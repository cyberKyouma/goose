// 图表(图2): 分类支出/收入 — 二级页,无全局底栏,自有时段与饼图/条形切换
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Circle, G } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { useStore } from '../stores/appStore';
import { CategoryGlyph } from '../components';
import { theme } from '../theme';
import { RootStackParamList } from '../navigation/AppNavigator';
import {
  describeTransaction,
  formatMoney,
  isActiveTx,
  visualForName,
} from '../utils';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Shape = 'pie' | 'bar';
type Granularity = 'year' | 'month';
type Flow = 'expense' | 'income';

interface Slice {
  id: string;
  name: string;
  color: string;
  amount: number;
  pct: number;
}

const money = (hidden: boolean, value: number): string => (hidden ? '****' : formatMoney(value));

const Donut: React.FC<{ slices: Slice[]; size?: number }> = ({ slices, size = 176 }) => {
  const total = slices.reduce((sum, s) => sum + s.amount, 0);
  const r = 52;
  const stroke = 22;
  const circ = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;
  if (total <= 0) {
    return (
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} stroke={theme.colors.border} strokeWidth={stroke} fill="none" />
      </Svg>
    );
  }
  let offset = 0;
  return (
    <Svg width={size} height={size}>
      <G rotation={-90} origin={`${cx}, ${cy}`}>
        {slices.map((s) => {
          const len = Math.max(0, (s.amount / total) * circ - (slices.length > 1 ? 1.5 : 0));
          const node = (
            <Circle
              key={s.id}
              cx={cx}
              cy={cy}
              r={r}
              stroke={s.color}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += (s.amount / total) * circ;
          return node;
        })}
      </G>
    </Svg>
  );
};

