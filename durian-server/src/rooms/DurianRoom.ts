import { Room, Client } from "colyseus";
import { Schema, type, ArraySchema } from "@colyseus/schema";
import { calculateOrders, ANGER_TOKENS, isGameOver, takeLowestAngerToken } from "../game/rules.js";
import { shuffle } from "../game/deck.js";
import { createDeckForMode, isGameModeId, type GameModeId } from "../game/modes.js";
import type { AngerToken, InventoryCard, OrderEntry } from "../game/types.js";
import { MessageRateLimiter, normalizeNickname, PlayerTurnPolicy, RoomAccessPolicy, RoomPhase, type RoomPhaseName } from "./domain/roomPolicies.js";

const DUMMY_INVENTORY_ID = "__dummy_inventory__";
const CHAT_EMOTE_IDS = new Set(["mitsuhiko", "moo", "nana", "grape-beadsmith", "order-swap-magician"]);
const CHAT_TEXT_MAX_LENGTH = 120;
type DurianRoomMetadata = { roomCode: string };
type RecoveryState = { phase: RoomPhaseName; currentPlayerId: string };

class PlayerState extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("boolean") connected = true;
  @type("number") anger = 0;
}

class DurianState extends Schema {
  @type("string") roomCode = "";
  @type("string") phase = "lobby";
  @type("string") gameMode = "classic";
  @type("string") currentPlayerId = "";
  @type([PlayerState]) players = new ArraySchema<PlayerState>();
  @type(["string"]) orders = new ArraySchema<string>();
  @type("string") message = "等待玩家加入";
  @type("string") pendingCardId = "";
  @type("string") pendingCardKind = "";
  @type("string") pendingLeftFruit = "";
  @type("number") pendingLeftCount = 0;
  @type("string") pendingRightFruit = "";
  @type("number") pendingRightCount = 0;
  @type("number") round = 0;
  @type(["string"]) readyPlayerIds = new ArraySchema<string>();
}

export class DurianRoom extends Room<{ state: DurianState; metadata: DurianRoomMetadata }> {
  maxClients = 7;
  private deck: InventoryCard[] = [];
  private inventories = new Map<string, InventoryCard>();
  private orders: OrderEntry[] = [];
  private availableTokens: AngerToken[] = [...ANGER_TOKENS];
  private lastOrderPlayerId = "";
  private pendingCard: InventoryCard | null = null;
  private pendingNextStarterId = "";
  private pendingGameOver = false;
  private pendingBell: { result: ReturnType<typeof calculateOrders>; penalizedPlayerId: string; penalizedName: string; ringerId: string; inventories: Map<string, InventoryCard>; dueAt: number } | null = null;
  private revealPayload: Record<string, unknown> | null = null;
  private roundPlayerIds = new Set<string>();
  private roomCode = String(Math.floor(10_000_000 + Math.random() * 90_000_000));
  private readonly phase = new RoomPhase();
  private readonly turns = new PlayerTurnPolicy();
  private readonly access = new RoomAccessPolicy();
  private readonly chatLimiter = new MessageRateLimiter(5, 5_000);
  private recovery: RecoveryState | null = null;
  private readonly permanentlyLeft = new Set<string>();
  private closing = false;

  static async onAuth(token: string, options: { name?: string; token?: string }) {
    void token;
    void options?.token;
    return { name: normalizeNickname(options?.name, "玩家") };
  }

  onCreate() {
    this.setState(new DurianState());
    this.state.roomCode = this.roomCode;
    void this.setMetadata({ roomCode: this.roomCode });
    this.onMessage("start_game", (client, message: { startPlayerId?: string }) => this.startGame(client, message));
    this.onMessage("set_game_mode", (client, message: { gameMode?: string }) => this.setGameMode(client, message));
    this.onMessage("draw_card", (client) => this.drawCard(client));
    this.onMessage("choose_order_side", (client, message: { side?: "left" | "right" }) => this.chooseOrderSide(client, message));
    this.onMessage("choose_gorilla_target", (client, message: { orderIndex?: number }) => this.chooseGorillaTarget(client, message));
    this.onMessage("ring_bell", (client) => this.ringBell(client));
    this.onMessage("ready_for_next_round", (client) => this.readyForNextRound(client));
    this.onMessage("end_game", (client) => {
      void this.endGame(client).catch((error) => console.error("[durian] 解散房间失败:", error));
    });
    this.onMessage("back_to_lobby", (client) => this.backToLobby(client));
    this.onMessage("kick_player", (client, message: { playerId?: string }) => this.kickPlayer(client, message));
    this.onMessage("request_inventory_view", (client) => {
      if (!this.requireMember(client)) return;
      if (this.inventories.has(client.sessionId)) this.sendInventoryViewTo(client);
    });
    this.onMessage("request_reveal_result", (client) => this.sendRevealResultTo(client));
    this.onMessage("chat", (client, message: { text?: string; emote?: string }) => this.chat(client, message));
  }

