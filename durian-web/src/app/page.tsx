"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import dynamic from "next/dynamic";
import { Client, Room } from "@colyseus/sdk";

const TableScene = dynamic(() => import("../components/TableScene").then((module) => module.TableScene), { ssr: false });

type Player = { id: string; name: string; connected: boolean; anger: number };
type RoomState = {
  roomCode: string;
  phase: string;
  currentPlayerId: string;
  players: Player[];
  orders: string[];
  message: string;
  pendingCardKind: string;
  pendingLeftFruit: string;
  pendingLeftCount: number;
  pendingRightFruit: string;
  pendingRightCount: number;
  round: number;
  readyPlayerIds: string[];
};

type InventoryCardView = {
  hidden?: boolean;
  kind?: "fruit" | "gorilla";
  left?: { fruit: string; count: number };
  right?: { fruit: string; count: number };
  gorilla?: string;
};

type RevealPayload = {
  revealRound?: number;
  result?: {
    allOrders?: unknown[];
    invalidOrders?: unknown[];
    overloadedOrders?: unknown[];
    exceededFruits?: string[];
  };
  inventories?: Record<string, unknown>;
  penalizedPlayerId?: string;
  ringerPlayerId?: string;
  successfulCall?: boolean;
  token?: number;
};

type TurnStartedPayload = { playerId?: string; round?: number; roundStart?: boolean };
type ChatPayload = { playerId?: string; name?: string; text?: string; emote?: string; ts?: number };
type ChatMessage = ChatPayload & { id: string };

function EffectParticles() {
  return <div className="effect-particles" aria-hidden="true">
    {Array.from({ length: 24 }, (_, index) => <i key={index} style={{ "--particle-index": index } as CSSProperties} />)}
  </div>;
}

function RoundEffect({ kind, token }: { kind: "penalty" | "success"; token?: number }) {
  const penalty = kind === "penalty";
  return <div className={`round-effect ${penalty ? "penalty-effect" : "success-effect"}`} role="alert" aria-live="assertive">
    <EffectParticles />
    {penalty
      ? <div className="effect-token" aria-hidden="true"><img src="/assets/manager-token.png" alt="" draggable={false} /><b>+{token ?? 0}</b></div>
      : <div className="effect-burst" aria-hidden="true">✓</div>}
    <strong>{penalty ? "YOU GOT PENALIZED" : "NICE CALL!"}</strong>
    <span>{penalty ? "愤怒经理板块已收入囊中" : "成功抓到超额订单"}</span>
  </div>;
}

function cardLabel(value: unknown) {
  const card = value as InventoryCardView | undefined;
  if (!card || card.hidden) return "你的库存\n不可见";
  if (card.kind === "fruit" && card.left && card.right) {
    return `${card.left.fruit} ${card.left.count}\n${card.right.fruit} ${card.right.count}`;
  }
  if (card.kind === "gorilla") return `大猩猩\n${card.gorilla ?? ""}`;
  return "库存卡";
}

const fruitImages: Record<string, string> = {
  strawberry: "/assets/fruit-strawberry.png",
  banana: "/assets/fruit-banana.png",
  grape: "/assets/fruit-grape.png",
  durian: "/assets/fruit-durian.png",
};
const gorillaImages: Record<string, string> = {
  mitsuhiko: "/assets/gorilla-mitsuhiko.png",
  moo: "/assets/gorilla-moo.png",
  nana: "/assets/gorilla-nana.png",
};
const fruitCardPool = { 1: "fruit-count-1", 2: "fruit-count-2", 3: "fruit-count-3" } as const;

function FruitLabel({ fruit, count }: { fruit: string; count: number }) {
  const countClass = fruitCardPool[count as 1 | 2 | 3] ?? fruitCardPool[1];
  return <span className={`fruit-label fruit-${fruit} ${countClass}`}>
    <span className="fruit-pips" aria-label={`${fruit} ${count}`}>
      {Array.from({ length: count }, (_, index) => <img className="fruit-icon" src={fruitImages[fruit] ?? fruitImages.strawberry} alt="" aria-hidden="true" key={`${fruit}-${index}`} draggable={false} />)}
    </span>
  </span>;
}

type FruitSideView = { fruit: string; count: number };

function FruitCardFace({
  top,
  bottom,
  onTop,
  onBottom,
}: {
  top: FruitSideView;
  bottom: FruitSideView;
  onTop?: () => void;
  onBottom?: () => void;
}) {
  const renderHalf = (side: FruitSideView, position: "top" | "bottom", onClick?: () => void) => {
    const content = <FruitLabel fruit={side.fruit} count={side.count} />;
    return onClick ? <button type="button" className={`fruit-card-half ${position}`} onClick={onClick}>{content}</button> : <div className={`fruit-card-half ${position}`}>{content}</div>;
  };
  return <div className="fruit-card-face">
    {renderHalf(top, "top", onTop)}
    {renderHalf(bottom, "bottom", onBottom)}
  </div>;
}

const gorillaEffects: Record<string, string> = {
  mitsuhiko: "大哥米奇：库存中时，所有包含 3 个水果的订单无效。",
  moo: "二哥墨菲：没有特殊效果。",
  nana: "妹妹汉娜：库存中时，所有香蕉订单无效。",
};

function GorillaCardFace({ gorilla }: { gorilla?: string }) {
  return <div className="gorilla-card-face" tabIndex={0} aria-label="悬浮查看大猩猩卡效果">
    <img className="gorilla-card-img" src={gorillaImages[gorilla ?? ""] ?? gorillaImages.moo} alt={`大猩猩卡 ${gorilla ?? ""}`} draggable={false} />
    <span className="gorilla-tooltip">{gorillaEffects[gorilla ?? ""] ?? "未知大猩猩卡效果"}</span>
  </div>;
}

function CardFace({ value }: { value: unknown }) {
  const card = value as InventoryCardView | undefined;
  if (card?.kind === "fruit" && card.left && card.right) {
    return <FruitCardFace top={card.left} bottom={card.right} />;
  }
  if (card?.kind === "gorilla") return <GorillaCardFace gorilla={card.gorilla} />;
  return <>{cardLabel(value).split("\n").map((line) => <span key={line}>{line}</span>)}</>;
}

