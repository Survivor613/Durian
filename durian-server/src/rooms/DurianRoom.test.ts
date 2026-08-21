import assert from "node:assert/strict";
import test from "node:test";
import type { Client } from "colyseus";
import { calculateOrders } from "../game/rules.js";
import type { InventoryCard } from "../game/types.js";
import { RoundPhrasePolicy } from "./domain/roundPhrasePolicy.js";
import { DurianRoom } from "./DurianRoom.js";

type TestRoom = Record<string, any> & { state: DurianRoom["state"]; clients: DurianRoom["clients"]; clock: DurianRoom["clock"]; onCreate: DurianRoom["onCreate"]; onJoin: DurianRoom["onJoin"]; onLeave: DurianRoom["onLeave"] };
type TestClient = Client & { sent: Array<{ type: string; payload: unknown }> };

function client(sessionId: string, clientId = sessionId): TestClient {
  const sent: Array<{ type: string; payload: unknown }> = [];
  return {
    sessionId,
    userData: { clientId },
    sent,
    send(type: string, payload: unknown) { sent.push({ type, payload }); },
  } as unknown as TestClient;
}

function roomWith(...clients: TestClient[]): TestRoom {
  const room = new DurianRoom() as unknown as TestRoom;
  room.setMetadata = async () => undefined;
  room.lock = async () => undefined;
  room.unlock = async () => undefined;
  room.broadcast = () => undefined;
  room.clients.push(...clients);
  room.onCreate();
  for (const member of clients) room.onJoin(member, { name: member.sessionId, clientId: member.userData.clientId });
  return room;
}

function startRound(room: TestRoom, starterId: string) {
  room.startRound(starterId);
  assert.equal(room.state.phase, "playing");
}

test("chat broadcasts every supported emote", () => {
  for (const emote of ["mitsuhiko", "moo", "nana", "grape-beadsmith", "order-swap-magician", "boxing-manager", "inventory-mover", "temporary-supervisor"]) {
    const member = client(`${emote}-player`);
    const room = roomWith(member);
    const messages: Array<Record<string, unknown>> = [];
    room.broadcast = (type: string, payload: Record<string, unknown>) => { if (type === "chat") messages.push(payload); };
    const before = Date.now();

    room.chat(member, { text: "  hello  ", emote });

    assert.equal(messages.length, 1);
    assert.equal(messages[0].playerId, member.sessionId);
    assert.equal(messages[0].name, room.state.players[0].name);
    assert.equal(messages[0].text, "hello");
    assert.equal(messages[0].emote, emote);
    assert.equal(typeof messages[0].ts, "number");
    assert.ok((messages[0].ts as number) >= before && (messages[0].ts as number) <= Date.now());
  }
});

test("chat rejects retired emotion emotes", () => {
  for (const emote of ["sad", "angry", "chill", "faint"]) {
    const member = client(`retired-${emote}`);
    const room = roomWith(member);
    let broadcasts = 0;
    room.broadcast = () => { broadcasts += 1; };

    room.chat(member, { emote });

    assert.equal(broadcasts, 0);
  }
});

test("invalid chat messages do not consume the rate limit", () => {
  const member = client("invalid-first");
  const room = roomWith(member);
  const messages: Array<Record<string, unknown>> = [];
  room.broadcast = (type: string, payload: Record<string, unknown>) => { if (type === "chat") messages.push(payload); };

  for (let index = 0; index < 8; index += 1) room.chat(member, { text: "   ", emote: "unknown" });
  for (let index = 0; index < 5; index += 1) room.chat(member, { text: `message-${index}` });

  assert.equal(messages.length, 5);
  assert.equal(member.sent.some(({ type }) => type === "action_error"), false);
});

test("chat rate limits the sixth valid message in five seconds", () => {
  const member = client("fast-writer");
  const room = roomWith(member);
  const messages: Array<Record<string, unknown>> = [];
  room.broadcast = (type: string, payload: Record<string, unknown>) => { if (type === "chat") messages.push(payload); };

  for (let index = 0; index < 6; index += 1) room.chat(member, { text: `message-${index}` });

  assert.equal(messages.length, 5);
  assert.deepEqual(member.sent.at(-1), { type: "action_error", payload: { message: "消息发送过快，请稍后再试" } });
});

