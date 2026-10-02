import { useState, type FormEvent } from 'react';
import { LiquidMetalButton } from './ui/liquid-metal-button';
import { loginUser, signupUser } from '../api/auth';
import type { User } from '../types/api';

interface LoginProps {
  onLogin: (user: User) => void;
}

type Mode = 'login' | 'signup';

export function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
  };

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('ENTER BOTH EMAIL & PASSWORD');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await loginUser(email.trim().toLowerCase(), password);
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

  const handleSignupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError('FILL IN ALL SIGNUP FIELDS');
      return;
    }
    if (password !== confirmPassword) {
      setError('PASSWORDS DO NOT MATCH');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await signupUser({
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirm_password: confirmPassword,
      });
      if (response.success && response.user) {
        onLogin(response.user);
      } else {
        setError(response.message || 'SIGNUP FAILED');
      }
    } catch (err: any) {
      setError(err?.message || 'FAILED TO CONNECT TO SERVER');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form
        className="login-card"
        onSubmit={mode === 'login' ? handleLoginSubmit : handleSignupSubmit}
      >
        <div className="op-logo-wrap">
          <img
            src="/assets/logo.png"
            alt="One Piece"
            className="op-animated-logo"
          />
        </div>

        <h2>Trader Authentication</h2>

        <div
          style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'center',
            marginBottom: '14px',
          }}
        >
          <button
            type="button"
            onClick={() => switchMode('login')}
            disabled={isLoading}
            style={{
              fontWeight: 800,
              fontSize: '12px',
              letterSpacing: '0.08em',
              padding: '6px 14px',
              borderRadius: '999px',
              border: mode === 'login' ? '2px solid #000' : '1px solid #ccc',
              background: mode === 'login' ? '#000' : '#fff',
              color: mode === 'login' ? '#fff' : '#000',
              cursor: 'pointer',
            }}
          >
            LOG IN
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            disabled={isLoading}
            style={{
              fontWeight: 800,
              fontSize: '12px',
              letterSpacing: '0.08em',
              padding: '6px 14px',
              borderRadius: '999px',
              border: mode === 'signup' ? '2px solid #000' : '1px solid #ccc',
              background: mode === 'signup' ? '#000' : '#fff',
              color: mode === 'signup' ? '#fff' : '#000',
              cursor: 'pointer',
            }}
          >
            SIGN UP
          </button>
        </div>

        <div className="login-fields">
          {mode === 'signup' && (
            <div className="input-field-wrap">
              <label htmlFor="signup-name">FULL NAME</label>
              <input
                id="signup-name"
                type="text"
                placeholder="YOUR FULL NAME"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                required
                maxLength={100}
                disabled={isLoading}
              />
            </div>
          )}

          <div className="input-field-wrap">
            <label htmlFor="auth-email">EMAIL</label>
            <input
              id="auth-email"
              type="email"
              placeholder="YOU@EXAMPLE.COM"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              disabled={isLoading}
            />
          </div>

          <div className="input-field-wrap">
            <label htmlFor="auth-password">PASSWORD</label>
            <input
              id="auth-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              disabled={isLoading}
            />
          </div>

          {mode === 'signup' && (
            <div className="input-field-wrap">
              <label htmlFor="signup-confirm">CONFIRM PASSWORD</label>
              <input
                id="signup-confirm"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                disabled={isLoading}
              />
            </div>
          )}
        </div>

        {error && <div className="login-error">{error}</div>}

        <div className="login-action-wrap">
          <LiquidMetalButton
            type="submit"
            label={
              isLoading
                ? mode === 'login'
                  ? 'VERIFYING CREDENTIALS...'
                  : 'CREATING ACCOUNT...'
                : mode === 'login'
                  ? 'VERIFY & UNLOCK'
                  : 'CREATE ACCOUNT'
            }
            disabled={isLoading}
          />
        </div>
      </form>
    </div>
  );
}
