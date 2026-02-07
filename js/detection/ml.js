export const ML_DETECTION_ENABLED_DEFAULT = false;
export const ML_CONFIDENCE_THRESHOLD = 0.3;
export const ML_INPUT_SIZE = 640;
export const ML_INFERENCE_TIMEOUT_MS = 5000;
export const ML_MIN_DETECTION_SIZE = 10;
export const ML_MIN_PLATFORM_COUNT = 2;
export const ML_PLATFORM_MERGE_TOLERANCE = 20;
export const ML_PLATFORM_OVERLAP_TOLERANCE_Y = 30;

// YOLOE-26n-seg is the target model (ADR guidance). Keep unset until assets are ready.
// When available, swap ML_MODEL_URLS to YOLOE and update output parsing for segmentation masks.
export const YOLOE_MODEL_URL = null;

// Model URLs: Try CDN first for deployments, local as fallback
export const ML_MODEL_URLS = [
    'https://cdn.jsdelivr.net/gh/aspect-technology/yolov8-onnx@main/models/yolov8n.onnx',
    'models/yolov8n.onnx'
];
// ONNX Runtime URLs: CDN first for deployments, local fallback
export const ONNX_RUNTIME_URLS = [
    'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/ort.min.js',
    'lib/ort.min.js'
];

export const PLATFORMABLE_CLASSES = [
    'bench', 'chair', 'couch', 'bed', 'dining table', 'desk', 'toilet',
    'tv', 'laptop', 'keyboard', 'book', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator',
    'car', 'bus', 'truck', 'boat', 'train', 'airplane', 'bicycle', 'motorcycle',
    'suitcase', 'backpack', 'skateboard', 'surfboard',
    'snowboard', 'skis',
    'vase', 'potted plant', 'bowl',
    'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe',
    'person',
    'clock', 'teddy bear', 'remote', 'mouse', 'cell phone'
];

export const COCO_CLASSES = [
    'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
    'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
    'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
    'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
    'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
    'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
    'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake',
    'chair', 'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop',
    'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
    'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
];

let onnxSession = null;
let onnxModelLoading = false;
let onnxModelLoaded = false;
let onnxLoadError = null;
let onnxModelSupportsSegmentation = false;

export function isModelLoaded() {
    return Boolean(onnxModelLoaded && onnxSession);
}

export function modelSupportsSegmentation() {
    return onnxModelSupportsSegmentation;
}

export function isModelLoading() {
    return onnxModelLoading;
}

export function getOnnxLoadError() {
    return onnxLoadError;
}

export function resetOnnxLoadError() {
    onnxLoadError = null;
}

// Lazy-load ONNX Runtime with fallback URLs
async function loadONNXRuntime(onStatus) {
    if (typeof ort !== 'undefined') {
        if (!ort.env.wasm.wasmPaths) {
            ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/';
        }
        return true;
    }

    for (const runtimeUrl of ONNX_RUNTIME_URLS) {
        try {
            console.log('Attempting to load ONNX Runtime from:', runtimeUrl);
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = runtimeUrl;
                script.onload = () => resolve(true);
                script.onerror = () => reject(new Error(`Failed to load from ${runtimeUrl}`));
                document.head.appendChild(script);
            });

            await new Promise(resolve => setTimeout(resolve, 100));

            if (typeof ort !== 'undefined') {
                console.log('ONNX Runtime loaded successfully from:', runtimeUrl);

                if (runtimeUrl.includes('://')) {
                    const cdnBase = runtimeUrl.substring(0, runtimeUrl.lastIndexOf('/') + 1);
                    ort.env.wasm.wasmPaths = cdnBase;
                    console.log('ONNX WASM path set to CDN:', ort.env.wasm.wasmPaths);
                } else {
                    ort.env.wasm.wasmPaths = 'lib/';
                    console.log('ONNX WASM path set to local:', ort.env.wasm.wasmPaths);
                }

                ort.env.wasm.numThreads = 1;

                return true;
            }
        } catch (err) {
            console.error('Failed to load ONNX Runtime from:', runtimeUrl);
            console.error('Error details:', err);
        }
    }

    throw new Error('Failed to load ONNX Runtime from all sources');
}

