// Matchday v3 compatibility + unified Match Event entry.
// Core timer, substitutions, persistence and recovery remain in matchday.js.
(() => {
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "matchday-v3.css";
  document.head.appendChild(css);

  // First-page manager toggle: tapping the selected manager deselects them.
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

  // Matchday eyebrow requested in black.
  const style = document.createElement("style");
  style.textContent = `
    .matchday-header .eyebrow.dark { color:#111827 !important; opacity:1 !important; }
    .matchday-unified-event-card { margin-top:10px; border:1px solid var(--border); border-radius:12px; padding:12px; }
    .matchday-unified-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)) 44px; gap:8px; align-items:end; }
    .matchday-unified-grid label { display:grid; gap:6px; font-weight:900; }
    .matchday-unified-records { display:grid; gap:7px; margin-top:10px; }
    @media (max-width:620px) {
      .matchday-unified-grid { grid-template-columns:minmax(0,1fr) minmax(0,1fr); }
      .matchday-unified-grid .matchday-tick-button { grid-column:2; justify-self:end; }
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

  const unified = document.createElement("div");
  unified.className = "matchday-unified-event-card";
  unified.innerHTML = `
    <div class="matchday-unified-grid">
      <label>
        Type
        <select id="matchday-unified-type" class="matchday-select">
          <option value="Goal">Goal</option>
          <option value="Own Goal">Own Goal</option>
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

  function setOptions(select, ids, blankText = null) {
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

  function goalAllowsAssist(goalType) {
    return ["Open Play", "Free Kick", "Corner"].includes(goalType);
  }

  function renderUnifiedControls() {
    if (typeof syncLateArrivals === "function") syncLateArrivals();
    setOptions(playerSelect, state.squadIds || []);
    setOptions(assistSelect, (state.squadIds || []).filter(id => id !== playerSelect.value), "No assist / unknown");

    const type = typeSelect.value;
    const isGoal = type === "Goal";
    const isOwnGoal = type === "Own Goal";
    const isFreeText = type === "Event";

    playerLabel.classList.toggle("hidden", isOwnGoal);
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
    if (event.type === "Goal" && event.goalType === "Own Goal") {
      return `${event.minute}' · Own Goal`;
    }
    if (event.type === "Goal") {
      return `${event.minute}' · ${playerName(event.playerId)} · Goal · ${event.goalType}${event.assistPlayerId ? ` · Assist: ${playerName(event.assistPlayerId)}` : ""}`;
    }
    if (event.type === "Card") {
      const label = event.cardType === "Yellow" ? "Yellow Card" : event.cardType === "Red" ? "Red Card" : "Sin Bin";
      return `${event.minute}' · ${playerName(event.playerId)} · ${label}`;
    }
    return `${event.minute}' · ${playerName(event.playerId)} · ${event.text}`;
  }

  // Edit behaviour for the unified event types. Own Goal deliberately has no player.
  editEvent = function (index) {
    const recorded = state.events[index];
    if (!recorded) return;

    const minute = askMinute(recorded.minute);
    if (minute == null || minute === undefined) return;
    recorded.minute = minute;

    if (recorded.type === "Goal" && recorded.goalType === "Own Goal") {
      // Only minute needs editing; there is intentionally no player.
    } else {
      const playerId = askPlayer(recorded.playerId, "Player");
      if (playerId == null || playerId === undefined) return;
      recorded.playerId = playerId;

      if (recorded.type === "Goal") {
        const entered = window.prompt(
          "Goal type: Open Play, Penalty, Free Kick or Corner",
          recorded.goalType || "Open Play"
        );
        if (entered === null) return;
        const types = {
          "open play": "Open Play",
          "penalty": "Penalty",
          "free kick": "Free Kick",
          "corner": "Corner"
        };
        const goalType = types[entered.trim().toLowerCase()];
        if (!goalType) return window.alert("Use Open Play, Penalty, Free Kick or Corner.");
        recorded.goalType = goalType;

        if (!goalAllowsAssist(goalType)) {
          delete recorded.assistPlayerId;
        } else {
          const names = state.squadIds.map(id => playerName(id)).join(", ");
          const assist = window.prompt(
            `Assist (blank for none)\n\nSquad: ${names}`,
            recorded.assistPlayerId ? playerName(recorded.assistPlayerId) : ""
          );
          if (assist === null) return;
          if (!assist.trim()) delete recorded.assistPlayerId;
          else {
            const assistId = state.squadIds.find(id => playerName(id).toLowerCase() === assist.trim().toLowerCase());
            if (!assistId || assistId === recorded.playerId) return window.alert("Assist player not recognised.");
            recorded.assistPlayerId = assistId;
          }
        }
      } else if (recorded.type === "Card") {
        const current = recorded.cardType === "Yellow" ? "Yellow Card" : recorded.cardType === "Red" ? "Red Card" : "Sin Bin";
        const entered = window.prompt("Type: Yellow Card, Red Card or Sin Bin", current);
        if (entered === null) return;
        const map = { "yellow card": "Yellow", "red card": "Red", "sin bin": "Sin Bin" };
        const mapped = map[entered.trim().toLowerCase()];
        if (!mapped) return window.alert("Use Yellow Card, Red Card or Sin Bin.");
        recorded.cardType = mapped;
      } else {
        const text = window.prompt("Event", recorded.text || "");
        if (text === null) return;
        if (!text.trim()) return window.alert("Event cannot be blank.");
        recorded.text = text.trim();
      }
    }

    saveState();
    renderLive();
    if (typeof saveRecovery === "function") saveRecovery("event-correction");
  };

  // Keep substitution rendering from core, but render all Match events in one place.
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
        row.append(span, spanner(text, () => editEvent(index), () => deleteEvent(index)));
        records.appendChild(row);
      });
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
