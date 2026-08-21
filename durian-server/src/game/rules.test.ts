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
const boxingManager: GorillaCard = { id: "gorilla-boxing-manager", kind: "gorilla", gorilla: "boxing-manager" };
const inventoryMover: GorillaCard = { id: "gorilla-inventory-mover", kind: "gorilla", gorilla: "inventory-mover" };
const temporarySupervisor: GorillaCard = { id: "gorilla-temporary-supervisor", kind: "gorilla", gorilla: "temporary-supervisor" };

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

test("boxing manager protects only the first stable minimum, including zero inventory", () => {
  const result = calculateOrders([order(strawberryBanana, "left"), order(strawberryBanana, "right")], [boxingManager]);
  assert.equal(result.overstocked, true);
  assert.deepEqual(result.orders, { strawberry: 1, banana: 2, grape: 0, durian: 0 });
  assert.deepEqual(result.exceededFruits, ["banana"]);
  assert.equal(result.overloadedOrders[0]?.cardId, "fruit-a");
  assert.deepEqual(result.explanations[0], {
    effect: "boxing-manager",
    summary: "封箱经理·克莱德按初始库存保护整种最低库存水果；并列取固定顺序第一项，库存为 0 仍不触发爆单",
    affectedFruits: ["strawberry"],
  });
});

test("boxing manager protects strawberry before grape when their inventory ties", () => {
  const strawberryOrders = [order(strawberryBanana, "left"), order(strawberryBanana, "left"), order(strawberryBanana, "left")];
  const result = calculateOrders(strawberryOrders, [strawberryBanana, grapeDurian, boxingManager]);
  assert.deepEqual(result.baseInventory, { strawberry: 1, banana: 2, grape: 1, durian: 3 });
  assert.deepEqual(result.explanations[0], {
    effect: "boxing-manager",
    summary: "封箱经理·克莱德按初始库存保护整种最低库存水果；并列取固定顺序第一项，库存为 0 仍不触发爆单",
    affectedFruits: ["strawberry"],
  });
  assert.equal(result.overstocked, false);
  assert.deepEqual(result.exceededFruits, []);
  assert.equal(result.overloadedOrders.length, 0);
});

test("inventory mover reports a two-fruit transfer and stays silent when blocked", () => {
  const heavy: FruitCard = { id: "heavy", kind: "fruit", left: { fruit: "strawberry", count: 1 }, right: { fruit: "banana", count: 2 } };
  const result = calculateOrders([], [heavy, grapeDurian, inventoryMover]);
  assert.deepEqual(result.inventory, { strawberry: 3, banana: 2, grape: 1, durian: 1 });
  assert.deepEqual(result.explanations[0], {
    effect: "inventory-mover",
    summary: "库存搬运工·巴鲁避开克莱德保护的水果，从合格的最高有效库存实例搬运 2 个到最低库存",
    sourceFruit: "durian",
    targetFruit: "strawberry",
    amount: 2,
    actor: { inventoryId: "2", card: inventoryMover },
    sources: [{ inventoryId: "1", cardId: "fruit-b", side: "right", effectiveFruit: "durian", amount: 2, countBefore: 3, countAfter: 1 }],
    inventoryChanges: { durian: { from: 3, to: 1 }, strawberry: { from: 1, to: 3 } },
  });
  assert.deepEqual(calculateOrders([], [inventoryMover]).explanations, []);
});

