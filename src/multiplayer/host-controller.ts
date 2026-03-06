/**
 * Host controller: receive guest inputs, apply to engine P2 override, send state snapshots at 10–20 Hz.
 */

import type { DataConnection } from "peerjs";
import type { GameEngine } from "../engine/GameEngine";
import { buildStateMessage } from "./messages";
import { INPUT_TO_KEY, isInputMessage } from "./messages";

const SNAPSHOT_HZ = 45;
const SNAPSHOT_INTERVAL_MS = 1000 / SNAPSHOT_HZ;

export interface HostControllerCallbacks {
  onDisconnect?: () => void;
}

export function createHostController(
  engine: GameEngine,
  conn: DataConnection,
  callbacks: HostControllerCallbacks = {}
): () => void {
  const { onDisconnect } = callbacks;
  let snapshotIntervalId: ReturnType<typeof setInterval> | null = null;
  let tick = 0;

  // P2 keys from guest (logical key -> pressed)
  const p2Keys = new Map<string, boolean>([
    ["ArrowLeft", false],
    ["ArrowRight", false],
    ["ArrowUp", false],
    ["Enter", false],
  ]);

  function applyInputToEngine() {
    const set = new Set<string>();
    for (const [key, pressed] of p2Keys) {
      if (pressed) set.add(key);
    }
    engine.setP2InputOverride(set);
  }

  conn.on("data", (data: unknown) => {
    if (isInputMessage(data)) {
      const keyCode = INPUT_TO_KEY[data.key];
      if (keyCode) {
        p2Keys.set(keyCode, data.pressed);
        applyInputToEngine();
      }
    }
  });

  conn.on("close", () => {
    stop();
    engine.setP2InputOverride(null);
    onDisconnect?.();
  });

  conn.on("error", () => {
    stop();
    engine.setP2InputOverride(null);
    onDisconnect?.();
  });

  function sendSnapshot() {
    if (!conn.open) return;
    tick += 1;
    const state = engine.getState();
    const msg = buildStateMessage(state, tick);
    conn.send(msg);
  }

  function start() {
    if (snapshotIntervalId != null) return;
    snapshotIntervalId = setInterval(sendSnapshot, SNAPSHOT_INTERVAL_MS);
  }

  function stop() {
    if (snapshotIntervalId != null) {
      clearInterval(snapshotIntervalId);
      snapshotIntervalId = null;
    }
  }

  start();
  return stop;
}
