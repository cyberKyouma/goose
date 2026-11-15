// 记一笔: 大金额 + 数字键盘(+/-) + 一二级分类 + 时间滚轮 + 备注
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useStore } from '../stores/appStore';
import { theme } from '../theme';
import { CategoryPicker, DatePickerWheel } from '../components';
import { RootStackParamList } from '../navigation/AppNavigator';
import { describeTransaction, isActiveTx, pad2 } from '../utils';

type Panel = 'keypad' | 'category' | 'date';
type TxType = 'expense' | 'income';
type AddTxRoute = RouteProp<RootStackParamList, 'AddTransaction'>;

const ROW_H = 54;

const META_TINT = {
  category: '#F08AB0',
  time: '#F5A524',
  note: '#B39DDB',
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

const parseAmt = (raw: string): number => {
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
};

const displayAmount = (raw: string): string => {
  if (!raw || raw === '0') return '0.00';
  if (raw.endsWith('.')) return raw;
  if (!raw.includes('.')) return `${raw}.00`;
  return raw;
};

const formatCnDateTime = (d: Date): string => {
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
};

const KEY_ROWS: string[][] = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['.', '0', 'del'],
];

export const AddTransactionScreen: React.FC<{ route?: AddTxRoute }> = ({ route }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const editingId = route?.params?.editingId;

  const categories = useStore((s) => s.categories);
  const subCategories = useStore((s) => s.subCategories);
  const transactions = useStore((s) => s.transactions);
  const addTransaction = useStore((s) => s.addTransaction);
  const updateTransaction = useStore((s) => s.updateTransaction);
  const addCategory = useStore((s) => s.addCategory);
  const removeCategory = useStore((s) => s.removeCategory);
  const addSubCategory = useStore((s) => s.addSubCategory);
  const removeSubCategory = useStore((s) => s.removeSubCategory);
  const confirmMigrateDeleteSubCategory = useStore((s) => s.confirmMigrateDeleteSubCategory);
  const setFlashMessage = useStore((s) => s.setFlashMessage);
  const lastTxType = useStore((s) => s.lastTxType);

  const editingTx = useMemo(
    () => (editingId ? transactions.find((t) => t.id === editingId) : undefined),
    [editingId, transactions]
  );
  const isRevoked = editingTx ? !isActiveTx(editingTx) : false;
  const isEdit = !!editingTx;

  const initialType: TxType = editingTx?.type ?? lastTxType;
  const initialSub = (): string => {
    if (editingTx) return editingTx.subCategoryId;
    const last = transactions.find((t) => isActiveTx(t) && t.type === initialType);
    return last?.subCategoryId ?? '';
  };

  const [type, setType] = useState<TxType>(initialType);
  const [amount, setAmount] = useState<string>(() =>
    editingTx ? String(round2(editingTx.amount)) : '0'
  );
  const [note, setNote] = useState(() => editingTx?.note ?? '');
  const [selectedSubId, setSelectedSubId] = useState<string>(initialSub);
  const [fromRecent, setFromRecent] = useState(!editingTx);
  const [date, setDate] = useState<Date>(() => (editingTx ? new Date(editingTx.date) : new Date()));
  const [panel, setPanel] = useState<Panel | null>('keypad');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingOp, setPendingOp] = useState<'+' | '-' | null>(null);
  const [acc, setAcc] = useState<number | null>(null);
  const [fresh, setFresh] = useState(false);

  const selected = useMemo(() => {
    if (!selectedSubId) return null;
    return describeTransaction({ subCategoryId: selectedSubId }, categories, subCategories);
  }, [categories, selectedSubId, subCategories]);

  const expression = useMemo(() => {
    if (!pendingOp || acc === null) return '';
    const tail = fresh ? '' : displayAmount(amount).replace(/\.00$/, '');
    return `${String(round2(acc))}${pendingOp}${tail}`;
  }, [acc, amount, fresh, pendingOp]);

  const appendDigit = (key: string): void => {
    setErrorMessage(null);
    const base = fresh ? '0' : amount;
    if (key === '.') {
      if (fresh) {
        setAmount('0.');
        setFresh(false);
        return;
      }
      if (base.includes('.')) return;
      setAmount(`${base}.`);
      return;
    }
    const next = fresh || base === '0' ? key : base + key;
    const intPart = next.split('.')[0].replace('-', '');
    if (intPart.length > 9) return;
    const dec = next.split('.')[1];
    if (dec && dec.length > 2) return;
    setAmount(next);
    setFresh(false);
  };

  const backspace = (): void => {
    setErrorMessage(null);
    if (fresh || amount.length <= 1) {
      setAmount('0');
      setFresh(true);
      return;
    }
    const next = amount.slice(0, -1);
    setAmount(next === '' || next === '-' ? '0' : next);
  };

  const onOperator = (op: '+' | '-'): void => {
    setErrorMessage(null);
    const current = parseAmt(amount);
    if (pendingOp && acc !== null && !fresh) {
      const result = round2(pendingOp === '+' ? acc + current : acc - current);
      setAcc(result);
      setAmount(String(result));
    } else {
      setAcc(current);
      setAmount(String(round2(current)));
    }
    setPendingOp(op);
    setFresh(true);
  };

  const onEquals = (): void => {
    if (!pendingOp || acc === null) return;
    if (fresh) {
      setAmount(String(round2(acc)));
    } else {
      const current = parseAmt(amount);
      const result = round2(pendingOp === '+' ? acc + current : acc - current);
      setAmount(String(result));
    }
    setPendingOp(null);
    setAcc(null);
    setFresh(true);
  };

  const resolveAmount = (): number => {
    if (pendingOp && acc !== null) {
      if (fresh) return round2(acc);
      const current = parseAmt(amount);
      return round2(pendingOp === '+' ? acc + current : acc - current);
    }
    return round2(parseAmt(amount));
  };

  const switchType = (next: TxType): void => {
    if (next === type) return;
    setType(next);
    const last = transactions.find((t) => isActiveTx(t) && t.type === next);
    setSelectedSubId(last?.subCategoryId ?? '');
    setFromRecent(!!last);
    setErrorMessage(null);
  };

  const submit = async (): Promise<void> => {
    if (isRevoked) {
      setErrorMessage('已撤销的账目不可编辑,请先恢复');
      return;
    }
    const finalAmount = resolveAmount();
    setAmount(String(finalAmount));
    setPendingOp(null);
    setAcc(null);
    setFresh(true);
    if (!finalAmount || finalAmount <= 0) {
      setErrorMessage('请输入有效金额');
      return;
    }
    if (!selectedSubId) {
      setErrorMessage('请选择分类');
      setPanel('category');
      return;
    }
    try {
      if (isEdit && editingTx) {
        await updateTransaction({
          ...editingTx,
          amount: finalAmount,
          date: date.toISOString(),
          note: note.trim(),
          subCategoryId: selectedSubId,
          type,
        });
      } else {
        await addTransaction({
          amount: finalAmount,
          date: date.toISOString(),
          note: note.trim(),
          subCategoryId: selectedSubId,
          type,
        });
      }
      setFlashMessage('保存成功');
      navigation.goBack();
    } catch {
      setErrorMessage('保存失败,请重试');
    }
  };

  const onOrange = (): void => {
    if (pendingOp) onEquals();
    else void submit();
  };

  const accent = type === 'expense' ? theme.colors.expense : theme.colors.income;
  const categoryPanelHeight = Math.min(420, Math.round(windowHeight * 0.48));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} accessibilityLabel="返回">
          <Feather name="chevron-left" size={26} color="#333" />
        </Pressable>
        <Text style={styles.headerTitle}>记一笔</Text>
        <Pressable
          onPress={() => void submit()}
          style={styles.saveBtn}
          disabled={isRevoked}
          accessibilityLabel="保存"
        >
          <Feather name="check" size={16} color={isRevoked ? '#ccc' : theme.colors.expense} />
          <Text style={[styles.saveText, isRevoked && styles.saveTextDisabled]}>保存</Text>
        </Pressable>
      </View>

      {isRevoked ? (
        <View style={styles.revokedBanner}>
          <Text style={styles.revokedBannerText}>该账目已撤销,不可编辑。如需修改请先恢复。</Text>
        </View>
      ) : null}

      <View style={styles.typeTabs}>
        {(['expense', 'income'] as TxType[]).map((t) => {
          const active = type === t;
          return (
            <Pressable key={t} onPress={() => switchType(t)} style={styles.typeTab}>
              <Text style={[styles.typeTabText, active && styles.typeTabTextActive]}>
                {t === 'expense' ? '支出' : '收入'}
              </Text>
              {active ? <View style={styles.typeTabBar} /> : <View style={styles.typeTabBarPlaceholder} />}
            </Pressable>
          );
        })}
      </View>

      <Pressable style={styles.amountBlock} onPress={() => setPanel('keypad')}>
        <Text style={[styles.amountText, { color: accent }]}>{displayAmount(amount)}</Text>
        {errorMessage || expression ? (
          <Text
            style={[styles.expression, errorMessage ? styles.expressionError : null]}
            numberOfLines={1}
          >
            {errorMessage || expression}
          </Text>
        ) : null}
      </Pressable>

      <View style={styles.meta}>
        <Pressable
          style={[styles.metaRow, panel === 'category' && styles.metaRowActive]}
          onPress={() => setPanel((p) => (p === 'category' ? 'keypad' : 'category'))}
        >
          <Feather name="grid" size={16} color={META_TINT.category} />
          <Text style={[styles.metaLabel, { color: META_TINT.category }]}>分类</Text>
          {selected && selected.title !== '未分类' ? (
            <Text style={styles.path} numberOfLines={1}>
              <Text style={styles.pathMuted}>{fromRecent ? '最近使用' : selected.parentName}</Text>
              <Text style={styles.pathSep}>{' > '}</Text>
              <Text style={styles.pathStrong}>{selected.title}</Text>
            </Text>
          ) : (
            <Text style={styles.placeholder}>请选择</Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.metaRow, panel === 'date' && styles.metaRowActive]}
          onPress={() => setPanel((p) => (p === 'date' ? 'keypad' : 'date'))}
        >
          <Feather name="clock" size={16} color={META_TINT.time} />
          <Text style={[styles.metaLabel, { color: META_TINT.time }]}>时间</Text>
          <Text style={styles.metaValue} numberOfLines={1}>
            {formatCnDateTime(date)}
          </Text>
          <Pressable
            onPress={() => setDate(new Date())}
            hitSlop={8}
            accessibilityLabel="重置为现在"
          >
            <Feather name="x" size={16} color="#C8C8C8" />
          </Pressable>
        </Pressable>

        <View style={styles.metaRow}>
          <Feather name="bookmark" size={16} color={META_TINT.note} />
          <Text style={[styles.metaLabel, { color: META_TINT.note }]}>备注</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="..."
            placeholderTextColor="#C8C8C8"
            maxLength={50}
            onFocus={() => setPanel(null)}
          />
        </View>
      </View>

      <View style={styles.flexSpacer} />

      {panel !== null ? (
        <View style={{ paddingBottom: insets.bottom > 0 ? insets.bottom : 0 }}>
          <Pressable style={styles.collapse} onPress={() => setPanel(null)} accessibilityLabel="收起">
            <Feather name="chevron-down" size={18} color="#C0C0C0" />
          </Pressable>

          {panel === 'keypad' ? (
            <View style={styles.keypad}>
              <View style={styles.keyLeft}>
                <Pressable style={styles.sideKey} onPress={() => switchType('expense')}>
                  <Text style={[styles.sideText, type === 'expense' && styles.sideExpense]}>支出</Text>
                </Pressable>
                <Pressable style={styles.sideKey} onPress={() => switchType('income')}>
                  <Text style={[styles.sideText, type === 'income' && styles.sideIncome]}>收入</Text>
                </Pressable>
              </View>
              <View style={styles.keyGrid}>
                {KEY_ROWS.map((row) => (
                  <View key={row.join('-')} style={styles.keyRow}>
                    {row.map((key) => (
                      <Pressable
                        key={key}
                        style={styles.key}
                        onPress={() => (key === 'del' ? backspace() : appendDigit(key))}
                      >
                        {key === 'del' ? (
                          <Feather name="delete" size={20} color="#666" />
                        ) : (
                          <Text style={styles.keyText}>{key}</Text>
                        )}
                      </Pressable>
                    ))}
                  </View>
                ))}
              </View>
              <View style={styles.keyOps}>
                <Pressable style={styles.opKey} onPress={() => onOperator('-')}>
                  <Text style={[styles.opText, pendingOp === '-' && styles.opTextOn]}>−</Text>
                </Pressable>
                <Pressable style={styles.opKey} onPress={() => onOperator('+')}>
                  <Text style={[styles.opText, pendingOp === '+' && styles.opTextOn]}>+</Text>
                </Pressable>
                <Pressable style={styles.okKey} onPress={onOrange} accessibilityLabel={pendingOp ? '计算结果' : '确定'}>
                  <Text style={styles.okText}>{pendingOp ? '=' : '确定'}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {panel === 'category' ? (
            <View style={{ height: categoryPanelHeight }}>
              <CategoryPicker
                type={type}
                categories={categories}
                subCategories={subCategories}
                transactions={transactions}
                selectedSubId={selectedSubId}
                onChange={({ subCategoryId, fromRecent: recent }) => {
                  setSelectedSubId(subCategoryId);
                  setFromRecent(!!recent);
                  setErrorMessage(null);
                }}
                onCreateCategory={addCategory}
                onDeleteCategory={removeCategory}
                onCreateSubCategory={addSubCategory}
                onDeleteSubCategory={removeSubCategory}
                onConfirmMigrateDeleteSubCategory={confirmMigrateDeleteSubCategory}
              />
            </View>
          ) : null}

          {panel === 'date' ? (
            <View style={styles.datePanel}>
              <DatePickerWheel value={date} onChange={setDate} />
            </View>
          ) : null}
        </View>
      ) : (
        <Pressable
          style={[styles.reopen, { paddingBottom: insets.bottom > 0 ? insets.bottom : 8 }]}
          onPress={() => setPanel('keypad')}
        >
          <Feather name="chevron-up" size={18} color="#C0C0C0" />
        </Pressable>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.page },
  header: {
    height: theme.layout.topBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.sm,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...theme.typography.title, color: theme.colors.text },
  saveBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: 44, gap: 2 },
  saveText: { ...theme.typography.listTitle, color: theme.colors.expense, fontWeight: '600' },
  saveTextDisabled: { color: theme.colors.textPlaceholder },
  revokedBanner: {
    backgroundColor: '#FFF1F0',
    paddingHorizontal: theme.layout.pagePadding,
    paddingVertical: theme.spacing.sm,
  },
  revokedBannerText: { color: '#A8071A', ...theme.typography.label, fontWeight: '400' },
  typeTabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.divider,
  },
  typeTab: { alignItems: 'center', paddingTop: 6, minWidth: 56 },
  typeTabText: { ...theme.typography.listTitle, color: theme.colors.textPlaceholder, fontWeight: '500' },
  typeTabTextActive: { color: theme.colors.text, fontWeight: '600' },
  typeTabBar: {
    marginTop: theme.spacing.sm,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.accent,
  },
  typeTabBarPlaceholder: { marginTop: theme.spacing.sm, height: 3 },
  amountBlock: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 6 },
  amountText: {
    ...theme.typography.display,
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  expression: { marginTop: theme.spacing.xs, ...theme.typography.label, fontWeight: '400', color: theme.colors.textMuted },
  expressionError: { color: theme.colors.danger },
  meta: { marginTop: theme.spacing.sm },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.layout.pagePadding,
    minHeight: 50,
    gap: theme.spacing.sm,
  },
  metaRowActive: { backgroundColor: theme.colors.pageAlt },
  metaLabel: { ...theme.typography.body, color: theme.colors.textSecondary, width: 36 },
  metaValue: { flex: 1, ...theme.typography.body, color: theme.colors.text },
  path: { flex: 1, ...theme.typography.body },
  pathMuted: { color: theme.colors.textSecondary },
  pathSep: { color: theme.colors.textPlaceholder },
  pathStrong: { color: theme.colors.text, fontWeight: '600' },
  placeholder: { flex: 1, ...theme.typography.body, color: theme.colors.textPlaceholder },
  noteInput: { flex: 1, ...theme.typography.body, color: theme.colors.text, paddingVertical: theme.spacing.sm },
  flexSpacer: { flex: 1, minHeight: theme.spacing.sm },
  collapse: { alignItems: 'center', paddingVertical: 2 },
  reopen: {
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  keypad: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.page,
  },
  keyLeft: { width: 46, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: theme.colors.divider },
  sideKey: { height: ROW_H, alignItems: 'center', justifyContent: 'center' },
  sideText: { ...theme.typography.label, color: theme.colors.textPlaceholder, fontWeight: '600' },
  sideExpense: { color: theme.colors.expense },
  sideIncome: { color: theme.colors.income },
  keyGrid: { flex: 1 },
  keyRow: { flexDirection: 'row', height: ROW_H },
  key: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.divider,
  },
  keyText: { fontSize: 24, lineHeight: 28, color: theme.colors.text, fontWeight: '400' },
  keyOps: { width: 78 },
  opKey: {
    height: ROW_H,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.divider,
  },
  opText: { fontSize: 26, lineHeight: 30, color: theme.colors.textSecondary, fontWeight: '400' },
  opTextOn: { color: theme.colors.accent, fontWeight: '700' },
  okKey: {
    flex: 1,
    margin: theme.spacing.sm,
    borderRadius: 10,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okText: { color: theme.colors.white, ...theme.typography.title, fontWeight: '700' },
  datePanel: { backgroundColor: theme.colors.pageAlt },
});
