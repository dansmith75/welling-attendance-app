const MATCHDAY_STORAGE_KEY = "welling-red-matchday-v1";
const MATCHDAY_STARTERS = 11;

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
  cardPlayer: document.getElementById("matchday-card-player"),
  cardType: document.getElementById("matchday-card-type"),
  cardMinute: document.getElementById("matchday-card-minute"),
  addCard: document.getElementById("matchday-add-card"),
  eventList: document.getElementById("matchday-event-list"),
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

function emptyState() {
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
    supabaseId: null
  };
}

function loadState() {
  try {
    const saved = localStorage.getItem(MATCHDAY_STORAGE_KEY);
    return saved ? { ...emptyState(), ...JSON.parse(saved) } : emptyState();
  } catch {
    return emptyState();
  }
}

let state = loadState();
const saveState = () => localStorage.setItem(MATCHDAY_STORAGE_KEY, JSON.stringify(state));
const player = id => matchdayPlayers.find(p => p.id === id);
const playerName = id => player(id)?.displayName || id;
const playerPosition = id => String(player(id)?.position || "").toUpperCase();
const fixture = () => matchdayFixtures.find(f => f.id === state.fixtureId) || null;

function positionGroup(pos) {
  const p = String(pos || "").toUpperCase();
  if (p === "GK") return "Goalkeeper";
  if (["CB","LB","RB","LWB","RWB","DF","DEF"].includes(p)) return "Defence";
  if (["CDM","DM","CM","CAM","AM","LM","RM","MF","MID"].includes(p)) return "Midfield";
  if (["LW","RW","CF","ST","FW","FWD"].includes(p)) return "Attack";
  return "Other";
}

function labelFixture(f) {
  return `${f.date} · ${f.opposition}${f.competition ? ` · ${f.competition}` : ""}`;
}

function elapsedSeconds() {
  let value = Number(state.accumulatedSeconds || 0);
  if (state.status === "running" && state.lastResumeEpoch) {
    value += (Date.now() - state.lastResumeEpoch) / 1000;
  }
  return Math.max(0, value);
}

