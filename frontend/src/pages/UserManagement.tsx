import { useState, useEffect } from 'react';
import { Users, UserPlus, Edit, Trash2, Key, X, Check, AlertTriangle, Mail, Shield } from 'lucide-react';
import { userAPI } from '../api/auth';

interface User {
  id: number;
  username: string;
  email: string;
  display_name: string;
  auth_type: 'local' | 'sso';
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

export const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<{ id: number; username: string } | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    displayName: '',
    isAdmin: false
  });
  const [newPassword, setNewPassword] = useState('');

  // Toast states
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const showToast = (message: string, isError = false) => {
    setToastMessage(message);
    if (isError) {
      setShowErrorToast(true);
      setTimeout(() => setShowErrorToast(false), 3000);
    } else {
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await userAPI.getAll();
      setUsers(data);
    } catch (err: any) {
      showToast(err.message || 'Fehler beim Laden der Benutzer', true);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await userAPI.create(formData);
      showToast('Benutzer erfolgreich erstellt');
      setShowCreateModal(false);
      resetForm();
      loadUsers();
    } catch (err: any) {
      showToast(err.message || 'Fehler beim Erstellen des Benutzers', true);
    }
  };

  const handleUpdate = async (user: User) => {
    try {
      await userAPI.update(user.id, {
        email: user.email,
        displayName: user.display_name,
        isAdmin: user.is_admin,
        isActive: user.is_active
      });
      showToast('Benutzer erfolgreich aktualisiert');
      setEditingUser(null);
      loadUsers();
    } catch (err: any) {
      showToast(err.message || 'Fehler beim Aktualisieren des Benutzers', true);
    }
  };

  const handleResetPassword = async (userId: number) => {
    if (!newPassword) {
      showToast('Bitte Passwort eingeben', true);
      return;
    }
    if (newPassword.length < 8) {
      showToast('Passwort muss mindestens 8 Zeichen lang sein', true);
      return;
    }
    try {
      await userAPI.resetPassword(userId, newPassword);
      showToast('Passwort erfolgreich zurückgesetzt');
      setShowPasswordModal(null);
      setNewPassword('');
    } catch (err: any) {
      showToast(err.message || 'Fehler beim Zurücksetzen des Passworts', true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!showDeleteModal) return;

    try {
      await userAPI.delete(showDeleteModal.id);
      showToast('Benutzer erfolgreich gelöscht');
      setShowDeleteModal(null);
      loadUsers();
    } catch (err: any) {
      showToast(err.message || 'Fehler beim Löschen des Benutzers', true);
      setShowDeleteModal(null);
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      displayName: '',
      isAdmin: false
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-200 dark:border-gray-700"></div>
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary-600 dark:border-primary-400 absolute top-0"></div>
        </div>
        <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">Lade Benutzer...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 dark:from-primary-400 dark:to-primary-600 rounded-xl flex items-center justify-center shadow-md">
            <Users className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Benutzerverwaltung</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">{users.length} {users.length === 1 ? 'Benutzer' : 'Benutzer'}</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl transition shadow-lg font-medium w-full sm:w-auto"
        >
          <UserPlus size={20} />
          <span>Benutzer erstellen</span>
        </button>
      </div>

      {/* Users Table/Cards - Mobile Responsive */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Benutzer
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="hidden lg:table-cell px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Erstellt
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold">
                        {user.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {user.display_name}
                          </span>
                          {user.is_admin && (
                            <span className="px-2 py-0.5 text-xs bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-full font-semibold">
                              Admin
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Mail size={12} />
                          {user.email}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">@{user.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      user.auth_type === 'sso'
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    }`}>
                      {user.auth_type === 'sso' ? 'SSO' : 'Lokal'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingUser?.id === user.id ? (
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingUser.is_active}
                          onChange={(e) => setEditingUser({ ...editingUser, is_active: e.target.checked })}
                          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Aktiv</span>
                      </label>
                    ) : (
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        user.is_active
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                          : 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                      }`}>
                        {user.is_active ? 'Aktiv' : 'Deaktiviert'}
                      </span>
                    )}
                  </td>
                  <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      {editingUser?.id === user.id ? (
                        <>
                          <button
                            onClick={() => handleUpdate(editingUser)}
                            className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition"
                            title="Speichern"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            onClick={() => setEditingUser(null)}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                            title="Abbrechen"
                          >
                            <X size={18} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditingUser(user)}
                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                            title="Bearbeiten"
                          >
                            <Edit size={18} />
                          </button>
                          {user.auth_type === 'local' && (
                            <button
                              onClick={() => setShowPasswordModal(user.id)}
                              className="p-2 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition"
                              title="Passwort zurücksetzen"
                            >
                              <Key size={18} />
                            </button>
                          )}
                          <button
                            onClick={() => setShowDeleteModal({ id: user.id, username: user.username })}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                            title="Löschen"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
          {users.map((user) => (
            <div key={user.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-lg">
                    {user.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {user.display_name}
                      </span>
                      {user.is_admin && (
                        <span className="px-2 py-0.5 text-xs bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-full font-semibold">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">@{user.username}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                  user.auth_type === 'sso'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                }`}>
                  {user.auth_type === 'sso' ? 'SSO' : 'Lokal'}
                </span>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                  user.is_active
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                    : 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                }`}>
                  {user.is_active ? 'Aktiv' : 'Deaktiviert'}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setEditingUser(user)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition text-sm font-medium"
                >
                  <Edit size={16} />
                  Bearbeiten
                </button>
                {user.auth_type === 'local' && (
                  <button
                    onClick={() => setShowPasswordModal(user.id)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition text-sm"
                  >
                    <Key size={16} />
                  </button>
                )}
                <button
                  onClick={() => setShowDeleteModal({ id: user.id, username: user.username })}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition text-sm"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl animate-slideUp">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                Neuen Benutzer erstellen
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                <X size={24} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Benutzername *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  E-Mail *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Passwort * (min. 8 Zeichen)
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                  minLength={8}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Anzeigename
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                  placeholder="Optional"
                />
              </div>
              <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <input
                  type="checkbox"
                  id="isAdmin"
                  checked={formData.isAdmin}
                  onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="isAdmin" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Shield size={16} />
                  Administrator-Rechte
                </label>
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white py-3 px-4 rounded-xl transition font-semibold shadow-lg"
                >
                  Erstellen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="flex-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 py-3 px-4 rounded-xl transition font-semibold"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-slideUp">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                Passwort zurücksetzen
              </h3>
              <button
                onClick={() => {
                  setShowPasswordModal(null);
                  setNewPassword('');
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                <X size={24} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Neues Passwort * (min. 8 Zeichen)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                  placeholder="Neues Passwort eingeben"
                  minLength={8}
                  autoFocus
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => handleResetPassword(showPasswordModal)}
                  className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white py-3 px-4 rounded-xl transition font-semibold shadow-lg"
                >
                  Zurücksetzen
                </button>
                <button
                  onClick={() => {
                    setShowPasswordModal(null);
                    setNewPassword('');
                  }}
                  className="flex-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 py-3 px-4 rounded-xl transition font-semibold"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-slideUp">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="text-red-600 dark:text-red-400" size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                Benutzer löschen?
              </h3>
            </div>

            <div className="mb-6">
              <p className="text-gray-600 dark:text-gray-400">
                Möchten Sie den Benutzer <strong className="text-gray-800 dark:text-gray-100">"{showDeleteModal.username}"</strong> wirklich löschen?
              </p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                ⚠️ Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white py-3 px-4 rounded-xl transition font-semibold shadow-lg flex items-center justify-center gap-2"
              >
                <Trash2 size={18} />
                Ja, löschen
              </button>
              <button
                onClick={() => setShowDeleteModal(null)}
                className="flex-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 py-3 px-4 rounded-xl transition font-semibold"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed bottom-4 right-4 z-50 animate-slideUp">
          <div className="bg-green-500 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-2">
            <Check size={20} />
            <span className="font-medium">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {showErrorToast && (
        <div className="fixed bottom-4 right-4 z-50 animate-slideUp">
          <div className="bg-red-500 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-2">
            <AlertTriangle size={20} />
            <span className="font-medium">{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};
