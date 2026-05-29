// Injected into every tab (and every frame). The top frame renders the cat
// overlay during 'break' and a heads-up toast in the last 30 seconds of
// 'work'; subframes only handle media pause/resume. Defends itself against
// DOM removal, key/scroll close attempts, and Esc.

(function () {
  if (window.__catExtensionLoaded__) return;
  window.__catExtensionLoaded__ = true;

  const T = window.CatTimer;
  const ART = window.CatArt;
  const OVERLAY_ID = "cat-extension-overlay";
  const WARNING_ID = "cat-extension-warning";
  // The overlay belongs to the top frame only — otherwise every iframe on the
  // page would stack its own copy. Media pause runs in every frame so that
  // YouTube/Vimeo embeds also stop during the break.
  const isTopFrame = window.top === window.self;

  let lastPayload = null;
  let tickInterval = null;
  let mutationObserver = null;
  let keyHandler = null;
  let blockHandler = null;
  let savedHtmlOverflow = null;
  let savedBodyOverflow = null;
  // Track only the media we paused, so resume restores playback without
  // un-pausing things the user had already paused or media that started
  // mid-break.
  let localPaused = false;
  let pausedEls = [];

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
      lockScroll();
    }
    return el;
  }

  function removeOverlay() {
    uninstallDefenses();
    unlockScroll();
    const el = document.getElementById(OVERLAY_ID);
    if (el) el.remove();
  }

  function lockScroll() {
    if (savedHtmlOverflow !== null) return;
    savedHtmlOverflow = document.documentElement.style.overflow || "";
    savedBodyOverflow = document.body ? document.body.style.overflow || "" : "";
    document.documentElement.style.overflow = "hidden";
    if (document.body) document.body.style.overflow = "hidden";
  }

  function unlockScroll() {
    if (savedHtmlOverflow === null) return;
    document.documentElement.style.overflow = savedHtmlOverflow;
    if (document.body) document.body.style.overflow = savedBodyOverflow || "";
    savedHtmlOverflow = null;
    savedBodyOverflow = null;
  }

  function installDefenses(el) {
    // Re-attach the overlay if any script tries to remove it during a break.
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

    // Block scroll / wheel / touch / context-menu so the user can't
    // interact with the page underneath.
    blockHandler = (e) => {
      if (!lastPayload || lastPayload.state.phase !== "break") return;
      const overlay = document.getElementById(OVERLAY_ID);
      if (overlay && e.target && overlay.contains(e.target)) return;
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
    };
    const opts = { capture: true, passive: false };
    window.addEventListener("wheel", blockHandler, opts);
    window.addEventListener("touchmove", blockHandler, opts);
    window.addEventListener("contextmenu", blockHandler, opts);
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
    if (blockHandler) {
      const opts = { capture: true };
      window.removeEventListener("wheel", blockHandler, opts);
      window.removeEventListener("touchmove", blockHandler, opts);
      window.removeEventListener("contextmenu", blockHandler, opts);
      blockHandler = null;
    }
  }

  function pauseMediaForBreak() {
    if (localPaused) return;
    const media = document.querySelectorAll("video, audio");
    pausedEls = [];
    media.forEach((el) => {
      if (!el.paused && !el.ended) {
        try {
          el.pause();
          pausedEls.push(el);
        } catch (_) {}
      }
    });
    localPaused = true;
  }

  function resumeMediaAfterBreak() {
    if (!localPaused) return;
    pausedEls.forEach((el) => {
      const p = el.play();
      // Autoplay policies / element removal can reject; swallow — there's
      // nothing useful to do beyond not crashing the content script.
      if (p && typeof p.catch === "function") p.catch(() => {});
    });
    pausedEls = [];
    localPaused = false;
  }

  function ensureWarning() {
    let el = document.getElementById(WARNING_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = WARNING_ID;
      el.innerHTML = `
        <span class="cat-warn-pulse"></span>
        <span class="cat-warn-title">FAT CAT INCOMING</span>
        <span class="cat-warn-time" data-warn-time>0:30</span>
      `;
      document.documentElement.appendChild(el);
    }
    return el;
  }

  function removeWarning() {
    const el = document.getElementById(WARNING_ID);
    if (el) el.remove();
  }

  function render(payload) {
    lastPayload = payload;
    const { state, settings, now } = payload;

    // Media pause runs in every frame; the UI work below is top-frame only.
    // Unconditional during break — there's no useful state where the cat is
    // covering the tab but the user still wants audio bleeding through a UI
    // they can't reach.
    if (settings.enabled && state.phase === "break") pauseMediaForBreak();
    else resumeMediaAfterBreak();

    if (!isTopFrame) return;

    if (!settings.enabled || state.phase === "idle") {
      removeOverlay();
      removeWarning();
      return;
    }

    if (state.phase === "work") {
      removeOverlay();
      if (T.shouldWarn(state, now)) {
        const el = ensureWarning();
        el.querySelector("[data-warn-time]").textContent = T.formatMMSS(
          T.remainingSeconds(state, now)
        );
      } else {
        removeWarning();
      }
      return;
    }

    // phase === 'break'
    removeWarning();
    const el = ensureOverlay();
    const breakSeconds = T.BREAK_MINUTES * 60;
    const remaining = T.remainingSeconds(state, now);
    const hours = T.continuousWorkHours(state.workStreakStartedAt, now);
    const weight = T.weightStageForHours(hours);
    const stretch = T.stretchFactor(remaining, breakSeconds);

    el.style.setProperty(
      "--cat-size",
      `${Math.round(weight.sizeFactor * 100)}vmin`
    );
    el.style.setProperty("--cat-stretch", stretch.toFixed(2));

    const elapsed = breakSeconds - remaining;
    if (elapsed >= 13) el.classList.add("cat-comfortable");
    else el.classList.remove("cat-comfortable");

    el.querySelector("[data-timer]").textContent = T.formatMMSS(remaining);
    el.querySelector("[data-label]").textContent =
      `${weight.label} cat • ${hours.toFixed(1)}h streak`;
    el.querySelector("[data-quote]").textContent =
      ART.phraseForSecond(remaining);
    el.querySelector("[data-meta]").textContent =
      `next work block: ${T.clampWorkMinutes(settings.workMinutes)} min`;
  }

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
