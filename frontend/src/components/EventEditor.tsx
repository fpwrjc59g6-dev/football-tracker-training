import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsApi } from '../services/api';
import type { Event, Track, EventType, EventCategory, BodyPart, PassHeight } from '../types';
import { X, Save, AlertTriangle, Trash2, Target } from 'lucide-react';
import clsx from 'clsx';

interface EventEditorProps {
  event: Event;
  matchId: number;
  tracks: Track[];
  onClose: () => void;
}

const EVENT_TYPES: { value: EventType; label: string; category: EventCategory }[] = [
  // Possession
  { value: 'ball_receipt', label: 'Ball Receipt', category: 'possession' },
  { value: 'ball_recovery', label: 'Ball Recovery', category: 'possession' },
  { value: 'carry', label: 'Carry', category: 'possession' },
  { value: 'dribble', label: 'Dribble', category: 'possession' },
  { value: 'dispossessed', label: 'Dispossessed', category: 'possession' },
  { value: 'miscontrol', label: 'Miscontrol', category: 'possession' },
  // Passing
  { value: 'pass', label: 'Pass', category: 'passing' },
  { value: 'cross', label: 'Cross', category: 'passing' },
  { value: 'long_ball', label: 'Long Ball', category: 'passing' },
  { value: 'through_ball', label: 'Through Ball', category: 'passing' },
  { value: 'switch', label: 'Switch', category: 'passing' },
  { value: 'pass_into_box', label: 'Pass into Box', category: 'passing' },
  { value: 'cutback', label: 'Cutback', category: 'passing' },
  { value: 'assist', label: 'Assist', category: 'passing' },
  { value: 'key_pass', label: 'Key Pass', category: 'passing' },
  // Shooting
  { value: 'shot', label: 'Shot', category: 'shooting' },
  { value: 'shot_on_target', label: 'Shot on Target', category: 'shooting' },
  { value: 'shot_off_target', label: 'Shot off Target', category: 'shooting' },
  { value: 'shot_blocked', label: 'Shot Blocked', category: 'shooting' },
  { value: 'goal', label: 'Goal', category: 'shooting' },
  { value: 'penalty', label: 'Penalty', category: 'shooting' },
  // Defending
  { value: 'tackle', label: 'Tackle', category: 'defending' },
  { value: 'interception', label: 'Interception', category: 'defending' },
  { value: 'clearance', label: 'Clearance', category: 'defending' },
  { value: 'block', label: 'Block', category: 'defending' },
  { value: 'pressure', label: 'Pressure', category: 'defending' },
  // Duels
  { value: 'aerial_duel', label: 'Aerial Duel', category: 'duel' },
  { value: 'ground_duel', label: 'Ground Duel', category: 'duel' },
  // Set pieces
  { value: 'corner', label: 'Corner', category: 'set_piece' },
  { value: 'free_kick', label: 'Free Kick', category: 'set_piece' },
  { value: 'throw_in', label: 'Throw In', category: 'set_piece' },
  { value: 'goal_kick', label: 'Goal Kick', category: 'set_piece' },
  // Goalkeeper
  { value: 'save', label: 'Save', category: 'goalkeeper' },
  { value: 'punch', label: 'Punch', category: 'goalkeeper' },
  { value: 'catch', label: 'Catch', category: 'goalkeeper' },
  // Fouls
  { value: 'foul_committed', label: 'Foul Committed', category: 'foul' },
  { value: 'foul_won', label: 'Foul Won', category: 'foul' },
  { value: 'yellow_card', label: 'Yellow Card', category: 'foul' },
  { value: 'red_card', label: 'Red Card', category: 'foul' },
  { value: 'offside', label: 'Offside', category: 'foul' },
];

const BODY_PARTS: { value: BodyPart; label: string }[] = [
  { value: 'right_foot', label: 'Right Foot' },
  { value: 'left_foot', label: 'Left Foot' },
  { value: 'head', label: 'Head' },
  { value: 'chest', label: 'Chest' },
  { value: 'other', label: 'Other' },
];

const PASS_HEIGHTS: { value: PassHeight; label: string }[] = [
  { value: 'ground', label: 'Ground' },
  { value: 'low', label: 'Low' },
  { value: 'high', label: 'High' },
];

