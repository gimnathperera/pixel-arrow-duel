import { useState } from "react";
import { RoomCodeCard } from "./RoomCodeCard";

export type LobbyRole = "host" | "guest";

interface OnlineLobbyHostProps {
  peerId: string;
  displayCode: string;
  onCancel: () => void;
}

function OnlineLobbyHost({ peerId, displayCode, onCancel }: OnlineLobbyHostProps) {
  return (
    <div className="flex flex-col items-center gap-6 max-w-md mx-auto">
      <h2 className="text-xl font-bold text-white">Create room</h2>
      <RoomCodeCard peerId={peerId} displayCode={displayCode} />
      <p className="text-slate-400 text-sm animate-pulse">Waiting for opponent…</p>
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 rounded bg-slate-600 hover:bg-slate-500 text-white text-sm"
      >
        Cancel
      </button>
    </div>
  );
}

interface OnlineLobbyGuestProps {
  onJoin: (roomCode: string) => void;
  onCancel: () => void;
  joining: boolean;
  error: string | null;
}

function OnlineLobbyGuest({ onJoin, onCancel, joining, error }: OnlineLobbyGuestProps) {
  const [input, setInput] = useState("");

  return (
    <div className="flex flex-col items-center gap-6 max-w-md mx-auto">
      <h2 className="text-xl font-bold text-white">Join room</h2>
      <p className="text-slate-400 text-sm">Enter the room code from your friend (host)</p>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste room code"
        className="w-full px-4 py-3 rounded border-2 border-slate-600 bg-slate-800 text-white font-mono placeholder-slate-500 focus:border-blue-500 focus:outline-none"
        disabled={joining}
        autoCapitalize="off"
        autoComplete="off"
      />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onJoin(input.trim())}
          disabled={!input.trim() || joining}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-medium"
        >
          {joining ? "Connecting…" : "Join"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={joining}
          className="px-4 py-2 rounded bg-slate-600 hover:bg-slate-500 text-white text-sm disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export interface OnlineLobbyProps {
  role: LobbyRole;
  /** Host only */
  peerId?: string;
  displayCode?: string;
  onCancel: () => void;
  /** Guest only */
  onJoin?: (roomCode: string) => void;
  joining?: boolean;
  joinError?: string | null;
}

export function OnlineLobby({
  role,
  peerId = "",
  displayCode,
  onCancel,
  onJoin,
  joining = false,
  joinError = null,
}: OnlineLobbyProps) {
  if (role === "host") {
    return (
      <OnlineLobbyHost
        peerId={peerId}
        displayCode={displayCode ?? peerId}
        onCancel={onCancel}
      />
    );
  }
  return (
    <OnlineLobbyGuest
      onJoin={onJoin!}
      onCancel={onCancel}
      joining={joining}
      error={joinError}
    />
  );
}
