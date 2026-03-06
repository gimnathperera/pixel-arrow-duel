import { GAME_HEIGHT, GAME_WIDTH, INITIAL_PLATFORMS } from "../game/MapDef";
import type { StateMessage } from "../multiplayer/messages";
import type { GameState, PlayerState, Rectangle } from "./types";
import { soundManager } from "./SoundManager";

const PLAYER_WIDTH = 24;
const PLAYER_HEIGHT = 24;
const ARROW_WIDTH = 16;
const ARROW_HEIGHT = 4;

function snapshotToGameState(msg: StateMessage): GameState {
  const platforms = JSON.parse(JSON.stringify(INITIAL_PLATFORMS)) as GameState["platforms"];
  if (msg.movingPlatforms) {
    for (const { id, x } of msg.movingPlatforms) {
      const plat = platforms.find((p) => p.id === id);
      if (plat) plat.x = x;
    }
  }
  const p1 = msg.players.p1;
  const p2 = msg.players.p2;
  return {
    players: [
      {
        id: "p1",
        x: p1.x,
        y: p1.y,
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        color: "#ef4444",
        velocity: { x: p1.vx, y: p1.vy },
        health: p1.health,
        isGrounded: false,
        facingRight: p1.facing === "right",
        shootCooldown: 0,
      },
      {
        id: "p2",
        x: p2.x,
        y: p2.y,
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        color: "#3b82f6",
        velocity: { x: p2.vx, y: p2.vy },
        health: p2.health,
        isGrounded: false,
        facingRight: p2.facing === "right",
        shootCooldown: 0,
      },
    ],
    platforms,
    arrows: msg.arrows.map((a) => ({
      id: a.id,
      ownerId: a.owner,
      x: a.x,
      y: a.y,
      width: ARROW_WIDTH,
      height: ARROW_HEIGHT,
      velocity: { x: a.vx, y: a.vy },
      active: true,
    })),
    particles: [],
    screenShakeTimer: 0,
    matchOver: msg.winner !== null,
    winner: msg.winner === null ? null : msg.winner === "p1" ? "Player 1 (Red)" : "Player 2 (Blue)",
    resetTimer: 0,
  };
}

const GRAVITY = 0.5;
const MAX_FALL_SPEED = 12;
const JUMP_FORCE = -12;
const JUMP_BAR_FORCE = -16; // Trampoline bounce
const MOVE_SPEED = 5;
const ARROW_SPEED = 15;
const SHOOT_COOLDOWN = 30; // Frames
const MAX_HEALTH = 100;

export type EngineMode = "local" | "host" | "guest";

export class GameEngine {
  private state: GameState;
  private ctx: CanvasRenderingContext2D;
  private keys: Set<string> = new Set();
  private animationFrameId: number = 0;
  /** When set (host mode), P2 input is taken from this instead of keyboard. */
  private p2InputOverride: Set<string> | null = null;
  private readonly isGuest: boolean;

  constructor(canvas: HTMLCanvasElement, options?: { mode?: EngineMode }) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2d context not available");
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
    this.isGuest = options?.mode === "guest";

    this.state = this.getInitialState();

