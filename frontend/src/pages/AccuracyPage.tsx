import { useQuery } from '@tanstack/react-query';
import { accuracyApi, matchesApi } from '../services/api';
import { Link } from 'react-router-dom';
import {
  Target,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ArrowRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { format } from 'date-fns';

export function AccuracyPage() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['accuracy-dashboard'],
    queryFn: accuracyApi.getDashboard,
  });

  const { data: matches } = useQuery({
    queryKey: ['matches-processed'],
    queryFn: () => matchesApi.list({ is_processed: true }),
  });

  // Prepare trend data
  const trendData = dashboard?.trends.map((t) => ({
    date: format(new Date(t.period_start), 'MMM d'),
    accuracy: t.accuracy,
    matches: t.matches_count,
    corrections: t.total_corrections,
  })) || [];

  // Prepare event type data for bar chart
  const eventTypeData = dashboard?.event_type_accuracy
    ? Object.entries(dashboard.event_type_accuracy)
        .map(([type, accuracy]) => ({
          name: type.replace(/_/g, ' '),
          accuracy,
        }))
        .sort((a, b) => b.accuracy - a.accuracy)
        .slice(0, 15)
    : [];

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return '#22c55e';
    if (accuracy >= 60) return '#eab308';
    return '#ef4444';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Accuracy Dashboard</h1>
        <p className="text-surface-400 mt-1">
          Track AI performance and identify areas for improvement
        </p>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Overall accuracy */}
        <div className="stat-card col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="stat-label">Overall AI Accuracy</div>
              <div className="text-4xl font-bold mt-2" style={{ color: getAccuracyColor(dashboard?.overall_accuracy || 0) }}>
                {dashboard?.overall_accuracy?.toFixed(1) || '—'}%
              </div>
            </div>
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${getAccuracyColor(dashboard?.overall_accuracy || 0)}20` }}
            >
              <Target className="w-8 h-8" style={{ color: getAccuracyColor(dashboard?.overall_accuracy || 0) }} />
            </div>
          </div>
        </div>

        {/* Event detection */}
        <div className="stat-card">
          <div className="stat-label">Event Detection</div>
          <div className="stat-value" style={{ color: getAccuracyColor(dashboard?.event_detection_accuracy || 0) }}>
            {dashboard?.event_detection_accuracy?.toFixed(1) || '—'}%
          </div>
        </div>

        {/* Team assignment */}
        <div className="stat-card">
          <div className="stat-label">Team Assignment</div>
          <div className="stat-value" style={{ color: getAccuracyColor(dashboard?.team_assignment_accuracy || 0) }}>
            {dashboard?.team_assignment_accuracy?.toFixed(1) || '—'}%
          </div>
        </div>

        {/* Tracking */}
        <div className="stat-card">
          <div className="stat-label">Tracking</div>
          <div className="stat-value" style={{ color: getAccuracyColor(dashboard?.tracking_accuracy || 0) }}>
            {dashboard?.tracking_accuracy?.toFixed(1) || '—'}%
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Accuracy trend */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Accuracy Over Time</h3>
            <div className="flex items-center gap-2 text-sm">
              {trendData.length > 1 && (
                <>
                  {trendData[trendData.length - 1]?.accuracy > trendData[0]?.accuracy ? (
                    <TrendingUp className="w-4 h-4 text-success-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-error-400" />
                  )}
                  <span className={
                    trendData[trendData.length - 1]?.accuracy > trendData[0]?.accuracy
                      ? 'text-success-400'
                      : 'text-error-400'
                  }>
                    {Math.abs(trendData[trendData.length - 1]?.accuracy - trendData[0]?.accuracy).toFixed(1)}%
                  </span>
                </>
              )}
            </div>
          </div>
          {trendData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="accuracyGradient2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1a85f5" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#1a85f5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#f1f5f9' }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Accuracy']}
                  />
                  <Area type="monotone" dataKey="accuracy" stroke="#1a85f5" strokeWidth={2} fill="url(#accuracyGradient2)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-surface-500">
              No trend data yet
            </div>
          )}
        </div>

        {/* Event type breakdown */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Accuracy by Event Type</h3>
            <BarChart3 className="w-5 h-5 text-surface-500" />
          </div>
          {eventTypeData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventTypeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" stroke="#64748b" fontSize={12} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={80} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Accuracy']}
                  />
                  <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
                    {eventTypeData.map((entry, index) => (
                      <Cell key={index} fill={getAccuracyColor(entry.accuracy)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-surface-500">
              No event data yet
            </div>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="stat-label">Matches Processed</div>
          <div className="stat-value">{dashboard?.total_matches_processed || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Corrections</div>
          <div className="stat-value">{dashboard?.total_corrections_made?.toLocaleString() || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Events Reviewed</div>
          <div className="stat-value">{dashboard?.total_events_reviewed?.toLocaleString() || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tracks Reviewed</div>
          <div className="stat-value">{dashboard?.total_tracks_reviewed?.toLocaleString() || 0}</div>
        </div>
      </div>

      {/* Recent matches accuracy */}
      <div className="card">
        <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Match Accuracy</h3>
          <Link to="/matches" className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1">
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Match</th>
              <th>Date</th>
              <th>Overall</th>
              <th>Events</th>
              <th>Tracking</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {matches?.slice(0, 10).map((match) => (
              <tr key={match.id}>
                <td>
                  <div className="flex items-center gap-2">
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
                <td className="text-surface-400">
                  {format(new Date(match.match_date), 'MMM d, yyyy')}
                </td>
                <td>
                  {match.ai_accuracy_overall !== null ? (
                    <span className="font-medium" style={{ color: getAccuracyColor(match.ai_accuracy_overall) }}>
                      {match.ai_accuracy_overall.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-surface-500">—</span>
                  )}
                </td>
                <td>
                  {match.ai_accuracy_events !== null ? (
                    <span style={{ color: getAccuracyColor(match.ai_accuracy_events) }}>
                      {match.ai_accuracy_events.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-surface-500">—</span>
                  )}
                </td>
                <td>
                  {match.ai_accuracy_tracking !== null ? (
                    <span style={{ color: getAccuracyColor(match.ai_accuracy_tracking) }}>
                      {match.ai_accuracy_tracking.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-surface-500">—</span>
                  )}
                </td>
                <td>
                  <Link to={`/matches/${match.id}`} className="btn-ghost btn-sm">
                    Review
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
