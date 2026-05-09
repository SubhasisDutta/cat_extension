#!/usr/bin/env node
// Tiny no-deps test runner. Discovers *.test.js in this folder, runs them,
// prints results, exits non-zero on any failure.

const fs = require("fs");
const path = require("path");

const tests = [];
const only = [];

global.test = (name, fn) => tests.push({ name, fn, only: false });
global.test.only = (name, fn) => {
  const t = { name, fn, only: true };
  tests.push(t);
  only.push(t);
};

global.assert = {
  eq(a, b, msg) {
    if (a !== b) {
      throw new Error(
        `assert.eq failed${msg ? " (" + msg + ")" : ""}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`
      );
    }
  },
  approx(a, b, eps = 1e-6, msg) {
    if (Math.abs(a - b) > eps) {
      throw new Error(
        `assert.approx failed${msg ? " (" + msg + ")" : ""}: |${a} - ${b}| > ${eps}`
      );
    }
  },
  truthy(v, msg) {
    if (!v) throw new Error(`assert.truthy failed${msg ? " (" + msg + ")" : ""}`);
  },
  throws(fn, msg) {
    let threw = false;
    try { fn(); } catch (_) { threw = true; }
    if (!threw) throw new Error(`assert.throws failed${msg ? " (" + msg + ")" : ""}`);
  },
};

const dir = __dirname;
for (const f of fs.readdirSync(dir)) {
  if (f.endsWith(".test.js")) require(path.join(dir, f));
}

const toRun = only.length ? only : tests;
let passed = 0;
let failed = 0;
const failures = [];

(async () => {
  for (const t of toRun) {
    try {
      await t.fn();
      passed++;
      console.log(`  ✓ ${t.name}`);
    } catch (e) {
      failed++;
      failures.push({ name: t.name, err: e });
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${e.message}`);
    }
  }
  console.log("");
  console.log(`${passed} passed, ${failed} failed (${tests.length} total)`);
  if (failed > 0) process.exit(1);
})();
