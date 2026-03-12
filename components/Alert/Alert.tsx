import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';

export interface AlertProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  title?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
}

const VariantStyles = {
  default: { bg: '#ffffff', border: '#e5e7eb', text: '#111827', icon: '📝' },
  success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#14532d', icon: '✅' },
  warning: { bg: '#fffbeb', border: '#fde68a', text: '#78350f', icon: '⚠️' },
  error: { bg: '#fef2f2', border: '#fecaca', text: '#7f1d1d', icon: '❌' },
  info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e3a8a', icon: 'ℹ️' },
};

export const Alert: React.FC<AlertProps> = ({ variant = 'default', title, children, style }) => {
  const currentVariant = VariantStyles[variant] || VariantStyles.default;

  return (
    <View style={[styles.container, { backgroundColor: currentVariant.bg, borderColor: currentVariant.border }, style]}>
      <Text style={styles.icon}>{currentVariant.icon}</Text>
      <View style={styles.content}>{title ? <Text style={[styles.title, { color: currentVariant.text }]}>{title}</Text> : null}{typeof children === 'string' || Array.isArray(children) ? (<Text style={[styles.message, { color: currentVariant.text }]}>{children}</Text>) : children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    width: '100%',
  },
  icon: {
    fontSize: 18,
    marginRight: 12,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.9,
  },
});
