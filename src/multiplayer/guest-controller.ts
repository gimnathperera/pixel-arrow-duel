/**
 * Guest controller: send local P2 input to host, receive state snapshots and apply to engine.
 */

import type { DataConnection } from "peerjs";
import type { GameEngine } from "../engine/GameEngine";
import { isStateMessage } from "./messages";
import { KEY_TO_INPUT } from "./messages";

const P2_KEY_CODES = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "Enter"]);

export interface GuestControllerCallbacks {
  onDisconnect?: () => void;
}

export function createGuestController(
  engine: GameEngine,
  conn: DataConnection,
  callbacks: GuestControllerCallbacks = {}
): () => void {
  const { onDisconnect } = callbacks;

  function sendInput(key: string, pressed: boolean) {
    const logicalKey = KEY_TO_INPUT[key];
    if (!logicalKey || !conn.open) return;
    conn.send({
      type: "input",
      playerId: "p2",
      key: logicalKey,
      pressed,
    });
  }

  const keyDown = (e: KeyboardEvent) => {
    if (P2_KEY_CODES.has(e.code)) {
      e.preventDefault();
      sendInput(e.code, true);
    }
  };
  const keyUp = (e: KeyboardEvent) => {
    if (P2_KEY_CODES.has(e.code)) {
      sendInput(e.code, false);
    }
  };

  window.addEventListener("keydown", keyDown);
  window.addEventListener("keyup", keyUp);

  conn.on("data", (data: unknown) => {
    if (isStateMessage(data)) {
      engine.setStateFromSnapshot(data);
    }
  });

  conn.on("close", () => {
    cleanup();
    onDisconnect?.();
  });

  conn.on("error", () => {
    cleanup();
    onDisconnect?.();
  });

  function cleanup() {
    window.removeEventListener("keydown", keyDown);
    window.removeEventListener("keyup", keyUp);
  }

  return cleanup;
}
