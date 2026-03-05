import { invoke } from '@tauri-apps/api/core';

let apiBase = '';
let fetchPatched = false;
const API_READY_RETRIES = 30;
const API_READY_DELAY_MS = 80;
const API_HEALTH_TIMEOUT_MS = 600;

export function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

export function getApiBase() {
  return apiBase;
}

export function apiUrl(path = '') {
  if (!path) return apiBase;
  if (/^https?:\/\//i.test(path)) return path;
  return `${apiBase}${path}`;
}

function rewriteApiUrl(url) {
  if (!apiBase) return url;
  if (typeof url !== 'string') return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/api')) return `${apiBase}${url}`;
  return url;
}

function patchFetch() {
  if (fetchPatched || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === 'string') {
      return originalFetch(rewriteApiUrl(input), init);
    }
    if (input instanceof Request) {
      const reqUrl = rewriteApiUrl(input.url);
      if (reqUrl !== input.url) {
        return originalFetch(new Request(reqUrl, input), init);
      }
    }
    return originalFetch(input, init);
  };
  fetchPatched = true;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function isApiReady(baseUrl) {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function' || !baseUrl) return false;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_HEALTH_TIMEOUT_MS);
  try {
    const response = await window.fetch(`${baseUrl}/api/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function waitForApiReady(baseUrl) {
  for (let attempt = 0; attempt < API_READY_RETRIES; attempt += 1) {
    if (await isApiReady(baseUrl)) return true;
    await sleep(API_READY_DELAY_MS);
  }
  return false;
}

export async function initRuntime() {
  if (isTauriRuntime()) {
    try {
      const port = await invoke('get_server_port');
      if (typeof port === 'number' && Number.isFinite(port) && port > 0) {
        const primary = `http://127.0.0.1:${port}`;
        apiBase = primary;
      }
    } catch (err) {
      console.error('Failed to get backend port from Tauri:', err);
    }
  }
  patchFetch();

  if (apiBase) {
    // Do not block UI bootstrap on backend health checks.
    void waitForApiReady(apiBase).then((ready) => {
      if (!ready) {
        console.error(`Backend not ready at ${apiBase}. Requests may fail until backend starts.`);
      }
    });
  }
}
