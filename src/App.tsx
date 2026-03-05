import { useEffect, useRef, useState } from 'react';
import { GameEngine } from './engine/GameEngine';
import type { GameState } from './engine/types';
import { GAME_WIDTH, GAME_HEIGHT } from './game/MapDef';
import { HealthBar } from './components/HealthBar';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Engine
    const engine = new GameEngine(canvasRef.current);
    engineRef.current = engine;
    engine.start();

    // Loop for UI React state updates (syncing at 30fps is enough for UI)
    const uiInterval = setInterval(() => {
      if (engineRef.current) {
        setGameState({...engineRef.current.getState()});
      }
    }, 1000 / 30);

    return () => {
      engine.stop();
      clearInterval(uiInterval);
    };
  }, []);

  const p1 = gameState?.players.find(p => p.id === 'p1');
  const p2 = gameState?.players.find(p => p.id === 'p2');

  return (
    <div className="h-screen w-full flex flex-col bg-slate-950 overflow-hidden">
      <div className="max-w-5xl mx-auto flex flex-col gap-4 w-full flex-1 min-h-0 py-4 px-4">
        {/* Header - Title & Controls */}
        <header className="shrink-0 flex flex-col items-center gap-1 sm:gap-2 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-widest text-white drop-shadow-lg">
            🏹 PIXEL ARROW DUEL 🏹
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm">
            <span className="text-red-400 font-bold">P1 (RED):</span> WASD to move, Space to shoot
          </p>
          <p className="text-slate-400 text-xs sm:text-sm">
            <span className="text-blue-400 font-bold">P2 (BLUE):</span> Arrows to move, Enter to shoot
          </p>
        </header>

        {/* Game Container - Centered, fits remaining height */}
        <div className="flex-1 min-h-0 flex items-center justify-center w-full">
          <div className="relative shadow-2xl border-4 border-slate-700/50 rounded-lg overflow-hidden bg-slate-900 inline-block">
            <canvas
              ref={canvasRef}
              width={GAME_WIDTH}
              height={GAME_HEIGHT}
              className="block outline-none"
              tabIndex={0}
              onMouseEnter={(e) => e.currentTarget.focus()}
            />

            {/* UI Overlay - Health bars & Match Over */}
            {gameState && (
              <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-start gap-4 w-full">
                  <HealthBar
                    label="P1"
                    health={p1?.health || 0}
                    maxHealth={100}
                    colorClass="bg-red-500"
                  />
                  <HealthBar
                    label="P2"
                    health={p2?.health || 0}
                    maxHealth={100}
                    colorClass="bg-blue-500"
                    isRightToLeft={true}
                  />
                </div>

                {gameState.matchOver && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                    <h2 className={`text-4xl sm:text-5xl font-bold mb-4 ${gameState.winner?.includes('Blue') ? 'text-blue-500' : 'text-red-500'} drop-shadow-xl saturate-150`}>
                      {gameState.winner} Wins!
                    </h2>
                    <p className="text-white/80 animate-pulse text-xl">
                      Restarting in {Math.ceil(gameState.resetTimer / 60)}...
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
