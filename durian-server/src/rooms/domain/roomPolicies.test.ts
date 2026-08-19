import assert from "node:assert/strict";
import test from "node:test";
import { MessageRateLimiter, normalizeNickname, PlayerTurnPolicy, RoomAccessPolicy, RoomPhase } from "./roomPolicies.js";

test("RoomPhase composes explicit phase transitions", () => {
  const phase = new RoomPhase();
  assert.equal(phase.is("lobby"), true);
  assert.equal(phase.enter("playing"), "playing");
  assert.equal(phase.is("playing", "resolving"), true);
});

test("PlayerTurnPolicy rotates only through online seats", () => {
  const policy = new PlayerTurnPolicy();
  const players = [{ id: "a", connected: true }, { id: "b", connected: false }, { id: "c", connected: true }];
  assert.equal(policy.nextOnline(players, "a"), "c");
  assert.equal(policy.nextOnline(players, "c"), "a");
  assert.equal(policy.canContinue(players), true);
  assert.equal(policy.canContinue(players.slice(0, 2)), false);
});

test("PlayerTurnPolicy preserves the successor when the current seat is removed", () => {
  const policy = new PlayerTurnPolicy();
  const players = [{ id: "a", connected: true }, { id: "b", connected: true }, { id: "c", connected: true }];
  assert.equal(policy.nextOnlineAfterRemoval(players, "b"), "c");
  assert.equal(policy.nextOnlineAfterRemoval(players, "c"), "a");
  assert.equal(policy.nextOnline([{ id: "a", connected: true }, { id: "c", connected: true }], "b"), "a");
});

test("RoomAccessPolicy requires a seat for host and turn actions", () => {
  const policy = new RoomAccessPolicy();
  assert.equal(policy.isHost(["host", "guest"], "host"), true);
  assert.equal(policy.isHost(["host", "guest"], "outsider"), false);
  assert.equal(policy.canAct(["host", "guest"], "guest", "guest"), true);
  assert.equal(policy.canAct(["host", "guest"], "outsider", "outsider"), false);
});

test("MessageRateLimiter conservatively rejects bursts", () => {
  const limiter = new MessageRateLimiter(2, 1_000);
  assert.equal(limiter.allow("a", 0), true);
  assert.equal(limiter.allow("a", 1), true);
  assert.equal(limiter.allow("a", 2), false);
  assert.equal(limiter.allow("a", 1_001), true);
});

test("normalizeNickname strips controls, folds whitespace, truncates, and falls back", () => {
  assert.equal(normalizeNickname("  A\n  B\u0000  ", "玩家"), "A B");
  assert.equal(normalizeNickname(" ", "玩家 1"), "玩家 1");
  assert.equal(normalizeNickname("x".repeat(30), "玩家"), "x".repeat(24));
});
