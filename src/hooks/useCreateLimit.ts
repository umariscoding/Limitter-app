import { useState } from 'react';
import { Alert } from 'react-native';
import { createPolicyAPI } from '../services/policyService';
import { enforceDailyLimitMinutes, invalidatePlanCache } from '../services/planGuardService';
import {
  startAppClockTimer,
  startAppUsageTimer,
  startWebsiteTimer,
} from '../services/appBlockerService';
import {
  calculateTotalSecondsFromInputs,
  clockTargetTimestampMs,
  toHour24,
} from '../helpers/helper';
import type { InstalledApp } from '../services/appListService';

export interface CreateLimitState {
  targetType: 'app' | 'category' | 'website';
  timerType: 'combined' | 'single' | 'clock';
  createAppName: string;
  selectedInstalledApp: InstalledApp | null;
  appSearch: string;
  createCategory: string;
  createWebsiteUrl: string;
  hours: string;
  minutes: string;
  seconds: string;
  singleTimerValue: string;
  singleTimerUnit: 'seconds' | 'minutes' | 'hours';
  clockHour: string;
  clockMinute: string;
  clockPeriod: 'AM' | 'PM';
}

export function useCreateLimit(
  uid: string | undefined,
  deviceId: string,
  onSuccess: (label: string) => void,
  setLoading: (v: boolean) => void,
) {
  const [isCreating, setIsCreating] = useState(false);

  const createLimit = async (state: CreateLimitState) => {
    if (!uid) {
      Alert.alert('Error', 'User not logged in');
      return false;
    }
    if (!deviceId) {
      Alert.alert('Error', 'Device not ready yet. Please try again in a moment.');
      return false;
    }

    const {
      targetType, timerType, createAppName, selectedInstalledApp,
      createCategory, createWebsiteUrl,
      hours, minutes, seconds, singleTimerValue, singleTimerUnit,
      clockHour, clockMinute, clockPeriod,
    } = state;

    const appName = createAppName.trim();
    const category = createCategory.trim();
    const websiteUrl = createWebsiteUrl.trim();

    const totalSeconds = calculateTotalSecondsFromInputs({
      timerType, hours, minutes, seconds,
      singleTimerValue, singleTimerUnit, clockHour, clockMinute, clockPeriod,
    });
    const rawMinutes = Math.round(totalSeconds / 60) || 1;
    const parsedMinutes = await enforceDailyLimitMinutes(rawMinutes);

    if (targetType === 'app') {
      if (!selectedInstalledApp || !appName) {
        Alert.alert('Validation', 'Please select an app from your installed apps list');
        return false;
      }
    } else if (targetType === 'category') {
      if (!category) {
        Alert.alert('Validation', 'Category is required');
        return false;
      }
    } else {
      if (!websiteUrl) {
        Alert.alert('Validation', 'Website URL is required');
        return false;
      }
    }

    if (!Number.isFinite(totalSeconds) || totalSeconds < 60) {
      Alert.alert('Validation', 'Minimum limit is 1 minute (60 seconds)');
      return false;
    }

    setIsCreating(true);
    setLoading(true);
    try {
      const targetKey =
        targetType === 'app' ? appName
          : targetType === 'website' ? websiteUrl
            : category;
      const targetLabel =
        targetType === 'app' ? selectedInstalledApp?.appName || appName
          : targetType === 'website' ? websiteUrl
            : category;

      const response = await createPolicyAPI({
        type: targetType,
        targetKey,
        targetLabel,
        dailyLimitMinutes: parsedMinutes,
        scope: 'account',
      });

      if (response) {
        if (targetType === 'app' && selectedInstalledApp) {
          const timerStartResult =
            timerType === 'clock'
              ? await startAppClockTimer(
                  selectedInstalledApp.packageName,
                  selectedInstalledApp.appName,
                  toHour24(clockHour, clockPeriod),
                  Math.max(0, Math.min(59, Number(clockMinute || '0'))),
                )
              : await startAppUsageTimer(
                  selectedInstalledApp.packageName,
                  selectedInstalledApp.appName,
                  totalSeconds,
                );

          if (!timerStartResult.success) {
            Alert.alert(
              'Permission Required',
              'Enable Display over other apps and Usage access for Limitter.',
            );
          }
        }

        if (targetType === 'website') {
          const timerStartResult = await startWebsiteTimer({
            websiteUrl,
            durationSeconds: timerType === 'clock' ? undefined : totalSeconds,
            blockAtTimestampMs:
              timerType === 'clock'
                ? clockTargetTimestampMs(clockHour, clockMinute, clockPeriod)
                : undefined,
          });

          if (!timerStartResult.success) {
            Alert.alert(
              'Permission Required',
              'Enable Display over other apps and accessibility service for website blocking.',
            );
          }
        }

        const label =
          targetType === 'app' ? appName
            : targetType === 'category' ? category
              : websiteUrl;

        invalidatePlanCache();
        onSuccess(label);
        return true;
      } else {
        Alert.alert('Error', 'Failed to create limit');
        return false;
      }
    } catch (error: any) {
      const msg = error?.message || 'Failed to create limit';
      if (msg.includes('plan limit') || msg.includes('Plan limit')) {
        Alert.alert('Plan Limit Reached', msg);
      } else if (msg.includes('already exists')) {
        Alert.alert('Already Added', 'A limit for this app/site already exists.');
      } else {
        Alert.alert('Error', msg);
      }
      return false;
    } finally {
      setIsCreating(false);
      setLoading(false);
    }
  };

  return { createLimit, isCreating };
}
