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
import { getInstalledApps, InstalledApp } from '../services/appListService';
import { getWebsiteBlockerStatus } from '../services/appBlockerService';
import { filterInstalledApps } from '../helpers/helper';
import type { CreateLimitState } from '../hooks/useCreateLimit';

interface CreateLimitModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (state: CreateLimitState) => void;
  existingTargetKeys?: Set<string>;
}

const CATEGORIES = ['Social Media', 'Video Streaming', 'Gaming', 'Productivity', 'Education'];

export default function CreateLimitModal({ visible, onClose, onSubmit, existingTargetKeys }: CreateLimitModalProps) {
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
  const [websiteStatusLoading, setWebsiteStatusLoading] = useState(false);
  const [websiteStatus, setWebsiteStatus] = useState<{
    overlayEnabled: boolean;
    accessibilityEnabled: boolean;
    ready: boolean;
  } | null>(null);

  useEffect(() => {
    if (visible && installedAppsList.length === 0) {
      loadInstalledApps();
    }
  }, [visible]);

  useEffect(() => {
    if (visible && targetType === 'website') {
      refreshWebsiteStatus();
    }
  }, [visible, targetType]);

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

  const refreshWebsiteStatus = async () => {
    setWebsiteStatusLoading(true);
    try {
      const status = await getWebsiteBlockerStatus();
      setWebsiteStatus({
        overlayEnabled: status.overlayEnabled,
        accessibilityEnabled: status.accessibilityEnabled,
        ready: status.ready,
      });
    } finally {
      setWebsiteStatusLoading(false);
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
  };

  const handleSubmit = () => {
    onSubmit({
      targetType, timerType, createAppName, selectedInstalledApp, appSearch,
      createCategory, createWebsiteUrl,
      hours, minutes, seconds, singleTimerValue, singleTimerUnit,
      clockHour, clockMinute, clockPeriod,
    });
    resetForm();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title}>Create Limit</Text>
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
                    <Text style={s.suggestionSub}>{app.packageName}</Text>
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
              <View style={s.wsCard}>
                <View style={s.wsHeader}>
                  <Text style={s.wsTitle}>Website Service Status</Text>
                  <TouchableOpacity style={s.wsRefreshBtn} onPress={refreshWebsiteStatus} disabled={websiteStatusLoading}>
                    <Text style={s.wsRefreshText}>{websiteStatusLoading ? 'Checking...' : 'Refresh'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.wsRow}>
                  <Text style={s.wsLabel}>Overlay</Text>
                  <Text style={[s.wsValue, websiteStatus?.overlayEnabled ? s.wsOk : s.wsErr]}>
                    {websiteStatus?.overlayEnabled ? 'Enabled' : 'Missing'}
                  </Text>
                </View>
                <View style={s.wsRow}>
                  <Text style={s.wsLabel}>Accessibility</Text>
                  <Text style={[s.wsValue, websiteStatus?.accessibilityEnabled ? s.wsOk : s.wsErr]}>
                    {websiteStatus?.accessibilityEnabled ? 'Enabled' : 'Missing'}
                  </Text>
                </View>
                <Text style={[s.wsReady, websiteStatus?.ready ? s.wsOk : s.wsErr]}>
                  {websiteStatus?.ready ? 'Website tracking is ready.' : 'Enable missing permissions before creating website limits.'}
                </Text>
              </View>
            </>
          )}

          <Text style={s.subTitle}>Timer Type</Text>
          <View style={s.selectorRow}>
            {(['combined', 'single', 'clock'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[s.selectorBtn, timerType === t && s.selectorBtnActive]}
                onPress={() => setTimerType(t)}
              >
                <Text style={[s.selectorBtnText, timerType === t && s.selectorBtnTextActive]}>
                  {t === 'combined' ? 'H:M:S' : t === 'single' ? 'Single Unit' : 'Exact Time'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {timerType === 'combined' ? (
            <View style={s.timeRow}>
              {[{ label: 'H', val: hours, set: setHours }, { label: 'M', val: minutes, set: setMinutes }, { label: 'S', val: seconds, set: setSeconds }].map(f => (
                <View key={f.label} style={s.timeBox}>
                  <Text style={s.timeLabel}>{f.label}</Text>
                  <TextInput value={f.val} onChangeText={f.set} keyboardType="number-pad" style={s.timeInput} />
                </View>
              ))}
            </View>
          ) : timerType === 'single' ? (
            <>
              <TextInput
                value={singleTimerValue}
                onChangeText={setSingleTimerValue}
                placeholder="Enter timer value"
                keyboardType="number-pad"
                style={s.input}
                placeholderTextColor="#94A3B8"
              />
              <View style={s.selectorRow}>
                {(['seconds', 'minutes', 'hours'] as const).map(unit => (
                  <TouchableOpacity key={unit} style={[s.selectorBtn, singleTimerUnit === unit && s.selectorBtnActive]} onPress={() => setSingleTimerUnit(unit)}>
                    <Text style={[s.selectorBtnText, singleTimerUnit === unit && s.selectorBtnTextActive]}>{unit}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
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

          <View style={s.targetBox}>
            <Text style={s.targetText}>
              {targetType === 'app' ? createAppName || 'No app selected'
                : targetType === 'category' ? createCategory || 'No category selected'
                : createWebsiteUrl || 'No website selected'}
            </Text>
          </View>
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
  title: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  subTitle: { color: '#334155', fontWeight: '700', marginBottom: 8, marginTop: 4 },
  selectorRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  selectorBtn: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingVertical: 9, alignItems: 'center', backgroundColor: '#F8FAFC' },
  selectorBtnActive: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  selectorBtnText: { color: '#475569', fontWeight: '600', fontSize: 12 },
  selectorBtnTextActive: { color: '#3730A3' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 10, fontSize: 14, color: '#0F172A', marginBottom: 10, backgroundColor: '#F8FAFC' },
  availableText: { color: '#64748B', fontSize: 11, marginBottom: 6 },
  suggestionList: { maxHeight: 240, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, backgroundColor: '#FFFFFF' },
  suggestionItem: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  suggestionText: { color: '#0F172A', fontSize: 12 },
  suggestionSub: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  loadingAppsText: { color: '#64748B', fontSize: 13, textAlign: 'center', padding: 12, fontWeight: '600' },
  emptyAppsText: { color: '#94A3B8', fontSize: 12, textAlign: 'center', paddingVertical: 12 },
  categoryWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  categoryChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#F8FAFC' },
  categoryChipActive: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  categoryChipText: { color: '#475569', fontSize: 12, fontWeight: '600' },
  categoryChipTextActive: { color: '#3730A3' },
  timeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  timeBox: { flex: 1 },
  timeLabel: { color: '#64748B', fontSize: 11, marginBottom: 4, fontWeight: '700' },
  timeInput: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#F8FAFC', color: '#0F172A' },
  wsCard: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, backgroundColor: '#FFFFFF' },
  wsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  wsTitle: { color: '#0F172A', fontSize: 12, fontWeight: '700' },
  wsRefreshBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#EEF2FF' },
  wsRefreshText: { color: '#3730A3', fontWeight: '700', fontSize: 11 },
  wsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  wsLabel: { color: '#64748B', fontSize: 12 },
  wsValue: { fontSize: 12, fontWeight: '700' },
  wsOk: { color: '#166534' },
  wsErr: { color: '#B91C1C' },
  wsReady: { marginTop: 8, fontSize: 11, fontWeight: '600' },
  targetBox: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 10, backgroundColor: '#F1F5F9' },
  targetText: { color: '#0F172A', fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, marginLeft: 8 },
  cancelBtn: { backgroundColor: '#E2E8F0' },
  createBtn: { backgroundColor: '#4F46E5' },
  cancelText: { color: '#334155', fontWeight: '700' },
  createText: { color: '#FFFFFF', fontWeight: '700' },
});