    if (!this.isGuest) {
      window.addEventListener("keydown", this.handleKeyDown);
      window.addEventListener("keyup", this.handleKeyUp);
    }
  }

  /** Host only: set P2 keys from network. Pass null to use local keyboard again. */
  public setP2InputOverride(keys: Set<string> | null): void {
    this.p2InputOverride = keys;
  }

  /** Guest only: replace full state (e.g. from snapshot). */
  public setState(state: GameState): void {
    this.state = state;
  }

  /** Guest only: build GameState from StateMessage and set it. */
  public setStateFromSnapshot(msg: StateMessage): void {
    this.state = snapshotToGameState(msg);
  }

  /** Guest only: run draw loop only (no update, no key handling). */
  public startGuest(): void {
    if (!this.isGuest) return;
    const loop = () => {
      this.draw();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  private getInitialState(): GameState {
    return {
      players: [
        {
          id: "p1",
          x: 200,
          y: 300,
          width: 24,
          height: 24,
          color: "#ef4444",
          velocity: { x: 0, y: 0 },
          health: MAX_HEALTH,
          isGrounded: false,
          facingRight: true,
          shootCooldown: 0,
        },
        {
          id: "p2",
          x: 600,
          y: 300,
          width: 24,
          height: 24,
          color: "#3b82f6",
          velocity: { x: 0, y: 0 },
          health: MAX_HEALTH,
          isGrounded: false,
          facingRight: false,
          shootCooldown: 0,
        },
      ],
      platforms: JSON.parse(JSON.stringify(INITIAL_PLATFORMS)),
      arrows: [],
      particles: [],
      screenShakeTimer: 0,
      matchOver: false,
      winner: null,
      resetTimer: 0,
    };
  }

  public start() {
    const loop = () => {
      this.update();
      this.draw();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  public stop() {
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }

  public getState() {
    return this.state;
  }

  private static readonly GAME_KEYS = new Set([
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "Space",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Enter",
  ]);

  private handleKeyDown = (e: KeyboardEvent) => {
    if (GameEngine.GAME_KEYS.has(e.code)) {
      e.preventDefault();
    }
    this.keys.add(e.code);
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private checkAABB(rect1: Rectangle, rect2: Rectangle) {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  }

  private update() {
    if (this.state.matchOver) {
      if (this.state.resetTimer > 0) {
        this.state.resetTimer--;
      } else {
        this.state = this.getInitialState();
      }
      return;
    }

    if (this.state.screenShakeTimer > 0) {
      this.state.screenShakeTimer--;
    }

    this.updatePlatforms();
    this.updatePlayers();
    this.updateArrows();
    this.updateParticles();
  }

  private updatePlatforms() {
    for (const plat of this.state.platforms) {
      if (
        plat.type === "moving" &&
        plat.baseX !== undefined &&
        plat.range !== undefined &&
        plat.dir !== undefined &&
        plat.speed !== undefined
      ) {
        plat.x += (plat.speed / 60) * plat.dir;
        if (Math.abs(plat.x - plat.baseX) > plat.range) {
          plat.dir *= -1;
        }
      }
    }
  }

  private spawnParticles(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      this.state.particles.push({
        id: Math.random().toString(),
        x,
        y,
        velocity: {
          x: (Math.random() - 0.5) * 10,
          y: (Math.random() - 0.5) * 10,
        },
        color,
        life: 30 + Math.random() * 20,
        maxLife: 50,
        size: 2 + Math.random() * 4,
      });
    }
  }

  private getP2Keys(): Set<string> {
    return this.p2InputOverride ?? this.keys;
  }

  private updatePlayers() {
    const p1 = this.state.players[0];
    const p2 = this.state.players[1];
    const p2Keys = this.getP2Keys();

    // Input Handling
    // Player 1: WASD + Space (always from local keyboard)
    if (this.keys.has("KeyA")) {
      p1.velocity.x = -MOVE_SPEED;
      p1.facingRight = false;
    } else if (this.keys.has("KeyD")) {
      p1.velocity.x = MOVE_SPEED;
      p1.facingRight = true;
    } else {
      p1.velocity.x = 0;
    }

    if (this.keys.has("KeyW") && p1.isGrounded) {
      p1.velocity.y = JUMP_FORCE;
      p1.isGrounded = false;
      soundManager.playJump();
    }

    if (this.keys.has("Space") && p1.shootCooldown <= 0) {
      this.shootArrow(p1);
      p1.shootCooldown = SHOOT_COOLDOWN;
    }

    // Player 2: Arrows + Enter (from p2Keys: local keyboard or host's network override)
    if (p2Keys.has("ArrowLeft")) {
      p2.velocity.x = -MOVE_SPEED;
      p2.facingRight = false;
    } else if (p2Keys.has("ArrowRight")) {
      p2.velocity.x = MOVE_SPEED;
      p2.facingRight = true;
    } else {
      p2.velocity.x = 0;
    }

    if (p2Keys.has("ArrowUp") && p2.isGrounded) {
      p2.velocity.y = JUMP_FORCE;
      p2.isGrounded = false;
      soundManager.playJump();
    }

    if (p2Keys.has("Enter") && p2.shootCooldown <= 0) {
      this.shootArrow(p2);
      p2.shootCooldown = SHOOT_COOLDOWN;
    }

    // Physics & Collision
    for (const p of this.state.players) {
      if (p.shootCooldown > 0) p.shootCooldown--;

      // Gravity
      p.velocity.y += GRAVITY;
      if (p.velocity.y > MAX_FALL_SPEED) p.velocity.y = MAX_FALL_SPEED;

      // X Movement
      p.x += p.velocity.x;
      this.handlePlatformCollisions(p, true);

      // Y Movement
      p.y += p.velocity.y;
      p.isGrounded = false;
      this.handlePlatformCollisions(p, false);

      // Screen bounds wrapping (X axis)
      if (p.x < -p.width) p.x = GAME_WIDTH;
      if (p.x > GAME_WIDTH) p.x = -p.width;

      // Bottom bound kill check
      if (p.y > GAME_HEIGHT + 100) {
        this.takeDamage(p.id, 100);
      }
    }
  }

  private shootArrow(player: PlayerState) {
    this.state.arrows.push({
      id: Math.random().toString(),
      ownerId: player.id,
      x: player.facingRight ? player.x + player.width : player.x - 16,
      y: player.y + player.height / 2 - 2,
      width: 16,
      height: 4,
      velocity: {
        x: player.facingRight ? ARROW_SPEED : -ARROW_SPEED,
        y: 0,
      },
      active: true,
    });
    soundManager.playShoot();
  }

  private handlePlatformCollisions(player: PlayerState, horizontal: boolean) {
    for (const plat of this.state.platforms) {
      if (this.checkAABB(player, plat)) {
        if (horizontal) {
          // Only solid collides horizontally
          if (plat.type === "solid" || plat.type === "moving") {
            if (player.velocity.x > 0) {
              player.x = plat.x - player.width;
            } else if (player.velocity.x < 0) {
              player.x = plat.x + plat.width;
            }
          }
        } else {
          // Vertical collision
          if (player.velocity.y > 0) {
            // Falling
            // Jump bars and solids
            if (player.y + player.height - player.velocity.y <= plat.y) {
              player.y = plat.y - player.height;
              player.isGrounded = true;

              if (plat.type === "jump-bar") {
                player.velocity.y = JUMP_BAR_FORCE;
                player.isGrounded = false;
                this.spawnParticles(
                  player.x + player.width / 2,
                  player.y + player.height,
                  "#fbbf24",
                  5,
                );
                soundManager.playBounce();
              } else {
                player.velocity.y = 0;
                if (
                  plat.type === "moving" &&
                  plat.dir !== undefined &&
                  plat.speed !== undefined
                ) {
                  player.x += (plat.speed / 60) * plat.dir; // Ride platform
                }
              }
            }
          } else if (player.velocity.y < 0) {
            // Jumping up (only collides with solid bottom)
            if (plat.type === "solid" || plat.type === "moving") {
              player.y = plat.y + plat.height;
              player.velocity.y = 0;
            }
          }
        }
      }
    }
  }

  private takeDamage(playerId: string, amount: number) {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return;

    player.health -= amount;
    this.state.screenShakeTimer = 15;
    soundManager.playHit();

    this.spawnParticles(
      player.x + player.width / 2,
      player.y + player.height / 2,
      player.color,
      15,
    );

    if (player.health <= 0) {
      player.health = 0;
      this.state.matchOver = true;
      this.state.winner =
        playerId === "p1" ? "Player 2 (Blue)" : "Player 1 (Red)";
      this.state.resetTimer = 180; // 3 seconds at 60fps
      soundManager.playExplosion();
    }
  }

  private updateArrows() {
    for (const arrow of this.state.arrows) {
      if (!arrow.active) continue;

      arrow.x += arrow.velocity.x;

      // Out of bounds
      if (arrow.x < -100 || arrow.x > GAME_WIDTH + 100) {
        arrow.active = false;
        continue;
      }

      // Trail
      if (Math.random() < 0.3) {
        this.state.particles.push({
          id: Math.random().toString(),
          x: arrow.x + (arrow.velocity.x > 0 ? 0 : arrow.width),
          y: arrow.y + arrow.height / 2,
          velocity: { x: 0, y: 0 },
          color: "#d1d5db",
          life: 10,
          maxLife: 10,
          size: 2,
        });
      }

      // Check hits with platforms
      let hitPlatform = false;
      for (const plat of this.state.platforms) {
        if (plat.type !== "jump-bar" && this.checkAABB(arrow, plat)) {
          arrow.active = false;
          hitPlatform = true;
          this.spawnParticles(
            arrow.velocity.x > 0 ? arrow.x + arrow.width : arrow.x,
            arrow.y,
            "#9ca3af",
            5,
          );
          break;
        }
      }
      if (hitPlatform) continue;

      // Check hits with players
      for (const p of this.state.players) {
        if (p.id !== arrow.ownerId && this.checkAABB(arrow, p)) {
          arrow.active = false;
          this.takeDamage(p.id, 15 + Math.floor(Math.random() * 6)); // 15-20 damage
          break;
        }
      }
    }

    this.state.arrows = this.state.arrows.filter((a) => a.active);
  }

  private updateParticles() {
    for (const p of this.state.particles) {
      p.x += p.velocity.x;
      p.y += p.velocity.y;
      p.life--;
    }
    this.state.particles = this.state.particles.filter((p) => p.life > 0);
  }

  private drawPlayer(p: PlayerState) {
    const S = 3; // each logical pixel = 3×3 screen pixels
    const isRed = p.color === "#ef4444";

    // ── Colour palette ──
    const hood     = isRed ? "#7f1d1d" : "#1e3a8a";
    const hoodFrnt = isRed ? "#991b1b" : "#1e40af";
    const skin     = "#fde68a";
    const eyeC     = "#f0f9ff";
    const armor    = isRed ? "#ef4444" : "#3b82f6";
    const armorD   = isRed ? "#b91c1c" : "#1d4ed8";
    const armorL   = isRed ? "#fca5a5" : "#93c5fd";
    const belt     = "#44403c";
    const boot     = "#1c1917";

    // ── 8×8 logical-pixel map (designed for facing RIGHT) ──
    // "" = transparent
    const pixels: string[][] = [
      ["",      "",       hood,    hood,    hood,    hood,    "",       ""      ], // 0 hood top
      ["",      hood,     skin,    skin,    skin,    skin,    hood,     ""      ], // 1 face
      ["",      hood,     skin,    skin,    eyeC,    skin,    hoodFrnt, ""      ], // 2 face + eye
      ["",      hood,     skin,    skin,    skin,    hoodFrnt,"",       ""      ], // 3 lower face
      ["",      armorL,   armor,   armor,   armor,   armor,   "",       ""      ], // 4 shoulders
      ["",      armor,    armorD,  armor,   armor,   armorD,  armor,    ""      ], // 5 chest detail
      [armor,   armor,    belt,    belt,    belt,    armor,   armor,    ""      ], // 6 belt
      ["",      boot,     boot,    "",      boot,    boot,    "",       ""      ], // 7 boots
    ];

    this.ctx.save();

    // Glow
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = isRed ? "rgba(239,68,68,0.5)" : "rgba(59,130,246,0.5)";

    // Draw pixel character
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const mapCol = p.facingRight ? col : 7 - col;
        const color = pixels[row][mapCol];
        if (color) {
          this.ctx.fillStyle = color;
          this.ctx.fillRect(p.x + col * S, p.y + row * S, S, S);
        }
      }
    }

    // ── Bow ──
    const by = p.y + S;  // top of bow aligns with row 1
    this.ctx.shadowBlur = 6;
    this.ctx.shadowColor = "#92400e";

    if (p.facingRight) {
      const bx = p.x + p.width;
      // Limbs
      this.ctx.fillStyle = "#78350f";
      this.ctx.fillRect(bx,     by,            S,     S);      // top tip
      this.ctx.fillRect(bx,     by + S,        S,     S * 5);  // body
      this.ctx.fillRect(bx,     by + S * 6,    S,     S);      // bottom tip
      // String
      this.ctx.fillStyle = "#d4a574";
      this.ctx.fillRect(bx + S + 1, by + S,    2,     S * 5);
    } else {
      const bx = p.x - S;
      // Limbs
      this.ctx.fillStyle = "#78350f";
      this.ctx.fillRect(bx,     by,            S,     S);      // top tip
      this.ctx.fillRect(bx,     by + S,        S,     S * 5);  // body
      this.ctx.fillRect(bx,     by + S * 6,    S,     S);      // bottom tip
      // String
      this.ctx.fillStyle = "#d4a574";
      this.ctx.fillRect(bx - 3, by + S,        2,     S * 5);
    }

    this.ctx.restore();
  }

  private draw() {
    // Background - dynamic gradient
    const bgGradient = this.ctx.createRadialGradient(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, 0,
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH
    );
    bgGradient.addColorStop(0, "#0f172a"); // Slate 900
    bgGradient.addColorStop(1, "#020617"); // Slate 950
    this.ctx.fillStyle = bgGradient;
    this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Grid lines for depth
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    this.ctx.lineWidth = 1;
    for (let x = 0; x < GAME_WIDTH; x += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, GAME_HEIGHT);
      this.ctx.stroke();
    }
    for (let y = 0; y < GAME_HEIGHT; y += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(GAME_WIDTH, y);
      this.ctx.stroke();
    }

    // Apply Shake
    this.ctx.save();
    if (this.state.screenShakeTimer > 0) {
      const magnitude = (this.state.screenShakeTimer / 15) * 8;
      this.ctx.translate(
        (Math.random() - 0.5) * magnitude,
        (Math.random() - 0.5) * magnitude,
      );
    }

    // Draw Platforms
    for (const plat of this.state.platforms) {
      this.ctx.save();
      
      const isJumpBar = plat.type === "jump-bar";
      const isMoving = plat.type === "moving";
      
      // Platform glow
      this.ctx.shadowBlur = 15;
      if (isJumpBar) {
        this.ctx.shadowColor = "rgba(251, 191, 36, 0.4)";
        this.ctx.fillStyle = "#f59e0b"; // Amber 500
      } else if (isMoving) {
        this.ctx.shadowColor = "rgba(129, 140, 248, 0.4)";
        this.ctx.fillStyle = "#6366f1"; // Indigo 500
      } else {
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = "#334155"; // Slate 700
      }

      // Main body with rounded-ish corners (simulated)
      this.ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
      
      // Highlight/texture
      const highlightGradient = this.ctx.createLinearGradient(plat.x, plat.y, plat.x, plat.y + plat.height);
      highlightGradient.addColorStop(0, "rgba(255, 255, 255, 0.15)");
      highlightGradient.addColorStop(0.5, "rgba(255, 255, 255, 0)");
      highlightGradient.addColorStop(1, "rgba(0, 0, 0, 0.2)");
      this.ctx.fillStyle = highlightGradient;
      this.ctx.fillRect(plat.x, plat.y, plat.width, plat.height);

      // Top edge glow
      this.ctx.fillStyle = isJumpBar ? "#fef3c7" : isMoving ? "#c7d2fe" : "#64748b";
      this.ctx.fillRect(plat.x, plat.y, plat.width, 2);

      this.ctx.restore();
    }

    // Draw Particles
    for (const p of this.state.particles) {
      this.ctx.save();
      this.ctx.globalAlpha = p.life / p.maxLife;
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = p.color;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    // Draw Players
    for (const p of this.state.players) {
      this.drawPlayer(p);
    }

    // Draw Arrows
    for (const arrow of this.state.arrows) {
      this.ctx.save();
      
      // Arrow Glow
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
      
      // Tail streak
      const streakGradient = this.ctx.createLinearGradient(
        arrow.x, arrow.y, 
        arrow.x - (arrow.velocity.x * 2), arrow.y
      );
      streakGradient.addColorStop(0, "rgba(255, 255, 255, 0.8)");
      streakGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      this.ctx.fillStyle = streakGradient;
      this.ctx.fillRect(
        arrow.velocity.x > 0 ? arrow.x - 20 : arrow.x + arrow.width, 
        arrow.y, 
        20, 
        arrow.height
      );

      // Body
      this.ctx.fillStyle = "#f8fafc"; // Slate 50
      this.ctx.fillRect(arrow.x, arrow.y, arrow.width, arrow.height);

      // Arrowhead
      this.ctx.fillStyle = "#94a3b8"; // Slate 400
      if (arrow.velocity.x > 0) {
        this.ctx.fillRect(arrow.x + arrow.width - 4, arrow.y - 1, 4, 6);
      } else {
        this.ctx.fillRect(arrow.x, arrow.y - 1, 4, 6);
      }
      
      this.ctx.restore();
    }

    this.ctx.restore();
  }
}