  onJoin(client: Client, options: { name?: string; clientId?: string }) {
    if (this.closing) throw new Error("房主已解散房间");
    // Colyseus 会在最后一个可用席位连接、进入 onJoin 前自动 lock；大厅阶段不能据此拒绝第七人。
    if (!this.phase.is("lobby")) throw new Error("游戏已经开始，不能中途加入");
    client.userData = { ...(client.userData ?? {}), clientId: options?.clientId ?? "" };
    const clientId = options?.clientId ?? "";
    if (clientId && this.clients.some((other) => other.sessionId !== client.sessionId && other.userData?.clientId === clientId)) {
      throw new Error("该客户端已在房间中");
    }
    const player = new PlayerState();
    player.id = client.sessionId;
    player.name = normalizeNickname(options?.name, `玩家 ${this.state.players.length + 1}`);
    this.state.players.push(player);
    this.state.message = `${player.name} 加入了房间`;
  }

  async onDrop(client: Client) {
    const player = this.player(client.sessionId);
    if (!player || this.permanentlyLeft.has(client.sessionId)) return;
    player.connected = false;
    this.removeReady(client.sessionId);
    this.handleOnlineChange(client.sessionId);
    try {
      await this.allowReconnection(client, 120);
    } catch {
      this.finalizeLeave(client.sessionId);
    }
  }

  onReconnect(client: Client) {
    const player = this.player(client.sessionId);
    if (!player || this.permanentlyLeft.has(client.sessionId)) return;
    player.connected = true;
    this.state.message = `${player.name} 重新连接`;
    if (this.inventories.has(client.sessionId)) this.sendInventoryViewTo(client);
    this.restoreAfterReconnect();
    this.evaluateReady();
  }

  onLeave(client: Client) {
    this.finalizeLeave(client.sessionId);
  }

  private chat(client: Client, message: { text?: string; emote?: string }) {
    if (!this.requireMember(client)) return;
    const text = typeof message?.text === "string" ? message.text.trim().slice(0, CHAT_TEXT_MAX_LENGTH) : "";
    const emote = typeof message?.emote === "string" && CHAT_EMOTE_IDS.has(message.emote) ? message.emote : "";
    if (!text && !emote) return;
    if (!this.chatLimiter.allow(client.sessionId)) return this.actionError(client, "消息发送过快，请稍后再试");
    this.broadcast("chat", { playerId: client.sessionId, name: this.playerName(client.sessionId), text, emote, ts: Date.now() });
  }

  private setGameMode(client: Client, message: { gameMode?: string } = {}) {
    if (!this.requireHost(client)) return;
    if (!this.phase.is("lobby")) return this.actionError(client, "模式仅可在大厅修改");
    if (!isGameModeId(message.gameMode)) return this.actionError(client, "未知游戏模式");
    this.state.gameMode = message.gameMode;
    this.state.message = `房主将模式切换为${message.gameMode === "classic" ? "经典市场" : "奇趣市场"}`;
  }

  private startGame(client: Client, message: { startPlayerId?: string } = {}) {
    if (!this.requireHost(client)) return;
    if (!this.phase.is("lobby")) return this.actionError(client, "游戏不在大厅阶段");
    const online = this.onlinePlayers();
    if (online.length < 2) return this.actionError(client, "至少需要 2 名在线玩家才能开始");
    const requested = online.find((player) => player.id === message.startPlayerId)?.id;
    this.lock();
    this.startRound(requested ?? online[0].id);
  }

