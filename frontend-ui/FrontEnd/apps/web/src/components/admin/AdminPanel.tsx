import { useState, useEffect, useRef } from 'react';
import { adminApi, ControlDeckData } from '../../api/admin';

type Section =
  | 'deck'
  | 'dashboard'
  | 'students'
  | 'questions'
  | 'games'
  | 'investments'
  | 'leaderboard'
  | 'audit'
  | 'settings';

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'deck', label: 'Market Desk', icon: '⚡' },
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'students', label: 'Students', icon: '🎓' },
  { id: 'questions', label: 'Question Bank', icon: '❓' },
  { id: 'games', label: 'Games', icon: '🎮' },
  { id: 'investments', label: 'Order Book & Logs', icon: '💼' },
  { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
  { id: 'audit', label: 'Audit Log', icon: '📜' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

const card: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '16px',
  padding: '16px',
  marginBottom: '14px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
};

const btnPrimary: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: '10px',
  background: '#000000',
  color: '#ffffff',
  border: 'none',
  cursor: 'pointer',
  fontWeight: '800',
  fontSize: '12px',
  letterSpacing: '0.04em',
  transition: 'all 0.15s ease',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
};

const btnGhost: React.CSSProperties = {
  ...btnPrimary,
  background: '#f3f4f6',
  color: '#111827',
  border: '1px solid #d1d5db',
};

const btnSuccess: React.CSSProperties = {
  ...btnPrimary,
  background: '#16a34a',
  color: '#ffffff',
};

const btnWarning: React.CSSProperties = {
  ...btnPrimary,
  background: '#d97706',
  color: '#ffffff',
};

const btnDanger: React.CSSProperties = {
  ...btnPrimary,
  background: '#dc2626',
  color: '#ffffff',
};

const inputStyle: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  fontSize: '13px',
  width: '100%',
  boxSizing: 'border-box',
  background: '#ffffff',
  color: '#111827',
};

function Err({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="login-error" style={{ margin: '10px 0', fontSize: '13px', padding: '10px 14px' }}>
      ⚠️ {msg}
    </div>
  );
}

function SuccessMsg({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div style={{
      background: 'rgba(22, 163, 74, 0.1)',
      border: '1px solid #16a34a',
      color: '#15803d',
      borderRadius: '8px',
      padding: '10px 14px',
      margin: '10px 0',
      fontSize: '13px',
      fontWeight: '700',
    }}>
      ✅ {msg}
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280', fontWeight: '800', fontSize: '14px' }}>
      <div style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: '8px' }}>🔄</div>
      {label}...
    </div>
  );
}

// ---------------- Confirm Modal ----------------

