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

    // Rebuild only the main event list so free-text notes render correctly as well.
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

  // Populate immediately if Matchday is already open.
  renderNotePlayers();
})();