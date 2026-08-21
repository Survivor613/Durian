"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { gorillasByMode, socialGorillas } from "../data/gorillas";

type EmployeeHandbookProps = { open: boolean; onOpen: () => void; onClose: () => void };
type BookPage = { label: string; content: React.ReactNode };

const modeLabel = (modes: readonly string[]) => modes.includes("classic") ? "经典模式 · 猩风作浪" : "猩风作浪";

export function EmployeeHandbook({ open, onOpen, onClose }: EmployeeHandbookProps) {
  const [spread, setSpread] = useState(0);
  const [direction, setDirection] = useState<"next" | "previous">("next");
  const pages = useMemo<BookPage[]>(() => [
    {
      label: "开店守则",
      content: <div className="book-cover-page"><span>Durian Fruit Shop</span><h2>夜班员工手册</h2><p>游戏规则 · 员工档案 · 卡池记录</p><i>内部资料 · 值班前请阅读</i></div>,
    },
    {
      label: "目录",
      content: <><div className="book-kicker">Contents</div><h2>今晚工作安排</h2><ol className="book-contents"><li><b>01</b><span>基本规则<small>观察库存、抽牌与下单</small></span></li><li><b>02</b><span>敲铃结算<small>判断爆单、处罚与特殊效果</small></span></li><li><b>03</b><span>员工档案<small>八位在职大猩猩</small></span></li><li><b>04</b><span>本期卡池<small>经典模式与猩风作浪</small></span></li></ol></>,
    },
    {
      label: "基本规则",
      content: <><div className="book-kicker">01 · Rules</div><h2>看得见别人，看不见自己</h2><div className="book-rule-list"><article><b>1</b><div><h3>观察库存</h3><p>每位玩家都看得见其他人的库存牌，唯独看不见自己的牌。</p></div></article><article><b>2</b><div><h3>抽牌下单</h3><p>轮到你时抽一张牌；水果牌选择一侧加入订单，必须让同类水果订单不低于桌面已有数量。</p></div></article><article><b>3</b><div><h3>放置大猩猩</h3><p>抽到大猩猩时，将它附到一张还没有大猩猩的订单上；结算时能力才会生效。</p></div></article></div></>,
    },
    {
      label: "敲铃结算",
      content: <><div className="book-kicker">02 · Settlement</div><h2>觉得爆单，就敲铃</h2><div className="book-rule-list compact"><article><b>!</b><div><h3>判断超额</h3><p>任意水果订单总数严格大于全部库存时即为爆单；相等仍然安全。</p></div></article><article><b>✓</b><div><h3>判断正确</h3><p>导致订单爆掉的玩家受到处罚；判断错误则由敲铃者承担处罚。</p></div></article><article><b>7</b><div><h3>结束条件</h3><p>玩家怒气达到 7 时本局结束。</p></div></article></div><div className="book-note"><strong>猩风作浪结算顺序</strong><p>菲恩锁定每种水果首单 → 米奇、汉娜使未锁订单无效 → 紫罗修改未锁葡萄订单 → 莫比交换有效库存归属 → 克莱德按初始库存保护最低项 → 巴鲁避开保护项按实例搬运。</p></div></>,
    },
    ...socialGorillas.map((gorilla, index): BookPage => ({
      label: `员工 ${index + 1}`,
      content: <div className="employee-profile"><div className={`employee-photo employee-photo-${gorilla.id}`}><img src={gorilla.lobbyImage} alt={`${gorilla.title}·${gorilla.name}`} draggable={false} /><span>NO. {String(index + 1).padStart(2, "0")}</span></div><div className="book-kicker">Employee file</div><h2>{gorilla.title}<em>·</em>{gorilla.name}</h2><p className="employee-story">{gorilla.story}</p><dl><div><dt>能力</dt><dd>{gorilla.ability}</dd></div><div><dt>值班模式</dt><dd>{modeLabel(gorilla.modes)}</dd></div><div><dt>加入批次</dt><dd>{gorilla.introducedAt}</dd></div><div><dt>状态</dt><dd>在职 · 已发布</dd></div></dl></div>,
    })),
    {
      label: "卡池记录",
      content: <><div className="book-kicker">04 · Card pool</div><h2>2026-08 首期记录</h2><div className="pool-ledger"><article><span>经典模式</span><strong>31 张</strong><p>28 张水果牌 + {gorillasByMode("classic").map((gorilla) => gorilla.name).join("、")}</p></article><article><span>猩风作浪</span><strong>36 张</strong><p>28 张水果牌 + {gorillasByMode("curious-market").map((gorilla) => gorilla.name).join("、")}</p></article></div><div className="book-stamp">本期加入<br /><strong>紫罗 · 莫比 · 克莱德 · 巴鲁 · 菲恩</strong></div><p className="book-footnote">2026-08 为建立维护记录时的基线，不代表角色真实上线日期。</p></>,
    },
    {
      label: "封底",
      content: <div className="book-back-page"><span>End of handbook</span><h2>今晚别让<br />订单爆掉。</h2><p>有新员工入职时，记得同步资料源、规则测试与卡池记录。</p></div>,
    },
  ], []);
  const maxSpread = Math.ceil(pages.length / 2) - 1;
  const pageIndex = spread * 2;

  function turn(next: boolean) {
    setDirection(next ? "next" : "previous");
    setSpread((value) => Math.max(0, Math.min(maxSpread, value + (next ? 1 : -1))));
  }

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") turn(false);
      if (event.key === "ArrowRight") turn(true);
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, maxSpread, onClose]);

  if (!open) return <button type="button" className="handbook-reopen" onClick={onOpen}><span aria-hidden="true">▤</span><b>打开员工手册</b><small>规则 · 员工 · 卡池</small></button>;
  if (typeof document === "undefined") return null;

  return createPortal(<div className="book-overlay" role="dialog" aria-modal="true" aria-label="夜班员工手册">
    <button type="button" className="book-close" onClick={onClose} aria-label="关闭员工手册">×</button>
    <div className="book-shell">
      <div className={`open-book turn-${direction}`} key={spread} aria-live="polite">
        {[pages[pageIndex], pages[pageIndex + 1]].map((page, side) => {
          const canTurn = side === 0 ? spread > 0 : spread < maxSpread;
          const label = side === 0 ? "点击左页查看上一页" : "点击右页查看下一页";
          return <section className={`book-page book-page-${side ? "right" : "left"} ${canTurn ? "is-turnable" : ""}`} key={page?.label ?? "blank"} aria-label={`${page?.label ?? "空白页"}，${canTurn ? label : "已到尽头"}`} onClick={() => canTurn && turn(side === 1)}>
            <div className="book-page-inner">{page?.content}</div><span className="book-page-number">{page ? pageIndex + side + 1 : ""}</span>
            {canTurn && <span className="book-page-cue" aria-hidden="true">{side === 0 ? "‹" : "›"}</span>}
          </section>;
        })}
        <i className="book-spine" aria-hidden="true" />
      </div>
    </div>
  </div>, document.body);
}
