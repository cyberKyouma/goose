// 年度流水: 年结余横幅、目标、按月展开到日、底栏 天/分类/账户/项目/更多
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../stores/appStore';
import { CategoryGlyph, ScenicBanner, YearPickerModal } from '../components';
import { bannerText, theme } from '../theme';
import { Transaction } from '../models';
import { RootStackParamList } from '../navigation/AppNavigator';
import {
  DEFAULT_ACCOUNT_NAME,
  describeTransaction,
  formatMoney,
  visualForName,
  isActiveTx,
  pad2,
  WEEKDAYS,
  toYmd,
} from '../utils';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Lens = 'day' | 'category' | 'account' | 'project';
type Flow = 'all' | 'income' | 'expense';

const GOAL_KEY = '@goose/year-goal';
const GOAL_HIDE_KEY = '@goose/goal-hidden';

const money = (hidden: boolean, value: number): string => (hidden ? '****' : formatMoney(value));

interface DayBucket {
  ymd: string;
  income: number;
  expense: number;
  balance: number;
  txs: Transaction[];
}

interface MonthBucket {
  month: number;
  income: number;
  expense: number;
  balance: number;
  days: DayBucket[];
}

const sumBucket = (txs: Transaction[]): { income: number; expense: number; balance: number } => {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, balance: income - expense };
};

const OptionSheet: React.FC<{
  visible: boolean;
  title: string;
  options: { id: string; label: string }[];
  selected?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}> = ({ visible, title, options, selected, onSelect, onClose }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
        <Text style={styles.sheetTitle}>{title}</Text>
        {options.map((opt) => {
          const on = opt.id === selected;
          return (
            <Pressable key={opt.id} style={styles.sheetRow} onPress={() => onSelect(opt.id)}>
              <Text style={[styles.sheetLabel, on && styles.sheetLabelOn]}>{opt.label}</Text>
              {on ? <Feather name="check" size={16} color={theme.colors.accent} /> : null}
            </Pressable>
          );
        })}
      </Pressable>
    </Pressable>
  </Modal>
);

