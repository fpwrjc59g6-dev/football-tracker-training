import axios from 'axios';
import type {
  User, Team, Player, Match, MatchPlayer, Track, Event, EventSummary,
  Calibration, Correction, CorrectionSummary, TrainingExport,
  AccuracyDashboard, AccuracyMetric, AccuracyComparison
} from '../types';

// API base URL - will be configured for production
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Track when we last logged in to avoid redirect race conditions
let lastLoginTime = 0;

// Axios instance with auth interceptor
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
  (response) => {
    // Track successful login time
    if (response.config.url?.includes('/auth/login')) {
      lastLoginTime = Date.now();
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Don't redirect if we're already on login page or if this was the login request
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      const isOnLoginPage = window.location.pathname === '/login';
      // Grace period after login to avoid race conditions (5 seconds)
      const justLoggedIn = Date.now() - lastLoginTime < 5000;

      if (!isLoginRequest && !isOnLoginPage && !justLoggedIn) {
        localStorage.removeItem('token');
        localStorage.removeItem('auth-storage');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ============================================================================
// AUTH
// ============================================================================

export const authApi = {
  login: async (username: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    const { data } = await api.post<{ access_token: string; user: User }>(
      '/auth/login',
      formData,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    return data;
  },

  me: async () => {
    const { data } = await api.get<User>('/auth/me');
    return data;
  },

  register: async (userData: { email: string; username: string; password: string; full_name?: string; role?: string }) => {
    const { data } = await api.post<User>('/auth/register', userData);
    return data;
  },
};

// ============================================================================
// TEAMS
// ============================================================================

export const teamsApi = {
  list: async (params?: { search?: string }) => {
    const { data } = await api.get<Team[]>('/teams', { params });
    return data;
  },

  get: async (id: number) => {
    const { data } = await api.get<Team>(`/teams/${id}`);
    return data;
  },

  create: async (team: Partial<Team>) => {
    const { data } = await api.post<Team>('/teams', team);
    return data;
  },

  update: async (id: number, team: Partial<Team>) => {
    const { data } = await api.put<Team>(`/teams/${id}`, team);
    return data;
  },

  delete: async (id: number) => {
    await api.delete(`/teams/${id}`);
  },
};

// ============================================================================
// PLAYERS
// ============================================================================

export const playersApi = {
  list: async (params?: { team_id?: number; search?: string }) => {
    const { data } = await api.get<Player[]>('/players', { params });
    return data;
  },

  get: async (id: number) => {
    const { data } = await api.get<Player>(`/players/${id}`);
    return data;
  },

  create: async (player: Partial<Player>) => {
    const { data } = await api.post<Player>('/players', player);
    return data;
  },

  createBulk: async (players: Partial<Player>[]) => {
    const { data } = await api.post<Player[]>('/players/bulk', players);
    return data;
  },

  update: async (id: number, player: Partial<Player>) => {
    const { data } = await api.put<Player>(`/players/${id}`, player);
    return data;
  },

  delete: async (id: number) => {
    await api.delete(`/players/${id}`);
  },
};

// ============================================================================
// MATCHES
// ============================================================================

export const matchesApi = {
  list: async (params?: { team_id?: number; start_date?: string; end_date?: string; is_processed?: boolean }) => {
    const { data } = await api.get<Match[]>('/matches', { params });
    return data;
  },

  get: async (id: number) => {
    const { data } = await api.get<Match>(`/matches/${id}`);
    return data;
  },

  create: async (match: Partial<Match>) => {
    const { data } = await api.post<Match>('/matches', match);
    return data;
  },

  update: async (id: number, match: Partial<Match>) => {
    const { data } = await api.put<Match>(`/matches/${id}`, match);
    return data;
  },

  delete: async (id: number) => {
    await api.delete(`/matches/${id}`);
  },

  // Match players (lineup)
  getPlayers: async (matchId: number, params?: { is_home_team?: boolean }) => {
    const { data } = await api.get<MatchPlayer[]>(`/matches/${matchId}/players`, { params });
    return data;
  },

  addPlayer: async (matchId: number, player: Partial<MatchPlayer>) => {
    const { data } = await api.post<MatchPlayer>(`/matches/${matchId}/players`, player);
    return data;
  },

  updatePlayer: async (matchId: number, matchPlayerId: number, player: Partial<MatchPlayer>) => {
    const { data } = await api.put<MatchPlayer>(`/matches/${matchId}/players/${matchPlayerId}`, player);
    return data;
  },

  removePlayer: async (matchId: number, matchPlayerId: number) => {
    await api.delete(`/matches/${matchId}/players/${matchPlayerId}`);
  },
};

// ============================================================================
// TRACKS
// ============================================================================

export const tracksApi = {
  list: async (matchId: number, params?: { team?: string; detection_class?: string; is_reviewed?: boolean }) => {
    const { data } = await api.get<Track[]>(`/matches/${matchId}/tracks`, { params });
    return data;
  },

  get: async (matchId: number, trackId: number) => {
    const { data } = await api.get<Track>(`/matches/${matchId}/tracks/${trackId}`);
    return data;
  },

  update: async (matchId: number, trackId: number, track: Partial<Track>) => {
    const { data } = await api.put<Track>(`/matches/${matchId}/tracks/${trackId}`, track);
    return data;
  },

  getDetections: async (matchId: number, trackId: number, params?: { frame_start?: number; frame_end?: number }) => {
    const { data } = await api.get(`/matches/${matchId}/tracks/${trackId}/detections`, { params });
    return data;
  },
};

// ============================================================================
// EVENTS
// ============================================================================

export const eventsApi = {
  list: async (matchId: number, params?: {
    event_type?: string;
    event_category?: string;
    player_track_id?: number;
    half?: number;
    frame_start?: number;
    frame_end?: number;
    include_deleted?: boolean;
  }) => {
    const { data } = await api.get<Event[]>(`/matches/${matchId}/events`, { params });
    return data;
  },

  getSummary: async (matchId: number) => {
    const { data } = await api.get<EventSummary>(`/matches/${matchId}/events/summary`);
    return data;
  },

  get: async (matchId: number, eventId: number) => {
    const { data } = await api.get<Event>(`/matches/${matchId}/events/${eventId}`);
    return data;
  },

  create: async (matchId: number, event: Partial<Event>) => {
    const { data } = await api.post<Event>(`/matches/${matchId}/events`, event);
    return data;
  },

  update: async (matchId: number, eventId: number, event: Partial<Event>) => {
    const { data } = await api.put<Event>(`/matches/${matchId}/events/${eventId}`, event);
    return data;
  },

  delete: async (matchId: number, eventId: number, hardDelete = false) => {
    await api.delete(`/matches/${matchId}/events/${eventId}`, { params: { hard_delete: hardDelete } });
  },
};

// ============================================================================
// CALIBRATION
// ============================================================================

export const calibrationApi = {
  get: async (matchId: number) => {
    const { data } = await api.get<Calibration>(`/matches/${matchId}/calibration`);
    return data;
  },

  getStatus: async (matchId: number) => {
    const { data } = await api.get(`/matches/${matchId}/calibration/status`);
    return data;
  },

  create: async (matchId: number, calibration: Partial<Calibration> & { points: Array<{ point_type: string; pixel_x: number; pixel_y: number; pitch_x: number; pitch_y: number }> }) => {
    const { data } = await api.post<Calibration>(`/matches/${matchId}/calibration`, calibration);
    return data;
  },

  delete: async (matchId: number) => {
    await api.delete(`/matches/${matchId}/calibration`);
  },

  getStandardPoints: async () => {
    const { data } = await api.get('/matches/1/calibration/standard-points');
    return data;
  },
};

// ============================================================================
// CORRECTIONS
// ============================================================================

export const correctionsApi = {
  list: async (params?: { match_id?: number; correction_type?: string; user_id?: number; used_in_training?: boolean }) => {
    const { data } = await api.get<Correction[]>('/corrections', { params });
    return data;
  },

  getSummary: async (matchId?: number) => {
    const { data } = await api.get<CorrectionSummary>('/corrections/summary', { params: { match_id: matchId } });
    return data;
  },

  create: async (correction: Partial<Correction>) => {
    const { data } = await api.post<Correction>('/corrections', correction);
    return data;
  },

  createBatch: async (corrections: Partial<Correction>[]) => {
    const { data } = await api.post<Correction[]>('/corrections/batch', { corrections });
    return data;
  },

  delete: async (id: number) => {
    await api.delete(`/corrections/${id}`);
  },
};

// ============================================================================
// TRAINING
// ============================================================================

export const trainingApi = {
  listExports: async (params?: { export_type?: string }) => {
    const { data } = await api.get<TrainingExport[]>('/training/exports', { params });
    return data;
  },

  getExport: async (id: number) => {
    const { data } = await api.get<TrainingExport>(`/training/exports/${id}`);
    return data;
  },

  createExport: async (exportData: { export_type: string; export_format: string; match_ids?: number[]; notes?: string }) => {
    const { data } = await api.post<TrainingExport>('/training/exports', exportData);
    return data;
  },

  downloadExport: async (id: number) => {
    const { data } = await api.get(`/training/exports/${id}/download`, { responseType: 'blob' });
    return data;
  },
};

// ============================================================================
// ACCURACY
// ============================================================================

export const accuracyApi = {
  getDashboard: async () => {
    const { data } = await api.get<AccuracyDashboard>('/accuracy/dashboard');
    return data;
  },

  getMatchAccuracy: async (matchId: number) => {
    const { data } = await api.get<AccuracyMetric[]>(`/accuracy/matches/${matchId}`);
    return data;
  },

  calculateMatchAccuracy: async (matchId: number) => {
    const { data } = await api.post(`/accuracy/matches/${matchId}/calculate`);
    return data;
  },

  getComparison: async (matchId: number) => {
    const { data } = await api.get<AccuracyComparison>(`/accuracy/comparison/${matchId}`);
    return data;
  },
};

export default api;
