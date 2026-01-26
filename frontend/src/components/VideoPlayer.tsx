import { useRef, useEffect, useState, useCallback } from 'react';
import type { Match, Event } from '../types';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface VideoPlayerProps {
  match: Match;
  currentFrame: number;
  onFrameChange: (frame: number) => void;
  events: Event[];
  selectedEventId: number | null;
  localVideoUrl: string | null;
  onVideoLoad: (url: string) => void;
}

export function VideoPlayer({
  match,
  currentFrame,
  onFrameChange,
  events,
  selectedEventId,
  localVideoUrl,
  onVideoLoad,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });

  const fps = match.fps || 30;
  const totalFrames = match.total_frames || 1;

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onVideoLoad(url);
  }, [onVideoLoad]);

  // Seek to frame
  useEffect(() => {
    if (videoRef.current && fps > 0 && localVideoUrl) {
      const time = currentFrame / fps;
      if (Math.abs(videoRef.current.currentTime - time) > 0.05) {
        videoRef.current.currentTime = time;
      }
    }
  }, [currentFrame, fps, localVideoUrl]);

  // Handle video loaded
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setVideoDimensions({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
      });
    }
  }, []);

  // Handle time update
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current && isPlaying) {
      const frame = Math.floor(videoRef.current.currentTime * fps);
      onFrameChange(frame);
    }
  }, [fps, isPlaying, onFrameChange]);

  // Draw overlays on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || videoDimensions.width === 0 || !localVideoUrl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = video.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Find detections for current frame (would come from frameData in real implementation)
    // For now, we'll show track info at their last known positions

    // Draw event indicators
    events.forEach((event, index) => {
      const isSelected = event.id === selectedEventId;

      ctx.fillStyle = isSelected ? 'rgba(251, 191, 36, 0.9)' : 'rgba(139, 92, 246, 0.8)';
      ctx.fillRect(12, 12 + index * 28, 160, 24);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = isSelected ? 'bold 11px Inter, sans-serif' : '11px Inter, sans-serif';
      ctx.fillText(
        `${event.event_type.replace(/_/g, ' ')}${event.outcome_success ? ' ✓' : ''}`,
        20,
        28 + index * 28
      );
    });

  }, [events, selectedEventId, videoDimensions, localVideoUrl, currentFrame]);

  // Playback controls
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const stepFrame = useCallback((delta: number) => {
    const newFrame = Math.max(0, Math.min(totalFrames - 1, currentFrame + delta));
    onFrameChange(newFrame);
  }, [currentFrame, totalFrames, onFrameChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          stepFrame(e.shiftKey ? -10 : -1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          stepFrame(e.shiftKey ? 10 : 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          stepFrame(e.shiftKey ? -fps : -Math.round(fps / 2));
          break;
        case 'ArrowDown':
          e.preventDefault();
          stepFrame(e.shiftKey ? fps : Math.round(fps / 2));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, stepFrame, fps]);

  const formatTime = (frame: number) => {
    const totalSeconds = frame / fps;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div ref={containerRef}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Video container */}
      <div className="relative bg-surface-950 aspect-video">
        {!localVideoUrl ? (
          /* No video - show upload prompt */
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-center p-8 max-w-md">
              <div className="w-20 h-20 rounded-2xl bg-surface-800 flex items-center justify-center mx-auto mb-6">
                <Upload className="w-10 h-10 text-surface-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Load Video from Your Device
              </h3>
              <p className="text-surface-400 mb-6">
                Select the match video file from your computer. The video stays on your device — only annotations sync to the server.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-primary btn-lg"
              >
                <Upload className="w-5 h-5" />
                Choose Video File
              </button>
              <p className="text-surface-500 text-sm mt-4">
                Supports MP4, MOV, WebM
              </p>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              src={localVideoUrl}
              className="w-full h-full"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              muted={isMuted}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          </>
        )}
      </div>

      {/* Controls */}
      <div className="video-controls">
        {/* Top row - playback */}
        <div className="flex items-center gap-2 mb-4">
          {/* Frame step back */}
          <button
            onClick={() => stepFrame(-fps)}
            className="btn-ghost btn-icon"
            title="Back 1 second"
            disabled={!localVideoUrl}
          >
            <SkipBack className="w-5 h-5" />
          </button>
          <button
            onClick={() => stepFrame(-1)}
            className="btn-ghost btn-icon"
            title="Previous frame"
            disabled={!localVideoUrl}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Play/pause */}
          <button
            onClick={togglePlay}
            className="btn-primary btn-icon"
            disabled={!localVideoUrl}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>

          {/* Frame step forward */}
          <button
            onClick={() => stepFrame(1)}
            className="btn-ghost btn-icon"
            title="Next frame"
            disabled={!localVideoUrl}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => stepFrame(fps)}
            className="btn-ghost btn-icon"
            title="Forward 1 second"
            disabled={!localVideoUrl}
          >
            <SkipForward className="w-5 h-5" />
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Frame info */}
          <div className="text-sm">
            <span className="font-mono text-white">{formatTime(currentFrame)}</span>
            <span className="text-surface-500 mx-2">/</span>
            <span className="font-mono text-surface-400">{formatTime(totalFrames)}</span>
          </div>

          <div className="h-4 w-px bg-surface-700 mx-2" />

          <div className="text-sm">
            <span className="text-surface-400">Frame</span>
            <span className="font-mono text-white ml-2">{currentFrame.toLocaleString()}</span>
            <span className="text-surface-500 mx-1">/</span>
            <span className="font-mono text-surface-400">{totalFrames.toLocaleString()}</span>
          </div>

          {/* Volume toggle */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="btn-ghost btn-icon ml-2"
            disabled={!localVideoUrl}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          {/* Change video */}
          {localVideoUrl && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-ghost btn-sm ml-2"
            >
              <Upload className="w-4 h-4" />
              Change
            </button>
          )}
        </div>

        {/* Timeline slider */}
        <div className="relative">
          <input
            type="range"
            min={0}
            max={totalFrames - 1}
            value={currentFrame}
            onChange={(e) => onFrameChange(parseInt(e.target.value))}
            className="w-full h-2 bg-surface-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
            disabled={!localVideoUrl}
          />
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="mt-3 flex items-center gap-4 text-xs text-surface-500">
          <span><kbd className="px-1.5 py-0.5 bg-surface-800 rounded text-surface-400">Space</kbd> Play/Pause</span>
          <span><kbd className="px-1.5 py-0.5 bg-surface-800 rounded text-surface-400">←</kbd><kbd className="px-1.5 py-0.5 bg-surface-800 rounded text-surface-400 ml-1">→</kbd> Frame step</span>
          <span><kbd className="px-1.5 py-0.5 bg-surface-800 rounded text-surface-400">↑</kbd><kbd className="px-1.5 py-0.5 bg-surface-800 rounded text-surface-400 ml-1">↓</kbd> 0.5s step</span>
          <span><kbd className="px-1.5 py-0.5 bg-surface-800 rounded text-surface-400">Shift</kbd> + Arrow: Larger steps</span>
        </div>
      </div>
    </div>
  );
}