export const TransactionsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const transactions = useStore((s) => s.transactions);
  const categories = useStore((s) => s.categories);
  const subCategories = useStore((s) => s.subCategories);
  const amountsHidden = useStore((s) => s.amountsHidden);
  const toggleAmountsHidden = useStore((s) => s.toggleAmountsHidden);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState<number | null>(now.getMonth());
  const [openDays, setOpenDays] = useState<string[]>([]);
  const [lens, setLens] = useState<Lens>('day');
  const [flow, setFlow] = useState<Flow>('all');
  const [categoryId, setCategoryId] = useState<string | 'all'>('all');
  const [accountId, setAccountId] = useState<'all' | 'cash'>('all');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [goal, setGoal] = useState<number | null>(null);
  const [goalHidden, setGoalHidden] = useState(false);
  const [goalEditor, setGoalEditor] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(GOAL_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw) as Record<string, number>;
        const value = parsed[String(year)];
        setGoal(typeof value === 'number' && value > 0 ? value : null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [year]);

  useEffect(() => {
    AsyncStorage.getItem(GOAL_HIDE_KEY)
      .then((v) => setGoalHidden(v === '1'))
      .catch(() => undefined);
  }, []);

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

  const yearTx = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (!isActiveTx(t)) return false;
      const d = new Date(t.date);
      if (d.getFullYear() !== year) return false;
      if (flow !== 'all' && t.type !== flow) return false;
      const visual = describeTransaction(t, categories, subCategories);
      if (categoryId !== 'all' && visual.categoryId !== categoryId) return false;
      if (!q) return true;
      const hay = `${visual.title} ${visual.parentName} ${t.note} ${t.amount.toFixed(2)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [categories, categoryId, flow, query, subCategories, transactions, year]);

  const yearIncome = yearTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const yearExpense = yearTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const yearBalance = yearIncome - yearExpense;

  const months = useMemo<MonthBucket[]>(() => {
    const rows: MonthBucket[] = [];
    for (let m = 11; m >= 0; m -= 1) {
      const txs = yearTx
        .filter((t) => new Date(t.date).getMonth() === m)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (txs.length === 0) continue;
      const byDay = new Map<string, Transaction[]>();
      for (const t of txs) {
        const key = toYmd(new Date(t.date));
        const bucket = byDay.get(key);
        if (bucket) bucket.push(t);
        else byDay.set(key, [t]);
      }
      const days = [...byDay.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([ymd, dayTx]) => ({ ymd, ...sumBucket(dayTx), txs: dayTx }));
      rows.push({ month: m, ...sumBucket(txs), days });
    }
    return rows;
  }, [yearTx]);

  useEffect(() => {
    if (months.length === 0) return;
    const month = months.find((m) => m.month === expandedMonth) ?? months[0];
    if (!month?.days[0]) return;
    setOpenDays((prev) => (prev.length === 0 ? [month.days[0].ymd] : prev));
  }, [expandedMonth, months]);

  const categoryGroups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of yearTx) {
      const visual = describeTransaction(t, categories, subCategories);
      const id = visual.categoryId || 'other';
      const bucket = map.get(id);
      if (bucket) bucket.push(t);
      else map.set(id, [t]);
    }
    return [...map.entries()]
      .map(([id, txs]) => {
        const cat = categories.find((c) => c.id === id);
        const name = cat?.name ?? '未分类';
        const visual = visualForName(name, cat?.icon ?? '📦', cat?.color ?? '#C9CBCF');
        return { id, name, color: visual.color, txs, ...sumBucket(txs) };
      })
      .sort((a, b) => b.expense + b.income - (a.expense + a.income));
  }, [categories, subCategories, yearTx]);

  const toggleMonth = (month: number): void => {
    if (expandedMonth === month) {
      setExpandedMonth(null);
      return;
    }
    setExpandedMonth(month);
    const found = months.find((m) => m.month === month);
    setOpenDays(found?.days[0] ? [found.days[0].ymd] : []);
  };

  const toggleDay = (ymd: string): void => {
    setOpenDays((prev) => (prev.includes(ymd) ? prev.filter((d) => d !== ymd) : [...prev, ymd]));
  };

  const saveGoal = async (): Promise<void> => {
    const value = Math.round(parseFloat(goalDraft) * 100) / 100;
    if (!Number.isFinite(value) || value <= 0) return;
    const raw = await AsyncStorage.getItem(GOAL_KEY).catch(() => null);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    parsed[String(year)] = value;
    await AsyncStorage.setItem(GOAL_KEY, JSON.stringify(parsed));
    setGoal(value);
    setGoalEditor(false);
  };

  const clearGoal = async (): Promise<void> => {
    const raw = await AsyncStorage.getItem(GOAL_KEY).catch(() => null);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    delete parsed[String(year)];
    await AsyncStorage.setItem(GOAL_KEY, JSON.stringify(parsed));
    setGoal(null);
    setGoalEditor(false);
  };

  const hideGoal = (): void => {
    setGoalHidden(true);
    AsyncStorage.setItem(GOAL_HIDE_KEY, '1').catch(() => undefined);
  };

  const categoryOptions = [
    { id: 'all', label: '全部分类' },
    ...categories
      .filter((c) => c.type === 'expense' || c.type === 'income')
      .map((c) => ({ id: c.id, label: c.name })),
  ];
  const selectedCategoryName =
    categoryId === 'all' ? '全部 - 分类' : categories.find((c) => c.id === categoryId)?.name ?? '全部 - 分类';

  const renderTx = (t: Transaction, showDate: boolean): React.ReactNode => {
    const d = new Date(t.date);
    const visual = describeTransaction(t, categories, subCategories);
    const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    const meta = t.note ? `${hm} · ${DEFAULT_ACCOUNT_NAME} · ${t.note}` : `${hm} · ${DEFAULT_ACCOUNT_NAME}`;
    return (
      <Pressable
        key={t.id}
        style={styles.txRow}
        onPress={() => navigation.navigate('AddTransaction', { editingId: t.id })}
      >
        <View style={styles.txDate}>
          {showDate ? (
            <>
              <Text style={styles.txDay}>{d.getDate()}</Text>
              <Text style={styles.txWeek}>{WEEKDAYS[d.getDay()]}</Text>
            </>
          ) : null}
        </View>
        <CategoryGlyph name={visual.title} color={visual.color} size={36} />
        <View style={styles.txBody}>
          <Text style={styles.txTitle} numberOfLines={1}>
            {visual.title}
          </Text>
          <Text style={styles.txTime} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <Text style={[styles.txAmount, { color: t.type === 'income' ? theme.colors.income : theme.colors.expense }]}>
          {money(amountsHidden, t.amount)}
        </Text>
      </Pressable>
    );
  };

  const renderDayList = (days: DayBucket[]): React.ReactNode =>
    days.map((day) => {
      const open = openDays.includes(day.ymd);
      const [y, m] = day.ymd.split('-');
      let lastShown = '';
      return (
        <View key={day.ymd} style={styles.dayBlock}>
          <Pressable style={styles.dayHead} onPress={() => toggleDay(day.ymd)}>
            <View style={styles.dayLeft}>
              <Text style={styles.dayNum}>{Number(day.ymd.slice(8))}日</Text>
              <Text style={styles.daySub}>{y}. {Number(m)}</Text>
            </View>
            <View style={styles.dayRight}>
              <View style={styles.dayBalRow}>
                <Text style={styles.dayBal}>{money(amountsHidden, day.balance)}</Text>
                <Text style={styles.balTag}>结余</Text>
                <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#C8C8C8" />
              </View>
              <Text style={styles.dayMeta}>
                收入 <Text style={styles.metaIn}>{money(amountsHidden, day.income)}</Text>
                <Text style={styles.metaSep}>  |  </Text>
                支出 <Text style={styles.metaOut}>{money(amountsHidden, day.expense)}</Text>
              </Text>
            </View>
          </Pressable>
          {open
            ? day.txs.map((t) => {
                const stamp = toYmd(new Date(t.date));
                const show = stamp !== lastShown;
                lastShown = stamp;
                return renderTx(t, show);
              })
            : null}
        </View>
      );
    });

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerWrap}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="返回主界面">
              <Feather name="chevron-left" size={26} color={theme.colors.text} />
            </Pressable>
            <Pressable onPress={() => setYearPickerOpen(true)} hitSlop={8} accessibilityLabel="选择年份">
              <Text style={styles.yearTitle}>{year}年</Text>
            </Pressable>
          </View>
          <View style={styles.headerRight}>
            <Pressable
              onPress={() => {
                setSearchOpen((v) => {
                  if (v) setQuery('');
                  return !v;
                });
              }}
              hitSlop={8}
              style={styles.iconBtn}
              accessibilityLabel="搜索"
            >
              <Feather name="search" size={20} color={theme.colors.text} />
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('AddTransaction')}
              hitSlop={8}
              style={styles.iconBtn}
              accessibilityLabel="记一笔"
            >
              <Feather name="plus" size={22} color={theme.colors.text} />
            </Pressable>
          </View>
        </View>
        {searchOpen ? (
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="搜索分类、备注或金额"
            placeholderTextColor={theme.colors.textPlaceholder}
            autoFocus
          />
        ) : null}
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ScenicBanner variant="lake" height={188} contentStyle={styles.bannerContent}>
          <View style={styles.bannerFilters}>
            <Pressable style={styles.filterLine} onPress={() => setYearPickerOpen(true)}>
              <Text style={styles.filterValue}>{year}.1.1 - {year}.12.31</Text>
              <Text style={styles.filterTag}>时间</Text>
              <Feather name="chevron-down" size={11} color="rgba(255,255,255,0.9)" />
            </Pressable>
            <Pressable style={styles.filterLine} onPress={() => setCategoryOpen(true)}>
              <Text style={styles.filterValue}>{selectedCategoryName}</Text>
              <Feather name="chevron-down" size={11} color="rgba(255,255,255,0.9)" />
            </Pressable>
            <Pressable style={styles.filterLine} onPress={() => setAccountOpen(true)}>
              <Text style={styles.filterValue}>{accountId === 'all' ? '全部 - 账户' : DEFAULT_ACCOUNT_NAME}</Text>
              <Feather name="chevron-down" size={11} color="rgba(255,255,255,0.9)" />
            </Pressable>
          </View>
          <Text style={styles.bannerLabel}>结余</Text>
          <Text style={styles.bannerAmount}>{money(amountsHidden, yearBalance)}</Text>
          <Text style={styles.bannerSub}>
            收入 {money(amountsHidden, yearIncome)}
            <Text style={styles.bannerSep}>  |  </Text>
            支出 {money(amountsHidden, yearExpense)}
          </Text>
        </ScenicBanner>

        {goalHidden ? null : (
          <View style={styles.goal}>
            <View style={styles.goalHead}>
              <View style={styles.goalTitleRow}>
                <Text style={styles.goalTitle}>目标</Text>
                <Feather name="flag" size={14} color="#C8C8C8" />
              </View>
              <Pressable onPress={hideGoal} hitSlop={8} accessibilityLabel="关闭目标">
                <Feather name="x" size={16} color="#C8C8C8" />
              </Pressable>
            </View>
            <View style={styles.goalTrack}>
              <View
                style={[
                  styles.goalFill,
                  {
                    width: goal && goal > 0 ? `${Math.min(100, (yearExpense / goal) * 100)}%` : '0%',
                  },
                ]}
              />
            </View>
            <Text style={styles.goalText}>
              {goal ? (
                `本年支出目标 ${money(amountsHidden, goal)} · 已用 ${Math.min(999, Math.round((yearExpense / goal) * 100))}%`
              ) : (
                <>
                  未设置目标{' '}
                  <Text
                    style={styles.goalLink}
                    onPress={() => {
                      setGoalDraft('');
                      setGoalEditor(true);
                    }}
                  >
                    点此设置
                  </Text>
                </>
              )}
            </Text>
            {goal ? (
              <Pressable
                onPress={() => {
                  setGoalDraft(String(goal));
                  setGoalEditor(true);
                }}
              >
                <Text style={styles.goalLink}>修改目标</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {lens === 'project' ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>未设置项目</Text>
            <Text style={styles.emptySub}>当前账本按分类记账,还没有项目维度</Text>
          </View>
        ) : lens === 'account' ? (
          <View>
            <View style={styles.accountCard}>
              <Text style={styles.accountName}>{DEFAULT_ACCOUNT_NAME}</Text>
              <Text style={styles.accountBal}>{money(amountsHidden, yearBalance)}</Text>
              <Text style={styles.accountMeta}>
                收入 <Text style={styles.metaIn}>{money(amountsHidden, yearIncome)}</Text>
                {'  '}
                支出 <Text style={styles.metaOut}>{money(amountsHidden, yearExpense)}</Text>
              </Text>
            </View>
            {months.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>{year}年暂无流水</Text>
              </View>
            ) : (
              months.map((row) => (
                <View key={row.month}>
                  <Text style={styles.accountMonth}>{row.month + 1}月</Text>
                  {row.days.map((day) => day.txs.map((t, idx) => renderTx(t, idx === 0)))}
                </View>
              ))
            )}
          </View>
        ) : lens === 'category' ? (
          categoryGroups.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{year}年暂无流水</Text>
            </View>
          ) : (
            categoryGroups.map((group) => {
              const open = openCategoryId === group.id;
              return (
                <View key={group.id} style={styles.catBlock}>
                  <Pressable style={styles.catHead} onPress={() => setOpenCategoryId(open ? null : group.id)}>
                    <CategoryGlyph name={group.name} color={group.color} size={34} />
                    <Text style={styles.catName}>{group.name}</Text>
                    <Text style={styles.catAmount}>{money(amountsHidden, group.expense || group.income)}</Text>
                    <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#C8C8C8" />
                  </Pressable>
                  {open ? group.txs.map((t, idx) => renderTx(t, idx === 0 || toYmd(new Date(group.txs[idx - 1].date)) !== toYmd(new Date(t.date)))) : null}
                </View>
              );
            })
          )
        ) : months.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{year}年暂无流水</Text>
          </View>
        ) : (
          months.map((row) => {
            const open = expandedMonth === row.month;
            return (
              <View key={row.month} style={styles.monthBlock}>
                <Pressable style={styles.monthHead} onPress={() => toggleMonth(row.month)}>
                  <Text style={styles.monthTitle}>
                    {row.month + 1}月. {year}
                  </Text>
                  <View style={styles.monthRight}>
                    <Text style={styles.monthBal}>{money(amountsHidden, row.balance)}</Text>
                    <Text style={styles.balTag}>结余</Text>
                    <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#C8C8C8" />
                  </View>
                </Pressable>
                {open ? renderDayList(row.days) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.bottomSafe}>
        <View style={styles.filterBar}>
          {(
            [
              ['day', '天'],
              ['category', '分类'],
              ['account', '账户'],
              ['project', '项目'],
            ] as const
          ).map(([id, label]) => {
            const on = lens === id;
            return (
              <Pressable key={id} style={styles.filterTab} onPress={() => setLens(id)}>
                <Text style={[styles.filterTabText, on && styles.filterTabOn]}>{label}</Text>
                <Feather name="chevron-down" size={12} color={on ? '#222' : '#C6C6C6'} />
              </Pressable>
            );
          })}
          <Pressable style={styles.filterTab} onPress={() => setMoreOpen(true)}>
            <Text style={[styles.filterTabText, moreOpen && styles.filterTabOn]}>更多</Text>
            <Feather name="chevron-down" size={12} color={moreOpen ? '#222' : '#C6C6C6'} />
          </Pressable>
        </View>
      </SafeAreaView>

      <YearPickerModal
        visible={yearPickerOpen}
        year={year}
        minYear={yearBounds.minYear}
        maxYear={yearBounds.maxYear}
        onSelect={(y) => {
          setYear(y);
          setExpandedMonth(y === now.getFullYear() ? now.getMonth() : 11);
          setOpenDays([]);
        }}
        onClose={() => setYearPickerOpen(false)}
      />
      <OptionSheet
        visible={categoryOpen}
        title="分类"
        options={categoryOptions}
        selected={categoryId}
        onSelect={(id) => {
          setCategoryId(id);
          setCategoryOpen(false);
        }}
        onClose={() => setCategoryOpen(false)}
      />
      <OptionSheet
        visible={accountOpen}
        title="账户"
        options={[
          { id: 'all', label: '全部账户' },
          { id: 'cash', label: DEFAULT_ACCOUNT_NAME },
        ]}
        selected={accountId}
        onSelect={(id) => {
          setAccountId(id as 'all' | 'cash');
          setAccountOpen(false);
        }}
        onClose={() => setAccountOpen(false)}
      />
      <OptionSheet
        visible={moreOpen}
        title="更多"
        options={[
          { id: 'all', label: '全部收支' },
          { id: 'expense', label: '仅支出' },
          { id: 'income', label: '仅收入' },
          { id: 'eye', label: amountsHidden ? '显示金额' : '隐藏金额' },
          { id: 'expand', label: '展开本月全部日期' },
          { id: 'collapse', label: '收起日期' },
        ]}
        selected={flow}
        onSelect={(id) => {
          if (id === 'all' || id === 'expense' || id === 'income') setFlow(id);
          else if (id === 'eye') toggleAmountsHidden();
          else if (id === 'expand') {
            const month = months.find((m) => m.month === expandedMonth) ?? months[0];
            if (month) {
              setExpandedMonth(month.month);
              setOpenDays(month.days.map((d) => d.ymd));
            }
          } else if (id === 'collapse') setOpenDays([]);
          setMoreOpen(false);
        }}
        onClose={() => setMoreOpen(false)}
      />

      <Modal visible={goalEditor} transparent animationType="fade" onRequestClose={() => setGoalEditor(false)}>
        <Pressable style={styles.overlay} onPress={() => setGoalEditor(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{year}年支出目标</Text>
            <TextInput
              style={styles.goalInput}
              value={goalDraft}
              onChangeText={setGoalDraft}
              keyboardType="decimal-pad"
              placeholder="输入金额"
              placeholderTextColor={theme.colors.textPlaceholder}
              autoFocus
            />
            <View style={styles.goalActions}>
              {goal ? (
                <Pressable style={styles.goalGhost} onPress={() => void clearGoal()}>
                  <Text style={styles.goalGhostText}>清除</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.goalGhost} onPress={() => setGoalEditor(false)}>
                  <Text style={styles.goalGhostText}>取消</Text>
                </Pressable>
              )}
              <Pressable style={styles.goalSave} onPress={() => void saveGoal()}>
                <Text style={styles.goalSaveText}>保存</Text>
              </Pressable>
            </View>
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
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  yearTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.text },
  iconBtn: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 14,
    fontSize: 14,
    color: theme.colors.text,
  },
  scroll: { paddingBottom: 16 },
  bannerContent: { justifyContent: 'flex-end', paddingTop: 10 },
  bannerFilters: { position: 'absolute', top: 8, right: 12, alignItems: 'flex-end', gap: 4, maxWidth: '58%' },
  filterLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterValue: { color: 'rgba(255,255,255,0.92)', fontSize: 11, lineHeight: 15 },
  filterTag: { color: 'rgba(255,255,255,0.92)', fontSize: 11, lineHeight: 15 },
  bannerLabel: { ...bannerText.label, fontSize: 13 },
  bannerAmount: { ...bannerText.amount, fontSize: 36, lineHeight: 42, marginTop: 0 },
  bannerSub: { ...bannerText.sub, marginTop: 4, fontSize: 13 },
  bannerSep: { color: 'rgba(255,255,255,0.7)' },
  goal: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F2F2',
  },
  goalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  goalTitle: { fontSize: 15, color: '#222', fontWeight: '500' },
  goalTrack: { marginTop: 10, height: 3, borderRadius: 2, backgroundColor: '#F0F0F0', overflow: 'hidden' },
  goalFill: { height: 3, backgroundColor: theme.colors.accent },
  goalText: { marginTop: 8, fontSize: 13, color: '#B0B0B0' },
  goalLink: { color: theme.colors.accent, fontSize: 13 },
  empty: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { color: '#9A9A9A', fontSize: 14 },
  emptySub: { marginTop: 6, color: '#C0C0C0', fontSize: 12 },
  monthBlock: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F4F4F4',
  },
  monthHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 },
  monthTitle: { fontSize: 16, color: '#222', fontWeight: '500' },
  monthRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  monthBal: { fontSize: 16, color: '#222', fontVariant: ['tabular-nums'] },
  balTag: { fontSize: 12, color: '#A3A3A3', marginRight: 2 },
  dayBlock: { marginTop: 14 },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  dayLeft: { minWidth: 72 },
  dayNum: { fontSize: 22, lineHeight: 28, fontWeight: '600', color: '#222' },
  daySub: { marginTop: 2, fontSize: 12, color: '#B0B0B0' },
  dayRight: { flex: 1, alignItems: 'flex-end' },
  dayBalRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dayBal: { fontSize: 20, lineHeight: 26, fontWeight: '500', color: '#222', fontVariant: ['tabular-nums'] },
  dayMeta: { marginTop: 2, fontSize: 12, color: '#A3A3A3' },
  metaIn: { color: theme.colors.income },
  metaOut: { color: theme.colors.expense },
  metaSep: { color: '#D0D0D0' },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 14, gap: 10 },
  txDate: { width: 36 },
  txDay: { fontSize: 18, lineHeight: 22, fontWeight: '600', color: '#222' },
  txWeek: { fontSize: 11, color: '#B0B0B0', marginTop: -1 },
  txBody: { flex: 1 },
  txTitle: { fontSize: 16, color: '#222' },
  txTime: { fontSize: 12, color: '#B0B0B0', marginTop: 2 },
  txAmount: { fontSize: 18, fontWeight: '400', fontVariant: ['tabular-nums'] },
  accountCard: { paddingHorizontal: 16, paddingVertical: 16 },
  accountName: { fontSize: 16, color: '#222', fontWeight: '600' },
  accountBal: { marginTop: 4, fontSize: 28, fontWeight: '300', color: '#222', fontVariant: ['tabular-nums'] },
  accountMeta: { marginTop: 4, fontSize: 13, color: '#8A8A8A' },
  accountMonth: { paddingHorizontal: 16, paddingTop: 8, fontSize: 13, color: '#9A9A9A' },
  catBlock: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F4F4F4',
  },
  catHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catName: { flex: 1, fontSize: 16, color: '#222' },
  catAmount: { fontSize: 16, color: theme.colors.expense, fontVariant: ['tabular-nums'], marginRight: 4 },
  bottomSafe: { backgroundColor: theme.colors.page },
  filterBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EFEFEF',
    backgroundColor: '#FFFFFF',
  },
  filterTab: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 4, paddingVertical: 8 },
  filterTabText: { fontSize: 14, color: '#C6C6C6' },
  filterTabOn: { color: '#222', fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 14,
    paddingBottom: 28,
    maxHeight: '70%',
  },
  sheetTitle: { fontSize: 13, color: '#9A9A9A', paddingHorizontal: 20, marginBottom: 6 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sheetLabel: { fontSize: 16, color: '#222' },
  sheetLabelOn: { color: theme.colors.accent, fontWeight: '600' },
  goalInput: {
    marginHorizontal: 20,
    marginTop: 8,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F6F6F6',
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#222',
  },
  goalActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 16 },
  goalGhost: { flex: 1, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F4' },
  goalGhostText: { color: '#666', fontSize: 15 },
  goalSave: { flex: 1, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accent },
  goalSaveText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
