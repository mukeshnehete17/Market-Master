import { useState, useEffect } from 'react';
import { fetchPlayerProfile } from '../api/player';
import { logoutUser } from '../api/auth';
import type { Player } from '../types/api';

interface ProfileProps {
  illuminateId: string;
  onLogout: () => void;
}

export function Profile({ illuminateId, onLogout }: ProfileProps) {
  const [profile, setProfile] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadProfile(signal?: AbortSignal) {
      setIsLoading(true);
      setError('');
      try {
        const data = await fetchPlayerProfile(signal);
        if (signal?.aborted) return;
        if (data.success && data.player) {
          setProfile(data.player);
        }
      } catch (err: any) {
        if (signal?.aborted || err?.name === 'AbortError') return;
        setError(err?.message || 'Failed to load profile.');
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    }
    const ctrl = new AbortController();
    loadProfile(ctrl.signal);
    return () => ctrl.abort();
  }, []);

  const handleSignOut = async () => {
    await logoutUser();
    onLogout();
  };

  const capital = profile?.capital ?? 1000;
  const startingCapital = profile?.starting_capital ?? 1000;
  const netPL = profile?.net_pl ?? (capital - startingCapital);

  return (
    <div className="profile-container">
      <div className="profile-card">
        <div className="profile-header">
          <div className="op-profile-avatar">
            <img
              src="/assets/wano-luffy.png"
              alt="Wano Luffy Profile"
              className="luffy-avatar-img"
            />
          </div>
          <div>
            <h2 className="profile-heading">Trader Profile</h2>
            <span style={{ fontSize: '13px', color: '#666', fontWeight: '700' }}>
              {profile?.avatar || '🦊'} {profile?.name || illuminateId || 'Trader'}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#666', fontWeight: '800' }}>
            LOADING TRADER DATA...
          </div>
        ) : error ? (
          <div className="login-error">{error}</div>
        ) : (
          <div className="profile-details">
            <div className="profile-field">
              <span className="profile-label">USER ID</span>
              <span className="profile-value">{illuminateId ? illuminateId.toUpperCase() : profile?.name || 'N/A'}</span>
            </div>
            <div className="profile-field">
              <span className="profile-label">CAPITAL BALANCE</span>
              <span className="profile-value" style={{ color: capital >= startingCapital ? '#16a34a' : '#e11d48' }}>
                ₹{capital.toLocaleString()}
              </span>
            </div>
            <div className="profile-field">
              <span className="profile-label">NET P&L</span>
              <span className="profile-value" style={{ color: netPL >= 0 ? '#16a34a' : '#e11d48' }}>
                {netPL >= 0 ? `+₹${netPL.toLocaleString()}` : `-₹${Math.abs(netPL).toLocaleString()}`}
              </span>
            </div>
            <div className="profile-field">
              <span className="profile-label">ROUNDS COMPLETED</span>
              <span className="profile-value">{profile?.rounds_played ?? 0}</span>
            </div>
            <div className="profile-field">
              <span className="profile-label">ACCURACY SCORE</span>
              <span className="profile-value">{profile?.score ?? 0}</span>
            </div>
            <div className="profile-field">
              <span className="profile-label">ACCOUNT STATUS</span>
              <span className="profile-value active-status">{profile?.status || 'ACTIVE'}</span>
            </div>
          </div>
        )}

        <div className="profile-actions">
          <button
            type="button"
            className="profile-logout-btn"
            onClick={handleSignOut}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
