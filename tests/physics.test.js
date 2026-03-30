// ---------------------------------------------------------------------------
// tests/physics.test.js — Player physics tests
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Platform } from '../js/engine/platform.js';
import {
    PLAYER_SPEED,
    PLAYER_JUMP_POWER,
    PLAYER_GRAVITY,
    JUMP_CUT_DAMPING,
    PLAYER_SIZE,
    BLOCK_SIZE,
    BASE_WORLD_WIDTH,
    BASE_PLAYER_SIZE,
    MIN_PLAYER_SIZE,
} from '../js/config.js';

// We test the Player class by mocking the runtime module it imports.
// The runtime is a simple object with nullable function references.
// We mock it before importing Player.
vi.mock('../js/runtime.js', () => ({
    runtime: {
        ctx: null,
        getScaledBlockSize: () => 20,
        getScaledLetterSize: null,
        getGoal: null,
        getPlatforms: () => [],
        getWorldWidth: () => 800,
        getWorldHeight: () => 600,
        getKeys: () => ({}),
        touchJumpingRef: null,
        getScore: () => 0,
        setScore: () => {},
        getStartTime: () => Date.now(),
        getPlayerSpawnY: () => 500,
    },
}));

// Import Player AFTER mock is set up
const { Player, applyJumpCut } = await import('../js/engine/player.js');
const { runtime } = await import('../js/runtime.js');

describe('Player class — Constructor', () => {
    it('initializes position from arguments', () => {
        const player = new Player(
            40, 500,
            () => PLAYER_SIZE,
            () => PLAYER_SPEED,
            () => PLAYER_JUMP_POWER,
            () => PLAYER_GRAVITY,
        );

        expect(player.x).toBe(40);
        expect(player.y).toBe(500);
    });

    it('sets width and height from getScaledPlayerSize', () => {
        const player = new Player(0, 0, () => 30, () => 3, () => 14, () => 0.5);
        expect(player.width).toBe(30);
        expect(player.height).toBe(30);
    });

    it('uses scaled speed, jumpPower, and gravity', () => {
        const player = new Player(0, 0, () => 20, () => 5, () => 18, () => 0.7);
        expect(player.speed).toBe(5);
        expect(player.jumpPower).toBe(18);
        expect(player.gravity).toBe(0.7);
    });

    it('starts with zero velocity', () => {
        const player = new Player(0, 0, () => 20, () => 3, () => 14, () => 0.5);
        expect(player.velocityX).toBe(0);
        expect(player.velocityY).toBe(0);
    });

    it('starts not on ground', () => {
        const player = new Player(0, 0, () => 20, () => 3, () => 14, () => 0.5);
        expect(player.onGround).toBe(false);
    });
});

describe('Player physics — Gravity', () => {
    let player;

    beforeEach(() => {
        player = new Player(100, 200, () => PLAYER_SIZE, () => PLAYER_SPEED, () => PLAYER_JUMP_POWER, () => PLAYER_GRAVITY);
        // Reset runtime mock for each test
        runtime.getKeys = () => ({});
        runtime.getPlatforms = () => [];
        runtime.getWorldWidth = () => 800;
        runtime.getWorldHeight = () => 10000;  // tall world so player doesn't respawn
        runtime.touchJumpingRef = null;
        runtime.getScore = () => 0;
        runtime.setScore = () => {};
        runtime.getStartTime = () => Date.now();
    });

    it('gravity increases downward velocity each frame', () => {
        const initialVY = player.velocityY;
        player.update();
        expect(player.velocityY).toBe(initialVY + PLAYER_GRAVITY);
    });

    it('gravity accumulates over multiple frames', () => {
        const frames = 10;
        for (let i = 0; i < frames; i++) {
            player.update();
        }
        // After n frames: vy = n * gravity (since we start at 0 and add gravity each frame)
        // Player falls: y increases by sum of velocities
        expect(player.velocityY).toBeCloseTo(frames * PLAYER_GRAVITY, 1);
    });

    it('player falls when not on ground', () => {
        const initialY = player.y;
        player.update();
        expect(player.y).toBeGreaterThan(initialY);
    });
});

