import type { GorillaKind, InventoryCard } from "./types.js";
import { GORILLA_CARDS, VERIFIED_STRUCTURE_DEV_CARDS } from "./deck.js";

export const GAME_MODE_IDS = ["classic", "curious-market"] as const;
export type GameModeId = (typeof GAME_MODE_IDS)[number];

export type GameModeConfig = {
  id: GameModeId;
  label: string;
  description: string;
  gorillas: readonly GorillaKind[];
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
    description: "经典牌组加入葡萄珠匠·紫罗与换位魔术师·莫比。",
    gorillas: ["mitsuhiko", "moo", "nana", "grape-beadsmith", "order-swap-magician"],
  },
};

export function isGameModeId(value: unknown): value is GameModeId {
  return typeof value === "string" && GAME_MODE_IDS.includes(value as GameModeId);
}

export function createDeckForMode(mode: GameModeId): InventoryCard[] {
  const gorillas = new Set(GAME_MODES[mode].gorillas);
  return [...VERIFIED_STRUCTURE_DEV_CARDS, ...GORILLA_CARDS.filter((card) => gorillas.has(card.gorilla))];
}
