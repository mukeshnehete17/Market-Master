import { useState, useEffect, useRef, useCallback } from 'react';
import { LiquidMetalButton } from './ui/liquid-metal-button';
import { LiquidGlassButton } from './ui/liquid-glass-button';
import { Confetti } from './Confetti';
import {
  fetchCurrentGameState,
  submitPosition,
  fetchRoundResult,
  advanceNextRound,
  resetGameSession,
  submitTimeout,
} from '../api/game';
import type {
  Question,
  PendingPosition,
  RoundResult,
  GameSummary,
} from '../types/api';

type RiskLevel = 'none' | '2x' | '3x' | '5x';

interface RiskConfig {
  label: string;
  name: string;
  multiplier: number;
}

const RISK_TIERS: Record<RiskLevel, RiskConfig> = {
  none: {
    label: 'No Risk',
    name: 'No Risk (0x)',
    multiplier: 0,
  },
  '2x': {
    label: '2x Risk',
    name: '2x Multiplier',
    multiplier: 2,
  },
  '3x': {
    label: '3x Risk',
    name: '3x Multiplier',
    multiplier: 3,
  },
  '5x': {
    label: '5x Risk',
    name: '5x High Conviction',
    multiplier: 5,
  },
};

interface Props {
  callsign: string;
  onExit: () => void;
}

