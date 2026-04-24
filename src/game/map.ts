import { GRID_COLS, GRID_ROWS, TILE_SIZE } from "../config/balance";

export type GridPoint = { col: number; row: number };
export type WorldPoint = { x: number; y: number };

const basePathTiles: GridPoint[] = [
  { col: 0, row: 4 },
  { col: 2, row: 4 },
  { col: 2, row: 1 },
  { col: 5, row: 1 },
  { col: 5, row: 6 },
  { col: 9, row: 6 },
  { col: 9, row: 2 },
  { col: 12, row: 2 },
  { col: 12, row: 7 },
  { col: 15, row: 7 }
];

export const pathTiles: GridPoint[] = basePathTiles.map((tile) => ({
  col: tile.col * 2,
  row: tile.row * 2
}));

export const pathPoints: WorldPoint[] = pathTiles.map((tile) => ({
  x: tile.col * TILE_SIZE + TILE_SIZE / 2,
  y: tile.row * TILE_SIZE + TILE_SIZE / 2
}));

const blocked = new Set<string>();

for (let index = 0; index < pathTiles.length - 1; index += 1) {
  const from = pathTiles[index];
  const to = pathTiles[index + 1];

  if (from.col === to.col) {
    const start = Math.min(from.row, to.row);
    const end = Math.max(from.row, to.row);
    for (let row = start; row <= end; row += 1) {
      blocked.add(`${from.col},${row}`);
    }
  } else {
    const start = Math.min(from.col, to.col);
    const end = Math.max(from.col, to.col);
    for (let col = start; col <= end; col += 1) {
      blocked.add(`${col},${from.row}`);
    }
  }
}

export const buildableTiles: GridPoint[] = [];

for (let row = 0; row < GRID_ROWS; row += 1) {
  for (let col = 0; col < GRID_COLS; col += 1) {
    if (!blocked.has(`${col},${row}`)) {
      buildableTiles.push({ col, row });
    }
  }
}

export function isBuildableTile(col: number, row: number): boolean {
  return col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS && !blocked.has(`${col},${row}`);
}

export function worldToGrid(x: number, y: number): GridPoint {
  return {
    col: Math.floor(x / TILE_SIZE),
    row: Math.floor(y / TILE_SIZE)
  };
}

export function gridToWorldCenter(col: number, row: number): WorldPoint {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2
  };
}
