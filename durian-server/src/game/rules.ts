import type {
  AngerToken,
  Fruit,
  InventoryCard,
  InventorySlot,
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
    protectsLowestFruit: gorillas.has("boxing-manager"),
    movesInventory: gorillas.has("inventory-mover"),
    discountsFirstOrders: gorillas.has("temporary-supervisor"),
    hasMoo: gorillas.has("moo"),
  };
}

function selectedFruit(order: OrderEntry) {
  return order.side === "left" ? order.card.left : order.card.right;
}

function normalizeInventorySlots(inventory: InventoryCard[] | InventorySlot[]): InventorySlot[] {
  return inventory.map((entry, index) => "card" in entry ? entry : { inventoryId: String(index), card: entry });
}

type InventoryHalf = {
  inventoryId: string;
  cardId: string;
  side: "left" | "right";
  effectiveFruit: Fruit;
  count: 1 | 2 | 3;
};

export function calculateOrders(orders: OrderEntry[], inventoryInput: InventoryCard[] | InventorySlot[]): RevealResult {
  const inventorySlots = normalizeInventorySlots(inventoryInput);
  const inventoryCards = inventorySlots.map((slot) => slot.card);
  const baseInventory = calculateInventory(inventoryCards);
  const inventory = { ...baseInventory };
  const effects = inventoryEffects(inventoryCards);
  const validOrders: OrderEntry[] = [];
  const invalidOrders: OrderEntry[] = [];
  const explanations: RevealResult["explanations"] = [];
  const lockedOrders = new Set<OrderEntry>();

  const supervisorOrders = new Set<OrderEntry>();
  const supervisorFruits = new Set<Fruit>();
  const supervisorChanges: Extract<RevealResult["explanations"][number], { effect: "temporary-supervisor" }>["orderChanges"] = [];
  if (effects.discountsFirstOrders) {
    for (const order of orders) {
      const fruit = selectedFruit(order);
      if (supervisorFruits.has(fruit.fruit)) continue;
      supervisorFruits.add(fruit.fruit);
      supervisorOrders.add(order);
      lockedOrders.add(order);
      supervisorChanges.push({ cardId: order.cardId, fruit: fruit.fruit, from: fruit.count, to: 0 });
    }
    explanations.push({ effect: "temporary-supervisor", summary: "临时主管·菲恩使每种水果按原顺序的第一张订单计 0，并锁定该订单不再处理后续订单效果", orderChanges: supervisorChanges });
  }

  const mitsuhikoOrders: OrderEntry[] = [];
  if (effects.invalidatesThreeFruitOrders) {
    for (const order of orders) {
      if (lockedOrders.has(order) || selectedFruit(order).count !== 3) continue;
      mitsuhikoOrders.push(order);
      lockedOrders.add(order);
    }
    explanations.push({ effect: "mitsuhiko", summary: "三果判官·米奇使尚未锁定且数量为 3 的订单无效", affectedOrderCardIds: mitsuhikoOrders.map((order) => order.cardId) });
  }

  const nanaOrders: OrderEntry[] = [];
  if (effects.invalidatesBananaOrders) {
    for (const order of orders) {
      if (lockedOrders.has(order) || selectedFruit(order).fruit !== "banana") continue;
      nanaOrders.push(order);
      lockedOrders.add(order);
    }
    explanations.push({ effect: "nana", summary: "香蕉克星·汉娜使尚未锁定的香蕉订单无效", affectedOrderCardIds: nanaOrders.map((order) => order.cardId) });
  }
  invalidOrders.push(...mitsuhikoOrders, ...nanaOrders);
  const invalidOrderSet = new Set(invalidOrders);
  validOrders.push(...orders.filter((order) => !invalidOrderSet.has(order)));

  const grapeOrders: OrderEntry[] = [];
  if (effects.countsGrapeOrdersAsOne) {
    for (const order of orders) {
      const fruit = selectedFruit(order);
      if (lockedOrders.has(order) || fruit.fruit !== "grape" || fruit.count <= 1) continue;
      grapeOrders.push(order);
      lockedOrders.add(order);
    }
    explanations.push({
      effect: "grape-beadsmith",
      summary: "葡萄珠匠·紫罗让尚未锁定且仍有效的葡萄订单按 1 计算",
      orderChanges: grapeOrders.map((order) => ({ cardId: order.cardId, from: selectedFruit(order).count as 2 | 3, to: 1 })),
    });
  }
  const halves: InventoryHalf[] = inventorySlots.flatMap(({ inventoryId, card }) => card.kind === "fruit" ? (["left", "right"] as const).map((side) => ({
    inventoryId,
    cardId: card.id,
    side,
    effectiveFruit: effects.swapsStrawberryAndGrapeInventory
      ? card[side].fruit === "strawberry" ? "grape" : card[side].fruit === "grape" ? "strawberry" : card[side].fruit
      : card[side].fruit,
    count: card[side].count,
  })) : []);
  if (effects.swapsStrawberryAndGrapeInventory) {
    const strawberry = inventory.strawberry;
    const grape = inventory.grape;
    [inventory.strawberry, inventory.grape] = [grape, strawberry];
    explanations.push({
      effect: "order-swap-magician",
      summary: "换位魔术师·莫比交换草莓与葡萄的有效库存归属，订单与原库存卡不变",
      inventoryChanges: { strawberry: { from: strawberry, to: grape }, grape: { from: grape, to: strawberry } },
    });
  }

  const protectedFruit = effects.protectsLowestFruit
    ? FRUITS.reduce((selected, fruit) => {
      // FRUITS is the authoritative tie-break order; keep the earlier fruit on equality.
      return baseInventory[fruit] < baseInventory[selected] ? fruit : selected;
    }, FRUITS[0])
    : undefined;
  if (protectedFruit) explanations.push({ effect: "boxing-manager", summary: "封箱经理·克莱德按初始库存保护整种最低库存水果；并列取固定顺序第一项，库存为 0 仍不触发爆单", affectedFruits: [protectedFruit] });
  const actor = effects.movesInventory ? inventorySlots.find((slot) => slot.card.kind === "gorilla" && slot.card.gorilla === "inventory-mover") : undefined;
  if (actor) {
    const eligibleFruits = FRUITS.filter((fruit) => fruit !== protectedFruit && inventory[fruit] >= 2);
    const source = eligibleFruits.reduce<Fruit | undefined>((selected, fruit) => selected === undefined || inventory[fruit] > inventory[selected] ? fruit : selected, undefined);
    const target = FRUITS.reduce((selected, fruit) => inventory[fruit] < inventory[selected] ? fruit : selected, FRUITS[0]);
    if (source && source !== target) {
      const matching = halves.filter((half) => half.effectiveFruit === source);
      const wholeTwo = matching.find((half) => half.count === 2);
      const fromThree = matching.find((half) => half.count === 3);
      const singles = matching.filter((half) => half.count === 1).slice(0, 2);
      const selected = wholeTwo ? [{ half: wholeTwo, amount: 2 as const }] : fromThree ? [{ half: fromThree, amount: 2 as const }] : singles.length === 2 ? singles.map((half) => ({ half, amount: 1 as const })) : [];
      if (selected.length > 0) {
        const sourceBefore = inventory[source];
        const targetBefore = inventory[target];
        inventory[source] -= 2;
        inventory[target] += 2;
        explanations.push({
          effect: "inventory-mover",
          summary: "库存搬运工·巴鲁避开克莱德保护的水果，从合格的最高有效库存实例搬运 2 个到最低库存",
          sourceFruit: source,
          targetFruit: target,
          amount: 2,
          actor,
          sources: selected.map(({ half, amount }) => ({
            inventoryId: half.inventoryId,
            cardId: half.cardId,
            side: half.side,
            effectiveFruit: half.effectiveFruit,
            amount,
            countBefore: half.count,
            countAfter: (half.count - amount) as 0 | 1,
          })),
          inventoryChanges: { [source]: { from: sourceBefore, to: inventory[source] }, [target]: { from: targetBefore, to: inventory[target] } },
        });
      }
    }
  }

  const orderTotals = emptyTotals();
  const overloadedOrders: OrderEntry[] = [];
  const grapeOrderSet = new Set(grapeOrders);
  for (const order of validOrders) {
    const fruit = selectedFruit(order);
    const amount = supervisorOrders.has(order) ? 0 : grapeOrderSet.has(order) ? 1 : fruit.count;
    orderTotals[fruit.fruit] += amount;
    if (overloadedOrders.length === 0 && fruit.fruit !== protectedFruit && orderTotals[fruit.fruit] > inventory[fruit.fruit]) overloadedOrders.push(order);
  }

  const exceededFruits = FRUITS.filter((fruit) => fruit !== protectedFruit && orderTotals[fruit] > inventory[fruit]);
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
