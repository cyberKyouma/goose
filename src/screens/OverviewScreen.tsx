// 首页概览:与流水/图表共用 ScenicBanner 与排版 Token,去掉未实现的占位菜单
import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useStore } from '../stores/appStore';
import { ScenicBanner, TransactionItem } from '../components';
import { bannerText, emptyText, theme } from '../theme';
import { Category, SubCategory, Transaction } from '../models';
import { RootStackParamList } from '../navigation/AppNavigator';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { formatMoney } from '../utils';

type DateRange = 'day' | 'week' | 'month' | 'year';
const DATE_RANGES: DateRange[] = ['day', 'week', 'month', 'year'];
const PERIOD_LABEL: Record<DateRange, string> = {
  day: '今日支出',
  week: '本周支出',
  month: '本月支出',
  year: '本年支出',
};
const TAB_LABEL: Record<DateRange, string> = {
  day: '今日',
  week: '本周',
  month: '本月',
  year: '本年',
};
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const formatDateHeader = (dateStr: string) => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateStr === ymd(today)) return '今天';
  if (dateStr === ymd(yesterday)) return '昨天';

  const [, m, d] = dateStr.split('-').map(Number);
  const date = new Date(dateStr);
  return `${m}月${d}日 ${WEEKDAYS[date.getDay()]}`;
};

const moneyText = (hidden: boolean, value: number): string =>
  hidden ? '****' : formatMoney(value);

const EmptyState = () => (
  <View style={styles.emptyState}>
    <Text style={styles.emptyText}>暂无记录</Text>
    <Text style={styles.emptySubText}>点下方「记一笔」记下第一笔</Text>
  </View>
);

