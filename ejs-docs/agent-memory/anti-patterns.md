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