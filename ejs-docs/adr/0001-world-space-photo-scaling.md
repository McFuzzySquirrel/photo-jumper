---
ejs:
  type: journey-adr
  version: 1.1
  adr_id: 0001
  title: World-Space Photo Scaling with Viewport-Independent Rendering
  date: 2026-02-06
  status: accepted
  session_id: ejs-session-2026-02-06-001
  session_journey: ../journey/2026/ejs-session-2026-02-06-001.md

actors:
  humans:
    - id: McFuzzySquirrel
      role: Developer
  agents:
    - id: GitHub Copilot
      role: AI Coding Assistant

context:
  repo: McFuzzySquirrel/photo-jumper
  branch: copilot/improve-photo-scaling
---

# Session Journey

Link to the originating session artifact:
- Session Journey: [`ejs-docs/journey/2026/ejs-session-2026-02-06-001.md`](../journey/2026/ejs-session-2026-02-06-001.md)

# Context

Photo Jumper converts uploaded photos into playable platformer levels by detecting edges and brightness to create platforms. Previously, the game world was sized to match the canvas (which was constrained to 800x600 max), and in fullscreen mode the canvas was forced to fill the entire viewport (100vw x 100vh), causing photos to be squashed or distorted.

Users want to:
- Upload photos of any size/aspect ratio without distortion
- See their full photo when zoomed out
- Have camera follow the player smoothly
- Maintain proper aspect ratios with black borders if needed

Constraints:
- Browser-based game using HTML5 Canvas
- Single-file architecture (index.html)
- Must work on mobile and desktop
- Photos can be any aspect ratio (portrait, landscape, square)
- Performance must remain acceptable

---

# Session Intent

Fix photo squashing in fullscreen mode and implement proper scaling that:
1. Preserves photo aspect ratio
2. Allows viewing entire photo when zoomed out
3. Works like a scroller with camera follow
4. Uses black borders to maintain scale

# Collaboration Summary

The agent proposed separating world coordinates (based on photo dimensions) from viewport/canvas coordinates (based on screen size). This architectural change required:
- Adding worldWidth/worldHeight variables
- Updating processImage() to preserve original photo size
- Scaling platforms from process coordinates to world coordinates
- Updating camera bounds to use world size
- Calculating dynamic zoom limits
- Changing fullscreen CSS to preserve aspect ratio

One bug was encountered (undefined width/height in nested functions) which was quickly resolved by adding const aliases.

Testing with landscape and portrait test images confirmed the solution works correctly.

---

# Decision Trigger / Significance

This warrants an ADR because:
- **System boundary changed**: The coordinate system architecture fundamentally changed from canvas-sized world to photo-sized world with viewport adaptation
- **Long-lived consequences**: All future features must understand the world vs viewport coordinate distinction
- **Multiple alternatives considered**: Could have kept canvas-sized world, stretched photos, or used other scaling approaches
- **Hard to reverse**: Changing coordinate systems after adding more features would be difficult

---

# Considered Options

## Option A: Keep Canvas-Sized World (Status Quo)

Keep the world sized to match the canvas (800x600 max), constraining photos to this size.

**Pros:**
- Simple implementation
- No coordinate system complexity
- Existing code works

**Cons:**
- Photos lose detail (compressed to 800x600)
- Fullscreen mode squashes photos
- Can't preserve aspect ratios properly
- Poor UX for modern high-res photos

## Option B: Stretch Photo to Fill Viewport

Size canvas to viewport, stretch photo to fill it completely.

**Pros:**
- Uses full screen space
- No black borders

**Cons:**
- Distorts photos (wrong aspect ratio)
- Poor visual quality
- Breaks the "photo platformer" aesthetic
- User experience suffers

## Option C: World-Space Photo with Viewport Canvas (Selected)

Separate world coordinates (photo dimensions) from viewport coordinates (canvas dimensions). Canvas fills viewport, camera shows portion of world.

**Pros:**
- Photos maintain original aspect ratio
- No distortion or quality loss
- Can zoom out to see entire world
- Black borders preserve aspect ratio cleanly
- Scalable to any photo size
- Industry-standard game dev pattern

**Cons:**
- More complex coordinate system
- Need to track both world and viewport coordinates
- Requires dynamic zoom limit calculations
- Initial implementation effort

---

# Decision

**Adopt Option C: World-Space Photo with Viewport Canvas**

The game world (platforms, player, photo) exists in "world space" with dimensions matching the original photo. The canvas is sized to the viewport (screen), and the camera determines which portion of the world is visible.

Key components:
1. `worldWidth`, `worldHeight` - store original photo dimensions
2. Canvas sized to fill container/viewport
3. Platforms created in process coordinates, then scaled to world coordinates
4. Camera bounds use world size, not canvas size
5. Dynamic zoom limits ensure entire world visible when zoomed out
6. CSS uses max-width/max-height to preserve aspect ratio with black borders

