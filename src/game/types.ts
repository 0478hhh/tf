import type { EnemyType, TowerType } from "../config/balance";

export type GamePhase = "idle" | "running" | "paused" | "won" | "lost";

export type Enemy = {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  reward: number;
  leakDamage: number;
  radius: number;
  pathIndex: number;
  alive: boolean;
  progressScore: number;
};

export type Tower = {
  id: number;
  type: TowerType;
  col: number;
  row: number;
  x: number;
  y: number;
  level: number;
  totalSpent: number;
  cooldown: number;
  aimAngle: number;
};

export type ShotFlash = {
  id: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  ttl: number;
};

export type SpawnQueueItem = {
  type: EnemyType;
  spawnAt: number;
};

export type GameState = {
  phase: GamePhase;
  gold: number;
  lives: number;
  waveIndex: number;
  selectedTowerType: TowerType;
  hoveredCell: { col: number; row: number } | null;
  selectedTowerId: number | null;
  enemies: Enemy[];
  towers: Tower[];
  shotFlashes: ShotFlash[];
  nextEnemyId: number;
  nextTowerId: number;
  nextFlashId: number;
  time: number;
  queue: SpawnQueueItem[];
};
