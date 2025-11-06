import { useState, useEffect } from 'react';
import { Shield, RefreshCw, Save, Check, AlertCircle, AlertTriangle } from 'lucide-react';
import { ssoAPI } from '../api/auth';

export const SSOSettings = () => {
  const [config, setConfig] = useState({
    isEnabled: false,
    tenantId: '',
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    buttonText: 'Mit Microsoft anmelden',
    allowedGroups: [] as string[],
    frontendUrl: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newGroup, setNewGroup] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await ssoAPI.getConfig();
      setConfig(data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden der Konfiguration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await ssoAPI.updateConfig(config);
      setSuccess('SSO Konfiguration erfolgreich gespeichert');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern der Konfiguration');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncConfirm = async () => {
    setShowSyncModal(false);
    setError('');
    setSyncing(true);
    try {
      const result = await ssoAPI.syncUsers();
      setSuccess(`Synchronisierung erfolgreich: ${result.syncedCount} Benutzer synchronisiert (${result.createdCount} neu erstellt)`);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Synchronisieren der Benutzer');
    } finally {
      setSyncing(false);
    }
  };

  const addGroup = () => {
    if (newGroup && !config.allowedGroups.includes(newGroup)) {
      setConfig({
        ...config,
        allowedGroups: [...config.allowedGroups, newGroup]
      });
      setNewGroup('');
    }
  };

  const removeGroup = (group: string) => {
    setConfig({
      ...config,
      allowedGroups: config.allowedGroups.filter(g => g !== group)
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Shield className="text-primary-600 dark:text-primary-400 flex-shrink-0" size={32} />
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">SSO Konfiguration</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">EntraID (Azure AD) Single Sign-On</p>
          </div>
        </div>
        <button
          onClick={() => setShowSyncModal(true)}
          disabled={syncing || !config.isEnabled}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition w-full sm:w-auto"
        >
          <RefreshCw size={20} className={syncing ? 'animate-spin' : ''} />
          <span>{syncing ? 'Synchronisiere...' : 'Benutzer synchronisieren'}</span>
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg flex items-start gap-2">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Fehler</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}
      {success && (
        <div className="bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg flex items-center gap-2">
          <Check size={20} />
          {success}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Setup Anleitung</h3>
        <ol className="text-sm text-blue-800 dark:text-blue-400 space-y-1 list-decimal list-inside">
          <li>Erstelle eine App Registration in Azure Portal</li>
          <li>Notiere Tenant ID, Client ID und erstelle ein Client Secret</li>
          <li>Füge die Redirect URI in Azure hinzu: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{config.frontendUrl}/auth/callback</code></li>
          <li>Füge API Permissions hinzu: openid, profile, email, User.Read, User.Read.All</li>
          <li>Trage die Werte unten ein und speichere</li>
        </ol>
      </div>

      {/* Configuration Form */}
      <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 space-y-6">
        {/* Enable SSO */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">SSO aktivieren</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Aktiviert Single Sign-On mit EntraID</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.isEnabled}
              onChange={(e) => setConfig({ ...config, isEnabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
          </label>
        </div>

        {/* Frontend URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Frontend URL
          </label>
          <input
            type="url"
            value={config.frontendUrl}
            onChange={(e) => setConfig({ ...config, frontendUrl: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500"
            placeholder="http://localhost:8570"
            required
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Die URL wo deine App läuft (für Redirect URI)
          </p>
        </div>

        {/* Tenant ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tenant ID
          </label>
          <input
            type="text"
            value={config.tenantId}
            onChange={(e) => setConfig({ ...config, tenantId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            required
          />
        </div>

        {/* Client ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Client ID (Application ID)
          </label>
          <input
            type="text"
            value={config.clientId}
            onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            required
          />
        </div>

        {/* Client Secret */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Client Secret
          </label>
          <input
            type="password"
            value={config.clientSecret}
            onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500"
            placeholder={config.clientSecret ? '***HIDDEN***' : 'Client Secret Value'}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Leer lassen um bestehenden Wert zu behalten
          </p>
        </div>

        {/* Redirect URI */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Redirect URI
          </label>
          <input
            type="url"
            value={config.redirectUri}
            onChange={(e) => setConfig({ ...config, redirectUri: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500"
            placeholder="http://localhost:8570/auth/callback"
            required
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Muss in Azure App Registration eingetragen sein
          </p>
        </div>

        {/* Button Text */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Login Button Text
          </label>
          <input
            type="text"
            value={config.buttonText}
            onChange={(e) => setConfig({ ...config, buttonText: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500"
            placeholder="Mit Microsoft anmelden"
          />
        </div>

        {/* Allowed Groups */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Erlaubte Gruppen (Optional)
          </label>
          <div className="flex flex-col sm:flex-row gap-2 mb-2">
            <input
              type="text"
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addGroup())}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Gruppen-ID oder Name"
            />
            <button
              type="button"
              onClick={addGroup}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 rounded-lg transition w-full sm:w-auto"
            >
              Hinzufügen
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {config.allowedGroups.map((group, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 rounded-full text-sm"
              >
                {group}
                <button
                  type="button"
                  onClick={() => removeGroup(group)}
                  className="hover:text-primary-600 dark:hover:text-primary-400"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Nur Benutzer in diesen Gruppen können sich anmelden (leer = alle)
          </p>
        </div>

        {/* Save Button */}
        <div className="flex gap-2 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition font-medium w-full sm:w-auto"
          >
            <Save size={20} />
            <span>{saving ? 'Speichere...' : 'Konfiguration speichern'}</span>
          </button>
        </div>
      </form>

      {/* Test Section */}
      {config.isEnabled && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Test & Informationen</h3>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p><strong>Status:</strong> <span className="text-green-600 dark:text-green-400">SSO aktiviert</span></p>
            <p><strong>Redirect URI:</strong> <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{config.redirectUri}</code></p>
            <p><strong>Login Button:</strong> "{config.buttonText}"</p>
            {config.allowedGroups.length > 0 && (
              <p><strong>Eingeschränkt auf:</strong> {config.allowedGroups.length} Gruppe(n)</p>
            )}
          </div>
        </div>
      )}

      {/* Sync Confirmation Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <AlertTriangle className="text-blue-600 dark:text-blue-400" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                  Benutzer synchronisieren?
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Möchten Sie alle Benutzer aus EntraID synchronisieren? Dies wird alle EntraID-Benutzer 
                  in die Datenbank importieren bzw. aktualisieren.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSyncConfirm}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition font-medium"
              >
                Ja, synchronisieren
              </button>
              <button
                onClick={() => setShowSyncModal(false)}
                className="flex-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 py-2 px-4 rounded-lg transition font-medium"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};