import {
    FEEDBACK_TOKEN_STORAGE_KEY,
    PLAYER_SIZE,
    PLAYER_SPEED,
    PLAYER_JUMP_POWER,
    PLAYER_GRAVITY,
    GRID_SIZE,
    BRIGHTNESS_THRESHOLD,
    MAX_FILE_SIZE,
    EDGE_DETECTION_THRESHOLD,
    EDGE_BRIGHTNESS_THRESHOLD,
    EDGE_DENSITY_CELL_THRESHOLD,
    EDGE_DENSITY_ROW_THRESHOLD,
    BLOCK_SIZE,
    PLATFORM_MIN_WIDTH,
    PLATFORM_THICKNESS,
    PLATFORM_MERGE_GAP_PX,
    MAX_PLATFORM_WIDTH_BLOCKS,
    PLATFORM_GAP_WIDTH_BLOCKS,
    HELPERS_MAX_COUNT,
    MAX_PLATFORM_COUNT,
    DEBUG_DEFAULT_ENABLED,
    PLAYER_SPAWN_X,
    PLAYER_SPAWN_Y_OFFSET,
    START_AREA_WIDTH,
    START_AREA_HEIGHT,
    GOAL_AREA_WIDTH,
    GOAL_AREA_HEIGHT,
    WORD_BAR_AREA_HEIGHT,
    STUCK_CHECK_INTERVAL,
    STUCK_MOVEMENT_THRESHOLD,
    COLLECTIBLE_LETTER_SIZE,
    COLLECTIBLE_LETTER_POINTS,
    COLLECTIBLE_LETTER_OFFSET_RATIO,
    COLLECTIBLE_LETTER_MAX_OFFSET,
    COLLECTIBLE_LETTER_VERTICAL_OFFSET,
    WORD_COMPLETE_BONUS,
    CORRECT_ORDER_BONUS,
    WORD_DICTIONARY,
    MAX_GOAL_CANDIDATES,
    BASE_WORLD_WIDTH,
    CAMERA_DEFAULTS
} from './config.js';
import { runtime } from './runtime.js';
import { Goal } from './engine/goal.js';
import { Platform } from './engine/platform.js';
import { Letter } from './engine/letter.js';
import { Player, applyJumpCut } from './engine/player.js';
import {
    ML_DETECTION_ENABLED_DEFAULT,
    ML_ONLY_MODE_DEFAULT,
    ML_MIN_PLATFORM_COUNT,
    ML_PLATFORM_OVERLAP_TOLERANCE_Y,
    initONNXModel,
    detectObjectsWithONNX,
    detectMasksWithONNX,
    mapObjectsToPlatforms,
    isModelLoaded,
    isModelLoading,
    modelSupportsSegmentation,
    getOnnxLoadError,
    resetOnnxLoadError
} from './detection/ml.js';
import { buildSolidGrid, extractTopSurfacesFromGrid } from './detection/grid.js';
import { combinePlatforms } from './detection/pipeline.js';
import { evaluateMlPlatforms } from './detection/fallback.js';
import { detectHoughPlatforms } from './detection/hough.js';
import { detectEdgeDensityPlatforms } from './detection/edge-density.js';
import { generateSkeletonPlatforms } from './detection/skeleton.js';
import { addHelperPlatformsIfNeeded as addHelperPlatformsIfNeededModule } from './detection/helpers.js';
import { masksToTopContours, contoursToSteppedPlatforms } from './detection/contours.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const previewCanvas = document.getElementById('previewCanvas');
const previewCtx = previewCanvas.getContext('2d');

const introScreen = document.getElementById('introScreen');
const gameScreen = document.getElementById('gameScreen');
const splashScreen = document.getElementById('splashScreen');
const splashPlayBtn = document.getElementById('splashPlayBtn');
const startGameBtn = document.getElementById('startGameBtn');
const exitFullscreenBtn = document.getElementById('exitFullscreenBtn');
const container = document.querySelector('.container');
const gameCanvasContainer = document.querySelector('.game-canvas-container');

const uploadBtn = document.getElementById('uploadBtn');
const cameraBtn = document.getElementById('cameraBtn');
const resetBtn = document.getElementById('resetBtn');
const feedbackBtn = document.getElementById('feedbackBtn');
const fileInput = document.getElementById('fileInput');
const cameraInput = document.getElementById('cameraInput');
const gameInfo = document.getElementById('gameInfo');
const scoreElement = document.getElementById('score');
const timeElement = document.getElementById('time');

// Word bar elements
const wordBar = document.getElementById('wordBar');
const wordLetters = document.getElementById('wordLetters');
const wordProgress = document.getElementById('wordProgress');
const detectionModeBadge = document.getElementById('detectionModeBadge');

const feedbackModal = document.getElementById('feedbackModal');
const feedbackForm = document.getElementById('feedbackForm');
const feedbackDeviceType = document.getElementById('feedbackDeviceType');
const feedbackMessage = document.getElementById('feedbackMessage');
const feedbackCancelBtn = document.getElementById('feedbackCancelBtn');
const feedbackSubmitBtn = document.getElementById('feedbackSubmitBtn');
const feedbackStatus = document.getElementById('feedbackStatus');

const lanHint = document.getElementById('lanHint');
const lanUrl = document.getElementById('lanUrl');
const lanNote = document.getElementById('lanNote');
const copyLinkBtn = document.getElementById('copyLinkBtn');

const debugOverlayToggle = document.getElementById('debugOverlayToggle');

// Mobile control buttons
const mobileControls = document.getElementById('mobileControls');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const jumpBtn = document.getElementById('jumpBtn');

// Zoom control buttons
const zoomControls = document.getElementById('zoomControls');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomResetBtn = document.getElementById('zoomResetBtn');
const respawnBtn = document.getElementById('respawnBtn');
const regenBtn = document.getElementById('regenBtn');

let camera = { ...CAMERA_DEFAULTS };

// Pre-computed shortest word for fallback (safe with non-empty dictionary)
const SHORTEST_WORD = WORD_DICTIONARY.length > 0 
    ? WORD_DICTIONARY.reduce((shortest, word) => word.length < shortest.length ? word : shortest)
    : 'FUN';  // Fallback if dictionary is somehow empty

let gameRunning = false;
let platforms = [];
let shadowPlatforms = [];
let player = null;

// World dimensions (actual photo size in game world coordinates)
let worldWidth = 800;
let worldHeight = 600;
let goal = null;  // Goal object for animation tracking
let goalPlatform = null;  // The platform that acts as the goal
let playerSpawnY = 0;  // Calculated spawn Y position
let keys = {};
let score = 0;
let startTime = 0;
let touchStartX = 0;
let touchStartY = 0;
const touchJumpingRef = { value: false };
let backgroundImage = null; // Store the uploaded photo for background
let gameWon = false;  // Track if player reached the goal

// Letter collection game state
let letters = [];  // Array of Letter objects
let collectedLetters = [];  // Array of collected letters in order
let targetWord = '';  // The word to spell
let wordCompleteBonus = 0;  // Bonus earned for completing word
let correctOrderBonus = 0;  // Bonus earned for correct order

let debugOverlayEnabled = DEBUG_DEFAULT_ENABLED;
let debugSolidGrid = null;
let debugGridSize = GRID_SIZE;
let debugHelperPlatforms = [];
let debugEdgeDensity = null;
let debugSegmentationPlatforms = [];

// ONNX state
let mlDetectionEnabled = ML_DETECTION_ENABLED_DEFAULT;
let mlOnlyMode = ML_ONLY_MODE_DEFAULT;
let debugDetectedObjects = [];

// Calculate scaled block size - all visual elements scale with world dimensions
// This ensures consistent visual scale across different photo sizes
function getScaledBlockSize() {
    return (worldWidth / BASE_WORLD_WIDTH) * BLOCK_SIZE;
}

// Calculate player size - should always match scaled block size for consistent scale with platforms
function getScaledPlayerSize() {
    return getScaledBlockSize();  // Scales with world to match platform block size
}

// Calculate player speed scaled to world dimensions
// Speed must scale proportionally so movement feels consistent across world sizes
function getScaledPlayerSpeed() {
    return (worldWidth / BASE_WORLD_WIDTH) * PLAYER_SPEED;
}

// Calculate player jump power scaled to world dimensions
// Jump power must scale proportionally so jumping feels consistent across world sizes
function getScaledPlayerJumpPower() {
    return (worldWidth / BASE_WORLD_WIDTH) * PLAYER_JUMP_POWER;
}

// Calculate player gravity scaled to world dimensions
// Gravity must scale proportionally to match jump physics
function getScaledPlayerGravity() {
    return (worldWidth / BASE_WORLD_WIDTH) * PLAYER_GRAVITY;
}

// Calculate scaled letter size - scales with world for visibility
function getScaledLetterSize() {
    return (worldWidth / BASE_WORLD_WIDTH) * COLLECTIBLE_LETTER_SIZE;
}

runtime.ctx = ctx;
runtime.getScaledBlockSize = getScaledBlockSize;
runtime.getScaledLetterSize = getScaledLetterSize;
runtime.getGoal = () => goal;
runtime.getPlatforms = () => platforms;
runtime.getWorldWidth = () => worldWidth;
runtime.getWorldHeight = () => worldHeight;
runtime.getKeys = () => keys;
runtime.touchJumpingRef = touchJumpingRef;
runtime.getScore = () => score;
runtime.setScore = (value) => {
    score = value;
    scoreElement.textContent = score;
};
runtime.getStartTime = () => startTime;
runtime.getPlayerSpawnY = () => playerSpawnY;

// ML status indicator
function updateMLStatus(text) {
    const mlStatusEl = document.getElementById('mlStatus');
    if (mlStatusEl) {
        mlStatusEl.textContent = text ? ` (${text})` : '';
    }
}

