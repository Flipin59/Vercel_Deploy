import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { NextRequest, NextResponse } = require("next/server");

function load(file: string, mocks: Record<string, unknown>) {
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  vm.runInNewContext(compiled, {
    exports, Headers, process: { env: {} }, console: { error() {} },
    require(name: string) {
      if (!Object.hasOwn(mocks, name)) throw new Error(`Unexpected dependency: ${name}`);
      return mocks[name];
    },
  });
  return exports;
}

test("duel polling authenticates without querying the onboarding profile", async () => {
  let lookups = 0;
  const proxy = load("src/proxy.ts", {
    "@supabase/ssr": { createServerClient: () => ({
      auth: { getUser: async () => ({ data: { user: { id: "me" } } }) },
      from: () => { lookups++; throw new Error("Profile service unavailable"); },
    }) },
    "next/server": { NextResponse },
    "@/features/auth/routing": { isPlacementRoute: () => false },
    "@/shared/supabase/config": { isSupabaseConfigured: () => true },
  }).proxy;
  const poll = await proxy(new NextRequest("http://localhost:3000/play/duel/duel-id/state")) as Response;
  assert.equal(lookups, 0);
  assert.equal(poll.headers.get("x-middleware-next"), "1");
  const page = await proxy(new NextRequest("http://localhost:3000/profile")) as Response;
  assert.equal(lookups, 1);
  assert.equal(page.headers.get("x-middleware-next"), "1");
});

test("returned onboarding errors degrade and confirmed incomplete profiles still redirect", async () => {
  let result = { data: null as { onboarded_at: string | null } | null, error: new Error("offline") as Error | null };
  const query = { select: () => query, eq: () => query, single: async () => result };
  const proxy = load("src/proxy.ts", {
    "@supabase/ssr": { createServerClient: () => ({
      auth: { getUser: async () => ({ data: { user: { id: "me" } } }) }, from: () => query,
    }) },
    "next/server": { NextResponse },
    "@/features/auth/routing": { isPlacementRoute: () => false },
    "@/shared/supabase/config": { isSupabaseConfigured: () => true },
  }).proxy;
  assert.equal((await proxy(new NextRequest("http://localhost:3000/dashboard")) as Response).status, 200);
  result = { data: { onboarded_at: null }, error: null };
  assert.equal((await proxy(new NextRequest("http://localhost:3000/dashboard")) as Response).headers.get("location"), "http://localhost:3000/onboarding");
});

test("duel polling still redirects an expired session to login", async () => {
  const proxy = load("src/proxy.ts", {
    "@supabase/ssr": { createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) },
    "next/server": { NextResponse },
    "@/features/auth/routing": { isPlacementRoute: () => false },
    "@/shared/supabase/config": { isSupabaseConfigured: () => true },
  }).proxy;
  assert.equal((await proxy(new NextRequest("http://localhost:3000/play/duel/duel-id/state")) as Response).headers.get("location"), "http://localhost:3000/login");
});

test("a failed progress RPC or service-role config leaves the app shell and children available", async () => {
  const Header = Symbol("Header");
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const layout = load("src/app/(app)/layout.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@/features/forum/server": { getPendingRequestCount: async () => { throw new Error("offline"); } },
    "next/headers": { headers: async () => new Headers() },
    "next/navigation": { redirect: () => assert.fail("Unexpected redirect") },
    "@/features/auth": { SignOutButton: Symbol("SignOutButton") },
    "@/shared/progress/date": { istDate: () => "2026-10-11" },
    "@/shared/progress": {
      recordActivity: async () => { throw new Error("Missing service role"); },
      getXpSummary: async () => { throw new Error("Summary unavailable"); },
    },
    "@/shared/session": { getCurrentProfile: async () => ({ id: "me", onboardedAt: "done" }) },
    "@/shared/ui/BottomNav": { BottomNav: Symbol("BottomNav") },
    "@/shared/ui/Header": { Header },
  }).default;
  const shell = await layout({ children: "Feature page" }) as { props: { children: { type: unknown; props: Record<string, unknown> }[] } };
  const header = shell.props.children[0];
  assert.equal(header.type, Header);
  assert.equal(header.props.title, undefined);
  assert.equal(header.props.coins, undefined);
  assert.equal(header.props.streakDays, undefined);
  assert.equal(header.props.pendingRequests, 0);
  assert.equal((shell.props.children[1].props.children as unknown[])[0], "Feature page");
});

test("migration versions are unique and ordered", () => {
  const versions = readdirSync("supabase/migrations").filter(f => f.endsWith(".sql")).map(f => f.split("_")[0]);
  assert.equal(new Set(versions).size, versions.length);
  assert.ok(versions.includes("20261011140001"));
});

test("active duel screens hide bottom nav while the lobby retains it", () => {
  let pathname = "/play/duel";
  const nav = load("src/shared/ui/BottomNav.tsx", {
    "react/jsx-runtime": { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) },
    "next/link": { default: Symbol("Link"), __esModule: true },
    "next/navigation": { usePathname: () => pathname },
    "@/shared/i18n": { useT: () => (key: string) => key },
    "@/shared/nav": { NAV_ITEMS: [], NO_NAV_PREFIXES: [], hasPrefix: () => false },
    "./messages/en.json": {}, "./messages/te.json": {}, "./messages/hi.json": {},
  }).BottomNav;
  assert.notEqual(nav(), null);
  pathname = "/play/duel/active-id";
  assert.equal(nav(), null);
});

test("auth and shared translation drafts preserve every key and substitution", () => {
  for (const directory of ["src/features/auth/messages", "src/shared/ui/messages"]) {
    const en = JSON.parse(readFileSync(`${directory}/en.json`, "utf8")) as Record<string, string>;
    for (const language of ["te", "hi"]) {
      const translated = JSON.parse(readFileSync(`${directory}/${language}.json`, "utf8")) as Record<string, string>;
      assert.deepEqual(Object.keys(translated).sort(), Object.keys(en).sort());
      for (const key of Object.keys(en)) {
        assert.deepEqual((translated[key].match(/\{[^}]+\}/g) ?? []).sort(), (en[key].match(/\{[^}]+\}/g) ?? []).sort(), `${language}: ${key}`);
      }
    }
  }
});
