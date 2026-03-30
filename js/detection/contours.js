// ---------------------------------------------------------------------------
// masksToTopContours — Extract the topmost contour of each instance mask
//
// For each mask (output of computeInstanceMasks or a generic mask tensor):
//   1. Scan each column top-to-bottom; the first pixel with value > 0.5 is the
//      top-surface Y for that column.
//   2. Scale from mask resolution (e.g. 160×160 proto space) to world space.
//   3. Fill small gaps (≤ 4 px) via linear interpolation.
//   4. Smooth with a 3-pixel moving-average window to reduce staircase noise.
//
// Returns Array<{ contour: number[], width: number, height: number }>
// where contour[x] is the world-space Y of the top surface, or null.
// ---------------------------------------------------------------------------
export function masksToTopContours(options) {
    const { masks, width, height } = options;

    if (!masks || masks.length === 0) return [];

    const contours = [];

    for (const mask of masks) {
        const maskWidth = mask.width || width;
        const maskHeight = mask.height || height;
        const data = mask.data;
        if (!data) continue;

        const topContour = new Array(maskWidth).fill(null);

        for (let x = 0; x < maskWidth; x++) {
            for (let y = 0; y < maskHeight; y++) {
                const idx = y * maskWidth + x;
                if (data[idx] > 0.5) {
                    topContour[x] = y;
                    break;
                }
            }
        }

        const scaleX = width / maskWidth;
        const scaleY = height / maskHeight;
        const scaledContour = new Array(width).fill(null);
        for (let x = 0; x < maskWidth; x++) {
            const y = topContour[x];
            if (y === null) continue;
            const worldX = Math.min(width - 1, Math.round(x * scaleX));
            const worldY = Math.round(y * scaleY);
            scaledContour[worldX] = worldY;
        }

        const filledContour = fillContourGaps(scaledContour, 4);
        const smoothedContour = smoothContour(filledContour, 3);

        contours.push({
            contour: smoothedContour,
            width,
            height
        });
    }

    return contours;
}

function smoothContour(contour, windowSize) {
    const radius = Math.max(1, Math.floor(windowSize / 2));
    const smoothed = new Array(contour.length).fill(null);

    for (let x = 0; x < contour.length; x++) {
        let sum = 0;
        let count = 0;
        for (let dx = -radius; dx <= radius; dx++) {
            const idx = x + dx;
            if (idx < 0 || idx >= contour.length) continue;
            const y = contour[idx];
            if (y === null) continue;
            sum += y;
            count += 1;
        }
        if (count > 0) {
            smoothed[x] = Math.round(sum / count);
        }
    }

    return smoothed;
}

function fillContourGaps(contour, maxGap) {
    const filled = [...contour];
    let lastIndex = null;
    let lastValue = null;

    for (let x = 0; x < filled.length; x++) {
        const y = filled[x];
        if (y === null) continue;

        if (lastIndex !== null) {
            const gap = x - lastIndex - 1;
            if (gap > 0 && gap <= maxGap) {
                for (let i = 1; i <= gap; i++) {
                    const t = i / (gap + 1);
                    const interp = Math.round(lastValue + (y - lastValue) * t);
                    filled[lastIndex + i] = interp;
                }
            }
        }

        lastIndex = x;
        lastValue = y;
    }

    return filled;
}

