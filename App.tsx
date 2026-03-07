import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  NativeModules,
  Alert,
  TextInput,
  ActivityIndicator,
  AppState,
  ScrollView,
  NativeEventEmitter,
  Linking,
} from 'react-native';

const { LimitterModule, TimerEventModule } = NativeModules;

import { startCategoryService } from './src/services/categoryService';

type AppInfo = {
  name: string;
  package: string;
};

interface AppLimit extends AppInfo {
  durationSeconds: number;
  remainingSeconds: number;
  status: 'active' | 'blocked';
}

function App(): React.JSX.Element {
  const [activeLimits, setActiveLimits] = useState<AppLimit[]>([]);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const [selectedApps, setSelectedApps] = useState<AppInfo[]>([]); // Multi-select support
  const [step, setStep] = useState(0); // 0: Permissions, 1: Main App
  const [allApps, setAllApps] = useState<AppInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [permissions, setPermissions] = useState({ overlay: false, usage: false, batteryOptimized: false, exactAlarm: true });
  const [hoursInput, setHoursInput] = useState('0');
  const [secondsInput, setSecondsInput] = useState('30');
  const [timerReady, setTimerReady] = useState(false);

  useEffect(() => {
    refreshPermissions();
    syncActiveTimers();
    startCategoryService();
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active') {
        refreshPermissions();
        syncActiveTimers();
      }
    });
    return () => sub.remove();
  }, []);

  const syncActiveTimers = async () => {
    if (LimitterModule?.getActiveTimers) {
      try {
        const timers = await LimitterModule.getActiveTimers();
        if (timers && timers.length > 0) {
          console.log("Synced active timers:", timers.length);
          setActiveLimits(prev => {
            // Merge existing with synced, taking synced as source of truth
            const newMap = new Map();
            timers.forEach((t: any) => newMap.set(t.package, {
              package: t.package,
              name: t.name,
              durationSeconds: t.remainingSeconds, // approximating
              remainingSeconds: t.remainingSeconds,
              status: t.status
            }));
            return Array.from(newMap.values());
          });
        }
      } catch (e) {
        console.error("Failed to sync timers:", e);
      }
    }
  };

  // Listen to native timer updates
  useEffect(() => {
    if (TimerEventModule) {
      const eventEmitter = new NativeEventEmitter(TimerEventModule);
      TimerEventModule.startListening();

      const subscription = eventEmitter.addListener('TIMER_TICK', (data) => {
        const { package: pkg, appName, remaining, isBlocked } = data;

        setActiveLimits(prev => {
          const exists = prev.some(a => a.package === pkg);
          if (!exists) {
            // Package not in current state, add it
            return [...prev, {
              package: pkg,
              name: appName || pkg,
              durationSeconds: remaining, // best guess
              remainingSeconds: remaining,
              status: isBlocked ? 'blocked' : 'active'
            }];
          }

          return prev.map(app => {
            if (app.package === pkg) {
              return {
                ...app,
                remainingSeconds: remaining,
                status: isBlocked ? 'blocked' : 'active'
              };
            }
            return app;
          });
        });
      });

      return () => {
        subscription.remove();
        TimerEventModule.stopListening();
      };
    }
  }, []);

  const refreshPermissions = async () => {
    if (LimitterModule?.checkPermissions) {
      const res = await LimitterModule.checkPermissions();
      console.log("Permission Status:", res);
      setPermissions(res);
      // We only strictly require overlay and usage to enter step 1
      // Battery optimization is highly recommended but not a hard block for the UI
      if (res.overlay && res.usage) {
        setStep(1);
      }
    }
  };

  const fetchApps = async () => {
    setLoading(true);
    console.log("Fetching apps...");
    try {
      if (LimitterModule?.getInstalledApps) {
        const apps = await LimitterModule.getInstalledApps();
        console.log("Apps found:", apps.length);
        setAllApps(apps.filter((a: any) => a.package !== 'com.appguard2').sort((a: any, b: any) => a.name.localeCompare(b.name)));
      } else {
        console.error("LimitterModule.getInstalledApps is missing");
      }
    } catch (e: any) {
      console.error("Failed to load apps:", e);
      Alert.alert('Error', 'Failed to load app list: ' + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step === 1) fetchApps();
  }, [step]);

  const handleSetTimer = async () => {
    const total = (parseInt(hoursInput) || 0) * 3600 + (parseInt(secondsInput) || 0);
    if (total <= 0) {
      Alert.alert('Invalid Time', 'Please enter a valid duration.');
      return;
    }
    setTimerReady(true);
    if (LimitterModule?.showNotification) {
      await LimitterModule.showNotification("Your timer is set. Now select apps to limit.");
    }
  };

  // Toggle app selection (multi-select)
  const toggleAppSelection = (app: AppInfo) => {
    setSelectedApps(prev => {
      const isSelected = prev.some(a => a.package === app.package);
      if (isSelected) {
        return prev.filter(a => a.package !== app.package);
      } else {
        return [...prev, app];
      }
    });
  };

  // Start timers for all selected apps
  const startAllTimers = async () => {
    if (!timerReady) {
      Alert.alert('Step 1 Required', 'Please set the timer above and click SAVE TIMER first.');
      return;
    }

    if (selectedApps.length === 0) {
      Alert.alert('No Apps Selected', 'Please select at least one app to limit.');
      return;
    }

    const total = (parseInt(hoursInput) || 0) * 3600 + (parseInt(secondsInput) || 0);

    // Add all selected apps to active timers
    const newLimits: AppLimit[] = selectedApps.map(app => ({
      ...app,
      durationSeconds: total,
      remainingSeconds: total,
      status: 'active'
    }));

    setActiveLimits(prev => {
      // Remove any app that's being re-added
      const filtered = prev.filter(l => !selectedApps.some(s => s.package === l.package));
      return [...filtered, ...newLimits];
    });

    // Send to native service
    if (LimitterModule?.sendCommand) {
      try {
        const apps = selectedApps.map(app => ({
          package: app.package,
          appName: app.name,
          duration: total.toString()
        }));

        await LimitterModule.sendCommand('START_TIMERS', {
          apps: apps
        });

        console.log(`✅ Started timers for ${selectedApps.length} apps`);
        Alert.alert('Success', `⏱ Timers started for ${selectedApps.length} app(s)`);

        setTimerReady(false);
        setSelectedApps([]);
        setSearchQuery('');
      } catch (e) {
        console.error("Failed to start timers:", e);
        Alert.alert('Error', 'Failed to start timers: ' + (e as any).message);
      }
    }
  };

  const selectAndStartApp = async (item: AppInfo) => {
    if (!timerReady) {
      Alert.alert('Step 1 Required', 'Please set the timer above and click SAVE TIMER first.');
      return;
    }

    const total = (parseInt(hoursInput) || 0) * 3600 + (parseInt(secondsInput) || 0);
    const newLimit: AppLimit = { ...item, durationSeconds: total, remainingSeconds: total, status: 'active' };

    setActiveLimits(prev => [...prev.filter(l => l.package !== item.package), newLimit]);

    if (LimitterModule?.sendCommand) {
      try {
        await LimitterModule.sendCommand('START', {
          package: item.package,
          appName: item.name,
          duration: total.toString(),
          timeUnit: 'seconds'
        });
        console.log("Command START sent for:", item.name);
      } catch (e) {
        console.error("Failed to send command:", e);
      }
    }
    setTimerReady(false);
    setSearchQuery('');
  };

  const filteredApps = useMemo(() => {
    return allApps.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [allApps, searchQuery]);

  if (step === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', padding: 30 }]}>
        <Text style={styles.title}>Permissions Needed</Text>
        <Text style={styles.subtitle}>Overlay and Usage Access required.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => LimitterModule?.checkAndRequestPermissions()}>
          <Text style={styles.btnText}>GRANT PERMISSIONS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: '#334155', marginTop: 10 }]} onPress={refreshPermissions}>
          <Text style={styles.btnText}>I'VE GRANTED THEM - REFRESH</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <View>
            <Text style={styles.title}>APPGUARD</Text>
            <Text style={styles.versionTag}>v2.0 Native Guard</Text>
          </View>
          <TouchableOpacity
            style={{ backgroundColor: '#E11D48', padding: 8, borderRadius: 10 }}
            onPress={() => Alert.alert(
              "Help & Settings",
              "If your timer stops in the background:\n\n1. Disable Battery Optimization\n2. Allow Exact Alarms\n3. Ensure 'Auto-Start' is enabled (if available in phone settings).",
              [
                { text: "Open Background Settings", onPress: () => setShowTroubleshoot(!showTroubleshoot) },
                { text: "OK" }
              ]
            )}
          >
            <Text style={{ color: 'white', fontWeight: 'bold' }}>HELP</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {(permissions.batteryOptimized || !permissions.exactAlarm || showTroubleshoot) && (
          <View style={[styles.card, { backgroundColor: '#7C2D12', borderColor: '#F59E0B', borderWidth: 1 }]}>
            <Text style={[styles.sectionTitle, { color: '#FACC15' }]}>⚠️ Background Performance</Text>
            <Text style={{ color: '#FED7AA', marginBottom: 15, fontSize: 13 }}>
              Troubleshooting: If the timer stops, ensure these system permissions are granted for 100% reliability.
            </Text>

            <View>
              {permissions.batteryOptimized && (
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: '#EA580C', marginBottom: 10 }]}
                  onPress={() => LimitterModule?.requestBatteryOptimizationExemption()}
                >
                  <Text style={styles.btnText}>1. DISABLE BATTERY OPTIMIZATION</Text>
                </TouchableOpacity>
              )}

              {!permissions.exactAlarm && (
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: '#B45309', marginBottom: 10 }]}
                  onPress={() => Linking.openSettings()}
                >
                  <Text style={styles.btnText}>2. ALLOW EXACT ALARMS</Text>
                </TouchableOpacity>
              )}

              {showTroubleshoot && (
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: '#475569', marginTop: 5 }]}
                  onPress={() => setShowTroubleshoot(false)}
                >
                  <Text style={styles.btnText}>CLOSE HELP PANEL</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>1. Set Timer</Text>
          <View style={styles.timerRow}>
            <View style={styles.inputBox}>
              <Text style={styles.label}>HRS</Text>
              <TextInput style={styles.input} value={hoursInput} onChangeText={setHoursInput} keyboardType="numeric" />
            </View>
            <View style={styles.inputBox}>
              <Text style={styles.label}>SEC</Text>
              <TextInput style={styles.input} value={secondsInput} onChangeText={setSecondsInput} keyboardType="numeric" />
            </View>
          </View>
          <TouchableOpacity
            style={[styles.btn, timerReady && { backgroundColor: '#10B981' }]}
            onPress={handleSetTimer}
          >
            <Text style={styles.btnText}>{timerReady ? "✓ TIMER SET" : "SAVE TIMER"}</Text>
          </TouchableOpacity>
        </View>

        {activeLimits.map(l => {
          const formatTime = (secs: number) => {
            const h = Math.floor(secs / 3600);
            const m = Math.floor((secs % 3600) / 60);
            const s = secs % 60;
            if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            return `${m}:${s.toString().padStart(2, '0')}`;
          };

          return (
            <View key={l.package} style={[styles.activeCard, l.status === 'blocked' && { borderColor: '#EF4444' }]}>
              <Text style={styles.activeLabel}>
                {l.name} - {l.status === 'blocked' ? 'BLOCKED ⛔' : `${formatTime(l.remainingSeconds)} remaining ⏱`}
              </Text>
            </View>
          );
        })}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>2. Select Apps</Text>
          <Text style={styles.subtitle}>{selectedApps.length} app(s) selected</Text>
          <TextInput
            style={styles.search}
            placeholder="Search apps..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {loading ? (
            <ActivityIndicator color="#6366F1" />
          ) : (
            filteredApps.map(item => {
              const isSelected = selectedApps.some(a => a.package === item.package);
              return (
                <TouchableOpacity
                  key={item.package}
                  style={[
                    styles.appRow,
                    timerReady && styles.appRowReady,
                    isSelected && styles.appRowSelected
                  ]}
                  onPress={() => toggleAppSelection(item)}
                >
                  <View style={[styles.icon, isSelected && { backgroundColor: '#6366F1' }]}>
                    <Text style={styles.iconTxt}>{item.name[0]}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 15 }}>
                    <Text style={styles.appName}>{item.name}</Text>
                    <Text style={styles.pkgName}>{item.package}</Text>
                  </View>
                  <View style={[styles.tick, isSelected && { backgroundColor: '#6366F1' }]}>
                    <Text style={styles.tickTxt}>{isSelected ? "✓" : "+"}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          {selectedApps.length > 0 && (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: '#8B5CF6', marginTop: 20 }]}
              onPress={startAllTimers}
            >
              <Text style={styles.btnText}>▶ START TIMERS ({selectedApps.length})</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { padding: 30, alignItems: 'center' },
  title: { fontSize: 40, fontWeight: '900', color: '#F8FAFC' },
  versionTag: { color: '#6366F1', fontSize: 12, fontWeight: '700' },
  subtitle: { color: '#94A3B8', marginBottom: 20 },
  card: { backgroundColor: '#1E293B', margin: 20, padding: 20, borderRadius: 20 },
  sectionTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '800', marginBottom: 15 },
  timerRow: { flexDirection: 'row', gap: 15, marginBottom: 20 },
  inputBox: { flex: 1, backgroundColor: '#0F172A', padding: 10, borderRadius: 10, alignItems: 'center' },
  label: { color: '#64748B', fontSize: 10, fontWeight: '800' },
  input: { color: '#F8FAFC', fontSize: 24, fontWeight: '900' },
  btn: { backgroundColor: '#6366F1', padding: 18, borderRadius: 15, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '900' },
  activeCard: { marginHorizontal: 20, marginBottom: 10, padding: 15, borderRadius: 12, borderLeftWidth: 5, borderLeftColor: '#6366F1', backgroundColor: '#1E293B' },
  activeLabel: { color: 'white', fontWeight: '700' },
  listSection: { padding: 20 },
  search: { backgroundColor: '#1E293B', color: 'white', padding: 15, borderRadius: 15, marginBottom: 20 },
  appRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, opacity: 1, backgroundColor: '#1E293B', padding: 12, borderRadius: 12 },
  appRowReady: { opacity: 1 },
  appRowSelected: { backgroundColor: '#3730A3', borderWidth: 2, borderColor: '#6366F1' },
  icon: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  iconTxt: { color: 'white', fontSize: 20, fontWeight: '800' },
  appName: { color: '#F8FAFC', fontWeight: '700' },
  pkgName: { color: '#64748B', fontSize: 10 },
  tick: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  tickTxt: { color: 'white', fontWeight: '900' }
});

export default App;
