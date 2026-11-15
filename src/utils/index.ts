// 工具函数
import type { Category, SubCategory, Transaction } from '../models';

// 生成唯一ID
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// 格式化日期
export const formatDate = (date: string | Date, format: 'full' | 'date' | 'time' = 'full'): string => {
  const d = new Date(date);
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  switch (format) {
    case 'date':
      return `${year}-${month}-${day}`;
    case 'time':
      return `${hours}:${minutes}`;
    default:
      return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
};

// 格式化金额
export const formatAmount = (amount: number, showSign: boolean = false): string => {
  const sign = showSign && amount > 0 ? '+' : '';
  return `${sign}¥${amount.toFixed(2)}`;
};

// 获取月初日期
export const getMonthStart = (date: Date = new Date()): string => {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
};

// 获取月末日期
export const getMonthEnd = (date: Date = new Date()): string => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59).toISOString();
};

// 获取年初日期
export const getYearStart = (date: Date = new Date()): string => {
  return new Date(date.getFullYear(), 0, 1).toISOString();
};

// 获取年未日期
export const getYearEnd = (date: Date = new Date()): string => {
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59).toISOString();
};

export const pad2 = (n: number): string => String(n).padStart(2, '0');

export const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 本地日历日 yyyy-mm-dd,避免 toISOString 的 UTC 跨日 */
export const toYmd = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const startOfDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);

export const endOfDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

/** 周一为一周起点(本地时区) */
export const startOfWeek = (d: Date): Date => {
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const start = startOfDay(d);
  start.setDate(start.getDate() - diff);
  return start;
};

export const endOfWeek = (d: Date): Date => {
  const end = startOfWeek(d);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
};

export const startOfMonthDate = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);

export const endOfMonthDate = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

export const isActiveTx = (t: { status?: string }): boolean =>
  (t.status ?? 'active') !== 'revoked';

/** 千分位,保留两位。负数自带减号。 */
export const formatMoney = (amount: number): string => {
  const negative = amount < 0;
  const [intRaw, dec] = Math.abs(amount).toFixed(2).split('.');
  const grouped = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}.${dec}`;
};

export const formatDayHeading = (ymd: string): string => {
  const [y, m, day] = ymd.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, day || 1);
  return `${day}日 / ${WEEKDAYS[date.getDay()]}`;
};

const NAME_VISUAL: Record<string, { icon: string; color: string }> = {
  早餐: { icon: '🥣', color: '#F0B42A' },
  午餐: { icon: '🍜', color: '#F0B42A' },
  中餐: { icon: '🍜', color: '#F0B42A' },
  晚餐: { icon: '🍜', color: '#F0B42A' },
  夜宵: { icon: '🍜', color: '#F0B42A' },
  饮料: { icon: '🧋', color: '#F0B42A' },
  水果: { icon: '🍓', color: '#F0786A' },
  打车: { icon: '🚗', color: '#8B7CF6' },
  公交: { icon: '🚌', color: '#8B7CF6' },
  地铁: { icon: '🚇', color: '#5B8DEF' },
  油费: { icon: '⛽', color: '#8B7CF6' },
  停车: { icon: '🅿️', color: '#8B7CF6' },
  高铁: { icon: '🚄', color: '#5B8DEF' },
  水电: { icon: '💧', color: '#4C9BFF' },
  水电煤: { icon: '💧', color: '#4C9BFF' },
  房租: { icon: '🏠', color: '#2EBE9A' },
  餐饮: { icon: '🍜', color: '#FF5C8A' },
  交通: { icon: '🚗', color: '#7BC142' },
  购物: { icon: '🛍️', color: '#F5B400' },
  居住: { icon: '🏠', color: '#2EBE9A' },
  娱乐: { icon: '🎬', color: '#D946EF' },
  医疗: { icon: '💊', color: '#EF5350' },
  教育: { icon: '📚', color: '#5B8DEF' },
  其他支出: { icon: '📦', color: '#90A4AE' },
  工资: { icon: '👜', color: '#F0A202' },
  月薪: { icon: '👜', color: '#F0A202' },
  奖金: { icon: '🎁', color: '#FF9F43' },
  投资: { icon: '📈', color: '#26A69A' },
  其他收入: { icon: '💵', color: '#78909C' },
};

export const visualForName = (
  name: string,
  fallbackIcon: string,
  fallbackColor: string
): { icon: string; color: string } =>
  NAME_VISUAL[name] ?? { icon: fallbackIcon || '💰', color: fallbackColor || '#FF8A34' };

export interface TxVisual {
  title: string;
  parentName: string;
  icon: string;
  color: string;
  categoryId: string;
}

export const describeTransaction = (
  tx: Pick<Transaction, 'subCategoryId'>,
  categories: Category[],
  subs: SubCategory[]
): TxVisual => {
  const sub = subs.find((s) => s.id === tx.subCategoryId);
  const category = sub
    ? categories.find((c) => c.id === sub.categoryId)
    : categories.find((c) => c.id === tx.subCategoryId);
  const title = sub?.name || category?.name || '未分类';
  const visual = visualForName(title, sub?.icon || category?.icon || '💰', category?.color || '#FF8A34');
  return {
    title,
    parentName: category?.name || '未分类',
    icon: visual.icon,
    color: visual.color,
    categoryId: category?.id ?? '',
  };
};

// 按日期分组
export const groupByDate = <T extends { date: string }>(items: T[]): Record<string, T[]> => {
  return items.reduce((groups, item) => {
    const date = item.date.split('T')[0];
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(item);
    return groups;
  }, {} as Record<string, T[]>);
};
