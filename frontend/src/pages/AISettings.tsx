import { useState, useEffect } from 'react';
import { Save, Bot, Key, Check, AlertCircle, Loader2, Eye, EyeOff, Info } from 'lucide-react';
import { aiSettingsApi, AISettings as AISettingsType } from '../api/ai-settings';

export const AISettings = () => {
  const [settings, setSettings] = useState<AISettingsType>({
    provider: 'claude',
    api_key: '',
    enabled: false,
    has_api_key: false,
    force_autonomous: false,
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [message, setMessage] = useState('');
  const [newApiKey, setNewApiKey] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await aiSettingsApi.getSettings();
      setSettings(data);
    } catch (error) {
      console.error('Error loading AI settings:', error);
      showToast('Fehler beim Laden der Einstellungen', true);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string, isError = false) => {
    setMessage(msg);
    if (isError) {
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
    } else {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData: any = {
        provider: settings.provider,
        enabled: settings.enabled,
        force_autonomous: settings.force_autonomous,
      };

      // Nur neuen API Key senden wenn er geändert wurde
      if (newApiKey.trim()) {
        updateData.api_key = newApiKey.trim();
      }

      await aiSettingsApi.updateSettings(updateData);
      showToast('AI Einstellungen gespeichert');

      // Nach dem Speichern neu laden
      await loadSettings();
      setNewApiKey(''); // Clear the input
    } catch (error: any) {
      console.error('Error saving AI settings:', error);
      showToast(error.message || 'Fehler beim Speichern', true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 animate-slideIn">
          <div className="flex items-center gap-2 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg">
            <Check className="w-5 h-5" />
            <span>{message}</span>
          </div>
        </div>
      )}

      {showError && (
        <div className="fixed top-4 right-4 z-50 animate-slideIn">
          <div className="flex items-center gap-2 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg">
            <AlertCircle className="w-5 h-5" />
            <span>{message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 bg-primary-100 dark:bg-primary-900 rounded-lg">
          <Bot className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            AI Einstellungen
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Konfiguriere AI-Unterstützung für PDF Rezept-Parsing
          </p>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-semibold mb-2">AI-basiertes PDF Parsing (Optional)</p>
            <p className="mb-2">
              Standard: PDF Rezepte werden mit Regex-Patterns ausgelesen (Option B).
            </p>
            <p>
              Optional: Mit einem AI API Key können Rezepte intelligenter und genauer
              ausgelesen werden (Option C). Dies ist besonders hilfreich bei komplexen
              oder unstrukturierten PDFs.
            </p>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <div className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div>
            <label className="text-sm font-semibold text-gray-900 dark:text-white">
              AI-Parsing aktivieren
            </label>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Wenn deaktiviert, wird Standard-Regex verwendet
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.enabled
                ? 'bg-primary-600'
                : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Force Autonomous Mode Toggle */}
        <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div>
            <label className="text-sm font-semibold text-gray-900 dark:text-white">
              🧪 Force Autonomous Mode (Test)
            </label>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Deaktiviert AI-Fallback komplett - nutzt nur Regex Parser
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              ⚠️ Nur zum Testen: Prüft ob ML intelligent genug ist
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSettings({ ...settings, force_autonomous: !settings.force_autonomous })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.force_autonomous
                ? 'bg-amber-600'
                : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.force_autonomous ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Provider Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
            <Bot className="inline w-4 h-4 mr-2" />
            AI Provider
          </label>
          <select
            value={settings.provider}
            onChange={(e) => setSettings({ ...settings, provider: e.target.value as 'claude' | 'openai' })}
            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
            disabled={!settings.enabled}
          >
            <option value="claude">Claude (Anthropic)</option>
            <option value="openai">OpenAI (GPT-4)</option>
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {settings.provider === 'claude'
              ? 'Verwendet Claude 3.5 Sonnet für beste Ergebnisse'
              : 'Verwendet GPT-4o-mini für schnelles Parsing'}
          </p>
        </div>

        {/* API Key */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
            <Key className="inline w-4 h-4 mr-2" />
            API Key
          </label>

          {settings.has_api_key && (
            <div className="mb-2 text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
              <Check className="w-4 h-4" />
              API Key ist gespeichert
            </div>
          )}

          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={newApiKey}
              onChange={(e) => setNewApiKey(e.target.value)}
              placeholder={settings.has_api_key ? 'Neuen API Key eingeben (optional)' : 'API Key eingeben'}
              className="w-full px-4 py-3 pr-12 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
              disabled={!settings.enabled}
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
            >
              {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <div className="mt-2 space-y-1">
            {settings.provider === 'claude' && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Benötigt: Claude API Key von{' '}
                <a
                  href="https://console.anthropic.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                >
                  console.anthropic.com
                </a>
              </p>
            )}
            {settings.provider === 'openai' && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Benötigt: OpenAI API Key von{' '}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                >
                  platform.openai.com
                </a>
              </p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Der API Key wird verschlüsselt gespeichert
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Speichere...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Einstellungen speichern
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
