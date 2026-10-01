import { useState, useEffect, type FormEvent } from 'react';
import { LiquidMetalButton } from './ui/liquid-metal-button';

interface Props {
  onJoin: (data: { callsign: string; gameCode: string }) => void;
  illuminateId?: string;
  onOpenLogin?: () => void;
}

export default function JoinGame({ onJoin, illuminateId, onOpenLogin }: Props) {
  const [callsign, setCallsign] = useState(illuminateId || '');
  const [gameCode, setGameCode] = useState('');

  useEffect(() => {
    if (illuminateId) {
      setCallsign(illuminateId);
    }
  }, [illuminateId]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!illuminateId) {
      onOpenLogin?.();
      return;
    }
    if (!callsign.trim() || !gameCode.trim()) return;
    onJoin({
      callsign: callsign.trim(),
      gameCode: gameCode.trim().toUpperCase(),
    });
  };

  const isLocked = !illuminateId;

  return (
    <div className="join-wrapper">
      {isLocked ? (
        /* Locked State: Requires Illuminate Login */
        <div className="join-locked-card">
          <div className="locked-badge">
            <span className="lock-icon" aria-hidden="true">
              🔒
            </span>
            <span>ILLUMINATE AUTHENTICATION REQUIRED</span>
          </div>
          <h2>Authentication Required</h2>
          <p className="locked-description">
            Market simulation entry is restricted to verified Illuminate
            traders. Log in with your Illuminate ID and password in the Dynamic
            Island above to unlock access.
          </p>
          <div className="locked-action-wrap">
            <button
              type="button"
              className="open-island-login-btn"
              onClick={onOpenLogin}
            >
              <span>Tap to Authenticate in Dynamic Island</span>
              <span className="arrow" aria-hidden="true">
                ↗
              </span>
            </button>
          </div>
        </div>
      ) : (
        /* Unlocked State: Authenticated Trader Form */
        <form id="join" className="join" onSubmit={handleSubmit}>
          <div className="join-title-row">
            <div className="join-illuminate-pill">
              <span className="pill-dot" />
              <span>
                ILLUMINATE AUTHENTICATED: {illuminateId.toUpperCase()}
              </span>
            </div>
            <h2>Enter the simulation</h2>
            <p className="join-sub">
              Starting Capital: <strong>₹1,000</strong> · No Risk / 2x / 3x / 5x
            </p>
          </div>

          <div className="input-fields">
            <div className="input-field-wrap">
              <label htmlFor="trader-callsign">Trader callsign</label>
              <input
                id="trader-callsign"
                name="traderCallsign"
                value={callsign}
                onChange={(e) => setCallsign(e.target.value)}
                placeholder="ENTER YOUR NAME / CALLSIGN"
                autoComplete="name"
                spellCheck={false}
                required
                maxLength={30}
              />
            </div>
            <div className="input-field-wrap">
              <label htmlFor="game-code">Game code</label>
              <input
                id="game-code"
                name="gameCode"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value)}
                placeholder="ENTER GAME CODE (E.G. ALPHA1)"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                required
                maxLength={12}
                pattern="[A-Za-z0-9]+"
                title="Use letters and numbers only"
              />
            </div>
          </div>

          <LiquidMetalButton type="submit" label="Join the game" />
        </form>
      )}
    </div>
  );
}
