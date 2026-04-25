import {
  MAX_TOWER_LEVEL,
  SELL_REFUND_RATIO,
  enemyDefinitions,
  towerDefinitions,
  type TowerType,
  waves
} from "../config/balance";
import { getTowerStats } from "../game/balance-utils";
import { TowerDefenseGame } from "../game/game";
import type { Enemy, GamePhase, Tower } from "../game/types";

type UiRefs = {
  canvas: HTMLCanvasElement;
  towerGrid: HTMLDivElement;
  info: HTMLDivElement;
  tooltip: HTMLDivElement;
  startButton: HTMLButtonElement;
  pauseButton: HTMLButtonElement;
  restartButton: HTMLButtonElement;
};

export function bootstrapApp(root: HTMLDivElement) {
  root.innerHTML = createAppMarkup();

  const refs = queryUiRefs(root);
  refs.tooltip.style.display = "none";

  const game = new TowerDefenseGame(refs.canvas, renderUi);
  const towerButtons = createTowerButtons(refs.towerGrid, game, renderUi);

  refs.startButton.addEventListener("click", () => {
    game.startNextWave();
    renderUi();
  });

  refs.pauseButton.addEventListener("click", () => {
    game.togglePause();
    renderUi();
  });

  refs.restartButton.addEventListener("click", () => {
    game.reset();
    renderUi();
  });

  function renderUi() {
    const { state } = game;

    setField(root, "gold", `${state.gold}`);
    setField(root, "lives", `${state.lives}`);
    setField(root, "wave", `${state.waveIndex} / ${waves.length}`);
    setField(root, "phase", getPhaseLabel(state.phase));

    refs.startButton.disabled = isStartDisabled(state.phase);
    refs.pauseButton.disabled = state.phase !== "running" && state.phase !== "paused";
    refs.pauseButton.textContent = state.phase === "paused" ? "继续" : "暂停";

    for (const button of towerButtons) {
      button.classList.toggle("active", button.dataset.type === state.selectedTowerType);
    }

    renderInfoPanel(refs.info, game);
    renderCursorTooltip(refs.tooltip, game);
  }

  game.mount();
}

function createAppMarkup() {
  return `
    <div class="shell">
      <section class="panel hud">
        <div class="stat"><span>金币</span><strong data-field="gold"></strong></div>
        <div class="stat"><span>生命</span><strong data-field="lives"></strong></div>
        <div class="stat"><span>波次</span><strong data-field="wave"></strong></div>
        <div class="stat"><span>状态</span><strong data-field="phase"></strong></div>
      </section>
      <section class="stage panel">
        <canvas data-role="canvas"></canvas>
      </section>
      <section class="panel controls">
        <div class="actions">
          <button data-action="start">开始</button>
          <button data-action="pause">暂停</button>
          <button data-action="restart">重新开始</button>
        </div>
        <div class="tower-grid" data-role="tower-grid"></div>
        <div class="panel tower-detail" data-role="selected-info">
          <p>点击塔卡选择建造，点击地图中的塔可升级或摧毁。</p>
        </div>
      </section>
    </div>
    <div class="cursor-tooltip" data-role="cursor-tooltip" hidden></div>
  `;
}

function queryUiRefs(root: HTMLDivElement): UiRefs {
  return {
    canvas: root.querySelector<HTMLCanvasElement>('[data-role="canvas"]')!,
    towerGrid: root.querySelector<HTMLDivElement>('[data-role="tower-grid"]')!,
    info: root.querySelector<HTMLDivElement>('[data-role="selected-info"]')!,
    tooltip: root.querySelector<HTMLDivElement>('[data-role="cursor-tooltip"]')!,
    startButton: root.querySelector<HTMLButtonElement>('[data-action="start"]')!,
    pauseButton: root.querySelector<HTMLButtonElement>('[data-action="pause"]')!,
    restartButton: root.querySelector<HTMLButtonElement>('[data-action="restart"]')!
  };
}

function createTowerButtons(
  towerGrid: HTMLDivElement,
  game: TowerDefenseGame,
  renderUi: () => void
) {
  return Object.values(towerDefinitions).map((definition) => {
    const button = document.createElement("button");
    button.className = "tower-card";
    button.dataset.type = definition.type;
    button.dataset.tooltip = getTowerCardTooltip(definition.type);
    button.setAttribute("aria-label", definition.label);
    button.innerHTML = `
      <span class="tower-icon" style="--tower-color:${definition.color}">
        <span class="tower-icon__core"></span>
        <span class="tower-icon__barrel"></span>
      </span>
      <span class="sr-only">${definition.label}</span>
    `;
    button.addEventListener("click", () => {
      game.setSelectedTowerType(definition.type);
      renderUi();
    });
    towerGrid.appendChild(button);
    return button;
  });
}

function getTowerCardTooltip(type: TowerType) {
  const tower = towerDefinitions[type];
  return [
    tower.label,
    `价格 ${tower.cost}`,
    `伤害 ${tower.baseDamage}`,
    `攻速 ${tower.baseFireRate.toFixed(2)}/s`,
    `射程 ${tower.baseRange.toFixed(1)} 格`
  ].join("\n");
}

