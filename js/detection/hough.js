export function detectHoughPlatforms(options) {
    const {
        grid,
        getScaledBlockSize,
        platformMinWidth,
        platformClass,
        rowThreshold,
        cellThreshold
    } = options;

    if (!grid || !grid.edgeDensity) return [];

    // Placeholder for Hough-based horizontal line detection.
    // TODO: Replace with true Hough transform on edge maps.
    const { edgeDensity, cellsX, cellsY, gridSize, width } = grid;
    const blockSize = getScaledBlockSize();
    const platforms = [];

    const rowCutoff = rowThreshold ?? 0.22;
    const cellCutoff = cellThreshold ?? 0.18;

    for (let cy = 0; cy < cellsY; cy++) {
        let rowSum = 0;
        for (let cx = 0; cx < cellsX; cx++) {
            rowSum += edgeDensity[cy][cx];
        }
        const rowAvg = rowSum / Math.max(1, cellsX);

        if (rowAvg < rowCutoff) continue;

        let runStart = null;
        for (let cx = 0; cx <= cellsX; cx++) {
            const isDense = cx < cellsX ? edgeDensity[cy][cx] >= cellCutoff : false;
            if (isDense && runStart === null) {
                runStart = cx;
            }
            if ((!isDense || cx === cellsX) && runStart !== null) {
                const runEnd = cx - 1;
                const runLength = runEnd - runStart + 1;
                const runWidth = runLength * gridSize;

                if (runWidth >= platformMinWidth) {
                    const x = runStart * gridSize;
                    const y = cy * gridSize;
                    const alignedWidth = Math.ceil(runWidth / blockSize) * blockSize;
                    const platform = new platformClass(
                        x,
                        y,
                        Math.min(alignedWidth, width - x),
                        blockSize,
                        'rgba(120, 140, 180, 0.85)',
                        'fallback-hough'
                    );
                    platforms.push(platform);
                }

                runStart = null;
            }
        }
    }

    return platforms;
}
