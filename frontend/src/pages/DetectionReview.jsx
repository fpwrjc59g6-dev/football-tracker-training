import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { matchesAPI, detectionsAPI } from '../services/api';

// Class colors from spec
const CLASS_COLORS = {
  team_a: '#22C55E',
  team_b: '#F97316',
  ball: '#FACC15',
  referee: '#EF4444',
  linesman: '#EF4444',
};

const CLASS_OPTIONS = ['team_a', 'team_b', 'ball', 'referee', 'linesman'];

function BoundingBox({ detection, isSelected, onClick, scale }) {
  const color = CLASS_COLORS[detection.class_name] || '#888888';
  const { x1, y1, x2, y2 } = detection.bbox;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick(detection);
      }}
      className={`absolute border-2 cursor-pointer transition-all ${
        isSelected ? 'border-white shadow-lg' : ''
      }`}
      style={{
        left: x1 * scale,
        top: y1 * scale,
        width: (x2 - x1) * scale,
        height: (y2 - y1) * scale,
        borderColor: color,
        backgroundColor: isSelected ? `${color}33` : 'transparent',
      }}
    >
      {/* Label */}
      <div
        className="absolute -top-6 left-0 px-1.5 py-0.5 text-xs font-medium text-white rounded"
        style={{ backgroundColor: color }}
      >
        {detection.class_name}
        {detection.confidence && ` ${(detection.confidence * 100).toFixed(0)}%`}
      </div>
    </div>
  );
}

