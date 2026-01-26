import { useState } from 'react';
import type { Track, Match, TeamSide } from '../types';
import { Search, User, CheckCircle, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface TrackListProps {
  tracks: Track[];
  selectedTrackId: number | null;
  onSelect: (trackId: number) => void;
  match: Match;
}

const TEAM_COLORS: Record<TeamSide, string> = {
  home: 'bg-blue-500',
  away: 'bg-red-500',
  referee: 'bg-yellow-500',
  linesman: 'bg-orange-500',
  unknown: 'bg-gray-500',
};

const TEAM_LABELS: Record<TeamSide, string> = {
  home: 'Home',
  away: 'Away',
  referee: 'Referee',
  linesman: 'Linesman',
  unknown: 'Unknown',
};

export function TrackList({ tracks, selectedTrackId, onSelect, match }: TrackListProps) {
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<TeamSide | 'all'>('all');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'reviewed' | 'pending'>('all');

  // Filter tracks
  const filteredTracks = tracks.filter((track) => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        track.track_id.toString().includes(searchLower) ||
        (track.jersey_number?.toString().includes(searchLower)) ||
        track.team.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Team filter
    if (teamFilter !== 'all' && track.team !== teamFilter) return false;

    // Review filter
    if (reviewFilter === 'reviewed' && !track.is_reviewed) return false;
    if (reviewFilter === 'pending' && track.is_reviewed) return false;

    return true;
  });

  // Sort: pending first, then by track ID
  const sortedTracks = [...filteredTracks].sort((a, b) => {
    if (a.is_reviewed !== b.is_reviewed) return a.is_reviewed ? 1 : -1;
    return a.track_id - b.track_id;
  });

  // Stats
  const reviewedCount = tracks.filter((t) => t.is_reviewed).length;
  const correctedCount = tracks.filter((t) => t.is_corrected).length;

  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      <div className="px-4 py-3 border-b border-surface-800 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4 text-success-400" />
          <span className="text-surface-400">{reviewedCount} reviewed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-warning-400" />
          <span className="text-surface-400">{correctedCount} corrected</span>
        </div>
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
            placeholder="Search tracks..."
            className="input pl-9 py-1.5 text-sm"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2">
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value as TeamSide | 'all')}
            className="select text-xs py-1 flex-1"
          >
            <option value="all">All Teams</option>
            <option value="home">{match.home_team.short_name || 'Home'}</option>
            <option value="away">{match.away_team.short_name || 'Away'}</option>
            <option value="referee">Referee</option>
            <option value="linesman">Linesman</option>
            <option value="unknown">Unknown</option>
          </select>

          <select
            value={reviewFilter}
            onChange={(e) => setReviewFilter(e.target.value as 'all' | 'reviewed' | 'pending')}
            className="select text-xs py-1 flex-1"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending Review</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </div>
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto">
        {sortedTracks.length === 0 ? (
          <div className="p-8 text-center text-surface-500">
            <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No tracks found</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-800">
            {sortedTracks.map((track) => (
              <button
                key={track.id}
                onClick={() => onSelect(track.track_id)}
                className={clsx(
                  'w-full px-4 py-3 text-left hover:bg-surface-800/50 transition-colors',
                  selectedTrackId === track.track_id && 'bg-brand-500/10 border-l-2 border-brand-500'
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Team color indicator */}
                  <div className={clsx('w-3 h-3 rounded-full', TEAM_COLORS[track.team])} />

                  {/* Track info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">
                        Track {track.track_id}
                      </span>
                      {track.jersey_number && (
                        <span className="text-sm text-surface-400">
                          #{track.jersey_number}
                        </span>
                      )}
                      {track.is_corrected && (
                        <span className="badge-warning text-2xs">Corrected</span>
                      )}
                    </div>
                    <div className="text-xs text-surface-500 mt-0.5">
                      {TEAM_LABELS[track.team]} · {track.detection_class} · {track.total_detections} detections
                    </div>
                  </div>

                  {/* Status indicator */}
                  {track.is_reviewed ? (
                    <CheckCircle className="w-5 h-5 text-success-400 flex-shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-surface-600 flex-shrink-0" />
                  )}
                </div>

                {/* Additional info */}
                {track.total_distance_m && (
                  <div className="mt-2 flex items-center gap-4 text-xs text-surface-500">
                    <span>{track.total_distance_m.toFixed(0)}m distance</span>
                    {track.max_speed_ms && (
                      <span>{(track.max_speed_ms * 3.6).toFixed(1)} km/h max</span>
                    )}
                    {track.sprint_count && (
                      <span>{track.sprint_count} sprints</span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
