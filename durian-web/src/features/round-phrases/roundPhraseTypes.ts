export const WIN_ROUND_PHRASES = [
  { phraseId: "interesting", text: "有点意思" },
  { phraseId: "did-we-win", text: "你就说赢没赢吧" },
  { phraseId: "pressure", text: "给压压" },
  { phraseId: "no-pressure", text: "不吃压力" },
] as const;

export const WIN_GORILLA_ROUND_PHRASES = [
  { phraseId: "gorilla-called-it", text: "猜到了老弟" },
  { phraseId: "interesting", text: "有点意思" },
  { phraseId: "did-we-win", text: "你就说赢没赢吧" },
  { phraseId: "gorilla-woo", text: "Wooooo~" },
] as const;

export const LOSE_ROUND_PHRASES = [
  { phraseId: "miscalculated", text: "失算了" },
  { phraseId: "pressure-hit", text: "完了吃压力了" },
  { phraseId: "bad-coin", text: "有坏币" },
  { phraseId: "ran-it-for-you", text: "给你运完了" },
] as const;

export const LOSE_GORILLA_ROUND_PHRASES = [
  { phraseId: "what-was-that", text: "居然是这个" },
  { phraseId: "miscalculated", text: "失算了" },
  { phraseId: "pressure-hit", text: "完了吃压力了" },
  { phraseId: "bad-coin", text: "有坏币" },
] as const;

export type RoundPhraseId =
  | (typeof WIN_ROUND_PHRASES)[number]["phraseId"]
  | (typeof WIN_GORILLA_ROUND_PHRASES)[number]["phraseId"]
  | (typeof LOSE_ROUND_PHRASES)[number]["phraseId"]
  | (typeof LOSE_GORILLA_ROUND_PHRASES)[number]["phraseId"];
export type RoundPhrasePayload = {
  playerId: string;
  round: number;
  phraseId: RoundPhraseId;
  text: string;
  sentAt: number;
  eventId: string;
};

export type RoundPhraseRoom = {
  sessionId: string;
  send(type: string, payload?: unknown): void;
  onMessage(type: "round_phrase", callback: (payload: RoundPhrasePayload) => void): (() => void) | void;
};
