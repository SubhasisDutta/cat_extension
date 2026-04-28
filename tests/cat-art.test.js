const ART = require("../cat.js");

test("phraseForSecond is deterministic and bounded", () => {
  for (let s = 0; s < 600; s++) {
    const p = ART.phraseForSecond(s);
    assert.truthy(typeof p === "string" && p.length > 0);
  }
  assert.eq(ART.phraseForSecond(0), ART.phraseForSecond(ART.PHRASES.length));
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
