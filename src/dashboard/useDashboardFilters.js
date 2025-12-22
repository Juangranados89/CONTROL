import { create } from 'zustand';

const useDashboardFilters = create((set) => ({
  selectedVehicle: null, // { code, plate }
  vehicleStatus: null, // 'OPERATIVO' | 'MANTENIMIENTO' | 'FUERA DE SERVICIO'
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

  setSearch: (value) => set(() => ({ search: String(value ?? '') })),
  clearSearch: () => set(() => ({ search: '' })),

  clearAll: () => set(() => ({ selectedVehicle: null, vehicleStatus: null, search: '' })),
}));

export default useDashboardFilters;
