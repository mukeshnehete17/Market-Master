import { useState, useId, type FormEvent } from 'react';
import { LiquidMetalButton } from './ui/liquid-metal-button';
import { loginUser, signupUser } from '../api/auth';
import type { User } from '../types/api';

interface LoginProps {
  onLogin: (user: User) => void;
}

type Mode = 'login' | 'signup';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const MIN_PASSWORD_LEN = 8;

const DOMAIN_TYPOS: Record<string, string> = {
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmaill.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'iclod.com': 'icloud.com',
};

export function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Touched state for live field feedback
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const nameInputId = useId();
  const emailInputId = useId();
  const passwordInputId = useId();
  const confirmInputId = useId();

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 400);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setErrorCode(null);
  };

  // Real-time Email Validation calculations
  const cleanEmail = email.trim();
  const hasSpaceInEmail = /\s/.test(email);

  let emailError: string | null = null;
  let emailSuggestion: string | null = null;

  if (cleanEmail.length > 0) {
    if (hasSpaceInEmail) {
      emailError = 'Email address cannot contain spaces';
    } else if (!cleanEmail.includes('@')) {
      emailError = "Include an '@' in your email address";
    } else {
      const parts = cleanEmail.split('@');
      const domain = parts[1] || '';
      if (!domain) {
        emailError = "Enter a domain after '@' (e.g. example.com)";
      } else if (!domain.includes('.')) {
        emailError = "Domain must include an extension (e.g. .com, .edu)";
      } else if (!EMAIL_REGEX.test(cleanEmail)) {
        emailError = 'Please enter a valid email format (name@example.com)';
      }

      // Check common typos
      const lowerDomain = domain.toLowerCase();
      if (DOMAIN_TYPOS[lowerDomain]) {
        emailSuggestion = `${parts[0]}@${DOMAIN_TYPOS[lowerDomain]}`;
      }
    }
  } else if (emailTouched) {
    emailError = 'Email address is required';
  }

  const isEmailValid = cleanEmail.length > 0 && !emailError;

  // Real-time Password Validation calculations
  const isPasswordLengthOk = password.length >= MIN_PASSWORD_LEN;
  const isPasswordMismatch =
    mode === 'signup' &&
    confirmPassword.length > 0 &&
    password !== confirmPassword;
  const isPasswordMatchOk =
    mode === 'signup' &&
    confirmPassword.length > 0 &&
    password === confirmPassword;

  const handleApplySuggestion = () => {
    if (emailSuggestion) {
      setEmail(emailSuggestion);
      setError('');
    }
  };

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    setPasswordTouched(true);

    const targetEmail = cleanEmail.toLowerCase();
    if (!targetEmail || !password) {
      setError('Please enter both your email and password');
      setErrorCode(400);
      triggerShake();
      return;
    }

    if (!EMAIL_REGEX.test(targetEmail)) {
      setError('Please enter a valid email address format (e.g. you@example.com)');
      setErrorCode(400);
      triggerShake();
      return;
    }

    setError('');
    setErrorCode(null);
    setIsLoading(true);

    try {
      const response = await loginUser(targetEmail, password);
      if (response.success && response.user) {
        onLogin(response.user);
      } else {
        setError(response.message || 'Authentication failed. Please check your credentials.');
        setErrorCode(401);
        triggerShake();
      }
    } catch (err: any) {
      const status = err?.status ?? 0;
      setErrorCode(status);
      if (status === 401) {
        setError('Invalid email or password. Please verify your credentials or create an account.');
      } else if (status === 403) {
        setError('This account has been disabled or suspended. Please contact the administrator.');
      } else if (status === 503) {
        setError('Database service is temporarily unavailable. Please try again in a few moments.');
      } else if (status === 0 || !navigator.onLine) {
        setError('Unable to reach the server. Please check your network connection.');
      } else {
        setError(err?.message || 'Authentication failed. Please try again.');
      }
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setNameTouched(true);
    setEmailTouched(true);
    setPasswordTouched(true);
    setConfirmTouched(true);

    const trimmedName = fullName.trim();
    const targetEmail = cleanEmail.toLowerCase();

    if (!trimmedName) {
      setError('Please enter your full name');
      setErrorCode(400);
      triggerShake();
      return;
    }
    if (!targetEmail) {
      setError('Please enter your email address');
      setErrorCode(400);
      triggerShake();
      return;
    }
    if (!EMAIL_REGEX.test(targetEmail)) {
      setError('Please enter a valid email address (e.g. you@example.com)');
      setErrorCode(400);
      triggerShake();
      return;
    }
    if (!password) {
      setError('Please enter a password');
      setErrorCode(400);
      triggerShake();
      return;
    }
    if (password.length < MIN_PASSWORD_LEN) {
      setError(`Password must be at least ${MIN_PASSWORD_LEN} characters long`);
      setErrorCode(400);
      triggerShake();
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify both password fields.');
      setErrorCode(400);
      triggerShake();
      return;
    }

    setError('');
    setErrorCode(null);
    setIsLoading(true);

    try {
      const response = await signupUser({
        name: trimmedName,
        email: targetEmail,
        password,
        confirm_password: confirmPassword,
      });
      if (response.success && response.user) {
        onLogin(response.user);
      } else {
        setError(response.message || 'Account creation failed. Please try again.');
        setErrorCode(400);
        triggerShake();
      }
    } catch (err: any) {
      const status = err?.status ?? 0;
      setErrorCode(status);
      if (status === 409 || err?.message?.toLowerCase().includes('already exists')) {
        setError('An account with this email already exists.');
      } else if (status === 503) {
        setError('Database is temporarily unavailable. Please try again shortly.');
      } else if (status === 0 || !navigator.onLine) {
        setError('Unable to reach the server. Please check your network connection.');
      } else {
        setError(err?.message || 'Could not create account. Please try again.');
      }
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form
        className={`login-card ${isShaking ? 'shake' : ''}`}
        onSubmit={mode === 'login' ? handleLoginSubmit : handleSignupSubmit}
        noValidate
      >
        <div className="op-logo-wrap">
          <img
            src="/assets/logo.png"
            alt="Market Master"
            className="op-animated-logo"
          />
        </div>

        <h2>Trader Authentication</h2>

        <div
          style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'center',
            marginBottom: '10px',
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
              padding: '7px 16px',
              borderRadius: '999px',
              border: mode === 'login' ? '2px solid #000' : '1px solid #d1d5db',
              background: mode === 'login' ? '#000' : '#ffffff',
              color: mode === 'login' ? '#ffffff' : '#4b5563',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
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
              padding: '7px 16px',
              borderRadius: '999px',
              border: mode === 'signup' ? '2px solid #000' : '1px solid #d1d5db',
              background: mode === 'signup' ? '#000' : '#ffffff',
              color: mode === 'signup' ? '#ffffff' : '#4b5563',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            SIGN UP
          </button>
        </div>

        <div className="login-fields">
          {mode === 'signup' && (
            <div className="input-field-wrap">
              <label htmlFor={nameInputId}>FULL NAME</label>
              <input
                id={nameInputId}
                type="text"
                placeholder="YOUR FULL NAME"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (error) setError('');
                }}
                onBlur={() => setNameTouched(true)}
                autoComplete="name"
                required
                maxLength={100}
                disabled={isLoading}
                className={nameTouched && !fullName.trim() ? 'input-error' : ''}
              />
              {nameTouched && !fullName.trim() && (
                <div className="field-helper error">⚠️ Full name is required</div>
              )}
            </div>
          )}

          <div className="input-field-wrap">
            <label htmlFor={emailInputId}>EMAIL ADDRESS</label>
            <input
              id={emailInputId}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              onBlur={() => {
                setEmailTouched(true);
                setEmail((prev) => prev.trim());
              }}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck="false"
              required
              disabled={isLoading}
              className={
                emailTouched && emailError
                  ? 'input-error'
                  : emailTouched && isEmailValid
                    ? 'input-success'
                    : ''
              }
            />

            {/* Real-time email validation feedback */}
            {emailTouched && emailError && (
              <div className="field-helper error">
                <span>⚠️</span> {emailError}
              </div>
            )}

            {/* Live typo domain suggestion */}
            {emailSuggestion && (
              <div
                className="field-helper suggestion"
                onClick={handleApplySuggestion}
                title="Click to fix typo"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleApplySuggestion();
                }}
              >
                💡 Did you mean <strong>{emailSuggestion}</strong>? Click to apply
              </div>
            )}

            {/* Real-time success indicator */}
            {!emailError && cleanEmail.length > 0 && !emailSuggestion && (
              <div className="field-helper success">
                <span>✓</span> Email format valid
              </div>
            )}
          </div>

          <div className="input-field-wrap">
            <label htmlFor={passwordInputId}>PASSWORD</label>
            <div className="pw-input-container">
              <input
                id={passwordInputId}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                onBlur={() => setPasswordTouched(true)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                disabled={isLoading}
                className={
                  passwordTouched && mode === 'signup' && !isPasswordLengthOk
                    ? 'input-error'
                    : ''
                }
              />
              <button
                type="button"
                className="pw-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '👁️' : '🙈'}
              </button>
            </div>

            {/* Password length helper for signup */}
            {mode === 'signup' && (
              <div
                className={`field-helper ${
                  isPasswordLengthOk
                    ? 'success'
                    : passwordTouched
                      ? 'error'
                      : ''
                }`}
                style={{
                  color: isPasswordLengthOk
                    ? '#059669'
                    : passwordTouched
                      ? '#e11d48'
                      : '#6b7280',
                }}
              >
                <span>{isPasswordLengthOk ? '✓' : '•'}</span> At least {MIN_PASSWORD_LEN} characters
              </div>
            )}
          </div>

          {mode === 'signup' && (
            <div className="input-field-wrap">
              <label htmlFor={confirmInputId}>CONFIRM PASSWORD</label>
              <div className="pw-input-container">
                <input
                  id={confirmInputId}
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError('');
                  }}
                  onBlur={() => setConfirmTouched(true)}
                  autoComplete="new-password"
                  required
                  disabled={isLoading}
                  className={
                    confirmTouched && isPasswordMismatch
                      ? 'input-error'
                      : confirmTouched && isPasswordMatchOk
                        ? 'input-success'
                        : ''
                  }
                />
                <button
                  type="button"
                  className="pw-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? '👁️' : '🙈'}
                </button>
              </div>

              {confirmTouched && isPasswordMismatch && (
                <div className="field-helper error">
                  <span>✕</span> Passwords do not match
                </div>
              )}
              {isPasswordMatchOk && (
                <div className="field-helper success">
                  <span>✓</span> Passwords match
                </div>
              )}
            </div>
          )}
        </div>

        {/* Informative Error Banner with Action Suggestions */}
        {error && (
          <div className="login-error-banner" role="alert">
            <div className="banner-header">
              <span>⚠️</span>
              <span>{error}</span>
            </div>

            {/* If login failed due to non-existent account, offer switch to signup */}
            {mode === 'login' && errorCode === 401 && (
              <button
                type="button"
                className="banner-action-btn"
                onClick={() => switchMode('signup')}
              >
                Don't have an account? Sign up now →
              </button>
            )}

            {/* If signup failed due to existing email, offer switch to login */}
            {mode === 'signup' && errorCode === 409 && (
              <button
                type="button"
                className="banner-action-btn"
                onClick={() => switchMode('login')}
              >
                Already have an account? Log in now →
              </button>
            )}
          </div>
        )}

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
