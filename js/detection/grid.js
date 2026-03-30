export function buildSolidGrid(options) {
    const {
        width,
        height,
        data,
        gridSize,
        brightnessThreshold,
        edgeDetectionThreshold,
        edgeBrightnessThreshold,
        startAreaWidth,
        startAreaHeight,
        goalAreaWidth,
        goalAreaHeight,
        wordBarAreaHeight
    } = options;

    const cellsX = Math.ceil(width / gridSize);
    const cellsY = Math.ceil(height / gridSize);
    const solid = Array.from({ length: cellsY }, () => Array.from({ length: cellsX }, () => false));
    const brightness = Array.from({ length: cellsY }, () => Array.from({ length: cellsX }, () => 255));
    const edgeDensity = Array.from({ length: cellsY }, () => Array.from({ length: cellsX }, () => 0));

    function hasEdge(x, y) {
        if (x === 0 || y === 0 || x + 1 >= width || y + 1 >= height) {
            return false;
        }

        const centerI = (y * width + x) * 4;
        const centerBrightness = (data[centerI] + data[centerI + 1] + data[centerI + 2]) / 3;

        let maxDiff = 0;
        const checkPositions = [
            [x - 1, y], [x + 1, y],
            [x, y - 1], [x, y + 1]
        ];

        for (const [px, py] of checkPositions) {
            if (px >= 0 && px < width && py >= 0 && py < height) {
                const i = (py * width + px) * 4;
                const neighborBrightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
                const diff = Math.abs(centerBrightness - neighborBrightness);
                maxDiff = Math.max(maxDiff, diff);
            }
        }

        return maxDiff > edgeDetectionThreshold;
    }

    for (let cy = 0; cy < cellsY; cy++) {
        for (let cx = 0; cx < cellsX; cx++) {
            const x = cx * gridSize;
            const y = cy * gridSize;

            let totalBrightness = 0;
            let pixelCount = 0;
            let edgeCount = 0;
            let edgeSamples = 0;

            for (let dy = 0; dy < gridSize && y + dy < height; dy++) {
                for (let dx = 0; dx < gridSize && x + dx < width; dx++) {
                    const i = ((y + dy) * width + (x + dx)) * 4;
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const bness = (r + g + b) / 3;
                    totalBrightness += bness;
                    pixelCount++;

                    if (dx % 4 === 0 && dy % 4 === 0 && x + dx + 1 < width && y + dy + 1 < height) {
                        const rightI = i + 4;
                        const downI = i + width * 4;
                        const rightB = (data[rightI] + data[rightI + 1] + data[rightI + 2]) / 3;
                        const downB = (data[downI] + data[downI + 1] + data[downI + 2]) / 3;
                        const localDiff = Math.max(Math.abs(bness - rightB), Math.abs(bness - downB));
                        if (localDiff > edgeDetectionThreshold) {
                            edgeCount++;
                        }
                        edgeSamples++;
                    }
                }
            }

            const avgBrightness = pixelCount > 0 ? (totalBrightness / pixelCount) : 255;
            brightness[cy][cx] = avgBrightness;
            edgeDensity[cy][cx] = edgeSamples > 0 ? (edgeCount / edgeSamples) : 0;

            const isEdge = hasEdge(x, y);

            const isStartArea = (x < startAreaWidth && y > height - startAreaHeight);
            const isGoalArea = (x > width - goalAreaWidth && y < goalAreaHeight);
            const isWordBarArea = (y < wordBarAreaHeight);

            const isSolidHint = (!isStartArea && !isGoalArea && !isWordBarArea) &&
                (avgBrightness < brightnessThreshold || (isEdge && avgBrightness < edgeBrightnessThreshold));

            solid[cy][cx] = Boolean(isSolidHint);
        }
    }

    return {
        solid,
        brightness,
        edgeDensity,
        cellsX,
        cellsY,
        gridSize,
        width,
        height
    };
}

function platformColorFromBrightness(avgBrightness) {
    const alpha = 0.85;
    const colorValue = Math.floor(avgBrightness * 0.6);
    return `rgba(${colorValue}, ${colorValue}, ${colorValue}, ${alpha})`;
}

function filterVerticallyClashingPlatforms(platforms, playerSize) {
    const minVerticalGap = playerSize + 5;
    const filtered = [];

    const sorted = [...platforms].sort((a, b) => a.y - b.y);

    for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i];
        let tooClose = false;

        for (let j = i + 1; j < sorted.length; j++) {
            const below = sorted[j];
            const horizontalOverlap = !(current.x + current.width <= below.x || below.x + below.width <= current.x);

            if (horizontalOverlap) {
                const verticalGap = below.y - (current.y + current.height);

                if (verticalGap > 0 && verticalGap < minVerticalGap) {
                    console.log(`Filtering platform at y=${current.y} - too close to platform at y=${below.y} (gap=${verticalGap}px < ${minVerticalGap}px)`);
                    tooClose = true;
                }
                break;
            }
        }

        if (!tooClose) {
            filtered.push(current);
        }
    }

    return filtered;
}

export function extractTopSurfacesFromGrid(grid, options) {
    const {
        getScaledBlockSize,
        platformMinWidth,
        platformMergeGapPx,
        platformThickness,
        playerSize,
        platformClass
    } = options;

    const { solid, brightness, cellsX, cellsY, gridSize, width } = grid;
    const segments = [];

    for (let cy = 0; cy < cellsY; cy++) {
        for (let cx = 0; cx < cellsX; cx++) {
            if (!solid[cy][cx]) continue;
            const aboveSolid = (cy > 0) ? solid[cy - 1][cx] : false;
            if (aboveSolid) continue;

            const x = cx * gridSize;
            const y = cy * gridSize;
            const w = Math.min(gridSize, width - x);
            if (w <= 0) continue;

            segments.push({
                x,
                y,
                width: w,
                brightness: brightness[cy][cx]
            });
        }
    }

    const merged = [];
    let current = null;

    for (const seg of segments) {
        if (!current) {
            current = { ...seg };
            continue;
        }

        const touchesSameRow = seg.y === current.y;
        const isAdjacent = seg.x <= (current.x + current.width + platformMergeGapPx);

        if (touchesSameRow && isAdjacent) {
            const end = Math.max(current.x + current.width, seg.x + seg.width);
            const totalWidth = end - current.x;
            const weightedBrightness = ((current.brightness * current.width) + (seg.brightness * seg.width)) / (current.width + seg.width);
            current.width = totalWidth;
            current.brightness = weightedBrightness;
        } else {
            merged.push(current);
            current = { ...seg };
        }
    }
    if (current) merged.push(current);

    const blockSize = getScaledBlockSize();
    const platformsOut = [];
    for (const m of merged) {
        if (m.width < platformMinWidth) continue;

        const blockCount = Math.ceil(m.width / blockSize);
        const alignedWidth = blockCount * blockSize;

        const platformHeight = blockSize;
        const color = platformColorFromBrightness(m.brightness);
        const mainPlatform = new platformClass(m.x, m.y, Math.min(alignedWidth, width - m.x), platformHeight, color, 'photo');
        platformsOut.push(mainPlatform);
    }

    return filterVerticallyClashingPlatforms(platformsOut, playerSize);
}
