import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { matchesAPI } from '../services/api';

const TEAM_COLORS = {
  home: '#22C55E',
  away: '#F97316',
  team_a: '#22C55E',
  team_b: '#F97316',
};

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// API calls for players and tracks - using correct endpoint paths
async function getMatchPlayers(matchId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/v1/matches/${matchId}/players`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to fetch players');
  const players = await response.json();
  // Transform response to expected format with home/away split
  const home_players = players.filter(p => p.is_home_team);
  const away_players = players.filter(p => !p.is_home_team);
  return { home_players, away_players };
}

async function getMatchTracks(matchId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/v1/matches/${matchId}/tracks`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to fetch tracks');
  return response.json();
}

async function assignPlayerToTrack(matchId, trackId, playerId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/v1/tracks/${trackId}/assign-player`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ player_id: playerId }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to assign player');
  }
  return response.json();
}

async function unassignPlayer(matchId, trackId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/v1/tracks/${trackId}/unassign-player`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to unassign player');
  return response.json();
}

function TrackCard({ track, players, onAssign, selectedTrackId, onSelect }) {
  const team = track.team || 'unknown';
  const color = TEAM_COLORS[team] || '#888';
  const isSelected = selectedTrackId === track.track_id;

  return (
    <div
      className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
        isSelected
          ? 'border-team-a bg-team-a/10'
          : track.is_assigned
          ? 'border-green-500/50 bg-green-500/10'
          : 'border-border bg-card hover:border-gray-500'
      }`}
      onClick={() => onSelect(track.track_id)}
    >
      <div className="flex items-center gap-2">
        <span
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {track.ai_jersey_number || `T${track.track_id}`}
        </span>
        <div className="flex-1 min-w-0">
          {track.assigned_player ? (
            <>
              <p className="text-white font-medium truncate">
                {track.assigned_player.name}
              </p>
              <p className="text-green-400 text-xs">
                #{track.assigned_player.jersey_number} - Assigned
              </p>
            </>
          ) : (
            <>
              <p className="text-white font-medium">Track #{track.track_id}</p>
              <p className="text-gray-400 text-xs">
                {track.total_detections} detections
                {track.ai_jersey_number && ` - AI: #${track.ai_jersey_number}`}
              </p>
            </>
          )}
        </div>
        <span
          className="px-2 py-0.5 rounded text-xs whitespace-nowrap"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {team === 'home' ? 'Home' : team === 'away' ? 'Away' : team}
        </span>
      </div>
    </div>
  );
}

function PlayerCard({ player, onAssign, isAvailable }) {
  return (
    <div
      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
        player.primary_track_id
          ? 'border-green-500/50 bg-green-500/10 opacity-50'
          : isAvailable
          ? 'border-border bg-card hover:border-team-a hover:bg-team-a/10'
          : 'border-border bg-card'
      }`}
      onClick={() => !player.primary_track_id && isAvailable && onAssign(player.player_id)}
    >
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-white">
          {player.jersey_number || '?'}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate">{player.name}</p>
          <p className="text-gray-400 text-xs">
            {player.position}
            {player.primary_track_id && ` - Track #${player.primary_track_id}`}
          </p>
        </div>
        {player.primary_track_id && (
          <span className="text-green-400 text-xs">Assigned</span>
        )}
      </div>
    </div>
  );
}

