import { create } from 'zustand';

const useDashboardFilters = create((set) => ({
  selectedVehicle: null, // { code, plate }
  vehicleStatus: null, // 'OPERATIVO' | 'MANTENIMIENTO' | 'FUERA DE SERVICIO'
  maintenanceStatus: null, // 'VENCIDO' | 'PROXIMO' | 'OK'
  search: '',

  setSelectedVehicle: (vehicle) =>
    set(() => ({
      selectedVehicle: vehicle
        ? {
            code: vehicle.code || null,
            plate: vehicle.plate || null,
          }
        : null,
    })),

  clearSelectedVehicle: () => set(() => ({ selectedVehicle: null })),

  setVehicleStatus: (status) =>
    set(() => ({
      vehicleStatus: status ? String(status).toUpperCase() : null,
    })),

  toggleVehicleStatus: (status) =>
    set((state) => {
      const normalized = status ? String(status).toUpperCase() : null;
      if (!normalized) return { vehicleStatus: null };
      return { vehicleStatus: state.vehicleStatus === normalized ? null : normalized };
    }),

  clearVehicleStatus: () => set(() => ({ vehicleStatus: null })),

  setMaintenanceStatus: (status) =>
    set(() => ({
      maintenanceStatus: status ? String(status).toUpperCase() : null,
    })),

  toggleMaintenanceStatus: (status) =>
    set((state) => {
      const normalized = status ? String(status).toUpperCase() : null;
      if (!normalized) return { maintenanceStatus: null };
      return { maintenanceStatus: state.maintenanceStatus === normalized ? null : normalized };
    }),

  clearMaintenanceStatus: () => set(() => ({ maintenanceStatus: null })),

  setSearch: (value) => set(() => ({ search: String(value ?? '') })),
  clearSearch: () => set(() => ({ search: '' })),

  clearAll: () => set(() => ({ selectedVehicle: null, vehicleStatus: null, maintenanceStatus: null, search: '' })),
}));

export default useDashboardFilters;
