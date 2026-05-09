// Cat assets: inline SVG + personality phrases.
// Loaded as a content script before content.js.

(function (root) {
  // Annoyed, entitled, unbothered. Rotates through these on the overlay.
  const PHRASES = [
    "I don't care about your sprint.",
    "Your launch date is not my problem.",
    "Take the break. I'm not moving.",
    "Your boss doesn't pay me.",
    "Standup can wait. I cannot.",
    "Production is fine. Sit down.",
    "The deploy will hold. Breathe.",
    "I have been here longer than your codebase.",
    "Close the laptop. Pet the cat.",
    "You are not the main character. I am.",
  ];

  function phraseForSecond(sec) {
    return PHRASES[Math.abs(sec) % PHRASES.length];
  }

  // SVG of a fat orange cat. Uses currentColor + CSS vars so we can
  // stretch and recolor without redrawing.
  function svgMarkup() {
    return `
<svg viewBox="0 0 400 360" xmlns="http://www.w3.org/2000/svg" aria-label="A fat orange cat" role="img">
  <defs>
    <radialGradient id="bodyGrad" cx="50%" cy="55%" r="60%">
      <stop offset="0%" stop-color="#ffb86b"/>
      <stop offset="70%" stop-color="#ef8b2a"/>
      <stop offset="100%" stop-color="#c46410"/>
    </radialGradient>
    <radialGradient id="bellyGrad" cx="50%" cy="60%" r="50%">
      <stop offset="0%" stop-color="#ffe6c4"/>
      <stop offset="100%" stop-color="#f6c98b"/>
    </radialGradient>
  </defs>
  <!-- tail tucked behind body -->
  <path d="M340,260 q40,-20 30,-70 q-10,-40 -50,-30" fill="#c46410" stroke="#7a3a08" stroke-width="3"/>
  <!-- body (big oval) -->
  <ellipse cx="200" cy="240" rx="160" ry="100" fill="url(#bodyGrad)" stroke="#7a3a08" stroke-width="4"/>
  <!-- belly -->
  <ellipse cx="200" cy="265" rx="110" ry="70" fill="url(#bellyGrad)"/>
  <!-- stripes -->
  <path d="M90,210 q20,-15 40,0" fill="none" stroke="#7a3a08" stroke-width="3" stroke-linecap="round"/>
  <path d="M90,240 q20,-15 40,0" fill="none" stroke="#7a3a08" stroke-width="3" stroke-linecap="round"/>
  <path d="M270,210 q20,-15 40,0" fill="none" stroke="#7a3a08" stroke-width="3" stroke-linecap="round"/>
  <path d="M270,240 q20,-15 40,0" fill="none" stroke="#7a3a08" stroke-width="3" stroke-linecap="round"/>
  <!-- back legs (tucked) -->
  <ellipse cx="120" cy="320" rx="40" ry="18" fill="#c46410" stroke="#7a3a08" stroke-width="3"/>
  <ellipse cx="280" cy="320" rx="40" ry="18" fill="#c46410" stroke="#7a3a08" stroke-width="3"/>
  <!-- front paws -->
  <ellipse cx="160" cy="330" rx="22" ry="12" fill="#ef8b2a" stroke="#7a3a08" stroke-width="3"/>
  <ellipse cx="240" cy="330" rx="22" ry="12" fill="#ef8b2a" stroke="#7a3a08" stroke-width="3"/>
  <!-- head -->
  <ellipse cx="200" cy="130" rx="95" ry="80" fill="url(#bodyGrad)" stroke="#7a3a08" stroke-width="4"/>
  <!-- ears -->
  <polygon points="125,70 105,15 165,55" fill="#ef8b2a" stroke="#7a3a08" stroke-width="3"/>
  <polygon points="275,70 295,15 235,55" fill="#ef8b2a" stroke="#7a3a08" stroke-width="3"/>
  <polygon points="135,60 122,30 158,53" fill="#ffb1b1"/>
  <polygon points="265,60 278,30 242,53" fill="#ffb1b1"/>
  <!-- cheeks -->
  <ellipse cx="160" cy="160" rx="30" ry="22" fill="#ffd6a8"/>
  <ellipse cx="240" cy="160" rx="30" ry="22" fill="#ffd6a8"/>
  <!-- eyes (annoyed half-lids) -->
  <path d="M150,118 q15,-12 30,0" fill="none" stroke="#1f1f1f" stroke-width="5" stroke-linecap="round"/>
  <path d="M220,118 q15,-12 30,0" fill="none" stroke="#1f1f1f" stroke-width="5" stroke-linecap="round"/>
  <circle cx="165" cy="125" r="3" fill="#1f1f1f"/>
  <circle cx="235" cy="125" r="3" fill="#1f1f1f"/>
  <!-- nose -->
  <path d="M195,150 l10,0 l-5,8 z" fill="#7a3a08"/>
  <!-- mouth (flat, unimpressed) -->
  <path d="M180,170 q20,8 40,0" fill="none" stroke="#1f1f1f" stroke-width="3" stroke-linecap="round"/>
  <!-- whiskers -->
  <path d="M120,160 l-30,-5 M120,170 l-30,5 M280,160 l30,-5 M280,170 l30,5" stroke="#1f1f1f" stroke-width="2" stroke-linecap="round"/>
</svg>`;
  }

  const api = { PHRASES, phraseForSecond, svgMarkup };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.CatArt = api;
  }
})(typeof self !== "undefined" ? self : this);
