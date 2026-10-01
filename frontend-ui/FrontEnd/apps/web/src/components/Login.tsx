import { useState, type FormEvent } from 'react';
import { LiquidMetalButton } from './ui/liquid-metal-button';
import { loginUser } from '../api/auth';
import type { User } from '../types/api';

interface LoginProps {
  onLogin: (user: User) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [localId, setLocalId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!localId.trim() || !password.trim()) {
      setError('ENTER BOTH ID & PASSWORD');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await loginUser(localId.trim(), password.trim());
      if (response.success && response.user) {
        onLogin(response.user);
      } else {
        setError(response.message || 'AUTHENTICATION FAILED');
      }
    } catch (err: any) {
      setError(err?.message || 'FAILED TO CONNECT TO SERVER');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form className="login-card" onSubmit={handleLoginSubmit}>
        <div className="op-logo-wrap">
          <img
            src="/assets/logo.png"
            alt="One Piece"
            className="op-animated-logo"
          />
        </div>

        <h2>Trader Authentication</h2>

        <div className="login-fields">
          <div className="input-field-wrap">
            <label htmlFor="login-id">USER / ILLUMINATE ID</label>
            <input
              id="login-id"
              type="text"
              placeholder="YOUR NAME"
              value={localId}
              onChange={(e) => setLocalId(e.target.value)}
              autoComplete="username"
              required
              disabled={isLoading}
            />
          </div>

          <div className="input-field-wrap">
            <label htmlFor="login-password">PASSWORD</label>
            <input
              id="login-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={isLoading}
            />
          </div>
        </div>

        {error && <div className="login-error">{error}</div>}

        <div className="login-action-wrap">
          <LiquidMetalButton
            type="submit"
            label={isLoading ? 'VERIFYING CREDENTIALS...' : 'VERIFY & UNLOCK'}
            disabled={isLoading}
          />
        </div>
      </form>
    </div>
  );
}
