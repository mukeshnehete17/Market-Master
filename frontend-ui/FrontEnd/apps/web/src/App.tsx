import { useState, useEffect } from 'react';
import JoinGame from './components/JoinGame';
import { GameArena } from './components/GameArena';
import { GradientBlurBg } from './components/GradientBlurBg';
import { Profile } from './components/Profile';
import { Login } from './components/Login';
import { Leaderboard } from './components/Leaderboard';
import { History } from './components/History';
import { BottomNav, type TabType } from './components/BottomNav';
import { fetchCurrentUser, logoutUser } from './api/auth';
import type { User } from './types/api';

interface PlayerSession {
  callsign: string;
  gameCode: string;
  avatar: string;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('game');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check existing token/session on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const user = await fetchCurrentUser();
        if (user) {
          setCurrentUser(user);
        }
      } catch {
        // No active auth session
      } finally {
        setIsCheckingAuth(false);
      }
    }
    checkAuth();
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setSession(null);
    setActiveTab('game');
  };

  if (isCheckingAuth) {
    return (
      <>
        <GradientBlurBg />
        <div className="paper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#000', fontWeight: '800', fontSize: '18px' }}>
            ⚡ Initializing Market Master...
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <GradientBlurBg />

      <div className="paper">
        <main className="main-content">
          {!currentUser ? (
            <section className="login-section" aria-label="Login">
              <Login onLogin={(user) => setCurrentUser(user)} />
            </section>
          ) : session && activeTab === 'game' ? (
            <GameArena
              callsign={session.callsign}
              onExit={() => setSession(null)}
            />
          ) : (
            <>
              {activeTab === 'game' && (
                <section className="join-section" aria-label="Join the game">
                  <JoinGame
                    illuminateId={currentUser.id}
                    onJoin={(newSession) => setSession(newSession)}
                  />
                </section>
              )}

              {activeTab === 'rankings' && (
                <section className="join-section" aria-label="Leaderboard Rankings">
                  <Leaderboard />
                </section>
              )}

              {activeTab === 'history' && (
                <section className="join-section" aria-label="Trade History">
                  <History />
                </section>
              )}

              {activeTab === 'account' && (
                <section className="join-section" aria-label="Trader Profile">
                  <Profile
                    illuminateId={currentUser.id}
                    onLogout={handleLogout}
                  />
                </section>
              )}

              <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
            </>
          )}
        </main>
      </div>
    </>
  );
}
