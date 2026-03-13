import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    FlatList, Alert, NativeModules, NativeEventEmitter,
    ScrollView, StatusBar, Animated, ActivityIndicator,
    DeviceEventEmitter,
} from 'react-native';

const { LimitterModule } = NativeModules;

interface AppInfo { name: string; package: string; }
type Step = 'timer' | 'apps' | 'running' | 'blocked';

const POPULAR_APPS = [
    { name: 'Instagram', package: 'com.instagram.android', icon: '📸', color: '#E1306C' },
    { name: 'WhatsApp', package: 'com.whatsapp', icon: '💬', color: '#25D366' },
    { name: 'YouTube', package: 'com.google.android.youtube', icon: '▶️', color: '#FF0000' },
    { name: 'Snapchat', package: 'com.snapchat.android', icon: '👻', color: '#FFFC00' },
    { name: 'Messenger', package: 'com.facebook.orca', icon: '🔵', color: '#006AFF' },
    { name: 'TikTok', package: 'com.zhiliaoapp.musically', icon: '🎵', color: '#ee1d52' },
    { name: 'Spotify', package: 'com.spotify.music', icon: '🎧', color: '#1DB954' },
    { name: 'Facebook', package: 'com.facebook.katana', icon: '👍', color: '#1877F2' },
    { name: 'Telegram', package: 'org.telegram.messenger', icon: '✈️', color: '#0088cc' },
    { name: 'Twitter/X', package: 'com.twitter.android', icon: '🐦', color: '#1DA1F2' },
    { name: 'Netflix', package: 'com.netflix.mediaclient', icon: '🎬', color: '#E50914' },
    { name: 'Reddit', package: 'com.reddit.frontpage', icon: '🤖', color: '#FF4500' },
];

const C = {
    bg: '#0f0c29', surface: 'rgba(255,255,255,0.07)', border: 'rgba(255,255,255,0.12)',
    primary: '#7c3aed', primaryLight: '#a78bfa',
    danger: '#ef4444', text: '#ffffff', muted: '#6b7280', secondary: '#c4b5fd',
};

