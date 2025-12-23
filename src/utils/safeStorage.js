/**
 * Safe wrapper around localStorage/sessionStorage.
 * Gracefully handles Tracking Prevention / Private Browsing / SecurityError.
 */

const memoryFallback = new Map();

function testStorage(storage) {
  if (!storage) return false;
  const key = '__storage_test__';
  try {
    storage.setItem(key, '1');
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

const localStorageAvailable = typeof window !== 'undefined' && testStorage(window.localStorage);
const sessionStorageAvailable = typeof window !== 'undefined' && testStorage(window.sessionStorage);

function makeStorage(realStorage, available) {
  return {
    getItem(key) {
      if (available) {
        try {
          return realStorage.getItem(key);
        } catch {
          // Blocked
        }
      }
      return memoryFallback.get(key) ?? null;
    },
    setItem(key, value) {
      if (available) {
        try {
          realStorage.setItem(key, value);
          return;
        } catch {
          // Blocked or quota exceeded
        }
      }
      memoryFallback.set(key, String(value));
    },
    removeItem(key) {
      if (available) {
        try {
          realStorage.removeItem(key);
        } catch {
          // Blocked
        }
      }
      memoryFallback.delete(key);
    },
    clear() {
      if (available) {
        try {
          realStorage.clear();
        } catch {
          // Blocked
        }
      }
      memoryFallback.clear();
    },
    get length() {
      if (available) {
        try {
          return realStorage.length;
        } catch {
          // Blocked
        }
      }
      return memoryFallback.size;
    },
    key(index) {
      if (available) {
        try {
          return realStorage.key(index);
        } catch {
          // Blocked
        }
      }
      const keys = Array.from(memoryFallback.keys());
      return keys[index] ?? null;
    }
  };
}

export const safeLocalStorage = makeStorage(
  typeof window !== 'undefined' ? window.localStorage : null,
  localStorageAvailable
);

export const safeSessionStorage = makeStorage(
  typeof window !== 'undefined' ? window.sessionStorage : null,
  sessionStorageAvailable
);

export default safeLocalStorage;
