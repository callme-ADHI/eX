/**
 * Face Authentication Service Worker Bridge
 * Manages the Chrome MV3 Offscreen Document lifecycle (offscreen.html)
 * where heavy ONNX neural network inference executes.
 */

export interface FaceAuthResult {
  matched: boolean;
  similarity: number;
  ready: boolean;
  error?: string;
  nearestSimilarity?: number;
  meanSimilarity?: number;
}

let creatingOffscreenPromise: Promise<void> | null = null;

export async function ensureOffscreenDocument(): Promise<void> {
  try {
    if ("hasDocument" in chrome.offscreen) {
      if (await chrome.offscreen.hasDocument()) {
        return;
      }
    }
  } catch (err) {
    console.warn("[FaceAuth SW] hasDocument check warning:", err);
  }

  if (creatingOffscreenPromise) {
    await creatingOffscreenPromise;
    return;
  }

  creatingOffscreenPromise = (async () => {
    try {
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: [chrome.offscreen.Reason.BLOBS],
        justification: "Face authentication ONNX neural network inference and OCR",
      });
    } catch (err: any) {
      if (err?.message?.includes("Only a single offscreen document") || err?.message?.includes("already exists")) {
        return;
      }
      console.error("[FaceAuth SW] Failed to create offscreen document:", err);
      throw err;
    }
  })();

  try {
    await creatingOffscreenPromise;
  } finally {
    creatingOffscreenPromise = null;
  }
}

export function initFaceAuthEngine(): void {
  ensureOffscreenDocument()
    .then(() => {
      chrome.runtime.sendMessage({ target: "offscreen", type: "OFFSCREEN_PING" }).catch(() => {});
    })
    .catch((err) => {
      console.error("[FaceAuth SW] Pre-warm init error:", err);
    });
}

export async function verifyFace(imageData: number[]): Promise<FaceAuthResult> {
  try {
    await ensureOffscreenDocument();

    const response = await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "OFFSCREEN_FACE_AUTH",
      imageData,
    });

    if (response?.ok && response.data) {
      return response.data as FaceAuthResult;
    }

    return {
      matched: false,
      similarity: 0,
      ready: false,
      error: response?.error || "Inference failed",
    };
  } catch (err: any) {
    return {
      matched: false,
      similarity: 0,
      ready: false,
      error: String(err?.message ?? err),
    };
  }
}