---

# Rationale

This option was chosen because:

1. **Preserves Photo Integrity**: Original photos maintain aspect ratio and detail, which is central to the game's concept
2. **Industry Standard**: Separating world space from screen space is how most games handle resolution independence
3. **Scalability**: Works with any photo size or aspect ratio without code changes
4. **User Experience**: Black borders are acceptable and expected when preserving aspect ratios (e.g., watching movies on different screens)
5. **Future-Proof**: Makes it easy to add features like pan/zoom, minimap, split-screen, etc.

Rejected alternatives:
- **Option A** limits photo quality and doesn't solve fullscreen distortion
- **Option B** creates unacceptable visual distortion that breaks the game's aesthetic

---

# Consequences

### Positive
- ✅ Photos no longer squash or distort in fullscreen
- ✅ Can handle any photo aspect ratio (portrait, landscape, square)
- ✅ Camera system works smoothly with world coordinates
- ✅ Zoom out shows entire photo with all platforms
- ✅ Black borders provide clean, professional letterboxing/pillarboxing
- ✅ Higher photo detail preserved (increased processing to 1600x1200)
- ✅ Architecture aligns with game development best practices
- ✅ Easier to add features like minimap, multiple viewports, etc.

### Negative / Trade-offs
- ⚠️ More complex coordinate system requires understanding world vs viewport distinction
- ⚠️ Future developers must be aware of coordinate spaces when adding features
- ⚠️ Black borders use screen space (though this is standard and expected)
- ⚠️ Slightly more processing for very large photos (1600x1200 vs 800x600)
- ⚠️ Edge cases with extreme aspect ratios may need special handling
- ⚠️ Existing features touching coordinates needed updates (player boundaries, score calculation, debug overlay)

---

# Key Learnings

**Human learned:**
- World space vs screen space separation is fundamental for resolution independence
- Dynamic constraints (zoom limits) are more robust than hardcoded values
- Black borders (letterboxing) are the standard solution for aspect ratio mismatches
- Testing with varied inputs (portrait, landscape) catches edge cases early

**Agent learned:**
- User phrases like "like a scroller" effectively communicate camera follow behavior
- Variable scope issues can hide until runtime - need to check nested function access
- Screenshots are essential for verifying visual changes
- Separating coordinates early prevents painful refactoring later

---

# Agent Guidance

**For future agents working on photo-jumper:**

## Coordinate System Architecture
- World space: Based on original photo dimensions (`worldWidth`, `worldHeight`)
- Screen space: Based on viewport/canvas dimensions (`canvas.width`, `canvas.height`)
- Always use world coordinates for game objects (platforms, player, goal)
- Use screen coordinates only for rendering viewport

## Preferred Patterns
```javascript
// ✅ Good: Use world coordinates for game logic
if (player.x > worldWidth) { /* ... */ }

// ❌ Bad: Don't use canvas size for world boundaries
if (player.x > canvas.width) { /* ... */ }
```

## Camera System
- Camera position is in world coordinates
- Camera bounds use worldWidth/worldHeight
- Viewport size affects what portion of world is visible
- Zoom limits calculated dynamically based on world:viewport ratio

## Adding New Features
- Game objects: Position them in world space
- Rendering: Transform via camera (translate + scale)
- UI overlays: Use screen space (outside camera transform)
- Collisions: All in world space

## Anti-Patterns to Avoid
- Don't assume canvas size == world size
- Don't hardcode zoom limits without considering world dimensions
- Don't position game objects based on canvas dimensions
- Don't skip testing with varied aspect ratios

## Testing
- Always test with both portrait and landscape images
- Test extreme aspect ratios (very wide, very tall)
- Verify zoom limits allow seeing entire world
- Check black borders appear correctly

---

# Reuse Signals (Optional)

```yaml
reuse:
  patterns:
    - "world-viewport-separation"
    - "dynamic-zoom-limits"
    - "aspect-ratio-preservation"
    - "coordinate-system-scaling"
  
  prompts:
    - "check if world vs viewport coordinates are properly separated"
    - "verify zoom limits work for all aspect ratios"
    - "test with both landscape and portrait images"
  
  anti_patterns:
    - "conflating-world-and-screen-coordinates"
    - "hardcoded-aspect-ratio-assumptions"
    - "forced-viewport-sizing"
  
  future_considerations:
    - "Very extreme aspect ratios (>5:1) may need special zoom limit handling"
    - "Very large photos (>4K) may need performance optimizations"
    - "Mobile devices with small screens may benefit from different default zoom"
    - "Consider adding pinch-to-zoom for touch devices"
```
