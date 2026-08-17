// Matchday resilience + corrections.
// Keeps live recovery snapshots separate from completed matchday_sessions.
(() => {
  if (typeof state === "undefined" || typeof payload !== "function") return;

  const AUTOSAVE_MS = 3 * 60 * 1000;
  const SAFETY_SECONDS = 180 * 60;
  let autosaveHandle = null;
  let autosaveBusy = false;

  state.recoveryId = state.recoveryId || null;
  state.safetyStopTriggered = Boolean(state.safetyStopTriggered);

  async function saveRecovery(reason = "autosave") {
    if (autosaveBusy || !["running", "paused"].includes(state.status)) return;
    if (typeof isSupabaseConfigured !== "function" || !isSupabaseConfigured()) return;

    autosaveBusy = true;
    try {
      const seconds = elapsedSeconds();
      const data = payload(seconds);
      data.recovery = { live: true, reason, savedAt: new Date().toISOString() };
      const row = {
        team: data.team,
        season: data.season,
        match_id: data.matchId,
        match_date: data.fixture?.date || null,
        opposition: data.fixture?.opposition || null,
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
    try {
      const client = getSupabaseClient();
      await client.from("matchday_recovery").delete().eq("id", state.recoveryId);
    } catch (error) {
      console.warn("Could not clear Matchday recovery row", error);
    }
    state.recoveryId = null;
    saveState();
  }

  function startAutosave() {
    if (autosaveHandle) return;
    autosaveHandle = setInterval(() => saveRecovery("interval"), AUTOSAVE_MS);
  }

  function stopAutosave() {
    if (autosaveHandle) clearInterval(autosaveHandle);
    autosaveHandle = null;
  }

  async function safetyStop() {
    if (state.status !== "running" || state.safetyStopTriggered) return;
    if (elapsedSeconds() < SAFETY_SECONDS) return;

    state.accumulatedSeconds = SAFETY_SECONDS;
    state.lastResumeEpoch = null;
    state.status = "paused";
    state.safetyStopTriggered = true;
    saveState();
    stopTicker();
    renderLive();
    await saveRecovery("180-minute-safety-stop");
    window.alert("Matchday has reached 180 minutes. The clock has been paused and the current data has been saved centrally. Choose Full Time, or Resume if the match genuinely needs to continue.");
  }

  const originalFormatClock = formatClock;
  formatClock = seconds => Number(seconds || 0) > SAFETY_SECONDS ? "180:00+" : originalFormatClock(seconds);

  const originalStartMatch = startMatch;
  startMatch = function () {
    originalStartMatch();
    if (state.status === "running") {
      state.recoveryId = null;
      state.safetyStopTriggered = false;
      saveState();
      startAutosave();
      saveRecovery("kickoff");
    }
  };

  const originalPauseMatch = pauseMatch;
  pauseMatch = function () {
    originalPauseMatch();
    if (state.status === "paused") saveRecovery("pause");
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
    if (state.status === "finished" && state.supabaseId) await clearRecovery();
  };

  const originalCancelMatchday = cancelMatchday;
  cancelMatchday = function () {
    const recoveryId = state.recoveryId;
    stopAutosave();
    originalCancelMatchday();
    if (recoveryId && typeof isSupabaseConfigured === "function" && isSupabaseConfigured()) {
      getSupabaseClient().from("matchday_recovery").delete().eq("id", recoveryId).then(() => {}).catch(() => {});
    }
  };

  setInterval(() => {
    if (state.status === "running") safetyStop();
  }, 1000);

  function squadNames() {
    return (state.squadIds || []).map(id => playerName(id)).join(", ");
  }

  function promptPlayer(currentId, label) {
    const value = window.prompt(`${label}\n\nSquad: ${squadNames()}`, playerName(currentId));
    if (value === null) return null;
    const found = (state.squadIds || []).find(id => playerName(id).toLowerCase() === value.trim().toLowerCase());
    if (!found) {
      window.alert("Player name not recognised. Use the displayed squad name exactly.");
      return undefined;
    }
    return found;
  }

  function promptMinute(current) {
    const value = window.prompt("Minute", String(current ?? 0));
    if (value === null) return null;
    const minute = Number(value);
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
    if (minute == null) return;
    if (minute === undefined) return;
    const pid = promptPlayer(e.playerId, "Player");
    if (pid == null) return;
    if (pid === undefined) return;
    e.minute = minute;
    e.playerId = pid;

    if (e.type === "Goal") {
      const gt = window.prompt("Goal type: Open Play or Penalty", e.goalType || "Open Play");
      if (gt === null) { state.events[index] = backup; return; }
      const normalized = gt.trim().toLowerCase();
      if (!["open play", "penalty"].includes(normalized)) {
        state.events[index] = backup;
        return window.alert("Goal type must be Open Play or Penalty.");
      }
      e.goalType = normalized === "penalty" ? "Penalty" : "Open Play";
      if (e.goalType === "Penalty") {
        delete e.assistPlayerId;
      } else {
        const assistName = window.prompt(`Assist (leave blank for none)\n\nSquad: ${squadNames()}`, e.assistPlayerId ? playerName(e.assistPlayerId) : "");
        if (assistName === null) { state.events[index] = backup; return; }
        if (!assistName.trim()) delete e.assistPlayerId;
        else {
          const aid = (state.squadIds || []).find(id => playerName(id).toLowerCase() === assistName.trim().toLowerCase());
          if (!aid || aid === e.playerId) {
            state.events[index] = backup;
            return window.alert("Assist player not recognised, or is the scorer.");
          }
          e.assistPlayerId = aid;
        }
      }
    } else if (e.type === "Card") {
      const ct = window.prompt("Card type: Yellow, Red or Sin Bin", e.cardType || "Yellow");
      if (ct === null) { state.events[index] = backup; return; }
      const allowed = ["Yellow", "Red", "Sin Bin"];
      const found = allowed.find(x => x.toLowerCase() === ct.trim().toLowerCase());
      if (!found) {
        state.events[index] = backup;
        return window.alert("Card type must be Yellow, Red or Sin Bin.");
      }
      e.cardType = found;
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
    saveRecovery("event-edit");
  }

  function deleteEvent(index) {
    const e = state.events[index];
    if (!e) return;
    const label = e.type === "Goal" ? `${playerName(e.playerId)}'s goal at ${e.minute}'` : `${e.type} for ${playerName(e.playerId)} at ${e.minute}'`;
    if (!window.confirm(`Delete ${label}?`)) return;
    state.events.splice(index, 1);
    saveState();
    renderLive();
    saveRecovery("event-delete");
  }

  function rebuildSubs(proposed) {
    const intervals = {};
    const lineup = [...state.starterIds];
    const open = (id, second) => {
      intervals[id] ||= [];
      intervals[id].push({ start: second, end: null });
    };
    const close = (id, second) => {
      const current = [...(intervals[id] || [])].reverse().find(i => i.end === null);
      if (!current || second < current.start) return false;
      current.end = second;
      return true;
    };

    state.starterIds.forEach(id => open(id, 0));
    const ordered = proposed.map(s => ({ ...s })).sort((a, b) => Number(a.second || 0) - Number(b.second || 0));
    for (const sub of ordered) {
      const second = Math.max(0, Number(sub.second ?? (Number(sub.minute || 0) * 60)));
      if (!lineup.includes(sub.off) || lineup.includes(sub.on) || !close(sub.off, second)) return null;
      open(sub.on, second);
      lineup.splice(lineup.indexOf(sub.off), 1, sub.on);
      sub.second = Math.round(second);
      sub.minute = Math.floor(second / 60);
    }
    return { ordered, intervals, lineup };
  }

  function applySubs(proposed) {
    const rebuilt = rebuildSubs(proposed);
    if (!rebuilt) {
      window.alert("That correction would make the substitution sequence invalid. Nothing was changed.");
      return;
    }
    state.substitutions = rebuilt.ordered;
    state.intervals = rebuilt.intervals;
    state.lineupIds = rebuilt.lineup;
    saveState();
    renderLive();
    saveRecovery("substitution-correction");
  }

  function editSub(index) {
    const s = state.substitutions[index];
    if (!s) return;
    const minute = promptMinute(s.minute);
    if (minute == null || minute === undefined) return;
    const off = promptPlayer(s.off, "Player off");
    if (off == null || off === undefined) return;
    const on = promptPlayer(s.on, "Player on");
    if (on == null || on === undefined) return;
    if (off === on) return window.alert("Player off and player on must be different.");
    applySubs(state.substitutions.map((sub, i) => i === index ? { ...sub, minute, second: minute * 60, off, on } : { ...sub }));
  }

  function deleteSub(index) {
    const s = state.substitutions[index];
    if (!s) return;
    if (!window.confirm(`Delete ${playerName(s.off)} OFF → ${playerName(s.on)} ON at ${s.minute}'?`)) return;
    applySubs(state.substitutions.filter((_, i) => i !== index).map(sub => ({ ...sub })));
  }

  function actions(editFn, deleteFn) {
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

  const previousRenderLists = renderLists;
  renderLists = function () {
    previousRenderLists();

    [...md.subList.querySelectorAll(".matchday-sub-row")].forEach((row, index) => {
      row.appendChild(actions(() => editSub(index), () => deleteSub(index)));
    });

    const orderedEvents = state.events
      .map((event, originalIndex) => ({ event, originalIndex }))
      .sort((a, b) => Number(a.event.minute || 0) - Number(b.event.minute || 0));
    [...md.eventList.querySelectorAll(".matchday-event-row")].forEach((row, displayIndex) => {
      const originalIndex = orderedEvents[displayIndex]?.originalIndex;
      if (originalIndex === undefined) return;
      row.appendChild(actions(() => editEvent(originalIndex), () => deleteEvent(originalIndex)));
    });
  };

  if (["running", "paused"].includes(state.status)) {
    startAutosave();
    saveRecovery("app-reopen");
  }
})();
