/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  eX — Lock Overlay Component (PBKDF2 Master Auth + FaceNet Fallback)
 *  src/content/LockOverlay/LockOverlay.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import './LockOverlay.css';
import type { FaceAuthResult } from '../../background/faceAuthEngine';
import { verifyPin, hashPin } from '../../face/pin';

export interface LockOverlayProps {
  hostname: string;
  onUnlock: () => void;
}

type OverlayState = 'loading' | 'requesting_camera' | 'verifying' | 'password' | 'create_password' | 'error';
const FACE_VERIFY_TIMEOUT_MS = 10_000, VERIFY_POLL_INTERVAL_MS = 800;
const FACE_CROP_SIZE = 160, CENTER_CROP_FRAC = 0.65, CAMERA_ACQUIRE_TIMEOUT_MS = 8_000;

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
    pollRef.current = null; verifyTimerRef.current = null; cameraTimeoutRef.current = null;
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

    ctx.drawImage(videoEl, sx, sy, cropDimension, cropDimension, 0, 0, FACE_CROP_SIZE, FACE_CROP_SIZE);
    const imageData = ctx.getImageData(0, 0, FACE_CROP_SIZE, FACE_CROP_SIZE);
    return Array.from(imageData.data);
  }, []);

  const startVerification = useCallback((videoEl: HTMLVideoElement) => {
    setState('verifying');
    setStatusMsg('Loading facial recognition model…');
    hasStartedScanningRef.current = false;

    verifyTimerRef.current = setTimeout(() => {
      showPasswordFallback();
    }, 45_000);

    pollRef.current = setInterval(async () => {
      if (unlockedRef.current || videoEl.readyState < 2) return;
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
            setState('error');
            setStatusMsg(`Model error: ${result.error}`);
            if (pollRef.current) clearInterval(pollRef.current);
            return;
          }
          if (result.ready && !hasStartedScanningRef.current) {
            hasStartedScanningRef.current = true;
            if (verifyTimerRef.current) clearTimeout(verifyTimerRef.current);
            verifyTimerRef.current = setTimeout(() => {
              showPasswordFallback();
            }, FACE_VERIFY_TIMEOUT_MS);
          }
          if (result.error) return;

          setSimilarity(result.similarity);
          if (result.matched) {
            setStatusMsg('Identity confirmed ✓');
            setTimeout(unlock, 350);
          } else {
            setStatusMsg(`Scanning… (match: ${result.similarity.toFixed(2)})`);
          }
        }
      } catch (e) {
        console.warn('[eX FaceLock] Poll error:', e);
      }
    }, VERIFY_POLL_INTERVAL_MS);
  }, [captureCenterCrop, showPasswordFallback, unlock]);

  const initCamera = useCallback(async () => {
    try {
      setState('requesting_camera');
      setStatusMsg('Requesting camera access…');

      cameraTimeoutRef.current = setTimeout(() => {
        showPasswordFallback();
      }, CAMERA_ACQUIRE_TIMEOUT_MS);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });

      if (cameraTimeoutRef.current) clearTimeout(cameraTimeoutRef.current);
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        showPasswordFallback();
        return;
      }

      video.srcObject = stream;
      await video.play();

      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) { resolve(); return; }
        video.onloadeddata = () => resolve();
        setTimeout(resolve, 1500);
      });

      startVerification(video);
    } catch (err: any) {
      if (cameraTimeoutRef.current) clearTimeout(cameraTimeoutRef.current);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setState('error');
        setStatusMsg('Camera access was denied.');
      } else {
        setState('error');
        setStatusMsg(`Camera error: ${err?.message || 'Unable to access camera'}`);
      }
    }
  }, [showPasswordFallback, startVerification]);

  useEffect(() => {
    chrome.storage.local.get(['settings', 'facelock:pin'], (res: { [key: string]: any }) => {
      const s = res?.settings as any;
      if (s?.faceLock?.pinHash) {
        storedPinRef.current = { pinHash: s.faceLock.pinHash, pinSalt: s.faceLock.pinSalt };
      } else if (res?.['facelock:pin']?.pinHash) {
        storedPinRef.current = res['facelock:pin'];
      }
    });

    initCamera();
    return () => cleanup();
  }, [cleanup, initCamera]);

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
      setPwError('Incorrect master password.');
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
        faceLock: { ...(current.faceLock || {}), enabled: true, pinHash, pinSalt },
      };
      await chrome.storage.local.set({ settings: updated, 'facelock:pin': { pinHash, pinSalt } });
      setStatusMsg('Master password configured ✓');
      setTimeout(unlock, 350);
    } catch (err: any) {
      setPwError('Failed to save password: ' + err.message);
    }
  }, [confirmPassword, password, unlock]);

  const isCamActive = state === 'verifying' || state === 'requesting_camera' || state === 'loading';

  return (
    <div className="ex-lock-overlay" id="ex-lock-overlay-root">
      <div className="ex-lock-backdrop" />
      <div className="ex-lock-card">
        {/* Header */}
        <div className="ex-lock-header">
          <div className="ex-lock-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="1.75" style={{ width: 24, height: 24, minWidth: 24, minHeight: 24, flexShrink: 0 }}>
              <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="#a5b4fc" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" fill="none" stroke="#a5b4fc" />
            </svg>
          </div>
          <div className="ex-lock-title">eX Face Lock</div>
          <div className="ex-lock-domain">{hostname}</div>
        </div>

        {/* Camera Viewfinder */}
        {isCamActive && (
          <div className="ex-lock-camera-wrap">
            <video ref={videoRef} className="ex-lock-video" autoPlay muted playsInline />
            <div className="ex-lock-face-guide" />
            <div className="ex-lock-corner ex-lock-corner--tl" />
            <div className="ex-lock-corner ex-lock-corner--tr" />
            <div className="ex-lock-corner ex-lock-corner--bl" />
            <div className="ex-lock-corner ex-lock-corner--br" />
            {state === 'verifying' && <div className="ex-lock-scanline" />}
            {similarity !== null && (
              <div className="ex-lock-sim-debug">sim: {similarity.toFixed(4)}</div>
            )}
          </div>
        )}

        {/* Camera Error View */}
        {state === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '16px 8px', width: '100%' }}>
            <div style={{ fontSize: 32 }}>⚠️</div>
            <div style={{ fontSize: 13, color: '#fca5a5', textAlign: 'center', fontWeight: 500 }}>
              {statusMsg}
            </div>
            <button
              type="button"
              className="ex-lock-pw-btn"
              onClick={showPasswordFallback}
              style={{ marginTop: 6 }}
            >
              Unlock with Master Password
            </button>
            <button
              type="button"
              className="ex-lock-try-face-btn"
              onClick={() => initCamera()}
            >
              Retry Camera Access
            </button>
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Status Line */}
        {state !== 'error' && (
          <div className={`ex-lock-status ex-lock-status--${state}`}>
            {(state === 'loading' || state === 'requesting_camera') && <span className="ex-lock-spinner" />}
            {state === 'verifying' && <span className="ex-lock-pulse-dot" />}
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Password Fallback Form */}
        {state === 'password' && (
          <form className="ex-lock-pw-form" onSubmit={handlePasswordSubmit}>
            <input
              id="ex-lock-password-input"
              type="password"
              placeholder="Enter master password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPwError(''); }}
              className="ex-lock-pw-input"
              autoFocus
              autoComplete="current-password"
            />
            {pwError && <div className="ex-lock-pw-error" role="alert">{pwError}</div>}
            <button id="ex-lock-password-submit" type="submit" className="ex-lock-pw-btn">
              Unlock Site
            </button>
            <button
              type="button"
              className="ex-lock-try-face-btn"
              onClick={() => { setPwError(''); setPassword(''); initCamera(); }}
            >
              Try face recognition again
            </button>
          </form>
        )}

        {/* Create Password Setup */}
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

        {/* Fallback link when camera is active */}
        {isCamActive && (
          <button
            type="button"
            className="ex-lock-try-face-btn"
            onClick={showPasswordFallback}
            style={{ fontSize: '11px', opacity: 0.8 }}
          >
            Use master password instead
          </button>
        )}

        <div className="ex-lock-footer">
          Secured by eX Facial Intelligence
        </div>
      </div>
    </div>
  );
}
