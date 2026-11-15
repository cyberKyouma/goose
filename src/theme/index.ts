// 主题与设计 Token — 全应用共用同一套文字、间距、横幅规格
import { Platform, TextStyle } from 'react-native';

/**
 * 字体族总闸。页面禁止散写 fontFamily；后续接字体库只改这里。
 * 现在用系统 UI 字体；换成 Noto 等时把 regular 改成加载后的字体名即可。
 */
export const fonts = {
  regular: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    web: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif',
    default: undefined,
  }),
} as const;

const type = (
  style: Omit<TextStyle, 'fontFamily'> & { fontWeight: NonNullable<TextStyle['fontWeight']> }
): TextStyle => ({
  fontFamily: fonts.regular,
  ...style,
});

export const theme = {
  colors: {
    primary: '#FF8A34',
    secondary: '#FF8A34',
    accent: '#FF8A34',
    success: '#2EBE6E',
    danger: '#F04452',
    warning: '#F5A524',
    info: '#5B8DEF',
    light: '#F6F7F8',
    dark: '#222222',
    white: '#FFFFFF',
    gray: '#9AA0A6',
    border: '#EEEEEE',

    income: '#F04452',
    expense: '#2EBE6E',
    headerBg: '#6E8B78',

    // 文字层级 (避免各页散落 #222 / #999 / #AAA)
    text: '#222222',
    textSecondary: '#8A8A8A',
    textMuted: '#B0B0B0',
    textPlaceholder: '#C8C8C8',
    textOnDark: '#FFFFFF',
    textOnDarkMuted: 'rgba(255,255,255,0.88)',
    textOnDarkSoft: 'rgba(255,255,255,0.72)',

    // 表面
    page: '#FFFFFF',
    pageAlt: '#F6F7F8',
    surfaceMuted: '#F4F4F4',
    divider: '#F2F2F2',

    categoryColors: [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
      '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF',
    ],
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },

  borderRadius: {
    sm: 4,
    md: 8,
    lg: 16,
    full: 9999,
  },

  // 字体族入口 (与顶部 fonts 同一引用,方便 theme.fonts.regular)
  fonts,

  // 原始字号阶梯 (兼容旧引用)
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 24,
    xxl: 32,
  },

  // 语义排版: 含 fontFamily。页面应 ...theme.typography.xxx,勿散写 fontFamily
  typography: {
    micro: type({ fontSize: 11, lineHeight: 14, fontWeight: '400' }),
    caption: type({ fontSize: 12, lineHeight: 16, fontWeight: '400' }),
    label: type({ fontSize: 13, lineHeight: 18, fontWeight: '500' }),
    body: type({ fontSize: 15, lineHeight: 22, fontWeight: '400' }),
    bodyStrong: type({ fontSize: 15, lineHeight: 22, fontWeight: '600' }),
    listTitle: type({ fontSize: 16, lineHeight: 22, fontWeight: '400' }),
    listAmount: type({ fontSize: 16, lineHeight: 22, fontWeight: '500' }),
    title: type({ fontSize: 17, lineHeight: 24, fontWeight: '600' }),
    headline: type({ fontSize: 22, lineHeight: 28, fontWeight: '700' }),
    section: type({ fontSize: 26, lineHeight: 32, fontWeight: '700' }),
    hero: type({ fontSize: 36, lineHeight: 44, fontWeight: '600' }),
    display: type({ fontSize: 48, lineHeight: 56, fontWeight: '500' }),
  },

  // 布局规格: 横幅、顶栏、列表图标统一尺寸
  layout: {
    bannerHeight: 156,
    topBarHeight: 44,
    pagePadding: 16,
    listIconSize: 34,
    listDividerInset: 62,
    tabBarHeight: 72,
  },

  shadow: {
    textOnBanner: {
      textShadowColor: 'rgba(0,0,0,0.28)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    } satisfies TextStyle,
  },
};

/** 风景横幅内通用文字样式 */
export const bannerText = {
  label: {
    color: theme.colors.textOnDarkMuted,
    ...theme.typography.label,
    fontWeight: '400' as const,
    ...theme.shadow.textOnBanner,
  } satisfies TextStyle,
  amount: {
    color: theme.colors.textOnDark,
    ...theme.typography.hero,
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  } satisfies TextStyle,
  sub: {
    color: theme.colors.textOnDarkMuted,
    ...theme.typography.label,
    fontWeight: '400' as const,
    ...theme.shadow.textOnBanner,
  } satisfies TextStyle,
  subStrong: {
    fontFamily: fonts.regular,
    color: theme.colors.textOnDark,
    fontWeight: '700' as const,
  } satisfies TextStyle,
  meta: {
    color: theme.colors.textOnDarkMuted,
    ...theme.typography.micro,
    ...theme.shadow.textOnBanner,
  } satisfies TextStyle,
};

/** 空状态通用样式 */
export const emptyText = {
  title: {
    ...theme.typography.listTitle,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs + 2,
  } satisfies TextStyle,
  sub: {
    ...theme.typography.label,
    fontWeight: '400' as const,
    color: theme.colors.textSecondary,
  } satisfies TextStyle,
};

export type Theme = typeof theme;
