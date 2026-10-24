# eX Face Lock Parity with eX2

## Architecture & Implementation Matrix

| Capability / Attribute | eX2 Baseline | eX Implementation | Parity Status |
|---|---|---|---|
| Injection Mechanism | Shadow DOM (`mode: 'open'`) inside content script | Shadow DOM (`mode: 'open'`) attached to document root | Identical |
| Styling Isolation | Injected `<style>` with component CSS | Injected `<style>` with CSS reset `:host { all: initial; }` | Enhanced |
| UI Frame & Dimensions | 340px width glassmorphic card with 20px radius | 340px width glassmorphic card with 20px radius | Identical |
| Video Viewfinder | 220×165px mirrored video (`transform: scaleX(-1)`) | 220×165px mirrored video (`transform: scaleX(-1)`) | Identical |
| Corner Biometric Brackets | 4 corner brackets (TL, TR, BL, BR) with indigo accent | 4 corner brackets (TL, TR, BL, BR) with indigo accent | Identical |
| Scanline Animation | Continuous horizontal beam across viewfinder | Continuous horizontal beam across viewfinder | Identical |
| Face Guide Oval | 110×130px dashed elliptical framing overlay | 110×130px dashed elliptical framing overlay | Identical |
| Debug Similarity Readout | Bottom-right monospace `sim: 0.xxxx` | Bottom-right monospace `sim: 0.xxxx` | Identical |
| Video Acquisition | `navigator.mediaDevices.getUserMedia({ video: ... })` | Robust state-machine with 10s camera acquisition timeout | Fixed Task C |
| Face Cropping | Canvas 2D center-crop at 65% scale, resized to 160×160 | Canvas 2D center-crop at 65% scale, resized to 160×160 | Identical |
| Preprocessing Pipeline | Raw RGBA array sent via `FACE_AUTH_VERIFY` | Raw RGBA array sent via `FACE_AUTH_VERIFY` | Identical |
| Neural Network Model | FaceNet ONNX in Offscreen Document (512-dim embedding) | FaceNet ONNX in Offscreen Document (512-dim embedding) | Identical |
| Cosine Threshold | Default 0.50 | Default 0.50 (user adjustable in settings) | Identical |
| Fallback Authentication | Hardcoded `1234` | Forced PBKDF2 Password/PIN Setup & Verification | Upgraded (Secure) |
| Session Unlock Persistence | In-memory unmount only | 15-minute `chrome.storage.session` unlock cache | Enhanced |
| Private Sites Storage Key | `facelock:privateSites` array | `facelock:privateSites` array + settings sync | Full Parity |
| Management UIs | Settings Panel (Privacy tab) | Settings Tab, Overview Tab & Newtab Settings | Extended |

## State Machine
```
IDLE ──► REQUESTING_CAMERA ──► STREAM_READY ──► LOADING_MODEL ──► SCANNING
              │                                                     │
              ├─► DENIED / NO_CAMERA / TIMEOUT                      ├─► MATCHED (Unlock)
              │                                                     ├─► FAILED / TIMEOUT
              ▼                                                     ▼
      PASSWORD_SETUP (if unset) ◄─────────────────────────── PASSWORD_VERIFY
```
