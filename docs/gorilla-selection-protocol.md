# 猩猩阵容选择协议

## 状态

房间状态同步两个字段：

- `selectedGorillaIds: string[]`：当前猩风作浪阵容，默认包含 `mitsuhiko`、`moo`、`nana`、`grape-beadsmith`、`order-swap-magician`、`boxing-manager`、`inventory-mover`、`temporary-supervisor` 八个 ID。
- `maxGorillas: number`：一小局开始时发给所有场上玩家的初始库存中，猩猩库存卡的总上限，默认 `8`。后续从牌堆抽牌不受此上限限制；双人局公共 dummy inventory 也不计入。

这些字段只影响 `curious-market`。`classic` 继续使用经典三张猩猩牌组，不读取阵容配置。

## 入站消息

大厅阶段仅房主可发送：

```json
{
  "gorillaIds": ["moo", "nana", "inventory-mover"],
  "maxGorillas": 2
}
```

消息类型为 `set_gorilla_selection`。payload 必须严格只包含 `gorillaIds` 和 `maxGorillas`：

- `gorillaIds` 必须是当前猩风作浪 roster 中的合法 ID；
- 不得重复，且至少选择一个；
- `maxGorillas` 必须是有限整数，范围为 `1` 至选中数量；
- 权限、阶段或字段校验失败时返回 `action_error`，状态不变。

## 牌组语义

开始猩风作浪回合前，服务端先从模式牌组中过滤全部选中的猩猩，之后统一洗牌。发放玩家初始库存时，未达到 `maxGorillas` 使用既有 `playerGorillaWeight` 加权抽取；达到上限后仅抽水果牌。双人局公共 dummy inventory 直接从牌堆抽取，不计入玩家上限；回合开始后的普通抽牌也不受该上限限制。经典模式不应用此过滤或上限。
