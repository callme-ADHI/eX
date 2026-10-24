/**
 * Rate-limited request queue.
 * Max concurrency: 2. Retry with exponential backoff on 429/5xx.
 * Per-call timeout: 30s via AbortController.
 */

const MAX_CONCURRENCY = 2;
const TIMEOUT_MS = 30_000;
const RETRY_DELAYS = [1000, 2000, 4000];

let running = 0;
/** @type {Array<{fn: Function, resolve: Function, reject: Function}>} */
const waitQueue = [];

function drain() {
  while (running < MAX_CONCURRENCY && waitQueue.length > 0) {
    const job = waitQueue.shift();
    running++;
    job.fn()
      .then(job.resolve)
      .catch(job.reject)
      .finally(() => { running--; drain(); });
  }
}

/**
 * Enqueue a function to run with max-concurrency limiting.
 * @param {() => Promise<any>} fn
 * @returns {Promise<any>}
 */
export function enqueue(fn) {
  return new Promise((resolve, reject) => {
    waitQueue.push({ fn, resolve, reject });
    drain();
  });
}

/**
 * Wrap a fetch-returning function with timeout + retry logic.
 * On 401/403: throws immediately with code AUTH.
 * On 429/5xx: retries up to 3 times with backoff.
 * @param {(signal: AbortSignal) => Promise<Response>} fetchFn
 * @returns {Promise<Response>}
 */
export async function withRetry(fetchFn) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetchFn(controller.signal);
      clearTimeout(timeout);

      if (res.status === 401 || res.status === 403) {
        const e = new Error(`HTTP ${res.status}`);
        e.code = 'AUTH';
        throw e;
      }

      if (res.status === 429 || res.status >= 500) {
        let delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
        const retryAfter = res.headers.get('Retry-After');
        if (retryAfter) {
          const ra = parseInt(retryAfter, 10);
          if (!isNaN(ra)) delay = ra * 1000;
        }
        if (attempt >= RETRY_DELAYS.length) {
          const e = new Error(`HTTP ${res.status} after ${RETRY_DELAYS.length} retries`);
          e.code = res.status === 429 ? 'RATE_LIMIT' : 'SERVER_ERROR';
          throw e;
        }
        await sleep(delay);
        continue;
      }

      return res;
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') { err.code = 'TIMEOUT'; throw err; }
      if (err.code === 'AUTH') throw err;
      lastErr = err;
      if (attempt < RETRY_DELAYS.length) await sleep(RETRY_DELAYS[attempt]);
    }
  }
  const e = lastErr || new Error('Network error');
  if (!e.code) e.code = 'NETWORK';
  throw e;
}

/** @param {number} ms */
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
