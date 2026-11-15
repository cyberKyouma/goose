// 实心色块 + 白色图形,对齐参考记账列表里的分类图标
import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type Kind =
  | 'food'
  | 'car'
  | 'bus'
  | 'metro'
  | 'fuel'
  | 'parking'
  | 'train'
  | 'drop'
  | 'home'
  | 'shop'
  | 'film'
  | 'game'
  | 'pill'
  | 'book'
  | 'gift'
  | 'trend'
  | 'wallet'
  | 'bag'
  | 'coffee'
  | 'fruit'
  | 'box'
  | 'shirt';

const KIND_BY_NAME: Record<string, Kind> = {
  早餐: 'food',
  午餐: 'food',
  中餐: 'food',
  晚餐: 'food',
  夜宵: 'food',
  饮料: 'coffee',
  水果: 'fruit',
  餐饮: 'food',
  打车: 'car',
  公交: 'bus',
  地铁: 'metro',
  油费: 'fuel',
  停车: 'parking',
  高铁: 'train',
  交通: 'car',
  购物: 'shop',
  日用: 'shop',
  服饰: 'shirt',
  美妆: 'shop',
  数码: 'box',
  杂物: 'box',
  居住: 'home',
  房租: 'home',
  水电: 'drop',
  水电煤: 'drop',
  物业: 'home',
  维修: 'home',
  娱乐: 'film',
  电影: 'film',
  游戏: 'game',
  运动: 'trend',
  旅行: 'train',
  聚会: 'food',
  医疗: 'pill',
  药品: 'pill',
  门诊: 'pill',
  体检: 'pill',
  保健: 'pill',
  教育: 'book',
  书籍: 'book',
  课程: 'book',
  培训: 'book',
  考试: 'book',
  其他支出: 'box',
  红包: 'gift',
  礼品: 'gift',
  工资: 'bag',
  月薪: 'bag',
  加班: 'bag',
  补贴: 'bag',
  奖金: 'gift',
  绩效: 'gift',
  项目: 'bag',
  抽奖: 'gift',
  投资: 'trend',
  股票: 'trend',
  基金: 'trend',
  利息: 'trend',
  理财: 'trend',
  其他收入: 'wallet',
  兼职: 'wallet',
  退款: 'wallet',
};

interface CategoryGlyphProps {
  name: string;
  color: string;
  size?: number;
}

