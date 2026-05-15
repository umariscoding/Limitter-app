import React, { useState } from 'react';
import { createPolicyAPI } from '../services/policyService';
import { showAlert } from '../components/AppAlert';
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
import {
  hhmmToTimestampMs,
  isValidHHMM,
  validateUntilTimestamp,
} from '../utils/timeWindow';
import { checkPermissions } from '../services/permissionsService';

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
  // New: per-limit reset boundary, "HH:MM" 24h. Defaults to "00:00".
  dailyResetTimeLocal: string;
  // New: optional default end time for blocked windows. "" means use next reset.
  endTimeHHMM: string;
  endTimeDay: 'today' | 'tomorrow';
}

export function useCreateLimit(
  uid: string | undefined,
  deviceId: string,
  onSuccess: (label: string) => void,
  setLoading: (v: boolean) => void,
) {
  const [isCreating, setIsCreating] = useState(false);
  const [needsAccessibilityDisclosure, setNeedsAccessibilityDisclosure] = useState(false);
  const pendingWebsiteStateRef = React.useRef<CreateLimitState | null>(null);

  const createLimit = async (state: CreateLimitState) => {
    if (!uid) {
      showAlert('Error', 'User not logged in');
      return false;
    }
    if (!deviceId) {
      showAlert('Error', 'Device not ready yet. Please try again in a moment.');
      return false;
    }

    const {
      targetType, timerType, createAppName, selectedInstalledApp,
      createCategory, createWebsiteUrl,
      hours, minutes, seconds, singleTimerValue, singleTimerUnit,
      clockHour, clockMinute, clockPeriod,
      dailyResetTimeLocal, endTimeHHMM, endTimeDay,
    } = state;

    const resetTime = dailyResetTimeLocal && dailyResetTimeLocal.trim() !== ''
      ? dailyResetTimeLocal.trim()
      : '00:00';
    if (!isValidHHMM(resetTime)) {
      showAlert('Validation', 'Limit reset time must be HH:MM (e.g. 06:00)');
      return false;
    }

    let lockUntilTimestampMs: number | null = null;
    if (endTimeHHMM && endTimeHHMM.trim() !== '') {
      if (!isValidHHMM(endTimeHHMM)) {
        showAlert('Validation', 'Block-until time must be HH:MM');
        return false;
      }
      const ts = hhmmToTimestampMs(endTimeHHMM, endTimeDay || 'today');
      const check = validateUntilTimestamp(ts);
      if (!check.ok) {
        showAlert('Validation', check.reason);
        return false;
      }
      lockUntilTimestampMs = check.value;
    }

    const appName = createAppName.trim();
    const category = createCategory.trim();
    const websiteUrl = createWebsiteUrl.trim().toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .replace(/\/.*$/, '');

    const totalSeconds = calculateTotalSecondsFromInputs({
      timerType, hours, minutes, seconds,
      singleTimerValue, singleTimerUnit, clockHour, clockMinute, clockPeriod,
    });
    const rawMinutes = Math.round(totalSeconds / 60) || 1;
    const parsedMinutes = await enforceDailyLimitMinutes(rawMinutes);

    if (targetType === 'app') {
      if (!selectedInstalledApp || !appName) {
        showAlert('Validation', 'Please select an app from your installed apps list');
        return false;
      }
    } else if (targetType === 'category') {
      if (!category) {
        showAlert('Validation', 'Category is required');
        return false;
      }
    } else {
      if (!websiteUrl) {
        showAlert('Validation', 'Website URL is required');
        return false;
      }
      const domainPattern = /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      const cleaned = websiteUrl.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
      if (!domainPattern.test(cleaned)) {
        showAlert('Validation', 'Enter a valid website URL (e.g. youtube.com)');
        return false;
      }
    }

    if (!Number.isFinite(totalSeconds) || totalSeconds < 60) {
      showAlert('Validation', 'Minimum limit is 1 minute (60 seconds)');
      return false;
    }

    if (targetType === 'website') {
      const perms = await checkPermissions();
      if (!perms.accessibility) {
        pendingWebsiteStateRef.current = state;
        setNeedsAccessibilityDisclosure(true);
        return false;
      }
    }

    setIsCreating(true);
    setLoading(true);
    try {
      const targetKey =
        targetType === 'app' ? selectedInstalledApp!.packageName
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
        dailyResetTimeLocal: resetTime,
        lockUntilTimestampMs,
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
            showAlert(
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
            showAlert(
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
        showAlert('Error', 'Failed to create limit');
        return false;
      }
    } catch (error: any) {
      const msg = error?.message || 'Failed to create limit';
      if (msg.includes('plan limit') || msg.includes('Plan limit')) {
        showAlert('Plan Limit Reached', msg);
      } else if (msg.includes('already exists')) {
        showAlert('Already Added', 'A limit for this app/site already exists.');
      } else {
        showAlert('Error', msg);
      }
      return false;
    } finally {
      setIsCreating(false);
      setLoading(false);
    }
  };

  const onAccessibilityDisclosureComplete = async (granted: boolean) => {
    setNeedsAccessibilityDisclosure(false);
    const pending = pendingWebsiteStateRef.current;
    pendingWebsiteStateRef.current = null;
    if (granted && pending) {
      await createLimit(pending);
    }
  };

  const onAccessibilityDisclosureDecline = () => {
    setNeedsAccessibilityDisclosure(false);
    pendingWebsiteStateRef.current = null;
  };

  return {
    createLimit,
    isCreating,
    needsAccessibilityDisclosure,
    onAccessibilityDisclosureComplete,
    onAccessibilityDisclosureDecline,
  };
}
