/**
 * PeerJS wrapper: create Peer and DataConnection for host/guest.
 * Uses PeerJS default cloud for signaling; data goes P2P after connect.
 */

import type { DataConnection } from "peerjs";
import Peer from "peerjs";

export type PeerConnectionState = "idle" | "connecting" | "open" | "closed" | "error";

export interface PeerConnectionCallbacks {
  onOpen?: (conn: DataConnection) => void;
  onData?: (data: unknown) => void;
  onClose?: () => void;
  onError?: (err: Error) => void;
}

/** Generate a short room code (alphanumeric) from a peer ID for display. */
export function peerIdToRoomCode(peerId: string): string {
  return peerId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase() || peerId.slice(0, 8);
}

/**
 * Create a Peer that will act as host. Peer ID is the room code (guest uses this to join).
 * Returns the Peer and a promise that resolves with the DataConnection when a guest connects.
 */
export function createHostPeer(): Promise<{
  peer: Peer;
  peerId: string;
  connectionPromise: Promise<DataConnection>;
}> {
  return new Promise((resolve, reject) => {
    const peer = new Peer({ debug: 0 });

    const connectionPromise = new Promise<DataConnection>((connResolve) => {
      peer.on("connection", (conn: DataConnection) => {
        connResolve(conn);
      });
    });

    peer.on("open", (id) => {
      resolve({ peer, peerId: id, connectionPromise });
    });

    peer.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Create a Peer and connect to the host. Returns the Peer and a promise that resolves with the DataConnection when connected.
 */
export function createGuestPeer(hostPeerId: string): Promise<{
  peer: Peer;
  connectionPromise: Promise<DataConnection>;
}> {
  return new Promise((resolve, reject) => {
    const peer = new Peer({ debug: 0 });

    peer.on("open", () => {
      const conn = peer.connect(hostPeerId, { reliable: true });
      const connectionPromise = new Promise<DataConnection>((connResolve, connReject) => {
        conn.on("open", () => connResolve(conn));
        conn.on("error", (err) => connReject(err));
      });
      resolve({ peer, connectionPromise });
    });

    peer.on("error", (err) => reject(err));
  });
}
