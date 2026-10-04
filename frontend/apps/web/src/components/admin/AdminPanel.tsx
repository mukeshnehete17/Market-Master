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

function MarketDesk({
  selectedGameId,
  onSelectGame,
}: {
  selectedGameId: string;
  onSelectGame: (id: string) => void;
}) {
  const [deck, setDeck] = useState<ControlDeckData | null>(null);
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
  const activeReqId = useRef(0);
  const abortCtrlRef = useRef<AbortController | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const load = async (targetGameId: string, silent = false) => {
    // 1. Abort any previous in-flight request
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
    }
    const ctrl = new AbortController();
    abortCtrlRef.current = ctrl;

    const reqId = ++activeReqId.current;

    if (!silent) {
      setLoading(true);
      setError('');
    }

    try {
      const data = await adminApi.controlDeck(targetGameId || undefined, ctrl.signal);

      // Protect against race conditions: ignore if request was superseded or unmounted
      if (!isMounted.current || reqId !== activeReqId.current || ctrl.signal.aborted) {
        return;
      }

      setDeck(data.deck);

      // Authoritative synchronization without flapping:
      // If no game was initially selected (targetGameId is empty) and backend chose an active game,
      // synchronize the parent selection once. NEVER overwrite when targetGameId was already explicit.
      if (!targetGameId && data.deck?.game?.id) {
        onSelectGame(data.deck.game.id);
      }
    } catch (err: any) {
      if (!isMounted.current || reqId !== activeReqId.current || ctrl.signal.aborted || err?.name === 'AbortError') {
        return;
      }
      if (!silent) {
        setError(err?.message || 'Failed to load control deck.');
      }
    } finally {
      if (isMounted.current && reqId === activeReqId.current) {
        if (!silent) setLoading(false);
        // Controlled recursive polling: schedule next poll ONLY after this request finishes
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        pollTimerRef.current = setTimeout(() => {
          if (isMounted.current) {
            void load(targetGameId, true);
          }
        }, 3000);
      }
    }
  };

  useEffect(() => {
    isMounted.current = true;
    // Clear old game data immediately upon game switch so user doesn't see stale Game A data
    setDeck(null);
    setLoading(true);
    setError('');
    void load(selectedGameId);

    return () => {
      isMounted.current = false;
      if (abortCtrlRef.current) abortCtrlRef.current.abort();
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGameId]);

  const runControl = async (op: string, label: string) => {
    if (!deck?.game?.id || actionLoading) return;
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

  if (error && !deck) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontSize: '36px', marginBottom: '14px' }}>⚠️</div>
        <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '800' }}>Failed to Load Control Deck</h3>
        <p style={{ margin: '0 0 20px', color: '#dc2626', fontSize: '14px', maxWidth: '440px', marginInline: 'auto' }}>
          {error}
        </p>
        <button
          type="button"
          style={btnPrimary}
          onClick={() => { void load(selectedGameId); }}
        >
          🔄 Retry Loading Game
        </button>
      </div>
    );
  }

  if (!deck || !deck.has_game || !deck.game) {
    const liveAvailable = deck?.games_list?.find((item) => item.status === 'live' || item.status === 'paused');
    return (
      <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontSize: '42px', marginBottom: '14px' }}>🎮</div>
        <h3 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '800' }}>No Game Currently Selected</h3>
        <p style={{ margin: '0 0 20px', color: '#6b7280', fontSize: '14px', maxWidth: '440px', marginInline: 'auto' }}>
          Select an active competition below or create a new game in the Games section to launch the live market desk.
        </p>

        {liveAvailable && (
          <div style={{ marginBottom: '20px' }}>
            <button
              type="button"
              style={{ ...btnPrimary, background: '#16a34a', padding: '10px 22px', fontSize: '13px', boxShadow: '0 4px 12px rgba(22,163,74,0.3)' }}
              onClick={() => {
                onSelectGame(liveAvailable.id);
              }}
            >
              🔥 Switch to Live Game: {liveAvailable.name} (PIN: {liveAvailable.game_pin})
            </button>
          </div>
        )}

        {deck?.games_list && deck.games_list.length > 0 && (
          <div style={{ maxWidth: '360px', margin: '0 auto 16px' }}>
            <select
              style={{ ...inputStyle, textAlign: 'center' }}
              value={selectedGameId}
              onChange={(e) => {
                onSelectGame(e.target.value);
              }}
            >
              <option value="">-- Choose Existing Game --</option>
              {deck.games_list.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.game_pin}) — {item.status.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        )}

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

  // Active live game notice if admin is inspecting another game while a live game is active
  const liveGameNotice = deck.games_list?.find((item) => (item.status === 'live' || item.status === 'paused') && item.id !== g.id);

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

      {liveGameNotice && (
        <div
          style={{
            background: 'linear-gradient(90deg, #1e3a8a 0%, #2563eb 100%)',
            color: '#ffffff',
            padding: '12px 18px',
            borderRadius: '14px',
            marginBottom: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
          }}
        >
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', opacity: 0.85 }}>
              ⚡ LIVE COMPETITION RUNNING
            </span>
            <div style={{ fontSize: '15px', fontWeight: '900' }}>
              {liveGameNotice.name} · PIN: <span style={{ color: '#93c5fd' }}>{liveGameNotice.game_pin}</span>
            </div>
          </div>
          <button
            type="button"
            style={{
              ...btnPrimary,
              background: '#ffffff',
              color: '#1e3a8a',
              border: 'none',
              padding: '8px 16px',
              fontSize: '12px',
              fontWeight: '900',
            }}
            onClick={() => {
              onSelectGame(liveGameNotice.id);
              load(liveGameNotice.id);
            }}
          >
            👉 Switch to Live Game
          </button>
        </div>
      )}

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
            {g.total_rounds === 0
              ? 'NO QUESTIONS ASSIGNED'
              : `ROUND ${String(g.current_round_number).padStart(2, '0')} / ${String(g.total_rounds).padStart(2, '0')}`}
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
              onChange={(e) => {
                onSelectGame(e.target.value);
              }}
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
            onClick={async () => {
              await load(selectedGameId);
              setSuccess('Sync complete — fresh state loaded.');
            }}
            disabled={actionLoading || loading}
          >
            {loading ? '⏳ Syncing...' : '🔄 Sync'}
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
                  {g.total_rounds === 0
                    ? '0 of 0'
                    : `${String(g.current_round_number).padStart(2, '0')} / ${String(g.total_rounds).padStart(2, '0')}`}
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
                  style={{
                    ...(g.total_rounds === 0 ? btnGhost : btnSuccess),
                    width: '100%',
                    padding: '12px',
                    opacity: g.total_rounds === 0 ? 0.6 : 1,
                    cursor: g.total_rounds === 0 ? 'not-allowed' : 'pointer',
                  }}
                  onClick={() => runControl('start', 'Start Game & Publish Question 1')}
                  disabled={actionLoading || g.total_rounds === 0}
                  title={g.total_rounds === 0 ? 'Assign at least one question to start.' : 'Start Round 1'}
                >
                  {g.total_rounds === 0 ? '⚠️ ASSIGN AT LEAST 1 QUESTION TO START' : '📢 PUBLISH QUESTION 1 (SEND TO STUDENTS)'}
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
                  onClick={() => runControl('settle', 'Settle Round & Compute P/L')}
                  disabled={actionLoading}
                >
                  ⚡ SETTLE ROUND & COMPUTE P/L
                </button>
              )}

              {isSettled && hasMoreRounds && (
                <button
                  type="button"
                  style={{ ...btnPrimary, width: '100%', padding: '12px', background: '#000000' }}
                  onClick={() => runControl('next', `Publish Question ${g.current_round_number + 1}`)}
                  disabled={actionLoading}
                >
                  📢 PUBLISH QUESTION {g.current_round_number + 1} → (DISPATCH TO STUDENTS)
                </button>
              )}

              {isSettled && !hasMoreRounds && (
                <button
                  type="button"
                  style={{ ...btnSuccess, width: '100%', padding: '12px' }}
                  onClick={() =>
                    askConfirm(
                      'End Championship Competition?',
                      'All rounds have settled. This will finalize student standings and mark the competition as completed.',
                      () => runControl('end', 'Complete Competition')
                    )
                  }
                  disabled={actionLoading}
                >
                  🏁 FINAL ROUND SETTLED — COMPLETE COMPETITION
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
                  const optText = opt === 'A' ? q?.option_a : opt === 'B' ? q?.option_b : opt === 'C' ? q?.option_c : q?.option_d;
                  const isWinning = (roundStatus === 'result' || roundStatus === 'settled') && (
                    q?.correct_option === opt ||
                    q?.correct_option === `Option ${opt}` ||
                    (optText && q?.correct_option?.toLowerCase() === optText.toLowerCase())
                  );

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
                    const isCorrect = (
                      q.correct_option === optKey ||
                      q.correct_option === `Option ${optKey}` ||
                      (text && q.correct_option?.toLowerCase() === text.toLowerCase())
                    );
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
                ❓ Assigned Questions ({g.questions?.length || 0})
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
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#6b7280', marginBottom: '8px' }}>
                    TOP STANDINGS & BADGES
                  </div>
                  {deck.leaderboard.slice(0, 5).map((p: any, idx: number) => {
                    const rankNum = p.rank || idx + 1;
                    const medal = rankNum === 1 ? '🥇' : rankNum === 2 ? '🥈' : rankNum === 3 ? '🥉' : `#${rankNum}`;
                    return (
                      <div
                        key={p.user_id || idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '12px',
                          padding: '6px 0',
                          borderBottom: '1px solid #f3f4f6',
                          fontWeight: '700',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                          <span style={{ fontSize: '13px', width: '22px' }}>{medal}</span>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                            {p.avatar} {p.name}
                          </span>
                          {p.badge && (
                            <span style={{ fontSize: '10px', background: '#f3f4f6', padding: '1px 6px', borderRadius: '4px', color: '#374151', fontWeight: '800' }}>
                              {p.badge}
                            </span>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: '800' }}>₹{Number(p.capital).toLocaleString()}</span>
                          {p.return_pct !== undefined && (
                            <span style={{ marginLeft: '6px', fontSize: '11px', fontWeight: '800', color: p.return_pct >= 0 ? '#16a34a' : '#dc2626' }}>
                              {p.return_pct >= 0 ? '+' : ''}{p.return_pct}%
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
  const [loading, setLoading] = useState(false);

  const load = async (silent = false) => {
    if (!silent && !metrics) setLoading(true);
    setError('');
    try {
      const data = await adminApi.overview();
      setMetrics(data.metrics);
    } catch (err: any) {
      if (!silent) setError(err?.message || 'Failed to load dashboard.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading && !metrics) return <Loading label="LOADING DASHBOARD" />;
  if (error && !metrics) return <Err msg={error} />;
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

      <button type="button" style={btnGhost} onClick={() => load()}>
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

  const isMounted = useRef(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = `?search=${encodeURIComponent(search)}&status=${status}`;
      const data = await adminApi.students(params);
      if (isMounted.current) {
        setList(data.students || []);
      }
    } catch (err: any) {
      if (isMounted.current) {
        setError(err?.message || 'Failed to load students.');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    isMounted.current = true;
    load();
    return () => {
      isMounted.current = false;
    };
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
      setSuccessMsg(`Student status updated to ${newStatus}.`);
      await load();
      if (detail?.id === id) setDetail((prev: any) => (prev ? { ...prev, status: newStatus } : null));
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
      if (!data.student && !data.id) {
        throw new Error(data.message || 'Student creation failed on server.');
      }
      setShowAdd(false);
      setForm({ name: '', email: '', password: '', role: 'participant' });
      setSuccessMsg('Student created successfully.');
      await load();
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
  const [showAdd, setShowAdd] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ ...EMPTY_Q });
  const isMounted = useRef(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.questions();
      if (isMounted.current) {
        setList(data.questions || []);
      }
    } catch (err: any) {
      if (isMounted.current) {
        setError(err?.message || 'Failed to load questions.');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    isMounted.current = true;
    load();
    return () => {
      isMounted.current = false;
    };
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
        await adminApi.updateQuestion(editing.id, form);
        setSuccessMsg('Question updated successfully.');
      } else {
        await adminApi.createQuestion(form);
        setSuccessMsg('Question created successfully.');
      }
      setShowAdd(false);
      setEditing(null);
      setForm({ ...EMPTY_Q });
      await load();
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
      setSuccessMsg('Question archived successfully.');
      await load();
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
      setSuccessMsg('Question deleted successfully.');
      await load();
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
            setShowAdd(true);
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

      {(showAdd || editing !== null) && (
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
                {saving ? (editing ? 'Saving...' : 'Creating...') : editing ? 'Update Question' : 'Create Question'}
              </button>
              <button
                type="button"
                style={btnGhost}
                onClick={() => {
                  setShowAdd(false);
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
        <div style={{ ...card, textAlign: 'center', color: '#6b7280', fontWeight: '700' }}>No questions available.</div>
      ) : (
        list.map((q, idx) => (
          <div key={q.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '13px', maxWidth: '75%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ background: '#000000', color: '#ffffff', borderRadius: '4px', padding: '2px 7px', fontSize: '11px', fontWeight: '800' }}>
                  #{idx + 1}
                </span>
                <strong>{q.question_text}</strong>
              </div>
              <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '2px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                <span>Category: <strong>{q.category}</strong></span>
                <span>·</span>
                <span>Correct: <strong style={{ color: '#16a34a' }}>{q.correct_option}</strong></span>
                <span>·</span>
                <span style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: '4px', fontWeight: '800', color: '#111827' }}>
                  {q.duration_seconds || 15} SEC
                </span>
                <span>·</span>
                <span style={{ color: q.is_active ? '#16a34a' : '#6b7280', fontWeight: '700' }}>
                  {q.is_active ? 'Active' : 'Archived'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                style={btnGhost}
                onClick={() => {
                  setEditing(q);
                  setShowAdd(true);
                  const cOpt = (q.correct_option || '').trim();
                  let resolvedSelect = cOpt;
                  if (cOpt === 'A' || cOpt === 'Option A' || (q.option_a && cOpt.toLowerCase() === q.option_a.toLowerCase())) resolvedSelect = 'Option A';
                  else if (cOpt === 'B' || cOpt === 'Option B' || (q.option_b && cOpt.toLowerCase() === q.option_b.toLowerCase())) resolvedSelect = 'Option B';
                  else if (cOpt === 'C' || cOpt === 'Option C' || (q.option_c && cOpt.toLowerCase() === q.option_c.toLowerCase())) resolvedSelect = 'Option C';
                  else if (cOpt === 'D' || cOpt === 'Option D' || (q.option_d && cOpt.toLowerCase() === q.option_d.toLowerCase())) resolvedSelect = 'Option D';

                  setForm({
                    question_text: q.question_text || '',
                    option_a: q.option_a || '',
                    option_b: q.option_b || '',
                    option_c: q.option_c || '',
                    option_d: q.option_d || '',
                    correct_option: resolvedSelect,
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

function Games({
  onOpenDeck,
  selectedGameId,
  onSelectGame,
}: {
  onOpenDeck?: (gameId: string) => void;
  selectedGameId?: string;
  onSelectGame?: (id: string) => void;
}) {
  const [list, setList] = useState<any[]>([]);
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [createdGame, setCreatedGame] = useState<any | null>(null);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
    isDanger: boolean;
  }>({ isOpen: false, title: '', message: '', action: () => {}, isDanger: true });
  const [form, setForm] = useState({
    name: '',
    starting_capital: 10000,
    min_risk: 10,
    max_risk: 75,
    default_question_duration: 15,
    question_ids: [] as (string | number)[],
  });

  const isMounted = useRef(true);

  const load = async (silent = false) => {
    if (!silent && list.length === 0) setLoading(true);
    setError('');
    try {
      const [gData, qData] = await Promise.all([adminApi.games(), adminApi.questions()]);
      if (isMounted.current) {
        setList(gData.games || []);
        setAllQuestions((qData.questions || []).filter((q: any) => q.is_active));
      }
    } catch (err: any) {
      if (isMounted.current && !silent) setError(err?.message || 'Failed to load games.');
    } finally {
      if (isMounted.current && !silent) setLoading(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    load();
    return () => {
      isMounted.current = false;
    };
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
      if (!res.game || !res.game.id) {
        throw new Error(res.message || 'Game creation failed on server.');
      }
      const newGame = {
        ...res.game,
        rounds: res.game.questions ? res.game.questions.length : form.question_ids.length,
        players: 0,
      };
      setList((prev) => [newGame, ...prev]);
      setShowAdd(false);
      setCreatedGame(newGame);
      setSuccessMsg(`Game "${newGame.name}" created successfully (PIN: ${newGame.game_pin})!`);
      setForm({
        name: '',
        starting_capital: 10000,
        min_risk: 10,
        max_risk: 75,
        default_question_duration: 15,
        question_ids: [],
      });
      // Synchronize selection and immediately switch to Market Desk (Phase 5 & Final Acceptance Rule)
      onSelectGame?.(newGame.id);
      onOpenDeck?.(newGame.id);
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
      onSelectGame?.(gameId);
      onOpenDeck?.(gameId);
    } catch (err: any) {
      setError(err?.message || 'Failed to start game.');
    } finally {
      setStartingId(null);
    }
  };

  const handleDeleteGame = async (gameId: string, gameName: string) => {
    if (deletingId) return;
    setDeletingId(gameId);
    setError('');
    setSuccessMsg('');
    try {
      await adminApi.deleteGame(gameId);
      const remaining = list.filter((g) => g.id !== gameId);
      setList(remaining);
      setSuccessMsg(`Game "${gameName}" deleted successfully.`);

      // If the deleted game was selected, update or clear selection (Phase 10)
      if (gameId === selectedGameId) {
        const nextGameId = remaining.length > 0 ? remaining[0].id : '';
        onSelectGame?.(nextGameId);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to delete game.');
    } finally {
      setDeletingId(null);
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
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        isDanger={confirmState.isDanger}
        onConfirm={confirmState.action}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />

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
        <button type="button" style={btnGhost} onClick={() => load()}>
          🔄 Refresh
        </button>
      </div>
      <Err msg={error} />
      {successMsg && <div style={{ color: '#16a34a', fontWeight: '800', fontSize: '12px', marginBottom: '8px' }}>{successMsg}</div>}

      {createdGame && (
        <div
          style={{
            background: 'rgba(22, 163, 74, 0.08)',
            border: '1px solid #16a34a',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#15803d', letterSpacing: '0.04em' }}>
              ✅ COMPETITION CREATED
            </span>
            <div style={{ fontSize: '14px', fontWeight: '900', color: '#111827' }}>
              {createdGame.name} · PIN: <strong style={{ color: '#2563eb' }}>{createdGame.game_pin}</strong>
            </div>
            <div style={{ fontSize: '11px', color: '#4b5563' }}>
              {createdGame.rounds || 0} questions assigned · Ready for live competition.
            </div>
          </div>
          <button
            type="button"
            style={{ ...btnPrimary, background: '#16a34a', padding: '8px 16px', fontSize: '12px' }}
            onClick={() => {
              onOpenDeck?.(createdGame.id);
            }}
          >
            ⚡ Open in Market Desk →
          </button>
        </div>
      )}

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
          const canDelete = isDraft && (g.players || 0) === 0;

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
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  style={{ ...btnGhost, padding: '6px 12px', fontSize: '11px' }}
                  onClick={() => {
                    try {
                      sessionStorage.setItem('mm_admin_selected_game_id', g.id);
                    } catch {}
                    onOpenDeck?.(g.id);
                  }}
                  title="Open this game in the live Market Desk"
                >
                  ⚡ Open Desk
                </button>

                {isDraft && (
                  canStart ? (
                    <button
                      type="button"
                      style={{ ...btnSuccess, padding: '6px 12px', fontSize: '11px' }}
                      disabled={startingId === g.id}
                      onClick={() => handleStartGame(g.id)}
                    >
                      {startingId === g.id ? 'Starting...' : 'Start Game'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      style={{ ...btnGhost, opacity: 0.5, cursor: 'not-allowed', padding: '6px 12px', fontSize: '11px' }}
                      disabled
                      title="Assign questions before starting"
                    >
                      Assign Questions First
                    </button>
                  )
                )}

                {canDelete && (
                  <button
                    type="button"
                    style={{ ...btnDanger, padding: '6px 12px', fontSize: '11px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
                    disabled={deletingId === g.id}
                    onClick={() => {
                      setConfirmState({
                        isOpen: true,
                        title: 'Delete Game?',
                        message: `Are you sure you want to permanently delete draft game "${g.name}" (PIN: ${g.game_pin})?`,
                        isDanger: true,
                        action: () => handleDeleteGame(g.id, g.name),
                      });
                    }}
                  >
                    {deletingId === g.id ? 'Deleting...' : '🗑️ Delete'}
                  </button>
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
    const ctrl = new AbortController();
    adminApi
      .games(ctrl.signal)
      .then((d) => {
        if (!ctrl.signal.aborted) {
          const list = d.games || [];
          setGames(list);
          if (list.length && !value) onChange(list[0].id);
        }
      })
      .catch(() => {});
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <select style={{ ...inputStyle, maxWidth: '280px', marginBottom: '12px' }} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select game</option>
      {games.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name} ({g.game_pin}) — {g.status.toUpperCase()}
        </option>
      ))}
    </select>
  );
}

function Investments({
  selectedGameId,
  onSelectGame,
}: {
  selectedGameId?: string;
  onSelectGame: (id: string) => void;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [roundFilter, setRoundFilter] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [optionFilter, setOptionFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');

  const isMounted = useRef(true);
  const activeReqId = useRef(0);
  const abortCtrlRef = useRef<AbortController | null>(null);

  const loadTrades = (gid: string) => {
    if (!gid) {
      setRows([]);
      setLoading(false);
      return;
    }
    if (abortCtrlRef.current) abortCtrlRef.current.abort();
    const ctrl = new AbortController();
    abortCtrlRef.current = ctrl;
    const reqId = ++activeReqId.current;

    setRows([]);
    setLoading(true);
    setError('');

    adminApi
      .gameTrades(gid, ctrl.signal)
      .then((d) => {
        if (isMounted.current && reqId === activeReqId.current && !ctrl.signal.aborted) {
          setRows(d.trades || []);
        }
      })
      .catch((err: any) => {
        if (isMounted.current && reqId === activeReqId.current && !ctrl.signal.aborted && err?.name !== 'AbortError') {
          setError(err?.message || 'Failed to load order book.');
        }
      })
      .finally(() => {
        if (isMounted.current && reqId === activeReqId.current && !ctrl.signal.aborted) {
          setLoading(false);
        }
      });
  };

  useEffect(() => {
    isMounted.current = true;
    if (selectedGameId) {
      loadTrades(selectedGameId);
    } else {
      setRows([]);
      setLoading(false);
    }
    return () => {
      isMounted.current = false;
      abortCtrlRef.current?.abort();
    };
  }, [selectedGameId]);

  const filtered = rows.filter((t) => {
    if (roundFilter && String(t.round_number) !== roundFilter) return false;
    if (studentSearch && !String(t.player_name || '').toLowerCase().includes(studentSearch.toLowerCase())) return false;
    if (optionFilter && String(t.selected_option || '').toUpperCase() !== optionFilter.toUpperCase()) return false;
    if (resultFilter === 'won' && !t.is_correct) return false;
    if (resultFilter === 'lost' && t.is_correct) return false;
    return true;
  });

  const availableRounds = Array.from(new Set(rows.map((r) => r.round_number))).sort((a: any, b: any) => Number(a) - Number(b));

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <GamePicker value={selectedGameId || ''} onChange={onSelectGame} />
        <select
          style={{ ...inputStyle, maxWidth: '140px', marginBottom: '12px' }}
          value={roundFilter}
          onChange={(e) => setRoundFilter(e.target.value)}
        >
          <option value="">All Rounds</option>
          {availableRounds.map((r: any) => (
            <option key={r} value={r}>Round {r}</option>
          ))}
        </select>
        <input
          style={{ ...inputStyle, maxWidth: '180px', marginBottom: '12px' }}
          placeholder="Filter student..."
          value={studentSearch}
          onChange={(e) => setStudentSearch(e.target.value)}
        />
        <select
          style={{ ...inputStyle, maxWidth: '140px', marginBottom: '12px' }}
          value={optionFilter}
          onChange={(e) => setOptionFilter(e.target.value)}
        >
          <option value="">All Options</option>
          <option value="A">Option A</option>
          <option value="B">Option B</option>
          <option value="C">Option C</option>
          <option value="D">Option D</option>
        </select>
        <select
          style={{ ...inputStyle, maxWidth: '130px', marginBottom: '12px' }}
          value={resultFilter}
          onChange={(e) => setResultFilter(e.target.value)}
        >
          <option value="">All Results</option>
          <option value="won">Won Only</option>
          <option value="lost">Lost Only</option>
        </select>
      </div>

      <Err msg={error} />

      {loading ? (
        <Loading label="LOADING ORDER BOOK & LOGS" />
      ) : filtered.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#6b7280' }}>
          {selectedGameId ? 'No matching orders or trade records found.' : 'Select a game to view orders.'}
        </div>
      ) : (
        filtered.slice(0, 200).map((t: any, i: number) => (
          <div key={i} style={{ ...card, padding: '10px 14px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <strong>R{t.round_number}</strong> · <strong>{t.player_name}</strong> · {t.is_correct ? '✅ Won' : '❌ Lost'} · Option <span style={{ fontWeight: '800', color: '#2563eb' }}>{t.selected_option}</span>
              <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>{t.question_text}</div>
            </div>
            <div style={{ fontWeight: '700', textAlign: 'right' }}>
              <div>Bid: ₹{Number(t.bid_amount || 0).toLocaleString()} ({t.risk_percent}%)</div>
              <div style={{ color: Number(t.profit_loss || 0) >= 0 ? '#16a34a' : '#dc2626' }}>{t.financial_change}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ---------------- 7. Leaderboard ----------------

function Board({
  selectedGameId,
  onSelectGame,
}: {
  selectedGameId?: string;
  onSelectGame: (id: string) => void;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isMounted = useRef(true);
  const activeReqId = useRef(0);
  const abortCtrlRef = useRef<AbortController | null>(null);

  const loadLeaderboard = (gid: string) => {
    if (!gid) {
      setRows([]);
      setLoading(false);
      return;
    }
    if (abortCtrlRef.current) abortCtrlRef.current.abort();
    const ctrl = new AbortController();
    abortCtrlRef.current = ctrl;
    const reqId = ++activeReqId.current;

    setRows([]);
    setLoading(true);
    setError('');

    adminApi
      .gameLeaderboard(gid, ctrl.signal)
      .then((d) => {
        if (isMounted.current && reqId === activeReqId.current && !ctrl.signal.aborted) {
          setRows(d.leaderboard || []);
        }
      })
      .catch((err: any) => {
        if (isMounted.current && reqId === activeReqId.current && !ctrl.signal.aborted && err?.name !== 'AbortError') {
          setError(err?.message || 'Failed to load leaderboard.');
        }
      })
      .finally(() => {
        if (isMounted.current && reqId === activeReqId.current && !ctrl.signal.aborted) {
          setLoading(false);
        }
      });
  };

  useEffect(() => {
    isMounted.current = true;
    if (selectedGameId) {
      loadLeaderboard(selectedGameId);
    } else {
      setRows([]);
      setLoading(false);
    }
    return () => {
      isMounted.current = false;
      abortCtrlRef.current?.abort();
    };
  }, [selectedGameId]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        <GamePicker value={selectedGameId || ''} onChange={onSelectGame} />
        {selectedGameId && (
          <button type="button" style={{ ...btnGhost, padding: '8px 14px', fontSize: '11px' }} onClick={() => loadLeaderboard(selectedGameId)} disabled={loading}>
            🔄 {loading ? 'Updating...' : 'Refresh Standings'}
          </button>
        )}
      </div>

      <Err msg={error} />

      {/* Top 3 Podium Cards */}
      {rows.length >= 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '18px' }}>
          {/* 1st Place Gold */}
          <div style={{ ...card, border: '2px solid #eab308', background: 'linear-gradient(180deg, #fefce8 0%, #ffffff 100%)', textAlign: 'center', padding: '16px' }}>
            <div style={{ fontSize: '28px' }}>👑 🥇</div>
            <div style={{ fontSize: '11px', fontWeight: '900', color: '#854d0e', letterSpacing: '0.06em' }}>CHAMPION #1</div>
            <div style={{ fontSize: '16px', fontWeight: '900', color: '#111827', margin: '4px 0' }}>{rows[0].avatar} {rows[0].name}</div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#16a34a' }}>₹{Number(rows[0].capital).toLocaleString()}</div>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#ca8a04', marginTop: '2px' }}>
              Return: {rows[0].return_pct >= 0 ? '+' : ''}{rows[0].return_pct}% · Win Rate: {rows[0].win_rate}%
            </div>
            <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '10px', background: '#fef08a', color: '#713f12', padding: '2px 8px', borderRadius: '999px', fontWeight: '800' }}>
              {rows[0].badge || '👑 Market Leader'}
            </span>
          </div>

          {/* 2nd Place Silver */}
          <div style={{ ...card, border: '2px solid #94a3b8', background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)', textAlign: 'center', padding: '16px' }}>
            <div style={{ fontSize: '28px' }}>🥈</div>
            <div style={{ fontSize: '11px', fontWeight: '900', color: '#475569', letterSpacing: '0.06em' }}>RUNNER UP #2</div>
            <div style={{ fontSize: '16px', fontWeight: '900', color: '#111827', margin: '4px 0' }}>{rows[1].avatar} {rows[1].name}</div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#16a34a' }}>₹{Number(rows[1].capital).toLocaleString()}</div>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', marginTop: '2px' }}>
              Return: {rows[1].return_pct >= 0 ? '+' : ''}{rows[1].return_pct}% · Win Rate: {rows[1].win_rate}%
            </div>
            <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '10px', background: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '999px', fontWeight: '800' }}>
              {rows[1].badge || '🏆 Top Trader'}
            </span>
          </div>

          {/* 3rd Place Bronze */}
          <div style={{ ...card, border: '2px solid #d97706', background: 'linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)', textAlign: 'center', padding: '16px' }}>
            <div style={{ fontSize: '28px' }}>🥉</div>
            <div style={{ fontSize: '11px', fontWeight: '900', color: '#b45309', letterSpacing: '0.06em' }}>PODIUM #3</div>
            <div style={{ fontSize: '16px', fontWeight: '900', color: '#111827', margin: '4px 0' }}>{rows[2].avatar} {rows[2].name}</div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#16a34a' }}>₹{Number(rows[2].capital).toLocaleString()}</div>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#b45309', marginTop: '2px' }}>
              Return: {rows[2].return_pct >= 0 ? '+' : ''}{rows[2].return_pct}% · Win Rate: {rows[2].win_rate}%
            </div>
            <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '10px', background: '#fed7aa', color: '#7c2d12', padding: '2px 8px', borderRadius: '999px', fontWeight: '800' }}>
              {rows[2].badge || '🏆 Top Trader'}
            </span>
          </div>
        </div>
      )}

      {/* Full Leaderboard Table */}
      {rows.length > 0 ? (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
            <span style={{ fontSize: '12px', fontWeight: '900', color: '#374151' }}>
              COMPETITION LEADERBOARD ({rows.length} TRADERS)
            </span>
            <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '700' }}>
              Multi-factor sorting: Capital → Score → P/L → Win Rate
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#6b7280', fontSize: '11px' }}>
                  <th style={{ padding: '10px 14px' }}>RANK</th>
                  <th style={{ padding: '10px 14px' }}>TRADER</th>
                  <th style={{ padding: '10px 14px' }}>BADGE</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>CAPITAL (₹)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>NET P/L</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>RETURN %</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>WIN RATE</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>SCORE</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p: any, idx: number) => {
                  const rankNum = p.rank || idx + 1;
                  return (
                    <tr key={p.user_id || p.name || idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 14px', fontWeight: '900' }}>
                        {rankNum === 1 ? '🥇 #1' : rankNum === 2 ? '🥈 #2' : rankNum === 3 ? '🥉 #3' : `#${rankNum}`}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: '800' }}>
                        {p.avatar} {p.name}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: '10px', fontWeight: '800', background: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: '6px' }}>
                          {p.badge || 'Neutral'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '900' }}>
                        ₹{Number(p.capital).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '800', color: p.profit_loss >= 0 ? '#16a34a' : '#dc2626' }}>
                        {p.profit_loss >= 0 ? '+' : ''}₹{Number(p.profit_loss).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '800', color: p.return_pct >= 0 ? '#16a34a' : '#dc2626' }}>
                        {p.return_pct >= 0 ? '+' : ''}{p.return_pct}%
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '800' }}>
                        {p.win_rate}%
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '800' }}>
                        {p.score} pts ({p.correct_count || 0}W/{p.wrong_count || 0}L)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        selectedGameId && <div style={{ ...card, textAlign: 'center', color: '#6b7280', padding: '32px' }}>No player standings recorded for this game yet.</div>
      )}
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
  const [section, setSection] = useState<Section>(() => {
    try {
      return (sessionStorage.getItem('mm_admin_section') as Section) || 'deck';
    } catch {
      return 'deck';
    }
  });

  const [selectedGameId, setSelectedGameId] = useState<string>(() => {
    try {
      return sessionStorage.getItem('mm_admin_selected_game_id') || '';
    } catch {
      return '';
    }
  });

  const handleSelectGame = (gid: string) => {
    setSelectedGameId(gid);
    try {
      sessionStorage.setItem('mm_admin_selected_game_id', gid);
    } catch {}
  };

  const handleOpenDeck = (gid: string) => {
    handleSelectGame(gid);
    setSection('deck');
    try {
      sessionStorage.setItem('mm_admin_section', 'deck');
    } catch {}
  };

  const handleSetSection = (s: Section) => {
    setSection(s);
    try {
      sessionStorage.setItem('mm_admin_section', s);
    } catch {}
  };

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
              onClick={() => handleSetSection(s.id)}
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

        {/* Active Section Panel Render — Lifecycle Controlled, Zero Background Leaks */}
        {section === 'deck' && (
          <MarketDesk selectedGameId={selectedGameId} onSelectGame={handleSelectGame} />
        )}
        {section === 'dashboard' && <Dashboard />}
        {section === 'students' && <Students />}
        {section === 'questions' && <Questions />}
        {section === 'games' && (
          <Games
            onOpenDeck={handleOpenDeck}
            selectedGameId={selectedGameId}
            onSelectGame={handleSelectGame}
          />
        )}
        {section === 'investments' && (
          <Investments selectedGameId={selectedGameId} onSelectGame={handleSelectGame} />
        )}
        {section === 'leaderboard' && (
          <Board selectedGameId={selectedGameId} onSelectGame={handleSelectGame} />
        )}
        {section === 'audit' && <AuditLog />}
        {section === 'settings' && <Settings />}
      </div>
    </div>
  );
}

export default AdminPanel;
