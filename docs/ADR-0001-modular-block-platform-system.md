# ADR-0001: Modular Block-Based Platform System with Enhanced Reachability

**Status:** Implemented  
**Date:** 2026-02-04  
**Participants:** User (Product Owner/Designer), GitHub Copilot (AI Assistant)  
**Decision Maker:** User  

## Context and Problem Statement

The Photo Jumper game was experiencing critical gameplay issues that violated the core design principle: "If a platform looks jumpable, it must be jumpable."

### Issues Identified by User:
1. **Object detection platforms were inaccessible** - Letters and platforms placed on detected objects sometimes couldn't be reached
2. **Platform placement too high/far** - Helper platforms weren't creating sufficient stepping stones
3. **Visual ambiguity** - Thin line platforms didn't clearly show where players could land
4. **Stacked platforms too close** - Double rows of platforms caused collision issues
5. **No recovery mechanism** - Players got stuck with no way to regenerate level

### Design Goals (User Requirements):
- 16-bit Mario-style platformer aesthetic with visible block structure
- Clear visual indication of collision boundaries
- All platforms must be reachable from start to goal
- Ability to regenerate level if stuck
- Slower player movement for better control
- Clean UI without overlapping elements

## Decision Drivers

### User-Driven Requirements:
- **Gameplay first**: Visual accuracy of photo interpretation is secondary to playability
- **Retro aesthetic**: Blocky, modular appearance like classic platformers
- **Clarity**: What you see is what you collide with
- **Player agency**: Give players control to fix bad level generations

### Technical Constraints:
- Must work with existing grid-based and ML object detection systems
- Performance must remain acceptable on low-end devices
- No breaking changes to core game loop

## Considered Options

### Option 1: Filled Block Platforms (Initially Attempted)
**Proposed by:** Copilot  
**User Feedback:** "that made it worse, now there are no clear paths as the big blocks and platforms clash"

- **Approach:** Fill entire detected object areas as solid blocks
- **Problem:** Created impassable walls, blocked navigation
- **Rejected:** Violated gameplay-first principle

### Option 2: Modular Block System (Implemented)
**Refined by:** User and Copilot through iteration  
**User Request:** "make the platforms a series of conjoined smaller square blocks, then the helper could be more flexible"

- **Approach:** Render platforms as connected 20px square blocks
- **Benefits:** Visual clarity, flexible helper placement, retro aesthetic
- **Outcome:** Accepted and implemented

### Option 3: Vertical Spacing and Wall Blocks
**User Identified Issue:** "sometimes the next level of blocks is too high or far for player to jump to"  
**Copilot Solution:** Added minimum vertical spacing and wall blocks at platform edges

- **Minimum 1-block gap** between vertically stacked platforms
- **Wall blocks** at platform ends for climbing assistance
- **Outcome:** Improved reachability significantly

## Decision Outcome

**Chosen option:** Modular Block System with Enhanced Helper Placement

### Implementation Details

#### 1. Block Size Standardization
**Actioned by:** Copilot  
**Approved by:** User

```javascript
const BLOCK_SIZE = 20;  // Matches GRID_SIZE
const PLATFORM_THICKNESS = BLOCK_SIZE;  // One block tall
```

#### 2. Platform Rendering System
**Designed by:** Copilot  
**Refined by:** User feedback

- Platforms drawn as series of 20px connected blocks
- Each block has individual outline and highlight
- Shadow effects for depth perception
- Goal platform has pulsing golden glow

#### 3. Helper Platform Improvements
**User Requirement:** "more flexible helper blocks"  
**Implemented by:** Copilot with multiple iterations

**Evolution of helper placement:**
- Initial: 0.8x/0.7x step multipliers, failed too often
- Iteration 1: 0.7x/0.6x steps, still gaps
- Iteration 2: 0.6x/0.5x steps, better but not enough
- **Final: 0.55x/0.45x steps** with multiple fallback strategies

**Helper width options:**
- Reduced from [80px, 60px, 40px] to [60px, 40px]
- Enables placement in tighter spaces

**Fallback strategies (in order):**
1. Try ideal position at target height
2. Try horizontal shifts (up to 10 blocks)
3. Try horizontal stepping at same height
4. Try descending path
5. **Try very close stepping stones (2 blocks away)**

#### 4. Vertical Clash Filtering
**User Issue:** "double rows with objects sometimes cause letter placement to be inaccessible"  
**Solution by:** Copilot

```javascript
function filterVerticallyClashingPlatforms(platforms) {
    const minVerticalGap = BLOCK_SIZE;  // At least 1 block spacing
    // Filter out platforms with insufficient vertical clearance
}
```

#### 5. Wall Block Generation
**User Request:** "we can be free to add a block at the ends of platforms to create a wall like effect"  
**Implemented by:** Copilot

- Adds single block vertical extensions at platform ends
- Only on platforms ≥3 blocks wide
- Creates natural climbing assists
- Helps reach higher platforms

