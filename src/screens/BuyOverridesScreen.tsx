import React, { useMemo, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    TextInput,
    Alert,
    ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Minus, Plus, ShoppingCart } from 'lucide-react-native';

const PRICE_PER_OVERRIDE = 1.99;
const MIN_OVERRIDES = 1;
const MAX_OVERRIDES = 999;

export default function BuyOverridesScreen() {
    const navigation = useNavigation<any>();
    const [countText, setCountText] = useState('1');

    const count = useMemo(() => {
        const parsed = parseInt(countText, 10);
        if (isNaN(parsed) || parsed < 0) return 0;
        return parsed;
    }, [countText]);

    const totalPrice = useMemo(() => {
        return (count * PRICE_PER_OVERRIDE).toFixed(2);
    }, [count]);

    const isValid = count >= MIN_OVERRIDES && count <= MAX_OVERRIDES;

    const handleTextChange = (text: string) => {
        const cleaned = text.replace(/[^0-9]/g, '');
        setCountText(cleaned);
    };

    const increment = () => {
        const newValue = Math.min(MAX_OVERRIDES, count + 1);
        setCountText(String(newValue));
    };

    const decrement = () => {
        const newValue = Math.max(MIN_OVERRIDES, count - 1);
        setCountText(String(newValue));
    };

    const handleBuy = () => {
        if (!isValid) {
            Alert.alert(
                'Invalid amount',
                `Please enter a number between ${MIN_OVERRIDES} and ${MAX_OVERRIDES}.`
            );
            return;
        }
        Alert.alert(
            'Confirm Purchase',
            `Buy ${count} override${count > 1 ? 's' : ''} for $${totalPrice}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Proceed',
                    onPress: () => {
                        // Payment integration goes here later.
                        console.log('Purchase initiated:', { count, totalPrice });
                    },
                },
            ],
        );
    };

    return (
        <SafeAreaView style={s.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            <View style={s.header}>
                <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
                    <ChevronLeft size={22} color="#0F172A" />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Buy Overrides</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
                <View style={s.infoCard}>
                    <ShoppingCart size={28} color="#6366F1" />
                    <Text style={s.infoTitle}>Purchase Overrides</Text>
                    <Text style={s.infoText}>
                        Each override lets you unlock a blocked app or website once. Choose how many you want.
                    </Text>
                </View>

                <Text style={s.label}>Number of overrides</Text>
                <View style={s.counterRow}>
                    <TouchableOpacity
                        style={[s.stepBtn, count <= MIN_OVERRIDES && s.stepBtnDisabled]}
                        onPress={decrement}
                        disabled={count <= MIN_OVERRIDES}
                    >
                        <Minus size={22} color={count <= MIN_OVERRIDES ? '#CBD5E1' : '#4338CA'} />
                    </TouchableOpacity>

                    <TextInput
                        style={s.input}
                        value={countText}
                        onChangeText={handleTextChange}
                        keyboardType="number-pad"
                        maxLength={3}
                        textAlign="center"
                        selectTextOnFocus
                    />

                    <TouchableOpacity
                        style={[s.stepBtn, count >= MAX_OVERRIDES && s.stepBtnDisabled]}
                        onPress={increment}
                        disabled={count >= MAX_OVERRIDES}
                    >
                        <Plus size={22} color={count >= MAX_OVERRIDES ? '#CBD5E1' : '#4338CA'} />
                    </TouchableOpacity>
                </View>

                <View style={s.priceCard}>
                    <View style={s.priceRow}>
                        <Text style={s.priceLabel}>Price per override</Text>
                        <Text style={s.priceValue}>${PRICE_PER_OVERRIDE.toFixed(2)}</Text>
                    </View>
                    <View style={s.priceRow}>
                        <Text style={s.priceLabel}>Quantity</Text>
                        <Text style={s.priceValue}>× {count}</Text>
                    </View>
                    <View style={s.divider} />
                    <View style={s.priceRow}>
                        <Text style={s.totalLabel}>Total</Text>
                        <Text style={s.totalValue}>${totalPrice}</Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={[s.buyBtn, !isValid && s.buyBtnDisabled]}
                    onPress={handleBuy}
                    disabled={!isValid}
                >
                    <Text style={s.buyBtnText}>
                        {isValid ? `Proceed to Payment • $${totalPrice}` : 'Enter a valid quantity'}
                    </Text>
                </TouchableOpacity>

                <Text style={s.footnote}>
                    You'll be charged only after confirming payment on the next screen.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F1F5F9' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 40,
        paddingBottom: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
    content: { padding: 16 },
    infoCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 20,
    },
    infoTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginTop: 10 },
    infoText: {
        fontSize: 13,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 18,
    },
    label: {
        fontSize: 13,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 10,
        marginLeft: 4,
    },
    counterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 20,
    },
    stepBtn: {
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: '#EEF2FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepBtnDisabled: { backgroundColor: '#F1F5F9' },
    input: {
        width: 110,
        height: 60,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#6366F1',
        fontSize: 24,
        fontWeight: '800',
        color: '#0F172A',
    },
    priceCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 20,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
    },
    priceLabel: { fontSize: 14, color: '#64748B', fontWeight: '600' },
    priceValue: { fontSize: 14, color: '#0F172A', fontWeight: '700' },
    divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 8 },
    totalLabel: { fontSize: 16, color: '#0F172A', fontWeight: '800' },
    totalValue: { fontSize: 20, color: '#4338CA', fontWeight: '800' },
    buyBtn: {
        backgroundColor: '#6366F1',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
    },
    buyBtnDisabled: { backgroundColor: '#CBD5E1' },
    buyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
    footnote: {
        fontSize: 11,
        color: '#94A3B8',
        textAlign: 'center',
        marginTop: 14,
        fontWeight: '500',
    },
});