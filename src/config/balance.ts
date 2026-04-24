export type TowerType = "basic" | "rapid" | "sniper" | "splash" | "cannon";
export type EnemyType = "normal" | "fast" | "tank";

export type TowerDefinition = {
  type: TowerType;
  label: string;
  color: string;
  cost: number;
  baseDamage: number;
  baseFireRate: number;
  baseRange: number;
  upgradeCosts: number[];
  damageScale: number;
  fireRateScale: number;
  rangeScale: number;
  splashRadius?: number;
  splashFactor?: number;
};

export type EnemyDefinition = {
  type: EnemyType;
  label: string;
  color: string;
  radius: number;
  baseHp: number;
  baseSpeed: number;
  baseReward: number;
  baseLeakDamage: number;
};

export type WaveEntry = {
  type: EnemyType;
  count: number;
  interval: number;
};

export const GRID_COLS = 32;
export const GRID_ROWS = 18;
export const TILE_SIZE = 32;
export const CANVAS_WIDTH = GRID_COLS * TILE_SIZE;
export const CANVAS_HEIGHT = GRID_ROWS * TILE_SIZE;
export const MAX_TOWER_LEVEL = 5;
export const SELL_REFUND_RATIO = 0.7;
export const STARTING_GOLD = 180;
export const STARTING_LIVES = 20;
export const ENEMY_HP_GROWTH = 0.08;
export const ENEMY_SPEED_GROWTH = 0.012;
export const ENEMY_REWARD_GROWTH = 0.05;

export const towerDefinitions: Record<TowerType, TowerDefinition> = {
  basic: {
    type: "basic",
    label: "均衡塔",
    color: "#275d8c",
    cost: 60,
    baseDamage: 18,
    baseFireRate: 1.0,
    baseRange: 2.8,
    upgradeCosts: [42, 60, 84, 114],
    damageScale: 0.22,
    fireRateScale: 0.08,
    rangeScale: 0.06
  },
  rapid: {
    type: "rapid",
    label: "速射塔",
    color: "#1d7a55",
    cost: 75,
    baseDamage: 9,
    baseFireRate: 2.4,
    baseRange: 2.4,
    upgradeCosts: [53, 75, 105, 143],
    damageScale: 0.18,
    fireRateScale: 0.1,
    rangeScale: 0.06
  },
  sniper: {
    type: "sniper",
    label: "狙击塔",
    color: "#6d4c9f",
    cost: 110,
    baseDamage: 55,
    baseFireRate: 0.45,
    baseRange: 4.8,
    upgradeCosts: [77, 110, 154, 209],
    damageScale: 0.28,
    fireRateScale: 0.04,
    rangeScale: 0.06
  },
  splash: {
    type: "splash",
    label: "爆破塔",
    color: "#b75a24",
    cost: 130,
    baseDamage: 24,
    baseFireRate: 0.8,
    baseRange: 3.0,
    upgradeCosts: [91, 130, 182, 247],
    damageScale: 0.2,
    fireRateScale: 0.08,
    rangeScale: 0.06,
    splashRadius: 0.9,
    splashFactor: 0.55
  },
  cannon: {
    type: "cannon",
    label: "重炮塔",
    color: "#9e2e3f",
    cost: 160,
    baseDamage: 85,
    baseFireRate: 0.32,
    baseRange: 2.2,
    upgradeCosts: [112, 160, 224, 304],
    damageScale: 0.3,
    fireRateScale: 0.05,
    rangeScale: 0.04
  }
};

export const enemyDefinitions: Record<EnemyType, EnemyDefinition> = {
  normal: {
    type: "normal",
    label: "常规怪",
    color: "#202b3b",
    radius: 7,
    baseHp: 70,
    baseSpeed: 95,
    baseReward: 10,
    baseLeakDamage: 1
  },
  fast: {
    type: "fast",
    label: "快怪",
    color: "#3f7b2d",
    radius: 5,
    baseHp: 38,
    baseSpeed: 155,
    baseReward: 11,
    baseLeakDamage: 1
  },
  tank: {
    type: "tank",
    label: "肉盾怪",
    color: "#7d3c1f",
    radius: 9,
    baseHp: 210,
    baseSpeed: 58,
    baseReward: 24,
    baseLeakDamage: 2
  }
};

export const waves: WaveEntry[][] = [
  [{ type: "normal", count: 6, interval: 0.9 }],
  [{ type: "normal", count: 8, interval: 0.88 }],
  [{ type: "normal", count: 10, interval: 0.86 }],
  [{ type: "normal", count: 12, interval: 0.84 }],
  [{ type: "normal", count: 14, interval: 0.82 }],
  [
    { type: "normal", count: 12, interval: 0.88 },
    { type: "fast", count: 4, interval: 0.55 }
  ],
  [
    { type: "normal", count: 14, interval: 0.84 },
    { type: "fast", count: 6, interval: 0.52 }
  ],
  [
    { type: "normal", count: 12, interval: 0.82 },
    { type: "fast", count: 6, interval: 0.5 },
    { type: "tank", count: 2, interval: 1.4 }
  ],
  [
    { type: "normal", count: 14, interval: 0.8 },
    { type: "fast", count: 8, interval: 0.48 },
    { type: "tank", count: 3, interval: 1.35 }
  ],
  [
    { type: "normal", count: 16, interval: 0.78 },
    { type: "fast", count: 10, interval: 0.46 },
    { type: "tank", count: 4, interval: 1.3 }
  ]
];
