import React, { forwardRef, useState } from 'react';
import { View, Text, TextInput as RNTextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { TextInputProps } from './TextInput';

export const PasswordInput = forwardRef<RNTextInput, TextInputProps>(
  ({ label, error, style, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <View style={styles.container}>
        {label && <Text style={styles.label}>{label}</Text>}
        <View style={styles.inputContainer}>
          <RNTextInput
            ref={ref}
            secureTextEntry={!showPassword}
            style={[
              styles.input,
              error ? styles.inputError : styles.inputNormal,
              style
            ]}
            placeholderTextColor="#9ca3af"
            {...props}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingRight: 50,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  inputNormal: {
    borderColor: '#d1d5db',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  eyeText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: '#ef4444',
  },
});
