"use client";

import { FormEvent, useState } from "react";
import { BrandLockup } from "./BrandLockup";

type HomeLandingProps = {
  name: string;
  roomCode: string;
  isConnecting: boolean;
  error: string;
  onNameChange: (value: string) => void;
  onRoomCodeChange: (value: string) => void;
  onRandomNickname: () => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
};

const facts = ["2–7 人", "约 15 分钟", "浏览器直接玩"];
const brandIcons = [
  { file: "gorilla-manager-seal-v1.png", name: "经理印章", note: "主品牌图标，角色记忆最强，适合宣传头像与应用图标" },
  { file: "durian-bell-badge-v1.png", name: "榴莲铃铛", note: "玩法与游戏名结合，适合作为活动徽章" },
  { file: "exploding-order-v1.png", name: "爆单现场", note: "戏剧性最强，适合活动传播" },
  { file: "d-monogram-v1.png", name: "D 字品牌标", note: "最简洁成熟，适合小尺寸辅助标识" },
];

const managerPlateOptions = [
  { id: "brass", label: "A 黄铜铭牌" },
  { id: "enamel", label: "B 珐琅工牌" },
  { id: "ledger", label: "C 账本桌牌" },
  { id: "neon", label: "D 霓虹灯牌" },
] as const;

type ManagerPlateStyle = (typeof managerPlateOptions)[number]["id"];

function HeroTable() {
  const [plateStyle, setPlateStyle] = useState<ManagerPlateStyle>("brass");
  return <div className="landing-visual" aria-label="猩猩经理守着水果订单和铃铛的牌桌">
    <div className="landing-spotlight" aria-hidden="true" />
    <div className="landing-scene-back" aria-hidden="true">
      <div className="landing-manager-halo" />
      <img className="landing-manager" src="/assets/gorilla-mitsuhiko.png" alt="" draggable={false} />
    </div>
    <div className="landing-table" aria-hidden="true">
      <div className="landing-table-rim" />
      <div className="landing-table-items">
        <div className={`landing-danger-label plate-${plateStyle}`}><span>STORE MANAGER</span><strong>值班经理 · 米奇</strong><small>NO. 001</small></div>
        <img className="landing-order-board landing-item-standing" src="/assets/order-board.png" alt="" draggable={false} />
        <img className="landing-bell landing-item-standing" src="/assets/bell.png" alt="" draggable={false} />
        <img className="landing-fruit landing-fruit-durian landing-item-standing" src="/assets/fruit-durian.png" alt="" draggable={false} />
      </div>
    </div>
    <div className="manager-plate-switcher" role="group" aria-label="经理姓名板方案预览">
      {managerPlateOptions.map((option) => <button type="button" key={option.id} className={plateStyle === option.id ? "is-selected" : ""} aria-pressed={plateStyle === option.id} onClick={() => setPlateStyle(option.id)}>{option.label}</button>)}
    </div>
    <div className="landing-visual-caption"><i /> 今晚营业中 <span>经理已经开始查账</span></div>
  </div>;
}

