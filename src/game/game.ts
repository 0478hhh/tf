import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  enemyDefinitions,
  GRID_COLS,
  GRID_ROWS,
  MAX_TOWER_LEVEL,
  SELL_REFUND_RATIO,
  STARTING_GOLD,
  STARTING_LIVES,
  TILE_SIZE,
  towerDefinitions,
  type TowerType,
  waves
} from "../config/balance";
import { getEnemyStats, getTowerStats } from "./balance-utils";
import { gridToWorldCenter, isBuildableTile, pathPoints } from "./map";
import type { Enemy, GameState, Tower } from "./types";

export class TowerDefenseGame {
  readonly state: GameState;
  private readonly ctx: CanvasRenderingContext2D;
  private animationFrameId = 0;
  private lastTime = 0;
  private readonly onChange: () => void;

  constructor(private readonly canvas: HTMLCanvasElement, onChange: () => void) {
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context is unavailable.");
    }

    this.ctx = ctx;
    this.onChange = onChange;
    this.state = {
      phase: "idle",
      gold: STARTING_GOLD,
      lives: STARTING_LIVES,
      waveIndex: 0,
      selectedTowerType: "basic",
      hoveredCell: null,
      selectedTowerId: null,
      enemies: [],
      towers: [],
      shotFlashes: [],
      nextEnemyId: 1,
      nextTowerId: 1,
      nextFlashId: 1,
      time: 0,
      queue: []
    };
  }

  mount() {
    this.bindEvents();
    this.render();
    this.onChange();
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this.animationFrameId);
  }

  setSelectedTowerType(type: TowerType) {
    this.state.selectedTowerType = type;
    this.onChange();
  }

  togglePause() {
    if (this.state.phase === "running") {
      this.state.phase = "paused";
    } else if (this.state.phase === "paused") {
      this.state.phase = "running";
    }
    this.onChange();
  }

  startNextWave() {
    if (this.state.phase === "running" || this.state.phase === "paused") {
      return;
    }

    if (this.state.waveIndex >= waves.length) {
      return;
    }

    this.state.waveIndex += 1;
    this.state.phase = "running";
    this.state.queue = this.buildSpawnQueue(this.state.waveIndex);
    this.state.selectedTowerId = null;
    this.onChange();
  }

  upgradeSelectedTower() {
    const tower = this.getSelectedTower();
    if (!tower || tower.level >= MAX_TOWER_LEVEL) {
      return;
    }

    const definition = towerDefinitions[tower.type];
    const cost = definition.upgradeCosts[tower.level - 1];
    if (this.state.gold < cost) {
      return;
    }

    this.state.gold -= cost;
    tower.level += 1;
    tower.totalSpent += cost;
    this.onChange();
  }

  sellSelectedTower() {
    const tower = this.getSelectedTower();
    if (!tower) {
      return;
    }

    this.state.gold += Math.round(tower.totalSpent * SELL_REFUND_RATIO);
    this.state.towers = this.state.towers.filter((item) => item.id !== tower.id);
    this.state.selectedTowerId = null;
    this.onChange();
  }

  private readonly loop = (timestamp: number) => {
    if (this.lastTime === 0) {
      this.lastTime = timestamp;
    }

    const delta = Math.min((timestamp - this.lastTime) / 1000, 0.033);
    this.lastTime = timestamp;

    if (this.state.phase === "running") {
      this.update(delta);
    }

    this.render();
    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  private bindEvents() {
    this.canvas.addEventListener("mousemove", (event) => {
      const position = this.getCanvasPosition(event);
      const col = Math.floor(position.x / TILE_SIZE);
      const row = Math.floor(position.y / TILE_SIZE);
      this.state.hoveredCell = col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS ? { col, row } : null;
      this.onChange();
    });

    this.canvas.addEventListener("mouseleave", () => {
      this.state.hoveredCell = null;
      this.onChange();
    });

    this.canvas.addEventListener("click", (event) => {
      const position = this.getCanvasPosition(event);
      const clickedTower = this.findTowerAt(position.x, position.y);
      if (clickedTower) {
        this.state.selectedTowerId = clickedTower.id;
        this.onChange();
        return;
      }

      const col = Math.floor(position.x / TILE_SIZE);
      const row = Math.floor(position.y / TILE_SIZE);
      this.placeTower(col, row);
    });
  }

  private getCanvasPosition(event: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * this.canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * this.canvas.height
    };
  }

  private update(delta: number) {
    this.state.time += delta;
    this.spawnEnemies();
    this.updateEnemies(delta);
    this.updateTowers(delta);
    this.updateFlashes(delta);
    this.cleanupEntities();
    this.checkWaveEnd();
  }

  private spawnEnemies() {
    while (this.state.queue.length > 0 && this.state.queue[0].spawnAt <= this.state.time) {
      const item = this.state.queue.shift()!;
      const stats = getEnemyStats(item.type, this.state.waveIndex);
      const spawn = pathPoints[0];

      this.state.enemies.push({
        id: this.state.nextEnemyId++,
        type: item.type,
        x: spawn.x,
        y: spawn.y,
        hp: stats.hp,
        maxHp: stats.hp,
        speed: stats.speed,
        reward: stats.reward,
        leakDamage: stats.leakDamage,
        radius: stats.radius,
        pathIndex: 0,
        alive: true,
        progressScore: 0
      });
    }
  }

  private updateEnemies(delta: number) {
    for (const enemy of this.state.enemies) {
      if (!enemy.alive) {
        continue;
      }

      const nextPoint = pathPoints[enemy.pathIndex + 1];
      if (!nextPoint) {
        enemy.alive = false;
        this.state.lives -= enemy.leakDamage;
        if (this.state.lives <= 0) {
          this.state.lives = 0;
          this.state.phase = "lost";
        }
        continue;
      }

      const dx = nextPoint.x - enemy.x;
      const dy = nextPoint.y - enemy.y;
      const distance = Math.hypot(dx, dy);
      const step = enemy.speed * delta;

      if (distance <= step) {
        enemy.x = nextPoint.x;
        enemy.y = nextPoint.y;
        enemy.pathIndex += 1;
        enemy.progressScore = enemy.pathIndex;
      } else {
        enemy.x += (dx / distance) * step;
        enemy.y += (dy / distance) * step;
        enemy.progressScore = enemy.pathIndex + 1 - distance / TILE_SIZE;
      }
    }
  }

  private updateTowers(delta: number) {
    for (const tower of this.state.towers) {
      tower.cooldown -= delta;

      const stats = getTowerStats(tower.type, tower.level);
      const rangePixels = stats.range * TILE_SIZE;
      const target = this.acquireTarget(tower, rangePixels);
      if (!target) {
        continue;
      }

      tower.aimAngle = Math.atan2(target.y - tower.y, target.x - tower.x);
      if (tower.cooldown > 0) {
        continue;
      }

      tower.cooldown = 1 / stats.fireRate;
      this.damageEnemy(target, stats.damage);

      if (stats.splashRadius && stats.splashFactor) {
        const splashRadius = stats.splashRadius * TILE_SIZE;
        for (const enemy of this.state.enemies) {
          if (!enemy.alive || enemy.id === target.id) {
            continue;
          }
          const distance = Math.hypot(enemy.x - target.x, enemy.y - target.y);
          if (distance <= splashRadius) {
            this.damageEnemy(enemy, stats.damage * stats.splashFactor);
          }
        }
      }

      this.state.shotFlashes.push({
        id: this.state.nextFlashId++,
        fromX: tower.x,
        fromY: tower.y,
        toX: target.x,
        toY: target.y,
        color: towerDefinitions[tower.type].color,
        ttl: 0.08
      });
    }
  }

  private damageEnemy(enemy: Enemy, amount: number) {
    if (!enemy.alive) {
      return;
    }

    enemy.hp -= amount;
    if (enemy.hp <= 0) {
      enemy.alive = false;
      this.state.gold += enemy.reward;
    }
  }

  private updateFlashes(delta: number) {
    for (const flash of this.state.shotFlashes) {
      flash.ttl -= delta;
    }
  }

  private cleanupEntities() {
    this.state.enemies = this.state.enemies.filter((enemy) => enemy.alive);
    this.state.shotFlashes = this.state.shotFlashes.filter((flash) => flash.ttl > 0);
  }

  private checkWaveEnd() {
    if (this.state.phase !== "running") {
      return;
    }

    if (this.state.queue.length === 0 && this.state.enemies.length === 0) {
      this.state.phase = this.state.waveIndex >= waves.length ? "won" : "idle";
      this.onChange();
    }
  }

  private buildSpawnQueue(waveNumber: number) {
    let cursor = this.state.time + 0.4;
    const entries = waves[waveNumber - 1];

    return entries.flatMap((entry) => {
      const items = Array.from({ length: entry.count }, () => {
        const item = { type: entry.type, spawnAt: cursor };
        cursor += entry.interval;
        return item;
      });
      cursor += 0.35;
      return items;
    });
  }

  private acquireTarget(tower: Tower, rangePixels: number) {
    let best: Enemy | null = null;

    for (const enemy of this.state.enemies) {
      if (!enemy.alive) {
        continue;
      }

      const distance = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
      if (distance > rangePixels) {
        continue;
      }

      if (!best || enemy.progressScore > best.progressScore) {
        best = enemy;
      }
    }

    return best;
  }

  private placeTower(col: number, row: number) {
    if (!isBuildableTile(col, row)) {
      return;
    }

    const occupied = this.state.towers.some((tower) => tower.col === col && tower.row === row);
    if (occupied) {
      return;
    }

    const definition = towerDefinitions[this.state.selectedTowerType];
    if (this.state.gold < definition.cost) {
      return;
    }

    const { x, y } = gridToWorldCenter(col, row);
    this.state.gold -= definition.cost;
    this.state.towers.push({
      id: this.state.nextTowerId++,
      type: definition.type,
      col,
      row,
      x,
      y,
      level: 1,
      totalSpent: definition.cost,
      cooldown: 0,
      aimAngle: -Math.PI / 2
    });
    this.state.selectedTowerId = null;
    this.onChange();
  }

  private findTowerAt(x: number, y: number) {
    return this.state.towers.find((tower) => Math.hypot(tower.x - x, tower.y - y) <= TILE_SIZE * 0.35) ?? null;
  }

  private getSelectedTower() {
    return this.state.towers.find((tower) => tower.id === this.state.selectedTowerId) ?? null;
  }

  private render() {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.renderGrid();
    this.renderPath();
    this.renderHover();
    this.renderTowers();
    this.renderEnemies();
    this.renderFlashes();
    this.renderOverlay();
  }

  private renderGrid() {
    const { ctx } = this;
    ctx.fillStyle = "#f3f1eb";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.strokeStyle = "rgba(28, 35, 45, 0.12)";
    ctx.lineWidth = 1;

    for (let col = 0; col <= GRID_COLS; col += 1) {
      const x = col * TILE_SIZE;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvas.height);
      ctx.stroke();
    }

    for (let row = 0; row <= GRID_ROWS; row += 1) {
      const y = row * TILE_SIZE;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvas.width, y);
      ctx.stroke();
    }
  }

  private renderPath() {
    const { ctx } = this;
    ctx.strokeStyle = "#cbbfa7";
    ctx.lineWidth = TILE_SIZE * 0.64;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
    for (const point of pathPoints.slice(1)) {
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();

    ctx.strokeStyle = "#9b8c71";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private renderHover() {
    if (!this.state.hoveredCell) {
      return;
    }

    const { col, row } = this.state.hoveredCell;
    const canBuild =
      isBuildableTile(col, row) &&
      !this.state.towers.some((tower) => tower.col === col && tower.row === row) &&
      this.state.gold >= towerDefinitions[this.state.selectedTowerType].cost;

    this.ctx.fillStyle = canBuild ? "rgba(29, 122, 85, 0.2)" : "rgba(158, 46, 63, 0.18)";
    this.ctx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
  }

  private renderTowers() {
    const { ctx } = this;

    for (const tower of this.state.towers) {
      const definition = towerDefinitions[tower.type];
      const isSelected = this.state.selectedTowerId === tower.id;
      if (isSelected) {
        const stats = getTowerStats(tower.type, tower.level);
        ctx.strokeStyle = "rgba(39, 93, 140, 0.28)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, stats.range * TILE_SIZE, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = definition.color;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, TILE_SIZE * 0.24, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#121924";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(tower.x, tower.y);
      ctx.lineTo(
        tower.x + Math.cos(tower.aimAngle) * TILE_SIZE * 0.3,
        tower.y + Math.sin(tower.aimAngle) * TILE_SIZE * 0.3
      );
      ctx.stroke();

      ctx.fillStyle = "#fffdfa";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`L${tower.level}`, tower.x, tower.y + 3);
    }
  }

  private renderEnemies() {
    const { ctx } = this;

    for (const enemy of this.state.enemies) {
      ctx.fillStyle = enemyDefinitions[enemy.type].color;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(18, 25, 36, 0.18)";
      ctx.fillRect(enemy.x - 14, enemy.y - enemy.radius - 9, 28, 4);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(enemy.x - 14, enemy.y - enemy.radius - 9, 28 * Math.max(enemy.hp / enemy.maxHp, 0), 4);
    }
  }

  private renderFlashes() {
    const { ctx } = this;
    ctx.lineWidth = 2;

    for (const flash of this.state.shotFlashes) {
      ctx.strokeStyle = flash.color;
      ctx.globalAlpha = Math.max(flash.ttl / 0.08, 0);
      ctx.beginPath();
      ctx.moveTo(flash.fromX, flash.fromY);
      ctx.lineTo(flash.toX, flash.toY);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  private renderOverlay() {
    if (this.state.phase !== "won" && this.state.phase !== "lost") {
      return;
    }

    const { ctx } = this;
    ctx.fillStyle = "rgba(18, 25, 36, 0.42)";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = "#fffdfa";
    ctx.textAlign = "center";
    ctx.font = "bold 40px sans-serif";
    ctx.fillText(this.state.phase === "won" ? "胜利" : "失败", this.canvas.width / 2, this.canvas.height / 2);
  }
}
