import { AppState, type AppStateStatus } from 'react-native';

type Callback = () => void;

let online = true;
const reconnectListeners = new Set<Callback>();
const disconnectListeners = new Set<Callback>();

// Lightweight connectivity check — ping the API server
// No native module required, works without linking
async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://clients3.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.status === 204 || res.ok;
  } catch {
    return false;
  }
}

async function poll() {
  const nowOnline = await checkConnectivity();

  if (!online && nowOnline) {
    online = true;
    reconnectListeners.forEach(cb => { try { cb(); } catch { /* silenced */ } });
  } else if (online && !nowOnline) {
    online = false;
    disconnectListeners.forEach(cb => { try { cb(); } catch { /* silenced */ } });
  } else {
    online = nowOnline;
  }
}

// Poll on app foreground transitions + periodic check
let pollInterval: ReturnType<typeof setInterval> | null = null;

function startPolling() {
  if (pollInterval) return;
  poll(); // immediate check
  pollInterval = setInterval(poll, 30_000); // every 30s
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// Start on import
startPolling();

// Re-check on app foreground
AppState.addEventListener('change', (state: AppStateStatus) => {
  if (state === 'active') {
    poll();
    startPolling();
  } else if (state === 'background') {
    stopPolling();
  }
});

export function isOnline(): boolean {
  return online;
}

export function onReconnect(cb: Callback): () => void {
  reconnectListeners.add(cb);
  return () => { reconnectListeners.delete(cb); };
}

export function onDisconnect(cb: Callback): () => void {
  disconnectListeners.add(cb);
  return () => { disconnectListeners.delete(cb); };
}
