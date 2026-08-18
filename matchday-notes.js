// Matchday v3 compatibility + unified Match Event entry.
// Core timer, substitutions, persistence and recovery remain in matchday.js.
(() => {
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "matchday-v3.css";
  document.head.appendChild(css);

  const userContainer = document.getElementById("user-options");
  if (userContainer) {
    userContainer.addEventListener("click", (event) => {
      const button = event.target.closest(".user-option");
      if (!button) return;
      const selectedName = button.textContent.replace(" ✓", "").trim();
      if (!currentUser || currentUser.name !== selectedName) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      currentUser = null;
      localStorage.removeItem(USER_STORAGE_KEY);
      updateUserUi();
      renderUserOptions();
    }, true);
  }

  if (typeof md === "undefined" || typeof state === "undefined") return;

  const style = document.createElement("style");
  style.textContent = `
    .matchday-header .eyebrow.dark { color:#111827 !important; opacity:1 !important; }
    .matchday-unified-event-card { margin-top:10px; border:1px solid var(--border); border-radius:12px; padding:12px; }
    .matchday-unified-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)) 44px; gap:8px; align-items:end; }
    .matchday-unified-grid label { display:grid; gap:6px; font-weight:900; }
    .matchday-unified-records { display:grid; gap:7px; margin-top:10px; }
    .matchday-score-line { display:flex; align-items:center; justify-content:center; gap:22px; flex-wrap:wrap; margin-top:6px; }
    .matchday-live-score { font-size:clamp(26px,5vw,46px); line-height:1; font-weight:1000; color:#fff; white-space:nowrap; }
    .matchday-opponent-goal { margin:10px auto 0; display:block; min-width:180px; padding:10px 16px; border-radius:10px; border:1px solid rgba(255,255,255,.65); background:rgba(255,255,255,.14); color:#fff; font-weight:900; cursor:pointer; }
    .matchday-edit-overlay { position:fixed; inset:0; z-index:10050; background:rgba(15,23,42,.68); display:flex; align-items:center; justify-content:center; padding:18px; }
    .matchday-edit-overlay.hidden { display:none !important; }
    .matchday-edit-dialog { width:min(620px,100%); max-height:90vh; overflow:auto; background:#fff; border-radius:16px; padding:20px; box-shadow:0 24px 60px rgba(0,0,0,.28); }
    .matchday-edit-dialog h3 { margin:0 0 16px; }
    .matchday-edit-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .matchday-edit-grid label { display:grid; gap:6px; font-weight:900; }
    .matchday-edit-grid .full { grid-column:1/-1; }
    .matchday-edit-actions { display:flex; gap:10px; justify-content:flex-end; margin-top:18px; }
    .matchday-edit-save { background:#16a34a; color:#fff; border:0; border-radius:10px; padding:11px 18px; font-weight:900; cursor:pointer; }
    .matchday-edit-cancel { background:#f1f5f9; color:#0f172a; border:1px solid #cbd5e1; border-radius:10px; padding:11px 18px; font-weight:900; cursor:pointer; }
    @media (max-width:620px) {
      .matchday-unified-grid { grid-template-columns:minmax(0,1fr) minmax(0,1fr); }
      .matchday-unified-grid .matchday-tick-button { grid-column:2; justify-self:end; }
      .matchday-edit-grid { grid-template-columns:1fr; }
      .matchday-edit-grid .full { grid-column:1; }
    }
  `;
  document.head.appendChild(style);

  const legacyGoalCard = md.goalPlayer?.closest(".matchday-event-card");
  const legacyPlayerEventCard = md.eventPlayer?.closest(".matchday-event-card");
  const eventSection = md.legacyEventList?.closest(".matchday-live-section");
  if (!eventSection || !legacyGoalCard || !legacyPlayerEventCard) return;

  legacyGoalCard.classList.add("hidden");
  legacyPlayerEventCard.classList.add("hidden");
  md.legacyEventList?.classList.add("hidden");

  // Running score, shown alongside the live clock.
  const scoreLine = document.createElement("div");
  scoreLine.className = "matchday-score-line";
  const clockParent = md.clock.parentElement;
  clockParent.insertBefore(scoreLine, md.clock);
  scoreLine.appendChild(md.clock);
  const liveScore = document.createElement("div");
  liveScore.id = "matchday-live-score";
  liveScore.className = "matchday-live-score";
  liveScore.textContent = "0 - 0";
  scoreLine.appendChild(liveScore);

  const opponentGoalButton = document.createElement("button");
  opponentGoalButton.type = "button";
  opponentGoalButton.className = "matchday-opponent-goal";
  opponentGoalButton.textContent = "Opponent Goal +";
  md.clockState.insertAdjacentElement("afterend", opponentGoalButton);

  const unified = document.createElement("div");
  unified.className = "matchday-unified-event-card";
  unified.innerHTML = `
    <div class="matchday-unified-grid">
      <label>
        Type
        <select id="matchday-unified-type" class="matchday-select">
          <option value="Goal">Goal</option>
          <option value="Own Goal">Own Goal</option>
          <option value="Opponent Goal">Opponent Goal</option>
          <option value="Yellow Card">Yellow Card</option>
          <option value="Red Card">Red Card</option>
          <option value="Sin Bin">Sin Bin</option>
          <option value="Event">Event</option>
        </select>
      </label>
      <label id="matchday-unified-player-label">
        Player
        <select id="matchday-unified-player" class="matchday-select"></select>
      </label>
      <label id="matchday-unified-goal-type-label">
        Goal type
        <select id="matchday-unified-goal-type" class="matchday-select">
          <option value="Open Play">Open Play</option>
          <option value="Penalty">Penalty</option>
          <option value="Free Kick">Free Kick</option>
          <option value="Corner">Corner</option>
        </select>
      </label>
      <label id="matchday-unified-assist-label">
        Assist
        <select id="matchday-unified-assist" class="matchday-select"></select>
      </label>
      <label id="matchday-unified-text-label" class="hidden">
        Event
        <input id="matchday-unified-text" class="matchday-input" type="text" placeholder="What happened?" />
      </label>
      <label>
        Minute
        <input id="matchday-unified-minute" class="matchday-input" type="number" min="0" step="1" />
      </label>
      <button id="matchday-unified-add" class="matchday-tick-button" type="button" title="Record event" aria-label="Record event">✓</button>
    </div>
    <div id="matchday-unified-records" class="matchday-unified-records"></div>
  `;
  eventSection.insertBefore(unified, md.legacyEventList);

  const typeSelect = document.getElementById("matchday-unified-type");
  const playerLabel = document.getElementById("matchday-unified-player-label");
  const playerSelect = document.getElementById("matchday-unified-player");
  const goalTypeLabel = document.getElementById("matchday-unified-goal-type-label");
  const goalTypeSelect = document.getElementById("matchday-unified-goal-type");
  const assistLabel = document.getElementById("matchday-unified-assist-label");
  const assistSelect = document.getElementById("matchday-unified-assist");
  const textLabel = document.getElementById("matchday-unified-text-label");
  const textInput = document.getElementById("matchday-unified-text");
  const minuteInput = document.getElementById("matchday-unified-minute");
  const addButton = document.getElementById("matchday-unified-add");
  const records = document.getElementById("matchday-unified-records");

  function setOptions(select, ids, blankText = null, selected = null) {
    const previous = selected !== null ? selected : select.value;
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

  function goalAllowsAssist(goalType) {
    return ["Open Play", "Free Kick", "Corner"].includes(goalType);
  }

  function renderUnifiedControls() {
    if (typeof syncLateArrivals === "function") syncLateArrivals();
    setOptions(playerSelect, state.squadIds || []);
    setOptions(assistSelect, (state.squadIds || []).filter(id => id !== playerSelect.value), "No assist / unknown");

    const type = typeSelect.value;
    const isGoal = type === "Goal";
    const noPlayer = type === "Own Goal" || type === "Opponent Goal";
    const isFreeText = type === "Event";

    playerLabel.classList.toggle("hidden", noPlayer);
    goalTypeLabel.classList.toggle("hidden", !isGoal);
    textLabel.classList.toggle("hidden", !isFreeText);
    assistLabel.classList.toggle("hidden", !isGoal || !goalAllowsAssist(goalTypeSelect.value));

    if (!isGoal || !goalAllowsAssist(goalTypeSelect.value)) assistSelect.value = "";
    if (!isFreeText) textInput.value = "";
    if (document.activeElement !== minuteInput) minuteInput.value = matchMinute();
  }

  function recordUnifiedEvent() {
    if (typeof syncLateArrivals === "function") syncLateArrivals();
    const type = typeSelect.value;
    const minute = Math.max(0, Math.floor(Number(minuteInput.value) || matchMinute()));
    const playerId = playerSelect.value;

    if (type === "Own Goal") {
      state.events.push({ type: "Goal", minute, goalType: "Own Goal", playerId: "" });
    } else if (type === "Opponent Goal") {
      state.events.push({ type: "Opponent Goal", minute });
    } else if (type === "Goal") {
      if (!playerId) return window.alert("Choose the goal scorer.");
      const goalType = goalTypeSelect.value;
      const event = { type: "Goal", playerId, minute, goalType };
      if (goalAllowsAssist(goalType) && assistSelect.value) event.assistPlayerId = assistSelect.value;
      state.events.push(event);
    } else if (["Yellow Card", "Red Card", "Sin Bin"].includes(type)) {
      if (!playerId) return window.alert("Choose the player.");
      const cardType = type === "Yellow Card" ? "Yellow" : type === "Red Card" ? "Red" : "Sin Bin";
      state.events.push({ type: "Card", playerId, minute, cardType });
    } else {
      if (!playerId) return window.alert("Choose the player.");
      const text = textInput.value.trim();
      if (!text) return window.alert("Enter the event text.");
      state.events.push({ type: "Note", playerId, minute, text });
      textInput.value = "";
    }

    saveState();
    renderLive();
    if (typeof saveRecovery === "function") saveRecovery("match-event");
  }

  function eventDescription(event) {
    if (event.type === "Opponent Goal") return `${event.minute}' · Opponent Goal`;
    if (event.type === "Goal" && event.goalType === "Own Goal") return `${event.minute}' · Own Goal`;
    if (event.type === "Goal") {
      return `${event.minute}' · ${playerName(event.playerId)} · Goal · ${event.goalType}${event.assistPlayerId ? ` · Assist: ${playerName(event.assistPlayerId)}` : ""}`;
    }
    if (event.type === "Card") {
      const label = event.cardType === "Yellow" ? "Yellow Card" : event.cardType === "Red" ? "Red Card" : "Sin Bin";
      return `${event.minute}' · ${playerName(event.playerId)} · ${label}`;
    }
    return `${event.minute}' · ${playerName(event.playerId)} · ${event.text}`;
  }

  function currentScore() {
    let ours = 0;
    let theirs = 0;
    (state.events || []).forEach(event => {
      if (event.type === "Goal") ours += 1;
      else if (event.type === "Opponent Goal") theirs += 1;
    });
    return { ours, theirs };
  }

  function updateScore() {
    const score = currentScore();
    liveScore.textContent = `${score.ours} - ${score.theirs}`;
  }

  opponentGoalButton.addEventListener("click", () => {
    state.events.push({ type: "Opponent Goal", minute: matchMinute() });
    saveState();
    renderLive();
    if (typeof saveRecovery === "function") saveRecovery("opponent-goal");
  });

  // Full-form editor -------------------------------------------------------
  const editOverlay = document.createElement("div");
  editOverlay.className = "matchday-edit-overlay hidden";
  editOverlay.innerHTML = `
    <div class="matchday-edit-dialog" role="dialog" aria-modal="true">
      <h3 id="matchday-edit-title">Edit</h3>
      <div id="matchday-edit-fields" class="matchday-edit-grid"></div>
      <div class="matchday-edit-actions">
        <button id="matchday-edit-cancel" class="matchday-edit-cancel" type="button">Cancel</button>
        <button id="matchday-edit-save" class="matchday-edit-save" type="button">Save changes</button>
      </div>
    </div>`;
  document.body.appendChild(editOverlay);
  const editTitle = document.getElementById("matchday-edit-title");
  const editFields = document.getElementById("matchday-edit-fields");
  const editCancel = document.getElementById("matchday-edit-cancel");
  const editSave = document.getElementById("matchday-edit-save");
  let editSaveAction = null;

  function closeEditModal() {
    editOverlay.classList.add("hidden");
    editFields.innerHTML = "";
    editSaveAction = null;
  }
  function openEditModal(title, html, saveAction) {
    editTitle.textContent = title;
    editFields.innerHTML = html;
    editSaveAction = saveAction;
    editOverlay.classList.remove("hidden");
  }
  editCancel.addEventListener("click", closeEditModal);
  editOverlay.addEventListener("click", event => { if (event.target === editOverlay) closeEditModal(); });
  editSave.addEventListener("click", () => { if (editSaveAction) editSaveAction(); });

  function playerOptions(selected = "", includeBlank = false) {
    let html = includeBlank ? `<option value="">No assist / unknown</option>` : "";
    (state.squadIds || []).forEach(id => {
      html += `<option value="${id}"${id === selected ? " selected" : ""}>${playerName(id)}</option>`;
    });
    return html;
  }

  function eventUiType(recorded) {
    if (recorded.type === "Opponent Goal") return "Opponent Goal";
    if (recorded.type === "Goal" && recorded.goalType === "Own Goal") return "Own Goal";
    if (recorded.type === "Goal") return "Goal";
    if (recorded.type === "Card") return recorded.cardType === "Yellow" ? "Yellow Card" : recorded.cardType === "Red" ? "Red Card" : "Sin Bin";
    return "Event";
  }

  function editEventForm(index) {
    const recorded = state.events[index];
    if (!recorded) return;
    const uiType = eventUiType(recorded);
    openEditModal("Edit match event", `
      <label>Type
        <select id="edit-event-type" class="matchday-select">
          ${["Goal","Own Goal","Opponent Goal","Yellow Card","Red Card","Sin Bin","Event"].map(v => `<option value="${v}"${v===uiType?" selected":""}>${v}</option>`).join("")}
        </select>
      </label>
      <label id="edit-event-player-label">Player
        <select id="edit-event-player" class="matchday-select">${playerOptions(recorded.playerId || "")}</select>
      </label>
      <label id="edit-event-goal-type-label">Goal type
        <select id="edit-event-goal-type" class="matchday-select">
          ${["Open Play","Penalty","Free Kick","Corner"].map(v => `<option value="${v}"${v===(recorded.goalType||"Open Play")?" selected":""}>${v}</option>`).join("")}
        </select>
      </label>
      <label id="edit-event-assist-label">Assist
        <select id="edit-event-assist" class="matchday-select">${playerOptions(recorded.assistPlayerId || "", true)}</select>
      </label>
      <label id="edit-event-text-label" class="full">Event
        <input id="edit-event-text" class="matchday-input" type="text" value="${String(recorded.text || "").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;")}" />
      </label>
      <label>Minute
        <input id="edit-event-minute" class="matchday-input" type="number" min="0" step="1" value="${Number(recorded.minute || 0)}" />
      </label>`, () => {
        const type = document.getElementById("edit-event-type").value;
        const minute = Math.max(0, Math.floor(Number(document.getElementById("edit-event-minute").value) || 0));
        const playerId = document.getElementById("edit-event-player").value;
        const goalType = document.getElementById("edit-event-goal-type").value;
        const assistId = document.getElementById("edit-event-assist").value;
        const text = document.getElementById("edit-event-text").value.trim();
        let replacement;

        if (type === "Opponent Goal") replacement = { type: "Opponent Goal", minute };
        else if (type === "Own Goal") replacement = { type: "Goal", goalType: "Own Goal", playerId: "", minute };
        else if (type === "Goal") {
          if (!playerId) return window.alert("Choose the goal scorer.");
          replacement = { type: "Goal", goalType, playerId, minute };
          if (goalAllowsAssist(goalType) && assistId) {
            if (assistId === playerId) return window.alert("Scorer and assist cannot be the same player.");
            replacement.assistPlayerId = assistId;
          }
        } else if (["Yellow Card","Red Card","Sin Bin"].includes(type)) {
          if (!playerId) return window.alert("Choose the player.");
          replacement = { type: "Card", playerId, minute, cardType: type === "Yellow Card" ? "Yellow" : type === "Red Card" ? "Red" : "Sin Bin" };
        } else {
          if (!playerId) return window.alert("Choose the player.");
          if (!text) return window.alert("Event text cannot be blank.");
          replacement = { type: "Note", playerId, minute, text };
        }
        state.events[index] = replacement;
        saveState();
        closeEditModal();
        renderLive();
        if (typeof saveRecovery === "function") saveRecovery("event-correction");
      });

    const typeEl = document.getElementById("edit-event-type");
    const goalTypeEl = document.getElementById("edit-event-goal-type");
    const playerEl = document.getElementById("edit-event-player");
    const playerLbl = document.getElementById("edit-event-player-label");
    const goalLbl = document.getElementById("edit-event-goal-type-label");
    const assistLbl = document.getElementById("edit-event-assist-label");
    const textLbl = document.getElementById("edit-event-text-label");
    const assistEl = document.getElementById("edit-event-assist");
    function refreshEditEventFields() {
      const type = typeEl.value;
      const isGoal = type === "Goal";
      const noPlayer = type === "Own Goal" || type === "Opponent Goal";
      playerLbl.classList.toggle("hidden", noPlayer);
      goalLbl.classList.toggle("hidden", !isGoal);
      assistLbl.classList.toggle("hidden", !isGoal || !goalAllowsAssist(goalTypeEl.value));
      textLbl.classList.toggle("hidden", type !== "Event");
      if (isGoal) {
        const selectedAssist = assistEl.value;
        assistEl.innerHTML = playerOptions(selectedAssist, true);
        [...assistEl.options].forEach(option => { if (option.value && option.value === playerEl.value) option.disabled = true; });
      }
    }
    typeEl.addEventListener("change", refreshEditEventFields);
    goalTypeEl.addEventListener("change", refreshEditEventFields);
    playerEl.addEventListener("change", refreshEditEventFields);
    refreshEditEventFields();
  }

  function editSubForm(index) {
    const sub = state.substitutions[index];
    if (!sub) return;
    openEditModal("Edit substitution", `
      <label>Player off
        <select id="edit-sub-off" class="matchday-select">${playerOptions(sub.off)}</select>
      </label>
      <label>Player on
        <select id="edit-sub-on" class="matchday-select">${playerOptions(sub.on)}</select>
      </label>
      <label>Minute
        <input id="edit-sub-minute" class="matchday-input" type="number" min="0" step="1" value="${Number(sub.minute || 0)}" />
      </label>`, () => {
        const off = document.getElementById("edit-sub-off").value;
        const on = document.getElementById("edit-sub-on").value;
        const minute = Math.max(0, Math.floor(Number(document.getElementById("edit-sub-minute").value) || 0));
        if (!off || !on || off === on) return window.alert("Choose two different players.");
        const proposed = state.substitutions.map((item, i) => i === index ? { ...item, off, on, minute, second: minute * 60 } : { ...item });
        const rebuilt = rebuildSubState(proposed);
        if (!rebuilt) return window.alert("That correction would make the substitution sequence invalid.");
        state.intervals = rebuilt.intervals;
        state.lineupIds = rebuilt.lineup;
        state.substitutions = rebuilt.ordered;
        saveState();
        closeEditModal();
        renderLive();
        if (typeof saveRecovery === "function") saveRecovery("substitution-correction");
      });
  }

  editEvent = editEventForm;
  editSub = editSubForm;

  const coreRenderRecordedItems = renderRecordedItems;
  renderRecordedItems = function () {
    coreRenderRecordedItems();
    md.goalList.innerHTML = "";
    md.playerEventList.innerHTML = "";
    records.innerHTML = "";

    state.events
      .map((event, index) => ({ event, index }))
      .sort((a, b) => Number(a.event.minute || 0) - Number(b.event.minute || 0))
      .forEach(({ event, index }) => {
        const text = eventDescription(event);
        const row = document.createElement("div");
        row.className = "matchday-event-row";
        const span = document.createElement("span");
        span.textContent = text;
        row.append(span, spanner(text, () => editEventForm(index), () => deleteEvent(index)));
        records.appendChild(row);
      });
    updateScore();
  };

  const coreRenderControls = renderControls;
  renderControls = function () {
    coreRenderControls();
    renderUnifiedControls();
  };

  typeSelect.addEventListener("change", renderUnifiedControls);
  playerSelect.addEventListener("change", renderUnifiedControls);
  goalTypeSelect.addEventListener("change", renderUnifiedControls);
  addButton.addEventListener("click", recordUnifiedEvent);

  renderUnifiedControls();
  renderRecordedItems();
})();
