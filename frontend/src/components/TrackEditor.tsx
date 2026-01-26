import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tracksApi, playersApi } from '../services/api';
import type { Track, TeamSide, DetectionClass } from '../types';
import { useQuery } from '@tanstack/react-query';
import { X, Save, AlertTriangle, User } from 'lucide-react';

interface TrackEditorProps {
  track: Track;
  matchId: number;
  onClose: () => void;
}

const TEAM_OPTIONS: { value: TeamSide; label: string }[] = [
  { value: 'home', label: 'Home Team' },
  { value: 'away', label: 'Away Team' },
  { value: 'referee', label: 'Referee' },
  { value: 'linesman', label: 'Linesman' },
  { value: 'unknown', label: 'Unknown' },
];

const CLASS_OPTIONS: { value: DetectionClass; label: string }[] = [
  { value: 'player', label: 'Player' },
  { value: 'goalkeeper', label: 'Goalkeeper' },
  { value: 'referee', label: 'Referee' },
  { value: 'linesman', label: 'Linesman' },
  { value: 'unknown', label: 'Unknown' },
];

export function TrackEditor({ track, matchId, onClose }: TrackEditorProps) {
  const queryClient = useQueryClient();

  const [correctedTeam, setCorrectedTeam] = useState<TeamSide | null>(track.corrected_team);
  const [correctedClass, setCorrectedClass] = useState<DetectionClass | null>(track.corrected_detection_class);
  const [correctedJersey, setCorrectedJersey] = useState<number | null>(track.corrected_jersey_number);
  const [assignedPlayerId, setAssignedPlayerId] = useState<number | null>(track.assigned_player_id);
  const [isReviewed, setIsReviewed] = useState(track.is_reviewed);

  // Fetch players for assignment dropdown
  const { data: players } = useQuery({
    queryKey: ['players'],
    queryFn: () => playersApi.list(),
  });

  // Filter players by team
  const teamPlayers = players;

  // Update mutation
  const updateTrack = useMutation({
    mutationFn: () => tracksApi.update(matchId, track.track_id, {
      corrected_team: correctedTeam,
      corrected_detection_class: correctedClass,
      corrected_jersey_number: correctedJersey,
      assigned_player_id: assignedPlayerId,
      is_reviewed: isReviewed,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracks', matchId] });
      onClose();
    },
  });

  const hasChanges =
    correctedTeam !== track.corrected_team ||
    correctedClass !== track.corrected_detection_class ||
    correctedJersey !== track.corrected_jersey_number ||
    assignedPlayerId !== track.assigned_player_id ||
    isReviewed !== track.is_reviewed;

  return (
    <div className="card">
      {/* Header */}
      <div className="px-4 py-3 border-b border-surface-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-brand-400" />
          <h3 className="font-semibold text-white">Edit Track {track.track_id}</h3>
          {track.is_corrected && (
            <span className="badge-warning">Previously Corrected</span>
          )}
        </div>
        <button onClick={onClose} className="btn-ghost btn-icon btn-sm">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* AI predictions vs corrections */}
        <div className="p-3 bg-surface-800/50 rounded-lg">
          <div className="text-xs text-surface-500 uppercase tracking-wider mb-2">AI Prediction</div>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-surface-400">Team:</span>
              <span className="text-white ml-1 capitalize">{track.ai_team}</span>
            </div>
            <div>
              <span className="text-surface-400">Class:</span>
              <span className="text-white ml-1 capitalize">{track.ai_detection_class}</span>
            </div>
            {track.ai_jersey_number && (
              <div>
                <span className="text-surface-400">Jersey:</span>
                <span className="text-white ml-1">#{track.ai_jersey_number}</span>
              </div>
            )}
          </div>
        </div>

        {/* Team correction */}
        <div>
          <label className="label">
            Team Assignment
            {correctedTeam && correctedTeam !== track.ai_team && (
              <span className="text-warning-400 ml-2">(Changed)</span>
            )}
          </label>
          <select
            value={correctedTeam || track.ai_team}
            onChange={(e) => setCorrectedTeam(e.target.value as TeamSide)}
            className="select"
          >
            {TEAM_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Class correction */}
        <div>
          <label className="label">
            Detection Class
            {correctedClass && correctedClass !== track.ai_detection_class && (
              <span className="text-warning-400 ml-2">(Changed)</span>
            )}
          </label>
          <select
            value={correctedClass || track.ai_detection_class}
            onChange={(e) => setCorrectedClass(e.target.value as DetectionClass)}
            className="select"
          >
            {CLASS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Jersey number correction */}
        <div>
          <label className="label">
            Jersey Number
            {correctedJersey && correctedJersey !== track.ai_jersey_number && (
              <span className="text-warning-400 ml-2">(Changed)</span>
            )}
          </label>
          <input
            type="number"
            min={1}
            max={99}
            value={correctedJersey ?? track.ai_jersey_number ?? ''}
            onChange={(e) => setCorrectedJersey(e.target.value ? Number(e.target.value) : null)}
            placeholder="Enter jersey number"
            className="input"
          />
        </div>

        {/* Player assignment */}
        <div>
          <label className="label">Assign to Player (Optional)</label>
          <select
            value={assignedPlayerId || ''}
            onChange={(e) => setAssignedPlayerId(e.target.value ? Number(e.target.value) : null)}
            className="select"
          >
            <option value="">— Not assigned —</option>
            {teamPlayers?.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name} {player.jersey_number ? `#${player.jersey_number}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Mark as reviewed */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="is_reviewed"
            checked={isReviewed}
            onChange={(e) => setIsReviewed(e.target.checked)}
            className="w-4 h-4 rounded border-surface-600 bg-surface-800 text-brand-500 focus:ring-brand-500"
          />
          <label htmlFor="is_reviewed" className="text-sm text-surface-300 cursor-pointer">
            Mark as reviewed
          </label>
        </div>

        {/* Track stats */}
        <div className="p-3 bg-surface-800/50 rounded-lg">
          <div className="text-xs text-surface-500 uppercase tracking-wider mb-2">Track Statistics</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-surface-400">Frames:</span>
              <span className="text-white ml-1">{track.first_frame} - {track.last_frame}</span>
            </div>
            <div>
              <span className="text-surface-400">Detections:</span>
              <span className="text-white ml-1">{track.total_detections}</span>
            </div>
            {track.total_distance_m && (
              <div>
                <span className="text-surface-400">Distance:</span>
                <span className="text-white ml-1">{track.total_distance_m.toFixed(0)}m</span>
              </div>
            )}
            {track.max_speed_ms && (
              <div>
                <span className="text-surface-400">Max Speed:</span>
                <span className="text-white ml-1">{(track.max_speed_ms * 3.6).toFixed(1)} km/h</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-surface-800 flex items-center justify-between">
        <div className="text-xs text-surface-500">
          {hasChanges && (
            <span className="flex items-center gap-1 text-warning-400">
              <AlertTriangle className="w-3 h-3" />
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="btn-ghost btn-sm">
            Cancel
          </button>
          <button
            onClick={() => updateTrack.mutate()}
            disabled={updateTrack.isPending}
            className="btn-primary btn-sm"
          >
            {updateTrack.isPending ? (
              <>
                <span className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-white"></span>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
