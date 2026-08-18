import { Room, Client } from "colyseus";
import { Schema, type, ArraySchema } from "@colyseus/schema";
import { calculateOrders, ANGER_TOKENS, isGameOver, nextPlayerId, takeLowestAngerToken } from "../game/rules.js";
import { createDevDeck, shuffle } from "../game/deck.js";
import type { AngerToken, InventoryCard, OrderEntry } from "../game/types.js";

const DUMMY_INVENTORY_ID = "__dummy_inventory__";
type DurianRoomMetadata = { roomCode: string };

class PlayerState extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("boolean") connected = true;
  @type("number") anger = 0;
}

class DurianState extends Schema {
  @type("string") roomCode = "";
  @type("string") phase = "lobby";
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

  // 帐号系统扩展点：目前是匿名放行，仅做基本校验。
  // 未来接入帐号后，在此验证 token（JWT）并返回 { userId, name }，
  // 返回值会挂在 client.userData 上，onJoin 随之改为按 userId 落座。
  static async onAuth(token: string, options: { name?: string; token?: string; clientId?: string }) {
    void token; // Colyseus 0.17 的 auth token 通道，当前未启用
    void options?.token; // 预留：帐号 JWT，当前不验证
    return { name: options?.name?.trim().slice(0, 24) ?? "" };
  }

  onJoin(client: Client, options: { name?: string; clientId?: string }) {
    // clientId 是前端 localStorage 里的持久匿名 ID，是帐号 userId 的过渡形态；
    // 座位归属目前仍按 sessionId 判断，接入帐号后迁移到它。
    client.userData = { ...(client.userData ?? {}), clientId: options?.clientId ?? "" };
    // 同一 clientId 已在房间（双击加入/多开标签页都会产生第二个连接）：
    // 移除旧座位并断开旧连接，保证一个匿名 ID 只占一个位置
    const clientId = options?.clientId ?? "";
    if (clientId) {
      for (const other of this.clients) {
        if (other.sessionId !== client.sessionId && other.userData?.clientId === clientId) {
          this.removePlayerSeat(other.sessionId);
          other.leave();
        }
      }
    }
    if (this.state.phase !== "lobby") return;
    const player = new PlayerState();
    player.id = client.sessionId;
    player.name = options?.name?.trim() || `玩家 ${this.state.players.length + 1}`;
    this.state.players.push(player);
    this.state.message = `${player.name} 加入了房间`;
  }
  private deck: InventoryCard[] = [];
  private inventories = new Map<string, InventoryCard>();
  private orders: OrderEntry[] = [];
  private availableTokens: AngerToken[] = [...ANGER_TOKENS];
  private lastOrderPlayerId = "";
  private pendingCard: InventoryCard | null = null;
  private pendingNextStarterId = "";
  private pendingBell: { result: ReturnType<typeof calculateOrders>; penalizedPlayerId: string; ringerId: string } | null = null;
  private roomCode = String(Math.floor(10_000_000 + Math.random() * 90_000_000));

  onCreate() {
    this.setState(new DurianState());
    this.state.roomCode = this.roomCode;
    void this.setMetadata({ roomCode: this.roomCode });
    this.onMessage("start_game", (client, message: { startPlayerId?: string }) => this.startGame(client, message));
    this.onMessage("draw_card", (client) => this.drawCard(client));
    this.onMessage("choose_order_side", (client, message: { side?: "left" | "right" }) => this.chooseOrderSide(client, message));
    this.onMessage("choose_gorilla_target", (client, message: { orderIndex?: number }) => this.chooseGorillaTarget(client, message));
    this.onMessage("ring_bell", (client) => this.ringBell(client));
    this.onMessage("ready_for_next_round", (client) => this.readyForNextRound(client));
    this.onMessage("end_game", (client) => this.endGame(client));
    this.onMessage("kick_player", (client, message: { playerId?: string }) => this.kickPlayer(client, message));
    this.onMessage("request_inventory_view", (client) => {
      if (this.inventories.size > 0) this.sendInventoryViewTo(client);
    });
    this.onMessage("chat", (client, message: { text?: string; emote?: string }) => {
      const text = typeof message.text === "string" ? message.text.trim().slice(0, 120) : "";
      const emote = ["mitsuhiko", "moo", "nana"].includes(message.emote ?? "") ? message.emote : "";
      if (!text && !emote) return;
      this.broadcast("chat", { playerId: client.sessionId, name: this.playerName(client.sessionId), text, emote, ts: Date.now() });
    });
  }

