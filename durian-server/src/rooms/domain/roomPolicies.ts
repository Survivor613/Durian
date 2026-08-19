export type RoomPhaseName = "lobby" | "playing" | "choosing_order" | "choosing_gorilla" | "gorilla_skip" | "bell_ringing" | "resolving" | "finished" | "waiting_reconnect";

export class RoomPhase {
  constructor(public value: RoomPhaseName = "lobby") {}

  is(...phases: RoomPhaseName[]) {
    return phases.includes(this.value);
  }

  enter(phase: RoomPhaseName) {
    this.value = phase;
    return phase;
  }
}

export type TurnPlayer = { id: string; connected: boolean };

export class PlayerTurnPolicy {
  online(players: readonly TurnPlayer[]) {
    return players.filter((player) => player.connected);
  }

  nextOnline(players: readonly TurnPlayer[], currentId: string): string | undefined {
    if (players.length === 0) return undefined;
    const found = players.findIndex((player) => player.id === currentId);
    const start = found >= 0 ? found : players.length - 1;
    for (let offset = 1; offset <= players.length; offset += 1) {
      const candidate = players[(start + offset) % players.length];
      if (candidate.connected) return candidate.id;
    }
    return undefined;
  }

  nextOnlineAfterRemoval(playersBeforeRemoval: readonly TurnPlayer[], removedId: string): string | undefined {
    const removedIndex = playersBeforeRemoval.findIndex((player) => player.id === removedId);
    if (removedIndex < 0) return this.nextOnline(playersBeforeRemoval, removedId);
    for (let offset = 1; offset < playersBeforeRemoval.length; offset += 1) {
      const candidate = playersBeforeRemoval[(removedIndex + offset) % playersBeforeRemoval.length];
      if (candidate.connected && candidate.id !== removedId) return candidate.id;
    }
    return undefined;
  }

  canContinue(players: readonly TurnPlayer[]) {
    return this.online(players).length >= 2;
  }
}

export class RoomAccessPolicy {
  isMember(playerIds: readonly string[], sessionId: string) {
    return playerIds.includes(sessionId);
  }

  isHost(playerIds: readonly string[], sessionId: string) {
    return playerIds[0] === sessionId;
  }

  canAct(playerIds: readonly string[], currentPlayerId: string, sessionId: string) {
    return this.isMember(playerIds, sessionId) && currentPlayerId === sessionId;
  }
}

export class MessageRateLimiter {
  private readonly buckets = new Map<string, number[]>();

  constructor(private readonly limit = 5, private readonly windowMs = 5_000) {}

  allow(key: string, now = Date.now()) {
    const recent = (this.buckets.get(key) ?? []).filter((time) => now - time < this.windowMs);
    if (recent.length >= this.limit) {
      this.buckets.set(key, recent);
      return false;
    }
    recent.push(now);
    this.buckets.set(key, recent);
    return true;
  }

  clear(key: string) {
    this.buckets.delete(key);
  }
}

export function normalizeNickname(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 24);
  return normalized || fallback;
}
