// Small fetch helper: timeout, no caching, one retry on network errors, and a
// clear error when a server answers with an HTML page instead of data (the bug
// that broke the old cron).

/**
 * fetch() with a timeout and ONE retry after a short pause when the connection
 * itself fails (seen in production: the first call to the FSO server sometimes
 * fails with "fetch failed", the next one works). HTTP errors are not retried.
 */
export async function fetchWithRetry(url, { timeoutMs = 20000, label = url, retryDelayMs = 1500 } = {}) {
  try {
    return await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    await new Promise(r => setTimeout(r, retryDelayMs));
    try {
      return await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      throw new Error(`${label}: request failed twice (${e.cause?.code || e.message})`);
    }
  }
}

export async function fetchText(url, { timeoutMs = 20000, label = url } = {}) {
  const res = await fetchWithRetry(url, { timeoutMs, label });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`${label}: HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  if (/^\s*<(!doctype|html)/i.test(body)) {
    throw new Error(`${label}: got an HTML page instead of data`);
  }
  return body;
}

export async function fetchJson(url, opts) {
  const text = await fetchText(url, opts);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${opts?.label || url}: response is not valid JSON`);
  }
}

export function daysAgo(n, from = new Date()) {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
