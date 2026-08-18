import type { Fruit, FruitCard, GorillaCard, InventoryCard } from "./types.js";

function fruitCard(id: string, leftFruit: Fruit, leftCount: 1 | 2 | 3, rightFruit: Fruit, rightCount: 2 | 3): FruitCard {
  if (leftFruit === rightFruit) throw new Error("水果牌上下两侧不能是同一种水果");
  return { id, kind: "fruit", left: { fruit: leftFruit, count: leftCount }, right: { fruit: rightFruit, count: rightCount } };
}

/*
 * 水果牌共 28 张，牌面数据转录自 Durian.xlsx（Serial 1–28）。
 * xlsx 中 Left/Number 表示"多个"的一侧（2 或 3 个），Right 表示"一个"的一侧；
 * 对应到代码结构为 left = 一个的一侧（count 1），right = 多个的一侧（count 2|3）。
 */
export const VERIFIED_STRUCTURE_DEV_CARDS: FruitCard[] = [
  fruitCard("fruit-1", "banana", 1, "strawberry", 3),
  fruitCard("fruit-2", "banana", 1, "strawberry", 2),
  fruitCard("fruit-3", "banana", 1, "strawberry", 2),
  fruitCard("fruit-4", "banana", 1, "strawberry", 2),
  fruitCard("fruit-5", "grape", 1, "strawberry", 3),
  fruitCard("fruit-6", "grape", 1, "strawberry", 2),
  fruitCard("fruit-7", "grape", 1, "strawberry", 2),
  fruitCard("fruit-8", "grape", 1, "strawberry", 2),
  fruitCard("fruit-9", "durian", 1, "strawberry", 3),
  fruitCard("fruit-10", "durian", 1, "strawberry", 2),
  fruitCard("fruit-11", "strawberry", 1, "banana", 3),
  fruitCard("fruit-12", "strawberry", 1, "banana", 2),
  fruitCard("fruit-13", "strawberry", 1, "banana", 2),
  fruitCard("fruit-14", "strawberry", 1, "banana", 2),
  fruitCard("fruit-15", "grape", 1, "banana", 2),
  fruitCard("fruit-16", "grape", 1, "banana", 2),
  fruitCard("fruit-17", "durian", 1, "banana", 2),
  fruitCard("fruit-18", "strawberry", 1, "grape", 3),
  fruitCard("fruit-19", "strawberry", 1, "grape", 2),
  fruitCard("fruit-20", "strawberry", 1, "grape", 2),
  fruitCard("fruit-21", "strawberry", 1, "grape", 2),
  fruitCard("fruit-22", "banana", 1, "grape", 2),
  fruitCard("fruit-23", "banana", 1, "grape", 2),
  fruitCard("fruit-24", "durian", 1, "grape", 2),
  fruitCard("fruit-25", "strawberry", 1, "durian", 3),
  fruitCard("fruit-26", "strawberry", 1, "durian", 2),
  fruitCard("fruit-27", "banana", 1, "durian", 2),
  fruitCard("fruit-28", "grape", 1, "durian", 2),
];

export const GORILLA_CARDS: GorillaCard[] = [
  { id: "gorilla-mitsuhiko", kind: "gorilla", gorilla: "mitsuhiko" },
  { id: "gorilla-moo", kind: "gorilla", gorilla: "moo" },
  { id: "gorilla-nana", kind: "gorilla", gorilla: "nana" },
];

export function createDevDeck(): InventoryCard[] {
  return [...VERIFIED_STRUCTURE_DEV_CARDS, ...GORILLA_CARDS];
}

export function shuffle<T>(items: T[], random = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
