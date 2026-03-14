import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function UsageScreen() {
  const navigation = useNavigation<any>();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Usage Screen (Placeholder)</Text>
      <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('DashboardScreen')}>
        <Text style={styles.btnText}>Go to Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  btn: { padding: 12, backgroundColor: '#4F46E5', borderRadius: 8 },
  btnText: { color: '#FFF', fontWeight: 'bold' }
});
