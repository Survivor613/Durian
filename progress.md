## 2026-08-20 - Task: 添加仓库代理执行规范

### What was done

- 将用户提供的代理执行规范原样放入 Durian 仓库根目录，使后续模型与代理在进入仓库时能够读取统一规范。

### Testing

- 已重新读取根目录 `AGENTS.md`，确认文件存在且内容与来源文件一致。

### Notes

- `AGENTS.md`：新增仓库级模型与代理执行规范。
- `progress.md`：新增进度日志并记录本次文件落点与验证结果。
- 回滚方式：删除根目录的 `AGENTS.md`，并删除 `progress.md` 中本条记录；如果 `progress.md` 不再包含其他记录，可一并删除该文件。

## 2026-08-20 - Task: 记录三位新角色图像生成提示词

### What was done

- 将封箱经理·克莱德、库存搬运工·巴鲁和临时主管·菲恩的角色逻辑、内容提示词、统一画风要求、参考图职责和迭代流程整理为可复用文档。
- 明确区分“内容参考图决定画什么”和“画风参考图决定怎么画”，并记录当前推荐参考图及画风迁移边界。

### Testing

- 已确认文档包含通用生成参数、统一画风提示词、三位角色的独立内容提示词、最终执行段和迭代原则。
- 本次仅新增提示词文档，没有执行图片生成或运行时代码测试。

### Notes

- `docs/new-gorilla-generation-prompts.md`：新增三位角色的完整图像生成提示词和后续迭代规范。
- `progress.md`：追加本次文档交付和验证记录。
- 回滚方式：删除 `docs/new-gorilla-generation-prompts.md`，并从 `progress.md` 末尾移除本条任务记录。

## 2026-08-20 - Task: 配置代理自动调用图像生成 API

### What was done

- 在仓库代理规范中明确图像生成链路：当前推理模型负责理解需求并调用仓库脚本，`tools/generate-assets.mjs` 通过项目环境中的独立图像 API 完成实际图片生成。
- 规定图片生成任务无需切换推理模型，用户明确要求生成时应直接执行脚本，而不是只返回提示词。

### Testing

- 已确认新增规范引用的 `tools/generate-assets.mjs`、`docs/asset-generation-workflow.md` 和 `docs/new-gorilla-generation-prompts.md` 均为仓库现有路径。
- 本次只调整代理执行规范，没有调用图像 API。

### Notes

- `AGENTS.md`：新增图像生成的自动调用规则、默认参数、密钥保护和候选素材落点要求。
- `progress.md`：追加本次代理规范变更记录。
- 回滚方式：删除 `AGENTS.md` 中的“图像生成”章节，并从 `progress.md` 末尾移除本条任务记录。

## 2026-08-20 - Task: 生成封箱经理·克莱德候选图

### What was done

- 使用角色画风底稿和机制内容参考图，通过 APINebula 的 Gemini 原生图片端点生成封箱经理·克莱德候选卡面。
- 使用 `gemini-3.1-flash-image` 保持克莱德角色与画风，并允许对机制内容中的细节错误进行合理调整。
- 将接口返回的 JPEG 图像转换为标准 RGB PNG，并统一为 `1024 × 1536`。

### Testing

- API 请求返回 HTTP 200，并成功返回图片数据。
- 已通过 Pillow 完整解码与格式验证；最终文件为 RGB PNG、`1024 × 1536`。
- 当前工具环境无法直接执行人工视觉审核；画风、榴莲机制对应与手部细节仍需用户查看候选图确认。

### Notes

- `assets/source/characters/boxing-manager/room-generated-v1.png`：新增封箱经理·克莱德候选角色卡面。
- `progress.md`：追加本次图片生成与技术验证记录。
- 未修改或覆盖 `durian-web/public/assets/` 中的正式公开素材。
- 回滚方式：删除 `assets/source/characters/boxing-manager/room-generated-v1.png`，并从 `progress.md` 末尾移除本条任务记录。

## 2026-08-20 - Task: 归档新大猩猩角色候选图

### What was done

- 将封箱经理、库存搬运工、临时主管和画风测试目录中的 57 张非当前候选图移入 `assets/archive/iterations/new-gorillas/`，保留原目录分类和文件名。
- `assets/source/characters/` 中仅保留 6 张当前内容或画风基准图，降低后续选图和生成时误用错误候选的风险。
- 将克莱德的当前画风底稿更新为用户确认的 `room-candidate-v2-01.png`。

### Testing

- 已确认四个 source 目录合计保留 6 张 PNG，归档目录包含 57 张 PNG，整理前后总数均为 63。
- 每张图片移动后均重新计算 SHA-256，并确认与移动前一致。
- 已确认 `docs/new-gorilla-generation-prompts.md` 中的当前参考图均仍存在于 source 目录。
- 已确认 `durian-web/public/assets/` 没有产生本轮改动。

### Notes

- `assets/source/characters/boxing-manager/`：保留 `room-candidate-v2-01.png` 和 `room-strict-v4-03.png`。
- `assets/source/characters/inventory-mover/`：保留 `room-badge-review-02.png`。
- `assets/source/characters/near-expiry-supervisor/`：保留 `room-badge-review-02.png`。
- `assets/source/characters/style-tests/`：保留两张 `gorilla-style-test` 图片。
- `assets/archive/iterations/new-gorillas/`：新增四个归档子目录，保存 57 张旧候选图。
- `docs/new-gorilla-generation-prompts.md`：将克莱德画风底稿引用更新为 `room-candidate-v2-01.png`。
- `progress.md`：追加本次归档与验证记录。
- 回滚方式：将 `assets/archive/iterations/new-gorillas/<角色目录>/` 中的图片按原名移动回 `assets/source/characters/<角色目录>/`，删除空归档目录，将文档中的克莱德画风底稿改回 `room-candidate-03.png`，并从 `progress.md` 末尾移除本条记录。

## 2026-08-20 - Task: 以画风优先从零生成封箱经理

### What was done

- 仅使用克莱德确认画风基准和两张统一画风测试图，从零生成新的封箱经理候选卡面，没有输入任何机制内容候选图。
- 使用 `gemini-3-pro-image-preview` 强化画风遵循，并将内容简化为最后一个榴莲封存、榴莲暂停出售和温和停售手势。
- 将 API 返回图片转换为标准 RGB PNG，并统一为 `1024 × 1536`。

### Testing

- API 请求返回 HTTP 200，并成功返回图片数据。
- 已通过 Pillow 完整解码验证；最终文件为 RGB PNG、`1024 × 1536`。
- 当前工具环境无法直接人工查看图片；最终画风一致性和内容细节仍需用户审核。

### Notes

- `assets/source/characters/boxing-manager/room-style-first-v1.png`：新增画风优先的封箱经理候选图。
- `progress.md`：追加本次生成与技术验证记录。
- 未覆盖现有画风或内容基准，也未写入 `durian-web/public/assets/`。
- 回滚方式：删除 `assets/source/characters/boxing-manager/room-style-first-v1.png`，并从 `progress.md` 末尾移除本条记录。

## 2026-08-20 - Task: 使用文档原 Prompt 重绘封箱经理

### What was done

- 直接组合 `docs/new-gorilla-generation-prompts.md` 中克莱德内容提示词、统一画风提示词和通用执行段进行重绘，不使用上一轮重新编写的画风优先 Prompt。
- 第一张输入使用 `room-candidate-v2-01.png` 锁定克莱德与画风，第二张输入使用 `room-strict-v4-03.png` 提供机制内容。
- 第三方网关的 2K 请求超时后，仅将生成档位降为 1K，Prompt、模型和参考图保持不变；返回图统一转换为 `1024 × 1536` RGB PNG。

### Testing

- 2K 请求返回 HTTP 524；调整为 1K 后请求返回 HTTP 200，并成功取得图片。
- 已通过 Pillow 完整解码验证；最终文件为 RGB PNG、`1024 × 1536`。
- 当前工具环境无法直接人工查看图片；画风一致性仍需用户审核。

### Notes

- `assets/source/characters/boxing-manager/room-doc-prompt-v1.png`：新增使用文档原 Prompt 生成的封箱经理候选图。
- `progress.md`：追加本次生成过程和技术验证记录。
- 未覆盖现有候选或写入 `durian-web/public/assets/`。
- 回滚方式：删除 `assets/source/characters/boxing-manager/room-doc-prompt-v1.png`，并从 `progress.md` 末尾移除本条记录。

## 2026-08-20 - Task: 修正 3D 画风规范并重生成封箱经理

### What was done

- 根据确认的 `room-candidate-v2-01.png` 重写新大猩猩统一画风规范，删除与目标图冲突的二维手绘、粗描边、赛璐璐、纸张颗粒和“不要 3D”要求。
- 将目标画风改为无墨线、圆润数字雕塑体积、柔软短绒毛发、细腻皮肤、明确材质和柔和全局照明的风格化 3D 动画角色卡。
- 详细重写克莱德内容 Prompt，保留透明盒内最后一个榴莲、温和停售手势、榴莲单斜杠徽章和轻量订单提示，并规定内容复杂时优先保证画风。
- 只输入确认的 3D 克莱德基准图，机制内容全部使用文字描述，通过 `gemini-3-pro-image-preview` 生成新候选。

### Testing

- API 请求返回 HTTP 200，并成功返回 PNG 图片数据。
- 已通过 Pillow 完整解码验证；最终文件为 RGB PNG、`1024 × 1536`。
- 已确认正式 Prompt 不再包含“不要 3D 渲染”、赛璐璐上色、纸张颗粒、深色手绘轮廓或“重新手绘”等冲突要求。
- 已确认 `durian-web/public/assets/` 没有产生本轮改动。
- 当前工具环境无法直接人工查看图片；最终画风和内容仍需用户审核。

### Notes

- `docs/new-gorilla-generation-prompts.md`：统一改为目标 3D 画风，重写克莱德内容 Prompt、最终执行段和迭代原则。
- `assets/source/characters/boxing-manager/room-style-3d-v1.png`：新增只使用 3D 画风基准生成的克莱德候选图。
- `progress.md`：追加本次规范修正、生成与验证记录。
- 未覆盖现有候选，也未写入正式公开素材目录。
- 回滚方式：恢复 `docs/new-gorilla-generation-prompts.md` 本轮修改前版本，删除 `assets/source/characters/boxing-manager/room-style-3d-v1.png`，并从 `progress.md` 末尾移除本条记录。

## 2026-08-20 - Task: 严格按内容图重绘 3D 封箱经理

### What was done

- 将当前正确的 `room-style-3d-v1.png` 设为克莱德角色与 3D 画风唯一基准，将 `room-strict-v4-03.png` 设为不可省略的内容与构图蓝图。
- 新增严格内容重绘 Prompt，详细锁定克莱德的停售手势、透明封存柜、顾客订单、柜台图标牌、左上机制徽章和四处榴莲对应。
- 明确第二张图只提供动作、布局、对象数量和机制关系，禁止继承其二维线稿、赛璐璐、纸张纹理和暗色调。
- 使用两张职责分离的参考图，通过 `gemini-3-pro-image-preview` 生成严格内容版 3D 候选图。

### Testing

