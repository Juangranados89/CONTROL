// API Client for backend communication
// Dev: always use same-origin + Vite proxy (/api -> http://localhost:4000)
// This prevents accidental usage of production API URLs inside Codespaces/dev.
const API_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:4000');

class ApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = localStorage.getItem('auth_token');

    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    // Allow callers to explicitly remove Authorization
    if (headers.Authorization === undefined) {
      delete headers.Authorization;
    }

    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers,
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

  // ========== AUTH ==========
  async login(email, password) {
    return this.request('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      // Explicitly avoid attaching an old token if present
      headers: { Authorization: undefined }
    });
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
