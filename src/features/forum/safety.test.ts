import assert from "node:assert/strict";
import test from "node:test";
import { checkSafety, isSafeContent } from "./safety.ts";

test("checkSafety permits normal safe financial questions", () => {
  const safeSamples = [
    "How does a compound interest formula work for fixed deposits?",
    "What is the difference between UPI and IMPS?",
    "Can a 17-year-old student open a bank account in Hyderabad?",
    "Should I allocate 50% to needs and 30% to wants?",
    "Is gold ETF better than physical gold?",
    "Split ₹5000 as 2500, 1500 and 1000",
    "My account number is 1234567890", // not a mobile number (starts with 1)
    "Saved 60000 in 2025-2026",
  ];

  for (const sample of safeSamples) {
    assert.deepEqual(checkSafety(sample), { safe: true });
    assert.equal(isSafeContent(sample), true);
  }
});

test("checkSafety blocks email addresses", () => {
  const emailSamples = [
    "Contact me at student123@gmail.com for notes",
    "Send queries to support@scam-alert.org immediately",
    "My email is rahul.sharma@outlook.co.in",
  ];

  for (const sample of emailSamples) {
    assert.deepEqual(checkSafety(sample), { safe: false, violation: "email" });
    assert.equal(isSafeContent(sample), false);
  }
});

test("checkSafety blocks Indian and standard phone numbers", () => {
  const phoneSamples = [
    "Call me on 9876543210 for more info",
    "WhatsApp at +91 9876543210 for quick response",
    "+91-9123456789 is my number",
    "Call 8123456789 urgently",
    "Dial 9 8 7 6 5 4 3 2 1 0",
    "Ping me at 98765 43210",
    "My number: 98765-43210",
    "Try 987.654.3210 after school",
    "Landline style 0 98765 43210",
    "+91 98-765-43-210",
  ];

  for (const sample of phoneSamples) {
    assert.deepEqual(checkSafety(sample), { safe: false, violation: "phone" });
    assert.equal(isSafeContent(sample), false);
  }
});

test("isSafeContent handles multiple texts simultaneously", () => {
  assert.equal(isSafeContent("Valid title", "Valid content", "budget"), true);
  assert.equal(isSafeContent("Valid title", "Call me at 9876543210", "budget"), false);
  assert.equal(isSafeContent("Email me at rahul@test.com", "Valid content"), false);
});
