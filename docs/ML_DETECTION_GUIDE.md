# ML Object Detection - Expected Behavior

## Why You Might Not See Different Platforms

The ML detection feature is **working correctly**, but it only creates platforms from specific objects. Here's what's happening:

### What ML Detection Does

1. **Scans your photo** for 80 different object types (COCO dataset)
2. **Filters for "platformable" objects** (furniture, vehicles, electronics)
3. **Creates platforms** from those objects only
4. **Falls back to grid-based detection** for everything else

### Platformable Objects

ML detection ONLY creates platforms from these objects:

**Furniture (7):**
- bench, chair, couch, bed, dining table, desk, toilet

**Electronics (9):**
- tv, laptop, keyboard, book, microwave, oven, toaster, sink, refrigerator

**Vehicles (8):**
- car, bus, truck, boat, train, airplane, bicycle, motorcycle

**Sports Equipment (4):**
- skateboard, surfboard, snowboard, skis

**Containers (3):**
- vase, potted plant, bowl

**Animals (10):**
- bird, cat, dog, horse, sheep, cow, elephant, bear, zebra, giraffe

**People (1):**
- person

**Other (9):**
- suitcase, backpack, clock, teddy bear, remote, mouse, cell phone

**Total: 51 platformable object types**

### Why You See the Same Platforms

If your test photo doesn't contain these objects, ML detection won't create any ML-specific platforms. The game will fall back to the **grid-based detection** (which works on all photos).

**Example scenarios:**

❌ **Photo of landscape** → 0 platformable objects → Same as grid-based
❌ **Photo of food only** → 0 platformable objects → Same as grid-based  
✅ **Photo of living room** → chairs, couch, tv → Different platforms!
✅ **Photo of office** → desk, laptop, chair → Different platforms!
✅ **Photo of parking lot** → cars, trucks, bus → Different platforms!
✅ **Photo with pets** → cats, dogs → Animal platforms!
✅ **Zoo photo** → elephants, giraffes → Exotic platforms!
✅ **Family photo** → people → Jump on heads!

## How to Test ML Detection

### Step 1: Enable Debug Overlay

1. Upload a photo
2. Check "Debug overlay" checkbox
3. Check "ML object detection" checkbox

### Step 2: Check Console

Open DevTools (F12) → Console tab. You'll see:

```
🤖 Running ML object detection...
ONNX inference completed in 2345ms
ML detection found 5 total objects
Detected objects: person (95.2%) ✗ not platformable, chair (87.3%) ✓ platformable, couch (82.1%) ✓ platformable
2 of those are platformable
```

### Step 3: Look for ML Objects in Debug Overlay

- **Green boxes** = Platformable objects (will create platforms)
- **Orange boxes** = Detected but not platformable (won't create platforms)

## When ML Makes a Difference

ML detection is most useful for photos containing:

### ✅ Good Test Photos:
- **Office/workspace** - desks, chairs, laptops, keyboards
- **Living room** - couches, chairs, TV stands
- **Kitchen** - refrigerator, oven, microwave, sink
- **Parking lot / street** - cars, trucks, buses
- **Airport / station** - trains, airplanes, benches
- **Pet photos** - cats, dogs (stand on animals!)
- **Zoo/wildlife** - elephants, giraffes, zebras, bears
- **Farm** - horses, cows, sheep
- **Family/group photos** - people (jump on heads!)
- **Sports/outdoor** - bicycles, motorcycles, skateboards, surfboards

### ❌ Poor Test Photos:
- **Pure nature scenes** - trees, grass, sky (no animals)
- **Abstract patterns** - no recognizable objects
- **Close-ups of food** - pizza, sandwiches (unless on a table/plate)
- **Empty rooms** - just walls and floors

## Technical Details

### Segmentation (Planned)

YOLOE-26n-seg is the target ML model. It will provide segmentation masks that
convert into stepped, block-aligned platforms. This is not wired to runtime yet,
but the pipeline is scaffolded and will replace the bounding-box-only approach
once the model outputs are confirmed.

### Why These Specific Objects?

These objects typically have **detectable boundaries** that can serve as platform surfaces:
- Furniture → sit/stand on top
- Cars → stand on roof
- Laptops → stand on top
- Animals → jump on their backs (video game logic!)
- People → Mario-style head jumping

Objects are detected based on what the YOLOv8 model can recognize in the COCO dataset (80 common objects).

### Confidence Threshold

- Default: 50% confidence required
- Lower threshold = more detections (but more false positives)
- Current setting is balanced for accuracy

### Platform Generation

For each platformable object:
1. Get bounding box (x, y, width, height)
2. Calculate top surface (y coordinate)
3. Create platform from top edge
4. Merge with nearby ML platforms
5. Combine with grid-based platforms (fill gaps)

## Debugging Tips

### If you see "No objects detected":
- Photo doesn't contain any of the 80 COCO classes
- Or objects are too small
- Or confidence too low

### If you see "X objects (none platformable)":
- ML detected things like people, trees, animals
- But none are furniture/vehicles/electronics
- Enable debug overlay to see what was detected (orange boxes)

### If you see "X objects → platforms":
- ML found platformable objects!
- Platforms created from those objects
- Should look different from grid-based detection
- Green boxes show detected objects

## Recommendation

**For best ML results, use photos of:**
1. **Your desk/workspace** - lots of electronics
2. **Your living room** - furniture galore  
3. **A parking lot** - cars make great platforms
4. **Your kitchen** - appliances everywhere
5. **Your pets** - cats and dogs as platforms
6. **Zoo/wildlife** - exotic animal platforms
7. **Family gatherings** - people platforms!

**Avoid:**
1. Pure landscapes (no animals/objects)
2. Abstract art
3. Food close-ups (unless on furniture)
4. Empty rooms

---

**TL;DR:** ML detection works, and now detects **51 object types** including furniture, vehicles, electronics, animals, and people! If your photo has cats, dogs, elephants, or people, you'll get animal/person platforms. Try a photo of your pets or a zoo visit to see the difference!