test("chat trims and caps text at the shared 120-character contract", () => {
  const member = client("writer");
  const room = roomWith(member);
  const messages: Array<Record<string, unknown>> = [];
  room.broadcast = (type: string, payload: Record<string, unknown>) => { if (type === "chat") messages.push(payload); };

  room.chat(member, { text: `  ${"字".repeat(130)}  ` });

  assert.equal(messages.length, 1);
  assert.equal(messages[0].text, "字".repeat(120));
});

test("round phrase broadcasts a complete server-owned payload without chat", () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);
  startRound(room, "host");
  room.setPhase("resolving");
  const broadcasts: Array<{ type: string; payload: Record<string, unknown> }> = [];
  room.broadcast = (type: string, payload: Record<string, unknown>) => { broadcasts.push({ type, payload }); };
  const before = Date.now();

  room.roundPhrase(guest, { phraseId: "interesting" });

  assert.equal(broadcasts.length, 1);
  assert.equal(broadcasts[0].type, "round_phrase");
  assert.deepEqual({ ...broadcasts[0].payload, sentAt: 0, eventId: "event" }, { playerId: "guest", round: 1, phraseId: "interesting", text: "有点意思", sentAt: 0, eventId: "event" });
  assert.ok((broadcasts[0].payload.sentAt as number) >= before && (broadcasts[0].payload.sentAt as number) <= Date.now());
  assert.equal((broadcasts[0].payload.eventId as string).startsWith("1:guest:"), true);
  assert.equal(broadcasts.some(({ type }) => type === "chat"), false);
});

test("round phrase allows only one phrase per player each round and resets next round", () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);
  startRound(room, "host");
  room.setPhase("resolving");
  const broadcasts: string[] = [];
  room.broadcast = (type: string) => { if (type === "round_phrase") broadcasts.push(type); };

  room.roundPhrase(guest, { phraseId: "interesting" });
  room.roundPhrase(guest, { phraseId: "did-we-win" });
  assert.deepEqual(broadcasts, ["round_phrase"]);
  assert.deepEqual(guest.sent.at(-1), { type: "action_error", payload: { message: "本轮已经发过一句话" } });

  startRound(room, "host");
  room.setPhase("resolving");
  room.roundPhrase(guest, { phraseId: "interesting" });
  assert.deepEqual(broadcasts, ["round_phrase", "round_phrase"]);
});

test("round phrase gorilla phrases require a gorilla inventory", () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);
  startRound(room, "host");
  room.setPhase("resolving");
  const broadcasts: string[] = [];
  room.broadcast = (type: string) => { if (type === "round_phrase") broadcasts.push(type); };
  room.inventories.set(guest.sessionId, { id: "fruit-test", kind: "fruit", left: { fruit: "banana", count: 1 }, right: { fruit: "durian", count: 1 } });

  room.roundPhrase(guest, { phraseId: "gorilla-called-it" });
  assert.deepEqual(guest.sent.at(-1), { type: "action_error", payload: { message: "这句短语不适用于你当前的结算身份" } });
  assert.equal(broadcasts.length, 0);

  room.inventories.set(guest.sessionId, { id: "gorilla-test", kind: "gorilla", gorilla: "moo" });
  room.roundPhrase(guest, { phraseId: "gorilla-called-it" });
  assert.deepEqual(broadcasts, ["round_phrase"]);
});

test("round phrase policy selects all four identity catalogs", () => {
  const policy = new RoundPhrasePolicy();
  assert.equal(policy.canUse("pressure", false, false), true);
  assert.equal(policy.canUse("gorilla-woo", true, false), true);
  assert.equal(policy.canUse("ran-it-for-you", false, true), true);
  assert.equal(policy.canUse("what-was-that", true, true), true);
  assert.equal(policy.canUse("gorilla-woo", false, false), false);
  assert.equal(policy.canUse("ran-it-for-you", false, false), false);
  assert.equal(policy.canUse("what-was-that", true, false), false);
});

