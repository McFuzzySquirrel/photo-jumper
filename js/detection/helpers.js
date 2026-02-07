export function addHelperPlatformsIfNeeded(options) {
    const {
        startPlatform,
        goalPlatform,
        allPlatforms,
        limits,
        maxHelpers,
        blockSize,
        width,
        height,
        wordBarAreaHeight,
        platformClass,
        overlapsAny,
        isReachable,
        canReachPlatform,
        debugHelperPlatforms
    } = options;

    if (isReachable(startPlatform, goalPlatform, allPlatforms, limits)) {
        return;
    }

    const helperColor = 'rgba(80, 120, 255, 0.9)';

    let current = startPlatform;
    let added = 0;
    let failedAttempts = 0;
    const maxFailedAttempts = 10;

    function isWithinBounds(candidate) {
        return candidate.x >= 0 &&
            candidate.x + candidate.width <= width &&
            candidate.y >= wordBarAreaHeight &&
            candidate.y + candidate.height <= height;
    }

    function addHelpers(candidates, target) {
        for (const helper of candidates) {
            if (added >= maxHelpers) return true;
            if (overlapsAny(helper, allPlatforms)) continue;
            if (!isWithinBounds(helper)) continue;
            if (!canReachPlatform(current, helper, limits, allPlatforms)) continue;
            if (target && !canReachPlatform(helper, target, limits, allPlatforms)) continue;
            allPlatforms.push(helper);
            debugHelperPlatforms.push(helper);
            current = helper;
            added++;
        }
        return candidates.length > 0;
    }

    function midpointHelper(from, to) {
        const fromCenter = from.x + from.width / 2;
        const toCenter = to.x + to.width / 2;
        const midX = (fromCenter + toCenter) / 2 - blockSize;
        const midY = (from.y + to.y) / 2;
        return [new platformClass(midX, midY, blockSize * 2, blockSize, helperColor, 'helper')];
    }

    function staircaseHelpers(from, to) {
        const fromCenter = from.x + from.width / 2;
        const toCenter = to.x + to.width / 2;
        const steps = 3;
        const helpers = [];
        for (let i = 1; i <= steps; i++) {
            const t = i / (steps + 1);
            const x = fromCenter + (toCenter - fromCenter) * t - blockSize;
            const y = from.y + (to.y - from.y) * t;
            helpers.push(new platformClass(x, y, blockSize * 2, blockSize, helperColor, 'helper'));
        }
        return helpers;
    }

    function landingShelfHelper(from, to) {
        const shelfWidth = blockSize * 3;
        const x = to.x + (from.x < to.x ? -shelfWidth : to.width);
        const y = to.y;
        return [new platformClass(x, y, shelfWidth, blockSize, helperColor, 'helper')];
    }

    function bridgeHelpers(from, to) {
        const fromRight = from.x + from.width;
        const toLeft = to.x;
        const gap = Math.max(0, toLeft - fromRight);
        if (gap <= blockSize) return [];
        const count = Math.min(5, Math.ceil(gap / (blockSize * 2)));
        const helpers = [];
        for (let i = 1; i <= count; i++) {
            const x = fromRight + i * (gap / (count + 1)) - blockSize;
            helpers.push(new platformClass(x, from.y, blockSize * 2, blockSize, helperColor, 'helper'));
        }
        return helpers;
    }

    function directConnector(from, to) {
        const left = Math.min(from.x, to.x);
        const right = Math.max(from.x + from.width, to.x + to.width);
        return [new platformClass(left, Math.min(from.y, to.y), right - left, blockSize, helperColor, 'helper')];
    }

    const strategies = [
        midpointHelper,
        staircaseHelpers,
        landingShelfHelper,
        bridgeHelpers,
        directConnector
    ];

    const goalCenterX = goalPlatform.x + goalPlatform.width / 2;
    const goalCenterY = goalPlatform.y;

    function scoreCandidate(platform) {
        const centerX = platform.x + platform.width / 2;
        const dx = Math.abs(goalCenterX - centerX);
        const dy = Math.abs(goalCenterY - platform.y);
        return dx + dy * 1.2;
    }

    while (added < maxHelpers && failedAttempts < maxFailedAttempts) {
        if (isReachable(startPlatform, goalPlatform, allPlatforms, limits)) {
            return;
        }

        const candidates = allPlatforms
            .filter(p => p.kind !== 'wall' && p.kind !== 'shadow')
            .filter(p => canReachPlatform(current, p, limits, allPlatforms))
            .sort((a, b) => scoreCandidate(a) - scoreCandidate(b));

        const target = candidates[0] || goalPlatform;

        let placed = false;
        for (const strategy of strategies) {
            const helpers = strategy(current, target);
            if (addHelpers(helpers, target)) {
                placed = true;
                break;
            }
        }

        if (!placed) {
            failedAttempts++;
        }
    }
}