const matchMinute = () => Math.floor(elapsedSeconds() / 60);
function formatClock(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2,"0")}:${String(total % 60).padStart(2,"0")}`;
}

function attendanceSquadIds() {
  if (typeof players === "undefined" || typeof getPlayerStatusForCurrentSession !== "function") return [];
  return players
    .filter(p => ["Present","Late"].includes(getPlayerStatusForCurrentSession(p.id)))
    .map(p => p.id);
}

function syncSetupSquad() {
  const ids = attendanceSquadIds();
  state.squadIds = ids;
  state.starterIds = state.starterIds.filter(id => ids.includes(id));
  saveState();
}

function syncLateArrivals() {
  if (!["running","paused"].includes(state.status)) return;
  let changed = false;
  attendanceSquadIds().forEach(id => {
    if (!state.squadIds.includes(id)) {
      state.squadIds.push(id);
      changed = true;
    }
  });
  if (changed) saveState();
}

function updateLaunch() {
  const selected = document.querySelector('input[name="session-type"]:checked');
  md.open.classList.toggle("hidden", !(selected && selected.value === "Match"));
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
    const today = new Date().toISOString().slice(0,10);
    state.fixtureId = (matchdayFixtures.find(f => f.date >= today) || matchdayFixtures[0]).id;
    saveState();
  }
  md.fixture.value = state.fixtureId || "";
  const f = fixture();
  md.fixtureMeta.textContent = f ? `${f.competition || "Competition TBC"} · ${f.venue || "Venue TBC"}` : "Select a fixture.";
}

function renderStarters() {
  md.starterList.innerHTML = "";
  const squad = matchdayPlayers.filter(p => state.squadIds.includes(p.id));
  md.squadCount.textContent = `${squad.length} player${squad.length === 1 ? "" : "s"} from Attendance`;
  md.starterCount.textContent = `${state.starterIds.length} selected`;

  if (!squad.length) {
    const note = document.createElement("p");
    note.className = "matchday-help";
    note.textContent = "No Match squad yet. Return to Attendance and mark players Present or Late.";
    md.starterList.appendChild(note);
    return;
  }

  squad.forEach(p => {
    const label = document.createElement("label");
    label.className = `matchday-player-choice${state.starterIds.includes(p.id) ? " selected" : ""}`;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = state.starterIds.includes(p.id);
    input.addEventListener("change", () => {
      if (input.checked) {
        if (!state.starterIds.includes(p.id)) state.starterIds.push(p.id);
      } else {
        state.starterIds = state.starterIds.filter(id => id !== p.id);
      }
      saveState();
      renderSetup();
    });
    const text = document.createElement("span");
    text.textContent = p.position ? `${p.displayName} · ${p.position}` : p.displayName;
    label.append(input, text);
    md.starterList.appendChild(label);
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
  const intervals = state.intervals[id] || [];
  const open = [...intervals].reverse().find(i => i.end === null);
  if (!open || second < open.start) return false;
  open.end = second;
  return true;
}

function startMatch() {
  syncSetupSquad();
  if (!fixture()) return alert("Select a fixture first.");
  if (!state.squadIds.length) return alert("Mark the Match squad Present or Late on Attendance first.");
  if (!state.starterIds.length) return alert("Select at least one starter.");
  if (state.starterIds.length < MATCHDAY_STARTERS && !confirm(`You have selected ${state.starterIds.length} starters instead of 11. Start anyway?`)) return;

  const now = Date.now();
  state.status = "running";
  state.accumulatedSeconds = 0;
  state.lastResumeEpoch = now;
  state.startedAt = new Date(now).toISOString();
  state.finishedAt = null;
  state.substitutions = [];
  state.events = [];
  state.lineupIds = [...state.starterIds];
  state.intervals = {};
  state.submittedBy = typeof getCurrentUserName === "function" ? getCurrentUserName() : "Unknown";
  state.supabaseId = null;
  state.starterIds.forEach(id => openInterval(id, 0));
  saveState();
  renderMatchday();
  startTicker();
}

function pauseMatch() {
  if (state.status !== "running") return;
  state.accumulatedSeconds = elapsedSeconds();
  state.lastResumeEpoch = null;
  state.status = "paused";
  saveState(); renderLive(); stopTicker();
}

function resumeMatch() {
  if (state.status !== "paused") return;
  state.status = "running";
  state.lastResumeEpoch = Date.now();
  saveState(); renderLive(); startTicker();
}

function fillSelect(select, ids, blankText = null) {
  const previous = select.value;
  select.innerHTML = "";
  if (blankText !== null) {
    const blank = document.createElement("option"); blank.value = ""; blank.textContent = blankText; select.appendChild(blank);
  }
  ids.forEach(id => {
    const o = document.createElement("option"); o.value = id; o.textContent = playerName(id); select.appendChild(o);
  });
  if ([...select.options].some(o => o.value === previous)) select.value = previous;
}

function renderSubControls() {
  fillSelect(md.subOff, state.lineupIds);
  fillSelect(md.subOn, state.squadIds.filter(id => !state.lineupIds.includes(id)));
  if (document.activeElement !== md.subMinute) md.subMinute.value = matchMinute();
}

function addSub() {
  syncLateArrivals();
  const off = md.subOff.value, on = md.subOn.value;
  if (!off || !on || off === on) return alert("Choose a player off and a different player on.");
  const second = Math.min(Math.max(0, Number(md.subMinute.value) || matchMinute()) * 60, elapsedSeconds());
  if (!closeInterval(off, second)) return alert("That substitution minute is before this player's current spell.");
  openInterval(on, second);
  state.lineupIds = state.lineupIds.filter(id => id !== off); state.lineupIds.push(on);
  state.substitutions.push({ minute: Math.floor(second / 60), second: Math.round(second), off, on });
  saveState(); renderLive();
}

function renderAssistOptions() {
  fillSelect(md.goalAssist, state.squadIds.filter(id => id !== md.goalPlayer.value), "No assist / unknown");
}

function updateAssistVisibility() {
  const openPlay = md.goalType.value === "Open Play";
  md.assistLabel.classList.toggle("hidden", !openPlay);
  if (!openPlay) md.goalAssist.value = "";
}

function renderEventControls() {
  fillSelect(md.goalPlayer, state.squadIds);
  fillSelect(md.cardPlayer, state.squadIds);
  renderAssistOptions();
  updateAssistVisibility();
  if (document.activeElement !== md.goalMinute) md.goalMinute.value = matchMinute();
  if (document.activeElement !== md.cardMinute) md.cardMinute.value = matchMinute();
}

function addGoal() {
  syncLateArrivals();
  const scorer = md.goalPlayer.value;
  if (!scorer) return alert("Choose the goal scorer.");
  const goalType = md.goalType.value;
  const event = { type: "Goal", playerId: scorer, minute: Math.max(0, Number(md.goalMinute.value) || matchMinute()), goalType };
  if (goalType === "Open Play" && md.goalAssist.value) event.assistPlayerId = md.goalAssist.value;
  state.events.push(event); saveState(); renderLive();
}

function addCard() {
  syncLateArrivals();
  const id = md.cardPlayer.value;
  if (!id) return alert("Choose the player.");
  state.events.push({ type: "Card", playerId: id, minute: Math.max(0, Number(md.cardMinute.value) || matchMinute()), cardType: md.cardType.value });
  saveState(); renderLive();
}

function renderLineup() {
  md.lineup.innerHTML = "";
  const groups = ["Goalkeeper","Defence","Midfield","Attack","Other"];
  groups.forEach(group => {
    const ids = state.lineupIds.filter(id => positionGroup(playerPosition(id)) === group);
    if (!ids.length) return;
    const section = document.createElement("div"); section.className = "matchday-position-group";
    const heading = document.createElement("div"); heading.className = "matchday-position-heading"; heading.textContent = group;
    const chips = document.createElement("div"); chips.className = "matchday-position-chips";
    ids.forEach(id => {
      const chip = document.createElement("span"); chip.className = `matchday-lineup-chip position-${group.toLowerCase()}`;
      chip.textContent = playerPosition(id) ? `${playerName(id)} · ${playerPosition(id)}` : playerName(id);
      chips.appendChild(chip);
    });
    section.append(heading, chips); md.lineup.appendChild(section);
  });
}

function renderLists() {
  md.subList.innerHTML = "";
  state.substitutions.forEach(s => {
    const row = document.createElement("div"); row.className = "matchday-sub-row";
    row.innerHTML = `<span>${s.minute}'</span><span>${playerName(s.off)} OFF → ${playerName(s.on)} ON</span>`;
    md.subList.appendChild(row);
  });

  md.eventList.innerHTML = "";
  [...state.events].sort((a,b) => a.minute - b.minute).forEach(e => {
    const row = document.createElement("div"); row.className = "matchday-event-row";
    if (e.type === "Goal") {
      const assist = e.assistPlayerId ? ` · Assist: ${playerName(e.assistPlayerId)}` : "";
      row.innerHTML = `<span>${e.minute}'</span><span>⚽ ${playerName(e.playerId)} · ${e.goalType}${assist}</span>`;
    } else {
      const icon = e.cardType === "Yellow" ? "🟨" : e.cardType === "Red" ? "🟥" : "⏱️";
      row.innerHTML = `<span>${e.minute}'</span><span>${icon} ${playerName(e.playerId)} · ${e.cardType}</span>`;
    }
    md.eventList.appendChild(row);
  });
}