const GlyphShape: React.FC<{ kind: Kind; color: string; size: number }> = ({ kind, color, size }) => {
  const box = { width: size, height: size, viewBox: '0 0 24 24' };
  switch (kind) {
    case 'food':
      return (
        <Svg {...box}>
          <Path fill="#fff" d="M4.2 9.2h15.6v1.1c0 4.4-3.4 7.2-7.8 7.2s-7.8-2.8-7.8-7.2V9.2z" />
          <Path fill={color} d="M7.1 11.3h9.8v.3c0 2.4-2.1 4-4.9 4s-4.9-1.6-4.9-4v-.3z" />
          <Path fill="#fff" d="M8.2 18.7h7.6v1.4H8.2z" />
        </Svg>
      );
    case 'car':
      return (
        <Svg {...box}>
          <Path fill="#fff" d="M6.4 14.6 8.1 9.4h7.8l1.7 5.2H6.4z" />
          <Rect x="3.6" y="14.2" width="16.8" height="3.3" rx="1.1" fill="#fff" />
          <Circle cx="7.6" cy="18.3" r="1.55" fill="#fff" />
          <Circle cx="16.4" cy="18.3" r="1.55" fill="#fff" />
          <Circle cx="7.6" cy="18.3" r="0.7" fill={color} />
          <Circle cx="16.4" cy="18.3" r="0.7" fill={color} />
        </Svg>
      );
    case 'bus':
      return (
        <Svg {...box}>
          <Rect x="5" y="3.8" width="14" height="13.2" rx="2" fill="#fff" />
          <Rect x="7" y="6" width="4.2" height="3.3" rx="0.4" fill={color} />
          <Rect x="12.8" y="6" width="4.2" height="3.3" rx="0.4" fill={color} />
          <Circle cx="8.3" cy="18.7" r="1.45" fill="#fff" />
          <Circle cx="15.7" cy="18.7" r="1.45" fill="#fff" />
        </Svg>
      );
    case 'metro':
    case 'train':
      return (
        <Svg {...box}>
          <Path fill="#fff" d="M7 3.6h10a2 2 0 0 1 2 2V14a3.4 3.4 0 0 1-3.4 3.4H8.4A3.4 3.4 0 0 1 5 14V5.6a2 2 0 0 1 2-2z" />
          <Rect x="7.4" y="6.2" width="3.7" height="3.1" fill={color} />
          <Rect x="12.9" y="6.2" width="3.7" height="3.1" fill={color} />
          <Circle cx="9" cy="14.6" r="1" fill={color} />
          <Circle cx="15" cy="14.6" r="1" fill={color} />
        </Svg>
      );
    case 'fuel':
      return (
        <Svg {...box}>
          <Rect x="5.5" y="3.5" width="9" height="14" rx="1.2" fill="#fff" />
          <Rect x="7.2" y="5.6" width="5.6" height="4" rx="0.4" fill={color} />
          <Path d="M14.5 7.2H17v5.2" stroke="#fff" strokeWidth="1.7" fill="none" strokeLinecap="round" />
          <Rect x="6.4" y="18.2" width="7.2" height="2" rx="0.4" fill="#fff" />
        </Svg>
      );
    case 'parking':
      return (
        <Svg {...box}>
          <Rect x="4.5" y="3.2" width="15" height="17.6" rx="2" fill="#fff" />
          <Path d="M9.2 16.4V7.4h3.3a2.7 2.7 0 0 1 0 5.4H9.2" stroke={color} strokeWidth="1.7" fill="none" />
        </Svg>
      );
    case 'drop':
      return (
        <Svg {...box}>
          <Path
            fill="#fff"
            d="M12 2.8c.5 0 1 .4 1.4 1C16.2 8 18.4 10.8 18.4 13.6a6.4 6.4 0 1 1-12.8 0c0-2.8 2.2-5.6 5-9.8.4-.6.9-1 1.4-1z"
          />
        </Svg>
      );
    case 'home':
      return (
        <Svg {...box}>
          <Path fill="#fff" d="M12 3.4 3.2 11h2.3V20.2h5v-5.4h3v5.4h5V11h2.3L12 3.4z" />
        </Svg>
      );
    case 'shop':
      return (
        <Svg {...box}>
          <Path fill="#fff" d="M6.6 8.2h10.8l1 11.4H5.6L6.6 8.2z" />
          <Path d="M9 8.4V7a3 3 0 0 1 6 0v1.4" stroke={color} strokeWidth="1.6" fill="none" />
        </Svg>
      );
    case 'shirt':
      return (
        <Svg {...box}>
          <Path fill="#fff" d="M8 6.2 12 8.4 16 6.2 19.4 9l-2.6 2.2V19.5H7.2V11.2L4.6 9 8 6.2z" />
        </Svg>
      );
    case 'film':
      return (
        <Svg {...box}>
          <Rect x="3.2" y="5.5" width="17.6" height="13" rx="1.3" fill="#fff" />
          <Rect x="7.6" y="5.5" width="8.8" height="13" fill={color} />
        </Svg>
      );
    case 'game':
      return (
        <Svg {...box}>
          <Rect x="2.8" y="7.6" width="18.4" height="9.2" rx="4.4" fill="#fff" />
          <Circle cx="8" cy="12.2" r="1.05" fill={color} />
          <Circle cx="15.2" cy="10.8" r="0.85" fill={color} />
          <Circle cx="17.2" cy="13.2" r="0.85" fill={color} />
        </Svg>
      );
    case 'pill':
      return (
        <Svg {...box}>
          <Rect x="8" y="2.6" width="8" height="18.8" rx="4" fill="#fff" rotation={-40} origin="12,12" />
        </Svg>
      );
    case 'book':
      return (
        <Svg {...box}>
          <Path fill="#fff" d="M12 5.4C10.6 4.5 8.8 4 6.4 4H4.6v14.2h2c2.2 0 3.6.5 5.4 1.6V5.4z" />
          <Path fill="#fff" d="M12 5.4c1.4-.9 3.2-1.4 5.6-1.4h1.8v14.2h-2c-2.2 0-3.6.5-5.4 1.6V5.4z" />
        </Svg>
      );
    case 'gift':
      return (
        <Svg {...box}>
          <Rect x="3.6" y="10" width="16.8" height="9.2" rx="1" fill="#fff" />
          <Rect x="3.2" y="6.8" width="17.6" height="3.4" rx="0.8" fill="#fff" />
          <Rect x="10.8" y="6.8" width="2.4" height="12.4" fill={color} />
        </Svg>
      );
    case 'trend':
      return (
        <Svg {...box}>
          <Path
            d="M3.8 16.8 9 11.2l3.2 3.1L20 7.2"
            stroke="#fff"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path fill="#fff" d="M14.2 6.2H20.2V12.2L14.2 6.2z" />
        </Svg>
      );
    case 'bag':
      return (
        <Svg {...box}>
          <Rect x="3.8" y="8" width="16.4" height="11.2" rx="1.6" fill="#fff" />
          <Path d="M9 8V6.3A1.5 1.5 0 0 1 10.5 4.8h3A1.5 1.5 0 0 1 15 6.3V8" stroke={color} strokeWidth="1.6" fill="none" />
          <Path d="M3.8 12.4h16.4" stroke={color} strokeWidth="1.4" />
        </Svg>
      );
    case 'wallet':
      return (
        <Svg {...box}>
          <Rect x="3.2" y="5.6" width="17.6" height="12.6" rx="1.6" fill="#fff" />
          <Rect x="3.2" y="9" width="17.6" height="2.5" fill={color} />
          <Circle cx="16.4" cy="14.4" r="1.05" fill={color} />
        </Svg>
      );
    case 'coffee':
      return (
        <Svg {...box}>
          <Path fill="#fff" d="M5.6 7.4H15v6.2a4.4 4.4 0 0 1-8.8 0V7.4h-.6z" />
          <Path d="M15 9h2a2.4 2.4 0 0 1 0 4.8H15" stroke="#fff" strokeWidth="1.6" fill="none" />
        </Svg>
      );
    case 'fruit':
      return (
        <Svg {...box}>
          <Circle cx="12" cy="13.2" r="6.1" fill="#fff" />
          <Path d="M12 7.2c1.2-2 3.4-2.5 4.4-2.2" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </Svg>
      );
    case 'box':
    default:
      return (
        <Svg {...box}>
          <Path fill="#fff" d="M12 3.2 20.2 7.4 12 11.6 3.8 7.4 12 3.2z" />
          <Path fill="#fff" opacity={0.82} d="M3.8 7.4V16.4L12 20.6V11.6L3.8 7.4z" />
          <Path fill="#fff" d="M20.2 7.4V16.4L12 20.6V11.6l8.2-4.2z" />
        </Svg>
      );
  }
};

export const CategoryGlyph: React.FC<CategoryGlyphProps> = ({ name, color, size = 34 }) => {
  const kind = KIND_BY_NAME[name];
  const iconSize = Math.round(size * 0.62);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {kind ? (
        <GlyphShape kind={kind} color={color} size={iconSize} />
      ) : (
        <Text style={{ color: '#fff', fontSize: Math.round(size * 0.4), fontWeight: '700' }}>
          {name.slice(0, 1) || '·'}
        </Text>
      )}
    </View>
  );
};
