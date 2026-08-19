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
  const gorillas = new Set(cards.filter((card) => card.kind === "gorilla").map((card) => card.gorilla));
  return {
    invalidatesThreeFruitOrders: gorillas.has("mitsuhiko"),
    invalidatesBananaOrders: gorillas.has("nana"),
    countsGrapeOrdersAsOne: gorillas.has("grape-beadsmith"),
    swapsStrawberryAndGrapeInventory: gorillas.has("order-swap-magician"),
    hasMoo: gorillas.has("moo"),
  };
}

function selectedFruit(order: OrderEntry) {
  return order.side === "left" ? order.card.left : order.card.right;
}

export function calculateOrders(orders: OrderEntry[], inventoryCards: InventoryCard[]): RevealResult {
  const baseInventory = calculateInventory(inventoryCards);
  const inventory = { ...baseInventory };
  const effects = inventoryEffects(inventoryCards);
  const validOrders: OrderEntry[] = [];
  const invalidOrders: OrderEntry[] = [];
  const explanations: RevealResult["explanations"] = [];

  const mitsuhikoOrders: OrderEntry[] = [];
  const nanaOrders: OrderEntry[] = [];
  for (const order of orders) {
    const fruit = selectedFruit(order);
    if (effects.invalidatesThreeFruitOrders && fruit.count === 3) mitsuhikoOrders.push(order);
    else if (effects.invalidatesBananaOrders && fruit.fruit === "banana") nanaOrders.push(order);
    else validOrders.push(order);
  }
  invalidOrders.push(...mitsuhikoOrders, ...nanaOrders);
  if (effects.invalidatesThreeFruitOrders) explanations.push({ effect: "mitsuhiko", summary: "三果判官·米奇使数量为 3 的订单无效", affectedOrderCardIds: mitsuhikoOrders.map((order) => order.cardId) });
  if (effects.invalidatesBananaOrders) explanations.push({ effect: "nana", summary: "香蕉克星·汉娜使香蕉订单无效", affectedOrderCardIds: nanaOrders.map((order) => order.cardId) });

  const grapeOrders = effects.countsGrapeOrdersAsOne ? validOrders.filter((order) => {
    const fruit = selectedFruit(order);
    return fruit.fruit === "grape" && fruit.count > 1;
  }) : [];
  if (effects.countsGrapeOrdersAsOne) explanations.push({
    effect: "grape-beadsmith",
    summary: "葡萄珠匠·紫罗让每张仍有效的葡萄订单按 1 计算",
    orderChanges: grapeOrders.map((order) => ({ cardId: order.cardId, from: selectedFruit(order).count as 2 | 3, to: 1 })),
  });
  if (effects.swapsStrawberryAndGrapeInventory) {
    const strawberry = inventory.strawberry;
    const grape = inventory.grape;
    [inventory.strawberry, inventory.grape] = [grape, strawberry];
    explanations.push({
      effect: "order-swap-magician",
      summary: "换位魔术师·莫比交换草莓与葡萄库存总数，订单不变",
      inventoryChanges: { strawberry: { from: strawberry, to: grape }, grape: { from: grape, to: strawberry } },
    });
  }

  const orderTotals = emptyTotals();
  const overloadedOrders: OrderEntry[] = [];
  for (const order of validOrders) {
    const fruit = selectedFruit(order);
    orderTotals[fruit.fruit] += effects.countsGrapeOrdersAsOne && fruit.fruit === "grape" ? 1 : fruit.count;
    if (overloadedOrders.length === 0 && orderTotals[fruit.fruit] > inventory[fruit.fruit]) overloadedOrders.push(order);
  }

  const exceededFruits = FRUITS.filter((fruit) => orderTotals[fruit] > inventory[fruit]);
  return { inventory, baseInventory, orders: orderTotals, allOrders: [...orders], validOrders, invalidOrders, exceededFruits, overloadedOrders, overstocked: exceededFruits.length > 0, explanations };
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