- API 请求返回 HTTP 200，并成功返回图片数据。
- 已通过 Pillow 完整解码验证；最终文件为 RGB PNG、`1024 × 1536`。
- 已确认文档严格要求四处榴莲对应、停售手势、透明柜、订单和柜台图标牌不得省略。
- 已确认 `durian-web/public/assets/` 没有产生本轮改动。
- 当前工具环境无法直接人工查看图片；四处榴莲对象、手部和画风仍需用户审核。

### Notes

- `docs/new-gorilla-generation-prompts.md`：更新克莱德当前参考图并新增严格内容重绘 Prompt。
- `assets/source/characters/boxing-manager/room-content-strict-3d-v1.png`：新增严格按内容蓝图生成的 3D 克莱德候选图。
- `progress.md`：追加本次 Prompt 设计、生成与验证记录。
- 未覆盖现有风格基准或写入正式公开素材目录。
- 回滚方式：恢复文档中克莱德 4.2 和 4.3 节的上一版本，删除 `assets/source/characters/boxing-manager/room-content-strict-3d-v1.png`，并从 `progress.md` 末尾移除本条记录。

## 2026-08-20 - Task: 将内容母版整图迁移为 3D 画风

### What was done

- 将输入顺序改为 `room-strict-v4-03.png` 作为第一张不可改动的完整内容母版，`room-style-3d-v1.png` 作为第二张仅提供渲染语言的画风参考。
- 将 Prompt 改为严格整图风格迁移，要求画布、镜头、裁切、脸型、表情、视线、姿势、双手、服装、道具、背景、水果、图标、数量、位置、尺寸、遮挡和留白全部按内容母版逐项保持。
- 删除“背景可简化”和自由重构空间，只允许将二维墨线、赛璐璐和纸张纹理替换为无描边 3D 材质、体积、光照和接触阴影。
- 使用 `gemini-3-pro-image-preview` 生成新的整图风格迁移候选。

### Testing

- API 请求返回 HTTP 200，并成功返回图片数据。
- 已通过 Pillow 完整解码验证；最终文件为 RGB PNG、`1024 × 1536`。
- 已确认文档明确禁止删除、添加、替换、移动、缩放、简化或重新设计内容母版中的任何可见内容。
- 已确认 `durian-web/public/assets/` 没有产生本轮改动。
- 当前工具环境无法直接人工比较像素级内容一致性；动作、细节和 3D 画风仍需用户查看候选图审核。

### Notes

- `docs/new-gorilla-generation-prompts.md`：将克莱德 Prompt 改为以内容图为第一输入的严格整图风格迁移。
- `assets/source/characters/boxing-manager/room-exact-content-3d-v1.png`：新增整图内容母版 3D 风格迁移候选。
- `progress.md`：追加本次策略纠正、生成与验证记录。
- 未覆盖任何既有候选或写入正式公开素材目录。
- 回滚方式：恢复文档中克莱德 4.2 和 4.3 节的上一版本，删除 `assets/source/characters/boxing-manager/room-exact-content-3d-v1.png`，并从 `progress.md` 末尾移除本条记录。

## 2026-08-20 - Task: 同步三位员工正式上线文档与长期规范

### What was done

- 将员工与卡池基线同步为 8 位在职员工、经典模式 31 张不变、猩风作浪 36 张（28 张水果牌 + 8 张大猩猩牌），记录克莱德、巴鲁、菲恩的正式名称、能力、故事和 ID。
- 固化猩风作浪现行结算顺序、并列最高/最低优先级及巴鲁不搬运边界，并将三位员工的正式发布资源纳入资源清单。
- 固化后续猩猩上线流程：标准尺寸卡片、精彩角色区域表情、员工故事与本地文档、模式决策，以及超过 7 位角色后的大厅随机顺序与不重复分配要求。
- 保留卡池历史并新增 2026-08 三位员工正式上线条目；修正生成提示词中已过时的“未上线”“规则待定”和“ID 待决定”描述。

### Testing

- 已使用 Pillow 完整解码三位员工各一套正式资源：`gorilla-*.png` 均为 `750x1000 RGB PNG`，`emote-*.png` 均为 `256x256 RGB PNG`。
- 当前发布工作已有服务端 51 项测试通过和前端生产构建通过的已知结果；本轮仅修改文档，未由本代理重复执行全量测试与构建。
- 已检查指定文档中的员工数、卡池数、正式 ID、固定结算顺序和过时状态描述；最终全量复核仍由主代理执行。

### Notes

- `AGENTS.md`：仅在图像生成章节追加正式上线资源、员工资料、模式选择和大厅角色分配规范。
- `README.md`：更新两种当前模式、8 位员工、36 张猩风作浪卡池及固定结算说明。
- `docs/gorilla-employee-handbook.md`：补全 8 位员工资料、三位新员工故事、结算边界和长期接入清单。
- `docs/card-pool-history.md`：更新当前卡池并追加 2026-08 三位员工正式上线历史条目。
- `docs/asset-inventory.md`：登记三位员工各一套正式卡片与表情的路径和规格。
- `docs/asset-generation-workflow.md`：固化标准卡片、精彩区域表情、员工故事、文档、模式与大厅分配流程。
- `docs/new-gorilla-generation-prompts.md`：标记三位员工已上线，补齐巴鲁边界并确认菲恩正式 ID。
- `progress.md`：仅在末尾追加本条完整任务记录。
- 回滚方式：以本条任务开始前的工作区为回滚点，逐项反向恢复上述 7 个规范/说明文档的本轮段落，并从 `progress.md` 末尾完整删除本条任务记录；不得改动此前历史日志或任何代码、图片。

## 2026-08-20 - Task: 正式上线克莱德、巴鲁和菲恩

### What was done

- 将三位员工定稿导出为标准角色卡，并从角色上半身精彩区域制作聊天表情，接入大厅、员工手册、聊天和结算展示。
- 在服务端实现三项能力及结构化结算说明，将三位员工加入猩风作浪，使该模式更新为 28 张水果牌与 8 张大猩猩牌；经典模式保持不变。
- 大厅按房间号生成稳定随机角色顺序，已有玩家保持原分配；角色数足够时同一大厅玩家不重复，超过角色池后才循环复用。
- 修正结算文案和执行顺序：巴鲁先按交换后的库存搬运，克莱德再保护搬运后的最低库存，菲恩在汇总有效订单时漏登每种水果第一张。

### Testing

- `durian-server` 执行 `npm test && npm run build`：51 项测试全部通过，TypeScript 构建通过。
- `durian-web` 执行 `npm run build`：Next.js 生产构建、类型检查和静态页面生成通过；仅保留原有 `metadataBase` 非阻断警告。
- 使用 Pillow 完整解码 6 个正式 PNG：三张卡片均为 `750x1000 RGB`，三张表情均为 `256x256 RGB`。
- 使用两个不同房间号复核随机顺序，8 个角色在各房间内均为 8 个唯一 ID，且房间之间顺序不同；`git diff --check` 通过。
- 当前工具未提供可用的媒体查看入口，无法再次人工复核表情裁切观感；卡面使用用户已确认的三张定稿，表情已按固定上半身区域确定性裁切。

### Notes

- `durian-server/src/game/types.ts`：注册三位正式角色 ID 和对应结算解释类型。
- `durian-server/src/game/deck.ts`：加入三张新大猩猩牌。
- `durian-server/src/game/modes.ts`：将三位员工加入猩风作浪并更新模式说明。
- `durian-server/src/game/rules.ts`：实现克莱德、巴鲁和菲恩能力及固定执行顺序。
- `durian-server/src/game/modes.test.ts`、`durian-server/src/game/rules.test.ts`、`durian-server/src/rooms/DurianRoom.test.ts`：覆盖 8 张大猩猩牌组、新能力和牌堆数量。
- `durian-web/src/data/gorillas.ts`：新增三位员工资料、故事和正式素材路径。
- `durian-web/src/app/page.tsx`：接入 8 张卡概率，并实现按房间稳定随机且优先不重复的大厅角色分配。
- `durian-web/src/components/EmployeeHandbook.tsx`、`durian-web/src/components/SettlementSequence.tsx`：展示八位员工、36 张卡池、新结算顺序和新角色动画素材。
- `durian-web/public/assets/gorilla-boxing-manager.png`、`gorilla-inventory-mover.png`、`gorilla-temporary-supervisor.png`：新增三张正式角色卡。
- `durian-web/public/assets/emote-boxing-manager.png`、`emote-inventory-mover.png`、`emote-temporary-supervisor.png`：新增三张正式聊天表情。
- `AGENTS.md`、`README.md`、`docs/gorilla-employee-handbook.md`、`docs/card-pool-history.md`、`docs/asset-inventory.md`、`docs/asset-generation-workflow.md`、`docs/new-gorilla-generation-prompts.md`：同步正式上线规范、角色资料、卡池、资源和生成记录。
- `progress.md`：追加正式上线实现、验证和回滚记录。
- 回滚方式：恢复上述服务端、前端和文档文件到本任务前版本，删除 6 个新增公开素材；不要回滚或删除任务开始前已存在的候选归档和其他未提交改动。

## 2026-08-20 - Task: 重做紫罗葡萄订单结算特效

### What was done

- 将紫罗旧的“角标内划掉 ×2/×3”效果改为与其他无效订单一致的整卡手绘划线，再在订单旁显示葡萄串签与 `×1` 标牌。
- 新增一张横向葡萄串签专属特效图：一颗颗紫葡萄沿木签串联，透明背景，小尺寸用于结算角标。
- 图像 API 因无效令牌返回 HTTP 401 后未切换模型，改用 Pillow 在本地确定性绘制并导出源图和正式资源。
- 本轮只修改前端表现，不改变紫罗“每张仍有效葡萄订单按 1 计算”的服务端规则。

### Testing

- `durian-web` 执行 `npm run build`：Next.js 生产构建、类型检查和静态页面生成通过；仅有原有 `metadataBase` 非阻断警告。
- `durian-server` 执行 `npm test`：51 项测试全部通过，紫罗服务端规则保持通过。
- 使用 Pillow 完整解码源图和正式图：分别为 `1024x1024 RGBA` 与 `256x256 RGBA`，透明通道范围为 `0–255`，非透明内容均位于画布安全范围内。
- 已确认运行时代码只引用新 `effect-grape-skewer.png`，旧 `.grape-old-rule` 运行时标记和样式已移除。
- 当前工具未提供可用媒体查看入口，无法在工具内人工目视复核最终图标；已通过确定性绘制参数、透明边界与目标尺寸完成技术验证。

### Notes

- `assets/source/game-ui/grape-skewer-v1.png`：新增高分辨率透明葡萄串签源图。
- `durian-web/public/assets/effect-grape-skewer.png`：新增紫罗结算特效正式图。
- `durian-web/src/app/page.tsx`：将紫罗命中订单改为整卡划线，并在旁侧显示葡萄串签 `×1`。
- `durian-web/src/app/globals.css`：复用整卡手绘划线动画，重排葡萄串签标牌并删除旧局部划线样式。
- `docs/asset-inventory.md`：登记葡萄串签源图、正式资源和用途。
- `docs/asset-generation-workflow.md`：记录专属机制特效与紫罗固定动画顺序。
- `progress.md`：追加本轮改造、验证和回滚记录。
- 回滚方式：恢复 `page.tsx`、`globals.css` 和两份资源文档到本任务前版本，删除两张葡萄串签图片，并从 `progress.md` 末尾移除本条记录。

