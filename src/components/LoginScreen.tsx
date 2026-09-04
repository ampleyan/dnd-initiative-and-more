import React, { useState } from 'react';

interface LoginScreenProps {
  onLogin: (username: string, password: string) => Promise<string | null>;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const err = await onLogin(username, password);
    setLoading(false);
    if (err) setError(err);
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/favicon.ico" alt="logo" className="w-14 h-14 mb-3 rounded-xl" />
          <h1 className="text-2xl font-headline font-bold text-on-surface">Initiative Tracker</h1>
          <p className="text-sm text-outline mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-container rounded-2xl p-6 space-y-4 border border-outline-variant/20">
          <div>
            <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              required
              className="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-on-primary py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 mt-2"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};
