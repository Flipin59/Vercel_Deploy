import assert from "node:assert/strict";
import test from "node:test";
import { CHOICE_SIMS, runChoiceSim, runSim } from "./sim.ts";

test("runSim scores needs paid and money left", () => {
  // Cheapest needs, skip both wants: ₹3,000 − 199 − 600 − 700 = ₹1,501 left.
  assert.deepEqual(runSim([1, 0, 2, 0, 2]), { balance: 1501, needsPaid: 3, needs: 3, score: 100 });
  // Every need skipped, every want bought: ₹1,300 left, 0 needs.
  assert.deepEqual(runSim([2, 2, 0, 2, 0]), { balance: 1300, needsPaid: 0, needs: 3, score: 40 });
  // ₹3,000 − 299 − 800 − 500 − 800 = ₹601, then the ₹600 pair leaves ₹1.
  assert.equal(runSim([0, 1, 0, 1, 1])?.score, 60);
});

test("runSim rejects impossible runs", () => {
  assert.equal(runSim([0, 1, 0, 1, 0]), null); // ₹1,200 sneakers with ₹601 left
  assert.equal(runSim([0, 0, 0, 0]), null);
  assert.equal(runSim([0, 0, 0, 0, 3]), null);
  assert.equal(runSim([0, 0, 0, 0, 0.5]), null);
});

test("choice simulations: the best choices score 100, impossible runs are rejected", () => {
  for (const [id, sim] of Object.entries(CHOICE_SIMS)) {
    const best = sim.cards.map((c) => (c.points as readonly number[]).indexOf(Math.max(...c.points)));
    assert.deepEqual(runChoiceSim(id, best), { score: 100, best: 4, cards: 4 }, id);
    assert.ok(runChoiceSim(id, [0, 0, 0, 0])!.score < 100, id);
    assert.equal(runChoiceSim(id, [0, 0, 0]), null);
    assert.equal(runChoiceSim(id, [0, 0, 0, 3]), null);
  }
  assert.equal(runChoiceSim("survive-month", [0, 0, 0, 0]), null);
});
