// 通用按钮组件
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { theme } from '../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  style,
}) => {
  const getBackgroundColor = () => {
    if (disabled) return theme.colors.gray;
    switch (variant) {
      case 'primary':
        return theme.colors.primary;
      case 'secondary':
        return theme.colors.secondary;
      case 'danger':
        return theme.colors.danger;
      case 'outline':
        return 'transparent';
      default:
        return theme.colors.primary;
    }
  };
  
  const getTextColor = () => {
    if (variant === 'outline') return theme.colors.primary;
    return theme.colors.white;
  };
  
  const getPadding = () => {
    switch (size) {
      case 'small':
        return { paddingVertical: 8, paddingHorizontal: 16 };
      case 'large':
        return { paddingVertical: 16, paddingHorizontal: 32 };
      default:
        return { paddingVertical: 12, paddingHorizontal: 24 };
    }
  };
  
  const getFontSize = () => {
    switch (size) {
      case 'small':
        return 14;
      case 'large':
        return 18;
      default:
        return 16;
    }
  };
  
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          ...getPadding(),
        },
        variant === 'outline' && styles.outline,
        style,
      ]}
    >
      <Text style={[styles.text, { color: getTextColor(), fontSize: getFontSize() }]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  text: {
    fontWeight: '600',
  },
});
