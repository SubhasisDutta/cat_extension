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
  // If we just entered break, force-inject everywhere first so the
  // broadcast that follows actually has someone to receive it.
  if (next.phase === "break") {
    await injectIntoAllTabs();
  }
  await broadcast();
}

// Pages where Chrome refuses content-script injection. Skip silently.
function canInject(url) {
  if (!url) return false;
  if (url.startsWith("chrome://")) return false;
  if (url.startsWith("chrome-extension://")) return false;
  if (url.startsWith("edge://")) return false;
  if (url.startsWith("about:")) return false;
  if (url.startsWith("view-source:")) return false;
  if (url.startsWith("https://chrome.google.com/webstore")) return false;
  if (url.startsWith("https://chromewebstore.google.com")) return false;
  return /^(https?|file|ftp):/.test(url);
}

// Idempotent (content.js guards on window.__catExtensionLoaded__).
// allFrames so the media-pause path in content.js also fires inside
// embedded players (YouTube/Vimeo iframes etc.). The overlay still renders
// in the top frame only — content.js gates on window.top === window.self.
async function ensureInjected(tabId) {
  try {
    await chrome.scripting.insertCSS({
      target: { tabId, allFrames: true },
      files: ["overlay.css"],
    });
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["lib/timer-logic.js", "cat.js", "content.js"],
    });
    return true;
  } catch (_e) {
    return false;
  }
}

// Force-inject the cat into every tab on every window. Called when a break
// starts so tabs that were open before install (or reloaded before the
// manifest content_script took effect) still get the overlay.
async function injectIntoAllTabs() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id == null || !canInject(tab.url)) return;
      await ensureInjected(tab.id);
    })
  );
}

async function broadcast() {
  const settings = await getSettings();
  const state = await getState();
  const payload = { type: "CAT_STATE", settings, state, now: Date.now() };
  // Send to popup (best-effort).
  chrome.runtime.sendMessage(payload).catch(() => {});
  // Send to every tab. If sendMessage fails (no listener), inject and retry.
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id == null) return;
      try {
        await chrome.tabs.sendMessage(tab.id, payload);
      } catch (_e) {
        if (state.phase !== "break") return; // only force-inject for breaks
        if (!canInject(tab.url)) return;
        const ok = await ensureInjected(tab.id);
        if (ok) {
          chrome.tabs.sendMessage(tab.id, payload).catch(() => {});
        }
      }
    })
  );
}

async function bootstrap() {
  const settings = await getSettings();
  await setSettings(settings);
  const state = await getState();
  // If we woke up mid-break, make sure every tab actually has the overlay.
  if (state.phase === "break" && state.phaseEndsAt > Date.now()) {
    await injectIntoAllTabs();
    await broadcast();
    return;
  }
  if (settings.enabled) await startWork();
}

chrome.runtime.onInstalled.addListener(bootstrap);
chrome.runtime.onStartup.addListener(bootstrap);

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
        if (next.phase === "break") await injectIntoAllTabs();
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
