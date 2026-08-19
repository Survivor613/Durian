"use client";

import { useEffect, useMemo, useState } from "react";

export type SettlementExplanation =
  | { effect: "mitsuhiko" | "nana"; summary: string; affectedOrderCardIds: string[] }
  | { effect: "grape-beadsmith"; summary: string; orderChanges: Array<{ cardId: string; from: 2 | 3; to: 1 }> }
  | { effect: "order-swap-magician"; summary: string; inventoryChanges: { strawberry: { from: number; to: number }; grape: { from: number; to: number } } };

const images: Record<SettlementExplanation["effect"], string> = {
  mitsuhiko: "/assets/gorilla-mitsuhiko.png",
  nana: "/assets/gorilla-nana.png",
  "grape-beadsmith": "/assets/gorilla-grape-beadsmith.png",
  "order-swap-magician": "/assets/gorilla-order-swap-magician.png",
};

function stepDuration(step: SettlementExplanation) {
  const targetCount = step.effect === "grape-beadsmith"
    ? step.orderChanges.length
    : step.effect === "mitsuhiko" || step.effect === "nana"
      ? step.affectedOrderCardIds.length
      : 1;
  const stagger = step.effect === "grape-beadsmith" ? 150 : 130;
  return Math.max(1100, 620 + Math.max(0, targetCount - 1) * stagger + 320);
}

export function SettlementSequence({ explanations, sequenceKey, onStepChange, onComplete }: {
  explanations: SettlementExplanation[];
  sequenceKey: string;
  onStepChange: (committedCount: number, activeIndex: number | null) => void;
  onComplete: () => void;
}) {
  const [committedCount, setCommittedCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const reducedMotion = useMemo(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);

  useEffect(() => {
    let timer: number | undefined;
    setCommittedCount(0);
    setActiveIndex(explanations.length ? 0 : null);
    onStepChange(0, explanations.length ? 0 : null);
    if (reducedMotion || explanations.length === 0) {
      setCommittedCount(explanations.length);
      setActiveIndex(null);
      onStepChange(explanations.length, null);
      onComplete();
      return;
    }

    let active = 0;
    const commitActiveStep = () => {
      const nextCommitted = active + 1;
      const nextActive = nextCommitted < explanations.length ? nextCommitted : null;
      setCommittedCount(nextCommitted);
      setActiveIndex(nextActive);
      onStepChange(nextCommitted, nextActive);
      if (nextActive === null) {
        timer = window.setTimeout(onComplete, 180);
        return;
      }
      active = nextActive;
      timer = window.setTimeout(commitActiveStep, stepDuration(explanations[active]));
    };
    timer = window.setTimeout(commitActiveStep, stepDuration(explanations[active]));
    return () => { if (timer !== undefined) window.clearTimeout(timer); };
  }, [explanations, sequenceKey, reducedMotion, onComplete, onStepChange]);

  if (!explanations.length) return null;
  const visibleCount = committedCount + (activeIndex === null ? 0 : 1);
  return <section className="settlement-sequence" aria-live="polite" aria-label="特殊角色顺序结算">
    {explanations.slice(0, visibleCount).map((item, index) => <article className={`settlement-step ${index === activeIndex ? "is-active" : "is-committed"}`} key={`${item.effect}-${index}`}>
      <img src={images[item.effect]} alt="" draggable={false} />
      <div>
        <strong>{index + 1}. {item.summary}</strong>
        {item.effect === "grape-beadsmith" && <p>{item.orderChanges.length ? `${item.orderChanges.length} 张葡萄订单依次改为 ×1` : "没有仍有效且数量大于 1 的葡萄订单"}</p>}
        {item.effect === "order-swap-magician" && <p>划掉桌面草莓/葡萄库存来源，牌旁显示交换后的合计</p>}
        {(item.effect === "mitsuhiko" || item.effect === "nana") && <p>{item.affectedOrderCardIds.length ? `依次划掉 ${item.affectedOrderCardIds.length} 张目标订单` : "没有命中目标订单"}</p>}
      </div>
    </article>)}
  </section>;
}
