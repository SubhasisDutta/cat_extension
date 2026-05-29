const T = window.CatTimer;

const els = {
  phase: document.querySelector("[data-phase]"),
  countdown: document.querySelector("[data-countdown]"),
  meta: document.querySelector("[data-meta]"),
  workInput: document.querySelector("[data-work-input]"),
  enabled: document.querySelector("[data-enabled]"),
  save: document.querySelector("[data-save]"),
  summon: document.querySelector("[data-summon]"),
};

let latest = null;

function paint() {
  if (!latest) return;
  const { settings, state, now } = latest;
  // Don't clobber a field the user is currently editing — paint() runs every
  // second from the local tick, so any keystroke would be overwritten before
  // Save lands. Only sync the input when it isn't focused.
  if (document.activeElement !== els.workInput) {
    els.workInput.value = T.clampWorkMinutes(settings.workMinutes);
  }
  if (document.activeElement !== els.enabled) {
    els.enabled.checked = !!settings.enabled;
  }

  // While a break is running the cat is summoned: the button reads
  // "I'm summoned" and is disabled, reverting to "Summon me now" once the
  // (fixed 5-minute) break completes. Driven by phase so it stays correct
  // across popup close/reopen and missed optimistic updates.
  const summoned = !!settings.enabled && state.phase === "break";
  els.summon.textContent = summoned ? "I'm summoned" : "Summon me now";
  els.summon.disabled = summoned;

  const remaining = T.remainingSeconds(state, now);
  if (!settings.enabled) {
    els.phase.textContent = "off duty";
    els.countdown.textContent = "--:--";
    els.meta.textContent = "I'm napping elsewhere.";
    return;
  }
  if (state.phase === "work") {
    els.phase.textContent = "working";
    els.countdown.textContent = T.formatMMSS(remaining);
    const hrs = T.continuousWorkHours(state.workStreakStartedAt, now);
    const w = T.weightStageForHours(hrs);
    els.meta.textContent = `I'm ${w.label} • ${hrs.toFixed(2)}h streak`;
  } else if (state.phase === "break") {
    els.phase.textContent = "break — sit there";
    els.countdown.textContent = T.formatMMSS(remaining);
    els.meta.textContent = "I'm on every tab. all of them.";
  } else {
    els.phase.textContent = "idle";
    els.countdown.textContent = "--:--";
    els.meta.textContent = "I'm between cycles.";
  }
}

async function refresh() {
  const resp = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  if (resp?.ok) {
    latest = { settings: resp.settings, state: resp.state, now: resp.now };
    paint();
  }
}

els.save.addEventListener("click", async () => {
  const v = T.clampWorkMinutes(els.workInput.value);
  els.save.textContent = "Saving";
  els.save.disabled = true;
  try {
    const resp = await chrome.runtime.sendMessage({
      type: "SET_WORK_MINUTES",
      value: v,
    });
    if (resp?.ok) {
      els.workInput.value = resp.settings.workMinutes;
      refresh();
    }
  } finally {
    els.save.textContent = "Save";
    els.save.disabled = false;
  }
});

els.enabled.addEventListener("change", async () => {
  await chrome.runtime.sendMessage({
    type: "SET_ENABLED",
    value: els.enabled.checked,
  });
  refresh();
});

els.summon.addEventListener("click", async () => {
  // Optimistic; paint() is the source of truth and keeps it in sync with the
  // actual phase, reverting to "Summon me now" when the break completes.
  els.summon.textContent = "I'm summoned";
  els.summon.disabled = true;
  await chrome.runtime.sendMessage({ type: "FORCE_BREAK" });
  refresh();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "CAT_STATE") {
    latest = { settings: msg.settings, state: msg.state, now: msg.now };
    paint();
  }
});

// Local 1Hz tick for smooth countdown in the popup.
setInterval(() => {
  if (!latest) return;
  latest = { ...latest, now: Date.now() };
  paint();
}, 1000);

refresh();
