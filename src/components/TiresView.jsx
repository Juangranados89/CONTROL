import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Plus, X, ArrowLeft } from 'lucide-react';
import * as Recharts from 'recharts';
import api from '../api';
import { useDialog } from './DialogProvider.jsx';

const TireIcon = ({ colorClass, size = 24 }) => {
  // Map tailwind bg classes to fill colors
  const getFillColor = (cls) => {
    if (cls.includes('red')) return '#ef4444';
    if (cls.includes('amber')) return '#f59e0b';
    if (cls.includes('emerald')) return '#10b981';
    return '#cbd5e1'; // slate-300
  };

  const fillColor = getFillColor(colorClass);

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="inline-block drop-shadow-sm">
      {/* Tire Tread (Colored based on status) */}
      <circle cx="50" cy="50" r="48" fill={fillColor} stroke="#0f172a" strokeWidth="1" />
      
      {/* Inner dark circle to create the "tire wall" effect */}
      <circle cx="50" cy="50" r="36" fill="#1e293b" />

      {/* Treads details (dashed stroke on the colored part) */}
      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="8" strokeDasharray="6 3" />

      {/* Rim (Metallic/Grey) */}
      <circle cx="50" cy="50" r="22" fill="#94a3b8" />
      
      {/* Rim Detail (Bolts) */}
      <circle cx="50" cy="50" r="8" fill="#1e293b" opacity="0.6" />
      <circle cx="35" cy="35" r="2" fill="#1e293b" opacity="0.8" />
      <circle cx="65" cy="35" r="2" fill="#1e293b" opacity="0.8" />
      <circle cx="35" cy="65" r="2" fill="#1e293b" opacity="0.8" />
      <circle cx="65" cy="65" r="2" fill="#1e293b" opacity="0.8" />
    </svg>
  );
};

