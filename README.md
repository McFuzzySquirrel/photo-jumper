 Exploring Ideas Through Code: One Experiment at a Time

## About These Projects

All of my projects exist for one main reason: **learning through experimentation**.  
Each repository is a result of me asking questions like:  
> “Is this possible?”  
> “I wonder if…?”  

Sometimes they’re attempts to solve real problems I’ve come across, other times they’re just me following curiosity down a rabbit hole.  
This is my **learning playground**, a space where I test ideas, try new things, and learn by doing.  

I share them here in case they help or inspire someone else.  
So expect some projects to be **messy**, others **well-structured**, all of them are honest reflections of learning in progress.  

Feel free to **use**, **modify**, or **build on** anything here. 

So here we go:


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

Note: the in-game feedback form requires running the local server (below). If you open the file directly (`file://`), gameplay works but feedback submission will not.

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

## LAN Server + Feedback (Offline)

If you want other people on your WiFi/LAN (mobile/tablet/computer) to access the game over HTTP *and* send feedback, run the included local server (requires Node.js + npm).

```bash
cd photo-jumper
npm install
npm start
```

By default it listens on `0.0.0.0:8080` so other devices can reach it.

1. Find your LAN IP (for example `192.168.x.x` or `10.x.x.x`)
2. On another device on the same network, open:
  - `http://<your-lan-ip>:8080/`

Tip (Linux): you can often get your LAN IP with:

```bash
hostname -I | awk '{print $1}'
```

Feedback is text-only and stored locally (daily rotated) in `feedback/YYYY-MM-DD.jsonl`.

## Triage Feedback → GitHub Issues (Interactive)

To turn selected feedback entries into GitHub issues (one-by-one, step-through), use the included interactive triage script.

Prereqs:
- GitHub CLI installed (`gh`)
- Authenticated (`gh auth login`)
- Run from inside this repo so it can auto-detect the target repo from the git remote

Run:

```bash
npm run feedback:issues
```

Notes:
- The script **auto-creates missing labels** (minimal set: `feedback`, `needs-triage`, and `device: ...`).
- For privacy, issues **never include IP or User-Agent**, even though the local logs contain them.
- Each created issue includes a hidden dedupe marker like `<!-- pj-feedback-id: ... -->` so reruns can detect duplicates.

Common overrides:

```bash
# Use a specific feedback file
npm run feedback:issues -- feedback/2026-01-25.jsonl

# Use a specific repo (override git remote detection)
npm run feedback:issues -- --repo McFuzzySquirrel/photo-jumper

# Preview only (no labels/issues created)
npm run feedback:issues -- --dry-run
```

In the game UI:
- Use the **Feedback** button to send feedback (message + device type).
- Use the **Share link** panel to copy the current URL. If it shows `localhost`, replace it with your LAN IP when sharing to other devices.

### Optional access code

If you want to require an access code to submit feedback:

```bash
FEEDBACK_TOKEN=your-code-here npm start
```

When the token is enabled, the web UI will prompt for the access code the first time someone submits feedback (it will be remembered on that device).

### Configuration

Environment variables (optional):
- `PORT` (default: `8080`)
- `HOST` (default: `0.0.0.0`)
- `FEEDBACK_TOKEN` (default: empty)

### Firewall note

If other devices can't connect, you may need to allow the port in your firewall (example for UFW):

```bash
sudo ufw allow 8080/tcp
```

## Architecture Decisions

Architecture Decision Records are tracked in [docs/adr/README.md](docs/adr/README.md).

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
