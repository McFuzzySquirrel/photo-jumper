# Anti-Patterns

## Unicode Text Replacement
### What Happened
Attempted `replace_string_in_file` on a markdown file that contained Unicode curly quotes (U+201C `"`, U+201D `"`) and smart apostrophes (U+2019 `'`). The tool couldn't match the plain ASCII replacement string against the Unicode content.
### Why It Was Bad
Wasted multiple tool calls trying different escaping strategies before diagnosing the root cause.
### Future Avoidance Guidance
- Before replacing text in markdown files, check encoding with `cat -A` or `hexdump -C` for non-ASCII bytes
- If Unicode characters are present, delete the file and recreate with `create_file` using clean ASCII content
- Look for `e2 80 9c`, `e2 80 9d`, `e2 80 99` byte sequences in hexdump output as indicators

## Hardcoded Zoom Values
### What Happened
Initial plan used a fixed `0.5` zoom level, which would zoom out too far on some photos and not enough on others.
### Why It Was Bad
Photo dimensions vary wildly — a hardcoded zoom value can't adapt. Would have led to inconsistent player experience.
### Future Avoidance Guidance
- Always compute zoom from world/viewport ratio: `Math.min(zoomToFitWidth, zoomToFitHeight)`
- Use `camera.autoFitZoom` for resets, never hardcoded values
- Any value that depends on photo dimensions must be computed dynamically

## Forgetting Input Release Handlers
### What Happened
Jump-cut mechanic needs damping applied on *all* release handlers: keyboard keyup, touch button touchend, canvas touchend, AND touchcancel.
### Why It Was Bad
Missing any one handler means the mechanic silently fails for that input method — hard to detect in testing if you only test one input type.
### Future Avoidance Guidance
- When adding input-triggered mechanics, enumerate ALL input paths: keyboard, touch button, canvas touch, touchcancel
- Create a checklist of handlers before implementing
- Test on both keyboard and touch to verify all paths work

## Invisible Solid Objects in BFS
### What Happened
Wall blocks were created as `Platform` objects with `kind: 'photo'` — identical to regular platforms. The BFS reachability check iterated all platforms without filtering, treating wall blocks as traversable nodes. Meanwhile, the player collision loop also hit wall blocks, creating physical barriers the BFS couldn't see.
### Why It Was Bad
BFS would mark a path as "reachable" while a wall block physically blocked the jump trajectory. Players got stuck on platforms where every exit required an extra jump over a wall lip that the reachability system didn't account for.
### Future Avoidance Guidance
- Always give distinct `kind` values to different types of platform-like objects
- Filter non-traversable objects out of BFS/reachability checks
- Add solid obstacles AFTER BFS validation (post-BFS pipeline position)
- If an object collides with the player, verify the BFS accounts for it as an obstacle

## Camera Clamped to Origin Without Centering
### What Happened
Camera clamping used `Math.max(0, Math.min(camera.x, worldWidth - viewportWidth))`. When viewport exceeded world bounds, `worldWidth - viewportWidth` became negative, and `Math.max(0, negative) = 0` — pinning the photo to the top-left with blank space on the right/bottom.
### Why It Was Bad
Created a visible blank strip (sky-blue) on one side of the screen, making the game look broken at certain zoom levels or aspect ratios.
### Future Avoidance Guidance
- When `viewport > world`, compute centering offset: `-(viewport - world) / 2`
- Branch the clamping logic: center when exceeding, clamp when fitting
- Test at multiple zoom levels AND aspect ratios (landscape, portrait, square)