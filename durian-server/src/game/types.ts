export const FRUITS = ["strawberry", "banana", "grape", "durian"] as const;
export type Fruit = (typeof FRUITS)[number];

export type FruitSide = { fruit: Fruit; count: 1 | 2 | 3 };
export type FruitCard = { id: string; kind: "fruit"; left: FruitSide; right: FruitSide };
export type GorillaKind = "mitsuhiko" | "moo" | "nana" | "grape-beadsmith" | "order-swap-magician" | "boxing-manager" | "inventory-mover" | "temporary-supervisor";
export type GorillaCard = { id: string; kind: "gorilla"; gorilla: GorillaKind };
export type InventoryCard = FruitCard | GorillaCard;
export type InventorySlot = { inventoryId: string; card: InventoryCard };

export type OrderEntry = {
  cardId: string;
  playerId: string;
  side: "left" | "right";
  card: FruitCard;
  gorillaCardId?: string;
};

export type InventoryTotals = Record<Fruit, number>;
export type AngerToken = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type InvalidatingEffect = {
  effect: "mitsuhiko" | "nana";
  summary: string;
  affectedOrderCardIds: string[];
};

export type SettlementExplanation = InvalidatingEffect | {
  effect: "grape-beadsmith";
  summary: string;
  orderChanges: Array<{ cardId: string; from: 2 | 3; to: 1 }>;
} | {
  effect: "boxing-manager";
  summary: string;
  affectedFruits: Fruit[];
} | {
  effect: "inventory-mover";
  summary: string;
  sourceFruit: Fruit;
  targetFruit: Fruit;
  amount: 2;
  actor: InventorySlot;
  sources: Array<{
    inventoryId: string;
    cardId: string;
    side: "left" | "right";
    effectiveFruit: Fruit;
    amount: 1 | 2;
    countBefore: 1 | 2 | 3;
    countAfter: 0 | 1;
  }>;
  inventoryChanges: Partial<Record<Fruit, { from: number; to: number }>>;
} | {
  effect: "temporary-supervisor";
  summary: string;
  orderChanges: Array<{ cardId: string; fruit: Fruit; from: number; to: 0 }>;
} | {
  effect: "order-swap-magician";
  summary: string;
  inventoryChanges: {
    strawberry: { from: number; to: number };
    grape: { from: number; to: number };
  };
};

export type RevealResult = {
  inventory: InventoryTotals;
  baseInventory: InventoryTotals;
  orders: InventoryTotals;
  allOrders: OrderEntry[];
  validOrders: OrderEntry[];
  invalidOrders: OrderEntry[];
  exceededFruits: Fruit[];
  overloadedOrders: OrderEntry[];
  overstocked: boolean;
  explanations: SettlementExplanation[];
};
