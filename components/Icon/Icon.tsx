import React from 'react';
import { Text, StyleSheet, TextProps } from 'react-native';

export interface IconProps extends TextProps {
  size?: 'sm' | 'md' | 'lg' | number;
}

const sizeMap = {
  sm: 16,
  md: 20,
  lg: 24,
};

export const Icon: React.FC<IconProps> = ({ size = 'md', style, children, ...props }) => {
  const computedSize = typeof size === 'number' ? size : sizeMap[size];

  return (
    <Text 
      style={[{ fontSize: computedSize }, styles.icon, style]} 
      {...props}
    >
      {children}
    </Text>
  );
};

Icon.displayName = 'Icon';

const styles = StyleSheet.create({
  icon: {
    // Basic styling for text-based icon representation
  }
});