## 2026-08-20 - Task: 修复新员工表情、准备快捷键和牌池可见性

### What was done

- 分别按克莱德、巴鲁和菲恩在定稿卡面中的脸部与头肩位置重新紧凑裁切三张表情，减少无关场景，让圆形聊天按钮中的角色主体更大。
- 修复服务端聊天表情白名单遗漏，将三个新角色加入允许广播的 8 个正式表情，并扩展对应测试。
- 增加结算完成后的 `Enter` 快捷准备：仅红色按钮可用时触发，忽略聊天输入、按钮、可编辑控件、组合键、长按和其他游戏阶段。
- 复核猩风作浪实际模式牌堆，确认三个新角色均包含在 36 张牌中并能通过正式抽牌函数抽出；不调整牌组概率和平衡。

### Testing

- `durian-server` 执行 `npm test && npm run build`：51 项测试全部通过，8 个正式表情均可广播，TypeScript 构建通过。
- `durian-web` 执行 `npm run build`：Next.js 生产构建、类型检查和静态页面生成通过；仅有原有 `metadataBase` 非阻断警告。
- 使用 `dist/game/modes.js` 确定性抽空猩风作浪牌堆：总计 36 张、8 张大猩猩，输出包含 `boxing-manager`、`inventory-mover`、`temporary-supervisor`。
- 三张重裁表情均完整解码为 `256x256 RGB PNG`，40px 缩略采样均含超过 1200 种颜色，未出现空白或单色错误图。
- 首次从仓库根目录调用 `tsx` 复核脚本因依赖解析路径失败；改用已通过构建的服务端 `dist` 产物后复核通过，代码和依赖未因此修改。

### Notes

- `durian-web/public/assets/emote-boxing-manager.png`、`emote-inventory-mover.png`、`emote-temporary-supervisor.png`：覆盖为逐角色紧凑头肩裁切版本。
- `durian-server/src/rooms/DurianRoom.ts`：将三个新角色加入聊天表情白名单。
- `durian-server/src/rooms/DurianRoom.test.ts`：将支持表情广播测试从 5 个扩展到 8 个。
- `durian-web/src/app/page.tsx`：增加无冲突的 `Enter` 准备快捷键和界面提示。
- `docs/asset-inventory.md`：记录三张表情的独立裁切坐标。
- `docs/asset-generation-workflow.md`：补充逐角色裁切和服务端表情白名单接入要求。
- `README.md`：记录 `Enter` 快捷键作用域和服务端改动后的重启要求。
- `progress.md`：追加本轮修复、验证和回滚记录。
- 回滚方式：恢复上述两个代码文件、一个测试文件和三份说明文档到本任务前版本，并从对应定稿卡面按旧统一裁切参数重新导出三张表情；不要回滚本任务前的其他未提交改动。


## 2026-08-20 - Task: 完善克莱德、巴鲁与菲恩结构化结算及差异化动画

### What was done

- 将三位员工的结算解释拆为独立判别类型：巴鲁明确返回来源、目标、固定搬运量与库存变化；菲恩返回每种水果第一张有效订单的归零变化；克莱德继续返回受保护水果，并保持巴鲁无法搬运时不生成解释。
- 扩展规则回归测试，覆盖三种结构化结果、菲恩跳过米奇与汉娜已判无效订单，以及七种效果的固定顺序、库存、订单、爆单与首张越界订单最终结果。
- 将三种解释的 active/committed 状态接入结算桌面：菲恩在目标订单上呈现细长紫红完整大 X、钢笔与印章光泽并保持降饱和；克莱德只封存所有库存牌中命中水果半区；巴鲁在独立桌面层用木箱和两颗水果呈现弧线搬运、`-2`、`+2` 与最终总数。三者提交态保留到本轮结束，并为 reduced-motion 直接显示最终态。
- 同步结算步骤时长、步骤说明与员工手册中的克莱德规则边界和三套视觉语义。

### Testing

- `durian-server` 执行 `npm test`：51 项测试全部通过；该命令内含 TypeScript 构建。
- `durian-server` 独立执行 `npm run build`：TypeScript 构建通过。
- `durian-web` 执行 `npm run lint`：失败；仓库没有 ESLint 配置，Next.js 15 的 `next lint` 进入首次配置交互并以退出码 1 结束。本轮未为绕过该既有配置缺口新增依赖或配置。
- `durian-web` 执行 `npm run build`：生产编译、类型检查与静态页面生成通过；仅保留既有 `metadataBase` 非阻断警告。
- 对本轮 7 个实现/文档文件执行 `git diff --check`：通过；仅输出 Git 的 LF 将来可能转为 CRLF 提示，无空白错误。

### Notes

- `durian-server/src/game/types.ts`：拆分克莱德、巴鲁、菲恩的判别联合与结构化字段。
- `durian-server/src/game/rules.ts`：补齐巴鲁搬运字段和菲恩首张有效订单变化，保持既有规则顺序与静默边界。
- `durian-server/src/game/rules.test.ts`：覆盖三种结构化结果、无效订单跳过与完整七效果最终结果。
- `durian-web/src/components/SettlementSequence.tsx`：同步前端解释类型、三种步骤时长和说明。
- `durian-web/src/app/page.tsx`：从可见解释派生三种状态，并映射到订单、库存半区和桌面搬运层。
- `durian-web/src/app/globals.css`：新增菲恩、克莱德、巴鲁差异化动画及 reduced-motion 最终态。
- `docs/gorilla-employee-handbook.md`：同步克莱德规则边界与三种结算视觉语义。
- `progress.md`：仅在全部验证完成后于末尾追加本条记录。
- 回滚方式：仅反向恢复上述 7 个实现/文档文件中本任务新增的结构化结算与视觉改动，并从 `progress.md` 末尾完整删除本条记录；保留任务开始前工作区中已有的角色上线、紫罗特效、资源、配置及其他未提交改动，不执行 `git reset`、`git clean` 或任何其他 Git mutation。


## 2026-08-20 - Task: 纠正菲恩、克莱德与巴鲁固定结算语义

### What was done

- 将菲恩的结算解释与视觉步骤移到全部特殊效果之前，同时仍先由服务端确定米奇、汉娜最终作废集合；每种水果首张名额只从过滤后的有效订单中选取，被作废订单不占名额，订单总数逻辑保持不变。
- 将克莱德保护目标改为根据 `baseInventory` 初始库存选择，最低库存并列继续沿用 `FRUITS` 稳定顺序；克莱德步骤发生在巴鲁之前。
- 保持莫比先交换当前库存，克莱德选定初始库存保护目标后，巴鲁再基于莫比交换后的当前库存执行 `-2/+2`；爆单以最终搬运库存判断，初始库存选出的保护水果继续豁免。
- 将完整解释顺序固定为菲恩、米奇、汉娜、紫罗、莫比、克莱德、巴鲁，并补充组合回归断言；核对前端结算序列与桌面效果均直接依赖服务端 explanation 数组顺序，没有硬编码旧顺序，因此无需修改前端实现。
- 同步员工手册中的能力定义、固定顺序、并列规则和最终爆单语义。

### Testing

- `durian-server` 执行 `npm test`：51 项测试全部通过；命令内含 TypeScript 构建。
- `durian-server` 独立执行 `npm run build`：TypeScript 构建通过。
- `durian-web` 执行 `npm run build`：Next.js 生产编译、类型检查和静态页面生成通过；仅有既有 `metadataBase` 非阻断警告。
- 仓库根目录执行 `git diff --check`：通过；仅输出 Git 的 LF 将来可能转为 CRLF 提示，无空白错误。
- 未重复执行 `npm run lint`：当前 `durian-web` 仍只有会进入交互配置的 `next lint`，没有新增可非交互 lint 入口。

### Notes

- `durian-server/src/game/rules.ts`：纠正菲恩 explanation 顺序、克莱德初始库存选目标及克莱德/巴鲁执行顺序，保留最终库存爆单判断。
- `durian-server/src/game/rules.test.ts`：更新菲恩优先、无效订单不占首单、克莱德初始库存目标和七效果固定顺序断言。
- `docs/gorilla-employee-handbook.md`：同步三位员工能力边界、完整固定顺序和爆单语义。
- `progress.md`：仅在末尾追加本轮纠正规则、验证与回滚记录。
- `durian-server/src/game/types.ts`、`durian-web/src/components/SettlementSequence.tsx`、`durian-web/src/app/page.tsx`：已核对现有结构化类型和前端 explanation 驱动机制满足本轮规则，无需修改。
- 回滚方式：仅反向恢复 `durian-server/src/game/rules.ts`、`durian-server/src/game/rules.test.ts`、`docs/gorilla-employee-handbook.md` 中本轮纠正，并从 `progress.md` 末尾完整删除本条记录；保留任务开始前全部既有未提交工作，不执行 `git reset`、`git clean` 或其他 Git mutation。

## 2026-08-20 - Task: 使用 Gemini 原生端点重绘三位员工聊天表情

### What was done

- 为 `tools/generate-assets.mjs` 增加 Gemini 图片模型原生 `generateContent` 请求分支，支持将参考 PNG 作为 `inline_data` 发送，并解析 Gemini 图片响应；原有 OpenAI 兼容接口分支保持不变。
- 使用 `api.yhlxj.ai` 的 `gemini-3-pro-image-preview` 生成三张候选表情：克莱德强化正面拒绝手势，巴鲁完整露脸并保留搬运动作，菲恩将脸部居中并保留电话、订单板和印章的忙乱识别点。
- 将候选图统一导出为三张 `256x256 RGB PNG` 正式聊天表情。

### Testing

- 三次 Gemini 原生请求均成功返回图片；巴鲁在首次请求超时后用精简参考请求重试成功。
- Pillow 检查三张正式表情均为 `256x256 RGB PNG`；40px 缩略图颜色数分别为 1476、1085、1502，无空白或单色错误。
- `tools/generate-assets.mjs` 成功通过 Gemini 原生端点生成候选；尚未执行 `durian-web` 生产构建。

### Notes

- `tools/generate-assets.mjs`：按模型自动选择 Gemini 原生或 OpenAI 兼容图片协议。
- `assets/source/characters/boxing-manager/emote-v2.png`、`inventory-mover/emote-v2.png`、`near-expiry-supervisor/emote-v2.png`：保留三张高分辨率候选源图。
- `durian-web/public/assets/emote-boxing-manager.png`、`emote-inventory-mover.png`、`emote-temporary-supervisor.png`：替换为本轮候选的 256px RGB 正式表情。
- `docs/asset-generation-workflow.md`：补充 Gemini 原生端点、请求与响应格式说明。
- `progress.md`：追加本轮生成、验证与回滚记录。
- 回滚方式：恢复 `tools/generate-assets.mjs`、`docs/asset-generation-workflow.md` 和三张 `durian-web/public/assets/emote-*.png` 到本轮前版本，删除三张 `assets/source/characters/*/emote-v2.png`，并从 `progress.md` 末尾移除本条记录；不执行 Git mutation。

## 2026-08-20 - Task: 调整菲恩订单大叉的毛笔笔墨质感

