import type { GorillaKind, InventoryCard } from "./types.js";
import { GORILLA_CARDS, VERIFIED_STRUCTURE_DEV_CARDS } from "./deck.js";

export const GAME_MODE_IDS = ["classic", "curious-market"] as const;
export type GameModeId = (typeof GAME_MODE_IDS)[number];

export const CURIOUS_MARKET_PLAYER_GORILLA_WEIGHT = 1;

export type GameModeConfig = {
  id: GameModeId;
  label: string;
  description: string;
  gorillas: readonly GorillaKind[];
  playerGorillaWeight?: number;
};

export const GAME_MODES: Record<GameModeId, GameModeConfig> = {
  classic: {
    id: "classic",
    label: "经典模式",
    description: "28 张水果牌与 3 张经典大猩猩牌。",
    gorillas: ["mitsuhiko", "moo", "nana"],
  },
  "curious-market": {
    id: "curious-market",
    label: "猩风作浪",
    description: "经典牌组加入五张特殊大猩猩牌。",
    gorillas: ["mitsuhiko", "moo", "nana", "grape-beadsmith", "order-swap-magician", "boxing-manager", "inventory-mover", "temporary-supervisor"],
    playerGorillaWeight: CURIOUS_MARKET_PLAYER_GORILLA_WEIGHT,
  },
};

export function drawWeightedInventoryCard(deck: InventoryCard[], gorillaWeight: number, random: () => number = Math.random): InventoryCard | undefined {
  if (deck.length === 0) return undefined;
  if (!Number.isFinite(gorillaWeight) || gorillaWeight < 0) throw new RangeError("大猩猩牌权重必须是非负有限数");

  const totalWeight = deck.reduce((sum, card) => sum + (card.kind === "gorilla" ? gorillaWeight : 1), 0);
  if (totalWeight === 0) return deck.pop();

  let target = random() * totalWeight;
  for (let index = 0; index < deck.length; index += 1) {
    target -= deck[index].kind === "gorilla" ? gorillaWeight : 1;
    if (target < 0) return deck.splice(index, 1)[0];
  }
  return deck.pop();
}

export function drawFruitInventoryCard(deck: InventoryCard[], random: () => number = Math.random): InventoryCard | undefined {
  const fruitCards = deck.filter((card) => card.kind === "fruit");
  const card = drawWeightedInventoryCard(fruitCards, 0, random);
  if (!card) return undefined;
  const index = deck.findIndex((candidate) => candidate.id === card.id);
  return index >= 0 ? deck.splice(index, 1)[0] : undefined;
}

export function isGameModeId(value: unknown): value is GameModeId {
  return typeof value === "string" && GAME_MODE_IDS.includes(value as GameModeId);
}

export function createDeckForMode(mode: GameModeId): InventoryCard[] {
  const gorillas = new Set(GAME_MODES[mode].gorillas);
  return [...VERIFIED_STRUCTURE_DEV_CARDS, ...GORILLA_CARDS.filter((card) => gorillas.has(card.gorilla))];
}
