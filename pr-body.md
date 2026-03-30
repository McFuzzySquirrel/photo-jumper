## Summary

Implements ONNX Runtime Web integration for ML-based object detection in platform generation. Detects 51 object types including furniture, vehicles, electronics, **animals**, and **people** to create unique platformer levels.

## Key Features

- 🤖 **ONNX Runtime Web** - Browser-based ML using YOLOv8n
- 🐾 **51 Platformable Objects** - Including animals (cats, dogs, elephants, giraffes) and people
- 🌐 **CDN-First Architecture** - No large files in repo, works on any static host
- 🔧 **Service Worker Fixed** - Proper fallback handling
- 📚 **Complete Documentation** - ADR, guides, troubleshooting
- 🎮 **Optional Feature** - Disabled by default, no impact if not used

## What's Included

### Platformable Objects (51 types)

**Furniture (7):** bench, chair, couch, bed, dining table, desk, toilet  
**Electronics (9):** tv, laptop, keyboard, book, microwave, oven, toaster, sink, refrigerator  
**Vehicles (8):** car, bus, truck, boat, train, airplane, bicycle, motorcycle  
**Animals (10):** bird, cat, dog, horse, sheep, cow, elephant, bear, zebra, giraffe  
**People (1):** person (Mario-style head jumping!)  
**Sports (4):** skateboard, surfboard, snowboard, skis  
**Other (12):** suitcase, backpack, vase, potted plant, bowl, clock, teddy bear, remote, mouse, cell phone

### Technical Implementation

- **Runtime**: ONNX Runtime Web 1.17.0 (from CDN)
- **Model**: YOLOv8n (6 MB, from local or CDN)
- **Execution**: WASM backend (stable, compatible)
- **Performance**: 4-6s inference time
- **Deployment**: ~500 KB (ML loads from CDN)

### Files Changed

**Modified (4):**
- `index.html` - ONNX integration, ML detection logic, expanded platformable objects
- `sw.js` - Fixed caching strategy, CDN support, v2 cache
- `README.md` - Updated features, how to play, how it works
- `.gitignore` - Exclude large ML files

**New (10):**
- `docs/adr/0007-onnx-runtime-web-implementation-and-fixes.md` - Complete ADR
- `docs/ONNX_SETUP.md` - Setup guide
- `docs/ML_DETECTION_GUIDE.md` - User guide
- `docs/DEPLOYMENT.md` - Deployment guide
- `docs/PLATFORMABLE_OBJECTS_UPDATE.md` - Feature changelog
- `ONNX_FIX_SUMMARY.md` - Technical summary
- `SESSION_SUMMARY.md` - Session summary
- `TESTING_ONNX_FIX.md` - Testing instructions
- `clear-sw.html` - Service worker reset tool
- `test-onnx.html` - ONNX diagnostic tool

## How It Works

1. User enables "ML object detection" checkbox
2. ONNX Runtime loads from CDN (jsDelivr)
3. YOLOv8n model loads (local or CDN fallback)
4. Photo is processed through YOLO inference
5. Detected objects filtered by platformable types
6. Platforms generated from object boundaries
7. Combined with grid-based detection for hybrid approach

## Deployment

Works on **any static web host** (GitHub Pages, Netlify, Vercel, etc.):
- No backend required
- No build process
- CDN-first (no large files to commit)
- Service worker caches everything
- Works offline after first visit

## Testing

Try these photo types:
- 🐱 **Pet photos** - Cats and dogs as platforms
- 🐘 **Zoo photos** - Elephants, giraffes, zebras
- 👨‍👩‍👧 **Family photos** - Jump on people's heads
- 🚗 **Parking lot** - Cars and vehicles
- 🏠 **Living room** - Furniture and electronics
- 🛹 **Sports photos** - Skateboards, bicycles

Enable debug overlay to see detected objects (green boxes = platformable, orange = detected but not platformable).

## Documentation

- **ADR 0007**: Complete architectural decision record
- **ONNX_SETUP.md**: Setup and troubleshooting guide
- **ML_DETECTION_GUIDE.md**: User guide with examples
- **DEPLOYMENT.md**: Deployment instructions
- **TESTING_ONNX_FIX.md**: Testing instructions

## Breaking Changes

None - fully backward compatible. ML detection is optional and disabled by default.

## Related Issues

Implements the ONNX-based object detection planned in ADR 0005.

## Checklist

- [x] ONNX Runtime loads from CDN
- [x] Service worker doesn't block fallback
- [x] Model inference works correctly
- [x] Platformable objects generate platforms
- [x] Debug overlay controllable
- [x] Console provides helpful feedback
- [x] Works offline after first load
- [x] No impact when ML disabled
- [x] Documentation complete
- [x] README updated
- [x] ADR created (0007)
- [x] Deployment tested (CDN-only)
- [x] Animals and people included (51 object types)

## Screenshots

Enable ML detection and try a photo with pets, people, or zoo animals to see the difference!