export async function initONNXModel({ onStatus }) {
    if (onnxSession) return true;
    if (onnxModelLoading) return false;
    if (onnxLoadError) return false;

    onnxModelLoading = true;
    if (onStatus) onStatus('Loading runtime...');

    try {
        await loadONNXRuntime(onStatus);
        if (onStatus) onStatus('Loading model...');

        let lastError = null;
        for (const modelUrl of ML_MODEL_URLS) {
            try {
                if (onStatus) onStatus(`Trying ${modelUrl.includes('://') ? 'CDN' : 'local'} model...`);
                console.log('Attempting to load model from:', modelUrl);

                onnxSession = await ort.InferenceSession.create(modelUrl, {
                    executionProviders: ['wasm'],
                    graphOptimizationLevel: 'all'
                });

                onnxModelSupportsSegmentation = modelUrl.includes('seg');

                onnxModelLoaded = true;
                onnxModelLoading = false;
                if (onStatus) onStatus('ML ready');
                console.log('ONNX model loaded successfully from:', modelUrl);
                return true;
            } catch (urlError) {
                console.error(`Failed to load model from ${modelUrl}:`, urlError);
                console.error('Error stack:', urlError.stack);
                lastError = urlError;
            }
        }

        throw lastError || new Error('All model URLs failed');
    } catch (err) {
        onnxLoadError = err;
        onnxModelLoading = false;
        onnxModelLoaded = false;
        if (onStatus) onStatus('ML failed - see console');
        console.error('Failed to load ML detection:', err);
        console.info('=== ML Detection Troubleshooting ===');
        console.info('The app is running via HTTPS/web server (good!)');
        console.info('ML assets are loading from CDN (no downloads needed).');
        console.info('');
        console.info('Possible issues:');
        console.info('1. CDN temporarily unavailable - try refreshing');
        console.info('2. Network/firewall blocking CDN - check connection');
        console.info('3. Browser compatibility - try Chrome/Edge');
        console.info('');
        console.info('CDN URLs tried:');
        console.info('- Runtime: https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/');
        console.info('- Model: https://cdn.jsdelivr.net/gh/aspect-technology/yolov8-onnx@main/');
        console.info('');
        console.info('See docs/ONNX_SETUP.md for full troubleshooting guide.');
        return false;
    }
}

function preprocessImageForYOLO({ previewCanvas, width, height }) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = ML_INPUT_SIZE;
    tempCanvas.height = ML_INPUT_SIZE;
    const tempCtx = tempCanvas.getContext('2d');

    const scale = Math.min(ML_INPUT_SIZE / width, ML_INPUT_SIZE / height);
    const scaledWidth = Math.floor(width * scale);
    const scaledHeight = Math.floor(height * scale);
    const offsetX = Math.floor((ML_INPUT_SIZE - scaledWidth) / 2);
    const offsetY = Math.floor((ML_INPUT_SIZE - scaledHeight) / 2);

    tempCtx.fillStyle = '#808080';
    tempCtx.fillRect(0, 0, ML_INPUT_SIZE, ML_INPUT_SIZE);

    tempCtx.drawImage(previewCanvas, 0, 0, width, height, offsetX, offsetY, scaledWidth, scaledHeight);

    const resizedData = tempCtx.getImageData(0, 0, ML_INPUT_SIZE, ML_INPUT_SIZE).data;

    const inputSize = ML_INPUT_SIZE * ML_INPUT_SIZE;
    const float32Data = new Float32Array(3 * inputSize);

    for (let i = 0; i < inputSize; i++) {
        const pixelIndex = i * 4;
        float32Data[i] = resizedData[pixelIndex] / 255.0;
        float32Data[i + inputSize] = resizedData[pixelIndex + 1] / 255.0;
        float32Data[i + 2 * inputSize] = resizedData[pixelIndex + 2] / 255.0;
    }

    return {
        tensor: new ort.Tensor('float32', float32Data, [1, 3, ML_INPUT_SIZE, ML_INPUT_SIZE]),
        scale,
        offsetX,
        offsetY
    };
}