export default function App() {
    const [step, setStep] = useState<Step>('timer');
    const [timeUnit, setTimeUnit] = useState<'seconds' | 'hours'>('seconds');
    const [timeValue, setTimeValue] = useState('');
    const [installed, setInstalled] = useState<any[]>([]);
    const [selectedApp, setSelected] = useState<AppInfo | null>(null);
    const [totalSecs, setTotal] = useState(0);
    const [remaining, setRemaining] = useState(0);
    const [loading, setLoading] = useState(false);
    const [permOk, setPermOk] = useState(false);
    const [notifMsg, setNotifMsg] = useState('');
    const notifOpacity = useRef(new Animated.Value(0)).current;

    // ── Permissions on mount ─────────────────────────────────
    useEffect(() => { checkPerms(); }, []);

    // ── Listen to native timer broadcasts ───────────────────
    // Native service broadcasts every second with remaining time
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('TIMER_TICK', (data: any) => {
            const r = data?.remaining ?? 0;
            const blocked = data?.isBlocked ?? false;
            setRemaining(r);
            if (blocked && step !== 'blocked') {
                setStep('blocked');
            }
        });
        return () => sub.remove();
    }, [step]);

    const checkPerms = async () => {
        try {
            const p = await LimitterModule.checkPermissions();
            setPermOk(p.overlay && p.usage);
            if (!p.overlay || !p.usage) {
                await LimitterModule.checkAndRequestPermissions();
                setTimeout(checkPerms, 3000);
            }
        } catch { setPermOk(true); }
    };

    const showNotif = (msg: string) => {
        setNotifMsg(msg);
        Animated.sequence([
            Animated.timing(notifOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.delay(2500),
            Animated.timing(notifOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();
    };

    const loadApps = async () => {
        setLoading(true);
        try {
            const apps: AppInfo[] = await LimitterModule.getInstalledApps();
            const pkgs = new Set(apps.map(a => a.package));
            const pop = POPULAR_APPS.filter(p => pkgs.has(p.package));
            const rest = apps
                .filter(a => !POPULAR_APPS.find(p => p.package === a.package))
                .map(a => ({ ...a, icon: '📱', color: C.primary }));
            setInstalled([...pop, ...rest]);
        } catch { setInstalled(POPULAR_APPS); }
        setLoading(false);
    };

    const handleSetTimer = () => {
        const val = parseInt(timeValue);
        if (!val || val <= 0) { Alert.alert('Invalid', 'Enter a valid time.'); return; }
        const secs = timeUnit === 'hours' ? val * 3600 : val;
        setTotal(secs);
        setRemaining(secs);
        showNotif('✅ Timer set! Now select the app to limit.');
        loadApps();
        setTimeout(() => setStep('apps'), 500);
    };

    const handleStart = async () => {
        if (!selectedApp) { Alert.alert('Select App', 'Please select an app first.'); return; }
        try {
            await LimitterModule.showNotification(
                `⏱ Timer set for ${selectedApp.name}. You have ${fmt(totalSecs)}.`
            );
            const result = await LimitterModule.sendCommand('START', {
                package: selectedApp.package,
                appName: selectedApp.name,
                duration: totalSecs,
                timeUnit: 'seconds',
            });
            if (result === 'PERMISSION_OVERLAY_REQUIRED' || result === 'PERMISSION_USAGE_REQUIRED') {
                Alert.alert('Permission Required', 'Grant Overlay & Usage Access then try again.',
                    [{ text: 'Grant', onPress: checkPerms }]);
                return;
            }
            showNotif(`🚀 ${selectedApp.name} will be blocked in ${fmt(totalSecs)}`);
            setStep('running');
        } catch (e: any) { Alert.alert('Error', e?.message || 'Failed to start'); }
    };

    const reset = async () => {
        try { await LimitterModule.sendCommand('STOP', {}); } catch { }
        setStep('timer'); setTimeValue(''); setSelected(null); setTotal(0); setRemaining(0);
    };

    const fmt = (s: number) => {
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
        return h > 0
            ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
            : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };

    const progress = totalSecs > 0 ? (totalSecs - remaining) / totalSecs : 0;

    return (
        <View style={s.root}>
            <StatusBar barStyle="light-content" backgroundColor={C.bg} />

            <Animated.View style={[s.toast, { opacity: notifOpacity }]}>
                <Text style={s.toastTxt}>{notifMsg}</Text>
            </Animated.View>

            {!permOk && (
                <TouchableOpacity style={s.permBanner} onPress={checkPerms}>
                    <Text style={s.permTxt}>⚠️ Permissions needed. Tap to grant.</Text>
                </TouchableOpacity>
            )}

            {/* ── STEP 1: SET TIMER ── */}
            {step === 'timer' && (
                <ScrollView contentContainerStyle={s.screen}>
                    <Text style={s.title}>⏱ AppGuard</Text>
                    <Text style={s.subtitle}>Screen Time Limiter</Text>
                    <View style={s.card}>
                        <Text style={s.cardTitle}>Set Your Timer</Text>
                        <View style={s.toggle}>
                            {(['seconds', 'hours'] as const).map(u => (
                                <TouchableOpacity key={u} style={[s.tBtn, timeUnit === u && s.tBtnOn]}
                                    onPress={() => { setTimeUnit(u); setTimeValue(''); }}>
                                    <Text style={[s.tTxt, timeUnit === u && s.tTxtOn]}>
                                        {u === 'seconds' ? '⚡ Seconds' : '🕐 Hours'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TextInput style={s.input}
                            placeholder={timeUnit === 'seconds' ? 'e.g. 30' : 'e.g. 1'}
                            placeholderTextColor={C.muted} value={timeValue}
                            onChangeText={setTimeValue} keyboardType="numeric" maxLength={4} />
                        {!!timeValue && parseInt(timeValue) > 0 && (
                            <Text style={s.preview}>
                                = {fmt(timeUnit === 'hours' ? parseInt(timeValue) * 3600 : parseInt(timeValue))}
                            </Text>
                        )}
                        <Text style={s.label}>Quick Presets</Text>
                        <View style={s.presets}>
                            {([
                                { l: '10s', v: '10', u: 'seconds' }, { l: '30s', v: '30', u: 'seconds' },
                                { l: '1 min', v: '60', u: 'seconds' }, { l: '5 min', v: '300', u: 'seconds' },
                                { l: '1 hr', v: '1', u: 'hours' }, { l: '2 hr', v: '2', u: 'hours' },
                            ] as any[]).map(p => (
                                <TouchableOpacity key={p.l} style={s.presetBtn}
                                    onPress={() => { setTimeUnit(p.u); setTimeValue(p.v); }}>
                                    <Text style={s.presetTxt}>{p.l}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TouchableOpacity
                            style={[s.btn, (!timeValue || parseInt(timeValue) <= 0) && s.btnOff]}
                            onPress={handleSetTimer} disabled={!timeValue || parseInt(timeValue) <= 0}>
                            <Text style={s.btnTxt}>Next: Select App →</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            )}

            {/* ── STEP 2: SELECT APP ── */}
            {step === 'apps' && (
                <View style={s.screen}>
                    <View style={s.stepHdr}>
                        <TouchableOpacity onPress={() => setStep('timer')}>
                            <Text style={s.back}>← Back</Text>
                        </TouchableOpacity>
                        <Text style={s.stepTitle}>📱 Select App to Block</Text>
                    </View>
                    <Text style={s.stepSub}>Timer: {fmt(totalSecs)} • Select ONE app</Text>
                    {loading
                        ? <View style={s.loadBox}><ActivityIndicator color={C.primary} size="large" /><Text style={s.loadTxt}>Loading apps...</Text></View>
                        : (
                            <FlatList
                                data={installed}
                                keyExtractor={i => i.package}
                                numColumns={2}
                                columnWrapperStyle={{ gap: 12, marginBottom: 12, paddingHorizontal: 16 }}
                                contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}
                                showsVerticalScrollIndicator={false}
                                renderItem={({ item }) => {
                                    const sel = selectedApp?.package === item.package;
                                    const pop = POPULAR_APPS.find(p => p.package === item.package);
                                    const icon = pop?.icon || '📱';
                                    const col = pop?.color || C.primary;
                                    return (
                                        <TouchableOpacity
                                            style={[s.appCard, sel && { borderColor: col, backgroundColor: col + '22' }]}
                                            onPress={() => setSelected(item)} activeOpacity={0.8}>
                                            {sel && (
                                                <View style={[s.check, { backgroundColor: col }]}>
                                                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text>
                                                </View>
                                            )}
                                            <Text style={{ fontSize: 32, marginBottom: 8 }}>{icon}</Text>
                                            <Text style={[s.appName, sel && { color: '#fff' }]} numberOfLines={1}>
                                                {item.name}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        )
                    }
                    <View style={s.bottomBar}>
                        <TouchableOpacity style={[s.btn, !selectedApp && s.btnOff]}
                            onPress={handleStart} disabled={!selectedApp}>
                            <Text style={s.btnTxt}>
                                {selectedApp ? `🚀 Block ${selectedApp.name} after ${fmt(totalSecs)}` : 'Select an app first'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* ── STEP 3: TIMER RUNNING ── */}
            {step === 'running' && selectedApp && (
                <ScrollView contentContainerStyle={s.screen}>
                    <Text style={s.title}>⏱ Timer Running</Text>
                    <Text style={s.subtitle}>You can use your phone normally</Text>

                    {/* Big countdown — synced from native */}
                    <View style={s.ring}>
                        <View style={[s.ringInner, { borderColor: remaining <= 10 ? C.danger : C.primary }]}>
                            <Text style={[s.ringTime, remaining <= 10 && { color: C.danger }]}>
                                {fmt(remaining)}
                            </Text>
                            <Text style={s.ringSub}>remaining</Text>
                        </View>
                    </View>

                    <View style={s.pBarWrap}>
                        <View style={[s.pBarFill, {
                            width: `${Math.min(progress * 100, 100)}%` as any,
                            backgroundColor: remaining <= 10 ? C.danger : C.primary,
                        }]} />
                    </View>

                    <View style={s.card}>
                        <Text style={s.label}>🔒 Will auto-block when timer ends:</Text>
                        <View style={s.appRow}>
                            <Text style={{ fontSize: 32 }}>
                                {POPULAR_APPS.find(p => p.package === selectedApp.package)?.icon || '📱'}
                            </Text>
                            <View>
                                <Text style={s.appRowName}>{selectedApp.name}</Text>
                                <Text style={s.appRowPkg}>{selectedApp.package}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={[s.card, { backgroundColor: 'rgba(5,150,105,0.1)', borderColor: 'rgba(5,150,105,0.3)' }]}>
                        <Text style={{ color: '#86efac', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                            ✅ Timer runs in background automatically.{'\n'}
                            When time ends, {selectedApp.name} will be blocked instantly — even if you're using it.
                        </Text>
                    </View>

                    <TouchableOpacity style={s.cancelBtn} onPress={() =>
                        Alert.alert('Cancel Timer?', 'This will stop the timer and unblock the app.', [
                            { text: 'No', style: 'cancel' },
                            { text: 'Yes, Cancel', style: 'destructive', onPress: reset },
                        ])}>
                        <Text style={s.cancelTxt}>✕ Cancel Timer</Text>
                    </TouchableOpacity>
                </ScrollView>
            )}

            {/* ── STEP 4: BLOCKED ── */}
            {step === 'blocked' && selectedApp && (
                <ScrollView contentContainerStyle={s.screen}>
                    <Text style={{ fontSize: 80, textAlign: 'center', marginBottom: 16 }}>🚫</Text>
                    <Text style={s.blockedTitle}>Time's Up!</Text>
                    <Text style={s.blockedSub}>
                        {selectedApp.name} is now blocked.{'\n'}
                        If you open it, a block screen will appear automatically.
                    </Text>

                    <View style={[s.card, { borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                        <View style={s.appRow}>
                            <Text style={{ fontSize: 36 }}>
                                {POPULAR_APPS.find(p => p.package === selectedApp.package)?.icon || '📱'}
                            </Text>
                            <View>
                                <Text style={s.appRowName}>{selectedApp.name}</Text>
                                <Text style={[s.appRowPkg, { color: C.danger }]}>🔒 BLOCKED</Text>
                            </View>
                        </View>
                    </View>

                    <View style={[s.card, { backgroundColor: 'rgba(124,58,237,0.1)' }]}>
                        <Text style={s.motivTitle}>💡 Take a Break!</Text>
                        <Text style={s.motivTxt}>Drink water, stretch, or go for a walk. 🧠</Text>
                    </View>

                    <TouchableOpacity style={s.btn} onPress={reset}>
                        <Text style={s.btnTxt}>🔄 Set New Timer</Text>
                    </TouchableOpacity>
                </ScrollView>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    screen: { flexGrow: 1, padding: 20, paddingTop: 60, paddingBottom: 40 },
    toast: { position: 'absolute', top: 20, left: 20, right: 20, zIndex: 999, backgroundColor: 'rgba(124,58,237,0.9)', borderRadius: 14, padding: 14, alignItems: 'center' },
    toastTxt: { color: '#fff', fontWeight: '600', fontSize: 14 },
    permBanner: { backgroundColor: 'rgba(239,68,68,0.2)', padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(239,68,68,0.3)' },
    permTxt: { color: '#fca5a5', fontSize: 13, textAlign: 'center' },
    title: { fontSize: 36, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -1 },
    subtitle: { color: C.primaryLight, fontSize: 15, textAlign: 'center', marginBottom: 32, marginTop: 4 },
    card: { backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 20, marginBottom: 16 },
    cardTitle: { color: C.text, fontWeight: '700', fontSize: 18, marginBottom: 20 },
    toggle: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 4, marginBottom: 16 },
    tBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
    tBtnOn: { backgroundColor: C.primary },
    tTxt: { color: C.muted, fontWeight: '600', fontSize: 14 },
    tTxtOn: { color: '#fff' },
    input: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 20, paddingVertical: 16, fontSize: 28, fontWeight: '700', color: C.text, marginBottom: 8 },
    preview: { color: C.primaryLight, fontSize: 14, marginBottom: 20, textAlign: 'center' },
    label: { color: C.secondary, fontSize: 13, fontWeight: '600', marginBottom: 10 },
    presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    presetBtn: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: C.border },
    presetTxt: { color: C.secondary, fontWeight: '600', fontSize: 13 },
    btn: { backgroundColor: C.primary, borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: C.primary, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
    btnOff: { opacity: 0.35, shadowOpacity: 0 },
    btnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
    stepHdr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, marginBottom: 4, paddingTop: 52 },
    back: { color: C.primaryLight, fontSize: 16 },
    stepTitle: { color: C.text, fontWeight: '700', fontSize: 18 },
    stepSub: { color: C.muted, fontSize: 13, paddingHorizontal: 16, marginBottom: 12 },
    loadBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 60 },
    loadTxt: { color: C.muted, fontSize: 15 },
    appCard: { flex: 1, backgroundColor: C.surface, borderRadius: 18, borderWidth: 2, borderColor: C.border, padding: 16, alignItems: 'center', minHeight: 110, justifyContent: 'center', position: 'relative' },
    check: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    appName: { color: C.secondary, fontWeight: '600', fontSize: 12, textAlign: 'center' },
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border },
    ring: { alignItems: 'center', marginBottom: 20, marginTop: 8 },
    ringInner: { width: 200, height: 200, borderRadius: 100, borderWidth: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124,58,237,0.1)' },
    ringTime: { fontSize: 38, fontWeight: '800', color: C.text, letterSpacing: -2 },
    ringSub: { color: C.muted, fontSize: 12, fontWeight: '600', letterSpacing: 2, marginTop: 4 },
    pBarWrap: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, marginBottom: 24, overflow: 'hidden' },
    pBarFill: { height: '100%', borderRadius: 3 },
    appRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
    appRowName: { color: C.text, fontWeight: '700', fontSize: 16 },
    appRowPkg: { color: C.muted, fontSize: 11, marginTop: 2 },
    cancelBtn: { borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', marginTop: 8 },
    cancelTxt: { color: C.danger, fontWeight: '600', fontSize: 15 },
    blockedTitle: { fontSize: 36, fontWeight: '800', color: C.danger, textAlign: 'center', marginBottom: 12 },
    blockedSub: { color: C.muted, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
    motivTitle: { color: C.primaryLight, fontWeight: '700', fontSize: 15, marginBottom: 8 },
    motivTxt: { color: C.secondary, fontSize: 14, lineHeight: 22 },
});