import { MAINTENANCE_ROUTINES } from '../data';

export const detectRoutineVariant = (vehicleModel = '') => {
  const modelUpper = String(vehicleModel || '').toUpperCase();

  if (modelUpper.includes('RAM')) return 'RAM';
  if (modelUpper.includes('JMC')) return 'JMC';
  if (/\b700\b/.test(modelUpper) || modelUpper.includes('RAM 700')) return 'RAM';

  return null;
};

export const pickVariantRoutine = (baseRoutine, variantKey) => {
  if (!baseRoutine || typeof baseRoutine !== 'object') {
    return { name: 'Mantenimiento Estándar', items: [], supplies: [] };
  }

  const variants = baseRoutine.variants && typeof baseRoutine.variants === 'object' ? baseRoutine.variants : null;
  if (!variants) return baseRoutine;

  if (variantKey && variants?.[variantKey]) return variants[variantKey];

  const keys = Object.keys(variants).filter(k => variants[k]);
  if (keys.length === 1) return variants[keys[0]];

  return baseRoutine;
};

export const getNextRoutine = (mileage, vehicleModel = '') => {
  let intervals = Object.keys(MAINTENANCE_ROUTINES).map(Number).sort((a, b) => a - b);

  if (vehicleModel) {
    const variantKey = detectRoutineVariant(vehicleModel);
    if (variantKey) {
      const filtered = intervals.filter(interval => {
        const routine = MAINTENANCE_ROUTINES[interval];
        return routine?.variants && routine.variants[variantKey];
      });

      if (filtered.length > 0) intervals = filtered;
    }
  }

  if (intervals.length === 0) {
    return { km: 5000, name: 'Mantenimiento Estándar', items: [], supplies: [] };
  }

  const nextInterval = intervals.find(interval => interval > mileage);
  const targetInterval = nextInterval || intervals[intervals.length - 1];

  const baseRoutine = MAINTENANCE_ROUTINES[targetInterval] || { name: 'Mantenimiento Estándar', items: [], supplies: [], variants: {} };
  const variantKey = detectRoutineVariant(vehicleModel);
  const finalRoutine = pickVariantRoutine(baseRoutine, variantKey);

  return {
    km: targetInterval,
    ...finalRoutine
  };
};

export const calculateForecasting = (vehicle, history) => {
  if (!vehicle || !Array.isArray(history) || history.length < 2) {
    return { avgDailyKm: 0, estimatedDays: null, estimatedDate: null };
  }

  const vehicleHistory = history
    .filter(h => h.vehicleId === vehicle.id || h.plate === vehicle.plate || h.code === vehicle.code)
    .map(h => {
      let date;
      const raw = String(h.date || '').trim();
      const match = raw.match(/^([0-3]?\d)\/([01]?\d)\/(\d{4})/);
      if (match) {
        date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
      } else {
        date = new Date(raw);
      }
      return { ...h, parsedDate: date };
    })
    .filter(h => !Number.isNaN(h.parsedDate.getTime()))
    .sort((a, b) => b.parsedDate - a.parsedDate);

  if (vehicleHistory.length < 2) {
    return { avgDailyKm: 0, estimatedDays: null, estimatedDate: null };
  }

  const recentHistory = vehicleHistory.slice(0, 5);
  const newest = recentHistory[0];
  const oldest = recentHistory[recentHistory.length - 1];

  const kmDiff = (newest.km ?? newest.mileage ?? 0) - (oldest.km ?? oldest.mileage ?? 0);
  const timeDiffMs = newest.parsedDate - oldest.parsedDate;
  const daysDiff = timeDiffMs / (1000 * 60 * 60 * 24);

  if (daysDiff <= 0 || kmDiff <= 0) {
    return { avgDailyKm: 0, estimatedDays: null, estimatedDate: null };
  }

  const avgDailyKmRaw = kmDiff / daysDiff;

  const nextRoutine = getNextRoutine(vehicle.mileage, vehicle.model);
  const kmSinceLastMtto = (vehicle.mileage || 0) - (vehicle.lastMaintenance || 0);
  const kmRemaining = nextRoutine.km - kmSinceLastMtto;

  if (kmRemaining <= 0) {
    return {
      avgDailyKm: Number(avgDailyKmRaw.toFixed(2)),
      estimatedDays: 0,
      estimatedDate: new Date()
    };
  }

  const estimatedDays = Math.ceil(kmRemaining / avgDailyKmRaw);
  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + estimatedDays);

  return {
    avgDailyKm: Number(avgDailyKmRaw.toFixed(2)),
    estimatedDays,
    estimatedDate
  };
};
