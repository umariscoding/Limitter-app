import { NativeEventEmitter } from 'react-native';
import { addLimitHistoryEntry } from '../utils/limitHistoryService';
import { TimerEventModule, warnIfCustomNativeMissing } from './limitterNativeModules';

type TimerTickEvent = {
  package: string;
  appName: string;
  remaining: number;
  isBlocked: boolean;
  status?: 'waiting' | 'active' | 'blocked';
  blockedAt?: number;
};

type TimerBlockedEvent = {
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

const blockedTransitionMap = new Map<string, boolean>();

const handleTick = async (event: TimerTickEvent) => {
  tickListeners.forEach(listener => listener(event));

  const wasBlocked = blockedTransitionMap.get(event.package) || false;
  if (event.isBlocked && !wasBlocked) {
    blockedTransitionMap.set(event.package, true);
    const blockedAt = Number(event.blockedAt || Date.now());

    await addLimitHistoryEntry({
      appName: event.appName || event.package,
      packageName: event.package,
      timestamp: blockedAt,
      type: 'blocked',
      overrideUsed: false,
    });

    blockedListeners.forEach(listener =>
      listener({
        package: event.package,
        appName: event.appName,
        blockedAt,
      })
    );
  } else if (!event.isBlocked) {
    blockedTransitionMap.set(event.package, false);
  }
};

const handleBlocked = async (event: TimerBlockedEvent) => {
  const blockedAt = Number(event.blockedAt || Date.now());
  blockedTransitionMap.set(event.package, true);

  await addLimitHistoryEntry({
    appName: event.appName || event.package,
    packageName: event.package,
    timestamp: blockedAt,
    type: 'blocked',
    overrideUsed: false,
  });

  blockedListeners.forEach(listener =>
    listener({
      package: event.package,
      appName: event.appName,
      blockedAt,
    })
  );
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
    void handleTick(event);
  });

  blockedSubscription = eventEmitter.addListener('TIMER_BLOCKED', (event: TimerBlockedEvent) => {
    void handleBlocked(event);
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
