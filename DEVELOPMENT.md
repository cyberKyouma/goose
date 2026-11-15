# Goose 记账软件开发框架

> 本文档面向 Goose 项目的开发与维护人员,定义项目架构、编码规范、工作流程与未来规划。

## 1. 项目现状

### 1.1 技术栈

| 类别 | 选型 |
| --- | --- |
| 框架 | Expo SDK 55 (React Native 0.83) |
| 语言 | TypeScript 5.9 (strict) |
| 跨端 | iOS / Android / Web (`react-native-web`) |
| 状态管理 | Zustand 5 |
| 导航 | React Navigation 7 Native Stack:主界面含底栏;图表/流水为二级页 |
| 本地存储 | AsyncStorage (Web) / expo-sqlite (Native) 双实现 |
| 图标 | `lucide-react-native` + `react-native-vector-icons/Feather` |
| 图表 | `react-native-chart-kit` |
| UI 风格 | 浅色主题 (强调色 `#FF8A34`,支出绿 `#2EBE6E`,收入红 `#F04452`);排版/文字色/字体族/横幅见 `src/theme`(`fonts` 为字体总闸) |

### 1.2 现有目录结构

```
goose/
├── App.tsx                 # 根组件: 加载状态 + SafeArea + Navigator
├── index.ts                # Expo 注册入口
├── app.json                # Expo 应用配置
├── src/
│   ├── components/         # 通用 UI 组件 (Button, Card, Input, FAB, TransactionItem)
│   ├── models/             # 数据模型与类型定义
│   ├── navigation/         # 导航配置 (AppNavigator)
│   ├── screens/            # 页面级组件 (Home/Overview/Transactions/...)
│   ├── services/           # 数据访问层 (database.ts / database-web.ts)
│   ├── stores/             # Zustand 全局状态
│   ├── theme/              # 主题与设计 Token
│   └── utils/              # 通用工具函数
```

### 1.3 已实现功能

- 底部 Tab 导航 + 中央悬浮「+」记账入口
- 收入/支出分类(大类 + 小类)增删
- 流水按时间/分类/类型筛选,日期分组展示
- 概览页收入/支出/结余
- 图表页
- 本地持久化(双端兼容)

### 1.4 已知问题 / 风险点

- 主题色已收敛为橙色强调、支出绿、收入红(2026-10-12)。`App.tsx` 与 `AppNavigator` 都走 `theme`。
- `database-web.ts` 与 `database.ts` 内容重复,需收敛(`src/services/index.ts` 已做平台分支)。
- `models/index.ts` 中 `Transaction.subCategoryId` 关联查询时,需在 `appStore` 中补充聚合。
- `appStore` 缺乏分页/搜索/错误状态/重试机制。
- 缺少测试、CI、Lint 工具链。

---

## 2. 目标架构

### 2.1 分层

```
┌─────────────────────────────────────┐
│  Screens (UI 表现层)                │
│  - 纯函数式 React 组件              │
│  - 通过 Hooks 消费 Store            │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Stores (状态层 / Zustand)          │
│  - 全局状态 + 业务编排              │
│  - 暴露 actions,屏蔽异步细节        │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Services (数据访问层)              │
│  - 抽象 Repository 接口             │
│  - 平台实现: Web (AsyncStorage)     │
│             Native (expo-sqlite)    │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Models + Utils (基础层)            │
│  - 类型定义 / 纯函数                │
└─────────────────────────────────────┘
```

### 2.2 数据模型 (v2 规划)

在 [src/models/index.ts](src/models/index.ts) 基础上扩展:

```ts
// 账本 (多账本支持)
interface Account {
  id: string;
  name: string;          // "现金" / "支付宝" / "招行信用卡"
  type: 'cash' | 'bank' | 'credit' | 'alipay' | 'wechat' | 'other';
  balance: number;       // 期初余额
  icon: string;
  color: string;
  archived: boolean;
}

// 标签 (用于多标签)
interface Tag {
  id: string;
  name: string;
  color: string;
}

// 账目扩展字段
interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  date: string;          // ISO 8601
  accountId: string;     // 所属账户
  toAccountId?: string;  // 转账目标账户
  categoryId: string;
  subCategoryId?: string;
  tagIds: string[];
  note: string;
  attachments?: string[]; // 图片/票据 URL
  recurringRuleId?: string;
  createdAt: string;
  updatedAt: string;
}

// 周期性账目 (订阅/工资)
interface RecurringRule {
  id: string;
  template: Omit<Transaction, 'id' | 'date'>;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  endDate?: string;
  nextRunAt: string;
}

// 预算
interface Budget {
  id: string;
  scope: 'total' | 'category';
  categoryId?: string;
  amount: number;
  period: 'monthly' | 'yearly';
  startDate: string;
}

// 同步/远端
interface SyncConfig {
  enabled: boolean;
  endpoint?: string;
  token?: string;
  lastSyncedAt?: string;
}
```