test("inventory mover uses stable 2, then 3, then 1+1 instance priority and preserves inputs", () => {
  const two: FruitCard = { id: "two", kind: "fruit", left: { fruit: "banana", count: 2 }, right: { fruit: "durian", count: 1 } };
  const three: FruitCard = { id: "three", kind: "fruit", left: { fruit: "banana", count: 3 }, right: { fruit: "durian", count: 1 } };
  const oneA: FruitCard = { id: "one-a", kind: "fruit", left: { fruit: "banana", count: 1 }, right: { fruit: "durian", count: 1 } };
  const oneB: FruitCard = { id: "one-b", kind: "fruit", left: { fruit: "banana", count: 1 }, right: { fruit: "durian", count: 1 } };
  const slots = [{ inventoryId: "p1", card: two }, { inventoryId: "p2", card: three }, { inventoryId: "p3", card: oneA }, { inventoryId: "p4", card: oneB }, { inventoryId: "actor", card: inventoryMover }];
  const first = calculateOrders([], slots);
  const firstMover = first.explanations.at(-1);
  assert.deepEqual(firstMover?.effect === "inventory-mover" ? firstMover.sources : [], [{ inventoryId: "p1", cardId: "two", side: "left", effectiveFruit: "banana", amount: 2, countBefore: 2, countAfter: 0 }]);
  assert.deepEqual(calculateOrders([], slots), first);
  assert.equal(two.left.count, 2);

  const fromThree = calculateOrders([], slots.slice(1));
  const threeMover = fromThree.explanations.at(-1);
  assert.deepEqual(threeMover?.effect === "inventory-mover" ? threeMover.sources : [], [{ inventoryId: "p2", cardId: "three", side: "left", effectiveFruit: "banana", amount: 2, countBefore: 3, countAfter: 1 }]);
  const singles = calculateOrders([], slots.slice(2));
  const singlesMover = singles.explanations.at(-1);
  assert.deepEqual(singlesMover?.effect === "inventory-mover" ? singlesMover.sources : [], [
    { inventoryId: "p3", cardId: "one-a", side: "left", effectiveFruit: "banana", amount: 1, countBefore: 1, countAfter: 0 },
    { inventoryId: "p4", cardId: "one-b", side: "left", effectiveFruit: "banana", amount: 1, countBefore: 1, countAfter: 0 },
  ]);
});

test("inventory mover excludes protected highest, supports dummy actor, Mobius effective fruit, and silent boundaries", () => {
  const strawberryLow: FruitCard = { id: "strawberry-low", kind: "fruit", left: { fruit: "strawberry", count: 1 }, right: { fruit: "strawberry", count: 1 } };
  const grapeHigh: FruitCard = { id: "grape-high", kind: "fruit", left: { fruit: "grape", count: 3 }, right: { fruit: "grape", count: 3 } };
  const nextHigh: FruitCard = { id: "next-high", kind: "fruit", left: { fruit: "banana", count: 2 }, right: { fruit: "banana", count: 2 } };
  const durian: FruitCard = { id: "durian", kind: "fruit", left: { fruit: "durian", count: 2 }, right: { fruit: "durian", count: 1 } };
  const result = calculateOrders([], [
    { inventoryId: "low", card: strawberryLow }, { inventoryId: "transformed-high", card: grapeHigh }, { inventoryId: "next", card: nextHigh }, { inventoryId: "durian", card: durian },
    { inventoryId: "mobius", card: magician }, { inventoryId: "box", card: boxingManager }, { inventoryId: "__dummy_inventory__", card: inventoryMover },
  ]);
  const mover = result.explanations.find((item) => item.effect === "inventory-mover");
  const boxing = result.explanations.find((item) => item.effect === "boxing-manager");
  assert.deepEqual(boxing?.effect === "boxing-manager" ? boxing.affectedFruits : [], ["strawberry"]);
  assert.equal(mover?.effect === "inventory-mover" ? mover.sourceFruit : undefined, "banana");
  assert.deepEqual(mover?.effect === "inventory-mover" ? mover.actor : undefined, { inventoryId: "__dummy_inventory__", card: inventoryMover });
  assert.deepEqual(mover?.effect === "inventory-mover" ? mover.sources : undefined, [{ inventoryId: "next", cardId: "next-high", side: "left", effectiveFruit: "banana", amount: 2, countBefore: 2, countAfter: 0 }]);

  const grapeTwo: FruitCard = { id: "grape-two-source", kind: "fruit", left: { fruit: "grape", count: 2 }, right: { fruit: "durian", count: 1 } };

  const swapped = calculateOrders([], [{ inventoryId: "source", card: grapeTwo }, { inventoryId: "mobius", card: magician }, { inventoryId: "actor", card: inventoryMover }]);
  const swappedMover = swapped.explanations.find((item) => item.effect === "inventory-mover");
  assert.deepEqual(swappedMover?.effect === "inventory-mover" ? swappedMover.sources : undefined, [{ inventoryId: "source", cardId: "grape-two-source", side: "left", effectiveFruit: "strawberry", amount: 2, countBefore: 2, countAfter: 0 }]);

  const oneOnly: FruitCard = { id: "one-only", kind: "fruit", left: { fruit: "banana", count: 1 }, right: { fruit: "durian", count: 1 } };
  assert.deepEqual(calculateOrders([], [oneOnly, inventoryMover]).explanations, []);
  const allEqual: FruitCard = { id: "equal", kind: "fruit", left: { fruit: "strawberry", count: 2 }, right: { fruit: "banana", count: 2 } };
  const allEqual2: FruitCard = { id: "equal-2", kind: "fruit", left: { fruit: "grape", count: 2 }, right: { fruit: "durian", count: 2 } };
  assert.deepEqual(calculateOrders([], [allEqual, allEqual2, inventoryMover]).explanations, []);
});

