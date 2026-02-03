# Deployment Guide - Photo Jumper

## Quick Answer: Yes, it works on any web host! ✅

Photo Jumper is designed to work on **any static web hosting** including:
- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages
- AWS S3 + CloudFront
- Firebase Hosting
- Any other static host

## How It Works

### 🌐 CDN-First Architecture

The app uses a **CDN-first** approach for ML dependencies:

1. **ONNX Runtime** → Loads from jsDelivr CDN
2. **WASM files** → Automatically loaded from CDN by ONNX Runtime
3. **YOLOv8n Model** → Loads from GitHub CDN

**No large files in your repo, no server required!**

## Deployment Options

### Option 1: CDN-Only (Recommended) ⭐

**What's included in deployment:**
```
photo-jumper/
├── index.html          # Main app (everything in one file)
├── manifest.json       # PWA manifest
├── sw.js              # Service worker
├── icons/             # App icons (small)
└── server.js          # Optional (only for local dev)
```

**What's NOT included (loads from CDN):**
- ONNX Runtime (~300 KB)
- WASM files (~2 MB)
- YOLOv8n model (~6 MB)

**Total deployment size:** ~500 KB (without ML files)

**Pros:**
- ✅ Small deployment
- ✅ Fast git operations
- ✅ Easy updates
- ✅ Reliable CDN delivery

**Cons:**
- ⚠️ Requires internet for ML feature (first time)
- ⚠️ Depends on CDN availability

**Steps:**
1. Push to GitHub
2. Enable GitHub Pages (Settings → Pages → Source: main branch)
3. Done! ML works automatically via CDN

### Option 2: Self-Hosted ML (Offline-Capable)

**What's included:**
```
photo-jumper/
├── index.html
├── manifest.json
├── sw.js
├── icons/
├── models/
│   └── yolov8n.onnx   # 6 MB model file
└── lib/
    ├── ort.min.js     # 300 KB runtime
    └── ort-wasm*.wasm # 2 MB WASM files
```

**Total deployment size:** ~9 MB

**Pros:**
- ✅ Works completely offline (after first visit)
- ✅ No CDN dependency
- ✅ Faster ML loading (no network)

**Cons:**
- ❌ Large repo size
- ❌ Slower git operations
- ❌ More to maintain

**Steps:**
1. Download ML files (see below)
2. Commit to repo
3. Deploy as normal

## GitHub Pages Deployment (CDN-Only)

### Step 1: Push Code
```bash
git add .
git commit -m "Deploy Photo Jumper"
git push origin main
```

### Step 2: Enable GitHub Pages
1. Go to repository Settings
2. Navigate to "Pages" section
3. Source: Deploy from branch `main`
4. Folder: `/` (root)
5. Save

### Step 3: Wait & Access
- GitHub builds your site (~1 minute)
- Access at: `https://yourusername.github.io/photo-jumper`

**ML Detection:**
- ✅ Works automatically
- Loads from CDN on first use
- Cached by service worker afterward

## Other Static Hosts

### Netlify

**Deploy from Git:**
1. Connect GitHub repo
2. Build command: (none needed)
3. Publish directory: `/`
4. Deploy!

**Deploy via Drag & Drop:**
1. Go to https://app.netlify.com/drop
2. Drag folder
3. Done!

### Vercel

```bash
npm install -g vercel
vercel
```

### Cloudflare Pages

1. Connect GitHub repo
2. Build command: (none)
3. Output directory: `/`
4. Deploy!

## Local Development

The app includes a Node.js server for local testing:

```bash
npm install
npm start
```

Opens at `http://localhost:8080`

**Why a server?**
- Service workers require HTTP/HTTPS (not `file://`)
- CORS restrictions on local files
- Camera access requires secure context

**In production:** Any static host works (no Node.js needed)

## ML Files Download (Optional)

If you want self-hosted ML:

### 1. Download ONNX Runtime
```bash
# Create lib folder
mkdir lib

# Download runtime and WASM files from:
# https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/

# Files needed:
# - ort.min.js
# - ort-wasm.wasm
# - ort-wasm-simd.wasm
# - ort-wasm-threaded.wasm (optional)
# - ort-wasm-simd-threaded.wasm (optional)
```

### 2. Download YOLOv8n Model
```bash
# Create models folder
mkdir models

# Download from:
# https://github.com/ultralytics/assets/releases

# Or use CDN link directly in browser:
# https://cdn.jsdelivr.net/gh/aspect-technology/yolov8-onnx@main/models/yolov8n.onnx

# Save as: models/yolov8n.onnx
```

### 3. Remove from .gitignore
Edit `.gitignore` and remove:
```
# ML Models (large files - use CDN instead)
models/*.onnx
lib/ort*.wasm
lib/ort*.js
```

### 4. Commit files
```bash
git add models/ lib/
git commit -m "Add self-hosted ML files"
git push
```

## Fallback Chain

The app tries multiple sources for each dependency:

### ONNX Runtime
1. CDN: `https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/ort.min.js` ⭐
2. Local: `lib/ort.min.js` (if exists)

### YOLOv8n Model
1. CDN: `https://cdn.jsdelivr.net/gh/aspect-technology/yolov8-onnx@main/models/yolov8n.onnx` ⭐
2. Local: `models/yolov8n.onnx` (if exists)

**Order changed from development:** CDN first ensures deployment works without large files.

## Troubleshooting

### ML doesn't work on deployed site

**Check:**
1. Open browser console (F12)
2. Look for ONNX loading messages
3. Check for CORS errors

**Common issues:**
- ❌ CORS blocked → Use HTTPS deployment
- ❌ Service worker stale → Clear cache (Ctrl+Shift+R)
- ❌ CDN down → Rare, try local files

### Service worker not updating

**Solution:**
```javascript
// Already handled in code:
const CACHE_NAME = 'photo-jumper-v2'; // Version bump forces update
```

Or manually:
1. DevTools (F12) → Application → Service Workers
2. Click "Unregister"
3. Reload page

### Large deployment size

**Recommended:**
- Use CDN-only approach (default)
- Don't commit `models/*.onnx` or `lib/` files
- Total deployment: ~500 KB

## Performance

### First Visit (No Cache)
- App loads: <1s
- ML enabled: +7-11s (CDN download + inference)
- **Total:** ~12s

### Return Visit (Cached)
- App loads: <1s
- ML enabled: +5-8s (cached runtime + inference)
- **Total:** ~6s

### Offline (After First Visit)
- App works: ✅ Yes
- ML works: ✅ Yes (if runtime/model cached)

## Best Practices

### For Production Deployment:
1. ✅ Use CDN-only (default setup)
2. ✅ Let service worker cache everything
3. ✅ Bump cache version on updates
4. ✅ Test with `npm start` locally first

### For Offline/Self-Hosted:
1. Download ML files
2. Commit to repo
3. Accept larger deployment size
4. Update regularly

## Example Deployment URLs

**GitHub Pages:**
```
https://yourusername.github.io/photo-jumper/
```

**Netlify:**
```
https://photo-jumper.netlify.app/
```

**Vercel:**
```
https://photo-jumper.vercel.app/
```

**Custom Domain:**
```
https://photojumper.com/
```

All work the same way! 🎉

## Summary

✅ **Works on any static web host**  
✅ **No backend/server required**  
✅ **CDN-first approach (default)**  
✅ **Small deployment (~500 KB)**  
✅ **ML loads automatically from CDN**  
✅ **Service worker caches everything**  
✅ **Works offline after first visit**  

**Recommendation:** Use CDN-only approach (current default). Deploy to GitHub Pages or any static host. ML works perfectly via CDN!