test("round phrase rejects malformed payloads, outsiders, and non-settlement phases", () => {
  const host = client("host");
  const guest = client("guest");
  const outsider = client("outsider");
  const room = roomWith(host, guest);
  startRound(room, "host");
  let broadcasts = 0;
  room.broadcast = () => { broadcasts += 1; };

  room.roundPhrase(outsider, { phraseId: "interesting" });
  room.roundPhrase(guest, { phraseId: "interesting" });
  assert.deepEqual(outsider.sent.at(-1), { type: "action_error", payload: { message: "你不是房间成员" } });
  assert.deepEqual(guest.sent.at(-1), { type: "action_error", payload: { message: "当前阶段不能发送快捷短句" } });

  room.setPhase("resolving");
  for (const payload of [null, [], "interesting", {}, { phraseId: 1 }, { phraseId: "unknown" }, { phraseId: "interesting", text: "伪造文本" }]) room.roundPhrase(guest, payload);
  assert.equal(broadcasts, 0);
  assert.equal(guest.sent.filter(({ type }) => type === "action_error").length, 8);
});

test("round phrase cache is resent on request and reconnect", () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);
  startRound(room, "host");
  room.setPhase("resolving");
  room.broadcast = () => undefined;
  room.roundPhrase(host, { phraseId: "interesting" });
  room.roundPhrase(guest, { phraseId: "interesting" });
  guest.sent.length = 0;

  room.sendRoundPhrasesTo(guest);
  assert.equal(guest.sent.filter(({ type }) => type === "round_phrase").length, 2);

  guest.sent.length = 0;
  room.onReconnect(guest);
  assert.equal(guest.sent.filter(({ type }) => type === "round_phrase").length, 2);
});

test("onLeave clears a pending choice and advances from the removed seat", () => {
  const a = client("a");
  const b = client("b");
  const c = client("c");
  const room = roomWith(a, b, c);
  startRound(room, "b");
  const pending: InventoryCard = { id: "fruit-test", kind: "fruit", left: { fruit: "banana", count: 1 }, right: { fruit: "strawberry", count: 2 } };
  room.pendingCard = pending;
  room.state.pendingCardId = pending.id;
  room.state.pendingCardKind = "fruit";
  room.setPhase("choosing_order");

  room.onLeave(b);

  assert.equal(room.state.phase, "playing");
  assert.equal(room.state.currentPlayerId, "c");
  assert.equal(room.state.pendingCardId, "");
  assert.equal(room.pendingCard, null);
  assert.deepEqual([...room.state.players].map((player: { id: string }) => player.id), ["a", "c"]);
});

test("duplicate clientId rejects the new join without removing the old seat", () => {
  const original = client("old", "same-client");
  const room = roomWith(original);
  const duplicate = client("new", "same-client");
  room.clients.push(duplicate);

  assert.throws(() => room.onJoin(duplicate, { name: "new", clientId: "same-client" }), /该客户端已在房间中/);
  assert.deepEqual([...room.state.players].map((player: { id: string }) => player.id), ["old"]);
  assert.equal(room.state.players[0].connected, true);
});

test("ring settlement keeps reveal inventories unchanged while explanation carries Map keys", () => {
  const a = client("a");
  const b = client("b");
  const room = roomWith(a, b);
  const fruit: InventoryCard = { id: "banana-two", kind: "fruit", left: { fruit: "banana", count: 2 }, right: { fruit: "durian", count: 1 } };
  const mover: InventoryCard = { id: "gorilla-inventory-mover", kind: "gorilla", gorilla: "inventory-mover" };
  room.inventories = new Map<string, InventoryCard>([["a", fruit], ["b", mover]]);
  room.orders = [{ cardId: fruit.id, playerId: "a", side: "right", card: fruit }];
  room.lastOrderPlayerId = "a";
  room.roundPlayerIds = new Set(["a", "b"]);
  room.setPhase("playing");
  room.state.currentPlayerId = "a";
  room.clock.setTimeout = (() => ({} as never)) as typeof room.clock.setTimeout;

  room.ringBell(a);
  const explanation = room.pendingBell.result.explanations.find((item: { effect: string }) => item.effect === "inventory-mover");
  assert.deepEqual(explanation.actor, { inventoryId: "b", card: mover });
  assert.deepEqual(explanation.sources, [{ inventoryId: "a", cardId: "banana-two", side: "left", effectiveFruit: "banana", amount: 2, countBefore: 2, countAfter: 0 }]);
  room.finishBell();
  assert.deepEqual(room.revealPayload.inventories, { a: fruit, b: mover });
});

