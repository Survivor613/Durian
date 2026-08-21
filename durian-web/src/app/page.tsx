"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import dynamic from "next/dynamic";
import { Client, Room } from "@colyseus/sdk";
import { randomNickname } from "../data/nicknames";
import { gorillaEffect, socialGorillas, socialGorillasById, type SocialGorillaId } from "../data/gorillas";
import { BrandLockup } from "../components/BrandLockup";
import { EmployeeHandbook } from "../components/EmployeeHandbook";
import { GorillaRosterSelector } from "../components/GorillaRosterSelector";
import { HomeLanding } from "../components/HomeLanding";
import { SettlementSequence, type SettlementExplanation } from "../components/SettlementSequence";
import { RoundPhraseCloud } from "../features/round-phrases/RoundPhraseCloud";
import { useRoundPhrases } from "../features/round-phrases/useRoundPhrases";

const PunchOverlay = dynamic(() => import("../components/PunchOverlay").then((module) => module.PunchOverlay), { ssr: false });

type Player = { id: string; name: string; connected: boolean; isBot: boolean; anger: number };
type RoomState = {
  roomCode: string;
  phase: string;
  gameMode: "classic" | "curious-market";
  playerGorillaWeight: number;
  selectedGorillaIds: string[];
  maxGorillas: number;
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
  id?: string;
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
    explanations?: SettlementExplanation[];
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
const gorillaImages: Record<string, string> = Object.fromEntries(
  socialGorillas.map((gorilla) => [gorilla.id, gorilla.lobbyImage]),
);
const fruitCardPool = { 1: "fruit-count-1", 2: "fruit-count-2", 3: "fruit-count-3" } as const;
const CURIOUS_MARKET_FRUIT_CARDS = 28;
const CURIOUS_MARKET_GORILLA_CARDS = 8;
const PLAYER_GORILLA_WEIGHTS = Array.from({ length: 9 }, (_, index) => index / 2);

function playerGorillaFirstProbability(weight: number) {
  const weightedGorillas = CURIOUS_MARKET_GORILLA_CARDS * weight;
  return weightedGorillas === 0 ? 0 : weightedGorillas / (CURIOUS_MARKET_FRUIT_CARDS + weightedGorillas);
}

function lobbyGorillaScore(roomCode: string, gorillaId: string) {
  let hash = 2166136261;
  for (const character of `${roomCode}:${gorillaId}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function FruitLabel({ fruit, count, removal }: { fruit: string; count: number; removal?: { amount: 1 | 2; status: SettlementTargetState["status"]; effectiveFruit: string } }) {
  const countClass = fruitCardPool[count as 1 | 2 | 3] ?? fruitCardPool[1];
  return <span className={`fruit-label fruit-${fruit} ${countClass}${removal ? ` mover-source is-${removal.status}` : ""}`}>
    <span className="fruit-pips" aria-label={`${fruit} ${count}`}>
      {Array.from({ length: count }, (_, index) => <span className={`fruit-pip${removal && index >= count - removal.amount ? " is-removed" : ""}`} key={`${fruit}-${index}`}><img className="fruit-icon" src={fruitImages[removal?.effectiveFruit ?? fruit] ?? fruitImages.strawberry} alt="" aria-hidden="true" draggable={false} /></span>)}
    </span>
    {removal && <b className="mover-removal">−{removal.amount}</b>}
  </span>;
}

type FruitSideView = { fruit: string; count: number };

function FruitCardFace({
  top,
  bottom,
  onTop,
  onBottom,
  boxedFruit,
  boxedStatus,
  removals,
}: {
  top: FruitSideView;
  bottom: FruitSideView;
  onTop?: () => void;
  onBottom?: () => void;
  boxedFruit?: string;
  boxedStatus?: SettlementTargetState["status"];
  removals?: Partial<Record<"top" | "bottom", { amount: 1 | 2; status: SettlementTargetState["status"]; effectiveFruit: string }>>;
}) {
  const renderHalf = (side: FruitSideView, position: "top" | "bottom", onClick?: () => void) => {
    const boxed = side.fruit === boxedFruit && boxedStatus;
    const content = <><FruitLabel fruit={side.fruit} count={side.count} removal={removals?.[position]} />{boxed && <span className={`boxing-fruit-cover is-${boxedStatus}`} aria-label={`${side.fruit} 已封箱`}><i /><b aria-hidden="true" /></span>}</>;
    return onClick ? <button type="button" className={`fruit-card-half ${position}`} onClick={onClick}>{content}</button> : <div className={`fruit-card-half ${position}`}>{content}</div>;
  };
  return <div className="fruit-card-face">
    {renderHalf(top, "top", onTop)}
    {renderHalf(bottom, "bottom", onBottom)}
  </div>;
}

function GorillaCardFace({ gorilla }: { gorilla?: string }) {
  return <div className="gorilla-card-face" tabIndex={0} aria-label="悬浮查看大猩猩卡效果">
    <img className="gorilla-card-img" src={gorillaImages[gorilla ?? ""] ?? gorillaImages.moo} alt={`大猩猩卡 ${gorilla ?? ""}`} draggable={false} />
    <span className="gorilla-tooltip">{gorillaEffect(gorilla ?? "")}</span>
  </div>;
}

function InventorySwapMarks({ top, bottom, status }: { top: FruitSideView; bottom: FruitSideView; status: SettlementTargetState["status"] }) {
  const renderMark = (side: FruitSideView, position: "top" | "bottom") => {
    if (side.fruit !== "strawberry" && side.fruit !== "grape") return null;
    const replacement = side.fruit === "strawberry" ? "grape" : "strawberry";
    return <span className={`inventory-swap-mark ${position} is-${status}`}>
      <i aria-hidden="true" />
      <b><img src={fruitImages[replacement]} alt={replacement === "grape" ? "葡萄" : "草莓"} draggable={false} /><span>×{side.count}</span></b>
    </span>;
  };
  return <div className="inventory-swap-marks" role="status" aria-label="换位魔术师逐面交换草莓与葡萄">
    {renderMark(top, "top")}
    {renderMark(bottom, "bottom")}
  </div>;
}

function CardFace({ value, inventorySwapStatus, boxingState, moverSources }: { value: unknown; inventorySwapStatus?: SettlementTargetState["status"]; boxingState?: { fruit: string; status: SettlementTargetState["status"] }; moverSources?: Array<{ side: "left" | "right"; amount: 1 | 2; effectiveFruit: string; status: SettlementTargetState["status"] }> }) {
  const card = value as InventoryCardView | undefined;
  if (card?.kind === "fruit" && card.left && card.right) {
    const removals = Object.fromEntries((moverSources ?? []).map((source) => [source.side === "left" ? "top" : "bottom", source]));
    return <div className="inventory-fruit-face">
      <FruitCardFace top={card.left} bottom={card.right} boxedFruit={boxingState?.fruit} boxedStatus={boxingState?.status} removals={removals} />
      {inventorySwapStatus && <InventorySwapMarks top={card.left} bottom={card.right} status={inventorySwapStatus} />}
    </div>;
  }
  if (card?.kind === "gorilla") return <GorillaCardFace gorilla={card.gorilla} />;
  return <>{cardLabel(value).split("\n").map((line) => <span key={line}>{line}</span>)}</>;
}

function hasSwappableFruit(value: unknown) {
  const card = value as InventoryCardView | undefined;
  return card?.kind === "fruit" && [card.left?.fruit, card.right?.fruit].some((fruit) => fruit === "strawberry" || fruit === "grape");
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

type SettlementTargetState = { status: "active" | "committed"; delay: number };

function OrderCard({ value, exploded = false, invalidState, grapeChange, supervisorChange, boxingState, entering = false, flipping = false, revealDelay, selectable = false, onSelect }: { value: unknown; exploded?: boolean; invalidState?: SettlementTargetState; grapeChange?: { from: 2 | 3; to: 1 } & SettlementTargetState; supervisorChange?: { fruit: string; from: number; to: 0 } & SettlementTargetState; boxingState?: { fruit: string; status: SettlementTargetState["status"] }; entering?: boolean; flipping?: boolean; revealDelay?: number; selectable?: boolean; onSelect?: () => void }) {
  const order = parsePublicOrder(value);
  if (!order.left || !order.right) return <div className={`card reveal-order-card ${exploded ? "order-exploded" : invalidState ? `order-invalid is-${invalidState.status}` : ""}`}>{String(value)}</div>;
  const kept = order.selectedSide === "right" ? order.right : order.left;
  const discarded = order.selectedSide === "right" ? order.left : order.right;
  const boxedFruit = kept.fruit === boxingState?.fruit ? boxingState.fruit : undefined;
  const hasGorilla = Boolean(order.gorillaKind || order.gorillaCardId);
  return <div
    className={`order-item ${hasGorilla ? "has-gorilla" : ""} ${entering ? "order-enter" : ""} ${flipping ? "order-flip" : ""} ${revealDelay !== undefined ? "reveal-flip" : ""} ${selectable ? "gorilla-target" : ""}`}
    style={revealDelay !== undefined ? { animationDelay: `${revealDelay}ms` } : undefined}
    onClick={selectable ? onSelect : undefined}
    role={selectable ? "button" : undefined}
    tabIndex={selectable ? 0 : undefined}
    onKeyDown={selectable ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect?.(); } } : undefined}
  >
    <div className={`order-card-full order-column ${exploded ? "order-exploded" : invalidState ? `order-invalid is-${invalidState.status}` : grapeChange ? `order-grape-changed is-${grapeChange.status}` : supervisorChange ? `order-supervisor-cancelled is-${supervisorChange.status}` : ""}`} style={invalidState || grapeChange || supervisorChange ? { "--strike-delay": `${(invalidState ?? grapeChange ?? supervisorChange)?.delay ?? 0}ms` } as CSSProperties : undefined}>
      <FruitCardFace top={discarded} bottom={kept} boxedFruit={boxedFruit} boxedStatus={boxingState?.status} />
      {grapeChange && <span className={`grape-order-change is-${grapeChange.status}`} style={{ "--strike-delay": `${grapeChange.delay}ms` } as CSSProperties}><img src="/assets/effect-grape-skewer.png" alt="葡萄串签" draggable={false} /><b>×1</b></span>}
      {supervisorChange && <span className={`supervisor-order-mark is-${supervisorChange.status}`} style={{ "--strike-delay": `${supervisorChange.delay}ms` } as CSSProperties}><img className="supervisor-x-stroke first" src="/assets/effect-supervisor-stroke-first.png" alt="" aria-hidden="true" draggable={false} /><img className="supervisor-x-stroke second" src="/assets/effect-supervisor-stroke-second.png" alt="" aria-hidden="true" draggable={false} /><b>{supervisorChange.from} → 0</b></span>}
    </div>
    {(order.gorillaKind || order.gorillaCardId) && <img
      className="gorilla-side-card"
      src={gorillaImages[order.gorillaKind ?? order.gorillaCardId?.replace("gorilla-", "") ?? ""] ?? gorillaImages.moo}
      alt=""
      aria-hidden="true"
      draggable={false}
    />}
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
          return <OrderCard value={order} exploded={exploded} invalidState={invalid ? { status: "committed", delay: 0 } : undefined} key={`reveal-order-${index}`} />;
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

function tableSeatPosition(index: number, total: number) {
  if (total < 5) return arcPosition(index, total, 24, 36, 8);
  const progress = total === 1 ? 0.5 : index / (total - 1);
  return {
    left: `${9 + progress * 82}%`,
    top: `${15 + Math.abs(progress * 2 - 1) * 7}%`,
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
    gameMode: source.gameMode ?? "classic",
    playerGorillaWeight: source.playerGorillaWeight ?? 1,
    selectedGorillaIds: Array.from(source.selectedGorillaIds ?? socialGorillas.map((gorilla) => gorilla.id)),
    maxGorillas: source.maxGorillas ?? socialGorillas.length,
    currentPlayerId: source.currentPlayerId ?? "",
    players: Array.from(source.players ?? []).map((player) => ({
      id: player.id,
      name: player.name,
      connected: player.connected,
      isBot: player.isBot ?? false,
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

// 持久匿名 ID（localStorage）+ 每次页面加载生成的随机后缀：
// localStorage 在同一浏览器的所有标签页间共享，若 clientId 整体持久，
// 第二个标签页/窗口加入同一房间时会被服务端的"同 clientId 踢旧座位"逻辑
// 当成同一人重复连接而顶替掉第一个标签页（双方互相看不到对方）。
// 后缀只存在内存里，新标签页、复制标签页、刷新都会重新生成；
// 刷新重连走 reconnectionToken 落座，不经过 onJoin 的 clientId 去重，不受影响。
let pageLoadSuffix = "";
function getClientId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("durian.clientId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("durian.clientId", id);
  }
  if (!pageLoadSuffix) pageLoadSuffix = crypto.randomUUID().slice(0, 8);
  return `${id}:${pageLoadSuffix}`;
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

function ConnectionBadge({ connected }: { connected: boolean }) {
  if (connected) return null;
  return <span className="connection-badge" role="status" aria-label="玩家已离线">
    <i className="connection-dot" aria-hidden="true" />离线
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
  const [settlementProgress, setSettlementProgress] = useState<{ committedCount: number; activeIndex: number | null }>({ committedCount: 0, activeIndex: null });
  const [settlementIntroComplete, setSettlementIntroComplete] = useState(false);
  const [settlementComplete, setSettlementComplete] = useState(false);
  const [showRoomCodeModal, setShowRoomCodeModal] = useState(false);
  const [roomCodeCopied, setRoomCodeCopied] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [turnNotice, setTurnNotice] = useState(false);
  const [roundEffect, setRoundEffect] = useState<{ kind: "penalty" | "success"; token?: number } | null>(null);
  const [gorillaFlipIndex, setGorillaFlipIndex] = useState(-1);
  const [gameStartNotice, setGameStartNotice] = useState(false);
  const [handDown, setHandDown] = useState(false);
  const [showPunch, setShowPunch] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatOpen, setChatOpen] = useState(true);
  const [handbookOpen, setHandbookOpen] = useState(false);
  const [gorillaRosterOpen, setGorillaRosterOpen] = useState(false);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  // 入场动画：以我第一次看到的名单为基准（他们安静地站着），
  // 只有我自己和之后新加入的人播闪电登场
  const seenPlayerIdsRef = useRef<Set<string> | null>(null);
  const arriveIdsRef = useRef<Set<string>>(new Set());
  const lobbyGorillaAssignmentsRef = useRef<Map<string, SocialGorillaId>>(new Map());
  const lobbyGorillaOrderRef = useRef<{ roomCode: string; order: SocialGorillaId[] } | null>(null);
  const readyShortcutSentRef = useRef(false);
  const turnNoticeTimerRef = useRef<number | null>(null);
  const roundEffectTimerRef = useRef<number | null>(null);
  const gorillaFlipTimerRef = useRef<number | null>(null);
  const gameStartTimerRef = useRef<number | null>(null);
  const turnDelayTimerRef = useRef<number | null>(null);
  const drawSendTimerRef = useRef<number | null>(null);
  const drawResetTimerRef = useRef<number | null>(null);
  const orderSendTimerRef = useRef<number | null>(null);
  const activeRoomRef = useRef<Room<RoomState> | null>(null);
  const gameStartShownRef = useRef(false);
  const bellPlayedRef = useRef(false);
  const gameOverPlayedRef = useRef(false);
  const lastPunchRevealRef = useRef<RevealPayload | null>(null);
  const prevOrdersRef = useRef<string[]>([]);
  const { send: sendRoundPhrase, hasSentSelf, phraseByPlayerId } = useRoundPhrases(room, state?.round ?? 0, state?.phase ?? "lobby");

  useEffect(() => {
    activeRoomRef.current = room;
    return () => { if (activeRoomRef.current === room) void room?.leave(false); };
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
      if (turnDelayTimerRef.current) window.clearTimeout(turnDelayTimerRef.current);
      if (drawSendTimerRef.current) window.clearTimeout(drawSendTimerRef.current);
      if (drawResetTimerRef.current) window.clearTimeout(drawResetTimerRef.current);
      if (orderSendTimerRef.current) window.clearTimeout(orderSendTimerRef.current);
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
    if (state?.phase !== "finished") gameOverPlayedRef.current = false;
  }, [state?.phase]);

  // 爆单冲拳特效：reveal_result 罚了我、且本轮存在爆单订单时播放。
  // 动画盖在最上层、不阻塞 resolving → finished 的状态流转。
  // 以防重入：记录上次触发的那次 reveal 引用，新的 reveal_result 到来（对象变了）就允许再播。
  useEffect(() => {
    const reveal = revealHistory[revealHistory.length - 1];
    if (!reveal || !room) return;
    if (reveal === lastPunchRevealRef.current) return;
    if (reveal.penalizedPlayerId !== room.sessionId) return;
    const overloadedOrders = (reveal.result?.overloadedOrders as unknown[] | undefined) ?? [];
    if (overloadedOrders.length === 0) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    lastPunchRevealRef.current = reveal;
    setShowPunch(true);
  }, [revealHistory, room]);

  const handleSettlementStep = useCallback((committedCount: number, activeIndex: number | null) => setSettlementProgress({ committedCount, activeIndex }), []);
  const handleSettlementComplete = useCallback(() => setSettlementComplete(true), []);

  // 奖励/惩罚与冲拳结束后才启动逐项结算，避免划线在遮罩后偷偷播完。
  useEffect(() => {
    if (!revealHistory.length || state?.phase !== "resolving") return;
    setSettlementIntroComplete(false);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setSettlementIntroComplete(true);
      return;
    }
    const timer = window.setTimeout(() => setSettlementIntroComplete(true), showPunch ? 3500 : roundEffect ? 3100 : 1200);
    return () => window.clearTimeout(timer);
  }, [revealHistory, state?.phase, state?.round, showPunch, Boolean(roundEffect)]);

  // 结算标记只能属于当前 resolving 轮次。进入下一小局时立即丢弃旧揭示，
  // finished 则保留最后一次揭示供总结算使用。
  useEffect(() => {
    if (state?.phase === "resolving") return;
    setSettlementProgress({ committedCount: 0, activeIndex: null });
    setSettlementComplete(false);
    if (state?.phase === "playing") setRevealHistory([]);
  }, [state?.phase, state?.round]);

  // ESC 暂时放下举着的牌，看看场上形势；再按一次举回
  const focusActive = Boolean(state && room && (state.phase === "choosing_order" || state.phase === "choosing_gorilla") && state.currentPlayerId === room.sessionId);
  useEffect(() => {
    if (!focusActive) { setHandDown(false); return; }
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setHandDown((down) => !down); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusActive]);

  useEffect(() => { readyShortcutSentRef.current = false; }, [state?.phase, state?.round]);
  const readyShortcutActive = Boolean(state && room && state.phase === "resolving" && settlementComplete && !state.readyPlayerIds.includes(room.sessionId));
  useEffect(() => {
    if (!readyShortcutActive || !room) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (event.key !== "Enter" || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || target?.closest("input, textarea, select, button, [contenteditable]:not([contenteditable='false'])")) return;
      event.preventDefault();
      if (readyShortcutSentRef.current) return;
      readyShortcutSentRef.current = true;
      room.send("ready_for_next_round");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readyShortcutActive, room]);

  async function connect(connectAction: (client: Client) => Promise<Room<RoomState>>): Promise<boolean> {
    if (connectingRef.current) return false;
    connectingRef.current = true;
    setIsConnecting(true);
    setError("");
    roomClosedMessageRef.current = null;
    try {
      const client = new Client(SERVER_URL);
      const joined = await connectAction(client);
      activeRoomRef.current = joined;
      setRoom(joined);
      setRoomId(joined.state.roomCode || "");
      setStartPlayerId(joined.sessionId);
      setRevealHistory([]);
      prevOrdersRef.current = [];
      setGorillaFlipIndex(-1);
      gameStartShownRef.current = false;
      bellPlayedRef.current = false;
      gameOverPlayedRef.current = false;
      lastPunchRevealRef.current = null;
      setShowPunch(false);
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
        if (activeRoomRef.current !== joined) return;
        const snap = snapshotState(nextState);
        markPlayers(snap.players);
        setState(snap);
      });
      joined.onMessage("inventory_view", (view: Record<string, unknown>) => {
        if (activeRoomRef.current === joined) setInventoryView(view);
      });
      joined.onMessage("turn_started", (payload: TurnStartedPayload) => {
        if (activeRoomRef.current !== joined) return;
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
        if (turnDelayTimerRef.current) window.clearTimeout(turnDelayTimerRef.current);
        turnDelayTimerRef.current = window.setTimeout(() => {
          if (activeRoomRef.current !== joined) return;
          if (turnNoticeTimerRef.current) window.clearTimeout(turnNoticeTimerRef.current);
          setTurnNotice(true);
          turnNoticeTimerRef.current = window.setTimeout(() => setTurnNotice(false), 1800);
        }, delay);
      });
      joined.onMessage("action_error", (payload: { message?: string }) => {
        if (activeRoomRef.current === joined) setError(payload.message ?? "操作未能完成");
      });
      joined.onMessage("reveal_result", (payload: RevealPayload) => {
        if (activeRoomRef.current !== joined) return;
        setSettlementProgress({ committedCount: 0, activeIndex: null });
        setSettlementIntroComplete(false);
        setSettlementComplete(false);
        setRevealHistory([payload]);
        const isPenalized = payload.penalizedPlayerId === joined.sessionId;
        const isSuccessfulRinger = Boolean(payload.successfulCall) && payload.ringerPlayerId === joined.sessionId;
        if (!isPenalized && !isSuccessfulRinger) return;
        if (roundEffectTimerRef.current) window.clearTimeout(roundEffectTimerRef.current);
        setRoundEffect(isPenalized ? { kind: "penalty", token: payload.token } : { kind: "success", token: payload.token });
        roundEffectTimerRef.current = window.setTimeout(() => setRoundEffect(null), 3000);
      });
      joined.onMessage("chat", (payload: ChatPayload) => {
        if (activeRoomRef.current !== joined) return;
        setChatMessages((list) => [...list.slice(-49), { ...payload, id: `${payload.ts ?? Date.now()}-${Math.random().toString(36).slice(2, 8)}` }]);
      });
      joined.onMessage("room_closed", (payload: { message?: string }) => {
        if (activeRoomRef.current !== joined) return;
        const message = payload.message ?? "房间已解散";
        roomClosedMessageRef.current = message;
        leaveRoom(message);
      });
      joined.onError((code, message) => {
        if (activeRoomRef.current === joined) setError(`服务器错误 ${code}: ${message}`);
      });
      joined.onLeave((code) => {
        if (activeRoomRef.current === joined) setError(roomClosedMessageRef.current ?? `连接已结束（${code}）`);
      });
      sessionStorage.setItem("durian-room-token", joined.reconnectionToken);
      // onReconnect 的点对点补发可能早于监听器注册；此时 joined.state 也可能尚未完成
      // 首次同步而暂时呈现 lobby，故监听就绪后必须无条件请求，交由服务端判断是否有可补发数据。
      joined.send("request_inventory_view");
      joined.send("request_reveal_result");
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

  function send(type: "start_game" | "set_game_mode" | "set_player_gorilla_weight" | "set_gorilla_selection" | "draw_card" | "ring_bell" | "choose_order_side" | "choose_gorilla_target" | "ready_for_next_round" | "end_game" | "add_bot" | "remove_bot" | "back_to_lobby", payload?: object) {
    room?.send(type, payload);
  }

  function sendChatText(event: React.FormEvent) {
    event.preventDefault();
    const text = chatInput.trim();
    if (!room || !text) return;
    room.send("chat", { text });
    setChatInput("");
  }

  function sendEmote(emote: SocialGorillaId) {
    room?.send("chat", { emote });
  }

  // 新消息或展开聊天时滚动到底部
  useEffect(() => {
    chatListRef.current?.scrollTo({ top: chatListRef.current.scrollHeight });
  }, [chatMessages, chatOpen]);

  function drawFromPile() {
    if (!room || !state || state.currentPlayerId !== room.sessionId || state.phase !== "playing" || isDrawing) return;
    setIsDrawing(true);
    drawSendTimerRef.current = window.setTimeout(() => {
      if (activeRoomRef.current === room) room.send("draw_card");
    }, 900);
    drawResetTimerRef.current = window.setTimeout(() => setIsDrawing(false), 1550);
  }

  function chooseOrderSide(side: "left" | "right") {
    if (!room || isPlacingOrder) return;
    setIsPlacingOrder(true);
    orderSendTimerRef.current = window.setTimeout(() => {
      if (activeRoomRef.current === room) room.send("choose_order_side", { side });
      setIsPlacingOrder(false);
    }, 520);
  }

  function leaveRoom(closedMessage?: string) {
    sessionStorage.removeItem("durian-room-token");
    activeRoomRef.current = null;
    void room?.leave();
    setRoom(null);
    setState(null);
    setStartPlayerId("");
    setInventoryView({});
    setRevealHistory([]);
    setShowRoomCodeModal(false);
    setRoomCodeCopied(false);
    if (turnNoticeTimerRef.current) window.clearTimeout(turnNoticeTimerRef.current);
    if (roundEffectTimerRef.current) window.clearTimeout(roundEffectTimerRef.current);
    if (gorillaFlipTimerRef.current) window.clearTimeout(gorillaFlipTimerRef.current);
    if (gameStartTimerRef.current) window.clearTimeout(gameStartTimerRef.current);
    if (turnDelayTimerRef.current) window.clearTimeout(turnDelayTimerRef.current);
    if (drawSendTimerRef.current) window.clearTimeout(drawSendTimerRef.current);
    if (drawResetTimerRef.current) window.clearTimeout(drawResetTimerRef.current);
    if (orderSendTimerRef.current) window.clearTimeout(orderSendTimerRef.current);
    setIsDrawing(false);
    setIsPlacingOrder(false);
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
    lastPunchRevealRef.current = null;
    setShowPunch(false);
    prevOrdersRef.current = [];
    roomClosedMessageRef.current = null;
    setError(closedMessage ?? "");
  }

  async function copyRoomCode() {
    if (!state?.roomCode) return;
    await navigator.clipboard.writeText(state.roomCode);
    setRoomCodeCopied(true);
  }

  const players = state?.players ?? [];
  const activePlayerIds = new Set(players.map((player) => player.id));
  const lobbyGorillaAssignments = lobbyGorillaAssignmentsRef.current;
  const roomCode = state?.roomCode ?? "";
  if (roomCode && lobbyGorillaOrderRef.current?.roomCode !== roomCode) {
    lobbyGorillaAssignments.clear();
    lobbyGorillaOrderRef.current = {
      roomCode,
      order: socialGorillas
        .map((gorilla) => gorilla.id)
        .sort((left, right) => lobbyGorillaScore(roomCode, left) - lobbyGorillaScore(roomCode, right)),
    };
  }
  for (const playerId of lobbyGorillaAssignments.keys()) {
    if (!activePlayerIds.has(playerId)) lobbyGorillaAssignments.delete(playerId);
  }
  const gorillaOrder = lobbyGorillaOrderRef.current?.order ?? socialGorillas.map((gorilla) => gorilla.id);
  const usedGorillas = new Set(lobbyGorillaAssignments.values());
  for (const player of players) {
    if (lobbyGorillaAssignments.has(player.id)) continue;
    const nextGorillaId = gorillaOrder.find((gorillaId) => !usedGorillas.has(gorillaId)) ?? gorillaOrder[lobbyGorillaAssignments.size % gorillaOrder.length];
    lobbyGorillaAssignments.set(player.id, nextGorillaId);
    usedGorillas.add(nextGorillaId);
  }
  const onlinePlayerCount = players.filter((player) => player.connected).length;
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
    const pull = 0.5; // 从座位往桌心收一半，抽出的牌落在桌心上方的空区，远离座位上的库存牌
    const cardX = seatX + (50 - seatX) * pull;
    const cardY = seatY + (44 - seatY) * pull;
    watchingCardStyle = { left: `${cardX}%`, top: `${cardY}%` };
    // 手默认从牌的正下方伸出，旋转到"指向座位"的方向后沿该方向偏移；
    // 横向再让开 80px、纵向只探出 110px（小于牌到座位的距离），让手掌停在座位侧面而不是压在库存牌上
    const angle = Math.atan2(-(seatX - cardX), seatY - cardY) * 180 / Math.PI;
    watchingHandStyle = { left: "50%", top: "50%", bottom: "auto", transform: `translate(-50%, -50%) rotate(${angle}deg) translate(80px, 110px)` };
  }
  const lastReveal = revealHistory[revealHistory.length - 1];
  const activeReveal = state?.phase === "resolving"
    && lastReveal
    && (lastReveal.revealRound === undefined || lastReveal.revealRound === state.round)
    ? lastReveal
    : undefined;
  const settlementExplanations = activeReveal?.result?.explanations ?? [];
  const visibleExplanationCount = settlementProgress.committedCount + (settlementProgress.activeIndex === null ? 0 : 1);
  const visibleExplanations = settlementExplanations.slice(0, visibleExplanationCount);
  const effectStatus = (index: number) => index < settlementProgress.committedCount ? "committed" as const : "active" as const;
  const invalidatedCards = new Map(visibleExplanations.flatMap((item, effectIndex) => item.effect === "mitsuhiko" || item.effect === "nana"
    ? item.affectedOrderCardIds.map((cardId, targetIndex) => [cardId, { status: effectStatus(effectIndex), delay: targetIndex * 130 }] as const)
    : []));
  const grapeChanges = new Map(visibleExplanations.flatMap((item, effectIndex) => item.effect === "grape-beadsmith"
    ? item.orderChanges.map((change, targetIndex) => [change.cardId, { ...change, status: effectStatus(effectIndex), delay: targetIndex * 150 }] as const)
    : []));
  const inventorySwap = visibleExplanations.map((item, index) => ({ item, index })).find(({ item }) => item.effect === "order-swap-magician");
  const inventorySwapState = inventorySwap?.item.effect === "order-swap-magician"
    ? { changes: inventorySwap.item.inventoryChanges, status: effectStatus(inventorySwap.index) }
    : null;
  const supervisorChanges = new Map(visibleExplanations.flatMap((item, effectIndex) => item.effect === "temporary-supervisor"
    ? item.orderChanges.map((change, targetIndex) => [change.cardId, { ...change, status: effectStatus(effectIndex), delay: targetIndex * 180 }] as const)
    : []));
  const boxingEffect = visibleExplanations.map((item, index) => ({ item, index })).find(({ item }) => item.effect === "boxing-manager");
  const boxingState = boxingEffect?.item.effect === "boxing-manager"
    ? { fruit: boxingEffect.item.affectedFruits[0], status: effectStatus(boxingEffect.index) }
    : undefined;
  const moverEffect = visibleExplanations.map((item, index) => ({ item, index })).find(({ item }) => item.effect === "inventory-mover");
  const moverState = moverEffect?.item.effect === "inventory-mover" ? { ...moverEffect.item, status: effectStatus(moverEffect.index) } : undefined;
  const moverSourcesFor = (inventoryId: string) => moverState?.sources.filter((source) => source.inventoryId === inventoryId).map((source) => ({ ...source, status: moverState.status }));
  const inventoryPosition = (inventoryId: string) => {
    if (inventoryId === room?.sessionId) return { left: "50%", top: "78%" };
    if (inventoryId === "__dummy_inventory__") return { left: "85%", top: "52%" };
    const opponentIndex = opponentSeats.findIndex(({ player }) => player.id === inventoryId);
    return tableSeatPosition(Math.max(0, opponentIndex), opponentSeats.length);
  };
  const actorPosition = moverState ? (() => {
    const actor = inventoryPosition(moverState.actor.inventoryId);
    const actorX = Number.parseFloat(actor.left);
    const actorY = Number.parseFloat(actor.top);
    return {
      "--actor-x": `${actorX + (50 - actorX) * .18}%`,
      "--actor-y": `${actorY + (48 - actorY) * .18}%`,
    };
  })() : undefined;
  const isHost = players[0]?.id === room?.sessionId;
  // 最后一局的 resolving 复盘：被处罚者怒气已达 7 点，READY 后进入总结算而非下一轮
  const isFinalResolve = Boolean(activeReveal) && (players.find((player) => player.id === activeReveal?.penalizedPlayerId)?.anger ?? 0) >= 7;

  if (!room) {
    return <HomeLanding
      name={name}
      roomCode={roomId}
      isConnecting={isConnecting}
      error={error}
      onNameChange={setName}
      onRoomCodeChange={setRoomId}
      onRandomNickname={() => setName(randomNickname())}
      onCreateRoom={createRoom}
      onJoinRoom={joinRoom}
    />;
  }

  return (
    <main className={`page ${state?.phase === "lobby" ? "page-lobby" : ""}`}>
      <div className="shell">
        <header className="game-brand-header">
          <BrandLockup variant="header" />
          <p className="subtitle">和朋友围坐一桌，开一家热热闹闹的榴莲水果店。</p>
        </header>

        {error && <p className="status">{error}</p>}

        {state && room && state.phase === "lobby" && <section className={`lobby-scene lobby-scene-${state.gameMode}`}>
          <div className="lobby-backdrops" aria-hidden="true">
            <img className={`lobby-backdrop ${state.gameMode === "classic" ? "is-active" : ""}`} src="/assets/lobby-classic.png" alt="" draggable={false} />
            <img className={`lobby-backdrop ${state.gameMode === "curious-market" ? "is-active" : ""}`} src="/assets/lobby-wild.png" alt="" draggable={false} />
            <i className="lobby-vignette" />
            <i className="lobby-ui-shade" />
          </div>

          <div className="lobby-title">
            <div className="lobby-title-left">
              <div className="lobby-heading-plaque">
                <div className="eyebrow">Private club</div>
                <h2>{state.gameMode === "curious-market" ? "猩风作浪" : "经典模式"}</h2>
                <p>等待玩家入席</p>
              </div>
              <EmployeeHandbook open={handbookOpen} onOpen={() => setHandbookOpen(true)} onClose={() => setHandbookOpen(false)} />
            </div>
            <div className="room-sign"><span>ROOM</span><strong>{state.roomCode}</strong></div>
          </div>

          <div className="lobby-gorillas">
            {players.map((player) => {
              const gorillaId = lobbyGorillaAssignments.get(player.id) ?? socialGorillas[0].id;
              const gorilla = socialGorillasById.get(gorillaId) ?? socialGorillas[0];
              const isNewArrival = arriveIdsRef.current.has(player.id);
              return <div className={`lobby-gorilla ${isNewArrival ? "arrive" : ""} ${player.connected ? "" : "is-offline"}`} key={player.id}>
                <i className="seat-warm-light" aria-hidden="true" />
                <img src={gorilla.lobbyImage} alt={player.name} draggable={false} />
                <span className="lobby-gorilla-name">
                  <strong>{player.name}</strong>
                  <small>{player.isBot ? "机器人" : player.id === players[0]?.id ? "房主" : "来宾"}{player.id === room.sessionId ? " · 你" : ""}</small>
                  <ConnectionBadge connected={player.connected} />
                </span>
                {isHost && player.id !== room.sessionId && !player.isBot && <button
                  type="button"
                  className="kick-button"
                  title={`将 ${player.name} 移出房间`}
                  onClick={() => { if (window.confirm(`确定把 ${player.name} 移出房间？`)) room.send("kick_player", { playerId: player.id }); }}
                >✕</button>}
              </div>;
            })}
          </div>

          <div className="lobby-control-tray">
            <div className="mode-picker">
              <span>游戏模式</span>
              <div className="mode-segments" role="group" aria-label="游戏模式">
                <button type="button" className={state.gameMode === "classic" ? "is-selected" : ""} aria-pressed={state.gameMode === "classic"} disabled={!isHost} onClick={() => send("set_game_mode", { gameMode: "classic" })}>经典模式</button>
                <button type="button" className={state.gameMode === "curious-market" ? "is-selected" : ""} aria-pressed={state.gameMode === "curious-market"} disabled={!isHost} onClick={() => send("set_game_mode", { gameMode: "curious-market" })}>猩风作浪</button>
              </div>
              <small>{state.gameMode === "curious-market" ? "紫罗、莫比、克莱德、巴鲁与菲恩加入牌局" : "三果判官·米奇、悠哉掌柜·墨菲与香蕉克星·汉娜坐镇"}</small>
              {state.gameMode === "curious-market" && <div className="gorilla-weight-control">
                <label htmlFor="player-gorilla-weight">玩家猩猩倍率 <strong>{state.playerGorillaWeight.toFixed(1)}×</strong></label>
                <input id="player-gorilla-weight" type="range" min="0" max="4" step="0.5" value={state.playerGorillaWeight} disabled={!isHost} onChange={(event) => send("set_player_gorilla_weight", { weight: Number(event.target.value) })} />
                <div className="gorilla-weight-steps" aria-hidden="true">{PLAYER_GORILLA_WEIGHTS.map((weight) => <span key={weight}>{weight}</span>)}</div>
                <small>当前牌组首位约 {(playerGorillaFirstProbability(state.playerGorillaWeight) * 100).toFixed(1)}%（8 张猩猩 / 28 张水果）</small>
              </div>}
            </div>
            <div className="lobby-actions">
              {isHost && state.gameMode === "curious-market" && <button type="button" onClick={() => setGorillaRosterOpen(true)}>猩猩档案（{state.selectedGorillaIds.length} 位角色，初始上限 {state.maxGorillas} 张）</button>}
              {isHost && <label className="starter-select">起始玩家
                <select value={startPlayerId || players[0]?.id || ""} onChange={(event) => setStartPlayerId(event.target.value)}>
                  {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
                </select>
              </label>}
              <button className="start-game-button" onClick={() => send("start_game", { startPlayerId: startPlayerId || players[0]?.id })} disabled={!isHost || players.length < 2}>开始游戏</button>
              {isHost && !players.some((player) => player.isBot) && <button type="button" onClick={() => send("add_bot")}>加入机器人</button>}
              {isHost && players.some((player) => player.isBot) && <button type="button" onClick={() => send("remove_bot")}>移除机器人</button>}
              {isHost && <button type="button" className="dissolve-room-button" onClick={() => { if (window.confirm("确定解散房间？所有玩家都将返回首页，当前房间号会立即失效。")) send("end_game"); }}>解散房间</button>}
              {!isHost && <p className="hint">房主正在安排牌局，请稍候</p>}
            </div>
          </div>
          <GorillaRosterSelector
            open={gorillaRosterOpen && isHost && state.gameMode === "curious-market"}
            selectedIds={state.selectedGorillaIds}
            max={state.maxGorillas}
            onClose={() => setGorillaRosterOpen(false)}
            onSave={(selectedIds, maxGorillas) => {
              send("set_gorilla_selection", { gorillaIds: selectedIds, maxGorillas });
              setGorillaRosterOpen(false);
            }}
          />
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
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => send("back_to_lobby")}>返回房间</button>
            <button className="secondary-button" onClick={() => leaveRoom()}>退出到首页</button>
          </div>
        </section>}

        {state && room && state.phase !== "lobby" && state.phase !== "finished" && <>
          <section className="game-surface">
          <div className="toolbar">
            <span className={`mode-badge mode-badge-${state.gameMode}`}>{state.gameMode === "curious-market" ? "猩风作浪" : "经典模式"}</span>
            <span className="status">第 {state.round} 轮 · {state.message}</span>
            {isHost && <button type="button" className="end-game-button" onClick={() => { if (window.confirm("确定解散整个房间？这不是结束单局：所有玩家都将返回首页，当前房间号会立即失效。")) send("end_game"); }}>解散房间</button>}
          </div>
          {state.phase === "bell_ringing" && <div className="bell-overlay" role="status" aria-live="assertive">
            <div className="bell-graphic" aria-hidden="true"><img className="bell-img" src="/assets/bell.png" alt="" draggable={false} /><i className="bell-ring" /><i className="bell-ring second" /></div>
            <strong>铃响了！</strong>
            <span>正在结算本轮订单</span>
          </div>}
          <p className="hint">房间号：{state.roomCode}（复制给另一个浏览器测试加入） · {isHost ? "你是房主" : "等待房主开始游戏"}</p>
          <section className="inventory-table">
            <div className="section-heading"><strong>{state.phase === "resolving" ? "本轮结算桌面" : "环桌库存"}</strong><span className="hint">你在圆心，其他玩家按顺时针顺序沿圆弧排列</span></div>
            {activeReveal ? <>
              {settlementIntroComplete && <SettlementSequence explanations={settlementExplanations} sequenceKey={String(activeReveal.revealRound ?? state.round)} onStepChange={handleSettlementStep} onComplete={handleSettlementComplete} />}
              {settlementComplete && <div className="round-result-banner">
                <span>被处罚：<strong>{players.find((player) => player.id === activeReveal.penalizedPlayerId)?.name ?? "玩家"}</strong></span>
                <span>+{activeReveal.token ?? 0} 怒气</span>
                <span>超出：{activeReveal.result?.exceededFruits?.join("、") || "无"}</span>
              </div>}

            </> : null}
            <div className="table-stage">
              {moverState && <div className={`inventory-mover-effect is-${moverState.status}`} style={actorPosition as CSSProperties} role="status" aria-label={`${moverState.sourceFruit} 库存减少 2，${moverState.targetFruit} 库存增加 2`}>
                {moverState.sources.map((source, index) => {
                  const sourcePosition = inventoryPosition(source.inventoryId);
                  return <span className="mover-cart" style={{ "--cart-delay": `${index * 120}ms`, "--source-x": sourcePosition.left, "--source-y": sourcePosition.top } as CSSProperties} key={`${source.inventoryId}-${source.cardId}-${source.side}`}><i /><span>{Array.from({ length: source.amount }, (_, pip) => <img src={fruitImages[source.effectiveFruit]} alt="" draggable={false} key={pip} />)}</span></span>;
                })}
                <span className="mover-actor-glow"><span className="mover-transform-source"><img src={fruitImages[moverState.sourceFruit]} alt="" draggable={false} /><img src={fruitImages[moverState.sourceFruit]} alt="" draggable={false} /></span><b>→</b><span className="mover-transform-target"><img src={fruitImages[moverState.targetFruit]} alt="" draggable={false} /><img src={fruitImages[moverState.targetFruit]} alt="" draggable={false} /></span></span>
                <div className="mover-summary"><span><img src={fruitImages[moverState.sourceFruit]} alt="" draggable={false} />{moverState.inventoryChanges[moverState.sourceFruit]?.from} → {moverState.inventoryChanges[moverState.sourceFruit]?.to}</span><span><img src={fruitImages[moverState.targetFruit]} alt="" draggable={false} />{moverState.inventoryChanges[moverState.targetFruit]?.from} → {moverState.inventoryChanges[moverState.targetFruit]?.to}</span></div>
              </div>}
              <DrawPile isDrawing={isDrawing} disabled={state.currentPlayerId !== room.sessionId || state.phase !== "playing"} onDraw={drawFromPile} />
              <button type="button" className="table-bell" onClick={() => send("ring_bell")} disabled={state.currentPlayerId !== room.sessionId || state.phase !== "playing" || orders.length === 0} aria-label="摇铃结算">
                <img src="/assets/bell.png" alt="" draggable={false} />
              </button>
              <div className="felt-orders-zone">
                {state.phase === "choosing_gorilla" && state.currentPlayerId === room.sessionId && <div className="gorilla-choice-hint" role="status">抽到猩猩牌！点击选择一列订单，将它翻转 180°</div>}
                <div className="felt-orders-scroll">
                  <div className="orders felt-orders">
                    <img className="order-board-stand" src="/assets/order-board.png" alt="" aria-hidden="true" draggable={false} />
                    {activeReveal
                    ? (activeReveal.result?.allOrders ?? []).map((order, index) => {
                      const cardId = parsePublicOrder(order).cardId ?? "";
                      return <OrderCard value={order} exploded={settlementComplete && Boolean(activeReveal.result?.overloadedOrders?.[0]) && orderKey(activeReveal.result?.overloadedOrders?.[0]) === orderKey(order)} invalidState={invalidatedCards.get(cardId)} grapeChange={grapeChanges.get(cardId)} supervisorChange={supervisorChanges.get(cardId)} boxingState={boxingState} revealDelay={index * 90} key={`resolved-order-${index}`} />;
                    })
                    : orders.map((order, index) => {
                      const choosingGorilla = state.phase === "choosing_gorilla" && state.currentPlayerId === room.sessionId;
                      return <OrderCard value={order} entering={isPlacingOrder && index === orders.length - 1} flipping={index === gorillaFlipIndex} selectable={choosingGorilla} onSelect={() => send("choose_gorilla_target", { orderIndex: index })} key={`${order}-${index}`} />;
                    })}
                  </div>
                </div>
              </div>
              {state.phase === "resolving" && settlementComplete && <div className="ready-button-wrap">
                <button type="button" className={`big-red-button ${state.readyPlayerIds.includes(room.sessionId) ? "is-pressed" : ""}`} onClick={() => { if (readyShortcutSentRef.current) return; readyShortcutSentRef.current = true; send("ready_for_next_round"); }} disabled={state.readyPlayerIds.includes(room.sessionId)} aria-label={isFinalResolve ? "查看总结算" : "准备下一轮"}>
                  <span className="big-red-button-cap">{state.readyPlayerIds.includes(room.sessionId) ? "OK" : isFinalResolve ? "结算" : "READY"}</span>
                </button>
                <span className="ready-count">{state.readyPlayerIds.includes(room.sessionId) ? "已准备，等待其他玩家" : `${isFinalResolve ? "按下查看总结算" : "按下准备下一轮"} · Enter 快捷准备`} · {state.readyPlayerIds.length}/{onlinePlayerCount} 在线</span>
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
              {opponentSeats.map(({ player }, index) => {
                const inventory = state.phase === "resolving" ? activeReveal?.inventories?.[player.id] : inventoryView[player.id];
                const swapStatus = inventorySwapState && hasSwappableFruit(inventory) ? inventorySwapState.status : undefined;
                const seatPosition = tableSeatPosition(index, opponentSeats.length);
                const phraseSide = index >= Math.ceil(opponentSeats.length / 2) ? "left" : "right";
                return <div key={player.id} className={`arc-seat ${opponentSeats.length >= 5 ? "dense-seat" : ""} ${player.connected && player.id === state.currentPlayerId ? "active-seat" : ""} ${player.connected ? "" : "is-offline"}`} style={seatPosition}>
                  <div className="seat-name">{player.name}<ConnectionBadge connected={player.connected} /></div>
                  <div className={`inventory-card ${state.phase === "resolving" ? "reveal-flip" : ""}${swapStatus ? " inventory-swap-marked" : ""}`} style={state.phase === "resolving" ? { animationDelay: `${index * 80}ms` } : undefined}><CardFace value={inventory} inventorySwapStatus={swapStatus} boxingState={boxingState} moverSources={moverSourcesFor(player.id)} /></div>
                  {state.phase === "resolving" && <RoundPhraseCloud event={phraseByPlayerId[player.id]} inventoryKind={(inventory as InventoryCardView | undefined)?.kind} side={phraseSide} spokenDirection="down" roundOutcome={player.id === activeReveal?.penalizedPlayerId ? "lose" : "win"} />}
                  <div className="seat-anger"><AngerBadge anger={player.anger} /></div>
                </div>;
              })}
              {self && (() => {
                const inventory = state.phase === "resolving" ? activeReveal?.inventories?.[self.id] : inventoryView[self.id];
                const swapStatus = inventorySwapState && hasSwappableFruit(inventory) ? inventorySwapState.status : undefined;
                return <div className={`center-seat ${self.connected && self.id === state.currentPlayerId ? "active-seat" : ""} ${self.connected ? "" : "is-offline"}`}>
                  <div className="seat-name">{self.name}（你）{self.id === players[0]?.id ? "（房主）" : ""}<ConnectionBadge connected={self.connected} /></div>
                  <div className={`inventory-card ${state.phase === "resolving" ? "reveal-flip" : "card-back"}${swapStatus ? " inventory-swap-marked" : ""}`} style={state.phase === "resolving" ? { animationDelay: `${opponentSeats.length * 80}ms` } : undefined}>{state.phase === "resolving" ? <CardFace value={inventory} inventorySwapStatus={swapStatus} boxingState={boxingState} moverSources={moverSourcesFor(self.id)} /> : null}</div>
                  {state.phase === "resolving" && <RoundPhraseCloud event={phraseByPlayerId[self.id]} inventoryKind={(inventory as InventoryCardView | undefined)?.kind} side="right" roundOutcome={self.id === activeReveal?.penalizedPlayerId ? "lose" : "win"} canSend={settlementComplete && !hasSentSelf} onSend={sendRoundPhrase} />}
                  <div className="seat-anger"><AngerBadge anger={self.anger} /></div>
                </div>;
              })()}
              {players.length === 2 && Boolean(state.phase === "resolving" ? activeReveal?.inventories?.["__dummy_inventory__"] : inventoryView["__dummy_inventory__"]) && (() => {
                const inventory = state.phase === "resolving" ? activeReveal?.inventories?.["__dummy_inventory__"] : inventoryView["__dummy_inventory__"];
                const swapStatus = inventorySwapState && hasSwappableFruit(inventory) ? inventorySwapState.status : undefined;
                return <div className="dummy-seat">
                  <div className="seat-name">公共库存</div>
                  <div className={`inventory-card ${state.phase === "resolving" ? "reveal-flip" : ""}${swapStatus ? " inventory-swap-marked" : ""}`}><CardFace value={inventory} inventorySwapStatus={swapStatus} boxingState={boxingState} moverSources={moverSourcesFor("__dummy_inventory__")} /></div>
                </div>;
              })()}
            </div>
          </section>
          <div className="grid">
            <section className="player-panel">
              <h2>玩家</h2>
              <div className="players">
                {players.map((player) => <div key={player.id} className={`player ${player.connected && player.id === state.currentPlayerId ? "active" : ""} ${player.id === room.sessionId ? "self-player" : ""} ${player.id === players[0]?.id ? "host-player" : ""} ${player.connected ? "" : "is-offline"}`}>
                  <span>{player.name}{player.id === room.sessionId ? "（你）" : ""}{player.id === players[0]?.id ? <span className="host-tag">（房主）</span> : ""}</span>
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
            {chatMessages.map((msg) => {
              const emote = typeof msg.emote === "string" ? socialGorillasById.get(msg.emote as SocialGorillaId) : undefined;
              return <div className={`chat-msg ${msg.playerId === room.sessionId ? "own" : ""}`} key={msg.id}>
                <span className="chat-name">{msg.playerId === room.sessionId ? "你" : msg.name ?? "玩家"}</span>
                {msg.text && <span className="chat-bubble">{msg.text}</span>}
                {emote && <img className="chat-emote-img" src={emote.emoteImage} alt={emote.id} draggable={false} />}
              </div>;
            })}
          </div>
          <div className="chat-emote-row">
            {socialGorillas.map((gorilla) => <button type="button" key={gorilla.id} className="chat-emote-btn" onClick={() => sendEmote(gorilla.id)} aria-label={`发送猩猩表情 ${gorilla.id}`}><img src={gorilla.emoteImage} alt="" draggable={false} /></button>)}
          </div>
          <form className="chat-input-row" onSubmit={sendChatText}>
            <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} maxLength={120} placeholder="聊两句…" />
            <button type="submit">发送</button>
          </form>
        </>}
      </div>}
      {showPunch && <PunchOverlay onClose={() => setShowPunch(false)} />}
    </main>
  );
}
