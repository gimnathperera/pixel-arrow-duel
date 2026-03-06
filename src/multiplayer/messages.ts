/**
 * Network message types for host-authoritative P2P multiplayer.
 * Guest sends only InputMessage; host sends StateMessage snapshots.
 */

export type InputKey = 'left' | 'right' | 'jump' | 'shoot';

export type InputMessage = {
  type: 'input';
  playerId: 'p2';
  key: InputKey;
  pressed: boolean;
};

export type StateMessage = {
  type: 'state';
  tick: number;
  players: {
    p1: { x: number; y: number; vx: number; vy: number; health: number; facing: 'left' | 'right' };
    p2: { x: number; y: number; vx: number; vy: number; health: number; facing: 'left' | 'right' };
  };
  arrows: Array<{
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    owner: 'p1' | 'p2';
  }>;
  movingPlatforms?: Array<{ id: string; x: number }>;
  winner: 'p1' | 'p2' | null;
};

export type NetworkMessage = InputMessage | StateMessage;

export function isInputMessage(msg: unknown): msg is InputMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as InputMessage).type === 'input' &&
    (msg as InputMessage).playerId === 'p2' &&
    ['left', 'right', 'jump', 'shoot'].includes((msg as InputMessage).key) &&
    typeof (msg as InputMessage).pressed === 'boolean'
  );
}

export function isStateMessage(msg: unknown): msg is StateMessage {
  if (typeof msg !== 'object' || msg === null || (msg as StateMessage).type !== 'state') return false;
  const m = msg as StateMessage;
  return (
    typeof m.tick === 'number' &&
    typeof m.players?.p1 === 'object' &&
    typeof m.players?.p2 === 'object' &&
    Array.isArray(m.arrows) &&
    (m.winner === null || m.winner === 'p1' || m.winner === 'p2')
  );
}

/** Map keyboard code to logical key for P2 (guest sends these). */
export const KEY_TO_INPUT: Record<string, InputKey> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'jump',
  Enter: 'shoot',
};

/** Map logical key to keyboard code for host (engine expects these). */
export const INPUT_TO_KEY: Record<InputKey, string> = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  jump: 'ArrowUp',
  shoot: 'Enter',
};

/** Build StateMessage from engine GameState (used by host). */
export function buildStateMessage(
  state: {
    players: Array<{
      id: 'p1' | 'p2';
      x: number;
      y: number;
      velocity: { x: number; y: number };
      health: number;
      facingRight: boolean;
    }>;
    platforms: Array<{ id: string; type: string; x: number }>;
    arrows: Array<{
      id: string;
      x: number;
      y: number;
      velocity: { x: number; y: number };
      ownerId: 'p1' | 'p2';
      active: boolean;
    }>;
    matchOver: boolean;
    winner: string | null;
  },
  tick: number
): StateMessage {
  const p1 = state.players.find((p) => p.id === 'p1')!;
  const p2 = state.players.find((p) => p.id === 'p2')!;
  return {
    type: 'state',
    tick,
    players: {
      p1: {
        x: p1.x,
        y: p1.y,
        vx: p1.velocity.x,
        vy: p1.velocity.y,
        health: p1.health,
        facing: p1.facingRight ? 'right' : 'left',
      },
      p2: {
        x: p2.x,
        y: p2.y,
        vx: p2.velocity.x,
        vy: p2.velocity.y,
        health: p2.health,
        facing: p2.facingRight ? 'right' : 'left',
      },
    },
    arrows: state.arrows
      .filter((a) => a.active)
      .map((a) => ({
        id: a.id,
        x: a.x,
        y: a.y,
        vx: a.velocity.x,
        vy: a.velocity.y,
        owner: a.ownerId,
      })),
    movingPlatforms: state.platforms
      .filter((p) => p.type === 'moving')
      .map((p) => ({ id: p.id, x: p.x })),
    winner: state.matchOver && state.winner ? (state.winner.includes('Blue') ? 'p2' : 'p1') : null,
  };
}
