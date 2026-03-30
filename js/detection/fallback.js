export function evaluateMlPlatforms(options) {
    const { mlDetectionEnabled, mlPlatforms, minPlatforms } = options;

    const isEnabled = Boolean(mlDetectionEnabled);
    const platformCount = mlPlatforms.length;
    const mlSparse = isEnabled && platformCount < minPlatforms;
    const effectiveMlPlatforms = (isEnabled && platformCount >= minPlatforms)
        ? mlPlatforms
        : [];

    return { mlSparse, effectiveMlPlatforms };
}
