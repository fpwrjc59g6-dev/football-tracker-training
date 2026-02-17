import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { processingAPI, analyticsAPI } from '../services/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function TrainingDashboard() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [exports, setExports] = useState([]);
  const [processingStats, setProcessingStats] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load multiple data sources in parallel
      const [accuracyData, procStats, exportsData] = await Promise.all([
        analyticsAPI.getGlobalTrends().catch(() => null),
        processingAPI.getStats().catch(() => null),
        fetchExports().catch(() => []),
      ]);

      setStats(accuracyData);
      setProcessingStats(procStats);
      setExports(exportsData);
    } catch (err) {
      console.error('Failed to load training data:', err);
      setError('Failed to load training dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchExports = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/api/v1/training/exports?limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch exports');
    return response.json();
  };

  const createExport = async (exportType) => {
    try {
      setCreating(true);
      const token = localStorage.getItem('token');

      const response = await fetch(`${API_URL}/api/v1/training/exports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          export_type: exportType,
          export_format: 'json',
          notes: `Export created from Training Dashboard - ${new Date().toLocaleString()}`,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to create export');
      }

      // Refresh exports list
      const exportsData = await fetchExports();
      setExports(exportsData);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const downloadExport = (exportId) => {
    const token = localStorage.getItem('token');
    window.open(`${API_URL}/api/v1/training/exports/${exportId}/download?token=${token}`, '_blank');
  };

  const isAdmin = (user?.role || '').toLowerCase() === 'admin';

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-team-a border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 mt-4">Loading training dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-white">Training Dashboard</h1>
                <p className="text-gray-400 text-sm">AI Model Training & Export</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-white text-sm font-medium">{user?.full_name || user?.username}</p>
                <p className="text-gray-400 text-xs capitalize">{user?.role}</p>
              </div>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-border rounded-lg hover:border-gray-500 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-team-a/20 rounded-lg">
                <svg className="w-5 h-5 text-team-a" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-400 text-sm">Tracking Accuracy</p>
            </div>
            <p className="text-3xl font-bold text-white">
              {stats?.tracking_accuracy?.toFixed(1) || 0}%
            </p>
          </div>

          <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="text-gray-400 text-sm">Event Detection</p>
            </div>
            <p className="text-3xl font-bold text-white">
              {stats?.event_detection_accuracy?.toFixed(1) || 0}%
            </p>
          </div>

          <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-gray-400 text-sm">Total Reviews</p>
            </div>
            <p className="text-3xl font-bold text-white">
              {(stats?.total_tracks_reviewed || 0) + (stats?.total_events_reviewed || 0)}
            </p>
          </div>

          <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-gray-400 text-sm">Processed Matches</p>
            </div>
            <p className="text-3xl font-bold text-white">
              {processingStats?.processed_matches || 0}
            </p>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Create Export Section */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Create Training Export</h2>
            <p className="text-gray-400 text-sm mb-6">
              Export reviewed and corrected data for AI model training.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => createExport('all')}
                disabled={creating || !isAdmin}
                className="w-full p-4 bg-team-a/10 border border-team-a/30 rounded-lg text-left hover:bg-team-a/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Complete Export</p>
                    <p className="text-gray-400 text-sm">All tracking, events, and corrections</p>
                  </div>
                  <svg className="w-5 h-5 text-team-a" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
              </button>

              <button
                onClick={() => createExport('tracking')}
                disabled={creating || !isAdmin}
                className="w-full p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-left hover:bg-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Tracking Data</p>
                    <p className="text-gray-400 text-sm">Player tracks and team classifications</p>
                  </div>
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </button>

              <button
                onClick={() => createExport('event_detection')}
                disabled={creating || !isAdmin}
                className="w-full p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg text-left hover:bg-purple-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Event Detection</p>
                    <p className="text-gray-400 text-sm">Passes, shots, tackles, and other events</p>
                  </div>
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </button>

              {!isAdmin && (
                <p className="text-yellow-400 text-sm text-center mt-4">
                  Admin access required to create exports
                </p>
              )}
            </div>
          </div>

          {/* Recent Exports */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Recent Exports</h2>

            {exports.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">No exports yet</p>
                <p className="text-gray-500 text-sm mt-1">Create your first export to start training</p>
              </div>
            ) : (
              <div className="space-y-3">
                {exports.map((exp) => (
                  <div
                    key={exp.id}
                    className="p-4 bg-background rounded-lg border border-border"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">
                        Export #{exp.id}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded ${
                        exp.export_type === 'all'
                          ? 'bg-team-a/20 text-team-a'
                          : exp.export_type === 'tracking'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {exp.export_type}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                      <div>
                        <p className="text-gray-500">Corrections</p>
                        <p className="text-white">{exp.correction_count || 0}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Frames</p>
                        <p className="text-white">{exp.frame_count || 0}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Events</p>
                        <p className="text-white">{exp.event_count || 0}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 text-xs">
                        {new Date(exp.created_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => downloadExport(exp.id)}
                        className="px-3 py-1 text-sm text-team-a hover:bg-team-a/10 rounded transition-colors"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Model Training Status */}
        <div className="mt-8 bg-card rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Model Training Progress</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Detection Model */}
            <div className="p-4 bg-background rounded-lg border border-border">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white font-medium">Detection Model</p>
                <span className="px-2 py-1 text-xs bg-team-a/20 text-team-a rounded">
                  v{stats?.model_version || '1.0'}
                </span>
              </div>
              <div className="mb-3">
                <div className="flex justify-between text-sm text-gray-400 mb-1">
                  <span>Training Data</span>
                  <span>{stats?.total_tracks_reviewed || 0} samples</span>
                </div>
                <div className="w-full bg-card rounded-full h-2">
                  <div
                    className="bg-team-a h-2 rounded-full"
                    style={{ width: `${Math.min(100, ((stats?.total_tracks_reviewed || 0) / 1000) * 100)}%` }}
                  />
                </div>
              </div>
              <p className="text-gray-500 text-xs">
                {stats?.total_tracks_reviewed >= 1000 ? 'Ready for training' : `Need ${1000 - (stats?.total_tracks_reviewed || 0)} more samples`}
              </p>
            </div>

            {/* Event Classifier */}
            <div className="p-4 bg-background rounded-lg border border-border">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white font-medium">Event Classifier</p>
                <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded">
                  v{stats?.event_model_version || '1.0'}
                </span>
              </div>
              <div className="mb-3">
                <div className="flex justify-between text-sm text-gray-400 mb-1">
                  <span>Training Data</span>
                  <span>{stats?.total_events_reviewed || 0} samples</span>
                </div>
                <div className="w-full bg-card rounded-full h-2">
                  <div
                    className="bg-blue-400 h-2 rounded-full"
                    style={{ width: `${Math.min(100, ((stats?.total_events_reviewed || 0) / 500) * 100)}%` }}
                  />
                </div>
              </div>
              <p className="text-gray-500 text-xs">
                {stats?.total_events_reviewed >= 500 ? 'Ready for training' : `Need ${500 - (stats?.total_events_reviewed || 0)} more samples`}
              </p>
            </div>

            {/* Team Classifier */}
            <div className="p-4 bg-background rounded-lg border border-border">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white font-medium">Team Classifier</p>
                <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded">
                  v{stats?.team_model_version || '1.0'}
                </span>
              </div>
              <div className="mb-3">
                <div className="flex justify-between text-sm text-gray-400 mb-1">
                  <span>Accuracy</span>
                  <span>{stats?.team_classification_accuracy?.toFixed(1) || 0}%</span>
                </div>
                <div className="w-full bg-card rounded-full h-2">
                  <div
                    className="bg-purple-400 h-2 rounded-full"
                    style={{ width: `${stats?.team_classification_accuracy || 0}%` }}
                  />
                </div>
              </div>
              <p className="text-gray-500 text-xs">
                Based on {stats?.team_samples_count || 0} classified samples
              </p>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link
            to="/"
            className="p-4 bg-card border border-border rounded-lg hover:border-team-a/50 transition-colors text-center"
          >
            <svg className="w-6 h-6 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <p className="text-white text-sm font-medium">Dashboard</p>
          </Link>

          <Link
            to="/match/new"
            className="p-4 bg-card border border-border rounded-lg hover:border-team-a/50 transition-colors text-center"
          >
            <svg className="w-6 h-6 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <p className="text-white text-sm font-medium">New Match</p>
          </Link>

          {isAdmin && (
            <Link
              to="/admin/users"
              className="p-4 bg-card border border-border rounded-lg hover:border-team-a/50 transition-colors text-center"
            >
              <svg className="w-6 h-6 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p className="text-white text-sm font-medium">Manage Users</p>
            </Link>
          )}

          <a
            href="https://docs.ultralytics.com/datasets/detect/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 bg-card border border-border rounded-lg hover:border-team-a/50 transition-colors text-center"
          >
            <svg className="w-6 h-6 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <p className="text-white text-sm font-medium">YOLO Docs</p>
          </a>
        </div>
      </main>
    </div>
  );
}
