import { useState, useCallback, memo } from 'react';
import { LiquidMetalButton } from './ui/liquid-metal-button';
import { Confetti } from './Confetti';
import { RoundTimer } from './RoundTimer';
import { RiskControls, RISK_TIERS, type RiskLevel } from './RiskControls';

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

interface Props {
  callsign: string;
  onExit: () => void;
}

// Subcomponent: Player Status Bar
const PlayerStatusBar = memo(function PlayerStatusBar({
  callsign,
  capital,
  currentRound,
  totalRounds,
  onExit,
}: {
  callsign: string;
  capital: number;
  currentRound: number;
  totalRounds: number;
  onExit: () => void;
}) {
  return (
    <div className="arena-status-bar">
      <div className="arena-trader-info">
        <span className="arena-label">TRADER</span>
        <span className="arena-callsign">{callsign.toUpperCase()}</span>
      </div>

      <div className="arena-capital-box">
        <span className="arena-label">PORTFOLIO CAPITAL</span>
        <span className="arena-capital-value">
          ₹{capital.toLocaleString()}
        </span>
      </div>

      <div className="arena-actions-top">
        <span className="arena-progress">
          ROUND {currentRound} / {totalRounds}
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
  );
});

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

  const currentQuestion = QUESTIONS[currentIndex];
  const effectiveBid = Math.min(capital, Math.max(10, bidAmount));

  const resolveRound = useCallback(
    (chosen: number | null, timedOut = false) => {
      const q = QUESTIONS[currentIndex];
      const bid = Math.min(capital, Math.max(10, bidAmount));

      const calculateWinBenefit = (risk: RiskLevel, b: number) => {
        if (risk === 'none') return 100;
        if (risk === '2x') return b * 2;
        if (risk === '3x') return b * 3;
        if (risk === '5x') return b * 5;
        return 100;
      };

      const calculateDownside = (risk: RiskLevel, b: number) => {
        if (risk === 'none') return 0;
        return b;
      };

      if (chosen !== null && chosen === q.correctOption) {
        const reward = calculateWinBenefit(selectedRisk, bid);
        setCapital((prev) => prev + reward);
        setLastDelta(reward);
        setIsWin(true);
        setIsTimeout(false);
        setConfettiTrigger(true);
      } else {
        const loss = calculateDownside(selectedRisk, bid);
        setCapital((prev) => Math.max(0, prev - loss));
        setLastDelta(loss);
        setIsWin(false);
        setIsTimeout(timedOut);
        setConfettiTrigger(false);
      }
      setGameState('result');
    },
    [currentIndex, capital, bidAmount, selectedRisk]
  );

  const handleTimeout = useCallback(() => {
    resolveRound(selectedOption, selectedOption === null);
  }, [resolveRound, selectedOption]);

  const handleLockIn = useCallback(() => {
    if (selectedOption !== null) {
      resolveRound(selectedOption, false);
    }
  }, [resolveRound, selectedOption]);

  const handleNext = () => {
    setConfettiTrigger(false);
    setSelectedOption(null);
    setSelectedRisk('none');
    setIsTimeout(false);

    if (capital <= 0 || currentIndex + 1 >= QUESTIONS.length) {
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
  };

  return (
    <div className="arena-container">
      <Confetti trigger={confettiTrigger} />

      {/* Top Status Bar */}
      <PlayerStatusBar
        callsign={callsign}
        capital={capital}
        currentRound={currentIndex + 1}
        totalRounds={QUESTIONS.length}
        onExit={onExit}
      />

      {/* Question / Active View */}
      {gameState === 'question' && (
        <div className="arena-card">
          {/* Isolated 15-Second Timer Bar */}
          <RoundTimer
            roundKey={currentIndex}
            duration={15}
            onTimeout={handleTimeout}
          />

          <div className="arena-card-header">
            <span className="arena-category">{currentQuestion.category}</span>
            <span className="arena-multiplier-badge">
              {RISK_TIERS[selectedRisk].name}
            </span>
          </div>

          <h2 className="arena-question-text">{currentQuestion.question}</h2>

          {/* 4 Options Grid (Mobile-First 1 Column on small screens, 2 Columns on desktop) */}
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
                  aria-pressed={isSelected}
                >
                  <span className="option-letter">{letter}</span>
                  <span className="option-text">{opt}</span>
                </button>
              );
            })}
          </div>

          {/* Dynamic Risk Controller with Steppers, Slider & Financial Breakdown */}
          <RiskControls
            capital={capital}
            bidAmount={effectiveBid}
            selectedRisk={selectedRisk}
            onBidChange={setBidAmount}
            onRiskChange={setSelectedRisk}
          />

          {/* Primary Action Button */}
          <div className="arena-submit-wrap">
            <LiquidMetalButton
              type="button"
              label={
                selectedOption === null
                  ? 'Select an Option to Lock In'
                  : `Lock In — Bid ₹${effectiveBid} · ${RISK_TIERS[selectedRisk].label}`
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
                <span className="congrats-emoji" aria-hidden="true">🎉</span>
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
                  ? 'No option was locked in within the 15-second deadline. Position forfeited.'
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

