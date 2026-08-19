import assert from "node:assert/strict";
import test from "node:test";
import { calculateInventory, calculateOrders, isGameOver, nextPlayerId, takeLowestAngerToken } from "./rules.js";
import { createDeckForMode } from "./modes.js";
import type { FruitCard, GorillaCard, OrderEntry } from "./types.js";

const strawberryBanana: FruitCard = {
  id: "fruit-a", kind: "fruit",
  left: { fruit: "strawberry", count: 1 },
  right: { fruit: "banana", count: 2 },
};
const grapeDurian: FruitCard = {
  id: "fruit-b", kind: "fruit",
  left: { fruit: "grape", count: 1 },
  right: { fruit: "durian", count: 3 },
};
const moo: GorillaCard = { id: "gorilla-moo", kind: "gorilla", gorilla: "moo" };
const mitsuhiko: GorillaCard = { id: "gorilla-mitsuhiko", kind: "gorilla", gorilla: "mitsuhiko" };
const nana: GorillaCard = { id: "gorilla-nana", kind: "gorilla", gorilla: "nana" };
const beadsmith: GorillaCard = { id: "gorilla-grape-beadsmith", kind: "gorilla", gorilla: "grape-beadsmith" };
const magician: GorillaCard = { id: "gorilla-order-swap-magician", kind: "gorilla", gorilla: "order-swap-magician" };

function order(card: FruitCard, side: "left" | "right"): OrderEntry {
  return { cardId: card.id, playerId: "p1", side, card };
}

test("Moo contributes no fruit and otherwise does nothing", () => {
  assert.deepEqual(calculateInventory([strawberryBanana, grapeDurian, moo]), {
    strawberry: 1, banana: 2, grape: 1, durian: 3,
  });
});

test("inventory counts both sides of ordinary fruit cards", () => {
  assert.deepEqual(calculateInventory([strawberryBanana, grapeDurian]), {
    strawberry: 1, banana: 2, grape: 1, durian: 3,
  });
});

test("Mitsuhiko invalidates every order showing three fruits", () => {
  const result = calculateOrders([order(grapeDurian, "right"), order(strawberryBanana, "right")], [strawberryBanana, mitsuhiko]);
  assert.equal(result.invalidOrders.length, 1);
  assert.equal(result.orders.durian, 0);
  assert.equal(result.orders.banana, 2);
});

test("Nana invalidates every banana order", () => {
  const result = calculateOrders([order(strawberryBanana, "right"), order(grapeDurian, "left")], [strawberryBanana, nana]);
  assert.equal(result.invalidOrders.length, 1);
  assert.equal(result.orders.banana, 0);
  assert.equal(result.orders.grape, 1);
});

test("overstock is strict greater-than, equality is safe", () => {
  const safe = calculateOrders([order(strawberryBanana, "right")], [strawberryBanana]);
  assert.equal(safe.overstocked, false);
  const bad = calculateOrders([order(strawberryBanana, "right"), order(strawberryBanana, "right")], [strawberryBanana]);
  assert.equal(bad.overstocked, true);
  assert.deepEqual(bad.exceededFruits, ["banana"]);
  assert.equal(bad.overloadedOrders.length, 1);
  assert.equal(bad.overloadedOrders[0]?.cardId, "fruit-a");
});

test("marks the first order that crosses the inventory total", () => {
  const result = calculateOrders([
    order(grapeDurian, "left"),
    order(strawberryBanana, "right"),
    order(grapeDurian, "right"),
    order(strawberryBanana, "right"),
  ], [strawberryBanana, grapeDurian]);
  assert.deepEqual(result.exceededFruits, ["banana"]);
  assert.equal(result.overloadedOrders.length, 1);
  assert.equal(result.overloadedOrders[0]?.cardId, "fruit-a");
});

test("anger token and clockwise next player are deterministic", () => {
  assert.equal(takeLowestAngerToken([4, 1, 6]), 1);
  assert.equal(nextPlayerId(["p1", "p2", "p3"], "p2"), "p3");
});

test("anger at 7 or above ends the game", () => {
  assert.equal(isGameOver(6), false);
  assert.equal(isGameOver(7), true);
  assert.equal(isGameOver(9), true);
});