function DrawPile({ isDrawing, disabled, onDraw }: { isDrawing: boolean; disabled: boolean; onDraw: () => void }) {
  return <button className={`draw-pile ${isDrawing ? "is-drawing" : ""} ${disabled ? "" : "can-draw"}`} onClick={onDraw} disabled={disabled || isDrawing} aria-label="点击桌面牌堆抽牌">
    <span className="draw-pile-cards" aria-hidden="true"><i /><i /><i /></span>
    <span>{isDrawing ? "抽取中" : "牌堆"}</span>
  </button>;
}

function orderLabel(value: unknown) {
  const order = value as { side?: "left" | "right"; card?: InventoryCardView } | undefined;
  const side = order?.side === "right" ? order.card?.right : order?.card?.left;
  return side ? `${side.fruit} × ${side.count}` : "订单牌";
}

function orderKey(value: unknown) {
  const order = value as { cardId?: string; side?: string } | undefined;
  return `${order?.cardId ?? ""}:${order?.side ?? ""}`;
}

type PublicOrder = {
  cardId?: string;
  left?: { fruit: string; count: number };
  right?: { fruit: string; count: number };
  selectedSide?: "left" | "right";
  side?: "left" | "right";
  gorillaKind?: string;
  gorillaCardId?: string;
};

function parsePublicOrder(value: unknown): PublicOrder {
  const parsed = (typeof value === "string" ? (() => { try { return JSON.parse(value); } catch { return {}; } })() : value) as PublicOrder & { card?: PublicOrder };
  const normalized = parsed.left && parsed.right ? parsed : { ...parsed, ...(parsed.card ?? {}) };
  return { ...normalized, selectedSide: normalized.selectedSide ?? (parsed as PublicOrder).side ?? "left" };
}

function OrderCard({ value, exploded = false, invalid = false, entering = false, flipping = false, revealDelay, selectable = false, onSelect }: { value: unknown; exploded?: boolean; invalid?: boolean; entering?: boolean; flipping?: boolean; revealDelay?: number; selectable?: boolean; onSelect?: () => void }) {
  const order = parsePublicOrder(value);
  if (!order.left || !order.right) return <div className={`card reveal-order-card ${exploded ? "order-exploded" : invalid ? "order-invalid" : ""}`}>{String(value)}</div>;
  const kept = order.selectedSide === "right" ? order.right : order.left;
  const discarded = order.selectedSide === "right" ? order.left : order.right;
  const hasGorilla = Boolean(order.gorillaKind || order.gorillaCardId);
  return <div
    className={`order-item ${hasGorilla ? "has-gorilla" : ""} ${entering ? "order-enter" : ""} ${flipping ? "order-flip" : ""} ${revealDelay !== undefined ? "reveal-flip" : ""} ${selectable ? "gorilla-target" : ""}`}
    style={revealDelay !== undefined ? { animationDelay: `${revealDelay}ms` } : undefined}
    onClick={selectable ? onSelect : undefined}
    role={selectable ? "button" : undefined}
    tabIndex={selectable ? 0 : undefined}
    onKeyDown={selectable ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect?.(); } } : undefined}
  >
    <div className={`order-card-full order-column ${exploded ? "order-exploded" : invalid ? "order-invalid" : ""}`}>
      <FruitCardFace top={discarded} bottom={kept} />
    </div>
    {(order.gorillaKind || order.gorillaCardId) && <div className="gorilla-side">大猩猩<br />{order.gorillaKind ?? order.gorillaCardId?.replace("gorilla-", "")}</div>}
  </div>;
}

function RevealTable({ reveal, players, self, opponentSeats }: { reveal: RevealPayload; players: Player[]; self?: Player; opponentSeats: { player: Player; offset: number }[] }) {
  return <div className="reveal-table-stage">
    {opponentSeats.map(({ player }, index) => <div className="reveal-arc-seat" key={player.id} style={arcPosition(index, opponentSeats.length)}>
      <div className="seat-name">{player.name}</div>
      <div className="inventory-card"><CardFace value={reveal.inventories?.[player.id]} /></div>
      <div className="seat-anger"><AngerBadge anger={player.anger} /></div>
    </div>)}
    {self && <div className="reveal-center-seat">
      <div className="seat-name">{self.name}（你）</div>
      <div className="inventory-card"><CardFace value={reveal.inventories?.[self.id]} /></div>
      <div className="seat-anger"><AngerBadge anger={self.anger} /></div>
    </div>}
    {players.length === 2 && Boolean(reveal.inventories?.["__dummy_inventory__"]) && <div className="reveal-dummy-seat">
      <div className="seat-name">公共库存</div>
      <div className="inventory-card"><CardFace value={reveal.inventories?.["__dummy_inventory__"]} /></div>
    </div>}
    <div className="revealed-order-stack">
      <div className="stack-title">本轮订单牌</div>
      <div className="order-display">
        <div className="orders order-stack">
          {(reveal.result?.allOrders ?? []).map((order, index) => {
          const exploded = reveal.result?.overloadedOrders?.some((bad) => orderKey(bad) === orderKey(order));
          const invalid = reveal.result?.invalidOrders?.some((bad) => orderKey(bad) === orderKey(order));
          return <OrderCard value={order} exploded={exploded} invalid={invalid} key={`reveal-order-${index}`} />;
          })}
        </div>
        <div className="order-board-marks"><b>×</b><b>√</b></div>
      </div>
    </div>
  </div>;
}

function arcPosition(index: number, total: number, centerY = 45, radiusX = 42, radiusY = 25) {
  const angle = total === 1 ? 270 : 205 + (130 * index) / (total - 1);
  const radians = (angle * Math.PI) / 180;
  return {
    left: `${50 + Math.cos(radians) * radiusX}%`,
    top: `${centerY + Math.sin(radians) * radiusY}%`,
  };
}

function relativeOpponentSeats(players: Player[], selfId: string) {
  const selfIndex = players.findIndex((player) => player.id === selfId);
  if (selfIndex < 0) return [];
  const opponentCount = players.length - 1;
  const offsets = Array.from({ length: opponentCount }, (_, index) => index + 1);
  return offsets.map((offset) => ({
    offset,
    player: players[(selfIndex + offset + players.length) % players.length],
  }));
}

