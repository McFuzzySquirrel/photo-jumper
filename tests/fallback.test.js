// ---------------------------------------------------------------------------
// tests/fallback.test.js — Fallback chain: ML evaluation, Hough, edge-density, skeleton
// ---------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import { evaluateMlPlatforms } from '../js/detection/fallback.js';
import { detectHoughPlatforms } from '../js/detection/hough.js';
import { detectEdgeDensityPlatforms } from '../js/detection/edge-density.js';
import { generateSkeletonPlatforms } from '../js/detection/skeleton.js';
import { Platform } from '../js/engine/platform.js';
import { BLOCK_SIZE } from '../js/config.js';

// Helper: create a mock grid with specified edge density values
function createMockGrid(cellsX, cellsY, edgeDensityValues) {
    const gridSize = BLOCK_SIZE;
    const edgeDensity = [];
    for (let y = 0; y < cellsY; y++) {
        const row = [];
        for (let x = 0; x < cellsX; x++) {
            row.push(edgeDensityValues?.[y]?.[x] ?? 0);
        }
        edgeDensity.push(row);
    }
    return {
        edgeDensity,
        cellsX,
        cellsY,
        gridSize,
        width: cellsX * gridSize,
    };
}

describe('evaluateMlPlatforms', () => {
    it('returns mlSparse=true when ML enabled but platform count < minPlatforms', () => {
        const p1 = new Platform(100, 200, 80, 20, '#f00', 'ml-seg');

        const result = evaluateMlPlatforms({
            mlDetectionEnabled: true,
            mlPlatforms: [p1],
            minPlatforms: 3,
        });

        expect(result.mlSparse).toBe(true);
        expect(result.effectiveMlPlatforms).toHaveLength(0);
    });

    it('returns mlSparse=false when platform count >= minPlatforms', () => {
        const platforms = [
            new Platform(100, 200, 80, 20, '#f00', 'ml-seg'),
            new Platform(200, 300, 80, 20, '#f00', 'ml-seg'),
            new Platform(300, 400, 80, 20, '#f00', 'ml-seg'),
        ];

        const result = evaluateMlPlatforms({
            mlDetectionEnabled: true,
            mlPlatforms: platforms,
            minPlatforms: 3,
        });

        expect(result.mlSparse).toBe(false);
        expect(result.effectiveMlPlatforms).toHaveLength(3);
    });

    it('returns mlSparse=false and empty platforms when ML disabled', () => {
        const result = evaluateMlPlatforms({
            mlDetectionEnabled: false,
            mlPlatforms: [new Platform(100, 200, 80, 20, '#f00')],
            minPlatforms: 1,
        });

        expect(result.mlSparse).toBe(false);
        expect(result.effectiveMlPlatforms).toHaveLength(0);
    });

    it('handles empty mlPlatforms with ML enabled', () => {
        const result = evaluateMlPlatforms({
            mlDetectionEnabled: true,
            mlPlatforms: [],
            minPlatforms: 3,
        });

        expect(result.mlSparse).toBe(true);
        expect(result.effectiveMlPlatforms).toHaveLength(0);
    });

    it('returns the original platforms when viable', () => {
        const p1 = new Platform(100, 200, 80, 20, '#f00', 'ml-seg');
        const result = evaluateMlPlatforms({
            mlDetectionEnabled: true,
            mlPlatforms: [p1],
            minPlatforms: 1,
        });

        expect(result.effectiveMlPlatforms).toContain(p1);
    });
});

describe('detectHoughPlatforms', () => {
    it('returns empty array for null grid', () => {
        expect(detectHoughPlatforms({
            grid: null,
            getScaledBlockSize: () => BLOCK_SIZE,
            platformMinWidth: 40,
            platformClass: Platform,
        })).toEqual([]);
    });

    it('returns empty array for grid with no edge density', () => {
        expect(detectHoughPlatforms({
            grid: { edgeDensity: null },
            getScaledBlockSize: () => BLOCK_SIZE,
            platformMinWidth: 40,
            platformClass: Platform,
        })).toEqual([]);
    });

    it('generates platforms from high edge-density rows', () => {
        // Create a grid where row 5 has high edge density
        const cellsX = 10;
        const cellsY = 10;
        const densityValues = Array.from({ length: cellsY }, () =>
            Array.from({ length: cellsX }, () => 0)
        );
        // Row 5: all cells have high density
        for (let cx = 0; cx < cellsX; cx++) {
            densityValues[5][cx] = 0.5;
        }

        const grid = createMockGrid(cellsX, cellsY, densityValues);

        const result = detectHoughPlatforms({
            grid,
            getScaledBlockSize: () => BLOCK_SIZE,
            platformMinWidth: 40,
            platformClass: Platform,
        });

        expect(result.length).toBeGreaterThan(0);
        for (const p of result) {
            expect(p.kind).toBe('fallback-hough');
            expect(p.y).toBe(5 * BLOCK_SIZE);
        }
    });

    it('skips rows with average density below threshold', () => {
        const cellsX = 10;
        const cellsY = 10;
        const densityValues = Array.from({ length: cellsY }, () =>
            Array.from({ length: cellsX }, () => 0.1)  // all low density
        );

        const grid = createMockGrid(cellsX, cellsY, densityValues);

        const result = detectHoughPlatforms({
            grid,
            getScaledBlockSize: () => BLOCK_SIZE,
            platformMinWidth: 40,
            platformClass: Platform,
        });

        expect(result).toHaveLength(0);
    });

    it('respects minimum platform width for short runs', () => {
        const cellsX = 10;
        const cellsY = 10;
        const densityValues = Array.from({ length: cellsY }, () =>
            Array.from({ length: cellsX }, () => 0)
        );
        // Row 3: only 1 cell is dense — width = 20px < 40px min
        densityValues[3][5] = 0.5;
        // But row avg needs to meet threshold too; boost all cells slightly
        for (let cx = 0; cx < cellsX; cx++) {
            densityValues[3][cx] = Math.max(densityValues[3][cx], 0.25);
        }

        const grid = createMockGrid(cellsX, cellsY, densityValues);

        const result = detectHoughPlatforms({
            grid,
            getScaledBlockSize: () => BLOCK_SIZE,
            platformMinWidth: 40,
            platformClass: Platform,
            cellThreshold: 0.4, // Only cell 5 meets this
        });

        // Single 20px run doesn't meet 40px minimum
        for (const p of result) {
            expect(p.width).toBeGreaterThanOrEqual(40);
        }
    });
});

