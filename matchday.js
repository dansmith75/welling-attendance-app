const MATCHDAY_STORAGE_KEY = "welling-red-matchday-v3";
const MATCHDAY_STARTERS = 11;
const MATCHDAY_AUTOSAVE_MS = 3 * 60 * 1000;
const MATCHDAY_SAFETY_SECONDS = 180 * 60;

const md = {
  open: document.getElementById("open-matchday"),
  view: document.getElementById("matchday-view"),
  close: document.getElementById("close-matchday"),
  setup: document.getElementById("matchday-setup"),
  live: document.getElementById("matchday-live"),
  finished: document.getElementById("matchday-finished"),
  fixture: document.getElementById("matchday-fixture"),
  fixtureMeta: document.getElementById("matchday-fixture-meta"),
  starterList: document.getElementById("matchday-starter-list"),
  starterCount: document.getElementById("matchday-starter-count"),
  squadCount: document.getElementById("matchday-auto-squad-count"),
  start: document.getElementById("matchday-start"),
  liveFixture: document.getElementById("matchday-live-fixture"),
  clock: document.getElementById("matchday-clock"),
  clockState: document.getElementById("matchday-clock-state"),
  pause: document.getElementById("matchday-pause"),
  resume: document.getElementById("matchday-resume"),
  lineup: document.getElementById("matchday-lineup"),
  subOff: document.getElementById("matchday-sub-off"),
  subOn: document.getElementById("matchday-sub-on"),
  subMinute: document.getElementById("matchday-sub-minute"),
  addSub: document.getElementById("matchday-add-sub"),
  subList: document.getElementById("matchday-sub-list"),
  goalPlayer: document.getElementById("matchday-goal-player"),
  goalType: document.getElementById("matchday-goal-type"),
  goalAssist: document.getElementById("matchday-goal-assist"),
  assistLabel: document.getElementById("matchday-assist-label"),
  goalMinute: document.getElementById("matchday-goal-minute"),
  addGoal: document.getElementById("matchday-add-goal"),
  eventPlayer: document.getElementById("matchday-card-player"),
  eventType: document.getElementById("matchday-card-type"),
  eventMinute: document.getElementById("matchday-card-minute"),
  addEvent: document.getElementById("matchday-add-card"),
  legacyEventList: document.getElementById("matchday-event-list"),
  fullTime: document.getElementById("matchday-fulltime"),
  finishedFixture: document.getElementById("matchday-finished-fixture"),
  finishedClock: document.getElementById("matchday-finished-clock"),
  minutesList: document.getElementById("matchday-minutes-list"),
  saveStatus: document.getElementById("matchday-save-status"),
  reset: document.getElementById("matchday-reset")
};

let matchdayFixtures = [];
let matchdayPlayers = [];
let timerHandle = null;
let autosaveHandle = null;
let autosaveBusy = false;

function emptyMatchdayState() {
  return {
    fixtureId: null,
    squadIds: [],
    starterIds: [],
    lineupIds: [],
    status: "setup",
    accumulatedSeconds: 0,
    lastResumeEpoch: null,
    substitutions: [],
    events: [],
    intervals: {},
    startedAt: null,
    finishedAt: null,
    submittedBy: null,
    supabaseId: null,
    recoveryId: null,
    safetyStopTriggered: false
  };
}

function loadMatchdayState() {
  try {
    const raw = localStorage.getItem(MATCHDAY_STORAGE_KEY);
    return raw ? { ...emptyMatchdayState(), ...JSON.parse(raw) } : emptyMatchdayState();
  } catch {
    return emptyMatchdayState();
  }
}

let state = loadMatchdayState();
const saveState = () => localStorage.setItem(MATCHDAY_STORAGE_KEY, JSON.stringify(state));
const player = id => matchdayPlayers.find(p => p.id === id);
const playerName = id => player(id)?.displayName || id;
const playerPosition = id => String(player(id)?.position || "").toUpperCase();
const fixture = () => matchdayFixtures.find(f => f.id === state.fixtureId) || null;

function positionGroup(pos) {
  const p = String(pos || "").toUpperCase();
  if (p === "GK") return "Goalkeeper";
  if (["CB", "LB", "RB", "LWB", "RWB", "DF", "DEF"].includes(p)) return "Defence";
  if (["CDM", "DM", "CM", "CAM", "AM", "LM", "RM", "MF", "MID"].includes(p)) return "Midfield";
  if (["LW", "RW", "CF", "ST", "FW", "FWD"].includes(p)) return "Attack";
  return "Other";
}

