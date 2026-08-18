import type {
  AngerToken,
  Fruit,
  InventoryCard,
  InventoryTotals,
  OrderEntry,
  RevealResult,
} from "./types.js";
import { FRUITS } from "./types.js";

export const ANGER_TOKENS: AngerToken[] = [1, 2, 3, 4, 5, 6, 7];

export function isGameOver(anger: number): boolean {
  return anger >= 7;
}

export function emptyTotals(): InventoryTotals {
  return { strawberry: 0, banana: 0, grape: 0, durian: 0 };
}

export function calculateInventory(cards: InventoryCard[]): InventoryTotals {
  const totals = emptyTotals();
  for (const card of cards) {
    if (card.kind === "fruit") {
      totals[card.left.fruit] += card.left.count;
      totals[card.right.fruit] += card.right.count;
    }
  }
  return totals;
}

export function inventoryEffects(cards: InventoryCard[]) {
  return {
    invalidatesThreeFruitOrders: cards.some((card) => card.kind === "gorilla" && card.gorilla === "mitsuhiko"),
    invalidatesBananaOrders: cards.some((card) => card.kind === "gorilla" && card.gorilla === "nana"),
    hasMoo: cards.some((card) => card.kind === "gorilla" && card.gorilla === "moo"),
  };
}

function selectedFruit(order: OrderEntry) {
  return order.side === "left" ? order.card.left : order.card.right;
}

export function calculateOrders(orders: OrderEntry[], inventoryCards: InventoryCard[]): RevealResult {
  const inventory = calculateInventory(inventoryCards);
  const effects = inventoryEffects(inventoryCards);
  const validOrders: OrderEntry[] = [];
  const invalidOrders: OrderEntry[] = [];
  const orderTotals = emptyTotals();
  const overloadedOrders: OrderEntry[] = [];

  for (const order of orders) {
    const fruit = selectedFruit(order);
    const invalid =
      (effects.invalidatesThreeFruitOrders && fruit.count === 3) ||
      (effects.invalidatesBananaOrders && fruit.fruit === "banana");
    if (invalid) invalidOrders.push(order);
    else {
      validOrders.push(order);
      orderTotals[fruit.fruit] += fruit.count;
      // Orders are stored in action order. The first card whose cumulative
      // total crosses the available inventory is the card that "explodes".
      if (overloadedOrders.length === 0 && orderTotals[fruit.fruit] > inventory[fruit.fruit]) {
        overloadedOrders.push(order);
      }
    }
  }

  const exceededFruits = FRUITS.filter((fruit) => orderTotals[fruit] > inventory[fruit]);
  return { inventory, orders: orderTotals, allOrders: [...orders], validOrders, invalidOrders, exceededFruits, overloadedOrders, overstocked: exceededFruits.length > 0 };
}

export function takeLowestAngerToken(available: AngerToken[]): AngerToken {
  if (available.length === 0) throw new Error("没有剩余的店长怒气筹码");
  return [...available].sort((a, b) => a - b)[0];
}

export function nextPlayerId(playerIds: string[], currentPlayerId: string): string {
  const index = playerIds.indexOf(currentPlayerId);
  if (index < 0 || playerIds.length === 0) throw new Error("当前玩家不在房间内");
  return playerIds[(index + 1) % playerIds.length];
}
