import assert from "node:assert/strict";
import test from "node:test";
import { GORILLA_CARDS, VERIFIED_STRUCTURE_DEV_CARDS } from "./deck.js";
import {
  CURIOUS_MARKET_PLAYER_GORILLA_WEIGHT,
  createDeckForMode,
  drawWeightedInventoryCard,
  GAME_MODES,
} from "./modes.js";
import type { InventoryCard } from "./types.js";

function randomAt(value: number): () => number {
  return () => value;
}

test("curious-market default weight matches the dynamic deck's base gorilla probability", () => {
  const deck = createDeckForMode("curious-market");
  const fruits = deck.filter((card) => card.kind === "fruit").length;
  const firstGorillaBoundary = fruits / deck.length;

  assert.equal(CURIOUS_MARKET_PLAYER_GORILLA_WEIGHT, 1);
  assert.equal(GAME_MODES["curious-market"].playerGorillaWeight, 1);
  assert.equal(drawWeightedInventoryCard([...deck], 1, randomAt(firstGorillaBoundary - Number.EPSILON))?.kind, "fruit");
  assert.equal(drawWeightedInventoryCard([...deck], 1, randomAt(firstGorillaBoundary))?.kind, "gorilla");
});

test("increasing gorilla weight moves the exact category boundary", () => {
  const deck = createDeckForMode("curious-market");
  const fruits = deck.filter((card) => card.kind === "fruit").length;
  const weight = 3;
  const firstGorillaBoundary = fruits / (fruits + (deck.length - fruits) * weight);

  assert.equal(drawWeightedInventoryCard([...deck], weight, randomAt(firstGorillaBoundary - Number.EPSILON))?.kind, "fruit");
  assert.equal(drawWeightedInventoryCard([...deck], weight, randomAt(firstGorillaBoundary))?.kind, "gorilla");
  assert.equal(drawWeightedInventoryCard([...deck], 0, randomAt(0))?.kind, "fruit");
  assert.equal(drawWeightedInventoryCard([...GORILLA_CARDS], 0, randomAt(0))?.kind, "gorilla");
});

test("weighted draws remove cards in place without duplicates and conserve count", () => {
  const deck = createDeckForMode("curious-market");
  const originalIds = new Set(deck.map((card) => card.id));
  const drawn: InventoryCard[] = [];

  while (deck.length > 0) {
    const before = deck.length;
    const card = drawWeightedInventoryCard(deck, 4, randomAt(0.37));
    assert.ok(card);
    drawn.push(card);
    assert.equal(deck.length, before - 1);
  }

  assert.equal(drawn.length, originalIds.size);
  assert.equal(new Set(drawn.map((card) => card.id)).size, drawn.length);
  assert.deepEqual(new Set(drawn.map((card) => card.id)), originalIds);
  assert.equal(drawWeightedInventoryCard(deck, 4, randomAt(0)), undefined);
});

test("weighted draw rejects invalid algorithm inputs", () => {
  const deck = createDeckForMode("curious-market");

  for (const weight of [-0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.throws(() => drawWeightedInventoryCard([...deck], weight), RangeError);
  }
});

test("curious-market deck contains 28 fruit and 8 gorilla cards", () => {
  const curious = createDeckForMode("curious-market");

  assert.equal(curious.length, 36);
  assert.deepEqual(curious.filter((card) => card.kind === "gorilla").map((card) => card.gorilla), [
    "mitsuhiko", "moo", "nana", "grape-beadsmith", "order-swap-magician", "boxing-manager", "inventory-mover", "temporary-supervisor",
  ]);
});

test("classic deck remains the original 28 fruit and 3 classic gorilla cards", () => {
  const classic = createDeckForMode("classic");

  assert.equal(classic.length, VERIFIED_STRUCTURE_DEV_CARDS.length + 3);
  assert.deepEqual(classic.filter((card) => card.kind === "fruit"), VERIFIED_STRUCTURE_DEV_CARDS);
  assert.deepEqual(
    classic.filter((card) => card.kind === "gorilla").map((card) => card.gorilla),
    ["mitsuhiko", "moo", "nana"],
  );
  assert.equal(GAME_MODES.classic.playerGorillaWeight, undefined);
});
