import { useCallback, useEffect, useRef, useState } from "react";
import { GameEngine, type EngineMode } from "./engine/GameEngine";
import type { GameState } from "./engine/types";
import { GAME_WIDTH, GAME_HEIGHT } from "./game/MapDef";
import { HealthBar } from "./components/HealthBar";
import { OnlineLobby } from "./ui/OnlineLobby";
import { createHostController } from "./multiplayer/host-controller";
import { createGuestController } from "./multiplayer/guest-controller";
import { createRoom, joinRoom } from "./multiplayer/room";
import type { DataConnection } from "peerjs";
import type Peer from "peerjs";

type Screen = "menu" | "local" | "online-lobby" | "online-game";

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const cleanupControllerRef = useRef<(() => void) | null>(null);

  const [screen, setScreen] = useState<Screen>("menu");
  const [gameState, setGameState] = useState<GameState | null>(null);

  // Online lobby (host)
  const [hostPeerId, setHostPeerId] = useState<string | null>(null);
  const [hostDisplayCode, setHostDisplayCode] = useState<string | null>(null);

  // Online game
  const [role, setRole] = useState<"host" | "guest" | null>(null);
  const [connection, setConnection] = useState<DataConnection | null>(null);
  const [disconnected, setDisconnected] = useState(false);

  // Guest join
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // UI state
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  const goToMenu = useCallback(() => {
    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch {
        // ignore
      }
      peerRef.current = null;
    }
    if (cleanupControllerRef.current) {
      cleanupControllerRef.current();
      cleanupControllerRef.current = null;
    }
    if (engineRef.current) {
      engineRef.current.stop();
      engineRef.current = null;
    }
    setConnection(null);
    setRole(null);
    setHostPeerId(null);
    setHostDisplayCode(null);
    setDisconnected(false);
    setJoinError(null);
    setJoining(false);
    setShowQuitConfirm(false);
    setScreen("menu");
  }, []);

  // Create room (host)
  const handleCreateRoom = useCallback(async () => {
    try {
      const result = await createRoom();
      peerRef.current = result.peer;
      setHostPeerId(result.peerId);
      setHostDisplayCode(result.displayCode);
      setRole("host");
      setScreen("online-lobby");

      result.connectionPromise
        .then((conn) => {
          setConnection(conn);
          setScreen("online-game");
        })
        .catch(() => {
          setJoinError("Connection failed");
        });
    } catch (err) {
      setJoinError(
        err instanceof Error ? err.message : "Failed to create room",
      );
    }
  }, []);

  // Join room (guest)
  const handleJoinRoom = useCallback((roomCode: string) => {
    if (!roomCode.trim()) return;
    setJoining(true);
    setJoinError(null);
    setRole("guest");
    setScreen("online-lobby");

    joinRoom(roomCode)
      .then((result) => {
        peerRef.current = result.peer;
        return result.connectionPromise;
      })
      .then((conn) => {
        setConnection(conn);
        setScreen("online-game");
      })
      .catch((err) => {
        setJoinError(err instanceof Error ? err.message : "Failed to join");
        setShowQuitConfirm(false);
        setScreen("menu");
        setRole(null);
      })
      .finally(() => {
        setJoining(false);
      });
  }, []);

  // Cancel lobby
  const handleCancelLobby = useCallback(() => {
    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch {
        // ignore
      }
      peerRef.current = null;
    }
    setHostPeerId(null);
    setHostDisplayCode(null);
    setRole(null);
    setJoinError(null);
    setJoining(false);
    setShowQuitConfirm(false);
    setScreen("menu");
  }, []);

  // Local game: mount engine when screen is local
  useEffect(() => {
    if (screen !== "local" || !canvasRef.current) return;
    const engine = new GameEngine(canvasRef.current);
    engineRef.current = engine;
    engine.start();
    const uiInterval = setInterval(() => {
      if (engineRef.current) setGameState({ ...engineRef.current.getState() });
    }, 1000 / 30);
    return () => {
      engine.stop();
      engineRef.current = null;
      clearInterval(uiInterval);
    };
  }, [screen]);

  // Escape key listener for quit confirmation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (screen === "local" || screen === "online-game") {
          setShowQuitConfirm((prev) => !prev);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [screen]);

  // Online game: mount engine (host or guest) and controller when we have connection
  useEffect(() => {
    if (screen !== "online-game" || !canvasRef.current || !connection || !role)
      return;

    const mode: EngineMode = role === "host" ? "host" : "guest";
    const engine = new GameEngine(canvasRef.current, { mode });
    engineRef.current = engine;

    if (role === "host") {
      engine.start();
      cleanupControllerRef.current = createHostController(engine, connection, {
        onDisconnect: () => setDisconnected(true),
      });
    } else {
      engine.startGuest();
      cleanupControllerRef.current = createGuestController(engine, connection, {
        onDisconnect: () => setDisconnected(true),
      });
    }

    const uiInterval = setInterval(() => {
      if (engineRef.current) setGameState({ ...engineRef.current.getState() });
    }, 1000 / 30);

    return () => {
      if (cleanupControllerRef.current) {
        cleanupControllerRef.current();
        cleanupControllerRef.current = null;
      }
      engine.stop();
      engineRef.current = null;
      clearInterval(uiInterval);
    };
  }, [screen, connection, role]);

  const p1 = gameState?.players.find((p) => p.id === "p1");
  const p2 = gameState?.players.find((p) => p.id === "p2");
  const showGameCanvas = screen === "local" || screen === "online-game";

  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-950 overflow-x-hidden selection:bg-blue-500/30">
      <div className="max-w-6xl mx-auto flex flex-col gap-6 w-full flex-1 py-6 px-4 sm:px-8">
        <header className="shrink-0 flex flex-col items-center gap-2 text-center mt-4 mb-2">
          <div className="relative group">
            <h1 className="text-2xl sm:text-4xl font-black tracking-[0.2em] text-transparent bg-clip-text bg-linear-to-b from-white to-slate-500 drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
              PIXEL ARROW DUEL
            </h1>
            <div className="absolute -inset-4 bg-linear-to-r from-red-500/0 via-blue-500/10 to-red-500/0 blur-2xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          </div>

          <div className="h-px w-24 bg-linear-to-r from-transparent via-slate-700 to-transparent my-2" />

          {showGameCanvas && (
            <div className="flex flex-wrap justify-center gap-4 text-[10px] sm:text-xs font-semibold tracking-wider text-slate-400 uppercase">
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/20 bg-red-500/5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                <span className="text-red-400 font-black">P1:</span> WASD +
                SPACE
              </span>
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                <span className="text-blue-400 font-black">P2:</span> ARROWS +
                ENTER
              </span>
            </div>
          )}
        </header>

        {screen === "menu" && (
          <div className="flex-1 flex flex-col items-center justify-center -mt-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl px-4">
              <button
                type="button"
                onClick={() => setScreen("local")}
                className="group relative glass-panel glass-button p-8 rounded-2xl flex flex-col items-center gap-4 hover:scale-[1.02]"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                  <span className="text-2xl">🎮</span>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white mb-1">
                    Local Play
                  </h3>
                  <p className="text-slate-400 text-sm">
                    Battle on one keyboard
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={handleCreateRoom}
                className="group relative glass-panel glass-button p-8 rounded-2xl flex flex-col items-center gap-4 border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/50 hover:scale-[1.02]"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-900/50 flex items-center justify-center group-hover:bg-blue-800/50 transition-colors">
                  <span className="text-2xl text-blue-400">🌐</span>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white mb-1">
                    Create Room
                  </h3>
                  <p className="text-slate-400 text-sm">Host an online duel</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRole("guest");
                  setScreen("online-lobby");
                }}
                className="group relative glass-panel glass-button p-8 rounded-2xl flex flex-col items-center gap-4 col-span-1 sm:col-span-2 hover:scale-[1.01]"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                  <span className="text-2xl">🤝</span>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white mb-1">
                    Join Friend
                  </h3>
                  <p className="text-slate-400 text-sm">
                    Enter a room code to play
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {screen === "online-lobby" && role && (
          <div className="flex-1 flex items-center justify-center -mt-12">
            <div className="w-full max-w-xl glass-panel p-8 sm:p-12 rounded-3xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-blue-500/50 to-transparent" />
              <OnlineLobby
                role={role}
                peerId={hostPeerId ?? undefined}
                displayCode={hostDisplayCode ?? undefined}
                onCancel={handleCancelLobby}
                onJoin={role === "guest" ? handleJoinRoom : undefined}
                joining={joining}
                joinError={joinError}
              />
            </div>
          </div>
        )}

        {showGameCanvas && (
          <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0">
            <div className="relative w-full max-w-4xl aspect-4/3 sm:aspect-video glass-panel rounded-3xl overflow-hidden p-2 sm:p-4 group">
              {/* Internal Bezels */}
              <div className="absolute inset-0 border-20 border-black/10 pointer-events-none rounded-3xl" />

              <div className="relative w-full h-full bg-slate-900 rounded-xl overflow-hidden shadow-2xl">
                <canvas
                  ref={canvasRef}
                  width={GAME_WIDTH}
                  height={GAME_HEIGHT}
                  className="w-full h-full object-contain outline-none"
                  tabIndex={0}
                  onMouseEnter={(e) => e.currentTarget.focus()}
                />

                {gameState && (
                  <div className="absolute inset-x-0 top-0 pointer-events-none z-10 p-2 sm:p-4">
                    <div className="flex justify-between items-start gap-8 w-full">
                      <HealthBar
                        label="Player 1"
                        health={p1?.health ?? 0}
                        maxHealth={100}
                        colorClass="bg-red-500"
                      />

                      <div className="hidden sm:flex flex-col items-center -mt-2">
                        <span className="text-[10px] pixel-font text-slate-500 uppercase tracking-widest mb-1">
                          Versus
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500/50" />
                          <div className="w-12 h-px bg-linear-to-r from-red-500/50 via-slate-700 to-blue-500/50" />
                          <div className="w-2 h-2 rounded-full bg-blue-500/50" />
                        </div>
                      </div>

                      <HealthBar
                        label="Player 2"
                        health={p2?.health ?? 0}
                        maxHealth={100}
                        colorClass="bg-blue-500"
                        isRightToLeft
                      />
                    </div>

                    {gameState.matchOver && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md z-30 transition-all duration-500 p-4">
                        <div className="glass-panel p-6 sm:p-10 rounded-3xl flex flex-col items-center gap-4 sm:gap-6 border-white/20 animate-in zoom-in duration-300 max-w-full text-center">
                          <div className="h-1 w-16 sm:w-24 bg-linear-to-r from-transparent via-accent-gold to-transparent" />
                          <h2
                            className={`text-xl sm:text-3xl md:text-5xl font-black italic tracking-tighter uppercase drop-shadow-[0_0_30px_rgba(255,255,255,0.3)] ${
                              gameState.winner?.includes("Blue")
                                ? "text-blue-400"
                                : "text-red-400"
                            } saturate-200 leading-tight`}
                          >
                            {gameState.winner}
                          </h2>
                          <div className="flex flex-col items-center gap-2">
                            <p className="text-white/60 font-medium tracking-[0.2em] uppercase text-[8px] sm:text-xs">
                              Next round starting soon
                            </p>
                            <div className="w-32 sm:w-48 h-1 bg-slate-800 rounded-full overflow-hidden mt-1 sm:mt-2">
                              <div
                                className="h-full bg-accent-gold transition-all duration-100 ease-linear"
                                style={{
                                  width: `${(gameState.resetTimer / 180) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {showQuitConfirm && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md z-50 p-4">
                    <div className="glass-panel p-8 sm:p-12 rounded-3xl flex flex-col items-center gap-8 border-white/20 animate-in zoom-in duration-300 max-w-sm text-center">
                      <div className="flex flex-col gap-3">
                        <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider">
                          Abandon Duel?
                        </h2>
                        <p className="text-slate-400 text-[10px] leading-relaxed">
                          Are you sure you want to leave the arena?
                        </p>
                      </div>

                      <div className="flex gap-4 w-full">
                        <button
                          type="button"
                          onClick={() => setShowQuitConfirm(false)}
                          className="flex-1 glass-button glass-panel py-3 rounded-xl text-white text-[10px] font-bold uppercase tracking-widest hover:bg-white/10"
                        >
                          No
                        </button>
                        <button
                          type="button"
                          onClick={goToMenu}
                          className="flex-1 glass-button glass-panel py-3 rounded-xl text-red-400 border-red-500/30 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/10"
                        >
                          Yes
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {disconnected && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl z-40 p-8">
                    <div className="text-center space-y-6">
                      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/20 text-red-500 text-4xl mb-2">
                        ⚠️
                      </div>
                      <h2 className="text-3xl font-bold text-white uppercase tracking-tight">
                        Signal Lost
                      </h2>
                      <p className="text-slate-400 max-w-xs mx-auto">
                        The other duelist has vanished into the digital void.
                        The match is nullified.
                      </p>
                      <button
                        type="button"
                        onClick={goToMenu}
                        className="glass-button glass-panel px-8 py-3 rounded-full text-white font-bold uppercase tracking-widest text-sm"
                      >
                        Return Home
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 flex gap-4">
              <button
                type="button"
                onClick={goToMenu}
                className="glass-button cursor-pointer glass-panel px-6 py-2.5 rounded-full text-slate-300 hover:text-white text-xs font-bold uppercase tracking-[0.2em] flex flex-row items-center justify-center gap-2 leading-none"
              >
                <span
                  style={{
                    display: "inline-block",
                    transform: "translateY(-2px)",
                    lineHeight: 1,
                  }}
                  aria-hidden
                  className="text-lg mb-2"
                >
                  ←
                </span>
                <span style={{ lineHeight: 1 }}>Menu</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <footer className="shrink-0 py-6 px-8 flex justify-between items-center opacity-30 text-[10px] tracking-[0.3em] uppercase font-bold text-slate-500">
        <span>V.1.0.4-DUEL</span>
        <div className="flex gap-4">
          <span>Responsive Arena</span>
          <span>Online Ready</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
