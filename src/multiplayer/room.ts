/**
 * High-level room flow: create room (host) or join room by code (guest).
 * Room code for display can be shortened; guest must use full host peer ID to join.
 */

import type { DataConnection } from "peerjs";
import type Peer from "peerjs";
import { createGuestPeer, createHostPeer, peerIdToRoomCode } from "./peer";

export type RoomRole = "host" | "guest";

export interface CreateRoomResult {
  role: "host";
  peer: Peer;
  peerId: string;
  /** Short code for display (e.g. first 8 alphanumeric chars). */
  displayCode: string;
  /** Resolves when a guest connects. Use this connection for send/recv. */
  connectionPromise: Promise<DataConnection>;
}

export interface JoinRoomResult {
  role: "guest";
  peer: Peer;
  /** Resolves when connected to host. Use this connection for send/recv. */
  connectionPromise: Promise<DataConnection>;
}

/**
 * Create a room as host. Returns peer (destroy on cancel), peerId, and a promise for the guest connection.
 */
export async function createRoom(): Promise<CreateRoomResult> {
  const { peer, peerId, connectionPromise } = await createHostPeer();
  return {
    role: "host",
    peer,
    peerId,
    displayCode: peerIdToRoomCode(peerId),
    connectionPromise,
  };
}

/**
 * Join a room as guest. Pass the full host peer ID (room code). Returns peer (destroy on cancel) and connection promise.
 */
export async function joinRoom(hostPeerId: string): Promise<JoinRoomResult> {
  const { peer, connectionPromise } = await createGuestPeer(hostPeerId.trim());
  return {
    role: "guest",
    peer,
    connectionPromise,
  };
}