export async function detectObjectsWithONNX({ width, height, previewCanvas, onOutputs }) {
    if (!onnxSession) return [];

    try {
        const startTime = performance.now();

        const { tensor, scale, offsetX, offsetY } = preprocessImageForYOLO({ previewCanvas, width, height });

        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Inference timeout')), ML_INFERENCE_TIMEOUT_MS);
        });

        try {
            const results = await Promise.race([
                onnxSession.run({ images: tensor }),
                timeoutPromise
            ]);
            clearTimeout(timeoutId);

            if (onOutputs) {
                onOutputs(results);
            }

            const inferenceTime = performance.now() - startTime;
            console.log(`ONNX inference completed in ${inferenceTime.toFixed(0)}ms`);

            const output = results.predictions || results.output0 || results[Object.keys(results)[0]];

            if (!output) {
                console.error('No valid output found. Available keys:', Object.keys(results));
                return [];
            }

            console.log('Using output tensor with dims:', output.dims);

            return processYOLOOutput(output, width, height, scale, offsetX, offsetY);
        } catch (inferErr) {
            clearTimeout(timeoutId);
            throw inferErr;
        }
    } catch (err) {
        console.warn('ONNX inference failed:', err);
        return [];
    }
}

// Placeholder for YOLOE segmentation outputs until model is wired in.
export async function detectMasksWithONNX({ outputs, width, height }) {
    if (!outputs) return [];
    return parseYoloeSegmentationOutputs({ outputs, width, height });
}

// Placeholder parser for YOLOE-26n-seg outputs.
// Expected to return an array of { data, width, height } masks.
export function parseYoloeSegmentationOutputs({ outputs, width, height }) {
    if (!outputs) return [];

    const outputKeys = Object.keys(outputs || {});
    const maskKey = outputKeys.find(key => key.toLowerCase().includes('mask'));

    if (!maskKey) {
        console.warn('YOLOE segmentation output missing mask tensor. Keys:', outputKeys);
        return [];
    }

    const maskTensor = outputs[maskKey];
    const maskData = maskTensor?.cpuData || maskTensor?.data;
    const dims = maskTensor?.dims || [];

    if (!maskData || dims.length < 3) {
        console.warn('YOLOE mask tensor unavailable or has unexpected shape. dims:', dims);
        return [];
    }

    const maskCount = dims[dims.length - 3] || 1;
    const maskHeight = dims[dims.length - 2] || height;
    const maskWidth = dims[dims.length - 1] || width;

    const masks = [];
    const maskSize = maskWidth * maskHeight;
    const maxMasks = Math.min(maskCount, 16);

    for (let i = 0; i < maxMasks; i++) {
        const start = i * maskSize;
        const slice = maskData.slice(start, start + maskSize);
        masks.push({ data: slice, width: maskWidth, height: maskHeight });
    }

    return masks;
}

function processYOLOOutput(output, originalWidth, originalHeight, scale, offsetX, offsetY) {
    if (!output) {
        console.error('Output is undefined');
        return [];
    }

    const data = output.cpuData || output.data;

    if (!data) {
        console.error('Output data is undefined. Output:', output);
        console.error('Available properties:', Object.keys(output));
        return [];
    }

    const dims = output.dims;
    if (!dims || dims.length !== 3) {
        console.error('Invalid output dimensions:', dims);
        return [];
    }

    const [batch, features, numBoxes] = dims;
    console.log(`Processing YOLO output: ${batch}x${features}x${numBoxes}`);

    const detections = [];

    for (let i = 0; i < numBoxes; i++) {
        const cx = data[i];
        const cy = data[numBoxes + i];
        const w = data[2 * numBoxes + i];
        const h = data[3 * numBoxes + i];

        let maxProb = 0;
        let maxClass = 0;
        for (let c = 0; c < 80; c++) {
            const prob = data[(4 + c) * numBoxes + i];
            if (prob > maxProb) {
                maxProb = prob;
                maxClass = c;
            }
        }

        if (maxProb < ML_CONFIDENCE_THRESHOLD) continue;

        const x1 = (cx - w / 2 - offsetX) / scale;
        const y1 = (cy - h / 2 - offsetY) / scale;
        const boxW = w / scale;
        const boxH = h / scale;

        const clampedX = Math.max(0, Math.min(x1, originalWidth - 1));
        const clampedY = Math.max(0, Math.min(y1, originalHeight - 1));
        const clampedW = Math.min(boxW, originalWidth - clampedX);
        const clampedH = Math.min(boxH, originalHeight - clampedY);

        if (clampedW < ML_MIN_DETECTION_SIZE || clampedH < ML_MIN_DETECTION_SIZE) continue;

        const className = COCO_CLASSES[maxClass] || 'unknown';

        detections.push({
            class: className,
            classId: maxClass,
            confidence: maxProb,
            bbox: [clampedX, clampedY, clampedW, clampedH],
            isPlatformable: PLATFORMABLE_CLASSES.includes(className)
        });
    }

    return applyNMS(detections, 0.45);
}