  private startRound(startPlayerId: string) {
    const online = this.onlinePlayers();
    if (online.length < 2) return this.returnToLobby("在线玩家不足，已返回大厅");
    this.deck = shuffle(createDeckForMode(this.state.gameMode as GameModeId));
    this.orders = [];
    this.lastOrderPlayerId = "";
    this.pendingCard = null;
    this.revealPayload = null;
    this.inventories.clear();
    this.state.orders.clear();
    this.state.readyPlayerIds.clear();
    this.state.round += 1;
    this.roundPlayerIds = new Set(online.map((player) => player.id));
    this.setPhase("playing");
    this.state.currentPlayerId = online.some((player) => player.id === startPlayerId) ? startPlayerId : online[0].id;
    this.clearPendingCard();
    for (const player of online) {
      const card = this.deck.pop();
      if (!card) throw new Error("牌堆不足，无法发放库存卡");
      this.inventories.set(player.id, card);
    }
    if (online.length === 2) {
      const dummyCard = this.deck.pop();
      if (!dummyCard) throw new Error("牌堆不足，无法发放双人局公共库存牌");
      this.inventories.set(DUMMY_INVENTORY_ID, dummyCard);
    }
    this.sendInventoryViews();
    this.state.message = `第 ${this.state.round} 轮开始，轮到 ${this.playerName(this.state.currentPlayerId)}`;
    this.broadcast("turn_started", { playerId: this.state.currentPlayerId, round: this.state.round, roundStart: true });
  }

  private drawCard(client: Client) {
    if (!this.requireTurn(client, "playing")) return;
    const card = this.deck.pop();
    if (!card) return this.actionError(client, "牌堆已空，请敲铃结算");
    this.pendingCard = card;
    this.state.pendingCardId = card.id;
    if (card.kind === "fruit") {
      this.setPhase("choosing_order");
      this.state.pendingCardKind = "fruit";
      this.state.pendingLeftFruit = card.left.fruit;
      this.state.pendingLeftCount = card.left.count;
      this.state.pendingRightFruit = card.right.fruit;
      this.state.pendingRightCount = card.right.count;
      this.state.message = `${this.playerName(client.sessionId)} 请选择订单的一侧`;
      return;
    }
    const targets = this.orders.filter((order) => !order.gorillaCardId);
    this.state.pendingCardKind = `gorilla:${card.gorilla}`;
    if (targets.length === 0) {
      this.setPhase("gorilla_skip");
      this.state.message = `${this.playerName(client.sessionId)} 抽到大猩猩卡，但没有可翻转的订单，继续抽牌`;
      const playerId = client.sessionId;
      this.clock.setTimeout(() => {
        if (this.phase.is("gorilla_skip") && this.player(playerId)?.connected) this.continueTurn(playerId);
      }, 2600);
      return;
    }
    this.setPhase("choosing_gorilla");
    this.state.message = `${this.playerName(client.sessionId)} 请选择要翻转的订单`;
  }

  private chooseOrderSide(client: Client, message: { side?: "left" | "right" }) {
    if (!this.requireTurn(client, "choosing_order")) return;
    if (!this.pendingCard || this.pendingCard.kind !== "fruit" || (message?.side !== "left" && message?.side !== "right")) return this.actionError(client, "无效的订单选择");
    this.orders.push({ cardId: this.pendingCard.id, playerId: client.sessionId, side: message.side, card: this.pendingCard });
    this.state.orders.push(this.publicOrder(this.orders[this.orders.length - 1]));
    this.lastOrderPlayerId = client.sessionId;
    this.advanceTurn(client.sessionId);
  }

  private chooseGorillaTarget(client: Client, message: { orderIndex?: number }) {
    if (!this.requireTurn(client, "choosing_gorilla")) return;
    if (!this.pendingCard || this.pendingCard.kind !== "gorilla") return this.actionError(client, "当前没有可用的大猩猩卡");
    const target = this.orders[message?.orderIndex ?? -1];
    if (!target || target.gorillaCardId) return this.actionError(client, "无效的翻转目标");
    target.side = target.side === "left" ? "right" : "left";
    target.gorillaCardId = this.pendingCard.id;
    this.state.orders[message.orderIndex!] = this.publicOrder(target);
    this.lastOrderPlayerId = client.sessionId;
    this.advanceTurn(client.sessionId);
  }

  private continueTurn(playerId: string) {
    this.pendingCard = null;
    this.clearPendingCard();
    this.setPhase("playing");
    this.state.currentPlayerId = playerId;
    this.state.message = `${this.playerName(playerId)} 继续抽牌`;
    this.broadcast("turn_started", { playerId, round: this.state.round, redraw: true });
  }

  private advanceTurn(previousPlayerId: string) {
    this.pendingCard = null;
    this.clearPendingCard();
    const next = this.turns.nextOnline(this.turnPlayers(), previousPlayerId);
    if (!next || !this.turns.canContinue(this.turnPlayers())) return this.waitForReconnect("在线玩家不足，等待重连…");
    this.setPhase("playing");
    this.state.currentPlayerId = next;
    this.state.message = `轮到 ${this.playerName(next)}`;
    this.broadcast("turn_started", { playerId: next, round: this.state.round });
  }