### What was done

- 将菲恩原有细直紫红大叉改为暖白主墨、酒红收边的粗细变化毛笔笔触，加入不规则毛边、飞白断纹和叠色阴影，使其更接近现有白色斜划的手绘质感。
- 同步调整钢笔笔尖、归零印章与订单降饱和强度，保持原有两笔动画、目标订单和结算顺序不变。

### Testing

- `durian-web` 执行 `npm run build`：Next.js 生产编译、类型检查和静态页面生成通过；仅有既有 `metadataBase` 非阻断警告。
- 对 `durian-web/src/app/globals.css` 执行 `git diff --check`：通过；仅输出 Git 的 LF 将来可能转为 CRLF 提示，无空白错误。

### Notes

- `durian-web/src/app/globals.css`：调整菲恩大叉、笔尖、印章和命中订单的视觉配色与纹理，不改动画时序及业务逻辑。
- `progress.md`：仅在末尾追加本轮视觉调整与验证记录。
- 回滚方式：仅反向恢复 `durian-web/src/app/globals.css` 中本轮菲恩笔触样式，并从 `progress.md` 末尾完整删除本条记录；不执行 Git mutation。

## 2026-08-20 - Task: 调整员工手册角色脸部焦点

### What was done

- 员工手册角色照片从统一 `object-position: center 28%` 改为按角色独立定位。
- 为克莱德、巴鲁和菲恩分别增加员工照片类名与焦点位置，让脸部更接近画面中心、减少顶部或侧向偏移；不旋转图片，不改变角色资源。

### Testing

- `durian-web` 执行 `npm run build`：Next.js 生产编译、类型检查和静态页面生成通过；仅有既有 `metadataBase` 非阻断警告。

### Notes

- `durian-web/src/components/EmployeeHandbook.tsx`：为员工照片容器增加角色 ID 类名。
- `durian-web/src/app/globals.css`：增加三位员工手册照片的独立 `object-position`。
- `progress.md`：追加本轮调整、验证和回滚记录。
- 回滚方式：恢复上述组件和 CSS 到本轮前版本，并从 `progress.md` 末尾删除本条记录；不执行 Git mutation。


## 2026-08-20 - Task: 补全巴鲁并列与搬运边界说明

### What was done

- 补全巴鲁角色资料与结算步骤文案，明确最高、最低并列均按草莓→香蕉→葡萄→榴莲取第一项，并说明全部相等时不搬运。
- 将员工手册中的巴鲁规则拆为清晰边界条目，覆盖单侧并列、双侧并列、全部相等、来源不足 2，以及每次只搬一组 2 颗且不拆分、不连续搬运多组。
- 最小同步 README 中会造成信息缺口的巴鲁简述，并纠正其既有旧结算顺序；未改服务端规则、协议或测试。

### Testing

- `durian-web` 执行 `npm run build`：Next.js 生产编译、类型检查与 4 个静态页面生成通过；仅有既有 `metadataBase` 非阻断警告。
- 对 `README.md`、`durian-web/src/data/gorillas.ts`、`durian-web/src/components/SettlementSequence.tsx`、`docs/gorilla-employee-handbook.md` 执行目标文件 `git diff --check`（未跟踪文件使用 `git diff --no-index --check /dev/null <file>`）：通过；仅输出 Git 的 LF 将来可能转为 CRLF 提示，无空白错误。

### Notes

- `durian-web/src/data/gorillas.ts`：补全巴鲁 tooltip 的最高/最低并列顺序与全相等不搬运说明。
- `durian-web/src/components/SettlementSequence.tsx`：在巴鲁实际搬运步骤的来源→目标说明后补充并列取项顺序。
- `docs/gorilla-employee-handbook.md`：扩展巴鲁角色资料和结算边界条目，保留克莱德基于初始库存、巴鲁基于莫比后当前库存的顺序语义。
- `README.md`：最小同步巴鲁并列、无搬运边界及现有固定结算顺序，避免简述与员工手册冲突。
- `progress.md`：仅在末尾追加本轮文案改动、验证与回滚记录。
- 回滚方式：仅反向恢复上述四个文案/组件文件中的本轮文字改动，并从 `progress.md` 末尾完整删除本条记录；保留任务开始前全部既有未提交工作，不执行 `git reset`、`git clean` 或其他 Git mutation。


## 2026-08-20 - Task: 实施订单效果顺序锁定、克莱德订单封箱与菲恩 SVG 大叉

### What was done

- 将菲恩、米奇、汉娜、紫罗的订单效果改为按固定顺序共享订单实例锁：菲恩按原订单顺序锁定每种水果首单并计 0，后续效果只处理未锁订单，同一订单最多命中一个订单效果；`validOrders` 只排除米奇或汉娜判无效的订单，订单总数由实际命中集合计算。
- 补齐顺序优先级、同水果后续订单、四类目标互斥、七效果完整结果，以及克莱德并列最低固定取第一项、库存 0 仍受保护且其他水果可爆单的回归测试。
- 将克莱德透明箱扩展到所有目标水果订单，仅覆盖订单已选水果半区，并与库存箱共用 active、committed、reduced-motion 生命周期；结算步骤明确保护整种水果、库存与订单都有箱且库存为 0 仍不爆单。
- 将菲恩原有 CSS 矩形长条替换为单个 inline SVG：两条不对称、略偏心曲线路径各自使用酒红粗边与暖白细墨双层描边，通过 `stroke-dasharray` / `stroke-dashoffset` 依次绘制，保留钢笔和 `from → 0` 印章。
- 同步角色资料、员工手册与 README，删除旧的最终有效订单反向预判描述，明确顺序锁定、每单最多一个订单效果、克莱德整种水果封箱与新 SVG 视觉语义。

### Testing

- `durian-server` 执行 `npm test`：54 项测试全部通过，0 失败。
- `durian-server` 执行 `npm run build`：TypeScript 构建通过。
- `durian-web` 执行 `npm run build`：Next.js 生产编译、类型检查和 4 个静态页面生成通过；仅有既有 `metadataBase` 非阻断警告。
- 对本轮 8 个实现/文档文件执行目标 `git diff --check`；已跟踪文件直接检查，未跟踪文件使用 `git diff --no-index --check /dev/null <file>`：通过，仅有 Git 的 LF 将来可能转为 CRLF 提示，无空白错误。
- 未进行浏览器目视验收；克莱德订单半区箱体叠加层级与菲恩两笔 SVG 的实际观感仍需在真实结算动画中人工确认。

### Notes

- `durian-server/src/game/rules.ts`：实现 `Set<OrderEntry>` 顺序锁、实际命中集合计数及克莱德库存 0/并列语义说明。
- `durian-server/src/game/rules.test.ts`：新增和更新订单效果互斥、优先级、后续订单、七效果及克莱德爆单边界测试。
- `durian-web/src/app/page.tsx`：向订单牌传入克莱德封箱状态，并用单个 inline SVG 替换菲恩两条 CSS 长条。
- `durian-web/src/app/globals.css`：改用 SVG 双层描边和路径逐笔动画，补齐 committed 与 reduced-motion 最终态，保留箱体低于其他订单效果的层级。
- `durian-web/src/components/SettlementSequence.tsx`：明确克莱德保护整种水果，库存与订单均封箱且库存 0 不爆单。
- `durian-web/src/data/gorillas.ts`：更新菲恩顺序首单锁定与克莱德并列、整种水果、库存 0 能力文案。
- `docs/gorilla-employee-handbook.md`：记录订单实例锁、有效订单定义、克莱德订单箱及菲恩 SVG 视觉规范。
- `README.md`：最小同步新的固定结算与克莱德保护语义。
- `progress.md`：仅在末尾追加本轮施工、验证、文件清单与回滚说明。
- 回滚方式：仅反向恢复上述 8 个实现/文档文件中本轮顺序锁、测试、订单封箱、SVG 与文案改动，并从 `progress.md` 末尾完整删除本条记录；保留任务开始前全部用户未提交改动，不执行 `git reset`、`git clean` 或任何其他 Git mutation。

## 2026-08-20 - Task: 将小局快捷发话改为库存牌旁云朵互动

### What was done

- 移除结算区顶部快捷短句按钮，把发送入口改为结算完成后自己库存牌右侧的小云朵按钮；右侧空间不足的对手座位自动将云朵翻到左侧。
- 点击小云朵后展开服务器拥有的快捷句库，选择一句后从对应玩家库存牌旁显示云朵式发言；其他玩家在相同牌位看到该发言，快捷语不再重复进入普通聊天消息列表。
- 每位玩家每小局最多发送一句；未发送可以直接准备下一局。特殊猩猩库存牌仍可看到两句专属短句。
- 云朵显示约 6 秒后淡出，普通文字聊天与表情聊天保持原样。

### Testing

- `durian-server` 执行 `npm test`：55 项测试全部通过，新增每位玩家每小局最多一句的服务端测试，0 失败。
- `durian-web` 执行 `npm run build`：Next.js 生产编译、类型检查和 4 个静态页面生成通过；仅有既有 `metadataBase` 非阻断警告。

### Notes

- `durian-server/src/rooms/DurianRoom.ts`：记录每轮已发言玩家、限制一次发送，并在广播中携带轮次供牌位定位。
- `durian-server/src/rooms/DurianRoom.test.ts`：更新快捷语广播契约并增加重复发送拒绝测试。
- `durian-web/src/app/page.tsx`：新增牌位云朵组件、自己牌旁选择入口、对手牌旁广播展示和快捷语聊天过滤。
- `durian-web/src/app/globals.css`：新增云朵外框、尾部圆点、快捷菜单、淡入淡出及默认右侧/右边缘左翻样式，删除旧顶部快捷按钮样式。
- `progress.md`：追加本轮交互改造、验证和回滚记录。
- 回滚方式：恢复上述四个实现与测试文件到本轮前版本，并从 `progress.md` 末尾删除本条记录；不执行 Git mutation。


## 2026-08-20 - Task: 将小局云朵发话从聊天协议彻底解耦

### What was done

- 服务端新增独立 `round_phrase` / `request_round_phrases` 协议与集中策略，统一维护短句文案、特殊资格、每轮每人一次、完整事件 payload 和本轮缓存；新轮、返回大厅清空，重连与显式请求补发。
- 云朵事件不再进入 `chat` 广播、聊天消息列表或聊天限流器；普通文字与猩猩表情聊天维持原协议。
- 前端拆出独立类型、Hook、云朵组件与 CSS Module；按 `eventId` 去重、按 `sentAt` 恢复约 5 秒生命周期，并在所有客户端对应库存牌上方播放。
- 自己结算完成后显示小入口，普通四句以左右两列大云朵展开；猩猩专属两句放独立切换页。右侧座位通过明确 `side="left"` 避让，包含 reduced-motion 降级。
- 删除 page 内联快捷语组件/状态/聊天过滤和 globals 旧云朵样式，并补充协议文档。

### Testing

