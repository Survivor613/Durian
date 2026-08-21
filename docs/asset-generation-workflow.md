# 美术资源生成工作流

本文记录角色卡面与聊天表情的可复用生成、审核、发布和清理流程。文档不记录 API 密钥、访问令牌或 `.env` 内容；密钥只通过运行环境提供。

## 1. 基准与生成顺序

1. 始终把三张原角色作品同时作为共同风格参考：
   - `assets/source/characters/mitsuhiko/room-v1.png`
   - `assets/source/characters/moo/room-v1.png`
   - `assets/source/characters/nana/room-v1.png`
2. 先生成候选角色图，再将“候选角色图 + 上述三张原图”一起输入，进行 v2 精修。候选图只用于迭代，不直接发布。
3. 卡面定稿后，从最能体现角色身份和情绪的精彩区域截取、提炼或重绘聊天表情。表情应参考定稿卡面和原三角色的 emote；允许以精彩角色区域为构图基础，但禁止把整张卡面机械缩小塞入正方形画布。
4. 卡面和表情分别审核、导出；源文件进入 `assets/source/`，公开成品进入 `durian-web/public/assets/`。
5. 正式上线还必须完成员工手册资料与合理故事、本地文档同步、按用户要求确定所属模式；在职角色总数超过 7 位时，大厅按房间生成随机角色顺序，角色足够覆盖玩家时不得重复分配。

## 2. 工具与参数

默认使用 `gemini-3-pro-image-preview`，质量统一为 `high`；仅允许使用以下 Gemini 图片模型：

- `gemini-3.1-flash-image`
- `gemini-3-pro-image-preview`（默认）

Gemini 图片模型统一使用原生 `generateContent` 端点：

- Gemini 图片接口：`<base-url>/v1beta/models/<model>:generateContent`
- 不再使用 `gpt-image-2`、OpenAI 图片接口或 `/v1/images/generations`、`/v1/images/edits`。
- 卡面源图：`1024x1536 high`
- 表情源图：`1024x1024 high`
- 发布卡面：`750x1000 RGB`
- 发布表情：`256x256 RGB`

`tools/generate-assets.mjs` 只调用 Gemini 原生图片接口，使用 `GEMINI_API_KEY` 与现有 `GEMINI_BASE_URL`。如果 Base URL 末尾带 `/v1`，脚本会在拼接原生 `v1beta` 路径前去掉末尾 `/v1`，实际请求严格为 `<base-url>/v1beta/models/<model>:generateContent`，避免 `/v1/v1beta` 冲突。Gemini 原生请求将参考 PNG 作为 `inline_data` 发送，并从 `candidates[].content.parts[].inline_data` 或 `inlineData` 读取返回图片。API 密钥只允许通过环境变量提供，不写入文档、源码或命令历史。输出参数是相对于 `assets/` 的路径：

```bash
IMAGE_MODEL=gemini-3-pro-image-preview IMAGE_SIZE=1024x1536 IMAGE_QUALITY=high \
node tools/generate-assets.mjs \
  --input assets/source/characters/mitsuhiko/room-v1.png \
  --input assets/source/characters/moo/room-v1.png \
  --input assets/source/characters/nana/room-v1.png \
  source/characters/<character-id>/room-v1.png \
  "<完整卡面 prompt>"
```

v2 精修时把候选图放在首个 `--input`，后接三张原图：

```bash
IMAGE_MODEL=gemini-3-pro-image-preview IMAGE_SIZE=1024x1536 IMAGE_QUALITY=high \
node tools/generate-assets.mjs \
  --input assets/source/characters/<character-id>/room-v1.png \
  --input assets/source/characters/mitsuhiko/room-v1.png \
  --input assets/source/characters/moo/room-v1.png \
  --input assets/source/characters/nana/room-v1.png \
  source/characters/<character-id>/room-v2.png \
  "<v2 精修 prompt>"
```

表情应开启 `1024x1024`，输入定稿卡面以及三张原角色 emote（按仓库中实际源文件路径传入），独立描述表情构图与动作。

## 3. 可复用 Prompt 结构

每次应填写完整结构，不依赖模型猜测前一次上下文：

```text
【任务】生成《Durian》角色卡面 / 聊天表情，角色 ID：<character-id>。

【共同风格】严格以输入的三张原角色作品为同等权重的共同参考。保持同一种大猩猩物种、相同面部结构规律、毛发塑形、粗线条、明快赛璐璐上色、材质颗粒、夸张但友善的桌游插画气质。不要把参考角色本人混合成新角色；只继承统一画风和物种语言。

【角色身份】<职业、性格、年龄感、体型、服装、道具>。轮廓必须一眼可辨，脸仍明确属于与原三角色相同物种和世界观。

【构图】<卡面：竖构图、完整头肩/半身、安全边距、主体居中；表情：正方形、近景、透明或易抠背景、缩至 256px 仍清楚>。

【机制符号】
- 葡萄串珠匠：必须出现“葡萄横签图标”，是一枚横向招牌/标签，葡萄图形清晰，不得误画成文字、酒瓶或普通圆点。
- 订单交换魔术师：必须出现“彩色水果交换图标”，用不同颜色水果与明确双向交换箭头表达，不得只用单色箭头或扑克牌花色代替。

【色彩与光照】<主色、辅色、背景、轮廓对比>；保持原作高饱和、清晰明暗层级，避免写实摄影光。

【输出要求】单张成品，无样机、无边框外杂物、无水印。卡面源图 1024x1536；表情源图 1024x1024；high quality。

【负面约束】不要人类、猴子或其他灵长类物种；不要写实照片、3D 渲染、低幼扁平图标、日漫人物、风格拼贴；不要改变物种脸型；不要多余肢体、手指、眼睛、牙齿或重复道具；不要乱码文字、品牌标志、水印、签名；不要裁掉头顶、下巴、关键手势或机制图标；不要把葡萄横签画成竖牌；不要把彩色水果交换图标画成单色、单向或无水果；不要复刻任一原角色的服装和身份。
```