function applyNMS(detections, iouThreshold) {
    detections.sort((a, b) => b.confidence - a.confidence);

    const kept = [];
    const suppressed = new Set();

    for (let i = 0; i < detections.length; i++) {
        if (suppressed.has(i)) continue;

        kept.push(detections[i]);

        for (let j = i + 1; j < detections.length; j++) {
            if (suppressed.has(j)) continue;

            const iou = calculateIoU(detections[i].bbox, detections[j].bbox);
            if (iou > iouThreshold) {
                suppressed.add(j);
            }
        }
    }

    return kept;
}

function calculateIoU(box1, box2) {
    const [x1, y1, w1, h1] = box1;
    const [x2, y2, w2, h2] = box2;

    const interX1 = Math.max(x1, x2);
    const interY1 = Math.max(y1, y2);
    const interX2 = Math.min(x1 + w1, x2 + w2);
    const interY2 = Math.min(y1 + h1, y2 + h2);

    const interW = Math.max(0, interX2 - interX1);
    const interH = Math.max(0, interY2 - interY1);
    const interArea = interW * interH;

    const area1 = w1 * h1;
    const area2 = w2 * h2;
    const unionArea = area1 + area2 - interArea;

    return unionArea > 0 ? interArea / unionArea : 0;
}

export function mapObjectsToPlatforms(detections, options) {
    const {
        canvasWidth,
        canvasHeight,
        getScaledBlockSize,
        platformMinWidth,
        startAreaWidth,
        startAreaHeight,
        goalAreaWidth,
        goalAreaHeight,
        wordBarAreaHeight,
        platformThickness,
        platformMergeGapPx
    } = options;

    const platformCandidates = [];

    for (const detection of detections) {
        const [x, y, w, h] = detection.bbox;

        const platformY = y;
        const platformX = x;

        const blockSize = getScaledBlockSize();
        const blockCount = Math.max(2, Math.ceil(w / blockSize));
        const platformWidth = blockCount * blockSize;
        const platformHeight = blockSize;

        const isStartArea = (platformX < startAreaWidth && platformY > canvasHeight - startAreaHeight);
        const isGoalArea = (platformX > canvasWidth - goalAreaWidth && platformY < goalAreaHeight);
        const isWordBarArea = (platformY < wordBarAreaHeight);
        if (isStartArea || isGoalArea || isWordBarArea) continue;

        if (platformWidth < platformMinWidth) continue;

        if (platformY < 0 || platformY > canvasHeight - platformHeight) continue;
        if (platformX + platformWidth > canvasWidth) continue;

        let color;
        if (detection.isPlatformable) {
            color = 'rgba(60, 150, 80, 0.85)';
        } else {
            color = 'rgba(80, 100, 160, 0.85)';
        }

        platformCandidates.push({
            x: platformX,
            y: platformY,
            width: platformWidth,
            height: platformHeight,
            color: color,
            source: 'ml-detection',
            detection: detection
        });
    }

    return mergePlatformCandidates(platformCandidates, {
        platformThickness,
        platformMergeGapPx
    });
}

export function mergePlatformCandidates(candidates, options) {
    const { platformThickness, platformMergeGapPx } = options;
    if (candidates.length === 0) return [];

    candidates.sort((a, b) => a.y - b.y || a.x - b.x);

    const merged = [];
    let current = { ...candidates[0] };

    for (let i = 1; i < candidates.length; i++) {
        const next = candidates[i];

        const sameRow = Math.abs(next.y - current.y) < platformThickness;
        const adjacent = next.x <= current.x + current.width + platformMergeGapPx + ML_PLATFORM_MERGE_TOLERANCE;

        if (sameRow && adjacent) {
            const newRight = Math.max(current.x + current.width, next.x + next.width);
            current.width = newRight - current.x;
        } else {
            merged.push(current);
            current = { ...next };
        }
    }
    merged.push(current);

    return merged;
}