export function EventEditor({ event, matchId, tracks, onClose }: EventEditorProps) {
  const queryClient = useQueryClient();

  const [eventType, setEventType] = useState<EventType>(event.event_type);
  const [playerTrackId, setPlayerTrackId] = useState<number | null>(event.player_track_id);
  const [targetTrackId, setTargetTrackId] = useState<number | null>(event.target_track_id);
  const [opponentTrackId, setOpponentTrackId] = useState<number | null>(event.opponent_track_id);
  const [outcomeSuccess, setOutcomeSuccess] = useState<boolean | null>(event.outcome_success);
  const [bodyPart, setBodyPart] = useState<BodyPart | null>(event.body_part);
  const [passHeight, setPassHeight] = useState<PassHeight | null>(event.pass_height);
  const [underPressure, setUnderPressure] = useState(event.under_pressure);
  const [isCounterAttack, setIsCounterAttack] = useState(event.is_counter_attack);
  const [isSetPiece, setIsSetPiece] = useState(event.is_set_piece);
  const [isFirstTouch, setIsFirstTouch] = useState(event.is_first_touch);

  // Get event category from type
  const eventCategory = EVENT_TYPES.find((t) => t.value === eventType)?.category || event.event_category;

  // Determine which fields to show based on event type
  const showTargetPlayer = ['pass', 'cross', 'long_ball', 'through_ball', 'switch', 'assist', 'throw_in'].includes(eventType);
  const showOpponent = ['tackle', 'duel', 'aerial_duel', 'ground_duel', 'foul_committed', 'foul_won', 'dispossessed'].includes(eventType);
  const showBodyPart = ['shot', 'pass', 'clearance', 'save', 'header', 'goal'].includes(eventType);
  const showPassHeight = ['pass', 'cross', 'long_ball', 'through_ball'].includes(eventType);
  const showOutcome = !['goal', 'yellow_card', 'red_card', 'offside', 'half_start', 'half_end'].includes(eventType);

  // Update mutation
  const updateEvent = useMutation({
    mutationFn: () => eventsApi.update(matchId, event.id, {
      event_type: eventType,
      event_category: eventCategory,
      player_track_id: playerTrackId,
      target_track_id: targetTrackId,
      opponent_track_id: opponentTrackId,
      outcome_success: outcomeSuccess,
      body_part: bodyPart,
      pass_height: passHeight,
      under_pressure: underPressure,
      is_counter_attack: isCounterAttack,
      is_set_piece: isSetPiece,
      is_first_touch: isFirstTouch,
      is_corrected: true,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', matchId] });
      onClose();
    },
  });

  // Delete mutation
  const deleteEvent = useMutation({
    mutationFn: () => eventsApi.delete(matchId, event.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', matchId] });
      onClose();
    },
  });

  const hasChanges =
    eventType !== event.event_type ||
    playerTrackId !== event.player_track_id ||
    targetTrackId !== event.target_track_id ||
    opponentTrackId !== event.opponent_track_id ||
    outcomeSuccess !== event.outcome_success ||
    bodyPart !== event.body_part ||
    passHeight !== event.pass_height ||
    underPressure !== event.under_pressure ||
    isCounterAttack !== event.is_counter_attack ||
    isSetPiece !== event.is_set_piece ||
    isFirstTouch !== event.is_first_touch;

  return (
    <div className="card">
      {/* Header */}
      <div className="px-4 py-3 border-b border-surface-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-brand-400" />
          <h3 className="font-semibold text-white">Edit Event</h3>
          {event.is_corrected && (
            <span className="badge-warning">Previously Corrected</span>
          )}
          {event.is_ai_generated && (
            <span className="badge-primary">AI Generated</span>
          )}
        </div>
        <button onClick={onClose} className="btn-ghost btn-icon btn-sm">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
        {/* Event type */}
        <div>
          <label className="label">
            Event Type
            {eventType !== event.event_type && (
              <span className="text-warning-400 ml-2">(Changed)</span>
            )}
          </label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as EventType)}
            className="select"
          >
            {EVENT_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({opt.category})
              </option>
            ))}
          </select>
        </div>

        {/* Player (who performed action) */}
        <div>
          <label className="label">Player (Performer)</label>
          <select
            value={playerTrackId || ''}
            onChange={(e) => setPlayerTrackId(e.target.value ? Number(e.target.value) : null)}
            className="select"
          >
            <option value="">— Select player —</option>
            {tracks.filter((t) => t.detection_class === 'player' || t.detection_class === 'goalkeeper').map((track) => (
              <option key={track.id} value={track.track_id}>
                Track {track.track_id} - {track.team} {track.jersey_number ? `#${track.jersey_number}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Target player (for passes) */}
        {showTargetPlayer && (
          <div>
            <label className="label">Target Player (Receiver)</label>
            <select
              value={targetTrackId || ''}
              onChange={(e) => setTargetTrackId(e.target.value ? Number(e.target.value) : null)}
              className="select"
            >
              <option value="">— Select target —</option>
              {tracks.filter((t) => t.detection_class === 'player' || t.detection_class === 'goalkeeper').map((track) => (
                <option key={track.id} value={track.track_id}>
                  Track {track.track_id} - {track.team} {track.jersey_number ? `#${track.jersey_number}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Opponent (for duels, tackles) */}
        {showOpponent && (
          <div>
            <label className="label">Opponent</label>
            <select
              value={opponentTrackId || ''}
              onChange={(e) => setOpponentTrackId(e.target.value ? Number(e.target.value) : null)}
              className="select"
            >
              <option value="">— Select opponent —</option>
              {tracks.filter((t) => t.detection_class === 'player' || t.detection_class === 'goalkeeper').map((track) => (
                <option key={track.id} value={track.track_id}>
                  Track {track.track_id} - {track.team} {track.jersey_number ? `#${track.jersey_number}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Outcome */}
        {showOutcome && (
          <div>
            <label className="label">Outcome</label>
            <div className="flex gap-2">
              <button
                onClick={() => setOutcomeSuccess(true)}
                className={clsx(
                  'flex-1 py-2 px-4 rounded-lg font-medium transition-colors',
                  outcomeSuccess === true
                    ? 'bg-success-500 text-white'
                    : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                )}
              >
                Success ✓
              </button>
              <button
                onClick={() => setOutcomeSuccess(false)}
                className={clsx(
                  'flex-1 py-2 px-4 rounded-lg font-medium transition-colors',
                  outcomeSuccess === false
                    ? 'bg-error-500 text-white'
                    : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                )}
              >
                Failed ✗
              </button>
            </div>
          </div>
        )}

        {/* Body part */}
        {showBodyPart && (
          <div>
            <label className="label">Body Part</label>
            <select
              value={bodyPart || ''}
              onChange={(e) => setBodyPart(e.target.value ? e.target.value as BodyPart : null)}
              className="select"
            >
              <option value="">— Select body part —</option>
              {BODY_PARTS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Pass height */}
        {showPassHeight && (
          <div>
            <label className="label">Pass Height</label>
            <select
              value={passHeight || ''}
              onChange={(e) => setPassHeight(e.target.value ? e.target.value as PassHeight : null)}
              className="select"
            >
              <option value="">— Select height —</option>
              {PASS_HEIGHTS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Context flags */}
        <div>
          <label className="label">Context</label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={underPressure}
                onChange={(e) => setUnderPressure(e.target.checked)}
                className="w-4 h-4 rounded border-surface-600 bg-surface-800 text-brand-500"
              />
              <span className="text-sm text-surface-300">Under Pressure</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isCounterAttack}
                onChange={(e) => setIsCounterAttack(e.target.checked)}
                className="w-4 h-4 rounded border-surface-600 bg-surface-800 text-brand-500"
              />
              <span className="text-sm text-surface-300">Counter Attack</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isSetPiece}
                onChange={(e) => setIsSetPiece(e.target.checked)}
                className="w-4 h-4 rounded border-surface-600 bg-surface-800 text-brand-500"
              />
              <span className="text-sm text-surface-300">Set Piece</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isFirstTouch}
                onChange={(e) => setIsFirstTouch(e.target.checked)}
                className="w-4 h-4 rounded border-surface-600 bg-surface-800 text-brand-500"
              />
              <span className="text-sm text-surface-300">First Touch</span>
            </label>
          </div>
        </div>

        {/* Event info */}
        <div className="p-3 bg-surface-800/50 rounded-lg">
          <div className="text-xs text-surface-500 uppercase tracking-wider mb-2">Event Info</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-surface-400">Frame:</span>
              <span className="text-white ml-1">{event.frame_start}</span>
            </div>
            <div>
              <span className="text-surface-400">Half:</span>
              <span className="text-white ml-1">{event.half}</span>
            </div>
            {event.distance_m && (
              <div>
                <span className="text-surface-400">Distance:</span>
                <span className="text-white ml-1">{event.distance_m.toFixed(1)}m</span>
              </div>
            )}
            {event.ai_confidence && (
              <div>
                <span className="text-surface-400">AI Confidence:</span>
                <span className="text-white ml-1">{(event.ai_confidence * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-surface-800 flex items-center justify-between">
        <button
          onClick={() => {
            if (confirm('Delete this event? This will mark it as a false positive.')) {
              deleteEvent.mutate();
            }
          }}
          disabled={deleteEvent.isPending}
          className="btn-ghost btn-sm text-error-400 hover:text-error-300"
        >
          <Trash2 className="w-4 h-4" />
          Delete Event
        </button>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-xs text-warning-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Unsaved
            </span>
          )}
          <button onClick={onClose} className="btn-ghost btn-sm">
            Cancel
          </button>
          <button
            onClick={() => updateEvent.mutate()}
            disabled={updateEvent.isPending}
            className="btn-primary btn-sm"
          >
            {updateEvent.isPending ? (
              <>
                <span className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-white"></span>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
