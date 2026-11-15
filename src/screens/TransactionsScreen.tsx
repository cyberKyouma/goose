// 流水(图3): 年结余横幅 + 按月展开 — 二级页,无全局底栏,自有筛选条
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { useStore } from '../stores/appStore';
import { CategoryGlyph, ScenicBanner, YearPickerModal } from '../components';
import { bannerText, theme } from '../theme';
import { Transaction } from '../models';
import { RootStackParamList } from '../navigation/AppNavigator';
import {
  describeTransaction,
  formatMoney,
  isActiveTx,
  pad2,
  WEEKDAYS,
} from '../utils';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const money = (hidden: boolean, value: number): string => (hidden ? '****' : formatMoney(value));

export const TransactionsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const transactions = useStore((s) => s.transactions);
  const categories = useStore((s) => s.categories);
  const subCategories = useStore((s) => s.subCategories);
  const amountsHidden = useStore((s) => s.amountsHidden);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(now.getMonth());
  const [yearOpen, setYearOpen] = useState(true);

  const yearBounds = useMemo(() => {
    let minY = now.getFullYear();
    let maxY = now.getFullYear();
    for (const t of transactions) {
      const y = new Date(t.date).getFullYear();
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return {
      minYear: Math.min(minY, now.getFullYear() - 5),
      maxYear: Math.max(maxY, now.getFullYear()),
    };
  }, [transactions]);

  const yearTx = useMemo(
    () => transactions.filter((t) => isActiveTx(t) && new Date(t.date).getFullYear() === year),
    [transactions, year]
  );

  const yearIncome = yearTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const yearExpense = yearTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const yearBalance = yearIncome - yearExpense;

  const months = useMemo(() => {
    const rows: {
      month: number;
      income: number;
      expense: number;
      balance: number;
      txs: Transaction[];
    }[] = [];
    for (let m = 11; m >= 0; m -= 1) {
      const txs = yearTx
        .filter((t) => new Date(t.date).getMonth() === m)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (txs.length === 0) continue;
      const income = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      rows.push({ month: m, income, expense, balance: income - expense, txs });
    }
    return rows;
  }, [yearTx]);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerWrap}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={8}
              accessibilityLabel="返回主界面"
            >
              <Feather name="chevron-left" size={26} color={theme.colors.text} />
            </Pressable>
            <Pressable
              onPress={() => setYearPickerOpen(true)}
              hitSlop={8}
              style={styles.yearTap}
              accessibilityLabel="选择年份"
            >
              <Text style={styles.yearTitle}>{year}年</Text>
              <Feather name="chevron-down" size={16} color={theme.colors.text} />
            </Pressable>
          </View>
          <Pressable
            onPress={() => navigation.navigate('AddTransaction')}
            hitSlop={8}
            style={styles.iconBtn}
            accessibilityLabel="记一笔"
          >
            <Feather name="plus" size={22} color={theme.colors.text} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ScenicBanner variant="lake">
          <Text style={styles.bannerLabel}>结余</Text>
          <Text style={styles.bannerAmount}>{money(amountsHidden, yearBalance)}</Text>
          <Text style={styles.bannerSub}>
            收入 {money(amountsHidden, yearIncome)}
            <Text style={styles.bannerSep}>  |  </Text>
            支出 {money(amountsHidden, yearExpense)}
          </Text>
        </ScenicBanner>

        <Pressable style={styles.yearStrip} onPress={() => setYearOpen((open) => !open)}>
          <Text style={styles.yearStripTitle}>{year}年</Text>
          <View style={styles.yearStripRight}>
            <Text style={styles.yearStripTag}>结余 </Text>
            <Text style={styles.yearStripValue}>{money(amountsHidden, yearBalance)}</Text>
            <Feather
              name={yearOpen ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={theme.colors.textPlaceholder}
            />
          </View>
        </Pressable>

        {!yearOpen ? null : months.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{year}年暂无流水</Text>
          </View>
        ) : (
          months.map((row) => {
            const open = expanded === row.month;
            let lastDay = '';
            return (
              <View key={row.month} style={styles.monthBlock}>
                <Pressable
                  style={styles.monthHead}
                  onPress={() => setExpanded(open ? null : row.month)}
                >
                  <View>
                    <Text style={styles.monthName}>{row.month + 1}月</Text>
                    <Text style={styles.monthYear}>{year}</Text>
                  </View>
                  <View style={styles.monthMid}>
                    <Text
                      style={[
                        styles.monthBalance,
                        { color: row.balance < 0 ? theme.colors.income : theme.colors.expense },
                      ]}
                    >
                      {money(amountsHidden, row.balance)}
                    </Text>
                    <Text style={styles.balanceTag}>结余</Text>
                  </View>
                  <Feather
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={theme.colors.textPlaceholder}
                  />
                </Pressable>
                <Text style={styles.monthMeta}>
                  收入 <Text style={styles.metaIn}>{money(amountsHidden, row.income)}</Text>
                  {'  '}
                  支出 <Text style={styles.metaOut}>{money(amountsHidden, row.expense)}</Text>
                </Text>
                {open
                  ? row.txs.map((t) => {
                      const d = new Date(t.date);
                      const day = String(d.getDate());
                      const showDay = day !== lastDay;
                      lastDay = day;
                      const visual = describeTransaction(t, categories, subCategories);
                      return (
                        <Pressable
                          key={t.id}
                          style={styles.txRow}
                          onPress={() => navigation.navigate('AddTransaction', { editingId: t.id })}
                        >
                          <View style={styles.txDate}>
                            {showDay ? (
                              <>
                                <Text style={styles.txDay}>{day}</Text>
                                <Text style={styles.txWeek}>{WEEKDAYS[d.getDay()]}</Text>
                              </>
                            ) : null}
                          </View>
                          <CategoryGlyph
                            name={visual.title}
                            color={visual.color}
                            size={theme.layout.listIconSize}
                          />
                          <View style={styles.txBody}>
                            <Text style={styles.txTitle}>{visual.title}</Text>
                            <Text style={styles.txTime}>
                              {pad2(d.getHours())}:{pad2(d.getMinutes())}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.txAmount,
                              {
                                color:
                                  t.type === 'income' ? theme.colors.income : theme.colors.expense,
                              },
                            ]}
                          >
                            {money(amountsHidden, t.amount)}
                          </Text>
                        </Pressable>
                      );
                    })
                  : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.bottomSafe}>
        <View style={styles.filterBar}>
          <Text style={[styles.filterItem, styles.filterOn]}>月</Text>
          <Text style={styles.filterItem}>分类</Text>
          <Text style={styles.filterItem}>更多</Text>
        </View>
      </SafeAreaView>

      <YearPickerModal
        visible={yearPickerOpen}
        year={year}
        minYear={yearBounds.minYear}
        maxYear={yearBounds.maxYear}
        onSelect={setYear}
        onClose={() => setYearPickerOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.page },
  headerWrap: { backgroundColor: theme.colors.page },
  header: {
    height: theme.layout.topBarHeight,
    paddingHorizontal: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  yearTap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  yearTitle: { ...theme.typography.title, fontWeight: '700', color: theme.colors.text },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 12 },
  bannerLabel: bannerText.label,
  bannerAmount: { ...bannerText.amount, marginTop: 2 },
  bannerSub: { ...bannerText.sub, marginTop: 6, fontWeight: '500' },
  bannerSep: { color: theme.colors.textOnDarkSoft, fontWeight: '400' },
  yearStrip: {
    minHeight: 48,
    paddingHorizontal: theme.layout.pagePadding,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.divider,
  },
  yearStripTitle: { ...theme.typography.listTitle, fontWeight: '700', color: theme.colors.text },
  yearStripRight: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  yearStripTag: { ...theme.typography.label, fontWeight: '400', color: theme.colors.textSecondary },
  yearStripValue: {
    ...theme.typography.listTitle,
    fontWeight: '700',
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
    marginRight: theme.spacing.xs,
  },
  empty: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { color: theme.colors.textSecondary, ...theme.typography.label, fontWeight: '400' },
  monthBlock: {
    paddingHorizontal: theme.layout.pagePadding,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.divider,
  },
  monthHead: { flexDirection: 'row', alignItems: 'center' },
  monthName: { ...theme.typography.section, color: theme.colors.text },
  monthYear: { ...theme.typography.caption, color: theme.colors.textMuted },
  monthMid: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    marginRight: theme.spacing.sm,
  },
  monthBalance: { ...theme.typography.headline, fontVariant: ['tabular-nums'] },
  balanceTag: {
    marginLeft: theme.spacing.xs,
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  monthMeta: {
    marginTop: theme.spacing.xs,
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  metaIn: { color: theme.colors.income, fontWeight: '600' },
  metaOut: { color: theme.colors.expense, fontWeight: '600' },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 14, gap: 10 },
  txDate: { width: 36 },
  txDay: { fontSize: 18, lineHeight: 22, fontWeight: '700', color: theme.colors.text },
  txWeek: { ...theme.typography.micro, color: theme.colors.textMuted, marginTop: -1 },
  txBody: { flex: 1 },
  txTitle: { ...theme.typography.body, color: theme.colors.text },
  txTime: { ...theme.typography.micro, color: theme.colors.textMuted, marginTop: 2 },
  txAmount: { ...theme.typography.bodyStrong, fontVariant: ['tabular-nums'] },
  bottomSafe: { backgroundColor: theme.colors.page },
  filterBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.page,
  },
  filterItem: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  filterOn: {
    color: theme.colors.accent,
    fontWeight: '700',
  },
});
