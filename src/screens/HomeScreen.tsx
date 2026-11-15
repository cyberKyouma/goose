// 主界面(图1): 本周支出横幅 + 按日流水 + 底部「图表|流水|记一笔」
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { useStore } from '../stores/appStore';
import { HomeBottomBar } from '../components/HomeBottomBar';
import { ScenicBanner, TransactionItem } from '../components';
import { bannerText, emptyText, theme } from '../theme';
import { Transaction } from '../models';
import { RootStackParamList } from '../navigation/AppNavigator';
import {
  describeTransaction,
  endOfMonthDate,
  endOfWeek,
  formatDayHeading,
  formatMoney,
  isActiveTx,
  startOfMonthDate,
  startOfWeek,
  toYmd,
} from '../utils';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PAGE_SIZE = 40;

interface DayGroup {
  date: string;
  txs: Transaction[];
  income: number;
  expense: number;
}

const moneyText = (hidden: boolean, value: number): string =>
  hidden ? '****' : formatMoney(value);

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const transactions = useStore((s) => s.transactions);
  const categories = useStore((s) => s.categories);
  const subCategories = useStore((s) => s.subCategories);
  const amountsHidden = useStore((s) => s.amountsHidden);
  const toggleAmountsHidden = useStore((s) => s.toggleAmountsHidden);
  const deleteTransaction = useStore((s) => s.deleteTransaction);
  const revokeTransaction = useStore((s) => s.revokeTransaction);
  const restoreTransaction = useStore((s) => s.restoreTransaction);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const summary = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now).getTime();
    const weekEnd = endOfWeek(now).getTime();
    const monthStart = startOfMonthDate(now).getTime();
    const monthEnd = endOfMonthDate(now).getTime();
    let weekExpense = 0;
    let monthExpense = 0;
    let monthIncome = 0;
    for (const t of transactions) {
      if (!isActiveTx(t)) continue;
      const ms = new Date(t.date).getTime();
      if (t.type === 'expense' && ms >= weekStart && ms <= weekEnd) weekExpense += t.amount;
      if (ms >= monthStart && ms <= monthEnd) {
        if (t.type === 'expense') monthExpense += t.amount;
        else monthIncome += t.amount;
      }
    }
    return { weekExpense, monthExpense, monthBalance: monthIncome - monthExpense };
  }, [transactions]);

  const filteredTx = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter((t) => {
      const visual = describeTransaction(t, categories, subCategories);
      const hay = `${visual.title} ${visual.parentName} ${t.note} ${t.amount.toFixed(2)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [categories, query, subCategories, transactions]);

  const groups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filteredTx) {
      const key = toYmd(new Date(t.date));
      const bucket = map.get(key);
      if (bucket) bucket.push(t);
      else map.set(key, [t]);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, txs]) => {
        let income = 0;
        let expense = 0;
        for (const t of txs) {
          if (!isActiveTx(t)) continue;
          if (t.type === 'income') income += t.amount;
          else expense += t.amount;
        }
        return { date, txs, income, expense };
      });
  }, [filteredTx]);

  const shown = useMemo(() => {
    const page: DayGroup[] = [];
    let count = 0;
    for (const group of groups) {
      page.push(group);
      count += group.txs.length;
      if (count >= visibleCount) break;
    }
    return page;
  }, [groups, visibleCount]);

  const totalCount = filteredTx.length;
  const shownCount = shown.reduce((n, g) => n + g.txs.length, 0);
  const hasMore = shownCount < totalCount;

  const handlePress = useCallback(
    (t: Transaction) => {
      if (!isActiveTx(t)) {
        Alert.alert('已撤销', '该账目已撤销,无法编辑。如需修改请先恢复。');
        return;
      }
      navigation.navigate('AddTransaction', { editingId: t.id });
    },
    [navigation]
  );

  const handleLongPress = useCallback(
    (t: Transaction) => {
      const revoked = !isActiveTx(t);
      const opts: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [];
      if (revoked) {
        opts.push({
          text: '恢复',
          onPress: () => {
            restoreTransaction(t.id).catch((e) =>
              Alert.alert('恢复失败', String((e as Error)?.message ?? e))
            );
          },
        });
      } else {
        opts.push({
          text: '撤销',
          onPress: () => {
            revokeTransaction(t.id).catch((e) =>
              Alert.alert('撤销失败', String((e as Error)?.message ?? e))
            );
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
                deleteTransaction(t.id).catch((e) =>
                  Alert.alert('删除失败', String((e as Error)?.message ?? e))
                );
              },
            },
          ]);
        },
      });
      opts.push({ text: '取消', style: 'cancel' });
      Alert.alert('账目操作', undefined, opts);
    },
    [deleteTransaction, restoreTransaction, revokeTransaction]
  );

  const renderItem = useCallback(
    ({ item }: { item: DayGroup }) => (
      <View>
        <View style={styles.dayHeader}>
          <Text style={styles.dayTitle}>{formatDayHeading(item.date)}</Text>
          <View style={styles.dayTotals}>
            {item.income > 0 ? (
              <View style={styles.totalPair}>
                <View style={styles.dayDot} />
                <Text style={[styles.dayIncome, amountsHidden && styles.masked]}>
                  {moneyText(amountsHidden, item.income)}
                </Text>
              </View>
            ) : null}
            {item.expense > 0 || item.income === 0 ? (
              <View style={styles.totalPair}>
                <View style={styles.dayDot} />
                <Text style={[styles.dayExpense, amountsHidden && styles.masked]}>
                  {moneyText(amountsHidden, item.expense)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        {item.txs.map((t, idx) => {
          const visual = describeTransaction(t, categories, subCategories);
          return (
            <View key={t.id}>
              <TransactionItem
                transaction={t}
                title={visual.title}
                icon={visual.icon}
                iconColor={visual.color}
                amountsHidden={amountsHidden}
                onPress={() => handlePress(t)}
                onLongPress={() => handleLongPress(t)}
              />
              {idx < item.txs.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          );
        })}
      </View>
    ),
    [amountsHidden, categories, handleLongPress, handlePress, subCategories]
  );

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.topBar}>
          <Text style={styles.brand}>Goose</Text>
          <Pressable
            onPress={() => {
              setSearchOpen((v) => {
                if (v) setQuery('');
                return !v;
              });
            }}
            hitSlop={8}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={searchOpen ? '关闭搜索' : '搜索'}
          >
            <Feather
              name="search"
              size={20}
              color={searchOpen ? theme.colors.accent : theme.colors.text}
            />
          </Pressable>
        </View>
        {searchOpen ? (
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setVisibleCount(PAGE_SIZE);
            }}
            placeholder="搜索分类、备注或金额"
            placeholderTextColor={theme.colors.textPlaceholder}
            autoFocus
          />
        ) : null}
      </SafeAreaView>
      <FlatList
        data={shown}
        keyExtractor={(item) => item.date}
        renderItem={renderItem}
        extraData={amountsHidden}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <ScenicBanner>
            <Text style={styles.bannerLabel}>本周支出</Text>
            <View style={styles.bannerMainRow}>
              <Text style={styles.bannerAmount}>{moneyText(amountsHidden, summary.weekExpense)}</Text>
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
                本月支出 <Text style={styles.bannerSubStrong}>{moneyText(amountsHidden, summary.monthExpense)}</Text>
              </Text>
              <Text style={styles.bannerSub}>
                本月结余 <Text style={styles.bannerSubStrong}>{moneyText(amountsHidden, summary.monthBalance)}</Text>
              </Text>
            </View>
          </ScenicBanner>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{query.trim() ? '没有匹配的流水' : '暂无流水'}</Text>
            <Text style={styles.emptySub}>
              {query.trim() ? '换个关键词试试' : '点下方「记一笔」记下第一笔'}
            </Text>
          </View>
        }
        ListFooterComponent={
          hasMore ? (
            <Pressable style={styles.loadMore} onPress={() => setVisibleCount((n) => n + PAGE_SIZE)}>
              <Text style={styles.loadMoreText}>查看更多 ›</Text>
            </Pressable>
          ) : totalCount > PAGE_SIZE ? (
            <Text style={styles.endText}>没有更多了</Text>
          ) : (
            <View style={styles.footerSpace} />
          )
        }
      />
      <SafeAreaView edges={['bottom']} style={styles.safeBottom}>
        <HomeBottomBar />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.page },
  safeTop: { backgroundColor: theme.colors.page },
  safeBottom: { backgroundColor: theme.colors.page },
  topBar: {
    height: theme.layout.topBarHeight,
    paddingHorizontal: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flex: 1,
    ...theme.typography.title,
    fontWeight: '700',
    color: theme.colors.text,
    paddingLeft: theme.spacing.sm,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  search: {
    marginHorizontal: theme.layout.pagePadding,
    marginBottom: theme.spacing.sm,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 14,
    ...theme.typography.label,
    fontWeight: '400',
    color: theme.colors.text,
  },
  listContent: { paddingBottom: 8 },
  bannerLabel: bannerText.label,
  bannerMainRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  bannerAmount: bannerText.amount,
  eyeBtn: {
    marginLeft: theme.spacing.sm,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerSubRow: { flexDirection: 'row', marginTop: theme.spacing.sm, gap: 28 },
  bannerSub: bannerText.sub,
  bannerSubStrong: bannerText.subStrong,
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.layout.pagePadding,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
    backgroundColor: theme.colors.page,
  },
  dayTitle: {
    ...theme.typography.label,
    fontWeight: '400',
    color: theme.colors.textSecondary,
  },
  dayTotals: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  totalPair: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dayDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dayExpense: {
    ...theme.typography.label,
    color: theme.colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  dayIncome: {
    ...theme.typography.label,
    color: theme.colors.income,
    fontVariant: ['tabular-nums'],
  },
  masked: { letterSpacing: 1 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.divider,
    marginLeft: theme.layout.listDividerInset,
  },
  empty: { alignItems: 'center', paddingVertical: 64 },
  emptyTitle: emptyText.title,
  emptySub: emptyText.sub,
  loadMore: { alignItems: 'center', paddingVertical: 18 },
  loadMoreText: {
    ...theme.typography.label,
    fontWeight: '400',
    color: theme.colors.textMuted,
  },
  endText: {
    textAlign: 'center',
    color: theme.colors.textPlaceholder,
    ...theme.typography.caption,
    paddingVertical: 18,
  },
  footerSpace: { height: theme.spacing.lg },
});