test("bell recovery schedules the remaining settlement timer", () => {
  const a = client("a");
  const b = client("b");
  const room = roomWith(a, b);
  startRound(room, "a");
  const scheduled: number[] = [];
  room.clock.setTimeout = ((_handler: () => void, delay: number) => { scheduled.push(delay); return {} as never; }) as typeof room.clock.setTimeout;
  room.pendingBell = {
    result: calculateOrders([], [...room.inventories.values()] as InventoryCard[]),
    penalizedPlayerId: "a",
    penalizedName: "a",
    ringerId: "a",
    inventories: new Map(room.inventories),
    dueAt: Date.now() + 2_000,
  };
  room.recovery = { phase: "bell_ringing", currentPlayerId: "a" };
  room.setPhase("waiting_reconnect");

  room.restoreAfterReconnect();

  assert.equal(room.state.phase, "bell_ringing");
  assert.equal(scheduled.length, 1);
  assert.ok(scheduled[0] >= 0 && scheduled[0] <= 2_000);
});

test("permanent leave re-evaluates waiting_reconnect and resumes when two round players remain", () => {
  const a = client("a");
  const b = client("b");
  const c = client("c");
  const room = roomWith(a, b, c);
  startRound(room, "a");
  room.state.players.find((player: { id: string }) => player.id === "b")!.connected = false;
  room.recovery = { phase: "playing", currentPlayerId: "a" };
  room.setPhase("waiting_reconnect");

  room.onLeave(b);

  assert.equal(room.state.phase, "playing");
  assert.equal(room.state.currentPlayerId, "a");
  assert.deepEqual([...room.state.players].map((player: { id: string }) => player.id), ["a", "c"]);
});

test("only the host can change mode and mode locks after start", () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);

  room.setGameMode(guest, { gameMode: "curious-market" });
  assert.equal(room.state.gameMode, "classic");
  assert.equal(guest.sent.at(-1)?.type, "action_error");

  room.setGameMode(host, { gameMode: "curious-market" });
  assert.equal(room.state.gameMode, "curious-market");
  startRound(room, "host");
  room.setGameMode(host, { gameMode: "classic" });
  assert.equal(room.state.gameMode, "curious-market");
});

test("player gorilla weight defaults to one and only the host can change it in lobby", () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);

  assert.equal(room.state.playerGorillaWeight, 1);
  room.setPlayerGorillaWeight(guest, { weight: 2 });
  assert.equal(room.state.playerGorillaWeight, 1);
  assert.deepEqual(guest.sent.at(-1), { type: "action_error", payload: { message: "只有房主可以执行此操作" } });

  room.setPlayerGorillaWeight(host, { weight: 0 });
  assert.equal(room.state.playerGorillaWeight, 0);
  room.setPlayerGorillaWeight(host, { weight: 0.5 });
  assert.equal(room.state.playerGorillaWeight, 0.5);
  room.setPlayerGorillaWeight(host, { weight: 4 });
  assert.equal(room.state.playerGorillaWeight, 4);
  assert.equal(room.state.message, "房主将玩家猩猩倍率设为 4 倍");
});

test("player gorilla weight rejects malformed, non-finite, out-of-range, and non-half-step values", () => {
  const host = client("host");
  const room = roomWith(host);
  const invalid = [undefined, null, [], {}, { weight: "1" }, { weight: Number.NaN }, { weight: Number.POSITIVE_INFINITY }, { weight: -0.5 }, { weight: 4.5 }, { weight: 1.25 }, { weight: 1, extra: true }];

  for (const payload of invalid) {
    room.setPlayerGorillaWeight(host, payload);
    assert.equal(room.state.playerGorillaWeight, 1);
  }
  assert.equal(host.sent.filter(({ type }) => type === "action_error").length, invalid.length);
});