describe('Player physics — Jumping', () => {
    let player;

    beforeEach(() => {
        player = new Player(100, 200, () => PLAYER_SIZE, () => PLAYER_SPEED, () => PLAYER_JUMP_POWER, () => PLAYER_GRAVITY);
        player.onGround = true;  // Must be on ground to jump
        runtime.getKeys = () => ({});
        runtime.getPlatforms = () => [];
        runtime.getWorldWidth = () => 800;
        runtime.getWorldHeight = () => 10000;
        runtime.touchJumpingRef = null;
        runtime.getScore = () => 0;
        runtime.setScore = () => {};
        runtime.getStartTime = () => Date.now();
    });

    it('sets correct initial velocity on jump', () => {
        runtime.getKeys = () => ({ 'ArrowUp': true });

        player.update();

        // After jump: velocityY = -jumpPower + gravity (gravity applied in same frame)
        expect(player.velocityY).toBeCloseTo(-PLAYER_JUMP_POWER + PLAYER_GRAVITY, 1);
    });

    it('jump moves player upward', () => {
        runtime.getKeys = () => ({ 'ArrowUp': true });
        const initialY = player.y;

        player.update();

        // Player should move up (y decreases in screen coords)
        expect(player.y).toBeLessThan(initialY);
    });

    it('cannot double-jump (must be on ground)', () => {
        player.onGround = false;
        player.velocityY = 5;  // falling
        runtime.getKeys = () => ({ 'ArrowUp': true });

        player.update();

        // Should not get a jump velocity since not on ground
        // velocityY should be original + gravity (no jump)
        expect(player.velocityY).toBeCloseTo(5 + PLAYER_GRAVITY, 1);
    });

    it('enables jumpCutAllowed on jump', () => {
        runtime.getKeys = () => ({ 'ArrowUp': true });
        player.update();
        // jumpCutAllowed should be true while ascending (velocityY < 0)
        // After update: velocityY = -14 + 0.5 = -13.5 (still ascending)
        expect(player.jumpCutAllowed).toBe(true);
    });

    it('jump works with spacebar', () => {
        runtime.getKeys = () => ({ ' ': true });
        player.update();
        expect(player.velocityY).toBeCloseTo(-PLAYER_JUMP_POWER + PLAYER_GRAVITY, 1);
    });

    it('jump works with W key', () => {
        runtime.getKeys = () => ({ 'w': true });
        player.update();
        expect(player.velocityY).toBeCloseTo(-PLAYER_JUMP_POWER + PLAYER_GRAVITY, 1);
    });
});

describe('Player physics — Jump cut (variable jump)', () => {
    it('applyJumpCut reduces upward velocity', () => {
        const player = new Player(100, 200, () => PLAYER_SIZE, () => PLAYER_SPEED, () => PLAYER_JUMP_POWER, () => PLAYER_GRAVITY);
        player.velocityY = -10;  // ascending
        player.jumpCutAllowed = true;

        applyJumpCut(player);

        expect(player.velocityY).toBe(-10 * JUMP_CUT_DAMPING);
        expect(player.jumpCutAllowed).toBe(false);
    });

    it('applyJumpCut does nothing when not ascending', () => {
        const player = new Player(100, 200, () => PLAYER_SIZE, () => PLAYER_SPEED, () => PLAYER_JUMP_POWER, () => PLAYER_GRAVITY);
        player.velocityY = 5;  // falling
        player.jumpCutAllowed = true;

        applyJumpCut(player);

        expect(player.velocityY).toBe(5);  // unchanged
    });

    it('applyJumpCut does nothing when jumpCutAllowed is false', () => {
        const player = new Player(100, 200, () => PLAYER_SIZE, () => PLAYER_SPEED, () => PLAYER_JUMP_POWER, () => PLAYER_GRAVITY);
        player.velocityY = -10;
        player.jumpCutAllowed = false;

        applyJumpCut(player);

        expect(player.velocityY).toBe(-10);  // unchanged
    });

    it('applyJumpCut handles null player gracefully', () => {
        expect(() => applyJumpCut(null)).not.toThrow();
    });
});

describe('Player physics — Horizontal movement', () => {
    let player;

    beforeEach(() => {
        player = new Player(100, 200, () => PLAYER_SIZE, () => PLAYER_SPEED, () => PLAYER_JUMP_POWER, () => PLAYER_GRAVITY);
        runtime.getKeys = () => ({});
        runtime.getPlatforms = () => [];
        runtime.getWorldWidth = () => 800;
        runtime.getWorldHeight = () => 10000;
        runtime.touchJumpingRef = null;
        runtime.getScore = () => 0;
        runtime.setScore = () => {};
        runtime.getStartTime = () => Date.now();
    });

    it('moves right when ArrowRight pressed', () => {
        const initialX = player.x;
        runtime.getKeys = () => ({ 'ArrowRight': true });
        player.update();
        expect(player.x).toBeGreaterThan(initialX);
    });

    it('moves left when ArrowLeft pressed', () => {
        const initialX = player.x;
        runtime.getKeys = () => ({ 'ArrowLeft': true });
        player.update();
        expect(player.x).toBeLessThan(initialX);
    });

    it('speed is PLAYER_SPEED per frame of movement', () => {
        runtime.getKeys = () => ({ 'ArrowRight': true });
        player.update();
        // velocityX should be PLAYER_SPEED (set in update)
        // x should advance by PLAYER_SPEED from movement
        expect(player.velocityX).toBe(PLAYER_SPEED);
    });

    it('friction decelerates when no keys pressed', () => {
        player.velocityX = 10;
        player.update();
        // Friction: velocityX *= 0.7
        expect(player.velocityX).toBeCloseTo(10 * 0.7, 1);
    });

    it('player cannot go below x=0', () => {
        player.x = 5;
        runtime.getKeys = () => ({ 'ArrowLeft': true });
        player.update();
        expect(player.x).toBeGreaterThanOrEqual(0);
    });

    it('player cannot exceed world width', () => {
        player.x = 780;
        runtime.getKeys = () => ({ 'ArrowRight': true });
        player.update();
        expect(player.x + player.width).toBeLessThanOrEqual(800);
    });

    it('WASD keys work for movement', () => {
        const initialX = player.x;
        runtime.getKeys = () => ({ 'd': true });
        player.update();
        expect(player.x).toBeGreaterThan(initialX);
    });
});

