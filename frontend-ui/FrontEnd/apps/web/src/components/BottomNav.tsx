export type TabType = 'game' | 'rankings' | 'history' | 'account' | 'admin';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  showAdmin?: boolean;
}

export function BottomNav({ activeTab, onTabChange, showAdmin }: BottomNavProps) {
  return (
    <div className="bottom-nav-container">
      <button
        type="button"
        className={`nav-btn ${activeTab === 'game' ? 'active' : ''}`}
        onClick={() => onTabChange('game')}
      >
        <span className="nav-icon">🎮</span>
        <span className="nav-label">Game</span>
      </button>
      <button
        type="button"
        className={`nav-btn ${activeTab === 'rankings' ? 'active' : ''}`}
        onClick={() => onTabChange('rankings')}
      >
        <span className="nav-icon">🏆</span>
        <span className="nav-label">Rankings</span>
      </button>
      <button
        type="button"
        className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`}
        onClick={() => onTabChange('history')}
      >
        <span className="nav-icon">📜</span>
        <span className="nav-label">History</span>
      </button>
      <button
        type="button"
        className={`nav-btn ${activeTab === 'account' ? 'active' : ''}`}
        onClick={() => onTabChange('account')}
      >
        <span className="nav-icon">👤</span>
        <span className="nav-label">Account</span>
      </button>
      {showAdmin && (
        <button
          type="button"
          className={`nav-btn ${activeTab === 'admin' ? 'active' : ''}`}
          onClick={() => onTabChange('admin')}
        >
          <span className="nav-icon">🛡️</span>
          <span className="nav-label">Admin</span>
        </button>
      )}
    </div>
  );
}