export const ChartsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const transactions = useStore((s) => s.transactions);
  const categories = useStore((s) => s.categories);
  const subCategories = useStore((s) => s.subCategories);
  const amountsHidden = useStore((s) => s.amountsHidden);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [shape, setShape] = useState<Shape>('bar');
  const [granularity, setGranularity] = useState<Granularity>('year');
  const [flow, setFlow] = useState<Flow>('expense');

  const active = useMemo(() => transactions.filter(isActiveTx), [transactions]);

  const periodTx = useMemo(
    () =>
      active.filter((t) => {
        if (t.type !== flow) return false;
        const d = new Date(t.date);
        if (d.getFullYear() !== year) return false;
        if (granularity === 'month' && d.getMonth() !== monthIndex) return false;
        return true;
      }),
    [active, flow, granularity, monthIndex, year]
  );

  const slices = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of periodTx) {
      const visual = describeTransaction(t, categories, subCategories);
      const id = visual.categoryId || t.subCategoryId || 'other';
      map.set(id, (map.get(id) ?? 0) + t.amount);
    }
    const total = [...map.values()].reduce((s, n) => s + n, 0);
    const list: Slice[] = [...map.entries()]
      .map(([id, amount]) => {
        const cat = categories.find((c) => c.id === id);
        const name = cat?.name ?? '其他';
        const visual = visualForName(name, cat?.icon ?? '📦', cat?.color ?? '#C9CBCF');
        return {
          id,
          name,
          color: visual.color,
          amount,
          pct: total > 0 ? (amount / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);
    return { list, total };
  }, [categories, periodTx, subCategories]);

  const shiftPeriod = (dir: -1 | 1): void => {
    if (granularity === 'year') {
      setYear((y) => y + dir);
      return;
    }
    const next = new Date(year, monthIndex + dir, 1);
    setYear(next.getFullYear());
    setMonthIndex(next.getMonth());
  };

  const rangeLabel = (): string => {
    if (granularity === 'year') {
      return year === now.getFullYear() ? '本年 1.1 ~ 12.31' : `${year}.1.1 ~ ${year}.12.31`;
    }
    const last = new Date(year, monthIndex + 1, 0).getDate();
    return `${year}.${monthIndex + 1}.1 ~ ${year}.${monthIndex + 1}.${last}`;
  };

  const flowLabel = flow === 'expense' ? '支出' : '收入';

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerWrap}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={8}
            style={styles.iconBtn}
            accessibilityLabel="返回主界面"
          >
            <Feather name="chevron-left" size={26} color={theme.colors.text} />
          </Pressable>
          <Pressable
            style={styles.titleTap}
            onPress={() => setFlow((f) => (f === 'expense' ? 'income' : 'expense'))}
            accessibilityLabel="切换收支"
          >
            <Text style={styles.title}>分类{flowLabel}</Text>
            <Feather name="chevron-down" size={16} color={theme.colors.text} />
          </Pressable>
          <View style={styles.iconBtn} />
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.totalLabel}>总{flowLabel}</Text>
        <Text
          style={[
            styles.totalValue,
            { color: flow === 'expense' ? theme.colors.expense : theme.colors.income },
          ]}
        >
          {money(amountsHidden, slices.total)}
        </Text>

        {slices.list.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>该时段暂无{flowLabel}</Text>
          </View>
        ) : (
          <View>
            {shape === 'pie' ? (
              <View style={styles.pieWrap}>
                <Donut slices={slices.list} />
              </View>
            ) : null}
            {slices.list.map((s) => (
              <View key={s.id} style={styles.sliceRow}>
                <CategoryGlyph name={s.name} color={s.color} size={28} />
                <Text style={styles.sliceName} numberOfLines={1}>
                  {s.name}
                </Text>
                <Text style={styles.slicePct}>
                  {amountsHidden ? '**' : `${s.pct.toFixed(2)}%`}
                </Text>
                {shape === 'bar' ? (
                  <View style={styles.sliceTrack}>
                    <View
                      style={[
                        styles.sliceFill,
                        {
                          width: `${Math.max(Math.min(s.pct, 100), 2)}%`,
                          backgroundColor: s.color,
                        },
                      ]}
                    />
                  </View>
                ) : (
                  <View style={styles.sliceSpacer} />
                )}
                <Text style={styles.sliceAmount}>{money(amountsHidden, s.amount)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.bottomSafe}>
        <View style={styles.bottom}>
          <View style={styles.rangeRow}>
            <Pressable onPress={() => shiftPeriod(-1)} hitSlop={8} accessibilityLabel="上一时段">
              <Feather name="chevron-left" size={18} color={theme.colors.textSecondary} />
            </Pressable>
            <Text style={styles.rangeText}>{rangeLabel()}</Text>
            <Pressable onPress={() => shiftPeriod(1)} hitSlop={8} accessibilityLabel="下一时段">
              <Feather name="chevron-right" size={18} color={theme.colors.textSecondary} />
            </Pressable>
            <Pressable
              style={styles.granularity}
              onPress={() => setGranularity((g) => (g === 'year' ? 'month' : 'year'))}
            >
              <Text style={styles.granularityText}>{granularity === 'year' ? '按年' : '按月'}</Text>
            </Pressable>
          </View>
          <View style={styles.shapeRow}>
            <Pressable onPress={() => setShape('pie')} style={styles.shapeBtn}>
              <Text style={[styles.shapeText, shape === 'pie' && styles.shapeTextOn]}>饼图</Text>
              <View style={[styles.shapeUnderline, shape === 'pie' && styles.shapeUnderlineOn]} />
            </Pressable>
            <Pressable onPress={() => setShape('bar')} style={styles.shapeBtn}>
              <Text style={[styles.shapeText, shape === 'bar' && styles.shapeTextOn]}>条形图</Text>
              <View style={[styles.shapeUnderline, shape === 'bar' && styles.shapeUnderlineOn]} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.page },
  headerWrap: { backgroundColor: theme.colors.page },
  header: {
    height: theme.layout.topBarHeight,
    paddingHorizontal: theme.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titleTap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  title: { ...theme.typography.title, fontWeight: '700', color: theme.colors.text },
  scroll: { paddingHorizontal: theme.layout.pagePadding, paddingTop: 12, paddingBottom: 24 },
  totalLabel: { ...theme.typography.label, fontWeight: '400', color: theme.colors.textSecondary },
  totalValue: {
    ...theme.typography.hero,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: theme.spacing.md,
    fontVariant: ['tabular-nums'],
  },
  empty: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { color: theme.colors.textSecondary, ...theme.typography.label, fontWeight: '400' },
  pieWrap: { alignItems: 'center', marginBottom: theme.spacing.md },
  sliceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
    gap: theme.spacing.sm,
  },
  sliceName: { width: 64, ...theme.typography.label, fontWeight: '400', color: theme.colors.text },
  slicePct: { width: 58, ...theme.typography.caption, color: theme.colors.textSecondary },
  sliceTrack: {
    flex: 1,
    height: 5,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 3,
    overflow: 'hidden',
  },
  sliceFill: { height: 5, borderRadius: 3 },
  sliceSpacer: { flex: 1 },
  sliceAmount: {
    width: 92,
    textAlign: 'right',
    ...theme.typography.label,
    fontWeight: '400',
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
  bottomSafe: { backgroundColor: theme.colors.page },
  bottom: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.page,
    paddingBottom: theme.spacing.xs,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  rangeText: { ...theme.typography.label, fontWeight: '400', color: theme.colors.textSecondary },
  granularity: {
    marginLeft: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#FFF3E8',
  },
  granularityText: { ...theme.typography.caption, color: theme.colors.accent, fontWeight: '600' },
  shapeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: theme.spacing.md,
    height: 40,
  },
  shapeBtn: { paddingHorizontal: theme.spacing.sm, height: 40, justifyContent: 'center' },
  shapeText: { ...theme.typography.label, fontWeight: '400', color: theme.colors.textMuted },
  shapeTextOn: { color: theme.colors.accent, fontWeight: '700' },
  shapeUnderline: { marginTop: 2, height: 2, width: 28, borderRadius: 1, backgroundColor: 'transparent' },
  shapeUnderlineOn: { backgroundColor: theme.colors.accent },
});
