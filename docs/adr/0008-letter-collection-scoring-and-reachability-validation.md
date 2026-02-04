# ADR 0008: Letter Collection Scoring System and Reachability Validation

- Status: Accepted
- Date: 2026-02-04
- Related: ADR 0002 (gameplay-first principles)

## Context

The letter collection scoring system was introduced to add word-spelling gameplay mechanics to Photo Jumper. However, the initial implementation had critical issues that violated gameplay-first principles:

### Problems Identified

1. **Letters on unreachable platforms**: Letters were placed on platforms without validating reachability from the start position, leading to scenarios where players couldn't collect all letters to complete the word
2. **Unexpected auto-reset**: The stuck detection system (3-second timer with 5-pixel movement threshold) triggered during normal gameplay, causing frustrating auto-respawns when players were legitimately standing still (planning routes, waiting, collecting letters)
3. **Static goal position**: The goal always spawned in the top-right corner, making every playthrough feel repetitive

These issues directly violated the core gameplay promise: **"If a platform looks jumpable, it must be jumpable"** and **"If it's visible, it must be reachable."**

## Decision

We implemented comprehensive fixes that prioritize gameplay quality and player trust:

### 1. Multi-Hop Reachability Validation

**Decision**: Use graph-based pathfinding (`isReachable()`) instead of direct jump validation (`canReachPlatform()`) for letter placement.

**Rationale**: 
- Direct jump validation only checks if the player can jump directly from start to a platform
- Many platforms are reachable through intermediate jumps but would be excluded by direct validation
- Players can reach more platforms than direct validation suggests

**Implementation**:
```javascript
// Before: Only checked direct jumps
const suitablePlatforms = platforms.filter(p => {
    if (p.kind !== 'photo' && p.kind !== 'ml' && p.kind !== 'helper') return false;
    return canReachPlatform(startPlatform, p, limits); // ❌ Too restrictive
});

// After: Full graph traversal
const suitablePlatforms = platforms.filter(p => {
    if (p.kind !== 'photo' && p.kind !== 'ml' && p.kind !== 'helper') return false;
    return isReachable(startPlatform, p, platforms, limits); // ✅ Multi-hop paths
});
```

**Result**: Increased reachable platforms from 3 to 4+ on average test levels, allowing for longer words and better distribution.

### 2. Improved Stuck Detection

**Decision**: Increase detection interval and reset timer on player input.

**Changes**:
- Interval: 3 seconds → 5 seconds
- Added input-based reset: Any movement or jump key press immediately resets the stuck timer
- Clarified that this affects all stationary gameplay, not just letter collection

**Rationale**:
- 3 seconds is too short for players planning their route or analyzing the level
- Players actively pressing keys are not stuck, even if not moving
- False positives damage player trust and break immersion

**Implementation**:
```javascript
// Reset stuck timer on any player input
if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
    this.velocityX = -this.speed;
    this.lastPositionTime = Date.now(); // ✅ Reset on input
}
// ... similar for all movement and jump inputs
```

### 3. Goal Position Randomization

**Decision**: Randomly place goal on suitable platforms instead of always top-right.

**Algorithm**:
1. Filter platforms in upper 60% of level (not in start area)
2. Score by: `score = -platformY * 2 + distance_from_start`
3. Sort and randomly select from top 3 candidates
4. Fallback to top-right if no suitable platforms exist

**Rationale**:
- Adds variety to each playthrough
- Maintains gameplay quality (high, reachable positions)
- Configurable via `MAX_GOAL_CANDIDATES` constant

### 4. Code Architecture Improvements

**Decision**: Move reachability functions to global scope.

**Functions moved**:
- `canReachPlatform(from, to, limits)`
- `isReachable(startPlatform, goalPlatform, platforms, limits)`
- `getJumpLimits()`
- `intervalGap(a1, a2, b1, b2)`
- `overlapsAny(candidate, platforms)`

**Rationale**:
- These are core gameplay validation functions needed throughout the codebase
- Previously buried inside `processImage()` function, making them inaccessible
- Enables proper validation in letter placement and other future features

## Consequences

### Positive

✅ **Gameplay Quality**: All visible letters are now guaranteed to be reachable
✅ **Player Trust**: No more false stuck detection triggers during normal play
✅ **Replayability**: Goal position varies each playthrough
✅ **Code Quality**: Reusable validation functions in global scope
✅ **Testability**: Easier to validate reachability in future features

### Neutral

⚙️ **Performance**: Multi-hop pathfinding uses BFS (breadth-first search) but impact is negligible for typical platform counts (10-30 platforms)
⚙️ **Complexity**: Slightly more complex letter placement logic, but well-documented

### Trade-offs Considered

**Alternative 1**: Keep direct jump validation
- ❌ Rejected: Too restrictive, excludes many reachable platforms
- Result: Fewer platforms eligible for letters, shorter words, poorer distribution

**Alternative 2**: Place letters randomly without validation
- ❌ Rejected: Violates gameplay-first principle
- Result: Unreachable letters, broken gameplay promise

**Alternative 3**: Disable stuck detection entirely
- ❌ Rejected: Needed for actual stuck scenarios (player genuinely trapped)
- Result: Players stuck in geometry bugs with no auto-rescue

## Implementation Evidence

### Testing Results

**Test 1 (Direct jump validation):**
```
Console: "Placed 3 letters to spell: FUN on reachable platforms"
```

**Test 2 (Multi-hop validation):**
```
Console: "Placed 4 letters to spell: STAR on reachable platforms"
```

The improvement from 3 to 4 letters demonstrates multi-hop pathfinding finding more reachable platforms.

### Code Review Findings

All code review comments were addressed:
- ✅ Extracted magic numbers as named constants (`MAX_GOAL_CANDIDATES`)
- ✅ Improved comments for readability
- ✅ Optimized distance calculations (computed once per platform)
- ✅ Used proper multi-hop validation instead of single-hop

### Screenshots

**Before (3 letters with direct validation):**
See: `screenshots/letter-collection-3-letters.png`

**After (4 letters with multi-hop validation):**
See: `screenshots/letter-collection-4-letters.png`

Shows:
- Letters F, U, N / S, T, A, R on reachable platforms
- Goal position randomized (not always top-right)
- Progress indicator showing collection status
- All platforms reachable from green start platform

## Related Decisions

- **ADR 0002**: Gameplay-first platform generation - established the principle that gameplay quality trumps image accuracy
- **ADR 0003**: Platform detection improvements - established reachability requirements for helper platforms

## Future Considerations

1. **Dynamic difficulty**: Could adjust word length based on number of reachable platforms
2. **Letter placement strategy**: Could optimize placement to encourage exploration of the entire level
3. **Scoring refinement**: Could add time-based bonuses or penalties for letter collection speed
4. **Visual feedback**: Could add trails or hints showing reachable platforms to help players

## Notes

This ADR demonstrates the practical application of gameplay-first principles established in ADR 0002. When photo-generated platforms created unreachable scenarios, we prioritized player experience by adding proper validation rather than accepting broken gameplay.

The multi-hop reachability validation is now a reusable pattern that can be applied to future collectibles, power-ups, or other gameplay elements that need placement validation.
