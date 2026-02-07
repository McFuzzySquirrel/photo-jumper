export function generateSkeletonPlatforms(options) {
    const {
        width,
        height,
        getScaledBlockSize,
        platformClass,
        startAreaWidth,
        startAreaHeight,
        goalAreaWidth,
        goalAreaHeight,
        wordBarAreaHeight,
        jumpLimits
    } = options;

    // Placeholder for feature-guided procedural skeleton path.
    // TODO: Build a guaranteed traversable stepping-stone path.
    const blockSize = getScaledBlockSize();
    const platforms = [];

    const minWidth = blockSize * 2;
    const maxWidth = blockSize * 3;
    const safeDx = Math.max(blockSize * 3, Math.floor((jumpLimits?.maxJumpDx || blockSize * 6) * 0.6));
    const safeDy = Math.max(blockSize, Math.floor((jumpLimits?.maxJumpUp || blockSize * 4) * 0.5));
    const step = Math.max(blockSize * 3, Math.min(safeDx, blockSize * 6));

    let index = 0;
    let currentY = Math.max(wordBarAreaHeight + blockSize * 2, height * 0.55);
    const minY = wordBarAreaHeight + blockSize * 2;
    const maxY = height - startAreaHeight - blockSize * 3;

    for (let x = blockSize * 2; x < width - blockSize * 2; x += step) {
        const w = (index % 2 === 0) ? minWidth : maxWidth;
        const deltaY = (index % 4 < 2) ? -safeDy : safeDy;
        currentY = Math.min(maxY, Math.max(minY, currentY + deltaY));

        const isStartArea = (x < startAreaWidth && currentY > height - startAreaHeight);
        const isGoalArea = (x > width - goalAreaWidth && currentY < goalAreaHeight);
        const isWordBarArea = (currentY < wordBarAreaHeight);

        if (!isStartArea && !isGoalArea && !isWordBarArea) {
            platforms.push(new platformClass(
                x,
                currentY,
                w,
                blockSize,
                'rgba(90, 120, 200, 0.9)',
                'fallback-skeleton'
            ));
        }
        index += 1;
    }

    return platforms;
}
