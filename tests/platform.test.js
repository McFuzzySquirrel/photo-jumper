// ---------------------------------------------------------------------------
// tests/platform.test.js — Platform class geometry tests
// ---------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import { Platform } from '../js/engine/platform.js';
import { BLOCK_SIZE, PLATFORM_MIN_WIDTH, PLATFORM_THICKNESS } from '../js/config.js';

describe('Platform class', () => {
    describe('Constructor', () => {
        it('creates a platform with correct properties', () => {
            const p = new Platform(100, 200, 60, 20, '#000', 'photo');
            expect(p.x).toBe(100);
            expect(p.y).toBe(200);
            expect(p.width).toBe(60);
            expect(p.height).toBe(20);
            expect(p.color).toBe('#000');
            expect(p.kind).toBe('photo');
        });

        it('defaults kind to "photo" when not specified', () => {
            const p = new Platform(0, 0, 40, 20, 'red');
            expect(p.kind).toBe('photo');
        });

        it('accepts different platform kinds', () => {
            const kinds = ['photo', 'helper', 'start', 'goal', 'ground', 'wall', 'shadow',
                'ml-seg', 'fallback-hough', 'fallback-edge-density', 'fallback-skeleton'];
            for (const kind of kinds) {
                const p = new Platform(0, 0, 40, 20, '#000', kind);
                expect(p.kind).toBe(kind);
            }
        });
    });

    describe('Grid snapping expectations', () => {
        it('platform at grid-aligned coordinates maintains alignment', () => {
            const x = 3 * BLOCK_SIZE;  // 60
            const y = 5 * BLOCK_SIZE;  // 100
            const w = 4 * BLOCK_SIZE;  // 80
            const p = new Platform(x, y, w, BLOCK_SIZE, '#000');
            expect(p.x % BLOCK_SIZE).toBe(0);
            expect(p.y % BLOCK_SIZE).toBe(0);
            expect(p.width % BLOCK_SIZE).toBe(0);
        });

        it('standard thickness is one block height', () => {
            const p = new Platform(0, 0, 80, PLATFORM_THICKNESS, '#000');
            expect(p.height).toBe(BLOCK_SIZE);
        });

        it('minimum width is 2 blocks (40px)', () => {
            const minWidth = PLATFORM_MIN_WIDTH;
            expect(minWidth).toBe(2 * BLOCK_SIZE);
            const p = new Platform(0, 0, minWidth, BLOCK_SIZE, '#000');
            expect(p.width).toBe(40);
        });
    });

    describe('Platform as data object', () => {
        it('can be used in collision calculations', () => {
            const p1 = new Platform(0, 90, 60, 20, '#000');
            const p2 = new Platform(50, 80, 60, 20, '#000');

            // Overlap check (AABB)
            const overlaps = !(p1.x + p1.width <= p2.x ||
                p1.x >= p2.x + p2.width ||
                p1.y + p1.height <= p2.y ||
                p1.y >= p2.y + p2.height);
            expect(overlaps).toBe(true);
        });

        it('non-overlapping platforms detected correctly', () => {
            const p1 = new Platform(0, 100, 40, 20, '#000');
            const p2 = new Platform(200, 100, 40, 20, '#000');

            const overlaps = !(p1.x + p1.width <= p2.x ||
                p1.x >= p2.x + p2.width ||
                p1.y + p1.height <= p2.y ||
                p1.y >= p2.y + p2.height);
            expect(overlaps).toBe(false);
        });

        it('platforms at same height are vertically adjacent, not overlapping', () => {
            const p1 = new Platform(0, 100, 60, 20, '#000');
            const p2 = new Platform(0, 120, 60, 20, '#000'); // directly below

            const overlaps = !(p1.x + p1.width <= p2.x ||
                p1.x >= p2.x + p2.width ||
                p1.y + p1.height <= p2.y ||
                p1.y >= p2.y + p2.height);
            expect(overlaps).toBe(false);
        });
    });
});