const TireWidget = ({ vehicleIdentifier, model }) => {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  // Heuristic for layout based on model name
  const layout = useMemo(() => {
    const m = (model || '').toUpperCase();
    if (m.includes('NPR') || m.includes('NHR') || m.includes('FVR') || m.includes('CAMION')) return 13;
    return 5;
  }, [model]);

  useEffect(() => {
    let mounted = true;
    api.getTireOverview(vehicleIdentifier, layout)
       .then(data => { if(mounted) setOverview(data); })
       .catch(() => {}) 
       .finally(() => { if(mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [vehicleIdentifier, layout]);

  if (loading) return <div className="h-8 w-32 bg-slate-100 animate-pulse rounded-lg"></div>;
  if (!overview) return <span className="text-xs text-slate-300">Sin datos</span>;

  const positions = overview.positions || [];
  
  // Helper to get color based on depth
  const getColor = (posId) => {
     const pos = positions.find(p => p.position === posId);
     if (!pos || !pos.lastInspection) return 'bg-slate-200';
     
     const insp = pos.lastInspection;
     const values = [insp.depthExt, insp.depthCen, insp.depthInt]
      .map((v) => (Number.isFinite(Number(v)) ? Number(v) : null))
      .filter((v) => v != null);
     
     if (values.length === 0) return 'bg-slate-300';
     const minDepth = Math.min(...values);

     if (minDepth <= 3) return 'bg-red-500';
     if (minDepth <= 5) return 'bg-amber-500';
     return 'bg-emerald-500';
  };

  // Calculate average depth for display
  const allDepths = positions.flatMap(p => {
      const insp = p.lastInspection;
      if (!insp) return [];
      return [insp.depthExt, insp.depthCen, insp.depthInt]
        .map(Number).filter(n => Number.isFinite(n));
  });
  const avgDepth = allDepths.length > 0 
    ? (allDepths.reduce((a,b)=>a+b,0) / allDepths.length).toFixed(1) 
    : '-';

  // Generate array of positions to render
  const renderPositions = Array.from({ length: layout === 13 ? 12 : 4 }, (_, i) => i + 1);

  return (
    <div className="flex items-center gap-4">
       {/* Horizontal Tire Icons */}
       <div className="flex items-center gap-1">
          {renderPositions.map(p => (
            <div key={p} title={`Posición ${p}`}>
              <TireIcon colorClass={getColor(p)} size={22} />
            </div>
          ))}
       </div>
       <div className="flex flex-col border-l border-slate-200 pl-3">
          <span className="text-xs font-bold text-slate-700">{avgDepth} mm</span>
          <span className="text-[10px] text-slate-500">Promedio</span>
       </div>
    </div>
  );
};

const TiresFleetTable = ({ fleet, onSelect }) => {
  const [filter, setFilter] = useState('');
  
  const filtered = useMemo(() => {
    if (!filter) return fleet;
    const lower = filter.toLowerCase();
    return fleet.filter(v => 
      (v.code && v.code.toLowerCase().includes(lower)) ||
      (v.plate && v.plate.toLowerCase().includes(lower)) ||
      (v.model && v.model.toLowerCase().includes(lower))
    );
  }, [fleet, filter]);

  return (
    <div className="h-full flex flex-col bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <div>
           <h2 className="text-lg font-bold text-slate-800">Control de Llantas</h2>
           <p className="text-xs text-slate-500">Seleccione un vehículo para ver detalles</p>
        </div>
        <input 
          type="text" 
          placeholder="Buscar vehículo..." 
          className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left relative">
          <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm text-xs font-bold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 border-r border-slate-200">Código</th>
              <th className="px-4 py-3 border-r border-slate-200">Placa</th>
              <th className="px-4 py-3 border-r border-slate-200">Modelo</th>
              <th className="px-4 py-3 border-r border-slate-200 w-48">Estado Llantas</th>
              <th className="px-4 py-3 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(vehicle => (
              <tr 
                key={vehicle.id} 
                className="hover:bg-blue-50 cursor-pointer transition-colors"
                onClick={() => onSelect(vehicle)}
              >
                <td className="px-4 py-3 font-mono text-sm text-slate-700 border-r border-slate-100">{vehicle.code}</td>
                <td className="px-4 py-3 font-bold text-sm text-slate-800 border-r border-slate-100">{vehicle.plate}</td>
                <td className="px-4 py-3 text-sm text-slate-600 border-r border-slate-100">{vehicle.model}</td>
                <td className="px-4 py-2 border-r border-slate-100">
                  <TireWidget vehicleIdentifier={String(vehicle.code || vehicle.plate || vehicle.id)} model={vehicle.model} />
                </td>
                <td className="px-4 py-3 text-center">
                  <button className="text-blue-600 hover:text-blue-800 text-xs font-bold uppercase border border-blue-200 px-2 py-1 rounded bg-blue-50">
                    Ver Detalle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-400 text-right">
        Total: {filtered.length} vehículos
      </div>
    </div>
  );
};

export default function TiresView({ fleet }) {
  // --- Helper Functions (Internalized to avoid TDZ) ---
  const normalizeLayout = (layout) => {
    const n = Number(layout);
    if (n === 5 || n === 11 || n === 13) return n;
    return 5;
  };

  const buildPositions = (layout) => {
    const n = normalizeLayout(layout);
    const result = [];
    for (let p = 1; p <= n; p++) {
      result.push({ position: p, label: p === n ? 'RE' : String(p) });
    }
    return result;
  };

  const safeDateLabel = (value) => {
    if (!value) return '—';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-CO');
  };

  const shortDateLabel = (value) => {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-CO', { month: 'short', day: '2-digit' });
  };

  const avg = (values) => {
    const nums = (Array.isArray(values) ? values : []).map(Number).filter((n) => Number.isFinite(n));
    if (nums.length === 0) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  };

  const minDepth = (insp) => {
    if (!insp) return null;
    const values = [insp.depthExt, insp.depthCen, insp.depthInt]
      .map((v) => (Number.isFinite(Number(v)) ? Number(v) : null))
      .filter((v) => v != null);
    if (values.length === 0) return null;
    return Math.min(...values);
  };

  const statusFromInspection = (insp) => {
    if (!insp) {
      return { dot: 'bg-slate-300', text: 'Sin inspección' };
    }

    const depth = minDepth(insp);
    const psi = Number.isFinite(Number(insp.psiCold)) ? Number(insp.psiCold) : null;

    if (insp.actionRemoveFromService || (depth != null && depth <= 3) || (psi != null && psi <= 25)) {
      return { dot: 'bg-red-500', text: 'Crítico' };
    }

    if ((depth != null && depth <= 5) || (psi != null && psi <= 30)) {
      return { dot: 'bg-amber-500', text: 'Atención' };
    }

    return { dot: 'bg-emerald-500', text: 'OK' };
  };

  const dialog = useDialog();
  const vehicles = useMemo(() => (Array.isArray(fleet) ? fleet : []).slice().sort((a, b) => String(a?.code || '').localeCompare(String(b?.code || ''))), [fleet]);

  const [selectedVehicleIdentifier, setSelectedVehicleIdentifier] = useState(null);
  const [layout, setLayout] = useState(5);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('estado'); // estado | inspeccion | analitica

  const [selectedPosition, setSelectedPosition] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [mountOps, setMountOps] = useState({
    tireMarking: '',
    eventDate: new Date().toISOString().slice(0, 10),
    toPosition: ''
  });

  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsInspections, setAnalyticsInspections] = useState([]);
  const [form, setForm] = useState({
    tireMarking: '',
    inspectedAt: new Date().toISOString().slice(0, 10),
    odometerKm: '',
    psiCold: '',
    depthExt: '',
    depthCen: '',
    depthInt: '',
    actionRotate: false,
    actionAlign: false,
    actionRemoveFromService: false,
    notes: ''
  });

  // Auto-select removed to show table by default

  const loadOverview = useCallback(async () => {
    if (!selectedVehicleIdentifier) return;
    setLoading(true);
    try {
      const data = await api.getTireOverview(selectedVehicleIdentifier, layout);
      setOverview(data);
    } catch (e) {
      await dialog.alert({
        title: 'Error',
        variant: 'danger',
        message: `No se pudo cargar el estado de llantas.\n${e?.message || e}`
      });
    } finally {
      setLoading(false);
    }
  }, [dialog, layout, selectedVehicleIdentifier]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // Keep selectedPosition within layout range
  useEffect(() => {
    if (selectedPosition && selectedPosition > layout) {
      setSelectedPosition(null);
    }
  }, [layout, selectedPosition]);

  const positions = useMemo(() => {
    const base = buildPositions(layout);
    const byPos = new Map((overview?.positions || []).map((p) => [p.position, p]));
    return base.map(({ position, label }) => ({
      position,
      label,
      mount: byPos.get(position)?.mount || null,
      lastInspection: byPos.get(position)?.lastInspection || null
    }));
  }, [layout, overview]);

  // --- Derived State (Moved UP to avoid TDZ in callbacks) ---
  const positionLabel = useMemo(() => {
    if (!selectedPosition) return '—';
    return selectedPosition === layout ? 'RE' : String(selectedPosition);
  }, [layout, selectedPosition]);

  const selectedPositionData = useMemo(() => {
    if (!selectedPosition) return null;
    return positions.find((p) => p.position === selectedPosition) || null;
  }, [positions, selectedPosition]);

  const openNewInspection = useCallback((pos) => {
    const existing = positions.find((p) => p.position === pos);
    const marking = existing?.mount?.tire?.marking || existing?.lastInspection?.tire?.marking || '';

    setSelectedPosition(pos);
    setMountOps((prev) => ({
      ...prev,
      tireMarking: String(marking || ''),
      eventDate: new Date().toISOString().slice(0, 10),
      toPosition: ''
    }));
    setForm((prev) => ({
      ...prev,
      tireMarking: marking,
      inspectedAt: new Date().toISOString().slice(0, 10),
      odometerKm: '',
      psiCold: '',
      depthExt: '',
      depthCen: '',
      depthInt: '',
      actionRotate: false,
      actionAlign: false,
      actionRemoveFromService: false,
      notes: ''
    }));

    if (activeTab === 'estado') {
      setShowModal(true);
    }
  }, [positions]);

  const doMount = useCallback(async () => {
    if (!selectedPosition) return;
    const tireMarking = String(mountOps.tireMarking || '').trim().toUpperCase();
    if (!tireMarking) {
      await dialog.alert({ title: 'Validación', variant: 'warning', message: 'La marcación de la llanta es obligatoria para montar.' });
      return;
    }

    const ok = await dialog.confirm({
      title: 'Confirmar montaje',
      variant: 'warning',
      message: `Se montará la llanta ${tireMarking} en la posición ${positionLabel}.\nSi había una llanta montada allí, se desmontará automáticamente.`
    });
    if (!ok) return;

    setLoading(true);
    try {
      await api.mountTire({
        vehicleIdentifier: selectedVehicleIdentifier,
        position: selectedPosition,
        tireMarking,
        mountedAt: mountOps.eventDate
      });
      await loadOverview();
      await dialog.alert({ title: 'Listo', variant: 'success', message: 'Montaje registrado.' });
    } catch (e) {
      await dialog.alert({ title: 'Error', variant: 'danger', message: `No se pudo montar la llanta.\n${e?.message || e}` });
    } finally {
      setLoading(false);
    }
  }, [dialog, loadOverview, mountOps.eventDate, mountOps.tireMarking, positionLabel, selectedPosition, selectedVehicleIdentifier]);

  const doDismount = useCallback(async () => {
    if (!selectedPosition) return;
    const mounted = selectedPositionData?.mount?.tire?.marking;
    if (!mounted) {
      await dialog.alert({ title: 'Validación', variant: 'warning', message: 'No hay una llanta montada en esta posición.' });
      return;
    }

    const ok = await dialog.confirm({
      title: 'Confirmar desmontaje',
      variant: 'warning',
      message: `Se desmontará la llanta ${mounted} de la posición ${positionLabel}.`
    });
    if (!ok) return;

    setLoading(true);
    try {
      await api.dismountTire({
        vehicleIdentifier: selectedVehicleIdentifier,
        position: selectedPosition,
        unmountedAt: mountOps.eventDate
      });
      await loadOverview();
      await dialog.alert({ title: 'Listo', variant: 'success', message: 'Desmontaje registrado.' });
    } catch (e) {
      await dialog.alert({ title: 'Error', variant: 'danger', message: `No se pudo desmontar.\n${e?.message || e}` });
    } finally {
      setLoading(false);
    }
  }, [dialog, loadOverview, mountOps.eventDate, positionLabel, selectedPosition, selectedPositionData, selectedVehicleIdentifier]);

  const doMove = useCallback(async () => {
    if (!selectedPosition) return;
    const mounted = selectedPositionData?.mount?.tire?.marking;
    if (!mounted) {
      await dialog.alert({ title: 'Validación', variant: 'warning', message: 'No hay una llanta montada en la posición de origen.' });
      return;
    }

    const toPos = Number(mountOps.toPosition);
    if (!Number.isFinite(toPos) || toPos <= 0) {
      await dialog.alert({ title: 'Validación', variant: 'warning', message: 'Seleccione una posición destino válida.' });
      return;
    }
    if (toPos === selectedPosition) {
      await dialog.alert({ title: 'Validación', variant: 'warning', message: 'La posición destino debe ser diferente.' });
      return;
    }

    const destLabel = toPos === layout ? 'RE' : String(toPos);
    const ok = await dialog.confirm({
      title: 'Confirmar rotación',
      variant: 'warning',
      message: `Se moverá la llanta ${mounted} de ${positionLabel} a ${destLabel}.\nSi el destino está ocupado, se desmontará automáticamente.`
    });
    if (!ok) return;

    setLoading(true);
    try {
      await api.moveTireMount({
        vehicleIdentifier: selectedVehicleIdentifier,
        fromPosition: selectedPosition,
        toPosition: toPos,
        movedAt: mountOps.eventDate
      });
      await loadOverview();
      await dialog.alert({ title: 'Listo', variant: 'success', message: 'Rotación registrada.' });
    } catch (e) {
      await dialog.alert({ title: 'Error', variant: 'danger', message: `No se pudo rotar.\n${e?.message || e}` });
    } finally {
      setLoading(false);
    }
  }, [dialog, layout, loadOverview, mountOps.eventDate, mountOps.toPosition, positionLabel, selectedPosition, selectedPositionData, selectedVehicleIdentifier]);

  const saveInspection = useCallback(async () => {
    if (!selectedPosition) return;

    const tireMarking = String(form.tireMarking || '').trim().toUpperCase();
    if (!tireMarking) {
      await dialog.alert({ title: 'Validación', variant: 'warning', message: 'La marcación de la llanta es obligatoria.' });
      return;
    }

    const payload = {
      vehicleIdentifier: selectedVehicleIdentifier,
      position: selectedPosition,
      tireMarking,
      inspectedAt: form.inspectedAt,
      odometerKm: form.odometerKm === '' ? null : Number(form.odometerKm),
      psiCold: form.psiCold === '' ? null : Number(form.psiCold),
      depthExt: form.depthExt === '' ? null : Number(form.depthExt),
      depthCen: form.depthCen === '' ? null : Number(form.depthCen),
      depthInt: form.depthInt === '' ? null : Number(form.depthInt),
      actionRotate: !!form.actionRotate,
      actionAlign: !!form.actionAlign,
      actionRemoveFromService: !!form.actionRemoveFromService,
      notes: String(form.notes || '').trim() || null
    };

    setLoading(true);
    try {
      await api.createTireInspection(payload);
      setShowModal(false);
      await loadOverview();
    } catch (e) {
      await dialog.alert({
        title: 'Error',
        variant: 'danger',
        message: `No se pudo guardar la inspección.\n${e?.message || e}`
      });
    } finally {
      setLoading(false);
    }
  }, [dialog, form, loadOverview, selectedPosition, selectedVehicleIdentifier]);

  const loadAnalytics = useCallback(async () => {
    if (!selectedVehicleIdentifier || !selectedPosition) {
      setAnalyticsInspections([]);
      return;
    }

    setAnalyticsLoading(true);
    try {
      const resp = await api.getTireInspectionsByVehicle(selectedVehicleIdentifier, { position: selectedPosition, take: 200 });
      const rows = Array.isArray(resp?.inspections) ? resp.inspections : [];
      setAnalyticsInspections(rows);
    } catch (e) {
      await dialog.alert({
        title: 'Error',
        variant: 'danger',
        message: `No se pudo cargar la analítica.\n${e?.message || e}`
      });
    } finally {
      setAnalyticsLoading(false);
    }
  }, [dialog, selectedPosition, selectedVehicleIdentifier]);

  useEffect(() => {
    if (activeTab !== 'analitica') return;
    loadAnalytics();
  }, [activeTab, loadAnalytics]);

  // Refresh analytics after saving inspection
  useEffect(() => {
    if (activeTab !== 'analitica') return;
    // analyticsInspections is updated only by loadAnalytics; here we do nothing.
  }, [activeTab, analyticsInspections]);

  const analyticsSeries = useMemo(() => {
    const rows = Array.isArray(analyticsInspections) ? analyticsInspections : [];
    // Chart wants ascending
    const sorted = rows
      .map((r) => {
        const inspectedAt = r?.inspectedAt;
        const depth = minDepth(r);
        const psi = Number.isFinite(Number(r?.psiCold)) ? Number(r.psiCold) : null;
        return {
          inspectedAt,
          dateLabel: shortDateLabel(inspectedAt),
          minDepth: depth,
          psi
        };
      })
      .filter((r) => r.inspectedAt)
      .sort((a, b) => new Date(a.inspectedAt) - new Date(b.inspectedAt));

    return sorted;
  }, [analyticsInspections]);

  const analyticsKpis = useMemo(() => {
    const rows = Array.isArray(analyticsInspections) ? analyticsInspections : [];
    const count = rows.length;
    const last = count > 0 ? rows[0] : null; // server returns desc
    const avgPsi = avg(rows.map((r) => r?.psiCold));
    const avgMinDepth = avg(rows.map((r) => minDepth(r)));
    const rotateCount = rows.filter((r) => r?.actionRotate).length;
    const alignCount = rows.filter((r) => r?.actionAlign).length;
    const removeCount = rows.filter((r) => r?.actionRemoveFromService).length;

    return {
      count,
      lastDate: last?.inspectedAt || null,
      avgPsi: avgPsi != null ? Number(avgPsi.toFixed(1)) : null,
      avgMinDepth: avgMinDepth != null ? Number(avgMinDepth.toFixed(1)) : null,
      rotateCount,
      alignCount,
      removeCount
    };
  }, [analyticsInspections]);

  const InspectionFields = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Marcación *</label>
        <input
          value={form.tireMarking}
          onChange={(e) => setForm((p) => ({ ...p, tireMarking: e.target.value }))}
          className="w-full px-3 py-2 border rounded-lg text-sm"
          placeholder="Ej: GO02382"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Fecha</label>
        <input
          type="date"
          value={form.inspectedAt}
          onChange={(e) => setForm((p) => ({ ...p, inspectedAt: e.target.value }))}
          className="w-full px-3 py-2 border rounded-lg text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Kilometraje (km)</label>
        <input
          type="number"
          value={form.odometerKm}
          onChange={(e) => setForm((p) => ({ ...p, odometerKm: e.target.value }))}
          className="w-full px-3 py-2 border rounded-lg text-sm"
          placeholder="Ej: 85000"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">PSI en frío</label>
        <input
          type="number"
          value={form.psiCold}
          onChange={(e) => setForm((p) => ({ ...p, psiCold: e.target.value }))}
          className="w-full px-3 py-2 border rounded-lg text-sm"
          placeholder="Ej: 32"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Profundidad EXT (mm)</label>
        <input
          type="number"
          step="0.1"
          value={form.depthExt}
          onChange={(e) => setForm((p) => ({ ...p, depthExt: e.target.value }))}
          className="w-full px-3 py-2 border rounded-lg text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Profundidad CEN (mm)</label>
        <input
          type="number"
          step="0.1"
          value={form.depthCen}
          onChange={(e) => setForm((p) => ({ ...p, depthCen: e.target.value }))}
          className="w-full px-3 py-2 border rounded-lg text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Profundidad INT (mm)</label>
        <input
          type="number"
          step="0.1"
          value={form.depthInt}
          onChange={(e) => setForm((p) => ({ ...p, depthInt: e.target.value }))}
          className="w-full px-3 py-2 border rounded-lg text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Acciones</label>
        <div className="flex flex-wrap gap-3 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.actionRotate}
              onChange={(e) => setForm((p) => ({ ...p, actionRotate: e.target.checked }))}
            />
            Rotar
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.actionAlign}
              onChange={(e) => setForm((p) => ({ ...p, actionAlign: e.target.checked }))}
            />
            Alinear
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.actionRemoveFromService}
              onChange={(e) => setForm((p) => ({ ...p, actionRemoveFromService: e.target.checked }))}
            />
            Sacar de servicio
          </label>
        </div>
      </div>

      <div className="md:col-span-2">
        <label className="block text-xs font-bold text-slate-700 mb-1">Observación</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          className="w-full px-3 py-2 border rounded-lg text-sm min-h-[90px]"
          placeholder="Notas de inspección"
        />
      </div>
    </div>
  );

  return (
    <>
      <TiresFleetTable fleet={vehicles} onSelect={(v) => setSelectedVehicleIdentifier(String(v.code || v.plate || v.id || ''))} />

      {selectedVehicleIdentifier && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-7xl h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                  <RefreshCw size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    {vehicles.find(v => String(v.code || v.plate || v.id) === selectedVehicleIdentifier)?.plate || 'Vehículo'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {vehicles.find(v => String(v.code || v.plate || v.id) === selectedVehicleIdentifier)?.code || selectedVehicleIdentifier} — Control de Llantas
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedVehicleIdentifier(null)}
                className="p-2 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
               <div className="flex items-center justify-end gap-2 mb-4">
                  <select
                    value={layout}
                    onChange={(e) => setLayout(Number(e.target.value))}
                    className="px-3 py-2 border rounded-lg text-sm bg-white shadow-sm"
                    title="Configuración de posiciones"
                  >
                    <option value={5}>Camioneta (4 + repuesto)</option>
                    <option value={11}>Camión (10 + repuesto)</option>
                    <option value={13}>Camión (12 + repuesto)</option>
                  </select>

                  <button
                    type="button"
                    onClick={loadOverview}
                    className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-white text-sm font-semibold flex items-center gap-2 shadow-sm"
                  >
                    <RefreshCw size={16} />
                    Actualizar
                  </button>
               </div>

               <div className="bg-white rounded-lg shadow border border-slate-200">
                  <div className="flex gap-2 p-2 border-b border-slate-200">
                    <button
                      type="button"
                      onClick={() => setActiveTab('estado')}
                      className={`px-4 py-2 text-sm font-bold rounded-lg ${activeTab === 'estado' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      Estado
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('inspeccion')}
                      className={`px-4 py-2 text-sm font-bold rounded-lg ${activeTab === 'inspeccion' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      Inspección
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('analitica')}
                      className={`px-4 py-2 text-sm font-bold rounded-lg ${activeTab === 'analitica' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      Analítica
                    </button>
                  </div>

                  {activeTab === 'estado' ? (
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-semibold text-slate-700">Posiciones</div>
                        {layout === 13 ? (
                          <div className="text-xs text-slate-500">En camión 12, pos. 11–12 pertenecen a dual.</div>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {positions.map((p) => {
                          const insp = p.lastInspection;
                          const mount = p.mount;
                          const status = statusFromInspection(insp);
                          const tireMark = mount?.tire?.marking || insp?.tire?.marking || '—';
                          const depth = minDepth(insp);
                          const isSelected = selectedPosition === p.position;

                          return (
                            <button
                              key={p.position}
                              type="button"
                              onClick={() => openNewInspection(p.position)}
                              className={`text-left p-3 rounded-lg border hover:bg-slate-50 ${isSelected ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200'}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="font-bold text-slate-800">{p.label}</div>
                                <div className={`w-3 h-3 rounded-full ${status.dot}`} title={status.text} />
                              </div>

                              <div className="mt-2 text-xs text-slate-500">Llanta</div>
                              <div className="text-sm font-semibold text-slate-700 truncate">{tireMark}</div>

                              <div className="mt-2 text-xs text-slate-500">Última inspección</div>
                              <div className="text-sm text-slate-700">{safeDateLabel(insp?.inspectedAt)}</div>

                              <div className="mt-2 grid grid-cols-2 gap-2">
                                <div>
                                  <div className="text-xs text-slate-500">PSI</div>
                                  <div className="text-sm text-slate-700">{insp?.psiCold ?? '—'}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-slate-500">Min mm</div>
                                  <div className="text-sm text-slate-700">{depth ?? '—'}</div>
                                </div>
                              </div>

                              <div className="mt-3 flex items-center gap-2 text-xs text-blue-600 font-semibold">
                                <Plus size={14} />
                                Nueva inspección
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : activeTab === 'inspeccion' ? (
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <div className="text-sm font-semibold text-slate-700">Inspección (Gemelo Digital)</div>
                          <div className="text-xs text-slate-500">Seleccione una posición y complete la inspección.</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedPosition || ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (!v) return;
                              openNewInspection(Number(v));
                            }}
                            className="px-3 py-2 border rounded-lg text-sm bg-white"
                          >
                            <option value="">Seleccionar posición…</option>
                            {positions.map((p) => (
                              <option key={p.position} value={p.position}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-1 bg-slate-50 rounded-lg border border-slate-200 p-4">
                          <div className="text-sm font-bold text-slate-800">Resumen</div>
                          <div className="mt-2 text-sm text-slate-700">
                            <div><span className="text-slate-500">Posición:</span> <span className="font-semibold">{positionLabel}</span></div>
                            <div className="mt-1"><span className="text-slate-500">Llanta:</span> <span className="font-semibold">{selectedPositionData?.mount?.tire?.marking || selectedPositionData?.lastInspection?.tire?.marking || '—'}</span></div>
                            <div className="mt-1"><span className="text-slate-500">Últ. inspección:</span> <span className="font-semibold">{safeDateLabel(selectedPositionData?.lastInspection?.inspectedAt)}</span></div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <div className="text-sm font-bold text-slate-800">Montaje / Rotación</div>
                            <div className="mt-2 grid grid-cols-1 gap-2">
                              <div>
                                <div className="text-xs text-slate-500">Fecha</div>
                                <input
                                  type="date"
                                  value={mountOps.eventDate}
                                  onChange={(e) => setMountOps((prev) => ({ ...prev, eventDate: e.target.value }))}
                                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white"
                                  disabled={!selectedPosition || loading}
                                />
                              </div>

                              <div>
                                <div className="text-xs text-slate-500">Marcación (montar/reemplazar)</div>
                                <input
                                  type="text"
                                  value={mountOps.tireMarking}
                                  onChange={(e) => setMountOps((prev) => ({ ...prev, tireMarking: e.target.value }))}
                                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white"
                                  placeholder="Ej: 275/70R22.5-ABC123"
                                  disabled={!selectedPosition || loading}
                                />
                              </div>

                              <button
                                type="button"
                                onClick={doMount}
                                disabled={!selectedPosition || loading}
                                className="px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-sm font-semibold"
                              >
                                Montar / Reemplazar
                              </button>

                              <button
                                type="button"
                                onClick={doDismount}
                                disabled={!selectedPosition || loading}
                                className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-semibold"
                              >
                                Desmontar
                              </button>

                              <div className="grid grid-cols-2 gap-2">
                                <select
                                  value={mountOps.toPosition}
                                  onChange={(e) => setMountOps((prev) => ({ ...prev, toPosition: e.target.value }))}
                                  className="px-3 py-2 border rounded-lg text-sm bg-white"
                                  disabled={!selectedPosition || loading}
                                >
                                  <option value="">Destino…</option>
                                  {positions
                                    .filter((p) => p.position !== selectedPosition)
                                    .map((p) => (
                                      <option key={p.position} value={p.position}>
                                        {p.label}
                                      </option>
                                    ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={doMove}
                                  disabled={!selectedPosition || loading}
                                  className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold"
                                >
                                  Rotar
                                </button>
                              </div>

                              <div className="text-xs text-slate-500">
                                Tip: “Rotar” mueve la llanta actual de la posición seleccionada.
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-4">
                          {!selectedPosition ? (
                            <div className="text-sm text-slate-500">Seleccione una posición para iniciar.</div>
                          ) : (
                            <>
                              {InspectionFields}
                              <div className="mt-4 flex justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={loading || !selectedPosition}
                                  onClick={saveInspection}
                                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold"
                                >
                                  Guardar
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4">
                      <div className="text-sm font-semibold text-slate-700">Analítica</div>
                      <div className="mt-2 text-sm text-slate-500">Tendencia por posición (desgaste y PSI) y acciones registradas.</div>

                      <div className="mt-4 flex items-center gap-2 flex-wrap">
                        <select
                          value={selectedPosition || ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) {
                              setSelectedPosition(null);
                              return;
                            }
                            setSelectedPosition(Number(v));
                          }}
                          className="px-3 py-2 border rounded-lg text-sm bg-white"
                        >
                          <option value="">Seleccionar posición…</option>
                          {positions.map((p) => (
                            <option key={p.position} value={p.position}>
                              {p.label}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={loadAnalytics}
                          className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold flex items-center gap-2"
                          disabled={!selectedPosition || analyticsLoading}
                        >
                          <RefreshCw size={16} />
                          Actualizar
                        </button>

                        {analyticsLoading ? <div className="text-xs text-slate-500">Cargando…</div> : null}
                      </div>

                      {!selectedPosition ? (
                        <div className="mt-4 text-sm text-slate-500">Seleccione una posición para ver su tendencia.</div>
                      ) : (
                        <>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                              <div className="text-xs text-slate-500">Inspecciones (últimas)</div>
                              <div className="text-2xl font-bold text-slate-800 mt-1">{analyticsKpis.count}</div>
                              <div className="text-xs text-slate-500 mt-1">Última: {safeDateLabel(analyticsKpis.lastDate)}</div>
                            </div>
                            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                              <div className="text-xs text-slate-500">Prom. PSI</div>
                              <div className="text-2xl font-bold text-slate-800 mt-1">{analyticsKpis.avgPsi ?? '—'}</div>
                              <div className="text-xs text-slate-500 mt-1">(últimas {analyticsKpis.count || 0})</div>
                            </div>
                            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                              <div className="text-xs text-slate-500">Prom. min profundidad (mm)</div>
                              <div className="text-2xl font-bold text-slate-800 mt-1">{analyticsKpis.avgMinDepth ?? '—'}</div>
                              <div className="text-xs text-slate-500 mt-1">Rotar: {analyticsKpis.rotateCount} · Alinear: {analyticsKpis.alignCount} · Sacar: {analyticsKpis.removeCount}</div>
                            </div>
                          </div>

                          <div className="mt-4 bg-white rounded-lg border border-slate-200 p-4">
                            <div className="text-sm font-semibold text-slate-700 mb-2">Tendencia</div>
                            {analyticsSeries.length < 2 ? (
                              <div className="text-sm text-slate-500">Se requiere más de una inspección para graficar.</div>
                            ) : (
                              <div className="h-[260px]">
                                <Recharts.ResponsiveContainer width="100%" height="100%">
                                  <Recharts.LineChart data={analyticsSeries} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                                    <Recharts.CartesianGrid strokeDasharray="3 3" />
                                    <Recharts.XAxis dataKey="dateLabel" />
                                    <Recharts.YAxis yAxisId="left" domain={['auto', 'auto']} />
                                    <Recharts.YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} />
                                    <Recharts.Tooltip />
                                    <Recharts.Legend />
                                    <Recharts.Line yAxisId="left" type="monotone" dataKey="minDepth" name="Min profundidad (mm)" stroke="#2563eb" strokeWidth={2} dot={false} />
                                    <Recharts.Line yAxisId="right" type="monotone" dataKey="psi" name="PSI (frío)" stroke="#10b981" strokeWidth={2} dot={false} />
                                  </Recharts.LineChart>
                                </Recharts.ResponsiveContainer>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Existing Modal for New Inspection (Nested Modal) */}
      {showModal && selectedPosition ? (
        <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-slate-800">Nueva inspección</div>
                <div className="text-sm text-slate-500">Posición: {positionLabel}</div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg hover:bg-slate-50"
                aria-label="Cerrar"
              >
                <X size={18} className="text-slate-600" />
              </button>
            </div>

            <div className="p-5">{InspectionFields}</div>

            <div className="p-5 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={saveInspection}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