### 2.3 关键架构决策

1. **数据访问抽象**: 定义 `Repository` 接口,Web 走 AsyncStorage,Native 走 SQLite,**两套实现**通过 `index.ts` 平台分支导出,业务层不感知。
2. **状态管理**: Zustand store 拆分为多个 slice(`useTransactionStore`、`useCategoryStore`、`useAccountStore`、`useBudgetStore`、`useSettingsStore`),避免单 store 膨胀。
3. **导航类型**: 所有 `ParamList` 集中在 `src/navigation/types.ts`,强类型 `navigate()`。
4. **主题**: 抽出 `ThemeProvider` 组件 + `useTheme()` Hook,支持未来暗色模式。
5. **错误处理**: Service 层统一抛出 `ServiceError`,Store 层捕获后写入 `error` 状态,UI 层通过 Toast/Modal 反馈。

---

## 3. 编码规范

### 3.1 文件 / 目录

- 一个文件一个 React 组件;组件名与文件名严格一致。
- `index.ts` 仅做导出聚合,不写业务逻辑。
- 业务相关常量集中到 `src/constants.ts`。
- 私有 Hook 放 `src/hooks/`,命名 `useXxx`。

### 3.2 TypeScript

- 启用 `strict: true`,禁止 `any`(必要时用 `unknown`)。
- 所有函数参数、返回值显式标注。
- 优先 `interface`,联合/工具类型用 `type`。
- 业务领域类型集中在 `src/models/`,不要散落。

### 3.3 React

- 函数组件 + Hooks,无 class 组件。
- 列表渲染必须加稳定 `key` (推荐 `id`)。
- 副作用放在 `useEffect`,并在依赖数组中列出全部外部引用。
- 大列表使用 `FlatList` / `FlashList` 而非 `.map`。
- 样式优先 `StyleSheet.create`,复杂场景允许 `useMemo`。

### 3.4 命名

| 类别 | 规范 | 示例 |
| --- | --- | --- |
| 组件 | PascalCase | `TransactionItem.tsx` |
| Hook | camelCase,`use` 前缀 | `useTransactions.ts` |
| 工具函数 | camelCase | `formatAmount` |
| 常量 | UPPER_SNAKE | `STORAGE_KEYS` |
| 类型/接口 | PascalCase | `FilterParams` |
| 布尔字段 | `is` / `has` / `should` 前缀 | `isLoading` |

### 3.5 提交规范 (Conventional Commits)

```
feat: 添加预算功能
fix: 修复转账账户未保存的 bug
refactor: 拆分 appStore 为多个 slice
docs: 更新开发框架文档
chore: 升级依赖 expo 到 55.x
test: 补充 TransactionService 单元测试
```

---

## 4. 工作流程

### 4.1 任务执行

遵循 **CLAUDE.md** 中"先思考 → 最小实现 → 外科手术式修改 → 目标驱动"的原则:

1. **明确假设**: 接到任务后,先在内部陈述方案与不确定性。
2. **设计先行**: 涉及多文件改动或新功能时,先产出 1-2 段方案,再进入实现。
3. **最小可用**: 只写当前任务必需的代码,**不预先抽象**。
4. **可验证**: 每个子任务给出验证手段(测试 / 手测 / 截图)。

### 4.2 进度同步 (强制)

按 **CLAUDE.md** 末尾约定,每次开发过程需将**当前进度 / 待办 / 遇到的问题**记录到 `README.md`。建议在 `README.md` 末尾维护一个"开发日志"小节,格式:

```markdown
## 开发日志

### 2026-06-14
- ✅ 初始化项目,完成 Expo + 双端存储骨架
- 🚧 主题色统一:App.tsx 与 Navigator 颜色不一致
- ⏳ 待办: 拆分 appStore,引入 Account 概念
```

### 4.3 提交流程

```bash
# 1. 拉最新
git pull --rebase origin main

# 2. 切分支 (按功能/修复类型)
git checkout -b feat/budget

# 3. 开发 + 自测
npm start         # 启动 Metro
npm run web       # 浏览器验证

# 4. 类型检查
npx tsc --noEmit

# 5. 提交 (使用 Conventional Commits)
git add -A
git commit -m "feat: 预算基础模型与 Store"

# 6. 推送 + PR
git push origin feat/budget
```

