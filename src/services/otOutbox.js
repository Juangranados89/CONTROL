const OUTBOX_KEY = 'ot_outbox_v1';

const nowIso = () => new Date().toISOString();

const load = () => {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const save = (queue) => {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(Array.isArray(queue) ? queue : []));
  } catch {
    // ignore
  }
};

const genId = () => `op-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const getOutboxQueue = () => load();

export const getOutboxPendingCount = () => load().length;

export const enqueueOtOp = (op) => {
  const base = {
    id: genId(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    retries: 0,
    lastError: null,
    ...op
  };

  const queue = load();
  const next = [base, ...queue];
  save(next);
  return base;
};

export const replaceWorkOrderIdInOutbox = (oldId, newId) => {
  if (!oldId || !newId || oldId === newId) return;
  const queue = load();
  const next = queue.map((op) => {
    const updated = { ...op };

    if (updated.workOrderId === oldId) updated.workOrderId = newId;

    if (updated.type === 'OT_CREATE' && updated.payload?.id === oldId) {
      updated.payload = { ...updated.payload, id: newId };
    }

    if (updated.type === 'OT_UPDATE' && updated.updates?.id === oldId) {
      updated.updates = { ...updated.updates, id: newId };
    }

    return updated;
  });
  save(next);
};

const classifyError = (error) => {
  const status = error?.status;
  const isAuth = status === 401 || status === 403;
  const isNetwork = !status && (error?.name === 'TypeError' || String(error?.message || '').toLowerCase().includes('failed to fetch'));
  const isServer = status >= 500;
  return { status, isAuth, isNetwork, isServer };
};

export const flushOtOutbox = async ({ api, onCreated, onProgress } = {}) => {
  if (!api) throw new Error('flushOtOutbox requires api');

  let queue = load();
  const result = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    remaining: queue.length,
    needsAuth: false,
    lastError: null
  };

  for (const op of queue.slice().reverse()) {
    // Process oldest first for better ordering.
    try {
      onProgress?.({ phase: 'processing', op, result });

      if (op.type === 'OT_CREATE') {
        const payload = op.payload || {};
        const tempId = payload?.id || null;
        const saved = await api.createWorkOrder(payload);

        if (tempId && saved?.id && tempId !== saved.id) {
          replaceWorkOrderIdInOutbox(tempId, saved.id);
          onCreated?.({ tempId, savedOT: saved });
        } else {
          onCreated?.({ tempId, savedOT: saved });
        }
      } else if (op.type === 'OT_UPDATE') {
        if (!op.workOrderId) throw new Error('OT_UPDATE missing workOrderId');
        await api.updateWorkOrder(op.workOrderId, op.updates || {});
      } else if (op.type === 'OT_DELETE') {
        if (!op.workOrderId) throw new Error('OT_DELETE missing workOrderId');
        try {
          await api.deleteWorkOrder(op.workOrderId);
        } catch (e) {
          if (e?.status === 404) {
            // Already gone; treat as success.
          } else {
            throw e;
          }
        }
      } else {
        throw new Error(`Unknown outbox op type: ${op.type}`);
      }

      result.processed += 1;
      result.succeeded += 1;

      // Remove op from queue.
      queue = load().filter((x) => x.id !== op.id);
      save(queue);
      result.remaining = queue.length;
      onProgress?.({ phase: 'succeeded', op, result });
    } catch (error) {
      const { isAuth, isNetwork, isServer } = classifyError(error);
      result.processed += 1;
      result.failed += 1;
      result.lastError = error;

      // Update op with failure metadata.
      const current = load();
      const next = current.map((x) => {
        if (x.id !== op.id) return x;
        return {
          ...x,
          retries: Number(x.retries || 0) + 1,
          updatedAt: nowIso(),
          lastError: {
            at: nowIso(),
            message: String(error?.message || error),
            status: error?.status || null
          }
        };
      });
      save(next);

      onProgress?.({ phase: 'failed', op, result });

      // Stop early on auth/network/server errors to avoid spamming.
      if (isAuth) {
        result.needsAuth = true;
        break;
      }
      if (isNetwork || isServer) {
        break;
      }

      // For other 4xx, continue with next ops (best-effort).
    }
  }

  return result;
};
