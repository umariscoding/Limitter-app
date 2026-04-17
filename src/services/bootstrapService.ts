import { bootstrap } from "../auth/firebaseAuthService";

const DEDUP_WINDOW_MS = 2000;

let inFlight: Promise<any> | null = null;
let inFlightStartedAt = 0;

export async function refreshBootstrap(): Promise<any> {
  const now = Date.now();
  if (inFlight && now - inFlightStartedAt < DEDUP_WINDOW_MS) {
    return inFlight;
  }

  inFlightStartedAt = now;
  inFlight = (async () => {
    try {
      return await bootstrap();
    } finally {
      setTimeout(() => {
        if (inFlightStartedAt === now) {
          inFlight = null;
          inFlightStartedAt = 0;
        }
      }, DEDUP_WINDOW_MS);
    }
  })();

  return inFlight;
}
