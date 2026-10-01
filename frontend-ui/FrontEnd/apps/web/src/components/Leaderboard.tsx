import { useState, useEffect } from 'react';
import { fetchLeaderboard } from '../api/leaderboard';
import type { RankedPlayer } from '../types/api';

export function Leaderboard() {
  const [rankings, setRankings] = useState<RankedPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLeaderboard = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchLeaderboard();
      if (data.success && data.rankings) {
        setRankings(data.rankings);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load rankings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, []);

  return (
    <div className="profile-container">
      <div className="profile-card" style={{ maxWidth: '580px' }}>
        <div className="profile-header">
          <div className="profile-avatar" style={{ fontSize: '24px' }}>
            🏆
          </div>
          <div>
            <h2 className="profile-heading">Live Rankings</h2>
            <span style={{ fontSize: '12px', color: '#666', fontWeight: '700' }}>
              MARKET MASTER LEADERBOARD
            </span>
          </div>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#666', fontWeight: '800' }}>
            LOADING LIVE RANKINGS...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div className="login-error" style={{ marginBottom: '16px' }}>{error}</div>
            <button
              type="button"
              onClick={loadLeaderboard}
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
        ) : (
          <div className="profile-details" style={{ gap: '10px' }}>
            {rankings.map((player, idx) => {
              const rank = player.rank || idx + 1;
              const isFirst = rank === 1;
              const isTopThree = rank <= 3;
              const rankIcon =
                rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

              return (
                <div
                  key={player.name + idx}
                  className="profile-field"
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: player.is_me
                      ? 'rgba(0, 0, 0, 0.08)'
                      : isFirst
                        ? 'rgba(255, 215, 0, 0.12)'
                        : '#ffffff',
                    border: player.is_me ? '2px solid #000000' : '1px solid #eaeaea',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span
                      style={{
                        fontSize: isTopThree ? '18px' : '13px',
                        fontWeight: '800',
                        minWidth: '28px',
                        textAlign: 'center',
                      }}
                    >
                      {rankIcon}
                    </span>
                    <span style={{ fontSize: '20px' }}>{player.avatar || '👤'}</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: '800',
                          color: '#000000',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        {player.name}
                        {player.is_me && (
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              background: '#000',
                              color: '#fff',
                              borderRadius: '4px',
                            }}
                          >
                            YOU
                          </span>
                        )}
                      </span>
                      {player.badge && (
                        <span style={{ fontSize: '11px', color: '#666', fontWeight: '700' }}>
                          {player.badge}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        fontSize: '15px',
                        fontWeight: '800',
                        color: player.capital >= 1000 ? '#16a34a' : '#e11d48',
                      }}
                    >
                      ₹{player.capital.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={loadLeaderboard}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              background: '#f0f0f0',
              border: '1px solid #ddd',
              color: '#000',
              fontWeight: '800',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            🔄 Refresh Rankings
          </button>
        </div>
      </div>
    </div>
  );
}
