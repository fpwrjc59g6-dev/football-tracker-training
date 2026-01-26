import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trainingApi, correctionsApi } from '../services/api';
import { TrainingExport, ExportType, ExportFormat } from '../types';
import {
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  Package,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Filter,
} from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';

export function TrainingPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [exportType, setExportType] = useState<ExportType>('all');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [notes, setNotes] = useState('');

  const { data: exports, isLoading: exportsLoading } = useQuery({
    queryKey: ['training-exports'],
    queryFn: () => trainingApi.listExports(),
  });

  const { data: correctionSummary } = useQuery({
    queryKey: ['correction-summary'],
    queryFn: () => correctionsApi.getSummary(),
  });

  const createExportMutation = useMutation({
    mutationFn: trainingApi.createExport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-exports'] });
      queryClient.invalidateQueries({ queryKey: ['correction-summary'] });
      setShowCreateModal(false);
      setNotes('');
    },
  });

  const handleCreateExport = () => {
    createExportMutation.mutate({
      export_type: exportType,
      export_format: exportFormat,
      notes: notes || undefined,
    });
  };

  const handleDownload = async (exportId: number) => {
    const blob = await trainingApi.downloadExport(exportId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `training_export_${exportId}.${exportFormat === 'csv' ? 'csv' : 'json'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getExportTypeLabel = (type: ExportType) => {
    const labels: Partial<Record<ExportType, string>> = {
      all: 'All Data',
      event_detection: 'Event Detection',
      tracking: 'Tracking',
      team_classification: 'Team Classification',
      jersey_recognition: 'Jersey Recognition',
      detection: 'Detection',
    };
    return labels[type] || type;
  };

  const getExportTypeIcon = (type: ExportType) => {
    switch (type) {
      case 'event_detection':
        return <Database className="w-4 h-4" />;
      case 'tracking':
        return <Filter className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Training Data</h1>
          <p className="text-surface-400 mt-1">
            Export corrected data to train AI models
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Export
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center">
              <Database className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <div className="stat-label">Total Corrections</div>
              <div className="stat-value">{correctionSummary?.total_corrections || 0}</div>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-success-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-success-400" />
            </div>
            <div>
              <div className="stat-label">Used in Training</div>
              <div className="stat-value">{correctionSummary?.used_in_training || 0}</div>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warning-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-warning-400" />
            </div>
            <div>
              <div className="stat-label">Pending Training</div>
              <div className="stat-value">{correctionSummary?.pending_training || 0}</div>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Package className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="stat-label">Total Exports</div>
              <div className="stat-value">{exports?.length || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Correction Types Breakdown */}
      {correctionSummary?.by_type && Object.keys(correctionSummary.by_type).length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Corrections by Type</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Object.entries(correctionSummary.by_type).map(([type, count]) => (
              <div key={type} className="bg-surface-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-white">{count}</div>
                <div className="text-xs text-surface-400 mt-1 capitalize">
                  {type.replace(/_/g, ' ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exports List */}
      <div className="card">
        <div className="px-6 py-4 border-b border-surface-800">
          <h3 className="text-lg font-semibold text-white">Export History</h3>
        </div>

        {exportsLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500"></div>
          </div>
        ) : exports && exports.length > 0 ? (
          <div className="divide-y divide-surface-800">
            {exports.map((exp: TrainingExport) => (
              <div
                key={exp.id}
                className="px-6 py-4 hover:bg-surface-800/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={clsx(
                      'w-10 h-10 rounded-xl flex items-center justify-center',
                      exp.export_format === 'json' ? 'bg-blue-500/20' : 'bg-green-500/20'
                    )}>
                      {exp.export_format === 'json' ? (
                        <FileJson className={clsx('w-5 h-5', 'text-blue-400')} />
                      ) : (
                        <FileSpreadsheet className="w-5 h-5 text-green-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">
                          Export #{exp.id}
                        </span>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-surface-700 text-surface-300">
                          {getExportTypeLabel(exp.export_type)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-surface-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(new Date(exp.created_at), 'MMM d, yyyy h:mm a')}
                        </span>
                        {exp.correction_count > 0 && (
                          <span>{exp.correction_count} corrections</span>
                        )}
                        {exp.event_count > 0 && (
                          <span>{exp.event_count} events</span>
                        )}
                        {exp.frame_count > 0 && (
                          <span>{exp.frame_count} frames</span>
                        )}
                      </div>
                      {exp.notes && (
                        <p className="text-sm text-surface-500 mt-1">{exp.notes}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload(exp.id)}
                    className="btn-ghost btn-sm"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-surface-500">
            <Package className="w-12 h-12 mb-3 opacity-50" />
            <p>No exports yet</p>
            <p className="text-sm mt-1">Create your first export to start training</p>
          </div>
        )}
      </div>

      {/* Create Export Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-900 rounded-2xl border border-surface-800 w-full max-w-md p-6 animate-fade-in">
            <h2 className="text-xl font-bold text-white mb-4">Create Training Export</h2>

            <div className="space-y-4">
              {/* Export Type */}
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-2">
                  Export Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['all', 'event_detection', 'tracking', 'team_classification'] as ExportType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setExportType(type)}
                      className={clsx(
                        'px-3 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2',
                        exportType === type
                          ? 'border-brand-500 bg-brand-500/20 text-brand-400'
                          : 'border-surface-700 text-surface-400 hover:border-surface-600'
                      )}
                    >
                      {getExportTypeIcon(type)}
                      {getExportTypeLabel(type)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Export Format */}
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-2">
                  Format
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setExportFormat('json')}
                    className={clsx(
                      'flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2',
                      exportFormat === 'json'
                        ? 'border-brand-500 bg-brand-500/20 text-brand-400'
                        : 'border-surface-700 text-surface-400 hover:border-surface-600'
                    )}
                  >
                    <FileJson className="w-4 h-4" />
                    JSON
                  </button>
                  <button
                    onClick={() => setExportFormat('csv')}
                    className={clsx(
                      'flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2',
                      exportFormat === 'csv'
                        ? 'border-brand-500 bg-brand-500/20 text-brand-400'
                        : 'border-surface-700 text-surface-400 hover:border-surface-600'
                    )}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    CSV
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input h-20 resize-none"
                  placeholder="e.g., Training data for v2.0 model"
                />
              </div>

              {/* Pending Data Info */}
              {correctionSummary && correctionSummary.pending_training > 0 && (
                <div className="flex items-start gap-2 p-3 bg-brand-500/10 border border-brand-500/20 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-brand-300 font-medium">
                      {correctionSummary.pending_training} corrections ready
                    </p>
                    <p className="text-brand-400/80 mt-0.5">
                      These corrections will be marked as used after export
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateExport}
                disabled={createExportMutation.isPending}
                className="btn-primary"
              >
                {createExportMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4 mr-2" />
                    Create Export
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
