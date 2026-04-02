import { NativeEventEmitter } from 'react-native';
import { TimerEventModule, warnIfCustomNativeMissing } from '../config/nativeModules';

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
