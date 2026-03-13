import React, { forwardRef, useState } from 'react';
import { View, Text, TextInput as RNTextInput, StyleSheet, TextInputProps as RNTextInputProps, TouchableOpacity } from 'react-native';

export interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
}

export const TextInput = forwardRef<RNTextInput, TextInputProps>(
  ({ label, error, style, secureTextEntry, ...props }, ref) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    // If secureTextEntry is TRUE, we use our toggle logic. 
    // If it's undefined/false, it's a normal text input.
    const isActuallySecure = secureTextEntry && !isPasswordVisible;

    return (
      <View style={styles.container}>{label ? <Text style={styles.label}>{label}</Text> : null}<View style={styles.inputWrapper}><RNTextInput
            ref={ref}
            style={[
              styles.input,
              error ? styles.inputError : styles.inputNormal,
              secureTextEntry && { paddingRight: 60 },
              style
            ]}
            secureTextEntry={!!isActuallySecure}
            placeholderTextColor="#94A3B8"
            {...props}
          />{secureTextEntry ? (<TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              activeOpacity={0.6}
            ><Text style={styles.eyeText}>{isPasswordVisible ? 'Hide' : 'Show'}</Text></TouchableOpacity>) : null}</View>{error ? <Text style={styles.errorText}>{error}</Text> : null}</View>
    );
  }
);

TextInput.displayName = 'TextInput';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    width: '100%',
    justifyContent: 'center',
  },
  input: {
    height: 56,
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  inputNormal: {
    borderColor: '#E2E8F0',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  eyeText: {
    color: '#10B981', // Figma Teal
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    color: '#EF4444',
    marginLeft: 4,
  },
});