  // 刷新页面/短暂掉线：标记离线并保留座位，等待 120 秒内重连
  onDrop(client: Client) {
    const player = this.state.players.find((item) => item.id === client.sessionId);
    if (player) player.connected = false;
    this.state.message = `${player?.name ?? "玩家"} 连接断开，等待重连…`;
    this.allowReconnection(client, 120);
  }

  onReconnect(client: Client) {
    const player = this.state.players.find((item) => item.id === client.sessionId);
    if (player) player.connected = true;
    this.state.message = `${player?.name ?? "玩家"} 重新连接`;
    // 库存视图是进局时点对点下发的，重连后客户端没有这份数据，需要补发
    if (this.inventories.size > 0) this.sendInventoryViews();
  }

  onLeave(client: Client) {
    const player = this.state.players.find((item) => item.id === client.sessionId);
    if (player) player.connected = false;
    this.state.message = `${player?.name ?? "玩家"} 离开了房间`;
  }

  // 从座位列表移除玩家（踢人、同 clientId 重复连接的旧座位）
  private removePlayerSeat(sessionId: string) {
    const index = this.state.players.findIndex((item) => item.id === sessionId);
    if (index >= 0) this.state.players.splice(index, 1);
  }

  // 房主在大厅踢人：仅限 lobby 阶段，不能踢自己
  private kickPlayer(client: Client, message: { playerId?: string } = {}) {
    if (this.state.phase !== "lobby") return;
    if (client.sessionId !== this.state.players[0]?.id) return;
    const targetId = message.playerId ?? "";
    if (!targetId || targetId === client.sessionId) return;
    const target = this.clients.find((item) => item.sessionId === targetId);
    const name = this.playerName(targetId);
    this.removePlayerSeat(targetId);
    if (target) {
      target.send("room_closed", { message: "你已被房主移出房间" });
      target.leave();
    }
    this.state.message = `${name} 已被房主移出房间`;
  }

  private startGame(client: Client, message: { startPlayerId?: string } = {}) {
    if (this.state.phase !== "lobby") return;
    if (client.sessionId !== this.state.players[0]?.id) {
      this.state.message = "只有房主可以开始游戏";
      return;
    }
    if (this.state.players.length < 2) {
      this.state.message = "至少需要 2 名玩家才能开始";
      return;
    }
    const requestedStarter = this.state.players.find((player) => player.id === message.startPlayerId)?.id;
    this.startRound(requestedStarter ?? this.state.players[0].id);
  }

  private startRound(startPlayerId: string) {
    this.deck = shuffle(createDevDeck());
    this.orders = [];
    this.lastOrderPlayerId = "";
    this.pendingCard = null;
    this.inventories.clear();
    this.state.orders.clear();
    this.state.readyPlayerIds.clear();
    this.state.round += 1;
    this.state.phase = "playing";
    this.state.currentPlayerId = startPlayerId;
    this.clearPendingCard();

    for (const player of this.state.players) {
      const card = this.deck.pop();
      if (!card) throw new Error("牌堆不足，无法发放库存卡");
      this.inventories.set(player.id, card);
      player.connected = true;
    }
    if (this.state.players.length === 2) {
      const dummyCard = this.deck.pop();
      if (!dummyCard) throw new Error("牌堆不足，无法发放双人局公共库存牌");
      this.inventories.set(DUMMY_INVENTORY_ID, dummyCard);
    }
    this.sendInventoryViews();
    this.state.message = `第 ${this.state.round} 轮开始，轮到 ${this.playerName(startPlayerId)}`;
    this.broadcast("turn_started", { playerId: startPlayerId, round: this.state.round, roundStart: true });
  }

