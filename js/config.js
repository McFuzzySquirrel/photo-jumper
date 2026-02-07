export const FEEDBACK_TOKEN_STORAGE_KEY = 'photoJumperFeedbackToken';

// Game configuration constants
export const PLAYER_SIZE = 20;  // Matches BLOCK_SIZE exactly
export const PLAYER_SPEED = 3;  // Reduced from 4 for more precise positioning in tight gaps
export const PLAYER_JUMP_POWER = 14;  // Increased from 12 - allows jumping up one additional block
export const PLAYER_GRAVITY = 0.5;
export const JUMP_CUT_DAMPING = 0.5;  // Multiplier for velocity on early jump release (0-1, lower = shorter hop)

export const GRID_SIZE = 20;  // Reduced from 30 to detect more platforms (1x player size)
export const BRIGHTNESS_THRESHOLD = 50;  // Lowered to only detect very dark objects (not shadows)
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const EDGE_DETECTION_THRESHOLD = 70;  // Increased to reduce sensitivity to shadow edges
export const EDGE_BRIGHTNESS_THRESHOLD = 80;  // Lowered to be very selective about edge-based platforms
export const EDGE_DENSITY_CELL_THRESHOLD = 0.2;  // Minimum edge density per cell for fallback
export const EDGE_DENSITY_ROW_THRESHOLD = 0.22;  // Minimum average density per row for Hough fallback

// Modular block platform system
export const BLOCK_SIZE = 20;  // Individual block size (matches GRID_SIZE and PLAYER_SIZE)
export const PLATFORM_MIN_WIDTH = 40;  // Must fit at least 2 blocks
export const PLATFORM_THICKNESS = BLOCK_SIZE;  // One block tall
export const PLATFORM_MERGE_GAP_PX = 0;
export const MAX_PLATFORM_WIDTH_BLOCKS = 12;  // Max width before inserting jump-through gap (scales with world)
export const PLATFORM_GAP_WIDTH_BLOCKS = 2;   // Gap width in blocks (40px at base — fits 20px player)
export const HELPERS_MAX_COUNT = 50;  // Increased from 30 - more helpers for complex photos
export const MAX_PLATFORM_COUNT = 50;  // Clamp generated platforms for performance

export const DEBUG_DEFAULT_ENABLED = false;

// Player spawn and reserved area constants
export const PLAYER_SPAWN_X = 40;
export const PLAYER_SPAWN_Y_OFFSET = 100; // Pixels above canvas bottom
export const START_AREA_WIDTH = 140;  // Wider to ensure clear start area
export const START_AREA_HEIGHT = 100;  // Taller to ensure clear start area
export const GOAL_AREA_WIDTH = 100;
export const GOAL_AREA_HEIGHT = 80;
export const WORD_BAR_AREA_HEIGHT = 30;  // Reduced from 60 to not overlap with score display

// Stuck detection constants
export const STUCK_CHECK_INTERVAL = 15000;  // 15 seconds - increased from 5 for more patience
export const STUCK_MOVEMENT_THRESHOLD = 5;  // pixels

// Letter collection constants
export const COLLECTIBLE_LETTER_SIZE = 20;
export const COLLECTIBLE_LETTER_POINTS = 10;  // Points per letter
export const COLLECTIBLE_LETTER_FLOAT_SPEED = 0.1;  // Animation speed for floating effect
export const COLLECTIBLE_LETTER_OFFSET_RATIO = 0.4;  // Ratio of platform width for random offset
export const COLLECTIBLE_LETTER_MAX_OFFSET = 30;  // Maximum horizontal offset in pixels
export const COLLECTIBLE_LETTER_VERTICAL_OFFSET = 10;  // Pixels above platform
export const COLLECTIBLE_LETTER_FONT_SIZE_RATIO = 0.8;  // Font size as ratio of letter width
export const WORD_COMPLETE_BONUS = 50;  // Bonus for collecting all letters
export const CORRECT_ORDER_BONUS = 100;  // Extra bonus for correct order
export const WORD_DICTIONARY = ['JUMP', 'PLAY', 'GAME', 'PHOTO', 'STAR', 'GOAL', 'WIN', 'FUN'];
export const MAX_GOAL_CANDIDATES = 3;  // Number of top goal platform candidates to randomly select from

// Player scaling constants
export const BASE_WORLD_WIDTH = 800;  // Reference world width for player scaling
export const BASE_PLAYER_SIZE = 20;   // Reference player size at base world width
export const MIN_PLAYER_SIZE = 16;    // Minimum player size regardless of world size
export const PLAYER_EYE_SIZE_RATIO = 0.2;      // Eye size as ratio of player width
export const PLAYER_EYE_Y_RATIO = 0.25;        // Eye Y position as ratio of player height
export const PLAYER_LEFT_EYE_X_RATIO = 0.2;    // Left eye X position as ratio of player width
export const PLAYER_RIGHT_EYE_X_RATIO = 0.6;   // Right eye X position as ratio of player width
export const PLAYER_PUPIL_SIZE_RATIO = 0.5;    // Pupil size as ratio of eye size

// Camera and viewport constants
export const CAMERA_DEFAULTS = {
    x: 0,
    y: 0,
    zoom: 0.5,
    minZoom: 0.5,
    maxZoom: 2.0,
    smoothing: 0.1,  // Camera follow smoothing (0-1, lower = smoother)
    targetX: 0,
    targetY: 0,
    autoFitZoom: 0.5  // Computed in updateZoomLimits() to fit the world in the viewport
};
