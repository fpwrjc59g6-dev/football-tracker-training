import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { matchesAPI } from '../services/api';

function MatchCard({ match }) {
  const statusColors = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    processing: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-team-a/20 text-team-a',
    error: 'bg-red-500/20 text-red-400',
  };

  const status = match.is_processed ? 'completed' : (match.processing_status || 'pending');

  return (
    <Link
      to={`/match/${match.id}`}
      className="block bg-card rounded-lg border border-border p-6 hover:border-team-a/50 transition-colors"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {match.home_team?.name || 'Home'} vs {match.away_team?.name || 'Away'}
          </h3>
          <p className="text-gray-400 text-sm">
            {match.competition || 'Match'}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[status] || statusColors.pending}`}>
          {status}
        </span>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">
          {new Date(match.match_date).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>

        {match.home_score !== null && match.away_score !== null && (
          <span className="text-white font-mono text-lg">
            {match.home_score} - {match.away_score}
          </span>
        )}
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isAdmin = (user?.role || '').toLowerCase() === 'admin';

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    try {
      const data = await matchesAPI.list();
      setMatches(data);
    } catch (err) {
      setError('Failed to load matches');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-xl font-bold text-white">Football Tracker</h1>
                <p className="text-gray-400 text-sm">Review Platform</p>
              </div>

              {/* Admin Navigation */}
              {isAdmin && (
                <nav className="flex items-center gap-4 ml-4 border-l border-border pl-6">
                  <Link
                    to="/admin/users"
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    User Management
                  </Link>
                </nav>
              )}
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
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-gray-400 text-sm mb-1">Total Matches</p>
            <p className="text-3xl font-bold text-white">{matches.length}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-gray-400 text-sm mb-1">Processed</p>
            <p className="text-3xl font-bold text-team-a">
              {matches.filter((m) => m.is_processed).length}
            </p>
          </div>
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-gray-400 text-sm mb-1">Pending Review</p>
            <p className="text-3xl font-bold text-yellow-400">
              {matches.filter((m) => !m.is_processed).length}
            </p>
          </div>
        </div>

        {/* Matches List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Matches</h2>
            <Link
              to="/match/new"
              className="px-4 py-2 bg-team-a text-black font-semibold rounded-lg hover:bg-team-a/90 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Match
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-team-a border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-400 mt-4">Loading matches...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-400">{error}</p>
              <button
                onClick={loadMatches}
                className="mt-4 px-4 py-2 text-sm text-team-a border border-team-a rounded-lg hover:bg-team-a/10"
              >
                Retry
              </button>
            </div>
          ) : matches.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-lg border border-border">
              <p className="text-gray-400">No matches found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {matches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
