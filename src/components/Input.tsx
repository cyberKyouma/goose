// 输入框组件
import React from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps } from 'react-native';
import { theme } from '../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, style, ...props }) => {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={theme.colors.gray}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.dark,
    marginBottom: theme.spacing.xs,
    fontWeight: '500',
  },
  input: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.fontSize.md,
    color: theme.colors.dark,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  error: {
    color: theme.colors.danger,
    fontSize: theme.fontSize.xs,
    marginTop: theme.spacing.xs,
  },
});
