import assert from "node:assert/strict";
import test from "node:test";
import type { Client } from "colyseus";
import { calculateOrders } from "../game/rules.js";
import type { InventoryCard } from "../game/types.js";
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
  for (const emote of ["mitsuhiko", "moo", "nana", "grape-beadsmith", "order-swap-magician"]) {
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

test("quick phrase broadcasts server-owned text through chat during settlement", () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);
  startRound(room, "host");
  room.setPhase("resolving");
  const messages: Array<Record<string, unknown>> = [];
  room.broadcast = (type: string, payload: Record<string, unknown>) => { if (type === "chat") messages.push(payload); };

  room.quickPhrase(guest, { id: "fooled-you" });

  assert.equal(messages.length, 1);
  assert.deepEqual({ ...messages[0], ts: 0 }, { playerId: "guest", name: "guest", text: "被我骗到了吧？", quickPhraseId: "fooled-you", ts: 0 });
});

test("quick phrase rejects invalid ids and malformed payloads without broadcasting", () => {
  const host = client("host");
  const guest = client("guest");
  const room = roomWith(host, guest);
  startRound(room, "host");
  let broadcasts = 0;
  room.broadcast = () => { broadcasts += 1; };

  for (const payload of [null, [], "fooled-you", {}, { id: 1 }, { id: "unknown" }, { id: "fooled-you", text: "伪造文本" }]) {
    room.quickPhrase(guest, payload);
  }

  assert.equal(broadcasts, 0);
  assert.equal(guest.sent.filter(({ type }) => type === "action_error").length, 7);
});

test("quick phrase rejects non-members and non-settlement phases", () => {
  const host = client("host");
  const guest = client("guest");
  const outsider = client("outsider");
  const room = roomWith(host, guest);
  startRound(room, "host");
  let broadcasts = 0;
  room.broadcast = () => { broadcasts += 1; };

  room.quickPhrase(outsider, { id: "fooled-you" });
  room.quickPhrase(guest, { id: "fooled-you" });

  assert.equal(broadcasts, 0);
  assert.deepEqual(outsider.sent.at(-1), { type: "action_error", payload: { message: "你不是房间成员" } });
  assert.deepEqual(guest.sent.at(-1), { type: "action_error", payload: { message: "当前阶段不能发送快捷短句" } });
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