test("gorilla selection defaults to all curious-market ids and max eight", () => {
  const room = roomWith(client("host"));

  assert.deepEqual([...room.state.selectedGorillaIds], ["mitsuhiko", "moo", "nana", "grape-beadsmith", "order-swap-magician", "boxing-manager", "inventory-mover", "temporary-supervisor"]);
  assert.equal(room.state.maxGorillas, 8);
});

test("only the host can set gorilla selection in lobby", () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);

  room.setGorillaSelection(guest, { gorillaIds: ["moo"], maxGorillas: 1 });
  assert.equal(room.state.maxGorillas, 8);
  assert.deepEqual(guest.sent.at(-1), { type: "action_error", payload: { message: "只有房主可以执行此操作" } });

  room.setGorillaSelection(host, { gorillaIds: ["moo"], maxGorillas: 1 });
  assert.deepEqual([...room.state.selectedGorillaIds], ["moo"]);
  assert.equal(room.state.maxGorillas, 1);
});

test("gorilla selection rejects malformed configurations and locks after start", () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);
  const invalid = [undefined, null, [], {}, { gorillaIds: [] }, { gorillaIds: ["unknown"], maxGorillas: 1 }, { gorillaIds: ["moo", "moo"], maxGorillas: 1 }, { gorillaIds: ["moo"], maxGorillas: 0 }, { gorillaIds: ["moo"], maxGorillas: 2 }, { gorillaIds: ["moo"], maxGorillas: 1.5 }, { gorillaIds: ["moo"], maxGorillas: 1, extra: true }];

  for (const payload of invalid) room.setGorillaSelection(host, payload);
  assert.deepEqual([...room.state.selectedGorillaIds], ["mitsuhiko", "moo", "nana", "grape-beadsmith", "order-swap-magician", "boxing-manager", "inventory-mover", "temporary-supervisor"]);
  assert.equal(host.sent.filter(({ type }) => type === "action_error").length, invalid.length);

  startRound(room, "host");
  room.setGorillaSelection(host, { gorillaIds: ["moo"], maxGorillas: 1 });
  assert.equal(room.state.maxGorillas, 8);
  assert.deepEqual(host.sent.at(-1), { type: "action_error", payload: { message: "猩猩阵容仅可在大厅修改" } });
});

test("curious-market keeps every selected gorilla in the deck and limits player starting inventories", () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);
  room.state.gameMode = "curious-market";
  room.setGorillaSelection(host, { gorillaIds: ["moo", "nana", "inventory-mover"], maxGorillas: 1 });

  startRound(room, "host");

  const playerGorillas = [room.inventories.get("host"), room.inventories.get("guest")].filter((card): card is InventoryCard => card?.kind === "gorilla");
  const gorillaIds = [...room.deck, ...room.inventories.values()]
    .filter((card): card is InventoryCard & { kind: "gorilla" } => card.kind === "gorilla")
    .map((card) => card.gorilla);
  assert.ok(playerGorillas.length <= 1);
  assert.equal(gorillaIds.length, 3);
  assert.equal(gorillaIds.every((id) => ["moo", "nana", "inventory-mover"].includes(id)), true);
});

test("curious-market later draws can still draw gorillas after the starting limit", () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);
  room.state.gameMode = "curious-market";
  room.setGorillaSelection(host, { gorillaIds: ["moo"], maxGorillas: 1 });
  startRound(room, "host");

  room.deck.push({ id: "gorilla-later", kind: "gorilla", gorilla: "moo" });
  room.state.currentPlayerId = "host";
  room.drawCardForPlayer("host");

  assert.equal(room.pendingCard?.id, "gorilla-later");
});

