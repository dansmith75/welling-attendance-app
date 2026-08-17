// Matchday free-text player events and completed-save retry.
// This file extends the existing Matchday payload without changing Supabase schema.
(() => {
  const eventList = document.getElementById("matchday-event-list");
  const eventSection = eventList?.closest(".matchday-live-section");

  if (!eventSection || !eventList) {
    console.error("Matchday notes: Match events section not found.");
    return;
  }

  // Create the free-text card in a deterministic location: immediately before
  // the recorded event list. This avoids relying on nth-of-type selectors.
  let noteCard = document.getElementById("matchday-note-card");
  if (!noteCard) {
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
        <label style="grid-column: 1 / -1;">
          Event / note
          <textarea id="matchday-note-text" class="matchday-input" rows="3" placeholder="e.g. Fell over his own feet"></textarea>
        </label>
      </div>
      <button id="matchday-add-note" class="secondary-button matchday-wide" type="button">Record Event</button>
    `;
    eventSection.insertBefore(noteCard, eventList);
  }

  const notePlayer = document.getElementById("matchday-note-player");
  const noteText = document.getElementById("matchday-note-text");
  const addNote = document.getElementById("matchday-add-note");

  function currentSquadIds() {
    try {
      return Array.isArray(state?.squadIds) ? state.squadIds : [];
    } catch {
      return [];
    }
  }

  function renderNotePlayers() {
    if (!notePlayer) return;
    const previous = notePlayer.value;
    notePlayer.innerHTML = "";

    currentSquadIds().forEach((id) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = typeof playerName === "function" ? playerName(id) : id;
      notePlayer.appendChild(option);
    });

    if ([...notePlayer.options].some((option) => option.value === previous)) {
      notePlayer.value = previous;
    }
  }

  function renderAllEventsWithNotes() {
    if (!eventList) return;
    eventList.innerHTML = "";

    const events = (() => {
      try {
        return Array.isArray(state?.events) ? [...state.events] : [];
      } catch {
        return [];
      }
    })();

    events.sort((a, b) => (a.minute || 0) - (b.minute || 0)).forEach((e) => {
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
  }

  // Hook into Matchday rendering so the player dropdown also picks up late arrivals
  // and free-text events remain visible alongside goals/cards.
  try {
    const originalRenderEventControls = renderEventControls;
    renderEventControls = function () {
      originalRenderEventControls();
      renderNotePlayers();
    };

    const originalRenderLists = renderLists;
    renderLists = function () {
      originalRenderLists();
      renderAllEventsWithNotes();
    };
  } catch (error) {
    console.error("Matchday notes: could not hook Matchday render functions", error);
  }

  addNote?.addEventListener("click", () => {
    try {
      if (typeof syncLateArrivals === "function") syncLateArrivals();

      const playerId = notePlayer?.value || "";
      const text = noteText?.value.trim() || "";

      if (!playerId) {
        window.alert("Choose the player for this event.");
        return;
      }

      if (!text) {
        window.alert("Enter the event text first.");
        noteText?.focus();
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
    } catch (error) {
      console.error("Matchday notes: could not record event", error);
      window.alert("Could not record this event. Please try again.");
    }
  });

  renderNotePlayers();
  renderAllEventsWithNotes();
})();

// A completed Matchday must be recoverable if the manager has poor signal at
// Full Time. The session remains in localStorage; this adds an obvious retry.
(() => {
  const resetButton = document.getElementById("matchday-reset");
  const saveStatus = document.getElementById("matchday-save-status");
  if (!resetButton || !saveStatus) return;

  const retryButton = document.createElement("button");
  retryButton.id = "matchday-retry-save";
  retryButton.type = "button";
  retryButton.className = "primary-button matchday-wide hidden";
  retryButton.textContent = "Retry Save to Supabase";
  resetButton.parentNode.insertBefore(retryButton, resetButton);

  function updateRetryVisibility() {
    try {
      retryButton.classList.toggle("hidden", state.status !== "finished" || Boolean(state.supabaseId));
    } catch {
      retryButton.classList.add("hidden");
    }
  }

  try {
    const originalRenderFinished = renderFinished;
    renderFinished = function () {
      originalRenderFinished();
      updateRetryVisibility();
      if (state.status === "finished" && !state.supabaseId) {
        saveStatus.textContent = "Not yet saved centrally. Retry when you have a data connection.";
      }
    };
  } catch (error) {
    console.error("Matchday retry: could not hook finished render", error);
  }

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