function snapshotState(source: Partial<RoomState>): RoomState {
  return {
    roomCode: source.roomCode ?? "",
    phase: source.phase ?? "lobby",
    currentPlayerId: source.currentPlayerId ?? "",
    players: Array.from(source.players ?? []).map((player) => ({
      id: player.id,
      name: player.name,
      connected: player.connected,
      anger: player.anger ?? 0,
    })),
    orders: Array.from(source.orders ?? []),
    message: source.message ?? "正在同步房间状态",
    pendingCardKind: source.pendingCardKind ?? "",
    pendingLeftFruit: source.pendingLeftFruit ?? "",
    pendingLeftCount: source.pendingLeftCount ?? 0,
    pendingRightFruit: source.pendingRightFruit ?? "",
    pendingRightCount: source.pendingRightCount ?? 0,
    round: source.round ?? 0,
    readyPlayerIds: Array.from(source.readyPlayerIds ?? []),
  };
}

// 默认连「和网页同一台主机」的 2567 端口，这样手机用局域网 IP 打开页面也能连上电脑上的服务器
const SERVER_URL = (process.env.NEXT_PUBLIC_COLYSEUS_URL ?? (typeof window !== "undefined" ? `ws://${window.location.hostname}:2567` : "ws://localhost:2567")).replace(/\/+$/, "");
const SERVER_HTTP_URL = SERVER_URL.replace(/^ws/, "http");

// 持久匿名 ID（localStorage）：帐号系统的过渡形态，未来会被登录后的 userId 取代
function getClientId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("durian.clientId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("durian.clientId", id);
  }
  return id;
}

// ---- WebAudio 合成音效（无需音频资源文件）----
let sharedAudioCtx: AudioContext | null = null;
function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!sharedAudioCtx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    sharedAudioCtx = new Ctor();
  }
  if (sharedAudioCtx.state === "suspended") void sharedAudioCtx.resume();
  return sharedAudioCtx;
}

function playDing(ctx: AudioContext, at: number, freq: number, gainValue: number) {
  for (const [ratio, partialGain] of [[1, 1], [2.76, 0.42], [5.4, 0.18]] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq * ratio;
    gain.gain.setValueAtTime(gainValue * partialGain, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 1.5);
  }
}

function playBellSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  playDing(ctx, now, 660, 0.5);
  playDing(ctx, now + 0.42, 660, 0.34);
  playDing(ctx, now + 0.8, 660, 0.2);
}

function playGameOverSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  playDing(ctx, now, 392, 0.4);
  playDing(ctx, now + 0.5, 261.6, 0.45);
}

function AngerBadge({ anger }: { anger: number }) {
  return <span className="anger-badge" aria-label={`怒气 ${anger}/7`}>
    <img src="/assets/manager-token.png" alt="" draggable={false} />
    <b>{anger}</b>
  </span>;
}

