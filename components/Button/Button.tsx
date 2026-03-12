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
    >{isLoading ? <ActivityIndicator color={textStyle[1]?.color || '#fff'} style={{ marginRight: 8 }} /> : null}{(!isLoading && leftIcon) ? leftIcon : null}{typeof children === 'string' || Array.isArray(children) ? (<Text style={textStyle}>{children}</Text>) : children}{(!isLoading && rightIcon) ? rightIcon : null}</TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999, // Pill shape from Figma
  },
  textBase: {
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  primaryBg: { backgroundColor: '#10B981' }, // Teal from Figma
  primaryText: { color: '#FFFFFF' },
  secondaryBg: { backgroundColor: '#F3F4F6' },
  secondaryText: { color: '#0F172A' },
  outlineBg: { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#10B981' },
  outlineText: { color: '#10B981' },
  dangerBg: { backgroundColor: '#EF4444' },
  dangerText: { color: '#FFFFFF' },
  ghostBg: { backgroundColor: 'transparent' },
  ghostText: { color: '#64748B' },
  sizeSm: { height: 40, paddingHorizontal: 16 },
  sizeMd: { height: 56, paddingHorizontal: 24 },
  sizeLg: { height: 64, paddingHorizontal: 32 },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
});

export default BaseButton;
