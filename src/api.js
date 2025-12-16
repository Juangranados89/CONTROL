// API Client for backend communication
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

class ApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // ========== VEHICLES ==========
  async getVehicles() {
    return this.request('/api/vehicles');
  }

  async getVehicle(identifier) {
    return this.request(`/api/vehicles/${identifier}`);
  }

  async saveVehicle(vehicle) {
    return this.request('/api/vehicles', {
      method: 'POST',
      body: JSON.stringify(vehicle),
    });
  }

  async saveVehiclesBulk(vehicles) {
    return this.request('/api/vehicles/bulk', {
      method: 'POST',
      body: JSON.stringify(vehicles),
    });
  }

  async syncMaintenanceData() {
    return this.request('/api/vehicles/sync-maintenance', {
      method: 'POST',
    });
  }

  // ========== VARIABLES (MILEAGE HISTORY) ==========
  async getVariables(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/api/variables?${params}`);
  }

  async saveVariables(records) {
    return this.request('/api/variables', {
      method: 'POST',
      body: JSON.stringify(records),
    });
  }

  // ========== WORK ORDERS ==========
  async getWorkOrders(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/api/workorders?${params}`);
  }

  async createWorkOrder(workOrder) {
    return this.request('/api/workorders', {
      method: 'POST',
      body: JSON.stringify(workOrder),
    });
  }

  async updateWorkOrder(id, updates) {
    return this.request(`/api/workorders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }
}

export const api = new ApiClient(API_URL);
export default api;
