// Matchday resilience + correction controls.
// Loaded after matchday.js and matchday-notes.js.
(() => {
  if (typeof state === "undefined" || typeof payload !== "function") return;

  const AUTOSAVE_MS = 3 * 60 * 1000;
  const SAFETY_SECONDS = 180 * 60;
  let autosaveHandle = null;
  let autosaveBusy = false;

  state.safetyStopTriggered = Boolean(state.safetyStopTriggered);

  function matchdayRow(data) {
    return {
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
    };
  }

  // Replace the original insert-only save so live autosaves and Full Time
  // update the same Supabase row rather than creating duplicates.
  saveToSupabase = async function (data) {
    if (typeof isSupabaseConfigured !== "function" || !isSupabaseConfigured()) {
      throw new Error("Supabase not configured");
    }

    const client = getSupabaseClient();
    const row = matchdayRow(data);

    if (state.supabaseId) {
      const { data: updated, error } = await client
        .from("matchday_sessions")
        .update(row)
        .eq("id", state.supabaseId)
        .select("id")
        .single();
      if (error) throw error;
      return updated.id;
    }

    const { data: inserted, error } = await client
      .from("matchday_sessions")
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;
    return inserted.id;
  };

  async function saveRecoverySnapshot(reason = "autosave") {
    if (autosaveBusy || !["running", "paused"].includes(state.status)) return;
    if (typeof isSupabaseConfigured !== "function" || !isSupabaseConfigured()) return;

    autosaveBusy = true;
    try {
      const seconds = elapsedSeconds();
      const data = payload(seconds);
      data.recovery = {
        live: true,
        reason,
        savedAt: new Date().toISOString()
      };
      state.supabaseId = await saveToSupabase(data);
      saveState();
    } catch (error) {
      console.warn("Matchday recovery autosave failed", error);
    } finally {
      autosaveBusy = false;
    }
  }

  function startAutosave() {
    if (autosaveHandle) return;
    autosaveHandle = setInterval(() => saveRecoverySnapshot("interval"), AUTOSAVE_MS);
  }

  function stopAutosave() {
    if (autosaveHandle) clearInterval(autosaveHandle);
    autosaveHandle = null;
  }

  async function safetyStopAt180() {
    if (state.status !== "running" || state.safetyStopTriggered) return;
    if (elapsedSeconds() < SAFETY_SECONDS) return;

    state.accumulatedSeconds = SAFETY_SECONDS;
    state.lastResumeEpoch = null;
    state.status = "paused";
    state.safetyStopTriggered = true;
    saveState();
    stopTicker();
    renderLive();
    await saveRecoverySnapshot("180-minute-safety-stop");
    window.alert("Matchday has reached 180 minutes. The clock has been paused and the current match data has been saved centrally. Confirm Full Time, or Resume if you genuinely need to continue.");
  }

  const originalFormatClock = formatClock;
  formatClock = function (seconds) {
    if (Number(seconds || 0) > SAFETY_SECONDS) return "180:00+";
    return originalFormatClock(seconds);
  };

  const originalStartMatch = startMatch;
  startMatch = function () {
    originalStartMatch();
    if (state.status === "running") {
      state.safetyStopTriggered = false;
      saveState();
      startAutosave();
      saveRecoverySnapshot("kickoff");
    }
  };

  const originalPauseMatch = pauseMatch;
  pauseMatch = function () {
    originalPauseMatch();
    if (state.status === "paused") saveRecoverySnapshot("pause");
  };

  const originalResumeMatch = resumeMatch;
  resumeMatch = function () {
    originalResumeMatch();
    if (state.status === "running") startAutosave();
  };

  const originalFinishMatch = finishMatch;
  finishMatch = async function () {
    stopAutosave();
    await originalFinishMatch();
  };

  const originalCancelMatchday = cancelMatchday;
  cancelMatchday = function () {
    stopAutosave();
    originalCancelMatchday();
  };

  // Check the safety stop every second without replacing Matchday's own ticker.
  setInterval(() => {
    if (state.status === "running") safetyStopAt180();
  }, 1000);

  function squadNameList() {
    return (state.squadIds || []).map(id => playerName(id)).join(", ");
  }

  function promptPlayer(currentId, label) {
    const entered = window.prompt(`${label}\n\nSquad: ${squadNameList()}`, playerName(currentId));
    if (entered === null) return null;
    const found = (state.squadIds || []).find(id => playerName(id).toLowerCase() === entered.trim().toLowerCase());
    if (!found) {
      window.alert("Player name not recognised. Use the displayed squad name exactly.");
      return undefined;
    }
    return found;
  }

  function promptMinute(current) {
    const entered = window.prompt("Minute", String(current ?? 0));
    if (entered === null) return null;
    const minute = Number(entered);
    if (!Number.isFinite(minute) || minute < 0) {
      window.alert("Enter a valid minute.");
      return undefined;
    }
    return Math.floor(minute);
  }

  function editEvent(index) {
    const e = state.events[index];
    if (!e) return;
    const backup = JSON.parse(JSON.stringify(e));

    const minute = promptMinute(e.minute);
    if (minute === null || minute === undefined) return;

    const pid = promptPlayer(e.playerId, "Player");
    if (pid === null || pid === undefined) return;

    e.minute = minute;
    e.playerId = pid;

    if (e.type === "Goal") {
      const goalType = window.prompt("Goal type: Open Play or Penalty", e.goalType || "Open Play");
      if (goalType === null) { state.events[index] = backup; return; }
      const normalized = goalType.trim().toLowerCase();
      if (!["open play", "penalty"].includes(normalized)) {
        state.events[index] = backup;
        return window.alert("Goal type must be Open Play or Penalty.");
      }
      e.goalType = normalized === "penalty" ? "Penalty" : "Open Play";
      if (e.goalType === "Penalty") {
        delete e.assistPlayerId;
      } else {
        const currentAssist = e.assistPlayerId ? playerName(e.assistPlayerId) : "";
        const assist = window.prompt(`Assist (leave blank for none)\n\nSquad: ${squadNameList()}`, currentAssist);
        if (assist === null) { state.events[index] = backup; return; }
        if (!assist.trim()) {
          delete e.assistPlayerId;
        } else {
          const aid = (state.squadIds || []).find(id => playerName(id).toLowerCase() === assist.trim().toLowerCase());
          if (!aid || aid === e.playerId) {
            state.events[index] = backup;
            return window.alert("Assist player not recognised, or is the same as the scorer.");
          }
          e.assistPlayerId = aid;
        }
      }
    } else if (e.type === "Card") {
      const cardType = window.prompt("Card type: Yellow, Red or Sin Bin", e.cardType || "Yellow");
      if (cardType === null) { state.events[index] = backup; return; }
      const allowed = ["Yellow", "Red", "Sin Bin"];
      const selected = allowed.find(x => x.toLowerCase() === cardType.trim().toLowerCase());
      if (!selected) {
        state.events[index] = backup;
        return window.alert("Card type must be Yellow, Red or Sin Bin.");
      }
      e.cardType = selected;
    } else if (e.type === "Note") {
      const text = window.prompt("Event / note", e.text || "");
      if (text === null) { state.events[index] = backup; return; }
      if (!text.trim()) {
        state.events[index] = backup;
        return window.alert("Event text cannot be blank.");
      }
      e.text = text.trim();
    }

    saveState();
    renderLive();
    saveRecoverySnapshot("event-edit");
  }

  function deleteEvent(index) {
    const e = state.events[index];
    if (!e) return;
    let description = `${e.type} for ${playerName(e.playerId)} at ${e.minute}'`;
    if (e.type === "Goal") description = `${playerName(e.playerId)}'s goal at ${e.minute}'`;
    if (!window.confirm(`Delete ${description}?`)) return;
    state.events.splice(index, 1);
    saveState();
    renderLive();
    saveRecoverySnapshot("event-delete");
  }

  function rebuildSubstitutionState(substitutions) {
    const intervals = {};
    const lineup = [...state.starterIds];
    const open = (id, second) => {
      intervals[id] ||= [];
      intervals[id].push({ start: second, end: null });
    };
    const close = (id, second) => {
      const list = intervals[id] || [];
      const current = [...list].reverse().find(i => i.end === null);
      if (!current || second < current.start) return false;
      current.end = second;
      return true;
    };

    state.starterIds.forEach(id => open(id, 0));
    const ordered = substitutions.map(s => ({ ...s })).sort((a, b) => Number(a.second || 0) - Number(b.second || 0));

    for (const sub of ordered) {
      const second = Math.max(0, Number(sub.second ?? (Number(sub.minute || 0) * 60)));
      if (!lineup.includes(sub.off) || lineup.includes(sub.on)) return null;
      if (!close(sub.off, second)) return null;
      open(sub.on, second);
      lineup.splice(lineup.indexOf(sub.off), 1, sub.on);
      sub.second = Math.round(second);
      sub.minute = Math.floor(second / 60);
    }

    return { substitutions: ordered, intervals, lineupIds: lineup };
  }

  function applySubstitutionChanges(proposed) {
    const rebuilt = rebuildSubstitutionState(proposed);
    if (!rebuilt) {
      window.alert("That correction would make the substitution sequence invalid. No changes were made.");
      return false;
    }
    state.substitutions = rebuilt.substitutions;
    state.intervals = rebuilt.intervals;
    state.lineupIds = rebuilt.lineupIds;
    saveState();
    renderLive();
    saveRecoverySnapshot("substitution-correction");
    return true;
  }

  function editSub(index) {
    const s = state.substitutions[index];
    if (!s) return;
    const minute = promptMinute(s.minute);
    if (minute === null || minute === undefined) return;
    const off = promptPlayer(s.off, "Player off");
    if (off === null || off === undefined) return;
    const on = promptPlayer(s.on, "Player on");
    if (on === null || on === undefined) return;
    if (off === on) return window.alert("Player off and player on must be different.");

    const proposed = state.substitutions.map((sub, i) => i === index
      ? { ...sub, minute, second: minute * 60, off, on }
      : { ...sub });
    applySubstitutionChanges(proposed);
  }

  function deleteSub(index) {
    const s = state.substitutions[index];
    if (!s) return;
    if (!window.confirm(`Delete ${playerName(s.off)} OFF → ${playerName(s.on)} ON at ${s.minute}'?`)) return;
    const proposed = state.substitutions.filter((_, i) => i !== index).map(sub => ({ ...sub }));
    applySubstitutionChanges(proposed);
  }

  function correctionButtons(editFn, deleteFn) {
    const wrap = document.createElement("span");
    wrap.className = "matchday-correction-actions";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "small-button";
    edit.textContent = "Edit";
    edit.addEventListener("click", editFn);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "small-button danger-button";
    del.textContent = "Delete";
    del.addEventListener("click", deleteFn);

    wrap.append(edit, del);
    return wrap;
  }

  // Wrap whatever renderer is active after matchday-notes.js so notes are
  // included as well as goals/cards.
  const previousRenderLists = renderLists;
  renderLists = function () {
    previousRenderLists();

    const subRows = [...md.subList.querySelectorAll(".matchday-sub-row")];
    subRows.forEach((row, index) => {
      row.appendChild(correctionButtons(() => editSub(index), () => deleteSub(index)));
    });

    const orderedEvents = state.events
      .map((event, originalIndex) => ({ event, originalIndex }))
      .sort((a, b) => Number(a.event.minute || 0) - Number(b.event.minute || 0));
    const eventRows = [...md.eventList.querySelectorAll(".matchday-event-row")];
    eventRows.forEach((row, displayIndex) => {
      const originalIndex = orderedEvents[displayIndex]?.originalIndex;
      if (originalIndex === undefined) return;
      row.appendChild(correctionButtons(() => editEvent(originalIndex), () => deleteEvent(originalIndex)));
    });
  };

  // Start recovery for an already-running Matchday after refresh/reopen.
  if (["running", "paused"].includes(state.status)) {
    startAutosave();
    saveRecoverySnapshot("app-reopen");
  }
})();
