import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (email, password) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const response = await api.post('/api/v1/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
  },

  me: async () => {
    const response = await api.get('/api/v1/auth/me');
    return response.data;
  },

  initAdmin: async () => {
    const response = await api.post('/api/v1/auth/init-admin');
    return response.data;
  },
};

// Matches API
export const matchesAPI = {
  list: async () => {
    const response = await api.get('/api/v1/matches');
    return response.data;
  },

  get: async (id) => {
    const response = await api.get(`/api/v1/matches/${id}`);
    return response.data;
  },

  getDetectionStats: async (id) => {
    // This endpoint may not exist in all backend versions
    // Return empty stats if it fails
    try {
      const response = await api.get(`/api/v1/matches/${id}/tracks`);
      // Calculate stats from tracks data
      const tracks = response.data || [];
      return {
        frame_count: tracks.length > 0 ? Math.max(...tracks.map(t => t.last_frame || 0)) : 0,
        total_detections: tracks.reduce((sum, t) => sum + (t.detection_count || 0), 0),
        tracks_count: tracks.length,
      };
    } catch (err) {
      return { frame_count: 0, total_detections: 0, tracks_count: 0 };
    }
  },

  getFrames: async (id, skip = 0, limit = 100) => {
    const response = await api.get(`/api/v1/matches/${id}/frames?skip=${skip}&limit=${limit}`);
    return response.data;
  },
};

// Detections API
export const detectionsAPI = {
  getFrame: async (frameId) => {
    const response = await api.get(`/api/v1/frames/${frameId}`);
    return response.data;
  },

  getFrameByNumber: async (matchId, frameNumber) => {
    const response = await api.get(`/api/v1/matches/${matchId}/frames/${frameNumber}`);
    return response.data;
  },

  getFrameImageUrl: (matchId, frameNumber) => {
    const token = localStorage.getItem('token');
    return `${API_URL}/api/v1/matches/${matchId}/frame-by-number/${frameNumber}/image?token=${token}`;
  },

  updateDetection: async (detectionId, data) => {
    const response = await api.patch(`/api/v1/detections/${detectionId}`, data);
    return response.data;
  },

  createDetection: async (frameId, data) => {
    const response = await api.post(`/api/v1/frames/${frameId}/detections`, data);
    return response.data;
  },

  deleteDetection: async (detectionId) => {
    const response = await api.delete(`/api/v1/detections/${detectionId}`);
    return response.data;
  },
};

// Events API - Updated to match production backend structure
export const eventsAPI = {
  getMatchEvents: async (matchId, skip = 0, limit = 500) => {
    const response = await api.get(`/api/v1/matches/${matchId}/events?skip=${skip}&limit=${limit}`);
    // Backend returns array of events directly
    return response.data;
  },

  get: async (matchId, eventId) => {
    const response = await api.get(`/api/v1/matches/${matchId}/events/${eventId}`);
    return response.data;
  },

  update: async (matchId, eventId, data) => {
    const response = await api.put(`/api/v1/matches/${matchId}/events/${eventId}`, data);
    return response.data;
  },

  delete: async (matchId, eventId) => {
    const response = await api.delete(`/api/v1/matches/${matchId}/events/${eventId}`);
    return response.data;
  },

  getKickoffs: async (matchId) => {
    const response = await api.get(`/api/v1/matches/${matchId}/events/kickoffs`);
    return response.data;
  },

  createKickoff: async (matchId, data) => {
    const response = await api.post(`/api/v1/matches/${matchId}/events/kickoff`, data);
    return response.data;
  },
};

// Teams API
export const teamsAPI = {
  list: async () => {
    const response = await api.get('/api/v1/teams');
    return response.data;
  },
};

// Analytics API - uses /accuracy/dashboard which is working
export const analyticsAPI = {
  getMatchSummary: async (matchId) => {
    // Get match data as summary
    const response = await api.get(`/api/v1/matches/${matchId}`);
    return response.data;
  },

  getMatchAccuracy: async (matchId) => {
    // Use dashboard endpoint and filter for match-specific data
    const response = await api.get('/api/v1/accuracy/dashboard');
    const matchData = response.data.recent_matches?.find(m => m.id === parseInt(matchId));
    return matchData || response.data;
  },

  getDetectionAccuracy: async (matchId) => {
    // Use dashboard endpoint - provides overall detection accuracy
    const response = await api.get('/api/v1/accuracy/dashboard');
    const matchData = response.data.recent_matches?.find(m => m.id === parseInt(matchId));
    return {
      overall_accuracy: (matchData?.ai_accuracy_tracking || response.data.tracking_accuracy || 0) / 100,
      total: response.data.total_tracks_reviewed || 0,
      correct: response.data.total_tracks_reviewed || 0,
      by_class: {}
    };
  },

  getEventAccuracy: async (matchId) => {
    // Use dashboard endpoint - provides event accuracy breakdown
    const response = await api.get('/api/v1/accuracy/dashboard');
    const matchData = response.data.recent_matches?.find(m => m.id === parseInt(matchId));
    return {
      overall_accuracy: (matchData?.ai_accuracy_events || response.data.event_detection_accuracy || 0) / 100,
      total: response.data.total_events_reviewed || 0,
      correct: Math.round((response.data.total_events_reviewed || 0) * (response.data.event_detection_accuracy || 0)),
      by_type: response.data.event_type_accuracy || {}
    };
  },

  getGlobalTrends: async () => {
    const response = await api.get('/api/v1/accuracy/dashboard');
    return response.data;
  },
};

// Export API (YOLO Training Data)
export const exportAPI = {
  // Get export stats (preview before download)
  getStats: async (matchId, correctedOnly = true, minConfidence = 0) => {
    const response = await api.get(
      `/api/v1/export/matches/${matchId}/export/stats?corrected_only=${correctedOnly}&min_confidence=${minConfidence}`
    );
    return response.data;
  },

  // Get class mapping
  getClassMapping: async () => {
    const response = await api.get('/api/v1/export/export/class-mapping');
    return response.data;
  },

  // Download YOLO dataset (returns blob URL for download)
  downloadYOLO: async (matchId, options = {}) => {
    const params = new URLSearchParams({
      corrected_only: options.correctedOnly ?? true,
      min_confidence: options.minConfidence ?? 0,
      train_split: options.trainSplit ?? 0.8,
      include_images: options.includeImages ?? true,
    });

    const response = await api.get(
      `/api/v1/export/matches/${matchId}/export/yolo?${params.toString()}`,
      { responseType: 'blob' }
    );

    // Create download link
    const blob = new Blob([response.data], { type: 'application/zip' });
    const url = window.URL.createObjectURL(blob);
    const filename = response.headers['content-disposition']
      ?.split('filename=')[1]
      ?.replace(/"/g, '') || `football_tracker_match${matchId}.zip`;

    return { url, filename };
  },
};

export default api;