function elapsedSeconds() {
  let seconds = Number(state.accumulatedSeconds || 0);
  if (state.status === "running" && state.lastResumeEpoch) {
    seconds += (Date.now() - state.lastResumeEpoch) / 1000;
  }
  return Math.max(0, seconds);
}

const matchMinute = () => Math.floor(elapsedSeconds() / 60);
function formatClock(seconds) {
  if (Number(seconds || 0) > MATCHDAY_SAFETY_SECONDS) return "180:00+";
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function attendanceSquadIds() {
  if (typeof players === "undefined" || typeof getPlayerStatusForCurrentSession !== "function") return [];
  return players.filter(p => ["Present", "Late"].includes(getPlayerStatusForCurrentSession(p.id))).map(p => p.id);
}

function syncSetupSquad() {
  state.squadIds = attendanceSquadIds();
  state.starterIds = state.starterIds.filter(id => state.squadIds.includes(id));
  saveState();
}

function syncLateArrivals() {
  if (!["running", "paused"].includes(state.status)) return;
  let changed = false;
  attendanceSquadIds().forEach(id => {
    if (!state.squadIds.includes(id) && state.squadIds.length < 16) {
      state.squadIds.push(id);
      changed = true;
    }
  });
  if (changed) saveState();
}

function labelFixture(f) {
  return `${f.date} · ${f.opposition}${f.competition ? ` · ${f.competition}` : ""}`;
}

function updateLaunch() {
  const selected = document.querySelector('input[name="session-type"]:checked');
  md.open?.classList.toggle("hidden", !(selected && selected.value === "Match"));
}

function fillSelect(select, ids, blankText = null) {
  if (!select) return;
  const previous = select.value;
  select.innerHTML = "";
  if (blankText !== null) {
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = blankText;
    select.appendChild(blank);
  }
  ids.forEach(id => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = playerName(id);
    select.appendChild(option);
  });
  if ([...select.options].some(o => o.value === previous)) select.value = previous;
}

function buildV3Ui() {
  md.open.textContent = "Matchday";
  md.pause.classList.add("matchday-halftime-button");
  md.fullTime.className = "matchday-fulltime-button matchday-wide";

  const subSection = md.subList.closest(".matchday-live-section");
  const eventSection = md.legacyEventList.closest(".matchday-live-section");
  subSection?.querySelector("h3")?.classList.add("matchday-divider-title");
  eventSection?.querySelector("h3")?.classList.add("matchday-divider-title");
  md.lineup.closest(".matchday-live-section")?.querySelector("h3")?.classList.add("matchday-divider-title");

  const goalCard = md.goalPlayer.closest(".matchday-event-card");
  const eventCard = md.eventPlayer.closest(".matchday-event-card");
  goalCard.querySelector("strong").textContent = "Goal";
  eventCard.querySelector("strong").textContent = "Player Event";

  md.eventType.innerHTML = `
    <option value="Yellow">Yellow Card</option>
    <option value="Red">Red Card</option>
    <option value="Sin Bin">Sin Bin</option>
    <option value="Event">Event</option>`;

  const eventTextLabel = document.createElement("label");
  eventTextLabel.id = "matchday-player-event-text-label";
  eventTextLabel.className = "hidden";
  eventTextLabel.innerHTML = `Event<input id="matchday-player-event-text" class="matchday-input" type="text" placeholder="What happened?" />`;
  md.eventMinute.closest(".matchday-event-grid").insertBefore(eventTextLabel, md.eventMinute.closest("label"));

  md.addSub.textContent = "✓";
  md.addSub.title = "Record substitution";
  md.addSub.className = "matchday-tick-button";
  subSection.querySelector(".matchday-sub-grid").appendChild(md.addSub);

  md.addGoal.textContent = "✓";
  md.addGoal.title = "Record goal";
  md.addGoal.className = "matchday-tick-button";
  goalCard.querySelector(".matchday-event-grid").appendChild(md.addGoal);

  md.addEvent.textContent = "✓";
  md.addEvent.title = "Record player event";
  md.addEvent.className = "matchday-tick-button";
  eventCard.querySelector(".matchday-event-grid").appendChild(md.addEvent);

  md.goalList = document.createElement("div");
  md.goalList.className = "matchday-event-list";
  goalCard.appendChild(md.goalList);
  md.playerEventList = document.createElement("div");
  md.playerEventList.className = "matchday-event-list";
  eventCard.appendChild(md.playerEventList);
  md.legacyEventList.classList.add("hidden");

  let cancel = document.getElementById("matchday-cancel");
  if (!cancel) {
    cancel = document.createElement("button");
    cancel.id = "matchday-cancel";
    cancel.type = "button";
    cancel.textContent = "Cancel Matchday";
  }
  cancel.className = "danger-button matchday-wide matchday-cancel-bottom";
  md.live.appendChild(cancel);
  md.cancel = cancel;

  const overlay = document.createElement("div");
  overlay.id = "matchday-correction-overlay";
  overlay.className = "matchday-correction-overlay hidden";
  overlay.innerHTML = `<div class="matchday-correction-dialog">
    <strong id="matchday-correction-title">Recorded item</strong>
    <button id="matchday-correction-edit" class="secondary-button" type="button">Edit</button>
    <button id="matchday-correction-delete" class="danger-button" type="button">Delete</button>
    <button id="matchday-correction-cancel" class="small-button" type="button">Cancel</button>
  </div>`;
  document.body.appendChild(overlay);
  md.correctionOverlay = overlay;
  md.correctionTitle = document.getElementById("matchday-correction-title");
  md.correctionEdit = document.getElementById("matchday-correction-edit");
  md.correctionDelete = document.getElementById("matchday-correction-delete");
  md.correctionCancel = document.getElementById("matchday-correction-cancel");
}

