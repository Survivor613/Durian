# Durian Online

本项目是 Durian 在线版的初始全栈骨架：

- `durian-web`: Next.js + React 前端
- `durian-server`: Colyseus 实时游戏服务器

当前版本实现了完整联机房间生命周期：大厅可加入，开局后锁房；房主负责开局、返回大厅和结束游戏；回合只在在线座位间轮转。玩家掉线后保留座位 120 秒并可用 reconnection token 恢复，当前玩家掉线会清除未完成选择并安全轮转；在线不足两人时暂停等待，永久离开导致对局人数不足时返回大厅并解锁。聊天仅限房间成员且有保守频率限制，非法操作会通过 `action_error` 只反馈给发起者。

## 游戏模式

- `classic`（默认）：保持原有 28 张水果牌 + 光彦、墨菲、娜娜 3 张经典大猩猩牌及经典结算规则不变。
- `curious-market`：在经典牌组上各加入 1 张葡萄珠匠和订单换位魔术师。结算按固定顺序执行：先由光彦使数量为 3 的订单无效、娜娜使香蕉订单无效；再让每张仍有效葡萄订单按 1 计算；最后交换草莓与葡萄库存总数，订单不交换。

仅房主可在大厅切换模式；选择实时同步给全员，开局后锁定，结束后返回大厅仍保留上次选择。结算消息包含按执行顺序排列的结构化效果解释。

## 本地启动

先分别安装依赖：

```bash
cd durian-web && npm install
cd ../durian-server && npm install
```

然后开两个终端：

```bash
cd durian-server
npm run dev
```

```bash
cd durian-web
npm run dev
```

浏览器打开 http://localhost:3000。

## 测试与冒烟

```bash
cd durian-server
npm test
npm run build

cd ../durian-web
npm run build
```

启动服务端后，可从仓库根目录执行真实三客户端冒烟；它验证开局锁房不可查询、当前玩家掉线后轮转、`reconnect()`，以及服务端在 `onReconnect` 主动补发库存（不依赖客户端请求）：

```bash
node tools/smoke-online.mjs
# 临时端口示例：SMOKE_SERVER=ws://localhost:3567 node tools/smoke-online.mjs
```

## 环境变量

| 变量 | 位置 | 说明 |
|---|---|---|
| `PORT` | durian-server | 监听端口，本地缺省 2567；PaaS 自动注入 |
| `ALLOWED_ORIGINS` | durian-server | 允许跨域访问 `/api` 的前端来源，逗号分隔；缺省 `http://localhost:3000` |
| `NEXT_PUBLIC_COLYSEUS_URL` | durian-web | Colyseus 地址，如 `wss://xxx.up.railway.app`；构建期注入，改动后需重新部署 |

## 生产部署（Railway + Vercel）

### 后端 → Railway

1. 仓库推送到 GitHub（注意：根目录 `.env` 含密钥，绝不能提交，确认已被 `.gitignore` 忽略）。
2. Railway 新建项目 → Deploy from GitHub repo → Root Directory 设为 `Durian/durian-server`（Nixpacks 自动执行 `npm ci && npm run build`，启动命令 `npm start`）。
3. 环境变量：`ALLOWED_ORIGINS=https://<你的 Vercel 域名>`（`PORT` 由 Railway 自动注入）。
4. Settings → Networking 生成公网域名（自动 HTTPS/WSS）；Region 选离玩家最近的可用区域。
5. 验证：`curl https://<域名>/healthz` 返回 `{"ok":true}`；`curl https://<域名>/api/rooms/12345678` 返回 404 JSON。

### 前端 → Vercel

1. Vercel 导入同一仓库，Root Directory 设为 `Durian/durian-web`。
2. 环境变量：`NEXT_PUBLIC_COLYSEUS_URL=wss://<Railway 域名>`（必须是 `wss://`）。
3. 部署后打开 Vercel 域名，按下面清单冒烟。

### 冒烟清单

- A 建房 → B 用 8 位房间号加入 → 开局打完整一轮（抽牌/选边/敲铃结算）
- 刷新一端页面，验证 120 秒内自动重连回座位
- 房主结束游戏，所有人回首页

## 帐号系统扩展路线（预留，未实现）

代码里已埋好的钩子：

- `durian-server/src/rooms/DurianRoom.ts` 的 `static onAuth`：当前匿名放行，未来在此验证 JWT 并返回 `userId`。
- 前端 `page.tsx` 的 `getClientId()`：localStorage 持久匿名 ID，随 join options 上传并存于 `client.userData.clientId`，是未来 `userId` 的过渡形态。

后续步骤：

1. **认证**：前端接入 Auth.js（或自建用户名+密码）签发 JWT → 连接时经 `options.token` 携带 → 服务端 `onAuth` 校验。
2. **身份迁移**：座位归属从 `sessionId` 换成 `userId`；断线重连继续用 Colyseus reconnection token，天然兼容。
3. **持久化**：Railway 加 PostgreSQL，存用户、战绩、对局结算结果；Colyseus 房间保持纯内存。
4. **水平扩展**（远期）：单进程不够用再加 `@colyseus/redis-presence` + Redis driver。

> 提示：Vercel/Railway 为海外服务，国内访问延迟与稳定性需实测；不达标可迁回国内 VPS + Docker。