export default function MatchLineup() {
  const { id: matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [playersData, setPlayersData] = useState(null);
  const [tracksData, setTracksData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [matchId]);

  const loadData = async () => {
    try {
      const [matchData, players, tracks] = await Promise.all([
        matchesAPI.get(matchId),
        getMatchPlayers(matchId),
        getMatchTracks(matchId),
      ]);
      setMatch(matchData);
      setPlayersData(players);
      setTracksData(tracks);
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (playerId) => {
    if (!selectedTrackId) return;
    setSaving(true);
    try {
      await assignPlayerToTrack(matchId, selectedTrackId, playerId);
      // Refresh data
      const [players, tracks] = await Promise.all([
        getMatchPlayers(matchId),
        getMatchTracks(matchId),
      ]);
      setPlayersData(players);
      setTracksData(tracks);
      setSelectedTrackId(null);
    } catch (err) {
      console.error('Failed to assign:', err);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async (trackId) => {
    setSaving(true);
    try {
      await unassignPlayer(matchId, trackId);
      // Refresh data
      const [players, tracks] = await Promise.all([
        getMatchPlayers(matchId),
        getMatchTracks(matchId),
      ]);
      setPlayersData(players);
      setTracksData(tracks);
    } catch (err) {
      console.error('Failed to unassign:', err);
    } finally {
      setSaving(false);
    }
  };

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

  const homeTracks = tracksData?.tracks?.filter((t) => t.team === 'home') || [];
  const awayTracks = tracksData?.tracks?.filter((t) => t.team === 'away') || [];
  const otherTracks = tracksData?.tracks?.filter((t) => !['home', 'away'].includes(t.team)) || [];

  const assignedCount = tracksData?.assigned_count || 0;
  const totalTracks = tracksData?.total_tracks || 0;

  // Determine which team the selected track belongs to
  const selectedTrack = tracksData?.tracks?.find((t) => t.track_id === selectedTrackId);
  const selectedTeam = selectedTrack?.team;

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
              <h1 className="text-xl font-bold text-white mt-1">Player Assignment</h1>
              <p className="text-gray-400 text-sm">
                {match?.home_team?.name || 'Home'} vs {match?.away_team?.name || 'Away'}
              </p>
            </div>

            <div className="text-right">
              <p className="text-white font-mono text-2xl">
                {assignedCount}/{totalTracks}
              </p>
              <p className="text-gray-400 text-sm">tracks assigned</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-2 bg-background rounded-full overflow-hidden">
            <div
              className="h-full bg-team-a transition-all"
              style={{ width: `${totalTracks > 0 ? (assignedCount / totalTracks) * 100 : 0}%` }}
            />
          </div>

          {/* Instructions */}
          {selectedTrackId && (
            <div className="mt-4 p-3 bg-team-a/20 border border-team-a/50 rounded-lg">
              <p className="text-white text-sm">
                <strong>Track #{selectedTrackId} selected.</strong> Click a player below to assign them to this track.
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Main content - 3 column layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Home Team Column */}
          <div>
            <div className="bg-card rounded-lg border border-border p-4 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: TEAM_COLORS.home }} />
                <h2 className="text-white font-medium">
                  {match?.home_team?.name || 'Home Team'}
                </h2>
              </div>

              {/* Home Players */}
              <h3 className="text-gray-400 text-xs uppercase tracking-wider mb-2">Players</h3>
              <div className="space-y-2 mb-4">
                {playersData?.home_players?.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No players</p>
                ) : (
                  playersData?.home_players?.map((player) => (
                    <PlayerCard
                      key={player.player_id}
                      player={player}
                      onAssign={handleAssign}
                      isAvailable={selectedTrackId && selectedTeam === 'home'}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Home Tracks */}
            <div className="bg-card rounded-lg border border-border p-4">
              <h3 className="text-gray-400 text-xs uppercase tracking-wider mb-2">
                Tracks ({homeTracks.length})
              </h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {homeTracks.map((track) => (
                  <TrackCard
                    key={track.track_id}
                    track={track}
                    selectedTrackId={selectedTrackId}
                    onSelect={setSelectedTrackId}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Center Column - Unassigned / Other */}
          <div>
            <div className="bg-card rounded-lg border border-border p-4">
              <h2 className="text-white font-medium mb-4">
                Unassigned Tracks ({tracksData?.unassigned_count || 0})
              </h2>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {tracksData?.tracks
                  ?.filter((t) => !t.is_assigned)
                  .map((track) => (
                    <TrackCard
                      key={track.track_id}
                      track={track}
                      selectedTrackId={selectedTrackId}
                      onSelect={setSelectedTrackId}
                    />
                  ))}
              </div>
            </div>

            {/* Other tracks */}
            {otherTracks.length > 0 && (
              <div className="bg-card rounded-lg border border-border p-4 mt-4">
                <h2 className="text-gray-400 font-medium mb-4">
                  Other Tracks ({otherTracks.length})
                </h2>
                <div className="space-y-2">
                  {otherTracks.map((track) => (
                    <TrackCard
                      key={track.track_id}
                      track={track}
                      selectedTrackId={selectedTrackId}
                      onSelect={setSelectedTrackId}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Away Team Column */}
          <div>
            <div className="bg-card rounded-lg border border-border p-4 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: TEAM_COLORS.away }} />
                <h2 className="text-white font-medium">
                  {match?.away_team?.name || 'Away Team'}
                </h2>
              </div>

              {/* Away Players */}
              <h3 className="text-gray-400 text-xs uppercase tracking-wider mb-2">Players</h3>
              <div className="space-y-2 mb-4">
                {playersData?.away_players?.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No players</p>
                ) : (
                  playersData?.away_players?.map((player) => (
                    <PlayerCard
                      key={player.player_id}
                      player={player}
                      onAssign={handleAssign}
                      isAvailable={selectedTrackId && selectedTeam === 'away'}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Away Tracks */}
            <div className="bg-card rounded-lg border border-border p-4">
              <h3 className="text-gray-400 text-xs uppercase tracking-wider mb-2">
                Tracks ({awayTracks.length})
              </h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {awayTracks.map((track) => (
                  <TrackCard
                    key={track.track_id}
                    track={track}
                    selectedTrackId={selectedTrackId}
                    onSelect={setSelectedTrackId}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Help text */}
        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>1. Click on a track to select it</p>
          <p>2. Then click on a player to assign them to that track</p>
          <p>Assigned players will show their names in Event Review</p>
        </div>
      </main>
    </div>
  );
}
