import { useState, useEffect, lazy, Suspense } from 'react';
import JoinGame from './components/JoinGame';
import { GameArena } from './components/GameArena';
import { GradientBlurBg } from './components/GradientBlurBg';
import { Login } from './components/Login';
import { BottomNav, type TabType } from './components/BottomNav';
import { fetchCurrentUser, logoutUser } from './api/auth';
import { fetchCurrentGameState } from './api/game';
import type { User } from './types/api';

// Code-split secondary views to keep initial bundle ultra-light on mobile
const Leaderboard = lazy(() =>
  import('./components/Leaderboard').then((m) => ({ default: m.Leaderboard }))
);
const History = lazy(() =>
  import('./components/History').then((m) => ({ default: m.History }))
);
const Profile = lazy(() =>
  import('./components/Profile').then((m) => ({ default: m.Profile }))
);
const AdminPanel = lazy(() =>
  import('./components/admin/AdminPanel').then((m) => ({ default: m.AdminPanel }))
);

function TabLoader({ label = 'Loading...' }: { label?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        color: '#000',
        fontWeight: 800,
        fontSize: '14px',
        letterSpacing: '0.05em',
      }}
    >
      <div style={{ fontSize: '28px', marginBottom: '10px' }}>⚡</div>
      <span>{label}</span>
    </div>
  );
}


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
          if (user.role === 'admin') {
            setActiveTab('admin');
          } else {
            try {
              const state = await fetchCurrentGameState();
              if (state && state.game_state !== 'not_joined' && state.player) {
                setSession({
                  callsign: state.player.name || user.name,
                  gameCode: state.game_code || '',
                  avatar: state.player.avatar || user.avatar || '🦊',
                });
              }
            } catch {
              // Not in an active game
            }
          }
        }
      } catch {
        // No active auth session
      } finally {
        setIsCheckingAuth(false);
      }
    }
    checkAuth();
  }, []);

  const handleLogin = async (user: User) => {
    setCurrentUser(user);
    if (user.role === 'admin') {
      setActiveTab('admin');
    } else {
      try {
        const state = await fetchCurrentGameState();
        if (state && state.game_state !== 'not_joined' && state.player) {
          setSession({
            callsign: state.player.name || user.name,
            gameCode: state.game_code || '',
            avatar: state.player.avatar || user.avatar || '🦊',
          });
        }
      } catch {
        // Not in an active game
      }
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setSession(null);
    setActiveTab('game');
  };

  const isAdmin = currentUser?.role === 'admin';

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
              <Login onLogin={handleLogin} />
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
                    defaultName={currentUser.name}
                    onJoin={(newSession) => setSession(newSession)}
                  />
                </section>
              )}

              {activeTab === 'rankings' && (
                <section className="join-section" aria-label="Leaderboard Rankings">
                  <Suspense fallback={<TabLoader label="Loading Leaderboard..." />}>
                    <Leaderboard />
                  </Suspense>
                </section>
              )}

              {activeTab === 'history' && (
                <section className="join-section" aria-label="Trade History">
                  <Suspense fallback={<TabLoader label="Loading Trade History..." />}>
                    <History />
                  </Suspense>
                </section>
              )}

              {activeTab === 'account' && (
                <section className="join-section" aria-label="Trader Profile">
                  <Suspense fallback={<TabLoader label="Loading Profile..." />}>
                    <Profile
                      illuminateId={currentUser.id}
                      onLogout={handleLogout}
                    />
                  </Suspense>
                </section>
              )}

              {activeTab === 'admin' && isAdmin && (
                <section className="join-section" aria-label="Admin Console">
                  <Suspense fallback={<TabLoader label="Loading Admin Console..." />}>
                    <AdminPanel />
                  </Suspense>
                </section>
              )}

              <BottomNav activeTab={activeTab} onTabChange={setActiveTab} showAdmin={isAdmin} />

            </>
          )}
        </main>
      </div>
    </>
  );
}
