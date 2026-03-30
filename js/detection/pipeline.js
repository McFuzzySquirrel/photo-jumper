export function combinePlatforms(options) {
    const {
        mlDetectionEnabled,
        mlOnlyMode,
        mlPlatforms,
        gridBasedPlatforms,
        overlapToleranceY
    } = options;

    if (mlDetectionEnabled && mlPlatforms.length > 0) {
        // If ML-only mode is enabled, return only ML platforms (no grid platforms)
        if (mlOnlyMode) {
            return [...mlPlatforms];
        }

        // Otherwise, merge ML and grid platforms (existing behavior)
        const combined = [...mlPlatforms];

        for (const gridPlatform of gridBasedPlatforms) {
            let shouldSkip = false;
            for (const mlPlatform of mlPlatforms) {
                const horizontalOverlap = !(gridPlatform.x + gridPlatform.width < mlPlatform.x ||
                    gridPlatform.x > mlPlatform.x + mlPlatform.width);

                if (horizontalOverlap) {
                    const gridBottom = gridPlatform.y + gridPlatform.height;
                    const mlBottom = mlPlatform.y + mlPlatform.height;

                    let verticalSeparation;
                    if (gridPlatform.y > mlPlatform.y) {
                        verticalSeparation = gridPlatform.y - mlBottom;
                    } else {
                        verticalSeparation = mlPlatform.y - gridBottom;
                    }

                    if (verticalSeparation < overlapToleranceY) {
                        shouldSkip = true;
                        break;
                    }
                }
            }
            if (!shouldSkip) {
                combined.push(gridPlatform);
            }
        }

        return combined;
    }

    return [...gridBasedPlatforms];
}
