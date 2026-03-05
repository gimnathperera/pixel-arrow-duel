export interface Vector2 {
  x: number;
  y: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PlatformType = 'solid' | 'jump-bar' | 'moving';

export interface Platform extends Rectangle {
  id: string;
  type: PlatformType;
  baseX?: number; // For moving platforms
  speed?: number; // For moving platforms
  range?: number; // For moving platforms
  dir?: number; // For moving platforms
}

export interface PlayerState extends Rectangle {
  id: 'p1' | 'p2';
  color: string;
  velocity: Vector2;
  health: number;
  isGrounded: boolean;
  facingRight: boolean;
  shootCooldown: number;
  shakeTime?: number;
}

export interface ArrowState extends Rectangle {
  id: string;
  ownerId: 'p1' | 'p2';
  velocity: Vector2;
  active: boolean;
}

export interface ParticleState {
  id: string;
  x: number;
  y: number;
  velocity: Vector2;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

export interface GameState {
  players: PlayerState[];
  platforms: Platform[];
  arrows: ArrowState[];
  particles: ParticleState[];
  screenShakeTimer: number;
  matchOver: boolean;
  winner: string | null;
  resetTimer: number;
}
