import assert from "node:assert/strict";
import test from "node:test";
import { parseOnboarding, parseProfilePreferences, validUsername } from "./validation.ts";

function answers() {
  const form = new FormData();
  Object.entries({ language: "te", grade: "12", budget: "new", save: "learning", invest: "confident", safety: "new" })
    .forEach(([key, value]) => form.set(key, value));
  return form;
}

test("usernames exclude whitespace, emails, short and oversized names", () => {
  assert.equal(validUsername("student_12"), true);
  for (const value of ["ab", "a".repeat(25), "full name", "a@b.in", "student\n", "ABC"]) {
    assert.equal(validUsername(value), false, value);
  }
});

test("onboarding derives pillar needs from validated answers", () => {
  assert.deepEqual(parseOnboarding(answers()), {
    language: "te", grade: 12,
    persona: {
      answers: { budget: "new", save: "learning", invest: "confident", safety: "new" },
      pillarNeed: { budget: 1, save: 0.6, invest: 0.2, safety: 1 },
    },
  });
});

test("incomplete and tampered onboarding is rejected", () => {
  for (const [key, value] of [["language", "fr"], ["grade", "13"], ["budget", ""], ["safety", "100"], ["grade", "11junk"]]) {
    const form = answers();
    form.set(key, value);
    assert.equal(parseOnboarding(form), null);
  }
  const form = answers();
  form.delete("invest");
  assert.equal(parseOnboarding(form), null);
});

test("client-provided reward and persona fields are ignored", () => {
  const form = answers();
  const expected = parseOnboarding(form);
  form.set("xp", "999999");
  form.set("pillarNeed", '{"budget":0}');
  form.set("onboarded_at", "2099-01-01");
  assert.deepEqual(parseOnboarding(form), expected);
});


test("profile updates accept only language and grade, ignoring protected fields", () => {
  const form = new FormData();
  form.set("language", "hi");
  form.set("grade", "11");
  form.set("id", "another-user");
  form.set("username", "changed-name");
  form.set("onboarded_at", "");
  form.set("xp", "100000");
  form.set("persona", "{}");
  assert.deepEqual(parseProfilePreferences(form), { language: "hi", grade: 11 });
  form.set("grade", "11junk");
  assert.equal(parseProfilePreferences(form), null);
  form.set("grade", "12");
  form.set("language", "fr");
  assert.equal(parseProfilePreferences(form), null);
  form.delete("language");
  assert.equal(parseProfilePreferences(form), null);
});
