import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Modal,
  TextInput as RNTextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../context/UserContext';
import { usePolicyContext } from '../context/PolicyContext';
import { usePolicyFetcher } from '../hooks/usePolicyFetcher';
import { updatePolicyAPI, archivePolicyAPI, lockNowAPI } from '../services/policyService';
import BottomNav from '../components/BottomNav';
import {
  Home,
  Globe,
  Smartphone,
  Pencil,
  Trash2,
  X,
  Shield,
  Clock,
  AlertTriangle,
  Lock,
} from 'lucide-react-native';
import {
  hhmmToTimestampMs,
  isValidHHMM,
  validateUntilTimestamp,
  formatRelativeTime,
} from '../utils/timeWindow';
import {
  formatUsageTime,
  formatLimitTime,
  formatRemainingTime,
  type UIPolicy,
} from '../utils/policyMapper';
import { showAlert } from '../components/AppAlert';

export default function PoliciesScreen() {
  const navigation = useNavigation<any>();
  const { user } = useUser();
  const { policies, isLoading: loading, setPolicies } = usePolicyContext();
  const { fetchPolicies } = usePolicyFetcher();

  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<UIPolicy | null>(null);
  const [editLimitValue, setEditLimitValue] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editResetTime, setEditResetTime] = useState('00:00');
  const [editEndTimeHHMM, setEditEndTimeHHMM] = useState('');
  const [editEndTimeDay, setEditEndTimeDay] = useState<'today' | 'tomorrow'>('today');
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const [lockModalVisible, setLockModalVisible] = useState(false);
  const [lockingPolicy, setLockingPolicy] = useState<UIPolicy | null>(null);
  const [lockTimerType, setLockTimerType] = useState<'duration' | 'clock'>('duration');
  const [lockHours, setLockHours] = useState('');
  const [lockMinutes, setLockMinutes] = useState('');
  const [lockSeconds, setLockSeconds] = useState('');
  const [lockClockHour, setLockClockHour] = useState('');
  const [lockClockMinute, setLockClockMinute] = useState('');
  const [lockEndTimeDay, setLockEndTimeDay] = useState<'today' | 'tomorrow'>('today');
  const [lockError, setLockError] = useState<string | null>(null);
  const [lockLoading, setLockLoading] = useState(false);

  const fetchRef = useRef(fetchPolicies);
  fetchRef.current = fetchPolicies;

  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (hasFetchedRef.current) return;

    hasFetchedRef.current = true;
    fetchRef.current();
  }, []);

  const handleDelete = (policy: UIPolicy) => {
    showAlert(
      'Delete Limit',
      `Remove the limit for "${policy.target_label}"?\n\nYour usage data will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await archivePolicyAPI(policy.id);
              setPolicies((prev) => prev.filter((p) => p.id !== policy.id));
            } catch (err: any) {
              showAlert('Error', err?.message || 'Failed to delete limit');
            }
          },
        },
      ],
    );
  };

  const openEditModal = (policy: UIPolicy) => {
    setEditingPolicy(policy);
    setEditLimitValue(String(policy.max_time_minutes));
    setEditLabel(policy.target_label);
    setEditResetTime(policy.daily_reset_time_local || '00:00');
    setEditEndTimeHHMM('');
    setEditEndTimeDay('today');
    setEditError(null);
    setEditModalVisible(true);
  };

  const openLockModal = (policy: UIPolicy) => {
    setLockingPolicy(policy);
    setLockTimerType('duration');
    setLockHours('');
    setLockMinutes('');
    setLockSeconds('');
    setLockClockHour('');
    setLockClockMinute('');
    setLockEndTimeDay('today');
    setLockError(null);
    setLockModalVisible(true);
  };

  const handleLockConfirm = async () => {
    if (!lockingPolicy) return;
    setLockError(null);

    let untilTimestampMs: number | null = null;

    if (lockTimerType === 'clock') {
      if (lockClockHour.trim() !== '' || lockClockMinute.trim() !== '') {
        const hh = lockClockHour.padStart(2, '0');
        const mm = lockClockMinute.padStart(2, '0');
        const timeStr = `${hh}:${mm}`;
        if (!isValidHHMM(timeStr)) {
          setLockError('Time must be valid HH and MM (e.g. 21 and 00)');
          return;
        }
        const ts = hhmmToTimestampMs(timeStr, lockEndTimeDay);
        const check = validateUntilTimestamp(ts);
        if (!check.ok) {
          setLockError(check.reason);
          return;
        }
        untilTimestampMs = check.value;
      }
    } else {
      const h = parseInt(lockHours || '0', 10);
      const m = parseInt(lockMinutes || '0', 10);
      const s = parseInt(lockSeconds || '0', 10);
      if (!isNaN(h) && !isNaN(m) && !isNaN(s) && (h > 0 || m > 0 || s > 0)) {
        const totalMinutes = h * 60 + m + s / 60;
        const ts = Date.now() + Math.round(totalMinutes * 60 * 1000);
        const check = validateUntilTimestamp(ts);
        if (!check.ok) {
          setLockError(check.reason);
          return;
        }
        untilTimestampMs = check.value;
      }
    }

    setLockLoading(true);
    try {
      const result = await lockNowAPI(lockingPolicy.id, untilTimestampMs);
      const blockedUntil = result?.blockedUntil || 0;
      setPolicies((prev) =>
        prev.map((p) =>
          p.id === lockingPolicy.id
            ? { ...p, is_blocked: true, status: 'blocked' as const, blocked_until_timestamp: blockedUntil }
            : p,
        ),
      );
      setLockModalVisible(false);
    } catch (err: any) {
      setLockError(err?.message || 'Failed to lock');
    } finally {
      setLockLoading(false);
    }
  };

  const handleEditSave = async () => {
    if (!editingPolicy) return;
    setEditError(null);

    const newMinutes = Number(editLimitValue);
    if (!Number.isFinite(newMinutes) || newMinutes < 1) {
      setEditError('Minimum limit is 1 minute');
      return;
    }
    if (newMinutes > 1440) {
      setEditError('Maximum limit is 1440 minutes (24 hours)');
      return;
    }
    if (newMinutes !== editingPolicy.max_time_minutes && editingPolicy.time_used_minutes > 0) {
      setEditError('Daily limit cannot be changed after usage has started today.');
      return;
    }
    if (newMinutes !== editingPolicy.max_time_minutes && editingPolicy.is_blocked) {
      setEditError('Daily limit cannot be changed while exhausted. Use an override.');
      return;
    }

    const trimmedReset = (editResetTime || '00:00').trim();
    if (!isValidHHMM(trimmedReset)) {
      setEditError('Reset time must be HH:MM (e.g. 06:00)');
      return;
    }

    let nextLockUntilTimestampMs: number | null | undefined = undefined;
    if (editEndTimeHHMM.trim() !== '') {
      if (!isValidHHMM(editEndTimeHHMM)) {
        setEditError('End time must be HH:MM');
        return;
      }
      const ts = hhmmToTimestampMs(editEndTimeHHMM, editEndTimeDay);
      const check = validateUntilTimestamp(ts);
      if (!check.ok) {
        setEditError(check.reason);
        return;
      }
      nextLockUntilTimestampMs = check.value;
    }

    setEditLoading(true);
    try {
      const updates: any = {};
      if (newMinutes !== editingPolicy.max_time_minutes) updates.dailyLimitMinutes = newMinutes;
      if (editLabel.trim() !== editingPolicy.target_label) updates.targetLabel = editLabel.trim();
      if (trimmedReset !== (editingPolicy.daily_reset_time_local || '00:00')) {
        updates.dailyResetTimeLocal = trimmedReset;
      }
      if (nextLockUntilTimestampMs !== undefined) {
        updates.lockUntilTimestampMs = nextLockUntilTimestampMs;
      }

      if (Object.keys(updates).length === 0) {
        setEditModalVisible(false);
        return;
      }

      await updatePolicyAPI(editingPolicy.id, updates);
      setPolicies((prev) =>
        prev.map((p) =>
          p.id === editingPolicy.id
            ? {
                ...p,
                max_time_minutes: newMinutes,
                target_label: editLabel.trim(),
                daily_reset_time_local: trimmedReset,
                lock_until_timestamp_ms:
                  nextLockUntilTimestampMs !== undefined
                    ? nextLockUntilTimestampMs
                    : p.lock_until_timestamp_ms,
              }
            : p,
        ),
      );
      setEditModalVisible(false);
    } catch (err: any) {
      const msg = err?.message || 'Failed to update limit';
      setEditError(msg.length > 100 ? 'Failed to update limit. Please try again.' : msg);
    } finally {
      setEditLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    if (type === 'website') return '#6366F1';
    if (type === 'app') return '#10B981';
    return '#F59E0B';
  };

  const getTypeIcon = (type: string) => {
    if (type === 'website') return <Globe size={18} color="#FFF" />;
    if (type === 'app') return <Smartphone size={18} color="#FFF" />;
    return <Shield size={18} color="#FFF" />;
  };

  const formatTime = formatLimitTime;

  const renderPolicy = ({ item }: { item: UIPolicy }) => {
    const pct = item.max_time_minutes > 0
      ? Math.min((item.time_used_minutes / item.max_time_minutes) * 100, 100)
      : 0;
    const remaining = Math.max(0, item.max_time_minutes - item.time_used_minutes);
    const color = getTypeColor(item.target_type);

    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <View style={[s.iconBadge, { backgroundColor: color }]}>
            {getTypeIcon(item.target_type)}
          </View>
          <View style={s.cardInfo}>
            <Text style={s.cardName} numberOfLines={1}>{item.target_label}</Text>
            <View style={s.cardMeta}>
              <Clock size={11} color="#94A3B8" />
              <Text style={s.cardMetaText}>{item.target_type} · {formatLimitTime(item.max_time_minutes)} daily</Text>
            </View>
          </View>
          <View style={[
            s.statusPill,
            item.status === 'blocked' ? s.statusBlocked
              : item.status === 'active' ? s.statusActive
                : s.statusInactive,
          ]}>
            <Text style={[
              s.statusText,
              item.status === 'blocked' ? s.statusBlockedText
                : item.status === 'active' ? s.statusActiveText
                  : s.statusInactiveText,
            ]}>
              {item.status === 'blocked' ? 'BLOCKED' : item.status === 'active' ? 'ACTIVE' : 'TRACKING'}
            </Text>
          </View>
        </View>

        <View style={s.progressSection}>
          <View style={s.progressLabels}>
            <Text style={s.progressLabel}>{formatUsageTime(item.time_used_minutes)} used</Text>
            <Text style={s.progressLabel}>{formatRemainingTime(remaining)}</Text>
          </View>
          <View style={s.progressTrack}>
            <View style={[
              s.progressFill,
              { width: `${pct}%` },
              item.status === 'blocked' ? s.progressFillBlocked
                : item.status === 'active' ? s.progressFillActive
                  : s.progressFillInactive,
            ]} />
          </View>
        </View>

        <View style={s.cardActions}>
          <TouchableOpacity style={s.actionBtn} onPress={() => openEditModal(item)} activeOpacity={0.6}>
            <Pencil size={14} color="#4F46E5" />
            <Text style={s.actionEdit}>Edit</Text>
          </TouchableOpacity>
          <View style={s.actionDivider} />
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => openLockModal(item)}
            activeOpacity={0.6}
            disabled={item.is_blocked}
          >
            <Lock size={14} color={item.is_blocked ? '#CBD5E1' : '#0F172A'} />
            <Text style={[s.actionLock, item.is_blocked && s.actionLockDisabled]}>Lock Now</Text>
          </TouchableOpacity>
          <View style={s.actionDivider} />
          <TouchableOpacity style={s.actionBtn} onPress={() => handleDelete(item)} activeOpacity={0.6}>
            <Trash2 size={14} color="#EF4444" />
            <Text style={s.actionDelete}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>My Limits</Text>
          <Text style={s.headerSub}>{policies.length} active limit{policies.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={s.headerBtn} onPress={() => navigation.navigate('DashboardScreen')}>
          <Home size={20} color="#0F172A" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={s.loadingText}>Loading limits...</Text>
        </View>
      ) : policies.length === 0 ? (
        <View style={s.emptyWrap}>
          <View style={s.emptyIcon}><Shield size={36} color="#CBD5E1" /></View>
          <Text style={s.emptyTitle}>No limits yet</Text>
          <Text style={s.emptySub}>Create your first limit from the Dashboard to start managing screen time.</Text>
          <TouchableOpacity style={s.emptyCta} onPress={() => navigation.navigate('DashboardScreen')}>
            <Text style={s.emptyCtaText}>Go to Dashboard</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={policies}
          keyExtractor={(item) => item.id}
          renderItem={renderPolicy}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 90 }}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchPolicies().finally(() => setRefreshing(false)); }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal visible={editModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Edit Limit</Text>
              <TouchableOpacity style={s.modalClose} onPress={() => setEditModalVisible(false)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {editingPolicy && (
              <View style={s.modalInfo}>
                <View style={[s.iconBadgeSm, { backgroundColor: getTypeColor(editingPolicy.target_type) }]}>
                  {getTypeIcon(editingPolicy.target_type)}
                </View>
                <View>
                  <Text style={s.modalInfoName}>{editingPolicy.target_label}</Text>
                  <Text style={s.modalInfoMeta}>{editingPolicy.target_type} · Currently {formatTime(editingPolicy.max_time_minutes)}</Text>
                </View>
              </View>
            )}

            <Text style={s.fieldLabel}>Display Name</Text>
            <RNTextInput style={s.fieldInput} value={editLabel} onChangeText={setEditLabel} placeholder="Limit name" placeholderTextColor="#94A3B8" />

            <Text style={s.fieldLabel}>Daily Limit (minutes)</Text>
            <RNTextInput style={s.fieldInput} value={editLimitValue} onChangeText={setEditLimitValue} keyboardType="numeric" placeholder="e.g. 30" placeholderTextColor="#94A3B8" />

            <Text style={s.fieldLabel}>Limit Reset Time (24h HH:MM)</Text>
            <Text style={s.fieldHelp}>Applies from the next reset cycle — today's usage stays in today's bucket.</Text>
            <RNTextInput
              style={s.fieldInput}
              value={editResetTime}
              onChangeText={setEditResetTime}
              placeholder="00:00"
              placeholderTextColor="#94A3B8"
              maxLength={5}
              autoCapitalize="none"
            />

            <Text style={s.fieldLabel}>Default Block End Time (optional)</Text>
            <Text style={s.fieldHelp}>When this limit gets blocked, unblock at this time instead of next reset. Leave blank to use the reset time.</Text>
            <RNTextInput
              style={s.fieldInput}
              value={editEndTimeHHMM}
              onChangeText={setEditEndTimeHHMM}
              placeholder="e.g. 21:00"
              placeholderTextColor="#94A3B8"
              maxLength={5}
              autoCapitalize="none"
            />
            {editEndTimeHHMM ? (
              <View style={s.dayToggleRow}>
                {(['today', 'tomorrow'] as const).map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[s.dayToggle, editEndTimeDay === d && s.dayToggleActive]}
                    onPress={() => setEditEndTimeDay(d)}
                  >
                    <Text style={[s.dayToggleText, editEndTimeDay === d && s.dayToggleTextActive]}>
                      {d === 'today' ? 'Today' : 'Tomorrow'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {editingPolicy && editingPolicy.time_used_minutes > 0 && (
              <View style={s.warningBox}>
                <AlertTriangle size={14} color="#D97706" />
                <Text style={s.warningText}>{Math.round(editingPolicy.time_used_minutes)}m used today — the daily limit can't be changed until tomorrow's reset. You can still rename this limit.</Text>
              </View>
            )}

            {editError && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{editError}</Text>
              </View>
            )}

            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setEditModalVisible(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalSave} onPress={handleEditSave} disabled={editLoading}>
                {editLoading
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={s.modalSaveText}>Save Changes</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={lockModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Lock Now</Text>
              <TouchableOpacity style={s.modalClose} onPress={() => setLockModalVisible(false)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {lockingPolicy && (
              <View style={s.modalInfo}>
                <View style={[s.iconBadgeSm, { backgroundColor: getTypeColor(lockingPolicy.target_type) }]}>
                  {getTypeIcon(lockingPolicy.target_type)}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalInfoName}>{lockingPolicy.target_label}</Text>
                  <Text style={s.modalInfoMeta}>
                    Will be blocked until your next reset
                    {lockingPolicy.daily_reset_time_local ? ` (${lockingPolicy.daily_reset_time_local})` : ''}
                  </Text>
                </View>
              </View>
            )}

            <View style={s.selectorRow}>
              {(['duration', 'clock'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.selectorBtn, lockTimerType === t && s.selectorBtnActive]}
                  onPress={() => setLockTimerType(t)}
                >
                  <Text style={[s.selectorBtnText, lockTimerType === t && s.selectorBtnTextActive]}>
                    {t === 'duration' ? 'Duration' : 'Exact Time'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {lockTimerType === 'duration' ? (
              <>
                <Text style={s.fieldLabel}>Lock Duration (optional)</Text>
                <Text style={s.fieldHelp}>How long to lock for. Leave blank to lock until next reset.</Text>
                <View style={s.timeRow}>
                  <View style={s.timeBox}>
                    <Text style={s.timeLabel}>Hours</Text>
                    <RNTextInput value={lockHours} onChangeText={setLockHours} keyboardType="number-pad" style={s.timeInput} placeholder="0" placeholderTextColor="#CBD5E1" maxLength={2} />
                  </View>
                  <View style={s.timeBox}>
                    <Text style={s.timeLabel}>Minutes</Text>
                    <RNTextInput value={lockMinutes} onChangeText={setLockMinutes} keyboardType="number-pad" style={s.timeInput} placeholder="0" placeholderTextColor="#CBD5E1" maxLength={2} />
                  </View>
                  <View style={s.timeBox}>
                    <Text style={s.timeLabel}>Seconds</Text>
                    <RNTextInput value={lockSeconds} onChangeText={setLockSeconds} keyboardType="number-pad" style={s.timeInput} placeholder="0" placeholderTextColor="#CBD5E1" maxLength={2} />
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={s.fieldLabel}>Custom End Time (optional)</Text>
                <Text style={s.fieldHelp}>Override this lock's end time. Leave blank to lock until next reset.</Text>
                <View style={s.timeRow}>
                  <View style={s.timeBox}>
                    <Text style={s.timeLabel}>Hour (00-23)</Text>
                    <RNTextInput value={lockClockHour} onChangeText={setLockClockHour} keyboardType="number-pad" style={s.timeInput} placeholder="21" placeholderTextColor="#CBD5E1" maxLength={2} />
                  </View>
                  <View style={s.timeBox}>
                    <Text style={s.timeLabel}>Minute (00-59)</Text>
                    <RNTextInput value={lockClockMinute} onChangeText={setLockClockMinute} keyboardType="number-pad" style={s.timeInput} placeholder="00" placeholderTextColor="#CBD5E1" maxLength={2} />
                  </View>
                </View>
                {(lockClockHour || lockClockMinute) ? (
                  <>
                    <View style={s.dayToggleRow}>
                      {(['today', 'tomorrow'] as const).map(d => (
                        <TouchableOpacity
                          key={d}
                          style={[s.dayToggle, lockEndTimeDay === d && s.dayToggleActive]}
                          onPress={() => setLockEndTimeDay(d)}
                        >
                          <Text style={[s.dayToggleText, lockEndTimeDay === d && s.dayToggleTextActive]}>
                            {d === 'today' ? 'Today' : 'Tomorrow'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {isValidHHMM(`${lockClockHour.padStart(2, '0')}:${lockClockMinute.padStart(2, '0')}`) && (
                      <Text style={s.fieldHelp}>
                        Locks until {lockEndTimeDay === 'tomorrow' ? 'tomorrow ' : ''}{`${lockClockHour.padStart(2, '0')}:${lockClockMinute.padStart(2, '0')}`}{' '}
                        ({formatRelativeTime(hhmmToTimestampMs(`${lockClockHour.padStart(2, '0')}:${lockClockMinute.padStart(2, '0')}`, lockEndTimeDay))}).
                      </Text>
                    )}
                  </>
                ) : null}
              </>
            )}

            {lockError && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{lockError}</Text>
              </View>
            )}

            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setLockModalVisible(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalLockBtn} onPress={handleLockConfirm} disabled={lockLoading}>
                {lockLoading
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={s.modalSaveText}>Lock Now</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <BottomNav active="limits" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
  headerSub: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  headerBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, marginHorizontal: 16, marginBottom: 12, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  cardTop: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 12 },
  iconBadge: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardInfo: { flex: 1, marginRight: 8 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  cardMetaText: { fontSize: 12, color: '#94A3B8', marginLeft: 4, textTransform: 'capitalize' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  statusActive: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  statusInactive: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  statusBlocked: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  statusActiveText: { color: '#059669' },
  statusInactiveText: { color: '#64748B' },
  statusBlockedText: { color: '#DC2626' },
  progressSection: { paddingHorizontal: 16, paddingBottom: 12 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  progressTrack: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 100, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 100 },
  progressFillActive: { backgroundColor: '#10B981' },
  progressFillInactive: { backgroundColor: '#94A3B8' },
  progressFillBlocked: { backgroundColor: '#EF4444' },
  cardActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  actionDivider: { width: 1, backgroundColor: '#F1F5F9' },
  actionEdit: { fontSize: 13, fontWeight: '600', color: '#4F46E5', marginLeft: 6 },
  actionDelete: { fontSize: 13, fontWeight: '600', color: '#EF4444', marginLeft: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 13, color: '#94A3B8', marginTop: 12 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#475569', textAlign: 'center' },
  emptySub: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  emptyCta: { marginTop: 24, backgroundColor: '#10B981', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100 },
  emptyCtaText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  modalInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 20 },
  iconBadgeSm: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  modalInfoName: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  modalInfoMeta: { fontSize: 12, color: '#94A3B8', marginTop: 2, textTransform: 'capitalize' },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6 },
  fieldInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#0F172A', backgroundColor: '#FFF', marginBottom: 16 },
  warningBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FDE68A' },
  warningText: { fontSize: 12, color: '#92400E', marginLeft: 8, flex: 1, lineHeight: 16 },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' },
  errorText: { fontSize: 12, color: '#DC2626' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  modalSave: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#4F46E5', alignItems: 'center' },
  modalSaveText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  modalLockBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#0F172A', alignItems: 'center' },
  fieldHelp: { fontSize: 11, color: '#94A3B8', marginTop: -2, marginBottom: 6 },
  dayToggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  dayToggle: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#F8FAFC' },
  dayToggleActive: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  dayToggleText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  dayToggleTextActive: { color: '#4F46E5' },
  actionLock: { fontSize: 13, fontWeight: '600', color: '#0F172A', marginLeft: 6 },
  actionLockDisabled: { color: '#CBD5E1' },
  selectorRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  selectorBtn: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: '#F8FAFC' },
  selectorBtnActive: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  selectorBtnText: { color: '#475569', fontWeight: '600', fontSize: 13 },
  selectorBtnTextActive: { color: '#4F46E5' },
  timeRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  timeBox: { flex: 1 },
  timeLabel: { color: '#64748B', fontSize: 12, marginBottom: 4, fontWeight: '700' },
  timeInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', color: '#0F172A', fontSize: 16, textAlign: 'center' },
});