export function HomeLanding({
  name,
  roomCode,
  isConnecting,
  error,
  onNameChange,
  onRoomCodeChange,
  onRandomNickname,
  onCreateRoom,
  onJoinRoom,
}: HomeLandingProps) {
  const [nicknameFlip, setNicknameFlip] = useState(0);

  function randomizeName() {
    onRandomNickname();
    setNicknameFlip((value) => value + 1);
  }

  function submitJoin(event: FormEvent) {
    event.preventDefault();
    onJoinRoom();
  }

  return <div className="landing-page">
    <div className="landing-ambient landing-ambient-one" aria-hidden="true" />
    <div className="landing-ambient landing-ambient-two" aria-hidden="true" />

    <section className="landing-hero">
      <div className="landing-copy">
        <BrandLockup variant="hero" className="landing-brand-row" />
        <p className="landing-kicker"><i /> 猩猩水果店 · 今晚开张</p>
        <h1>今晚，别让<br /><em>订单爆掉。</em></h1>
        <p className="landing-lead">看别人的库存，猜自己的牌。大胆下单、互相怀疑，然后在正确的时机——敲铃。</p>
        <div className="landing-facts" aria-label="游戏信息">
          {facts.map((fact) => <span key={fact}>{fact}</span>)}
        </div>

        <div className="landing-actions">
          <div className="landing-name-row">
            <label className="landing-field landing-name-field" key={nicknameFlip}>
              <span>今晚怎么称呼你？</span>
              <input value={name} onChange={(event) => onNameChange(event.target.value)} maxLength={24} placeholder="输入昵称" autoComplete="nickname" />
            </label>
            <button type="button" className="landing-random" onClick={randomizeName} disabled={isConnecting}>
              <span aria-hidden="true">↻</span> 随机雷霆昵称
            </button>
          </div>
          <button type="button" className="landing-create" onClick={onCreateRoom} disabled={isConnecting}>
            <span>{isConnecting ? "正在摆桌…" : "摆好牌桌"}</span>
            <small>创建房间并邀请好友</small>
            <b aria-hidden="true">→</b>
          </button>

          <div className="landing-divider"><span>已经有人开桌？</span></div>
          <form className="landing-join" onSubmit={submitJoin}>
            <label className="landing-field">
              <span>8 位房间号</span>
              <input value={roomCode} onChange={(event) => onRoomCodeChange(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" maxLength={8} placeholder="例如 2086 0315" aria-label="8 位房间号" />
            </label>
            <button type="submit" disabled={isConnecting}>立即入座 <span aria-hidden="true">↗</span></button>
          </form>
          {error && <p className="landing-error" role="alert">{error}</p>}
        </div>
      </div>
      <HeroTable />
    </section>

    <section className="landing-section landing-opening" aria-labelledby="opening-title">
      <div className="landing-section-heading"><span>HOW TO JOIN</span><h2 id="opening-title">三步开张</h2><p>不用注册，不用下载。把朋友叫来，浏览器里直接入座。</p></div>
      <div className="landing-steps">
        {[
          ["01", "摆好牌桌", "创建一张私人牌桌，经理会给你一个 8 位房间号。"],
          ["02", "把暗号传出去", "复制房间号发给朋友，手机和电脑都能加入。"],
          ["03", "人齐就开查", "选好第一位店员，开始处理今晚这批危险订单。"],
        ].map(([number, title, description]) => <article key={number}><b>{number}</b><div><h3>{title}</h3><p>{description}</p></div></article>)}
      </div>
    </section>

    <section className="landing-section landing-rules" aria-labelledby="rules-title">
      <div className="landing-section-heading"><span>THE NIGHT SHIFT</span><h2 id="rules-title">今晚怎么查账</h2><p>规则不复杂，麻烦的是——你永远看不到自己的库存。</p></div>
      <div className="landing-rule-grid">
        <article><div className="landing-rule-art landing-rule-inventory"><img src="/assets/card-back.png" alt="" /></div><span>01 · 看库存</span><h3>全桌都知道，除了你</h3><p>观察其他人的库存牌，从他们的表情和订单猜出自己手里有什么。</p></article>
        <article><div className="landing-rule-art landing-rule-order"><img src="/assets/fruit-banana.png" alt="" /><img src="/assets/fruit-grape.png" alt="" /></div><span>02 · 下订单</span><h3>大胆一点，或者装得大胆</h3><p>每张订单都让风险继续累积。你可以诚实，也可以让别人先慌起来。</p></article>
        <article><div className="landing-rule-art landing-rule-bell"><img src="/assets/bell.png" alt="" /></div><span>03 · 敲铃</span><h3>抓到爆单，还是误伤自己</h3><p>觉得订单超过库存就敲铃。判断正确，经理找别人；错了，他会来找你。</p></article>
      </div>
    </section>

    <section className="landing-section landing-brand-lab" aria-labelledby="brand-lab-title">
      <div className="landing-section-heading"><span>BRAND LAB</span><h2 id="brand-lab-title">给水果店挑个招牌</h2><p>四版宣传图标先并排试用。观察它们在头像、应用图标和小尺寸下谁最有记忆点。</p></div>
      <div className="landing-icon-grid">
        {brandIcons.map((icon, index) => <article className={index === 0 ? "is-recommended" : ""} key={icon.file}>
          <div className="landing-icon-preview">
            <img src={`/assets/branding/${icon.file}`} alt={`${icon.name}图标候选`} draggable={false} />
            {index === 0 && <span>推荐</span>}
          </div>
          <div className="landing-icon-meta"><h3>{icon.name}</h3><p>{icon.note}</p></div>
          <div className="landing-icon-sizes" aria-label={`${icon.name}小尺寸预览`}>
            {[32, 48, 64].map((size) => <span key={size}><img src={`/assets/branding/${icon.file}`} alt="" style={{ width: size, height: size }} /><small>{size}</small></span>)}
          </div>
        </article>)}
      </div>
    </section>

    <footer className="landing-footer"><span>DURIAN FRUIT SHOP</span><p>今晚的库存，可能没有看起来那么多。</p></footer>
  </div>;
}