test("player gorilla weight locks after start and is preserved when returning to lobby", () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);
  room.setPlayerGorillaWeight(host, { weight: 2.5 });
  startRound(room, "host");

  room.setPlayerGorillaWeight(host, { weight: 3 });
  assert.equal(room.state.playerGorillaWeight, 2.5);
  assert.deepEqual(host.sent.at(-1), { type: "action_error", payload: { message: "玩家猩猩倍率仅可在大厅修改" } });

  room.setPhase("finished");
  room.backToLobby(host);
  assert.equal(room.state.playerGorillaWeight, 2.5);
});

test("curious-market player inventories read the synchronized weight while dummy remains a normal pop", () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);
  room.state.gameMode = "curious-market";
  room.state.playerGorillaWeight = 0;

  startRound(room, "host");

  assert.equal(room.inventories.get("host")?.kind, "fruit");
  assert.equal(room.inventories.get("guest")?.kind, "fruit");
  assert.ok(room.inventories.get("__dummy_inventory__"));
  assert.equal(room.deck.length, 33);
});

test("classic start does not apply the player gorilla weight", () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);
  room.state.playerGorillaWeight = -1;

  assert.doesNotThrow(() => startRound(room, "host"));
  assert.ok(room.inventories.get("host"));
  assert.ok(room.inventories.get("guest"));
});

test("returning to lobby preserves selected mode", () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);
  room.setGameMode(host, { gameMode: "curious-market" });
  room.setPhase("finished");

  room.backToLobby(host);

  assert.equal(room.state.phase, "lobby");
  assert.equal(room.state.gameMode, "curious-market");
});

test("non-host cannot close the room", async () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);
  let locks = 0;
  let broadcasts = 0;
  room.lock = async () => { locks += 1; };
  room.broadcast = () => { broadcasts += 1; };

  await room.endGame(guest);

  assert.equal(locks, 0);
  assert.equal(broadcasts, 0);
  assert.deepEqual(guest.sent.at(-1), { type: "action_error", payload: { message: "只有房主可以执行此操作" } });
});

test("host can close from lobby and closure locks immediately, broadcasts once, then disconnects", async () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);
  let releaseLock!: () => void;
  let locks = 0;
  const lockPending = new Promise<void>((resolve) => { releaseLock = resolve; });
  const broadcasts: Array<{ type: string; payload: unknown }> = [];
  const scheduled: Array<{ handler: () => void; delay: number }> = [];
  let disconnects = 0;
  room.lock = () => { locks += 1; return lockPending; };
  room.broadcast = (type: string, payload: unknown) => { broadcasts.push({ type, payload }); };
  room.clock.setTimeout = ((handler: () => void, delay: number) => {
    scheduled.push({ handler, delay });
    return {} as never;
  }) as typeof room.clock.setTimeout;
  room.disconnect = async () => { disconnects += 1; };

  const firstClose = room.endGame(host);
  const duplicateClose = room.endGame(host);

  assert.equal(room.closing, true);
  assert.equal(locks, 1);
  assert.equal(broadcasts.length, 0);
  releaseLock();
  await Promise.all([firstClose, duplicateClose]);
  assert.deepEqual(broadcasts, [{ type: "room_closed", payload: { message: "房主已解散房间" } }]);
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delay, 600);
  assert.equal(disconnects, 0);
  scheduled[0].handler();
  await Promise.resolve();
  assert.equal(disconnects, 1);
});

test("closing room rejects joins before lock finishes", async () => {
  const host = client("host");
  const room = roomWith(host);
  let releaseLock!: () => void;
  room.lock = () => new Promise<void>((resolve) => { releaseLock = resolve; });
  room.clock.setTimeout = (() => ({} as never)) as typeof room.clock.setTimeout;
  const closing = room.endGame(host);
  const lateGuest = client("late-guest");
  room.clients.push(lateGuest);

  assert.throws(() => room.onJoin(lateGuest, { name: "late", clientId: "late-guest" }), /房主已解散房间/);
  releaseLock();
  await closing;
});

test("resolving clients can request the cached reveal payload", () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);
  const payload = { revealRound: 4, token: 2, result: { explanations: [] } };
  room.revealPayload = payload;
  room.setPhase("resolving");

  room.sendRevealResultTo(guest);

  assert.deepEqual(guest.sent.at(-1), { type: "reveal_result", payload });
});

