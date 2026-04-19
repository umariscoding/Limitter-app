import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Zap } from 'lucide-react-native';

interface Props {
    visible: boolean;
    appName?: string;
    onBuyOverride: () => void;
    onBuyPlan: () => void;
    onCancel: () => void;
}

export default function NoOverridesModal({
    visible,
    appName,
    onBuyOverride,
    onBuyPlan,
    onCancel,
}: Props) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <View style={s.overlay}>
                <View style={s.card}>
                    <View style={s.iconWrap}>
                        <Zap size={28} color="#F59E0B" />
                    </View>

                    <Text style={s.title}>No Overrides Left</Text>
                    <Text style={s.body}>
                        {appName || 'This app'} reached its daily limit. Buy an override or buy a plan to continue.
                    </Text>

                    <TouchableOpacity style={s.btnPrimary} onPress={onBuyOverride}>
                        <Text style={s.btnPrimaryText}>Buy Override</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={s.btnSecondary} onPress={onBuyPlan}>
                        <Text style={s.btnSecondaryText}>Buy Plan</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={s.btnGhost} onPress={onCancel}>
                        <Text style={s.btnGhostText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', paddingHorizontal: 24 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, alignItems: 'center' },
    iconWrap: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    title: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
    body: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    btnPrimary: { width: '100%', backgroundColor: '#6366F1', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginBottom: 8 },
    btnPrimaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
    btnSecondary: { width: '100%', backgroundColor: '#EEF2FF', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginBottom: 8 },
    btnSecondaryText: { color: '#4F46E5', fontWeight: '700', fontSize: 15 },
    btnGhost: { width: '100%', paddingVertical: 12, alignItems: 'center' },
    btnGhostText: { color: '#94A3B8', fontWeight: '600', fontSize: 14 },
});