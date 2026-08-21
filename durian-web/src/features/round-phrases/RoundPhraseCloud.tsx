"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import {
  LOSE_GORILLA_ROUND_PHRASES,
  LOSE_ROUND_PHRASES,
  WIN_GORILLA_ROUND_PHRASES,
  WIN_ROUND_PHRASES,
  type RoundPhraseId,
  type RoundPhrasePayload,
} from "./roundPhraseTypes";
import styles from "./RoundPhraseCloud.module.css";

type Props = {
  event?: RoundPhrasePayload;
  inventoryKind?: "fruit" | "gorilla";
  side: "left" | "right";
  spokenDirection?: "up" | "down";
  roundOutcome?: "win" | "lose";
  canSend?: boolean;
  onSend?: (phraseId: RoundPhraseId) => void;
};

type CloudShellProps = {
  children: ReactNode;
  className: string;
  tail?: "left" | "right" | "up" | "down";
};

const CLOUD_PATH = "M21 79C7 75 4 59 15 49C9 34 23 20 39 27C44 10 65 7 76 21C89 7 110 10 116 27C132 18 151 28 150 44C166 49 171 65 161 77C153 89 135 92 119 88C108 101 88 101 77 90C64 101 43 98 39 86C31 89 24 86 21 79Z";

function CloudShell({ children, className, tail = "down" }: CloudShellProps) {
  return <span className={`${className} ${styles[`tail${tail[0].toUpperCase()}${tail.slice(1)}`]}`}>
    <svg className={styles.cloudShape} viewBox="0 0 180 112" aria-hidden="true">
      <path className={styles.cloudShadow} d={CLOUD_PATH} />
      <path className={styles.cloudBody} d={CLOUD_PATH} />
    </svg>
    <span className={styles.cloudText}>{children}</span>
    <i className={styles.tailBubbleLarge} />
    <i className={styles.tailBubbleSmall} />
  </span>;
}

function EntryIcon({ mood }: { mood: "win" | "lose" }) {
  if (mood === "win") return <svg viewBox="0 0 32 28" aria-hidden="true"><path d="M5 18C1 14 4 8 9 8C11 3 18 3 20 8C26 6 31 11 28 16C27 20 22 21 18 19C14 24 8 23 5 18Z" /><path d="M12 13h.1m7 0h.1M13 17c2 2 4 2 6 0" /></svg>;
  return <svg viewBox="0 0 32 28" aria-hidden="true"><path d="M6 20C1 17 3 10 8 9C8 4 14 2 18 6C23 3 29 7 27 12C32 16 28 22 23 21C19 24 13 22 11 20C9 22 7 21 6 20Z" /><path d="M11 13l2 1m6-1l2-1M14 17c2-1 3-1 5 0" /></svg>;
}

export function RoundPhraseCloud({ event, inventoryKind, side, spokenDirection = "up", roundOutcome = "win", canSend = false, onSend }: Props) {
  const [open, setOpen] = useState(false);
  const phrases = roundOutcome === "lose"
    ? (inventoryKind === "gorilla" ? LOSE_GORILLA_ROUND_PHRASES : LOSE_ROUND_PHRASES)
    : (inventoryKind === "gorilla" ? WIN_GORILLA_ROUND_PHRASES : WIN_ROUND_PHRASES);

  function choose(phraseId: RoundPhraseId) {
    onSend?.(phraseId);
    setOpen(false);
  }

  return <div className={`${styles.anchor} ${side === "left" ? styles.left : styles.right}`}>
    {event && <div className={`${styles.spoken} ${spokenDirection === "down" ? styles.spokenDown : styles.spokenUp}`} role="status" key={event.eventId}>
      <CloudShell className={styles.spokenCloud} tail={spokenDirection === "down" ? "up" : "down"}>{event.text}</CloudShell>
    </div>}
    {canSend && <>
      <div className={styles.entryVariants} aria-label={roundOutcome === "lose" ? "输家发话" : "赢家发话"}>
        <button
          type="button"
          className={`${styles.entry} ${roundOutcome === "lose" ? styles.entryLose : styles.entryWin}`}
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={roundOutcome === "lose" ? "输家发送本轮一句话" : "赢家发送本轮一句话"}
        ><EntryIcon mood={roundOutcome} /></button>
      </div>
      {open && <div className={styles.picker} role="menu">
        <div className={styles.rails}>
          {phrases.map((phrase, index) => {
            const rail = index % 2 === 0 ? "left" : "right";
            return <button
              type="button"
              className={`${styles.choice} ${rail === "left" ? styles.leftRail : styles.rightRail}`}
              style={{ "--cloud-row": Math.floor(index / 2), "--cloud-index": index } as CSSProperties}
              key={phrase.phraseId}
              role="menuitem"
              onClick={() => choose(phrase.phraseId)}
            >
              <CloudShell className={styles.choiceCloud} tail={rail === "left" ? "right" : "left"}>{phrase.text}</CloudShell>
            </button>;
          })}
        </div>
      </div>}
    </>}
  </div>;
}