v2 prompt 需额外明确：候选图定义角色身份、姿势与核心道具；三原图只约束共同画风和物种。列出本轮只需修正的问题，例如脸型漂移、图标不清、手部错误或边缘裁切，禁止无关重设计。

表情 prompt 需额外明确：基于定稿角色身份，重新绘制适合聊天窗口的独立近景表情；参考原三 emote 的线条、头部占比和可读性，不得直接缩放或裁切卡面。

## 4. 审核清单

- [ ] 三张原角色图均作为共同参考，没有只模仿其中一张。
- [ ] 与原三角色是同物种、同世界观、同画风，但身份和轮廓可区分。
- [ ] 角色脸、毛发、服装、手部、道具无结构错误或意外重复。
- [ ] 葡萄串珠匠的葡萄横签图标横向、清晰、无乱码。
- [ ] 订单交换魔术师的彩色水果交换图标包含不同颜色水果和明确交换关系。
- [ ] 无水印、签名、品牌、乱码文字、候选标记或多余边框。
- [ ] 卡面及大厅专用角色图均为 `750x1000`；发布表情为 `256x256`，采用确定性正方形近景构图，禁止把整身或整张卡面直接缩小塞入画布。
- [ ] 表情的脸部/关键头肩区域在成品中占据足够宽高与面积；用人工标注矩形记录定义、坐标和裁切前后占比，不得用背景颜色 flood-fill 结果冒充脸部 bbox。
- [ ] 表情必须分别按原生 `76x76` 和 `40x40` 实际查看：两档均可识别角色、情绪和脸部轮廓；`76px` 可读职业服饰/手势，`40px` 仍保留角色关键特征（例如低眼镜与精明眼神、挑眉与礼服领结）。
- [ ] 每位角色单独确定紧凑正方形裁切框并记录坐标；角色脸与头肩应成为圆形按钮主体，不得为复用统一裁切参数而保留大面积房间、桌面或卡面背景。
- [ ] 新增聊天表情时同步更新服务端 `CHAT_EMOTE_IDS` 和“全部支持表情可广播”测试；只有前端按钮和图片而没有服务端白名单不算完成发布。
- [ ] 大厅徽章外径 `180±4px`、圆心 `(140,120)`；机制对象保持彩色，外圈与交换箭头使用统一奶油白视觉体系。
- [ ] 大厅卡在桌面 `118px`、移动端 `92px` 宽度下仍清晰，圆角和阴影一致。
- [ ] 大厅专用图的修改严格限定左上 ROI，ROI 外逐像素等于原图按不透明白底合成后的 RGB 基线。
- [ ] 发布文件为 `RGB`，无意外调色板模式、CMYK 或灰度。
- [ ] 文件尺寸、文件名和引用路径与运行时代码一致。
- [ ] 运行前后端测试/构建，并搜索运行时代码中是否残留 `candidate` 或退役 ID。

## 5. 命名、发布与清理

- 角色 ID 使用小写 kebab-case，例如 `grape-beadsmith`、`order-swap-magician`。
- 角色源文件：`assets/source/characters/<character-id>/room-vN.png`、`emote-vN.png`。
- 原始水果：`assets/source/fruits/<fruit>-vN.png`；游戏 UI：`assets/source/game-ui/<name>-vN.png`。
- 被替代但仍有比较价值的迭代图：`assets/archive/iterations/<subject>/`。
- 公开卡面：`durian-web/public/assets/gorilla-<character-id>.png`；公开表情：`durian-web/public/assets/emote-<character-id>.png`。
- 大厅专用图：`durian-web/public/assets/lobby-gorilla-<character-id>.png`，只允许大厅显式映射引用，不得替换或影响正式游戏的 `gorillaImages`、牌组和规则。
- `candidate` 只能出现在临时候选文件或流程说明中，不得出现在正式公开文件名和运行时引用中。
- 发布确认后，删除明确判废的概念图、旧候选图和退役公开资源；不要删除未列入清理清单的文件。
- 清理后执行全局引用检查，确认没有悬空路径；正式牌组定义与社交展示角色分离，新社交角色不得加入游戏牌组类型、牌堆或规则。

## 6. 机制特效图

- 机制特效优先使用专属、可一眼说明能力的物件，不复用无法表达机制关系的普通水果图。
- 紫罗的订单折算特效使用 `assets/source/game-ui/grape-skewer-single-v2.png` 作为高分辨率源图，发布为 `durian-web/public/assets/effect-grape-skewer.png`；旧源版本保留，不覆盖。
- 动画顺序固定为：先在原葡萄订单整卡上播放与无效订单一致的手绘划线，再在卡旁出现单颗水晶葡萄金属签和 `×1`；禁止多颗葡萄、葡萄串或珠链；划线只表达数值被替换，不改变该订单的服务端有效状态。
- 特效源图保留高分辨率透明背景，发布图按实际 UI 尺寸导出，并在目标显示尺寸检查单颗葡萄与精致签子的轮廓、关键物件关系和文字可读性。
