import { useState, useEffect } from 'react';
import { Save, TestTube, Mail, Server, Key, User, Check, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

export const SMTPSettings = () => {
  const [settings, setSettings] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    sender_email: '',
    sender_name: 'Wochenplaner',
    smtp_secure: false,
    enabled: false,
    daily_menu_enabled: true,
    weekly_reminder_enabled: true
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/smtp/settings', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Error loading SMTP settings:', error);
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
      const response = await fetch('/api/smtp/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        showToast('SMTP Einstellungen gespeichert');
      } else {
        throw new Error('Fehler beim Speichern');
      }
    } catch (error) {
      showToast('Fehler beim Speichern', true);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const response = await fetch('/api/smtp/test', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const result = await response.json();

      if (result.success) {
        showToast('SMTP Verbindung erfolgreich!');
      } else {
        showToast(`Test fehlgeschlagen: ${result.message}`, true);
      }
    } catch (error: any) {
      showToast(`Test fehlgeschlagen: ${error.message}`, true);
    } finally {
      setTesting(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail) {
      showToast('Bitte Email-Adresse eingeben', true);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      showToast('Ungültige Email-Adresse', true);
      return;
    }

    setSendingTest(true);
    try {
      const response = await fetch('/api/smtp/send-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ email: testEmail })
      });
      const result = await response.json();

      if (result.success) {
        showToast(`Test-Email erfolgreich an ${testEmail} gesendet!`);
        setTestEmail('');
      } else {
        showToast(`Fehler: ${result.message}`, true);
      }
    } catch (error: any) {
      showToast(`Fehler beim Senden: ${error.message}`, true);
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-primary-600" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-md">
          <Mail className="text-white" size={24} />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Email Einstellungen</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">SMTP Server für automatische Benachrichtigungen</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SMTP Host */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            <Server size={16} className="inline mr-2" />
            SMTP Host *
          </label>
          <input
            type="text"
            value={settings.smtp_host}
            onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
            className="w-full px-3 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
            placeholder="smtp.gmail.com"
          />
        </div>

        {/* SMTP Port */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            SMTP Port *
          </label>
          <input
            type="number"
            value={settings.smtp_port}
            onChange={(e) => setSettings({ ...settings, smtp_port: parseInt(e.target.value) })}
            className="w-full px-3 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
          />
        </div>

        {/* SMTP User */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            <User size={16} className="inline mr-2" />
            SMTP Benutzer *
          </label>
          <input
            type="text"
            value={settings.smtp_user}
            onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
            className="w-full px-3 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
            placeholder="user@example.com"
          />
        </div>

        {/* SMTP Password */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            <Key size={16} className="inline mr-2" />
            SMTP Passwort *
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={settings.smtp_password}
              onChange={(e) => setSettings({ ...settings, smtp_password: e.target.value })}
              className="w-full px-3 py-2.5 pr-12 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        {/* Sender Email */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            <Mail size={16} className="inline mr-2" />
            Absender Email *
          </label>
          <input
            type="email"
            value={settings.sender_email}
            onChange={(e) => setSettings({ ...settings, sender_email: e.target.value })}
            className="w-full px-3 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
            placeholder="noreply@example.com"
          />
        </div>

        {/* Sender Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Absender Name
          </label>
          <input
            type="text"
            value={settings.sender_name}
            onChange={(e) => setSettings({ ...settings, sender_name: e.target.value })}
            className="w-full px-3 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
          />
        </div>
      </div>

      {/* Checkboxes */}
      <div className="space-y-3 bg-gray-50 dark:bg-gray-700 p-4 rounded-xl">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.smtp_secure}
            onChange={(e) => setSettings({ ...settings, smtp_secure: e.target.checked })}
            className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">SSL/TLS verwenden (Port 465)</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
            className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Email Benachrichtigungen aktivieren</span>
        </label>

        {settings.enabled && (
          <>
            <label className="flex items-center gap-3 cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={settings.daily_menu_enabled}
                onChange={(e) => setSettings({ ...settings, daily_menu_enabled: e.target.checked })}
                className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Täglicher Menüplan (07:00 Uhr)</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={settings.weekly_reminder_enabled}
                onChange={(e) => setSettings({ ...settings, weekly_reminder_enabled: e.target.checked })}
                className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Wöchentliche Erinnerung (Sonntag 10:00 Uhr)</span>
            </label>
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white py-3 px-6 rounded-xl transition shadow-lg font-semibold disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
          {saving ? 'Wird gespeichert...' : 'Einstellungen speichern'}
        </button>

        <button
          onClick={handleTest}
          disabled={testing || !settings.enabled}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white py-3 px-6 rounded-xl transition shadow-lg font-semibold disabled:opacity-50"
        >
          {testing ? <Loader2 className="animate-spin" size={20} /> : <TestTube size={20} />}
          {testing ? 'Teste...' : 'Verbindung testen'}
        </button>
      </div>

      {/* Test Email Section */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-200 dark:border-purple-700 rounded-xl p-6">
        <h4 className="font-semibold text-purple-900 dark:text-purple-300 mb-4 flex items-center gap-2">
          <Mail size={20} />
          Test-Email versenden
        </h4>
        <p className="text-sm text-purple-800 dark:text-purple-300 mb-4">
          Sende eine Test-Email an eine beliebige Email-Adresse, um die SMTP-Konfiguration zu testen.
        </p>
        <div className="flex gap-3">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="test@example.com"
            className="flex-1 px-4 py-3 border-2 border-purple-300 dark:border-purple-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
            disabled={!settings.enabled || sendingTest}
          />
          <button
            onClick={handleSendTest}
            disabled={sendingTest || !settings.enabled || !testEmail}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-3 px-6 rounded-xl transition shadow-lg font-semibold disabled:opacity-50 whitespace-nowrap"
          >
            {sendingTest ? <Loader2 className="animate-spin" size={20} /> : <Mail size={20} />}
            {sendingTest ? 'Sende...' : 'Email senden'}
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-xl p-4">
        <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">📧 Email Benachrichtigungen</h4>
        <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <li>• <strong>Täglicher Menüplan:</strong> Jeden Tag um 07:00 Uhr (Schweizer Zeit)</li>
          <li>• <strong>Wöchentliche Erinnerung:</strong> Jeden Sonntag um 10:00 Uhr (Schweizer Zeit)</li>
          <li>• Emails werden nur an SSO-Benutzer gesendet</li>
        </ul>
      </div>

      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed bottom-4 right-4 z-50 animate-slideUp">
          <div className="bg-green-500 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-2">
            <Check size={20} />
            <span className="font-medium">{message}</span>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {showError && (
        <div className="fixed bottom-4 right-4 z-50 animate-slideUp">
          <div className="bg-red-500 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-2">
            <AlertCircle size={20} />
            <span className="font-medium">{message}</span>
          </div>
        </div>
      )}
    </div>
  );
};
