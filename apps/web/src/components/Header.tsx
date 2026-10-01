import { useState, useEffect, type FormEvent } from 'react';

interface Props {
  isIngame?: boolean;
  callsign?: string;
  onLeave?: () => void;
  illuminateId?: string;
  onIlluminateLogin?: (id: string) => void;
  isLoginOpen?: boolean;
  onToggleLogin?: (open: boolean) => void;
}

export default function Header({
  isIngame,
  callsign,
  onLeave,
  illuminateId = '',
  onIlluminateLogin,
  isLoginOpen = false,
  onToggleLogin,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(isLoginOpen);
  const [localId, setLocalId] = useState(illuminateId);
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(illuminateId));
  const [loginMessage, setLoginMessage] = useState('');

  useEffect(() => {
    setIsExpanded(isLoginOpen);
  }, [isLoginOpen]);

  useEffect(() => {
    setIsLoggedIn(Boolean(illuminateId));
    if (illuminateId) {
      setLocalId(illuminateId);
    }
  }, [illuminateId]);

  const handleExpandToggle = (targetState: boolean) => {
    setIsExpanded(targetState);
    onToggleLogin?.(targetState);
  };

  const handleLoginSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!localId.trim() || !password.trim()) {
      setLoginMessage('ENTER BOTH ID & PASSWORD');
      return;
    }
    setIsLoggedIn(true);
    setLoginMessage(`AUTHENTICATED: ${localId.toUpperCase()}`);
    onIlluminateLogin?.(localId.trim());
    setTimeout(() => {
      handleExpandToggle(false);
      setLoginMessage('');
    }, 1100);
  };

  return (
    <header className="header-wrapper">
      <div className="header-centered-island-wrap">
        {/* Centered Wide iPhone Dynamic Island Display with Increased Height */}
        <div
          className={`dynamic-island ${isExpanded ? 'expanded' : ''} ${isIngame ? 'ingame' : ''}`}
        >
          {isIngame ? (
            /* Ingame Dynamic Display State */
            <div className="island-ingame-content">
              <span className="island-sensor-dot active" aria-hidden="true" />
              <span className="island-trader-tag">
                TRADER: {callsign?.toUpperCase()}
              </span>
              <span className="island-separator">•</span>
              <span className="island-status-pill">SIMULATION ACTIVE</span>
              <button
                type="button"
                className="island-leave-action"
                onClick={onLeave}
              >
                LEAVE ↗
              </button>
            </div>
          ) : (
            /* Standard / Expandable Dynamic Island */
            <div className="island-inner">
              {!isExpanded ? (
                /* Collapsed Wide Pill State */
                <div
                  className="island-collapsed-content"
                  onClick={() => handleExpandToggle(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && handleExpandToggle(true)
                  }
                  title="Click to open Illuminate Login"
                >
                  <div className="island-left-group">
                    <span
                      className={`island-sensor-dot ${isLoggedIn ? 'verified' : 'pulse'}`}
                      aria-hidden="true"
                    />
                    <div className="island-label-group">
                      <span className="island-badge">✦ ILLUMINATE ID</span>
                      <span className="island-subtext">
                        {isLoggedIn
                          ? `ACTIVE: ${localId.toUpperCase()}`
                          : 'LOGIN REQUIRED'}
                      </span>
                    </div>
                  </div>

                  <div className="island-middle-group">
                    <span className="island-capital-risk-text">
                      Starting Capital: <strong>₹1,000</strong> · No Risk / 2x /
                      3x / 5x
                    </span>
                  </div>

                  <div className="island-right-group">
                    <span className="island-action-tag">
                      {isLoggedIn ? 'ACCOUNT ▾' : 'LOGIN ▾'}
                    </span>
                  </div>
                </div>
              ) : (
                /* Expanded Dynamic Island Login Display */
                <form
                  className="island-expanded-form"
                  onSubmit={handleLoginSubmit}
                >
                  <div className="island-header-row">
                    <div className="island-title-wrap">
                      <span className="island-sensor-dot active" />
                      <span className="island-title">
                        ILLUMINATE OS AUTHENTICATION
                      </span>
                    </div>
                    <button
                      type="button"
                      className="island-close-btn"
                      onClick={() => handleExpandToggle(false)}
                      title="Collapse"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="island-inputs-row">
                    <div className="island-field">
                      <label htmlFor="island-illuminate-id">
                        ILLUMINATE ID
                      </label>
                      <input
                        id="island-illuminate-id"
                        name="illuminateId"
                        type="text"
                        placeholder="ENTER ILLUMINATE ID (E.G. IL-924)"
                        value={localId}
                        onChange={(e) => setLocalId(e.target.value)}
                        autoComplete="username"
                        required
                      />
                    </div>

                    <div className="island-field">
                      <label htmlFor="island-password">PASSWORD</label>
                      <input
                        id="island-password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                      />
                    </div>

                    <button type="submit" className="island-auth-btn">
                      {isLoggedIn ? 'UPDATE IDENTITY' : 'VERIFY & UNLOCK'}
                    </button>
                  </div>

                  {loginMessage && (
                    <div className="island-feedback">{loginMessage}</div>
                  )}
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
