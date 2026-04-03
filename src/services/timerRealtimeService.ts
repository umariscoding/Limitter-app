import { NativeEventEmitter } from 'react-native';
import { TimerEventModule, warnIfCustomNativeMissing } from '../config/nativeModules';
import { realtimeDB } from '../config/firebase';
import { ref, onValue, off } from 'firebase/database';

export type TimerTickEvent = {
  package: string;
  appName: string;
  remaining: number;
  isBlocked: boolean;
  status?: 'waiting' | 'active' | 'blocked';
  blockedAt?: number;
};

export type TimerBlockedEvent = {
  package: string;
  appName: string;
  blockedAt?: number;
};

const tickListeners = new Set<(event: TimerTickEvent) => void>();
const blockedListeners = new Set<(event: TimerBlockedEvent) => void>();

let eventEmitter: NativeEventEmitter | null = null;
let tickSubscription: { remove: () => void } | null = null;
let blockedSubscription: { remove: () => void } | null = null;
let isStarted = false;

const handleTick = (event: TimerTickEvent) => {
  tickListeners.forEach(listener => listener(event));
};

const handleBlocked = (event: TimerBlockedEvent) => {
  blockedListeners.forEach(listener => listener(event));
};

export const startTimerRealtimeTracking = () => {
  if (isStarted) return;
  if (!TimerEventModule) {
    warnIfCustomNativeMissing();
    return;
  }

  eventEmitter = new NativeEventEmitter(TimerEventModule);
  TimerEventModule.startListening?.();

  tickSubscription = eventEmitter.addListener('TIMER_TICK', (event: TimerTickEvent) => {
    handleTick(event);
  });

  blockedSubscription = eventEmitter.addListener('TIMER_BLOCKED', (event: TimerBlockedEvent) => {
    handleBlocked(event);
  });

  isStarted = true;
};

export const stopTimerRealtimeTracking = () => {
  tickSubscription?.remove();
  blockedSubscription?.remove();
  tickSubscription = null;
  blockedSubscription = null;
  TimerEventModule?.stopListening?.();
  isStarted = false;
};

export const subscribeTimerTicks = (listener: (event: TimerTickEvent) => void) => {
  tickListeners.add(listener);
  return () => {
    tickListeners.delete(listener);
  };
};

export const subscribeTimerBlocked = (listener: (event: TimerBlockedEvent) => void) => {
  blockedListeners.add(listener);
  return () => {
    blockedListeners.delete(listener);
  };
};

export interface LiveLockEvent {
  policyId: string;
  targetKey: string;
  isLocked: boolean;
  blockedUntil: number | null;
  reason: string;
}

type LockChangeListener = (locks: Record<string, LiveLockEvent>) => void;

let lockListenerUnsubscribe: (() => void) | null = null;

export const subscribeLockState = (
  accountId: string,
  listener: LockChangeListener,
): (() => void) => {
  const locksRef = ref(realtimeDB, `live/accounts/${accountId}/locks`);

  const handler = onValue(locksRef, (snapshot) => {
    const val = snapshot.val();
    if (!val) {
      listener({});
      return;
    }
    listener(val as Record<string, LiveLockEvent>);
  });

  const unsubscribe = () => {
    off(locksRef);
  };

  lockListenerUnsubscribe = unsubscribe;
  return unsubscribe;
};

export const unsubscribeLockState = () => {
  lockListenerUnsubscribe?.();
  lockListenerUnsubscribe = null;
};
