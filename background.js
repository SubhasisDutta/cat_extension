// Service worker: owns the timer state, schedules alarms, and broadcasts
// the state to every tab so each content script can render the cat.

importScripts("lib/timer-logic.js");

const T = self.CatTimer;

const STORAGE_KEYS = {
  settings: "settings",
  state: "state",
};

const DEFAULT_SETTINGS = {
  workMinutes: T.DEFAULT_WORK_MINUTES,
  enabled: true,
};

const DEFAULT_STATE = {
  phase: "idle", // 'idle' | 'work' | 'break'
  phaseEndsAt: 0,
  workStreakStartedAt: null,
  breakStartedAt: null,
};

const ALARM_PHASE = "cat-phase-end";
const ALARM_TICK = "cat-tick";

async function getSettings() {
  const r = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(r[STORAGE_KEYS.settings] || {}) };
}

async function setSettings(patch) {
  const cur = await getSettings();
  const next = { ...cur, ...patch };
  if ("workMinutes" in patch) {
    next.workMinutes = T.clampWorkMinutes(patch.workMinutes);
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: next });
  return next;
}

async function getState() {
  const r = await chrome.storage.local.get(STORAGE_KEYS.state);
  return { ...DEFAULT_STATE, ...(r[STORAGE_KEYS.state] || {}) };
}

async function setState(next) {
  await chrome.storage.local.set({ [STORAGE_KEYS.state]: next });
  return next;
}

async function startWork() {
  const settings = await getSettings();
  const state = await getState();
  const now = Date.now();
  const next = T.advancePhase(
    { ...state, phase: "idle" },
    settings,
    now
  );
  await setState(next);
  await scheduleAlarms(next);
  await broadcast();
}

async function stopAll() {
  await chrome.alarms.clear(ALARM_PHASE);
  await chrome.alarms.clear(ALARM_TICK);
  await setState({ ...DEFAULT_STATE });
  await broadcast();
}

async function scheduleAlarms(state) {
  await chrome.alarms.clear(ALARM_PHASE);
  await chrome.alarms.clear(ALARM_TICK);
  if (state.phase === "idle") return;
  const whenMs = state.phaseEndsAt;
  chrome.alarms.create(ALARM_PHASE, { when: whenMs });
  // 1s tick alarm so we keep tabs in sync if they reload mid-break.
  chrome.alarms.create(ALARM_TICK, {
    when: Date.now() + 1000,
    periodInMinutes: 1 / 60,
  });
}

async function onPhaseEnd() {
  const settings = await getSettings();
  const state = await getState();
  const now = Date.now();
  const next = T.advancePhase(state, settings, now);
  await setState(next);
  await scheduleAlarms(next);
  await broadcast();
}

async function broadcast() {
  const settings = await getSettings();
  const state = await getState();
  const payload = { type: "CAT_STATE", settings, state, now: Date.now() };
  // Send to popup (best-effort).
  chrome.runtime.sendMessage(payload).catch(() => {});
  // Send to every tab.
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id == null) continue;
    chrome.tabs.sendMessage(tab.id, payload).catch(() => {});
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings();
  await setSettings(settings);
  if (settings.enabled) await startWork();
});

chrome.runtime.onStartup.addListener(async () => {
  const settings = await getSettings();
  if (settings.enabled) await startWork();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_PHASE) {
    await onPhaseEnd();
  } else if (alarm.name === ALARM_TICK) {
    await broadcast();
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "GET_STATE") {
        const settings = await getSettings();
        const state = await getState();
        sendResponse({ ok: true, settings, state, now: Date.now() });
        return;
      }
      if (msg?.type === "SET_WORK_MINUTES") {
        const settings = await setSettings({ workMinutes: msg.value });
        // If work phase already running, leave its end-time alone -
        // the new value applies to the next cycle. If idle, start fresh.
        const state = await getState();
        if (state.phase === "idle" && settings.enabled) await startWork();
        await broadcast();
        sendResponse({ ok: true, settings });
        return;
      }
      if (msg?.type === "SET_ENABLED") {
        const settings = await setSettings({ enabled: !!msg.value });
        if (settings.enabled) await startWork();
        else await stopAll();
        sendResponse({ ok: true, settings });
        return;
      }
      if (msg?.type === "FORCE_BREAK") {
        // Debug helper used by popup ("summon the cat now").
        const state = await getState();
        const settings = await getSettings();
        const now = Date.now();
        const next = T.advancePhase(
          { ...state, phase: "work" },
          settings,
          now
        );
        await setState(next);
        await scheduleAlarms(next);
        await broadcast();
        sendResponse({ ok: true });
        return;
      }
      sendResponse({ ok: false, error: "unknown message" });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true; // async
});

// When a new tab finishes loading, push current state so it can render
// the cat immediately if we're mid-break.
chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status !== "complete") return;
  const settings = await getSettings();
  const state = await getState();
  chrome.tabs
    .sendMessage(tabId, {
      type: "CAT_STATE",
      settings,
      state,
      now: Date.now(),
    })
    .catch(() => {});
});