  private ringBell(client: Client) {
    if (!this.requireTurn(client, "playing")) return;
    if (this.orders.length === 0) return this.actionError(client, "至少完成一张订单后才能敲铃");
    const inventories = new Map(this.inventories);
    const result = calculateOrders(this.orders, [...inventories.values()]);
    const penalizedPlayerId = result.overstocked && this.lastOrderPlayerId ? this.lastOrderPlayerId : client.sessionId;
    this.pendingBell = { result, penalizedPlayerId, penalizedName: this.playerName(penalizedPlayerId), ringerId: client.sessionId, inventories, dueAt: Date.now() + 3000 };
    this.setPhase("bell_ringing");
    this.state.message = `${this.playerName(client.sessionId)} 摇响了铃，等待结算`;
    this.broadcast("bell_ringing", { duration: 3000, playerId: client.sessionId });
    this.clock.setTimeout(() => this.finishBell(), 3000);
  }

  private finishBell() {
    if (!this.phase.is("bell_ringing") || !this.pendingBell) return;
    const bell = this.pendingBell;
    this.pendingBell = null;
    const penalized = this.player(bell.penalizedPlayerId);
    const token = takeLowestAngerToken(this.availableTokens);
    this.availableTokens = this.availableTokens.filter((value) => value !== token);
    if (penalized) penalized.anger += token;
    this.setPhase("resolving");
    this.state.message = bell.result.overstocked ? `${bell.penalizedName} 订单超过库存，获得 ${token} 点怒气` : `${bell.penalizedName} 误敲铃，获得 ${token} 点怒气`;
    this.revealPayload = { result: bell.result, penalizedPlayerId: bell.penalizedPlayerId, ringerPlayerId: bell.ringerId, successfulCall: bell.result.overstocked && bell.penalizedPlayerId !== bell.ringerId, token, inventories: Object.fromEntries(bell.inventories), loser: bell.penalizedPlayerId, revealRound: this.state.round };
    this.broadcast("reveal_result", this.revealPayload);
    this.state.readyPlayerIds.clear();
    if (penalized && isGameOver(penalized.anger)) {
      this.pendingGameOver = true;
      this.state.message = "请所有在线玩家查看本轮结算并准备查看总结算";
    } else {
      this.pendingNextStarterId = this.turns.nextOnline(this.turnPlayers(), bell.penalizedPlayerId) ?? this.onlinePlayers()[0]?.id ?? "";
      this.state.currentPlayerId = this.pendingNextStarterId;
      this.state.message = "请所有在线玩家查看本轮结算并准备下一轮";
    }
    this.evaluateReady();
  }

  private readyForNextRound(client: Client) {
    if (!this.requireMember(client) || !this.phase.is("resolving")) return this.actionError(client, "当前无需准备");
    if (!this.state.readyPlayerIds.includes(client.sessionId)) this.state.readyPlayerIds.push(client.sessionId);
    this.evaluateReady();
  }

  private evaluateReady() {
    if (!this.phase.is("resolving")) return;
    const online = this.onlinePlayers();
    for (const id of [...this.state.readyPlayerIds]) if (!online.some((player) => player.id === id)) this.removeReady(id);
    if (online.length < 2) return this.waitForReconnect("在线玩家不足，等待重连…", { phase: "resolving", currentPlayerId: this.state.currentPlayerId });
    if (!online.every((player) => this.state.readyPlayerIds.includes(player.id))) {
      this.state.message = `等待所有在线玩家准备（${this.state.readyPlayerIds.length}/${online.length}）`;
      return;
    }
    if (this.pendingGameOver) {
      this.pendingGameOver = false;
      this.setPhase("finished");
      this.state.currentPlayerId = "";
      this.clearPendingCard();
      this.state.message = "游戏结束：怒气达到 7 点";
      return;
    }
    const starter = this.pendingNextStarterId;
    this.pendingNextStarterId = "";
    this.startRound(starter);
  }

  private backToLobby(client: Client) {
    if (!this.requireHost(client)) return;
    if (!this.phase.is("finished")) return this.actionError(client, "当前不能返回大厅");
    this.returnToLobby("已返回房间大厅，等待房主开始新一局");
  }

