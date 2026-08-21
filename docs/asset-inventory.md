# 资源清单

## 发布资源

`durian-web/public/assets/` 中的水果、角色、桌面、卡牌和 UI 成品由前端直接引用，均不得移动。

## 源素材

`assets/source/` 保存角色、水果和游戏 UI 源文件。当前未移动这些文件，因为它们不是明确的旧版本，且可用于后续重新导出。

## 本次归档

全仓检索未发现 `assets/review/` 审核 contact sheet 被 `durian-web/public/assets/` 或代码引用。仅将以下两个审核汇总图移动到对应归档目录：

- `assets/review/background-walls/contact-sheet.png` → `assets/archive/review/background-walls/contact-sheet.png`
- `assets/review/emotes-contact-sheet.png` → `assets/archive/review/emotes-contact-sheet.png`

背景候选图、标题概念图和生成脚本仍留在 `assets/review/`，因为它们不是本次明确要求归档的两个 contact sheet。

## 2026-08 三位员工发布资源

以下三位员工各发布一张标准角色卡和一张聊天表情，均位于 `durian-web/public/assets/`：

- 封箱经理·克莱德（`boxing-manager`）：`gorilla-boxing-manager.png` 为 `750x1000 RGB`；`emote-boxing-manager.png` 为 `256x256 RGB`。
- 库存搬运工·巴鲁（`inventory-mover`）：`gorilla-inventory-mover.png` 为 `750x1000 RGB`；`emote-inventory-mover.png` 为 `256x256 RGB`。
- 临时主管·菲恩（`temporary-supervisor`）：`gorilla-temporary-supervisor.png` 为 `750x1000 RGB`；`emote-temporary-supervisor.png` 为 `256x256 RGB`。

发布资源规格以完整解码后的像素尺寸和颜色模式为准；卡片统一为 `750x1000 RGB PNG`，表情统一为 `256x256 RGB PNG`。

三位新员工的表情已改为逐角色紧凑头肩裁切，避免完整场景缩进圆形按钮：克莱德源图裁切框为 `(220,55)-(804,639)`，巴鲁为 `(235,150)-(789,704)`，菲恩为 `(245,135)-(799,689)`；坐标基于各自 `1024x1536` 定稿卡面。

## 紫罗结算特效

- 源素材：`assets/source/game-ui/grape-skewer-single-gemini-v8-final.png`，`1024x1024 RGBA PNG`；参考 `assets/source/fruits/grape-v1.png` 保持游戏内葡萄形象一致，并保留旧源 `grape-skewer-v1.png` 与 `grape-skewer-single-v2.png`。
- 发布素材：`durian-web/public/assets/effect-grape-skewer.png`，`256x256 RGBA PNG`；本轮由 Gemini `gemini-3-pro-image-preview` 生成后清理透明背景并导出。
- 视觉约束：必须是一颗饱满圆润、紫水晶通透的单颗葡萄，带自然高光、内部透光和少量露珠；搭配精致纤细签子、金属尖端与装饰握柄。透明背景干净，禁止多颗葡萄、葡萄串/珠链、文字、数字、边框、标牌、角色或场景。
- 用途：葡萄珠匠·紫罗结算时，原葡萄订单整卡划掉后，在订单旁显示单颗水晶葡萄金属签与 `×1`；不得用普通葡萄图或旧的 `×2/×3` 划线角标替代。
