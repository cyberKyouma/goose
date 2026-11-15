// 年份选择弹层。图表 / 流水顶栏共用。
import React, { useMemo } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { theme } from '../theme';

interface YearPickerModalProps {
  visible: boolean;
  year: number;
  onSelect: (year: number) => void;
  onClose: () => void;
  /** 可选:有账目时按数据范围扩年;否则用当前年前后各若干年 */
  minYear?: number;
  maxYear?: number;
}

export const YearPickerModal: React.FC<YearPickerModalProps> = ({
  visible,
  year,
  onSelect,
  onClose,
  minYear,
  maxYear,
}) => {
  const years = useMemo(() => {
    const now = new Date().getFullYear();
    const lo = minYear ?? now - 15;
    const hi = maxYear ?? now;
    const list: number[] = [];
    for (let y = hi; y >= lo; y -= 1) list.push(y);
    return list;
  }, [minYear, maxYear]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="关闭选年">
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>选择年份</Text>
          <FlatList
            data={years}
            keyExtractor={(y) => String(y)}
            style={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const on = item === year;
              return (
                <Pressable
                  style={[styles.row, on && styles.rowOn]}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.rowText, on && styles.rowTextOn]}>{item}年</Text>
                </Pressable>
              );
            }}
          />
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>取消</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.page,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    maxHeight: '55%',
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  list: {
    paddingHorizontal: theme.layout.pagePadding,
  },
  row: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
  },
  rowOn: {
    backgroundColor: '#FFF3E8',
  },
  rowText: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  rowTextOn: {
    color: theme.colors.accent,
    fontWeight: '700',
  },
  cancel: {
    marginTop: theme.spacing.sm,
    marginHorizontal: theme.layout.pagePadding,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceMuted,
  },
  cancelText: {
    ...theme.typography.bodyStrong,
    color: theme.colors.textSecondary,
  },
});