- `cd durian-server && npm test`：59 项测试全部通过，0 失败；覆盖合法广播、每轮一次、特殊资格、阶段/非法输入拒绝、下一轮重置、缓存请求补发、重连补发、不触发 chat，并保留普通聊天测试。
- `cd durian-server && npm run build`：TypeScript 构建通过。
- `cd durian-web && npm run build`：Next.js 生产编译、类型检查与 4 个静态页面生成通过；仅有既有 `metadataBase` 非阻断警告。
- 仓库根执行 `git diff --check`，并对 6 个新文件执行 `git diff --no-index --check /dev/null <file>`：通过；仅有 Git 的 LF 将来可能转为 CRLF 提示，无空白错误。
- 搜索 `quick_phrase|request_quick_phrase|AutomaticQuickPhraseId|quickPhrasePayload|quickPhraseSent|PhraseBubble|phrase-bubble-|quickPhraseRound|phraseMenuOpen`：运行时代码与仓库均无匹配。
- 未实际执行双客户端浏览器目视验收；云朵位置、两次软弹、错峰悬浮和泡泡淡出仍需在真实双客户端牌局中人工确认。

### Notes

- `durian-server/src/rooms/domain/roundPhrasePolicy.ts`：新增快捷语目录、资格/次数策略、payload 与本轮缓存。
- `durian-server/src/rooms/DurianRoom.ts`：接入独立云朵协议、广播、请求补发、重连补发和轮次清理。
- `durian-server/src/rooms/DurianRoom.test.ts`：新增云朵协议完整回归测试。
- `durian-server/src/game/rules.test.ts`：同步任务开始时既有规则实现已经输出的结构化解释断言，使全套服务端测试恢复通过，未改规则实现。
- `durian-web/src/features/round-phrases/roundPhraseTypes.ts`：新增前端协议类型与短句目录。
- `durian-web/src/features/round-phrases/useRoundPhrases.ts`：新增独立订阅、补发请求、去重和可见生命周期管理。
- `durian-web/src/features/round-phrases/RoundPhraseCloud.tsx`：新增库存牌旁入口、普通/专属分页与最终发言渲染。
- `durian-web/src/features/round-phrases/RoundPhraseCloud.module.css`：新增完整云朵视觉、悬浮/软弹/淡出与 reduced-motion 样式。
- `durian-web/src/app/page.tsx`：仅保留 room、round、phase、库存类型、座位方向和结算完成状态接线，移除旧内联快捷语逻辑。
- `durian-web/src/app/globals.css`：删除旧 `.phrase-bubble-*` 与旧云朵动画。
- `docs/round-phrase-protocol.md`：记录独立入站、出站、缓存和重连契约。
- `progress.md`：追加本轮施工、验证、未目视项与回滚说明。
- 回滚方式：仅反向恢复上述 11 个实现、测试、文档文件中本轮云朵解耦相关改动，删除 6 个本轮新文件和本条 progress 记录；保留任务开始前全部未提交改动，不执行 Git mutation。


## 2026-08-20 - Task: 完整实施克莱德封箱与巴鲁实例搬运结算

### What was done

- 沿用工作树中已有的角色注册、基础结算顺序和半成品视觉，补成以库存位键和卡牌半区为单位的有效库存账本；莫比只交换草莓/葡萄的有效归属，克莱德按 `baseInventory` 先保护最低水果，巴鲁再排除保护水果并从最高合格有效库存选择具体来源。
- 巴鲁来源严格按单个 `2→0`、单个 `3→1`、两个 `1+1` 的优先级和 Map/左右半区稳定顺序选取；合格实例不足、来源目标相同均静默，结构化解释保留总量并增加 actor 与具体 sources，房间结算保留真实 inventory Map 键且 reveal 原库存卡不变。
- 前端按 `inventoryId + cardId + side` 精确移除来源 pip，支持莫比后的 `effectiveFruit`、普通玩家/自己/公共库存 actor 定位、一来源一辆车、双车错峰、巴鲁旁两次揉合与两颗目标水果最终态；克莱德复用 cover/i/b 完成罩体、盖合、锁环、锁扣和高光分段动画，并补齐 committed 与 reduced-motion 最终态。
- 同步角色资料、结算步骤、员工手册 UI、正式员工手册和 README，明确固定顺序、保护水果排除、实例选择、来源车辆及最终汇总语义。

### Testing

- `cd durian-server && npm test`：59 项测试全部通过，59 pass、0 fail、0 skipped；命令内含 TypeScript 构建，覆盖 `2→0`、`3→1`、`1+1`、稳定顺序、保护最高选次高、莫比有效水果、普通/公共 actor、静默边界、重复结算及真实房间 payload。
- `cd durian-server && npm run build`：TypeScript 构建通过。
- `cd durian-web && npm run build`：Next.js 15.5.23 生产编译、类型检查和 4 个静态页面生成通过；仅有既有 `metadataBase` 非阻断警告。
- 对本轮触碰的 12 个实现/文档文件执行目标 `git diff --check`；已跟踪文件直接检查，未跟踪文件使用 `git diff --no-index --check /dev/null <file>`：通过，仅有 Git 的 LF 将来可能转为 CRLF 提示，无空白错误。
- 未执行浏览器目视验收；克莱德锁具节奏、双车错峰、不同座位数/移动端安全路径及最终图层观感仍需真实牌局人工确认。

### Notes

- `durian-server/src/game/types.ts`：新增 `InventorySlot`，并为巴鲁解释增加 actor 与具体半区 sources 协议。
- `durian-server/src/game/rules.ts`：实现有效实例半区账本、莫比有效水果映射、克莱德保护排除及巴鲁稳定来源选择，保持旧数组调用兼容和输入不可变。
- `durian-server/src/game/rules.test.ts`：新增/更新巴鲁三类来源、稳定顺序、保护排除、莫比映射、actor、静默边界、重复结算与完整解释断言。
- `durian-server/src/rooms/DurianRoom.ts`：结算调用改为保留 inventories Map 键的 `InventorySlot[]`，reveal inventories payload 保持原样。
- `durian-server/src/rooms/DurianRoom.test.ts`：增加真实敲铃 payload 的 inventory key、actor/source 与原 reveal 卡验证。
- `durian-web/src/app/page.tsx`：补库存卡 ID、具体半区 removal 透传、莫比有效水果显示、actor/来源逻辑坐标、逐来源小车与两颗目标最终展示。
- `durian-web/src/app/globals.css`：实现克莱德五阶段锁箱动画和巴鲁取货、小车、揉合、交叉淡入淡出、汇总及 reduced-motion/committed 样式。
- `durian-web/src/components/SettlementSequence.tsx`：镜像巴鲁 actor/sources 类型，调整克莱德约 1500ms、巴鲁约 3400ms 步骤时长与说明。
- `durian-web/src/components/EmployeeHandbook.tsx`：纠正猩风作浪旧结算顺序并概括实例搬运规则。
- `durian-web/src/data/gorillas.ts`：补充克莱德保护排除与巴鲁具体实例选择能力说明。
- `docs/gorilla-employee-handbook.md`：记录有效半区账本、来源优先级、actor 定位和完整动画生命周期。
- `README.md`：同步克莱德/巴鲁结算简述与来源实例规则。
- `progress.md`：仅在末尾追加本轮施工、验证、文件清单和回滚说明。
- 回滚方式：仅反向恢复上述 12 个实现/测试/文档文件中本轮克莱德与巴鲁相关改动，并从 `progress.md` 末尾完整删除本条记录；保留任务开始前全部既有未提交改动，不执行 `git reset`、`git clean`、`git checkout` 或其他 Git mutation。


## 2026-08-20 - Task: 更正小局云朵发话的前端单例订阅

### What was done

- 将 `useRoundPhrases` 提升到牌桌页面单例调用，每个座位的云朵组件只接收对应事件、发送资格和发送回调，不再重复注册 `round_phrase` 监听或发送 `request_round_phrases`。
- 将本轮自己已发送改为明确 React state；可见云朵约 5 秒移除后仍保持入口禁用，收到已经过期的自有补发事件时只更新已发送状态、不写入可见事件 map，room 或 round 变化时统一重置。
- 范围审计 `durian-server/src/game/rules.test.ts` 时可识别并尝试撤销上一轮云朵任务为追平既有规则实现而做的断言/类型缩窄；审计过程中该文件内容仍发生变化，最终停止继续编辑以避免覆盖用户并行未提交工作。最终磁盘内容保留了结构化规则断言，服务端全套测试通过。

### Testing

- `cd durian-server && npm test`：最终 59 项测试全部通过，0 失败。
- `cd durian-server && npm run build`：TypeScript 构建通过。
- `cd durian-web && npm run build`：首次在完成编译、类型检查和静态页面生成后，因 `.next/server/pages/_error.js.nft.json` 瞬时缺失失败；单独重跑后完整通过，仍仅有既有 `metadataBase` 非阻断警告。
- 运行时代码范围 `durian-server/src` 与 `durian-web/src` 搜索 `quick_phrase|request_quick_phrase|AutomaticQuickPhraseId|quickPhrasePayload|quickPhraseSent|PhraseBubble|phrase-bubble-|quickPhraseRound|phraseMenuOpen`：均无匹配。
- `durian-web/src` 搜索 `useRoundPhrases(`：仅 Hook 定义和 `page.tsx` 单次调用两处匹配，确认组件不再订阅。
- 仓库根执行 `git diff --check`，并对本轮涉及的未跟踪 Hook/组件文件执行 `git diff --no-index --check /dev/null <file>`：通过；仅有 Git 的 LF 将来可能转为 CRLF 提示，无空白错误。
- 未执行双客户端浏览器目视验收；单次补发请求、两端同位置播放及过期补发不闪现仍需真实双客户端人工确认。

### Notes

- `durian-web/src/app/page.tsx`：新增唯一一次 Hook 调用，并向各座位传递对应事件；只向自己座位传递发送资格与回调。
- `durian-web/src/features/round-phrases/useRoundPhrases.ts`：增加明确的 `hasSentSelf` state 和过期事件前置判断，保留每轮重置与事件去重。
- `durian-web/src/features/round-phrases/RoundPhraseCloud.tsx`：移除 Hook、room、round、phase、playerId 依赖，改为纯 props 展示与交互组件。
- `durian-server/src/game/rules.test.ts`：已做范围审计；由于审计期间文件内容持续变化，为保护并行未提交工作，未强制恢复到 Git 基线，最终保留当前结构化规则断言。
- `progress.md`：仅在末尾追加本条更正、验证、范围审计和未目视说明。
- 回滚方式：仅反向恢复上述三个前端文件中本轮单例 Hook、显式已发送 state 和 props 接线改动，并从 `progress.md` 末尾完整删除本条记录；不要回滚或覆盖 `durian-server/src/game/rules.test.ts` 的当前用户未提交内容，不执行 Git mutation。


## 2026-08-21 - Task: 补正云朵缓存请求的结算阶段时机

### What was done

- 保持页面级唯一 `round_phrase` 监听不变，将 `request_round_phrases` 从监听注册时机拆出，改为仅在当前房间进入 `resolving` 阶段时请求本轮缓存；避免大厅/出牌阶段无效请求，同时确保同一房间从 `playing` 切换到 `resolving` 时能够补取事件。

### Testing