// Update detection mode badge to show current detection method
function updateDetectionModeBadge() {
    if (!detectionModeBadge) return;

    if (mlDetectionEnabled && isModelLoaded()) {
        if (mlOnlyMode) {
            detectionModeBadge.textContent = '🤖 ML Only';
            detectionModeBadge.classList.add('ml-active');
        } else {
            detectionModeBadge.textContent = '🤖 Grid + ML';
            detectionModeBadge.classList.add('ml-active');
        }
    } else {
        detectionModeBadge.textContent = '📐 Grid Only';
        detectionModeBadge.classList.remove('ml-active');
    }
}

// Helper functions for reachability checking
function intervalGap(a1, a2, b1, b2) {
    if (a2 < b1) return b1 - a2;
    if (b2 < a1) return a1 - b2;
    return 0;
}

function getJumpLimits() {
    const jumpPower = getScaledPlayerJumpPower();
    const gravity = getScaledPlayerGravity();
    const speed = getScaledPlayerSpeed();

    const maxJumpUp = (jumpPower * jumpPower) / (2 * gravity);
    const maxHangTime = (2 * jumpPower) / gravity;
    const maxJumpDx = speed * maxHangTime;

    // Conservative safety margins (gameplay-first): if we say reachable, it should
    // be comfortably reachable — not a frame-perfect jump.
    // 0.85 vertical / 0.80 horizontal ensures helpers get inserted for borderline gaps.
    return {
        maxJumpUp: maxJumpUp * 0.85,  // 15% margin below theoretical max
        maxJumpDx: maxJumpDx * 0.80,  // 20% margin below theoretical max
        jumpPower,
        gravity,
        speed
    };
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
    if (up <= 0) {
        // Dropping down is allowed; keep conservative horizontal requirement only.
        return true;
    }

    if (up > limits.maxJumpUp) return false;

    // More accurate horizontal limit for higher targets: time to reach that height (descending).
    const disc = (limits.jumpPower * limits.jumpPower) - (2 * limits.gravity * up);
    if (disc < 0) return false;
    const tLanding = (limits.jumpPower + Math.sqrt(disc)) / limits.gravity;
    const dxLimit = Math.min(limits.maxJumpDx, limits.speed * tLanding * 0.9);
    if (dx > dxLimit) return false;

    // Ceiling check: when jumping UP, verify no solid platform blocks the
    // vertical path between 'from' and 'to'. A ceiling is any platform whose
    // bottom edge sits between the two Y levels AND horizontally overlaps the
    // jump lane (the narrower of from/to horizontal extents).
    if (allPlatforms && up > 0) {
        // The horizontal lane the player must pass through
        const laneLeft = Math.max(fromLeft, toLeft);
        const laneRight = Math.min(fromRight, toRight);
        // Only check when platforms horizontally overlap (vertical jump)
        if (laneLeft < laneRight) {
            const topY = to.y + to.height;  // bottom edge of destination
            const botY = from.y;              // top edge of source
            for (const p of allPlatforms) {
                if (p === from || p === to || p.kind === 'wall' || p.kind === 'shadow') continue;
                // Platform sits between the two Y levels?
                if (p.y + p.height > topY && p.y < botY) {
                    // Horizontally blocks the lane entirely?
                    if (p.x <= laneLeft && p.x + p.width >= laneRight) {
                        return false;  // Ceiling blocks upward jump
                    }
                }
            }
        }
    }

    return true;
}

/**
 * Check if a platform has an unbroken ceiling directly above it within
 * jump height. Used by letter placement to avoid putting collectibles
 * in spots the player can't reach even though BFS says the platform
 * itself is reachable.
 */
