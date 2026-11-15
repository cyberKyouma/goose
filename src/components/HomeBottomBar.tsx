// 仅主界面底部导航: 图表 | 记一笔 | 流水（对齐参考图1，不做预算/设置）
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const HomeBottomBar: React.FC = () => {
  const navigation = useNavigation<Nav>();

  return (
    <View style={styles.bar}>
      <Pressable
        style={styles.sideItem}
        onPress={() => navigation.navigate('Charts')}
        accessibilityRole="button"
        accessibilityLabel="图表"
      >
        <Feather name="bar-chart-2" size={22} color={theme.colors.textPlaceholder} />
        <Text style={styles.sideLabel}>图表</Text>
      </Pressable>

      <Pressable
        style={styles.addWrap}
        onPress={() => navigation.navigate('AddTransaction')}
        accessibilityRole="button"
        accessibilityLabel="记一笔"
      >
        <View style={styles.addBtn}>
          <Text style={styles.addText}>记一笔</Text>
        </View>
      </Pressable>

      <Pressable
        style={styles.sideItem}
        onPress={() => navigation.navigate('Transactions')}
        accessibilityRole="button"
        accessibilityLabel="流水"
      >
        <Feather name="file-text" size={22} color={theme.colors.textPlaceholder} />
        <Text style={styles.sideLabel}>流水</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    height: theme.layout.tabBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.page,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingHorizontal: theme.spacing.sm,
  },
  sideItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  sideLabel: {
    ...theme.typography.micro,
    fontWeight: '500',
    lineHeight: 16,
    color: theme.colors.textPlaceholder,
  },
  addWrap: {
    flex: 1.15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    minWidth: 112,
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
    elevation: 6,
  },
  addText: {
    color: theme.colors.white,
    ...theme.typography.listTitle,
    fontWeight: '700',
  },
});
