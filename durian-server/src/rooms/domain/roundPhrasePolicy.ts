export const WIN_ROUND_PHRASES = [
  { id: "interesting", text: "有点意思" },
  { id: "did-we-win", text: "你就说赢没赢吧" },
  { id: "pressure", text: "给压压" },
  { id: "no-pressure", text: "不吃压力" },
] as const;

export const WIN_GORILLA_ROUND_PHRASES = [
  { id: "gorilla-called-it", text: "猜到了老弟" },
  { id: "interesting", text: "有点意思" },
  { id: "did-we-win", text: "你就说赢没赢吧" },
  { id: "gorilla-woo", text: "Wooooo~" },
] as const;

export const LOSE_ROUND_PHRASES = [
  { id: "miscalculated", text: "失算了" },
  { id: "pressure-hit", text: "完了吃压力了" },
  { id: "bad-coin", text: "有坏币" },
  { id: "ran-it-for-you", text: "给你运完了" },
] as const;

export const LOSE_GORILLA_ROUND_PHRASES = [
  { id: "what-was-that", text: "居然是这个" },
  { id: "miscalculated", text: "失算了" },
  { id: "pressure-hit", text: "完了吃压力了" },
  { id: "bad-coin", text: "有坏币" },
] as const;

export type RoundPhraseId =
  | (typeof WIN_ROUND_PHRASES)[number]["id"]
  | (typeof WIN_GORILLA_ROUND_PHRASES)[number]["id"]
  | (typeof LOSE_ROUND_PHRASES)[number]["id"]
  | (typeof LOSE_GORILLA_ROUND_PHRASES)[number]["id"];
export type RoundPhraseRequest = { phraseId: RoundPhraseId };
export type RoundPhrasePayload = {
  playerId: string;
  round: number;
  phraseId: RoundPhraseId;
  text: string;
  sentAt: number;
  eventId: string;
};

const phraseText = new Map<RoundPhraseId, string>(
  [WIN_ROUND_PHRASES, WIN_GORILLA_ROUND_PHRASES, LOSE_ROUND_PHRASES, LOSE_GORILLA_ROUND_PHRASES]
    .flat()
    .map((phrase) => [phrase.id, phrase.text]),
);

export class RoundPhrasePolicy {
  private round = 0;
  private sequence = 0;
  private readonly eventsByPlayerId = new Map<string, RoundPhrasePayload>();

  reset(round: number) {
    this.round = round;
    this.sequence = 0;
    this.eventsByPlayerId.clear();
  }

  parse(message: unknown): RoundPhraseRequest | null {
    if (!message || typeof message !== "object" || Array.isArray(message)) return null;
    const payload = message as Record<string, unknown>;
    if (Object.keys(payload).some((key) => key !== "phraseId") || typeof payload.phraseId !== "string" || !phraseText.has(payload.phraseId as RoundPhraseId)) return null;
    return { phraseId: payload.phraseId as RoundPhraseId };
  }

  canUse(phraseId: RoundPhraseId, hasGorillaInventory: boolean, isLoser: boolean) {
    const phrases = isLoser
      ? (hasGorillaInventory ? LOSE_GORILLA_ROUND_PHRASES : LOSE_ROUND_PHRASES)
      : (hasGorillaInventory ? WIN_GORILLA_ROUND_PHRASES : WIN_ROUND_PHRASES);
    return phrases.some((phrase) => phrase.id === phraseId);
  }

  hasSent(playerId: string) {
    return this.eventsByPlayerId.has(playerId);
  }

  create(playerId: string, phraseId: RoundPhraseId, sentAt = Date.now()): RoundPhrasePayload {
    const payload = {
      playerId,
      round: this.round,
      phraseId,
      text: phraseText.get(phraseId)!,
      sentAt,
      eventId: `${this.round}:${playerId}:${sentAt}:${this.sequence++}`,
    };
    this.eventsByPlayerId.set(playerId, payload);
    return payload;
  }

  events() {
    return [...this.eventsByPlayerId.values()];
  }

  clear() {
    this.reset(0);
  }
}