function renderFixtures() {
  md.fixture.innerHTML = "";
  matchdayFixtures.forEach(f => {
    const option = document.createElement("option");
    option.value = f.id;
    option.textContent = labelFixture(f);
    md.fixture.appendChild(option);
  });
  if (!state.fixtureId && matchdayFixtures.length) {
    const today = new Date().toISOString().slice(0, 10);
    state.fixtureId = (matchdayFixtures.find(f => f.date >= today) || matchdayFixtures[0]).id;
  }
  md.fixture.value = state.fixtureId || "";
  const f = fixture();
  md.fixtureMeta.textContent = f ? `${f.competition || "Competition TBC"} · ${f.venue || "Venue TBC"}` : "Select a fixture.";
  saveState();
}

function toggleStarter(id) {
  if (state.starterIds.includes(id)) {
    state.starterIds = state.starterIds.filter(x => x !== id);
  } else {
    if (state.starterIds.length >= MATCHDAY_STARTERS) return window.alert("Starting lineup is limited to 11 players.");
    state.starterIds.push(id);
  }
  saveState();
  renderStarters();
}

function renderStarters() {
  md.starterList.innerHTML = "";
  const squad = matchdayPlayers.filter(p => state.squadIds.includes(p.id));
  md.squadCount.textContent = `${squad.length} player${squad.length === 1 ? "" : "s"} from Attendance`;
  md.starterCount.textContent = `${state.starterIds.length} selected`;
  squad.forEach(p => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `matchday-player-choice${state.starterIds.includes(p.id) ? " selected" : ""}`;
    button.textContent = p.position ? `${p.displayName} · ${p.position}` : p.displayName;
    button.addEventListener("click", () => toggleStarter(p.id));
    md.starterList.appendChild(button);
  });
}

function renderSetup() {
  syncSetupSquad();
  renderFixtures();
  renderStarters();
}

function openInterval(id, second) {
  state.intervals[id] ||= [];
  state.intervals[id].push({ start: second, end: null });
}

function closeInterval(id, second) {
  const current = [...(state.intervals[id] || [])].reverse().find(i => i.end === null);
  if (!current || second < current.start) return false;
  current.end = second;
  return true;
}

function startMatch() {
  syncSetupSquad();
  if (!fixture()) return window.alert("Select a fixture first.");
  if (!state.squadIds.length) return window.alert("Mark the match squad Present or Late first.");
  if (!state.starterIds.length) return window.alert("Select at least one starter.");
  if (state.starterIds.length > 11) return window.alert("Starting lineup is limited to 11 players.");
  if (state.starterIds.length < 11 && !window.confirm(`You have selected ${state.starterIds.length} starters. Start anyway?`)) return;

  const now = Date.now();
  state = {
    ...state,
    status: "running",
    accumulatedSeconds: 0,
    lastResumeEpoch: now,
    startedAt: new Date(now).toISOString(),
    finishedAt: null,
    substitutions: [],
    events: [],
    lineupIds: [...state.starterIds],
    intervals: {},
    submittedBy: typeof getCurrentUserName === "function" ? getCurrentUserName() : "Unknown",
    supabaseId: null,
    recoveryId: null,
    safetyStopTriggered: false
  };
  state.starterIds.forEach(id => openInterval(id, 0));
  saveState();
  renderMatchday();
  startTicker();
  startAutosave();
  saveRecovery("kickoff");
}