function renderLive() {
  syncLateArrivals();
  md.liveFixture.textContent = fixture() ? labelFixture(fixture()) : "Match";
  md.clock.textContent = formatClock(elapsedSeconds());
  md.clockState.textContent = state.status === "paused" ? "Paused / Half Time" : "Match Running";
  md.pause.classList.toggle("hidden", state.status !== "running");
  md.resume.classList.toggle("hidden", state.status !== "paused");
  renderLineup(); renderSubControls(); renderEventControls(); renderLists();
}

function totalSeconds(id, finalSecond = elapsedSeconds()) {
  return (state.intervals[id] || []).reduce((sum, interval) => sum + Math.max(0, (interval.end ?? finalSecond) - interval.start), 0);
}

function payload(finalSecond) {
  return {
    team: "Welling United Red OBDSFL",
    season: "2026/27",
    fixture: fixture(),
    matchId: state.fixtureId,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    matchSeconds: Math.round(finalSecond),
    matchMinutes: Math.round(finalSecond / 60),
    submittedBy: state.submittedBy,
    squad: state.squadIds.map(id => ({ playerId: id, displayName: playerName(id), position: playerPosition(id) || null })),
    starters: [...state.starterIds],
    substitutions: [...state.substitutions],
    events: [...state.events],
    playerStats: state.squadIds.map(id => ({
      playerId: id,
      displayName: playerName(id),
      position: playerPosition(id) || null,
      starter: state.starterIds.includes(id),
      secondsPlayed: Math.round(totalSeconds(id, finalSecond)),
      minutesPlayed: Math.round(totalSeconds(id, finalSecond) / 60)
    }))
  };
}

