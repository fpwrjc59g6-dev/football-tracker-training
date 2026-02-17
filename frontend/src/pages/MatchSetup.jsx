import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { teamsAPI, matchesAPI } from '../services/api';

export default function MatchSetup() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    home_team_id: '',
    away_team_id: '',
    match_date: new Date().toISOString().split('T')[0],
    competition: '',
    venue: '',
    home_score: '',
    away_score: '',
    video_filename: '',
    fps: '30',
  });

  // New team modal state
  const [showNewTeamModal, setShowNewTeamModal] = useState(false);
  const [newTeamSide, setNewTeamSide] = useState('home'); // 'home' or 'away'
  const [newTeamData, setNewTeamData] = useState({
    name: '',
    short_name: '',
    primary_color: '#00ff00',
    secondary_color: '#ffffff',
  });

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      setTeamsLoading(true);
      const data = await teamsAPI.list();
      setTeams(data);
    } catch (err) {
      console.error('Failed to load teams:', err);
      setError('Failed to load teams');
    } finally {
      setTeamsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleNewTeamChange = (e) => {
    const { name, value } = e.target;
    setNewTeamData(prev => ({ ...prev, [name]: value }));
  };

  const createNewTeam = async (e) => {
    e.preventDefault();
    if (!newTeamData.name.trim()) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(newTeamData),
      });

      if (!response.ok) {
        throw new Error('Failed to create team');
      }

      const team = await response.json();
      setTeams(prev => [...prev, team]);

      // Auto-select the new team
      if (newTeamSide === 'home') {
        setFormData(prev => ({ ...prev, home_team_id: team.id.toString() }));
      } else {
        setFormData(prev => ({ ...prev, away_team_id: team.id.toString() }));
      }

      setShowNewTeamModal(false);
      setNewTeamData({ name: '', short_name: '', primary_color: '#00ff00', secondary_color: '#ffffff' });
      setSuccess(`Team "${team.name}" created successfully`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to create team: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!formData.home_team_id || !formData.away_team_id) {
      setError('Please select both home and away teams');
      return;
    }

    if (formData.home_team_id === formData.away_team_id) {
      setError('Home and away teams must be different');
      return;
    }

    if (!formData.match_date) {
      setError('Please select a match date');
      return;
    }

    try {
      setLoading(true);

      const matchPayload = {
        home_team_id: parseInt(formData.home_team_id),
        away_team_id: parseInt(formData.away_team_id),
        match_date: formData.match_date,
        competition: formData.competition || null,
        venue: formData.venue || null,
        home_score: formData.home_score ? parseInt(formData.home_score) : null,
        away_score: formData.away_score ? parseInt(formData.away_score) : null,
        video_filename: formData.video_filename || null,
        fps: parseFloat(formData.fps) || 30.0,
      };

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/matches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(matchPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create match');
      }

      const match = await response.json();
      setSuccess('Match created successfully! Redirecting...');

      // Redirect to match detail page after short delay
      setTimeout(() => {
        navigate(`/match/${match.id}`);
      }, 1500);

    } catch (err) {
      setError(err.message || 'Failed to create match');
    } finally {
      setLoading(false);
    }
  };

  const openNewTeamModal = (side) => {
    setNewTeamSide(side);
    setShowNewTeamModal(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">New Match Setup</h1>
                <p className="text-gray-400 text-sm">Create a new match for processing</p>
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
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-green-400">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Teams Section */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Teams</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Home Team */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Home Team *
                </label>
                <div className="flex gap-2">
                  <select
                    name="home_team_id"
                    value={formData.home_team_id}
                    onChange={handleChange}
                    disabled={teamsLoading}
                    className="flex-1 bg-background border border-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-team-a"
                  >
                    <option value="">Select home team</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => openNewTeamModal('home')}
                    className="px-3 py-2 bg-team-a/20 text-team-a border border-team-a/30 rounded-lg hover:bg-team-a/30 transition-colors"
                    title="Create new team"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Away Team */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Away Team *
                </label>
                <div className="flex gap-2">
                  <select
                    name="away_team_id"
                    value={formData.away_team_id}
                    onChange={handleChange}
                    disabled={teamsLoading}
                    className="flex-1 bg-background border border-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-team-a"
                  >
                    <option value="">Select away team</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => openNewTeamModal('away')}
                    className="px-3 py-2 bg-team-b/20 text-team-b border border-team-b/30 rounded-lg hover:bg-team-b/30 transition-colors"
                    title="Create new team"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Match Details Section */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Match Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Match Date */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Match Date *
                </label>
                <input
                  type="date"
                  name="match_date"
                  value={formData.match_date}
                  onChange={handleChange}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-team-a"
                />
              </div>

              {/* Competition */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Competition
                </label>
                <input
                  type="text"
                  name="competition"
                  value={formData.competition}
                  onChange={handleChange}
                  placeholder="e.g., Premier League, Cup Final"
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-team-a"
                />
              </div>

              {/* Venue */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Venue
                </label>
                <input
                  type="text"
                  name="venue"
                  value={formData.venue}
                  onChange={handleChange}
                  placeholder="e.g., Wembley Stadium"
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-team-a"
                />
              </div>

              {/* Score (optional - for completed matches) */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Final Score (optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    name="home_score"
                    value={formData.home_score}
                    onChange={handleChange}
                    min="0"
                    placeholder="H"
                    className="w-20 bg-background border border-border rounded-lg px-3 py-2 text-white text-center focus:outline-none focus:border-team-a"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="number"
                    name="away_score"
                    value={formData.away_score}
                    onChange={handleChange}
                    min="0"
                    placeholder="A"
                    className="w-20 bg-background border border-border rounded-lg px-3 py-2 text-white text-center focus:outline-none focus:border-team-a"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Video Configuration Section */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Video Configuration</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Video Filename */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Video Filename
                </label>
                <input
                  type="text"
                  name="video_filename"
                  value={formData.video_filename}
                  onChange={handleChange}
                  placeholder="e.g., match-2026-01-24.mp4"
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-team-a"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Enter the filename of the video in the processing directory
                </p>
              </div>

              {/* FPS */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Video FPS
                </label>
                <input
                  type="number"
                  name="fps"
                  value={formData.fps}
                  onChange={handleChange}
                  min="1"
                  max="120"
                  step="0.01"
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-team-a"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Frame rate of the video (default: 30)
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-6 py-3 text-gray-400 border border-border rounded-lg hover:text-white hover:border-gray-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-team-a text-black font-semibold rounded-lg hover:bg-team-a/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  Creating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Match
                </>
              )}
            </button>
          </div>
        </form>
      </main>

      {/* New Team Modal */}
      {showNewTeamModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Create New {newTeamSide === 'home' ? 'Home' : 'Away'} Team
              </h3>
              <button
                onClick={() => setShowNewTeamModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={createNewTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={newTeamData.name}
                  onChange={handleNewTeamChange}
                  placeholder="e.g., Manchester United"
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-team-a"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Short Name
                </label>
                <input
                  type="text"
                  name="short_name"
                  value={newTeamData.short_name}
                  onChange={handleNewTeamChange}
                  placeholder="e.g., MUN"
                  maxLength={10}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-team-a"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      name="primary_color"
                      value={newTeamData.primary_color}
                      onChange={handleNewTeamChange}
                      className="w-10 h-10 rounded border border-border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={newTeamData.primary_color}
                      onChange={handleNewTeamChange}
                      name="primary_color"
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-white text-sm font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Secondary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      name="secondary_color"
                      value={newTeamData.secondary_color}
                      onChange={handleNewTeamChange}
                      className="w-10 h-10 rounded border border-border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={newTeamData.secondary_color}
                      onChange={handleNewTeamChange}
                      name="secondary_color"
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-white text-sm font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewTeamModal(false)}
                  className="px-4 py-2 text-gray-400 border border-border rounded-lg hover:text-white hover:border-gray-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !newTeamData.name.trim()}
                  className="px-4 py-2 bg-team-a text-black font-semibold rounded-lg hover:bg-team-a/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
