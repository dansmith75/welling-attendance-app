// Matchday free-text player events.
// Extends the existing Matchday event payload without changing its Supabase schema.
(() => {
  const eventSection = document.querySelector("#matchday-live .matchday-live-section:nth-of-type(3)");
  const eventList = document.getElementById("matchday-event-list");

  if (!eventSection || !eventList || typeof state === "undefined") return;

  const card = document.createElement("div");
  card.className = "matchday-event-card";
  card.innerHTML = `
    <strong>📝 Player Event</strong>
    <div class="matchday-event-grid">
      <label>
        Player
        <select id="matchday-note-player" class="matchday-select"></select>
      </label>
      <label style="grid-column: 1 / -1;">
        Event
        <textarea id="matchday-note-text" class="matchday-input" rows="3" placeholder="e.g. Fell over his own feet"></textarea>
      </label>
    </div>
    <button id="matchday-add-note" class="secondary-button matchday-wide" type="button">Record Event</button>
  `;

  eventSection.insertBefore(card, eventList);

  const notePlayer = document.getElementById("matchday-note-player");
  const noteText = document.getElementById("matchday-note-text");
  const addNote = document.getElementById("matchday-add-note");

  function renderNotePlayers() {
    if (typeof fillSelect !== "function") return;
    fillSelect(notePlayer, state.squadIds || []);
  }

  const originalRenderEventControls = renderEventControls;
  renderEventControls = function () {
    originalRenderEventControls();
    renderNotePlayers();
  };

  const originalRenderLists = renderLists;
  renderLists = function () {
    originalRenderLists();

    eventList.innerHTML = "";
    [...state.events].sort((a, b) => (a.minute || 0) - (b.minute || 0)).forEach((e) => {
      const row = document.createElement("div");
      row.className = "matchday-event-row";

      if (e.type === "Goal") {
        const assist = e.assistPlayerId ? ` · Assist: ${playerName(e.assistPlayerId)}` : "";
        row.innerHTML = `<span>${e.minute}'</span><span>⚽ ${playerName(e.playerId)} · ${e.goalType}${assist}</span>`;
      } else if (e.type === "Card") {
        const icon = e.cardType === "Yellow" ? "🟨" : e.cardType === "Red" ? "🟥" : "⏱️";
        row.innerHTML = `<span>${e.minute}'</span><span>${icon} ${playerName(e.playerId)} · ${e.cardType}</span>`;
      } else if (e.type === "Note") {
        row.innerHTML = `<span>${e.minute}'</span><span>📝 ${playerName(e.playerId)} · ${e.text}</span>`;
      }

      eventList.appendChild(row);
    });
  };

  addNote.addEventListener("click", () => {
    if (typeof syncLateArrivals === "function") syncLateArrivals();

    const playerId = notePlayer.value;
    const text = noteText.value.trim();

    if (!playerId) {
      window.alert("Choose the player for this event.");
      return;
    }

    if (!text) {
      window.alert("Enter the event text first.");
      noteText.focus();
      return;
    }

    state.events.push({
      type: "Note",
      playerId,
      minute: typeof matchMinute === "function" ? matchMinute() : 0,
      text
    });

    saveState();
    noteText.value = "";
    renderLive();
  });

  renderNotePlayers();
})();

// A completed Matchday must be recoverable if the manager has poor signal at
// Full Time. The session already remains in localStorage; this adds an obvious
// retry action so it can still reach Supabase later and therefore Excel.
(() => {
  const resetButton = document.getElementById("matchday-reset");
  const saveStatus = document.getElementById("matchday-save-status");
  if (!resetButton || !saveStatus || typeof state === "undefined") return;

  const retryButton = document.createElement("button");
  retryButton.id = "matchday-retry-save";
  retryButton.type = "button";
  retryButton.className = "primary-button matchday-wide hidden";
  retryButton.textContent = "Retry Save to Supabase";
  resetButton.parentNode.insertBefore(retryButton, resetButton);

  function updateRetryVisibility() {
    retryButton.classList.toggle("hidden", state.status !== "finished" || Boolean(state.supabaseId));
  }

  const originalRenderFinished = renderFinished;
  renderFinished = function () {
    originalRenderFinished();
    updateRetryVisibility();
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
      updateRetryVisibility();
    } catch (error) {
      console.error(error);
      saveStatus.textContent = "Save failed again. Matchday is still safe on this device; retry when connected.";
    } finally {
      retryButton.disabled = false;
      retryButton.textContent = "Retry Save to Supabase";
    }
  });

  updateRetryVisibility();
})();
