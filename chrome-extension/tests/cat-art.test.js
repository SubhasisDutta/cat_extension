const ART = require("../cat.js");

test("phraseForSecond is deterministic and bounded", () => {
  for (let s = 0; s < 600; s++) {
    const p = ART.phraseForSecond(s);
    assert.truthy(typeof p === "string" && p.length > 0);
  }
  // The schedule repeats every full cycle, not every PHRASES.length seconds.
  assert.eq(
    ART.phraseForSecond(0),
    ART.phraseForSecond(ART.PHRASE_CYCLE_SECONDS)
  );
});

test("phraseForSecond holds each phrase for a readable span (no per-second flip)", () => {
  // The bug this fixes: the phrase must not change every second.
  assert.eq(ART.phraseForSecond(0), ART.phraseForSecond(1));
  // Every dwell sits inside the readable clamp.
  for (const p of ART.PHRASES) {
    const d = ART.phraseDwellSeconds(p);
    assert.truthy(d >= 4 && d <= 8, `dwell ${d}s out of range for: ${p}`);
  }
  // Across one full cycle the phrase advances exactly once per phrase
  // (PHRASES.length transitions), not once per second.
  let changes = 0;
  for (let s = 1; s <= ART.PHRASE_CYCLE_SECONDS; s++) {
    if (ART.phraseForSecond(s) !== ART.phraseForSecond(s - 1)) changes++;
  }
  assert.eq(changes, ART.PHRASES.length);
});

test("phraseForSecond handles negative seconds", () => {
  assert.eq(ART.phraseForSecond(-3), ART.phraseForSecond(3));
});

test("svgMarkup contains an svg root and the orange palette", () => {
  const svg = ART.svgMarkup();
  assert.truthy(svg.includes("<svg"));
  assert.truthy(svg.includes("</svg>"));
  // Orange-y stops we depend on for the "fat orange cat" vibe.
  assert.truthy(svg.includes("#ef8b2a"));
});

test("personality phrases stay on-brand (no apologies)", () => {
  for (const p of ART.PHRASES) {
    const lower = p.toLowerCase();
    assert.truthy(!lower.includes("sorry"), `apology in: ${p}`);
    assert.truthy(!lower.includes("please"), `politeness in: ${p}`);
  }
});
