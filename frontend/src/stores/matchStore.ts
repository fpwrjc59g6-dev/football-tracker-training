import { create } from 'zustand';
import type { Match, Track, Event, Frame, Detection } from '../types';

interface MatchState {
  // Current match being viewed/edited
  currentMatch: Match | null;
  setCurrentMatch: (match: Match | null) => void;

  // Video state
  currentFrame: number;
  setCurrentFrame: (frame: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  localVideoUrl: string | null;
  setLocalVideoUrl: (url: string | null) => void;

  // Frame data
  frameData: Frame | null;
  setFrameData: (data: Frame | null) => void;

  // Selection state
  selectedTrackId: number | null;
  setSelectedTrackId: (id: number | null) => void;
  selectedEventId: number | null;
  setSelectedEventId: (id: number | null) => void;
  selectedDetection: Detection | null;
  setSelectedDetection: (detection: Detection | null) => void;

  // Tracks and events for current match
  tracks: Track[];
  setTracks: (tracks: Track[]) => void;
  events: Event[];
  setEvents: (events: Event[]) => void;

  // Filter state
  showHomeTeam: boolean;
  setShowHomeTeam: (show: boolean) => void;
  showAwayTeam: boolean;
  setShowAwayTeam: (show: boolean) => void;
  showReferees: boolean;
  setShowReferees: (show: boolean) => void;
  showBall: boolean;
  setShowBall: (show: boolean) => void;
  eventTypeFilter: string | null;
  setEventTypeFilter: (type: string | null) => void;

  // Edit mode
  editMode: 'view' | 'track' | 'event' | 'calibration';
  setEditMode: (mode: 'view' | 'track' | 'event' | 'calibration') => void;

  // Reset
  reset: () => void;
}

const initialState = {
  currentMatch: null,
  currentFrame: 0,
  isPlaying: false,
  localVideoUrl: null,
  frameData: null,
  selectedTrackId: null,
  selectedEventId: null,
  selectedDetection: null,
  tracks: [],
  events: [],
  showHomeTeam: true,
  showAwayTeam: true,
  showReferees: true,
  showBall: true,
  eventTypeFilter: null,
  editMode: 'view' as const,
};

export const useMatchStore = create<MatchState>((set) => ({
  ...initialState,

  setCurrentMatch: (match) => set({ currentMatch: match }),
  setCurrentFrame: (frame) => set({ currentFrame: frame }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setLocalVideoUrl: (url) => set({ localVideoUrl: url }),
  setFrameData: (data) => set({ frameData: data }),
  setSelectedTrackId: (id) => set({ selectedTrackId: id }),
  setSelectedEventId: (id) => set({ selectedEventId: id }),
  setSelectedDetection: (detection) => set({ selectedDetection: detection }),
  setTracks: (tracks) => set({ tracks }),
  setEvents: (events) => set({ events }),
  setShowHomeTeam: (show) => set({ showHomeTeam: show }),
  setShowAwayTeam: (show) => set({ showAwayTeam: show }),
  setShowReferees: (show) => set({ showReferees: show }),
  setShowBall: (show) => set({ showBall: show }),
  setEventTypeFilter: (type) => set({ eventTypeFilter: type }),
  setEditMode: (mode) => set({ editMode: mode }),
  reset: () => set(initialState),
}));
