// 数据模型定义

// 大类
export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense';
}

// 小类
export interface SubCategory {
  id: string;
  name: string;
  categoryId: string;
  icon?: string;
  // 系统默认"其他":不可删除,固定排到所属大类的最后
  isDefault?: boolean;
  sortOrder?: number;
}

// 账目状态:撤销 vs 正常
export type TransactionStatus = 'active' | 'revoked';

// 账目
export interface Transaction {
  id: string;
  amount: number;
  date: string; // ISO string
  note: string;
  subCategoryId: string;
  type: 'income' | 'expense';
  status?: TransactionStatus; // 缺省视为 'active'
  revokedAt?: string; // ISO;撤销时记录
}

// 总览配置
export interface OverviewConfig {
  showIncome: boolean;
  showExpense: boolean;
  dateRange: 'day' | 'week' | 'month' | 'year';
}

// 筛选条件
export interface FilterParams {
  categoryId?: string;
  subCategoryId?: string;
  startDate?: string;
  endDate?: string;
  type?: 'income' | 'expense';
  minAmount?: number;
  maxAmount?: number;
}

// 图表数据
export interface ChartData {
  labels: string[];
  values: number[];
  colors?: string[];
}