- `cd durian-web && npm run build`：Next.js 生产编译、类型检查、4 个静态页面生成与 build traces 收集通过；仅有既有 `metadataBase` 非阻断警告。
- `durian-web/src` 搜索 `useRoundPhrases(`：仅 Hook 定义与 `page.tsx` 唯一调用两处匹配。
- 运行时代码搜索旧 `quick_phrase` 系列、内联 `PhraseBubble` 与 `.phrase-bubble-*`：无匹配。
- 仓库根执行 `git diff --check`，并对未跟踪 Hook 文件执行 `git diff --no-index --check`：通过；仅有 Git 的 LF/CRLF 提示。
- 未执行双客户端浏览器目视验收；结算切换时的单次缓存请求仍需真实双客户端人工确认。

### Notes

- `durian-web/src/features/round-phrases/useRoundPhrases.ts`：监听生命周期保持按 room/round 单例注册，缓存请求改为按 room/round/phase 在进入 `resolving` 时触发。
- `progress.md`：仅在末尾追加本次时机补正及验证记录。
- 回滚方式：仅恢复 `useRoundPhrases.ts` 本轮拆分缓存请求 effect 的改动，并从 `progress.md` 末尾完整删除本条记录；保留其他未提交工作，不执行 Git mutation。


## 2026-08-21 - Task: 修复小局快捷语候选云朵布局与视觉

### What was done

- 将候选云从入口附近的居中 2x2 网格改为以库存牌为中心的左右双轨布局：左侧两朵向左展开，右侧两朵向右展开，上下错峰，保留牌面中央无遮挡，并在窄屏压缩尺寸与间距。
- 使用内联 SVG 绘制连续 scalloped cloud silhouette，加入白色云体、深蓝漫画描边、偏移蓝紫阴影、侧向尾巴与小泡泡；选择态提供 Q 弹、描边强化，最终发言继续沿用 5 秒生命周期并复用新轮廓。
- 保持 round-phrases 协议、页面接线、发送与同步逻辑不变，样式仍完全封装在 CSS Module。

### Testing

- `cd durian-web && npm run build`：Next.js 生产编译、TypeScript 类型检查、4 个静态页面生成通过；仅有既有 `metadataBase` 非阻断警告。
- 对 `durian-web/src/features/round-phrases/RoundPhraseCloud.tsx` 与 `RoundPhraseCloud.module.css` 执行定向 `git diff --check`：通过。
- 未实际执行浏览器目视验收；不同桌边缘座位、移动端 table-stage 溢出与最终云朵观感仍需真实浏览器牌局确认。

### Notes

- `durian-web/src/features/round-phrases/RoundPhraseCloud.tsx`：新增可复用内联 SVG 云朵轮廓组件，候选按左右 rail 分配并保留交互。
- `durian-web/src/features/round-phrases/RoundPhraseCloud.module.css`：重写选择器定位、云体描边/阴影、尾巴、悬浮动画、窄屏与 reduced-motion 样式。
- `progress.md`：追加本轮施工、验证、未目视说明与回滚点。
- 回滚方式：仅恢复上述两个 round-phrases 文件并删除本条 `progress.md` 记录；保留其他未提交改动，不执行 Git mutation。

## 2026-08-21 - Task: 重生成并发布紫罗单颗水晶葡萄金属签结算特效

### What was done

- 按指定 Gemini 原生图像参数尝试生成最多三次候选；前两次均真实返回 `HTTP 401 Invalid token`，因此未继续调用，也未用 Pillow 冒充生成。保留既有 `grape-skewer-single-v2.png` 作为未覆盖的高分辨率定稿源。
- 对 `single-v2` 仅做透明背景保留、紧凑安全裁切和居中缩放，发布为 256x256 RGBA 正式图，并生成仅审核用的 56x42 RGBA 透明预览。
- 同步资源清单与生成流程，将视觉约束改为单颗水晶葡萄金属签并明确禁止多颗串珠。

### Testing

- Pillow 规格检查通过：高分辨率源 `1024x1024 RGBA`，alpha bbox `(29,260)-(998,824)`；正式图 `256x256 RGBA`，alpha bbox `(11,58)-(245,196)`，透明像素 `46421/65536`；审核预览 `56x42 RGBA`，alpha bbox `(0,7)-(55,33)`，透明像素 `1624/2352`。
- `ReadMediaFile` 逐次目视审核：当前工具会话未提供该接口；已逐次尝试读取高分辨率源、正式图和 56x42 预览，但工具明确拒绝图像读取，故无法完成用户要求的视觉确认，不能将视觉项宣称为已验证。
- `cd durian-web && npm run build`：通过；Next.js 编译、类型检查、4 个静态页面生成和 build traces 均通过，仅有既有 `metadataBase` 非阻断警告。
- 针对本任务修改/新增文件执行 `git diff --check` 或未跟踪文件的 `git diff --no-index --check`：通过；仅有 Git 的 LF/CRLF 提示，无空白错误。

### Notes

- `assets/source/game-ui/grape-skewer-single-v2.png`：保留并作为最终高分辨率源，未覆盖旧源候选。
- `durian-web/public/assets/effect-grape-skewer.png`：更新为 256x256 RGBA 正式图。
- `assets/review/grape-skewer-single-v2-56x42.png`：新增仅验证用透明预览。
- `docs/asset-inventory.md`：同步源版本、正式规格和单颗葡萄签视觉约束。
- `docs/asset-generation-workflow.md`：将“葡萄串签”改为“单颗水晶葡萄金属签”，明确禁止多颗串珠。
- `progress.md`：仅在末尾追加本轮记录。
- 回滚方式：删除本轮新增审核预览，恢复正式图到任务开始前版本 `durian-web/public/assets/effect-grape-skewer.png`；保留 `single-v2` 源和既有未提交内容，不执行 `git reset`、`git clean` 或其他 Git mutation。

## 2026-08-21 - Task: 将对手牌位发言云改为向下弹出

### What was done

- 为最终发言云增加独立的向上/向下弹出方向；自己底部牌位继续向上弹出，桌面顶部的对手牌位改为从库存牌下方弹出，避免云朵被 table-stage 顶部裁切而误以为未同步。
- 向下弹出的云朵使用朝上的泡泡尾巴指回库存牌，并保持原有 5.2 秒软弹、悬浮和淡出生命周期；独立 `round_phrase` 同步协议未修改。

### Testing

- `durian-web` 执行 `npm run build`：Next.js 生产编译、TypeScript 类型检查和 4 个静态页面生成通过；仅有既有 `metadataBase` 非阻断警告。
- 未实际执行双客户端浏览器目视验收；需在真实牌局确认对手云朵位于库存牌下方且双方均可见。

### Notes

- `durian-web/src/features/round-phrases/RoundPhraseCloud.tsx`：增加 `spokenDirection` 属性和上下尾巴方向。
- `durian-web/src/features/round-phrases/RoundPhraseCloud.module.css`：增加向下弹出定位、动画和上指泡泡尾巴。
- `durian-web/src/app/page.tsx`：对手牌位显式传入向下弹出，自己牌位保留默认向上。
- `progress.md`：追加本轮修复、验证和回滚记录。
- 回滚方式：恢复上述三个前端文件到本轮前版本，并从 `progress.md` 末尾删除本条记录；不执行 Git mutation。

## 2026-08-21 - Task: 修正库存水果在上下半区的垂直居中

### What was done

- 将水果牌每个上下半区的水果标签改为绝对填满对应半区，再由半区统一居中，避免单颗水果或不同尺寸水果因内容自身高度差而偏离上下正中线。
- 保留封箱玻璃罩、搬运标记、换位标记及订单牌现有布局和动画，不改游戏数据。

### Testing

- `durian-web` 执行 `npm run build`：Next.js 生产编译、TypeScript 类型检查和 4 个静态页面生成通过；仅有既有 `metadataBase` 非阻断警告。
- 对 `durian-web/src/app/globals.css` 执行 `git diff --check`：通过，仅有 Git 的 LF/CRLF 提示。
- 未进行浏览器目视验收；需在真实牌局确认四种水果和单颗/多颗组合的视觉中心。

### Notes

- `durian-web/src/app/globals.css`：为 `.fruit-card-half` 增加定位上下文，并让直属 `.fruit-label` 填满半区后居中。
- `progress.md`：追加本轮布局修正、验证与回滚记录。
- 回滚方式：恢复上述 CSS 规则到本轮前版本，并从 `progress.md` 末尾删除本条记录；不执行 Git mutation。

## 2026-08-21 - Task: 修复重复牌堆并提升可点击层级

### What was done

- 删除页面中重复渲染的第二个 `DrawPile`，桌面现在只保留一个牌堆。
- 将保留牌堆的层级从 `z-index: 10` 提升到 `20`，高于订单区及旋转后的猩猩附属牌，确保牌堆视觉在顶层且点击区域不被遮挡。

### Testing

- `durian-web` 执行 `npm run build`：Next.js 生产编译、TypeScript 类型检查和 4 个静态页面生成通过；仅有既有 `metadataBase` 非阻断警告。
- 搜索 `page.tsx` 确认仅剩一个 `<DrawPile>`。
- 对本轮代码执行 `git diff --check`：通过，仅有 Git 的 LF/CRLF 提示。

### Notes

- `durian-web/src/app/page.tsx`：删除重复牌堆实例。
- `durian-web/src/app/globals.css`：将牌堆交互层提升至 `z-index: 20`，同步更新层级注释。
- `progress.md`：追加本轮修复、验证与回滚记录。
- 回滚方式：恢复上述页面和 CSS 到本轮前版本，并从 `progress.md` 末尾删除本条记录；不执行 Git mutation。

## 2026-08-21 - Task: 增加 Token 与上下文节省施工规范

### What was done

- 将 Token 节省、上下文管理、子代理使用、并行调查、文件读取、验证频率和阶段交接要求写入仓库根 `AGENTS.md`，作为所有后续模型/代理进入仓库后的必经规范。
- 明确简单任务不得启动子代理或 AgentSwarm；大型任务默认限制为一个探索代理或一个实现代理，禁止无必要的代理递归派生。
- 明确先稳定服务端规则和测试，再实现前端与视觉，避免需求变更造成整批返工；同时要求按需读取文件、排除依赖与构建目录，并使用 `/usage` 和官方控制台查看用量。

### Testing

- 本轮为仓库规范文档改动，未涉及代码、依赖或运行时行为；按范围未执行构建和测试。
- 已重新读取 `AGENTS.md` 与 `progress.md` 目标段落，确认新增规范位于工具协作规则和图像生成规则之间，且本记录追加在日志末尾。

### Notes

- `AGENTS.md`：新增 `8.1 Token 与上下文节省`，规定最小有效路径、代理数量、上下文压缩、按需读取和验证策略。
- `progress.md`：追加本轮规范变更记录。
- 回滚方式：删除 `AGENTS.md` 中新增的 `8.1 Token 与上下文节省` 整节，并从 `progress.md` 末尾删除本条记录；不执行 Git mutation。

## 2026-08-21 - Task: 修正 Gemini 独立生图 API 配置并应用单颗葡萄签

### What was done

