import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';

export interface RadioOption {
  label: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name?: string;
  options: RadioOption[];
  value?: string;
  onChange: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
  error?: string;
  className?: string; // Removed, but we add style to maintain compatibility where needed
  style?: ViewStyle;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  options,
  value,
  onChange,
  orientation = 'vertical',
  error,
  style,
}) => {
  return (
    <View style={style}>
      <View style={orientation === 'vertical' ? styles.verticalContainer : styles.horizontalContainer}>
        {options.map((option) => {
          const isChecked = value === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              disabled={option.disabled}
              style={[styles.optionContainer, option.disabled && styles.disabled]}
              onPress={() => onChange(option.value)}
              activeOpacity={0.7}
            >
              <View style={[styles.radioCircle, isChecked && styles.radioChecked, error && !isChecked && styles.radioError]}>
                {isChecked && <View style={styles.radioInnerCircle} />}
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.label, isChecked && styles.labelChecked]}>{option.label}</Text>
                {option.description && <Text style={styles.description}>{option.description}</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  verticalContainer: {
    flexDirection: 'column',
    gap: 16,
  },
  horizontalContainer: {
    flexDirection: 'row',
    gap: 24,
    flexWrap: 'wrap',
  },
  optionContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  disabled: {
    opacity: 0.5,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    backgroundColor: '#ffffff',
  },
  radioChecked: {
    borderColor: '#2563eb',
    backgroundColor: '#2563eb',
  },
  radioError: {
    borderColor: '#ef4444',
  },
  radioInnerCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  textContainer: {
    marginLeft: 12,
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  labelChecked: {
    color: '#111827',
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    color: '#ef4444',
  },
});