export function GameArena({ callsign, onExit }: Props) {
  // Game state
  const [capital, setCapital] = useState(1000);
  const [bidAmount, setBidAmount] = useState(200);
  const [currentRoundNumber, setCurrentRoundNumber] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(8);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [selectedRisk, setSelectedRisk] = useState<RiskLevel>('none');

  const [arenaState, setArenaState] = useState<
    'loading' | 'waiting' | 'question' | 'locked' | 'result' | 'gameover'
  >('loading');

  const [pendingPosition, setPendingPosition] = useState<PendingPosition | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [gameSummary, setGameSummary] = useState<GameSummary | null>(null);

  const [timeLeft, setTimeLeft] = useState(15);
  const [deadlineTimestamp, setDeadlineTimestamp] = useState<number | null>(null);
  const [confettiTrigger, setConfettiTrigger] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [waitMessage, setWaitMessage] = useState('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const marketPollRef = useRef<NodeJS.Timeout | null>(null);
  const waitPollRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (marketPollRef.current) clearInterval(marketPollRef.current);
      if (waitPollRef.current) clearTimeout(waitPollRef.current);
    };
  }, []);

  // Fetch initial/current game state from backend.
  // Accepts an AbortSignal so unmounts cancel in-flight requests and stale
  // responses can never overwrite newer state.
  const syncGameState = useCallback(async (signal?: AbortSignal) => {
    setErrorMsg('');
    try {
      const data = await fetchCurrentGameState(signal);
      if (signal?.aborted) return;
      if (!data.success) {
        setErrorMsg(data.message || 'Failed to retrieve game state.');
        return;
      }

      if (data.player) {
        setCapital(data.player.capital);
      }

      if (data.game_state === 'gameover') {
        if (data.summary) setGameSummary(data.summary);
        setArenaState('gameover');
        return;
      }

      if (data.game_state === 'waiting' || data.game_state === 'paused') {
        // Game not live yet (admin has not started it / paused). Poll lightly.
        setArenaState('waiting');
        setWaitMessage(data.message || '');
        if (waitPollRef.current) clearTimeout(waitPollRef.current);
        waitPollRef.current = setTimeout(() => {
          syncGameState();
        }, 5000);
        return;
      }

      if (data.game_state === 'result' && data.result) {
        setRoundResult(data.result);
        setArenaState('result');
        if (data.result.is_correct) setConfettiTrigger(true);
        return;
      }

      if (data.game_state === 'market' && data.pending_position) {
        setPendingPosition(data.pending_position);
        if (data.deadline) {
          setDeadlineTimestamp(data.deadline);
          const remaining = Math.max(0, Math.round(data.deadline - Date.now() / 1000));
          setTimeLeft(remaining);
        }
        setArenaState('locked');
        return;
      }

      if (data.game_state === 'question' && data.round) {
        setCurrentRoundNumber(data.round.current_number);
        setTotalQuestions(data.round.total_questions);
        setCurrentQuestion(data.round.question);
        setSelectedOption(null);
        setSelectedOptionIndex(null);
        setSelectedRisk('none');
        setDeadlineTimestamp(data.round.deadline);
        const remaining = Math.max(0, Math.round(data.round.deadline - Date.now() / 1000));
        setTimeLeft(remaining > 0 ? remaining : data.round.question.duration_seconds || 15);
        setArenaState('question');
      }
    } catch (err: any) {
      if (signal?.aborted || err?.name === 'AbortError') return;
      setErrorMsg(err?.message || 'Network error syncing with game server.');
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    syncGameState(ctrl.signal);
    return () => ctrl.abort();
  }, [syncGameState]);

  // Handle countdown timer for question and market locked states
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (arenaState === 'question' || arenaState === 'locked') {
      timerRef.current = setInterval(() => {
        if (deadlineTimestamp) {
          const nowSec = Date.now() / 1000;
          const diff = Math.max(0, Math.ceil(deadlineTimestamp - nowSec));
          setTimeLeft(diff);

          if (diff <= 0) {
            if (timerRef.current) clearInterval(timerRef.current);
            // Handle timeout / market closure
            if (arenaState === 'question') {
              handleQuestionTimeout();
            } else if (arenaState === 'locked') {
              handleMarketClosed();
            }
          }
        } else {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              if (timerRef.current) clearInterval(timerRef.current);
              if (arenaState === 'question') handleQuestionTimeout();
              else if (arenaState === 'locked') handleMarketClosed();
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [arenaState, deadlineTimestamp]);

  const handleQuestionTimeout = async () => {
    try {
      const res = await submitTimeout();
      if (res.success && res.result) {
        setRoundResult(res.result);
        setArenaState('result');
      }
    } catch {
      // Fallback transition
      syncGameState();
    }
  };

  const handleMarketClosed = async () => {
    try {
      const res = await fetchRoundResult();
      if (res.success && res.result) {
        setRoundResult(res.result);
        if (res.capital !== undefined) setCapital(res.capital);
        setArenaState('result');
        if (res.result.is_correct) {
          setConfettiTrigger(true);
        }
      }
    } catch {
      syncGameState();
    }
  };

  const effectiveBid = Math.min(capital, Math.max(10, bidAmount));

  const calculateWinBenefit = (risk: RiskLevel, bid: number) => {
    if (risk === 'none') return 100;
    if (risk === '2x') return bid * 2;
    if (risk === '3x') return bid * 3;
    if (risk === '5x') return bid * 5;
    return 100;
  };

  const calculateDownside = (risk: RiskLevel, bid: number) => {
    if (risk === 'none') return 0;
    return bid;
  };

  const potentialWin = calculateWinBenefit(selectedRisk, effectiveBid);
  const potentialLoss = calculateDownside(selectedRisk, effectiveBid);

  // Submit Answer / Lock in Position
  const handleLockIn = async () => {
    if (!currentQuestion || selectedOption === null || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const multiplier = RISK_TIERS[selectedRisk].multiplier;
      const response = await submitPosition({
        question_id: currentQuestion.id,
        option: selectedOption,
        risk_multiplier: multiplier,
        bid_amount: effectiveBid,
      });

      if (response.success) {
        setPendingPosition(response.pending_position);
        if (response.deadline) {
          setDeadlineTimestamp(response.deadline);
          const remaining = Math.max(0, Math.round(response.deadline - Date.now() / 1000));
          setTimeLeft(remaining);
        }
        setArenaState('locked');
      } else {
        setErrorMsg(response.message || 'Position submission failed.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to submit position to server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Advance to Next Round
  const handleNext = async () => {
    setConfettiTrigger(false);
    setSelectedOption(null);
    setSelectedOptionIndex(null);
    setSelectedRisk('none');
    setPendingPosition(null);
    setRoundResult(null);
    setArenaState('loading');
    setErrorMsg('');

    try {
      const response = await advanceNextRound();
      if (response.success) {
        if (response.game_state === 'gameover') {
          if (response.summary) setGameSummary(response.summary);
          setArenaState('gameover');
        } else {
          await syncGameState();
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to advance to next round.');
      setArenaState('result');
    }
  };

  // Restart / Reset Game Session
  const handleRestart = async () => {
    setArenaState('loading');
    setConfettiTrigger(false);
    setSelectedOption(null);
    setSelectedOptionIndex(null);
    setSelectedRisk('none');
    setRoundResult(null);
    setGameSummary(null);
    setErrorMsg('');

    try {
      await resetGameSession();
      await syncGameState();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to reset game session.');
    }
  };

  return (
    <div className="arena-container">
      <Confetti trigger={confettiTrigger} />

      {/* Top Status Bar */}
      <div className="arena-status-bar">
        <div className="arena-status-left">
          <span className="arena-progress">
            ROUND {currentRoundNumber}/{totalQuestions}
          </span>
          <span className="arena-callsign">{callsign.toUpperCase()}</span>
        </div>

        <div className="arena-capital-bar-wrap">
          <div className="arena-capital-labels">
            <span className="arena-label">CAPITAL LOAD</span>
            <span className="arena-capital-value">
              ₹{capital.toLocaleString()}
            </span>
          </div>
          <div className="capital-load-bar-bg">
            <div
              className="capital-load-bar-fill"
              style={{ width: `${Math.min((capital / 10000) * 100, 100)}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          className="arena-exit-btn"
          onClick={onExit}
          title="Leave simulation"
        >
          Leave ↗
        </button>
      </div>

      {/* Error Alert Banner */}
      {errorMsg && (
        <div
          style={{
            background: 'rgba(225, 29, 72, 0.1)',
            border: '1px solid #e11d48',
            borderRadius: '12px',
            padding: '12px 16px',
            margin: '0 0 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#e11d48',
            fontSize: '13px',
            fontWeight: '800',
          }}
        >
          <span>⚠️ {errorMsg}</span>
          <button
            type="button"
            onClick={() => { void syncGameState(); }}
            style={{
              background: '#e11d48',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 10px',
              cursor: 'pointer',
              fontWeight: '800',
              fontSize: '12px',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {arenaState === 'loading' && (
        <div
          className="arena-card"
          style={{ textAlign: 'center', padding: '60px 20px' }}
        >
          <div style={{ fontSize: '32px', marginBottom: '14px' }}>⚡</div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>
            Syncing Market Feed...
          </h2>
          <p style={{ color: '#666', fontSize: '14px', marginTop: '6px' }}>
            Fetching authoritative game data from server.
          </p>
        </div>
      )}

      {/* Waiting State (game not live yet) */}
      {arenaState === 'waiting' && (
        <div
          className="arena-card"
          style={{ textAlign: 'center', padding: '60px 20px' }}
        >
          <div style={{ fontSize: '32px', marginBottom: '14px' }}>⏳</div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>
            Waiting For Market Open
          </h2>
          <p style={{ color: '#666', fontSize: '14px', marginTop: '6px' }}>
            {waitMessage || 'The admin has not started this game yet. Stay ready.'}
          </p>
          <button
            type="button"
            onClick={() => { void syncGameState(); }}
            style={{
              marginTop: '14px',
              padding: '10px 20px',
              borderRadius: '12px',
              background: '#000',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '800',
              fontSize: '13px',
            }}
          >
            🔄 Check Again
          </button>
        </div>
      )}

      {/* Question / Active View */}
      {arenaState === 'question' && currentQuestion && (
        <div className="arena-card">
          {/* Countdown Timer Bar */}
          <div className="arena-timer-bar-wrap">
            <div className="timer-info-row">
              <span className={`timer-badge ${timeLeft <= 5 ? 'urgent' : ''}`}>
                <span className="timer-icon">⏱</span>
                <span>{timeLeft}s REMAINING</span>
              </span>
              <span className="timer-rule">
                {currentQuestion.duration_seconds || 15}-SECOND DECISION DEADLINE
              </span>
            </div>
            <div className="timer-track">
              <div
                className={`timer-fill ${timeLeft <= 5 ? 'urgent' : ''}`}
                style={{
                  width: `${(timeLeft / (currentQuestion.duration_seconds || 15)) * 100}%`,
                }}
              />
            </div>
          </div>

          <div className="arena-card-header">
            <span className="arena-category">
              {currentQuestion.category || 'Market Intelligence'}
            </span>
            <span className="arena-multiplier-badge">
              {RISK_TIERS[selectedRisk].name}
            </span>
          </div>

          <h2 className="arena-question-text">{currentQuestion.question}</h2>

          {/* 4 Options Grid */}
          <div className="arena-options-grid">
            {currentQuestion.options.map((opt, idx) => {
              const letter = ['A', 'B', 'C', 'D'][idx];
              const isSelected = selectedOptionIndex === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`Option ${letter}: ${opt}`}
                  className={`arena-option-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedOptionIndex(idx);
                    setSelectedOption(opt);
                  }}
                >
                  <span className="option-letter">{letter}</span>
                  <span className="option-text">{opt}</span>
                </button>
              );
            })}
          </div>

          {/* Bid Amount + Risk Selector */}
          <div className="arena-risk-section">
            {/* Bid Amount Input with Mobile Quick Chips & Steppers */}
            <div className="bid-row">
              <div className="bid-row-header">
                <label htmlFor="bid-input" className="risk-title">
                  BID CAPITAL
                </label>
                <span className="bid-available-hint">
                  Available: <strong>₹{capital.toLocaleString()}</strong>
                </span>
              </div>

              <div className="bid-controls-flex">
                <button
                  type="button"
                  className="bid-step-btn"
                  onClick={() => setBidAmount((prev) => Math.max(10, prev - 50))}
                  aria-label="Decrease bid by 50"
                >
                  −50
                </button>

                <div className="bid-input-wrap">
                  <span className="bid-currency">₹</span>
                  <input
                    id="bid-input"
                    type="number"
                    min={10}
                    max={capital}
                    step={10}
                    value={bidAmount}
                    onChange={(e) =>
                      setBidAmount(
                        Math.min(capital, Math.max(10, Number(e.target.value) || 10))
                      )
                    }
                    className="bid-amount-input"
                    inputMode="numeric"
                  />
                </div>

                <button
                  type="button"
                  className="bid-step-btn"
                  onClick={() => setBidAmount((prev) => Math.min(capital, prev + 50))}
                  aria-label="Increase bid by 50"
                >
                  +50
                </button>
              </div>

              {/* One-Touch Quick Percentage Chips */}
              <div className="bid-quick-chips">
                <button
                  type="button"
                  className={`bid-chip ${effectiveBid === 10 ? 'active' : ''}`}
                  onClick={() => setBidAmount(10)}
                >
                  MIN (₹10)
                </button>
                <button
                  type="button"
                  className={`bid-chip ${effectiveBid === Math.max(10, Math.round(capital * 0.25)) ? 'active' : ''}`}
                  onClick={() => setBidAmount(Math.max(10, Math.round(capital * 0.25)))}
                >
                  25%
                </button>
                <button
                  type="button"
                  className={`bid-chip ${effectiveBid === Math.max(10, Math.round(capital * 0.5)) ? 'active' : ''}`}
                  onClick={() => setBidAmount(Math.max(10, Math.round(capital * 0.5)))}
                >
                  50%
                </button>
                <button
                  type="button"
                  className={`bid-chip ${effectiveBid === Math.max(10, Math.round(capital * 0.75)) ? 'active' : ''}`}
                  onClick={() => setBidAmount(Math.max(10, Math.round(capital * 0.75)))}
                >
                  75%
                </button>
                <button
                  type="button"
                  className={`bid-chip ${effectiveBid === capital ? 'active' : ''}`}
                  onClick={() => setBidAmount(capital)}
                >
                  MAX (₹{capital.toLocaleString()})
                </button>
              </div>
            </div>

            <div className="risk-header">
              <span className="risk-title">SELECT RISK MULTIPLIER</span>
              <span className="risk-payoff-preview">
                {selectedRisk === 'none'
                  ? 'Safe: +₹100 | Risk: ₹0'
                  : `Win: +₹${potentialWin.toLocaleString()} | Loss: -₹${potentialLoss.toLocaleString()}`}
              </span>
            </div>

            <div className="risk-pills-row">
              {(['none', '2x', '3x', '5x'] as RiskLevel[]).map((tier) => {
                const config = RISK_TIERS[tier];
                const active = selectedRisk === tier;
                const disabled = tier !== 'none' && effectiveBid > capital;

                return (
                  <LiquidGlassButton
                    key={tier}
                    active={active}
                    disabled={disabled}
                    onClick={() => setSelectedRisk(tier)}
                  >
                    <span className="risk-pill-name">{config.label}</span>
                    <span className="risk-pill-desc">
                      {tier === 'none'
                        ? 'Win: +₹100'
                        : `Win: +₹${calculateWinBenefit(tier, effectiveBid).toLocaleString()}`}
                    </span>
                  </LiquidGlassButton>
                );
              })}
            </div>
          </div>

          {/* Submit Action */}
          <div className="arena-submit-wrap">
            <LiquidMetalButton
              type="button"
              label={
                isSubmitting
                  ? 'LOCKING POSITION...'
                  : selectedOption === null
                    ? `Choose an option (${timeLeft}s remaining)`
                    : `Confirm — Bid ₹${effectiveBid.toLocaleString()} · ${RISK_TIERS[selectedRisk].label}`
              }
              onClick={handleLockIn}
              disabled={isSubmitting || selectedOption === null}
            />
          </div>
        </div>
      )}


      {/* Position Locked / Market Waiting State */}
      {arenaState === 'locked' && pendingPosition && (
        <div className="arena-card" style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              background: 'rgba(0, 0, 0, 0.06)',
              borderRadius: '100px',
              margin: '0 auto 12px',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#16a34a',
                display: 'inline-block',
              }}
            />
            <span
              style={{
                fontSize: '12px',
                fontWeight: '800',
                letterSpacing: '0.05em',
              }}
            >
              POSITION LOCKED
            </span>
          </div>

          <h2 style={{ fontSize: '26px', fontWeight: '800', margin: '0 0 8px' }}>
            Awaiting Market Closure
          </h2>
          <p style={{ color: '#666', fontSize: '14px', margin: '0 0 24px' }}>
            Your position is locked with the central exchange. Awaiting final order settlement.
          </p>

          <div
            style={{
              background: '#f7f7f7',
              border: '1px solid #eaeaea',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              margin: '0 auto 24px',
              maxWidth: '420px',
            }}
          >
            <div className="profile-field">
              <span className="profile-label">LOCKED ANSWER</span>
              <span className="profile-value">{pendingPosition.answer}</span>
            </div>
            <div className="profile-field">
              <span className="profile-label">RISK CONVICTION</span>
              <span className="profile-value">{pendingPosition.risk}</span>
            </div>
            <div className="profile-field">
              <span className="profile-label">CAPITAL AT RISK</span>
              <span className="profile-value">₹{pendingPosition.exposure.toLocaleString()}</span>
            </div>
            <div className="profile-field">
              <span className="profile-label">TIME TO SETTLEMENT</span>
              <span className="profile-value" style={{ color: '#e11d48' }}>
                {timeLeft}s
              </span>
            </div>
          </div>

          <LiquidMetalButton
            type="button"
            label={
              timeLeft > 0
                ? `Market Closing in ${timeLeft}s...`
                : 'Reveal Market Outcome'
            }
            onClick={handleMarketClosed}
          />
        </div>
      )}

      {/* Result Card with Settlement */}
      {arenaState === 'result' && roundResult && (
        <div
          className={`arena-result-card ${roundResult.is_correct ? 'won' : 'lost'}`}
        >
          {roundResult.is_correct ? (
            <div className="celebration-hero">
              <div className="op-win-animation">
                <img
                  src="/assets/gear5-luffy.png"
                  alt="Gear 5 Luffy"
                  className="luffy-win-img"
                />
              </div>
              <div className="celebration-badge">
                <span className="congrats-emoji">🎉</span>
                <span className="congrats-tag">OUTSTANDING POSITION</span>
              </div>
              <h2 className="congrats-heading">Congratulations, {callsign}!</h2>
              <p className="congrats-sub">
                Your conviction paid off. {roundResult.selected_risk} executed cleanly.
              </p>
              <div className="payout-stat-card win">
                <span className="stat-label">GAINED PROFIT</span>
                <span className="stat-amount win">
                  {roundResult.financial_change}
                </span>
                <span className="stat-balance">
                  New Capital Balance: ₹{roundResult.new_capital.toLocaleString()}
                </span>
              </div>
            </div>
          ) : (
            <div className="loss-hero">
              <div className="loss-badge">
                <span className="loss-tag">
                  {roundResult.is_timeout ? 'DEADLINE EXPIRED' : 'POSITION LIQUIDATED'}
                </span>
              </div>
              <h2 className="loss-heading">
                {roundResult.is_timeout ? 'Time Expired' : 'Risk Realized'}
              </h2>
              <p className="loss-sub">
                {roundResult.is_timeout
                  ? 'No option was selected within the deadline. Position forfeited.'
                  : 'The market moved against your position.'}
              </p>
              <div className="payout-stat-card loss">
                <span className="stat-label">CAPITAL DEDUCTION</span>
                <span className="stat-amount loss">
                  {roundResult.financial_change}
                </span>
                <span className="stat-balance">
                  Remaining Capital: ₹{roundResult.new_capital.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {roundResult.correct_answer && (
            <div
              style={{
                background: '#f9f9f9',
                border: '1px solid #eaeaea',
                borderRadius: '12px',
                padding: '12px 16px',
                margin: '16px 0 10px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '13px',
                fontWeight: '800',
              }}
            >
              <span style={{ color: '#666' }}>AUTHORITATIVE ANSWER:</span>
              <span style={{ color: '#16a34a' }}>{roundResult.correct_answer}</span>
            </div>
          )}

          <div className="result-explanation">
            <span className="exp-label">EXPLANATION:</span>
            <p className="exp-text">{roundResult.explanation}</p>
          </div>

          <div className="arena-next-wrap">
            <LiquidMetalButton
              type="button"
              label={
                currentRoundNumber >= totalQuestions || capital <= 0
                  ? 'View Final Portfolio Outcome'
                  : 'Next Market Question →'
              }
              onClick={handleNext}
            />
          </div>
        </div>
      )}

      {/* Game Over / Summary Card */}
      {arenaState === 'gameover' && (
        <div className="arena-gameover-card">
          <div className="gameover-header">
            <span className="eyebrow">SIMULATION SUMMARY</span>
            <h2>Portfolio Finalized</h2>
            <p className="gameover-trader">Trader: {callsign.toUpperCase()}</p>
          </div>

          <div className="summary-metrics">
            <div className="summary-metric-box">
              <span className="metric-label">STARTING CAPITAL</span>
              <span className="metric-val">
                ₹{(gameSummary?.starting_capital ?? 1000).toLocaleString()}
              </span>
            </div>
            <div className="summary-metric-box highlight">
              <span className="metric-label">FINAL EQUITY</span>
              <span className="metric-val">
                ₹{(gameSummary?.final_capital ?? capital).toLocaleString()}
              </span>
            </div>
            <div className="summary-metric-box">
              <span className="metric-label">NET P&L</span>
              <span
                className={`metric-val ${
                  (gameSummary?.final_capital ?? capital) >= 1000 ? 'profit' : 'deficit'
                }`}
              >
                {(gameSummary?.final_capital ?? capital) >= 1000 ? '+' : ''}₹
                {((gameSummary?.final_capital ?? capital) - 1000).toLocaleString()}
              </span>
            </div>
          </div>

          <p className="gameover-message">
            {(gameSummary?.final_capital ?? capital) > 2000
              ? '🏆 Masterclass Performance! You maximized risk multipliers with exceptional market accuracy.'
              : (gameSummary?.final_capital ?? capital) >= 1000
                ? '✅ Capital Preserved! You closed the session in green profit.'
                : '⚠️ Capital Drawdown. High risk requires precise conviction. Test your edge again.'}
          </p>

          <div className="gameover-actions">
            <LiquidMetalButton
              type="button"
              label="Play New Session (₹1,000)"
              onClick={handleRestart}
            />
          </div>
        </div>
      )}
    </div>
  );
}
