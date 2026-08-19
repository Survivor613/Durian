// 本地生产模式联机冒烟：锁房查询、掉线轮转与 reconnect()。
import { Client } from "../durian-web/node_modules/@colyseus/sdk/build/index.mjs";

const SERVER = process.env.SMOKE_SERVER ?? "ws://localhost:2567";
const HTTP = SERVER.replace(/^ws/, "http");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fail = (message) => { throw new Error(message); };
const waitFor = async (predicate, message, timeout = 5_000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await predicate()) return;
    await sleep(50);
  }
  fail(message);
};

const rooms = [];
try {
  const health = await fetch(`${HTTP}/healthz`).then((response) => response.json());
  if (!health.ok) fail("healthz 失败");

  // 容量合同是总计 7 人：1 名房主 + 6 名来宾；第 8 人必须被 matchmaking 拒绝。
  const capacityHostClient = new Client(SERVER);
  const capacityHost = await capacityHostClient.create("durian", { name: "容量房主", clientId: `capacity-host-${Date.now()}` });
  rooms.push(capacityHost);
  await waitFor(() => /^\d{8}$/.test(capacityHost.state?.roomCode ?? ""), "容量房间号未同步");
  const capacityCode = capacityHost.state.roomCode;
  const capacityRoomId = capacityHost.roomId;
  for (let index = 1; index <= 6; index += 1) {
    const guestClient = new Client(SERVER);
    const guest = await guestClient.joinById(capacityRoomId, { name: `容量来宾${index}`, clientId: `capacity-guest-${index}-${Date.now()}` });
    rooms.push(guest);
  }
  await waitFor(() => capacityHost.state.players.length === 7, "房主 + 6 来宾未全部加入");

  const eighthClient = new Client(SERVER);
  let eighthRejected = false;
  try {
    const eighth = await eighthClient.joinById(capacityRoomId, { name: "第八人", clientId: `capacity-eighth-${Date.now()}` });
    rooms.push(eighth);
  } catch {
    eighthRejected = true;
  }
  if (!eighthRejected) fail("第 8 人不应加入已满的七人房间");

  const closedMessage = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("未收到 room_closed")), 5_000);
    capacityHost.onMessage("room_closed", (payload) => {
      clearTimeout(timer);
      resolve(payload?.message);
    });
  });
  capacityHost.send("end_game");
  if (await closedMessage !== "房主已解散房间") fail("room_closed 文案不正确");
  await waitFor(async () => (await fetch(`${HTTP}/api/rooms/${capacityCode}`)).status === 404, "解散后房间号仍可查询");
  const staleClient = new Client(SERVER);
  let staleJoinRejected = false;
  try {
    const stale = await staleClient.joinById(capacityRoomId, { name: "旧房间来宾", clientId: `capacity-stale-${Date.now()}` });
    rooms.push(stale);
  } catch {
    staleJoinRejected = true;
  }
  if (!staleJoinRejected) fail("解散后旧 roomId 不应可加入");

  const clientA = new Client(SERVER);
  const roomA = await clientA.create("durian", { name: " 甲\n 一号 ", clientId: `smoke-a-${Date.now()}` });
  rooms.push(roomA);
  await waitFor(() => /^\d{8}$/.test(roomA.state?.roomCode ?? ""), "房间号未同步");
  const code = roomA.state.roomCode;
  const found = await fetch(`${HTTP}/api/rooms/${code}`).then((response) => response.json());

  const clientB = new Client(SERVER);
  let roomB = await clientB.joinById(found.roomId, { name: "乙", clientId: `smoke-b-${Date.now()}` });
  rooms.push(roomB);
  const clientC = new Client(SERVER);
  const roomC = await clientC.joinById(found.roomId, { name: "丙", clientId: `smoke-c-${Date.now()}` });
  rooms.push(roomC);
  await waitFor(() => roomA.state.players.length === 3, "三人未全部入座");
  if (roomA.state.players[0].name !== "甲 一号") fail("昵称规范化失败");

  roomA.send("start_game", { startPlayerId: roomB.sessionId });
  await waitFor(() => roomA.state.phase === "playing", "开局失败");
  const lockedLookup = await fetch(`${HTTP}/api/rooms/${code}`);
  if (lockedLookup.status !== 404) fail(`锁房仍可查询: ${lockedLookup.status}`);

  const token = roomB.reconnectionToken;
  roomB.connection.close();
  await waitFor(() => roomA.state.players.find((player) => player.id === roomB.sessionId)?.connected === false, "掉线状态未同步");
  await waitFor(() => roomA.state.currentPlayerId === roomC.sessionId, "当前玩家掉线后未轮到下一在线玩家");

  let inventoryReceived = false;
  roomB = await clientB.reconnect(token);
  rooms.push(roomB);
  roomB.onMessage("inventory_view", () => { inventoryReceived = true; });
  await waitFor(() => roomA.state.players.find((player) => player.id === roomB.sessionId)?.connected === true, "reconnect() 后未恢复在线");
  await waitFor(() => inventoryReceived, "onReconnect 未主动补发库存");

  console.log("SMOKE OK: 总计七人容量、第八人拒绝、解散失效、锁房查询、掉线轮转、reconnect()、主动库存补发");
} finally {
  for (const room of [...new Set(rooms)]) {
    try { room.connection.close(); } catch { /* already closed */ }
  }
}
