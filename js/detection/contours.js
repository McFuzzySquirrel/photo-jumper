export function masksToTopContours(options) {
    const { masks, width, height } = options;

    if (!masks || masks.length === 0) return [];

    // Placeholder: expects masks as arrays of { data, width, height }
    // TODO: Replace with YOLOE segmentation tensor parsing.
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

    for (const item of contours) {
        const { contour, width, height } = item;
        let runStart = null;

        for (let x = 0; x <= width; x++) {
            const y = x < width ? contour[x] : null;
            if (y !== null && runStart === null) {
                runStart = x;
            }
            if ((y === null || x === width) && runStart !== null) {
                const runEnd = x - 1;
                const runWidth = runEnd - runStart + 1;
                const snappedWidth = Math.ceil(runWidth / blockSize) * blockSize;

                if (snappedWidth >= platformMinWidth) {
                    const worldX = runStart;
                    const worldY = contour[Math.min(runStart, contour.length - 1)];
                    const snappedX = Math.floor(worldX / blockSize) * blockSize;
                    const snappedY = Math.floor(worldY / blockSize) * blockSize;
                    const finalX = Math.max(0, Math.min(worldWidth - snappedWidth, snappedX));
                    const finalY = Math.max(0, Math.min(worldHeight - blockSize, snappedY));

                    const isStartArea = (finalX < startAreaWidth && finalY > worldHeight - startAreaHeight);
                    const isGoalArea = (finalX > worldWidth - goalAreaWidth && finalY < goalAreaHeight);
                    const isWordBarArea = (finalY < wordBarAreaHeight);
                    if (isStartArea || isGoalArea || isWordBarArea) {
                        continue;
                    }

                    platforms.push(new platformClass(
                        finalX,
                        finalY,
                        snappedWidth,
                        blockSize,
                        color,
                        'ml-seg'
                    ));
                }

                runStart = null;
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
