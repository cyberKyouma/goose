// 账目列表项 — 图标尺寸、标题/备注/金额字号与 theme 对齐
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Transaction, Category } from '../models';
import { theme } from '../theme';
import { formatMoney } from '../utils';
import { CategoryGlyph } from './CategoryGlyph';

interface TransactionItemProps {
  transaction: Transaction;
  category?: Category;
  title?: string;
  icon?: string;
  iconColor?: string;
  amountsHidden?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

export const TransactionItem: React.FC<TransactionItemProps> = React.memo(({
  transaction,
  category,
  title,
  iconColor,
  amountsHidden = false,
  onPress,
  onLongPress,
}) => {
  const isIncome = transaction.type === 'income';
  const isRevoked = (transaction.status ?? 'active') === 'revoked';
  const label = title || category?.name || '未分类';
  const tint = iconColor || category?.color || theme.colors.accent;

  return (
    <TouchableOpacity
      style={[styles.container, isRevoked && styles.containerRevoked]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <CategoryGlyph name={label} color={tint} size={theme.layout.listIconSize} />

      <View style={styles.content}>
        <Text style={[styles.title, isRevoked && styles.textRevoked]} numberOfLines={1}>
          {label}
          {isRevoked ? ' · 已撤销' : ''}
        </Text>
        {transaction.note ? (
          <Text style={[styles.note, isRevoked && styles.textRevoked]} numberOfLines={1}>
            {transaction.note}
          </Text>
        ) : null}
      </View>

      <Text
        style={[
          styles.amount,
          { color: isIncome ? theme.colors.income : theme.colors.expense },
          isRevoked && styles.textRevoked,
        ]}
      >
        {amountsHidden ? '****' : formatMoney(transaction.amount)}
      </Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: theme.layout.pagePadding,
    backgroundColor: theme.colors.page,
    gap: 12,
  },
  containerRevoked: {
    opacity: 0.45,
  },
  content: {
    flex: 1,
  },
  title: {
    ...theme.typography.listTitle,
    color: theme.colors.text,
  },
  note: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  amount: {
    ...theme.typography.listAmount,
    fontVariant: ['tabular-nums'],
  },
  textRevoked: {
    textDecorationLine: 'line-through',
    color: theme.colors.textMuted,
  },
});
