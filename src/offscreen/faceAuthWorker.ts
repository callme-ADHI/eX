/**
 * Offscreen Face Authentication Engine
 * Performs 512-dim embedding inference + cosine similarity matching using FaceNet.
 */

const MODEL_URL    = chrome.runtime.getURL("models/boss/facenet.onnx");
const MEAN_EMB_URL = chrome.runtime.getURL("models/boss/mean_embedding.json");
const ALL_EMB_URL  = chrome.runtime.getURL("models/boss/all_embeddings.json");
const METADATA_URL = chrome.runtime.getURL("models/boss/metadata.json");

const INPUT_SIZE = 160;
const DEFAULT_THRESHOLD = 0.5;

let ortModule: any = null;
let ortSession: any = null;
let meanEmbedding: Float32Array | null = null;
let allEmbeddings: Float32Array[] = [];
let threshold = DEFAULT_THRESHOLD;

let engineReady = false;
let initPromise: Promise<void> | null = null;
let initFailed = false;
let initErrorMsg: string | null = null;

async function initEngine(): Promise<void> {
  console.log("[Offscreen FaceAuth] Starting initialization…");

  // Load ONNX Runtime
  const ortUrl = chrome.runtime.getURL("ort-wasm/ort.all.min.mjs");
  ortModule = await import(/* @vite-ignore */ ortUrl);
  ortModule.env.wasm.wasmPaths = chrome.runtime.getURL("ort-wasm/");
  ortModule.env.wasm.numThreads = 1;
  ortModule.env.wasm.proxy = false;

  // 1. Fetch ONNX model
  const modelRes = await fetch(MODEL_URL);
  if (!modelRes.ok) {
    throw new Error(`Failed to fetch facenet.onnx (HTTP ${modelRes.status})`);
  }
  const modelBuf = await modelRes.arrayBuffer();

  // 2. Create InferenceSession
  ortSession = await ortModule.InferenceSession.create(modelBuf, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });

  // 3. Load mean embedding
  const meanRes = await fetch(MEAN_EMB_URL);
  if (!meanRes.ok) {
    throw new Error(`Failed to fetch mean_embedding.json (HTTP ${meanRes.status})`);
  }
  const meanArr: number[] = await meanRes.json();
  meanEmbedding = new Float32Array(meanArr);

  // 4. Load all embeddings
  try {
    const allRes = await fetch(ALL_EMB_URL);
    if (allRes.ok) {
      const allArrs: number[][] = await allRes.json();
      allEmbeddings = allArrs.map((arr) => new Float32Array(arr));
    }
  } catch (e) {
    console.warn("[Offscreen FaceAuth] all_embeddings.json load note:", e);
  }

  // 5. Load metadata
  try {
    const metaRes = await fetch(METADATA_URL);
    if (metaRes.ok) {
      const meta = await metaRes.json();
      if (typeof meta.threshold === "number") {
        threshold = meta.threshold || DEFAULT_THRESHOLD;
      }
    }
  } catch (e) {
    console.warn("[Offscreen FaceAuth] metadata.json load note:", e);
  }

  engineReady = true;
  console.log("[Offscreen FaceAuth] Engine is fully READY ✓");
}

export function startInit(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = initEngine().catch((err) => {
    initFailed = true;
    initErrorMsg = String(err?.message ?? err);
    console.error("[Offscreen FaceAuth] Initialization failed:", err);
  });
  return initPromise;
}

function rgbaToNormalizedCHW(rgba: number[] | Uint8ClampedArray): any {
  const pixels = INPUT_SIZE * INPUT_SIZE;
  const data = new Float32Array(3 * pixels);

  for (let i = 0; i < pixels; i++) {
    const o = i * 4;
    data[i]              = (rgba[o]     / 255.0 - 0.5) / 0.5;
    data[pixels + i]     = (rgba[o + 1] / 255.0 - 0.5) / 0.5;
    data[2 * pixels + i] = (rgba[o + 2] / 255.0 - 0.5) / 0.5;
  }

  return new ortModule.Tensor("float32", data, [1, 3, INPUT_SIZE, INPUT_SIZE]);
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

export async function handleFaceAuth(imageData: number[] | Uint8ClampedArray) {
  if (initFailed) {
    return {
      ok: true,
      data: {
        matched: false,
        similarity: 0,
        ready: false,
        error: `Engine init failed: ${initErrorMsg}`,
      },
    };
  }

  if (!engineReady || !ortSession || !meanEmbedding) {
    return {
      ok: true,
      data: {
        matched: false,
        similarity: 0,
        ready: false,
      },
    };
  }

  try {
    const inputTensor = rgbaToNormalizedCHW(imageData);
    const feeds = { [ortSession.inputNames[0]]: inputTensor };
    const results = await ortSession.run(feeds);
    const outputTensor = results[ortSession.outputNames[0]];
    const embedding = new Float32Array(outputTensor.data as Float32Array);

    const meanSim = cosineSimilarity(embedding, meanEmbedding);
    let nearestSim = meanSim;
    if (allEmbeddings.length > 0) {
      let maxS = -1;
      for (let i = 0; i < allEmbeddings.length; i++) {
        const s = cosineSimilarity(embedding, allEmbeddings[i]);
        if (s > maxS) maxS = s;
      }
      nearestSim = maxS;
    }

    let activeThreshold = threshold;
    try {
      const s: any = await chrome.storage.local.get('settings');
      const customThresh = s?.settings?.faceLock?.threshold;
      if (typeof customThresh === 'number' && !isNaN(customThresh) && customThresh > 0) {
        activeThreshold = customThresh;
      }
    } catch (_) {}

    const effectiveSimilarity = Math.max(meanSim, nearestSim);
    const matched = effectiveSimilarity >= activeThreshold;

    return {
      ok: true,
      data: {
        matched,
        similarity: effectiveSimilarity,
        meanSimilarity: meanSim,
        nearestSimilarity: nearestSim,
        ready: true,
      },
    };
  } catch (err: any) {
    console.error("[Offscreen FaceAuth] Inference error:", err);
    return {
      ok: true,
      data: {
        matched: false,
        similarity: 0,
        ready: true,
        error: String(err?.message ?? err),
      },
    };
  }
}

export function getEngineStatus() {
  return { ready: engineReady, failed: initFailed, error: initErrorMsg };
}
