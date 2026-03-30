// ---------------------------------------------------------------------------
// tests/helpers.test.js — Helper platform insertion tests
// ---------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import { addHelperPlatformsIfNeeded } from '../js/detection/helpers.js';
import { Platform } from '../js/engine/platform.js';
import { BLOCK_SIZE } from '../js/config.js';

// ---------------------------------------------------------------------------
// Reference implementations of utility functions passed to helpers
// (These mirror the production logic in js/main.js which can't be imported
//  directly due to top-level DOM dependencies.)
// ---------------------------------------------------------------------------

function intervalGap(a1, a2, b1, b2) {
    if (a2 < b1) return b1 - a2;
    if (b2 < a1) return a1 - b2;
    return 0;
}

function overlapsAny(candidate, allPlatforms) {
    for (const p of allPlatforms) {
        if (p.kind === 'wall' || p.kind === 'shadow') continue;
        const overlaps = !(candidate.x + candidate.width <= p.x ||
            candidate.x >= p.x + p.width ||
            candidate.y + candidate.height <= p.y ||
            candidate.y >= p.y + p.height);
        if (overlaps) return true;
    }
    return false;
}

function canReachPlatform(from, to, limits, _allPlatforms) {
    if (from === to) return false;
    const dx = intervalGap(from.x, from.x + from.width, to.x, to.x + to.width);
    if (dx > limits.maxJumpDx) return false;
    const up = from.y - to.y;
    if (up <= 0) return true;
    if (up > limits.maxJumpUp) return false;
    const disc = (limits.jumpPower * limits.jumpPower) - (2 * limits.gravity * up);
    if (disc < 0) return false;
    const tLanding = (limits.jumpPower + Math.sqrt(disc)) / limits.gravity;
    const dxLimit = Math.min(limits.maxJumpDx, limits.speed * tLanding * 0.9);
    return dx <= dxLimit;
}

function isReachable(start, goal, allPlatforms, limits) {
    const traversable = allPlatforms.filter(p => p.kind !== 'wall' && p.kind !== 'shadow');
    const visited = new Set();
    const queue = [start];
    visited.add(start);
    let iterations = 0;
    while (queue.length) {
        iterations++;
        if (iterations > 10000) return false;
        const current = queue.shift();
        if (current === goal) return true;
        for (const next of traversable) {
            if (visited.has(next)) continue;
            if (!canReachPlatform(current, next, limits, traversable)) continue;
            visited.add(next);
            queue.push(next);
        }
    }
    return false;
}

// Standard jump limits for base world width (800px)
const LIMITS = {
    maxJumpDx: 120,
    maxJumpUp: 196,
    speed: 3,
    gravity: 0.5,
    jumpPower: 14,
};

// ---------------------------------------------------------------------------
// Helper to build options with defaults, reducing test boilerplate.
//
// IMPORTANT: Test scenarios use a moderate gap (200px vertical) that is
// bridgeable by a single midpoint helper. Larger gaps (>196px to midpoint)
// can trigger a known production issue where the while-loop doesn't
// terminate (addHelpers returns candidates.length > 0 even when no helper
// was placed, so failedAttempts never increments). Tests that need to
// verify maxHelpers limit use stub callbacks to avoid this.
// ---------------------------------------------------------------------------
function makeOptions(overrides = {}) {
    const start = overrides.startPlatform || new Platform(40, 400, 80, BLOCK_SIZE, '#000', 'start');
    const goal = overrides.goalPlatform || new Platform(350, 200, 80, BLOCK_SIZE, '#000', 'goal');
    const allPlatforms = overrides.allPlatforms || [start, goal];
    const debugHelpers = overrides.debugHelperPlatforms || [];
    return {
        startPlatform: start,
        goalPlatform: goal,
        allPlatforms,
        limits: overrides.limits || LIMITS,
        maxHelpers: overrides.maxHelpers ?? 10,
        blockSize: BLOCK_SIZE,
        width: overrides.width ?? 800,
        height: overrides.height ?? 600,
        wordBarAreaHeight: overrides.wordBarAreaHeight ?? 30,
        platformClass: Platform,
        overlapsAny: overrides.overlapsAny ?? overlapsAny,
        isReachable: overrides.isReachable ?? isReachable,
        canReachPlatform: overrides.canReachPlatform ?? canReachPlatform,
        debugHelperPlatforms: debugHelpers,
        mlOnlyMode: overrides.mlOnlyMode ?? false,
    };
}

