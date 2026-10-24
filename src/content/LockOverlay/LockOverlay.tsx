/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  eX — Lock Overlay Component (Parity + PBKDF2 Master Auth)
 *  src/content/LockOverlay/LockOverlay.tsx
 *
 *  Full-viewport overlay injected into private-listed sites.
 *  Uses pure Canvas 2D center-crop (zero-dependency) with FaceNet ONNX
 *  inference running in the offscreen document.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { FaceAuthResult } from '../../background/faceAuthEngine';
import { verifyPin, hashPin } from '../../face/pin';

export interface LockOverlayProps {
  hostname: string;
  onUnlock: () => void;
}

type OverlayState = 'loading' | 'requesting_camera' | 'verifying' | 'password' | 'create_password' | 'error';

const FACE_VERIFY_TIMEOUT_MS = 10_000;
const VERIFY_POLL_INTERVAL_MS = 800;
const FACE_CROP_SIZE = 160;
const CENTER_CROP_FRAC = 0.65;
const CAMERA_ACQUIRE_TIMEOUT_MS = 10_000;

export default function LockOverlay({ hostname, onUnlock }: LockOverlayProps) {
  const [state, setState] = useState<OverlayState>('loading');
  const [statusMsg, setStatusMsg] = useState('Initialising security…');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [similarity, setSimilarity] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const verifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unlockedRef = useRef(false);
  const hasStartedScanningRef = useRef(false);
  const storedPinRef = useRef<{ pinHash: string; pinSalt: string } | null>(null);

  const cleanup = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (verifyTimerRef.current) clearTimeout(verifyTimerRef.current);
    if (cameraTimeoutRef.current) clearTimeout(cameraTimeoutRef.current);
    pollRef.current = null;
    verifyTimerRef.current = null;
    cameraTimeoutRef.current = null;
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
    if (typeof chrome !== 'undefined' && chrome.storage?.session) {
      chrome.storage.session.set({ ['unlocked:' + hostname]: Date.now() });
    }
    onUnlock();
  }, [cleanup, hostname, onUnlock]);

  const showPasswordFallback = useCallback(() => {
    cleanup();
    if (!storedPinRef.current || !storedPinRef.current.pinHash) {
      setState('create_password');
      setStatusMsg('Create a secure master password (4+ chars) for fallback:');
    } else {
      setState('password');
      setStatusMsg('Enter master password to unlock:');
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
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(
      videoEl,
      sx, sy, cropDimension, cropDimension,
      0, 0, FACE_CROP_SIZE, FACE_CROP_SIZE
    );

    const imageData = ctx.getImageData(0, 0, FACE_CROP_SIZE, FACE_CROP_SIZE);
    return Array.from(imageData.data);
  }, []);

  const startVerification = useCallback((videoEl: HTMLVideoElement) => {
    setState('verifying');
    setStatusMsg('Loading face model… please wait');
    hasStartedScanningRef.current = false;

    verifyTimerRef.current = setTimeout(() => {
      console.log('[eX FaceLock] Safety timeout expired');
      showPasswordFallback();
    }, 60_000);

    pollRef.current = setInterval(async () => {
      if (unlockedRef.current) return;
      if (videoEl.readyState < 2) return;

      const rgba = captureCenterCrop(videoEl);
      if (!rgba) return;

      try {
        const response: any = await chrome.runtime.sendMessage({
          type: 'FACE_AUTH_VERIFY',
          imageData: rgba,
        });

        if (response?.ok) {
          const result: FaceAuthResult = response.data;

          if (!result.ready && !result.error) {
            setStatusMsg('Loading face model… please wait');
            return;
          }

          if (!result.ready && result.error) {
            console.error('[eX FaceLock] FaceAuthEngine hard error:', result.error);
            setState('error');
            setStatusMsg(`Security Engine error: ${result.error}`);
            if (pollRef.current) clearInterval(pollRef.current);
            return;
          }

          if (result.ready && !hasStartedScanningRef.current) {
            hasStartedScanningRef.current = true;
            if (verifyTimerRef.current) clearTimeout(verifyTimerRef.current);
            verifyTimerRef.current = setTimeout(() => {
              console.log('[eX FaceLock] Face verification timed out after 10s of scanning');
              showPasswordFallback();
            }, FACE_VERIFY_TIMEOUT_MS);
          }

          if (result.error) {
            console.warn('[eX FaceLock] Inference error (will retry):', result.error);
            return;
          }

          setSimilarity(result.similarity);

          if (result.matched) {
            setStatusMsg('Identity confirmed ✓');
            setTimeout(unlock, 350);
          } else {
            setStatusMsg(`Scanning… (score: ${result.similarity.toFixed(2)})`);
          }
        }
      } catch (e) {
        console.warn('[eX FaceLock] Verify poll error:', e);
      }
    }, VERIFY_POLL_INTERVAL_MS);
  }, [captureCenterCrop, showPasswordFallback, unlock]);

  useEffect(() => {
    let cancelled = false;

    // Load stored settings and PIN
    chrome.storage.local.get(['settings', 'facelock:pin'], (res: { [key: string]: any }) => {
      const s = res?.settings as any;
      if (s?.faceLock?.pinHash) {
        storedPinRef.current = { pinHash: s.faceLock.pinHash, pinSalt: s.faceLock.pinSalt };
      } else if (res?.['facelock:pin']?.pinHash) {
        storedPinRef.current = res['facelock:pin'];
      }
    });

    const init = async () => {
      try {
        setState('requesting_camera');
        setStatusMsg('Requesting camera access…');

        cameraTimeoutRef.current = setTimeout(() => {
          if (!cancelled && state === 'requesting_camera') {
            console.warn('[eX FaceLock] Camera acquisition timed out');
            showPasswordFallback();
          }
        }, CAMERA_ACQUIRE_TIMEOUT_MS);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });

        if (cameraTimeoutRef.current) clearTimeout(cameraTimeoutRef.current);

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          showPasswordFallback();
          return;
        }

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
        if (cameraTimeoutRef.current) clearTimeout(cameraTimeoutRef.current);
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
          showPasswordFallback();
        } else {
          console.error('[eX FaceLock] Camera init error:', err);
          setState('error');
          setStatusMsg(`Camera error: ${err?.message ?? err}`);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [cleanup, showPasswordFallback, startVerification]);

  const handlePasswordSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (!storedPinRef.current || !storedPinRef.current.pinHash) {
      showPasswordFallback();
      return;
    }

    const valid = await verifyPin(password, storedPinRef.current.pinHash, storedPinRef.current.pinSalt);
    if (valid) {
      setStatusMsg('Unlocked ✓');
      setTimeout(unlock, 250);
    } else {
      setPwError('Incorrect password. Try again.');
      setPassword('');
    }
  }, [password, showPasswordFallback, unlock]);

  const handleCreatePasswordSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (password.length < 4) {
      setPwError('Password must be at least 4 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setPwError('Passwords do not match.');
      return;
    }

    try {
      const { pinHash, pinSalt } = await hashPin(password);
      storedPinRef.current = { pinHash, pinSalt };

      const res = await chrome.storage.local.get('settings');
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
      await chrome.storage.local.set({
        settings: updated,
        'facelock:pin': { pinHash, pinSalt },
      });
      setStatusMsg('Password set ✓');
      setTimeout(unlock, 350);
    } catch (err: any) {
      setPwError('Failed to save password: ' + err.message);
    }
  }, [confirmPassword, password, unlock]);

  const isCamActive = state !== 'password' && state !== 'create_password';

  return (
    <div className="ex-lock-overlay" id="ex-lock-overlay-root">
      <div className="ex-lock-backdrop" />

      <div className="ex-lock-card">
        {/* Header */}
        <div className="ex-lock-header">
          <div className="ex-lock-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </div>
          <div className="ex-lock-title">Private Site</div>
          <div className="ex-lock-domain">{hostname}</div>
        </div>

        {/* Camera view rendered whenever not in password modes */}
        {isCamActive && (
          <div className="ex-lock-camera-wrap">
            <video
              ref={videoRef}
              className="ex-lock-video"
              autoPlay
              muted
              playsInline
            />
            {/* Center-crop target guide */}
            <div className="ex-lock-face-guide" />

            {/* Corner frame decorations */}
            <div className="ex-lock-corner ex-lock-corner--tl" />
            <div className="ex-lock-corner ex-lock-corner--tr" />
            <div className="ex-lock-corner ex-lock-corner--bl" />
            <div className="ex-lock-corner ex-lock-corner--br" />

            {/* Scan line animation */}
            {state === 'verifying' && <div className="ex-lock-scanline" />}

            {/* Debug similarity readout */}
            {similarity !== null && (
              <div className="ex-lock-sim-debug">
                sim: {similarity.toFixed(4)}
              </div>
            )}
          </div>
        )}

        {/* Hidden canvas for face cropping */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Status message */}
        <div className={`ex-lock-status ex-lock-status--${state}`}>
          {(state === 'loading' || state === 'requesting_camera') && <span className="ex-lock-spinner" />}
          {state === 'verifying' && <span className="ex-lock-pulse-dot" />}
          <span>{statusMsg}</span>
        </div>

        {/* Password fallback form */}
        {state === 'password' && (
          <form className="ex-lock-pw-form" onSubmit={handlePasswordSubmit}>
            <input
              id="ex-lock-password-input"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPwError(''); }}
              className="ex-lock-pw-input"
              autoFocus
              autoComplete="current-password"
            />
            {pwError && <div className="ex-lock-pw-error" role="alert">{pwError}</div>}
            <button id="ex-lock-password-submit" type="submit" className="ex-lock-pw-btn">
              Unlock
            </button>
            <button
              type="button"
              className="ex-lock-try-face-btn"
              onClick={() => {
                setPwError('');
                setPassword('');
                window.location.reload();
              }}
            >
              Try face again
            </button>
          </form>
        )}

        {/* Create password initial setup */}
        {state === 'create_password' && (
          <form className="ex-lock-pw-form" onSubmit={handleCreatePasswordSubmit}>
            <input
              id="ex-lock-new-password"
              type="password"
              placeholder="Create master password (4+ chars)"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPwError(''); }}
              className="ex-lock-pw-input"
              autoFocus
            />
            <input
              id="ex-lock-confirm-password"
              type="password"
              placeholder="Confirm master password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setPwError(''); }}
              className="ex-lock-pw-input"
            />
            {pwError && <div className="ex-lock-pw-error" role="alert">{pwError}</div>}
            <button id="ex-lock-create-submit" type="submit" className="ex-lock-pw-btn">
              Set Password & Unlock
            </button>
          </form>
        )}

        {isCamActive && (
          <button
            type="button"
            className="ex-lock-try-face-btn"
            onClick={showPasswordFallback}
            style={{ fontSize: '11px', opacity: 0.8 }}
          >
            Use password fallback
          </button>
        )}

        {/* Footer */}
        <div className="ex-lock-footer">
          Secured by eX Facial Lock
        </div>
      </div>
    </div>
  );
}
