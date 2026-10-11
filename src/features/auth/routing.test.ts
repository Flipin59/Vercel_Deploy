import assert from "node:assert/strict";
import test from "node:test";
import { isPlacementRoute } from "./routing.ts";

test("only the shared placement quiz bypasses onboarding", () => {
  assert.equal(isPlacementRoute("/play/quiz", "placement"), true);
  for (const path of ["/dashboard", "/profile", "/play", "/play/quiz/review", "/play/quiz/other", "/reels", "/forum", "/learn"]) {
    assert.equal(isPlacementRoute(path, "placement"), false, path);
  }
  for (const context of [null, "practice", "duel", "chapter", "reel", "Placement", "placement,practice"]) {
    assert.equal(isPlacementRoute("/play/quiz", context), false, String(context));
  }
});
