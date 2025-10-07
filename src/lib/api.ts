import axios from 'axios';
import Cookies from 'js-cookie';
import type { Plan } from '../types/plan';
import type { Organization, StrategicObjective, Program, StrategicInitiative, PerformanceMeasure } from '../types/organization';
import type { AuthState } from '../types/user';

// Create a base API instance
export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json, */*',
  },
  withCredentials: true,
});

// Add request interceptor to update CSRF token before each request
api.interceptors.request.use(config => {
  const token = Cookies.get('csrftoken');
  if (token) {
    config.headers['X-CSRFToken'] = token;
  }
  return config;
}, error => {
  console.error('Request interceptor error:', error);
  return Promise.reject(error);
});

// Add response interceptor to handle authentication errors
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Clear cookies and redirect to login
      Cookies.remove('sessionid', { path: '/' });
      Cookies.remove('csrftoken', { path: '/' });
      
      // Redirect after short delay to ensure cookies are cleared
      setTimeout(() => {
        window.location.href = '/login';
      }, 100);
    }
    return Promise.reject(error);
  }
);

// Enhanced CSRF token handling
const ensureCsrfToken = async () => {
  try {
    let token = Cookies.get('csrftoken');
    if (token) return token;
    
    // Try multiple endpoints to get CSRF token
    await Promise.allSettled([
      axios.get('/api/auth/csrf/', { withCredentials: true }),
      axios.get('/api/auth/check/', { withCredentials: true })
    ]);
    
    token = Cookies.get('csrftoken');
    if (!token) throw new Error('CSRF token not found after refresh');
    
    return token;
  } catch (error) {
    console.error('Failed to ensure CSRF token:', error);
    throw error;
  }
};

// Dedicated function to get a CSRF token
export const csrf = async () => {
  return ensureCsrfToken();
};

// Authentication service with enhanced session handling
export const auth = {
  login: async (username: string, password: string) => {
    try {
      await ensureCsrfToken();
      const response = await api.post('/auth/login/', { username, password });
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('Login error:', error.response?.data || error);
      return { success: false, error: error.response?.data?.detail || 'Login failed' };
    }
  },
  
  logout: async () => {
    try {
      try {
        await ensureCsrfToken();
      } catch (err) {
        console.warn("Failed to refresh CSRF token before logout:", err);
      }
      
      const csrfToken = Cookies.get('csrftoken');
      
      try {
        await axios.post('/api/auth/logout/', {}, {
          headers: {
            'X-CSRFToken': csrfToken || '',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Accept': 'application/json'
          },
          withCredentials: true
        });
      } catch (err) {
        console.warn("Logout request failed but proceeding anyway:", err);
      }
      
      // Always remove cookies regardless of response
      Cookies.remove('sessionid', { path: '/' });
      Cookies.remove('csrftoken', { path: '/' });
      
      // Force reload to the login page after a brief timeout
      setTimeout(() => {
        window.location.href = '/login';
      }, 100);
      
      return { success: true };
    } catch (error: any) {
      console.error('Logout error:', error);
      Cookies.remove('sessionid', { path: '/' });
      Cookies.remove('csrftoken', { path: '/' });
      setTimeout(() => {
        window.location.href = '/login';
      }, 100);
      return { success: false, error: error.message };
    }
  },
  
  updateProfile: async (data: { first_name?: string; last_name?: string; email?: string }) => {
    try {
      await ensureCsrfToken();
      const response = await api.patch('/auth/profile/', data);
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('Profile update error:', error);
      return { success: false, error: error.response?.data?.detail || 'Failed to update profile' };
    }
  },
  
  changePassword: async (data: { current_password: string; new_password: string }) => {
    try {
      await ensureCsrfToken();
      const response = await api.post('/auth/password_change/', data);
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('Password change error:', error);
      return { success: false, error: error.response?.data?.detail || 'Failed to change password' };
    }
  },
  
  checkAuth: async () => {
    try {
      const response = await api.get('/auth/check/');
      return response.data;
    } catch (error) {
      console.error('Auth check error:', error);
      return { isAuthenticated: false };
    }
  },
  
  getCurrentUser: async (retry = true): Promise<AuthState> => {
    try {
      const response = await api.get('/auth/check/');
      return {
        isAuthenticated: response.data.isAuthenticated,
        user: response.data.user,
        userOrganizations: response.data.userOrganizations || []
      };
    } catch (error: any) {
      console.error('Get current user error:', error);
      
      // Retry once if we get a 401 error
      if (error.response?.status === 401 && retry) {
        try {
          await ensureCsrfToken();
          return auth.getCurrentUser(false);
        } catch (refreshError) {
          console.error('CSRF refresh failed:', refreshError);
        }
      }
      
      return { isAuthenticated: false, user: null, userOrganizations: [] };
    }
  },
  
  isAuthenticated: () => {
    return !!Cookies.get('sessionid');
  },
  
  csrf: async () => {
    return csrf();
  }
};

// Session keep-alive function
const SESSION_REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes
let sessionRefreshTimer: NodeJS.Timeout | null = null;

export const startSessionRefresh = () => {
  if (sessionRefreshTimer) clearInterval(sessionRefreshTimer);
  
  sessionRefreshTimer = setInterval(async () => {
    try {
      await auth.getCurrentUser();
    } catch (error) {
      console.log('Session refresh failed', error);
    }
  }, SESSION_REFRESH_INTERVAL);
};

export const stopSessionRefresh = () => {
  if (sessionRefreshTimer) {
    clearInterval(sessionRefreshTimer);
    sessionRefreshTimer = null;
  }
};

// Initiative Feed API
export const initiativeFeeds = {
  getAll: async () => {
    try {
      const response = await api.get('/initiative-feeds/');
      return response;
    } catch (error) {
      console.error('Failed to fetch initiative feeds:', error);
      throw error;
    }
  },
  
  getByObjective: async (objectiveId: string) => {
    try {
      const response = await api.get(`/initiative-feeds/?strategic_objective=${objectiveId}`);
      return response;
    } catch (error) {
      console.error(`Failed to fetch initiative feeds for objective ${objectiveId}:`, error);
      throw error;
    }
  },
  
  getById: async (id: string) => {
    try {
      const response = await api.get(`/initiative-feeds/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch initiative feed ${id}:`, error);
      throw error;
    }
  },
  
  create: async (data: any) => {
    try {
      const response = await api.post('/initiative-feeds/', data);
      return response.data;
    } catch (error) {
      console.error('Failed to create initiative feed:', error);
      throw error;
    }
  },
  
  update: async (id: string, data: any) => {
    try {
      const response = await api.patch(`/initiative-feeds/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error(`Failed to update initiative feed ${id}:`, error);
      throw error;
    }
  },
  
  delete: async (id: string) => {
    try {
      await api.delete(`/initiative-feeds/${id}/`);
      return { success: true };
    } catch (error) {
      console.error(`Failed to delete initiative feed ${id}:`, error);
      throw error;
    }
  }
};

// Locations API
export const locations = {
  getAll: async () => {
    try {
      const timestamp = new Date().getTime();
      const response = await api.get(`/locations/?_=${timestamp}`);
      return response;
    } catch (error) {
      console.error('Failed to fetch locations:', error);
      return { data: [] };
    }
  },

  getById: async (id: string) => {
    try {
      const response = await api.get(`/locations/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch location ${id}:`, error);
      throw error;
    }
  }
};

// Land Transports API
export const landTransports = {
  getAll: async () => {
    try {
      const timestamp = new Date().getTime();
      const response = await api.get('/land-transports/', {
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch land transports:', error);
      return { data: [] };
    }
  },
  
  getById: async (id: string) => {
    try {
      const response = await api.get(`/land-transports/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch land transport ${id}:`, error);
      throw error;
    }
  }
};

// Air Transports API
export const airTransports = {
  getAll: async () => {
    try {
      const timestamp = new Date().getTime();
      const response = await api.get('/air-transports/', {
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch air transports:', error);
      return { data: [] };
    }
  },
  
  getById: async (id: string) => {
    try {
      const response = await api.get(`/air-transports/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch air transport ${id}:`, error);
      throw error;
    }
  }
};

// Per Diems API
export const perDiems = {
  getAll: async () => {
    try {
      const timestamp = new Date().getTime();
      const response = await api.get(`/per-diems/?_=${timestamp}`);
      return response;
    } catch (error) {
      console.error('Failed to fetch per diems:', error);
      throw error;
    }
  },
  
  getById: async (id: string) => {
    try {
      const response = await api.get(`/per-diems/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch per diem ${id}:`, error);
      throw error;
    }
  }
};

// Accommodations API
export const accommodations = {
  getAll: async () => {
    try {
      const timestamp = new Date().getTime();
      const response = await api.get(`/accommodations/?_=${timestamp}`);
      return response;
    } catch (error) {
      console.error('Failed to fetch accommodations:', error);
      return { data: [] };
    }
  },
  
  getById: async (id: string) => {
    try {
      const response = await api.get(`/accommodations/${id}/`);
      return response;
    } catch (error) {
      console.error(`Failed to fetch accommodation ${id}:`, error);
      throw error;
    }
  }
};

// Participant Costs API
export const participantCosts = {
  getAll: async () => {
    try {
      const timestamp = new Date().getTime();
      const response = await api.get(`/participant-costs/?_=${timestamp}`);
      return response;
    } catch (error) {
      console.error('Failed to fetch participant costs:', error);
      return { data: [] };
    }
  },
  
  getById: async (id: string) => {
    try {
      const response = await api.get(`/participant-costs/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch participant cost ${id}:`, error);
      throw error;
    }
  }
};

// Session Costs API
export const sessionCosts = {
  getAll: async () => {
    try {
      const timestamp = new Date().getTime();
      const response = await api.get(`/session-costs/?_=${timestamp}`);
      return response;
    } catch (error) {
      console.error('Failed to fetch session costs:', error);
      return { data: [] };
    }
  },
  
  getById: async (id: string) => {
    try {
      const response = await api.get(`/session-costs/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch session cost ${id}:`, error);
      throw error;
    }
  }
};

// Printing Costs API
export const printingCosts = {
  getAll: async () => {
    try {
      const timestamp = new Date().getTime();
      const response = await api.get(`/printing-costs/?_=${timestamp}`);
      return response;
    } catch (error) {
      console.error('Failed to fetch printing costs:', error);
      return { data: [] };
    }
  },
  
  getById: async (id: string) => {
    try {
      const response = await api.get(`/printing-costs/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch printing cost ${id}:`, error);
      throw error;
    }
  }
};

// Supervisor Costs API
export const supervisorCosts = {
  getAll: async () => {
    try {
      const timestamp = new Date().getTime();
      const response = await api.get(`/supervisor-costs/?_=${timestamp}`);
      return response;
    } catch (error) {
      console.error('Failed to fetch supervisor costs:', error);
      return { data: [] };
    }
  },
  
  getById: async (id: string) => {
    try {
      const response = await api.get(`/supervisor-costs/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch supervisor cost ${id}:`, error);
      throw error;
    }
  }
};

// Procurement Items API
export const procurementItems = {
  getAll: async () => {
    try {
      const timestamp = new Date().getTime();
      const response = await api.get(`/procurement-items/?_=${timestamp}`);
      return response;
    } catch (error) {
      console.error('Failed to fetch procurement items:', error);
      return { data: [] };
    }
  },
  
  getById: async (id: string) => {
    try {
      const response = await api.get(`/procurement-items/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch procurement item ${id}:`, error);
      throw error;
    }
  },
  
  getByCategory: async (category: string) => {
    try {
      const response = await api.get(`/procurement-items/?category=${category}`);
      return response;
    } catch (error) {
      console.error(`Failed to fetch procurement items for category ${category}:`, error);
      return { data: [] };
    }
  }
};

// Organizations service
export const organizations = {
  async getAll() {
    try {
      const timestamp = new Date().getTime();
      const response = await api.get(`/organizations/?_=${timestamp}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get organizations:', error);
      throw error;
    }
  },
  
  async getById(id: string) {
    try {
      const response = await api.get(`/organizations/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Failed to get organization ${id}:`, error);
      throw error;
    }
  },
  
  async update(id: string, data: any) {
    try {
      const response = await api.patch(`/organizations/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error(`Failed to update organization ${id}:`, error);
      throw error;
    }
  },
  
  async create(data: any) {
    try {
      const response = await api.post('/organizations/', data);
      return response.data;
    } catch (error) {
      console.error('Failed to create organization:', error);
      throw error;
    }
  },
  
  async delete(id: string) {
    try {
      const response = await api.delete(`/organizations/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Failed to delete organization ${id}:`, error);
      throw error;
    }
  },
  
  async getImplementingOrganizations() {
    try {
      const allOrganizations = await this.getAll();
      
      if (!Array.isArray(allOrganizations)) {
        return [];
      }
      
      return allOrganizations.filter((org: Organization) => {
        return ['EXECUTIVE', 'TEAM_LEAD', 'DESK'].includes(org.type);
      });
    } catch (error) {
      console.error('Failed to get implementing organizations:', error);
      return [];
    }
  }
};

// Strategic objectives service
export const objectives = {
  async getAll() {
    try {
      console.log('API: Fetching all strategic objectives...');
      const response = await api.get('/strategic-objectives/');
      
      // Ensure we have valid data structure
      if (!response.data) {
        console.error('API: No data received from objectives endpoint');
        return { data: [] };
      }
      
      // Handle different response formats
      let objectivesData = response.data;
      if (objectivesData.data && Array.isArray(objectivesData.data)) {
        objectivesData = objectivesData.data;
      } else if (objectivesData.results && Array.isArray(objectivesData.results)) {
        objectivesData = objectivesData.results;
      } else if (!Array.isArray(objectivesData)) {
        console.warn('API: Unexpected objectives data format:', objectivesData);
        return { data: [] };
      }
      
      // Validate and clean each objective
      const cleanedObjectives = objectivesData.map((obj: any) => {
        if (!obj) return null;
        
        return {
          ...obj,
          id: obj.id,
          title: obj.title || 'Untitled Objective',
          description: obj.description || '',
          weight: Number(obj.weight) || 0,
          planner_weight: obj.planner_weight !== null ? Number(obj.planner_weight) : null,
          effective_weight: Number(obj.effective_weight) || Number(obj.weight) || 0,
          is_default: Boolean(obj.is_default),
          programs: Array.isArray(obj.programs) ? obj.programs : [],
          initiatives: Array.isArray(obj.initiatives) ? obj.initiatives : [],
          total_initiatives_weight: Number(obj.total_initiatives_weight) || 0
        };
      }).filter(Boolean); // Remove null entries
      
      console.log(`API: Successfully loaded ${cleanedObjectives.length} strategic objectives`);
      return { data: cleanedObjectives };
      
    } catch (error) {
      console.error('API: Error fetching strategic objectives:', error);
      
      // Return empty data instead of throwing to prevent blank page
      return { 
        data: [],
        error: error.message || 'Failed to load strategic objectives'
      };
    }
  },
  
  async getById(id: string) {
    try {
      console.log(`API: Fetching strategic objective ${id}...`);
      const response = await api.get(`/strategic-objectives/${id}/`);
      
      if (!response.data) {
        throw new Error('No objective data received');
      }
      
      // Clean and validate the objective data
      const obj = response.data;
      const cleanedObjective = {
        ...obj,
        id: obj.id,
        title: obj.title || 'Untitled Objective',
        description: obj.description || '',
        weight: Number(obj.weight) || 0,
        planner_weight: obj.planner_weight !== null ? Number(obj.planner_weight) : null,
        effective_weight: Number(obj.effective_weight) || Number(obj.weight) || 0,
        is_default: Boolean(obj.is_default),
        programs: Array.isArray(obj.programs) ? obj.programs : [],
        initiatives: Array.isArray(obj.initiatives) ? obj.initiatives : [],
        total_initiatives_weight: Number(obj.total_initiatives_weight) || 0
      };
      
      console.log(`API: Successfully loaded objective ${id}`);
      return { data: cleanedObjective };
      
    } catch (error) {
      console.error(`API: Error fetching objective ${id}:`, error);
      throw error;
    }
  },
  
  async create(data: any) {
    try {
      const response = await api.post('/strategic-objectives/', data);
      return { data: response.data };
    } catch (error) {
      console.error('Failed to create objective:', error);
      throw error;
    }
  },
  
  async update(id: string, data: any) {
    try {
      console.log(`API: Updating strategic objective ${id} with data:`, data);
      
      // Ensure numeric values are properly formatted
      const cleanData = {
        ...data,
        weight: data.weight !== undefined ? Number(data.weight) : undefined,
        planner_weight: data.planner_weight !== undefined && data.planner_weight !== null 
          ? Number(data.planner_weight) : null
      };
      
      await ensureCsrfToken();
      const response = await api.patch(`/strategic-objectives/${id}/`, cleanData);
      
      if (!response.data) {
        throw new Error('No response data received');
      }
      
      console.log(`API: Successfully updated objective ${id}`);
      return { data: response.data };
      
    } catch (error) {
      console.error(`API: Error updating objective ${id}:`, error);
      throw error;
    }
  },
  
  async delete(id: string) {
    try {
      const response = await api.delete(`/strategic-objectives/${id}/`);
      return { data: response.data };
    } catch (error) {
      console.error(`Failed to delete objective ${id}:`, error);
      throw error;
    }
  },
  
  async getWeightSummary() {
    try {
      console.log('API: Fetching objectives weight summary...');
      const response = await api.get('/strategic-objectives/weight_summary/');
      
      if (!response.data) {
        console.warn('API: No weight summary data received');
        return {
          data: {
            total_weight: 0,
            remaining_weight: 100,
            is_valid: false
          }
        };
      }
      
      // Ensure numeric values
      const summary = {
        total_weight: Number(response.data.total_weight) || 0,
        remaining_weight: Number(response.data.remaining_weight) || 100,
        is_valid: Boolean(response.data.is_valid)
      };
      
      console.log('API: Weight summary loaded:', summary);
      return { data: summary };
      
    } catch (error) {
      console.error('API: Error fetching weight summary:', error);
      return {
        data: {
          total_weight: 0,
          remaining_weight: 100,
          is_valid: false
        },
        error: error.message || 'Failed to load weight summary'
      };
    }
  }
};

// Programs service
export const programs = {
  async getAll() {
    try {
      const response = await api.get('/programs/');
      return response;
    } catch (error) {
      console.error('Failed to get programs:', error);
      throw error;
    }
  },
  
  async getByObjective(objectiveId: string) {
    try {
      const response = await api.get(`/programs/?strategic_objective=${objectiveId}`);
      return response;
    } catch (error) {
      console.error(`Failed to get programs for objective ${objectiveId}:`, error);
      throw error;
    }
  },
  
  async getById(id: string) {
    try {
      const response = await api.get(`/programs/${id}/`);
      return response;
    } catch (error) {
      console.error(`Failed to get program ${id}:`, error);
      throw error;
    }
  },

  async create(data: any) {
    try {
      const response = await api.post('/programs/', data);
      return response;
    } catch (error) {
      console.error('Failed to create program:', error);
      throw error;
    }
  },
  
  async update(id: string, data: any) {
    try {
      const response = await api.patch(`/programs/${id}/`, data);
      return response;
    } catch (error) {
      console.error(`Failed to update program ${id}:`, error);
      throw error;
    }
  },
  
  async delete(id: string) {
    try {
      const response = await api.delete(`/programs/${id}/`);
      return response;
    } catch (error) {
      console.error(`Failed to delete program ${id}:`, error);
      throw error;
    }
  }
};

// Strategic Initiatives API
export const initiatives = {
  getAll: async () => {
    try {
      const response = await api.get('/strategic-initiatives/');
      
      // Ensure we return data in expected format
      if (response.data && Array.isArray(response.data.data)) {
        return response.data;
      } else if (response.data && Array.isArray(response.data)) {
        return { data: response.data };
      } else {
        console.warn('Unexpected initiatives response format:', response.data);
        return { data: [] };
      }
    } catch (error) {
      console.error('Error fetching all initiatives:', error);
      return { data: [] };
    }
  },
  
  getById: async (id: string) => {
    try {
      const response = await api.get(`/strategic-initiatives/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching initiative ${id}:`, error);
      throw error;
    }
  },
  
  getByObjective: async (objectiveId: string) => {
    try {
      console.log(`Fetching initiatives for objective: ${objectiveId}`);
      const response = await api.get(`/strategic-initiatives/?strategic_objective=${objectiveId}`);
      
      console.log('Raw initiatives response:', response.data);
      
      // Handle different response formats
      let initiativesData = [];
      if (response.data && Array.isArray(response.data.data)) {
        initiativesData = response.data.data;
      } else if (response.data && Array.isArray(response.data.results)) {
        initiativesData = response.data.results;
      } else if (response.data && Array.isArray(response.data)) {
        initiativesData = response.data;
      } else {
        console.warn('Unexpected initiatives response format for objective:', objectiveId, response.data);
        initiativesData = [];
      }
      
      console.log(`Found ${initiativesData.length} initiatives for objective ${objectiveId}`);
      
      return { data: initiativesData };
    } catch (error) {
      console.error(`Error fetching initiatives for objective ${objectiveId}:`, error);
      return { data: [] };
    }
  },
  
  getByProgram: async (programId: string) => {
    try {
      console.log(`Fetching initiatives for program: ${programId}`);
      const response = await api.get(`/strategic-initiatives/?program=${programId}`);
      
      // Handle different response formats
      let initiativesData = [];
      if (response.data && Array.isArray(response.data.data)) {
        initiativesData = response.data.data;
      } else if (response.data && Array.isArray(response.data.results)) {
        initiativesData = response.data.results;
      } else if (response.data && Array.isArray(response.data)) {
        initiativesData = response.data;
      } else {
        console.warn('Unexpected initiatives response format for program:', programId, response.data);
        initiativesData = [];
      }
      
      console.log(`Found ${initiativesData.length} initiatives for program ${programId}`);
      
      return { data: initiativesData };
    } catch (error) {
      console.error(`Error fetching initiatives for program ${programId}:`, error);
      return { data: [] };
    }
  },
  
  getBySubProgram: async (subProgramId: string) => {
    try {
      const response = await api.get(`/strategic-initiatives/?subprogram=${subProgramId}`);
      return response;
    } catch (error) {
      console.error(`Failed to fetch initiatives for subprogram ${subProgramId}:`, error);
      throw error;
    }
  },
  
  create: async (data: any) => {
    try {
      const response = await api.post('/strategic-initiatives/', data);
      return response.data;
    } catch (error) {
      console.error('Failed to create initiative:', error);
      throw error;
    }
  },
  
  update: async (id: string, data: any) => {
    try {
      const response = await api.patch(`/strategic-initiatives/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error(`Failed to update initiative ${id}:`, error);
      throw error;
    }
  },
  
  delete: async (id: string) => {
    try {
      await api.delete(`/strategic-initiatives/${id}/`);
      return { success: true };
    } catch (error) {
      console.error(`Failed to delete initiative ${id}:`, error);
      throw error;
    }
  },
  
  getWeightSummary: async (parentId: string, parentType: string) => {
    try {
      const paramName = parentType === 'objective' ? 'objective' : 
                       parentType === 'program' ? 'program' : 
                       'subprogram';
      
      const response = await api.get(`/strategic-initiatives/weight_summary/?${paramName}=${parentId}`);
      return response;
    } catch (error) {
      console.error(`Failed to fetch initiative weight summary for ${parentType} ${parentId}:`, error);
      return {
        data: {
          total_initiatives_weight: 0,
          remaining_weight: 100,
          parent_weight: 100,
          is_valid: true
        }
      };
    }
  },
  
  validateInitiativesWeight: async (parentId: string, parentType: string) => {
    try {
      const response = await api.post(`/strategic-initiatives/validate_initiatives_weight/?${parentType}=${parentId}`);
      return response;
    } catch (error) {
      console.error(`Failed to validate initiative weights for ${parentType} ${parentId}:`, error);
      throw error;
    }
  }
};

// Performance measures service
export const performanceMeasures = {
  async getByInitiative(initiativeId: string) {
    try {
      if (!initiativeId) {
        console.warn('No initiative ID provided to performanceMeasures.getByInitiative');
        return { data: [] };
      }
      
      console.log(`Fetching performance measures for initiative ${initiativeId} in production mode`);
      
      const timestamp = new Date().getTime();
      const id = String(initiativeId);
      
      let response;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          if (retryCount === 0) {
            // First attempt: standard format with extended timeout
            response = await api.get(`/performance-measures/?initiative=${id}&_=${timestamp}`, {
              timeout: 12000,
              headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
            });
          } else if (retryCount === 1) {
            // Second attempt: alternative parameter format
            response = await api.get('/performance-measures/', {
              params: { 
                initiative: id,
                initiative_id: id, // Try both parameter names
                _: timestamp + retryCount
              },
              timeout: 8000,
              headers: { 'Cache-Control': 'no-cache' }
            });
          } else {
            // Third attempt: simplified call with different endpoint approach
            response = await api.get(`/performance-measures/`, {
              timeout: 5000,
              params: { initiative: id }
            });
          }
          
          console.log(`Successfully fetched performance measures for initiative ${id} on attempt ${retryCount + 1}`);
          break;
          
        } catch (attemptError) {
          retryCount++;
          console.warn(`Performance measures attempt ${retryCount} failed for initiative ${id}:`, attemptError);
          
          if (retryCount >= maxRetries) {
            throw attemptError;
          }
          
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
      
      if (!response.data) {
        console.warn(`No performance measures data returned for initiative ${id}`);
        return { data: [] };
      }
      
      const data = response.data.results || response.data;
      if (!Array.isArray(data)) {
        console.warn(`Expected array but got for initiative ${id}:`, typeof data);
        return { data: [] };
      }
      
      return response;
    } catch (error) {
      console.warn(`Failed to get performance measures for initiative ${initiativeId} after retries:`, error);
      return { data: [] };
    }
  },
  
  async getById(id: string) {
    try {
      const response = await api.get(`/performance-measures/${id}/`);
      return response;
    } catch (error) {
      console.error(`Failed to get performance measure ${id}:`, error);
      throw error;
    }
  },
  
  async create(data: any) {
    try {
      await ensureCsrfToken();
      
      const submissionData = { ...data };
      if (data.initiative) submissionData.initiative = String(data.initiative);
      
      if (!Array.isArray(submissionData.selected_months)) {
        submissionData.selected_months = submissionData.selected_months ? [submissionData.selected_months] : [];
      }
      
      if (!Array.isArray(submissionData.selected_quarters)) {
        submissionData.selected_quarters = submissionData.selected_quarters ? [submissionData.selected_quarters] : [];
      }
      
      const response = await api.post('/performance-measures/', submissionData);
      return response;
    } catch (error) {
      console.error('Failed to create performance measure:', error);
      throw error;
    }
  },
  
  async update(id: string, data: any) {
    try {
      await ensureCsrfToken();
      
      const submissionData = { ...data };
      if (data.initiative) submissionData.initiative = String(data.initiative);
      
      if (!Array.isArray(submissionData.selected_months)) {
        submissionData.selected_months = submissionData.selected_months ? [submissionData.selected_months] : [];
      }
      
      if (!Array.isArray(submissionData.selected_quarters)) {
        submissionData.selected_quarters = submissionData.selected_quarters ? [submissionData.selected_quarters] : [];
      }
      
      const response = await api.patch(`/performance-measures/${id}/`, submissionData);
      return response;
    } catch (error) {
      console.error(`Failed to update performance measure ${id}:`, error);
      throw error;
    }
  },
  
  async delete(id: string) {
    try {
      const response = await api.delete(`/performance-measures/${id}/`);
      return response;
    } catch (error) {
      console.error(`Failed to delete performance measure ${id}:`, error);
      throw error;
    }
  },
  
  async getWeightSummary(initiativeId: string) {
    try {
      const id = String(initiativeId);
      const response = await api.get(`/performance-measures/weight_summary/?initiative=${id}`);
      return response;
    } catch (error) {
      console.error('Failed to get performance measures weight summary:', error);
      throw error;
    }
  },
  
  async validateMeasuresWeight(initiativeId: string) {
    try {
      await ensureCsrfToken();
      
      const id = String(initiativeId);
      const response = await api.post(`/performance-measures/validate_measures_weight/?initiative=${id}`);
      return response;
    } catch (error) {
      console.error('Failed to validate performance measures weight:', error);
      throw error;
    }
  }
};

// Main activities service
export const mainActivities = {
  getAll: async () => {
    try {
      const response = await api.get('/main-activities/');
      console.log('API: All main activities response:', response.data?.length || 0, 'items');
      return response.data;
    } catch (error) {
      console.error('API: Error fetching all main activities:', error);
      throw error;
    }
  },

  getById: async (id: string) => {
    try {
      console.log('API: Getting main activity by ID:', id);
      const response = await api.get(`/main-activities/${id}/`);
      console.log('API: Main activity by ID response:', response.data);
      return response.data;
    } catch (error) {
      console.error(`API: Error fetching main activity ${id}:`, error);
      throw error;
    }
  },

  getByInitiative: async (initiativeId: string) => {
    try {
      console.log(`API: Fetching main activities for initiative ${initiativeId}`);
      
      // Try multiple API strategies for better reliability
      let response;
      try {
        // Strategy 1: Direct query with initiative parameter
        response = await api.get(`/main-activities/?initiative=${initiativeId}`);
        console.log(`API: Main activities response for initiative ${initiativeId}:`, response.data);
      } catch (error1) {
        console.warn(`API: Strategy 1 failed for initiative ${initiativeId}:`, error1);
        
        try {
          // Strategy 2: Get all and filter (fallback)
          const allResponse = await api.get('/main-activities/');
          const allActivities = allResponse.data?.results || allResponse.data || [];
          const filteredActivities = allActivities.filter((activity: any) => 
            activity && activity.initiative && String(activity.initiative) === String(initiativeId)
          );
          
          response = {
            data: {
              data: filteredActivities,
              count: filteredActivities.length
            }
          };
          console.log(`API: Strategy 2 success for initiative ${initiativeId}, found ${filteredActivities.length} activities`);
        } catch (error2) {
          console.error(`API: All strategies failed for initiative ${initiativeId}:`, error2);
          throw error2;
        }
      }
      
      // Ensure consistent response format
      if (response.data && !response.data.data && Array.isArray(response.data)) {
        response.data = { data: response.data };
      }
      
      // Validate and clean the data
      const activities = response.data?.data || response.data?.results || response.data || [];
      const cleanedActivities = Array.isArray(activities) ? activities.filter(activity => 
        activity && 
        activity.id && 
        activity.name &&
        activity.initiative &&
        String(activity.initiative) === String(initiativeId)
      ) : [];
      
      console.log(`API: Cleaned ${activities.length} activities to ${cleanedActivities.length} valid activities`);
      
      return {
        data: cleanedActivities
      };
    } catch (error) {
      console.error(`API: Error fetching main activities for initiative ${initiativeId}:`, error);
      // Return empty array instead of throwing to prevent component crashes
      return {
        data: [],
        error: error.message || 'Failed to fetch main activities'
      };
    }
  },

  create: async (data: any) => {
    try {
      console.log('API: Creating main activity:', data);
      const response = await api.post('/main-activities/', data);
      console.log('API: Main activity created:', response.data);
      return response.data;
    } catch (error) {
      console.error('API: Error creating main activity:', error);
      throw error;
    }
  },

  update: async (id: string, data: any) => {
    try {
      console.log('API: Updating main activity:', id, data);
      const response = await api.put(`/main-activities/${id}/`, data);
      console.log('API: Main activity updated:', response.data);
      return response.data;
    } catch (error) {
      console.error(`API: Error updating main activity ${id}:`, error);
      throw error;
    }
  },

  delete: async (id: string) => {
    try {
      console.log('API: Deleting main activity:', id);
      const response = await api.delete(`/main-activities/${id}/`);
      console.log('API: Main activity deleted successfully');
      return response.data;
    } catch (error) {
      console.error(`API: Error deleting main activity ${id}:`, error);
      throw error;
    }
  },

  // Add method to get activities with sub-activities populated
  getByInitiativeWithSubActivities: async (initiativeId: string) => {
    console.log('API: Getting main activities with sub-activities for initiative:', initiativeId);
    
    try {
      const response = await api.get(`/main-activities/?initiative=${initiativeId}&include_sub_activities=true`);
      
      let activitiesData = response.data?.results || response.data || [];
      if (!Array.isArray(activitiesData)) activitiesData = [];
      
      console.log(`API: Found ${activitiesData.length} activities with sub-activities`);
      return { data: activitiesData };
      
    } catch (error) {
      console.error('API: Failed to fetch activities with sub-activities:', error);
      throw error;
    }
  },
  
  async getWeightSummary(initiativeId: string) {
    try {
      const response = await api.get(`/main-activities/weight_summary/?initiative=${initiativeId}`);
      return response;
    } catch (error) {
      console.error('Failed to get main activities weight summary:', error);
      throw error;
    }
  },
  
  async validateActivitiesWeight(initiativeId: string) {
    try {
      await ensureCsrfToken();
      const response = await api.post(`/main-activities/validate_activities_weight/?initiative=${initiativeId}`);
      return response;
    } catch (error) {
      console.error('Failed to validate main activities weight:', error);
      throw error;
    }
  },
  
   async updateBudget(activityId: string, budgetData: any) {
    try {
      await ensureCsrfToken();
      const response = await api.post(`/main-activities/${activityId}/budget/`, budgetData);
      return response;
    } catch (error) {
      console.error(`Failed to update budget for activity ${activityId}:`, error);
      throw error;
    }
  }
};


// Activity budgets service
export const activityBudgets = {
  async getByActivity(activityId: string) {
    try {
      const response = await api.get(`/activity-budgets/?activity=${activityId}`);
      return response;
    } catch (error) {
      console.error(`Failed to get budget for activity ${activityId}:`, error);
      throw error;
    }
  },
  
  async create(data: any) {
    try {
      const response = await api.post('/activity-budgets/', data);
      return response;
    } catch (error) {
      console.error('Failed to create activity budget:', error);
      throw error;
    }
  },
  
  async update(id: string, data: any) {
    try {
      const response = await api.patch(`/activity-budgets/${id}/`, data);
      return response;
    } catch (error) {
      console.error(`Failed to update activity budget ${id}:`, error);
      throw error;
    }
  },
  
  async delete(id: string) {
    try {
      const response = await api.delete(`/activity-budgets/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Failed to delete activity budget ${id}:`, error);
      throw error;
    }
  },
  
  async deleteByActivity(activityId: string) {
    try {
      // First get the budget for this activity
      const budgets = await api.get(`/activity-budgets/?activity=${activityId}`);
      const budgetList = budgets.data?.results || budgets.data || [];
      
      if (budgetList.length > 0) {
        const budget = budgetList[0];
        const response = await api.delete(`/activity-budgets/${budget.id}/`);
        return response.data;
      }
      
      throw new Error('No budget found for this activity');
    } catch (error) {
      console.error(`Failed to delete budget for activity ${activityId}:`, error);
      throw error;
    }
  }
};

// Sub Activities API
export const subActivities = {
  getAll: () => api.get('/sub-activities/'),
  getById: (id: string) => api.get(`/sub-activities/${id}/`),
  create: (data: any) => api.post('/sub-activities/', data),
  update: (id: string, data: any) => api.put(`/sub-activities/${id}/`, data),
  delete: async (id: string) => {
    try {
      console.log(`API: Deleting sub-activity ${id}`);
      const response = await api.delete(`/sub-activities/${id}/`);
      console.log(`API: Sub-activity ${id} deleted successfully`);
      return response;
    } catch (error) {
      console.error(`API: Error deleting sub-activity ${id}:`, error);
      throw error;
    }
  },
  getByMainActivity: (mainActivityId: string) => api.get('/sub-activities/', { params: { main_activity: mainActivityId } }),
  addBudget: (id: string, data: any) => api.post(`/sub-activities/${id}/add-budget/`, data),
  updateBudget: (id: string, data: any) => api.put(`/sub-activities/${id}/update-budget/`, data),
  deleteBudget: (id: string) => api.delete(`/sub-activities/${id}/delete-budget/`)
};

// Plans service
export const plans = {
  async getAll() {
    try {
      const timestamp = new Date().getTime();
      const response = await api.get(`/plans/?_=${timestamp}`);
      return response;
    } catch (error) {
      console.error('Failed to get plans:', error);
      throw error;
    }
  },
  
  async getById(id: string) {
    try {
      const response = await api.get(`/plans/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Failed to get plan ${id}:`, error);
      throw error;
    }
  },
  
  async create(data: any) {
    try {
      console.log('=== PLANS API CREATE START ===');
      console.log('Input data:', data);
      
      const formattedData = {...data};
      
      if (formattedData.organization) {
        formattedData.organization = Number(formattedData.organization);
      }
      
      if (formattedData.strategic_objective) {
        formattedData.strategic_objective = String(formattedData.strategic_objective);
      }
      
      if (formattedData.from_date) {
        formattedData.from_date = new Date(formattedData.from_date).toISOString().split('T')[0];
      }
      
      if (formattedData.to_date) {
        formattedData.to_date = new Date(formattedData.to_date).toISOString().split('T')[0];
      }
      
      // Handle selected objectives and their custom weights
      if (formattedData.selected_objectives) {
        console.log('Processing selected_objectives:', formattedData.selected_objectives);
        
        // Ensure selected_objectives is an array of valid IDs
        if (Array.isArray(formattedData.selected_objectives)) {
          const validIds = formattedData.selected_objectives
            .filter(item => item !== null && item !== undefined) // Remove null/undefined
            .map((item: any) => {
              // If it's an object with id property, extract the id
              if (typeof item === 'object' && item !== null && item.id !== undefined) {
                const id = Number(item.id);
                if (isNaN(id)) {
                  console.error('Invalid objective ID in object:', item);
                  return null;
                }
                return id;
              }
              // If it's already a primitive value, convert to number
              const id = Number(item);
              if (isNaN(id)) {
                console.error('Invalid objective ID:', item);
                return null;
              }
              return id;
            })
            .filter(id => id !== null && id > 0); // Remove invalid IDs
          
          formattedData.selected_objectives = validIds;
          console.log('Processed selected_objectives:', validIds);
          
          // Validate that we didn't lose any objectives
          if (validIds.length !== data.selected_objectives.length) {
            console.error('Objective count mismatch:', {
              original: data.selected_objectives.length,
              processed: validIds.length,
              originalData: data.selected_objectives,
              processedData: validIds
            });
            throw new Error(`Data integrity error: Lost ${data.selected_objectives.length - validIds.length} objectives during processing`);
          }
        } else {
          console.error('selected_objectives is not an array:', formattedData.selected_objectives);
          formattedData.selected_objectives = [];
        }
      } else {
        console.log('No selected_objectives provided');
        formattedData.selected_objectives = [];
      }
      
      if (formattedData.selected_objectives_weights) {
        console.log('Processing selected_objectives_weights:', formattedData.selected_objectives_weights);
        
        // Ensure weights are properly formatted and validate against objectives
        const weights: Record<string, number> = {};
        let weightCount = 0;
        
        Object.entries(formattedData.selected_objectives_weights).forEach(([key, value]) => {
          const weight = Number(value);
          if (!isNaN(weight) && weight > 0) {
            weights[key] = weight;
            weightCount++;
          } else {
            console.error('Invalid weight for objective:', key, value);
          }
        });
        
        formattedData.selected_objectives_weights = weights;
        console.log('Processed weights:', weights, 'Count:', weightCount);
        
        // Validate that we have weights for all objectives
        if (weightCount !== formattedData.selected_objectives.length) {
          console.error('Weight count mismatch:', {
            objectives: formattedData.selected_objectives.length,
            weights: weightCount,
            objectiveIds: formattedData.selected_objectives,
            weightKeys: Object.keys(weights)
          });
          throw new Error(`Weight mapping error: Expected ${formattedData.selected_objectives.length} weights but got ${weightCount}`);
        }
      } else {
        console.log('No selected_objectives_weights provided');
        formattedData.selected_objectives_weights = {};
      }
      
      console.log('=== FINAL FORMATTED DATA ===');
      console.log('Final plan data:', {
        ...formattedData,
        selected_objectives_summary: {
          count: formattedData.selected_objectives.length,
          ids: formattedData.selected_objectives,
          weights_count: Object.keys(formattedData.selected_objectives_weights).length
        }
      });
      
      // Ensure CSRF token is fresh before submission
      await ensureCsrfToken();
      
      // Submit with retry logic for production reliability
      let response;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          console.log(`Plan submission attempt ${retryCount + 1}/${maxRetries}`);
          
          response = await api.post('/plans/', formattedData, {
            timeout: 15000, // 15 second timeout
            headers: {
              'Content-Type': 'application/json',
              'X-CSRFToken': Cookies.get('csrftoken') || '',
              'Cache-Control': 'no-cache'
            }
          });
          
          console.log('Plan submission successful on attempt:', retryCount + 1);
          break;
          
        } catch (attemptError) {
          retryCount++;
          console.warn(`Plan submission attempt ${retryCount} failed:`, attemptError);
          
          if (retryCount >= maxRetries) {
            throw attemptError;
          }
          
          // Wait before retry with exponential backoff
          const waitTime = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
          // Refresh CSRF token before retry
          try {
            await ensureCsrfToken();
          } catch (csrfError) {
            console.warn('Failed to refresh CSRF token:', csrfError);
          }
        }
      }
      
      if (!response || !response.data) {
        throw new Error('No response data received from server');
      }
      
      console.log('=== PLAN CREATION SUCCESS ===');
      console.log('Created plan:', response.data);
      
      // Verify that all objectives were saved
      if (response.data.selected_objectives) {
        const savedObjectiveIds = response.data.selected_objectives;
        console.log('Saved objective IDs:', savedObjectiveIds);
        
        const selectedObjectiveIds = formattedData.selected_objectives;
        
        if (savedObjectiveIds.length !== selectedObjectiveIds.length) {
          console.error('OBJECTIVE COUNT MISMATCH:', {
            submitted: selectedObjectiveIds.length,
            saved: savedObjectiveIds.length,
            submittedIds: selectedObjectiveIds,
            savedIds: savedObjectiveIds
          });
          throw new Error(`Objective save error: Submitted ${selectedObjectiveIds.length} objectives but only ${savedObjectiveIds.length} were saved`);
        }
        
        // Verify all IDs match
        const missingIds = selectedObjectiveIds.filter(id => !savedObjectiveIds.includes(id));
        if (missingIds.length > 0) {
          console.error('MISSING OBJECTIVE IDS:', missingIds);
          throw new Error(`Missing objectives in saved plan: ${missingIds.join(', ')}`);
        }
        
        console.log('✓ All objectives verified successfully saved');
      }
      
      return response.data;
    } catch (error) {
      console.error('=== PLAN CREATION FAILED ===');
      console.error('Plan creation error:', error);
      console.error('Detailed error info:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        selectedObjectivesCount: data.selected_objectives?.length || 0,
        weightsCount: data.selected_objectives_weights ? Object.keys(data.selected_objectives_weights).length : 0
      });
      throw error;
    }
  },
  
  async update(id: string, data: any) {
    try {
      const response = await api.patch(`/plans/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error(`Failed to update plan ${id}:`, error);
      throw error;
    }
  },
  
  async delete(id: string) {
    try {
      const response = await api.delete(`/plans/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Failed to delete plan ${id}:`, error);
      throw error;
    }
  },
  
  async submitToEvaluator(id: string) {
    try {
      await ensureCsrfToken();
      const response = await api.post(`/plans/${id}/submit/`);
      return response.data;
    } catch (error: any) {
      let errorMessage = "Failed to submit plan for review";
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      throw new Error(errorMessage);
    }
  },
  
  async approvePlan(id: string, feedback: string) {
    try {
      await ensureCsrfToken();
      const response = await api.post(`/plans/${id}/approve/`, { feedback });
      return response;
    } catch (error) {
      console.error(`Failed to approve plan ${id}:`, error);
      throw error;
    }
  },
  
  async rejectPlan(id: string, feedback: string) {
    try {
      await ensureCsrfToken();
      const response = await api.post(`/plans/${id}/reject/`, { feedback });
      return response;
    } catch (error) {
      console.error(`Failed to reject plan ${id}:`, error);
      throw error;
    }
  },
  
  async getPendingReviews() {
    try {
      await ensureCsrfToken();
      const response = await api.get(`/plans/pending_reviews/`);
      return response;
    } catch (error) {
      console.error('Failed to get pending reviews:', error);
      throw error;
    }
  }
};

// Utility export functions
export const processDataForExport = (objectives: any[], language: string = 'en'): any[] => {
  return []; // Placeholder - implement actual export processing
};

export const formatCurrency = (value: any): string => {
  if (!value || value === 'N/A') return '-';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '-';
  return `$${numValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Start session refresh when module is loaded
if (typeof window !== 'undefined') {
  startSessionRefresh();
}