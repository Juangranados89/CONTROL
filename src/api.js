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
        let body = null;
        try {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            body = await response.json();
          } else {
            body = await response.text();
          }
        } catch {
          body = null;
        }

        const err = new Error(`HTTP ${response.status}: ${response.statusText}`);
        err.status = response.status;
        err.endpoint = endpoint;
        err.body = body;
        throw err;
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

  async deleteWorkOrder(id) {
    return this.request(`/api/workorders/${id}`, {
      method: 'DELETE'
    });
  }

  async ping() {
    // Production: call /health on API host (no auth needed)
    if (this.baseURL) {
      const res = await fetch(`${this.baseURL}/health`);
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
        err.status = res.status;
        throw err;
      }
      return await res.json();
    }

    // Dev/same-origin: use a lightweight authed call via proxy
    return this.request('/api/workorders');
  }

  // ========== WORK ORDER AUDIT / BITACORA ==========
  async getWorkOrderAudit(id) {
    return this.request(`/api/workorders/${id}/audit`);
  }

  async addWorkOrderNote(id, message) {
    return this.request(`/api/workorders/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  }

  // ========== TIRES (CONTROL DE LLANTAS) ==========
  async getTireOverview(vehicleIdentifier, layout = 5) {
    const params = new URLSearchParams({ layout: String(layout) });
    return this.request(`/api/tires/vehicles/${encodeURIComponent(vehicleIdentifier)}/overview?${params}`);
  }

  async createTireInspection(payload) {
    return this.request('/api/tires/inspections', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async getTireInspectionsByVehicle(vehicleIdentifier, options = {}) {
    const params = new URLSearchParams();
    if (options.position != null && String(options.position).trim() !== '') params.set('position', String(options.position));
    if (options.take != null) params.set('take', String(options.take));
    if (options.skip != null) params.set('skip', String(options.skip));
    return this.request(`/api/tires/vehicles/${encodeURIComponent(vehicleIdentifier)}/inspections?${params}`);
  }

  async getTireInspectionsByTireMarking(marking, options = {}) {
    const params = new URLSearchParams();
    if (options.take != null) params.set('take', String(options.take));
    if (options.skip != null) params.set('skip', String(options.skip));
    return this.request(`/api/tires/tires/${encodeURIComponent(marking)}/inspections?${params}`);
  }

  async mountTire(payload) {
    return this.request('/api/tires/mounts/mount', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async dismountTire(payload) {
    return this.request('/api/tires/mounts/dismount', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async moveTireMount(payload) {
    return this.request('/api/tires/mounts/move', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
}

export const api = new ApiClient(API_URL);
export default api;
