import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChefHat, Lock, User, LogIn, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ssoAPI } from '../api/auth';

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoConfig, setSsoConfig] = useState<any>(null);
  const { login, loginSSO } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Load SSO config
    ssoAPI.getPublicConfig().then(setSsoConfig);

    // Check for SSO callback
    const code = searchParams.get('code');
    if (code) {
      handleSSOCallback(code);
    }
  }, [searchParams]);

  const handleSSOCallback = async (code: string) => {
    setLoading(true);
    setError('');
    try {
      await loginSSO(code);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'SSO Login fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleSSOLogin = async () => {
    try {
      const { authUrl } = await ssoAPI.getPublicConfig().then(async (config) => {
        if (!config.enabled) throw new Error('SSO nicht aktiviert');
        const response = await fetch('/api/auth/sso/auth-url');
        return response.json();
      });
      window.location.href = authUrl;
    } catch (err: any) {
      setError(err.message || 'SSO nicht verfügbar');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Login Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 border border-gray-100 dark:border-gray-700 animate-slideUp">
          {/* Logo & Title */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-primary-500 to-primary-700 dark:from-primary-400 dark:to-primary-600 rounded-2xl flex items-center justify-center shadow-xl mb-4 animate-fadeIn">
              <ChefHat className="text-white" size={48} />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              Wochenplaner
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              Melde dich an um fortzufahren
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-sm flex items-start gap-3 animate-slideDown">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Benutzername
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                  placeholder="admin"
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Passwort
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold py-3 px-6 rounded-xl transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-400"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Anmeldung läuft...
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  Anmelden
                </>
              )}
            </button>
          </form>

          {/* SSO Login */}
          {ssoConfig?.enabled && (
            <>
              <div className="my-6 flex items-center">
                <div className="flex-1 border-t-2 border-gray-200 dark:border-gray-600"></div>
                <span className="px-4 text-sm font-medium text-gray-500 dark:text-gray-400">oder</span>
                <div className="flex-1 border-t-2 border-gray-200 dark:border-gray-600"></div>
              </div>

              <button
                onClick={handleSSOLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 border-2 border-blue-600 dark:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-600 font-semibold py-3 px-6 rounded-xl transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Mit Microsoft anmelden"
              >
                {/* Microsoft-Logo (4 Kacheln) */}
                <svg width="20" height="20" viewBox="0 0 23 23" aria-hidden="true">
                  <rect x="0" y="0" width="10" height="10" fill="#F25022" />
                  <rect x="12.5" y="0" width="10" height="10" fill="#7FBA00" />
                  <rect x="0" y="12.5" width="10" height="10" fill="#00A4EF" />
                  <rect x="12.5" y="12.5" width="10" height="10" fill="#FFB900" />
                </svg>
                <span>{ssoConfig.buttonText || 'Mit Microsoft anmelden'}</span>
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6 space-y-1">
          <p>© 2025 Wochenplaner • Made with ❤️</p>
          <p>🍴 Wochenplaner für die Essensplanung</p>
        </div>
      </div>
    </div>
  );
};