async function saveToSupabase(data) {
  if (typeof isSupabaseConfigured !== "function" || !isSupabaseConfigured()) throw new Error("Supabase not configured");
  const { data: inserted, error } = await getSupabaseClient().from("matchday_sessions").insert({
    team: data.team,
    season: data.season,
    match_id: data.matchId,
    match_date: data.fixture?.date || null,
    opposition: data.fixture?.opposition || null,
    competition: data.fixture?.competition || null,
    submitted_by: data.submittedBy,
    started_at: data.startedAt,
    finished_at: data.finishedAt,
    match_seconds: data.matchSeconds,
    payload: data
  }).select("id").single();
  if (error) throw error;
  return inserted.id;
}

async function finishMatch() {
  if (!["running","paused"].includes(state.status) || !confirm("Finish this match and calculate minutes played?")) return;
  const finalSecond = elapsedSeconds();
  state.accumulatedSeconds = finalSecond; state.lastResumeEpoch = null;
  state.lineupIds.forEach(id => closeInterval(id, finalSecond));
  state.status = "finished"; state.finishedAt = new Date().toISOString(); saveState(); stopTicker(); renderMatchday();
  md.saveStatus.textContent = "Saving Matchday to Supabase...";
  try {
    state.supabaseId = await saveToSupabase(payload(finalSecond)); saveState();
    md.saveStatus.textContent = `Saved to Supabase · ${state.supabaseId.slice(0,8)}`;
  } catch (error) {
    console.error(error); md.saveStatus.textContent = "Supabase save failed. Matchday remains saved on this device.";
  }
}

function cancelMatchday() {
  const warning = "Cancel Matchday? This will reset the timer and delete all substitutions, goals, cards and Matchday data for this match.";
  if (!confirm(warning)) return;
  stopTicker(); state = emptyState(); saveState(); renderMatchday(); closeMatchday();
}

function resetMatch() {
  if (!confirm("Clear this finished Matchday and start a new one?")) return;
  state = emptyState(); saveState(); renderMatchday();
}

function renderFinished() {
  const finalSecond = Number(state.accumulatedSeconds || 0);
  md.finishedFixture.textContent = fixture() ? labelFixture(fixture()) : "Match";
  md.finishedClock.textContent = formatClock(finalSecond);
  md.minutesList.innerHTML = "";
  state.squadIds
    .map(id => ({ id, seconds: totalSeconds(id, finalSecond) }))
    .sort((a,b) => b.seconds - a.seconds)
    .forEach(s => {
      const row = document.createElement("div"); row.className = "matchday-minute-row";
      row.innerHTML = `<span>${playerName(s.id)}</span><span>${Math.round(s.seconds / 60)} mins</span>`;
      md.minutesList.appendChild(row);
    });
  md.saveStatus.textContent = state.supabaseId ? `Saved to Supabase · ${state.supabaseId.slice(0,8)}` : "Match finished.";
}

