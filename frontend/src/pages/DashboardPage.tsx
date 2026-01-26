import { useQuery } from '@tanstack/react-query';
import { accuracyApi, matchesApi, correctionsApi } from '../services/api';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Video,
  CheckCircle,
  ArrowRight,
  Activity,
  Target,
  Brain,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { format } from 'date-fns';
import clsx from 'clsx';

export function DashboardPage() {
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['accuracy-dashboard'],
    queryFn: accuracyApi.getDashboard,
  });

  const { data: matches } = useQuery({
    queryKey: ['recent-matches'],
    queryFn: () => matchesApi.list({ is_processed: true }),
  });

  const { data: corrections } = useQuery({
    queryKey: ['corrections-summary'],
    queryFn: () => correctionsApi.getSummary(),
  });

  // Prepare trend data for chart
  const trendData = dashboard?.trends.map((t) => ({
    date: format(new Date(t.period_start), 'MMM d'),
    accuracy: t.accuracy,
    corrections: t.total_corrections,
  })) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-surface-400 mt-1">
            Here's what's happening with your AI training
          </p>
        </div>
        <Link to="/matches" className="btn-primary">
          <Video className="w-4 h-4" />
          Review Matches
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Accuracy */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center">
              <Target className="w-5 h-5 text-brand-400" />
            </div>
            {dashboard?.overall_accuracy !== undefined && (
              <div className={clsx(
                'flex items-center gap-1 text-sm font-medium',
                dashboard.overall_accuracy >= 80 ? 'text-success-400' : 'text-warning-400'
              )}>
                {dashboard.overall_accuracy >= 80 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span>{dashboard.overall_accuracy >= 80 ? 'Good' : 'Needs work'}</span>
              </div>
            )}
          </div>
          <div className="mt-4">
            <div className="stat-value">
              {dashboardLoading ? (
                <div className="skeleton h-8 w-20" />
              ) : (
                <>{dashboard?.overall_accuracy?.toFixed(1) || '—'}%</>
              )}
            </div>
            <div className="stat-label">Overall AI Accuracy</div>
          </div>
        </div>

        {/* Matches Processed */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-lg bg-success-500/20 flex items-center justify-center">
              <Video className="w-5 h-5 text-success-400" />
            </div>
          </div>
          <div className="mt-4">
            <div className="stat-value">
              {dashboardLoading ? (
                <div className="skeleton h-8 w-16" />
              ) : (
                dashboard?.total_matches_processed || 0
              )}
            </div>
            <div className="stat-label">Matches Processed</div>
          </div>
        </div>

        {/* Corrections Made */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-lg bg-warning-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-warning-400" />
            </div>
          </div>
          <div className="mt-4">
            <div className="stat-value">
              {dashboardLoading ? (
                <div className="skeleton h-8 w-20" />
              ) : (
                dashboard?.total_corrections_made?.toLocaleString() || 0
              )}
            </div>
            <div className="stat-label">Total Corrections</div>
          </div>
        </div>

        {/* Pending Training */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-lg bg-error-500/20 flex items-center justify-center">
              <Brain className="w-5 h-5 text-error-400" />
            </div>
          </div>
          <div className="mt-4">
            <div className="stat-value">
              {corrections?.pending_training?.toLocaleString() || 0}
            </div>
            <div className="stat-label">Pending for Training</div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Accuracy trend chart */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Accuracy Trend</h3>
            <span className="badge-primary">Last 10 periods</span>
          </div>
          {trendData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="accuracyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1a85f5" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#1a85f5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#f1f5f9' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="accuracy"
                    stroke="#1a85f5"
                    strokeWidth={2}
                    fill="url(#accuracyGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-surface-500">
              <div className="text-center">
                <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No trend data yet</p>
                <p className="text-sm">Process matches to see accuracy trends</p>
              </div>
            </div>
          )}
        </div>

        {/* Event type accuracy */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Event Type Accuracy</h3>
            <Link to="/accuracy" className="text-sm text-brand-400 hover:text-brand-300">
              View details
            </Link>
          </div>
          <div className="space-y-3">
            {dashboard?.event_type_accuracy && Object.keys(dashboard.event_type_accuracy).length > 0 ? (
              Object.entries(dashboard.event_type_accuracy)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 6)
                .map(([type, accuracy]) => (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-surface-300 capitalize">
                        {type.replace(/_/g, ' ')}
                      </span>
                      <span className={clsx(
                        'text-sm font-medium',
                        accuracy >= 80 ? 'text-success-400' :
                        accuracy >= 60 ? 'text-warning-400' : 'text-error-400'
                      )}>
                        {accuracy.toFixed(1)}%
                      </span>
                    </div>
                    <div className="progress">
                      <div
                        className={clsx(
                          'progress-bar',
                          accuracy >= 80 ? 'bg-success-500' :
                          accuracy >= 60 ? 'bg-warning-500' : 'bg-error-500'
                        )}
                        style={{ width: `${accuracy}%` }}
                      />
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center py-8 text-surface-500">
                <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No accuracy data yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent matches */}
      <div className="card">
        <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Recent Matches</h3>
          <Link to="/matches" className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1">
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Match</th>
                <th>Date</th>
                <th>Status</th>
                <th>Accuracy</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {matches?.slice(0, 5).map((match) => (
                <tr key={match.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="font-medium text-white">
                        {match.home_team.short_name || match.home_team.name}
                      </div>
                      <span className="text-surface-500">vs</span>
                      <div className="font-medium text-white">
                        {match.away_team.short_name || match.away_team.name}
                      </div>
                      {match.home_score !== null && (
                        <span className="text-surface-400 text-sm">
                          ({match.home_score} - {match.away_score})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-surface-400">
                    {format(new Date(match.match_date), 'MMM d, yyyy')}
                  </td>
                  <td>
                    {match.is_processed ? (
                      <span className="badge-success">Processed</span>
                    ) : (
                      <span className="badge-warning">Pending</span>
                    )}
                  </td>
                  <td>
                    {match.ai_accuracy_overall !== null ? (
                      <span className={clsx(
                        'font-medium',
                        match.ai_accuracy_overall >= 80 ? 'text-success-400' :
                        match.ai_accuracy_overall >= 60 ? 'text-warning-400' : 'text-error-400'
                      )}>
                        {match.ai_accuracy_overall.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-surface-500">—</span>
                    )}
                  </td>
                  <td>
                    <Link
                      to={`/matches/${match.id}`}
                      className="btn-ghost btn-sm"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              )) || (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-surface-500">
                    No matches yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