describe('Player collision detection', () => {
    it('checkCollision returns true for overlapping rectangles', () => {
        const player = new Player(10, 10, () => 20, () => 3, () => 14, () => 0.5);
        const platform = new Platform(20, 20, 40, 20, '#000');
        expect(player.checkCollision(platform)).toBe(true);
    });

    it('checkCollision returns false for non-overlapping rectangles', () => {
        const player = new Player(0, 0, () => 20, () => 3, () => 14, () => 0.5);
        const platform = new Platform(100, 100, 40, 20, '#000');
        expect(player.checkCollision(platform)).toBe(false);
    });

    it('checkCollision returns false for edge-touching rectangles', () => {
        const player = new Player(0, 0, () => 20, () => 3, () => 14, () => 0.5);
        const platform = new Platform(20, 0, 40, 20, '#000');
        expect(player.checkCollision(platform)).toBe(false);
    });
});

describe('Player physics — Scaling', () => {
    it('scales physics consistently with world size ratio', () => {
        // Base world (800px): standard player size
        const baseRatio = BASE_WORLD_WIDTH / BASE_WORLD_WIDTH;
        const baseSize = Math.max(MIN_PLAYER_SIZE, Math.round(BASE_PLAYER_SIZE * baseRatio));
        expect(baseSize).toBe(BASE_PLAYER_SIZE);

        // Larger world (1600px): player scales up
        const largeRatio = 1600 / BASE_WORLD_WIDTH;
        const largeSize = Math.max(MIN_PLAYER_SIZE, Math.round(BASE_PLAYER_SIZE * largeRatio));
        expect(largeSize).toBe(40);

        // Small world: player still has minimum size
        const smallRatio = 200 / BASE_WORLD_WIDTH;
        const smallSize = Math.max(MIN_PLAYER_SIZE, Math.round(BASE_PLAYER_SIZE * smallRatio));
        expect(smallSize).toBe(MIN_PLAYER_SIZE);
    });

    it('max jump height calculation matches physics formula', () => {
        // h_max = v0^2 / (2 * g)
        const maxJumpHeight = (PLAYER_JUMP_POWER * PLAYER_JUMP_POWER) / (2 * PLAYER_GRAVITY);
        expect(maxJumpHeight).toBe(196);
    });

    it('time to apex matches physics formula', () => {
        // t_apex = v0 / g
        const tApex = PLAYER_JUMP_POWER / PLAYER_GRAVITY;
        expect(tApex).toBe(28);  // frames
    });

    it('max horizontal distance during jump matches physics', () => {
        // d_max = speed * 2 * t_apex (full parabola)
        const tApex = PLAYER_JUMP_POWER / PLAYER_GRAVITY;
        const maxDx = PLAYER_SPEED * 2 * tApex;
        expect(maxDx).toBe(168);
    });

    it('jump cut reduces max height by damping factor squared', () => {
        // If cut at velocity v: new velocity is v * DAMPING
        // New max height from cut = (v*DAMPING)^2 / (2*g)
        // For a cut immediately: v = JUMP_POWER
        const cutVelocity = PLAYER_JUMP_POWER * JUMP_CUT_DAMPING;
        const cutHeight = (cutVelocity * cutVelocity) / (2 * PLAYER_GRAVITY);
        const fullHeight = (PLAYER_JUMP_POWER * PLAYER_JUMP_POWER) / (2 * PLAYER_GRAVITY);
        expect(cutHeight).toBeLessThan(fullHeight);
        expect(cutHeight).toBe(fullHeight * JUMP_CUT_DAMPING * JUMP_CUT_DAMPING);
    });
});