function pauseMatch() {
  if (state.status !== "running") return;
  state.accumulatedSeconds = elapsedSeconds();
  state.lastResumeEpoch = null;
  state.status = "paused";
  saveState();
  stopTicker();
  renderLive();
  saveRecovery("pause");
}

function resumeMatch() {
  if (state.status !== "paused") return;
  state.status = "running";
  state.lastResumeEpoch = Date.now();
  saveState();
  renderLive();
  startTicker();
  startAutosave();
}

function renderLineup() {
  md.lineup.innerHTML = "";
  const groups = ["Goalkeeper", "Defence", "Midfield", "Attack", "Other"];
  const flat = document.createElement("div");
  flat.className = "matchday-position-chips-flat";
  groups.forEach(group => {
    const ids = state.lineupIds.filter(id => positionGroup(playerPosition(id)) === group);
    if (!ids.length) return;
    const run = document.createElement("span");
    run.className = "matchday-pos-run";
    ids.forEach(id => {
      const chip = document.createElement("span");
      chip.className = `matchday-lineup-chip position-${group.toLowerCase()}`;
      chip.textContent = playerPosition(id) ? `${playerName(id)} · ${playerPosition(id)}` : playerName(id);
      run.appendChild(chip);
    });
    flat.appendChild(run);
  });
  md.lineup.appendChild(flat);
}

function renderControls() {
  syncLateArrivals();
  fillSelect(md.subOff, state.lineupIds);
  fillSelect(md.subOn, state.squadIds.filter(id => !state.lineupIds.includes(id)));
  fillSelect(md.goalPlayer, state.squadIds);
  fillSelect(md.eventPlayer, state.squadIds);
  fillSelect(md.goalAssist, state.squadIds.filter(id => id !== md.goalPlayer.value), "No assist / unknown");
  const openPlay = md.goalType.value === "Open Play";
  md.assistLabel.classList.toggle("hidden", !openPlay);
  if (!openPlay) md.goalAssist.value = "";
  document.getElementById("matchday-player-event-text-label")?.classList.toggle("hidden", md.eventType.value !== "Event");
  if (document.activeElement !== md.subMinute) md.subMinute.value = matchMinute();
  if (document.activeElement !== md.goalMinute) md.goalMinute.value = matchMinute();
  if (document.activeElement !== md.eventMinute) md.eventMinute.value = matchMinute();
}

function addSubstitution() {
  syncLateArrivals();
  const off = md.subOff.value;
  const on = md.subOn.value;
  if (!off || !on || off === on) return window.alert("Choose a player off and a different player on.");
  const minute = Math.max(0, Math.floor(Number(md.subMinute.value) || matchMinute()));
  const second = Math.min(minute * 60, elapsedSeconds());
  if (!closeInterval(off, second)) return window.alert("That substitution minute is before this player's current spell.");
  openInterval(on, second);
  state.lineupIds = state.lineupIds.filter(id => id !== off);
  state.lineupIds.push(on);
  state.substitutions.push({ minute: Math.floor(second / 60), second: Math.round(second), off, on });
  saveState();
  renderLive();
  saveRecovery("substitution");
}

function addGoal() {
  syncLateArrivals();
  const scorer = md.goalPlayer.value;
  if (!scorer) return window.alert("Choose the goal scorer.");
  const goalType = md.goalType.value;
  const event = { type: "Goal", playerId: scorer, minute: Math.max(0, Math.floor(Number(md.goalMinute.value) || matchMinute())), goalType };
  if (goalType === "Open Play" && md.goalAssist.value) event.assistPlayerId = md.goalAssist.value;
  state.events.push(event);
  saveState();
  renderLive();
  saveRecovery("goal");
}

function addPlayerEvent() {
  syncLateArrivals();
  const playerId = md.eventPlayer.value;
  if (!playerId) return window.alert("Choose the player.");
  const minute = Math.max(0, Math.floor(Number(md.eventMinute.value) || matchMinute()));
  if (md.eventType.value === "Event") {
    const input = document.getElementById("matchday-player-event-text");
    const text = input.value.trim();
    if (!text) return window.alert("Enter the event text.");
    state.events.push({ type: "Note", playerId, minute, text });
    input.value = "";
  } else {
    state.events.push({ type: "Card", playerId, minute, cardType: md.eventType.value });
  }
  saveState();
  renderLive();
  saveRecovery("player-event");
}

let correctionAction = null;
function openCorrection(title, editFn, deleteFn) {
  md.correctionTitle.textContent = title;
  correctionAction = { editFn, deleteFn };
  md.correctionOverlay.classList.remove("hidden");
}
function closeCorrection() {
  md.correctionOverlay.classList.add("hidden");
  correctionAction = null;
}
function spanner(title, editFn, deleteFn) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "matchday-spanner";
  button.textContent = "🔧";
  button.addEventListener("click", () => openCorrection(title, editFn, deleteFn));
  return button;
}