---

## 5. 路线图

### v0.1 现状(已完成)
- 基础记账、分类、流水、概览、图表
- 底部导航 + 中央 FAB

### v0.2 基础巩固(优先级最高)
- [x] 统一主题(消除 App.tsx 与 Navigator 颜色冲突)
- [ ] 抽象 `Repository` 接口,合并 `database.ts` / `database-web.ts` 公共逻辑
- [ ] 拆分 `appStore` 为 slice,引入 selectors
- [ ] 补充 `useTheme` / `useToast` 等通用 Hook
- [ ] 添加 ESLint + Prettier 配置

### v0.3 数据模型升级
- [ ] 引入 `Account` 概念,支持多账户
- [ ] 流水增加 `accountId` / `tagIds` / `attachments`
- [ ] 转账(同币种账户间)
- [ ] 流水搜索(关键字 + 金额区间 + 标签)
- [ ] 流水分页/虚拟列表

### v0.4 自动化
- [ ] 周期性账目(订阅、工资)
- [ ] 预算(Budget) + 超支提醒
- [ ] 每日提醒(本地通知)

### v0.5 统计与分析
- [ ] 多维度图表(分类饼图、月度趋势、年度对比)
- [ ] 数据导出(CSV / Excel)
- [ ] 数据导入(从 CSV / 他账 APP)

### v0.6 云同步(可选)
- [ ] 远端 API 抽象 + 自托管服务端
- [ ] 端到端加密
- [ ] 冲突解决(基于 `updatedAt`)

### v1.0 体验打磨
- [ ] 暗色模式
- [ ] 国际化(i18n)
- [ ] 桌面端 (Electron / Tauri)
- [ ] 小程序 / Watch 适配

---

## 6. 测试与质量

### 6.1 测试策略

| 层级 | 工具 | 覆盖目标 |
| --- | --- | --- |
| 单元 | Jest + ts-jest | `utils/`、`models/` 纯函数 |
| Store | Jest + zustand 测试工具 | actions、selectors |
| Service | Jest + 内存 mock Repository | 业务规则 |
| 组件 | React Native Testing Library | 关键交互组件 |
| E2E | Detox / Maestro | 核心流程(记账、查询) |

### 6.2 CI 建议 (GitHub Actions)

- PR 触发: `tsc --noEmit` + `eslint` + `jest` + `prettier --check`
- main 触发: 上述 + 构建三端 `expo prebuild`

---

## 7. 常见问题

**Q: 新增一个页面应该改哪些文件?**
1. 在 `src/screens/` 创建 `XxxScreen.tsx`
2. 在 `src/screens/index.ts` 导出
3. 在 `src/navigation/AppNavigator.tsx` 注册路由(并扩展 `ParamList`)
4. 若需 store,创建 `useXxxStore.ts`

**Q: 新增一个数据字段应该改哪些文件?**
1. `src/models/index.ts` 扩展类型
2. `src/services/database.ts` 与 `database-web.ts` 处理持久化
3. `src/stores/appStore.ts`(或对应 slice)更新 actions
4. 涉及的 Screen 组件更新 UI

**Q: 主题色改了,为什么有些地方没生效?**
检查 `AppNavigator.tsx` 内部硬编码的 `colors` 对象(目前是单独定义的,未走 `theme`),统一迁移到 `useTheme()` 即可。

---

## 8. 附录

### 8.1 关键文件索引

- [App.tsx](App.tsx) — 根组件、初始化
- [src/navigation/AppNavigator.tsx](src/navigation/AppNavigator.tsx) — 导航配置
- [src/stores/appStore.ts](src/stores/appStore.ts) — 全局状态
- [src/services/database.ts](src/services/database.ts) — Native 存储
- [src/services/database-web.ts](src/services/database-web.ts) — Web 存储
- [src/models/index.ts](src/models/index.ts) — 数据模型

### 8.2 关键依赖说明

- **expo-sqlite**: 仅在原生平台打包,Web 构建时由 `index.ts` 分支跳过
- **zustand**: 轻量,无 Provider 概念,Store 是单例 Hook
- **react-navigation 7**: Native Stack 在 iOS 上使用 `UINavigationController`,性能最佳
- **react-native-chart-kit**: 基于 `react-native-svg`,Web 端有兼容问题,后续可换 `victory-native` 或 `react-native-gifted-charts`
