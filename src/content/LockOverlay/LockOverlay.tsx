/**
 * eX Identity Lock Overlay Component
 * Center-crops live webcam frame to 160x160 px and sends to background for ONNX FaceNet verification.
 * Fallback: PBKDF2 PIN after 3 failed attempts or timeout.
 * First run prompts PIN creation.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { verifyPin, hashPin } from "../../face/pin";

export interface LockOverlayProps {
  hostname: string;
  onUnlock: () => void;
}

type OverlayState = "loading" | "verifying" | "pin" | "create_pin" | "error";

const FACE_VERIFY_TIMEOUT_MS = 10_000;
const VERIFY_POLL_INTERVAL_MS = 800;
const FACE_CROP_SIZE = 160;
const CENTER_CROP_FRAC = 0.65;
const MAX_FAILED_ATTEMPTS = 3;

export default function LockOverlay({ hostname, onUnlock }: LockOverlayProps) {
  const [state, setState] = useState<OverlayState>("loading");
  const [statusMsg, setStatusMsg] = useState("Securing tab…");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [similarity, setSimilarity] = useState<number | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const verifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unlockedRef = useRef(false);
  const hasStartedScanningRef = useRef(false);
  const storedPinRef = useRef<{ pinHash: string; pinSalt: string } | null>(null);

  const cleanup = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (verifyTimerRef.current) clearTimeout(verifyTimerRef.current);
    pollRef.current = null;
    verifyTimerRef.current = null;
    hasStartedScanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const unlock = useCallback(() => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    cleanup();
    // Persist 15 min unlock in session storage
    if (typeof chrome !== "undefined" && chrome.storage?.session) {
      chrome.storage.session.set({ ["unlocked:" + hostname]: Date.now() });
    }
    onUnlock();
  }, [cleanup, hostname, onUnlock]);

  const showPinFallback = useCallback(() => {
    cleanup();
    if (!storedPinRef.current || !storedPinRef.current.pinHash) {
      setState("create_pin");
      setStatusMsg("Set up your 4-digit PIN for Identity Lock:");
    } else {
      setState("pin");
      setStatusMsg("Enter security PIN to unlock:");
    }
  }, [cleanup]);

  const captureCenterCrop = useCallback((videoEl: HTMLVideoElement): number[] | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    if (!vw || !vh) return null;

    const cropDimension = Math.round(Math.min(vw, vh) * CENTER_CROP_FRAC);
    const sx = Math.round((vw - cropDimension) / 2);
    const sy = Math.round((vh - cropDimension) / 2);

    canvas.width = FACE_CROP_SIZE;
    canvas.height = FACE_CROP_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(videoEl, sx, sy, cropDimension, cropDimension, 0, 0, FACE_CROP_SIZE, FACE_CROP_SIZE);
    const imageData = ctx.getImageData(0, 0, FACE_CROP_SIZE, FACE_CROP_SIZE);
    return Array.from(imageData.data);
  }, []);

  const startVerification = useCallback((videoEl: HTMLVideoElement) => {
    setState("verifying");
    setStatusMsg("Loading neural models…");
    hasStartedScanningRef.current = false;

    verifyTimerRef.current = setTimeout(() => {
      showPinFallback();
    }, 45_000);

    let failedCount = 0;

    pollRef.current = setInterval(async () => {
      if (unlockedRef.current) return;
      if (videoEl.readyState < 2) return;

      const rgba = captureCenterCrop(videoEl);
      if (!rgba) return;

      try {
        const response: any = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: "FACE_AUTH_VERIFY", imageData: rgba }, resolve);
        });

        if (response?.ok && response.data) {
          const result = response.data;
          if (!result.ready && !result.error) {
            setStatusMsg("Warming FaceNet model…");
            return;
          }

          if (result.ready && !hasStartedScanningRef.current) {
            hasStartedScanningRef.current = true;
            if (verifyTimerRef.current) clearTimeout(verifyTimerRef.current);
            verifyTimerRef.current = setTimeout(() => {
              showPinFallback();
            }, FACE_VERIFY_TIMEOUT_MS);
          }

          if (result.error) {
            return;
          }

          setSimilarity(result.similarity);

          if (result.matched) {
            setStatusMsg("Face recognized ✓");
            setTimeout(unlock, 350);
          } else {
            failedCount++;
            setFailedAttempts(failedCount);
            if (failedCount >= MAX_FAILED_ATTEMPTS) {
              showPinFallback();
            } else {
              setStatusMsg(`Scanning… (${result.similarity.toFixed(2)})`);
            }
          }
        }
      } catch (e) {
        console.warn("[LockOverlay] Verify poll error:", e);
      }
    }, VERIFY_POLL_INTERVAL_MS);
  }, [captureCenterCrop, showPinFallback, unlock]);

  useEffect(() => {
    let cancelled = false;

    // Load stored settings and PIN
    chrome.storage.local.get("settings", (res) => {
      const s = res.settings as any;
      if (s?.faceLock?.pinHash) {
        storedPinRef.current = { pinHash: s.faceLock.pinHash, pinSalt: s.faceLock.pinSalt };
      }
    });

    const init = async () => {
      try {
        setStatusMsg("Requesting camera access…");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();
        if (cancelled) return;

        await new Promise<void>((resolve) => {
          if (video.readyState >= 2) { resolve(); return; }
          video.onloadeddata = () => resolve();
          setTimeout(resolve, 1500);
        });

        if (cancelled) return;
        startVerification(video);
      } catch (err: any) {
        if (cancelled) return;
        if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
          showPinFallback();
        } else {
          setState("error");
          setStatusMsg("Camera not available: " + (err?.message || "Check permissions"));
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [cleanup, showPinFallback, startVerification]);

  const handlePinSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");
    if (!storedPinRef.current || !storedPinRef.current.pinHash) {
      showPinFallback();
      return;
    }

    const valid = await verifyPin(pin, storedPinRef.current.pinHash, storedPinRef.current.pinSalt);
    if (valid) {
      unlock();
    } else {
      setPinError("Incorrect PIN. Please try again.");
      setPin("");
    }
  }, [pin, showPinFallback, unlock]);

  const handleCreatePinSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");
    if (pin.length < 4) {
      setPinError("PIN must be at least 4 digits.");
      return;
    }
    if (pin !== confirmPin) {
      setPinError("PINs do not match.");
      return;
    }

    try {
      const { pinHash, pinSalt } = await hashPin(pin);
      storedPinRef.current = { pinHash, pinSalt };

      const res = await chrome.storage.local.get("settings");
      const current = (res.settings || {}) as any;
      const updated = {
        ...current,
        faceLock: {
          ...(current.faceLock || {}),
          enabled: true,
          pinHash,
          pinSalt,
        },
      };
      await chrome.storage.local.set({ settings: updated });
      setStatusMsg("PIN established ✓");
      setTimeout(unlock, 350);
    } catch (err: any) {
      setPinError("Failed to save PIN: " + err.message);
    }
  }, [confirmPin, pin, unlock]);

  return (
    <div className="ex2-lock-overlay">
      <div className="ex2-lock-backdrop" />
      <div className="ex2-lock-card">
        <div className="ex2-lock-header">
          <div className="ex2-lock-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className="ex2-lock-title">eX Identity Lock</div>
          <div className="ex2-lock-domain">{hostname}</div>
        </div>

        {state === "verifying" && (
          <div className="ex2-lock-camera-wrap" style={{ position: "relative", width: "160px", height: "160px", borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(36, 82, 255, 0.6)", boxShadow: "0 0 20px rgba(36, 82, 255, 0.3)" }}>
            <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            <div style={{ position: "absolute", inset: 0, border: "2px dashed rgba(255,255,255,0.4)", borderRadius: "50%", pointerEvents: "none" }} />
          </div>
        )}

        <div className="ex2-lock-status" style={{ fontSize: "13px", color: "rgba(232, 232, 240, 0.75)", textAlign: "center" }}>
          {statusMsg}
        </div>

        {state === "pin" && (
          <form onSubmit={handlePinSubmit} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
            <input
              type="password"
              inputMode="numeric"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "8px",
                color: "#fff",
                fontSize: "16px",
                letterSpacing: "4px",
                textAlign: "center",
                outline: "none",
              }}
            />
            {pinError && <div style={{ color: "#ef4444", fontSize: "12px", textAlign: "center" }}>{pinError}</div>}
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "10px",
                background: "#2452ff",
                border: "none",
                borderRadius: "8px",
                color: "#fff",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Unlock
            </button>
          </form>
        )}

        {state === "create_pin" && (
          <form onSubmit={handleCreatePinSubmit} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
            <input
              type="password"
              inputMode="numeric"
              placeholder="New PIN (4+ digits)"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "8px",
                color: "#fff",
                fontSize: "16px",
                letterSpacing: "4px",
                textAlign: "center",
                outline: "none",
              }}
            />
            <input
              type="password"
              inputMode="numeric"
              placeholder="Confirm PIN"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "8px",
                color: "#fff",
                fontSize: "16px",
                letterSpacing: "4px",
                textAlign: "center",
                outline: "none",
              }}
            />
            {pinError && <div style={{ color: "#ef4444", fontSize: "12px", textAlign: "center" }}>{pinError}</div>}
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "10px",
                background: "#2452ff",
                border: "none",
                borderRadius: "8px",
                color: "#fff",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Set PIN & Unlock
            </button>
          </form>
        )}

        {state === "verifying" && (
          <button
            type="button"
            onClick={showPinFallback}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(232, 232, 240, 0.5)",
              fontSize: "12px",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Use PIN instead
          </button>
        )}
      </div>
    </div>
  );
}
