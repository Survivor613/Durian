import type { Fruit, FruitCard, GorillaCard, InventoryCard } from "./types.js";

const fruits: Fruit[] = ["strawberry", "banana", "grape", "durian"];

function fruitCard(id: string, leftFruit: Fruit, leftCount: 1 | 2 | 3, rightFruit: Fruit, rightCount: 2 | 3): FruitCard {
  if (leftFruit === rightFruit) throw new Error("水果牌上下两侧不能是同一种水果");
  return { id, kind: "fruit", left: { fruit: leftFruit, count: leftCount }, right: { fruit: rightFruit, count: rightCount } };
}

/*
 * The public rules confirm 28 fruit cards and their structural constraints:
 * two different fruits, one side showing 1 and the other showing 2 or 3.
 * The exact commercial card frequency table is kept isolated here until it
 * is transcribed from an owned rulebook/card set rather than guessed.
 */
export const VERIFIED_STRUCTURE_DEV_CARDS: FruitCard[] = Array.from({ length: 28 }, (_, index) => {
  const leftFruit = fruits[index % fruits.length];
  let rightFruitIndex = (index + 1 + Math.floor(index / fruits.length)) % fruits.length;
  if (rightFruitIndex === index % fruits.length) rightFruitIndex = (rightFruitIndex + 1) % fruits.length;
  const rightFruit = fruits[rightFruitIndex];
  const rightCount = (index % 2 === 0 ? 2 : 3) as 2 | 3;
  return fruitCard(`fruit-${index + 1}`, leftFruit, 1, rightFruit, rightCount);
});

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
