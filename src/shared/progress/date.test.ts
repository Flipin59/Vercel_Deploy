import assert from "node:assert/strict";
import test from "node:test";
import { istDate } from "./date.ts";

test("daily rewards switch dates exactly at IST midnight", () => {
  assert.equal(istDate(new Date("2026-10-10T18:29:59.999Z")), "2026-10-10");
  assert.equal(istDate(new Date("2026-10-10T18:30:00.000Z")), "2026-10-11");
});

test("IST date handles year and leap-day boundaries", () => {
  assert.equal(istDate(new Date("2026-12-31T18:30:00Z")), "2027-01-01");
  assert.equal(istDate(new Date("2028-02-28T18:30:00Z")), "2028-02-29");
});