function askMinute(current) {
  const value = window.prompt("Minute", String(current ?? 0));
  if (value === null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    window.alert("Enter a valid minute.");
    return undefined;
  }
  return Math.floor(number);
}
function askPlayer(current, label) {
  const names = state.squadIds.map(id => playerName(id)).join(", ");
  const value = window.prompt(`${label}\n\nSquad: ${names}`, playerName(current));
  if (value === null) return null;
  const id = state.squadIds.find(x => playerName(x).toLowerCase() === value.trim().toLowerCase());
  if (!id) {
    window.alert("Player not recognised.");
    return undefined;
  }
  return id;
}

function rebuildSubState(proposed) {
  const intervals = {};
  const lineup = [...state.starterIds];
  const open = (id, second) => { intervals[id] ||= []; intervals[id].push({ start: second, end: null }); };
  const close = (id, second) => {
    const current = [...(intervals[id] || [])].reverse().find(i => i.end === null);
    if (!current || second < current.start) return false;
    current.end = second;
    return true;
  };
  state.starterIds.forEach(id => open(id, 0));
  const ordered = proposed.map(s => ({ ...s })).sort((a, b) => Number(a.second || 0) - Number(b.second || 0));
  for (const sub of ordered) {
    const second = Math.max(0, Number(sub.second ?? Number(sub.minute || 0) * 60));
    if (!lineup.includes(sub.off) || lineup.includes(sub.on) || !close(sub.off, second)) return null;
    open(sub.on, second);
    lineup.splice(lineup.indexOf(sub.off), 1, sub.on);
    sub.second = Math.round(second);
    sub.minute = Math.floor(second / 60);
  }
  return { intervals, lineup, ordered };
}

function applySubChanges(proposed) {
  const rebuilt = rebuildSubState(proposed);
  if (!rebuilt) return window.alert("That correction would make the substitution sequence invalid.");
  state.intervals = rebuilt.intervals;
  state.lineupIds = rebuilt.lineup;
  state.substitutions = rebuilt.ordered;
  saveState();
  renderLive();
  saveRecovery("substitution-correction");
}

function editSub(index) {
  const sub = state.substitutions[index];
  if (!sub) return;
  const minute = askMinute(sub.minute); if (minute == null || minute === undefined) return;
  const off = askPlayer(sub.off, "Player off"); if (off == null || off === undefined) return;
  const on = askPlayer(sub.on, "Player on"); if (on == null || on === undefined) return;
  if (off === on) return window.alert("Players must be different.");
  applySubChanges(state.substitutions.map((s, i) => i === index ? { ...s, minute, second: minute * 60, off, on } : { ...s }));
}
function deleteSub(index) {
  if (!window.confirm("Delete this substitution?")) return;
  applySubChanges(state.substitutions.filter((_, i) => i !== index));
}

function editEvent(index) {
  const event = state.events[index];
  if (!event) return;
  const minute = askMinute(event.minute); if (minute == null || minute === undefined) return;
  const playerId = askPlayer(event.playerId, "Player"); if (playerId == null || playerId === undefined) return;
  event.minute = minute;
  event.playerId = playerId;
  if (event.type === "Goal") {
    const type = window.prompt("Goal type: Open Play or Penalty", event.goalType || "Open Play");
    if (type === null) return;
    if (!['open play', 'penalty'].includes(type.trim().toLowerCase())) return window.alert("Use Open Play or Penalty.");
    event.goalType = type.trim().toLowerCase() === "penalty" ? "Penalty" : "Open Play";
    if (event.goalType === "Penalty") delete event.assistPlayerId;
    else {
      const names = state.squadIds.map(id => playerName(id)).join(", ");
      const assist = window.prompt(`Assist (blank for none)\n\nSquad: ${names}`, event.assistPlayerId ? playerName(event.assistPlayerId) : "");
      if (assist === null) return;
      if (!assist.trim()) delete event.assistPlayerId;
      else {
        const aid = state.squadIds.find(id => playerName(id).toLowerCase() === assist.trim().toLowerCase());
        if (!aid || aid === event.playerId) return window.alert("Assist player not recognised.");
        event.assistPlayerId = aid;
      }
    }
  } else if (event.type === "Card") {
    const current = event.cardType === "Yellow" ? "Yellow Card" : event.cardType === "Red" ? "Red Card" : "Sin Bin";
    const type = window.prompt("Type: Yellow Card, Red Card or Sin Bin", current);
    if (type === null) return;
    const map = { "yellow card": "Yellow", "red card": "Red", "sin bin": "Sin Bin" };
    const mapped = map[type.trim().toLowerCase()];
    if (!mapped) return window.alert("Use Yellow Card, Red Card or Sin Bin.");
    event.cardType = mapped;
  } else {
    const text = window.prompt("Event", event.text || "");
    if (text === null) return;
    if (!text.trim()) return window.alert("Event cannot be blank.");
    event.text = text.trim();
  }
  saveState();
  renderLive();
  saveRecovery("event-correction");
}
function deleteEvent(index) {
  if (!window.confirm("Delete this recorded item?")) return;
  state.events.splice(index, 1);
  saveState();
  renderLive();
  saveRecovery("event-delete");
}

