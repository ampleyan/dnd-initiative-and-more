import React, { useState, useEffect } from 'react';
import { Plus, Trash2, LogOut, X } from 'lucide-react';
import { AuthUser } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { api } from '../api/client';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
  created_at: string;
}

interface UsersSettingsProps {
  currentUser: AuthUser;
  onLogout: () => void;
}

export const UsersSettings: React.FC<UsersSettingsProps> = ({ currentUser, onLogout }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const { showError, showSuccess } = useToast();

  const loadUsers = () => {
    api.users.list()
      .then(data => setUsers(data as User[]))
      .catch((e: unknown) => showError(e instanceof Error ? e.message : 'Failed to load users'));
  };

  useEffect(() => {
    if (currentUser.role === 'admin') loadUsers();
  }, [currentUser.role]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      await api.users.create(newUsername, newPassword, newRole);
    } catch (e: unknown) {
      setCreating(false);
      setError(e instanceof Error ? e.message : 'Failed to create user');
      return;
    }
    setCreating(false);
    setNewUsername('');
    setNewPassword('');
    setNewRole('user');
    setModalOpen(false);
    showSuccess(`User "${newUsername}" created`);
    loadUsers();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this user?')) return;
    try {
      await api.users.delete(id);
    } catch {
      showError('Failed to delete user');
      return;
    }
    showSuccess('User deleted');
    loadUsers();
  };

  const closeModal = () => { setModalOpen(false); setError(''); setNewUsername(''); setNewPassword(''); setNewRole('user'); };

  return (
    <div className="space-y-6">
      {/* Account section */}
      <div>
        <h3 className="text-xs font-black uppercase tracking-widest text-outline mb-3">Account</h3>
        <div className="bg-surface-container rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-on-surface">{currentUser.username}</p>
            <p className="text-xs text-outline capitalize">{currentUser.role}</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-outline hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </div>

      {/* Users list (admin only) */}
      {currentUser.role === 'admin' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-outline">Users</h3>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Create User
            </button>
          </div>
          <div className="space-y-1.5">
            {users.map(u => (
              <div key={u.id} className="bg-surface-container rounded-xl px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-on-surface">{u.username}</span>
                  <span className="ml-2 text-[10px] uppercase font-bold text-outline/60">{u.role}</span>
                </div>
                {u.id !== currentUser.id && (
                  <button
                    onClick={() => handleDelete(u.id)}
                    className="p-1.5 text-outline hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create User modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-surface-container rounded-2xl border border-white/10 w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-headline font-bold text-on-surface">Create User</h2>
              <button onClick={closeModal} className="text-outline hover:text-on-surface transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-outline uppercase mb-1">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/60"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-outline uppercase mb-1">Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  className="w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/60"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-outline uppercase mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as 'user' | 'admin')}
                  className="w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/60"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 rounded-lg text-xs font-bold bg-surface-container-high text-outline hover:text-on-surface transition-colors">Cancel</button>
                <button type="submit" disabled={creating} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all">
                  <Plus className="w-3.5 h-3.5" />
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