describe('detectEdgeDensityPlatforms', () => {
    it('returns empty array for null grid', () => {
        expect(detectEdgeDensityPlatforms({
            grid: null,
            getScaledBlockSize: () => BLOCK_SIZE,
            platformMinWidth: 40,
            platformClass: Platform,
        })).toEqual([]);
    });

    it('generates platforms from high-density cells', () => {
        const cellsX = 10;
        const cellsY = 10;
        const densityValues = Array.from({ length: cellsY }, () =>
            Array.from({ length: cellsX }, () => 0)
        );
        // Row 3, cells 2-6 have high density
        for (let cx = 2; cx <= 6; cx++) {
            densityValues[3][cx] = 0.5;
        }

        const grid = createMockGrid(cellsX, cellsY, densityValues);

        const result = detectEdgeDensityPlatforms({
            grid,
            getScaledBlockSize: () => BLOCK_SIZE,
            platformMinWidth: 40,
            platformClass: Platform,
        });

        expect(result.length).toBeGreaterThan(0);
        for (const p of result) {
            expect(p.kind).toBe('fallback-edge-density');
        }
    });

    it('respects cellThreshold parameter', () => {
        const cellsX = 10;
        const cellsY = 10;
        const densityValues = Array.from({ length: cellsY }, () =>
            Array.from({ length: cellsX }, () => 0.15)  // below default 0.2
        );

        const grid = createMockGrid(cellsX, cellsY, densityValues);

        // Default threshold (0.2) should find nothing
        const result = detectEdgeDensityPlatforms({
            grid,
            getScaledBlockSize: () => BLOCK_SIZE,
            platformMinWidth: 40,
            platformClass: Platform,
        });
        expect(result).toHaveLength(0);

        // Lower threshold should find platforms
        const result2 = detectEdgeDensityPlatforms({
            grid,
            getScaledBlockSize: () => BLOCK_SIZE,
            platformMinWidth: 40,
            platformClass: Platform,
            cellThreshold: 0.1,
        });
        expect(result2.length).toBeGreaterThan(0);
    });
});

describe('generateSkeletonPlatforms', () => {
    const defaultOptions = {
        width: 800,
        height: 600,
        getScaledBlockSize: () => BLOCK_SIZE,
        platformClass: Platform,
        startAreaWidth: 140,
        startAreaHeight: 100,
        goalAreaWidth: 100,
        goalAreaHeight: 80,
        wordBarAreaHeight: 30,
        jumpLimits: { maxJumpDx: 120, maxJumpUp: 196 },
    };

    it('generates a non-empty set of traversable platforms', () => {
        const result = generateSkeletonPlatforms(defaultOptions);
        expect(result.length).toBeGreaterThan(0);
    });

    it('all platforms have kind "fallback-skeleton"', () => {
        const result = generateSkeletonPlatforms(defaultOptions);
        for (const p of result) {
            expect(p.kind).toBe('fallback-skeleton');
        }
    });

    it('platforms have valid dimensions', () => {
        const result = generateSkeletonPlatforms(defaultOptions);
        for (const p of result) {
            expect(p.width).toBeGreaterThanOrEqual(BLOCK_SIZE * 2);
            expect(p.width).toBeLessThanOrEqual(BLOCK_SIZE * 3);
            expect(p.height).toBe(BLOCK_SIZE);
        }
    });

    it('platforms stay within world bounds', () => {
        const result = generateSkeletonPlatforms(defaultOptions);
        for (const p of result) {
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.x + p.width).toBeLessThanOrEqual(defaultOptions.width);
            expect(p.y).toBeGreaterThanOrEqual(0);
            expect(p.y + p.height).toBeLessThanOrEqual(defaultOptions.height);
        }
    });

    it('platforms avoid reserved zones', () => {
        const result = generateSkeletonPlatforms(defaultOptions);
        for (const p of result) {
            const isStartArea = (p.x < defaultOptions.startAreaWidth &&
                p.y > defaultOptions.height - defaultOptions.startAreaHeight);
            const isGoalArea = (p.x > defaultOptions.width - defaultOptions.goalAreaWidth &&
                p.y < defaultOptions.goalAreaHeight);
            const isWordBar = (p.y < defaultOptions.wordBarAreaHeight);
            expect(isStartArea).toBe(false);
            expect(isGoalArea).toBe(false);
            expect(isWordBar).toBe(false);
        }
    });

    it('generates platforms for different world sizes', () => {
        const largeWorld = generateSkeletonPlatforms({
            ...defaultOptions,
            width: 1600,
            height: 1200,
        });

        const smallWorld = generateSkeletonPlatforms({
            ...defaultOptions,
            width: 400,
            height: 300,
        });

        // Larger world should have more platforms
        expect(largeWorld.length).toBeGreaterThan(smallWorld.length);
    });
});