function renderRecordedItems() {
  md.subList.innerHTML = "";
  state.substitutions.forEach((sub, index) => {
    const text = `${sub.minute}' · ${playerName(sub.off)} OFF → ${playerName(sub.on)} ON`;
    const row = document.createElement("div");
    row.className = "matchday-sub-row";
    const span = document.createElement("span"); span.textContent = text;
    row.append(span, spanner(text, () => editSub(index), () => deleteSub(index)));
    md.subList.appendChild(row);
  });

  md.goalList.innerHTML = "";
  md.playerEventList.innerHTML = "";
  state.events.map((event, index) => ({ event, index })).sort((a, b) => a.event.minute - b.event.minute).forEach(({ event, index }) => {
    const row = document.createElement("div");
    row.className = "matchday-event-row";
    let text;
    if (event.type === "Goal") {
      text = `${event.minute}' · ${playerName(event.playerId)} · ${event.goalType}${event.assistPlayerId ? ` · Assist: ${playerName(event.assistPlayerId)}` : ""}`;
    } else if (event.type === "Card") {
      const label = event.cardType === "Yellow" ? "Yellow Card" : event.cardType === "Red" ? "Red Card" : event.cardType;
      text = `${event.minute}' · ${playerName(event.playerId)} · ${label}`;
    } else {
      text = `${event.minute}' · ${playerName(event.playerId)} · ${event.text}`;
    }
    const span = document.createElement("span"); span.textContent = text;
    row.append(span, spanner(text, () => editEvent(index), () => deleteEvent(index)));
    (event.type === "Goal" ? md.goalList : md.playerEventList).appendChild(row);
  });
}

function renderLive() {
  const f = fixture();
  md.liveFixture.textContent = f ? labelFixture(f) : "Match";
  md.clock.textContent = formatClock(elapsedSeconds());
  md.clockState.textContent = state.status === "paused" ? "Paused / Half Time" : "Match Running";
  md.pause.classList.toggle("hidden", state.status !== "running");
  md.resume.classList.toggle("hidden", state.status !== "paused");
  renderLineup();
  renderControls();
  renderRecordedItems();
}

function playerMinutes(id, finalSecond) {
  return Math.round((state.intervals[id] || []).reduce((sum, interval) => sum + Math.max(0, (interval.end ?? finalSecond) - interval.start), 0) / 60);
}

function payload(finalSecond) {
  const f = fixture();
  return {
    team: "Welling United Red OBDSFL",
    season: "2026-27",
    matchId: state.fixtureId,
    fixture: f ? { id: f.id, date: f.date, opposition: f.opposition, competition: f.competition || "", venue: f.venue || "" } : {},
    submittedBy: state.submittedBy,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    matchSeconds: Math.round(finalSecond),
    squad: state.squadIds.map(id => ({ playerId: id, displayName: playerName(id), position: playerPosition(id) })),
    starters: [...state.starterIds],
    substitutions: state.substitutions.map(s => ({ ...s })),
    events: state.events.map(e => ({ ...e })),
    playerStats: state.squadIds.map(id => ({ playerId: id, displayName: playerName(id), starter: state.starterIds.includes(id), minutesPlayed: playerMinutes(id, finalSecond) }))
  };
}

async function saveCompletedToSupabase(data) {
  if (typeof isSupabaseConfigured !== "function" || !isSupabaseConfigured()) throw new Error("Supabase not configured");
  const f = data.fixture || {};
  const row = {
    team: data.team,
    season: data.season,
    match_id: data.matchId,
    match_date: f.date || null,
    opposition: f.opposition || null,
    competition: f.competition || null,
    submitted_by: data.submittedBy,
    started_at: data.startedAt,
    finished_at: data.finishedAt,
    match_seconds: data.matchSeconds,
    payload: data
  };
  const { data: inserted, error } = await getSupabaseClient().from("matchday_sessions").insert(row).select("id").single();
  if (error) throw error;
  return inserted.id;
}

