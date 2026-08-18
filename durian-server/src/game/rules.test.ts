import assert from "node:assert/strict";
import test from "node:test";
import { calculateInventory, calculateOrders, isGameOver, nextPlayerId, takeLowestAngerToken } from "./rules.js";
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
