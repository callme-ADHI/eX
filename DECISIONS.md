# eX — Architecture & Decision Log

| Date | Question / Decision | Choice | Why |
|---|---|---|---|
| 2026-10-24 | NVIDIA NIM Model Selection | chat & mailDeep: `nvidia/nemotron-3.5-lightning-30b-a3b`<br>mailBatch & sitePhish: `nvidia/nemotron-3.5-bolt-e4b`<br>vuln: `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | Llama-3.1-70b/8b, codellama, and mistral models returned 404 or 410 on current keys. Probing confirmed Nemotron 30B lightning (600ms) for high-reasoning tasks, Nemotron 3.5 bolt (370ms) for fast batch scanning, and Nemotron 30B reasoning (900ms) for vulnerability analysis all respond reliably on the respective keys. |
| 2026-10-24 | Content Script Module Loading | Dynamic script injection & ES Modules | Content scripts running in MV3 use dynamic `import(chrome.runtime.getURL(...))` for modules and standard vanilla listeners for isolated DOM operations. |
| 2026-10-24 | Offscreen Document Unification | Single offscreen document handles both ONNX face verification and Tesseract OCR | Chrome MV3 enforces that only one offscreen document can exist at a time. Both face auth and OCR message listeners are unified under `src/offscreen/offscreen.ts`. |
| 2026-10-24 | PIN Fallback Security | PBKDF2 with SHA-256 (150,000 iterations, 16-byte random salt, 32-byte derived key) | Replaced hardcoded development password `1234` with cryptographically secure PBKDF2 hashing via `crypto.subtle`. |