  private drawCard(client: Client) {
    if (this.state.phase !== "playing" || client.sessionId !== this.state.currentPlayerId) return;
    const card = this.deck.pop();
    if (!card) {
      this.state.message = "牌堆已空，请敲铃结算";
      return;
    }
    this.pendingCard = card;
    this.state.pendingCardId = card.id;
    if (card.kind === "fruit") {
      this.state.phase = "choosing_order";
      this.state.pendingCardKind = "fruit";
      this.state.pendingLeftFruit = card.left.fruit;
      this.state.pendingLeftCount = card.left.count;
      this.state.pendingRightFruit = card.right.fruit;
      this.state.pendingRightCount = card.right.count;
      this.state.message = `${this.playerName(client.sessionId)} 请选择订单的一侧`;
    } else {
      const targets = this.orders.filter((order) => !order.gorillaCardId);
      if (targets.length === 0) {
        // 抽到猩猩牌但没有可翻转的订单：先把牌展示给所有人看，停顿一下再跳过，避免莫名其妙换人的困惑
        this.state.phase = "gorilla_skip";
        this.state.pendingCardKind = `gorilla:${card.gorilla}`;
        this.state.message = `${this.playerName(client.sessionId)} 抽到大猩猩卡，但没有可翻转的订单，自动跳过`;
        this.clock.setTimeout(() => {
          if (this.state.phase === "gorilla_skip") this.advanceTurn(client.sessionId);
        }, 2600);
        return;
      }
      this.state.phase = "choosing_gorilla";
      this.state.pendingCardKind = `gorilla:${card.gorilla}`;
      this.state.message = `${this.playerName(client.sessionId)} 请选择要翻转的订单`;
    }
  }

  private chooseOrderSide(client: Client, message: { side?: "left" | "right" }) {
    if (this.state.phase !== "choosing_order" || client.sessionId !== this.state.currentPlayerId) return;
    if (!this.pendingCard || this.pendingCard.kind !== "fruit" || (message.side !== "left" && message.side !== "right")) return;
    this.orders.push({ cardId: this.pendingCard.id, playerId: client.sessionId, side: message.side, card: this.pendingCard });
    const selected = message.side === "left" ? this.pendingCard.left : this.pendingCard.right;
    this.state.orders.push(this.publicOrder(this.orders[this.orders.length - 1]));
    this.lastOrderPlayerId = client.sessionId;
    this.advanceTurn(client.sessionId);
  }

  private chooseGorillaTarget(client: Client, message: { orderIndex?: number }) {
    if (this.state.phase !== "choosing_gorilla" || client.sessionId !== this.state.currentPlayerId) return;
    if (!this.pendingCard || this.pendingCard.kind !== "gorilla") return;
    const index = message.orderIndex ?? -1;
    const target = this.orders[index];
    if (!target || target.gorillaCardId) return;
    target.side = target.side === "left" ? "right" : "left";
    target.gorillaCardId = this.pendingCard.id;
    const selected = target.side === "left" ? target.card.left : target.card.right;
    this.state.orders[index] = this.publicOrder(target);
    this.lastOrderPlayerId = client.sessionId;
    this.advanceTurn(client.sessionId);
  }

  private advanceTurn(previousPlayerId: string) {
    this.pendingCard = null;
    this.clearPendingCard();
    this.state.phase = "playing";
    this.state.currentPlayerId = nextPlayerId(this.state.players.map((player) => player.id), previousPlayerId);
    this.state.message = `轮到 ${this.playerName(this.state.currentPlayerId)}`;
    this.broadcast("turn_started", { playerId: this.state.currentPlayerId, round: this.state.round });
  }

  private ringBell(client: Client) {
    if (this.state.phase !== "playing" || client.sessionId !== this.state.currentPlayerId) return;
    if (this.orders.length === 0) {
      this.state.message = "至少完成一张订单后才能敲铃";
      return;
    }
    const inventory = [...this.inventories.values()];
    const result = calculateOrders(this.orders, inventory);
    const penalizedPlayerId = result.overstocked && this.lastOrderPlayerId ? this.lastOrderPlayerId : client.sessionId;
    this.pendingBell = { result, penalizedPlayerId, ringerId: client.sessionId };
    this.state.phase = "bell_ringing";
    this.state.message = `${this.playerName(client.sessionId)} 摇响了铃，等待结算`;
    this.broadcast("bell_ringing", { duration: 3000, playerId: client.sessionId });
    setTimeout(() => this.finishBell(), 3000);
  }

