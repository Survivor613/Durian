import { defineServer, defineRoom, matchMaker } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { DurianRoom } from "./rooms/DurianRoom.js";

const port = Number(process.env.PORT ?? 2567);

// 允许跨域访问 /api 的前端来源，逗号分隔；本地开发缺省放行 localhost:3000
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function applyCors(req: import("express").Request, res: import("express").Response) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
}

const server = defineServer({
  rooms: {
    durian: defineRoom(DurianRoom),
  },
  transport: new WebSocketTransport(),
  express: (app) => {
    // PaaS（Railway 等）在边缘终止 TLS，需要信任代理才能拿到正确的客户端信息
    app.set("trust proxy", 1);

    app.get("/healthz", (_req, res) => {
      res.json({ ok: true });
    });

    app.get("/api/rooms/:roomCode", async (req, res) => {
      applyCors(req, res);
      const roomCode = String(req.params.roomCode ?? "");
      if (!/^\d{8}$/.test(roomCode)) {
        res.status(400).json({ error: "房间号必须是 8 位数字" });
        return;
      }
      const rooms = await matchMaker.query({ name: "durian" });
      const room = rooms.find((item) => item.metadata?.roomCode === roomCode && !item.locked && item.clients < item.maxClients);
      if (!room) {
        res.status(404).json({ error: "找不到可加入的房间" });
        return;
      }
      res.json({ roomId: room.roomId, roomCode });
    });
  },
});

server.listen(port);
console.log(`Durian Colyseus server listening on port ${port}`);
console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);

// PaaS 重新部署/缩容时会发 SIGTERM，优雅停机给进行中的对局留出收尾时间
process.on("SIGTERM", () => {
  console.log("收到 SIGTERM，开始优雅停机…");
  void server.gracefullyShutdown(false);
});
