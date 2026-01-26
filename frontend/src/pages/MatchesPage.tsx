import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { matchesApi, teamsApi } from '../services/api';
import { format } from 'date-fns';
import {
  Plus,
  Search,
  Filter,
  Calendar,
  Video,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowUpDown,
} from 'lucide-react';
import clsx from 'clsx';

export function MatchesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<number | null>(null);

  const { data: matches, isLoading } = useQuery({
    queryKey: ['matches', statusFilter, teamFilter],
    queryFn: () => matchesApi.list({
      is_processed: statusFilter === 'processed' ? true : statusFilter === 'pending' ? false : undefined,
      team_id: teamFilter || undefined,
    }),
  });

  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.list(),
  });

  // Filter by search
  const filteredMatches = matches?.filter((match) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      match.home_team.name.toLowerCase().includes(searchLower) ||
      match.away_team.name.toLowerCase().includes(searchLower) ||
      match.competition?.toLowerCase().includes(searchLower) ||
      match.venue?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = (match: NonNullable<typeof matches>[0]) => {
    if (match.processing_status === 'processing') {
      return <span className="badge-warning"><Clock className="w-3 h-3 mr-1" />Processing</span>;
    }
    if (match.processing_status === 'failed') {
      return <span className="badge-error"><AlertCircle className="w-3 h-3 mr-1" />Failed</span>;
    }
    if (match.is_processed) {
      return <span className="badge-success"><CheckCircle className="w-3 h-3 mr-1" />Processed</span>;
    }
    return <span className="badge-neutral"><Clock className="w-3 h-3 mr-1" />Pending</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Matches</h1>
          <p className="text-surface-400 mt-1">
            Review and correct AI predictions for each match
          </p>
        </div>
        <Link to="/matches/new" className="btn-primary">
          <Plus className="w-4 h-4" />
          Import Match
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search matches..."
              className="input pl-10"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-surface-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select w-40"
            >
              <option value="all">All Status</option>
              <option value="processed">Processed</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          {/* Team filter */}
          <select
            value={teamFilter || ''}
            onChange={(e) => setTeamFilter(e.target.value ? Number(e.target.value) : null)}
            className="select w-48"
          >
            <option value="">All Teams</option>
            {teams?.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Matches list */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500 mx-auto"></div>
            <p className="mt-4 text-surface-400">Loading matches...</p>
          </div>
        ) : filteredMatches?.length === 0 ? (
          <div className="p-12 text-center">
            <Video className="w-12 h-12 mx-auto text-surface-600 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No matches found</h3>
            <p className="text-surface-400 mb-4">
              {search ? 'Try adjusting your search or filters' : 'Import a match to get started'}
            </p>
            <Link to="/matches/new" className="btn-primary">
              <Plus className="w-4 h-4" />
              Import Match
            </Link>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>
                  <button className="flex items-center gap-1 hover:text-white transition-colors">
                    Match <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th>Date</th>
                <th>Competition</th>
                <th>Score</th>
                <th>Status</th>
                <th>AI Accuracy</th>
                <th>Calibrated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredMatches?.map((match) => (
                <tr key={match.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: match.home_team.primary_color || '#3B82F6' }}
                      />
                      <span className="font-medium text-white">
                        {match.home_team.short_name || match.home_team.name}
                      </span>
                      <span className="text-surface-500">vs</span>
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: match.away_team.primary_color || '#EF4444' }}
                      />
                      <span className="font-medium text-white">
                        {match.away_team.short_name || match.away_team.name}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2 text-surface-400">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(match.match_date), 'MMM d, yyyy')}
                    </div>
                  </td>
                  <td className="text-surface-400">
                    {match.competition || '—'}
                  </td>
                  <td>
                    {match.home_score !== null ? (
                      <span className="font-mono font-medium text-white">
                        {match.home_score} - {match.away_score}
                      </span>
                    ) : (
                      <span className="text-surface-500">—</span>
                    )}
                  </td>
                  <td>{getStatusBadge(match)}</td>
                  <td>
                    {match.ai_accuracy_overall !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-16 progress">
                          <div
                            className={clsx(
                              'progress-bar',
                              match.ai_accuracy_overall >= 80 ? 'bg-success-500' :
                              match.ai_accuracy_overall >= 60 ? 'bg-warning-500' : 'bg-error-500'
                            )}
                            style={{ width: `${match.ai_accuracy_overall}%` }}
                          />
                        </div>
                        <span className={clsx(
                          'text-sm font-medium',
                          match.ai_accuracy_overall >= 80 ? 'text-success-400' :
                          match.ai_accuracy_overall >= 60 ? 'text-warning-400' : 'text-error-400'
                        )}>
                          {match.ai_accuracy_overall.toFixed(0)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-surface-500">—</span>
                    )}
                  </td>
                  <td>
                    {match.is_calibrated ? (
                      <CheckCircle className="w-5 h-5 text-success-400" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-warning-400" />
                    )}
                  </td>
                  <td>
                    <Link
                      to={`/matches/${match.id}`}
                      className="btn-secondary btn-sm"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
