// ---------------------------------------------------------------------------
// tests/config.test.js — Verify key game constants and their relationships
// ---------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import {
    BLOCK_SIZE,
    GRID_SIZE,
    PLATFORM_MIN_WIDTH,
    PLATFORM_THICKNESS,
    MAX_PLATFORM_COUNT,
    MAX_PLATFORM_WIDTH_BLOCKS,
    PLATFORM_GAP_WIDTH_BLOCKS,
    HELPERS_MAX_COUNT,
    PLAYER_SIZE,
    PLAYER_SPEED,
    PLAYER_JUMP_POWER,
    PLAYER_GRAVITY,
    JUMP_CUT_DAMPING,
    BRIGHTNESS_THRESHOLD,
    EDGE_DETECTION_THRESHOLD,
    EDGE_BRIGHTNESS_THRESHOLD,
    EDGE_DENSITY_CELL_THRESHOLD,
    EDGE_DENSITY_ROW_THRESHOLD,
    START_AREA_WIDTH,
    START_AREA_HEIGHT,
    GOAL_AREA_WIDTH,
    GOAL_AREA_HEIGHT,
    WORD_BAR_AREA_HEIGHT,
    PLAYER_SPAWN_X,
    PLAYER_SPAWN_Y_OFFSET,
    BASE_WORLD_WIDTH,
    BASE_PLAYER_SIZE,
    MIN_PLAYER_SIZE,
    COLLECTIBLE_LETTER_SIZE,
    COLLECTIBLE_LETTER_POINTS,
    WORD_DICTIONARY,
    CAMERA_DEFAULTS,
    MAX_FILE_SIZE,
    PLATFORM_MERGE_GAP_PX,
} from '../js/config.js';

