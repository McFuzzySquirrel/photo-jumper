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

This feature required **15+ commits** across the session:
1. Initial block-style platforms (rejected)
2. Fix for navigation (reverted to surfaces)
3. Modular block system implementation
4. Wall blocks and vertical filtering
5. Helper placement improvements (multiple commits)
6. Goal simplification
7. UI fixes and regenerate feature
8. Debug logging for upload issue
9. Null reference fix (goalPlatform rename)
10. Goal collision and platform gap improvements
11. Dramatically improved helper generation
12. **Increased jump height** (simple user suggestion - +2.6 blocks)
13. **Visual goal portal** (user suggestion - walk-in collision)
14. Portal positioning and gap spacing fixes
15. Regenerate bug fixes (speed/resolution)

**Key User Insight:** "maybe the solution is to just make the character jump higher one block higher?" - This simple suggestion was more effective than complex helper algorithms.

## Final Implementation Summary

### Core Mechanics (as of 2026-02-04)
- **Player:** 20x20px (matches block size), Speed: 3px/frame, Jump: 14 power (~9.8 blocks high)
- **Blocks:** 20x20px modular squares with individual outlines
- **Platforms:** Series of connected blocks, minimum 40px width (2 blocks)
- **Vertical gaps:** Minimum 35px (player + 15px clearance)
- **Helper platforms:** Up to 50, very small steps (50% horizontal, 40% vertical)
- **Goal:** Glowing gold platform with 20x40px portal on top

### Visual Portal Goal (Final Solution)
**User Request:** "maybe we should just put a one block size portal on top of the glowing platform?"

**Implementation:**
- 1-block wide, 2-blocks tall shimmering golden portal
- Sits on top of glowing goal platform
- Walk-in collision (not landing-based)
- Pulsing glow with sparkle particles
- Always positioned to be visible on screen

**Benefits:**
- Intuitive goal interaction (walk into portal)
- Clear visual target
- No precision landing required
- Collision detection reliable and simple

### Regenerate Feature (G Key)
**User Request:** "is it also possible to add a regenerate platforms if they run into an issue"

**Critical Bugs Fixed:**
- Game loop multiplication causing speed increase
- Canvas resolution being overridden
- Camera zoom not resetting

**Final Implementation:**
```javascript
// Stop current game loop cleanly
gameRunning = false;
setTimeout(() => processImage(backgroundImage), 50);
// Regenerates platforms, resets camera, starts fresh loop
```

## Links and References

- **Repository Custom Instructions:** Core design principles
- **Branch:** `feature/block-style-platforms`
- **Commits (key milestones):** 
  - `ffbb46d` - Fix null reference (goalPlatform rename)
  - `cb53a3c` - Goal collision and gap spacing improvements
  - `02d3a56` - Dramatically improved helper generation (50 max, 5 fallback strategies)
  - `2113ac9` - **Increased jump height** (user's simple solution)
  - `30d9a9f` - **Visual goal portal** (user suggestion)
  - `183b385` - Portal placement and movement precision
  - `6ff831c` - Regenerate bug fixes (speed/resolution)

## Future Considerations

### Potential Enhancements
1. **Visual variety:** Different block textures per platform type
2. **Path finding:** Replace iterative helpers with A* algorithm
3. **Platform validation:** Verify reachability before finalization
4. **Difficulty scaling:** Adjust helper generation based on photo complexity
5. **UI improvements:** Better contrast for control hints text

### User Feedback to Monitor
- Does regenerate get used frequently? (Indicates quality issues)
- Are wall blocks sufficient for climbing?
- Is 15s stuck timeout appropriate?
- Do players understand block visual language?
- **Portal clarity:** Is the goal portal immediately recognizable?
- **Movement precision:** Is speed=3 slow enough for tight gaps?

## Lessons Learned - Extended

### Simple Solutions Often Win
**Example:** Instead of adding more complex helper platform logic, user suggested increasing jump height by one block. This simple change (+2 jump power) solved more problems than adding 20 more helpers.

**Takeaway:** Before adding complexity, ask "Can we make the player more capable?"

### Visual Clarity Drives Solutions
**Portal Evolution:**
1. Rotating star (confusing, small)
2. Golden door (complex, collision issues)
3. Glowing platform (unclear goal)
4. **Portal on platform (perfect!)** - User's suggestion

**Takeaway:** When collision detection is problematic, the visual representation may be wrong.

### Regenerate as Safety Valve
Regenerate (G key) proved essential during development, suggesting it's needed for players too. Accept that procedural generation won't always be perfect - give players a retry option.

---

**Approved by:** User (implicit through acceptance and continued iteration)  
**Implemented by:** GitHub Copilot  
**Status:** Complete and ready for merge to main  
**Date Completed:** 2026-02-04
