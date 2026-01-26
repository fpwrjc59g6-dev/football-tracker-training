import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { playersApi, teamsApi } from '../services/api';
import type { PlayerPosition } from '../types';
import { Plus, Search, Edit2, Trash2, User, Filter } from 'lucide-react';

const POSITIONS: { value: PlayerPosition; label: string }[] = [
  { value: 'goalkeeper', label: 'Goalkeeper' },
  { value: 'defender', label: 'Defender' },
  { value: 'midfielder', label: 'Midfielder' },
  { value: 'forward', label: 'Forward' },
  { value: 'unknown', label: 'Unknown' },
];

export function PlayersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    team_id: 0,
    name: '',
    jersey_number: '',
    position: 'unknown' as PlayerPosition,
  });

  const { data: players, isLoading } = useQuery({
    queryKey: ['players', search, teamFilter],
    queryFn: () => playersApi.list({
      search: search || undefined,
      team_id: teamFilter || undefined,
    }),
  });

  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.list(),
  });

  const createPlayer = useMutation({
    mutationFn: playersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      setIsCreating(false);
      resetForm();
    },
  });

  const updatePlayer = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => playersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      setEditingId(null);
      resetForm();
    },
  });

  const deletePlayer = useMutation({
    mutationFn: playersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
    },
  });

  const resetForm = () => {
    setFormData({
      team_id: teams?.[0]?.id || 0,
      name: '',
      jersey_number: '',
      position: 'unknown',
    });
  };

  const startEdit = (player: NonNullable<typeof players>[0]) => {
    setEditingId(player.id);
    setFormData({
      team_id: player.team_id,
      name: player.name,
      jersey_number: player.jersey_number?.toString() || '',
      position: player.position,
    });
  };

  // Group players by team
  const playersByTeam = players?.reduce((acc, player) => {
    const team = teams?.find((t) => t.id === player.team_id);
    const teamName = team?.name || 'Unknown Team';
    if (!acc[teamName]) acc[teamName] = [];
    acc[teamName].push(player);
    return acc;
  }, {} as Record<string, typeof players>);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Players</h1>
          <p className="text-surface-400 mt-1">Manage player roster for each team</p>
        </div>
        <button
          onClick={() => {
            setIsCreating(true);
            setEditingId(null);
            resetForm();
          }}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          Add Player
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players..."
              className="input pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-surface-500" />
            <select
              value={teamFilter || ''}
              onChange={(e) => setTeamFilter(e.target.value ? Number(e.target.value) : null)}
              className="select w-48"
            >
              <option value="">All Teams</option>
              {teams?.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Create/Edit form */}
      {(isCreating || editingId) && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            {isCreating ? 'Add New Player' : 'Edit Player'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label">Team</label>
              <select
                value={formData.team_id}
                onChange={(e) => setFormData({ ...formData, team_id: Number(e.target.value) })}
                className="select"
              >
                <option value={0}>Select team...</option>
                {teams?.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Player Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., John Smith"
                className="input"
              />
            </div>
            <div>
              <label className="label">Jersey Number</label>
              <input
                type="number"
                min={1}
                max={99}
                value={formData.jersey_number}
                onChange={(e) => setFormData({ ...formData, jersey_number: e.target.value })}
                placeholder="e.g., 10"
                className="input"
              />
            </div>
            <div>
              <label className="label">Position</label>
              <select
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value as PlayerPosition })}
                className="select"
              >
                {POSITIONS.map((pos) => (
                  <option key={pos.value} value={pos.value}>{pos.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => {
                setIsCreating(false);
                setEditingId(null);
                resetForm();
              }}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const data = {
                  ...formData,
                  jersey_number: formData.jersey_number ? Number(formData.jersey_number) : null,
                };
                if (isCreating) {
                  createPlayer.mutate(data);
                } else if (editingId) {
                  updatePlayer.mutate({ id: editingId, data });
                }
              }}
              disabled={!formData.name || !formData.team_id || createPlayer.isPending || updatePlayer.isPending}
              className="btn-primary"
            >
              {isCreating ? 'Create Player' : 'Update Player'}
            </button>
          </div>
        </div>
      )}

      {/* Players list */}
      {isLoading ? (
        <div className="card p-8">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="skeleton w-10 h-10 rounded-full" />
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      ) : players?.length === 0 ? (
        <div className="card p-12 text-center">
          <User className="w-12 h-12 mx-auto text-surface-600 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No players yet</h3>
          <p className="text-surface-400 mb-4">Add players to your teams</p>
          <button onClick={() => setIsCreating(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Player
          </button>
        </div>
      ) : teamFilter ? (
        // Single team view
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Jersey #</th>
                <th>Position</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {players?.map((player) => (
                <tr key={player.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface-700 flex items-center justify-center text-sm font-medium text-white">
                        {player.jersey_number || player.name.charAt(0)}
                      </div>
                      <span className="font-medium text-white">{player.name}</span>
                    </div>
                  </td>
                  <td>
                    {player.jersey_number ? (
                      <span className="font-mono text-white">#{player.jersey_number}</span>
                    ) : (
                      <span className="text-surface-500">—</span>
                    )}
                  </td>
                  <td className="capitalize text-surface-400">{player.position}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(player)} className="btn-ghost btn-icon btn-sm">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${player.name}?`)) {
                            deletePlayer.mutate(player.id);
                          }
                        }}
                        className="btn-ghost btn-icon btn-sm text-error-400 hover:text-error-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // Grouped by team view
        <div className="space-y-6">
          {Object.entries(playersByTeam || {}).map(([teamName, teamPlayers]) => {
            const team = teams?.find((t) => t.name === teamName);
            return (
              <div key={teamName} className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-800 flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: team?.primary_color || '#6B7280' }}
                  />
                  <h3 className="font-semibold text-white">{teamName}</h3>
                  <span className="text-sm text-surface-400">({teamPlayers.length} players)</span>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Jersey #</th>
                      <th>Position</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamPlayers.sort((a, b) => (a.jersey_number || 99) - (b.jersey_number || 99)).map((player) => (
                      <tr key={player.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white"
                              style={{ backgroundColor: team?.primary_color || '#6B7280' }}
                            >
                              {player.jersey_number || player.name.charAt(0)}
                            </div>
                            <span className="font-medium text-white">{player.name}</span>
                          </div>
                        </td>
                        <td>
                          {player.jersey_number ? (
                            <span className="font-mono text-white">#{player.jersey_number}</span>
                          ) : (
                            <span className="text-surface-500">—</span>
                          )}
                        </td>
                        <td className="capitalize text-surface-400">{player.position}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button onClick={() => startEdit(player)} className="btn-ghost btn-icon btn-sm">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete ${player.name}?`)) {
                                  deletePlayer.mutate(player.id);
                                }
                              }}
                              className="btn-ghost btn-icon btn-sm text-error-400 hover:text-error-300"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
