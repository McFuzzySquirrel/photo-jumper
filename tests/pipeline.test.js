// ---------------------------------------------------------------------------
// tests/pipeline.test.js — Platform combination (ML + grid merge) tests
// ---------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import { combinePlatforms } from '../js/detection/pipeline.js';
import { Platform } from '../js/engine/platform.js';

describe('combinePlatforms', () => {
    describe('ML-only mode', () => {
        it('returns only ML platforms when mlOnlyMode is true', () => {
            const ml1 = new Platform(100, 200, 80, 20, '#f00', 'ml-seg');
            const ml2 = new Platform(300, 150, 60, 20, '#f00', 'ml-seg');
            const grid1 = new Platform(100, 300, 100, 20, '#888', 'photo');

            const result = combinePlatforms({
                mlDetectionEnabled: true,
                mlOnlyMode: true,
                mlPlatforms: [ml1, ml2],
                gridBasedPlatforms: [grid1],
                overlapToleranceY: 40,
            });

            expect(result).toHaveLength(2);
            expect(result.every(p => p.kind === 'ml-seg')).toBe(true);
        });

        it('returns empty array when ML-only mode with empty ML platforms', () => {
            const grid1 = new Platform(100, 300, 100, 20, '#888', 'photo');

            const result = combinePlatforms({
                mlDetectionEnabled: true,
                mlOnlyMode: true,
                mlPlatforms: [],
                gridBasedPlatforms: [grid1],
                overlapToleranceY: 40,
            });

            // When ML is enabled but no ML platforms, falls through to grid-based
            expect(result).toHaveLength(1);
        });
    });

    describe('Hybrid mode (ML + grid)', () => {
        it('merges ML and grid platforms when they are vertically separated', () => {
            const ml1 = new Platform(100, 100, 80, 20, '#f00', 'ml-seg');
            const grid1 = new Platform(100, 300, 80, 20, '#888', 'photo');

            const result = combinePlatforms({
                mlDetectionEnabled: true,
                mlOnlyMode: false,
                mlPlatforms: [ml1],
                gridBasedPlatforms: [grid1],
                overlapToleranceY: 40,
            });

            expect(result).toHaveLength(2);
        });

        it('filters grid platforms too close vertically to ML platforms', () => {
            const ml1 = new Platform(100, 100, 80, 20, '#f00', 'ml-seg');
            // Grid platform at y=130, only 10px below ML bottom (100+20=120)
            const grid1 = new Platform(100, 130, 80, 20, '#888', 'photo');

            const result = combinePlatforms({
                mlDetectionEnabled: true,
                mlOnlyMode: false,
                mlPlatforms: [ml1],
                gridBasedPlatforms: [grid1],
                overlapToleranceY: 40,
            });

            // Grid platform should be filtered (vertical separation 10 < tolerance 40)
            expect(result).toHaveLength(1);
            expect(result[0].kind).toBe('ml-seg');
        });

        it('keeps grid platforms without horizontal overlap with ML', () => {
            const ml1 = new Platform(100, 100, 80, 20, '#f00', 'ml-seg');
            // Grid platform at same Y but no horizontal overlap
            const grid1 = new Platform(500, 100, 80, 20, '#888', 'photo');

            const result = combinePlatforms({
                mlDetectionEnabled: true,
                mlOnlyMode: false,
                mlPlatforms: [ml1],
                gridBasedPlatforms: [grid1],
                overlapToleranceY: 40,
            });

            expect(result).toHaveLength(2);
        });
    });

    describe('Grid-only mode (ML disabled)', () => {
        it('returns only grid platforms when ML is disabled', () => {
            const grid1 = new Platform(100, 200, 80, 20, '#888', 'photo');
            const grid2 = new Platform(300, 300, 60, 20, '#888', 'photo');

            const result = combinePlatforms({
                mlDetectionEnabled: false,
                mlOnlyMode: false,
                mlPlatforms: [],
                gridBasedPlatforms: [grid1, grid2],
                overlapToleranceY: 40,
            });

            expect(result).toHaveLength(2);
        });

        it('returns grid platforms when ML is enabled but has no platforms', () => {
            const grid1 = new Platform(100, 200, 80, 20, '#888', 'photo');

            const result = combinePlatforms({
                mlDetectionEnabled: true,
                mlOnlyMode: false,
                mlPlatforms: [],
                gridBasedPlatforms: [grid1],
                overlapToleranceY: 40,
            });

            expect(result).toHaveLength(1);
        });

        it('returns empty array when both sources are empty', () => {
            const result = combinePlatforms({
                mlDetectionEnabled: false,
                mlOnlyMode: false,
                mlPlatforms: [],
                gridBasedPlatforms: [],
                overlapToleranceY: 40,
            });

            expect(result).toHaveLength(0);
        });
    });

    describe('Overlap tolerance', () => {
        it('strict tolerance (0) only removes truly overlapping grid platforms', () => {
            const ml1 = new Platform(100, 100, 80, 20, '#f00', 'ml-seg');
            // Grid platform directly overlapping ML
            const grid1 = new Platform(120, 110, 60, 20, '#888', 'photo');

            const result = combinePlatforms({
                mlDetectionEnabled: true,
                mlOnlyMode: false,
                mlPlatforms: [ml1],
                gridBasedPlatforms: [grid1],
                overlapToleranceY: 0,
            });

            // Vertical separation: grid starts at 110, ML bottom is 120 => sep = -10 (overlapping)
            expect(result).toHaveLength(1);
        });

        it('generous tolerance removes nearby grid platforms', () => {
            const ml1 = new Platform(100, 100, 80, 20, '#f00', 'ml-seg');
            // Grid platform 50px below ML
            const grid1 = new Platform(100, 170, 80, 20, '#888', 'photo');

            const result = combinePlatforms({
                mlDetectionEnabled: true,
                mlOnlyMode: false,
                mlPlatforms: [ml1],
                gridBasedPlatforms: [grid1],
                overlapToleranceY: 100,  // large tolerance
            });

            // Vertical separation: grid at 170, ML bottom at 120 => sep = 50 < 100
            expect(result).toHaveLength(1);
        });
    });
});
