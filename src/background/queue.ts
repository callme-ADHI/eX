/**
 * Rate-limited request queue.
 * Max concurrency: 2. Retry with exponential backoff on 429/5xx (1s, 2s, 4s).
 * Per-call timeout: 30s via AbortController.
 */

const MAX_CONCURRENCY = 2;
const TIMEOUT_MS = 30_000;
const RETRY_DELAYS = [1000, 2000, 4000];

let running = 0;
const waitQueue: Array<{ fn: () => Promise<any>; resolve: (val: any) => void; reject: (err: any) => void }> = [];

function drain() {
  while (running < MAX_CONCURRENCY && waitQueue.length > 0) {
    const job = waitQueue.shift();
    if (!job) break;
    running++;
    job.fn()
      .then(job.resolve)
      .catch(job.reject)
      .finally(() => {
        running--;
        drain();
      });
  }
}

export function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    waitQueue.push({ fn, resolve, reject });
    drain();
  });
}

export async function withRetry(fetchFn: (signal: AbortSignal) => Promise<Response>): Promise<Response> {
  let lastErr: any;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetchFn(controller.signal);
      clearTimeout(timeout);

      if (res.status === 401 || res.status === 403) {
        const e: any = new Error("HTTP " + res.status);
        e.code = "AUTH";
        throw e;
      }

      if (res.status === 429 || res.status >= 500) {
        let delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
        const retryAfter = res.headers.get("Retry-After");
        if (retryAfter) {
          const ra = parseInt(retryAfter, 10);
          if (!isNaN(ra)) delay = ra * 1000;
        }
        if (attempt >= RETRY_DELAYS.length) {
          const e: any = new Error("HTTP " + res.status + " after " + RETRY_DELAYS.length + " retries");
          e.code = res.status === 429 ? "RATE_LIMIT" : "SERVER_ERROR";
          throw e;
        }
        await sleep(delay);
        continue;
      }

      return res;
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError") {
        err.code = "TIMEOUT";
        throw err;
      }
      if (err.code === "AUTH") throw err;
      lastErr = err;
      if (attempt < RETRY_DELAYS.length) await sleep(RETRY_DELAYS[attempt]);
    }
  }
  const e: any = lastErr || new Error("Network error");
  if (!e.code) e.code = "NETWORK";
  throw e;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