- 将生图脚本的 Gemini 配置与聊天模型配置彻底分离：OpenAI 兼容请求使用 `OPENAI_API_KEY`/`OPENAI_BASE_URL`，Gemini 原生生图使用 `GEMINI_API_KEY`/`GEMINI_BASE_URL`。
- 修正带 `/v1` 的 Gemini 代理 Base URL 拼接逻辑，避免错误生成 `/v1/v1beta`；实际调用 `gemini-3-pro-image-preview` 成功。
- 以 `assets/source/fruits/grape-v1.png` 作为葡萄外观参考生成 Gemini 候选：保持游戏内紫葡萄形象，单颗葡萄由精致金色金属签穿过；清理模型棋盘背景后导出并应用正式结算素材。

### Testing

- Gemini 原生生图调用：成功，模型为 `gemini-3-pro-image-preview`，代理 Base URL 配置为 `https://apinebula.ai/v1`，脚本实际请求 `https://apinebula.ai/v1beta/models/gemini-3-pro-image-preview:generateContent`。
- 目视检查高分辨率源和 `56x42` UI 预览：单颗葡萄、精致签子可辨认，无多颗葡萄；透明背景清理后无棋盘格残留。
- Pillow 规格检查：源文件 `1024x1024 RGBA`，正式文件 `256x256 RGBA`，预览 `56x42 RGBA`；alpha bbox 分别为 `(29,153)-(995,871)`、`(6,38)-(250,219)`、`(0,4)-(56,38)`。
- `durian-web` 执行 `npm run build`：生产编译、TypeScript 类型检查和静态页面生成通过；仅有既有 `metadataBase` 非阻断警告。
- 修改文件 `git diff --check`：通过；无空白错误，仅有 LF/CRLF 提示。

### Notes

- `tools/generate-assets.mjs`：增加 Gemini 独立密钥/地址配置并规范化带 `/v1` 的 Base URL。
- `AGENTS.md`：同步双 API 配置规范，禁止混用聊天和生图凭据。
- `docs/asset-generation-workflow.md`：记录 Gemini 独立配置和代理路径规则。
- `docs/asset-inventory.md`：登记 Gemini v8 单颗葡萄签源文件、正式资源和游戏葡萄参考源。
- `assets/source/game-ui/grape-skewer-single-gemini-v8.png`：Gemini 原始候选；`assets/source/game-ui/grape-skewer-single-gemini-v8-final.png` 为清理透明背景后的源成品。
- `durian-web/public/assets/effect-grape-skewer.png`：替换为正式 256x256 RGBA 资源。
- `assets/review/grape-skewer-single-gemini-v8-56x42.png`：新增实际 UI 尺寸审核预览。
- `progress.md`：追加本轮生图、应用与验证记录。
- 回滚方式：恢复 `durian-web/public/assets/effect-grape-skewer.png` 到本轮前资源，删除本轮 v8 源文件和审核预览，并反向恢复 `tools/generate-assets.mjs`、`AGENTS.md`、`docs/asset-generation-workflow.md`、`docs/asset-inventory.md` 的本轮改动；不执行 Git mutation。

## 2026-08-21 - Task: 修正封箱经理并列最低库存保护

### What was done

- 保持封箱经理按初始库存判断最低水果，并明确沿用 `FRUITS` 固定顺序处理并列最低值，使草莓与葡萄同为最低库存时保护草莓。
- 增加该并列场景的服务端回归测试，确认草莓订单超出库存时因受保护而不触发爆单。

### Testing

- `durian-server/npm test`：60 项测试全部通过。

### Notes

- `durian-server/src/game/rules.ts`：明确封箱经理并列最低时保留固定顺序靠前的水果。
- `durian-server/src/game/rules.test.ts`：新增草莓与葡萄并列最低时保护草莓的测试。
- `progress.md`：追加本轮修复记录。
- 回滚方式：恢复上述两个源码文件到本轮修改前版本，并删除本条日志；不执行 Git mutation。

## 2026-08-21 - Task: 修复水果图标动画后的居中布局

### What was done

- 将水果点位从 `display: contents` 改为固定尺寸的布局盒，保证旋转、封箱和库存搬运动画期间图标仍以半张牌中心为基准。
- 为三个水果图标增加固定的两行网格，为单个和两个水果保留稳定的水平居中布局。

### Testing

- `durian-web/npm run build`：生产编译、TypeScript 类型检查和静态页面生成通过；仅有既有 `metadataBase` 非阻断警告。

### Notes

- `durian-web/src/app/globals.css`：修复 `.fruit-pip`、`.fruit-pips` 和三水果网格的定位规则。
- `progress.md`：追加本轮前端布局修复记录。
- 回滚方式：恢复 `durian-web/src/app/globals.css` 到本轮修改前版本，并删除本条日志；不执行 Git mutation。


## 2026-08-21 - Task: 调整他人视角的发话云朵位置

### What was done

- 将结算阶段看其他玩家时的发话云朵从库存卡上方移到库存卡下方，避免遮挡卡面。
- 为移动端设置更紧凑的下移距离，保持小屏布局可见。

### Testing

- `durian-web/npm run build`：生产编译、TypeScript 类型检查和静态页面生成通过；仅有既有 `metadataBase` 非阻断警告。
- `git diff --check`：通过；仅有 Git 的 LF/CRLF 提示。

### Notes

- `durian-web/src/features/round-phrases/RoundPhraseCloud.module.css`：调整 `.spokenDown` 及移动端定位。
- `progress.md`：追加本轮修改记录。
- 回滚方式：恢复 `RoundPhraseCloud.module.css` 中本轮前的 `.spokenDown` 定位值，并删除本条日志；不执行 Git mutation。


## 2026-08-21 - Task: 删除重复牌堆特效并提升牌堆层级

### What was done

- 移除新的 3D `TableScene` 牌堆渲染，保留原有可点击牌堆，避免桌面同时出现两个牌堆特效。
- 将保留牌堆的层级提升到 `z-index: 999`，确保不会被旋转猩猩牌覆盖。

### Testing

- `durian-web/npm run build`：生产编译、TypeScript 类型检查和静态页面生成通过；仅有既有 `metadataBase` 非阻断警告。
- `git diff --check`：通过；仅有 Git 的 LF/CRLF 提示。
- 搜索 `page.tsx` 确认只保留一个 `<DrawPile>`，且已移除 `TableScene` 渲染。

### Notes

- `durian-web/src/app/page.tsx`：移除 `TableScene` 动态导入及渲染。
- `durian-web/src/app/globals.css`：将桌面牌堆层级提升到 `999`，同步更新层级说明。
- `progress.md`：追加本轮修改记录。
- 回滚方式：恢复 `page.tsx` 的 `TableScene` 导入/渲染和 `globals.css` 的牌堆层级，并删除本条日志；不执行 Git mutation。


## 2026-08-21 - Task: 恢复牌堆贴边呼吸高光

### What was done

- 参考原 3D 牌堆的可抽取呼吸效果，为保留牌堆的每张牌边增加贴边高光脉冲。
- 仅在轮到当前玩家可以抽牌时显示，并保留抽牌动画和减少动画偏好支持。

### Testing

- `durian-web/npm run build`：生产编译、TypeScript 类型检查和静态页面生成通过；仅有既有 `metadataBase` 非阻断警告。
- `git diff --check`：通过；仅有 Git 的 LF/CRLF 提示。

### Notes

- `durian-web/src/app/globals.css`：新增牌堆卡片边缘呼吸高光及错峰动画。
- `progress.md`：追加本轮修改记录。
- 回滚方式：删除 `.draw-pile.can-draw` 高光规则和 `draw-pile-edge-glow` 动画，并删除本条日志；不执行 Git mutation。


## 2026-08-21 - Task: 制作四款发话图标方案

### What was done

- 将原本粗糙的 Unicode 云朵替换为四款可直接对比的内联 SVG 图标。
- 四款方向分别为：轻雅火花、微笑调侃、省略号吐槽、俏皮眨眼；每款保留相同的发话交互。
- 在图标右下角标注 1–4，便于用户反馈选择。

### Testing

- `durian-web/npm run build`：生产编译、TypeScript 类型检查和静态页面生成通过；仅有既有 `metadataBase` 非阻断警告。
- `git diff --check`：通过；仅有 Git 的 LF/CRLF 提示。

### Notes

- `durian-web/src/features/round-phrases/RoundPhraseCloud.tsx`：新增四款 `EntryIcon` SVG，并渲染并列方案。
- `durian-web/src/features/round-phrases/RoundPhraseCloud.module.css`：新增方案排列、配色和图标样式。
- `progress.md`：追加本轮图标方案记录。
- 回滚方式：恢复上述 TSX/CSS 到本轮前的单云朵入口实现，并删除本条日志；不执行 Git mutation。


## 2026-08-21 - Task: 根据本轮胜负显示开心或伤心图标

### What was done

- 收敛发话入口为开心和伤心两款图标，移除其余两款临时方案。
- 结算时根据 `penalizedPlayerId` 自动判断：赢家显示开心图标，输家显示伤心图标。
- 保留原有发话菜单和发送流程不变。

### Testing

- `durian-web/npm run build`：生产编译、TypeScript 类型检查和静态页面生成通过；仅有既有 `metadataBase` 非阻断警告。
- `git diff --check`：通过；仅有 Git 的 LF/CRLF 提示。

### Notes

- `durian-web/src/features/round-phrases/RoundPhraseCloud.tsx`：增加 `roundOutcome`，仅保留开心/伤心入口并自动选图标。
- `durian-web/src/features/round-phrases/RoundPhraseCloud.module.css`：更新赢家与输家配色，删除临时编号样式。
- `durian-web/src/app/page.tsx`：将结算输赢状态传入每位玩家的发话组件。
- `progress.md`：追加本轮胜负图标记录。
- 回滚方式：恢复上述 TSX/CSS/page.tsx 到本轮前四方案实现，并删除本条日志；不执行 Git mutation。

## 2026-08-21 - Task: 切换默认图片生成模型为 Gemini

### What was done

- 将生图默认模型切换为 `gemini-3-pro-image-preview`，并允许显式选择 `gemini-3.1-flash-image`。
- 固定使用 Gemini 原生 `/v1beta/models/<model>:generateContent` 端点；当 Base URL 末尾带 `/v1` 时自动去除，避免 `/v1/v1beta` 冲突。
- 明确 API 密钥仅从 `GEMINI_API_KEY` 环境变量读取，不写入仓库文档、源码或命令示例。

### Testing

- `node --check tools/generate-assets.mjs`：通过。
- `git diff --check`：通过；仅有 Git 的 LF/CRLF 提示。
- 本轮图片请求此前返回 HTTP 401 `Invalid token`，未生成候选图；已报告为凭据/接口侧问题，未用其他模型掩盖。

### Notes

- `AGENTS.md`：更新 Gemini 模型、端点归一化和密钥保护规范。
- `tools/generate-assets.mjs`：限制可用 Gemini 模型并将默认模型改为 `gemini-3-pro-image-preview`。
- `docs/asset-generation-workflow.md`：更新模型、端点和命令示例。
- `docs/new-gorilla-generation-prompts.md`：更新角色生图模型与命令示例。
- `progress.md`：追加本轮配置切换记录。
- 回滚方式：恢复上述三个源码/文档文件到本轮修改前版本，并删除本条日志；不执行 Git mutation。


## 2026-08-21 - Task: 按胜负与猩猩身份更新小局发话短句

### What was done

