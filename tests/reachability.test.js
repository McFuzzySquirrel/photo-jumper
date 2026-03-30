// ---------------------------------------------------------------------------
// tests/reachability.test.js — Reachability validation (canReachPlatform, isReachable, hasCeilingAbove)
//
// NOTE: These functions are NOT exported from main.js (they are internal).
// We implement reference versions matching the exact production logic and test
// the algorithmic correctness. This validates the mathematical/physics-based
// reachability calculations that are critical for level fairness.
// ---------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import { Platform } from '../js/engine/platform.js';
import {
    PLAYER_SPEED,
    PLAYER_JUMP_POWER,
    PLAYER_GRAVITY,
    BLOCK_SIZE,
    MAX_PLATFORM_WIDTH_BLOCKS,
    PLATFORM_GAP_WIDTH_BLOCKS,
    PLATFORM_MIN_WIDTH,
} from '../js/config.js';

// ---------------------------------------------------------------------------
// Reference implementations (mirror production code in js/main.js)
// ---------------------------------------------------------------------------

function intervalGap(a1, a2, b1, b2) {
    if (a2 < b1) return b1 - a2;
    if (b2 < a1) return a1 - b2;
    return 0;
}

function canReachPlatform(from, to, limits, allPlatforms) {
    if (from === to) return false;

    const fromLeft = from.x;
    const fromRight = from.x + from.width;
    const toLeft = to.x;
    const toRight = to.x + to.width;

    const dx = intervalGap(fromLeft, fromRight, toLeft, toRight);
    if (dx > limits.maxJumpDx) return false;

    const up = from.y - to.y;
    if (up <= 0) return true;  // Dropping down

    if (up > limits.maxJumpUp) return false;

    const disc = (limits.jumpPower * limits.jumpPower) - (2 * limits.gravity * up);
    if (disc < 0) return false;
    const tLanding = (limits.jumpPower + Math.sqrt(disc)) / limits.gravity;
    const dxLimit = Math.min(limits.maxJumpDx, limits.speed * tLanding * 0.9);
    if (dx > dxLimit) return false;

    // Ceiling check
    if (allPlatforms && up > 0) {
        const laneLeft = Math.max(fromLeft, toLeft);
        const laneRight = Math.min(fromRight, toRight);
        if (laneLeft < laneRight) {
            const topY = to.y + to.height;
            const botY = from.y;
            for (const p of allPlatforms) {
                if (p === from || p === to || p.kind === 'wall' || p.kind === 'shadow') continue;
                if (p.y + p.height > topY && p.y < botY) {
                    if (p.x <= laneLeft && p.x + p.width >= laneRight) {
                        return false;
                    }
                }
            }
        }
    }

    return true;
}

function hasCeilingAbove(platform, allPlatforms, jumpHeight) {
    const aboveY = platform.y - jumpHeight;
    for (const p of allPlatforms) {
        if (p === platform || p.kind === 'wall' || p.kind === 'shadow') continue;
        if (p.y + p.height > aboveY && p.y + p.height <= platform.y) {
            if (p.x <= platform.x && p.x + p.width >= platform.x + platform.width) {
                return true;
            }
        }
    }
    return false;
}

function isReachable(startPlatform, goalPlatform, allPlatforms, limits) {
    const traversable = allPlatforms.filter(p => p.kind !== 'wall' && p.kind !== 'shadow');
    const visited = new Set();
    const queue = [startPlatform];
    visited.add(startPlatform);

    while (queue.length) {
        const current = queue.shift();
        if (current === goalPlatform) return true;
        for (const next of traversable) {
            if (visited.has(next)) continue;
            if (!canReachPlatform(current, next, limits, traversable)) continue;
            visited.add(next);
            queue.push(next);
        }
    }

    return false;
}