  private returnToLobby(message: string) {
    this.deck = [];
    this.orders = [];
    this.inventories.clear();
    this.availableTokens = [...ANGER_TOKENS];
    this.lastOrderPlayerId = "";
    this.pendingCard = null;
    this.pendingNextStarterId = "";
    this.pendingGameOver = false;
    this.pendingBell = null;
    this.revealPayload = null;
    this.roundPlayerIds.clear();
    this.recovery = null;
    this.clock.clear();
    this.setPhase("lobby");
    this.state.currentPlayerId = "";
    this.state.round = 0;
    this.state.orders.clear();
    this.state.readyPlayerIds.clear();
    this.clearPendingCard();
    for (const player of this.state.players) player.anger = 0;
    this.unlock();
    this.state.message = message;
    for (const member of this.clients) member.send("inventory_view", {});
  }

  private kickPlayer(client: Client, message: { playerId?: string } = {}) {
    if (!this.requireHost(client) || !this.phase.is("lobby")) return;
    const targetId = message.playerId ?? "";
    if (!targetId || targetId === client.sessionId) return this.actionError(client, "不能移除该玩家");
    const target = this.clients.find((item) => item.sessionId === targetId);
    const name = this.playerName(targetId);
    this.finalizeLeave(targetId);
    target?.send("room_closed", { message: "你已被房主移出房间" });
    target?.leave();
    this.state.message = `${name} 已被房主移出房间`;
  }

  private async endGame(client: Client) {
    if (!this.requireHost(client) || this.closing) return;
    this.closing = true;
    await this.lock();
    this.broadcast("room_closed", { message: "房主已解散房间" });
    this.clock.setTimeout(() => void this.disconnect(), 600);
  }

  private handleOnlineChange(droppedId: string) {
    if (this.phase.is("lobby", "finished")) {
      this.state.message = `${this.playerName(droppedId)} 连接断开，等待重连…`;
      return;
    }
    if (!this.turns.canContinue(this.turnPlayers())) return this.waitForReconnect("在线玩家不足，等待重连…");
    if (this.phase.is("bell_ringing")) return;
    if (this.state.currentPlayerId === droppedId && this.phase.is("playing", "choosing_order", "choosing_gorilla", "gorilla_skip")) {
      this.pendingCard = null;
      this.clearPendingCard();
      const next = this.turns.nextOnline(this.turnPlayers(), droppedId)!;
      this.setPhase("playing");
      this.state.currentPlayerId = next;
      this.state.message = `${this.playerName(droppedId)} 离线，轮到 ${this.playerName(next)}`;
      this.broadcast("turn_started", { playerId: next, round: this.state.round });
      return;
    }
    this.evaluateReady();
  }

  private waitForReconnect(message: string, recovery?: RecoveryState) {
    if (!this.phase.is("waiting_reconnect")) this.recovery = recovery ?? { phase: this.phase.value, currentPlayerId: this.state.currentPlayerId };
    this.setPhase("waiting_reconnect");
    this.state.message = message;
  }

  private restoreAfterReconnect() {
    if (!this.phase.is("waiting_reconnect") || !this.turns.canContinue(this.turnPlayers()) || !this.recovery) return;
    const recovery = this.recovery;
    this.recovery = null;
    if (recovery.phase === "resolving") {
      this.setPhase("resolving");
      this.state.currentPlayerId = recovery.currentPlayerId;
      this.evaluateReady();
      return;
    }
    if (recovery.phase === "bell_ringing" && this.pendingBell) {
      this.setPhase("bell_ringing");
      this.clock.setTimeout(() => this.finishBell(), Math.max(0, this.pendingBell.dueAt - Date.now()));
      return;
    }
    const current = this.player(recovery.currentPlayerId)?.connected ? recovery.currentPlayerId : this.turns.nextOnline(this.turnPlayers(), recovery.currentPlayerId);
    this.pendingCard = null;
    this.clearPendingCard();
    this.setPhase("playing");
    this.state.currentPlayerId = current ?? this.onlinePlayers()[0].id;
    this.state.message = `连接恢复，轮到 ${this.playerName(this.state.currentPlayerId)}`;
    this.broadcast("turn_started", { playerId: this.state.currentPlayerId, round: this.state.round });
  }

