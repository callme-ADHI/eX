let audioCtx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
let lastPlayTime = 0;
let tickIndex = 0;
const MIN_TICK_GAP = 0.045;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    const length = Math.ceil(ctx.sampleRate * 0.05);
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  return noiseBuffer;
}

export function playTactileTick() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;

    let playTime = now;
    if (now - lastPlayTime < MIN_TICK_GAP) {
      playTime = lastPlayTime + MIN_TICK_GAP;
      if (playTime - now > 0.15) {
        return;
      }
    }

    const isSingleHover = now - lastPlayTime > 0.25;
    lastPlayTime = playTime;
    tickIndex = isSingleHover ? 0 : tickIndex + 1;

    const pitchStep = 1 + ((tickIndex % 5) - 2) * 0.015;
    const jitter = 0.99 + Math.random() * 0.02;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(isSingleHover ? 0.5 : 0.36, playTime);
    masterGain.connect(ctx.destination);

    const noiseDuration = isSingleHover ? 0.022 : 0.010;
    const bodyDuration = isSingleHover ? 0.05 : 0.022;
    const attack = 0.002;

    // 1. Transient: pushed up to 3400/3800Hz — brighter, more "tick"-like crack
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = getNoiseBuffer(ctx);

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime((isSingleHover ? 3400 : 3800) * pitchStep * jitter, playTime);
    noiseFilter.Q.value = 1.1;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, playTime);
    noiseGain.gain.linearRampToValueAtTime(0.5, playTime + attack); // slightly louder — leads the sound
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, playTime + noiseDuration);

    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);

    // 2. Body: raised an octave-ish, shallow sweep — adds weight without a "tock" fall
    const bodyOsc = ctx.createOscillator();
    bodyOsc.type = 'sine';
    const bodyFreq = (isSingleHover ? 1050 : 1250) * pitchStep * jitter;
    bodyOsc.frequency.setValueAtTime(bodyFreq, playTime);
    bodyOsc.frequency.exponentialRampToValueAtTime(bodyFreq * 0.85, playTime + bodyDuration); // shallower fall

    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, playTime);
    bodyGain.gain.linearRampToValueAtTime(0.38, playTime + attack); // pulled back — supports, doesn't lead
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, playTime + bodyDuration);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(masterGain);

    noiseSrc.start(playTime);
    noiseSrc.stop(playTime + noiseDuration + 0.01);

    bodyOsc.start(playTime);
    bodyOsc.stop(playTime + bodyDuration + 0.01);
  } catch (err) {
    console.warn('Tactile tick audio failed to play:', err);
  }
}