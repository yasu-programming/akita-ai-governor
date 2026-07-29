import type { AxisKey, Weights } from './types';

export const AXES: {
  key: AxisKey;
  label: string;
  subtitle: string;
  tooltip?: string;
}[] = [
  { key: 'population', label: '人口増加', subtitle: '社会増減・出生数を伸ばす' },
  { key: 'economy', label: '経済成長', subtitle: '県内総生産・所得を伸ばす' },
  { key: 'fiscal', label: '財政健全化', subtitle: '将来世代の負担を減らす' },
  { key: 'quality', label: '生活の質', subtitle: '医療・教育・安全を守る' },
  {
    key: 'durability',
    label: '政治的持続性',
    subtitle: '再選可能性をどれだけ重視するか',
    tooltip:
      '公共選択論では、政治家を「再選を目的関数に含む合理的主体」としてモデル化します。' +
      'これは特定の人物の評価ではなく、制度設計を考えるための分析枠です。',
  },
];

export const PRESETS: {
  id: string;
  label: string;
  description: string;
  weights: Weights;
}[] = [
  {
    id: 'population-first',
    label: '人口最優先型',
    description: '人口減少の緩和を最上位に置く',
    weights: { population: 95, economy: 55, fiscal: 25, quality: 60, durability: 30 },
  },
  {
    id: 'growth-first',
    label: '経済成長優先型',
    description: '産業の付加価値を伸ばすことを最上位に置く',
    weights: { population: 45, economy: 95, fiscal: 35, quality: 40, durability: 35 },
  },
  {
    id: 'fiscal-discipline',
    label: '財政規律型',
    description: '将来世代への負担移転を避けることを最上位に置く',
    weights: { population: 35, economy: 45, fiscal: 95, quality: 45, durability: 15 },
  },
  {
    id: 'quality-first',
    label: '生活の質優先型',
    description: '医療・教育・安全の水準維持を最上位に置く',
    weights: { population: 45, economy: 35, fiscal: 40, quality: 95, durability: 40 },
  },
  {
    id: 'durability-first',
    label: '政治的持続性重視型',
    description: '短期に成果が見える施策を選びやすくなる',
    weights: { population: 45, economy: 45, fiscal: 20, quality: 50, durability: 95 },
  },
  {
    id: 'balanced',
    label: 'バランス型',
    description: '全ての軸を等しく扱う',
    weights: { population: 60, economy: 60, fiscal: 60, quality: 60, durability: 60 },
  },
];

export const DEFAULT_WEIGHTS: Weights = {
  population: 60,
  economy: 60,
  fiscal: 60,
  quality: 60,
  durability: 60,
};

/**
 * 単年度で組み替え可能な裁量枠を歳出規模の何割とみなすか。
 * 地方財政では義務的経費の比率が高く、単年度で動かせる範囲は限られる。
 * この値は本モデルの仮定値であり、画面上でもそう明示する。
 */
export const DISCRETIONARY_RATIO = 0.05;

export const AKITA_CODE = '05';
