import { MAX_TOWER_LEVEL, SELL_REFUND_RATIO, towerDefinitions, waves } from "../config/balance";
import { getTowerStats } from "../game/balance-utils";
import { TowerDefenseGame } from "../game/game";

export function bootstrapApp(root: HTMLDivElement) {
  root.innerHTML = `
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
          <button data-action="start">开始下一波</button>
          <button data-action="pause">暂停</button>
          <button data-action="restart">重新开始</button>
        </div>
        <div class="tower-grid" data-role="tower-grid"></div>
        <div class="panel tower-detail" data-role="selected-info">
          <p>右侧图标用于选塔建造。悬停图标可看参数，点击地图中的塔可升级或摧毁。</p>
        </div>
      </section>
    </div>
  `;

  const canvas = root.querySelector<HTMLCanvasElement>('[data-role="canvas"]')!;
  const towerGrid = root.querySelector<HTMLDivElement>('[data-role="tower-grid"]')!;
  const info = root.querySelector<HTMLDivElement>('[data-role="selected-info"]')!;
  const startButton = root.querySelector<HTMLButtonElement>('[data-action="start"]')!;
  const pauseButton = root.querySelector<HTMLButtonElement>('[data-action="pause"]')!;
  const restartButton = root.querySelector<HTMLButtonElement>('[data-action="restart"]')!;

  const game = new TowerDefenseGame(canvas, renderHud);

  const towerButtons = Object.values(towerDefinitions).map((definition) => {
    const button = document.createElement("button");
    button.className = "tower-card";
    button.dataset.type = definition.type;
    button.dataset.tooltip = [
      definition.label,
      `价格 ${definition.cost}`,
      `伤害 ${definition.baseDamage}`,
      `攻速 ${definition.baseFireRate.toFixed(2)}/s`,
      `射程 ${definition.baseRange.toFixed(1)} 格`
    ].join("\n");
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
      renderHud();
    });
    towerGrid.appendChild(button);
    return button;
  });

  startButton.addEventListener("click", () => {
    game.startNextWave();
    renderHud();
  });

  pauseButton.addEventListener("click", () => {
    game.togglePause();
    renderHud();
  });

  restartButton.addEventListener("click", () => {
    game.reset();
    renderHud();
  });

  function renderHud() {
    const { state } = game;

    setField("gold", `${state.gold}`);
    setField("lives", `${state.lives}`);
    setField("wave", `${state.waveIndex} / ${waves.length}`);
    setField("phase", phaseLabel(state.phase));

    startButton.disabled = state.phase === "running" || state.phase === "paused" || state.phase === "won" || state.phase === "lost";
    pauseButton.disabled = state.phase !== "running" && state.phase !== "paused";
    pauseButton.textContent = state.phase === "paused" ? "继续" : "暂停";
    restartButton.disabled = false;

    for (const button of towerButtons) {
      button.classList.toggle("active", button.dataset.type === state.selectedTowerType);
    }

    renderSelectionInfo();
  }

  function renderSelectionInfo() {
    const tower = game.state.towers.find((item) => item.id === game.state.selectedTowerId);
    if (!tower) {
      const selected = towerDefinitions[game.state.selectedTowerType];
      info.innerHTML = `
        <h3>当前建造：${selected.label}</h3>
        <p>价格 ${selected.cost}，点击地图中的可建造格即可放置。</p>
        <p>塔与怪物数值统一定义在 <code>src/config/balance.ts</code>。</p>
      `;
      return;
    }

    const definition = towerDefinitions[tower.type];
    const stats = getTowerStats(tower.type, tower.level);
    const canUpgrade = tower.level < MAX_TOWER_LEVEL;
    const upgradeCost = canUpgrade ? definition.upgradeCosts[tower.level - 1] : 0;
    const sellValue = Math.round(tower.totalSpent * SELL_REFUND_RATIO);

    info.innerHTML = `
      <h3>${definition.label} Lv.${tower.level}</h3>
      <p>伤害 ${stats.damage.toFixed(1)}，攻速 ${stats.fireRate.toFixed(2)}/s，射程 ${stats.range.toFixed(2)} 格</p>
      <p>累计投入 ${tower.totalSpent}，摧毁返还 ${sellValue}</p>
      <div class="selection-actions">
        <button data-action="upgrade" ${!canUpgrade || game.state.gold < upgradeCost ? "disabled" : ""}>
          ${canUpgrade ? `升级 (${upgradeCost})` : "已满级"}
        </button>
        <button data-action="sell">摧毁并返还</button>
      </div>
    `;

    info.querySelector<HTMLButtonElement>('[data-action="upgrade"]')?.addEventListener("click", () => {
      game.upgradeSelectedTower();
      renderHud();
    });

    info.querySelector<HTMLButtonElement>('[data-action="sell"]')?.addEventListener("click", () => {
      game.sellSelectedTower();
      renderHud();
    });
  }

  function setField(field: string, value: string) {
    root.querySelector<HTMLElement>(`[data-field="${field}"]`)!.textContent = value;
  }

  game.mount();
}

function phaseLabel(phase: string) {
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
