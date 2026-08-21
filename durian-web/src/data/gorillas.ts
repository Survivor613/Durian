export type GorillaMode = "classic" | "curious-market";

export const socialGorillas = [
  {
    id: "mitsuhiko",
    name: "米奇",
    title: "三果判官",
    ability: "库存中时，所有包含 3 个水果的订单无效。",
    story: "米奇年轻时吃过缺斤少两的亏，从此查账必数三遍。谁敢一次报上三个水果，他便敲响算盘，把那张可疑订单当场作废。",
    status: "published",
    introducedAt: "基础卡池",
    modes: ["classic", "curious-market"],
    emoteImage: "/assets/emote-mitsuhiko.png",
    lobbyImage: "/assets/gorilla-mitsuhiko.png",
  },
  {
    id: "moo",
    name: "墨菲",
    title: "悠哉掌柜",
    ability: "没有特殊效果，但会作为普通大猩猩卡占据库存。",
    story: "墨菲总靠在柜台边慢慢喝茶，从不催单也不争辩。他看似什么都没做，庞大的身影却足以让所有人重新掂量自己的库存。",
    status: "published",
    introducedAt: "基础卡池",
    modes: ["classic", "curious-market"],
    emoteImage: "/assets/emote-moo.png",
    lobbyImage: "/assets/gorilla-moo.png",
  },
  {
    id: "nana",
    name: "汉娜",
    title: "香蕉克星",
    ability: "库存中时，所有香蕉订单无效。",
    story: "汉娜曾在香蕉仓里被倒塌的货箱埋了一夜，从此见到香蕉订单就脸色发青。她会毫不犹豫盖下红章，整单退回重写。",
    status: "published",
    introducedAt: "基础卡池",
    modes: ["classic", "curious-market"],
    emoteImage: "/assets/emote-nana.png",
    lobbyImage: "/assets/gorilla-nana.png",
  },
  {
    id: "grape-beadsmith",
    name: "紫罗",
    title: "葡萄珠匠",
    ability: "每张仍有效的葡萄订单按 1 个葡萄计算。",
    story: "紫罗把每串葡萄拆开，挑出最圆的一颗穿成珠子。她坚持精品只算一粒，因此再夸张的葡萄订单，到她手里也只认一个。",
    status: "published",
    introducedAt: "2026-08 首期记录",
    modes: ["curious-market"],
    emoteImage: "/assets/emote-grape-beadsmith.png",
    lobbyImage: "/assets/gorilla-grape-beadsmith.png",
  },
  {
    id: "order-swap-magician",
    name: "莫比",
    title: "换位魔术师",
    ability: "交换每张库存卡草莓与葡萄半区的有效水果归属；原卡与订单保持不变。",
    story: "莫比在闭店后练习货架魔术，响指一打，草莓与葡萄便悄悄换位。订单上的字没动，仓库数字却已彻底颠倒。",
    status: "published",
    introducedAt: "2026-08 首期记录",
    modes: ["curious-market"],
    emoteImage: "/assets/emote-order-swap-magician.png",
    lobbyImage: "/assets/gorilla-order-swap-magician.png",
  },
  {
    id: "boxing-manager",
    name: "克莱德",
    title: "封箱经理",
    ability: "按初始库存保护库存最少的整种水果，库存与订单都封箱且即使库存为 0 也不爆单；并列按草莓→香蕉→葡萄→榴莲取第一项。",
    story: "克莱德从装箱线上一路升任经理，最擅长在混乱的出货前给每个箱子扣上最后一道锁。只要他拍板封箱，谁也别想再把订单拆开重装。",
    status: "published",
    introducedAt: "本次上线批次",
    modes: ["curious-market"],
    emoteImage: "/assets/emote-boxing-manager.png",
    lobbyImage: "/assets/gorilla-boxing-manager.png",
  },
  {
    id: "inventory-mover",
    name: "巴鲁",
    title: "库存搬运工",
    ability: "克莱德保护项不能作为来源；其余有效库存最高项向最低项搬 2 颗，实例依次优先整取 2、从 3 取 2、两个 1 各取 1；并列按固定水果与库存顺序。",
    story: "巴鲁扛着木箱穿过仓库时从不走直线，因为他知道最短的路未必通向正确的货架。他记得每种水果的重量，也记得哪一箱库存最需要被重新清点。",
    status: "published",
    introducedAt: "本次上线批次",
    modes: ["curious-market"],
    emoteImage: "/assets/emote-inventory-mover.png",
    lobbyImage: "/assets/gorilla-inventory-mover.png",
  },
  {
    id: "temporary-supervisor",
    name: "菲恩",
    title: "临时主管",
    ability: "每种水果按原订单顺序的第一张订单计 0，且该订单不再处理后续订单效果；同水果后续订单继续结算。",
    story: "菲恩原本只是来替同事顶一晚班，却在交接簿上发现了整页无人负责的空白。她先把袖口卷好，再用一支红笔接过现场，把每项差事都安排到该去的位置。",
    status: "published",
    introducedAt: "本次上线批次",
    modes: ["curious-market"],
    emoteImage: "/assets/emote-temporary-supervisor.png",
    lobbyImage: "/assets/gorilla-temporary-supervisor.png",
  },
] as const satisfies readonly {
  id: string;
  name: string;
  title: string;
  ability: string;
  story: string;
  status: "published";
  introducedAt: string;
  modes: readonly GorillaMode[];
  emoteImage: string;
  lobbyImage: string;
}[];

export type SocialGorillaId = (typeof socialGorillas)[number]["id"];

export const socialGorillasById = new Map<SocialGorillaId, (typeof socialGorillas)[number]>(
  socialGorillas.map((gorilla) => [gorilla.id, gorilla]),
);

export const gorillasByMode = (mode: GorillaMode) => socialGorillas.filter((gorilla) => (gorilla.modes as readonly GorillaMode[]).includes(mode));
export const gorillaEffect = (id: string) => {
  const gorilla = socialGorillas.find((entry) => entry.id === id);
  return gorilla ? `${gorilla.title}·${gorilla.name}：${gorilla.ability}` : "未知大猩猩卡效果";
};
