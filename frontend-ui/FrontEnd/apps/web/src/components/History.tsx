import { useState, useEffect } from 'react';
import { fetchTradeHistory } from '../api/player';
import type { TradeHistoryItem } from '../types/api';

export function History() {
  const [history, setHistory] = useState<TradeHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchTradeHistory(signal);
      if (signal?.aborted) return;
      if (data.success && data.history) {
        setHistory(data.history);
      }
    } catch (err: any) {
      if (signal?.aborted || err?.name === 'AbortError') return;
      setError(err?.message || 'Failed to load trade history.');
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  };

  useEffect(() => {
    const ctrl = new AbortController();
    loadHistory(ctrl.signal);
    return () => ctrl.abort();
  }, []);

  return (
    <div className="profile-container">
      <div className="profile-card" style={{ maxWidth: '640px' }}>
        <div className="profile-header">
          <div className="profile-avatar" style={{ fontSize: '24px' }}>
            📜
          </div>
          <div>
            <h2 className="profile-heading">Trade History</h2>
            <span style={{ fontSize: '12px', color: '#666', fontWeight: '700' }}>
              ROUND-BY-ROUND SETTLEMENT LOG
            </span>
          </div>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#666', fontWeight: '800' }}>
            LOADING POSITION LOGS...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div className="login-error" style={{ marginBottom: '16px' }}>{error}</div>
            <button
              type="button"
              onClick={() => { void loadHistory(); }}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: '#000',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '700',
              }}
            >
              Retry
            </button>
          </div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#777' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>⏳</div>
            <p style={{ fontWeight: '800', margin: 0 }}>NO SETTLED POSITIONS YET</p>
            <p style={{ fontSize: '13px', color: '#999', marginTop: '6px' }}>
              Complete rounds in the Game Arena to generate authoritative financial records.
            </p>
          </div>
        ) : (
          <div className="profile-details" style={{ gap: '14px' }}>
            {history.map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: '#ffffff',
                  border: '1px solid #eaeaea',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #f0f0f0',
                    paddingBottom: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        background: '#000',
                        color: '#fff',
                        borderRadius: '6px',
                        fontWeight: '800',
                      }}
                    >
                      ROUND {item.round}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontWeight: '800',
                        background: item.is_correct ? 'rgba(22, 163, 74, 0.15)' : 'rgba(225, 29, 72, 0.15)',
                        color: item.is_correct ? '#16a34a' : '#e11d48',
                      }}
                    >
                      {item.is_correct ? 'PROFIT' : 'LOSS'}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '15px',
                      fontWeight: '800',
                      color: item.is_correct ? '#16a34a' : '#e11d48',
                    }}
                  >
                    {item.financial_change}
                  </span>
                </div>

                <p style={{ fontSize: '14px', fontWeight: '700', color: '#111', margin: 0 }}>
                  {item.question_text}
                </p>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '12px',
                    color: '#666',
                    background: '#f9f9f9',
                    padding: '8px 12px',
                    borderRadius: '8px',
                  }}
                >
                  <div>
                    <span>Selected: <strong>{item.selected_option}</strong></span>
                    {!item.is_correct && item.correct_answer && (
                      <span style={{ marginLeft: '10px', color: '#16a34a' }}>
                        Correct: <strong>{item.correct_answer}</strong>
                      </span>
                    )}
                  </div>
                  <div>
                    <span>Risk: <strong>{item.risk_multiplier}x</strong> · Balance: <strong>₹{item.capital_after.toLocaleString()}</strong></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