async function saveRecovery(reason) {
  if (autosaveBusy || !["running", "paused"].includes(state.status)) return;
  if (typeof isSupabaseConfigured !== "function" || !isSupabaseConfigured()) return;
  autosaveBusy = true;
  try {
    const data = payload(elapsedSeconds());
    data.recovery = { live: true, reason, savedAt: new Date().toISOString() };
    const f = data.fixture || {};
    const row = {
      team: data.team,
      season: data.season,
      match_id: data.matchId,
      match_date: f.date || null,
      opposition: f.opposition || null,
      submitted_by: data.submittedBy,
      started_at: data.startedAt,
      saved_at: new Date().toISOString(),
      reason,
      match_seconds: data.matchSeconds,
      payload: data
    };
    const client = getSupabaseClient();
    if (state.recoveryId) {
      const { error } = await client.from("matchday_recovery").update(row).eq("id", state.recoveryId);
      if (error) throw error;
    } else {
      const { data: inserted, error } = await client.from("matchday_recovery").insert(row).select("id").single();
      if (error) throw error;
      state.recoveryId = inserted.id;
      saveState();
    }
  } catch (error) {
    console.warn("Matchday recovery save failed", error);
  } finally {
    autosaveBusy = false;
  }
}

async function clearRecovery() {
  if (!state.recoveryId || typeof isSupabaseConfigured !== "function" || !isSupabaseConfigured()) return;
  try { await getSupabaseClient().from("matchday_recovery").delete().eq("id", state.recoveryId); } catch {}
  state.recoveryId = null;
  saveState();
}

function startAutosave() {
  if (!autosaveHandle) autosaveHandle = setInterval(() => saveRecovery("interval"), MATCHDAY_AUTOSAVE_MS);
}
function stopAutosave() {
  if (autosaveHandle) clearInterval(autosaveHandle);
  autosaveHandle = null;
}

async function safetyCheck() {
  if (state.status !== "running" || state.safetyStopTriggered || elapsedSeconds() < MATCHDAY_SAFETY_SECONDS) return;
  state.accumulatedSeconds = MATCHDAY_SAFETY_SECONDS;
  state.lastResumeEpoch = null;
  state.status = "paused";
  state.safetyStopTriggered = true;
  saveState();
  stopTicker();
  renderLive();
  await saveRecovery("180-minute-safety-stop");
  window.alert("Matchday has reached 180 minutes. The clock has been paused and the current data saved centrally. Choose Full Time, or Resume if needed.");
}

async function finishMatch() {
  if (!["running", "paused"].includes(state.status)) return;
  const finalSecond = Math.round(elapsedSeconds());
  if (state.status === "running") {
    state.accumulatedSeconds = finalSecond;
    state.lastResumeEpoch = null;
  }
  state.lineupIds.forEach(id => closeInterval(id, finalSecond));
  state.status = "finished";
  state.finishedAt = new Date().toISOString();
  stopTicker();
  stopAutosave();
  saveState();
  renderMatchday();
  md.saveStatus.textContent = "Saving Matchday to Supabase...";
  try {
    state.supabaseId = await saveCompletedToSupabase(payload(finalSecond));
    saveState();
    await clearRecovery();
    md.saveStatus.textContent = `Saved to Supabase · ${state.supabaseId.slice(0, 8)}`;
  } catch (error) {
    console.error(error);
    md.saveStatus.textContent = "Save failed. Matchday is safe on this device; use Retry Save when connected.";
    ensureRetryButton();
  }
}

function ensureRetryButton() {
  let button = document.getElementById("matchday-retry-save");
  if (button) { button.classList.remove("hidden"); return; }
  button = document.createElement("button");
  button.id = "matchday-retry-save";
  button.className = "primary-button matchday-wide";
  button.type = "button";
  button.textContent = "Retry Save to Supabase";
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      state.supabaseId = await saveCompletedToSupabase(payload(Number(state.accumulatedSeconds || 0)));
      saveState();
      await clearRecovery();
      md.saveStatus.textContent = `Saved to Supabase · ${state.supabaseId.slice(0, 8)}`;
      button.remove();
    } catch {
      md.saveStatus.textContent = "Save failed again. Retry when connected.";
    } finally { button.disabled = false; }
  });
  md.reset.parentNode.insertBefore(button, md.reset);
}

