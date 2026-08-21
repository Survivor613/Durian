import { useCallback, useEffect, useRef, useState } from "react";
import type { RoundPhraseId, RoundPhrasePayload, RoundPhraseRoom } from "./roundPhraseTypes";

const VISIBLE_MS = 5_200;

export function useRoundPhrases(room: RoundPhraseRoom | null, round: number, phase: string) {
  const [events, setEvents] = useState<Record<string, RoundPhrasePayload>>({});
  const [hasSentSelf, setHasSentSelf] = useState(false);
  const seenEventIds = useRef(new Set<string>());
  const expiryTimers = useRef(new Map<string, number>());

  useEffect(() => {
    setEvents({});
    setHasSentSelf(false);
    seenEventIds.current.clear();
    for (const timer of expiryTimers.current.values()) window.clearTimeout(timer);
    expiryTimers.current.clear();
  }, [room, round]);

  useEffect(() => {
    if (!room) return;
    const remove = room.onMessage("round_phrase", (payload) => {
      if (!payload || payload.round !== round || seenEventIds.current.has(payload.eventId)) return;
      seenEventIds.current.add(payload.eventId);
      if (payload.playerId === room.sessionId) setHasSentSelf(true);
      const elapsed = Math.max(0, Date.now() - payload.sentAt);
      if (elapsed >= VISIBLE_MS) return;
      setEvents((current) => ({ ...current, [payload.playerId]: payload }));
      const previousTimer = expiryTimers.current.get(payload.playerId);
      if (previousTimer) window.clearTimeout(previousTimer);
      expiryTimers.current.set(payload.playerId, window.setTimeout(() => {
        setEvents((current) => {
          if (current[payload.playerId]?.eventId !== payload.eventId) return current;
          const next = { ...current };
          delete next[payload.playerId];
          return next;
        });
        expiryTimers.current.delete(payload.playerId);
      }, Math.max(0, VISIBLE_MS - elapsed)));
    });
    return () => { if (typeof remove === "function") remove(); };
  }, [room, round]);

  useEffect(() => {
    if (room && phase === "resolving") room.send("request_round_phrases");
  }, [room, round, phase]);

  useEffect(() => () => {
    for (const timer of expiryTimers.current.values()) window.clearTimeout(timer);
  }, []);

  const send = useCallback((phraseId: RoundPhraseId) => {
    if (!room || phase !== "resolving") return;
    room.send("round_phrase", { phraseId });
  }, [room, phase]);

  return { send, hasSentSelf, phraseByPlayerId: events };
}