- 将小局发话短句拆分为赢家普通、赢家猩猩、输家普通、输家猩猩四组。
- 前端菜单按结算输赢和当前库存牌类型自动展示对应四条短句。
- 服务端同步四组权威文案，并拒绝不符合当前身份的短句请求。
- 将短句目录和后续同步维护要求记录到协议文档。

### Testing

- `durian-server/npm test`：61 项测试全部通过。
- `durian-server/npm run build`：TypeScript 编译通过。
- `durian-web/npm run build`：生产编译、TypeScript 类型检查和静态页面生成通过；仅有既有 `metadataBase` 非阻断警告。
- `git diff --check`：通过；仅有 Git 的 LF/CRLF 提示。

### Notes

- `durian-web/src/features/round-phrases/roundPhraseTypes.ts`：新增四组客户端短句目录。
- `durian-web/src/features/round-phrases/RoundPhraseCloud.tsx`：按胜负和猩猩库存筛选菜单，移除旧分页。
- `durian-web/src/features/round-phrases/RoundPhraseCloud.module.css`：移除旧分页相关样式。
- `durian-server/src/rooms/domain/roundPhrasePolicy.ts`：同步服务端文案并增加身份目录校验。
- `durian-server/src/rooms/DurianRoom.ts`：将结算输家身份传入短句校验。
- `durian-server/src/rooms/DurianRoom.test.ts`：更新旧短句测试并覆盖四种身份目录。
- `docs/round-phrase-protocol.md`：记录四组短句和维护规则。
- `progress.md`：追加本轮短句规则记录。
- 回滚方式：恢复上述源码、测试和协议文档到本轮修改前版本，并删除本条日志；不执行 Git mutation。

## 2026-08-21 - Task: 接入服务端机器人席位与公开信息策略

### What was done

- 增加仅房主可操作的单一内部机器人席位，机器人不伪造 Colyseus Client，但计入开局人数、起始玩家和轮转，并保留服务端库存用于结算。
- 实现仅使用其他玩家及公共库存公开信息的水果选边、猩猩风险翻转和摇铃条件；动作由现有 clock 调度并随房间清理。
- 页面补充机器人席位标识、加入/移除控制，并保留既有房主解散 `end_game`/`room_closed` 闭环。

### Testing

- `durian-server/npm test`：当前 61 项既有测试通过；本轮新增测试尚未在本记录写入前完成最终重跑。
- `durian-web/npm run build` 与仓库根 `git diff --check`：待本轮最终验证。

### Notes

- `durian-server/src/rooms/DurianRoom.ts`：内部机器人席位、公开信息策略、clock 调度和房主 add/remove 协议。
- `durian-server/src/rooms/DurianRoom.test.ts`：机器人席位权限/唯一性、公开库存选边和无收益猩猩测试。
- `durian-web/src/app/page.tsx`：机器人状态字段、大厅控制和席位标签。
- `Durian/docs/bot-room-protocol.md`：记录机器人规则与协议边界。
- `progress.md`：追加本轮施工记录。
- 回滚方式：恢复上述代码与文档文件到本轮修改前版本，并删除本条日志；不执行 Git mutation。

## 2026-08-21 - Task: 接入临时主管毛笔大叉特效

### What was done

- 采用审核通过的 `supervisor-x-brush-v1.png`，清理生成图中的棋盘格并导出为正式 `effect-supervisor-x.png`。
- 移除原先柔软的 SVG 线条、钢笔图形和旋转浮现动画，改为同一毛笔素材的两层独立图像。
- 第一笔先从左向右裁切显现，第二笔延迟后再显现，保持逐笔绘制过程；结算完成后保留完整大叉。

### Testing

- `durian-web/npm run build`：通过；仅有既有 `metadataBase` 非阻断警告。
- 正式特效资源检查：`1024x1024 RGBA PNG`，已清除棋盘背景，透明边界框为 `(125,112)-(945,916)`。

### Notes

- `durian-web/public/assets/effect-supervisor-x.png`：新增正式毛笔大叉资源。
- `durian-web/src/app/page.tsx`：改用两层毛笔素材渲染临时主管特效。
- `durian-web/src/app/globals.css`：改为两笔依次裁切显现动画。
- `progress.md`：追加本轮特效接入记录。
- 回滚方式：删除正式大叉资源，并恢复 page.tsx/globals.css 中原临时主管 SVG 特效实现；不执行 Git mutation。

## 2026-08-21 - Task: 完成机器人席位闭环验证

### What was done

- 完成服务端内部机器人、公开库存决策、房主大厅控制与页面机器人标识的最小闭环；既有房主解散页面与 `room_closed` 返回首页流程保持有效。
- 修复机器人结算阶段未自动准备的问题：机器人现在会自动加入 `readyPlayerIds`，不会再阻塞下一轮或总结算。

### Testing

- `durian-server/npm test`：65 项测试全部通过，包含机器人权限、唯一席位、公开库存选边、猩猩无收益不翻和自动准备测试。
- `durian-web/npm run build`：生产编译、类型检查和静态页面生成通过；仅有既有 `metadataBase` 非阻断警告。
- `git diff --check`：通过；仅有 Windows 工作区 LF/CRLF 提示，无空白错误。

### Notes

- `durian-server/src/rooms/DurianRoom.ts`、`durian-server/src/rooms/DurianRoom.test.ts`：机器人席位、策略、调度和测试。
- `durian-web/src/app/page.tsx`：机器人状态与大厅 add/remove 控制。
- `docs/bot-room-protocol.md`：机器人规则和协议说明。
- `progress.md`：追加最终验证记录。

## 2026-08-21 - Task: 修正临时主管两笔毛笔叉绘制

### What was done

- 重新生成两条独立斜线素材，避免从完整 X 裁剪时把另一条斜线带入单笔。
- 第一笔置于第二笔上层，确保交叉处第一笔的暖白笔芯不会被第二笔酒红边缘覆盖。
- 完成状态强制显示两条完整斜线，避免动画结束后特效消失。

### Testing

- 已检查两条素材均为 `1024x1024 RGBA PNG`，并确认页面改用独立笔画资源。
- 前端构建待本轮最终执行。

### Notes

- `durian-web/public/assets/effect-supervisor-stroke-first.png`：第一笔独立毛笔斜线。
- `durian-web/public/assets/effect-supervisor-stroke-second.png`：第二笔独立毛笔斜线。
- `durian-web/src/app/page.tsx`：引用两条独立素材。
- `durian-web/src/app/globals.css`：设置第一笔上层及完成态永久显示。
- `progress.md`：追加本轮修正记录。
- 回滚方式：恢复 page.tsx/globals.css 到本轮修改前版本，并删除两条正式笔画资源及本条日志；不执行 Git mutation。
- 回滚方式：恢复上述代码和协议文档到本轮修改前版本，并删除本条日志；不执行 Git mutation。


## 2026-08-21 - Task: 增加猩风作浪猩猩阵容选择与牌组上限

### What was done

- 服务端同步猩风作浪阵容与猩猩牌数上限，新增仅房主大厅可用的严格 `set_gorilla_selection` 协议；非法配置统一返回 `action_error`。
- 猩风作浪开始回合前按选中阵容过滤并限制猩猩牌，保留玩家猩猩权重抽取；经典模式行为不变。
- 大厅新增房主专属 Portal 猩猩档案选择器，支持剪影勾选、最大牌数、保存和取消，并同步房间状态。
- 补充阵容协议文档和服务端回归测试。

### Testing

- `cd durian-server && npm test`：69 项测试通过，0 失败。
- `cd durian-web && npm run build`：Next.js 生产构建、TypeScript 检查和静态页面生成通过；仅有既有 `metadataBase` 非阻断警告。
- 仓库根目录执行 `git diff --check`：通过；仅有 Git 的 LF/CRLF 提示，无空白错误。

### Notes

- `durian-server/src/rooms/DurianRoom.ts`：同步阵容状态、协议校验和猩风作浪牌组过滤。
- `durian-server/src/rooms/DurianRoom.test.ts`：覆盖默认阵容、权限、非法配置、过滤和牌数上限。
- `durian-web/src/app/page.tsx`：扩展房间快照与发送协议，接入房主大厅入口和保存流程。
- `durian-web/src/components/GorillaRosterSelector.tsx`：新增 data-driven Portal 档案选择弹窗。
- `durian-web/src/app/globals.css`：新增弹窗、档案卡片和移动端响应式样式。
- `docs/gorilla-selection-protocol.md`：记录状态字段、入站校验和牌组语义。
- `progress.md`：追加本轮施工记录。
- 回滚方式：仅反向恢复上述服务端、前端和文档文件中的本轮改动，并删除本条 `progress.md` 记录；保留任务开始前已有的所有用户未提交改动，不执行 `git reset`、`git clean` 或其他 Git mutation。

## 2026-08-21 - Task: 修正猩猩名册独立选择与牌数上限

### What was done

- 修正名册弹窗，使猩猩勾选数量与最多猩猩牌数独立；可选择全量猩猩并设置较低牌数上限，取消仍不发送协议。

### Testing

- `cd durian-server && npm test`：69 项测试通过，0 失败。
- `cd durian-web && npm run build`：构建、类型检查和静态页面生成通过；仅有既有 `metadataBase` 非阻断警告。
- 仓库根目录执行 `git diff --check`：通过；仅有 Git 的 LF/CRLF 提示，无空白错误。

### Notes

- `durian-web/src/components/GorillaRosterSelector.tsx`：分离勾选阵容与猩猩牌数上限逻辑。
- `progress.md`：追加本轮修正记录。
- 回滚方式：恢复上述组件改动并删除本条日志；保留其他用户未提交改动，不执行任何 Git mutation。

## 2026-08-21 - Task: 修正猩猩初始库存上限语义

### What was done

- 猩风作浪牌组保留全部选中猩猩角色；`maxGorillas` 仅限制一小局开始时所有玩家初始库存中的猩猩库存卡数量。
- 玩家达到初始上限后改为只抽水果牌，双人局公共 dummy inventory 与后续牌堆抽牌不计入该上限；经典模式保持不变。
- 更新猩猩名册与大厅入口文案，明确角色选择和玩家初始猩猩上限的区别，并同步协议说明。

### Testing

- `cd durian-server && npm test`：70 项测试全部通过，0 失败。
- `cd durian-web && npm run build`：Next.js 生产构建、类型检查和静态页面生成通过；仅有既有 `metadataBase` 非阻断警告。
- 仓库根目录执行 `git diff --check`：通过；仅有 Git 的 LF/CRLF 提示，无空白错误。

### Notes

- `durian-server/src/rooms/DurianRoom.ts`：保留选中猩猩并限制玩家初始库存发牌。
- `durian-server/src/game/modes.ts`：新增仅抽水果的库存发牌 helper。
- `durian-server/src/rooms/DurianRoom.test.ts`：更新牌组、初始库存和后续抽牌回归测试。
- `durian-web/src/components/GorillaRosterSelector.tsx`：更新上限文案。
- `durian-web/src/app/page.tsx`：更新大厅入口摘要。
- `docs/gorilla-selection-protocol.md`：更新 `maxGorillas` 语义。
- `progress.md`：追加本轮修正记录。
- 回滚方式：恢复上述代码、前端和文档改动并删除本条日志；保留其他用户未提交改动，不执行任何 Git mutation。
