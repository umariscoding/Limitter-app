import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  Platform,
} from 'react-native';
import { getInstalledApps, getCachedApps, InstalledApp } from '../services/appListService';
import { filterInstalledApps } from '../helpers/helper';
import type { CreateLimitState } from '../hooks/useCreateLimit';
import { showAlert } from './AppAlert';
import TimeOfDayPicker from './TimeOfDayPicker';
import { formatHHMMtoAMPM } from '../utils/timeWindow';
interface PlanLimitsData {
  planCode: string;
  maxPolicies: number;
  currentPolicies: number;
  policiesRemaining: number;
  customTimers: boolean;
}

interface CreateLimitModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (state: CreateLimitState) => void;
  existingTargetKeys?: Set<string>;
  planLimits?: PlanLimitsData | null;
}

const CATEGORIES = ['Social Media', 'Video Streaming', 'Gaming', 'Productivity', 'Education'];

export default function CreateLimitModal({ visible, onClose, onSubmit, existingTargetKeys, planLimits }: CreateLimitModalProps) {
  const [targetType, setTargetType] = useState<'app' | 'category' | 'website'>('app');
  const [timerType, setTimerType] = useState<'combined' | 'single' | 'clock'>('combined');
  const [createAppName, setCreateAppName] = useState('');
  const [selectedInstalledApp, setSelectedInstalledApp] = useState<InstalledApp | null>(null);
  const [appSearch, setAppSearch] = useState('');
  const [createCategory, setCreateCategory] = useState('');
  const [createWebsiteUrl, setCreateWebsiteUrl] = useState('');
  const [installedAppsList, setInstalledAppsList] = useState<InstalledApp[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [singleTimerValue, setSingleTimerValue] = useState('');
  const [singleTimerUnit, setSingleTimerUnit] = useState<'seconds' | 'minutes' | 'hours'>('minutes');
  const [clockHour, setClockHour] = useState('12');
  const [clockMinute, setClockMinute] = useState('00');
  const [clockPeriod, setClockPeriod] = useState<'AM' | 'PM'>('PM');
  const [endTime, setEndTime] = useState('00:00');


  useEffect(() => {
    if (!visible) return;

    const cached = getCachedApps();

    if (cached) {
      setInstalledAppsList(cached);
    } else {
      loadInstalledApps();
    }
  }, [visible]);

  const loadInstalledApps = async () => {
    setLoadingApps(true);
    try {
      const apps = await getInstalledApps();
      setInstalledAppsList(apps);
    } catch {
      setInstalledAppsList([]);
    } finally {
      setLoadingApps(false);
    }
  };

  const filteredApps = React.useMemo(() => {
    const searched = filterInstalledApps(installedAppsList, appSearch);
    if (!existingTargetKeys || existingTargetKeys.size === 0) return searched;
    return searched.filter(
      app => !existingTargetKeys.has(app.packageName.trim().toLowerCase()),
    );
  }, [appSearch, installedAppsList, existingTargetKeys]);

  const resetForm = () => {
    setCreateAppName('');
    setSelectedInstalledApp(null);
    setCreateCategory('');
    setCreateWebsiteUrl('');
    setAppSearch('');
    setHours('');
    setMinutes('');
    setSeconds('');
    setSingleTimerValue('');
    setSingleTimerUnit('minutes');
    setClockHour('12');
    setClockMinute('00');
    setClockPeriod('PM');
    setEndTime('00:00');
  };

  const handleSubmit = () => {
    if (targetType === 'website' && existingTargetKeys) {
      const normalized = createWebsiteUrl.trim().toLowerCase()
        .replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
      if (existingTargetKeys.has(`website:${normalized}`)) {
        showAlert('Already Added', 'A limit for this website already exists.');
        return;
      }
    }

    const state = {
      targetType, timerType, createAppName, selectedInstalledApp, appSearch,
      createCategory, createWebsiteUrl,
      hours, minutes, seconds, singleTimerValue, singleTimerUnit,
      clockHour, clockMinute, clockPeriod,
      dailyResetTimeLocal: endTime,
      endTimeHHMM: '',
      endTimeDay: 'today' as const,
    };
    resetForm();
    onClose();
    onSubmit(state);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.titleRow}>
            <Text style={s.title}>Create Limit</Text>
            {planLimits?.maxPolicies !== -1 && planLimits?.maxPolicies !== undefined && (
              <Text style={s.limitCounter}>
                {planLimits.currentPolicies}/{planLimits.maxPolicies}
              </Text>
            )}
          </View>
          <Text style={s.subTitle}>Target Type</Text>
          <View style={s.selectorRow}>
            <TouchableOpacity
              style={[s.selectorBtn, targetType === 'app' && s.selectorBtnActive]}
              onPress={() => setTargetType('app')}
            >
              <Text style={[s.selectorBtnText, targetType === 'app' && s.selectorBtnTextActive]}>App</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.selectorBtn, targetType === 'website' && s.selectorBtnActive]}
              onPress={() => setTargetType('website')}
            >
              <Text style={[s.selectorBtnText, targetType === 'website' && s.selectorBtnTextActive]}>Website</Text>
            </TouchableOpacity>
          </View>

          {targetType === 'app' ? (
            <>
              <TextInput
                value={appSearch}
                onChangeText={text => {
                  setAppSearch(text);
                  setCreateAppName('');
                  setSelectedInstalledApp(null);
                }}
                placeholder="Search app (e.g. instagram)"
                style={s.input}
                placeholderTextColor="#94A3B8"
              />
              <Text style={s.availableText}>
                Showing {filteredApps.length} of {installedAppsList.length} installed apps
              </Text>
              <FlatList
                data={filteredApps}
                keyExtractor={item => item.packageName}
                style={s.suggestionList}
                nestedScrollEnabled
                renderItem={({ item: app }) => (
                  <TouchableOpacity
                    style={s.suggestionItem}
                    onPress={() => {
                      setCreateAppName(app.packageName);
                      setAppSearch(app.appName);
                      setSelectedInstalledApp(app);
                    }}
                  >
                    <Text style={s.suggestionText}>{app.appName}</Text>
                  </TouchableOpacity>
                )}
                ListHeaderComponent={loadingApps ? <Text style={s.loadingAppsText}>Loading apps...</Text> : null}
                ListEmptyComponent={!loadingApps ? <Text style={s.emptyAppsText}>No apps found</Text> : null}
              />
            </>
          ) : targetType === 'category' ? (
            <View style={s.categoryWrap}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[s.categoryChip, createCategory === cat && s.categoryChipActive]}
                  onPress={() => setCreateCategory(cat)}
                >
                  <Text style={[s.categoryChipText, createCategory === cat && s.categoryChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <>
              <TextInput
                value={createWebsiteUrl}
                onChangeText={setCreateWebsiteUrl}
                placeholder="Website URL (e.g. youtube.com)"
                style={s.input}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#94A3B8"
              />
              <Text style={s.websiteNote}>
                This limit covers only this website. For example, limiting youtube.com won't limit music.youtube.com
              </Text>
            </>
          )}

          <Text style={s.subTitle}>Timer Type</Text>
          {planLimits && !planLimits.customTimers && (
            <View style={s.planRestrictionBanner}>
              <Text style={s.planRestrictionText}>
                {planLimits.planCode.toUpperCase()} plan: fixed 60-minute timer only. Upgrade for custom timers.
              </Text>
            </View>
          )}
          {(!planLimits || planLimits.customTimers) && (
            <View style={s.selectorRow}>
              {(['combined', 'clock'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.selectorBtn, timerType === t && s.selectorBtnActive]}
                  onPress={() => setTimerType(t)}
                >
                  <Text style={[s.selectorBtnText, timerType === t && s.selectorBtnTextActive]}>
                    {t === 'combined' ? 'Duration' : 'Schedule Time'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {planLimits && !planLimits.customTimers ? null : timerType === 'combined' ? (
            <View style={s.timeRow}>
              {[{ label: 'Hours', val: hours, set: setHours }, { label: 'Minutes', val: minutes, set: setMinutes }].map(f => (
                <View key={f.label} style={s.timeBox}>
                  <Text style={s.timeLabel}>{f.label}</Text>
                  <TextInput value={f.val} onChangeText={f.set} keyboardType="number-pad" style={s.timeInput} placeholder="0" placeholderTextColor="#CBD5E1" />
                </View>
              ))}
            </View>
          ) : (
            <>
              <View style={s.timeRow}>
                {[{ label: 'HH', val: clockHour, set: setClockHour }, { label: 'MM', val: clockMinute, set: setClockMinute }].map(f => (
                  <View key={f.label} style={s.timeBox}>
                    <Text style={s.timeLabel}>{f.label}</Text>
                    <TextInput value={f.val} onChangeText={f.set} keyboardType="number-pad" style={s.timeInput} />
                  </View>
                ))}
              </View>
              <View style={s.selectorRow}>
                {(['AM', 'PM'] as const).map(period => (
                  <TouchableOpacity key={period} style={[s.selectorBtn, clockPeriod === period && s.selectorBtnActive]} onPress={() => setClockPeriod(period)}>
                    <Text style={[s.selectorBtnText, clockPeriod === period && s.selectorBtnTextActive]}>{period}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          <Text style={s.endTimeHelp}>You'll be blocked after this limit</Text>
          <Text style={s.subTitle}>Reset Time</Text>
          <Text style={s.endTimeHelp}>Your limit resets daily at this time. Currently set to {formatHHMMtoAMPM(endTime)}.</Text>
          <TimeOfDayPicker
            value={endTime}
            onChange={setEndTime}
            format="12h"
            showNextPreview={false}
          />
          <View style={{ height: 10 }} />

          <View style={s.actions}>
            <TouchableOpacity style={[s.actionBtn, s.cancelBtn]} onPress={onClose}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, s.createBtn]} onPress={handleSubmit}>
              <Text style={s.createText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', paddingHorizontal: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  limitCounter: { fontSize: 13, fontWeight: '700', color: '#10B981', backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  planRestrictionBanner: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 8, padding: 10, marginBottom: 10 },
  planRestrictionText: { fontSize: 12, color: '#92400E', fontWeight: '600' },
  subTitle: { color: '#334155', fontWeight: '700', marginBottom: 8, marginTop: 4 },
  endTimeHelp: { fontSize: 12, color: '#64748B', marginBottom: 8 },
  selectorRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  selectorBtn: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingVertical: 9, alignItems: 'center', backgroundColor: '#F8FAFC' },
  selectorBtnActive: { borderColor: '#10B981', backgroundColor: '#EEF2FF' },
  selectorBtnText: { color: '#475569', fontWeight: '600', fontSize: 12 },
  selectorBtnTextActive: { color: '#10B981' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 10, fontSize: 14, color: '#0F172A', marginBottom: 10, backgroundColor: '#F8FAFC' },
  websiteNote: { fontSize: 11, color: '#64748B', marginBottom: 8, lineHeight: 16 },
  availableText: { color: '#64748B', fontSize: 11, marginBottom: 6 },
  suggestionList: { maxHeight: 180, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, backgroundColor: '#FFFFFF' },
  suggestionItem: { paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  suggestionText: { color: '#0F172A', fontSize: 14, fontWeight: '500' },
  loadingAppsText: { color: '#64748B', fontSize: 13, textAlign: 'center', padding: 12, fontWeight: '600' },
  emptyAppsText: { color: '#94A3B8', fontSize: 12, textAlign: 'center', paddingVertical: 12 },
  categoryWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  categoryChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#F8FAFC' },
  categoryChipActive: { borderColor: '#10B981', backgroundColor: '#EEF2FF' },
  categoryChipText: { color: '#475569', fontSize: 12, fontWeight: '600' },
  categoryChipTextActive: { color: '#10B981' },
  timeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  timeBox: { flex: 1 },
  timeLabel: { color: '#64748B', fontSize: 11, marginBottom: 4, fontWeight: '700' },
  timeInput: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#F8FAFC', color: '#0F172A' },
  targetBox: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 10, backgroundColor: '#F1F5F9' },
  targetText: { color: '#0F172A', fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, marginLeft: 8 },
  cancelBtn: { backgroundColor: '#E2E8F0' },
  createBtn: { backgroundColor: '#10B981' },
  cancelText: { color: '#334155', fontWeight: '700' },
  createText: { color: '#FFFFFF', fontWeight: '700' },
});