function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  isDanger = true,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px',
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '18px',
        padding: '24px',
        maxWidth: '420px',
        width: '100%',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        border: '1px solid #000000',
      }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '800' }}>{title}</h3>
        <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#4b5563', lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button type="button" style={btnGhost} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            style={isDanger ? btnDanger : btnPrimary}
            onClick={() => {
              onConfirm();
              onCancel();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- 1. MARKET DESK (Live Control Center) ----------------

function MarketDesk() {
  const [deck, setDeck] = useState<ControlDeckData | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [subTab, setSubTab] = useState<'questions' | 'investments' | 'participants'>('questions');
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
    isDanger: boolean;
  }>({ isOpen: false, title: '', message: '', action: () => {}, isDanger: true });

  const isMounted = useRef(true);

  const load = async (gameId?: string, silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const gid = gameId !== undefined ? gameId : selectedGameId;
      const data = await adminApi.controlDeck(gid || undefined);
      if (isMounted.current) {
        setDeck(data.deck);
        if (data.deck.game && !selectedGameId) {
          setSelectedGameId(data.deck.game.id);
        }
      }
    } catch (err: any) {
      if (isMounted.current && !silent) {
        setError(err?.message || 'Failed to load control deck.');
      }
    } finally {
      if (isMounted.current && !silent) setLoading(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    load(selectedGameId);

    // Safe live polling every 4 seconds when desk is open
    const timer = setInterval(() => {
      load(selectedGameId, true);
    }, 4000);

    return () => {
      isMounted.current = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGameId]);

  const runControl = async (op: string, label: string) => {
    if (!deck?.game?.id) return;
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      await adminApi.controlGame(deck.game.id, op);
      setSuccess(`${label} succeeded!`);
      await load(deck.game.id, true);
    } catch (err: any) {
      setError(err?.message || `Failed to execute ${label}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const askConfirm = (title: string, message: string, action: () => void, isDanger = true) => {
    setConfirmState({ isOpen: true, title, message, action, isDanger });
  };

  if (loading && !deck) return <Loading label="INITIALIZING LIVE CONTROL DECK" />;

  if (!deck || !deck.has_game || !deck.game) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontSize: '42px', marginBottom: '14px' }}>🎮</div>
        <h3 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '800' }}>No Active Game in Session</h3>
        <p style={{ margin: '0 0 20px', color: '#6b7280', fontSize: '14px', maxWidth: '420px', marginInline: 'auto' }}>
          Create a game from the Game Bank or select an existing draft game to operate the live control deck.
        </p>
        <Err msg={error} />
      </div>
    );
  }

  const g = deck.game;
  const q = deck.current_question;
  const status = g.status;
  const roundStatus = g.round_status;

  // Validation flags for operation buttons
  const isDraftOrWaiting = status === 'draft' || status === 'waiting';
  const isLive = status === 'live';
  const isPaused = status === 'paused';
  const isQuestionOpen = isLive && (roundStatus === 'question_open' || roundStatus === 'market_open');
  const isMarketClosed = isLive && roundStatus === 'market_closed';
  const isResult = isLive && roundStatus === 'result';
  const isSettled = isLive && roundStatus === 'settled';
  const hasMoreRounds = g.current_round_number < g.total_rounds;

  return (
    <div>
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        isDanger={confirmState.isDanger}
        onConfirm={confirmState.action}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Top Game Bar */}
      <div
        style={{
          ...card,
          background: 'linear-gradient(135deg, #000000 0%, #1f2937 100%)',
          color: '#ffffff',
          border: 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '16px 20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '0.1em', fontWeight: '800', color: '#9ca3af' }}>
              LIVE CONTROL DECK
            </div>
            <div style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '-0.02em' }}>
              {g.name}
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              borderRadius: '999px',
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: '800',
              letterSpacing: '0.06em',
            }}
          >
            PIN: <span style={{ color: '#60a5fa' }}>{g.game_pin}</span>
          </div>

          <div
            style={{
              background: isLive ? 'rgba(22, 163, 74, 0.25)' : 'rgba(234, 179, 8, 0.25)',
              border: isLive ? '1px solid #16a34a' : '1px solid #eab308',
              color: isLive ? '#4ade80' : '#fde047',
              borderRadius: '999px',
              padding: '4px 12px',
              fontSize: '11px',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isLive ? '#4ade80' : '#fde047',
                boxShadow: isLive ? '0 0 8px #4ade80' : 'none',
              }}
            />
            {status.toUpperCase()} ({roundStatus.toUpperCase().replace('_', ' ')})
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              borderRadius: '999px',
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: '800',
            }}
          >
            ROUND {String(g.current_round_number).padStart(2, '0')} / {String(g.total_rounds).padStart(2, '0')}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {deck.games_list.length > 1 && (
            <select
              style={{
                ...inputStyle,
                maxWidth: '180px',
                padding: '6px 10px',
                fontSize: '12px',
                background: '#111827',
                color: '#fff',
                borderColor: '#374151',
              }}
              value={selectedGameId}
              onChange={(e) => setSelectedGameId(e.target.value)}
            >
              {deck.games_list.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.game_pin})
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            style={{ ...btnGhost, padding: '6px 12px', fontSize: '11px', background: 'rgba(255,255,255,0.15)', color: '#fff', borderColor: '#4b5563' }}
            onClick={() => load(selectedGameId)}
            disabled={actionLoading}
          >
            🔄 Sync
          </button>
        </div>
      </div>

      <Err msg={error} />
      <SuccessMsg msg={success} />

      {/* 3-Column Command Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
          alignItems: 'start',
        }}
      >
        {/* LEFT COLUMN: Market Dispatch & Sentiment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Dispatch Controls */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '900', letterSpacing: '0.04em' }}>
                MARKET DISPATCH
              </h3>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  color: isQuestionOpen ? '#16a34a' : isMarketClosed ? '#d97706' : '#6b7280',
                }}
              >
                ● {roundStatus.toUpperCase().replace('_', ' ')}
              </span>
            </div>

            {/* Round & Timer summary */}
            <div
              style={{
                background: '#f9fafb',
                borderRadius: '12px',
                padding: '12px',
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                marginBottom: '16px',
                border: '1px solid #f3f4f6',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: '800' }}>ROUND NUMBER</div>
                <div style={{ fontSize: '20px', fontWeight: '900', color: '#000000' }}>
                  {String(g.current_round_number).padStart(2, '0')} / {String(g.total_rounds).padStart(2, '0')}
                </div>
              </div>
              <div style={{ width: '1px', height: '30px', background: '#e5e7eb' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: '800' }}>QUESTION DURATION</div>
                <div style={{ fontSize: '20px', fontWeight: '900', color: '#16a34a', fontFamily: 'monospace' }}>
                  {q ? `${q.duration_seconds}s` : `${g.default_question_duration}s`}
                </div>
              </div>
            </div>

            {/* Step-by-Step Action Button Stack */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {isDraftOrWaiting && (
                <button
                  type="button"
                  style={{ ...btnSuccess, width: '100%', padding: '12px' }}
                  onClick={() => runControl('start', 'Start Game')}
                  disabled={actionLoading || g.total_rounds === 0}
                >
                  ▶ START GAME (ROUND 1)
                </button>
              )}

              {isQuestionOpen && (
                <button
                  type="button"
                  style={{ ...btnDanger, width: '100%', padding: '12px' }}
                  onClick={() => runControl('close-market', 'Close Market')}
                  disabled={actionLoading}
                >
                  🔒 CLOSE MARKET (LOCK BIDS)
                </button>
              )}

              {isMarketClosed && (
                <button
                  type="button"
                  style={{ ...btnPrimary, width: '100%', padding: '12px', background: '#2563eb' }}
                  onClick={() => runControl('reveal', 'Reveal Answer')}
                  disabled={actionLoading}
                >
                  👁 REVEAL ANSWER
                </button>
              )}

              {isResult && (
                <button
                  type="button"
                  style={{ ...btnWarning, width: '100%', padding: '12px' }}
                  onClick={() => runControl('settle', 'Settle Round')}
                  disabled={actionLoading}
                >
                  ⚡ SETTLE ROUND & COMPUTE P/L
                </button>
              )}

              {isSettled && hasMoreRounds && (
                <button
                  type="button"
                  style={{ ...btnPrimary, width: '100%', padding: '12px', background: '#000000' }}
                  onClick={() => runControl('next', 'Next Question')}
                  disabled={actionLoading}
                >
                  ⏭ NEXT QUESTION →
                </button>
              )}

              {isSettled && !hasMoreRounds && (
                <button
                  type="button"
                  style={{ ...btnSuccess, width: '100%', padding: '12px' }}
                  onClick={() =>
                    askConfirm(
                      'End Championship Game?',
                      'This will finalize all player results and mark the game as completed.',
                      () => runControl('end', 'End Game')
                    )
                  }
                  disabled={actionLoading}
                >
                  🏁 FINAL ROUND SETTLED — COMPLETE GAME
                </button>
              )}

              {/* Pause / Resume Controls */}
              {isLive && !isPaused && (
                <button
                  type="button"
                  style={{ ...btnGhost, width: '100%' }}
                  onClick={() => runControl('pause', 'Pause Game')}
                  disabled={actionLoading}
                >
                  ⏸ Pause Game
                </button>
              )}

              {isPaused && (
                <button
                  type="button"
                  style={{ ...btnPrimary, width: '100%', background: '#16a34a' }}
                  onClick={() => runControl('resume', 'Resume Game')}
                  disabled={actionLoading}
                >
                  ▶ Resume Game
                </button>
              )}

              {/* End / Cancel Buttons */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                {status !== 'completed' && status !== 'cancelled' && (
                  <button
                    type="button"
                    style={{ ...btnGhost, flex: 1, fontSize: '11px', color: '#dc2626' }}
                    onClick={() =>
                      askConfirm(
                        'End Game Prematurely?',
                        'Are you sure you want to end this game now? All remaining rounds will be skipped.',
                        () => runControl('end', 'End Game')
                      )
                    }
                    disabled={actionLoading}
                  >
                    🛑 End Game
                  </button>
                )}
                <button
                  type="button"
                  style={{ ...btnGhost, flex: 1, fontSize: '11px', color: '#6b7280' }}
                  onClick={() =>
                    askConfirm(
                      'Cancel Game?',
                      'Are you sure you want to cancel this game? This cannot be undone.',
                      () => runControl('cancel', 'Cancel Game')
                    )
                  }
                  disabled={actionLoading}
                >
                  ✕ Cancel
                </button>
              </div>
            </div>
          </div>

          {/* Order Book / Market Sentiment */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '900', letterSpacing: '0.04em' }}>
                ORDER BOOK SENTIMENT
              </h3>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#2563eb' }}>
                {deck.participants?.submitted_count || 0} / {deck.participants?.total_joined || 0} SUBMITTED
              </span>
            </div>

            {deck.sentiment && deck.sentiment.total_submissions > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                  const pct = deck.sentiment?.percentages[opt] || 0;
                  const count = deck.sentiment?.counts[opt] || 0;
                  const cap = deck.sentiment?.capital_by_option[opt] || 0;
                  const isWinning = (roundStatus === 'result' || roundStatus === 'settled') && q?.correct_option === opt;

                  return (
                    <div key={opt}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '800', marginBottom: '4px' }}>
                        <span style={{ color: isWinning ? '#16a34a' : '#111827' }}>
                          Option {opt} {isWinning ? '✓ (Winning)' : ''}
                        </span>
                        <span style={{ color: '#4b5563' }}>
                          {count} orders ({pct}%) · ₹{cap.toLocaleString()}
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: '#f3f4f6', borderRadius: '999px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: isWinning ? '#16a34a' : opt === 'A' ? '#2563eb' : opt === 'B' ? '#7c3aed' : opt === 'C' ? '#d97706' : '#dc2626',
                            borderRadius: '999px',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}

                <div
                  style={{
                    marginTop: '8px',
                    paddingTop: '10px',
                    borderTop: '1px solid #f3f4f6',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#6b7280' }}>TOTAL CAPITAL AT RISK</span>
                  <span style={{ fontSize: '16px', fontWeight: '900', color: '#111827', fontFamily: 'monospace' }}>
                    ₹{Number(deck.sentiment.total_capital_at_risk || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 10px', color: '#9ca3af', fontSize: '13px', fontWeight: '700' }}>
                Waiting for student order submissions...
              </div>
            )}
          </div>
        </div>

        {/* CENTER COLUMN: Active Market Question & Sub-tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Active Question Box */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    background: '#000000',
                    color: '#ffffff',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '800',
                  }}
                >
                  {q?.category || 'Market Intelligence'}
                </span>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#6b7280' }}>
                  Round {g.current_round_number} of {g.total_rounds}
                </span>
              </div>

              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  color: isQuestionOpen ? '#16a34a' : '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                ● {isQuestionOpen ? 'LIVE ON STUDENTS SCREENS' : roundStatus.toUpperCase().replace('_', ' ')}
              </span>
            </div>

            {q ? (
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#000000', lineHeight: 1.4, margin: '0 0 16px' }}>
                  {q.question_text}
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', marginBottom: '14px' }}>
                  {(['a', 'b', 'c', 'd'] as const).map((key) => {
                    const optKey = key.toUpperCase();
                    const text = (q as any)[`option_${key}`];
                    const isCorrect = q.correct_option === optKey;
                    const isRevealed = roundStatus === 'result' || roundStatus === 'settled';

                    return (
                      <div
                        key={key}
                        style={{
                          border: isRevealed && isCorrect ? '2px solid #16a34a' : '1px solid #e5e7eb',
                          background: isRevealed && isCorrect ? 'rgba(22, 163, 74, 0.08)' : '#f9fafb',
                          borderRadius: '10px',
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <span
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            background: isRevealed && isCorrect ? '#16a34a' : '#111827',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '900',
                            fontSize: '12px',
                            flexShrink: 0,
                          }}
                        >
                          {optKey}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: isRevealed && isCorrect ? '800' : '600', color: '#111827' }}>
                          {text}
                        </span>
                        {isRevealed && isCorrect && (
                          <span style={{ marginLeft: 'auto', fontSize: '14px', color: '#16a34a', fontWeight: '900' }}>✓</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {(roundStatus === 'result' || roundStatus === 'settled') && q.explanation && (
                  <div
                    style={{
                      background: 'rgba(22, 163, 74, 0.06)',
                      border: '1px solid rgba(22, 163, 74, 0.2)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      fontSize: '12px',
                      color: '#15803d',
                      lineHeight: 1.5,
                    }}
                  >
                    <strong>💡 Market Analysis / Explanation:</strong> {q.explanation}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: '#6b7280', fontSize: '13px' }}>
                No active question loaded for this round.
              </div>
            )}
          </div>

          {/* Sub-panel (Question Bank / Live Investments / Participants) */}
          <div style={card}>
            <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid #f3f4f6', paddingBottom: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <button
                type="button"
                style={{ ...(subTab === 'questions' ? btnPrimary : btnGhost), padding: '6px 14px', fontSize: '11px', borderRadius: '999px' }}
                onClick={() => setSubTab('questions')}
              >
                ❓ Question Bank ({g.questions?.length || 0})
              </button>
              <button
                type="button"
                style={{ ...(subTab === 'investments' ? btnPrimary : btnGhost), padding: '6px 14px', fontSize: '11px', borderRadius: '999px' }}
                onClick={() => setSubTab('investments')}
              >
                💼 Live Investments ({deck.participants?.submitted_count || 0})
              </button>
              <button
                type="button"
                style={{ ...(subTab === 'participants' ? btnPrimary : btnGhost), padding: '6px 14px', fontSize: '11px', borderRadius: '999px' }}
                onClick={() => setSubTab('participants')}
              >
                👥 Participants ({deck.participants?.total_joined || 0})
              </button>
            </div>

            {/* TAB: Questions */}
            {subTab === 'questions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(g.questions || []).map((qItem: any, idx: number) => {
                  const isCurrent = idx + 1 === g.current_round_number;
                  return (
                    <div
                      key={qItem.id || idx}
                      style={{
                        border: isCurrent ? '1.5px solid #000000' : '1px solid #e5e7eb',
                        background: isCurrent ? '#f9fafb' : '#ffffff',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <div style={{ fontSize: '12px' }}>
                        <span style={{ fontWeight: '800', marginRight: '6px' }}>#{idx + 1}</span>
                        <span>Question ID: {String(qItem.question_id || qItem.id).slice(0, 8)}...</span>
                        {isCurrent && (
                          <span style={{ marginLeft: '8px', background: '#16a34a', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>
                            CURRENT LIVE
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '700' }}>
                        {qItem.duration_seconds || g.default_question_duration}s
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB: Live Investments */}
            {subTab === 'investments' && (
              <div>
                {deck.participants?.list?.filter((p) => p.submission)?.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {deck.participants.list
                      .filter((p) => p.submission)
                      .map((p) => (
                        <div
                          key={p.user_id}
                          style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: '10px',
                            padding: '8px 12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '12px',
                            flexWrap: 'wrap',
                            gap: '6px',
                          }}
                        >
                          <div>
                            <strong>{p.avatar} {p.name}</strong> · Option <span style={{ fontWeight: '900', color: '#2563eb' }}>{p.submission?.selected_option}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '10px', fontWeight: '700', color: '#4b5563' }}>
                            <span>Risk {p.submission?.risk_percent}%</span>
                            <span style={{ color: '#000000' }}>₹{Number(p.submission?.bid_amount || 0).toLocaleString()}</span>
                            <span style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                              {p.submission?.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: '12px' }}>
                    No orders submitted for this round yet.
                  </div>
                )}
              </div>
            )}

            {/* TAB: Participants */}
            {subTab === 'participants' && (
              <div>
                {deck.participants?.list?.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {deck.participants.list.map((p) => (
                      <div
                        key={p.user_id}
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: '10px',
                          padding: '8px 12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '12px',
                          flexWrap: 'wrap',
                          gap: '6px',
                        }}
                      >
                        <div>
                          <strong>{p.avatar} {p.name}</strong> ({p.email})
                        </div>
                        <div style={{ display: 'flex', gap: '12px', fontWeight: '700' }}>
                          <span>Cap: ₹{Number(p.current_capital).toLocaleString()}</span>
                          <span style={{ color: p.total_profit_loss >= 0 ? '#16a34a' : '#dc2626' }}>
                            {p.total_profit_loss >= 0 ? '+' : ''}₹{Number(p.total_profit_loss).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: '12px' }}>
                    No students have joined this game yet.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Movers & Audit Log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Settlement Movers */}
          <div style={card}>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '900', letterSpacing: '0.04em' }}>
              SETTLEMENT MOVERS
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {deck.movers?.biggest_gainer ? (
                <div style={{ background: 'rgba(22, 163, 74, 0.08)', borderRadius: '10px', padding: '10px 12px', border: '1px solid rgba(22,163,74,0.2)' }}>
                  <div style={{ fontSize: '10px', fontWeight: '900', color: '#15803d', letterSpacing: '0.05em' }}>
                    🚀 BIGGEST GAINER
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#111827' }}>
                      {deck.movers.biggest_gainer.player_name}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: '900', color: '#16a34a' }}>
                      +₹{Number(deck.movers.biggest_gainer.profit_loss || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : null}

              {deck.movers?.biggest_drawdown ? (
                <div style={{ background: 'rgba(220, 38, 38, 0.08)', borderRadius: '10px', padding: '10px 12px', border: '1px solid rgba(220,38,38,0.2)' }}>
                  <div style={{ fontSize: '10px', fontWeight: '900', color: '#b91c1c', letterSpacing: '0.05em' }}>
                    🔻 BIGGEST DRAWDOWN
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#111827' }}>
                      {deck.movers.biggest_drawdown.player_name}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: '900', color: '#dc2626' }}>
                      -₹{Math.abs(Number(deck.movers.biggest_drawdown.profit_loss || 0)).toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Leaderboard Top 3 Podium */}
              {deck.leaderboard?.length ? (
                <div style={{ marginTop: '4px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#6b7280', marginBottom: '6px' }}>
                    TOP STANDINGS
                  </div>
                  {deck.leaderboard.slice(0, 3).map((p: any, idx: number) => (
                    <div
                      key={p.user_id || idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        padding: '4px 0',
                        borderBottom: '1px solid #f3f4f6',
                        fontWeight: '700',
                      }}
                    >
                      <span>
                        #{idx + 1} {p.avatar} {p.name}
                      </span>
                      <span>₹{Number(p.capital).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px', color: '#9ca3af', fontSize: '12px' }}>
                  No settled rounds or rankings yet.
                </div>
              )}
            </div>
          </div>

          {/* Immutable Audit Log */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '900', letterSpacing: '0.04em' }}>
                IMMUTABLE AUDIT LOG
              </h3>
              <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: '800' }}>● LIVE FEED</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
              {deck.recent_actions?.length ? (
                deck.recent_actions.slice(0, 15).map((a: any, idx: number) => (
                  <div
                    key={a.id || idx}
                    style={{
                      fontSize: '11px',
                      padding: '6px 8px',
                      background: '#f9fafb',
                      borderRadius: '6px',
                      borderLeft: '3px solid #000000',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800' }}>
                      <span>{a.action}</span>
                      <span style={{ color: '#9ca3af', fontSize: '10px' }}>
                        {a.created_at ? new Date(a.created_at).toLocaleTimeString() : 'Now'}
                      </span>
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '10px' }}>
                      {a.entity_type} {a.entity_id ? `· ${String(a.entity_id).slice(0, 8)}` : ''}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: '12px' }}>
                  No actions logged yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- 2. Dashboard ----------------

function Dashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.overview();
      setMetrics(data.metrics);
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <Loading label="LOADING DASHBOARD" />;
  if (error) return <Err msg={error} />;
  if (!metrics) return null;

  const cards = [
    ['Total Students', metrics.total_students],
    ['Active Students', metrics.active_students],
    ['Disabled Students', metrics.disabled_students],
    ['Total Questions', metrics.total_questions],
    ['Active Questions', metrics.active_questions],
    ['Total Games', metrics.total_games],
    ['Active Games', metrics.active_games],
    ['Players In Active Game', metrics.players_in_active_game],
  ];

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '10px',
          marginBottom: '14px',
        }}
      >
        {cards.map(([label, value]) => (
          <div key={label as string} style={{ ...card, marginBottom: 0, textAlign: 'center', padding: '14px' }}>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#000000' }}>{value as number}</div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280' }}>{label as string}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        <h3 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: '800' }}>Active Competition Overview</h3>
        {metrics.current_game ? (
          <div style={{ fontSize: '13px', fontWeight: '700' }}>
            {metrics.current_game.name} ({metrics.current_game.game_pin}) —{' '}
            <span style={{ color: '#16a34a' }}>{metrics.current_game.status}</span>
            {metrics.current_round && (
              <span>
                {' '}· Round {metrics.current_round.round_number} ({metrics.current_round.status})
              </span>
            )}
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: '#6b7280' }}>No active game in progress.</div>
        )}
      </div>

      <button type="button" style={btnGhost} onClick={load}>
        🔄 Refresh Metrics
      </button>
    </div>
  );
}

// ---------------- 3. Students ----------------

function Students() {
  const [list, setList] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [addLoading, setAddLoading] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'participant' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = `?search=${encodeURIComponent(search)}&status=${status}`;
      const data = await adminApi.students(params);
      setList(data.students);
    } catch (err: any) {
      setError(err?.message || 'Failed to load students.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = async (id: string) => {
    try {
      const data = await adminApi.student(id);
      setDetail(data.student);
    } catch (err: any) {
      setError(err?.message || 'Failed to load profile.');
    }
  };

  const toggleStatus = async (id: string, cur: string) => {
    if (statusLoadingId) return;
    setStatusLoadingId(id);
    setError('');
    setSuccessMsg('');
    try {
      const newStatus = cur === 'active' ? 'disabled' : 'active';
      if (cur === 'active') await adminApi.disableStudent(id);
      else await adminApi.enableStudent(id);
      setList((prev) => prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s)));
      if (detail?.id === id) setDetail((prev: any) => (prev ? { ...prev, status: newStatus } : null));
      setSuccessMsg(`Student status updated to ${newStatus}.`);
    } catch (err: any) {
      setError(err?.message || 'Status change failed.');
    } finally {
      setStatusLoadingId(null);
    }
  };

  const addStudent = async () => {
    if (addLoading) return;
    setError('');
    setSuccessMsg('');
    if (!form.name.trim()) {
      setError('Student name is required.');
      return;
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      setError('A valid email address is required.');
      return;
    }
    if (!form.password || form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setAddLoading(true);
    try {
      const data: any = await adminApi.createStudent(form);
      const newStudent = data.student || {
        ...form,
        id: data.id || `temp-${Date.now()}`,
        status: 'active',
        games_played: 0,
        total_pl: 0,
        total_score: 0,
      };
      setList((prev) => [newStudent, ...prev]);
      setShowAdd(false);
      setForm({ name: '', email: '', password: '', role: 'participant' });
      setSuccessMsg('Student created successfully.');
    } catch (err: any) {
      setError(err?.message || 'Create failed.');
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <input
          style={{ ...inputStyle, maxWidth: '220px' }}
          placeholder="Search name/email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <select style={{ ...inputStyle, maxWidth: '150px' }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
          <option value="banned">Banned</option>
        </select>
        <button type="button" style={btnGhost} onClick={load}>
          Search
        </button>
        <button type="button" style={btnPrimary} onClick={() => setShowAdd(!showAdd)}>
          + Add Student
        </button>
      </div>
      <Err msg={error} />
      {successMsg && <div style={{ color: '#16a34a', fontWeight: '800', fontSize: '12px', marginBottom: '8px' }}>{successMsg}</div>}

      {showAdd && (
        <div style={card}>
          <h3 style={{ margin: '0 0 8px' }}>Add Student</h3>
          <div style={{ display: 'grid', gap: '8px', maxWidth: '340px' }}>
            <input style={inputStyle} placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input style={inputStyle} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input style={inputStyle} placeholder="Password (min 8)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <select style={inputStyle} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="participant">participant</option>
              <option value="admin">admin</option>
            </select>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" style={btnPrimary} disabled={addLoading} onClick={addStudent}>
                {addLoading ? 'Creating...' : 'Create Student'}
              </button>
              <button type="button" style={btnGhost} onClick={() => setShowAdd(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <Loading label="LOADING STUDENTS" />
      ) : list.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#6b7280', fontWeight: '700' }}>No students found.</div>
      ) : (
        list.map((s) => (
          <div key={s.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '13px' }}>
              <strong>{s.name}</strong> · {s.email} · {s.role} · <span style={{ color: s.status === 'active' ? '#16a34a' : '#dc2626' }}>{s.status}</span>
              <div style={{ color: '#6b7280', marginTop: '2px' }}>
                Games: {s.games_played} · P/L: ₹{Number(s.total_pl || 0).toLocaleString()} · Score: {s.total_score || 0}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" style={btnGhost} onClick={() => openDetail(s.id)}>
                View
              </button>
              <button
                type="button"
                style={btnGhost}
                disabled={statusLoadingId === s.id}
                onClick={() => toggleStatus(s.id, s.status)}
              >
                {statusLoadingId === s.id ? 'Updating...' : s.status === 'active' ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        ))
      )}

      {detail && (
        <div style={card}>
          <h3 style={{ margin: '0 0 8px' }}>Profile: {detail.name}</h3>
          <div style={{ fontSize: '13px', marginBottom: '8px' }}>
            {detail.email} · {detail.role} · {detail.status} · Games: {detail.games_played} · P/L: ₹{Number(detail.total_pl || 0).toLocaleString()}
          </div>
          <h4>Game History ({detail.history?.length || 0})</h4>
          {(detail.history || []).slice(0, 30).map((h: any, i: number) => (
            <div key={i} style={{ fontSize: '12px', padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
              [{h.game_pin}] R{h.round} {h.is_correct ? '✅' : '❌'} {h.selected_option} · Bid ₹{h.bid_amount} · {h.financial_change} · Cap ₹{h.capital_after}
            </div>
          ))}
          <div style={{ marginTop: '8px' }}>
            <button type="button" style={btnGhost} onClick={() => setDetail(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- 4. Questions ----------------

const EMPTY_Q = {
  question_text: '',
  option_a: '',
  option_b: '',
  option_c: '',
  option_d: '',
  correct_option: '',
  explanation: '',
  category: 'Market Intelligence',
  duration_seconds: 15,
  is_active: true,
};

function Questions() {
  const [list, setList] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ ...EMPTY_Q });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.questions();
      setList(data.questions);
    } catch (err: any) {
      setError(err?.message || 'Failed to load questions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (saving) return;
    setError('');
    setSuccessMsg('');

    // Client-side validation
    if (!form.question_text.trim()) {
      setError('Question text is required.');
      return;
    }
    if (!form.option_a.trim() || !form.option_b.trim() || !form.option_c.trim() || !form.option_d.trim()) {
      setError('All 4 options (A, B, C, D) are required.');
      return;
    }
    if (!form.correct_option) {
      setError('Please select the correct answer option.');
      return;
    }
    if (!form.category.trim()) {
      setError('Category is required.');
      return;
    }
    const dur = Number(form.duration_seconds);
    if (isNaN(dur) || dur < 5 || dur > 300) {
      setError('Duration must be between 5 and 300 seconds.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const res: any = await adminApi.updateQuestion(editing.id, form);
        const updated = res.question || { ...editing, ...form };
        setList((prev) => prev.map((q) => (q.id === editing.id ? updated : q)));
        setSuccessMsg('Question updated successfully.');
      } else {
        const res: any = await adminApi.createQuestion(form);
        const created = res.question || { ...form, id: res.id || `q-${Date.now()}` };
        setList((prev) => [created, ...prev]);
        setSuccessMsg('Question created successfully.');
      }
      setEditing(null);
      setForm({ ...EMPTY_Q });
    } catch (err: any) {
      setError(err?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const archive = async (id: string) => {
    if (mutatingId) return;
    setMutatingId(id);
    setError('');
    setSuccessMsg('');
    try {
      await adminApi.archiveQuestion(id);
      setList((prev) => prev.map((q) => (q.id === id ? { ...q, is_active: false } : q)));
      setSuccessMsg('Question archived successfully.');
    } catch (err: any) {
      setError(err?.message || 'Archive failed.');
    } finally {
      setMutatingId(null);
    }
  };

  const del = async (id: string) => {
    if (mutatingId) return;
    setMutatingId(id);
    setError('');
    setSuccessMsg('');
    try {
      await adminApi.deleteQuestion(id);
      setList((prev) => prev.filter((q) => q.id !== id));
      setSuccessMsg('Question deleted successfully.');
    } catch (err: any) {
      setError(err?.message || 'Delete failed.');
    } finally {
      setMutatingId(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <button
          type="button"
          style={btnPrimary}
          onClick={() => {
            setEditing(null);
            setForm({ ...EMPTY_Q });
            setError('');
            setSuccessMsg('');
          }}
        >
          + New Question
        </button>
        <button type="button" style={btnGhost} onClick={load}>
          🔄 Refresh
        </button>
      </div>
      <Err msg={error} />
      {successMsg && <div style={{ color: '#16a34a', fontWeight: '800', fontSize: '12px', marginBottom: '8px' }}>{successMsg}</div>}

      {(editing !== null || form.question_text || form.option_a) && (
        <div style={card}>
          <h3 style={{ margin: '0 0 8px' }}>{editing ? 'Edit Question' : 'Create Question'}</h3>
          <div style={{ display: 'grid', gap: '8px' }}>
            <textarea
              style={{ ...inputStyle, minHeight: '60px' }}
              placeholder="Question text (e.g. What is the capital of France?)"
              value={form.question_text}
              onChange={(e) => setForm({ ...form, question_text: e.target.value })}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
              <input style={inputStyle} placeholder="Option A" value={form.option_a} onChange={(e) => setForm({ ...form, option_a: e.target.value })} />
              <input style={inputStyle} placeholder="Option B" value={form.option_b} onChange={(e) => setForm({ ...form, option_b: e.target.value })} />
              <input style={inputStyle} placeholder="Option C" value={form.option_c} onChange={(e) => setForm({ ...form, option_c: e.target.value })} />
              <input style={inputStyle} placeholder="Option D" value={form.option_d} onChange={(e) => setForm({ ...form, option_d: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
              <select
                style={{ ...inputStyle, fontWeight: '700' }}
                value={form.correct_option}
                onChange={(e) => setForm({ ...form, correct_option: e.target.value })}
              >
                <option value="">-- Select Correct Answer --</option>
                <option value="Option A">Option A {form.option_a ? `(${form.option_a})` : ''}</option>
                <option value="Option B">Option B {form.option_b ? `(${form.option_b})` : ''}</option>
                <option value="Option C">Option C {form.option_c ? `(${form.option_c})` : ''}</option>
                <option value="Option D">Option D {form.option_d ? `(${form.option_d})` : ''}</option>
              </select>
              <input
                style={inputStyle}
                placeholder="Category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
              <input
                style={inputStyle}
                type="number"
                placeholder="Duration (sec)"
                value={form.duration_seconds}
                onChange={(e) => setForm({ ...form, duration_seconds: Number(e.target.value) })}
              />
            </div>
            <textarea
              style={{ ...inputStyle, minHeight: '50px' }}
              placeholder="Explanation (Optional)"
              value={form.explanation}
              onChange={(e) => setForm({ ...form, explanation: e.target.value })}
            />
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" style={btnPrimary} disabled={saving} onClick={save}>
                {saving ? (editing ? 'Saving...' : 'Creating...') : editing ? 'Update Question' : 'Save Question'}
              </button>
              <button
                type="button"
                style={btnGhost}
                onClick={() => {
                  setEditing(null);
                  setForm({ ...EMPTY_Q });
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <Loading label="LOADING QUESTIONS" />
      ) : list.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#6b7280', fontWeight: '700' }}>No questions in bank.</div>
      ) : (
        list.map((q) => (
          <div key={q.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '13px', maxWidth: '75%' }}>
              <strong>{q.question_text}</strong>
              <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '2px' }}>
                Correct: <strong style={{ color: '#16a34a' }}>{q.correct_option}</strong> · {q.category} · {q.duration_seconds}s · {q.is_active ? 'Active' : 'Archived'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                style={btnGhost}
                onClick={() => {
                  setEditing(q);
                  setForm({
                    question_text: q.question_text || '',
                    option_a: q.option_a || '',
                    option_b: q.option_b || '',
                    option_c: q.option_c || '',
                    option_d: q.option_d || '',
                    correct_option: q.correct_option || '',
                    explanation: q.explanation || '',
                    category: q.category || 'Market Intelligence',
                    duration_seconds: q.duration_seconds || 15,
                    is_active: q.is_active !== undefined ? q.is_active : true,
                  });
                }}
              >
                Edit
              </button>
              <button
                type="button"
                style={btnGhost}
                disabled={mutatingId === q.id}
                onClick={() => archive(q.id)}
              >
                {mutatingId === q.id ? 'Archiving...' : 'Archive'}
              </button>
              <button
                type="button"
                style={btnGhost}
                disabled={mutatingId === q.id}
                onClick={() => del(q.id)}
              >
                {mutatingId === q.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ---------------- 5. Games ----------------

function Games() {
  const [list, setList] = useState<any[]>([]);
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '',
    starting_capital: 10000,
    min_risk: 10,
    max_risk: 75,
    default_question_duration: 15,
    question_ids: [] as (string | number)[],
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [gData, qData] = await Promise.all([adminApi.games(), adminApi.questions()]);
      setList(gData.games);
      setAllQuestions(qData.questions.filter((q: any) => q.is_active));
    } catch (err: any) {
      setError(err?.message || 'Failed to load games.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createGame = async () => {
    if (creating) return;
    setError('');
    setSuccessMsg('');
    if (!form.name.trim()) {
      setError('Game name is required.');
      return;
    }
    if (form.starting_capital <= 0) {
      setError('Starting capital must be greater than zero.');
      return;
    }
    if (form.min_risk > form.max_risk) {
      setError('Min risk % cannot exceed Max risk %.');
      return;
    }
    setCreating(true);
    try {
      const res: any = await adminApi.createGame(form);
      const newGame = res.game || {
        ...form,
        id: res.id || `g-${Date.now()}`,
        game_pin: res.game_pin || 'TESTPIN',
        status: 'draft',
        rounds: form.question_ids.length,
        players: 0,
      };
      setList((prev) => [newGame, ...prev]);
      setShowAdd(false);
      setForm({
        name: '',
        starting_capital: 10000,
        min_risk: 10,
        max_risk: 75,
        default_question_duration: 15,
        question_ids: [],
      });
      setSuccessMsg('Game created successfully.');
    } catch (err: any) {
      setError(err?.message || 'Create game failed.');
    } finally {
      setCreating(false);
    }
  };

  const handleStartGame = async (gameId: string) => {
    if (startingId) return;
    setStartingId(gameId);
    setError('');
    setSuccessMsg('');
    try {
      await adminApi.controlGame(gameId, 'start');
      setList((prev) => prev.map((g) => (g.id === gameId ? { ...g, status: 'live' } : g)));
      setSuccessMsg('Game started successfully!');
    } catch (err: any) {
      setError(err?.message || 'Failed to start game.');
    } finally {
      setStartingId(null);
    }
  };

  const toggleQuestionSelection = (qid: string | number) => {
    setForm((prev) => {
      const exists = prev.question_ids.includes(qid);
      return {
        ...prev,
        question_ids: exists ? prev.question_ids.filter((id) => id !== qid) : [...prev.question_ids, qid],
      };
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <button
          type="button"
          style={btnPrimary}
          onClick={() => {
            setShowAdd(!showAdd);
            setError('');
            setSuccessMsg('');
          }}
        >
          + Create Game
        </button>
        <button type="button" style={btnGhost} onClick={load}>
          🔄 Refresh
        </button>
      </div>
      <Err msg={error} />
      {successMsg && <div style={{ color: '#16a34a', fontWeight: '800', fontSize: '12px', marginBottom: '8px' }}>{successMsg}</div>}

      {showAdd && (
        <div style={card}>
          <h3 style={{ margin: '0 0 8px' }}>Create New Game</h3>
          <div style={{ display: 'grid', gap: '8px', maxWidth: '420px', marginBottom: '12px' }}>
            <input style={inputStyle} placeholder="Game Name (e.g. Master Championship)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700' }}>Starting Capital (₹)</label>
                <input style={inputStyle} type="number" value={form.starting_capital} onChange={(e) => setForm({ ...form, starting_capital: Number(e.target.value) })} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700' }}>Duration (sec)</label>
                <input style={inputStyle} type="number" value={form.default_question_duration} onChange={(e) => setForm({ ...form, default_question_duration: Number(e.target.value) })} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700' }}>Min Risk %</label>
                <input style={inputStyle} type="number" value={form.min_risk} onChange={(e) => setForm({ ...form, min_risk: Number(e.target.value) })} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700' }}>Max Risk %</label>
                <input style={inputStyle} type="number" value={form.max_risk} onChange={(e) => setForm({ ...form, max_risk: Number(e.target.value) })} />
              </div>
            </div>
          </div>

          <h4>Assign Questions ({form.question_ids.length} selected)</h4>
          <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', marginBottom: '12px' }}>
            {allQuestions.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#9ca3af', padding: '8px' }}>No active questions available. Create questions first.</div>
            ) : (
              allQuestions.map((q) => {
                const selected = form.question_ids.includes(q.id);
                return (
                  <div
                    key={q.id}
                    onClick={() => toggleQuestionSelection(q.id)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      background: selected ? 'rgba(0,0,0,0.06)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span>{selected ? '☑' : '☐'}</span>
                    <span>{q.question_text}</span>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" style={btnPrimary} disabled={creating} onClick={createGame}>
              {creating ? 'Creating...' : 'Create Game'}
            </button>
            <button type="button" style={btnGhost} onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <Loading label="LOADING GAMES" />
      ) : list.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#6b7280', fontWeight: '700' }}>No games created yet.</div>
      ) : (
        list.map((g) => {
          const questionCount = g.rounds || (g.questions?.length) || 0;
          const isDraft = g.status === 'draft';
          const canStart = isDraft && questionCount > 0;

          return (
            <div key={g.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '13px' }}>
                <strong>{g.name}</strong> · PIN: <strong style={{ color: '#2563eb' }}>{g.game_pin}</strong> · Status: <span style={{ color: g.status === 'live' ? '#16a34a' : '#000', fontWeight: '700' }}>{g.status.toUpperCase()}</span>
                {isDraft && questionCount === 0 && (
                  <span style={{ marginLeft: '8px', background: '#fef2f2', color: '#dc2626', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                    0 questions assigned
                  </span>
                )}
                <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '2px' }}>
                  Questions: {questionCount} · Players: {g.players || 0} · Cap: ₹{Number(g.starting_capital).toLocaleString()} · Risk: {g.min_risk}%-{g.max_risk}%
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {isDraft && (
                  canStart ? (
                    <button
                      type="button"
                      style={btnSuccess}
                      disabled={startingId === g.id}
                      onClick={() => handleStartGame(g.id)}
                    >
                      {startingId === g.id ? 'Starting...' : 'Start Game'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      style={{ ...btnGhost, opacity: 0.5, cursor: 'not-allowed' }}
                      disabled
                      title="Assign questions before starting"
                    >
                      Assign Questions First
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ---------------- 6. Investments / History ----------------

function GamePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [games, setGames] = useState<any[]>([]);
  useEffect(() => {
    adminApi
      .games()
      .then((d) => {
        setGames(d.games);
        if (d.games.length && !value) onChange(d.games[0].id);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <select style={{ ...inputStyle, maxWidth: '280px', marginBottom: '12px' }} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select game</option>
      {games.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name} ({g.game_pin}) — {g.status}
        </option>
      ))}
    </select>
  );
}

function Investments() {
  const [gameId, setGameId] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!gameId) return;
    adminApi
      .gameTrades(gameId)
      .then((d) => setRows(d.trades))
      .catch((err: any) => setError(err?.message || 'Failed.'));
  }, [gameId]);

  return (
    <div>
      <GamePicker value={gameId} onChange={setGameId} />
      <Err msg={error} />
      {rows.slice(0, 200).map((t: any, i: number) => (
        <div key={i} style={{ ...card, padding: '10px 14px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <strong>R{t.round_number}</strong> · <strong>{t.player_name}</strong> · {t.is_correct ? '✅ Won' : '❌ Lost'} · Option {t.selected_option}
            <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>{t.question_text}</div>
          </div>
          <div style={{ fontWeight: '700', textAlign: 'right' }}>
            <div>Bid: ₹{Number(t.bid_amount).toLocaleString()} ({t.risk_percent}%)</div>
            <div style={{ color: Number(t.profit_loss) >= 0 ? '#16a34a' : '#dc2626' }}>{t.financial_change}</div>
          </div>
        </div>
      ))}
      {gameId && rows.length === 0 && <div style={{ ...card, textAlign: 'center', color: '#6b7280' }}>No trades recorded yet.</div>}
    </div>
  );
}

// ---------------- 7. Leaderboard ----------------

function Board() {
  const [gameId, setGameId] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!gameId) return;
    adminApi
      .gameLeaderboard(gameId)
      .then((d) => setRows(d.leaderboard))
      .catch((err: any) => setError(err?.message || 'Failed.'));
  }, [gameId]);

  return (
    <div>
      <GamePicker value={gameId} onChange={setGameId} />
      <Err msg={error} />
      {rows.map((p: any) => (
        <div key={p.user_id || p.name} style={{ ...card, display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700' }}>
          <span>
            #{p.rank} {p.avatar} {p.name}
          </span>
          <span>
            ₹{Number(p.capital).toLocaleString()} ({Number(p.profit_loss) >= 0 ? '+' : ''}₹{Number(p.profit_loss).toLocaleString()})
          </span>
        </div>
      ))}
      {gameId && rows.length === 0 && <div style={{ ...card, textAlign: 'center', color: '#6b7280' }}>Leaderboard is empty.</div>}
    </div>
  );
}

// ---------------- 8. Audit Log ----------------

function AuditLog() {
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .actions(100)
      .then((d) => setActions(d.actions))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading label="LOADING AUDIT LOG" />;

  return (
    <div>
      {actions.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#6b7280' }}>No audit logs recorded yet.</div>
      ) : (
        actions.map((a: any, i: number) => (
          <div key={i} style={{ ...card, padding: '10px 14px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{a.action}</strong> · {a.entity_type} {a.entity_id ? `· ${String(a.entity_id).slice(0, 8)}` : ''}
            </div>
            <span style={{ color: '#9ca3af', fontSize: '11px' }}>{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</span>
          </div>
        ))
      )}
    </div>
  );
}

// ---------------- 9. Settings ----------------

function Settings() {
  const [settings, setSettings] = useState<any>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi
      .settings()
      .then((d) => setSettings(d.settings))
      .catch((err: any) => setError(err?.message || 'Failed.'));
  }, []);

  const save = async () => {
    if (saving) return;
    setError('');
    setMsg('');
    setSaving(true);
    try {
      const data = await adminApi.updateSettings(settings);
      setSettings(data.settings);
      setMsg('Settings saved successfully.');
    } catch (err: any) {
      setError(err?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <Loading label="LOADING SETTINGS" />;
  return (
    <div style={{ ...card, maxWidth: '420px' }}>
      <h3 style={{ margin: '0 0 8px' }}>Default Game Settings</h3>
      <Err msg={error} />
      {msg && <div style={{ color: '#16a34a', fontWeight: '800', fontSize: '13px', marginBottom: '8px' }}>{msg}</div>}
      {Object.keys(settings)
        .filter((k) => k.startsWith('default_'))
        .map((k) => (
          <div key={k} style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: '700' }}>{k}</label>
            <input style={inputStyle} type="number" value={settings[k]} onChange={(e) => setSettings({ ...settings, [k]: Number(e.target.value) })} />
          </div>
        ))}
      <button type="button" style={btnPrimary} disabled={saving} onClick={save}>
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}

// ---------------- Shell ----------------

export function AdminPanel() {
  const [section, setSection] = useState<Section>('deck');

  return (
    <div className="profile-container">
      <div className="profile-card" style={{ maxWidth: '1180px', width: '100%', padding: '24px' }}>
        <div className="profile-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="profile-avatar" style={{ fontSize: '24px', background: '#000000', color: '#fff' }}>
              🛡️
            </div>
            <div>
              <h2 className="profile-heading" style={{ fontSize: '20px' }}>
                Admin Control Deck
              </h2>
              <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '800', letterSpacing: '0.04em' }}>
                MARKET MASTER OPERATIONS COMMAND
              </span>
            </div>
          </div>
        </div>

        {/* Section Navigation Pills */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            marginBottom: '18px',
            paddingBottom: '12px',
            borderBottom: '1px solid #f3f4f6',
          }}
        >
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              style={{
                ...(section === s.id ? btnPrimary : btnGhost),
                borderRadius: '999px',
                padding: '8px 14px',
                fontSize: '12px',
              }}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {/* Dynamic Section Render */}
        {section === 'deck' && <MarketDesk />}
        {section === 'dashboard' && <Dashboard />}
        {section === 'students' && <Students />}
        {section === 'questions' && <Questions />}
        {section === 'games' && <Games />}
        {section === 'investments' && <Investments />}
        {section === 'leaderboard' && <Board />}
        {section === 'audit' && <AuditLog />}
        {section === 'settings' && <Settings />}
      </div>
    </div>
  );
}

export default AdminPanel;