  private finalizeLeave(sessionId: string) {
    if (this.permanentlyLeft.has(sessionId)) return;
    const player = this.player(sessionId);
    if (!player) return;
    this.permanentlyLeft.add(sessionId);
    const wasHost = this.state.players[0]?.id === sessionId;
    const name = player.name;
    const playersBeforeRemoval = this.turnPlayers();
    const wasCurrent = this.state.currentPlayerId === sessionId;
    const next = wasCurrent ? this.turns.nextOnlineAfterRemoval(playersBeforeRemoval, sessionId) : undefined;
    const mustAdvance = wasCurrent && this.phase.is("playing", "choosing_order", "choosing_gorilla", "gorilla_skip");
    if (mustAdvance) {
      this.pendingCard = null;
      this.clearPendingCard();
    }
    this.state.players.splice(this.state.players.findIndex((item) => item.id === sessionId), 1);
    this.roundPlayerIds.delete(sessionId);
    if (!this.pendingBell) this.inventories.delete(sessionId);
    this.removeReady(sessionId);
    this.chatLimiter.clear(sessionId);
    if (wasCurrent) this.state.currentPlayerId = next ?? "";
    if (!this.phase.is("lobby") && this.state.players.length < 2) return this.returnToLobby("玩家不足 2 人，已返回大厅");
    if (this.phase.is("waiting_reconnect")) {
      if (this.turns.canContinue(this.turnPlayers())) this.restoreAfterReconnect();
      return;
    }
    if (mustAdvance && next) {
      this.setPhase("playing");
      this.state.message = `${name} 已离开，轮到 ${this.playerName(next)}`;
      this.broadcast("turn_started", { playerId: next, round: this.state.round });
      return;
    }
    this.evaluateReady();
    if (!this.phase.is("resolving")) this.state.message = `${name} 已离开${wasHost && this.state.players[0] ? `，${this.state.players[0].name} 成为房主` : ""}`;
  }

  private sendInventoryViewTo(client: Client) {
    if (!this.player(client.sessionId) || !this.inventories.has(client.sessionId)) return;
    const visible = Object.fromEntries([...this.inventories.entries()].map(([playerId, card]) => [playerId, playerId === client.sessionId ? { hidden: true } : card]));
    client.send("inventory_view", visible);
  }

  private sendInventoryViews() {
    for (const client of this.clients) this.sendInventoryViewTo(client);
  }

  private sendRevealResultTo(client: Client) {
    if (!this.requireMember(client) || !this.phase.is("resolving") || !this.revealPayload) return;
    client.send("reveal_result", this.revealPayload);
  }

  private requireMember(client: Client) {
    if (this.access.isMember(this.playerIds(), client.sessionId)) return true;
    this.actionError(client, "你不是房间成员");
    return false;
  }

  private requireHost(client: Client) {
    if (this.access.isHost(this.playerIds(), client.sessionId)) return true;
    this.actionError(client, "只有房主可以执行此操作");
    return false;
  }

  private requireTurn(client: Client, expected: RoomPhaseName) {
    if (!this.requireMember(client)) return false;
    if (!this.phase.is(expected)) {
      this.actionError(client, "当前阶段不能执行此操作");
      return false;
    }
    if (!this.access.canAct(this.playerIds(), this.state.currentPlayerId, client.sessionId)) {
      this.actionError(client, "还没有轮到你");
      return false;
    }
    return true;
  }

  private actionError(client: Client, message: string) {
    client.send("action_error", { message });
  }

  private setPhase(phase: RoomPhaseName) {
    this.state.phase = this.phase.enter(phase);
  }

  private removeReady(id: string) {
    const index = this.state.readyPlayerIds.indexOf(id);
    if (index >= 0) this.state.readyPlayerIds.splice(index, 1);
  }

  private turnPlayers() { return [...this.state.players].filter((player) => this.roundPlayerIds.has(player.id)).map((player) => ({ id: player.id, connected: player.connected })); }
  private playerIds() { return this.state.players.map((player) => player.id); }
  private onlinePlayers() { return [...this.state.players].filter((player) => player.connected); }
  private player(id: string) { return this.state.players.find((player) => player.id === id); }
  private playerName(id: string) { return this.player(id)?.name ?? "玩家"; }

  private clearPendingCard() {
    this.state.pendingCardId = "";
    this.state.pendingCardKind = "";
    this.state.pendingLeftFruit = "";
    this.state.pendingLeftCount = 0;
    this.state.pendingRightFruit = "";
    this.state.pendingRightCount = 0;
  }

  private publicOrder(order: OrderEntry) {
    return JSON.stringify({ cardId: order.cardId, left: order.card.left, right: order.card.right, selectedSide: order.side, gorillaKind: order.gorillaCardId ? order.gorillaCardId.replace("gorilla-", "") : "" });
  }
}