#### 6. Player Speed Adjustment
**User Feedback Evolution:**
- "player movement is a little too slow now" (speed=3)
- **Final: speed=4** - "sweet spot between 3 and 5"

**Stuck Detection:**
- User: "we should set the rest time when the player stops to at least 15 seconds"
- Changed from 5s to 15s

#### 7. Goal Simplification
**User Direction:** "maybe instead of the door, just the yellow platform glows"  
**Implemented by:** Copilot

- Removed separate goal object (door/star)
- Goal platform itself glows with pulsing golden aura
- Collision detection uses platform, not separate object
- Letters excluded from goal platform to ensure collectability

#### 8. UI Improvements
**User Issue:** "the bar showing collected letters is still too wide, also...exit button...over the score"  
**Solutions by:** Copilot

- Letter bar: Dynamic width based on word length, left-aligned
- Exit button: Moved from top:10px to top:60px
- Changed text from "✕ Exit Game" to "← Exit"
- Smaller, cleaner styling

#### 9. Regenerate Feature
**User Request:** "is it also possible to add a regenerate platforms if they run into an issue"  
**Implemented by:** Copilot

- Press 'G' key to regenerate level from same photo
- Reprocesses image and creates new platform layout
- Gives players agency to fix bad generations
- Added to controls hint

### Positive Consequences

✅ **Gameplay Quality**
- Levels are consistently winnable
- Clear visual-collision alignment
- Gradual difficulty curves with smaller steps

✅ **Visual Clarity**
- Retro 16-bit aesthetic achieved
- Block boundaries clearly visible
- Glowing goal platform stands out

✅ **Player Control**
- Better movement control (speed=4)
- More time before stuck detection (15s)
- Regenerate option for recovery

✅ **Code Quality**
- Modular, maintainable helper placement
- Clear separation between rendering and collision
- Extensive fallback strategies ensure robustness

### Negative Consequences

⚠️ **Performance Considerations**
- More platforms generated (up to 30 helpers)
- Individual block rendering requires more draw calls
- Wall blocks add extra platform objects

**Mitigation:** Performance remains acceptable on target devices due to simple block rendering

⚠️ **Determinism**
- Level layout changes with regenerate
- Same photo produces different results each time

**Acceptable:** Gives replay value and recovery mechanism

### Technical Debt

- Helper placement uses iterative approach (could be path-finding algorithm)
- No validation that helpers actually create optimal path
- Wall block placement is heuristic-based

## Lessons Learned

### Collaboration Patterns

**User's Role:**
- Clear articulation of gameplay problems
- Quick feedback on what works/doesn't work
- Vision for aesthetic ("16-bit Mario style")
- Prioritization (gameplay > photo accuracy)

**Copilot's Role:**
- Rapid prototyping of solutions
- Technical implementation
- Suggesting improvements (wall blocks, vertical filtering)
- Multiple iterations until user satisfied

**Successful Pattern:**
1. User identifies problem
2. Copilot proposes solution
3. User tests and provides feedback
4. Copilot refines
5. Repeat until satisfactory

### Design Principles Validated

**"Gameplay feel, fairness, and player trust are more important than faithfully reproducing every detected line"**
- Proven correct: Filled blocks were visually accurate but unplayable
- Modular blocks sacrifice some realism for playability

**"If a platform looks jumpable, it must be jumpable"**
- Achieved through: Helper stairs, wall blocks, vertical spacing
- Regenerate provides escape hatch for edge cases

### Iteration Count

This feature required **8 commits** across multiple sessions:
1. Initial block-style platforms (rejected)
2. Fix for navigation (reverted to surfaces)
3. Modular block system implementation
4. Wall blocks and vertical filtering
5. Helper placement improvements (2 commits)
6. Goal simplification
7. UI fixes and regenerate feature
8. Debug logging for upload issue

## Links and References

- **Repository Custom Instructions:** Core design principles
- **Commits:** 
  - `330f56a` - Initial block style attempt
  - `e741ea5` - Fix navigation paths
  - `0b6c828` - Modular block system
  - `71c8819` - Zoom fixes and reachability
  - `ad68511` - Letter bar and background zoom
  - `3240f78` - Wall blocks and better helpers
  - `e6ed9b1` - Golden door (later simplified)
  - `ea0b058` - Glowing platform goal + regenerate
  - `5564034` - Debug logging

## Future Considerations

### Potential Enhancements
1. **Visual variety:** Different block textures per platform type
2. **Path finding:** Replace iterative helpers with A* algorithm
3. **Platform validation:** Verify reachability before finalization
4. **Difficulty scaling:** Adjust helper generation based on photo complexity

### User Feedback to Monitor
- Does regenerate get used frequently? (Indicates quality issues)
- Are wall blocks sufficient for climbing?
- Is 15s stuck timeout appropriate?
- Do players understand block visual language?

---

**Approved by:** User (implicit through acceptance and continued iteration)  
**Implemented by:** GitHub Copilot  
**Status:** Complete and merged to feature branch `feature/block-style-platforms`