function renderInfoPanel(container: HTMLDivElement, game: TowerDefenseGame) {
  const selectedTower = game.state.towers.find((tower) => tower.id === game.state.selectedTowerId);
  if (!selectedTower) {
    container.innerHTML = renderBuildInfo(game.state.selectedTowerType);
    return;
  }

  container.innerHTML = renderSelectedTowerInfo(selectedTower, game.state.gold);

  container.querySelector<HTMLButtonElement>('[data-action="upgrade"]')?.addEventListener("click", () => {
    game.upgradeSelectedTower();
  });

  container.querySelector<HTMLButtonElement>('[data-action="sell"]')?.addEventListener("click", () => {
    game.sellSelectedTower();
  });
}

function renderSelectedTowerInfo(tower: Tower, gold: number) {
  const definition = towerDefinitions[tower.type];
  const stats = getTowerStats(tower.type, tower.level);
  const canUpgrade = tower.level < MAX_TOWER_LEVEL;
  const upgradeCost = canUpgrade ? definition.upgradeCosts[tower.level - 1] : 0;
  const sellValue = Math.round(tower.totalSpent * SELL_REFUND_RATIO);

  return `
    <h3>${definition.label} Lv.${tower.level}</h3>
    <p>范围 ${stats.range.toFixed(2)} 格</p>
    <p>伤害 ${stats.damage.toFixed(1)}</p>
    <p>攻速 ${stats.fireRate.toFixed(2)}/s</p>
    <p>累计投入 ${tower.totalSpent}，摧毁返还 ${sellValue}</p>
    <div class="selection-actions">
      <button data-action="upgrade" ${!canUpgrade || gold < upgradeCost ? "disabled" : ""}>
        ${canUpgrade ? `升级 (${upgradeCost})` : "已满级"}
      </button>
      <button data-action="sell">摧毁并返还</button>
    </div>
  `;
}

function renderBuildInfo(type: TowerType) {
  const tower = towerDefinitions[type];
  return `
    <h3>当前建造：${tower.label}</h3>
    <p>价格 ${tower.cost}</p>
    <p>伤害 ${tower.baseDamage}</p>
    <p>攻速 ${tower.baseFireRate.toFixed(2)}/s</p>
    <p>射程 ${tower.baseRange.toFixed(1)} 格</p>
  `;
}

function renderCursorTooltip(tooltip: HTMLDivElement, game: TowerDefenseGame) {
  const hovered = game.state.hoveredEntity;
  const pointer = game.state.pointerPosition;

  if (!hovered || !pointer) {
    hideTooltip(tooltip);
    return;
  }

  const html =
    hovered.kind === "enemy"
      ? getEnemyTooltipMarkup(game.state.enemies.find((enemy) => enemy.id === hovered.id))
      : getTowerTooltipMarkup(game.state.towers.find((tower) => tower.id === hovered.id));

  if (!html) {
    hideTooltip(tooltip);
    return;
  }

  tooltip.innerHTML = html;
  tooltip.hidden = false;
  tooltip.style.display = "grid";
  tooltip.style.left = `${pointer.clientX + 16}px`;
  tooltip.style.top = `${pointer.clientY + 16}px`;
}

function getEnemyTooltipMarkup(enemy: Enemy | undefined) {
  if (!enemy) {
    return "";
  }

  const definition = enemyDefinitions[enemy.type];
  return `
    <strong>${definition.label}</strong>
    <span>总生命值 ${enemy.maxHp.toFixed(0)}</span>
    <span>当前生命值 ${Math.max(enemy.hp, 0).toFixed(0)}</span>
    <span>速度 ${enemy.speed.toFixed(1)}</span>
  `;
}

function getTowerTooltipMarkup(tower: Tower | undefined) {
  if (!tower) {
    return "";
  }

  const definition = towerDefinitions[tower.type];
  const stats = getTowerStats(tower.type, tower.level);
  return `
    <strong>${definition.label}</strong>
    <span>范围 ${stats.range.toFixed(2)} 格</span>
    <span>伤害 ${stats.damage.toFixed(1)}</span>
    <span>攻速 ${stats.fireRate.toFixed(2)}/s</span>
    <span>等级 ${tower.level}</span>
  `;
}

function hideTooltip(tooltip: HTMLDivElement) {
  tooltip.hidden = true;
  tooltip.style.display = "none";
}

function setField(root: HTMLDivElement, field: string, value: string) {
  root.querySelector<HTMLElement>(`[data-field="${field}"]`)!.textContent = value;
}

function getPhaseLabel(phase: GamePhase) {
  switch (phase) {
    case "idle":
      return "备战中";
    case "running":
      return "战斗中";
    case "paused":
      return "已暂停";
    case "won":
      return "已胜利";
    case "lost":
      return "已失败";
    default:
      return phase;
  }
}

function isStartDisabled(phase: GamePhase) {
  return phase === "running" || phase === "paused" || phase === "won" || phase === "lost";
}
