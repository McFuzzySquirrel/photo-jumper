# Photo Jumper 🎮

A web-based platform jumping game that converts your photos into playable levels!

## Features

- 📸 **Photo Upload**: Upload a photo from your device or take one with your camera
- 🎨 **Dynamic Level Generation**: Photos are automatically converted into platforms based on brightness
- 🖼️ **Photo Background**: Your photo is displayed as the game background, making you feel like you're playing inside the picture
- 🎮 **Classic Platform Gameplay**: Jump and navigate through your photo-based levels
- 🕹️ **Multiple Control Options**:
  - Keyboard: Arrow Keys or WASD to move, Space/Up Arrow to jump
  - Touch: Touch controls for mobile devices
- 📊 **Score Tracking**: Track your score and time as you play
- 📱 **Responsive Design**: Works on desktop and mobile devices

## How to Play

1. Open `index.html` in your web browser
2. Click "Upload Photo" to select an image from your device, or "Take Photo" to use your camera
3. The photo will be converted into a platform level (darker areas become platforms)
4. Use the controls to navigate:
   - **Move**: Arrow Keys or WASD
   - **Jump**: Space or Up Arrow
   - **Mobile**: Touch controls
5. Try to navigate through the level without falling!
6. Click "New Photo" to load a different image

## Quick Start

Simply open `index.html` in any modern web browser. No installation or build process required!

Alternatively, you can serve it with a local web server:

```bash
# Python 3
python3 -m http.server 8080

# Python 2
python -m SimpleHTTPServer 8080

# Node.js (with http-server)
npx http-server -p 8080
```

Then navigate to `http://localhost:8080` in your browser.

## How It Works

The game uses HTML5 Canvas to:
1. Process uploaded images and analyze brightness levels
2. Generate platforms from darker areas of the image
3. Display the original photo as the game background
4. Render semi-transparent platforms with visible borders so you can see the photo beneath
5. Apply physics-based platform game mechanics with gravity and collision detection
6. Support both keyboard and touch input for cross-platform compatibility

## Browser Compatibility

Works in all modern browsers that support HTML5 Canvas and ES6 JavaScript:
- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

## License

MIT License - See [LICENSE](LICENSE) file for details
