// ============================================================================
// USER & AUTH TYPES
// ============================================================================

export type UserRole = 'admin' | 'analyst' | 'viewer';

export interface User {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

// ============================================================================
// TEAM & PLAYER TYPES
// ============================================================================

export type PlayerPosition = 'goalkeeper' | 'defender' | 'midfielder' | 'forward' | 'unknown';

export interface Team {
  id: number;
  name: string;
  short_name: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  created_at: string;
}

export interface Player {
  id: number;
  team_id: number;
  name: string;
  jersey_number: number | null;
  position: PlayerPosition;
  height_cm: number | null;
  is_active: boolean;
  created_at: string;
}

export interface MatchPlayer {
  id: number;
  match_id: number;
  player_id: number;
  player: Player;
  is_home_team: boolean;
  jersey_number: number | null;
  position: PlayerPosition | null;
  is_starter: boolean;
  subbed_in_minute: number | null;
  subbed_out_minute: number | null;
  primary_track_id: number | null;
  total_distance_m: number | null;
  max_speed_kmh: number | null;
  sprint_count: number | null;
  high_intensity_runs: number | null;
}

// ============================================================================
// MATCH TYPES
// ============================================================================

export interface Match {
  id: number;
  home_team_id: number;
  away_team_id: number;
  home_team: Team;
  away_team: Team;
  match_date: string;
  competition: string | null;
  venue: string | null;
  home_score: number | null;
  away_score: number | null;
  video_filename: string | null;
  fps: number;
  total_frames: number | null;
  video_width: number | null;
  video_height: number | null;
  is_processed: boolean;
  is_calibrated: boolean;
  processing_status: string;
  ai_accuracy_events: number | null;
  ai_accuracy_tracking: number | null;
  ai_accuracy_overall: number | null;
  created_at: string;
  processed_at: string | null;
}

// ============================================================================
// TRACKING TYPES
// ============================================================================

export type TeamSide = 'home' | 'away' | 'referee' | 'linesman' | 'unknown';
export type DetectionClass = 'player' | 'goalkeeper' | 'referee' | 'linesman' | 'ball' | 'unknown';

export interface Track {
  id: number;
  match_id: number;
  track_id: number;
  ai_team: TeamSide;
  ai_detection_class: DetectionClass;
  ai_jersey_number: number | null;
  corrected_team: TeamSide | null;
  corrected_detection_class: DetectionClass | null;
  corrected_jersey_number: number | null;
  assigned_player_id: number | null;
  team: TeamSide;
  detection_class: DetectionClass;
  jersey_number: number | null;
  first_frame: number;
  last_frame: number;
  total_detections: number;
  avg_confidence: number | null;
  total_distance_m: number | null;
  max_speed_ms: number | null;
  avg_speed_ms: number | null;
  sprint_count: number | null;
  is_reviewed: boolean;
  is_corrected: boolean;
}

export interface Detection {
  id: number;
  frame_id: number;
  track_id: number | null;
  bbox_x1: number;
  bbox_y1: number;
  bbox_x2: number;
  bbox_y2: number;
  center_x: number;
  center_y: number;
  foot_x: number;
  foot_y: number;
  pitch_x: number | null;
  pitch_y: number | null;
  confidence: number;
  ai_detection_class: DetectionClass;
  ai_team: TeamSide;
}

export interface BallPosition {
  id: number;
  frame_id: number;
  pixel_x: number;
  pixel_y: number;
  pitch_x: number | null;
  pitch_y: number | null;
  confidence: number;
  is_visible: boolean;
  is_in_play: boolean;
  is_corrected: boolean;
  corrected_x: number | null;
  corrected_y: number | null;
}

export interface Frame {
  id: number;
  match_id: number;
  frame_number: number;
  timestamp_ms: number | null;
  detections: Detection[];
  ball_position: BallPosition | null;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export type EventCategory =
  | 'possession'
  | 'passing'
  | 'shooting'
  | 'defending'
  | 'duel'
  | 'set_piece'
  | 'goalkeeper'
  | 'foul'
  | 'game_state';

export type EventType =
  // Possession
  | 'ball_receipt' | 'ball_recovery' | 'carry' | 'dribble' | 'dispossessed' | 'miscontrol'
  // Passing
  | 'pass' | 'cross' | 'long_ball' | 'through_ball' | 'switch' | 'pass_into_box'
  | 'cutback' | 'assist' | 'key_pass' | 'progressive_pass'
  // Shooting
  | 'shot' | 'shot_on_target' | 'shot_off_target' | 'shot_blocked' | 'goal'
  | 'own_goal' | 'penalty' | 'free_kick_shot' | 'header'
  // Defending
  | 'tackle' | 'interception' | 'clearance' | 'block' | 'pressure' | 'recovery_run'
  // Duels
  | 'aerial_duel' | 'ground_duel' | 'loose_ball_duel'
  // Set pieces
  | 'corner' | 'free_kick' | 'throw_in' | 'goal_kick' | 'kick_off' | 'penalty_kick'
  // Goalkeeper
  | 'save' | 'punch' | 'catch' | 'smother' | 'goal_kick_gk' | 'drop_kick' | 'throw_gk'
  // Fouls
  | 'foul_committed' | 'foul_won' | 'yellow_card' | 'red_card' | 'second_yellow'
  | 'handball' | 'offside'
  // Game state
  | 'half_start' | 'half_end' | 'substitution' | 'injury' | 'ball_out' | 'referee_stop';

export type BodyPart = 'right_foot' | 'left_foot' | 'head' | 'chest' | 'other';
export type PassHeight = 'ground' | 'low' | 'high';
export type PitchZone = 'defensive_third' | 'middle_third' | 'attacking_third' | 'penalty_box' | 'six_yard_box';

export interface Event {
  id: number;
  match_id: number;
  frame_start: number;
  frame_end: number | null;
  timestamp_ms: number | null;
  match_minute: number | null;
  match_second: number | null;
  half: number;
  event_type: EventType;
  event_category: EventCategory;
  player_track_id: number | null;
  player_id: number | null;
  target_track_id: number | null;
  target_player_id: number | null;
  opponent_track_id: number | null;
  opponent_player_id: number | null;
  start_x: number | null;
  start_y: number | null;
  end_x: number | null;
  end_y: number | null;
  start_pitch_x: number | null;
  start_pitch_y: number | null;
  end_pitch_x: number | null;
  end_pitch_y: number | null;
  distance_m: number | null;
  speed_ms: number | null;
  angle_deg: number | null;
  outcome_success: boolean | null;
  body_part: BodyPart | null;
  pass_height: PassHeight | null;
  start_zone: PitchZone | null;
  end_zone: PitchZone | null;
  under_pressure: boolean;
  is_counter_attack: boolean;
  is_set_piece: boolean;
  is_first_touch: boolean;
  related_event_id: number | null;
  is_ai_generated: boolean;
  ai_confidence: number | null;
  is_corrected: boolean;
  is_deleted: boolean;
  is_manually_added: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface EventSummary {
  total_events: number;
  by_category: Record<string, number>;
  by_type: Record<string, number>;
  ai_generated_count: number;
  corrected_count: number;
  deleted_count: number;
  manually_added_count: number;
}

// ============================================================================
// CALIBRATION TYPES
// ============================================================================

export type CalibrationPointType =
  | 'corner_top_left' | 'corner_top_right' | 'corner_bottom_left' | 'corner_bottom_right'
  | 'center_spot' | 'center_circle_top' | 'center_circle_bottom'
  | 'penalty_area_top_left' | 'penalty_area_bottom_left' | 'penalty_spot_left'
  | 'goal_area_top_left' | 'goal_area_bottom_left'
  | 'penalty_area_top_right' | 'penalty_area_bottom_right' | 'penalty_spot_right'
  | 'goal_area_top_right' | 'goal_area_bottom_right'
  | 'goal_post_top_left' | 'goal_post_bottom_left' | 'goal_post_top_right' | 'goal_post_bottom_right'
  | 'halfway_top' | 'halfway_bottom'
  | 'custom';

export interface CalibrationPoint {
  id: number;
  calibration_id: number;
  point_type: CalibrationPointType;
  pixel_x: number;
  pixel_y: number;
  pitch_x: number;
  pitch_y: number;
  custom_label: string | null;
  created_at: string;
}

export interface Calibration {
  id: number;
  match_id: number;
  pitch_length: number;
  pitch_width: number;
  homography_matrix: number[] | null;
  inverse_homography_matrix: number[] | null;
  reprojection_error: number | null;
  is_valid: boolean;
  calibration_frame: number | null;
  calibrated_by_user_id: number | null;
  points: CalibrationPoint[];
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CORRECTION TYPES
// ============================================================================

export type CorrectionType =
  | 'track_team_assignment' | 'track_player_id' | 'track_jersey_number' | 'track_class'
  | 'track_merge' | 'track_split' | 'track_delete'
  | 'detection_bbox' | 'detection_add' | 'detection_delete'
  | 'ball_position' | 'ball_add' | 'ball_delete'
  | 'event_type' | 'event_player' | 'event_target' | 'event_outcome'
  | 'event_location' | 'event_timing' | 'event_add' | 'event_delete' | 'event_details'
  | 'calibration_point';

export interface Correction {
  id: number;
  match_id: number;
  user_id: number;
  correction_type: CorrectionType;
  track_id: number | null;
  event_id: number | null;
  frame_number: number | null;
  detection_id: number | null;
  original_value: Record<string, unknown> | null;
  corrected_value: Record<string, unknown> | null;
  notes: string | null;
  reviewer_confidence: number | null;
  used_in_training: boolean;
  training_export_id: number | null;
  created_at: string;
}

export interface CorrectionSummary {
  total_corrections: number;
  by_type: Record<string, number>;
  by_user: Record<string, number>;
  used_in_training: number;
  pending_training: number;
}

// ============================================================================
// TRAINING & ACCURACY TYPES
// ============================================================================

export type ExportType = 'detection' | 'tracking' | 'team_classification' | 'jersey_recognition' | 'event_detection' | 'all';
export type ExportFormat = 'pytorch' | 'tensorflow' | 'yolo' | 'coco' | 'csv' | 'json';
export type MetricCategory = 'detection' | 'tracking' | 'team_assignment' | 'jersey_recognition' | 'event_detection' | 'event_classification' | 'event_players' | 'overall';

export interface TrainingExport {
  id: number;
  export_type: ExportType;
  export_format: ExportFormat;
  match_ids: number[] | null;
  correction_count: number;
  frame_count: number;
  event_count: number;
  data_start_date: string | null;
  data_end_date: string | null;
  file_path: string | null;
  file_size_bytes: number | null;
  export_config: Record<string, unknown> | null;
  notes: string | null;
  created_by_user_id: number | null;
  created_at: string;
}

export interface AccuracyMetric {
  id: number;
  match_id: number;
  category: MetricCategory;
  accuracy: number;
  precision: number | null;
  recall: number | null;
  f1_score: number | null;
  total_predictions: number;
  correct_predictions: number;
  false_positives: number;
  false_negatives: number;
  breakdown: Record<string, number> | null;
  corrections_count: number;
  calculated_at: string;
}

export interface AccuracyTrend {
  period_start: string;
  period_end: string;
  category: MetricCategory;
  accuracy: number;
  matches_count: number;
  total_corrections: number;
  model_version: string | null;
}

export interface AccuracyDashboard {
  overall_accuracy: number;
  detection_accuracy: number | null;
  tracking_accuracy: number | null;
  team_assignment_accuracy: number | null;
  jersey_recognition_accuracy: number | null;
  event_detection_accuracy: number | null;
  trends: AccuracyTrend[];
  total_matches_processed: number;
  total_corrections_made: number;
  total_events_reviewed: number;
  total_tracks_reviewed: number;
  event_type_accuracy: Record<string, number>;
  recent_matches: Array<{
    id: number;
    match_date: string;
    home_team_id: number;
    away_team_id: number;
    ai_accuracy_overall: number | null;
    ai_accuracy_events: number | null;
    ai_accuracy_tracking: number | null;
  }>;
}

export interface AccuracyComparison {
  match_id: number;
  ai_events_count: number;
  ground_truth_events_count: number;
  matched_events: number;
  false_positives: number;
  false_negatives: number;
  event_accuracy: number;
  event_type_breakdown: Record<string, { ai_count: number; correct: number; accuracy: number }>;
  ai_tracks_count: number;
  corrected_tracks_count: number;
  track_accuracy: number;
  team_assignment_accuracy: number;
  jersey_recognition_accuracy: number;
}