export const OverviewScreen: React.FC = () => {
  const totalIncome = useStore((s) => s.totalIncome);
  const totalExpense = useStore((s) => s.totalExpense);
  const transactions = useStore((s) => s.transactions);
  const categories = useStore((s) => s.categories);
  const subCategories = useStore((s) => s.subCategories);
  const dateRange = useStore((s) => s.dateRange);
  const setDateRange = useStore((s) => s.setDateRange);
  const amountsHidden = useStore((s) => s.amountsHidden);
  const toggleAmountsHidden = useStore((s) => s.toggleAmountsHidden);
  const revokeTransaction = useStore((s) => s.revokeTransaction);
  const restoreTransaction = useStore((s) => s.restoreTransaction);
  const deleteTransaction = useStore((s) => s.deleteTransaction);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const categoryById = useMemo(
    () => new Map<string, Category>(categories.map((c) => [c.id, c])),
    [categories]
  );
  const subById = useMemo(
    () => new Map<string, SubCategory>(subCategories.map((s) => [s.id, s])),
    [subCategories]
  );

  const lookupCategory = (sid: string): Category | undefined => {
    if (!sid) return undefined;
    const sub = subById.get(sid);
    if (sub) return categoryById.get(sub.categoryId);
    return categoryById.get(sid);
  };

  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    for (const tx of transactions) {
      const key = ymd(new Date(tx.date));
      (groups[key] ||= []).push(tx);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions]);

  const handlePress = useCallback(
    (t: Transaction) => {
      if ((t.status ?? 'active') === 'revoked') {
        Alert.alert('已撤销', '该账目已撤销,无法编辑。如需修改请先恢复。');
        return;
      }
      navigation.navigate('AddTransaction', { editingId: t.id });
    },
    [navigation]
  );

  const handleLongPress = useCallback(
    (t: Transaction) => {
      const isRevoked = (t.status ?? 'active') === 'revoked';
      const opts: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [];
      if (isRevoked) {
        opts.push({
          text: '恢复',
          onPress: () => {
            restoreTransaction(t.id).catch((e) => {
              Alert.alert('恢复失败', String((e as Error)?.message ?? e));
            });
          },
        });
      } else {
        opts.push({
          text: '撤销',
          onPress: () => {
            revokeTransaction(t.id).catch((e) => {
              Alert.alert('撤销失败', String((e as Error)?.message ?? e));
            });
          },
        });
      }
      opts.push({
        text: '删除',
        style: 'destructive',
        onPress: () => {
          Alert.alert('确认删除', '删除后该账目将从流水中消失,且无法恢复。', [
            { text: '取消', style: 'cancel' },
            {
              text: '删除',
              style: 'destructive',
              onPress: () => {
                deleteTransaction(t.id).catch((e) => {
                  Alert.alert('删除失败', String((e as Error)?.message ?? e));
                });
              },
            },
          ]);
        },
      });
      opts.push({ text: '取消', style: 'cancel' });
      Alert.alert('账目操作', undefined, opts);
    },
    [revokeTransaction, restoreTransaction, deleteTransaction]
  );

  const renderItem = useCallback(
    ({ item }: { item: [string, Transaction[]] }) => {
      const [date, txs] = item;
      return (
        <View style={styles.dateGroup}>
          <Text style={styles.dateHeader}>{formatDateHeader(date)}</Text>
          {txs.map((t, idx) => (
            <View key={t.id}>
              <TransactionItem
                transaction={t}
                category={lookupCategory(t.subCategoryId)}
                amountsHidden={amountsHidden}
                onPress={() => handlePress(t)}
                onLongPress={() => handleLongPress(t)}
              />
              {idx < txs.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </View>
      );
    },
    [amountsHidden, categoryById, subById, handlePress, handleLongPress]
  );

  const keyExtractor = useCallback((item: [string, Transaction[]]) => item[0], []);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.topBarWrap}>
        <View style={styles.topBar}>
          <Text style={styles.yearText}>概览</Text>
          <Pressable
            onPress={() => navigation.navigate('Categories')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="分类管理"
          >
            <Text style={styles.categoryLink}>分类</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <FlatList
        data={groupedTransactions}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        extraData={amountsHidden}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <ScenicBanner>
              <Text style={styles.bannerLabel}>{PERIOD_LABEL[dateRange] ?? '支出'}</Text>
              <View style={styles.bannerMainRow}>
                <Text style={styles.bannerAmount}>{moneyText(amountsHidden, totalExpense)}</Text>
                <Pressable
                  onPress={toggleAmountsHidden}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={amountsHidden ? '显示金额' : '隐藏金额'}
                  style={styles.eyeBtn}
                >
                  <Feather name={amountsHidden ? 'eye-off' : 'eye'} size={18} color={theme.colors.textOnDark} />
                </Pressable>
              </View>
              <View style={styles.bannerSubRow}>
                <Text style={styles.bannerSub}>
                  收入 <Text style={styles.bannerSubStrong}>{moneyText(amountsHidden, totalIncome)}</Text>
                </Text>
                <Text style={styles.bannerSub}>
                  支出 <Text style={styles.bannerSubStrong}>{moneyText(amountsHidden, totalExpense)}</Text>
                </Text>
              </View>
            </ScenicBanner>

            <View style={styles.dateTabs}>
              {DATE_RANGES.map((range) => (
                <TouchableOpacity
                  key={range}
                  style={[styles.dateTab, dateRange === range && styles.dateTabActive]}
                  onPress={() => setDateRange(range)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dateTabText, dateRange === range && styles.dateTabTextActive]}>
                    {TAB_LABEL[range]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={EmptyState}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.page,
  },
  topBarWrap: {
    backgroundColor: theme.colors.page,
  },
  topBar: {
    height: theme.layout.topBarHeight,
    paddingHorizontal: theme.layout.pagePadding,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  yearText: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  categoryLink: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 100,
  },
  bannerLabel: bannerText.label,
  bannerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  bannerAmount: bannerText.amount,
  eyeBtn: {
    marginLeft: theme.spacing.sm,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerSubRow: {
    flexDirection: 'row',
    marginTop: theme.spacing.sm,
    gap: 28,
  },
  bannerSub: bannerText.sub,
  bannerSubStrong: bannerText.subStrong,
  dateTabs: {
    flexDirection: 'row',
    marginHorizontal: theme.layout.pagePadding,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.borderRadius.full,
    padding: theme.spacing.xs,
  },
  dateTab: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
  },
  dateTabActive: {
    backgroundColor: theme.colors.white,
  },
  dateTabText: {
    ...theme.typography.label,
    color: theme.colors.textSecondary,
  },
  dateTabTextActive: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  dateGroup: {
    marginBottom: theme.spacing.sm,
  },
  dateHeader: {
    ...theme.typography.label,
    fontWeight: '400',
    color: theme.colors.textSecondary,
    paddingHorizontal: theme.layout.pagePadding,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.divider,
    marginLeft: theme.layout.listDividerInset,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: emptyText.title,
  emptySubText: emptyText.sub,
});
