import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsApi } from '../services/api';
import { Plus, Search, Edit2, Trash2, Users } from 'lucide-react';

export function TeamsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    short_name: '',
    primary_color: '#3B82F6',
    secondary_color: '#FFFFFF',
  });

  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams', search],
    queryFn: () => teamsApi.list({ search: search || undefined }),
  });

  const createTeam = useMutation({
    mutationFn: teamsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setIsCreating(false);
      resetForm();
    },
  });

  const updateTeam = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof formData }) => teamsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setEditingId(null);
      resetForm();
    },
  });

  const deleteTeam = useMutation({
    mutationFn: teamsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      short_name: '',
      primary_color: '#3B82F6',
      secondary_color: '#FFFFFF',
    });
  };

  const startEdit = (team: NonNullable<typeof teams>[0]) => {
    setEditingId(team.id);
    setFormData({
      name: team.name,
      short_name: team.short_name || '',
      primary_color: team.primary_color || '#3B82F6',
      secondary_color: team.secondary_color || '#FFFFFF',
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Teams</h1>
          <p className="text-surface-400 mt-1">Manage teams and their colors for detection</p>
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
          Add Team
        </button>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teams..."
            className="input pl-10"
          />
        </div>
      </div>

      {/* Create/Edit form */}
      {(isCreating || editingId) && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            {isCreating ? 'Add New Team' : 'Edit Team'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Team Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Manchester United"
                className="input"
              />
            </div>
            <div>
              <label className="label">Short Name</label>
              <input
                type="text"
                value={formData.short_name}
                onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
                placeholder="e.g., MUN"
                maxLength={5}
                className="input"
              />
            </div>
            <div>
              <label className="label">Primary Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={formData.primary_color}
                  onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                  className="w-12 h-10 rounded border border-surface-700 cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.primary_color}
                  onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                  className="input flex-1"
                />
              </div>
            </div>
            <div>
              <label className="label">Secondary Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={formData.secondary_color}
                  onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                  className="w-12 h-10 rounded border border-surface-700 cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.secondary_color}
                  onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                  className="input flex-1"
                />
              </div>
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
                if (isCreating) {
                  createTeam.mutate(formData);
                } else if (editingId) {
                  updateTeam.mutate({ id: editingId, data: formData });
                }
              }}
              disabled={!formData.name || createTeam.isPending || updateTeam.isPending}
              className="btn-primary"
            >
              {isCreating ? 'Create Team' : 'Update Team'}
            </button>
          </div>
        </div>
      )}

      {/* Teams grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-6">
              <div className="skeleton h-6 w-32 mb-2" />
              <div className="skeleton h-4 w-20" />
            </div>
          ))}
        </div>
      ) : teams?.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-12 h-12 mx-auto text-surface-600 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No teams yet</h3>
          <p className="text-surface-400 mb-4">Add your first team to get started</p>
          <button onClick={() => setIsCreating(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Team
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams?.map((team) => (
            <div key={team.id} className="card-hover p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: team.primary_color || '#3B82F6' }}
                  >
                    {team.short_name || team.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{team.name}</h3>
                    {team.short_name && (
                      <p className="text-sm text-surface-400">{team.short_name}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(team)}
                    className="btn-ghost btn-icon btn-sm"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${team.name}?`)) {
                        deleteTeam.mutate(team.id);
                      }
                    }}
                    className="btn-ghost btn-icon btn-sm text-error-400 hover:text-error-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <div
                  className="w-6 h-6 rounded border border-surface-700"
                  style={{ backgroundColor: team.primary_color || '#3B82F6' }}
                  title="Primary color"
                />
                <div
                  className="w-6 h-6 rounded border border-surface-700"
                  style={{ backgroundColor: team.secondary_color || '#FFFFFF' }}
                  title="Secondary color"
                />
                <span className="text-xs text-surface-500 ml-2">Team colors</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
