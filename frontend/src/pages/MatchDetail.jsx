import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { matchesAPI, eventsAPI, processingAPI } from '../services/api';

function ProcessingStatus({ matchId, status, onStatusChange }) {
  const [processing, setProcessing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadProcessingStatus();
    // Poll for updates if processing
    let interval;
    if (status === 'processing' || status === 'queued') {
      interval = setInterval(loadProcessingStatus, 5000);
    }
    return () => clearInterval(interval);
  }, [matchId, status]);

  const loadProcessingStatus = async () => {
    try {
      const data = await processingAPI.getStatus(matchId);
      setProcessing(data);
      if (data.processing_status !== status) {
        onStatusChange?.(data.processing_status);
      }
    } catch (err) {
      console.error('Failed to load processing status:', err);
    }
  };

  const handleStartProcessing = async () => {
    try {
      setLoading(true);
      setError('');
      await processingAPI.startProcessing(matchId);
      await loadProcessingStatus();
      onStatusChange?.('queued');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to start processing');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelProcessing = async () => {
    if (!confirm('Are you sure you want to cancel processing?')) return;
    try {
      setLoading(true);
      await processingAPI.cancelProcessing(matchId);
      await loadProcessingStatus();
      onStatusChange?.('cancelled');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to cancel processing');
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    queued: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    processing: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
    cancelled: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  };

  const statusIcons = {
    pending: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    queued: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    processing: (
      <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
    ),
    completed: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  const currentStatus = processing?.processing_status || status || 'pending';

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Video Processing</h3>
        <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 border ${statusColors[currentStatus] || statusColors.pending}`}>
          {statusIcons[currentStatus]}
          {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Progress Bar */}
      {(currentStatus === 'processing' || currentStatus === 'queued') && processing?.progress_percent !== null && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-400 mb-1">
            <span>Progress</span>
            <span>{processing.progress_percent?.toFixed(1) || 0}%</span>
          </div>
          <div className="w-full bg-background rounded-full h-2">
            <div
              className="bg-team-a h-2 rounded-full transition-all duration-500"
              style={{ width: `${processing.progress_percent || 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats Grid */}
      {processing && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{processing.frames_processed || 0}</p>
            <p className="text-xs text-gray-400">Frames</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{processing.total_frames || '-'}</p>
            <p className="text-xs text-gray-400">Total</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{processing.detections_count || 0}</p>
            <p className="text-xs text-gray-400">Detections</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{processing.events_count || 0}</p>
            <p className="text-xs text-gray-400">Events</p>
          </div>
        </div>
      )}

      {/* Video File Info */}
      {processing?.video_filename && (
        <div className="mb-4 p-3 bg-background rounded border border-border">
          <p className="text-sm text-gray-400">Video File</p>
          <p className="text-white font-mono text-sm truncate">{processing.video_filename}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {(currentStatus === 'pending' || currentStatus === 'cancelled' || currentStatus === 'error') && (
          <button
            onClick={handleStartProcessing}
            disabled={loading || !processing?.video_filename}
            className="flex-1 px-4 py-2 bg-team-a text-black font-semibold rounded-lg hover:bg-team-a/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            Start Processing
          </button>
        )}

        {(currentStatus === 'queued' || currentStatus === 'processing') && (
          <button
            onClick={handleCancelProcessing}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 font-semibold rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel
          </button>
        )}

        {currentStatus === 'completed' && (
          <button
            onClick={() => {
              if (confirm('Reprocess this video? This will re-run the entire processing pipeline.')) {
                processingAPI.startProcessing(matchId, { reprocess: true }).then(() => {
                  loadProcessingStatus();
                  onStatusChange?.('queued');
                });
              }
            }}
            disabled={loading}
            className="px-4 py-2 bg-card border border-border text-gray-400 font-medium rounded-lg hover:border-yellow-500/50 hover:text-yellow-400 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reprocess
          </button>
        )}
      </div>

      {!processing?.video_filename && (
        <p className="mt-3 text-sm text-yellow-400">
          No video file set. Edit match details to add a video filename.
        </p>
      )}
    </div>
  );
}

export default function MatchDetail() {
  const { id } = useParams();
  const [match, setMatch] = useState(null);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMatchData();
  }, [id]);

  const loadMatchData = async () => {
    try {
      setLoading(true);
      const [matchData, eventsData, statsData] = await Promise.all([
        matchesAPI.get(id),
        eventsAPI.getMatchEvents(id),
        matchesAPI.getDetectionStats(id),
      ]);
      setMatch(matchData);
      setEvents(eventsData);
      setStats(statsData);
    } catch (err) {
      setError('Failed to load match data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (newStatus) => {
    setMatch(prev => ({ ...prev, processing_status: newStatus }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-team-a border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 mt-4">Loading match...</p>
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Match not found'}</p>
          <Link to="/" className="text-team-a hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link to="/" className="text-gray-400 hover:text-white text-sm mb-2 inline-block">
            &larr; Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {match.home_team?.name || 'Home'} vs {match.away_team?.name || 'Away'}
              </h1>
              <p className="text-gray-400">
                {match.competition} &middot;{' '}
                {new Date(match.match_date).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            {match.home_score !== null && (
              <div className="text-4xl font-bold text-white font-mono">
                {match.home_score} - {match.away_score}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Processing Status Card */}
        <div className="mb-8">
          <ProcessingStatus
            matchId={parseInt(id)}
            status={match.processing_status}
            onStatusChange={handleStatusChange}
          />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-gray-400 text-sm mb-1">Status</p>
            <p className={`text-xl font-semibold ${match.is_processed ? 'text-team-a' : 'text-yellow-400'}`}>
              {match.is_processed ? 'Processed' : match.processing_status || 'Pending'}
            </p>
          </div>
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-gray-400 text-sm mb-1">Total Frames</p>
            <p className="text-xl font-semibold text-white">{stats?.frame_count || 0}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-gray-400 text-sm mb-1">Detections</p>
            <p className="text-xl font-semibold text-white">{stats?.total_detections || 0}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-gray-400 text-sm mb-1">Events</p>
            <p className="text-xl font-semibold text-white">{events.length}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mb-8">
          <Link
            to={`/match/${id}/detections`}
            className="px-6 py-3 bg-team-a hover:bg-team-a/90 text-white font-medium rounded-lg transition-colors"
          >
            Review Detections
          </Link>
          <Link
            to={`/match/${id}/events`}
            className="px-6 py-3 bg-card border border-border hover:border-team-a/50 text-white font-medium rounded-lg transition-colors"
          >
            Review Events
          </Link>
          <Link
            to={`/match/${id}/export`}
            className="px-6 py-3 bg-card border border-border hover:border-yellow-500/50 text-yellow-400 font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export YOLO Dataset
          </Link>
          <Link
            to={`/match/${id}/accuracy`}
            className="px-6 py-3 bg-card border border-border hover:border-indigo-500/50 text-indigo-400 font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Accuracy Dashboard
          </Link>
          <Link
            to={`/match/${id}/lineup`}
            className="px-6 py-3 bg-card border border-border hover:border-cyan-500/50 text-cyan-400 font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Match Lineup
          </Link>
          <Link
            to={`/match/${id}/calibrate`}
            className="px-6 py-3 bg-card border border-border hover:border-orange-500/50 text-orange-400 font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Video Calibration
          </Link>
        </div>

        {/* Events List */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Events ({events.length})</h2>
          {events.length === 0 ? (
            <div className="bg-card rounded-lg border border-border p-8 text-center">
              <p className="text-gray-400">No events detected yet</p>
              {!match.is_processed && (
                <p className="text-sm text-gray-500 mt-2">Process the video to detect events</p>
              )}
            </div>
          ) : (
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <table className="w-full">
                <thead className="bg-background">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Confidence</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {events.slice(0, 20).map((event) => (
                    <tr key={event.id} className="hover:bg-background/50">
                      <td className="px-4 py-3 text-sm text-white font-mono">
                        {event.match_minute ? `${event.match_minute}'` : `${Math.floor(event.timestamp_ms / 60000)}:${String(Math.floor((event.timestamp_ms % 60000) / 1000)).padStart(2, '0')}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-white">{event.event_type}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{event.event_category || '-'}</td>
                      <td className="px-4 py-3 text-sm text-white">
                        {event.confidence ? `${(event.confidence * 100).toFixed(0)}%` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded ${
                          event.is_verified
                            ? event.is_correct
                              ? 'bg-team-a/20 text-team-a'
                              : 'bg-red-500/20 text-red-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {event.is_verified ? (event.is_correct ? 'Correct' : 'Incorrect') : 'Unverified'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {events.length > 20 && (
                <div className="px-4 py-3 bg-background text-center">
                  <p className="text-gray-400 text-sm">Showing 20 of {events.length} events</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