test("Finn locks each fruit's first original order before Mitsuhiko, Nana, and Violet", () => {
  const grapeThree: FruitCard = { id: "first-grape-three", kind: "fruit", left: { fruit: "strawberry", count: 1 }, right: { fruit: "grape", count: 3 } };
  const bananaThree: FruitCard = { id: "first-banana-three", kind: "fruit", left: { fruit: "strawberry", count: 1 }, right: { fruit: "banana", count: 3 } };
  const result = calculateOrders([
    order(grapeThree, "right"),
    order(bananaThree, "right"),
  ], [strawberryBanana, temporarySupervisor, mitsuhiko, nana, beadsmith]);

  assert.deepEqual(result.orders, { strawberry: 0, banana: 0, grape: 0, durian: 0 });
  assert.deepEqual(result.validOrders.map((item) => item.cardId), ["first-grape-three", "first-banana-three"]);
  assert.deepEqual(result.invalidOrders, []);
  assert.deepEqual(result.explanations.map((item) => item.effect), ["temporary-supervisor", "mitsuhiko", "nana", "grape-beadsmith"]);
  assert.deepEqual(result.explanations[0], {
    effect: "temporary-supervisor",
    summary: "临时主管·菲恩使每种水果按原顺序的第一张订单计 0，并锁定该订单不再处理后续订单效果",
    orderChanges: [
      { cardId: "first-grape-three", fruit: "grape", from: 3, to: 0 },
      { cardId: "first-banana-three", fruit: "banana", from: 3, to: 0 },
    ],
  });
  assert.deepEqual(result.explanations.slice(1).map((item) => "affectedOrderCardIds" in item ? item.affectedOrderCardIds : "orderChanges" in item ? item.orderChanges : null), [[], [], []]);
});

test("Mitsuhiko locks matching orders before Nana and Violet", () => {
  const bananaThree: FruitCard = { id: "banana-three", kind: "fruit", left: { fruit: "strawberry", count: 1 }, right: { fruit: "banana", count: 3 } };
  const grapeThree: FruitCard = { id: "grape-three-lock", kind: "fruit", left: { fruit: "strawberry", count: 1 }, right: { fruit: "grape", count: 3 } };
  const result = calculateOrders([order(bananaThree, "right"), order(grapeThree, "right")], [mitsuhiko, nana, beadsmith]);

  assert.deepEqual(result.invalidOrders.map((item) => item.cardId), ["banana-three", "grape-three-lock"]);
  assert.deepEqual(result.validOrders, []);
  assert.deepEqual(result.explanations[0], { effect: "mitsuhiko", summary: "三果判官·米奇使尚未锁定且数量为 3 的订单无效", affectedOrderCardIds: ["banana-three", "grape-three-lock"] });
  assert.deepEqual(result.explanations[1], { effect: "nana", summary: "香蕉克星·汉娜使尚未锁定的香蕉订单无效", affectedOrderCardIds: [] });
  assert.deepEqual(result.explanations[2], { effect: "grape-beadsmith", summary: "葡萄珠匠·紫罗让尚未锁定且仍有效的葡萄订单按 1 计算", orderChanges: [] });
});