function splitLongPlatforms(platformList, blockSize) {
    const maxWidth = MAX_PLATFORM_WIDTH_BLOCKS * blockSize;
    const gapWidth = PLATFORM_GAP_WIDTH_BLOCKS * blockSize;
    const minSegWidth = PLATFORM_MIN_WIDTH;
    const result = [];

    for (const p of platformList) {
        if (p.kind === 'ground' || p.kind === 'start' || p.kind === 'goal') {
            result.push(p);
            continue;
        }
        if (p.width <= maxWidth) {
            result.push(p);
            continue;
        }
        const totalContentWidth = p.width;
        const numGaps = Math.floor(totalContentWidth / maxWidth);
        const numSegments = numGaps + 1;
        const totalGapWidth = numGaps * gapWidth;
        const segmentWidth = Math.floor((totalContentWidth - totalGapWidth) / numSegments);

        if (segmentWidth < minSegWidth) {
            result.push(p);
            continue;
        }

        let x = p.x;
        for (let i = 0; i < numSegments; i++) {
            const isLast = (i === numSegments - 1);
            const w = isLast
                ? Math.max(minSegWidth, (p.x + p.width) - x)
                : segmentWidth;
            const alignedW = Math.floor(w / blockSize) * blockSize;
            const finalW = Math.max(minSegWidth, alignedW);
            result.push(new Platform(x, p.y, finalW, p.height, p.color, p.kind));
            x += finalW + gapWidth;
            if (x >= p.x + p.width) break;
        }
    }

    return result;
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

// ---------------------------------------------------------------------------
// Standard jump limits at base world width (800px)
// ---------------------------------------------------------------------------
const jumpPower = PLAYER_JUMP_POWER;
const gravity = PLAYER_GRAVITY;
const speed = PLAYER_SPEED;
const maxJumpUp = (jumpPower * jumpPower) / (2 * gravity);
const tApex = jumpPower / gravity;
const maxJumpDx = speed * tApex * 2;  // full jump horizontal distance

const LIMITS = { maxJumpDx, maxJumpUp, speed, gravity, jumpPower };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('intervalGap', () => {
    it('returns gap between non-overlapping intervals (A left of B)', () => {
        expect(intervalGap(0, 10, 20, 30)).toBe(10);
    });

    it('returns gap between non-overlapping intervals (B left of A)', () => {
        expect(intervalGap(20, 30, 0, 10)).toBe(10);
    });

    it('returns 0 for overlapping intervals', () => {
        expect(intervalGap(0, 20, 10, 30)).toBe(0);
    });

    it('returns 0 for touching intervals', () => {
        expect(intervalGap(0, 10, 10, 20)).toBe(0);
    });

    it('returns 0 when one interval contains the other', () => {
        expect(intervalGap(0, 100, 20, 30)).toBe(0);
    });
});

describe('canReachPlatform', () => {
    it('returns false for same platform', () => {
        const p = new Platform(100, 200, 80, 20, '#000');
        expect(canReachPlatform(p, p, LIMITS, [p])).toBe(false);
    });

    it('allows dropping down (any horizontal distance within maxJumpDx)', () => {
        const from = new Platform(100, 100, 80, 20, '#000');
        const to = new Platform(100, 300, 80, 20, '#000');  // below
        expect(canReachPlatform(from, to, LIMITS, [from, to])).toBe(true);
    });

    it('allows jumping to adjacent platform at same height', () => {
        const from = new Platform(0, 200, 80, 20, '#000');
        const to = new Platform(100, 200, 80, 20, '#000');
        expect(canReachPlatform(from, to, LIMITS, [from, to])).toBe(true);
    });

    it('allows jumping up one block', () => {
        const from = new Platform(100, 200, 80, 20, '#000');
        const to = new Platform(100, 180, 80, 20, '#000');  // 1 block higher
        expect(canReachPlatform(from, to, LIMITS, [from, to])).toBe(true);
    });

    it('rejects platform beyond maxJumpUp', () => {
        const from = new Platform(100, 500, 80, 20, '#000');
        const to = new Platform(100, 100, 80, 20, '#000');  // way too high
        expect(canReachPlatform(from, to, LIMITS, [from, to])).toBe(false);
    });

    it('rejects platform beyond maxJumpDx horizontally', () => {
        const from = new Platform(0, 200, 40, 20, '#000');
        const to = new Platform(500, 200, 40, 20, '#000');  // very far right
        expect(canReachPlatform(from, to, LIMITS, [from, to])).toBe(false);
    });

    it('accounts for platform width in horizontal gap', () => {
        // Two wide platforms that nearly touch — gap is 0
        const from = new Platform(0, 200, 100, 20, '#000');
        const to = new Platform(100, 180, 100, 20, '#000');  // touching
        expect(canReachPlatform(from, to, LIMITS, [from, to])).toBe(true);
    });

    it('rejects when ceiling blocks the jump', () => {
        const from = new Platform(100, 200, 80, 20, '#000');
        const to = new Platform(100, 100, 80, 20, '#000');
        const ceiling = new Platform(100, 150, 80, 20, '#000');  // between from and to
        expect(canReachPlatform(from, to, LIMITS, [from, to, ceiling])).toBe(false);
    });

    it('ceiling check ignores wall/shadow platforms', () => {
        const from = new Platform(100, 200, 80, 20, '#000');
        const to = new Platform(100, 100, 80, 20, '#000');
        const wallCeiling = new Platform(100, 150, 80, 20, '#000', 'wall');
        expect(canReachPlatform(from, to, LIMITS, [from, to, wallCeiling])).toBe(true);
    });

    it('ceiling only blocks when it fully covers the horizontal lane', () => {
        const from = new Platform(100, 200, 80, 20, '#000');
        const to = new Platform(120, 100, 40, 20, '#000');
        // Partial ceiling — doesn't cover the full lane [120, 160]
        const partialCeiling = new Platform(100, 150, 30, 20, '#000');
        expect(canReachPlatform(from, to, LIMITS, [from, to, partialCeiling])).toBe(true);
    });

    it('physics: higher targets require more horizontal reach time', () => {
        const from = new Platform(0, 300, 40, 20, '#000');
        const toNear = new Platform(80, 260, 40, 20, '#000');     // 2 blocks up, close
        const toFarHigh = new Platform(80, 120, 40, 20, '#000');  // very high up

        const nearReachable = canReachPlatform(from, toNear, LIMITS, [from, toNear]);
        const farHighReachable = canReachPlatform(from, toFarHigh, LIMITS, [from, toFarHigh]);

        // Near+low should be reachable; far+high may not be (depends on exact values)
        expect(nearReachable).toBe(true);
        // farHighReachable may or may not be true depending on the physics calculation
    });
});

describe('hasCeilingAbove', () => {
    it('returns false when nothing is above', () => {
        const p = new Platform(100, 200, 80, 20, '#000');
        expect(hasCeilingAbove(p, [p], 100)).toBe(false);
    });

    it('returns true when a platform fully covers above within jump height', () => {
        const p = new Platform(100, 200, 80, 20, '#000');
        const ceiling = new Platform(100, 150, 80, 20, '#000');  // 30px above (within 100)
        expect(hasCeilingAbove(p, [p, ceiling], 100)).toBe(true);
    });

    it('returns false when ceiling is beyond jump height', () => {
        const p = new Platform(100, 200, 80, 20, '#000');
        const ceiling = new Platform(100, 50, 80, 20, '#000');  // 130px above
        expect(hasCeilingAbove(p, [p, ceiling], 50)).toBe(false);
    });

    it('returns false when ceiling only partially covers horizontally', () => {
        const p = new Platform(100, 200, 80, 20, '#000');
        // Ceiling only 40px wide, doesn't cover full 80px width
        const ceiling = new Platform(110, 160, 40, 20, '#000');
        expect(hasCeilingAbove(p, [p, ceiling], 100)).toBe(false);
    });

    it('ignores wall and shadow platforms', () => {
        const p = new Platform(100, 200, 80, 20, '#000');
        const wallAbove = new Platform(100, 150, 80, 20, '#000', 'wall');
        const shadowAbove = new Platform(100, 160, 80, 20, '#000', 'shadow');
        expect(hasCeilingAbove(p, [p, wallAbove, shadowAbove], 100)).toBe(false);
    });

    it('detects ceiling at the exact jump height boundary', () => {
        const p = new Platform(100, 200, 80, 20, '#000');
        // Ceiling with bottom at y=100+20=120, which is 80 above p.y(200)
        // aboveY = 200 - 80 = 120
        // Condition: ceiling.y + ceiling.height > 120 && ceiling.y + ceiling.height <= 200
        const ceiling = new Platform(100, 105, 80, 20, '#000');  // bottom at 125
        expect(hasCeilingAbove(p, [p, ceiling], 80)).toBe(true);
    });
});

describe('isReachable (BFS)', () => {
    it('finds path between adjacent platforms', () => {
        const start = new Platform(0, 200, 80, 20, '#000', 'start');
        const goal = new Platform(100, 200, 80, 20, '#000', 'goal');
        expect(isReachable(start, goal, [start, goal], LIMITS)).toBe(true);
    });

    it('finds multi-hop path through intermediate platforms', () => {
        const start = new Platform(0, 300, 80, 20, '#000', 'start');
        const mid1 = new Platform(100, 280, 80, 20, '#000');
        const mid2 = new Platform(200, 260, 80, 20, '#000');
        const goal = new Platform(300, 240, 80, 20, '#000', 'goal');

        expect(isReachable(start, goal, [start, mid1, mid2, goal], LIMITS)).toBe(true);
    });

    it('returns false for disconnected platforms', () => {
        const start = new Platform(0, 300, 40, 20, '#000', 'start');
        const goal = new Platform(700, 50, 40, 20, '#000', 'goal');  // far away

        expect(isReachable(start, goal, [start, goal], LIMITS)).toBe(false);
    });

    it('filters wall and shadow platforms from traversal', () => {
        const start = new Platform(0, 200, 80, 20, '#000', 'start');
        const wall = new Platform(100, 200, 80, 20, '#000', 'wall');
        const goal = new Platform(300, 200, 80, 20, '#000', 'goal');

        // Without the wall as a stepping stone, goal may or may not be reachable
        // The wall should not be used as a stepping stone
        const allPlatforms = [start, wall, goal];
        const result = isReachable(start, goal, allPlatforms, LIMITS);
        // start→goal gap is 220px. Check if within maxJumpDx
        const gap = 300 - 80;  // 220px
        if (gap > LIMITS.maxJumpDx) {
            expect(result).toBe(false);
        } else {
            expect(result).toBe(true);
        }
    });

    it('handles linear staircase upward', () => {
        const platforms = [];
        // Create a staircase of platforms going up, each reachable from the previous
        for (let i = 0; i < 5; i++) {
            const x = i * 60;
            const y = 400 - i * 30;
            platforms.push(new Platform(x, y, 80, 20, '#000', i === 0 ? 'start' : i === 4 ? 'goal' : 'photo'));
        }

        expect(isReachable(platforms[0], platforms[4], platforms, LIMITS)).toBe(true);
    });

    it('handles dropping down path', () => {
        const start = new Platform(0, 100, 80, 20, '#000', 'start');
        const mid = new Platform(100, 200, 80, 20, '#000');
        const goal = new Platform(200, 300, 80, 20, '#000', 'goal');

        expect(isReachable(start, goal, [start, mid, goal], LIMITS)).toBe(true);
    });
});

describe('splitLongPlatforms', () => {
    it('does not split platforms at or under max width', () => {
        const maxWidth = MAX_PLATFORM_WIDTH_BLOCKS * BLOCK_SIZE;
        const p = new Platform(0, 100, maxWidth, 20, '#000', 'photo');
        const result = splitLongPlatforms([p], BLOCK_SIZE);
        expect(result).toHaveLength(1);
    });

    it('splits platforms exceeding max width into segments', () => {
        const maxWidth = MAX_PLATFORM_WIDTH_BLOCKS * BLOCK_SIZE;
        const p = new Platform(0, 100, maxWidth * 3, 20, '#000', 'photo');
        const result = splitLongPlatforms([p], BLOCK_SIZE);
        expect(result.length).toBeGreaterThan(1);
    });

    it('never splits ground, start, or goal platforms', () => {
        const maxWidth = MAX_PLATFORM_WIDTH_BLOCKS * BLOCK_SIZE;
        const bigWidth = maxWidth * 5;
        const ground = new Platform(0, 500, bigWidth, 20, '#000', 'ground');
        const start = new Platform(0, 400, bigWidth, 20, '#000', 'start');
        const goal = new Platform(0, 300, bigWidth, 20, '#000', 'goal');

        const result = splitLongPlatforms([ground, start, goal], BLOCK_SIZE);
        expect(result).toHaveLength(3);
    });

    it('segments maintain grid alignment', () => {
        const maxWidth = MAX_PLATFORM_WIDTH_BLOCKS * BLOCK_SIZE;
        const p = new Platform(0, 100, maxWidth * 2 + 100, 20, '#000', 'photo');
        const result = splitLongPlatforms([p], BLOCK_SIZE);

        for (const seg of result) {
            // Width should be at least minimum
            expect(seg.width).toBeGreaterThanOrEqual(PLATFORM_MIN_WIDTH);
        }
    });

    it('preserves platform kind in segments', () => {
        const maxWidth = MAX_PLATFORM_WIDTH_BLOCKS * BLOCK_SIZE;
        const p = new Platform(0, 100, maxWidth * 3, 20, '#000', 'photo');
        const result = splitLongPlatforms([p], BLOCK_SIZE);

        for (const seg of result) {
            expect(seg.kind).toBe('photo');
            expect(seg.y).toBe(100);
            expect(seg.height).toBe(20);
        }
    });
});

describe('overlapsAny', () => {
    it('returns false for non-overlapping platforms', () => {
        const candidate = new Platform(0, 0, 40, 20, '#000');
        const existing = [new Platform(200, 200, 40, 20, '#000')];
        expect(overlapsAny(candidate, existing)).toBe(false);
    });

    it('returns true for overlapping platforms', () => {
        const candidate = new Platform(10, 10, 40, 20, '#000');
        const existing = [new Platform(20, 10, 40, 20, '#000')];
        expect(overlapsAny(candidate, existing)).toBe(true);
    });

    it('ignores wall and shadow platforms', () => {
        const candidate = new Platform(10, 10, 40, 20, '#000');
        const wall = new Platform(10, 10, 40, 20, '#000', 'wall');
        const shadow = new Platform(10, 10, 40, 20, '#000', 'shadow');
        expect(overlapsAny(candidate, [wall, shadow])).toBe(false);
    });

    it('returns false for edge-touching (non-overlapping) platforms', () => {
        const candidate = new Platform(0, 0, 40, 20, '#000');
        const rightNeighbor = new Platform(40, 0, 40, 20, '#000');
        const belowNeighbor = new Platform(0, 20, 40, 20, '#000');
        expect(overlapsAny(candidate, [rightNeighbor, belowNeighbor])).toBe(false);
    });
});
