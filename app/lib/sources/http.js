// Small fetch helper: timeout, no caching, and a clear error when a server
// answers with an HTML page instead of data (the bug that broke the old cron).

export async function fetchText(url, { timeoutMs = 20000, label = url } = {}) {
  let res;
  try {
    res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw new Error(`${label}: request failed (${e.message})`);
  }
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