test("later orders of the same fruit continue through the effect chain", () => {
  const bananaThree: FruitCard = { id: "banana-first", kind: "fruit", left: { fruit: "strawberry", count: 1 }, right: { fruit: "banana", count: 3 } };
  const bananaTwo: FruitCard = { id: "banana-later", kind: "fruit", left: { fruit: "strawberry", count: 1 }, right: { fruit: "banana", count: 2 } };
  const grapeThree: FruitCard = { id: "grape-first", kind: "fruit", left: { fruit: "strawberry", count: 1 }, right: { fruit: "grape", count: 3 } };
  const grapeTwo: FruitCard = { id: "grape-later", kind: "fruit", left: { fruit: "strawberry", count: 1 }, right: { fruit: "grape", count: 2 } };
  const result = calculateOrders([
    order(bananaThree, "right"), order(bananaTwo, "right"), order(grapeThree, "right"), order(grapeTwo, "right"),
  ], [temporarySupervisor, mitsuhiko, nana, beadsmith]);

  assert.deepEqual(result.invalidOrders.map((item) => item.cardId), ["banana-later"]);
  assert.deepEqual(result.validOrders.map((item) => item.cardId), ["banana-first", "grape-first", "grape-later"]);
  assert.deepEqual(result.orders, { strawberry: 0, banana: 0, grape: 1, durian: 0 });
  assert.deepEqual(result.explanations[3], {
    effect: "grape-beadsmith",
    summary: "葡萄珠匠·紫罗让尚未锁定且仍有效的葡萄订单按 1 计算",
    orderChanges: [{ cardId: "grape-later", from: 2, to: 1 }],
  });
});

