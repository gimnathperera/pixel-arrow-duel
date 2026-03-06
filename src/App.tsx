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
      setJoinError(err instanceof Error ? err.message : "Failed to create room");
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

  // Online game: mount engine (host or guest) and controller when we have connection
  useEffect(() => {
    if (screen !== "online-game" || !canvasRef.current || !connection || !role) return;

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
    <div className="h-screen w-full flex flex-col bg-slate-950 overflow-hidden">
      <div className="max-w-5xl mx-auto flex flex-col gap-4 w-full flex-1 min-h-0 py-4 px-4">
        <header className="shrink-0 flex flex-col items-center gap-1 sm:gap-2 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-widest text-white drop-shadow-lg">
            🏹 PIXEL ARROW DUEL 🏹
          </h1>
          {showGameCanvas && (
            <>
              <p className="text-slate-400 text-xs sm:text-sm">
                <span className="text-red-400 font-bold">P1 (RED):</span> WASD to move, Space to shoot
              </p>
              <p className="text-slate-400 text-xs sm:text-sm">
                <span className="text-blue-400 font-bold">P2 (BLUE):</span> Arrows to move, Enter to shoot
              </p>
            </>
          )}
        </header>

        {screen === "menu" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => setScreen("local")}
                className="px-8 py-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-lg"
              >
                Local Play
              </button>
              <button
                type="button"
                onClick={handleCreateRoom}
                className="px-8 py-4 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-bold text-lg"
              >
                Create Room
              </button>
              <button
                type="button"
                onClick={() => {
                  setRole("guest");
                  setScreen("online-lobby");
                }}
                className="px-8 py-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-lg"
              >
                Join Room
              </button>
            </div>
          </div>
        )}

        {screen === "online-lobby" && role && (
          <div className="flex-1 flex items-center justify-center">
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
        )}

        {showGameCanvas && (
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

              {gameState && (
                <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-start gap-4 w-full">
                    <HealthBar
                      label="P1"
                      health={p1?.health ?? 0}
                      maxHealth={100}
                      colorClass="bg-red-500"
                    />
                    <HealthBar
                      label="P2"
                      health={p2?.health ?? 0}
                      maxHealth={100}
                      colorClass="bg-blue-500"
                      isRightToLeft
                    />
                  </div>

                  {gameState.matchOver && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                      <h2
                        className={`text-4xl sm:text-5xl font-bold mb-4 ${
                          gameState.winner?.includes("Blue") ? "text-blue-500" : "text-red-500"
                        } drop-shadow-xl saturate-150`}
                      >
                        {gameState.winner} Wins!
                      </h2>
                      <p className="text-white/80 animate-pulse text-xl">
                        Restarting in {Math.ceil(gameState.resetTimer / 60)}...
                      </p>
                    </div>
                  )}
                </div>
              )}

              {disconnected && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-20 pointer-events-auto">
                  <p className="text-xl font-bold text-white mb-4">Opponent disconnected</p>
                  <button
                    type="button"
                    onClick={goToMenu}
                    className="px-6 py-3 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium"
                  >
                    Return to menu
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {(screen === "local" || screen === "online-game") && (
          <div className="shrink-0 flex justify-center">
            <button
              type="button"
              onClick={goToMenu}
              className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm"
            >
              Back to menu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
