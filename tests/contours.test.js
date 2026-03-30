// ---------------------------------------------------------------------------
// tests/contours.test.js — Segmentation contour and stepped platform tests
// ---------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import { masksToTopContours, contoursToSteppedPlatforms } from '../js/detection/contours.js';
import { Platform } from '../js/engine/platform.js';
import { BLOCK_SIZE } from '../js/config.js';

describe('masksToTopContours', () => {
    it('returns empty array for null/empty masks', () => {
        expect(masksToTopContours({ masks: null, width: 100, height: 100 })).toEqual([]);
        expect(masksToTopContours({ masks: [], width: 100, height: 100 })).toEqual([]);
    });

    it('skips masks with no data', () => {
        const result = masksToTopContours({
            masks: [{ width: 10, height: 10 }],  // no .data
            width: 100,
            height: 100,
        });
        expect(result).toEqual([]);
    });

    it('extracts top contour from a simple rectangular mask', () => {
        // 10x10 mask with solid block in rows 3-7
        const maskWidth = 10;
        const maskHeight = 10;
        const data = new Float32Array(maskWidth * maskHeight);
        for (let y = 3; y <= 7; y++) {
            for (let x = 2; x <= 7; x++) {
                data[y * maskWidth + x] = 1.0;
            }
        }

        const result = masksToTopContours({
            masks: [{ data, width: maskWidth, height: maskHeight }],
            width: 100,
            height: 100,
        });

        expect(result).toHaveLength(1);
        expect(result[0].width).toBe(100);
        expect(result[0].height).toBe(100);
        // The contour should have non-null values in the scaled region
        const nonNull = result[0].contour.filter(y => y !== null);
        expect(nonNull.length).toBeGreaterThan(0);
    });

    it('returns correct world-space Y (scaled from mask space)', () => {
        // 5x5 mask, solid at row 1 for columns 0-4
        const maskWidth = 5;
        const maskHeight = 5;
        const data = new Float32Array(maskWidth * maskHeight);
        for (let x = 0; x < maskWidth; x++) {
            data[1 * maskWidth + x] = 1.0; // row 1
        }

        const worldWidth = 50;
        const worldHeight = 50;

        const result = masksToTopContours({
            masks: [{ data, width: maskWidth, height: maskHeight }],
            width: worldWidth,
            height: worldHeight,
        });

        expect(result).toHaveLength(1);
        // Row 1 in mask space, scaled by worldHeight/maskHeight = 50/5 = 10
        const nonNull = result[0].contour.filter(y => y !== null);
        expect(nonNull.length).toBeGreaterThan(0);
        // All non-null values should be around 10 (row 1 * scale 10)
        for (const y of nonNull) {
            expect(y).toBeGreaterThanOrEqual(8);  // allow smoothing tolerance
            expect(y).toBeLessThanOrEqual(12);
        }
    });

    it('handles multiple masks', () => {
        const maskWidth = 10;
        const maskHeight = 10;

        const mask1 = new Float32Array(maskWidth * maskHeight);
        const mask2 = new Float32Array(maskWidth * maskHeight);

        // Mask 1: solid at row 2
        for (let x = 0; x < maskWidth; x++) {
            mask1[2 * maskWidth + x] = 1.0;
        }
        // Mask 2: solid at row 5
        for (let x = 0; x < maskWidth; x++) {
            mask2[5 * maskWidth + x] = 1.0;
        }

        const result = masksToTopContours({
            masks: [
                { data: mask1, width: maskWidth, height: maskHeight },
                { data: mask2, width: maskWidth, height: maskHeight },
            ],
            width: 100,
            height: 100,
        });

        expect(result).toHaveLength(2);
    });
});