function renderFinished() {
  const f = fixture();
  md.finishedFixture.textContent = f ? labelFixture(f) : "Match";
  md.finishedClock.textContent = formatClock(Number(state.accumulatedSeconds || 0));
  md.minutesList.innerHTML = "";
  state.squadIds.forEach(id => {
    const row = document.createElement("div");
    row.className = "matchday-minute-row";
    row.innerHTML = `<span>${playerName(id)}</span><strong>${playerMinutes(id, Number(state.accumulatedSeconds || 0))} min</strong>`;
    md.minutesList.appendChild(row);
  });
  if (state.supabaseId) md.saveStatus.textContent = `Saved to Supabase · ${state.supabaseId.slice(0, 8)}`;
  else if (state.status === "finished") ensureRetryButton();
}

function cancelMatchday() {
  if (!window.confirm("Cancel Matchday? This resets the timer, substitutions, goals, cards and events.")) return;
  const recoveryId = state.recoveryId;
  stopTicker();
  stopAutosave();
  state = emptyMatchdayState();
  saveState();
  if (recoveryId && typeof isSupabaseConfigured === "function" && isSupabaseConfigured()) {
    getSupabaseClient().from("matchday_recovery").delete().eq("id", recoveryId).then(() => {}).catch(() => {});
  }
  renderMatchday();
}

function resetMatchday() {
  state = emptyMatchdayState();
  saveState();
  renderMatchday();
}

function renderMatchday() {
  md.setup.classList.toggle("hidden", state.status !== "setup");
  md.live.classList.toggle("hidden", !["running", "paused"].includes(state.status));
  md.finished.classList.toggle("hidden", state.status !== "finished");
  if (state.status === "setup") renderSetup();
  if (["running", "paused"].includes(state.status)) renderLive();
  if (state.status === "finished") renderFinished();
}

function startTicker() {
  stopTicker();
  timerHandle = setInterval(() => {
    if (state.status === "running") {
      md.clock.textContent = formatClock(elapsedSeconds());
      if (document.activeElement !== md.subMinute) md.subMinute.value = matchMinute();
      if (document.activeElement !== md.goalMinute) md.goalMinute.value = matchMinute();
      if (document.activeElement !== md.eventMinute) md.eventMinute.value = matchMinute();
      safetyCheck();
    }
  }, 1000);
}
function stopTicker() {
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = null;
}

async function openMatchday() {
  syncSetupSquad();
  md.view.classList.remove("hidden");
  renderMatchday();
  if (state.status === "running") { startTicker(); startAutosave(); saveRecovery("app-reopen"); }
  if (state.status === "paused") { startAutosave(); saveRecovery("app-reopen"); }
}

async function loadMatchdayData() {
  try {
    const [playersResponse, matchesResponse] = await Promise.all([
      fetch("players.json", { cache: "no-store" }),
      fetch("matches.json", { cache: "no-store" })
    ]);
    matchdayPlayers = (await playersResponse.json()).filter(p => p.active !== false);
    matchdayFixtures = (await matchesResponse.json()).filter(m => !m.postponed);
    renderMatchday();
  } catch (error) {
    console.error("Could not load Matchday data", error);
  }
}

buildV3Ui();

md.open?.addEventListener("click", openMatchday);
md.close?.addEventListener("click", () => md.view.classList.add("hidden"));
md.fixture?.addEventListener("change", () => { state.fixtureId = md.fixture.value; saveState(); renderSetup(); });
md.start?.addEventListener("click", startMatch);
md.pause?.addEventListener("click", pauseMatch);
md.resume?.addEventListener("click", resumeMatch);
md.addSub?.addEventListener("click", addSubstitution);
md.addGoal?.addEventListener("click", addGoal);
md.addEvent?.addEventListener("click", addPlayerEvent);
md.goalType?.addEventListener("change", renderControls);
md.goalPlayer?.addEventListener("change", renderControls);
md.eventType?.addEventListener("change", renderControls);
md.fullTime?.addEventListener("click", finishMatch);
md.cancel?.addEventListener("click", cancelMatchday);
md.reset?.addEventListener("click", resetMatchday);
md.correctionCancel?.addEventListener("click", closeCorrection);
md.correctionOverlay?.addEventListener("click", event => { if (event.target === md.correctionOverlay) closeCorrection(); });
md.correctionEdit?.addEventListener("click", () => { const fn = correctionAction?.editFn; closeCorrection(); fn?.(); });
md.correctionDelete?.addEventListener("click", () => { const fn = correctionAction?.deleteFn; closeCorrection(); fn?.(); });
document.querySelectorAll('input[name="session-type"]').forEach(input => input.addEventListener("change", updateLaunch));

updateLaunch();
loadMatchdayData();
if (state.status === "running") { startTicker(); startAutosave(); }
if (state.status === "paused") startAutosave();
