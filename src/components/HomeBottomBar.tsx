// 主界面底栏: 图表 | 流水 | 记一笔(上浮橙色胶囊) | 设置
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg';
import { theme } from '../theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ICON = '#C5C5C5';

const ChartIcon: React.FC = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Path d="M4 20V11" stroke={ICON} strokeWidth={1.8} strokeLinecap="round" />
    <Path d="M10 20V6" stroke={ICON} strokeWidth={1.8} strokeLinecap="round" />
    <Path d="M16 20v-6" stroke={ICON} strokeWidth={1.8} strokeLinecap="round" />
    <Path d="M3 20h18" stroke={ICON} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

const LedgerIcon: React.FC = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Path
      d="M7 3.5h8.2L19.5 8v12.2a1.3 1.3 0 0 1-1.3 1.3H7A1.3 1.3 0 0 1 5.7 20.2V4.8A1.3 1.3 0 0 1 7 3.5z"
      stroke={ICON}
      strokeWidth={1.6}
      fill="none"
    />
    <Path d="M15 3.8V8h4.2" stroke={ICON} strokeWidth={1.6} fill="none" />
    <Path d="M8.4 12.2h7.2M8.4 15.4h7.2M8.4 18.2h4.4" stroke={ICON} strokeWidth={1.6} strokeLinecap="round" />
  </Svg>
);

const SettingsIcon: React.FC = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Path
      d="M12 3.2 19.2 7.3v7.4L12 20.8 4.8 14.7V7.3L12 3.2z"
      stroke={ICON}
      strokeWidth={1.6}
      fill="none"
      strokeLinejoin="round"
    />
    <Path
      d="M12 9.1a2.9 2.9 0 1 1 0 5.8 2.9 2.9 0 0 1 0-5.8z"
      stroke={ICON}
      strokeWidth={1.6}
      fill="none"
    />
  </Svg>
);

const AddCapsule: React.FC = () => (
  <Svg width={132} height={46}>
    <Defs>
      <LinearGradient id="add-capsule" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#FFC85A" />
        <Stop offset="0.48" stopColor="#FF9A2E" />
        <Stop offset="1" stopColor="#FF7A18" />
      </LinearGradient>
    </Defs>
    <Rect width={132} height={46} rx={23} fill="url(#add-capsule)" />
  </Svg>
);

export const HomeBottomBar: React.FC = () => {
  const navigation = useNavigation<Nav>();

  return (
    <View style={styles.bar}>
      <Pressable
        style={styles.sideItem}
        onPress={() => navigation.navigate('Charts')}
        accessibilityRole="button"
        accessibilityLabel="图表"
      >
        <ChartIcon />
        <Text style={styles.sideLabel}>图表</Text>
      </Pressable>

      <Pressable
        style={styles.sideItem}
        onPress={() => navigation.navigate('Transactions')}
        accessibilityRole="button"
        accessibilityLabel="流水"
      >
        <LedgerIcon />
        <Text style={styles.sideLabel}>流水</Text>
      </Pressable>

      <View style={styles.addSlot}>
        <Pressable
          style={styles.addWrap}
          onPress={() => navigation.navigate('AddTransaction')}
          accessibilityRole="button"
          accessibilityLabel="记一笔"
        >
          <AddCapsule />
          <Text style={styles.addText}>记一笔</Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.sideItem}
        onPress={() => navigation.navigate('Settings')}
        accessibilityRole="button"
        accessibilityLabel="设置"
      >
        <SettingsIcon />
        <Text style={styles.sideLabel}>设置</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    height: theme.layout.tabBarHeight,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: theme.colors.page,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EFEFEF',
    paddingBottom: 6,
    overflow: 'visible',
  },
  sideItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    height: 46,
  },
  sideLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '400',
    color: '#B5B5B5',
  },
  addSlot: {
    flex: 1.15,
    alignItems: 'center',
  },
  addWrap: {
    width: 132,
    height: 46,
    marginTop: -22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF8A2A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  addText: {
    position: 'absolute',
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
