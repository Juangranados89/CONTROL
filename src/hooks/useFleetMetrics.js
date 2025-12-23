import { useMemo } from 'react';

export default function useFleetMetrics({ pickups, getNextRoutineLocal, getLastVariableDate, parseDateDDMMYYYY }) {
  return useMemo(() => {
    const today = new Date();
    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(today.getDate() - 5);

    return (pickups || []).reduce((acc, v) => {
      const nextRoutine = getNextRoutineLocal(v.mileage, v.model, v.lastMaintenance, v.maintenanceCycle);
      const kmRemaining = nextRoutine.km - v.mileage;

      const lastVarDate = getLastVariableDate(v);
      let isOutdated = !lastVarDate || v.mileage === 0;

      if (lastVarDate && !isOutdated) {
        const varDateObj = parseDateDDMMYYYY(lastVarDate);
        if (varDateObj) {
          varDateObj.setHours(0, 0, 0, 0);
          const fiveDaysAgoDate = new Date(fiveDaysAgo);
          fiveDaysAgoDate.setHours(0, 0, 0, 0);
          isOutdated = varDateObj < fiveDaysAgoDate;
        }
      }

      if (isOutdated) acc.outdated++;
      if (kmRemaining < 0) acc.overdue++;
      else if (kmRemaining < 1000) acc.upcoming++;
      else if (kmRemaining < 3000) acc.inRange++;
      else acc.ok++;

      return acc;
    }, { outdated: 0, overdue: 0, upcoming: 0, inRange: 0, ok: 0 });
  }, [pickups, getNextRoutineLocal, getLastVariableDate, parseDateDDMMYYYY]);
}
