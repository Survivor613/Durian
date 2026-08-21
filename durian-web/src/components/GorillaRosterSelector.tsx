"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { socialGorillas } from "../data/gorillas";

type GorillaRosterSelectorProps = {
  selectedIds: string[];
  max: number;
  onSave: (selectedIds: string[], maxGorillas: number) => void;
  onClose: () => void;
  open: boolean;
};

export function GorillaRosterSelector({ selectedIds, max, onSave, onClose, open }: GorillaRosterSelectorProps) {
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds);
  const [draftMax, setDraftMax] = useState(max);

  useEffect(() => {
    if (open) {
      setDraftIds(selectedIds);
      setDraftMax(max);
    }
  }, [max, open, selectedIds]);

  if (!open) return null;

  const toggleGorilla = (id: string) => {
    setDraftIds((current) => {
      if (current.includes(id)) {
        const next = current.filter((selectedId) => selectedId !== id);
        setDraftMax((value) => Math.min(value, next.length || 1));
        return next;
      }
      return [...current, id];
    });
  };

  const content = <div className="gorilla-roster-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="gorilla-roster-modal" role="dialog" aria-modal="true" aria-labelledby="gorilla-roster-title">
      <div className="gorilla-roster-heading">
        <div>
          <div className="eyebrow">Portal archive</div>
          <h2 id="gorilla-roster-title">猩猩名册</h2>
          <p>勾选本局会出现的员工剪影</p>
        </div>
        <button type="button" className="gorilla-roster-close" aria-label="关闭猩猩名册" onClick={onClose}>×</button>
      </div>
      <div className="gorilla-roster-toolbar">
        <span>已选角色 {draftIds.length} 位</span>
        <label>玩家初始猩猩上限
          <select value={draftMax} onChange={(event) => setDraftMax(Math.min(Number(event.target.value), draftIds.length || 1))}>
            {socialGorillas.map((gorilla, index) => <option key={gorilla.id} value={index + 1}>{index + 1} 张</option>)}
          </select>
        </label>
      </div>
      <div className="gorilla-roster-grid">
        {socialGorillas.map((gorilla) => {
          const checked = draftIds.includes(gorilla.id);
          return <button
            type="button"
            className={`gorilla-roster-card ${checked ? "is-selected" : ""}`}
            key={gorilla.id}
            aria-pressed={checked}
            onClick={() => toggleGorilla(gorilla.id)}
          >
            <span className="gorilla-roster-check" aria-hidden="true">{checked ? "✓" : ""}</span>
            <img src={gorilla.lobbyImage} alt="" draggable={false} />
            <span className="gorilla-roster-card-copy"><strong>{gorilla.name}</strong><small>{gorilla.title}</small><em>{gorilla.ability}</em></span>
          </button>;
        })}
      </div>
      <div className="gorilla-roster-actions">
        <button type="button" className="secondary-button" onClick={onClose}>取消</button>
        <button type="button" disabled={!draftIds.length} onClick={() => onSave(draftIds, draftMax)}>保存阵容</button>
      </div>
    </section>
  </div>;

  return createPortal(content, document.body);
}