// ---------------------------------------------------------------------------
// contoursToSteppedPlatforms — Convert contour arrays to block-aligned platforms
//
// Instead of producing one flat platform per contiguous mask region, this
// function creates a *staircase* of platforms that follow the contour shape.
// Whenever the contour's Y value snaps to a different block-grid row, a new
// platform step begins.  Each step must meet the minimum width (2 blocks)
// and is excluded if it falls inside a reserved zone (start area, goal area,
// or word bar).
//
// Returns Array<Platform> with kind = 'ml-seg'.
// ---------------------------------------------------------------------------
export function contoursToSteppedPlatforms(options) {
    const {
        contours,
        blockSize,
        platformMinWidth,
        platformClass,
        color,
        worldWidth,
        worldHeight,
        startAreaWidth,
        startAreaHeight,
        goalAreaWidth,
        goalAreaHeight,
        wordBarAreaHeight,
        mergeGapPx
    } = options;

    if (!contours || contours.length === 0) return [];

    const platforms = [];

    // Helper: finalise a single step into a snapped platform
    function emitPlatform(startX, endX, snappedY) {
        const runWidth = endX - startX + 1;
        // Round width up to the nearest whole-block multiple
        const snappedWidth = Math.ceil(runWidth / blockSize) * blockSize;

        // Enforce minimum platform width (2 blocks = 40 px)
        if (snappedWidth < platformMinWidth) return;

        // Snap X to block grid and clamp within world bounds
        const snappedX = Math.floor(startX / blockSize) * blockSize;
        const finalX = Math.max(0, Math.min(worldWidth - snappedWidth, snappedX));
        const finalY = Math.max(0, Math.min(worldHeight - blockSize, snappedY));

        // --- Exclude reserved zones ---
        // Start area: bottom-left corner
        const isStartArea = (finalX < startAreaWidth && finalY > worldHeight - startAreaHeight);
        // Goal area: top-right corner
        const isGoalArea = (finalX > worldWidth - goalAreaWidth && finalY < goalAreaHeight);
        // Word bar: thin strip along the very top of the world
        const isWordBarArea = (finalY < wordBarAreaHeight);
        if (isStartArea || isGoalArea || isWordBarArea) return;

        platforms.push(new platformClass(
            finalX,
            finalY,
            snappedWidth,
            blockSize,
            color,
            'ml-seg'
        ));
    }

    // Process each contour (one per detected object mask)
    for (const item of contours) {
        const { contour, width } = item;
        if (!contour || contour.length === 0) continue;

        let stepStartX = null;   // leftmost X of the current step
        let stepSnappedY = null; // block-grid Y of the current step

        // Walk left-to-right.  At x === width we inject a sentinel null
        // so that any open step is finalised automatically.
        for (let x = 0; x <= width; x++) {
            const y = (x < width) ? contour[x] : null;

            if (y !== null) {
                // Snap this column's Y to the block grid
                const snappedY = Math.floor(y / blockSize) * blockSize;

                if (stepStartX === null) {
                    // Begin a brand-new step
                    stepStartX = x;
                    stepSnappedY = snappedY;
                } else if (snappedY !== stepSnappedY) {
                    // The contour has moved to a different block row —
                    // finalise the current step and start a new one.
                    emitPlatform(stepStartX, x - 1, stepSnappedY);
                    stepStartX = x;
                    stepSnappedY = snappedY;
                }
                // Otherwise same row: keep extending the current step
            } else if (stepStartX !== null) {
                // Null gap or sentinel — finalise the current step
                emitPlatform(stepStartX, x - 1, stepSnappedY);
                stepStartX = null;
                stepSnappedY = null;
            }
        }
    }

    if (!mergeGapPx) {
        return platforms;
    }

    return mergeSteppedPlatforms(platforms, mergeGapPx);
}

function mergeSteppedPlatforms(platforms, mergeGapPx) {
    if (platforms.length === 0) return [];

    const sorted = [...platforms].sort((a, b) => a.y - b.y || a.x - b.x);
    const merged = [];
    let current = { ...sorted[0] };

    for (let i = 1; i < sorted.length; i++) {
        const next = sorted[i];
        const sameRow = Math.abs(next.y - current.y) <= mergeGapPx;
        const adjacent = next.x <= current.x + current.width + mergeGapPx;

        if (sameRow && adjacent) {
            const newRight = Math.max(current.x + current.width, next.x + next.width);
            current.width = newRight - current.x;
        } else {
            merged.push(current);
            current = { ...next };
        }
    }

    merged.push(current);
    return merged;
}