describe('addHelperPlatformsIfNeeded', () => {
    // ----- Real BFS tests (safe moderate-gap scenario) ---------------------

    it('does nothing when goal is already reachable', () => {
        // Start and goal are close enough (20px vertical, 80px horizontal)
        const start = new Platform(40, 500, 100, BLOCK_SIZE, '#000', 'start');
        const goal = new Platform(200, 480, 80, BLOCK_SIZE, '#000', 'goal');
        const debugHelpers = [];

        addHelperPlatformsIfNeeded(makeOptions({
            startPlatform: start,
            goalPlatform: goal,
            allPlatforms: [start, goal],
            debugHelperPlatforms: debugHelpers,
        }));

        expect(debugHelpers).toHaveLength(0);
    });

    it('adds helper platforms when goal is not reachable', () => {
        // 200px vertical gap, 230px horizontal → needs helper(s)
        const start = new Platform(40, 400, 80, BLOCK_SIZE, '#000', 'start');
        const goal = new Platform(350, 200, 80, BLOCK_SIZE, '#000', 'goal');
        const allPlatforms = [start, goal];
        const debugHelpers = [];

        addHelperPlatformsIfNeeded(makeOptions({
            startPlatform: start,
            goalPlatform: goal,
            allPlatforms,
            debugHelperPlatforms: debugHelpers,
        }));

        expect(debugHelpers.length).toBeGreaterThan(0);
        expect(allPlatforms.length).toBeGreaterThan(2);
    });

    it('helper platforms have correct kind and height', () => {
        const start = new Platform(40, 400, 80, BLOCK_SIZE, '#000', 'start');
        const goal = new Platform(350, 200, 80, BLOCK_SIZE, '#000', 'goal');
        const allPlatforms = [start, goal];
        const debugHelpers = [];

        addHelperPlatformsIfNeeded(makeOptions({
            startPlatform: start,
            goalPlatform: goal,
            allPlatforms,
            debugHelperPlatforms: debugHelpers,
        }));

        expect(debugHelpers.length).toBeGreaterThan(0);
        for (const h of debugHelpers) {
            expect(h.height).toBe(BLOCK_SIZE);
            expect(h.kind).toBe('helper');
        }
    });

    it('helpers stay within world bounds', () => {
        const start = new Platform(40, 400, 80, BLOCK_SIZE, '#000', 'start');
        const goal = new Platform(350, 200, 80, BLOCK_SIZE, '#000', 'goal');
        const allPlatforms = [start, goal];
        const debugHelpers = [];

        addHelperPlatformsIfNeeded(makeOptions({
            startPlatform: start,
            goalPlatform: goal,
            allPlatforms,
            debugHelperPlatforms: debugHelpers,
        }));

        for (const h of debugHelpers) {
            expect(h.x).toBeGreaterThanOrEqual(0);
            expect(h.x + h.width).toBeLessThanOrEqual(800);
            expect(h.y).toBeGreaterThanOrEqual(30);  // wordBarAreaHeight
            expect(h.y + h.height).toBeLessThanOrEqual(600);
        }
    });

    it('helpers are pushed to the allPlatforms array', () => {
        const start = new Platform(40, 400, 80, BLOCK_SIZE, '#000', 'start');
        const goal = new Platform(350, 200, 80, BLOCK_SIZE, '#000', 'goal');
        const allPlatforms = [start, goal];
        const debugHelpers = [];
        const initialLength = allPlatforms.length;

        addHelperPlatformsIfNeeded(makeOptions({
            startPlatform: start,
            goalPlatform: goal,
            allPlatforms,
            debugHelperPlatforms: debugHelpers,
        }));

        // Every helper in debug should also be in allPlatforms
        expect(allPlatforms.length).toBe(initialLength + debugHelpers.length);
        for (const h of debugHelpers) {
            expect(allPlatforms).toContain(h);
        }
    });

    it('caps helper width to 2 blocks in ML-only mode', () => {
        const start = new Platform(40, 400, 80, BLOCK_SIZE, '#000', 'start');
        const goal = new Platform(350, 200, 80, BLOCK_SIZE, '#000', 'goal');
        const allPlatforms = [start, goal];
        const debugHelpers = [];

        addHelperPlatformsIfNeeded(makeOptions({
            startPlatform: start,
            goalPlatform: goal,
            allPlatforms,
            debugHelperPlatforms: debugHelpers,
            mlOnlyMode: true,
        }));

        const maxWidth = BLOCK_SIZE * 2;
        expect(debugHelpers.length).toBeGreaterThan(0);
        for (const h of debugHelpers) {
            expect(h.width).toBeLessThanOrEqual(maxWidth);
        }
    });

    // ----- Stub-based tests (for edge cases that need controlled behavior) -

    it('respects maxHelpers limit', () => {
        // Use stub callbacks to guarantee helpers are always placed,
        // avoiding the production code's termination bug with large gaps.
        const start = new Platform(40, 400, 80, BLOCK_SIZE, '#000', 'start');
        const goal = new Platform(350, 200, 80, BLOCK_SIZE, '#000', 'goal');
        const allPlatforms = [start, goal];
        const debugHelpers = [];

        // isReachable always returns false → forces helper insertion loop
        // canReachPlatform always returns true (unless from===to) → all candidates accepted
        // overlapsAny always returns false → no placement conflicts
        addHelperPlatformsIfNeeded(makeOptions({
            startPlatform: start,
            goalPlatform: goal,
            allPlatforms,
            debugHelperPlatforms: debugHelpers,
            maxHelpers: 3,
            isReachable: () => false,
            canReachPlatform: (from, to) => from !== to,
            overlapsAny: () => false,
        }));

        expect(debugHelpers.length).toBeLessThanOrEqual(3);
        expect(debugHelpers.length).toBe(3);
    });

    it('stops early when isReachable becomes true', () => {
        const start = new Platform(40, 400, 80, BLOCK_SIZE, '#000', 'start');
        const goal = new Platform(350, 200, 80, BLOCK_SIZE, '#000', 'goal');
        const allPlatforms = [start, goal];
        const debugHelpers = [];

        let reachableCalls = 0;
        addHelperPlatformsIfNeeded(makeOptions({
            startPlatform: start,
            goalPlatform: goal,
            allPlatforms,
            debugHelperPlatforms: debugHelpers,
            maxHelpers: 10,
            // isReachable is called: (1) initial check at top, (2) start of each while iteration.
            // Return false for first 2 calls so one iteration of helper placement runs,
            // then true on call 3 so the loop exits after placing helpers.
            isReachable: () => {
                reachableCalls++;
                return reachableCalls > 2;
            },
            canReachPlatform: (from, to) => from !== to,
            overlapsAny: () => false,
        }));

        // Should have added helpers in first iteration, then stopped when isReachable returned true
        expect(debugHelpers.length).toBeGreaterThan(0);
        expect(debugHelpers.length).toBeLessThan(10);
    });

    it('does not add helpers when maxHelpers is 0', () => {
        const start = new Platform(40, 400, 80, BLOCK_SIZE, '#000', 'start');
        const goal = new Platform(350, 200, 80, BLOCK_SIZE, '#000', 'goal');
        const allPlatforms = [start, goal];
        const debugHelpers = [];

        addHelperPlatformsIfNeeded(makeOptions({
            startPlatform: start,
            goalPlatform: goal,
            allPlatforms,
            debugHelperPlatforms: debugHelpers,
            maxHelpers: 0,
            isReachable: () => false,
        }));

        expect(debugHelpers).toHaveLength(0);
    });
});