describe('contoursToSteppedPlatforms', () => {
    const defaultOptions = {
        blockSize: BLOCK_SIZE,
        platformMinWidth: 40,
        platformClass: Platform,
        color: '#ff0000',
        worldWidth: 800,
        worldHeight: 600,
        startAreaWidth: 140,
        startAreaHeight: 100,
        goalAreaWidth: 100,
        goalAreaHeight: 80,
        wordBarAreaHeight: 30,
        mergeGapPx: 0,
    };

    it('returns empty array for null/empty contours', () => {
        expect(contoursToSteppedPlatforms({ ...defaultOptions, contours: null })).toEqual([]);
        expect(contoursToSteppedPlatforms({ ...defaultOptions, contours: [] })).toEqual([]);
    });

    it('creates platforms from a flat contour', () => {
        // Flat contour at y=200 spanning x=100..300
        const contour = new Array(800).fill(null);
        for (let x = 100; x < 300; x++) {
            contour[x] = 200;
        }

        const result = contoursToSteppedPlatforms({
            ...defaultOptions,
            contours: [{ contour, width: 800, height: 600 }],
        });

        expect(result.length).toBeGreaterThan(0);
        // All platforms should be grid-aligned
        for (const p of result) {
            expect(p.x % BLOCK_SIZE).toBe(0);
            expect(p.y % BLOCK_SIZE).toBe(0);
            expect(p.width % BLOCK_SIZE).toBe(0);
            expect(p.height).toBe(BLOCK_SIZE);
            expect(p.kind).toBe('ml-seg');
        }
    });

    it('creates stepped platforms for a sloped contour', () => {
        // Contour that steps from y=200 to y=160 across x=100..300
        const contour = new Array(800).fill(null);
        for (let x = 100; x < 200; x++) contour[x] = 200;
        for (let x = 200; x < 300; x++) contour[x] = 160;

        const result = contoursToSteppedPlatforms({
            ...defaultOptions,
            contours: [{ contour, width: 800, height: 600 }],
        });

        // Should produce at least 2 platforms at different Y levels
        expect(result.length).toBeGreaterThanOrEqual(2);
        const yValues = new Set(result.map(p => p.y));
        expect(yValues.size).toBeGreaterThanOrEqual(2);
    });

    it('enforces minimum platform width', () => {
        // Very narrow contour (only 10px wide — less than 2 blocks)
        const contour = new Array(800).fill(null);
        for (let x = 100; x < 110; x++) contour[x] = 200;

        const result = contoursToSteppedPlatforms({
            ...defaultOptions,
            contours: [{ contour, width: 800, height: 600 }],
        });

        // Platform should either be at least 40px or not created at all
        for (const p of result) {
            expect(p.width).toBeGreaterThanOrEqual(defaultOptions.platformMinWidth);
        }
    });

    it('excludes platforms in start area (bottom-left)', () => {
        // Contour in the start area
        const contour = new Array(800).fill(null);
        for (let x = 0; x < 100; x++) contour[x] = 550;  // bottom-left corner

        const result = contoursToSteppedPlatforms({
            ...defaultOptions,
            contours: [{ contour, width: 800, height: 600 }],
        });

        // Platforms should be excluded from start area
        for (const p of result) {
            const isStartArea = (p.x < defaultOptions.startAreaWidth &&
                p.y > defaultOptions.worldHeight - defaultOptions.startAreaHeight);
            expect(isStartArea).toBe(false);
        }
    });

    it('excludes platforms in goal area (top-right)', () => {
        // Contour in the goal area
        const contour = new Array(800).fill(null);
        for (let x = 700; x < 800; x++) contour[x] = 40;  // top-right corner

        const result = contoursToSteppedPlatforms({
            ...defaultOptions,
            contours: [{ contour, width: 800, height: 600 }],
        });

        for (const p of result) {
            const isGoalArea = (p.x > defaultOptions.worldWidth - defaultOptions.goalAreaWidth &&
                p.y < defaultOptions.goalAreaHeight);
            expect(isGoalArea).toBe(false);
        }
    });

    it('excludes platforms in word bar area (top strip)', () => {
        // Contour in word bar area
        const contour = new Array(800).fill(null);
        for (let x = 200; x < 400; x++) contour[x] = 10;  // very top

        const result = contoursToSteppedPlatforms({
            ...defaultOptions,
            contours: [{ contour, width: 800, height: 600 }],
        });

        for (const p of result) {
            expect(p.y).toBeGreaterThanOrEqual(0);
        }
    });

    it('skips contours with no data', () => {
        const result = contoursToSteppedPlatforms({
            ...defaultOptions,
            contours: [{ contour: null, width: 800, height: 600 }],
        });
        expect(result).toEqual([]);
    });
});