describe('config.js — Game constants', () => {
    describe('Grid and Block consistency', () => {
        it('BLOCK_SIZE === GRID_SIZE === 20', () => {
            expect(BLOCK_SIZE).toBe(20);
            expect(GRID_SIZE).toBe(20);
            expect(BLOCK_SIZE).toBe(GRID_SIZE);
        });

        it('PLAYER_SIZE matches BLOCK_SIZE', () => {
            expect(PLAYER_SIZE).toBe(BLOCK_SIZE);
        });
    });

    describe('Platform dimension constraints', () => {
        it('PLATFORM_MIN_WIDTH >= 2 * BLOCK_SIZE', () => {
            expect(PLATFORM_MIN_WIDTH).toBeGreaterThanOrEqual(2 * BLOCK_SIZE);
        });

        it('PLATFORM_THICKNESS equals one BLOCK_SIZE', () => {
            expect(PLATFORM_THICKNESS).toBe(BLOCK_SIZE);
        });

        it('MAX_PLATFORM_COUNT > 0', () => {
            expect(MAX_PLATFORM_COUNT).toBeGreaterThan(0);
        });

        it('MAX_PLATFORM_WIDTH_BLOCKS > 0', () => {
            expect(MAX_PLATFORM_WIDTH_BLOCKS).toBeGreaterThan(0);
        });

        it('PLATFORM_GAP_WIDTH_BLOCKS accommodates player (>= 1 block)', () => {
            expect(PLATFORM_GAP_WIDTH_BLOCKS).toBeGreaterThanOrEqual(1);
        });

        it('HELPERS_MAX_COUNT > 0', () => {
            expect(HELPERS_MAX_COUNT).toBeGreaterThan(0);
        });

        it('PLATFORM_MERGE_GAP_PX is non-negative', () => {
            expect(PLATFORM_MERGE_GAP_PX).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Player physics constants', () => {
        it('PLAYER_SPEED > 0', () => {
            expect(PLAYER_SPEED).toBeGreaterThan(0);
        });

        it('PLAYER_JUMP_POWER > 0', () => {
            expect(PLAYER_JUMP_POWER).toBeGreaterThan(0);
        });

        it('PLAYER_GRAVITY > 0', () => {
            expect(PLAYER_GRAVITY).toBeGreaterThan(0);
        });

        it('JUMP_CUT_DAMPING is between 0 and 1 (exclusive)', () => {
            expect(JUMP_CUT_DAMPING).toBeGreaterThan(0);
            expect(JUMP_CUT_DAMPING).toBeLessThanOrEqual(1);
        });

        it('Jump height exceeds one block (jumpPower^2 / (2*gravity) > BLOCK_SIZE)', () => {
            const maxJumpHeight = (PLAYER_JUMP_POWER * PLAYER_JUMP_POWER) / (2 * PLAYER_GRAVITY);
            expect(maxJumpHeight).toBeGreaterThan(BLOCK_SIZE);
        });
    });

    describe('Detection thresholds', () => {
        it('BRIGHTNESS_THRESHOLD > 0 and < 256', () => {
            expect(BRIGHTNESS_THRESHOLD).toBeGreaterThan(0);
            expect(BRIGHTNESS_THRESHOLD).toBeLessThan(256);
        });

        it('EDGE_DETECTION_THRESHOLD > 0 and < 256', () => {
            expect(EDGE_DETECTION_THRESHOLD).toBeGreaterThan(0);
            expect(EDGE_DETECTION_THRESHOLD).toBeLessThan(256);
        });

        it('EDGE_BRIGHTNESS_THRESHOLD > 0 and < 256', () => {
            expect(EDGE_BRIGHTNESS_THRESHOLD).toBeGreaterThan(0);
            expect(EDGE_BRIGHTNESS_THRESHOLD).toBeLessThan(256);
        });

        it('EDGE_DENSITY_CELL_THRESHOLD between 0 and 1', () => {
            expect(EDGE_DENSITY_CELL_THRESHOLD).toBeGreaterThan(0);
            expect(EDGE_DENSITY_CELL_THRESHOLD).toBeLessThanOrEqual(1);
        });

        it('EDGE_DENSITY_ROW_THRESHOLD between 0 and 1', () => {
            expect(EDGE_DENSITY_ROW_THRESHOLD).toBeGreaterThan(0);
            expect(EDGE_DENSITY_ROW_THRESHOLD).toBeLessThanOrEqual(1);
        });
    });

    describe('Reserved areas', () => {
        it('START_AREA is non-zero size', () => {
            expect(START_AREA_WIDTH).toBeGreaterThan(0);
            expect(START_AREA_HEIGHT).toBeGreaterThan(0);
        });

        it('GOAL_AREA is non-zero size', () => {
            expect(GOAL_AREA_WIDTH).toBeGreaterThan(0);
            expect(GOAL_AREA_HEIGHT).toBeGreaterThan(0);
        });

        it('WORD_BAR_AREA_HEIGHT > 0', () => {
            expect(WORD_BAR_AREA_HEIGHT).toBeGreaterThan(0);
        });

        it('PLAYER_SPAWN_X > 0', () => {
            expect(PLAYER_SPAWN_X).toBeGreaterThan(0);
        });

        it('PLAYER_SPAWN_Y_OFFSET > 0', () => {
            expect(PLAYER_SPAWN_Y_OFFSET).toBeGreaterThan(0);
        });
    });

    describe('Scaling constants', () => {
        it('BASE_WORLD_WIDTH > 0', () => {
            expect(BASE_WORLD_WIDTH).toBeGreaterThan(0);
        });

        it('BASE_PLAYER_SIZE matches PLAYER_SIZE', () => {
            expect(BASE_PLAYER_SIZE).toBe(PLAYER_SIZE);
        });

        it('MIN_PLAYER_SIZE <= BASE_PLAYER_SIZE', () => {
            expect(MIN_PLAYER_SIZE).toBeLessThanOrEqual(BASE_PLAYER_SIZE);
        });
    });

    describe('Letter and word constants', () => {
        it('COLLECTIBLE_LETTER_SIZE > 0', () => {
            expect(COLLECTIBLE_LETTER_SIZE).toBeGreaterThan(0);
        });

        it('COLLECTIBLE_LETTER_POINTS > 0', () => {
            expect(COLLECTIBLE_LETTER_POINTS).toBeGreaterThan(0);
        });

        it('WORD_DICTIONARY contains at least 3 words', () => {
            expect(WORD_DICTIONARY.length).toBeGreaterThanOrEqual(3);
        });

        it('WORD_DICTIONARY entries are uppercase strings', () => {
            for (const word of WORD_DICTIONARY) {
                expect(typeof word).toBe('string');
                expect(word).toBe(word.toUpperCase());
                expect(word.length).toBeGreaterThan(0);
            }
        });
    });

    describe('Camera defaults', () => {
        it('CAMERA_DEFAULTS has required properties', () => {
            expect(CAMERA_DEFAULTS).toHaveProperty('zoom');
            expect(CAMERA_DEFAULTS).toHaveProperty('minZoom');
            expect(CAMERA_DEFAULTS).toHaveProperty('maxZoom');
            expect(CAMERA_DEFAULTS).toHaveProperty('smoothing');
        });

        it('minZoom <= zoom <= maxZoom', () => {
            expect(CAMERA_DEFAULTS.minZoom).toBeLessThanOrEqual(CAMERA_DEFAULTS.zoom);
            expect(CAMERA_DEFAULTS.zoom).toBeLessThanOrEqual(CAMERA_DEFAULTS.maxZoom);
        });

        it('smoothing is between 0 and 1', () => {
            expect(CAMERA_DEFAULTS.smoothing).toBeGreaterThan(0);
            expect(CAMERA_DEFAULTS.smoothing).toBeLessThanOrEqual(1);
        });
    });

    describe('File limits', () => {
        it('MAX_FILE_SIZE is 10MB', () => {
            expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
        });
    });
});
