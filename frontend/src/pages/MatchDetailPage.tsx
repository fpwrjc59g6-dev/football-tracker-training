import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { matchesApi, tracksApi, eventsApi, accuracyApi } from '../services/api';
import { useMatchStore } from '../stores/matchStore';
import { VideoPlayer } from '../components/VideoPlayer';
import { TrackList } from '../components/TrackList';
import { EventList } from '../components/EventList';
import { TrackEditor } from '../components/TrackEditor';
import { EventEditor } from '../components/EventEditor';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Video,
  Users,
  Calendar,
  Target,
  RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';

type Tab = 'tracks' | 'events' | 'calibration';

export function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const matchId = Number(id);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>('events');
  const {
    setCurrentMatch,
    currentFrame,
    setCurrentFrame,
    tracks,
    setTracks,
    events,
    setEvents,
    selectedTrackId,
    setSelectedTrackId,
    selectedEventId,
    setSelectedEventId,
    editMode,
    setEditMode,
    localVideoUrl,
    setLocalVideoUrl,
    reset,
  } = useMatchStore();

  // Fetch match data
  const { data: match, isLoading: matchLoading } = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => matchesApi.get(matchId),
    enabled: !!matchId,
  });

  // Fetch tracks
  const { data: tracksData } = useQuery({
    queryKey: ['tracks', matchId],
    queryFn: () => tracksApi.list(matchId),
    enabled: !!matchId,
  });

  // Fetch events
  const { data: eventsData } = useQuery({
    queryKey: ['events', matchId],
    queryFn: () => eventsApi.list(matchId),
    enabled: !!matchId,
  });

  // Calculate accuracy mutation
  const calculateAccuracy = useMutation({
    mutationFn: () => accuracyApi.calculateMatchAccuracy(matchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match', matchId] });
    },
  });

  // Update store when data loads
  useEffect(() => {
    if (match) setCurrentMatch(match);
    if (tracksData) setTracks(tracksData);
    if (eventsData) setEvents(eventsData);
  }, [match, tracksData, eventsData, setCurrentMatch, setTracks, setEvents]);

  // Cleanup on unmount
  useEffect(() => {
    return () => reset();
  }, [reset]);

  // Get selected track and event
  const selectedTrack = tracks.find((t) => t.track_id === selectedTrackId);
  const selectedEvent = events.find((e) => e.id === selectedEventId);

  // Filter events for current frame range
  const currentFrameEvents = events.filter(
    (e) => e.frame_start <= currentFrame && (!e.frame_end || e.frame_end >= currentFrame)
  );

  if (matchLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-center py-12">
        <Video className="w-12 h-12 mx-auto text-surface-600 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">Match not found</h3>
        <Link to="/matches" className="btn-secondary">
          <ArrowLeft className="w-4 h-4" />
          Back to Matches
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link
            to="/matches"
            className="mt-1 p-2 rounded-lg hover:bg-surface-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-surface-400" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: match.home_team.primary_color || '#3B82F6' }}
              />
              <h1 className="text-2xl font-bold text-white">
                {match.home_team.name}
              </h1>
              <span className="text-xl text-surface-500">vs</span>
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: match.away_team.primary_color || '#EF4444' }}
              />
              <h1 className="text-2xl font-bold text-white">
                {match.away_team.name}
              </h1>
              {match.home_score !== null && (
                <span className="text-xl font-mono text-surface-400">
                  ({match.home_score} - {match.away_score})
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-surface-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {format(new Date(match.match_date), 'MMMM d, yyyy')}
              </span>
              {match.competition && (
                <span>{match.competition}</span>
              )}
              {match.venue && (
                <span>{match.venue}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Accuracy badge */}
          {match.ai_accuracy_overall !== null && (
            <div className={clsx(
              'px-4 py-2 rounded-lg flex items-center gap-2',
              match.ai_accuracy_overall >= 80 ? 'bg-success-500/20' :
              match.ai_accuracy_overall >= 60 ? 'bg-warning-500/20' : 'bg-error-500/20'
            )}>
              <Target className={clsx(
                'w-5 h-5',
                match.ai_accuracy_overall >= 80 ? 'text-success-400' :
                match.ai_accuracy_overall >= 60 ? 'text-warning-400' : 'text-error-400'
              )} />
              <span className={clsx(
                'font-semibold',
                match.ai_accuracy_overall >= 80 ? 'text-success-400' :
                match.ai_accuracy_overall >= 60 ? 'text-warning-400' : 'text-error-400'
              )}>
                {match.ai_accuracy_overall.toFixed(1)}% Accuracy
              </span>
            </div>
          )}

          <button
            onClick={() => calculateAccuracy.mutate()}
            disabled={calculateAccuracy.isPending}
            className="btn-secondary"
          >
            <RefreshCw className={clsx('w-4 h-4', calculateAccuracy.isPending && 'animate-spin')} />
            Recalculate
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Video player - left side */}
        <div className="col-span-8">
          <div className="card overflow-hidden">
            <VideoPlayer
              match={match}
              currentFrame={currentFrame}
              onFrameChange={setCurrentFrame}
              events={currentFrameEvents}
              selectedEventId={selectedEventId}
              localVideoUrl={localVideoUrl}
              onVideoLoad={setLocalVideoUrl}
            />
          </div>

          {/* Event timeline */}
          <div className="card mt-4 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-white">Event Timeline</h3>
              <span className="text-sm text-surface-400">
                {events.length} events
              </span>
            </div>
            <div className="timeline h-12 relative">
              {/* Current position indicator */}
              <div
                className="timeline-marker z-10"
                style={{
                  left: `${(currentFrame / (match.total_frames || 1)) * 100}%`,
                }}
              />
              {/* Event markers */}
              {events.filter(e => !e.is_deleted).map((event) => {
                const position = (event.frame_start / (match.total_frames || 1)) * 100;
                const color = event.event_type.includes('goal') ? '#22c55e' :
                             event.event_type.includes('shot') ? '#ef4444' :
                             event.event_type.includes('pass') ? '#3b82f6' :
                             event.event_type.includes('tackle') ? '#f59e0b' :
                             '#8b5cf6';
                return (
                  <div
                    key={event.id}
                    className={clsx(
                      'timeline-event',
                      selectedEventId === event.id && 'ring-2 ring-white scale-150'
                    )}
                    style={{
                      left: `${position}%`,
                      backgroundColor: color,
                    }}
                    onClick={() => {
                      setSelectedEventId(event.id);
                      setCurrentFrame(event.frame_start);
                    }}
                    title={`${event.event_type} at frame ${event.frame_start}`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Right panel - tracks/events/editor */}
        <div className="col-span-4 space-y-4">
          {/* Tabs */}
          <div className="tabs">
            <button
              onClick={() => setActiveTab('tracks')}
              className={activeTab === 'tracks' ? 'tab-active' : 'tab'}
            >
              <Users className="w-4 h-4" />
              Tracks ({tracks.length})
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={activeTab === 'events' ? 'tab-active' : 'tab'}
            >
              <Target className="w-4 h-4" />
              Events ({events.filter(e => !e.is_deleted).length})
            </button>
          </div>

          {/* Tab content */}
          <div className="card h-[500px] overflow-hidden flex flex-col">
            {activeTab === 'tracks' && (
              <TrackList
                tracks={tracks}
                selectedTrackId={selectedTrackId}
                onSelect={(trackId) => {
                  setSelectedTrackId(trackId);
                  setEditMode('track');
                }}
                match={match}
              />
            )}
            {activeTab === 'events' && (
              <EventList
                events={events}
                selectedEventId={selectedEventId}
                onSelect={(eventId) => {
                  setSelectedEventId(eventId);
                  const event = events.find(e => e.id === eventId);
                  if (event) setCurrentFrame(event.frame_start);
                  setEditMode('event');
                }}
                currentFrame={currentFrame}
              />
            )}
          </div>

          {/* Editor panel */}
          {selectedTrack && editMode === 'track' && (
            <TrackEditor
              track={selectedTrack}
              matchId={matchId}
              onClose={() => {
                setSelectedTrackId(null);
                setEditMode('view');
              }}
            />
          )}
          {selectedEvent && editMode === 'event' && (
            <EventEditor
              event={selectedEvent}
              matchId={matchId}
              tracks={tracks}
              onClose={() => {
                setSelectedEventId(null);
                setEditMode('view');
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
