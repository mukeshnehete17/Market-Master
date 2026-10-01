import { useState, useEffect } from 'react';
import { LiquidMetalButton } from './ui/liquid-metal-button';
import { LiquidGlassButton } from './ui/liquid-glass-button';
import { Confetti } from './Confetti';

interface Question {
  id: number;
  category: string;
  question: string;
  options: string[];
  correctOption: number;
  explanation: string;
}

const QUESTIONS: Question[] = [
  {
    id: 1,
    category: 'Market Trends',
    question:
      'Which financial term describes a prolonged period of falling asset prices and widespread investor pessimism?',
    options: ['Bull Market', 'Bear Market', 'Contango', 'Stagflation'],
    correctOption: 1,
    explanation:
      'A Bear Market represents a sustained decline of 20% or more from recent peaks accompanied by negative market sentiment.',
  },
  {
    id: 2,
    category: 'Fixed Income & Rates',
    question:
      'When prevailing central bank interest rates rise, what typically happens to existing fixed-rate bond prices?',
    options: [
      'Bond prices rise',
      'Bond prices fall',
      'Bond prices remain unchanged',
      'Bond coupon rates double',
    ],
    correctOption: 1,
    explanation:
      'Bond prices and interest rates move in opposite directions; higher rates make existing lower-yielding bonds less valuable.',
  },
  {
    id: 3,
    category: 'Risk & Derivatives',
    question:
      'What is the primary objective of "Hedging" in institutional portfolio management?',
    options: [
      'Maximizing leverage to multiply profits',
      'Taking an offsetting position to neutralize adverse price movements',
      'Trading exclusively after exchange regular hours',
      'Investing only in risk-free government securities',
    ],
    correctOption: 1,
    explanation:
      'Hedging acts as financial insurance by opening a counter-position to balance downside market exposure.',
  },
  {
    id: 4,
    category: 'Corporate Finance',
    question:
      'Which core financial statement records a company’s revenue, operational costs, and net income over a specified reporting period?',
    options: [
      'Balance Sheet',
      'Cash Flow Statement',
      'Income Statement (P&L)',
      'Statement of Financial Position',
    ],
    correctOption: 2,
    explanation:
      'The Income Statement tracks revenues and expenses over a fiscal quarter or year to show net profitability.',
  },
  {
    id: 5,
    category: 'Options Architecture',
    question:
      'What right does holding a standard "Call Option" contract grant to an investor?',
    options: [
      'The obligation to sell the asset at the strike price',
      'The right to buy the underlying asset at the strike price before expiry',
      'An unconditional guarantee of quarterly cash dividend payouts',
      'The right to liquidate corporate assets during bankruptcy',
    ],
    correctOption: 1,
    explanation:
      'A Call Option provides the buyer the right (without obligation) to purchase the underlying security at the agreed strike price.',
  },
];

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
  const [capital, setCapital] = useState(1000);
  const [bidAmount, setBidAmount] = useState(200);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedRisk, setSelectedRisk] = useState<RiskLevel>('none');
  const [gameState, setGameState] = useState<
    'question' | 'result' | 'gameover'
  >('question');
  const [lastDelta, setLastDelta] = useState(0);
  const [isWin, setIsWin] = useState(false);
  const [isTimeout, setIsTimeout] = useState(false);
  const [confettiTrigger, setConfettiTrigger] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);

  const currentQuestion = QUESTIONS[currentIndex];
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

  // 15-second countdown timer per question
  useEffect(() => {
    if (gameState !== 'question') return;

    setTimeLeft(15);
    setIsTimeout(false);

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentIndex, gameState]);

  const resolveRound = (chosen: number | null, timedOut = false) => {
    const currentBid = effectiveBid;
    if (chosen !== null && chosen === currentQuestion.correctOption) {
      const reward = calculateWinBenefit(selectedRisk, currentBid);
      setCapital((prev) => prev + reward);
      setLastDelta(reward);
      setIsWin(true);
      setIsTimeout(false);
      setConfettiTrigger(true);
    } else {
      const loss = calculateDownside(selectedRisk, currentBid);
      setCapital((prev) => Math.max(0, prev - loss));
      setLastDelta(loss);
      setIsWin(false);
      setIsTimeout(timedOut);
      setConfettiTrigger(false);
    }
    setGameState('result');
  };

  // Handle 15s deadline expiry
  useEffect(() => {
    if (gameState === 'question' && timeLeft === 0) {
      resolveRound(selectedOption, selectedOption === null);
    }
  }, [timeLeft, gameState]);

  const handleLockIn = () => {
    if (selectedOption !== null) {
      resolveRound(selectedOption);
    }
  };

  const handleNext = () => {
    setConfettiTrigger(false);
    setSelectedOption(null);
    setSelectedRisk('none');
    setIsTimeout(false);

    if (capital <= 0) {
      setGameState('gameover');
      return;
    }

    if (currentIndex + 1 >= QUESTIONS.length) {
      setGameState('gameover');
    } else {
      setCurrentIndex((prev) => prev + 1);
      setGameState('question');
    }
  };

  const handleRestart = () => {
    setCapital(1000);
    setBidAmount(200);
    setCurrentIndex(0);
    setSelectedOption(null);
    setSelectedRisk('none');
    setGameState('question');
    setConfettiTrigger(false);
    setIsWin(false);
    setIsTimeout(false);
    setTimeLeft(15);
  };

  const potentialWin = calculateWinBenefit(selectedRisk, effectiveBid);
  const potentialLoss = calculateDownside(selectedRisk, effectiveBid);

  return (
    <div className="arena-container">
      <Confetti trigger={confettiTrigger} />

      {/* Top Status Bar */}
      <div className="arena-status-bar">
        <div className="arena-trader-info">
          <span className="arena-label">TRADER</span>
          <span className="arena-callsign">{callsign.toUpperCase()}</span>
        </div>

        <div className="arena-capital-box">
          <span className="arena-label">CAPITAL BALANCE</span>
          <span className="arena-capital-value">
            ₹{capital.toLocaleString()}
          </span>
        </div>

        <div className="arena-actions-top">
          <span className="arena-progress">
            ROUND {currentIndex + 1} / {QUESTIONS.length}
          </span>
          <button
            type="button"
            className="arena-exit-btn"
            onClick={onExit}
            title="Leave simulation"
          >
            Leave ↗
          </button>
        </div>
      </div>

      {/* Question / Active View */}
      {gameState === 'question' && (
        <div className="arena-card">
          {/* 15-Second Timer Bar */}
          <div className="arena-timer-bar-wrap">
            <div className="timer-info-row">
              <span className={`timer-badge ${timeLeft <= 5 ? 'urgent' : ''}`}>
                <span className="timer-icon">⏱</span>
                <span>{timeLeft}s REMAINING</span>
              </span>
              <span className="timer-rule">15-SECOND DECISION DEADLINE</span>
            </div>
            <div className="timer-track">
              <div
                className={`timer-fill ${timeLeft <= 5 ? 'urgent' : ''}`}
                style={{ width: `${(timeLeft / 15) * 100}%` }}
              />
            </div>
          </div>

          <div className="arena-card-header">
            <span className="arena-category">{currentQuestion.category}</span>
            <span className="arena-multiplier-badge">
              {RISK_TIERS[selectedRisk].name}
            </span>
          </div>

          <h2 className="arena-question-text">{currentQuestion.question}</h2>

          {/* 4 Options Grid */}
          <div className="arena-options-grid">
            {currentQuestion.options.map((opt, idx) => {
              const letter = ['A', 'B', 'C', 'D'][idx];
              const isSelected = selectedOption === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  className={`arena-option-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedOption(idx)}
                >
                  <span className="option-letter">{letter}</span>
                  <span className="option-text">{opt}</span>
                </button>
              );
            })}
          </div>

          {/* Bid Amount + Risk Selector */}
          <div className="arena-risk-section">
            {/* Bid Amount Input */}
            <div className="bid-row">
              <label htmlFor="bid-input" className="risk-title">
                YOUR BID AMOUNT
              </label>
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
                      Math.min(capital, Math.max(10, Number(e.target.value))),
                    )
                  }
                  className="bid-amount-input"
                />
              </div>
            </div>

            <div className="risk-header">
              <span className="risk-title">SELECT RISK MULTIPLIER</span>
              <span className="risk-payoff-preview">
                {selectedRisk === 'none'
                  ? 'Safe Gain: +₹100 | Bid at Risk: ₹0'
                  : `Win: +₹${potentialWin.toLocaleString()} | Lose: -₹${potentialLoss.toLocaleString()}`}
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
                selectedOption === null
                  ? `Choose an option (${timeLeft}s remaining)`
                  : `Confirm — Bid ₹${effectiveBid} · ${RISK_TIERS[selectedRisk].label}`
              }
              onClick={handleLockIn}
            />
          </div>
        </div>
      )}

      {/* Result Card with Congratulation Animation */}
      {gameState === 'result' && (
        <div className={`arena-result-card ${isWin ? 'won' : 'lost'}`}>
          {isWin ? (
            <div className="celebration-hero">
              <div className="celebration-badge">
                <span className="congrats-emoji">🎉</span>
                <span className="congrats-tag">OUTSTANDING POSITION</span>
              </div>
              <h2 className="congrats-heading">Congratulations, {callsign}!</h2>
              <p className="congrats-sub">
                Your conviction paid off. {RISK_TIERS[selectedRisk].name}{' '}
                executed cleanly within time.
              </p>
              <div className="payout-stat-card win">
                <span className="stat-label">GAINED PROFIT</span>
                <span className="stat-amount win">
                  +₹{lastDelta.toLocaleString()}
                </span>
                <span className="stat-balance">
                  New Capital Balance: ₹{capital.toLocaleString()}
                </span>
              </div>
            </div>
          ) : (
            <div className="loss-hero">
              <div className="loss-badge">
                <span className="loss-tag">
                  {isTimeout ? 'DEADLINE EXPIRED' : 'POSITION LIQUIDATED'}
                </span>
              </div>
              <h2 className="loss-heading">
                {isTimeout ? 'Time Expired (15s)' : 'Risk Realized'}
              </h2>
              <p className="loss-sub">
                {isTimeout
                  ? 'No option was selected within the 15-second deadline. Position forfeited.'
                  : 'The market moved against your position.'}
              </p>
              <div className="payout-stat-card loss">
                <span className="stat-label">CAPITAL DEDUCTION</span>
                <span className="stat-amount loss">
                  -₹{lastDelta.toLocaleString()}
                </span>
                <span className="stat-balance">
                  Remaining Capital: ₹{capital.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <div className="result-explanation">
            <span className="exp-label">EXPLANATION:</span>
            <p className="exp-text">{currentQuestion.explanation}</p>
          </div>

          <div className="arena-next-wrap">
            <LiquidMetalButton
              type="button"
              label={
                currentIndex + 1 >= QUESTIONS.length || capital <= 0
                  ? 'View Final Portfolio Outcome'
                  : 'Next Market Question (15s) →'
              }
              onClick={handleNext}
            />
          </div>
        </div>
      )}

      {/* Game Over / Summary Card */}
      {gameState === 'gameover' && (
        <div className="arena-gameover-card">
          <div className="gameover-header">
            <span className="eyebrow">SIMULATION SUMMARY</span>
            <h2>Portfolio Finalized</h2>
            <p className="gameover-trader">Trader: {callsign.toUpperCase()}</p>
          </div>

          <div className="summary-metrics">
            <div className="summary-metric-box">
              <span className="metric-label">STARTING CAPITAL</span>
              <span className="metric-val">₹1,000</span>
            </div>
            <div className="summary-metric-box highlight">
              <span className="metric-label">FINAL EQUITY</span>
              <span className="metric-val">₹{capital.toLocaleString()}</span>
            </div>
            <div className="summary-metric-box">
              <span className="metric-label">NET P&L</span>
              <span
                className={`metric-val ${capital >= 1000 ? 'profit' : 'deficit'}`}
              >
                {capital >= 1000 ? '+' : ''}₹{(capital - 1000).toLocaleString()}
              </span>
            </div>
          </div>

          <p className="gameover-message">
            {capital > 2000
              ? '🏆 Masterclass Performance! You maximized risk multipliers with exceptional market accuracy.'
              : capital >= 1000
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
