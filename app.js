const STATUSES = ["Present", "Absent", "Late", "Injured", "Holiday", "Trialist"];
const STORAGE_KEY = "welling-red-attendance-v1";

const playerListElement = document.getElementById("player-list");
const sessionDateElement = document.getElementById("session-date");
const sessionTypeElement = document.getElementById("session-type");
const sessionNotesElement = document.getElementById("session-notes");
const exportButton = document.getElementById("export-json");
const clearButton = document.getElementById("clear-session");
const summaryTotalElement = document.getElementById("summary-total");
const summaryPresentElement = document.getElementById("summary-present");
const summaryMissingElement = document.getElementById("summary-missing");

let players = [];
let attendance = {};

function todayAsInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function loadSavedSession() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return {
      date: todayAsInputDate(),
      type: "Training",
      notes: "",
      attendance: {}
    };
  }

  return JSON.parse(saved);
}

function saveSession() {
  const session = {
    date: sessionDateElement.value,
    type: sessionTypeElement.value,
    notes: sessionNotesElement.value,
    attendance
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function setPlayerStatus(playerId, status) {
  attendance[playerId] = status;
  saveSession();
  renderPlayers();
  updateSummary();
}

function renderPlayers() {
  playerListElement.innerHTML = "";

  players
    .filter((player) => player.active)
    .forEach((player) => {
      const card = document.createElement("article");
      card.className = "player-card";

      const name = document.createElement("div");
      name.className = "player-name";
      name.textContent = player.displayName;

      const buttonGrid = document.createElement("div");
      buttonGrid.className = "status-buttons";

      STATUSES.forEach((status) => {
        const button = document.createElement("button");
        button.className = "status-button";
        button.type = "button";
        button.textContent = status;

        if (attendance[player.id] === status) {
          button.classList.add("selected");
        }

        button.addEventListener("click", () => setPlayerStatus(player.id, status));
        buttonGrid.appendChild(button);
      });

      card.appendChild(name);
      card.appendChild(buttonGrid);
      playerListElement.appendChild(card);
    });
}

function updateSummary() {
  const activePlayers = players.filter((player) => player.active);
  const presentCount = activePlayers.filter((player) => {
    return attendance[player.id] === "Present" || attendance[player.id] === "Late";
  }).length;
  const markedCount = activePlayers.filter((player) => attendance[player.id]).length;
  const missingCount = activePlayers.length - presentCount;

  summaryTotalElement.textContent = `${activePlayers.length} players`;
  summaryPresentElement.textContent = `${presentCount} present`;
  summaryMissingElement.textContent = `${missingCount} missing`;
}

function buildExportData() {
  return {
    team: "Welling United Red OBDSFL",
    season: "2026/27",
    session: {
      date: sessionDateElement.value,
      type: sessionTypeElement.value,
      notes: sessionNotesElement.value
    },
    attendance: players
      .filter((player) => player.active)
      .map((player) => ({
        playerId: player.id,
        displayName: player.displayName,
        status: attendance[player.id] || "Unmarked"
      }))
  };
}

function exportJson() {
  const data = buildExportData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `attendance-${sessionDateElement.value}.json`;
  link.click();

  URL.revokeObjectURL(url);
}

function clearSession() {
  const confirmed = window.confirm("Clear all attendance marks for this session?");

  if (!confirmed) {
    return;
  }

  attendance = {};
  sessionNotesElement.value = "";
  saveSession();
  renderPlayers();
  updateSummary();
}

async function init() {
  const savedSession = loadSavedSession();

  sessionDateElement.value = savedSession.date || todayAsInputDate();
  sessionTypeElement.value = savedSession.type || "Training";
  sessionNotesElement.value = savedSession.notes || "";
  attendance = savedSession.attendance || {};

  const response = await fetch("players.json");
  players = await response.json();

  renderPlayers();
  updateSummary();

  sessionDateElement.addEventListener("change", saveSession);
  sessionTypeElement.addEventListener("change", saveSession);
  sessionNotesElement.addEventListener("input", saveSession);
  exportButton.addEventListener("click", exportJson);
  clearButton.addEventListener("click", clearSession);
}

init();
