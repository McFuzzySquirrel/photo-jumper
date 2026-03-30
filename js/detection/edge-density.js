export function detectEdgeDensityPlatforms(options) {
    const {
        grid,
        getScaledBlockSize,
        platformMinWidth,
        platformClass,
        cellThreshold
    } = options;

    if (!grid || !grid.edgeDensity) return [];

    // Placeholder for edge-density heat map sampling.
    // TODO: Use gradient/edge density to seed stepped platform bands.
    const { edgeDensity, cellsX, cellsY, gridSize, width } = grid;
    const blockSize = getScaledBlockSize();
    const platforms = [];

    const densityThreshold = cellThreshold ?? 0.2;

    for (let cy = 0; cy < cellsY; cy++) {
        let runStart = null;
        for (let cx = 0; cx <= cellsX; cx++) {
            const isDense = cx < cellsX ? edgeDensity[cy][cx] >= densityThreshold : false;
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
                        'rgba(150, 120, 180, 0.85)',
                        'fallback-edge-density'
                    );
                    platforms.push(platform);
                }

                runStart = null;
            }
        }
    }

    return platforms;
}
