// Injected into every tab. Renders the cat overlay during 'break' and
// silently no-ops during 'work'. Defends itself against DOM removal,
// keyboard close attempts, and Esc.

(function () {
  if (window.__catExtensionLoaded__) return;
  window.__catExtensionLoaded__ = true;

  const T = window.CatTimer;
  const ART = window.CatArt;
  const OVERLAY_ID = "cat-extension-overlay";

  let lastPayload = null;
  let tickInterval = null;
  let mutationObserver = null;
  let keyHandler = null;

  function buildOverlay() {
    const root = document.createElement("div");
    root.id = OVERLAY_ID;
    root.setAttribute("aria-modal", "true");
    root.setAttribute("role", "dialog");
    root.innerHTML = `
      <div class="cat-stage" aria-hidden="true">${ART.svgMarkup()}</div>
      <div class="cat-timer" data-timer>5:00</div>
      <div class="cat-label" data-label>break in progress</div>
      <div class="cat-quote" data-quote></div>
      <div class="cat-meta" data-meta></div>
    `;
    return root;
  }

  function ensureOverlay() {
    let el = document.getElementById(OVERLAY_ID);
    if (!el) {
      el = buildOverlay();
      document.documentElement.appendChild(el);
      installDefenses(el);
    }
    return el;
  }

  function removeOverlay() {
    uninstallDefenses();
    const el = document.getElementById(OVERLAY_ID);
    if (el) el.remove();
  }

  function installDefenses(el) {
    // Re-add the overlay if any script tries to remove it during a break.
    mutationObserver = new MutationObserver(() => {
      if (!lastPayload) return;
      if (lastPayload.state.phase !== "break") return;
      if (!document.getElementById(OVERLAY_ID)) {
        document.documentElement.appendChild(el);
      }
    });
    mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: false,
    });

    // Swallow Esc / Ctrl-W / Cmd-W / F11 inside the overlay scope.
    // (Browsers won't let extensions block top-level Cmd-W reliably, but
    // we block any in-page handlers and stop bubbling so site-level
    // shortcuts don't dismiss us.)
    keyHandler = (e) => {
      if (!lastPayload || lastPayload.state.phase !== "break") return;
      const blocked =
        e.key === "Escape" ||
        (e.key === "w" && (e.ctrlKey || e.metaKey)) ||
        e.key === "F11";
      if (blocked) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", keyHandler, true);
  }

  function uninstallDefenses() {
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    if (keyHandler) {
      window.removeEventListener("keydown", keyHandler, true);
      keyHandler = null;
    }
  }

  function render(payload) {
    lastPayload = payload;
    const { state, settings, now } = payload;

    if (!settings.enabled || state.phase !== "break") {
      removeOverlay();
      return;
    }

    const el = ensureOverlay();
    const breakSeconds = T.BREAK_MINUTES * 60;
    const remaining = T.remainingSeconds(state, now);
    const hours = T.continuousWorkHours(state.workStreakStartedAt, now);
    const weight = T.weightStageForHours(hours);
    const stretch = T.stretchFactor(remaining, breakSeconds);

    el.style.setProperty("--cat-size", `${Math.round(weight.sizeFactor * 100)}vmin`);
    el.style.setProperty("--cat-stretch", stretch.toFixed(2));

    // After the stretch window, switch on the breathing animation.
    const elapsed = breakSeconds - remaining;
    if (elapsed >= 13) el.classList.add("cat-comfortable");
    else el.classList.remove("cat-comfortable");

    el.querySelector("[data-timer]").textContent = T.formatMMSS(remaining);
    el.querySelector("[data-label]").textContent =
      `${weight.label} cat • ${hours.toFixed(1)}h streak`;
    el.querySelector("[data-quote]").textContent = ART.phraseForSecond(remaining);
    el.querySelector("[data-meta]").textContent =
      `next work block: ${T.clampWorkMinutes(settings.workMinutes)} min`;
  }

  // Re-render at 1Hz off the most recent payload, so the timer counts
  // down smoothly between background broadcasts.
  function startTick() {
    if (tickInterval) return;
    tickInterval = setInterval(() => {
      if (!lastPayload) return;
      render({ ...lastPayload, now: Date.now() });
    }, 1000);
  }

  startTick();

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "CAT_STATE") render(msg);
  });

  // On load, ask the worker for the current state so a freshly-opened tab
  // mid-break renders the cat immediately.
  chrome.runtime
    .sendMessage({ type: "GET_STATE" })
    .then((resp) => {
      if (resp?.ok) {
        render({
          type: "CAT_STATE",
          settings: resp.settings,
          state: resp.state,
          now: resp.now,
        });
      }
    })
    .catch(() => {});
})();
