import { useState } from 'react';
import type { Event, EventCategory } from '../types';
import { Search, Target, CheckCircle, Trash2, Plus, Clock } from 'lucide-react';
import clsx from 'clsx';

interface EventListProps {
  events: Event[];
  selectedEventId: number | null;
  onSelect: (eventId: number) => void;
  currentFrame: number;
}

const CATEGORY_COLORS: Record<EventCategory, string> = {
  possession: 'bg-emerald-500',
  passing: 'bg-blue-500',
  shooting: 'bg-red-500',
  defending: 'bg-orange-500',
  duel: 'bg-purple-500',
  set_piece: 'bg-cyan-500',
  goalkeeper: 'bg-green-500',
  foul: 'bg-yellow-500',
  game_state: 'bg-gray-500',
};

const CATEGORY_LABELS: Record<EventCategory, string> = {
  possession: 'Possession',
  passing: 'Passing',
  shooting: 'Shooting',
  defending: 'Defending',
  duel: 'Duel',
  set_piece: 'Set Piece',
  goalkeeper: 'Goalkeeper',
  foul: 'Foul',
  game_state: 'Game State',
};

export function EventList({ events, selectedEventId, onSelect, currentFrame }: EventListProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<EventCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ai' | 'corrected' | 'manual'>('all');
  const [showDeleted, setShowDeleted] = useState(false);

  // Filter events
  const filteredEvents = events.filter((event) => {
    // Hide deleted unless showing
    if (!showDeleted && event.is_deleted) return false;

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        event.event_type.toLowerCase().includes(searchLower) ||
        event.event_category.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Category filter
    if (categoryFilter !== 'all' && event.event_category !== categoryFilter) return false;

    // Status filter
    if (statusFilter === 'ai' && !event.is_ai_generated) return false;
    if (statusFilter === 'corrected' && !event.is_corrected) return false;
    if (statusFilter === 'manual' && !event.is_manually_added) return false;

    return true;
  });

  // Sort by frame
  const sortedEvents = [...filteredEvents].sort((a, b) => a.frame_start - b.frame_start);

  // Stats
  const activeEvents = events.filter((e) => !e.is_deleted);
  const correctedCount = activeEvents.filter((e) => e.is_corrected).length;
  const manualCount = activeEvents.filter((e) => e.is_manually_added).length;
  const deletedCount = events.filter((e) => e.is_deleted).length;

  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      <div className="px-4 py-3 border-b border-surface-800 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <Target className="w-4 h-4 text-brand-400" />
          <span className="text-surface-400">{activeEvents.length} events</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4 text-warning-400" />
          <span className="text-surface-400">{correctedCount} corrected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-success-400" />
          <span className="text-surface-400">{manualCount} added</span>
        </div>
        {deletedCount > 0 && (
          <button
            onClick={() => setShowDeleted(!showDeleted)}
            className={clsx(
              'flex items-center gap-1.5 hover:text-white transition-colors',
              showDeleted ? 'text-error-400' : 'text-surface-500'
            )}
          >
            <Trash2 className="w-4 h-4" />
            <span>{deletedCount} deleted</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="p-3 border-b border-surface-800 space-y-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events..."
            className="input pl-9 py-1.5 text-sm"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as EventCategory | 'all')}
            className="select text-xs py-1 flex-1"
          >
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'ai' | 'corrected' | 'manual')}
            className="select text-xs py-1 flex-1"
          >
            <option value="all">All Status</option>
            <option value="ai">AI Generated</option>
            <option value="corrected">Corrected</option>
            <option value="manual">Manually Added</option>
          </select>
        </div>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto">
        {sortedEvents.length === 0 ? (
          <div className="p-8 text-center text-surface-500">
            <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No events found</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-800">
            {sortedEvents.map((event) => {
              const isNearCurrent = Math.abs(event.frame_start - currentFrame) < 30;

              return (
                <button
                  key={event.id}
                  onClick={() => onSelect(event.id)}
                  className={clsx(
                    'w-full px-4 py-3 text-left transition-colors',
                    event.is_deleted && 'opacity-50',
                    selectedEventId === event.id
                      ? 'bg-brand-500/10 border-l-2 border-brand-500'
                      : isNearCurrent
                      ? 'bg-surface-800/30 hover:bg-surface-800/50'
                      : 'hover:bg-surface-800/50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Category color */}
                    <div className={clsx('w-3 h-3 rounded-full', CATEGORY_COLORS[event.event_category])} />

                    {/* Event info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white capitalize">
                          {event.event_type.replace(/_/g, ' ')}
                        </span>
                        {event.outcome_success !== null && (
                          <span className={clsx(
                            'text-xs',
                            event.outcome_success ? 'text-success-400' : 'text-error-400'
                          )}>
                            {event.outcome_success ? '✓' : '✗'}
                          </span>
                        )}
                        {event.is_deleted && (
                          <span className="badge-error text-2xs">Deleted</span>
                        )}
                        {event.is_corrected && !event.is_deleted && (
                          <span className="badge-warning text-2xs">Corrected</span>
                        )}
                        {event.is_manually_added && (
                          <span className="badge-success text-2xs">Added</span>
                        )}
                      </div>
                      <div className="text-xs text-surface-500 mt-0.5">
                        {CATEGORY_LABELS[event.event_category]}
                        {event.player_track_id && ` · Track ${event.player_track_id}`}
                        {event.distance_m && ` · ${event.distance_m.toFixed(1)}m`}
                      </div>
                    </div>

                    {/* Frame/time info */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-mono text-surface-300">
                        {event.match_minute !== null ? (
                          `${event.match_minute}'`
                        ) : (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {Math.floor(event.frame_start / 30 / 60)}:{String(Math.floor((event.frame_start / 30) % 60)).padStart(2, '0')}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-surface-500">
                        Frame {event.frame_start.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Context flags */}
                  {(event.under_pressure || event.is_counter_attack || event.is_set_piece || event.is_first_touch) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {event.under_pressure && (
                        <span className="badge-neutral text-2xs">Under Pressure</span>
                      )}
                      {event.is_counter_attack && (
                        <span className="badge-neutral text-2xs">Counter Attack</span>
                      )}
                      {event.is_set_piece && (
                        <span className="badge-neutral text-2xs">Set Piece</span>
                      )}
                      {event.is_first_touch && (
                        <span className="badge-neutral text-2xs">First Touch</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