function EditPanel({ detection, onUpdate, onDelete, onClose }) {
  const [selectedClass, setSelectedClass] = useState(detection.class_name);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (selectedClass === detection.class_name) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      await onUpdate(detection.id, { class_name: selectedClass });
      onClose();
    } catch (err) {
      console.error('Failed to update detection:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this detection?')) return;

    setSaving(true);
    try {
      await onDelete(detection.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete detection:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-medium">Edit Detection</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        {/* Detection ID */}
        <div>
          <p className="text-gray-400 text-xs mb-1">Detection ID</p>
          <p className="text-white font-mono text-sm">#{detection.id}</p>
        </div>

        {/* Class selector */}
        <div>
          <p className="text-gray-400 text-xs mb-2">Class</p>
          <div className="grid grid-cols-2 gap-2">
            {CLASS_OPTIONS.map((cls) => (
              <button
                key={cls}
                onClick={() => setSelectedClass(cls)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  selectedClass === cls
                    ? 'border-white bg-white/10'
                    : 'border-border hover:border-gray-500'
                }`}
                style={{
                  color: CLASS_COLORS[cls],
                  borderColor: selectedClass === cls ? CLASS_COLORS[cls] : undefined,
                }}
              >
                {cls}
              </button>
            ))}
          </div>
        </div>

        {/* Confidence */}
        {detection.confidence && (
          <div>
            <p className="text-gray-400 text-xs mb-1">Confidence</p>
            <p className="text-white">{(detection.confidence * 100).toFixed(1)}%</p>
          </div>
        )}

        {/* Status */}
        <div>
          <p className="text-gray-400 text-xs mb-1">Status</p>
          <span className={`px-2 py-1 text-xs rounded ${
            detection.is_corrected
              ? 'bg-team-a/20 text-team-a'
              : 'bg-gray-500/20 text-gray-400'
          }`}>
            {detection.is_corrected ? 'Corrected' : 'AI Detection'}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 px-4 bg-team-a hover:bg-team-a/90 disabled:bg-team-a/50 text-white font-medium rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleDelete}
            disabled={saving}
            className="py-2 px-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DetectionReview() {
  const { id: matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [frameList, setFrameList] = useState([]); // List of available frames
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0); // Index in frameList
  const [frameData, setFrameData] = useState(null);
  const [selectedDetection, setSelectedDetection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(false);
  const [error, setError] = useState('');
  const [scale, setScale] = useState(1);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  const containerRef = useRef(null);
  const imageRef = useRef(null);

  // Load match and frame list on mount
  useEffect(() => {
    let cancelled = false;

    const loadInitialData = async () => {
      console.log('[DetectionReview] Loading initial data for match:', matchId);
      try {
        // Load match data
        const matchData = await matchesAPI.get(matchId);
        console.log('[DetectionReview] Match loaded:', matchData);

        if (cancelled) return;
        setMatch(matchData);

        // Load frame list (API has max limit of 1000)
        console.log('[DetectionReview] Loading frame list...');
        const frames = await matchesAPI.getFrames(matchId, 0, 1000);
        console.log('[DetectionReview] Frames loaded:', frames.length, 'frames');
        console.log('[DetectionReview] First frame:', frames[0]);

        if (cancelled) return;

        if (frames.length > 0) {
          setFrameList(frames);
          setCurrentFrameIndex(0);
        } else {
          setError('No frames found for this match');
        }
      } catch (err) {
        console.error('[DetectionReview] Error loading initial data:', err);
        if (!cancelled) {
          setError('Failed to load match data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [matchId]);

  // Load frame data when currentFrameIndex changes
  useEffect(() => {
    if (frameList.length === 0) return;

    const currentFrame = frameList[currentFrameIndex];
    if (!currentFrame) return;

    let cancelled = false;

    const loadFrame = async () => {
      console.log('[DetectionReview] Loading frame:', currentFrame.frame_number, '(id:', currentFrame.id, ')');
      try {
        // Use frame_number to get frame data with detections
        const data = await detectionsAPI.getFrameByNumber(matchId, currentFrame.frame_number);
        console.log('[DetectionReview] Frame data loaded:', data.detections?.length, 'detections');

        if (!cancelled) {
          setFrameData(data);
          setSelectedDetection(null);
        }
      } catch (err) {
        console.error('[DetectionReview] Failed to load frame:', err);
        if (!cancelled) {
          setFrameData(null);
        }
      }
    };

    loadFrame();

    return () => {
      cancelled = true;
    };
  }, [matchId, frameList, currentFrameIndex]);

  const handleImageLoad = useCallback((e) => {
    const img = e.target;
    const containerWidth = containerRef.current?.clientWidth || 800;
    const newScale = containerWidth / img.naturalWidth;
    setScale(newScale);
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    setImageLoading(false);
    console.log('[DetectionReview] Image loaded, scale:', newScale);
  }, []);

  const handlePrevFrame = useCallback(() => {
    setCurrentFrameIndex(prev => Math.max(0, prev - 1));
  }, []);

  const handleNextFrame = useCallback(() => {
    setCurrentFrameIndex(prev => Math.min(frameList.length - 1, prev + 1));
  }, [frameList.length]);

  // Jump multiple frames (1 second worth based on frame spacing)
  const handlePrevSecond = useCallback(() => {
    // Assuming ~30fps, jump ~30 frames
    setCurrentFrameIndex(prev => Math.max(0, prev - 6)); // 6 frames at 5-frame intervals ≈ 1 sec
  }, []);

  const handleNextSecond = useCallback(() => {
    setCurrentFrameIndex(prev => Math.min(frameList.length - 1, prev + 6));
  }, [frameList.length]);

  const handleUpdateDetection = async (detectionId, data) => {
    await detectionsAPI.updateDetection(detectionId, data);
    // Reload frame to get updated detections
    const currentFrame = frameList[currentFrameIndex];
    if (currentFrame) {
      const newData = await detectionsAPI.getFrameByNumber(matchId, currentFrame.frame_number);
      setFrameData(newData);
    }
  };

  const handleDeleteDetection = async (detectionId) => {
    await detectionsAPI.deleteDetection(detectionId);
    const currentFrame = frameList[currentFrameIndex];
    if (currentFrame) {
      const newData = await detectionsAPI.getFrameByNumber(matchId, currentFrame.frame_number);
      setFrameData(newData);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (e.shiftKey) {
          handlePrevSecond();
        } else {
          handlePrevFrame();
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (e.shiftKey) {
          handleNextSecond();
        } else {
          handleNextFrame();
        }
      } else if (e.key === 'Escape') {
        setSelectedDetection(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevFrame, handleNextFrame, handlePrevSecond, handleNextSecond]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-team-a border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Match not found'}</p>
          <Link to="/" className="text-team-a hover:underline">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  // Get current frame info
  const currentFrame = frameList[currentFrameIndex];
  const frameNumber = currentFrame?.frame_number || 0;

  // Get auth token for image request
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const imageUrl = currentFrame
    ? `${apiUrl}/api/v1/matches/${matchId}/frame-by-number/${frameNumber}/image?token=${token}`
    : null;

  console.log('[DetectionReview] Render - frameIndex:', currentFrameIndex, 'frameNumber:', frameNumber, 'detections:', frameData?.detections?.length);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link to={`/match/${matchId}`} className="text-gray-400 hover:text-white text-sm">
                &larr; Back to Match
              </Link>
              <h1 className="text-xl font-bold text-white mt-1">Detection Review</h1>
              <p className="text-gray-400 text-sm">
                {match.home_team_name} vs {match.away_team_name}
              </p>
            </div>

            {/* Frame navigation */}
            <div className="flex items-center gap-4">
              <button
                onClick={handlePrevFrame}
                disabled={currentFrameIndex === 0}
                className="p-2 text-gray-400 hover:text-white bg-background rounded-lg border border-border hover:border-gray-500 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="text-center">
                <div className="text-white font-mono text-lg">
                  Frame {frameNumber}
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  {currentFrameIndex + 1} / {frameList.length} frames
                </p>
              </div>

              <button
                onClick={handleNextFrame}
                disabled={currentFrameIndex === frameList.length - 1}
                className="p-2 text-gray-400 hover:text-white bg-background rounded-lg border border-border hover:border-gray-500 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Frame viewer */}
          <div className="flex-1" ref={containerRef}>
            <div
              className="relative bg-black rounded-lg overflow-hidden"
              onClick={() => setSelectedDetection(null)}
            >
              {imageLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                  <div className="w-8 h-8 border-4 border-team-a border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}

              {imageUrl && (
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt={`Frame ${frameNumber}`}
                  onLoad={handleImageLoad}
                  onLoadStart={() => setImageLoading(true)}
                  onError={(e) => {
                    console.error('[DetectionReview] Image failed to load:', imageUrl);
                    setImageLoading(false);
                  }}
                  className="w-full"
                  style={{ display: imageLoading ? 'none' : 'block' }}
                />
              )}

              {/* Bounding boxes */}
              {!imageLoading && frameData?.detections?.map((det) => (
                <BoundingBox
                  key={det.id}
                  detection={det}
                  isSelected={selectedDetection?.id === det.id}
                  onClick={setSelectedDetection}
                  scale={scale}
                />
              ))}
            </div>

            {/* Frame info */}
            <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
              <div>
                Frame: <span className="text-white font-mono">{frameNumber}</span>
                {frameData?.timestamp_ms && (
                  <span className="ml-4">
                    Time: <span className="text-white font-mono">
                      {Math.floor(frameData.timestamp_ms / 60000)}:
                      {String(Math.floor((frameData.timestamp_ms % 60000) / 1000)).padStart(2, '0')}
                    </span>
                  </span>
                )}
              </div>
              <div>
                Detections: <span className="text-white">{frameData?.detections?.length || 0}</span>
              </div>
            </div>

            {/* Keyboard shortcuts */}
            <div className="mt-4 text-xs text-gray-500">
              <span className="mr-4">← → Navigate frames</span>
              <span className="mr-4">Shift+← → Jump 1 second</span>
              <span>ESC Deselect</span>
            </div>
          </div>

          {/* Edit panel */}
          <div className="w-80">
            {selectedDetection ? (
              <EditPanel
                detection={selectedDetection}
                onUpdate={handleUpdateDetection}
                onDelete={handleDeleteDetection}
                onClose={() => setSelectedDetection(null)}
              />
            ) : (
              <div className="bg-card rounded-lg border border-border p-4">
                <p className="text-gray-400 text-center">
                  Click a bounding box to edit
                </p>

                {/* Detection summary */}
                <div className="mt-4 space-y-2">
                  <p className="text-white font-medium text-sm">Detections in frame:</p>
                  {frameData?.detections?.length > 0 ? (
                    <div className="space-y-1">
                      {Object.entries(
                        frameData.detections.reduce((acc, det) => {
                          acc[det.class_name] = (acc[det.class_name] || 0) + 1;
                          return acc;
                        }, {})
                      ).map(([cls, count]) => (
                        <div key={cls} className="flex items-center justify-between">
                          <span style={{ color: CLASS_COLORS[cls] }}>{cls}</span>
                          <span className="text-white font-mono">{count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No detections</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
