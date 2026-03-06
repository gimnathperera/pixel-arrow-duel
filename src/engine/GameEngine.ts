import { GAME_HEIGHT, GAME_WIDTH, INITIAL_PLATFORMS } from "../game/MapDef";
import type { GameState, PlayerState, Rectangle } from "./types";

const GRAVITY = 0.5;
const MAX_FALL_SPEED = 12;
const JUMP_FORCE = -12;
const JUMP_BAR_FORCE = -16; // Trampoline bounce
const MOVE_SPEED = 5;
const ARROW_SPEED = 15;
const SHOOT_COOLDOWN = 30; // Frames
const MAX_HEALTH = 100;

export class GameEngine {
  private state: GameState;
  private ctx: CanvasRenderingContext2D;
  private keys: Set<string> = new Set();
  private animationFrameId: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2d context not available");
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;

    this.state = this.getInitialState();

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
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

  private updatePlayers() {
    const p1 = this.state.players[0];
    const p2 = this.state.players[1];

    // Input Handling
    // Player 1: WASD + Space
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
    }

    if (this.keys.has("Space") && p1.shootCooldown <= 0) {
      this.shootArrow(p1);
      p1.shootCooldown = SHOOT_COOLDOWN;
    }

    // Player 2: Arrows + Enter
    if (this.keys.has("ArrowLeft")) {
      p2.velocity.x = -MOVE_SPEED;
      p2.facingRight = false;
    } else if (this.keys.has("ArrowRight")) {
      p2.velocity.x = MOVE_SPEED;
      p2.facingRight = true;
    } else {
      p2.velocity.x = 0;
    }

    if (this.keys.has("ArrowUp") && p2.isGrounded) {
      p2.velocity.y = JUMP_FORCE;
      p2.isGrounded = false;
    }

    if (this.keys.has("Enter") && p2.shootCooldown <= 0) {
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

  private draw() {
    // Clear - slightly brighter background to match UI
    this.ctx.fillStyle = "#1e293b"; // Slate 800
    this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Apply Shake
    this.ctx.save();
    if (this.state.screenShakeTimer > 0) {
      const magnitude = (this.state.screenShakeTimer / 15) * 5;
      this.ctx.translate(
        (Math.random() - 0.5) * magnitude,
        (Math.random() - 0.5) * magnitude,
      );
    }

    // Draw Platforms
    for (const plat of this.state.platforms) {
      if (plat.type === "jump-bar") {
        this.ctx.fillStyle = "#facc15"; // Bright yellow - trampoline
        this.ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
        this.ctx.strokeStyle = "#ca8a04"; // Amber 600 outline
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(
          plat.x + 1,
          plat.y + 1,
          plat.width - 2,
          plat.height - 2,
        );
        this.ctx.fillStyle = "rgba(255,255,255,0.25)";
        this.ctx.fillRect(plat.x, plat.y, plat.width, 3);
      } else if (plat.type === "moving") {
        this.ctx.fillStyle = "#818cf8"; // indigo 400
        this.ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
        this.ctx.fillStyle = "rgba(255,255,255,0.1)";
        this.ctx.fillRect(plat.x, plat.y, plat.width, 4);
      } else {
        this.ctx.fillStyle = "#475569"; // Slate 600 - clearer platforms
        this.ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
        this.ctx.fillStyle = "rgba(255,255,255,0.12)";
        this.ctx.fillRect(plat.x, plat.y, plat.width, 4);
      }
    }

    // Draw Particles
    for (const p of this.state.particles) {
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.life / p.maxLife;
      this.ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    this.ctx.globalAlpha = 1.0;

    // Draw Players
    for (const p of this.state.players) {
      // Body
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(p.x, p.y, p.width, p.height);

      // Eye / Direction indicator
      this.ctx.fillStyle = "#ffffff";
      const eyeX = p.facingRight ? p.x + p.width - 6 : p.x + 2;
      this.ctx.fillRect(eyeX, p.y + 4, 4, 4);

      // Bow indication
      this.ctx.fillStyle = "#d97706"; // amber 600
      const bowX = p.facingRight ? p.x + p.width : p.x - 4;
      this.ctx.fillRect(bowX, p.y + 10, 4, 8);
    }

    // Draw Arrows
    for (const arrow of this.state.arrows) {
      this.ctx.fillStyle = "#e5e7eb"; // gray 200
      this.ctx.fillRect(arrow.x, arrow.y, arrow.width, arrow.height);

      // Arrowhead
      this.ctx.fillStyle = "#94a3b8"; // slate 400
      if (arrow.velocity.x > 0) {
        this.ctx.fillRect(arrow.x + arrow.width - 4, arrow.y - 1, 4, 6);
      } else {
        this.ctx.fillRect(arrow.x, arrow.y - 1, 4, 6);
      }
    }

    this.ctx.restore();
  }
}