test("mode decks keep classic unchanged and add exactly two curious gorillas", () => {
  assert.equal(createDeckForMode("classic").length, 31);
  assert.deepEqual(createDeckForMode("classic").filter((card) => card.kind === "gorilla").map((card) => card.gorilla), ["mitsuhiko", "moo", "nana"]);
  assert.equal(createDeckForMode("curious-market").length, 33);
  assert.deepEqual(createDeckForMode("curious-market").filter((card) => card.kind === "gorilla").map((card) => card.gorilla), ["mitsuhiko", "moo", "nana", "grape-beadsmith", "order-swap-magician"]);
});

test("curious effects run in fixed order and only count still-valid grape orders as one", () => {
  const grapeThree: FruitCard = { id: "grape-three", kind: "fruit", left: { fruit: "banana", count: 1 }, right: { fruit: "grape", count: 3 } };
  const bananaTwo: FruitCard = { id: "banana-two", kind: "fruit", left: { fruit: "strawberry", count: 1 }, right: { fruit: "banana", count: 2 } };
  const grapeTwo: FruitCard = { id: "grape-two", kind: "fruit", left: { fruit: "strawberry", count: 1 }, right: { fruit: "grape", count: 2 } };
  const result = calculateOrders([order(grapeThree, "right"), order(bananaTwo, "right"), order(grapeTwo, "right")], [strawberryBanana, grapeDurian, mitsuhiko, nana, beadsmith, magician]);

  assert.deepEqual(result.invalidOrders.map((item) => item.cardId), ["grape-three", "banana-two"]);
  assert.equal(result.orders.grape, 1);
  assert.deepEqual(result.baseInventory, { strawberry: 1, banana: 2, grape: 1, durian: 3 });
  assert.deepEqual(result.inventory, { strawberry: 1, banana: 2, grape: 1, durian: 3 });
  assert.deepEqual(result.explanations.map((item) => item.effect), ["mitsuhiko", "nana", "grape-beadsmith", "order-swap-magician"]);
  assert.deepEqual(result.explanations[0], { effect: "mitsuhiko", summary: "三果判官·米奇使数量为 3 的订单无效", affectedOrderCardIds: ["grape-three"] });
  assert.deepEqual(result.explanations[1], { effect: "nana", summary: "香蕉克星·汉娜使香蕉订单无效", affectedOrderCardIds: ["banana-two"] });
  assert.deepEqual(result.explanations[2], { effect: "grape-beadsmith", summary: "葡萄珠匠·紫罗让每张仍有效的葡萄订单按 1 计算", orderChanges: [{ cardId: "grape-two", from: 2, to: 1 }] });
  assert.deepEqual(result.explanations[3], {
    effect: "order-swap-magician",
    summary: "换位魔术师·莫比交换草莓与葡萄库存总数，订单不变",
    inventoryChanges: { strawberry: { from: 1, to: 1 }, grape: { from: 1, to: 1 } },
  });
});

test("swap magician exchanges inventory totals without mutating input or accumulating on repeated settlement", () => {
  const strawberryHeavy: FruitCard = { id: "strawberry-heavy", kind: "fruit", left: { fruit: "grape", count: 1 }, right: { fruit: "strawberry", count: 3 } };
  const cards = [strawberryHeavy, magician];
  const first = calculateOrders([order(strawberryHeavy, "left")], cards);
  const second = calculateOrders([order(strawberryHeavy, "left")], cards);

  assert.deepEqual(first.baseInventory, { strawberry: 3, banana: 0, grape: 1, durian: 0 });
  assert.deepEqual(first.inventory, { strawberry: 1, banana: 0, grape: 3, durian: 0 });
  assert.deepEqual(first.explanations[0], {
    effect: "order-swap-magician",
    summary: "换位魔术师·莫比交换草莓与葡萄库存总数，订单不变",
    inventoryChanges: { strawberry: { from: 3, to: 1 }, grape: { from: 1, to: 3 } },
  });
  assert.deepEqual(second, first);
  assert.deepEqual(calculateInventory(cards), first.baseInventory);
});
