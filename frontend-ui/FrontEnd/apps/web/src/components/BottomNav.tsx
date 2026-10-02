export type TabType = 'game' | 'rankings' | 'history' | 'account' | 'admin';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  showAdmin?: boolean;
}

export function BottomNav({ activeTab, onTabChange, showAdmin }: BottomNavProps) {
  return (
    <nav className="bottom-nav-container" aria-label="Primary">
      <button
        type="button"
        aria-label="Game"
        aria-current={activeTab === 'game' ? 'page' : undefined}
        className={`nav-btn ${activeTab === 'game' ? 'active' : ''}`}
        onClick={() => onTabChange('game')}
      >
        <span className="nav-icon" aria-hidden="true">🎮</span>
        <span className="nav-label">Game</span>
      </button>
      <button
        type="button"
        aria-label="Rankings"
        aria-current={activeTab === 'rankings' ? 'page' : undefined}
        className={`nav-btn ${activeTab === 'rankings' ? 'active' : ''}`}
        onClick={() => onTabChange('rankings')}
      >
        <span className="nav-icon" aria-hidden="true">🏆</span>
        <span className="nav-label">Rankings</span>
      </button>
      <button
        type="button"
        aria-label="History"
        aria-current={activeTab === 'history' ? 'page' : undefined}
        className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`}
        onClick={() => onTabChange('history')}
      >
        <span className="nav-icon" aria-hidden="true">📜</span>
        <span className="nav-label">History</span>
      </button>
      <button
        type="button"
        aria-label="Account"
        aria-current={activeTab === 'account' ? 'page' : undefined}
        className={`nav-btn ${activeTab === 'account' ? 'active' : ''}`}
        onClick={() => onTabChange('account')}
      >
        <span className="nav-icon" aria-hidden="true">👤</span>
        <span className="nav-label">Account</span>
      </button>
      {showAdmin && (
        <button
          type="button"
          aria-label="Admin console"
          aria-current={activeTab === 'admin' ? 'page' : undefined}
          className={`nav-btn ${activeTab === 'admin' ? 'active' : ''}`}
          onClick={() => onTabChange('admin')}
        >
          <span className="nav-icon" aria-hidden="true">🛡️</span>
          <span className="nav-label">Admin</span>
        </button>
      )}
    </nav>
  );
}
