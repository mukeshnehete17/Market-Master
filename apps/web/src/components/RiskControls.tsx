import { memo, useId } from 'react';
import { LiquidGlassButton } from './ui/liquid-glass-button';

export type RiskLevel = 'none' | '2x' | '3x' | '5x';

export interface RiskConfig {
  label: string;
  name: string;
  multiplier: number;
}

export const RISK_TIERS: Record<RiskLevel, RiskConfig> = {
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

interface RiskControlsProps {
  capital: number;
  bidAmount: number;
  selectedRisk: RiskLevel;
  onBidChange: (amount: number) => void;
  onRiskChange: (risk: RiskLevel) => void;
}

export const RiskControls = memo(function RiskControls({
  capital,
  bidAmount,
  selectedRisk,
  onBidChange,
  onRiskChange,
}: RiskControlsProps) {
  const sliderId = useId();
  const effectiveBid = Math.min(capital, Math.max(10, bidAmount));
  const riskPercentage = capital > 0 ? Math.round((effectiveBid / capital) * 100) : 0;

  // Potential calculations
  const calculateWin = (risk: RiskLevel, bid: number) => {
    if (risk === 'none') return 100;
    if (risk === '2x') return bid * 2;
    if (risk === '3x') return bid * 3;
    if (risk === '5x') return bid * 5;
    return 100;
  };

  const calculateLoss = (risk: RiskLevel, bid: number) => {
    if (risk === 'none') return 0;
    return bid;
  };

  const potentialWin = calculateWin(selectedRisk, effectiveBid);
  const potentialLoss = calculateLoss(selectedRisk, effectiveBid);
  const capitalAtRisk = selectedRisk === 'none' ? 0 : effectiveBid;

  const handleStep = (deltaPercent: number) => {
    const currentPercent = riskPercentage;
    const newPercent = Math.min(100, Math.max(10, currentPercent + deltaPercent));
    const newAmount = Math.round((newPercent / 100) * capital);
    onBidChange(Math.min(capital, Math.max(10, newAmount)));
  };

  const handleSlider = (percent: number) => {
    const newAmount = Math.round((percent / 100) * capital);
    onBidChange(Math.min(capital, Math.max(10, newAmount)));
  };

  return (
    <div className="arena-risk-section">
      {/* Dynamic Risk Header & Stepper Control */}
      <div className="risk-dynamic-header">
        <div className="risk-title-badge">YOUR RISK ALLOCATION</div>
        <div className="risk-percentage-stepper">
          <button
            type="button"
            className="risk-step-btn"
            onClick={() => handleStep(-10)}
            disabled={effectiveBid <= 10}
            aria-label="Decrease risk allocation by 10%"
          >
            −
          </button>
          <div className="risk-percent-display">
            <span className="percent-val">{riskPercentage}%</span>
            <span className="percent-sub">OF CAPITAL</span>
          </div>
          <button
            type="button"
            className="risk-step-btn"
            onClick={() => handleStep(10)}
            disabled={effectiveBid >= capital}
            aria-label="Increase risk allocation by 10%"
          >
            +
          </button>
        </div>
      </div>

      {/* Touch-optimized Fluid Range Slider */}
      <div className="risk-slider-container">
        <div className="slider-labels-row">
          <span>10% MIN</span>
          <span>50%</span>
          <span>100% MAX</span>
        </div>
        <div className="slider-track-wrap">
          <input
            id={sliderId}
            type="range"
            min={10}
            max={100}
            step={5}
            value={riskPercentage}
            onChange={(e) => handleSlider(Number(e.target.value))}
            className="risk-range-slider"
            aria-label="Risk percentage slider"
          />
        </div>
      </div>

      {/* Financial Exposure 4-Metric Grid */}
      <div className="risk-metrics-grid">
        <div className="risk-metric-card">
          <span className="metric-tag">AVAILABLE CAPITAL</span>
          <span className="metric-num">₹{capital.toLocaleString()}</span>
        </div>
        <div className="risk-metric-card highlight">
          <span className="metric-tag">CAPITAL AT RISK</span>
          <span className="metric-num">₹{capitalAtRisk.toLocaleString()}</span>
        </div>
        <div className="risk-metric-card win">
          <span className="metric-tag">POTENTIAL PROFIT</span>
          <span className="metric-num win">+{`₹${potentialWin.toLocaleString()}`}</span>
        </div>
        <div className="risk-metric-card loss">
          <span className="metric-tag">POTENTIAL LOSS</span>
          <span className="metric-num loss">-{`₹${potentialLoss.toLocaleString()}`}</span>
        </div>
      </div>

      {/* Risk Multiplier Presets */}
      <div className="risk-multiplier-header">
        <span className="risk-sub-heading">SELECT RISK CONVICTION</span>
        <span className="risk-current-badge">{RISK_TIERS[selectedRisk].name}</span>
      </div>

      <div className="risk-pills-row">
        {(['none', '2x', '3x', '5x'] as RiskLevel[]).map((tier) => {
          const config = RISK_TIERS[tier];
          const active = selectedRisk === tier;
          const winAmount = calculateWin(tier, effectiveBid);

          return (
            <LiquidGlassButton
              key={tier}
              active={active}
              onClick={() => onRiskChange(tier)}
            >
              <span className="risk-pill-name">{config.label}</span>
              <span className="risk-pill-desc">
                {tier === 'none' ? '+₹100 Safe' : `+₹${winAmount.toLocaleString()}`}
              </span>
            </LiquidGlassButton>
          );
        })}
      </div>
    </div>
  );
});