export default function Home() {
  const [room, setRoom] = useState<Room<RoomState> | null>(null);
  const [state, setState] = useState<RoomState | null>(null);
  const [name, setName] = useState("玩家");
  const [roomId, setRoomId] = useState("");
  const [startPlayerId, setStartPlayerId] = useState("");
  const [error, setError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [inventoryView, setInventoryView] = useState<Record<string, unknown>>({});
  const [revealHistory, setRevealHistory] = useState<RevealPayload[]>([]);
  const [showRoomCodeModal, setShowRoomCodeModal] = useState(false);
  const [roomCodeCopied, setRoomCodeCopied] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [turnNotice, setTurnNotice] = useState(false);
  const [roundEffect, setRoundEffect] = useState<{ kind: "penalty" | "success"; token?: number } | null>(null);
  const [gorillaFlipIndex, setGorillaFlipIndex] = useState(-1);
  const [gameStartNotice, setGameStartNotice] = useState(false);
  const [handDown, setHandDown] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatOpen, setChatOpen] = useState(true);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  // 入场动画：以我第一次看到的名单为基准（他们安静地站着），
  // 只有我自己和之后新加入的人播闪电登场
  const seenPlayerIdsRef = useRef<Set<string> | null>(null);
  const arriveIdsRef = useRef<Set<string>>(new Set());
  const turnNoticeTimerRef = useRef<number | null>(null);
  const roundEffectTimerRef = useRef<number | null>(null);
  const gorillaFlipTimerRef = useRef<number | null>(null);
  const gameStartTimerRef = useRef<number | null>(null);
  const gameStartShownRef = useRef(false);
  const bellPlayedRef = useRef(false);
  const gameOverPlayedRef = useRef(false);
  const prevOrdersRef = useRef<string[]>([]);

  useEffect(() => {
    return () => { void room?.leave(false); };
  }, [room]);

  // 刷新页面后自动尝试重连回之前的房间（token 存在 sessionStorage，关掉标签页即失效）
  const reconnectTriedRef = useRef(false);
  const roomClosedMessageRef = useRef<string | null>(null);
  // 同步防重入：双击“加入/创建房间”会在 setState 生效前触发第二次 connect
  const connectingRef = useRef(false);
  useEffect(() => {
    if (reconnectTriedRef.current) return;
    reconnectTriedRef.current = true;
    const token = sessionStorage.getItem("durian-room-token");
    if (!token) return;
    void (async () => {
      const ok = await connect((client) => client.reconnect<RoomState>(token));
      if (!ok) sessionStorage.removeItem("durian-room-token");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (turnNoticeTimerRef.current) window.clearTimeout(turnNoticeTimerRef.current);
      if (roundEffectTimerRef.current) window.clearTimeout(roundEffectTimerRef.current);
      if (gorillaFlipTimerRef.current) window.clearTimeout(gorillaFlipTimerRef.current);
      if (gameStartTimerRef.current) window.clearTimeout(gameStartTimerRef.current);
    };
  }, []);

  // 大猩猩卡会把某张订单翻面：对比前后订单快照，找出刚被翻转的那张并播放翻转动画
  useEffect(() => {
    const current = state?.orders ?? [];
    const previous = prevOrdersRef.current;
    prevOrdersRef.current = current;
    const flippedIndex = current.findIndex((order, index) => {
      if (previous[index] === undefined || previous[index] === order) return false;
      const before = parsePublicOrder(previous[index]);
      const next = parsePublicOrder(order);
      return before.cardId === next.cardId && !before.gorillaKind && Boolean(next.gorillaKind);
    });
    if (flippedIndex < 0) return;
    if (gorillaFlipTimerRef.current) window.clearTimeout(gorillaFlipTimerRef.current);
    setGorillaFlipIndex(flippedIndex);
    gorillaFlipTimerRef.current = window.setTimeout(() => setGorillaFlipIndex(-1), 900);
  }, [state?.orders]);

  // 摇铃 / 终局音效：阶段切换时各播放一次
  useEffect(() => {
    if (state?.phase === "bell_ringing" && !bellPlayedRef.current) {
      bellPlayedRef.current = true;
      playBellSound();
    }
    if (state?.phase !== "bell_ringing") bellPlayedRef.current = false;
  }, [state?.phase]);

  useEffect(() => {
    if (state?.phase === "finished" && !gameOverPlayedRef.current) {
      gameOverPlayedRef.current = true;
      playGameOverSound();
    }
  }, [state?.phase]);

  // ESC 暂时放下举着的牌，看看场上形势；再按一次举回
  const focusActive = Boolean(state && room && (state.phase === "choosing_order" || state.phase === "choosing_gorilla") && state.currentPlayerId === room.sessionId);
  useEffect(() => {
    if (!focusActive) { setHandDown(false); return; }
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setHandDown((down) => !down); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusActive]);

  async function connect(connectAction: (client: Client) => Promise<Room<RoomState>>): Promise<boolean> {
    if (connectingRef.current) return false;
    connectingRef.current = true;
    setIsConnecting(true);
    setError("");
    roomClosedMessageRef.current = null;
    try {
      const client = new Client(SERVER_URL);
      const joined = await connectAction(client);
      setRoom(joined);
      setRoomId(joined.state.roomCode || "");
      setStartPlayerId(joined.sessionId);
      setRevealHistory([]);
      prevOrdersRef.current = [];
      setGorillaFlipIndex(-1);
      gameStartShownRef.current = false;
      bellPlayedRef.current = false;
      gameOverPlayedRef.current = false;
      const markPlayers = (list: Player[]) => {
        const ids = list.map((player) => player.id);
        if (seenPlayerIdsRef.current === null) {
          // 名单里还没有我时，说明状态尚未同步完整，先不立基准，
          // 否则之后完整名单到达时会把所有老玩家误判成新登场
          if (!ids.includes(joined.sessionId)) return;
          // 我第一次看到完整名单：早就在场的人安静站着，只有我自己算新登场
          seenPlayerIdsRef.current = new Set(ids);
          arriveIdsRef.current = new Set([joined.sessionId]);
        } else {
          for (const id of ids) {
            if (!seenPlayerIdsRef.current.has(id)) {
              seenPlayerIdsRef.current.add(id);
              arriveIdsRef.current.add(id);
            }
          }
        }
      };
      const initialSnapshot = snapshotState(joined.state);
      markPlayers(initialSnapshot.players);
      setState(initialSnapshot);
      joined.onStateChange((nextState) => {
        const snap = snapshotState(nextState);
        markPlayers(snap.players);
        setState(snap);
      });
      joined.onMessage("inventory_view", (view: Record<string, unknown>) => setInventoryView(view));
      joined.onMessage("turn_started", (payload: TurnStartedPayload) => {
        // 只在真正的开局瞬间（服务端标记 roundStart）展示 GAME START，
        // 刷新重连后收到的普通回合广播不再重播
        if (payload.round === 1 && payload.roundStart && !gameStartShownRef.current) {
          gameStartShownRef.current = true;
          setGameStartNotice(true);
          if (gameStartTimerRef.current) window.clearTimeout(gameStartTimerRef.current);
          gameStartTimerRef.current = window.setTimeout(() => setGameStartNotice(false), 1900);
        }
        if (payload.playerId !== joined.sessionId) return;
        const delay = payload.round === 1 && payload.roundStart ? 1950 : 0;
        window.setTimeout(() => {
          if (turnNoticeTimerRef.current) window.clearTimeout(turnNoticeTimerRef.current);
          setTurnNotice(true);
          turnNoticeTimerRef.current = window.setTimeout(() => setTurnNotice(false), 1800);
        }, delay);
      });
      joined.onMessage("reveal_result", (payload: RevealPayload) => {
        setRevealHistory([payload]);
        const isPenalized = payload.penalizedPlayerId === joined.sessionId;
        const isSuccessfulRinger = Boolean(payload.successfulCall) && payload.ringerPlayerId === joined.sessionId;
        if (!isPenalized && !isSuccessfulRinger) return;
        if (roundEffectTimerRef.current) window.clearTimeout(roundEffectTimerRef.current);
        setRoundEffect(isPenalized ? { kind: "penalty", token: payload.token } : { kind: "success", token: payload.token });
        roundEffectTimerRef.current = window.setTimeout(() => setRoundEffect(null), isPenalized ? 3000 : 2600);
      });
      joined.onMessage("chat", (payload: ChatPayload) => {
        setChatMessages((list) => [...list.slice(-49), { ...payload, id: `${payload.ts ?? Date.now()}-${Math.random().toString(36).slice(2, 8)}` }]);
      });
      joined.onMessage("room_closed", (payload: { message?: string }) => {
        // 房主解散了房间：清掉重连 token，回到首页（onLeave 会随后触发，用同一条文案）
        roomClosedMessageRef.current = payload.message ?? "房间已解散";
        sessionStorage.removeItem("durian-room-token");
        leaveRoom();
      });
      joined.onError((code, message) => setError(`服务器错误 ${code}: ${message}`));
      joined.onLeave((code) => setError(roomClosedMessageRef.current ?? `连接已结束（${code}）`));
      sessionStorage.setItem("durian-room-token", joined.reconnectionToken);
      // 中途进房/重连时主动拉取库存视图（服务端的补发可能早于 onMessage 注册，主动请求最稳）
      if (initialSnapshot.phase !== "lobby") joined.send("request_inventory_view");
      connectingRef.current = false;
      setIsConnecting(false);
      return true;
    } catch (err) {
      // 完整错误打到 Console 便于诊断（重连失败的真实原因要看这里）
      console.error("[durian] 连接失败:", err);
      setError(err instanceof Error ? err.message : "无法连接游戏服务器");
      connectingRef.current = false;
      setIsConnecting(false);
      return false;
    }
  }

  function createRoom() {
    void (async () => {
      if (await connect((client) => client.create<RoomState>("durian", { name: name || "玩家", clientId: getClientId() }))) {
        setRoomCodeCopied(false);
        setShowRoomCodeModal(true);
      }
    })();
  }

  function joinRoom() {
    const code = roomId.trim();
    if (!/^\d{8}$/.test(code)) {
      setError("请输入 8 位数字房间号");
      return;
    }
    void connect(async (client) => {
      const response = await fetch(`${SERVER_HTTP_URL}/api/rooms/${code}`);
      const result = await response.json() as { roomId?: string; error?: string };
      if (!response.ok || !result.roomId) throw new Error(result.error ?? "找不到这个房间");
      return client.joinById<RoomState>(result.roomId, { name: name || "玩家", clientId: getClientId() });
    });
  }

  function send(type: "start_game" | "draw_card" | "ring_bell" | "choose_order_side" | "choose_gorilla_target" | "ready_for_next_round" | "end_game", payload?: object) {
    room?.send(type, payload);
  }

  function sendChatText(event: React.FormEvent) {
    event.preventDefault();
    const text = chatInput.trim();
    if (!room || !text) return;
    room.send("chat", { text });
    setChatInput("");
  }

  function sendEmote(emote: string) {
    room?.send("chat", { emote });
  }

  // 新消息或展开聊天时滚动到底部
  useEffect(() => {
    chatListRef.current?.scrollTo({ top: chatListRef.current.scrollHeight });
  }, [chatMessages, chatOpen]);

  function drawFromPile() {
    if (!room || !state || state.currentPlayerId !== room.sessionId || state.phase !== "playing" || isDrawing) return;
    setIsDrawing(true);
    window.setTimeout(() => {
      room.send("draw_card");
    }, 900);
    window.setTimeout(() => setIsDrawing(false), 1550);
  }

  function chooseOrderSide(side: "left" | "right") {
    if (!room || isPlacingOrder) return;
    setIsPlacingOrder(true);
    window.setTimeout(() => {
      room.send("choose_order_side", { side });
      setIsPlacingOrder(false);
    }, 520);
  }

  function leaveRoom() {
    sessionStorage.removeItem("durian-room-token");
    void room?.leave();
    setRoom(null);
    setState(null);
    setStartPlayerId("");
    setInventoryView({});
    setRevealHistory([]);
    setShowRoomCodeModal(false);
    setRoomCodeCopied(false);
    setError("");
    if (turnNoticeTimerRef.current) window.clearTimeout(turnNoticeTimerRef.current);
    if (roundEffectTimerRef.current) window.clearTimeout(roundEffectTimerRef.current);
    if (gorillaFlipTimerRef.current) window.clearTimeout(gorillaFlipTimerRef.current);
    if (gameStartTimerRef.current) window.clearTimeout(gameStartTimerRef.current);
    setTurnNotice(false);
    setRoundEffect(null);
    setGorillaFlipIndex(-1);
    setGameStartNotice(false);
    setChatMessages([]);
    setChatInput("");
    seenPlayerIdsRef.current = null;
    arriveIdsRef.current = new Set();
    gameStartShownRef.current = false;
    bellPlayedRef.current = false;
    gameOverPlayedRef.current = false;
    prevOrdersRef.current = [];
  }

  async function copyRoomCode() {
    if (!state?.roomCode) return;
    await navigator.clipboard.writeText(state.roomCode);
    setRoomCodeCopied(true);
  }

  const players = state?.players ?? [];
  const orders = state?.orders ?? [];
  const pendingGorilla = state?.pendingCardKind.startsWith("gorilla:") ? state.pendingCardKind.slice("gorilla:".length) : "";
  const self = players.find((player) => player.id === room?.sessionId);
  const opponentSeats = room ? relativeOpponentSeats(players, room.sessionId) : [];
  // 围观别人抽牌/选牌时，牌从对方座位沿半径往桌心方向收（不压住他的库存牌），手按座位角度旋转着伸向座位
  const watchingPlayerIndex = state && room ? opponentSeats.findIndex((seat) => seat.player.id === state.currentPlayerId) : -1;
  let watchingCardStyle: CSSProperties | undefined;
  let watchingHandStyle: CSSProperties | undefined;
  if (watchingPlayerIndex >= 0) {
    const seat = arcPosition(watchingPlayerIndex, opponentSeats.length, 24, 36, 8);
    const seatX = parseFloat(seat.left);
    const seatY = parseFloat(seat.top);
    const pull = 0.42; // 从座位往桌心收的比例
    const cardX = seatX + (50 - seatX) * pull;
    const cardY = seatY + (48 - seatY) * pull;
    watchingCardStyle = { left: `${cardX}%`, top: `${cardY}%` };
    // 手默认从牌的正下方伸出，旋转到"指向座位"的方向后再沿该方向偏移
    const angle = Math.atan2(-(seatX - cardX), seatY - cardY) * 180 / Math.PI;
    watchingHandStyle = { left: "50%", top: "50%", bottom: "auto", transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(130px)` };
  }
  const lastReveal = revealHistory[revealHistory.length - 1];
  const isHost = players[0]?.id === room?.sessionId;

  return (
    <main className="page">
      <div className="shell">
        <div className="eyebrow">Fruit Shop Party Game</div>
        <h1>Durian</h1>
        <p className="subtitle">和朋友围坐一桌，开一家热热闹闹的榴莲水果店。</p>

        {!room && <div className="home-hero">
          <div className="home-fruits" aria-hidden="true">
            <img src="/assets/fruit-durian.png" alt="" className="hf hf-durian" draggable={false} />
            <img src="/assets/fruit-strawberry.png" alt="" className="hf hf-strawberry" draggable={false} />
            <img src="/assets/fruit-banana.png" alt="" className="hf hf-banana" draggable={false} />
            <img src="/assets/fruit-grape.png" alt="" className="hf hf-grape" draggable={false} />
          </div>
          <section className="panel home-panel">
          <h2>创建或加入房间</h2>
          <p className="hint">先启动 durian-server，再点击下面的按钮。</p>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="你的昵称" style={{ padding: 11, borderRadius: 10, border: "1px solid #6b4a32", background: "#17120f", color: "#f7ead6", marginRight: 10 }} />
          <button onClick={createRoom} disabled={isConnecting}>创建房间</button>
          <div style={{ marginTop: 16 }}>
          <input value={roomId} onChange={(event) => setRoomId(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" maxLength={8} placeholder="8 位房间号" style={{ padding: 11, borderRadius: 10, border: "1px solid #6b4a32", background: "#17120f", color: "#f7ead6", marginRight: 10 }} />
            <button onClick={joinRoom} disabled={isConnecting}>{isConnecting ? "加入中…" : "加入房间"}</button>
          </div>
          </section>
        </div>}

        {error && <p className="status">{error}</p>}

        {state && room && state.phase === "lobby" && <section className="panel lobby-panel">
          <div className="lobby-title">
            <div>
              <div className="eyebrow">Private room</div>
              <h2>等待玩家加入</h2>
              <p className="hint">把 8 位房间号分享给朋友。所有玩家到齐后，由房主开始游戏。</p>
            </div>
            <div className="room-code">{state.roomCode}</div>
          </div>
          <div className="lobby-gorillas">
            {players.map((player, index) => {
              const gorilla = ["mitsuhiko", "moo", "nana"][index % 3];
              // 只有我自己（进房瞬间）和之后新加入的人播放闪电登场；早就在场的人安静站着
              const isNewArrival = arriveIdsRef.current.has(player.id);
              return <div className={`lobby-gorilla ${isNewArrival ? "arrive" : ""}`} key={player.id}>
                {isNewArrival && <i className="lightning" aria-hidden="true" />}
                <img src={`/assets/gorilla-${gorilla}.png`} alt={player.name} draggable={false} />
                <span className="lobby-gorilla-name">{player.name}{player.id === room.sessionId ? "（你）" : ""}{player.id === players[0]?.id ? " 👑" : ""}</span>
                {isHost && player.id !== room.sessionId && <button
                  type="button"
                  className="kick-button"
                  title={`将 ${player.name} 移出房间`}
                  onClick={() => { if (window.confirm(`确定把 ${player.name} 移出房间？`)) room.send("kick_player", { playerId: player.id }); }}
                >✕</button>}
              </div>;
            })}
          </div>
          {isHost && <label className="starter-select">第一轮起始玩家
            <select value={startPlayerId || players[0]?.id || ""} onChange={(event) => setStartPlayerId(event.target.value)}>
              {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select>
          </label>}
          <button onClick={() => send("start_game", { startPlayerId: startPlayerId || players[0]?.id })} disabled={!isHost || players.length < 2}>开始游戏</button>
          {!isHost && <p className="hint">等待房主开始游戏</p>}
        </section>}

        {state && room && state.phase === "finished" && <section className="panel finished-panel">
          <EffectParticles />
          <div className="finished-mark">✦</div>
          <div className="eyebrow">Game over</div>
          <h2>本局结束</h2>
          <p className="finished-message">{state.message}</p>
          {lastReveal?.penalizedPlayerId && <div className="loser-banner">
            输家：<strong>{players.find((player) => player.id === lastReveal.penalizedPlayerId)?.name ?? "玩家"}</strong>
            <span>获得 {lastReveal.token ?? 0} 点怒气</span>
          </div>}
          <div className="final-scores">
            {[...players].sort((a, b) => a.anger - b.anger).map((player, index) => <div className="final-score" key={player.id}>
              <span>{index + 1}. {player.name}{player.id === room.sessionId ? "（你）" : ""}</span>
              <strong><AngerBadge anger={player.anger} /></strong>
            </div>)}
          </div>
          <div className="reveal-section">
            <h3>上帝视角：全部库存牌</h3>
            <div className="reveal-inventories">
              {players.map((player) => <div className="reveal-player" key={player.id}>
                <div className="seat-name">{player.name}</div>
                <div className="inventory-card"><CardFace value={lastReveal?.inventories?.[player.id]} /></div>
              </div>)}
            </div>
          </div>
          <div className="reveal-section">
            <h3>结算明细</h3>
            <p className="hint">超出的水果：{lastReveal?.result?.exceededFruits?.join("、") || "无"}</p>
            <div className="reveal-orders">
              {(lastReveal?.result?.overloadedOrders ?? []).map((order, index) => <div className="reveal-order exploded" key={`bad-${index}`}>爆掉的订单：{orderLabel(order)}</div>)}
              {(lastReveal?.result?.invalidOrders ?? []).map((order, index) => <div className="reveal-order invalid" key={`invalid-${index}`}>特殊牌使订单无效：{orderLabel(order)}</div>)}
              {!lastReveal?.result?.overloadedOrders?.length && !lastReveal?.result?.invalidOrders?.length && <div className="hint">没有无效或超出的订单</div>}
            </div>
          </div>
          <button onClick={leaveRoom}>返回房间首页</button>
        </section>}

        {state && room && state.phase !== "lobby" && state.phase !== "finished" && <>
          <section className="game-surface">
          <div className="toolbar">
            <span className="status">第 {state.round} 轮 · {state.message}</span>
            {isHost && <button type="button" className="end-game-button" onClick={() => { if (window.confirm("确定结束本局游戏？所有玩家将回到大厅，可以重新开始。")) send("end_game"); }}>结束游戏</button>}
          </div>
          {state.phase === "bell_ringing" && <div className="bell-overlay" role="status" aria-live="assertive">
            <div className="bell-graphic" aria-hidden="true"><img className="bell-img" src="/assets/bell.png" alt="" draggable={false} /><i className="bell-ring" /><i className="bell-ring second" /></div>
            <strong>铃响了！</strong>
            <span>正在结算本轮订单</span>
          </div>}
          <p className="hint">房间号：{state.roomCode}（复制给另一个浏览器测试加入） · {isHost ? "你是房主" : "等待房主开始游戏"}</p>
          <section className="inventory-table">
            <div className="section-heading"><strong>{state.phase === "resolving" ? "本轮结算桌面" : "环桌库存"}</strong><span className="hint">你在圆心，其他玩家按顺时针顺序沿圆弧排列</span></div>
            {state.phase === "resolving" && lastReveal ? <>
              <div className="round-result-banner">
                <span>被处罚：<strong>{players.find((player) => player.id === lastReveal.penalizedPlayerId)?.name ?? "玩家"}</strong></span>
                <span>+{lastReveal.token ?? 0} 怒气</span>
                <span>超出：{lastReveal.result?.exceededFruits?.join("、") || "无"}</span>
              </div>
            </> : null}
            <div className="table-stage">
              <TableScene isDrawing={isDrawing} canDraw={state.currentPlayerId === room.sessionId && state.phase === "playing"} />
              <DrawPile isDrawing={isDrawing} disabled={state.currentPlayerId !== room.sessionId || state.phase !== "playing"} onDraw={drawFromPile} />
              <button type="button" className="table-bell" onClick={() => send("ring_bell")} disabled={state.currentPlayerId !== room.sessionId || state.phase !== "playing" || orders.length === 0} aria-label="摇铃结算">
                <img src="/assets/bell.png" alt="" draggable={false} />
              </button>
              <div className="felt-orders-zone">
                {state.phase === "choosing_gorilla" && state.currentPlayerId === room.sessionId && <div className="gorilla-choice-hint" role="status">抽到猩猩牌！点击选择一列订单，将它翻转 180°</div>}
                <div className="orders felt-orders">
                  <img className="order-board-stand" src="/assets/order-board.png" alt="" aria-hidden="true" draggable={false} />
                  {state.phase === "resolving" && lastReveal
                  ? (lastReveal.result?.allOrders ?? []).map((order, index) => <OrderCard value={order} exploded={Boolean(lastReveal.result?.overloadedOrders?.[0]) && orderKey(lastReveal.result?.overloadedOrders?.[0]) === orderKey(order)} invalid={false} revealDelay={index * 90} key={`resolved-order-${index}`} />)
                  : orders.map((order, index) => {
                    const choosingGorilla = state.phase === "choosing_gorilla" && state.currentPlayerId === room.sessionId;
                    return <OrderCard value={order} entering={isPlacingOrder && index === orders.length - 1} flipping={index === gorillaFlipIndex} selectable={choosingGorilla} onSelect={() => send("choose_gorilla_target", { orderIndex: index })} key={`${order}-${index}`} />;
                  })}
                </div>
              </div>
              {state.phase === "resolving" && <div className="ready-button-wrap">
                <button type="button" className={`big-red-button ${state.readyPlayerIds.includes(room.sessionId) ? "is-pressed" : ""}`} onClick={() => send("ready_for_next_round")} disabled={state.readyPlayerIds.includes(room.sessionId)} aria-label="准备下一轮">
                  <span className="big-red-button-cap">{state.readyPlayerIds.includes(room.sessionId) ? "OK" : "READY"}</span>
                </button>
                <span className="ready-count">{state.readyPlayerIds.includes(room.sessionId) ? "已准备，等待其他玩家" : "按下准备下一轮"} · {state.readyPlayerIds.length}/{players.length}</span>
              </div>}
              {state.phase === "choosing_order" && (state.currentPlayerId === room.sessionId ? <div className={`focus-drawn-card ${isPlacingOrder ? "is-placing" : ""} ${handDown ? "hand-down" : ""}`}>
                <div className="focus-card-hint">选择这张牌的一侧（<button type="button" className="hand-down-chip" onClick={() => setHandDown(true)}>放下牌看桌面</button>）</div>
                <div className="hand-holding">
                  <div className="choice-card order-card-full order-column choice-order-card">
                    <FruitCardFace
                      top={{ fruit: state.pendingLeftFruit, count: state.pendingLeftCount }}
                      bottom={{ fruit: state.pendingRightFruit, count: state.pendingRightCount }}
                      onTop={() => chooseOrderSide("left")}
                      onBottom={() => chooseOrderSide("right")}
                    />
                  </div>
                  <img className="holding-hand" src="/assets/hand.png" alt="" draggable={false} />
                </div>
              </div> : <div className="focus-drawn-card focus-drawn-card-watch" style={watchingCardStyle}>
                <div className="focus-card-hint">{players.find((player) => player.id === state.currentPlayerId)?.name ?? "对方"} 正在选择这张牌的一侧</div>
                <div className="hand-holding">
                  <div className="choice-card order-card-full order-column choice-order-card">
                    <FruitCardFace
                      top={{ fruit: state.pendingLeftFruit, count: state.pendingLeftCount }}
                      bottom={{ fruit: state.pendingRightFruit, count: state.pendingRightCount }}
                    />
                  </div>
                  <img className="holding-hand" src="/assets/hand.png" alt="" draggable={false} style={watchingHandStyle} />
                </div>
              </div>)}
              {state.phase === "choosing_gorilla" && pendingGorilla && (state.currentPlayerId === room.sessionId ? <div className={`focus-drawn-card ${handDown ? "hand-down" : ""}`}>
                <div className="focus-card-hint">抽到猩猩牌！点击一列订单翻转 180°（<button type="button" className="hand-down-chip" onClick={() => setHandDown(true)}>放下牌看桌面</button>）</div>
                <div className="hand-holding">
                  <div className="choice-card order-card-full order-column choice-order-card gorilla-focus-card">
                    <GorillaCardFace gorilla={pendingGorilla} />
                  </div>
                  <img className="holding-hand" src="/assets/hand.png" alt="" draggable={false} />
                </div>
              </div> : <div className="focus-drawn-card focus-drawn-card-watch" style={watchingCardStyle}>
                <div className="focus-card-hint">{players.find((player) => player.id === state.currentPlayerId)?.name ?? "对方"} 抽到猩猩牌，正在选择要翻转的订单</div>
                <div className="hand-holding">
                  <div className="choice-card order-card-full order-column choice-order-card gorilla-focus-card">
                    <GorillaCardFace gorilla={pendingGorilla} />
                  </div>
                  <img className="holding-hand" src="/assets/hand.png" alt="" draggable={false} style={watchingHandStyle} />
                </div>
              </div>)}
              {state.phase === "gorilla_skip" && pendingGorilla && <div className={`focus-drawn-card ${watchingCardStyle ? "focus-drawn-card-watch" : ""}`} style={watchingCardStyle}>
                <div className="focus-card-hint">{state.currentPlayerId === room.sessionId ? "你" : (players.find((player) => player.id === state.currentPlayerId)?.name ?? "对方")}抽到猩猩牌，但没有可翻转的订单，自动跳过</div>
                <div className="hand-holding">
                  <div className="choice-card order-card-full order-column choice-order-card gorilla-focus-card">
                    <GorillaCardFace gorilla={pendingGorilla} />
                  </div>
                  <img className="holding-hand" src="/assets/hand.png" alt="" draggable={false} style={watchingCardStyle ? watchingHandStyle : undefined} />
                </div>
              </div>}
              {handDown && <button type="button" className="hand-restore-chip" onClick={() => setHandDown(false)}>举回牌</button>}
              {opponentSeats.map(({ player, offset }, index) => <div key={player.id} className={`arc-seat ${player.id === state.currentPlayerId ? "active-seat" : ""}`} style={arcPosition(index, opponentSeats.length, 24, 36, 8)}>
                <div className="seat-name">{player.name}</div>
                <div className={`inventory-card ${state.phase === "resolving" ? "reveal-flip" : ""}`} style={state.phase === "resolving" ? { animationDelay: `${index * 80}ms` } : undefined}><CardFace value={state.phase === "resolving" ? lastReveal?.inventories?.[player.id] : inventoryView[player.id]} /></div>
                <div className="seat-anger"><AngerBadge anger={player.anger} /></div>
              </div>)}
              {self && <div className={`center-seat ${self.id === state.currentPlayerId ? "active-seat" : ""}`}>
                <div className="seat-name">{self.name}（你）{self.id === players[0]?.id ? "（房主）" : ""}</div>
                <div className={`inventory-card ${state.phase === "resolving" ? "reveal-flip" : "card-back"}`} style={state.phase === "resolving" ? { animationDelay: `${opponentSeats.length * 80}ms` } : undefined}>{state.phase === "resolving" ? <CardFace value={lastReveal?.inventories?.[self.id]} /> : null}</div>
                <div className="seat-anger"><AngerBadge anger={self.anger} /></div>
              </div>}
              {players.length === 2 && Boolean(state.phase === "resolving" ? lastReveal?.inventories?.["__dummy_inventory__"] : inventoryView["__dummy_inventory__"]) && <div className="dummy-seat">
                <div className="seat-name">公共库存</div>
                <div className={`inventory-card ${state.phase === "resolving" ? "reveal-flip" : ""}`}><CardFace value={state.phase === "resolving" ? lastReveal?.inventories?.["__dummy_inventory__"] : inventoryView["__dummy_inventory__"]} /></div>
              </div>}
            </div>
          </section>
          <div className="grid">
            <section className="player-panel">
              <h2>玩家</h2>
              <div className="players">
                {players.map((player) => <div key={player.id} className={`player ${player.id === state.currentPlayerId ? "active" : ""} ${player.id === room.sessionId ? "self-player" : ""}`}>
                  <span>{player.name}{player.id === room.sessionId ? "（你）" : ""}{player.id === players[0]?.id ? "（房主）" : ""}</span>
                  <span>{player.connected ? "在线" : "离线"} · <AngerBadge anger={player.anger} /></span>
                </div>)}
              </div>
              <p className="hint">当前连接身份：{self?.name ?? room.sessionId}</p>
            </section>
          </div>
          </section>
        </>}
      </div>
      {gameStartNotice && <div className="turn-notice game-start-notice" role="status" aria-live="polite"><span>游戏开始</span><strong>GAME START</strong></div>}
      {turnNotice && <div className="turn-notice" role="status" aria-live="polite"><span>轮到你了</span><strong>YOUR TURN</strong></div>}
      {roundEffect && <RoundEffect kind={roundEffect.kind} token={roundEffect.token} />}
      {showRoomCodeModal && state?.roomCode && <div className="room-modal-backdrop" role="presentation">
        <div className="room-modal" role="dialog" aria-modal="true" aria-labelledby="room-modal-title">
          <div className="eyebrow">Room created</div>
          <h2 id="room-modal-title">房间创建成功</h2>
          <p className="hint">把这个 8 位房间号发给其他玩家：</p>
          <div className="room-modal-code" aria-label={state.roomCode}>{state.roomCode}</div>
          <div className="room-modal-actions">
            <button onClick={() => void copyRoomCode()}>{roomCodeCopied ? "已复制" : "复制房间号"}</button>
            <button className="secondary-button" onClick={() => setShowRoomCodeModal(false)}>进入房间</button>
          </div>
        </div>
      </div>}
      {room && <div className={`chat-panel ${chatOpen ? "" : "is-closed"}`}>
        <button type="button" className="chat-toggle" onClick={() => setChatOpen((open) => !open)}>{chatOpen ? "收起聊天" : "💬 聊天"}</button>
        {chatOpen && <>
          <div className="chat-messages" ref={chatListRef}>
            {chatMessages.length === 0 && <div className="chat-empty">打个招呼吧 🦍</div>}
            {chatMessages.map((msg) => <div className={`chat-msg ${msg.playerId === room.sessionId ? "own" : ""}`} key={msg.id}>
              <span className="chat-name">{msg.playerId === room.sessionId ? "你" : msg.name ?? "玩家"}</span>
              {msg.text && <span className="chat-bubble">{msg.text}</span>}
              {msg.emote && <img className="chat-emote-img" src={`/assets/emote-${msg.emote}.png`} alt={msg.emote} draggable={false} />}
            </div>)}
          </div>
          <div className="chat-emote-row">
            {["mitsuhiko", "moo", "nana"].map((g) => <button type="button" key={g} className="chat-emote-btn" onClick={() => sendEmote(g)} aria-label={`发送猩猩表情 ${g}`}><img src={`/assets/emote-${g}.png`} alt="" draggable={false} /></button>)}
          </div>
          <form className="chat-input-row" onSubmit={sendChatText}>
            <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} maxLength={120} placeholder="聊两句…" />
            <button type="submit">发送</button>
          </form>
        </>}
      </div>}
    </main>
  );
}