function renderMatchday() {
  md.setup.classList.toggle("hidden", state.status !== "setup");
  md.live.classList.toggle("hidden", !["running","paused"].includes(state.status));
  md.finished.classList.toggle("hidden", state.status !== "finished");
  if (state.status === "setup") renderSetup();
  else if (["running","paused"].includes(state.status)) renderLive();
  else renderFinished();
}

function startTicker() {
  stopTicker();
  timerHandle = setInterval(() => {
    if (state.status !== "running") return;
    md.clock.textContent = formatClock(elapsedSeconds());
    if (document.activeElement !== md.subMinute) md.subMinute.value = matchMinute();
    if (document.activeElement !== md.goalMinute) md.goalMinute.value = matchMinute();
    if (document.activeElement !== md.cardMinute) md.cardMinute.value = matchMinute();
  }, 1000);
}
function stopTicker() { if (timerHandle) clearInterval(timerHandle); timerHandle = null; }

function openMatchday() { state.status === "setup" ? syncSetupSquad() : syncLateArrivals(); renderMatchday(); md.view.classList.remove("hidden"); document.body.style.overflow = "hidden"; }
function closeMatchday() { if (state.status === "running") { state.accumulatedSeconds = elapsedSeconds(); state.lastResumeEpoch = Date.now(); saveState(); } md.view.classList.add("hidden"); document.body.style.overflow = ""; }

async function initMatchday() {
  try {
    const playerUrl = window.WELLING_APP_CONFIG?.dashboardPlayersUrl || "players.json";
    const fixtureUrl = window.WELLING_APP_CONFIG?.dashboardMatchesUrl || "matches.json";
    const [playerResponse, fixtureResponse] = await Promise.all([
      fetch(playerUrl, { cache: "no-store" }),
      fetch(fixtureUrl, { cache: "no-store" })
    ]);
    if (!playerResponse.ok || !fixtureResponse.ok) throw new Error("Shared Dashboard feed unavailable");
    matchdayPlayers = (await playerResponse.json()).filter(p => p.active === true).map(p => ({ id: p.id, displayName: p.displayName, position: p.position || "" }));
    matchdayFixtures = (await fixtureResponse.json()).filter(f => f?.id && f?.opposition);
    updateLaunch(); renderMatchday(); if (state.status === "running") startTicker();
  } catch (error) {
    console.error("Matchday init failed", error); md.open.disabled = true; md.open.textContent = "Matchday unavailable";
  }
}

sessionTypeElements.forEach(el => el.addEventListener("change", updateLaunch));
md.open.addEventListener("click", openMatchday);
md.close.addEventListener("click", closeMatchday);
md.fixture.addEventListener("change", () => { state.fixtureId = md.fixture.value; saveState(); renderFixtures(); });
md.start.addEventListener("click", startMatch);
md.pause.addEventListener("click", pauseMatch);
md.resume.addEventListener("click", resumeMatch);
md.addSub.addEventListener("click", addSub);
md.goalType.addEventListener("change", updateAssistVisibility);
md.goalPlayer.addEventListener("change", renderAssistOptions);
md.addGoal.addEventListener("click", addGoal);
md.addCard.addEventListener("click", addCard);
md.fullTime.addEventListener("click", finishMatch);
md.reset.addEventListener("click", resetMatch);

const cancelButton = document.createElement("button");
cancelButton.id = "matchday-cancel";
cancelButton.className = "danger-button";
cancelButton.type = "button";
cancelButton.textContent = "Cancel Matchday";
cancelButton.addEventListener("click", cancelMatchday);
document.querySelector(".matchday-live-actions")?.appendChild(cancelButton);

window.addEventListener("beforeunload", () => {
  if (state.status === "running") {
    state.accumulatedSeconds = elapsedSeconds();
    state.lastResumeEpoch = Date.now();
    saveState();
  }
});

initMatchday();
