import { useState, useEffect, type FormEvent } from 'react';
import { LiquidMetalButton } from './ui/liquid-metal-button';
import { joinGame } from '../api/game';

interface Props {
  onJoin: (data: { callsign: string; gameCode: string; avatar: string }) => void;
  defaultName?: string;
}

const AVATARS = ['🦊', '🐺', '🦁', '🦅', '🦈', '🏴‍☠️'];

export default function JoinGame({ onJoin, defaultName = '' }: Props) {
  const [callsign, setCallsign] = useState(defaultName || '');
  const [gameCode, setGameCode] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🦊');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (defaultName && (!callsign || callsign.includes('-'))) {
      setCallsign(defaultName);
    }
  }, [defaultName]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!callsign.trim() || !gameCode.trim()) {
      setError('Please enter both your name and game code.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await joinGame(
        gameCode.trim().toUpperCase(),
        callsign.trim(),
        selectedAvatar
      );
      if (response.success) {
        onJoin({
          callsign: callsign.trim(),
          gameCode: gameCode.trim().toUpperCase(),
          avatar: selectedAvatar,
        });
      } else {
        setError(response.message || 'Failed to join game session.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error connecting to game session.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="join-wrapper">
      <form id="join" className="join" onSubmit={handleSubmit}>
        <div className="join-title-row">
          <div className="join-illuminate-pill">
            <span className="pill-dot" />
            <span>SESSION: {defaultName ? defaultName.toUpperCase() : 'AUTHENTICATED TRADER'}</span>
          </div>

          <div className="op-logo-wrap">
            <img
              src="/assets/logo.png"
              alt="One Piece"
              className="op-animated-logo"
            />
          </div>

          <h2>Enter Market Arena</h2>
          <p className="join-sub">
            Starting Capital: <strong>₹1,000</strong> · Multipliers: No Risk / 2x / 3x / 5x
          </p>
        </div>

        {/* Avatar Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', margin: '6px 0 14px' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '0.05em', color: '#555' }}>
            SELECT TRADER AVATAR
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            {AVATARS.map((av) => (
              <button
                key={av}
                type="button"
                onClick={() => setSelectedAvatar(av)}
                style={{
                  fontSize: '22px',
                  padding: '6px 10px',
                  borderRadius: '12px',
                  border: selectedAvatar === av ? '2px solid #000' : '1px solid #ddd',
                  background: selectedAvatar === av ? '#f0f0f0' : '#fff',
                  cursor: 'pointer',
                  transform: selectedAvatar === av ? 'scale(1.15)' : 'none',
                  transition: 'all 150ms ease',
                }}
              >
                {av}
              </button>
            ))}
          </div>
        </div>

        <div className="input-fields">
          <div className="input-field-wrap">
            <label htmlFor="trader-callsign">Trader Name</label>
            <input
              id="trader-callsign"
              name="traderCallsign"
              value={callsign}
              onChange={(e) => setCallsign(e.target.value)}
              placeholder="ENTER YOUR NAME"
              autoComplete="name"
              spellCheck={false}
              required
              maxLength={30}
              disabled={isLoading}
            />
          </div>
          <div className="input-field-wrap">
            <label htmlFor="game-code">Game PIN</label>
            <input
              id="game-code"
              name="gameCode"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value)}
              placeholder="ENTER GAME PIN"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
              maxLength={12}
              pattern="[A-Za-z0-9]+"
              title="Use letters and numbers only"
              disabled={isLoading}
            />
          </div>
        </div>

        {error && <div className="login-error" style={{ margin: '12px 0' }}>{error}</div>}

        <LiquidMetalButton
          type="submit"
          label={isLoading ? 'ENTERING ARENA...' : 'ENTER ARENA (₹1,000)'}
          disabled={isLoading}
        />
      </form>
    </div>
  );
}