function hasCeilingAbove(platform, allPlatforms, jumpHeight) {
    const aboveY = platform.y - jumpHeight;
    for (const p of allPlatforms) {
        if (p === platform || p.kind === 'wall' || p.kind === 'shadow') continue;
        // Platform is above and within jump height?
        if (p.y + p.height > aboveY && p.y + p.height <= platform.y) {
            // Completely covers this platform horizontally?
            if (p.x <= platform.x && p.x + p.width >= platform.x + platform.width) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Split platforms that exceed MAX_PLATFORM_WIDTH_BLOCKS into smaller
 * segments with player-width gaps so the player can always jump through.
 * Max width scales proportionally with world size via getScaledBlockSize().
 * Skips ground, start, and goal platforms.
 */
function splitLongPlatforms(platformList, blockSizeOverride) {
    const blockSize = blockSizeOverride ?? getScaledBlockSize();
    const maxWidth = MAX_PLATFORM_WIDTH_BLOCKS * blockSize;
    const gapWidth = PLATFORM_GAP_WIDTH_BLOCKS * blockSize;
    const minSegWidth = PLATFORM_MIN_WIDTH;  // Minimum 2-block segment
    const result = [];

    for (const p of platformList) {
        // Never split special platforms
        if (p.kind === 'ground' || p.kind === 'start' || p.kind === 'goal') {
            result.push(p);
            continue;
        }

        if (p.width <= maxWidth) {
            result.push(p);
            continue;
        }

        // Calculate how many segments we need
        // Each segment is at most maxWidth, separated by gapWidth
        const totalContentWidth = p.width;
        // Number of gaps needed: enough so each segment <= maxWidth
        const numGaps = Math.floor(totalContentWidth / maxWidth);
        const numSegments = numGaps + 1;
        // Distribute width evenly across segments
        const totalGapWidth = numGaps * gapWidth;
        const segmentWidth = Math.floor((totalContentWidth - totalGapWidth) / numSegments);

        if (segmentWidth < minSegWidth) {
            // Platform too narrow to split meaningfully — keep as-is
            result.push(p);
            continue;
        }

        // Build segments with gaps
        let x = p.x;
        for (let i = 0; i < numSegments; i++) {
            // Last segment gets remaining width to avoid rounding drift
            const isLast = (i === numSegments - 1);
            const w = isLast
                ? Math.max(minSegWidth, (p.x + p.width) - x)  // remainder
                : segmentWidth;
            // Align to block grid
            const alignedW = Math.floor(w / blockSize) * blockSize;
            const finalW = Math.max(minSegWidth, alignedW);

            result.push(new Platform(x, p.y, finalW, p.height, p.color, p.kind));
            x += finalW + gapWidth;

            // Safety: don't exceed original platform bounds
            if (x >= p.x + p.width) break;
        }

        console.log(`Split ${Math.round(p.width)}px platform into ${numSegments} segments at y=${Math.round(p.y)}`);
    }

    return result;
}

function isReachable(startPlatform, goalPlatform, allPlatforms, limits) {
    // Filter out wall/shadow blocks — visual only, not traversal nodes
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

// Process image and create platforms
async function processImage(image) {
    console.log('processImage called with image:', image.width, 'x', image.height);
    
    // Update detection mode badge to show current mode
    updateDetectionModeBadge();
    
    // Store the image for background rendering
    backgroundImage = image;

    // Store the original image dimensions as the world size
    // This allows the photo to be rendered at full resolution in game world
    worldWidth = image.width;
    worldHeight = image.height;

    // For platform detection, we'll use the actual image size
    // (We'll limit processing size for performance, but world coords use full size)
    const maxProcessWidth = 1600;  // Increased from 800 to preserve more detail
    const maxProcessHeight = 1200; // Increased from 600 to preserve more detail
    let processWidth = image.width;
    let processHeight = image.height;

    // Scale down only if image is very large (for performance)
    if (processWidth > maxProcessWidth) {
        processHeight = (processHeight * maxProcessWidth) / processWidth;
        processWidth = maxProcessWidth;
    }
    if (processHeight > maxProcessHeight) {
        processWidth = (processWidth * maxProcessHeight) / processHeight;
        processHeight = maxProcessHeight;
    }

    // Set preview canvas to processing size for platform detection
    previewCanvas.width = processWidth;
    previewCanvas.height = processHeight;

    // Draw image to preview canvas for platform detection
    previewCtx.drawImage(image, 0, 0, processWidth, processHeight);
    const imageData = previewCtx.getImageData(0, 0, processWidth, processHeight);
    const data = imageData.data;
    
    // For convenience in nested functions, create width/height aliases
    const width = processWidth;
    const height = processHeight;
    const processBlockSize = (processWidth / BASE_WORLD_WIDTH) * BLOCK_SIZE;

    // Create platforms based on brightness and edge detection
    platforms = [];
    const gridSize = GRID_SIZE;
    const brightnessThreshold = BRIGHTNESS_THRESHOLD;

    debugGridSize = gridSize;
    debugHelperPlatforms = [];
    debugSolidGrid = null;
    debugDetectedObjects = [];
    debugEdgeDensity = null;
    debugSegmentationPlatforms = [];
    shadowPlatforms = [];

    

    // Wall blocks (post-BFS): place solid edge assists on
    // platform edges that don't face a reachable neighbor.
    function addWallBlocks(allPlatforms, limits) {
        const blockSize = processBlockSize;
        // Only consider non-wall traversable platforms for wall placement
        const mainPlatforms = allPlatforms.filter(p => p.kind !== 'wall');
        const newWalls = [];

        for (const platform of mainPlatforms) {
            // Only add walls on platforms wide enough (>= 3 blocks)
            if (platform.width < blockSize * 3) continue;

            // Check if any reachable neighbor approaches from the left or right
            let hasLeftNeighbor = false;
            let hasRightNeighbor = false;

            for (const other of mainPlatforms) {
                if (other === platform) continue;
                // Check both directions: can we reach other FROM platform, or reach platform FROM other
                const reachable = canReachPlatform(platform, other, limits, mainPlatforms) || canReachPlatform(other, platform, limits, mainPlatforms);
                if (!reachable) continue;

                // Determine which side the neighbor is on relative to this platform
                const otherCenterX = other.x + other.width / 2;
                const platformCenterX = platform.x + platform.width / 2;

                if (otherCenterX < platformCenterX) {
                    hasLeftNeighbor = true;
                }
                if (otherCenterX > platformCenterX) {
                    hasRightNeighbor = true;
                }

                // Early exit if both sides have neighbors
                if (hasLeftNeighbor && hasRightNeighbor) break;
            }

            // Place wall block on left edge only if no neighbor approaches from the left
            if (!hasLeftNeighbor && platform.x >= blockSize) {
                newWalls.push(new Platform(
                    platform.x,
                    platform.y - blockSize,
                    blockSize,
                    blockSize,
                    'rgba(0, 0, 0, 0.7)',
                    'wall'
                ));
            }

            // Place wall block on right edge only if no neighbor approaches from the right
            if (!hasRightNeighbor && platform.x + platform.width + blockSize <= processWidth) {
                newWalls.push(new Platform(
                    platform.x + platform.width - blockSize,
                    platform.y - blockSize,
                    blockSize,
                    blockSize,
                    'rgba(0, 0, 0, 0.7)',
                    'wall'
                ));
            }
        }

        // Add all wall blocks to the platform array (collidable)
        for (const wall of newWalls) {
            allPlatforms.push(wall);
        }
    }

    function addHelperPlatformsIfNeeded(startPlatform, goalPlatform, allPlatforms, limits) {
        addHelperPlatformsIfNeededModule({
            startPlatform,
            goalPlatform,
            allPlatforms,
            limits,
            maxHelpers: HELPERS_MAX_COUNT,
            blockSize: processBlockSize,
            width,
            height,
            wordBarAreaHeight: WORD_BAR_AREA_HEIGHT,
            platformClass: Platform,
            overlapsAny,
            isReachable,
            canReachPlatform,
            debugHelperPlatforms,
            mlOnlyMode
        });

        if (!isReachable(startPlatform, goalPlatform, allPlatforms, limits)) {
            console.warn('⚠️ Warning: Goal may not be reachable even after adding helpers. Try regenerating (G key).');
        }
    }

    // Build grid-based platforms (always run as baseline/fallback)
    const grid = buildSolidGrid({
        width,
        height,
        data,
        gridSize,
        brightnessThreshold,
        edgeDetectionThreshold: EDGE_DETECTION_THRESHOLD,
        edgeBrightnessThreshold: EDGE_BRIGHTNESS_THRESHOLD,
        startAreaWidth: START_AREA_WIDTH,
        startAreaHeight: START_AREA_HEIGHT,
        goalAreaWidth: GOAL_AREA_WIDTH,
        goalAreaHeight: GOAL_AREA_HEIGHT,
        wordBarAreaHeight: WORD_BAR_AREA_HEIGHT
    });
    debugSolidGrid = grid.solid;
    debugEdgeDensity = grid.edgeDensity;
    let gridBasedPlatforms = extractTopSurfacesFromGrid(grid, {
        getScaledBlockSize: () => processBlockSize,
        platformMinWidth: PLATFORM_MIN_WIDTH,
        platformMergeGapPx: PLATFORM_MERGE_GAP_PX,
        platformThickness: PLATFORM_THICKNESS,
        playerSize: processBlockSize,
        platformClass: Platform
    });

    if (gridBasedPlatforms.length > MAX_PLATFORM_COUNT) {
        gridBasedPlatforms = [...gridBasedPlatforms]
            .sort((a, b) => (b.width - a.width) || (a.y - b.y))
            .slice(0, MAX_PLATFORM_COUNT);
        console.log(`Clamped grid platforms to ${MAX_PLATFORM_COUNT} for performance.`);
    }

    // Try ML-based object detection if enabled
    let mlPlatforms = [];
    let usedSegmentationPlatforms = false;
    if (mlDetectionEnabled && isModelLoaded()) {
        console.log('🤖 Running ML object detection...');
        try {
            updateMLStatus('Detecting objects...');
            let onnxOutputs = null;
            const detections = await detectObjectsWithONNX({
                width,
                height,
                previewCanvas,
                onOutputs: (outputs) => {
                    onnxOutputs = outputs;
                }
            });
            debugDetectedObjects = detections;

            if (modelSupportsSegmentation()) {
                const masks = await detectMasksWithONNX({ outputs: onnxOutputs, width, height });
                const contours = masksToTopContours({ masks, width, height });
                const contourPlatforms = contoursToSteppedPlatforms({
                    contours,
                    blockSize: processBlockSize,
                    platformMinWidth: PLATFORM_MIN_WIDTH,
                    platformClass: Platform,
                    color: 'rgba(60, 150, 80, 0.85)',
                    worldWidth: width,
                    worldHeight: height,
                    startAreaWidth: START_AREA_WIDTH,
                    startAreaHeight: START_AREA_HEIGHT,
                    goalAreaWidth: GOAL_AREA_WIDTH,
                    goalAreaHeight: GOAL_AREA_HEIGHT,
                    wordBarAreaHeight: WORD_BAR_AREA_HEIGHT,
                    mergeGapPx: PLATFORM_MERGE_GAP_PX
                });
                if (contourPlatforms.length > 0) {
                    mlPlatforms = contourPlatforms;
                    debugSegmentationPlatforms = contourPlatforms;
                    if (mlPlatforms.length > MAX_PLATFORM_COUNT) {
                        mlPlatforms = [...mlPlatforms]
                            .sort((a, b) => (b.width - a.width) || (a.y - b.y))
                            .slice(0, MAX_PLATFORM_COUNT);
                        console.log(`Clamped segmentation platforms to ${MAX_PLATFORM_COUNT} for performance.`);
                    }
                    usedSegmentationPlatforms = true;
                }
            }
            
            console.log(`ML detection found ${detections.length} total objects`);
            
            // Log all detections for debugging
            if (detections.length > 0) {
                console.log('Detected objects:', detections.map(d => 
                    `${d.class} (${(d.confidence * 100).toFixed(1)}%) ${d.isPlatformable ? '✓ platformable' : '✗ not platformable'}`
                ).join(', '));
            }
            
            
            // Convert ALL detected objects to platforms for smooth gameplay
            // This ensures maximum platform coverage and better level traversability
            if (mlPlatforms.length === 0 && detections.length > 0) {
                mlPlatforms = mapObjectsToPlatforms(detections, {
                    canvasWidth: width,
                    canvasHeight: height,
                    getScaledBlockSize: () => processBlockSize,
                    platformMinWidth: PLATFORM_MIN_WIDTH,
                    startAreaWidth: START_AREA_WIDTH,
                    startAreaHeight: START_AREA_HEIGHT,
                    goalAreaWidth: GOAL_AREA_WIDTH,
                    goalAreaHeight: GOAL_AREA_HEIGHT,
                    wordBarAreaHeight: WORD_BAR_AREA_HEIGHT,
                    platformThickness: PLATFORM_THICKNESS,
                    platformMergeGapPx: PLATFORM_MERGE_GAP_PX
                });
                
                // Convert ML platform candidates to Platform objects
                mlPlatforms = mlPlatforms.map(p => 
                    new Platform(p.x, p.y, p.width, p.height, p.color, 'ml')
                );

                if (mlPlatforms.length > MAX_PLATFORM_COUNT) {
                    mlPlatforms = [...mlPlatforms]
                        .sort((a, b) => (b.width - a.width) || (a.y - b.y))
                        .slice(0, MAX_PLATFORM_COUNT);
                    console.log(`Clamped ML platforms to ${MAX_PLATFORM_COUNT} for performance.`);
                }
                
            }

            if (usedSegmentationPlatforms) {
                updateMLStatus(`Segmentation → ${mlPlatforms.length} platforms`);
            } else if (detections.length > 0) {
                const platformableCount = detections.filter(d => d.isPlatformable).length;
                updateMLStatus(`${detections.length} objects → platforms (${platformableCount} platformable)`);
            } else {
                console.log('ℹ️ No objects detected. Try photos with furniture, vehicles, or electronics.');
                console.log('   Platformable objects: chairs, tables, couches, cars, laptops, etc.');
                console.log('   Note: Buildings/architecture are not detected - use grid-based detection for those.');
                updateMLStatus('No objects detected');
            }
        } catch (err) {
            console.warn('ML detection failed during inference:', err);
            updateMLStatus('Detection failed');
        }
    }

    const { mlSparse, effectiveMlPlatforms } = evaluateMlPlatforms({
        mlDetectionEnabled,
        mlPlatforms,
        minPlatforms: ML_MIN_PLATFORM_COUNT
    });

    let fallbackPlatforms = [];
    if (mlSparse) {
        console.log(`ML sparse (${mlPlatforms.length} < ${ML_MIN_PLATFORM_COUNT}) - invoking fallback chain.`);

        fallbackPlatforms = detectHoughPlatforms({
            grid,
            getScaledBlockSize: () => processBlockSize,
            platformMinWidth: PLATFORM_MIN_WIDTH,
            platformClass: Platform,
            rowThreshold: EDGE_DENSITY_ROW_THRESHOLD,
            cellThreshold: EDGE_DENSITY_CELL_THRESHOLD
        });

        if (fallbackPlatforms.length === 0) {
            fallbackPlatforms = detectEdgeDensityPlatforms({
                grid,
                getScaledBlockSize: () => processBlockSize,
                platformMinWidth: PLATFORM_MIN_WIDTH,
                platformClass: Platform,
                cellThreshold: EDGE_DENSITY_CELL_THRESHOLD
            });
        }

        if (fallbackPlatforms.length === 0) {
            fallbackPlatforms = generateSkeletonPlatforms({
                width,
                height,
                getScaledBlockSize: () => processBlockSize,
                platformClass: Platform,
                startAreaWidth: START_AREA_WIDTH,
                startAreaHeight: START_AREA_HEIGHT,
                goalAreaWidth: GOAL_AREA_WIDTH,
                goalAreaHeight: GOAL_AREA_HEIGHT,
                wordBarAreaHeight: WORD_BAR_AREA_HEIGHT,
                jumpLimits: getJumpLimits()
            });
        }

        if (fallbackPlatforms.length > 0) {
            console.log(`Fallback chain produced ${fallbackPlatforms.length} platforms.`);
            gridBasedPlatforms = [...gridBasedPlatforms, ...fallbackPlatforms];
        } else {
            console.log('Fallback chain produced no platforms.');
        }
    }

    platforms = combinePlatforms({
        mlDetectionEnabled,
        mlOnlyMode,
        mlPlatforms: effectiveMlPlatforms,
        gridBasedPlatforms,
        overlapToleranceY: ML_PLATFORM_OVERLAP_TOLERANCE_Y
    });

    // Split overly wide platforms so the player can always jump through gaps.
    // Max width scales with world size (MAX_PLATFORM_WIDTH_BLOCKS * blockSize).
    platforms = splitLongPlatforms(platforms, processBlockSize);

    // Add a ground platform at the bottom (darker and more opaque)
    platforms.push(new Platform(0, height - processBlockSize, width, processBlockSize, 'rgba(100, 60, 20, 0.8)', 'ground'));

    // Add starting platform (green to indicate start, scaled with world)
    const blockSize = processBlockSize;
    const startPlatformY = height - (blockSize * 3);
    const startPlatform = new Platform(10, startPlatformY, blockSize * 5, blockSize, 'rgba(0, 180, 0, 0.9)', 'start');
    platforms.push(startPlatform);

    // Randomly select a goal location from suitable platforms
    // Goal should be: reachable, sufficiently far from start, preferably high up
    let goalSupportPlatform = null;
    let goalX, goalY;
    
    // Get candidate platforms for goal placement (photo/ml platforms in upper half)
    const candidateGoalPlatforms = platforms.filter(p => {
        if (p.kind !== 'photo' && p.kind !== 'ml') return false;
        // Prefer upper 60% of the level
        if (p.y > height * 0.6) return false;
        // Must not overlap with start area
        if (p.x < 150 && p.y > height - 150) return false;
        return true;
    });
    
    // If we have suitable candidates, pick one randomly
    if (candidateGoalPlatforms.length > 0) {
        // Sort by height (higher is better) and distance from start
        const startCenter = { x: 60, y: startPlatformY };
        candidateGoalPlatforms.sort((a, b) => {
            // Calculate distance once for each platform
            const aDistSq = (a.x - startCenter.x) ** 2 + (a.y - startCenter.y) ** 2;
            const bDistSq = (b.x - startCenter.x) ** 2 + (b.y - startCenter.y) ** 2;
            // Prefer high (negative y) + far (positive distance)
            const aScore = -a.y * 2 + Math.sqrt(aDistSq);
            const bScore = -b.y * 2 + Math.sqrt(bDistSq);
            return bScore - aScore;
        });
        
        // Pick from top candidates randomly for variety
        const topCandidates = candidateGoalPlatforms.slice(0, Math.min(MAX_GOAL_CANDIDATES, candidateGoalPlatforms.length));
        const selectedPlatform = topCandidates[Math.floor(Math.random() * topCandidates.length)];
        
        // Create goal support platform (use scaled block size)
        // Ensure platform is low enough that portal above it will be visible
        const minPlatformY = WORD_BAR_AREA_HEIGHT + (blockSize * 2) + 10;  // Room for portal above
        const platformY = Math.max(minPlatformY, selectedPlatform.y - blockSize);
        
        goalPlatform = new Platform(
            selectedPlatform.x + selectedPlatform.width / 2 - (blockSize * 1.5),
            platformY,
            blockSize * 3, 
            blockSize, 
            'rgba(255, 200, 0, 0.9)', 
            'goal'
        );
    } else {
        // Fallback to safe position if no suitable platforms found
        const goalX = width - (blockSize * 4);  // Ensure it's not too close to edge
        const goalY = WORD_BAR_AREA_HEIGHT + (blockSize * 2) + 20;  // Low enough for portal to be above
        goalPlatform = new Platform(goalX, goalY, blockSize * 3, blockSize, 'rgba(255, 200, 0, 0.9)', 'goal');
    }
    
    platforms.push(goalPlatform);
    
    // Create portal on top of goal platform (use scaled block size)
    const portalX = goalPlatform.x + (goalPlatform.width / 2) - (blockSize / 2);  // Center on platform
    const portalY = goalPlatform.y - (blockSize * 2);  // Portal sits on top of platform
    
    goal = new Goal(portalX, portalY);
    
    console.log('Goal platform created:', {
        x: goalPlatform.x,
        y: goalPlatform.y,
        width: goalPlatform.width,
        height: goalPlatform.height,
        kind: goalPlatform.kind
    });
    console.log('Goal portal created:', {
        x: goal.x,
        y: goal.y,
        width: goal.width,
        height: goal.height
    });

    // Initialize player ON the start platform (not above it)
    playerSpawnY = startPlatformY - 20; // Player height is 20, so spawn on top of platform
    player = new Player(
        PLAYER_SPAWN_X,
        playerSpawnY,
        getScaledPlayerSize,
        getScaledPlayerSpeed,
        getScaledPlayerJumpPower,
        getScaledPlayerGravity
    );
    
    // Remove any photo-generated platforms that overlap with player spawn area
    // to ensure player never spawns inside a block
    const spawnCheckX = PLAYER_SPAWN_X - 10;
    const spawnCheckY = playerSpawnY - 10;
    const spawnCheckWidth = 40;  // Player width + buffer
    const spawnCheckHeight = 40; // Player height + buffer
    
    platforms = platforms.filter(platform => {
        // Keep non-photo/non-ml platforms (ground/start/goal/helper)
        if (platform.kind !== 'photo' && platform.kind !== 'ml') return true;

        // Remove photo/ml platforms that overlap with spawn area
        const overlaps = !(platform.x + platform.width < spawnCheckX ||
            platform.x > spawnCheckX + spawnCheckWidth ||
            platform.y + platform.height < spawnCheckY ||
            platform.y > spawnCheckY + spawnCheckHeight);
        return !overlaps;
    });

    // Ensure the level is winnable: add helper platforms only when needed.
    const limits = getJumpLimits();
    addHelperPlatformsIfNeeded(startPlatform, goalPlatform, platforms, limits);

    // If goal is still unreachable, try re-selecting from lower candidates
    if (!isReachable(startPlatform, goalPlatform, platforms, limits)) {
        console.warn('Goal unreachable after helpers — trying lower candidates...');
        // Find all reachable platforms from start, pick the highest one as new goal
        const reachablePlatforms = platforms.filter(p =>
            p.kind !== 'wall' && p.kind !== 'shadow' && p.kind !== 'goal' && p !== startPlatform &&
            isReachable(startPlatform, p, platforms, limits)
        );
        if (reachablePlatforms.length > 0) {
            // Sort by Y ascending (highest first) and pick from top 3
            reachablePlatforms.sort((a, b) => a.y - b.y);
            const fallbackCandidates = reachablePlatforms.slice(0, Math.min(3, reachablePlatforms.length));
            const fallback = fallbackCandidates[Math.floor(Math.random() * fallbackCandidates.length)];
            
            // Remove old goal platform and portal
            platforms = platforms.filter(p => p !== goalPlatform);
            
            // Create new goal at the reachable platform
            const newBlockSize = processBlockSize;
            const newMinY = WORD_BAR_AREA_HEIGHT + (newBlockSize * 2) + 10;
            const newGoalY = Math.max(newMinY, fallback.y - newBlockSize);
            goalPlatform = new Platform(
                fallback.x + fallback.width / 2 - (newBlockSize * 1.5),
                newGoalY,
                newBlockSize * 3,
                newBlockSize,
                'rgba(255, 200, 0, 0.9)',
                'goal'
            );
            platforms.push(goalPlatform);
            
            // Recreate portal on new goal
            const newPortalX = goalPlatform.x + (goalPlatform.width / 2) - (newBlockSize / 2);
            const newPortalY = goalPlatform.y - (newBlockSize * 2);
            goal = new Goal(newPortalX, newPortalY);
            
            console.log('Goal relocated to reachable platform at y=' + fallback.y);
        }
    }

    // Add wall blocks on platform edges that don't face a reachable neighbor.
    // Walls are solid climbing assists (ADR 0009) placed only where they won't
    // block jump paths — edges facing a reachable neighbor stay clear.
    addWallBlocks(platforms, limits);

    // Alternative-path pass: sprinkle minimal single-block stepping stones
    // to connect isolated platform clusters. This gives the player more
    // routes through the level without flooding it with helpers.
    (function addAlternativePathHelpers() {
        const blockSize = processBlockSize;
        const helperColor = 'rgba(80, 120, 255, 0.7)';
        const traversable = platforms.filter(p => p.kind !== 'wall' && p.kind !== 'shadow');
        
        // Find all platforms reachable from start
        const reachableSet = new Set();
        const queue = [startPlatform];
        reachableSet.add(startPlatform);
        while (queue.length) {
            const cur = queue.shift();
            for (const next of traversable) {
                if (reachableSet.has(next)) continue;
                if (!canReachPlatform(cur, next, limits, traversable)) continue;
                reachableSet.add(next);
                queue.push(next);
            }
        }
        
        // Collect unreachable photo/ML platforms worth connecting
        const unreachable = traversable.filter(p =>
            !reachableSet.has(p) &&
            (p.kind === 'photo' || p.kind === 'ml') &&
            p.width >= blockSize * 2
        );
        
        if (unreachable.length === 0) return;
        
        let added = 0;
        const maxAltHelpers = 8; // Keep it minimal
        
        for (const target of unreachable) {
            if (added >= maxAltHelpers) break;
            
            // Find the closest reachable platform to this unreachable one
            let bestFrom = null;
            let bestDist = Infinity;
            for (const rp of reachableSet) {
                const dx = (rp.x + rp.width / 2) - (target.x + target.width / 2);
                const dy = rp.y - target.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestFrom = rp;
                }
            }
            if (!bestFrom) continue;
            
            // Only bridge gaps that are within ~2 jump distances
            if (bestDist > limits.maxJumpDx * 2.5) continue;
            
            // Try placing a single stepping-stone block midway
            const midX = (bestFrom.x + bestFrom.width / 2 + target.x + target.width / 2) / 2 - blockSize / 2;
            const midY = Math.min(bestFrom.y, target.y) - limits.maxJumpUp * 0.3;
            const clampedY = Math.max(WORD_BAR_AREA_HEIGHT, Math.min(midY, height - blockSize * 2));
            const clampedX = Math.max(0, Math.min(midX, width - blockSize));
            
            const stone = new Platform(clampedX, clampedY, blockSize, blockSize, helperColor, 'helper');
            
            if (!overlapsAny(stone, platforms)) {
                // Verify the stone actually helps: reachable from existing set AND can reach target
                const canGetToStone = [...reachableSet].some(rp => canReachPlatform(rp, stone, limits, platforms));
                const canGetFromStone = canReachPlatform(stone, target, limits, platforms);
                
                if (canGetToStone && canGetFromStone) {
                    platforms.push(stone);
                    debugHelperPlatforms.push(stone);
                    reachableSet.add(stone);
                    reachableSet.add(target);
                    added++;
                    console.log(`Alt-path stone at (${Math.round(clampedX)}, ${Math.round(clampedY)}) connects to platform at y=${Math.round(target.y)}`);
                    continue;
                }
            }
            
            // Fallback: try a 2-block wide stone at a few Y offsets
            const offsets = [0, -blockSize, blockSize, -blockSize * 2];
            let placed = false;
            for (const yOff of offsets) {
                const altY = Math.max(WORD_BAR_AREA_HEIGHT, Math.min(clampedY + yOff, height - blockSize * 2));
                const altStone = new Platform(clampedX, altY, blockSize * 2, blockSize, helperColor, 'helper');
                
                if (!overlapsAny(altStone, platforms)) {
                    const canGet = [...reachableSet].some(rp => canReachPlatform(rp, altStone, limits, platforms));
                    const canLeave = canReachPlatform(altStone, target, limits, platforms);
                    
                    if (canGet && canLeave) {
                        platforms.push(altStone);
                        debugHelperPlatforms.push(altStone);
                        reachableSet.add(altStone);
                        reachableSet.add(target);
                        added++;
                        placed = true;
                        console.log(`Alt-path 2-block stone at (${Math.round(clampedX)}, ${Math.round(altY)}) connects to platform at y=${Math.round(target.y)}`);
                        break;
                    }
                }
            }
        }
        
        if (added > 0) {
            console.log(`Added ${added} alternative-path stepping stones`);
        }
    })();

    // Scale all platforms from process coordinates to world coordinates
    const scaleX = worldWidth / processWidth;
    const scaleY = worldHeight / processHeight;
    
    for (let platform of platforms) {
        platform.x *= scaleX;
        platform.y *= scaleY;
        platform.width *= scaleX;
        platform.height *= scaleY;
    }
    
    // Scale goal position
    if (goal) {
        goal.x *= scaleX;
        goal.y *= scaleY;
        goal.width *= scaleX;
        goal.height *= scaleY;
    }

    // Normalize platform thickness to exactly one block in world space
    const worldBlockSize = getScaledBlockSize();
    for (const platform of platforms) {
        platform.height = worldBlockSize;
        if (platform.kind === 'ground') {
            platform.y = worldHeight - worldBlockSize;
        }
    }

    // Place collectible letters on platforms (pass limits and startPlatform for reachability check)
    placeLettersOnPlatforms(startPlatform, limits);

    // Second helper pass: ensure every letter platform is comfortably reachable.
    // The first pass only ensured start→goal; letters may be on side branches
    // that are borderline or unreachable with the tighter safety margins.
    for (const letter of letters) {
        // Find the platform this letter sits on
        const letterPlatform = platforms.find(p =>
            p.kind !== 'wall' && p.kind !== 'shadow' && p.kind !== 'ground' &&
            letter.x + letter.width > p.x &&
            letter.x < p.x + p.width &&
            Math.abs((letter.y + letter.height) - p.y) < getScaledBlockSize() * 2
        );
        if (letterPlatform && !isReachable(startPlatform, letterPlatform, platforms, limits)) {
            console.log(`Adding helpers for letter '${letter.letter}' platform at y=${Math.round(letterPlatform.y)}`);
            addHelperPlatformsIfNeeded(startPlatform, letterPlatform, platforms, limits);
        }
    }

    // Start game
    startGame();
}

// Fisher-Yates shuffle algorithm for unbiased array shuffling
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Place letters on platforms to spell a word
function placeLettersOnPlatforms(startPlatform, limits) {
    letters = [];
    collectedLetters = [];
    
    // Get platforms that are suitable for letter placement AND reachable from start
    // Exclude ground, start, goal platforms and those with ceilings blocking letter access
    const jumpHeight = limits.maxJumpUp;
    const suitablePlatforms = platforms.filter(p => {
        // Must be a photo/ml/helper platform (NOT goal)
        if (p.kind !== 'photo' && p.kind !== 'ml' && p.kind !== 'helper') {
            return false;
        }
        
        // Don't place letters on goal platform
        if (p === goalPlatform) {
            return false;
        }
        
        // Must be reachable from the start platform (including multi-hop paths)
        if (!isReachable(startPlatform, p, platforms, limits)) {
            return false;
        }
        
        // Skip platforms with an unbroken ceiling directly above —
        // letters placed here would be visually accessible but physically
        // unreachable because the player bonks the ceiling.
        if (hasCeilingAbove(p, platforms, jumpHeight)) {
            return false;
        }
        
        return true;
    });
    
    if (suitablePlatforms.length === 0) {
        console.warn('No suitable reachable platforms for letter placement');
        return;
    }
    
    // Choose a word that fits the available platforms
    // Filter words that have length <= number of suitable platforms
    const availableWords = WORD_DICTIONARY.filter(word => word.length <= suitablePlatforms.length);
    
    if (availableWords.length === 0) {
        // If no words fit (not enough reachable platforms), truncate the shortest word
        // to match the number of available platforms
        const baseWord = SHORTEST_WORD;
        targetWord = baseWord.substring(0, Math.min(baseWord.length, suitablePlatforms.length));
        
        // If still no platforms, exit early
        if (suitablePlatforms.length === 0 || targetWord.length === 0) {
            console.warn('Not enough reachable platforms for any word');
            return;
        }
    } else {
        targetWord = availableWords[Math.floor(Math.random() * availableWords.length)];
    }
    
    // Shuffle platforms using Fisher-Yates algorithm
    const shuffledPlatforms = shuffleArray(suitablePlatforms);
    
    // Place each letter of the word on different platforms (one letter per platform)
    for (let i = 0; i < targetWord.length; i++) {
        const platform = shuffledPlatforms[i];  // Direct indexing since word length <= platform count
        
        // Safety check: ensure platform exists
        // This should never happen due to filtering above, but we check defensively
        // to prevent crashes from undefined access
        if (!platform) {
            console.error(`CRITICAL: Platform ${i} is undefined for letter ${targetWord[i]} - this indicates a bug in platform filtering`);
            console.error(`Available platforms: ${suitablePlatforms.length}, Word length: ${targetWord.length}`);
            continue;
        }
        
        // Place letter on top of platform, centered with some randomness
        const letterSize = getScaledLetterSize();
        const platformCenterX = platform.x + platform.width / 2;
        const randomOffsetX = (Math.random() - 0.5) * Math.min(
            platform.width * COLLECTIBLE_LETTER_OFFSET_RATIO, 
            COLLECTIBLE_LETTER_MAX_OFFSET
        );
        const letterX = platformCenterX + randomOffsetX - letterSize / 2;
        const letterY = platform.y - letterSize - COLLECTIBLE_LETTER_VERTICAL_OFFSET;
        
        letters.push(new Letter(targetWord[i], letterX, letterY, i));
    }
    
    console.log(`Placed ${letters.length} letters to spell: ${targetWord} on reachable platforms`);
}

// Start the game loop
function startGame() {
    gameRunning = true;
    gameWon = false;  // Reset win state
    canvas.style.display = 'block';
    gameInfo.style.display = 'none';  // Hide old game info (we draw it on canvas now)
    resetBtn.style.display = 'inline-block';
    uploadBtn.style.display = 'none';
    cameraBtn.style.display = 'none';
    
    // Show detection mode badge
    detectionModeBadge.classList.add('visible');
    
    score = 0;
    wordCompleteBonus = 0;
    correctOrderBonus = 0;
    startTime = Date.now();
    
    // Reset camera
    camera.x = 0;
    camera.y = 0;
    camera.targetX = 0;
    camera.targetY = 0;
    
    // Resize canvas to fill the container/viewport (also computes autoFitZoom)
    resizeCanvas();
    
    // Set zoom to auto-fit so the world fills the screen
    camera.zoom = camera.autoFitZoom;
    
    // Enter fullscreen when game starts
    enterFullscreen();
    
    gameLoop();
}

// Resize canvas to fill viewport
function resizeCanvas() {
    const container = document.querySelector('.game-canvas-container');
    const isFullscreen = container.classList.contains('fullscreen');
    
    if (isFullscreen) {
        // Fill entire screen on mobile/fullscreen for maximum gameplay area
        // Note: This intentionally ignores photo aspect ratio to maximize screen usage
        // The game world will scale to fill available space (may appear stretched)
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    } else {
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
    }
    
    // Update minimum zoom to ensure entire world can be viewed
    updateZoomLimits();
}

// Calculate and update zoom limits based on world and canvas size
function updateZoomLimits() {
    // Calculate zoom levels: fit (entire world visible) and fill (no letterbox)
    const zoomToFitWidth = canvas.width / worldWidth;
    const zoomToFitHeight = canvas.height / worldHeight;
    const minZoomToFitWorld = Math.min(zoomToFitWidth, zoomToFitHeight);
    const fillZoom = Math.max(zoomToFitWidth, zoomToFitHeight);
    
    // minZoom allows zooming out to see the full level
    camera.minZoom = Math.max(0.1, minZoomToFitWorld * 0.95);
    camera.maxZoom = 2.0;
    
    // Default zoom fits the photo in the canvas — frosted letterbox shows around edges
    camera.autoFitZoom = Math.max(camera.minZoom, Math.min(minZoomToFitWorld, camera.maxZoom));
}

// Update camera to follow player
function updateCamera() {
    if (!player) return;
    
    // Target camera position (center on player)
    camera.targetX = player.x + player.width / 2 - (canvas.width / camera.zoom) / 2;
    camera.targetY = player.y + player.height / 2 - (canvas.height / camera.zoom) / 2;
    
    // Smooth camera movement
    camera.x += (camera.targetX - camera.x) * camera.smoothing;
    camera.y += (camera.targetY - camera.y) * camera.smoothing;
    
    // Clamp camera to world bounds, centering when viewport exceeds world
    const viewportWidth = canvas.width / camera.zoom;
    const viewportHeight = canvas.height / camera.zoom;
    if (viewportWidth >= worldWidth) {
        // Viewport wider than world — center horizontally
        camera.x = -(viewportWidth - worldWidth) / 2;
    } else {
        camera.x = Math.max(0, Math.min(camera.x, worldWidth - viewportWidth));
    }
    if (viewportHeight >= worldHeight) {
        // Viewport taller than world — center vertically
        camera.y = -(viewportHeight - worldHeight) / 2;
    } else {
        camera.y = Math.max(0, Math.min(camera.y, worldHeight - viewportHeight));
    }
}

// Main game loop
function gameLoop() {
    if (!gameRunning) return;

    // Update camera position
    updateCamera();

    // Clear canvas with dark letterbox color (area outside the game world)
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Save context state
    ctx.save();
    
    // Apply camera transformation for game world
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // Fill world bounds with sky-blue background
    ctx.fillStyle = '#87ceeb';
    ctx.fillRect(0, 0, worldWidth, worldHeight);

    // Draw the photo as background in world space (so it zooms with camera)
    if (backgroundImage) {
        ctx.drawImage(backgroundImage, 0, 0, worldWidth, worldHeight);
    }

    // Update and draw goal
    if (goal) {
        goal.update();
        goal.draw();
    }

    // Draw visual-only shadow blocks first (no collisions)
    for (let shadow of shadowPlatforms) {
        shadow.draw();
    }

    // Update and draw platforms
    for (let platform of platforms) {
        platform.draw();
    }

    if (debugOverlayEnabled && debugSolidGrid) {
        drawDebugOverlay();
    }

    // Update and draw letters (skip collected ones for performance)
    for (let letter of letters) {
        if (!letter.collected) {
            letter.update();
            letter.draw();
        }
    }

    // Update and draw player
    if (player && !gameWon) {
        player.update();
        player.draw();
        
        // Check for letter collection
        for (let letter of letters) {
            if (letter.checkCollision(player)) {
                letter.collected = true;
                collectedLetters.push(letter);
                
                // Add points for the letter
                score += COLLECTIBLE_LETTER_POINTS;
                scoreElement.textContent = score;
                
                console.log(`Collected letter: ${letter.char} (${collectedLetters.length}/${targetWord.length})`);
            }
        }
        
        // Check if player reached the goal portal
        if (goal) {
            const collision = goal.checkCollision(player);
            if (collision) {
                console.log('Player reached goal portal!');
                console.log('Player:', { x: player.x, y: player.y, width: player.width, height: player.height });
                console.log('Goal Portal:', { x: goal.x, y: goal.y, width: goal.width, height: goal.height });
                // Calculate bonuses if all letters were collected
                if (collectedLetters.length === targetWord.length) {
                    wordCompleteBonus = WORD_COMPLETE_BONUS;
                    score += wordCompleteBonus;
                    
                    // Check if letters were collected in correct order
                    let correctOrder = true;
                    for (let i = 0; i < collectedLetters.length; i++) {
                        if (collectedLetters[i].index !== i) {
                            correctOrder = false;
                            break;
                        }
                    }
                    
                    if (correctOrder) {
                        correctOrderBonus = CORRECT_ORDER_BONUS;
                        score += correctOrderBonus;
                    }
                    
                    scoreElement.textContent = score;
                }
                gameWon = true;
                console.log('Game won set to true');
            }
        } else {
            console.warn('goal is null!');
        }
    } else if (player && gameWon) {
        // Just draw the player when game is won, don't update
        player.draw();
    }

    // Restore context for UI overlay (drawn in screen space, not world space)
    ctx.restore();

    // Draw game info overlay (score, time)
    drawGameInfoOverlay();

    // Draw collected letters display
    drawCollectedLetters();

    // Draw win message if game is won
    if (gameWon) {
        drawWinMessage();
    }
    
    // Draw zoom level indicator
    drawZoomIndicator();

    requestAnimationFrame(gameLoop);
}

// Draw zoom level indicator
function drawZoomIndicator() {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(canvas.width - 80, canvas.height - 40, 70, 30);
    
    ctx.fillStyle = '#FFF';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(camera.zoom * 100)}%`, canvas.width - 45, canvas.height - 25);
    ctx.restore();
}

// Draw game info overlay (score, time, controls hint)
function drawGameInfoOverlay() {
    ctx.save();
    
    // Top-right corner - Score and Time
    const infoX = canvas.width - 10;
    const infoY = 10;
    
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = 4;
    ctx.fillStyle = '#FFD700';
    
    const scoreText = `Score: ${score}`;
    ctx.strokeText(scoreText, infoX, infoY);
    ctx.fillText(scoreText, infoX, infoY);
    
    const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    const timeText = `Time: ${elapsedTime}s`;
    ctx.strokeText(timeText, infoX, infoY + 22);
    ctx.fillText(timeText, infoX, infoY + 22);
    
    ctx.restore();
}

function drawDebugOverlay() {
    const gridSize = debugGridSize;
    if (!gridSize) return;

    // Solid grid hint
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#00bcd4';

    for (let cy = 0; cy < debugSolidGrid.length; cy++) {
        const row = debugSolidGrid[cy];
        for (let cx = 0; cx < row.length; cx++) {
            if (!row[cx]) continue;
            const x = cx * gridSize;
            const y = cy * gridSize;
            const w = Math.min(gridSize, canvas.width - x);
            const h = Math.min(gridSize, canvas.height - y);
            ctx.fillRect(x, y, w, h);
        }
    }

    // Edge density overlay (subtle heatmap)
    if (debugEdgeDensity) {
        for (let cy = 0; cy < debugEdgeDensity.length; cy++) {
            const row = debugEdgeDensity[cy];
            for (let cx = 0; cx < row.length; cx++) {
                const density = row[cx];
                if (density <= 0) continue;
                const x = cx * gridSize;
                const y = cy * gridSize;
                const w = Math.min(gridSize, canvas.width - x);
                const h = Math.min(gridSize, canvas.height - y);
                const alpha = Math.min(0.35, density * 0.8);
                ctx.fillStyle = `rgba(255, 64, 64, ${alpha})`;
                ctx.fillRect(x, y, w, h);
            }
        }
    }

    // Helper platforms highlight
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(80, 120, 255, 1)';
    ctx.lineWidth = 2;
    for (const p of debugHelperPlatforms) {
        ctx.strokeRect(p.x, p.y, p.width, p.height);
    }

    // Segmentation-derived platforms (debug)
    if (debugSegmentationPlatforms && debugSegmentationPlatforms.length > 0) {
        ctx.strokeStyle = 'rgba(0, 255, 153, 0.9)';
        ctx.lineWidth = 2;
        for (const p of debugSegmentationPlatforms) {
            ctx.strokeRect(p.x, p.y, p.width, p.height);
        }
    }

    // Segmentation availability hint (debug only)
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = modelSupportsSegmentation() ? '#00ff99' : '#ffcc66';
    ctx.fillText(
        `Segmentation: ${modelSupportsSegmentation() ? 'ready' : 'unavailable'}`,
        8,
        16
    );

    // ML detected objects overlay (only in debug mode)
    if (debugOverlayEnabled && debugDetectedObjects && debugDetectedObjects.length > 0) {
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        
        for (const detection of debugDetectedObjects) {
            const [x, y, w, h] = detection.bbox;
            
            // Draw bounding box
            if (detection.isPlatformable) {
                ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
            } else {
                ctx.strokeStyle = 'rgba(255, 165, 0, 0.8)';
            }
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, w, h);
            
            // Draw label background
            const label = `${detection.class} (${Math.round(detection.confidence * 100)}%)`;
            const textWidth = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(x, y - 16, textWidth + 6, 16);
            
            // Draw label text
            ctx.fillStyle = detection.isPlatformable ? '#00ff00' : '#ffa500';
            ctx.fillText(label, x + 3, y - 4);
        }
    }

    ctx.restore();
}

// Update word bar HTML element with collected letters
function drawCollectedLetters() {
    if (letters.length === 0) {
        wordBar.style.display = 'none';
        return;
    }

    wordBar.style.display = 'flex';

    const collectedIndices = new Set(collectedLetters.map(l => l.index));

    let lettersHTML = '';
    for (let i = 0; i < targetWord.length; i++) {
        const collected = collectedIndices.has(i);
        const className = collected ? 'word-letter collected' : 'word-letter uncollected';
        lettersHTML += `<span class="${className}">${targetWord[i]}</span>`;
    }

    wordLetters.innerHTML = lettersHTML;
    wordProgress.textContent = `${collectedLetters.length}/${targetWord.length}`;
}

// Draw win message overlay
function drawWinMessage() {
    // Calculate message height based on content
    let messageHeight = 80;
    let yOffset = 0;
    
    if (collectedLetters.length === targetWord.length) {
        messageHeight = 160;
    }
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, canvas.height / 2 - messageHeight / 2, canvas.width, messageHeight);
    
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🎉 YOU WIN! 🎉', canvas.width / 2, canvas.height / 2 - 50);
    
    // Show word if all letters were collected
    if (collectedLetters.length === targetWord.length) {
        ctx.font = 'bold 28px Arial';
        ctx.fillStyle = '#00FF00';
        ctx.fillText(`You spelled: ${targetWord}!`, canvas.width / 2, canvas.height / 2 - 15);
        
        // Show bonuses
        ctx.font = '18px Arial';
        ctx.fillStyle = '#FFF';
        yOffset = 10;
        ctx.fillText(`Word Complete Bonus: +${wordCompleteBonus}`, canvas.width / 2, canvas.height / 2 + yOffset);
        
        if (correctOrderBonus > 0) {
            yOffset += 25;
            ctx.fillStyle = '#FFD700';
            ctx.fillText(`✨ Correct Order Bonus: +${correctOrderBonus} ✨`, canvas.width / 2, canvas.height / 2 + yOffset);
        }
        
        yOffset += 30;
    } else {
        yOffset = 0;
    }
    
    ctx.font = '16px Arial';
    ctx.fillStyle = '#FFF';
    ctx.fillText('Press ESC or click "Exit Game" to return to start', canvas.width / 2, canvas.height / 2 + yOffset + 30);
}

// Show intro screen (from splash or back from game)
function showIntroScreen() {
    splashScreen.classList.add('hidden');
    introScreen.classList.remove('hidden');
    gameScreen.classList.remove('active');
    exitFullscreen();
}

// Show game screen
function showGameScreen() {
    splashScreen.classList.add('hidden');
    introScreen.classList.add('hidden');
    gameScreen.classList.add('active');
}

// Enter fullscreen
function enterFullscreen() {
    gameCanvasContainer.classList.add('fullscreen');
    exitFullscreenBtn.classList.add('visible');
    document.body.style.overflow = 'hidden';
    
    // Lock to landscape orientation on mobile devices
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(err => {
            // Orientation lock requires fullscreen API and may not be supported on all devices
            // This is an optional enhancement - game works fine without it
            console.log('Screen orientation lock not available:', err.name, err.message);
        });
    }
}

// Exit fullscreen
function exitFullscreen() {
    gameCanvasContainer.classList.remove('fullscreen');
    exitFullscreenBtn.classList.remove('visible');
    document.body.style.overflow = '';
    
    // Unlock screen orientation
    if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
    }
}

// Return to intro and exit fullscreen
function returnToIntro() {
    resetGame();
    showIntroScreen();
}

// Reset game
function resetGame() {
    gameRunning = false;
    gameWon = false;
    platforms = [];
    player = null;
    goal = null;  // Clear goal
    score = 0;
    letters = [];  // Clear letters
    collectedLetters = [];  // Clear collected letters
    targetWord = '';  // Clear target word
    wordCompleteBonus = 0;
    correctOrderBonus = 0;
    backgroundImage = null; // Clear background image
    canvas.style.display = 'none';
    gameInfo.style.display = 'none';
    wordBar.style.display = 'none';  // Hide word bar
    detectionModeBadge.classList.remove('visible');  // Hide detection mode badge
    resetBtn.style.display = 'none';
    uploadBtn.style.display = 'inline-block';
    cameraBtn.style.display = 'inline-block';
}

function guessDeviceType() {
    const ua = (navigator.userAgent || '').toLowerCase();
    if (ua.includes('ipad') || ua.includes('tablet')) return 'tablet';
    if (ua.includes('iphone') || ua.includes('android')) {
        return ua.includes('mobile') ? 'mobile' : 'tablet';
    }
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
        return window.innerWidth >= 768 ? 'tablet' : 'mobile';
    }
    return 'desktop';
}

function setFeedbackStatus(text, kind) {
    feedbackStatus.textContent = text || '';
    feedbackStatus.classList.remove('error', 'success');
    if (kind) feedbackStatus.classList.add(kind);
}

function openFeedbackModal() {
    feedbackDeviceType.value = guessDeviceType();
    setFeedbackStatus('', null);
    feedbackModal.classList.add('open');
    feedbackModal.setAttribute('aria-hidden', 'false');

    if (location.protocol === 'file:') {
        setFeedbackStatus('Feedback requires running the local server (not file://).', 'error');
    }

    setTimeout(() => {
        feedbackMessage.focus();
    }, 0);
}

function closeFeedbackModal() {
    feedbackModal.classList.remove('open');
    feedbackModal.setAttribute('aria-hidden', 'true');
}

async function postFeedback(message, deviceType, token) {
    const headers = {
        'Content-Type': 'application/json'
    };
    if (token) headers['X-Feedback-Token'] = token;

    return fetch('/api/feedback', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            message,
            deviceType
        })
    });
}

function shouldIgnoreGameKeyEvent(e) {
    if (feedbackModal.classList.contains('open')) return true;
    const target = e.target;
    if (!target) return false;
    if (target.isContentEditable) return true;
    const tag = (target.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function updateLanHint() {
    if (location.protocol === 'file:') {
        lanHint.classList.remove('open');
        return;
    }

    lanHint.classList.add('open');
    lanUrl.textContent = location.href;

    const host = (location.hostname || '').toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') {
        lanNote.innerHTML = 'If you\'re sharing to other devices, replace <strong>localhost</strong> with the host computer\'s LAN IP (e.g. <strong>192.168.x.x</strong>).';
    } else if (host === '0.0.0.0') {
        lanNote.innerHTML = 'Use the host computer\'s LAN IP instead of <strong>0.0.0.0</strong> when sharing (e.g. <strong>192.168.x.x</strong>).';
    } else {
        lanNote.textContent = 'Open this URL on devices connected to the same network.';
    }
}

if (debugOverlayToggle) {
    debugOverlayToggle.checked = DEBUG_DEFAULT_ENABLED;
    debugOverlayToggle.addEventListener('change', () => {
        debugOverlayEnabled = Boolean(debugOverlayToggle.checked);
    });
}

// ML Detection toggle handling
const mlDetectionToggle = document.getElementById('mlDetectionToggle');
const mlOnlyModeToggle = document.getElementById('mlOnlyModeToggle');
if (mlDetectionToggle) {
    mlDetectionToggle.checked = ML_DETECTION_ENABLED_DEFAULT;
    mlDetectionToggle.addEventListener('change', async () => {
        mlDetectionEnabled = Boolean(mlDetectionToggle.checked);
        
        // Enable/disable ML-only mode toggle based on ML detection state
        if (mlOnlyModeToggle) {
            mlOnlyModeToggle.disabled = !mlDetectionEnabled;
            if (!mlDetectionEnabled) {
                mlOnlyModeToggle.checked = false;
                mlOnlyMode = false;
            }
        }
        
        if (mlDetectionEnabled && !isModelLoaded() && !isModelLoading()) {
            // Reset error state to allow retry
            resetOnnxLoadError();
            
            // Show loading status
            updateMLStatus('Loading model...');
            
            // Start loading the ONNX model when user enables ML detection
            const success = await initONNXModel({ onStatus: updateMLStatus });
            if (!success) {
                // If loading fails, disable the toggle and show helpful message
                mlDetectionToggle.checked = false;
                mlDetectionEnabled = false;
                updateMLStatus('');
                updateDetectionModeBadge();
                
                // Also disable ML-only mode toggle
                if (mlOnlyModeToggle) {
                    mlOnlyModeToggle.disabled = true;
                    mlOnlyModeToggle.checked = false;
                    mlOnlyMode = false;
                }
                
                // Show actual error from console
                const errorMsg = getOnnxLoadError()?.message || 'Unknown error';
                alert('ML detection failed to load.\n\n' +
                    'Error: ' + errorMsg + '\n\n' +
                    'Check browser console (F12) for details.\n\n' +
                    'Common fixes:\n' +
                    '- Refresh the page\n' +
                    '- Check internet connection (CDN needed)\n' +
                    '- Clear browser cache\n\n' +
                    'See docs/ONNX_SETUP.md for full troubleshooting.');
            } else {
                updateMLStatus('ML ready');
                updateDetectionModeBadge();
            }
        } else if (mlDetectionEnabled && isModelLoaded()) {
            updateMLStatus('ML ready');
            updateDetectionModeBadge();
        } else {
            updateMLStatus('');
            updateDetectionModeBadge();
        }
    });
}

// ML-only mode toggle handling
if (mlOnlyModeToggle) {
    mlOnlyModeToggle.checked = ML_ONLY_MODE_DEFAULT;
    mlOnlyModeToggle.disabled = !mlDetectionEnabled; // Initially disabled unless ML is enabled
    mlOnlyModeToggle.addEventListener('change', () => {
        mlOnlyMode = Boolean(mlOnlyModeToggle.checked);
        console.log(`ML-only mode ${mlOnlyMode ? 'enabled' : 'disabled'}`);
        updateDetectionModeBadge();
    });
}

async function copyLanLink() {
    const text = location.href;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const temp = document.createElement('textarea');
            temp.value = text;
            temp.style.position = 'fixed';
            temp.style.left = '-9999px';
            document.body.appendChild(temp);
            temp.focus();
            temp.select();
            document.execCommand('copy');
            document.body.removeChild(temp);
        }
        copyLinkBtn.textContent = 'Copied';
        setTimeout(() => {
            copyLinkBtn.textContent = 'Copy';
        }, 900);
    } catch {
        copyLinkBtn.textContent = 'Copy failed';
        setTimeout(() => {
            copyLinkBtn.textContent = 'Copy';
        }, 1200);
    }
}

// Event listeners
splashPlayBtn.addEventListener('click', showIntroScreen);
startGameBtn.addEventListener('click', showGameScreen);
exitFullscreenBtn.addEventListener('click', returnToIntro);

uploadBtn.addEventListener('click', () => fileInput.click());
cameraBtn.addEventListener('click', () => cameraInput.click());
resetBtn.addEventListener('click', returnToIntro);

copyLinkBtn.addEventListener('click', copyLanLink);

feedbackBtn.addEventListener('click', openFeedbackModal);
feedbackCancelBtn.addEventListener('click', closeFeedbackModal);
feedbackModal.addEventListener('click', (e) => {
    if (e.target === feedbackModal) closeFeedbackModal();
});

fileInput.addEventListener('change', (e) => {
    console.log('File input changed');
    const file = e.target.files[0];
    if (file) {
        console.log('File selected:', file.name, file.type, file.size);
        // Validate file type
        if (!file.type.match('image.*')) {
            alert('Please select a valid image file.');
            return;
        }
        
        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            alert('File is too large. Please select an image under 10MB.');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
            console.log('FileReader loaded');
            const img = new Image();
            img.onload = () => {
                console.log('Image loaded, calling processImage');
                processImage(img);
            };
            img.onerror = () => {
                console.error('Image load error');
                alert('Failed to load image. Please try a different file.');
            };
            img.src = event.target.result;
        };
        reader.onerror = () => {
            console.error('FileReader error');
            alert('Failed to read file. Please try again.');
        };
        reader.readAsDataURL(file);
    }
});

cameraInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        // Validate file type
        if (!file.type.match('image.*')) {
            alert('Please capture a valid image.');
            return;
        }
        
        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            alert('Image is too large. Please try again.');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => processImage(img);
            img.onerror = () => {
                alert('Failed to load image. Please try again.');
            };
            img.src = event.target.result;
        };
        reader.onerror = () => {
            alert('Failed to read image. Please try again.');
        };
        reader.readAsDataURL(file);
    }
});

feedbackForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const message = (feedbackMessage.value || '').trim();
    const deviceType = feedbackDeviceType.value || 'unknown';

    if (!message) {
        setFeedbackStatus('Please enter a message.', 'error');
        return;
    }

    feedbackSubmitBtn.disabled = true;
    setFeedbackStatus('Sending…', null);

    try {
        let token = localStorage.getItem(FEEDBACK_TOKEN_STORAGE_KEY) || '';
        let response = await postFeedback(message, deviceType, token);

        if (response.status === 401) {
            const enteredToken = window.prompt('This server requires an access code. Enter it to send feedback:');
            if (enteredToken) {
                localStorage.setItem(FEEDBACK_TOKEN_STORAGE_KEY, enteredToken);
                token = enteredToken;
                response = await postFeedback(message, deviceType, token);
            }
        }

        if (!response.ok) {
            const text = await response.text();
            setFeedbackStatus(`Failed to send feedback (${response.status}). ${text ? 'Details: ' + text : ''}`.trim(), 'error');
            return;
        }

        feedbackMessage.value = '';
        setFeedbackStatus('Sent. Thank you!', 'success');

        setTimeout(() => {
            closeFeedbackModal();
        }, 700);
    } catch (err) {
        setFeedbackStatus('Failed to send feedback. Is the local server running?', 'error');
    } finally {
        feedbackSubmitBtn.disabled = false;
    }
});

updateLanHint();

// Keyboard controls
document.addEventListener('keydown', (e) => {
    // ESC key returns to intro screen
    if (e.key === 'Escape') {
        if (gameScreen.classList.contains('active')) {
            returnToIntro();
            e.preventDefault();
        }
        return;
    }
    
    if (shouldIgnoreGameKeyEvent(e)) return;
    
    // Zoom controls with + and - keys
    if (e.key === '=' || e.key === '+') {
        camera.zoom = Math.min(camera.maxZoom, camera.zoom + 0.1);
        e.preventDefault();
        return;
    }
    if (e.key === '-' || e.key === '_') {
        camera.zoom = Math.max(camera.minZoom, camera.zoom - 0.1);
        e.preventDefault();
        return;
    }
    // Reset zoom with '0' — snaps to auto-fit level
    if (e.key === '0') {
        camera.zoom = camera.autoFitZoom;
        e.preventDefault();
        return;
    }
    
    // Manual respawn with 'R' key
    if ((e.key === 'r' || e.key === 'R') && player && gameRunning) {
        player.respawn();
        e.preventDefault();
        return;
    }
    
    // Regenerate level with 'G' key
    if ((e.key === 'g' || e.key === 'G') && backgroundImage && gameRunning) {
        console.log('Regenerating level...');
        gameRunning = false;  // Stop current game loop
        
        // Small delay to ensure current frame completes
        setTimeout(() => {
            processImage(backgroundImage);
        }, 50);
        
        e.preventDefault();
        return;
    }
    
    keys[e.key] = true;
    // Prevent default for arrow keys and space
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
    }
});

// Mouse wheel zoom
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (!gameRunning) return;
    
    const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
    camera.zoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, camera.zoom + zoomDelta));
}, { passive: false });

// Resize canvas when window resizes
window.addEventListener('resize', () => {
    if (gameRunning) {
        resizeCanvas();
    }
});

document.addEventListener('keyup', (e) => {
    if (shouldIgnoreGameKeyEvent(e)) return;
    
    // Variable jump: cut the jump short on early release
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
        applyJumpCut(player);
    }
    
    keys[e.key] = false;
});

// Touch controls for mobile
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    touchStartX = touch.clientX - rect.left;
    touchStartY = touch.clientY - rect.top;
    
    // Jump on tap
    touchJumpingRef.value = true;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;
    
    // Horizontal movement based on touch position
    const deltaX = touchX - touchStartX;
    
    if (deltaX < -20) {
        keys['ArrowLeft'] = true;
        keys['ArrowRight'] = false;
    } else if (deltaX > 20) {
        keys['ArrowRight'] = true;
        keys['ArrowLeft'] = false;
    } else {
        keys['ArrowLeft'] = false;
        keys['ArrowRight'] = false;
    }
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    touchJumpingRef.value = false;
    keys['ArrowLeft'] = false;
    keys['ArrowRight'] = false;
    // Variable jump: cut the jump short on early release
    applyJumpCut(player);
});

// Mobile control button handlers
// Detect if device supports touch and show controls
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    mobileControls.classList.add('visible');
}

// Left button
leftBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    keys['ArrowLeft'] = true;
});
leftBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    keys['ArrowLeft'] = false;
});
leftBtn.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    keys['ArrowLeft'] = false;
});

// Right button
rightBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    keys['ArrowRight'] = true;
});
rightBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    keys['ArrowRight'] = false;
});
rightBtn.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    keys['ArrowRight'] = false;
});

// Jump button
jumpBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchJumpingRef.value = true;
});
jumpBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    touchJumpingRef.value = false;
    applyJumpCut(player);
});
jumpBtn.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    touchJumpingRef.value = false;
    applyJumpCut(player);
});

// Zoom control buttons
zoomInBtn.addEventListener('click', (e) => {
    e.preventDefault();
    camera.zoom = Math.min(camera.maxZoom, camera.zoom + 0.2);
});

zoomOutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    camera.zoom = Math.max(camera.minZoom, camera.zoom - 0.2);
});

zoomResetBtn.addEventListener('click', (e) => {
    e.preventDefault();
    camera.zoom = camera.autoFitZoom;
});

// Respawn button (R)
respawnBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (player && gameRunning) player.respawn();
});
respawnBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (player && gameRunning) player.respawn();
});

// Regenerate level button (G)
regenBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (backgroundImage && gameRunning) {
        console.log('Regenerating level...');
        gameRunning = false;
        setTimeout(() => { processImage(backgroundImage); }, 50);
    }
});
regenBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (backgroundImage && gameRunning) {
        console.log('Regenerating level...');
        gameRunning = false;
        setTimeout(() => { processImage(backgroundImage); }, 50);
    }
});

// Touch support for zoom buttons
zoomInBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    camera.zoom = Math.min(camera.maxZoom, camera.zoom + 0.2);
});

zoomOutBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    camera.zoom = Math.max(camera.minZoom, camera.zoom - 0.2);
});

zoomResetBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    camera.zoom = camera.autoFitZoom;
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && feedbackModal.classList.contains('open')) {
        closeFeedbackModal();
    }
});

// Register Service Worker for PWA/offline support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('Service Worker registered:', registration.scope);
            })
            .catch((error) => {
                console.log('Service Worker registration failed:', error);
            });
    });
}
