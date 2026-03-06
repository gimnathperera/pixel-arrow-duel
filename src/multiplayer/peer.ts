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

/** Generate a short room code (6 alphanumeric chars) for the host peer ID. */
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous chars like 0, O, 1, I
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/** Returns the peer ID as the room code. */
export function peerIdToRoomCode(peerId: string): string {
  return peerId.toUpperCase();
}

/**
 * Create a Peer that will act as host. Peer ID is the room code.
 */
export function createHostPeer(): Promise<{
  peer: Peer;
  peerId: string;
  connectionPromise: Promise<DataConnection>;
}> {
  return new Promise((resolve, reject) => {
    const roomId = generateRoomCode();
    const peer = new Peer(roomId, { debug: 0 });

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
        const timeout = setTimeout(() => {
          conn.close();
          connReject(new Error("Connection timed out (10s). Check the room code."));
        }, 10000);

        conn.on("open", () => {
          clearTimeout(timeout);
          connResolve(conn);
        });
        conn.on("error", (err) => {
          clearTimeout(timeout);
          connReject(err);
        });
      });
      resolve({ peer, connectionPromise });
    });

    peer.on("error", (err) => reject(err));
  });
}
