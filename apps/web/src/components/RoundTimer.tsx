import { useEffect, useState, memo } from 'react';

interface RoundTimerProps {
  roundKey: string | number; // Resets timer when round changes
  duration?: number;
  onTimeout: () => void;
  isPaused?: boolean;
}

export const RoundTimer = memo(function RoundTimer({
  roundKey,
  duration = 15,
  onTimeout,
  isPaused = false,
}: RoundTimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    setTimeLeft(duration);
    if (isPaused) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [roundKey, duration, isPaused, onTimeout]);

  const percentage = Math.max(0, Math.min(100, (timeLeft / duration) * 100));
  const isUrgent = timeLeft <= 5;

  return (
    <div className="arena-timer-bar-wrap" aria-label={`Round timer: ${timeLeft} seconds remaining`}>
      <div className="timer-info-row">
        <span className={`timer-badge ${isUrgent ? 'urgent' : ''}`}>
          <span className="timer-icon" aria-hidden="true">⏱</span>
          <span>{timeLeft}s REMAINING</span>
        </span>
        <span className="timer-rule">15-SECOND DECISION DEADLINE</span>
      </div>
      <div className="timer-track" role="progressbar" aria-valuenow={timeLeft} aria-valuemin={0} aria-valuemax={duration}>
        <div
          className={`timer-fill ${isUrgent ? 'urgent' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
});
