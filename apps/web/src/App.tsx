import { useState } from 'react';
import Header from './components/Header';
import JoinGame from './components/JoinGame';
import { GameArena } from './components/GameArena';
import { GradientBlurBg } from './components/GradientBlurBg';

interface PlayerSession {
  callsign: string;
  gameCode: string;
}

export default function App() {
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [illuminateId, setIlluminateId] = useState('');
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <>
      {/* 21st.dev Gradient Blur Background with Grid Pattern */}
      <GradientBlurBg />

      <div className="paper">
        <Header
          isIngame={session !== null}
          callsign={session?.callsign}
          onLeave={() => setSession(null)}
          illuminateId={illuminateId}
          onIlluminateLogin={(id) => {
            setIlluminateId(id);
            setIsLoginOpen(false);
          }}
          isLoginOpen={isLoginOpen}
          onToggleLogin={(open) => setIsLoginOpen(open)}
        />
        <main>
          {session ? (
            <GameArena
              callsign={session.callsign}
              onExit={() => setSession(null)}
            />
          ) : (
            <section className="join-section" aria-label="Join the game">
              <JoinGame
                illuminateId={illuminateId}
                onOpenLogin={() => setIsLoginOpen(true)}
                onJoin={(newSession) => setSession(newSession)}
              />
            </section>
          )}
        </main>
      </div>
    </>
  );
}
