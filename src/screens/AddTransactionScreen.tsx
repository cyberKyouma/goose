// 记一笔: 大金额 + 分类滚轮 + 数字键盘 + 时间滚轮 + 备注
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useStore } from '../stores/appStore';
import { theme } from '../theme';
import { CategoryPicker, CategoryWheel, CategoryGlyph, DatePickerWheel } from '../components';
import { RootStackParamList } from '../navigation/AppNavigator';
import { DEFAULT_ACCOUNT_NAME, describeTransaction, formatMoney, isActiveTx, pad2, toYmd } from '../utils';

type Panel = 'keypad' | 'category' | 'date';
type TxType = 'expense' | 'income';
type BookTab = 'template' | TxType | 'transfer' | 'balance';
type AddTxRoute = RouteProp<RootStackParamList, 'AddTransaction'>;

const ROW_H = 54;
const META_TINT = {
  category: '#F08AB0',
  time: '#F5A524',
  note: '#B39DDB',
};

const TABS: { id: BookTab; label: string }[] = [
  { id: 'template', label: '模板' },
  { id: 'expense', label: '支出' },
  { id: 'income', label: '收入' },
  { id: 'transfer', label: '转账' },
  { id: 'balance', label: '余额' },
];

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

const formatRecordTime = (d: Date): string => {
  const now = new Date();
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  if (toYmd(d) === toYmd(now)) return `今天${md} ${hm}`;
  if (d.getFullYear() !== now.getFullYear()) return `${d.getFullYear()}年${md} ${hm}`;
  return `${md} ${hm}`;
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

  const [book, setBook] = useState<BookTab>(initialType);
  const [type, setType] = useState<TxType>(initialType);
  const [amount, setAmount] = useState<string>(() =>
    editingTx ? String(round2(editingTx.amount)) : '0'
  );
  const [note, setNote] = useState(() => editingTx?.note ?? '');
  const [selectedSubId, setSelectedSubId] = useState<string>(initialSub);
  const [fromRecent, setFromRecent] = useState(!editingTx);
  const [date, setDate] = useState<Date>(() => (editingTx ? new Date(editingTx.date) : new Date()));
  const [panel, setPanel] = useState<Panel | null>('category');
  const [pickerStyle, setPickerStyle] = useState<'wheel' | 'list'>('wheel');
  const [catSearch, setCatSearch] = useState(false);
  const [catQuery, setCatQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingOp, setPendingOp] = useState<'+' | '-' | null>(null);
  const [acc, setAcc] = useState<number | null>(null);
  const [fresh, setFresh] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const selected = useMemo(() => {
    if (!selectedSubId) return null;
    return describeTransaction({ subCategoryId: selectedSubId }, categories, subCategories);
  }, [categories, selectedSubId, subCategories]);

  const templates = useMemo(() => {
    const seen = new Set<string>();
    const list: typeof transactions = [];
    for (const tx of transactions) {
      if (!isActiveTx(tx)) continue;
      const key = `${tx.type}:${tx.subCategoryId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(tx);
      if (list.length >= 12) break;
    }
    return list;
  }, [transactions]);

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
    setBook(next);
    if (next === type) return;
    setType(next);
    const last = transactions.find((t) => isActiveTx(t) && t.type === next);
    setSelectedSubId(last?.subCategoryId ?? '');
    setFromRecent(!!last);
    setErrorMessage(null);
    setPanel('category');
  };

  const applyTemplate = (tx: (typeof transactions)[number]): void => {
    setType(tx.type);
    setBook(tx.type);
    setAmount(String(round2(tx.amount)));
    setNote(tx.note);
    setSelectedSubId(tx.subCategoryId);
    setFromRecent(false);
    setFresh(true);
    setPendingOp(null);
    setAcc(null);
    setErrorMessage(null);
    setPanel('category');
  };

  const submit = async (): Promise<void> => {
    if (book === 'transfer') {
      setErrorMessage('当前只有现金账户,转账暂不可用');
      return;
    }
    if (book === 'balance') {
      setErrorMessage('余额调整暂不可用,请记收入或支出');
      return;
    }
    if (book === 'template') {
      setErrorMessage('请选择一个模板');
      return;
    }
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
      setPanel('keypad');
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
  const categoryPanelHeight = Math.min(420, Math.round(windowHeight * 0.42));
  const recordable = book === 'expense' || book === 'income';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} accessibilityLabel="返回">
          <Feather name="chevron-left" size={26} color="#333" />
        </Pressable>
        <Text style={styles.headerTitle}>记一笔</Text>
        <Pressable onPress={() => void submit()} style={styles.saveBtn} disabled={isRevoked} accessibilityLabel="保存">
          <Feather name="check" size={16} color={isRevoked ? '#ccc' : theme.colors.accent} />
          <Text style={[styles.saveText, isRevoked && styles.saveTextDisabled]}>保存</Text>
        </Pressable>
      </View>

      {isRevoked ? (
        <View style={styles.revokedBanner}>
          <Text style={styles.revokedBannerText}>该账目已撤销,不可编辑。如需修改请先恢复。</Text>
        </View>
      ) : null}

      <View style={styles.typeTabs}>
        {TABS.map((tab) => {
          const active = book === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => {
                if (tab.id === 'expense' || tab.id === 'income') switchType(tab.id);
                else setBook(tab.id);
                setErrorMessage(null);
              }}
              style={styles.typeTab}
            >
              <Text style={[styles.typeTabText, active && styles.typeTabTextActive]}>{tab.label}</Text>
              {active ? <View style={styles.typeCaret} /> : <View style={styles.typeCaretPlaceholder} />}
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setPanel((p) => (p ? null : 'category'))}
          style={styles.tabMore}
          accessibilityLabel="收起或展开选择器"
        >
          <Feather name={panel ? 'chevron-down' : 'chevron-up'} size={16} color="#C8C8C8" />
        </Pressable>
      </View>

      {book === 'template' ? (
        <ScrollView contentContainerStyle={styles.templateList}>
          {templates.length === 0 ? (
            <Text style={styles.unavailableText}>还没有模板。先记一笔,下次就能从这里套用分类和金额。</Text>
          ) : (
            templates.map((tx) => {
              const visual = describeTransaction(tx, categories, subCategories);
              return (
                <Pressable key={tx.id} style={styles.templateRow} onPress={() => applyTemplate(tx)}>
                  <CategoryGlyph name={visual.title} color={visual.color} size={34} />
                  <View style={styles.templateBody}>
                    <Text style={styles.templateTitle}>{visual.title}</Text>
                    <Text style={styles.templateSub}>{tx.type === 'income' ? '收入' : '支出'}</Text>
                  </View>
                  <Text style={[styles.templateAmount, { color: tx.type === 'income' ? theme.colors.income : theme.colors.expense }]}>
                    {formatMoney(tx.amount)}
                  </Text>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      ) : book === 'transfer' || book === 'balance' ? (
        <View style={styles.unavailable}>
          <Text style={styles.unavailableTitle}>{book === 'transfer' ? '转账' : '余额'}</Text>
          <Text style={styles.unavailableText}>
            {book === 'transfer'
              ? `转账需要至少两个账户。当前账本只有「${DEFAULT_ACCOUNT_NAME}」,请先用支出或收入记账。`
              : '余额调整还不是单独的账目类型。直接记一笔收入或支出即可。'}
          </Text>
          <Pressable style={styles.unavailableBtn} onPress={() => switchType('expense')}>
            <Text style={styles.unavailableBtnText}>去记支出</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.formScroll}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable style={styles.amountBlock} onPress={() => setPanel('keypad')}>
            <View style={styles.amountRow}>
              <Text style={[styles.amountText, { color: accent }]}>{displayAmount(amount)}</Text>
              <Pressable
                style={styles.camera}
                onPress={() => setFlashMessage('拍照记票据即将支持')}
                accessibilityLabel="拍照"
              >
                <Feather name="camera" size={18} color="#F07A8A" />
                <Text style={styles.cameraText}>拍照</Text>
              </Pressable>
            </View>
            <View style={[styles.amountLine, { backgroundColor: accent }]} />
            {errorMessage || expression ? (
              <Text style={[styles.expression, errorMessage ? styles.expressionError : null]} numberOfLines={1}>
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
                {formatRecordTime(date)}
              </Text>
              <Pressable onPress={() => setDate(new Date())} hitSlop={8} accessibilityLabel="重置为现在">
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
              <Pressable onPress={() => setFlashMessage('语音备注即将支持')} hitSlop={8} accessibilityLabel="语音备注">
                <Feather name="mic" size={18} color="#C8C8C8" />
              </Pressable>
            </View>
          </View>

          <View style={styles.chips}>
            <Pressable style={styles.chip} onPress={() => setAccountOpen(true)}>
              <Text style={styles.chipText}>账户</Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={() => setFlashMessage('暂无项目')}>
              <Text style={styles.chipText}>项目</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      {recordable && panel !== null ? (
        <View style={{ paddingBottom: insets.bottom > 0 ? insets.bottom : 0 }}>
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
            <View>
              <View style={styles.wheelBar}>
                <Pressable
                  style={styles.wheelIcon}
                  onPress={() => setPickerStyle('list')}
                  accessibilityLabel="管理分类"
                >
                  <Feather name="edit-2" size={16} color="#9A9A9A" />
                </Pressable>
                <View style={styles.wheelDivider} />
                <Pressable
                  style={styles.wheelIcon}
                  onPress={() => setCatSearch((v) => !v)}
                  accessibilityLabel="搜索分类"
                >
                  <Feather name="search" size={16} color={catSearch ? theme.colors.accent : '#9A9A9A'} />
                </Pressable>
                <View style={styles.wheelFlex} />
                <Pressable
                  style={styles.moreStyles}
                  onPress={() => setPickerStyle((s) => (s === 'wheel' ? 'list' : 'wheel'))}
                >
                  <Text style={styles.moreStylesText}>更多样式</Text>
                </Pressable>
                <Pressable style={styles.wheelIcon} onPress={() => setPanel(null)} accessibilityLabel="收起">
                  <Feather name="chevron-down" size={18} color="#C0C0C0" />
                </Pressable>
              </View>
              {catSearch ? (
                <TextInput
                  style={styles.catSearch}
                  value={catQuery}
                  onChangeText={setCatQuery}
                  placeholder="搜索分类"
                  placeholderTextColor={theme.colors.textPlaceholder}
                  autoFocus
                />
              ) : null}
              {pickerStyle === 'wheel' ? (
                <CategoryWheel
                  type={type}
                  categories={categories}
                  subCategories={subCategories}
                  transactions={transactions}
                  selectedSubId={selectedSubId}
                  query={catQuery}
                  onChange={({ subCategoryId, fromRecent: recent }) => {
                    setSelectedSubId(subCategoryId);
                    setFromRecent(!!recent);
                    setErrorMessage(null);
                  }}
                />
              ) : (
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
              )}
            </View>
          ) : null}

          {panel === 'date' ? (
            <View style={styles.datePanel}>
              <DatePickerWheel value={date} onChange={setDate} />
            </View>
          ) : null}
        </View>
      ) : recordable ? (
        <Pressable
          style={[styles.reopen, { paddingBottom: insets.bottom > 0 ? insets.bottom : 8 }]}
          onPress={() => setPanel('category')}
        >
          <Feather name="chevron-up" size={18} color="#C0C0C0" />
        </Pressable>
      ) : (
        <View style={{ height: insets.bottom }} />
      )}

      <Modal visible={accountOpen} transparent animationType="fade" onRequestClose={() => setAccountOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setAccountOpen(false)}>
          <Pressable style={styles.accountSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.accountTitle}>账户</Text>
            <View style={styles.accountRow}>
              <Text style={styles.accountName}>{DEFAULT_ACCOUNT_NAME}</Text>
              <Feather name="check" size={16} color={theme.colors.accent} />
            </View>
            <Text style={styles.accountHint}>当前账本只有这一个账户</Text>
          </Pressable>
        </Pressable>
      </Modal>
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
  saveBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 44, gap: 2 },
  saveText: { fontSize: 16, color: theme.colors.accent, fontWeight: '600' },
  saveTextDisabled: { color: theme.colors.textPlaceholder },
  revokedBanner: {
    backgroundColor: '#FFF1F0',
    paddingHorizontal: theme.layout.pagePadding,
    paddingVertical: theme.spacing.sm,
  },
  revokedBannerText: { color: '#A8071A', fontSize: 13 },
  typeTabs: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: 8,
    paddingRight: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F2F2',
  },
  typeTab: { alignItems: 'center', paddingTop: 8, paddingHorizontal: 10, minWidth: 48 },
  typeTabText: { fontSize: 15, color: '#C8C8C8', fontWeight: '500' },
  typeTabTextActive: { color: theme.colors.accent, fontWeight: '600' },
  typeCaret: {
    marginTop: 6,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: theme.colors.accent,
  },
  typeCaretPlaceholder: { marginTop: 6, height: 6 },
  tabMore: { marginLeft: 'auto', width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  formScroll: { flex: 1, minHeight: 0 },
  formContent: { paddingBottom: 12 },
  amountBlock: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4 },
  amountRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  amountText: {
    fontSize: 52,
    lineHeight: 60,
    fontWeight: '300',
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  amountLine: { height: 2, marginTop: 4, marginRight: 78, borderRadius: 1 },
  camera: {
    width: 58,
    height: 54,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#F0D0D4',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  cameraText: { fontSize: 11, color: '#F07A8A' },
  expression: { marginTop: 6, fontSize: 13, color: theme.colors.textMuted },
  expressionError: { color: theme.colors.danger },
  meta: { marginTop: 8 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.layout.pagePadding,
    minHeight: 50,
    gap: 8,
  },
  metaRowActive: { backgroundColor: '#FAFAFA' },
  metaLabel: { fontSize: 15, width: 36 },
  metaValue: { flex: 1, fontSize: 15, color: theme.colors.text },
  path: { flex: 1, fontSize: 15 },
  pathMuted: { color: '#9A9A9A' },
  pathSep: { color: '#C8C8C8' },
  pathStrong: { color: '#222', fontWeight: '600' },
  placeholder: { flex: 1, fontSize: 15, color: '#C8C8C8' },
  noteInput: { flex: 1, fontSize: 15, color: theme.colors.text, paddingVertical: 8 },
  chips: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 8 },
  chip: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E6E6E6',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  chipText: { fontSize: 13, color: '#9A9A9A' },
  wheelBar: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F0F0F0',
  },
  wheelIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  wheelDivider: { width: StyleSheet.hairlineWidth, height: 16, backgroundColor: '#E6E6E6' },
  wheelFlex: { flex: 1 },
  moreStyles: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E6E6E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreStylesText: { fontSize: 12, color: '#9A9A9A' },
  catSearch: {
    marginHorizontal: 16,
    marginBottom: 4,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F6F6F6',
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#222',
  },
  keypad: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.page,
  },
  keyLeft: { width: 46, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: theme.colors.divider },
  sideKey: { height: ROW_H, alignItems: 'center', justifyContent: 'center' },
  sideText: { fontSize: 13, color: theme.colors.textPlaceholder, fontWeight: '600' },
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
  okText: { color: theme.colors.white, fontSize: 16, fontWeight: '700' },
  datePanel: { backgroundColor: theme.colors.pageAlt },
  reopen: {
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  templateList: { paddingVertical: 8 },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  templateBody: { flex: 1 },
  templateTitle: { fontSize: 16, color: '#222' },
  templateSub: { marginTop: 2, fontSize: 12, color: '#A3A3A3' },
  templateAmount: { fontSize: 16, fontVariant: ['tabular-nums'] },
  unavailable: { flex: 1, paddingHorizontal: 28, paddingTop: 48 },
  unavailableTitle: { fontSize: 20, fontWeight: '600', color: '#222', marginBottom: 8 },
  unavailableText: { fontSize: 14, lineHeight: 22, color: '#8A8A8A' },
  unavailableBtn: {
    marginTop: 20,
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.accent,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  unavailableBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  accountSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  accountTitle: { fontSize: 13, color: '#9A9A9A', marginBottom: 8 },
  accountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  accountName: { fontSize: 16, color: theme.colors.accent, fontWeight: '600' },
  accountHint: { fontSize: 12, color: '#B0B0B0' },
});
