// 流水 / 图表 / 首页顶部风景横幅。本地 SVG,不依赖网络图片;高度走 theme.layout.bannerHeight。
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Path, Circle, Ellipse } from 'react-native-svg';
import { theme } from '../theme';

interface ScenicBannerProps {
  variant?: 'hill' | 'lake';
  height?: number;
  children?: React.ReactNode;
  style?: ViewStyle;
}

const HillArt: React.FC = () => (
  <>
    <Defs>
      <LinearGradient id="hill-sky" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#E7B56A" />
        <Stop offset="0.22" stopColor="#F4D7AE" />
        <Stop offset="0.48" stopColor="#E7EEEA" />
        <Stop offset="0.72" stopColor="#B7CDD2" />
        <Stop offset="1" stopColor="#8FB0B4" />
      </LinearGradient>
      <LinearGradient id="hill-scrim" x1="0" y1="0" x2="1" y2="0.2">
        <Stop offset="0" stopColor="#1A241C" stopOpacity="0.42" />
        <Stop offset="0.46" stopColor="#1A241C" stopOpacity="0.12" />
        <Stop offset="1" stopColor="#1A241C" stopOpacity="0" />
      </LinearGradient>
      <LinearGradient id="hill-bottom" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0.55" stopColor="#102018" stopOpacity="0" />
        <Stop offset="1" stopColor="#102018" stopOpacity="0.28" />
      </LinearGradient>
    </Defs>
    <Rect width="400" height="220" fill="url(#hill-sky)" />
    <Circle cx="292" cy="38" r="70" fill="#FFF3D4" opacity="0.45" />
    <Circle cx="292" cy="38" r="120" fill="#F3D7A4" opacity="0.18" />
    <Path
      d="M0 78 C60 70 90 58 140 66 C190 74 210 52 260 48 C310 44 350 62 400 54 L400 130 L0 130 Z"
      fill="#F7F4EE"
      opacity="0.72"
    />
    <Path
      d="M0 98 C50 84 100 104 160 90 C220 76 250 108 320 94 C360 86 380 98 400 92 L400 160 L0 160 Z"
      fill="#E4E8E2"
      opacity="0.85"
    />
    <Path
      d="M0 118 C70 104 120 128 190 114 C250 100 290 132 360 116 L400 124 L400 190 L0 190 Z"
      fill="#C5D0C6"
    />
    <Path
      d="M0 142 C80 128 140 156 210 140 C280 124 320 158 400 142 L400 210 L0 210 Z"
      fill="#8FA68C"
    />
    <Path
      d="M0 168 C90 154 160 180 250 164 C320 150 360 176 400 166 L400 220 L0 220 Z"
      fill="#5E7A58"
    />
    <Path
      d="M0 192 C120 182 200 202 300 188 C350 180 380 194 400 190 L400 220 L0 220 Z"
      fill="#3C5640"
    />
    <Ellipse cx="120" cy="132" rx="86" ry="14" fill="#F8F8F6" opacity="0.42" />
    <Ellipse cx="230" cy="156" rx="110" ry="16" fill="#F4F6F3" opacity="0.32" />
    <Ellipse cx="300" cy="112" rx="70" ry="10" fill="#FFFFFF" opacity="0.28" />
    <Rect width="400" height="220" fill="url(#hill-scrim)" />
    <Rect width="400" height="220" fill="url(#hill-bottom)" />
  </>
);

const LakeArt: React.FC = () => (
  <>
    <Defs>
      <LinearGradient id="lake-sky" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#9EBFDA" />
        <Stop offset="0.45" stopColor="#D5E6EF" />
        <Stop offset="1" stopColor="#B7D0DC" />
      </LinearGradient>
      <LinearGradient id="lake-water" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#7EB4D0" />
        <Stop offset="0.45" stopColor="#4E92B8" />
        <Stop offset="1" stopColor="#2F6E96" />
      </LinearGradient>
      <LinearGradient id="lake-scrim" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#102830" stopOpacity="0.5" />
        <Stop offset="0.55" stopColor="#102830" stopOpacity="0.1" />
        <Stop offset="1" stopColor="#102830" stopOpacity="0" />
      </LinearGradient>
    </Defs>
    <Rect width="400" height="220" fill="url(#lake-sky)" />
    <Path d="M0 70 L48 42 L92 68 L140 34 L196 72 L250 48 L310 76 L360 52 L400 70 L400 120 L0 120 Z" fill="#D5E2E8" />
    <Path d="M0 92 L70 64 L130 98 L190 70 L250 104 L320 78 L400 100 L400 150 L0 150 Z" fill="#7B93A2" />
    <Path d="M0 118 L90 96 L160 124 L230 100 L300 128 L400 108 L400 160 L0 160 Z" fill="#51697A" />
    <Path d="M230 108 L248 96 L262 108 L278 92 L296 110 L318 98 L340 114 L400 104 L400 156 L220 156 Z" fill="#C4B49A" />
    <Rect x="246" y="100" width="8" height="16" fill="#F4EFE6" />
    <Rect x="258" y="94" width="10" height="24" fill="#EFE6D8" />
    <Rect x="272" y="88" width="7" height="28" fill="#C65A45" />
    <Rect x="282" y="96" width="12" height="22" fill="#F7F3EC" />
    <Rect x="296" y="90" width="8" height="26" fill="#A84838" />
    <Rect x="308" y="98" width="14" height="20" fill="#E7D3BE" />
    <Rect x="326" y="92" width="9" height="26" fill="#F3EFE8" />
    <Rect x="338" y="86" width="11" height="32" fill="#D8C4AE" />
    <Rect x="352" y="96" width="16" height="24" fill="#C46B52" />
    <Rect x="372" y="90" width="12" height="30" fill="#F6F1E8" />
    <Path d="M210 132 L400 124 L400 168 L200 168 Z" fill="#3E5C4A" opacity="0.35" />
    <Path d="M0 128 L400 118 L400 220 L0 220 Z" fill="url(#lake-water)" />
    <Path d="M20 150 Q110 144 190 156" stroke="#E7F6FB" strokeWidth="1.4" fill="none" opacity="0.7" />
    <Path d="M40 172 Q160 164 260 176" stroke="#E7F6FB" strokeWidth="1.2" fill="none" opacity="0.4" />
    <Path d="M280 146 Q330 140 390 150" stroke="#E7F6FB" strokeWidth="1.1" fill="none" opacity="0.45" />
    <Rect width="400" height="220" fill="url(#lake-scrim)" />
  </>
);

export const ScenicBanner: React.FC<ScenicBannerProps> = ({
  variant = 'hill',
  height = theme.layout.bannerHeight,
  children,
  style,
}) => (
  <View style={[styles.wrap, { height }, style]}>
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 400 220"
      preserveAspectRatio="xMidYMid slice"
      style={StyleSheet.absoluteFill}
    >
      {variant === 'lake' ? <LakeArt /> : <HillArt />}
    </Svg>
    <View style={styles.content}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: theme.colors.headerBg,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.layout.pagePadding,
    paddingTop: 14,
    paddingBottom: 14,
    justifyContent: 'center',
  },
});