test("reveal cache is unavailable outside resolving and clears for next round and lobby", () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);
  room.revealPayload = { revealRound: 1 };
  room.setPhase("playing");
  room.sendRevealResultTo(guest);
  assert.equal(guest.sent.some(({ type }) => type === "reveal_result"), false);

  room.revealPayload = { revealRound: 1 };
  startRound(room, "host");
  assert.equal(room.revealPayload, null);

  room.revealPayload = { revealRound: 2 };
  room.returnToLobby("test");
  assert.equal(room.revealPayload, null);
});

test("reconnect restores the same seat and sends that seat's inventory view", () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);
  startRound(room, "guest");
  guest.sent.length = 0;
  room.state.players.find((player: { id: string }) => player.id === guest.sessionId)!.connected = false;

  room.onReconnect(guest);

  assert.equal(room.state.players.find((player: { id: string }) => player.id === guest.sessionId)?.connected, true);
  assert.equal(room.state.currentPlayerId, guest.sessionId);
  const inventoryMessage = guest.sent.find(({ type }) => type === "inventory_view");
  assert.ok(inventoryMessage);
  const view = inventoryMessage.payload as Record<string, { hidden?: boolean; kind?: string }>;
  assert.deepEqual(view[guest.sessionId], { hidden: true });
  assert.ok(view[host.sessionId]?.kind);
});

test("only the host can add or remove one internal bot seat", () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);

  room.addBot(guest);
  assert.equal(room.state.players.some((player: { isBot: boolean }) => player.isBot), false);
  room.addBot(host);
  room.addBot(host);
  assert.deepEqual([...room.state.players].filter((player: { isBot: boolean }) => player.isBot).map((player: { id: string }) => player.id), ["__bot__"]);
  assert.equal(room.state.players.find((player: { isBot: boolean }) => player.isBot)?.connected, true);
  room.removeBot(guest);
  assert.equal(room.state.players.some((player: { isBot: boolean }) => player.isBot), true);
  room.removeBot(host);
  assert.equal(room.state.players.some((player: { isBot: boolean }) => player.isBot), false);
});

test("bot fruit strategy uses only other public inventory totals", () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);
  room.addBot(host);
  room.inventories.set("__bot__", { id: "bot-card", kind: "fruit", left: { fruit: "banana", count: 1 }, right: { fruit: "durian", count: 3 } });
  room.inventories.set("host", { id: "host-card", kind: "fruit", left: { fruit: "banana", count: 2 }, right: { fruit: "strawberry", count: 1 } });
  room.pendingCard = { id: "order-card", kind: "fruit", left: { fruit: "banana", count: 2 }, right: { fruit: "durian", count: 2 } };
  room.roundPlayerIds = new Set(["host", "guest", "__bot__"]);
  room.state.currentPlayerId = "__bot__";
  room.setPhase("choosing_order");
  room.chooseOrderSideForPlayer("__bot__", room.botOrderSide());
  assert.equal(room.orders[0].side, "left");
});

test("bot is automatically ready after settlement", () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);
  room.addBot(host);
  room.setPhase("resolving");
  room.evaluateReady();
  assert.equal(room.state.readyPlayerIds.includes("__bot__"), true);
});

test("bot gorilla does not flip without reducing public overstock risk", () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);
  room.addBot(host);
  room.inventories.set("host", { id: "host-card", kind: "fruit", left: { fruit: "banana", count: 1 }, right: { fruit: "strawberry", count: 1 } });
  room.orders = [{ cardId: "order", playerId: "host", side: "left", card: { id: "order", kind: "fruit", left: { fruit: "banana", count: 1 }, right: { fruit: "banana", count: 1 } } }];
  room.pendingCard = { id: "gorilla", kind: "gorilla", gorilla: "moo" };
  room.state.currentPlayerId = "__bot__";
  room.setPhase("choosing_gorilla");
  room.clock.setTimeout = (() => ({} as never)) as typeof room.clock.setTimeout;
  room.runBotAction();
  assert.equal(room.orders[0].gorillaCardId, undefined);
  assert.equal(room.state.phase, "playing");
});
