import React, { ReactNode } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';

export interface ButtonProps {
  children?: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  disabled?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export const BaseButton: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled = false,
  onPress,
  style,
}) => {
  const containerStyle: ViewStyle[] = [styles.base];
  const textStyle: TextStyle[] = [styles.textBase];

  // Variants
  if (variant === 'primary') {
    containerStyle.push(styles.primaryBg);
    textStyle.push(styles.primaryText);
  } else if (variant === 'secondary') {
    containerStyle.push(styles.secondaryBg);
    textStyle.push(styles.secondaryText);
  } else if (variant === 'outline') {
    containerStyle.push(styles.outlineBg);
    textStyle.push(styles.outlineText);
  } else if (variant === 'danger') {
    containerStyle.push(styles.dangerBg);
    textStyle.push(styles.dangerText);
  } else if (variant === 'ghost') {
    containerStyle.push(styles.ghostBg);
    textStyle.push(styles.ghostText);
  }

  // Sizes
  if (size === 'sm') containerStyle.push(styles.sizeSm);
  else if (size === 'md') containerStyle.push(styles.sizeMd);
  else if (size === 'lg') containerStyle.push(styles.sizeLg);

  // Layout
  if (fullWidth) containerStyle.push(styles.fullWidth);
  if (disabled || isLoading) containerStyle.push(styles.disabled);

  return (
    <TouchableOpacity
      style={[containerStyle, style]}
      disabled={disabled || isLoading}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {isLoading && <ActivityIndicator color={textStyle[1]?.color || '#fff'} style={{ marginRight: 8 }} />}
      {!isLoading && leftIcon && leftIcon}
      {typeof children === 'string' ? (
        <Text style={textStyle}>{children}</Text>
      ) : (
        children
      )}
      {!isLoading && rightIcon && rightIcon}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  textBase: {
    fontWeight: '600',
  },
  primaryBg: { backgroundColor: '#2563EB' },
  primaryText: { color: '#FFFFFF' },
  secondaryBg: { backgroundColor: '#F3F4F6' },
  secondaryText: { color: '#1F2937' },
  outlineBg: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#D1D5DB' },
  outlineText: { color: '#374151' },
  dangerBg: { backgroundColor: '#DC2626' },
  dangerText: { color: '#FFFFFF' },
  ghostBg: { backgroundColor: 'transparent' },
  ghostText: { color: '#4B5563' },
  sizeSm: { paddingVertical: 6, paddingHorizontal: 12 },
  sizeMd: { paddingVertical: 10, paddingHorizontal: 16 },
  sizeLg: { paddingVertical: 14, paddingHorizontal: 20 },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
});

export default BaseButton;
