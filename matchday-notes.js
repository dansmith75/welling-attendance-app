// Matchday UI, free-text events, corrections, recovery autosave and save retry.
// Loaded after matchday.js so it can safely extend the existing Matchday state.
(() => {
  if (typeof state === "undefined" || typeof md === "undefined") return;

  const AUTOSAVE_MS = 3 * 60 * 1000;
  const SAFETY_SECONDS = 180 * 60;
  let autosaveHandle = null;
  let autosaveBusy = false;

  state.recoveryId = state.recoveryId || null;
  state.safetyStopTriggered = Boolean(state.safetyStopTriggered);

  // ---------- Matchday visual layout ----------
  const style = document.createElement("style");
  style.textContent = `
    .matchday-divider-title {
      display:block;
      width:100%;
      margin:18px 0 12px;
      padding:10px 12px;
      border-radius:9px;
      background:#eef0f3;
      color:#374151;
      font-size:1rem;
      font-weight:950;
    }
    .matchday-live-section { border-top:0 !important; padding-top:0 !important; }
    .matchday-lineup-flat {
      display:flex;
      flex-wrap:wrap;
      gap:7px;
      padding:10px;
      border:1px solid var(--border);
      border-radius:12px;
    }
    .matchday-record-list { display:grid; gap:7px; margin-top:10px; }
    .matchday-record-row {
      display:grid;
      grid-template-columns:auto 1fr auto;
      gap:10px;
      align-items:center;
      padding:9px 10px;
      border-radius:9px;
      background:#f3f4f6;
      font-size:.82rem;
      font-weight:800;
    }
    .matchday-correction-actions { display:flex; gap:6px; }
    .matchday-correction-actions button { padding:6px 9px; font-size:.76rem; }
    .matchday-fulltime-green { background:var(--success) !important; color:white !important; }
    #matchday-cancel { width:100%; margin-top:18px; }
    #matchday-event-list { display:none !important; }
    @media (max-width:620px) {
      .matchday-record-row { grid-template-columns:auto 1fr; }
      .matchday-correction-actions { grid-column:1 / -1; justify-content:flex-end; }
    }
  `;
  document.head.appendChild(style);

  document.querySelectorAll("#matchday-live .matchday-live-section > h3").forEach((heading) => {
    heading.classList.add("matchday-divider-title");
  });

  // Full Time should be visually positive / decisive.
  md.fullTime?.classList.remove("danger-button");
  md.fullTime?.classList.add("primary-button", "matchday-fulltime-green");

  // Move Cancel Matchday right to the bottom of the live screen.
  const cancelButton = document.getElementById("matchday-cancel");
  if (cancelButton && md.live) md.live.appendChild(cancelButton);

  // ---------- One flat, colour-coded lineup ----------
  renderLineup = function () {
    md.lineup.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "matchday-lineup-flat";

    (state.lineupIds || []).forEach((id) => {
      const group = positionGroup(playerPosition(id));
      const chip = document.createElement("span");
      chip.className = `matchday-lineup-chip position-${group.toLowerCase()}`;
      chip.textContent = playerPosition(id) ? `${playerName(id)} · ${playerPosition(id)}` : playerName(id);
      wrap.appendChild(chip);
    });

    md.lineup.appendChild(wrap);
  };

  // ---------- Free-text event card ----------
  const eventSection = md.eventList?.closest(".matchday-live-section");
  const eventCards = eventSection ? [...eventSection.querySelectorAll(".matchday-event-card")] : [];
  const goalCard = eventCards[0] || null;
  const cardCard = eventCards[1] || null;

  let noteCard = document.getElementById("matchday-note-card");
  if (!noteCard && eventSection) {
    noteCard = document.createElement("div");
    noteCard.id = "matchday-note-card";
    noteCard.className = "matchday-event-card";
    noteCard.innerHTML = `
      <strong>📝 Player Event</strong>
      <div class="matchday-event-grid">
        <label>
          Player
          <select id="matchday-note-player" class="matchday-select"></select>
        </label>
        <label style="grid-column:1 / -1;">
          Event / note
          <textarea id="matchday-note-text" class="matchday-input" rows="3" placeholder="e.g. Fell over his own feet"></textarea>
        </label>
      </div>
      <button id="matchday-add-note" class="secondary-button matchday-wide" type="button">Record Event</button>
    `;
    eventSection.insertBefore(noteCard, md.eventList);
  }

  const notePlayer = document.getElementById("matchday-note-player");
  const noteText = document.getElementById("matchday-note-text");
  const addNote = document.getElementById("matchday-add-note");

  // Separate recorded lists under their own controls.
  function ensureList(card, id) {
    if (!card) return null;
    let list = document.getElementById(id);
    if (!list) {
      list = document.createElement("div");
      list.id = id;
      list.className = "matchday-record-list";
      card.appendChild(list);
    }
    return list;
  }

  const goalList = ensureList(goalCard, "matchday-goal-list");
  const cardList = ensureList(cardCard, "matchday-card-list");
  const noteList = ensureList(noteCard, "matchday-note-list");

  function renderNotePlayers() {
    if (!notePlayer) return;
    const previous = notePlayer.value;
    notePlayer.innerHTML = "";
    (state.squadIds || []).forEach((id) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = playerName(id);
      notePlayer.appendChild(option);
    });
    if ([...notePlayer.options].some((o) => o.value === previous)) notePlayer.value = previous;
  }

  const previousRenderEventControls = renderEventControls;
  renderEventControls = function () {
    previousRenderEventControls();
    renderNotePlayers();
  };

  addNote?.addEventListener("click", () => {
    if (typeof syncLateArrivals === "function") syncLateArrivals();
    const playerId = notePlayer?.value || "";
    const text = noteText?.value.trim() || "";
    if (!playerId) return window.alert("Choose the player for this event.");
    if (!text) {
      window.alert("Enter the event text first.");
      noteText?.focus();
      return;
    }
    state.events.push({ type: "Note", playerId, minute: matchMinute(), text });
    saveState();
    noteText.value = "";
    renderLive();
    saveRecovery("note-added");
  });

  // ---------- Recovery autosave ----------
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
      console.warn("Matchday recovery autosave failed", error);
    } finally {
      autosaveBusy = false;
    }
  }

  async function clearRecovery(recoveryId = state.recoveryId) {
    if (!recoveryId || typeof isSupabaseConfigured !== "function" || !isSupabaseConfigured()) return;
    try {
      await getSupabaseClient().from("matchday_recovery").delete().eq("id", recoveryId);
    } catch (error) {
      console.warn("Could not clear Matchday recovery", error);
    }
    if (state.recoveryId === recoveryId) {
      state.recoveryId = null;
      saveState();
    }
  }

  function startAutosave() {
    if (autosaveHandle) return;
    autosaveHandle = setInterval(() => saveRecovery("interval"), AUTOSAVE_MS);
  }

  function stopAutosave() {
    if (autosaveHandle) clearInterval(autosaveHandle);
    autosaveHandle = null;
  }

  // Hook clicks after the core handlers have changed state.
  md.start?.addEventListener("click", () => setTimeout(() => {
    if (state.status !== "running") return;
    state.recoveryId = null;
    state.safetyStopTriggered = false;
    saveState();
    startAutosave();
    saveRecovery("kickoff");
  }, 0));

  md.pause?.addEventListener("click", () => setTimeout(() => {
    if (state.status === "paused") saveRecovery("pause");
  }, 0));

  md.resume?.addEventListener("click", () => setTimeout(() => {
    if (state.status === "running") {
      startAutosave();
      saveRecovery("resume");
    }
  }, 0));

  md.fullTime?.addEventListener("click", () => {
    stopAutosave();
    const recoveryId = state.recoveryId;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (state.status === "finished" && state.supabaseId) {
        clearInterval(timer);
        clearRecovery(recoveryId);
      } else if (attempts >= 30) clearInterval(timer);
    }, 500);
  });

  cancelButton?.addEventListener("click", () => {
    const recoveryId = state.recoveryId;
    setTimeout(() => {
      if (state.status === "setup") {
        stopAutosave();
        clearRecovery(recoveryId);
      }
    }, 0);
  });

  // 180-minute safety stop.
  const originalFormatClock = formatClock;
  formatClock = function (seconds) {
    return Number(seconds || 0) > SAFETY_SECONDS ? "180:00+" : originalFormatClock(seconds);
  };

  setInterval(async () => {
    if (state.status !== "running" || state.safetyStopTriggered || elapsedSeconds() < SAFETY_SECONDS) return;
    state.accumulatedSeconds = SAFETY_SECONDS;
    state.lastResumeEpoch = null;
    state.status = "paused";
    state.safetyStopTriggered = true;
    saveState();
    stopTicker();
    renderLive();
    await saveRecovery("180-minute-safety-stop");
    window.alert("Matchday has reached 180 minutes. The clock has been paused and the current data has been saved centrally. Choose Full Time, or Resume if the match genuinely needs to continue.");
  }, 1000);

  // ---------- Edit / Delete helpers ----------
  function squadNames() {
    return (state.squadIds || []).map((id) => playerName(id)).join(", ");
  }

  function promptPlayer(currentId, label) {
    const entered = window.prompt(`${label}\n\nSquad: ${squadNames()}`, playerName(currentId));
    if (entered === null) return null;
    const found = (state.squadIds || []).find((id) => playerName(id).toLowerCase() === entered.trim().toLowerCase());
    if (!found) {
      window.alert("Player name not recognised. Use the displayed squad name exactly.");
      return undefined;
    }
    return found;
  }

  function promptMinute(current) {
    const entered = window.prompt("Minute", String(current ?? 0));
    if (entered === null) return null;
    const value = Number(entered);
    if (!Number.isFinite(value) || value < 0) {
      window.alert("Enter a valid minute.");
      return undefined;
    }
    return Math.floor(value);
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
      const gt = window.prompt("Goal type: Open Play or Penalty", e.goalType || "Open Play");
      if (gt === null) { state.events[index] = backup; return; }
      const normalized = gt.trim().toLowerCase();
      if (!["open play", "penalty"].includes(normalized)) {
        state.events[index] = backup;
        return window.alert("Goal type must be Open Play or Penalty.");
      }
      e.goalType = normalized === "penalty" ? "Penalty" : "Open Play";
      if (e.goalType === "Penalty") delete e.assistPlayerId;
      else {
        const assist = window.prompt(`Assist (leave blank for none)\n\nSquad: ${squadNames()}`, e.assistPlayerId ? playerName(e.assistPlayerId) : "");
        if (assist === null) { state.events[index] = backup; return; }
        if (!assist.trim()) delete e.assistPlayerId;
        else {
          const aid = (state.squadIds || []).find((id) => playerName(id).toLowerCase() === assist.trim().toLowerCase());
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
      const chosen = allowed.find((x) => x.toLowerCase() === ct.trim().toLowerCase());
      if (!chosen) {
        state.events[index] = backup;
        return window.alert("Card type must be Yellow, Red or Sin Bin.");
      }
      e.cardType = chosen;
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
    const label = e.type === "Goal"
      ? `${playerName(e.playerId)}'s goal at ${e.minute}'`
      : `${e.type} for ${playerName(e.playerId)} at ${e.minute}'`;
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
      const current = [...(intervals[id] || [])].reverse().find((i) => i.end === null);
      if (!current || second < current.start) return false;
      current.end = second;
      return true;
    };

    state.starterIds.forEach((id) => open(id, 0));
    const ordered = proposed.map((s) => ({ ...s })).sort((a, b) => Number(a.second || 0) - Number(b.second || 0));
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
    if (!rebuilt) return window.alert("That correction would make the substitution sequence invalid. Nothing was changed.");
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
    if (minute === null || minute === undefined) return;
    const off = promptPlayer(s.off, "Player off");
    if (off === null || off === undefined) return;
    const on = promptPlayer(s.on, "Player on");
    if (on === null || on === undefined) return;
    if (off === on) return window.alert("Player off and player on must be different.");
    applySubs(state.substitutions.map((sub, i) => i === index ? { ...sub, minute, second: minute * 60, off, on } : { ...sub }));
  }

  function deleteSub(index) {
    const s = state.substitutions[index];
    if (!s) return;
    if (!window.confirm(`Delete ${playerName(s.off)} OFF → ${playerName(s.on)} ON at ${s.minute}'?`)) return;
    applySubs(state.substitutions.filter((_, i) => i !== index).map((sub) => ({ ...sub })));
  }

  function correctionActions(editFn, deleteFn) {
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

  function renderRecordRow(list, minute, text, editFn, deleteFn) {
    if (!list) return;
    const row = document.createElement("div");
    row.className = "matchday-record-row";
    const min = document.createElement("span");
    min.textContent = `${minute}'`;
    const desc = document.createElement("span");
    desc.textContent = text;
    row.append(min, desc, correctionActions(editFn, deleteFn));
    list.appendChild(row);
  }

  // Replace the combined bottom event timeline with section-specific records.
  renderLists = function () {
    md.subList.innerHTML = "";
    state.substitutions.forEach((s, index) => {
      renderRecordRow(
        md.subList,
        s.minute,
        `${playerName(s.off)} OFF → ${playerName(s.on)} ON`,
        () => editSub(index),
        () => deleteSub(index)
      );
    });

    if (goalList) goalList.innerHTML = "";
    if (cardList) cardList.innerHTML = "";
    if (noteList) noteList.innerHTML = "";

    const ordered = state.events
      .map((event, originalIndex) => ({ event, originalIndex }))
      .sort((a, b) => Number(a.event.minute || 0) - Number(b.event.minute || 0));

    ordered.forEach(({ event: e, originalIndex }) => {
      if (e.type === "Goal") {
        const assist = e.assistPlayerId ? ` · Assist: ${playerName(e.assistPlayerId)}` : "";
        renderRecordRow(goalList, e.minute, `${playerName(e.playerId)} · ${e.goalType}${assist}`, () => editEvent(originalIndex), () => deleteEvent(originalIndex));
      } else if (e.type === "Card") {
        renderRecordRow(cardList, e.minute, `${playerName(e.playerId)} · ${e.cardType}`, () => editEvent(originalIndex), () => deleteEvent(originalIndex));
      } else if (e.type === "Note") {
        renderRecordRow(noteList, e.minute, `${playerName(e.playerId)} · ${e.text}`, () => editEvent(originalIndex), () => deleteEvent(originalIndex));
      }
    });
  };

  // ---------- Completed-save retry ----------
  const resetButton = document.getElementById("matchday-reset");
  const saveStatus = document.getElementById("matchday-save-status");
  if (resetButton && saveStatus && !document.getElementById("matchday-retry-save")) {
    const retryButton = document.createElement("button");
    retryButton.id = "matchday-retry-save";
    retryButton.type = "button";
    retryButton.className = "primary-button matchday-wide hidden";
    retryButton.textContent = "Retry Save to Supabase";
    resetButton.parentNode.insertBefore(retryButton, resetButton);

    function updateRetry() {
      retryButton.classList.toggle("hidden", state.status !== "finished" || Boolean(state.supabaseId));
    }

    const previousRenderFinished = renderFinished;
    renderFinished = function () {
      previousRenderFinished();
      updateRetry();
      if (state.status === "finished" && !state.supabaseId) {
        saveStatus.textContent = "Not yet saved centrally. Retry when you have a data connection.";
      }
    };

    retryButton.addEventListener("click", async () => {
      if (state.status !== "finished" || state.supabaseId) return;
      retryButton.disabled = true;
      retryButton.textContent = "Saving...";
      saveStatus.textContent = "Saving Matchday to Supabase...";
      try {
        const finalSecond = Number(state.accumulatedSeconds || 0);
        state.supabaseId = await saveToSupabase(payload(finalSecond));
        saveState();
        saveStatus.textContent = `Saved to Supabase · ${state.supabaseId.slice(0, 8)}`;
        updateRetry();
        await clearRecovery();
      } catch (error) {
        console.error(error);
        saveStatus.textContent = "Save failed again. Matchday is still safe on this device; retry when connected.";
      } finally {
        retryButton.disabled = false;
        retryButton.textContent = "Retry Save to Supabase";
      }
    });

    updateRetry();
  }

  renderNotePlayers();
  renderLineup();
  renderLists();

  if (["running", "paused"].includes(state.status)) {
    startAutosave();
    saveRecovery("app-reopen");
  }
})();