  private finishBell() {
    if (this.state.phase !== "bell_ringing" || !this.pendingBell) return;
    const { result, penalizedPlayerId, ringerId } = this.pendingBell;
    this.pendingBell = null;
    const token = takeLowestAngerToken(this.availableTokens);
    this.availableTokens = this.availableTokens.filter((value) => value !== token);
    const penalized = this.state.players.find((player) => player.id === penalizedPlayerId);
    if (!penalized) return;
    penalized.anger += token;
    this.state.phase = "resolving";
    this.state.message = result.overstocked
      ? `${this.playerName(penalizedPlayerId)} 订单超过库存，获得 ${token} 点怒气`
      : `${this.playerName(ringerId)} 误敲铃，获得 ${token} 点怒气`;
    this.broadcast("reveal_result", {
      result,
      penalizedPlayerId,
      ringerPlayerId: ringerId,
      successfulCall: result.overstocked && penalizedPlayerId !== ringerId,
      token,
      inventories: Object.fromEntries(this.inventories.entries()),
      loser: penalizedPlayerId,
      revealRound: this.state.round,
    });

    if (isGameOver(penalized.anger)) {
      this.state.phase = "finished";
      this.state.currentPlayerId = "";
      this.clearPendingCard();
      this.state.message = "游戏结束：怒气达到 7 点";
      return;
    }
    this.pendingNextStarterId = nextPlayerId(this.state.players.map((player) => player.id), penalizedPlayerId);
    this.state.currentPlayerId = this.pendingNextStarterId;
    this.state.readyPlayerIds.clear();
    this.state.message = "请所有玩家查看本轮结算并准备下一轮";
  }

  private readyForNextRound(client: Client) {
    if (this.state.phase !== "resolving") return;
    if (!this.state.readyPlayerIds.includes(client.sessionId)) {
      this.state.readyPlayerIds.push(client.sessionId);
    }
    const onlinePlayers = this.state.players.filter((player) => player.connected);
    if (onlinePlayers.every((player) => this.state.readyPlayerIds.includes(player.id))) {
      const starter = this.pendingNextStarterId;
      this.pendingNextStarterId = "";
      this.startRound(starter);
    } else {
      this.state.message = `等待所有玩家准备（${this.state.readyPlayerIds.length}/${onlinePlayers.length}）`;
    }
  }

  // 房主随时可结束游戏：通知所有人后解散房间，所有玩家回到首页
  private endGame(client: Client) {
    if (client.sessionId !== this.state.players[0]?.id) {
      this.state.message = "只有房主可以结束游戏";
      return;
    }
    this.broadcast("room_closed", { message: "房主结束了本局游戏，房间已解散" });
    // 给客户端留出收消息的时间再断开
    this.clock.setTimeout(() => this.disconnect(), 600);
  }

  private sendInventoryViewTo(client: Client) {
    const visibleToClient = Object.fromEntries([...this.inventories.entries()].map(([playerId, card]) => [
      playerId,
      playerId === client.sessionId ? { hidden: true } : card,
    ]));
    client.send("inventory_view", visibleToClient);
  }

  private sendInventoryViews() {
    for (const client of this.clients) this.sendInventoryViewTo(client);
  }

  private clearPendingCard() {
    this.state.pendingCardId = "";
    this.state.pendingCardKind = "";
    this.state.pendingLeftFruit = "";
    this.state.pendingLeftCount = 0;
    this.state.pendingRightFruit = "";
    this.state.pendingRightCount = 0;
  }

  private publicOrder(order: OrderEntry) {
    return JSON.stringify({
      cardId: order.cardId,
      left: order.card.left,
      right: order.card.right,
      selectedSide: order.side,
      gorillaKind: order.gorillaCardId ? this.gorillaName(order.gorillaCardId) : "",
    });
  }

  private gorillaName(cardId: string) {
    return cardId.replace("gorilla-", "");
  }

  private playerName(playerId: string) {
    return this.state.players.find((player) => player.id === playerId)?.name ?? "玩家";
  }
}
