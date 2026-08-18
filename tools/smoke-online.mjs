// 本地生产模式联机冒烟：双客户端建房/加房/开局/抽牌/重连 token 检查
import { Client } from "@colyseus/sdk";

const SERVER = process.env.SMOKE_SERVER ?? "ws://localhost:2567";
const HTTP = SERVER.replace(/^ws/, "http");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fail = (msg) => { console.error("FAIL:", msg); process.exit(1); };

// 1. healthz
const health = await fetch(`${HTTP}/healthz`).then((r) => r.json());
if (!health.ok) fail("healthz");

// 2. A 建房
const clientA = new Client(SERVER);
const roomA = await clientA.create("durian", { name: "甲", clientId: "smoke-a" });
// 等待首次状态同步
for (let i = 0; i < 50 && !roomA.state?.roomCode; i++) await sleep(100);
const code = roomA.state.roomCode;
if (!/^\d{8}$/.test(code)) fail(`房间号异常: ${code}`);
console.log("房间号:", code, "| reconnectionToken 存在:", Boolean(roomA.reconnectionToken));

// 3. B 通过 HTTP 查询 + joinById 加入
const clientB = new Client(SERVER);
const found = await fetch(`${HTTP}/api/rooms/${code}`).then((r) => r.json());
if (!found.roomId) fail("房间号查询不到房间");
const roomB = await clientB.joinById(found.roomId, { name: "乙", clientId: "smoke-b" });
await sleep(300);
if (roomA.state.players.length !== 2) fail(`人数异常: ${roomA.state.players.length}`);
console.log("双人在房:", roomA.state.players.map((p) => p.name).join(", "));

// 4. 房主开局 → 当前玩家抽牌
roomA.send("start_game");
await sleep(500);
if (roomA.state.phase === "lobby") fail("开局失败");
const current = roomA.state.currentPlayerId;
const currentRoom = current === roomA.sessionId ? roomA : roomB;
currentRoom.send("draw_card");
await sleep(500);
if (roomA.state.pendingCardId === "") fail("抽牌无响应");
console.log(`轮到 ${current === roomA.sessionId ? "甲" : "乙"}，抽牌后阶段: ${roomA.state.phase}，牌面: ${roomA.state.pendingCardKind}`);

// 5. 聊天广播
let chatOk = false;
roomB.onMessage("chat", (m) => { if (m.text === "冒烟测试") chatOk = true; });
roomA.send("chat", { text: "冒烟测试" });
await sleep(300);
if (!chatOk) fail("聊天未送达");

await roomA.leave(true);
await roomB.leave(true);
console.log("SMOKE OK");
process.exit(0);
