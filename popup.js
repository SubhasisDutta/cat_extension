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

  const remaining = T.remainingSeconds(state, now);
  if (!settings.enabled) {
    els.phase.textContent = "off duty";
    els.countdown.textContent = "--:--";
    els.meta.textContent = "the cat is napping elsewhere";
    return;
  }
  if (state.phase === "work") {
    els.phase.textContent = "working";
    els.countdown.textContent = T.formatMMSS(remaining);
    const hrs = T.continuousWorkHours(state.workStreakStartedAt, now);
    const w = T.weightStageForHours(hrs);
    els.meta.textContent = `${w.label} cat • ${hrs.toFixed(2)}h streak`;
  } else if (state.phase === "break") {
    els.phase.textContent = "break — sit there";
    els.countdown.textContent = T.formatMMSS(remaining);
    els.meta.textContent = "he is on every tab. all of them.";
  } else {
    els.phase.textContent = "idle";
    els.countdown.textContent = "--:--";
    els.meta.textContent = "no cycle running";
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
  const resp = await chrome.runtime.sendMessage({
    type: "SET_WORK_MINUTES",
    value: v,
  });
  if (resp?.ok) {
    els.workInput.value = resp.settings.workMinutes;
    refresh();
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
