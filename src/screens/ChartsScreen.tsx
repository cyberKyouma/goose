// 分类支出: 总支出 + 占比条(相对最大类) + 本月翻页 + 饼图/条形图
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Circle, G } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { useStore } from '../stores/appStore';
import { CategoryGlyph } from '../components';
import { theme } from '../theme';
import { RootStackParamList } from '../navigation/AppNavigator';
import { describeTransaction, formatMoney, isActiveTx, visualForName } from '../utils';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Shape = 'pie' | 'bar';
type Granularity = 'year' | 'month';
type Flow = 'expense' | 'income';

interface ChildSlice {
  id: string;
  name: string;
  color: string;
  amount: number;
  pct: number;
}

interface Slice {
  id: string;
  name: string;
  color: string;
  amount: number;
  pct: number;
  children: ChildSlice[];
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
  const toggleAmountsHidden = useStore((s) => s.toggleAmountsHidden);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [shape, setShape] = useState<Shape>('bar');
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [flow, setFlow] = useState<Flow>('expense');
  const [openId, setOpenId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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
    const map = new Map<string, { amount: number; children: Map<string, ChildSlice> }>();
    for (const t of periodTx) {
      const visual = describeTransaction(t, categories, subCategories);
      const id = visual.categoryId || t.subCategoryId || 'other';
      const bucket = map.get(id) ?? { amount: 0, children: new Map() };
      bucket.amount += t.amount;
      const prev = bucket.children.get(t.subCategoryId);
      bucket.children.set(t.subCategoryId, {
        id: t.subCategoryId,
        name: visual.title,
        color: visual.color,
        amount: (prev?.amount ?? 0) + t.amount,
        pct: 0,
      });
      map.set(id, bucket);
    }
    const total = [...map.values()].reduce((s, n) => s + n.amount, 0);
    const list: Slice[] = [...map.entries()]
      .map(([id, bucket]) => {
        const cat = categories.find((c) => c.id === id);
        const name = cat?.name ?? '其他';
        const visual = visualForName(name, cat?.icon ?? '📦', cat?.color ?? '#C9CBCF');
        const children = [...bucket.children.values()]
          .map((child) => ({ ...child, pct: total > 0 ? (child.amount / total) * 100 : 0 }))
          .sort((a, b) => b.amount - a.amount);
        return {
          id,
          name,
          color: visual.color,
          amount: bucket.amount,
          pct: total > 0 ? (bucket.amount / total) * 100 : 0,
          children,
        };
      })
      .sort((a, b) => b.amount - a.amount);
    return { list, total, max: list[0]?.amount ?? 0 };
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
      return year === now.getFullYear() ? '本年 1.1 ~ 12.31' : `${year}.1.1 ~ 12.31`;
    }
    const last = new Date(year, monthIndex + 1, 0).getDate();
    const same = year === now.getFullYear() && monthIndex === now.getMonth();
    const prefix = same ? '本月 ' : `${year}.`;
    return `${prefix}${monthIndex + 1}.1 ~ ${monthIndex + 1}.${last}`;
  };

  const flowLabel = flow === 'expense' ? '支出' : '收入';
  const totalColor = flow === 'expense' ? theme.colors.expense : theme.colors.income;

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
          <View style={styles.headerRight}>
            <Pressable
              style={styles.reportBtn}
              onPress={() => setGranularity((g) => (g === 'month' ? 'year' : 'month'))}
              accessibilityLabel="报表"
            >
              <Text style={styles.reportText}>报表</Text>
            </Pressable>
            <Pressable
              onPress={() => setMenuOpen(true)}
              hitSlop={8}
              style={styles.moreBtn}
              accessibilityLabel="更多"
            >
              <Feather name="more-horizontal" size={20} color={theme.colors.text} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.totalLabel}>总{flowLabel}</Text>
        <Text style={[styles.totalValue, { color: totalColor }]}>{money(amountsHidden, slices.total)}</Text>

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
            {slices.list.map((s) => {
              const open = openId === s.id;
              const ratio = slices.max > 0 ? s.amount / slices.max : 0;
              return (
                <View key={s.id} style={styles.sliceBlock}>
                  <Pressable style={styles.sliceTop} onPress={() => setOpenId(open ? null : s.id)}>
                    <CategoryGlyph name={s.name} color={s.color} size={34} />
                    <Text style={styles.sliceName} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text style={styles.slicePct}>{amountsHidden ? '**' : `${s.pct.toFixed(2)}%`}</Text>
                    <View style={styles.sliceSpacer} />
                    <Text style={styles.sliceAmount}>{money(amountsHidden, s.amount)}</Text>
                    <Feather
                      name={open ? 'chevron-down' : 'chevron-right'}
                      size={16}
                      color="#C8C8C8"
                    />
                  </Pressable>
                  {shape === 'bar' ? (
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${Math.max(ratio * 100, 2)}%`, backgroundColor: s.color },
                        ]}
                      />
                    </View>
                  ) : null}
                  {open
                    ? s.children.map((child) => (
                        <View key={child.id} style={styles.childRow}>
                          <CategoryGlyph name={child.name} color={child.color} size={22} />
                          <Text style={styles.childName} numberOfLines={1}>
                            {child.name}
                          </Text>
                          <Text style={styles.childPct}>
                            {amountsHidden ? '**' : `${child.pct.toFixed(2)}%`}
                          </Text>
                          <Text style={styles.childAmount}>{money(amountsHidden, child.amount)}</Text>
                        </View>
                      ))
                    : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.bottomSafe}>
        <View style={styles.bottom}>
          <View style={styles.rangeRow}>
            <Pressable onPress={() => shiftPeriod(-1)} hitSlop={8} accessibilityLabel="上一时段">
              <Feather name="chevron-left" size={18} color="#9A9A9A" />
            </Pressable>
            <Text style={styles.rangeText}>{rangeLabel()}</Text>
            <Pressable onPress={() => shiftPeriod(1)} hitSlop={8} accessibilityLabel="下一时段">
              <Feather name="chevron-right" size={18} color="#9A9A9A" />
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

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menuSheet} onPress={(e) => e.stopPropagation()}>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setFlow((f) => (f === 'expense' ? 'income' : 'expense'));
                setMenuOpen(false);
              }}
            >
              <Text style={styles.menuText}>{flow === 'expense' ? '查看分类收入' : '查看分类支出'}</Text>
            </Pressable>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                toggleAmountsHidden();
                setMenuOpen(false);
              }}
            >
              <Text style={styles.menuText}>{amountsHidden ? '显示金额' : '隐藏金额'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.page },
  headerWrap: { backgroundColor: theme.colors.page },
  header: {
    height: theme.layout.topBarHeight,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titleTap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  title: { ...theme.typography.title, fontWeight: '600', color: theme.colors.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', paddingRight: 4 },
  reportBtn: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#FFB15A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportText: { color: theme.colors.accent, fontSize: 12, fontWeight: '500' },
  moreBtn: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 28 },
  totalLabel: { fontSize: 13, lineHeight: 18, color: '#9A9A9A' },
  totalValue: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '300',
    marginTop: 2,
    marginBottom: 22,
    fontVariant: ['tabular-nums'],
  },
  empty: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { color: theme.colors.textSecondary, fontSize: 14 },
  pieWrap: { alignItems: 'center', marginBottom: 12 },
  sliceBlock: { marginBottom: 16 },
  sliceTop: { flexDirection: 'row', alignItems: 'center', minHeight: 36, gap: 8 },
  sliceName: { fontSize: 16, color: '#222', maxWidth: 88 },
  slicePct: { fontSize: 13, color: '#A3A3A3' },
  sliceSpacer: { flex: 1 },
  sliceAmount: {
    fontSize: 16,
    color: '#333',
    fontVariant: ['tabular-nums'],
    marginRight: 2,
  },
  barTrack: { marginLeft: 42, marginRight: 8, marginTop: 8, height: 4, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 42,
    marginTop: 10,
  },
  childName: { flex: 1, fontSize: 14, color: '#444' },
  childPct: { width: 58, fontSize: 12, color: '#A3A3A3' },
  childAmount: { width: 84, textAlign: 'right', fontSize: 14, color: '#444', fontVariant: ['tabular-nums'] },
  bottomSafe: { backgroundColor: theme.colors.page },
  bottom: {
    minHeight: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EFEFEF',
    backgroundColor: theme.colors.page,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  rangeRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  rangeText: { fontSize: 13, color: '#8A8A8A' },
  shapeRow: { flexDirection: 'row', alignItems: 'center' },
  shapeBtn: { paddingHorizontal: 8, height: 40, justifyContent: 'center', alignItems: 'center' },
  shapeText: { fontSize: 13, color: '#C0C0C0' },
  shapeTextOn: { color: theme.colors.accent, fontWeight: '600' },
  shapeUnderline: { marginTop: 3, height: 2, width: 28, borderRadius: 1, backgroundColor: 'transparent' },
  shapeUnderlineOn: { backgroundColor: theme.colors.accent },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-start', alignItems: 'flex-end' },
  menuSheet: {
    marginTop: 88,
    marginRight: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    minWidth: 160,
    paddingVertical: 4,
  },
  menuRow: { paddingHorizontal: 16, paddingVertical: 12 },
  menuText: { fontSize: 15, color: '#222' },
});
