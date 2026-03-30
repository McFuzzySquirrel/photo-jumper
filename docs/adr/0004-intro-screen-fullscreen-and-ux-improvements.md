# ADR 0004: Intro screen, fullscreen mode, and UX improvements

- Status: Accepted
- Date: 2026-01-29

## Context

We received user feedback highlighting several UX issues:

- No introduction or welcome screen - players are immediately shown upload buttons without context
- No fullscreen mode - game feels cramped in the small container
- Unclear navigation - no obvious way to start over or return to upload after playing
- Confusing scoring system - height-based score doesn't make intuitive sense
- Platforms sometimes hard to see - insufficient visual distinction from photo backgrounds

This conflicts with our goal of creating an engaging, polished game experience with clear navigation and visual feedback.

Constraints:
- Keep the project low-friction (single-file `index.html`, no build pipeline)
- Maintain gameplay quality as highest priority
- Keep jump physics and platform generation unchanged
- Ensure mobile compatibility and performance

## Decision

We will implement five targeted UX improvements:

### 1. **Add Introduction/Welcome Screen**
- Create a dedicated intro screen shown on initial load
- Display game title, tagline, and three key features:
  - 📸 Upload or Capture
  - 🎯 Reach the Goal
  - ⚡ Fast & Fun
- Single "Get Started" button to transition to upload screen
- Hide intro screen when game screen is active

### 2. **Implement Fullscreen Mode**
- Enter fullscreen automatically when game starts (photo uploaded and game begins)
- Use CSS to expand container to viewport: `position: fixed; inset: 0`
- Exit fullscreen when returning to intro screen
- Add visual indicator: "✕ Exit Game" button in top-right corner
- Maintain scrollability for mobile devices with small screens

### 3. **Improve Navigation Flow**
- Intro Screen → Game Screen → Fullscreen Gameplay → Back to Intro
- Update "Reset" button to "New Photo" for clarity
- Make "New Photo" button return to intro screen (not just reset game state)
- Add ESC key handler to exit game and return to intro
- Display exit instruction in win message

### 4. **Enhance Scoring System**
- Change from simple height-based scoring to progress + time efficiency
- New formula: `Score = (height progress × 2) - (time penalty)`
- Time penalty = elapsed seconds ÷ 2
- Rewards fast completion while still tracking vertical progress
- More intuitive and engaging than pure height-based scoring

### 5. **Improve Platform Visibility**
- Add drop shadows to platforms (4px blur, 2px offset)
- Increase outline thickness from 2px to 3px
- Add white highlight on top edge for 3D depth effect
- Shadow and outline make platforms stand out against any photo background
- Maintains exact collision geometry alignment with visuals

## Implementation Details

### Screen Management
```javascript
function showIntroScreen() {
    introScreen.classList.remove('hidden');
    gameScreen.classList.remove('active');
    exitFullscreen();
}

function showGameScreen() {
    introScreen.classList.add('hidden');
    gameScreen.classList.add('active');
}
```

### Fullscreen CSS
```css
.container.fullscreen {
    position: fixed;
    inset: 0;
    max-width: 100%;
    width: 100%;
    height: 100vh;
    border-radius: 0;
    overflow: auto;
}
```

### Enhanced Platform Drawing
```javascript
draw() {
    // Shadow for depth
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    // Fill platform
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
    
    // Thick outline
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeRect(this.x, this.y, this.width, this.height);
    
    // Top highlight for 3D effect
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y + 1);
    ctx.lineTo(this.x + this.width, this.y + 1);
    ctx.stroke();
}
```

## Consequences

### Positive

- **Better first impression**: Intro screen clearly communicates what the game is about
- **More immersive gameplay**: Fullscreen mode makes the game feel more polished and focused
- **Clear navigation**: Players always know how to start over or return to upload
- **More engaging scoring**: Time-based component adds competitive element
- **Better visibility**: Platforms are clearly distinguishable from photo backgrounds
- **Maintains simplicity**: All changes in single HTML file, no build complexity
- **Mobile friendly**: Fullscreen works on mobile, ESC key doesn't interfere with touch

### Neutral

- **Score values changed**: Existing scores not comparable to new scoring system
- **Additional DOM elements**: Intro screen adds minimal HTML/CSS overhead
- **Canvas rendering cost**: Platform shadows add minimal draw time (negligible on modern devices)

### Negative

- **None identified**: Changes are purely additive and improve UX without breaking existing functionality

## Alternatives Considered

### 1. Use browser's native fullscreen API
- **Rejected**: Requires user gesture, less reliable across browsers, can't style exit button
- **Chosen approach**: CSS-based fullscreen is more reliable and customizable

### 2. Keep simple height-based scoring
- **Rejected**: User feedback indicated confusion about scoring purpose
- **Chosen approach**: Time component makes scoring more intuitive and competitive

### 3. Use separate intro.html page
- **Rejected**: Adds complexity, requires navigation, breaks single-file principle
- **Chosen approach**: Single-file with conditional display maintains simplicity

## Related Decisions

- Builds on ADR 0003's mobile controls by adding exit button for touch users
- Maintains ADR 0002's gameplay-first platform constraints
- Scoring change doesn't affect platform generation or jump physics

## References

- Feedback received: 2026-01-29T17:56:12.707Z
- Issue: Gameplay improvement ideas
- User requests: fullscreen mode, intro screen, better scoring, clearer platforms
