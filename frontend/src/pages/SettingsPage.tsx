import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import {
  User,
  Shield,
  Bell,
  Palette,
  Key,
  Save,
  Check,
  AlertTriangle,
  Info,
} from 'lucide-react';
import clsx from 'clsx';

export function SettingsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [saved, setSaved] = useState(false);

  // Profile settings
  const [displayName, setDisplayName] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');

  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [correctionAlerts, setCorrectionAlerts] = useState(true);
  const [exportComplete, setExportComplete] = useState(true);

  // Display settings
  const [playbackSpeed, setPlaybackSpeed] = useState('1');
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [showConfidence, setShowConfidence] = useState(true);
  const [highlightCorrections, setHighlightCorrections] = useState(true);

  const handleSave = () => {
    // In a real app, this would call an API
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'display', label: 'Display', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'api', label: 'API Keys', icon: Key },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-surface-400 mt-1">
          Manage your account and preferences
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-56 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-brand-500/20 text-brand-400'
                    : 'text-surface-400 hover:bg-surface-800 hover:text-white'
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 card p-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-4">Profile Settings</h2>
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-2">
                      Role
                    </label>
                    <div className="flex items-center gap-2 px-3 py-2 bg-surface-800 rounded-lg">
                      <Shield className="w-4 h-4 text-brand-400" />
                      <span className="text-white capitalize">{user?.role || 'Viewer'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-surface-800 pt-6">
                <h3 className="text-md font-semibold text-white mb-4">Change Password</h3>
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-2">
                      Current Password
                    </label>
                    <input
                      type="password"
                      className="input"
                      placeholder="Enter current password"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      className="input"
                      placeholder="Enter new password"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-2">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      className="input"
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Display Tab */}
          {activeTab === 'display' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-white mb-4">Display Settings</h2>

              <div className="space-y-6 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-2">
                    Default Playback Speed
                  </label>
                  <select
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(e.target.value)}
                    className="input"
                  >
                    <option value="0.25">0.25x</option>
                    <option value="0.5">0.5x</option>
                    <option value="0.75">0.75x</option>
                    <option value="1">1x (Normal)</option>
                    <option value="1.5">1.5x</option>
                    <option value="2">2x</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">Auto-advance to next event</div>
                      <div className="text-xs text-surface-500 mt-0.5">
                        Automatically move to next event after saving
                      </div>
                    </div>
                    <button
                      onClick={() => setAutoAdvance(!autoAdvance)}
                      className={clsx(
                        'w-11 h-6 rounded-full transition-colors relative',
                        autoAdvance ? 'bg-brand-500' : 'bg-surface-700'
                      )}
                    >
                      <div
                        className={clsx(
                          'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                          autoAdvance ? 'translate-x-6' : 'translate-x-1'
                        )}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">Show AI confidence scores</div>
                      <div className="text-xs text-surface-500 mt-0.5">
                        Display confidence percentage for AI predictions
                      </div>
                    </div>
                    <button
                      onClick={() => setShowConfidence(!showConfidence)}
                      className={clsx(
                        'w-11 h-6 rounded-full transition-colors relative',
                        showConfidence ? 'bg-brand-500' : 'bg-surface-700'
                      )}
                    >
                      <div
                        className={clsx(
                          'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                          showConfidence ? 'translate-x-6' : 'translate-x-1'
                        )}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">Highlight corrections</div>
                      <div className="text-xs text-surface-500 mt-0.5">
                        Visually distinguish corrected items
                      </div>
                    </div>
                    <button
                      onClick={() => setHighlightCorrections(!highlightCorrections)}
                      className={clsx(
                        'w-11 h-6 rounded-full transition-colors relative',
                        highlightCorrections ? 'bg-brand-500' : 'bg-surface-700'
                      )}
                    >
                      <div
                        className={clsx(
                          'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                          highlightCorrections ? 'translate-x-6' : 'translate-x-1'
                        )}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-white mb-4">Notification Settings</h2>

              <div className="space-y-4 max-w-md">
                <div className="flex items-center justify-between p-4 bg-surface-800 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-white">Email notifications</div>
                    <div className="text-xs text-surface-500 mt-0.5">
                      Receive email updates about your account
                    </div>
                  </div>
                  <button
                    onClick={() => setEmailNotifications(!emailNotifications)}
                    className={clsx(
                      'w-11 h-6 rounded-full transition-colors relative',
                      emailNotifications ? 'bg-brand-500' : 'bg-surface-700'
                    )}
                  >
                    <div
                      className={clsx(
                        'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                        emailNotifications ? 'translate-x-6' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-surface-800 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-white">Correction alerts</div>
                    <div className="text-xs text-surface-500 mt-0.5">
                      Get notified when corrections need review
                    </div>
                  </div>
                  <button
                    onClick={() => setCorrectionAlerts(!correctionAlerts)}
                    className={clsx(
                      'w-11 h-6 rounded-full transition-colors relative',
                      correctionAlerts ? 'bg-brand-500' : 'bg-surface-700'
                    )}
                  >
                    <div
                      className={clsx(
                        'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                        correctionAlerts ? 'translate-x-6' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-surface-800 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-white">Export complete</div>
                    <div className="text-xs text-surface-500 mt-0.5">
                      Notify when training data export is ready
                    </div>
                  </div>
                  <button
                    onClick={() => setExportComplete(!exportComplete)}
                    className={clsx(
                      'w-11 h-6 rounded-full transition-colors relative',
                      exportComplete ? 'bg-brand-500' : 'bg-surface-700'
                    )}
                  >
                    <div
                      className={clsx(
                        'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                        exportComplete ? 'translate-x-6' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* API Keys Tab */}
          {activeTab === 'api' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-white mb-4">API Configuration</h2>

              <div className="space-y-4 max-w-lg">
                <div className="p-4 bg-surface-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-surface-300">
                        API keys are used to integrate with external services like Roboflow for model training.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-2">
                    Roboflow API Key
                  </label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Enter your Roboflow API key"
                  />
                  <p className="text-xs text-surface-500 mt-1">
                    Used for uploading training data to Roboflow
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-2">
                    Roboflow Workspace
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="your-workspace"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-2">
                    Roboflow Project
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="veo-football-detection"
                  />
                </div>

                <div className="flex items-start gap-3 p-4 bg-warning-500/10 border border-warning-500/20 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-warning-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-warning-300 font-medium">Keep your API keys secure</p>
                    <p className="text-xs text-warning-400/80 mt-0.5">
                      Never share your API keys publicly. They provide full access to your external accounts.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end mt-8 pt-6 border-t border-surface-800">
            <button
              onClick={handleSave}
              className={clsx(
                'btn-primary min-w-[120px]',
                saved && 'bg-success-600 hover:bg-success-600'
              )}
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
