import {
  ENEMY_HP_GROWTH,
  ENEMY_REWARD_GROWTH,
  ENEMY_SPEED_GROWTH,
  enemyDefinitions,
  towerDefinitions,
  type EnemyType,
  type TowerType
} from "../config/balance";

export function getTowerStats(type: TowerType, level: number) {
  const definition = towerDefinitions[type];
  const levelFactor = level - 1;

  return {
    damage: definition.baseDamage * (1 + definition.damageScale * levelFactor),
    fireRate: definition.baseFireRate * (1 + definition.fireRateScale * levelFactor),
    range: definition.baseRange * (1 + definition.rangeScale * levelFactor),
    splashRadius: definition.splashRadius,
    splashFactor: definition.splashFactor
  };
}

export function getEnemyStats(type: EnemyType, waveNumber: number) {
  const definition = enemyDefinitions[type];
  const factor = waveNumber - 1;

  return {
    hp: definition.baseHp * (1 + ENEMY_HP_GROWTH * factor),
    speed: definition.baseSpeed * (1 + ENEMY_SPEED_GROWTH * factor),
    reward: Math.round(definition.baseReward * (1 + ENEMY_REWARD_GROWTH * factor)),
    leakDamage: definition.baseLeakDamage,
    radius: definition.radius
  };
}
