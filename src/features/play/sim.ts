// "Survive the month" (IMPLEMENTATION.md P6, SCORE.md §5). Pure and deterministic, so
// the server replays the student's choices instead of trusting a score. Example prices;
// the texts are in messages (sim.<card>.*).
export const SIM = {
  id: "survive-month",
  start: 3000,
  // Choice 2 is always "skip" (₹0). Skipping a need leaves it unpaid.
  cards: [
    { key: "recharge", need: true, costs: [299, 199, 0] },
    { key: "bus", need: true, costs: [600, 800, 0] },
    { key: "outing", need: false, costs: [500, 150, 0] },
    { key: "examFee", need: true, costs: [700, 800, 0] },
    { key: "sneakers", need: false, costs: [1200, 600, 0] },
  ],
} as const;

const NEEDS = SIM.cards.filter((c) => c.need).length;

// Score 0–100 = 20 per need paid + up to 40 for money left (full at ₹600).
// Null when the choices aren't a possible run (wrong length, unknown or unaffordable).
export function runSim(choices: number[]): { balance: number; needsPaid: number; needs: number; score: number } | null {
  if (!Array.isArray(choices) || choices.length !== SIM.cards.length) return null;
  let balance: number = SIM.start;
  let needsPaid = 0;
  for (const [i, card] of SIM.cards.entries()) {
    const cost = Number.isInteger(choices[i]) ? card.costs[choices[i]] : undefined;
    if (cost === undefined || cost > balance) return null;
    balance -= cost;
    if (card.need && cost > 0) needsPaid++;
  }
  return { balance, needsPaid, needs: NEEDS, score: Math.round(20 * needsPaid + (40 * Math.min(balance, 600)) / 600) };
}

// Choice simulations (Wave 3b): four cards, three choices each, worth the points below;
// the score (0–100) is their sum. Deterministic, so the server replays the choices. The
// texts, example numbers and stated assumptions are in messages (sims.<id>.*).
export const CHOICE_SIMS = {
  "grow-savings": {
    pillar: "save",
    cards: [
      { key: "where", points: [0, 15, 25] },
      { key: "start", points: [25, 10, 0] },
      { key: "dip", points: [0, 10, 25] },
      { key: "raise", points: [15, 25, 0] },
    ],
  },
  "spot-the-scam": {
    pillar: "safety",
    cards: [
      { key: "otp", points: [0, 25, 15] },
      { key: "loan", points: [0, 10, 25] },
      { key: "scheme", points: [25, 0, 10] },
      { key: "alert", points: [10, 25, 0] },
    ],
  },
  "emi-or-save": {
    pillar: "budget",
    cards: [
      { key: "how", points: [5, 5, 25] },
      { key: "need", points: [5, 25, 0] },
      { key: "short", points: [0, 25, 5] },
      { key: "upsell", points: [0, 5, 25] },
    ],
  },
} as const;
export type ChoiceSimId = keyof typeof CHOICE_SIMS;
export const isChoiceSim = (id: string): id is ChoiceSimId => Object.hasOwn(CHOICE_SIMS, id);

// Null when the choices aren't a possible run. `best` = cards where the top choice was picked.
export function runChoiceSim(id: string, choices: number[]): { score: number; best: number; cards: number } | null {
  if (!isChoiceSim(id)) return null;
  const { cards } = CHOICE_SIMS[id];
  if (!Array.isArray(choices) || choices.length !== cards.length) return null;
  let score = 0;
  let best = 0;
  for (const [i, card] of cards.entries()) {
    const points: number | undefined = Number.isInteger(choices[i]) ? card.points[choices[i]] : undefined;
    if (points === undefined) return null;
    score += points;
    if (points === Math.max(...card.points)) best++;
  }
  return { score, best, cards: cards.length };
}
