"use client";

import { useEffect, useRef } from "react";

// 整场动画时长（与 globals.css 里 .punch-overlay 系列的 3.4s 动画保持一致）
const PUNCH_DURATION_MS = 3400;
// 两拳命中的时间点（对应 keyframes 里 31% / 51% 的屏幕震动）
const PUNCH_HIT_TIMES_MS = [1050, 1730];

// 可插拔的音效点：项目里没有现成的打击音效文件（现有铃声/终局音效都是 WebAudio 合成的），
// 所以这里用 WebAudio 合成一记低频闷击；将来若有 .mp3 素材，换成 new Audio(url).play() 即可。
let sharedAudioCtx: AudioContext | null = null;
function playPunchSound() {
  try {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return;
    if (!sharedAudioCtx) sharedAudioCtx = new Ctor();
    const ctx = sharedAudioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    // 低频正弦快速下扫 = 闷拳；叠一层短噪声增益包络 = 击打脆感
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.22);
    oscGain.gain.setValueAtTime(0.9, now);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  } catch {
    // 浏览器禁止自动播放等情况：静默失败，不影响动画
  }
}

// 放射裂纹：一组从命中点向外散开的线段
function CrackFan({ side }: { side: "left" | "right" }) {
  return <div className={`punch-cracks punch-cracks-${side}`} aria-hidden="true">
    {[0, 1, 2, 3, 4].map((index) => <i key={index} />)}
  </div>;
}

export function PunchOverlay({ onClose }: { onClose: () => void }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const soundTimers = PUNCH_HIT_TIMES_MS.map((at) => window.setTimeout(playPunchSound, at));
    const closeTimer = window.setTimeout(() => onCloseRef.current(), PUNCH_DURATION_MS);
    return () => {
      soundTimers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(closeTimer);
    };
  }, []);

  return <div className="punch-overlay" role="presentation" onClick={() => onCloseRef.current()}>
    <div className="punch-vignette" aria-hidden="true" />
    <div className="punch-stage" aria-hidden="true">
      <img className="punch-gorilla" src="/assets/gorilla-mitsuhiko.png" alt="" draggable={false} />
      <div className="punch-impact punch-impact-left">
        <div className="punch-ring" />
        <div className="punch-burst" />
      </div>
      <div className="punch-impact punch-impact-right">
        <div className="punch-ring" />
        <div className="punch-burst" />
      </div>
      <CrackFan side="left" />
      <CrackFan side="right" />
    </div>
    <div className="punch-flash" aria-hidden="true" />
    <div className="punch-skip">点击任意处跳过</div>
  </div>;
}