test("the four order effects target mutually exclusive order instances", () => {
  const strawberryTwo: FruitCard = { id: "finn-only", kind: "fruit", left: { fruit: "strawberry", count: 2 }, right: { fruit: "durian", count: 1 } };
  const grapeThree: FruitCard = { id: "mickey-only", kind: "fruit", left: { fruit: "grape", count: 3 }, right: { fruit: "durian", count: 1 } };
  const bananaTwo: FruitCard = { id: "nana-only", kind: "fruit", left: { fruit: "banana", count: 2 }, right: { fruit: "durian", count: 1 } };
  const grapeTwo: FruitCard = { id: "violet-only", kind: "fruit", left: { fruit: "grape", count: 2 }, right: { fruit: "durian", count: 1 } };
  const result = calculateOrders([
    order(strawberryTwo, "left"), order(grapeThree, "left"), order(bananaTwo, "left"), order(grapeTwo, "left"),
  ], [temporarySupervisor, mitsuhiko, nana, beadsmith]);
  const targets = result.explanations.flatMap((item) => item.effect === "temporary-supervisor" || item.effect === "grape-beadsmith"
    ? item.orderChanges.map((change) => change.cardId)
    : item.effect === "mitsuhiko" || item.effect === "nana" ? item.affectedOrderCardIds : []);

  assert.deepEqual(targets, ["finn-only", "mickey-only", "nana-only", "violet-only"]);
  assert.equal(new Set(targets).size, targets.length);
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

test("mode decks keep classic unchanged and curious-market has eight gorillas", () => {
  assert.equal(createDeckForMode("classic").length, 31);
  assert.deepEqual(createDeckForMode("classic").filter((card) => card.kind === "gorilla").map((card) => card.gorilla), ["mitsuhiko", "moo", "nana"]);
  assert.equal(createDeckForMode("curious-market").length, 36);
  assert.deepEqual(createDeckForMode("curious-market").filter((card) => card.kind === "gorilla").map((card) => card.gorilla), ["mitsuhiko", "moo", "nana", "grape-beadsmith", "order-swap-magician", "boxing-manager", "inventory-mover", "temporary-supervisor"]);
});

test("all seven effects keep fixed order and produce the final structured result", () => {
  const grapeThree: FruitCard = { id: "grape-three", kind: "fruit", left: { fruit: "banana", count: 1 }, right: { fruit: "grape", count: 3 } };
  const grapeTwo: FruitCard = { id: "grape-two", kind: "fruit", left: { fruit: "strawberry", count: 1 }, right: { fruit: "grape", count: 2 } };
  const bananaOne: FruitCard = { id: "banana-one", kind: "fruit", left: { fruit: "banana", count: 1 }, right: { fruit: "strawberry", count: 1 } };
  const bananaTwo: FruitCard = { id: "banana-two", kind: "fruit", left: { fruit: "strawberry", count: 1 }, right: { fruit: "banana", count: 2 } };
  const durianTwo: FruitCard = { id: "durian-two", kind: "fruit", left: { fruit: "banana", count: 1 }, right: { fruit: "durian", count: 2 } };
  const result = calculateOrders([
    order(grapeThree, "right"), order(grapeThree, "right"), order(grapeTwo, "right"),
    order(bananaOne, "left"), order(bananaTwo, "right"), order(durianTwo, "right"), order(durianTwo, "right"),
  ], [strawberryBanana, grapeDurian, mitsuhiko, nana, beadsmith, magician, inventoryMover, boxingManager, temporarySupervisor]);

  assert.deepEqual(result.invalidOrders.map((item) => item.cardId), ["grape-three", "banana-two"]);
  assert.deepEqual(result.validOrders.map((item) => item.cardId), ["grape-three", "grape-two", "banana-one", "durian-two", "durian-two"]);
  assert.deepEqual(result.baseInventory, { strawberry: 1, banana: 2, grape: 1, durian: 3 });
  assert.deepEqual(result.inventory, { strawberry: 3, banana: 2, grape: 1, durian: 1 });
  assert.deepEqual(result.orders, { strawberry: 0, banana: 0, grape: 1, durian: 2 });
  assert.deepEqual(result.exceededFruits, ["durian"]);
  assert.equal(result.overstocked, true);
  assert.equal(result.overloadedOrders[0]?.cardId, "durian-two");
  assert.deepEqual(result.explanations.map((item) => item.effect), ["temporary-supervisor", "mitsuhiko", "nana", "grape-beadsmith", "order-swap-magician", "boxing-manager", "inventory-mover"]);
  assert.deepEqual(result.explanations[0], {
    effect: "temporary-supervisor",
    summary: "临时主管·菲恩使每种水果按原顺序的第一张订单计 0，并锁定该订单不再处理后续订单效果",
    orderChanges: [
      { cardId: "grape-three", fruit: "grape", from: 3, to: 0 },
      { cardId: "banana-one", fruit: "banana", from: 1, to: 0 },
      { cardId: "durian-two", fruit: "durian", from: 2, to: 0 },
    ],
  });
  assert.deepEqual(result.explanations[1], { effect: "mitsuhiko", summary: "三果判官·米奇使尚未锁定且数量为 3 的订单无效", affectedOrderCardIds: ["grape-three"] });
  assert.deepEqual(result.explanations[2], { effect: "nana", summary: "香蕉克星·汉娜使尚未锁定的香蕉订单无效", affectedOrderCardIds: ["banana-two"] });
  assert.deepEqual(result.explanations[3], { effect: "grape-beadsmith", summary: "葡萄珠匠·紫罗让尚未锁定且仍有效的葡萄订单按 1 计算", orderChanges: [{ cardId: "grape-two", from: 2, to: 1 }] });
  assert.deepEqual(result.explanations[5], { effect: "boxing-manager", summary: "封箱经理·克莱德按初始库存保护整种最低库存水果；并列取固定顺序第一项，库存为 0 仍不触发爆单", affectedFruits: ["strawberry"] });
  assert.deepEqual(result.explanations[6], {
    effect: "inventory-mover",
    summary: "库存搬运工·巴鲁避开克莱德保护的水果，从合格的最高有效库存实例搬运 2 个到最低库存",
    sourceFruit: "durian", targetFruit: "strawberry", amount: 2,
    actor: { inventoryId: "6", card: inventoryMover },
    sources: [{ inventoryId: "1", cardId: "fruit-b", side: "right", effectiveFruit: "durian", amount: 2, countBefore: 3, countAfter: 1 }],
    inventoryChanges: { durian: { from: 3, to: 1 }, strawberry: { from: 1, to: 3 } },
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
    summary: "换位魔术师·莫比交换草莓与葡萄的有效库存归属，订单与原库存卡不变",
    inventoryChanges: { strawberry: { from: 3, to: 1 }, grape: { from: 1, to: 3 } },
  });
  assert.deepEqual(second, first);
  assert.deepEqual(calculateInventory(cards), first.baseInventory);
});
