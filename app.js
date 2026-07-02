const TRAINING_STATUSES = ["Present", "Late", "Absent", "Injured"];
const MATCH_STATUSES = ["Present", "Late", "No Show", "Unavailable", "Injured", "Rotated"];
const STORAGE_KEY = "welling-red-attendance-v1";

const playerListElement = document.getElementById("player-list");
const sessionTypeElements = document.querySelectorAll('input[name="session-type"]');
const matchVenueElements = document.querySelectorAll('input[name="match-venue"]');
const matchVenueOptionsElement = document.getElementById("match-venue-options");
const exportButton = document.getElementById("export-json");
const clearButton = document.getElementById("clear-session");
const summaryTotalElement = document.getElementById("summary-total");
const summaryPresentElement = document.getElementById("summary-present");
const summaryMissingElement = document.getElementById("summary-missing");
const unpaidWarningElement = document.getElementById("unpaid-warning");
const unpaidPlayerListElement = document.getElementById("unpaid-player-list");
const continueSubmitButton = document.getElementById("continue-submit");
const cancelSubmitButton = document.getElementById("cancel-submit");

let players = [];
let attendance = {};
let feesPaid = {};

function todayAsLocalDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getSelectedSessionType() {
  const checkedSessionType = document.querySelector('input[name="session-type"]:checked');
  return checkedSessionType ? checkedSessionType.value : "Training";
}

function getSelectedMatchVenue() {
  const checkedMatchVenue = document.querySelector('input[name="match-venue"]:checked');
  return checkedMatchVenue ? checkedMatchVenue.value : "Home";
}

function isMatch() {
  return getSelectedSessionType() === "Match";
}

function isHomeMatch() {
  return getSelectedSessionType() === "Match" && getSelectedMatchVenue() === "Home";
}

function setSelectedSessionType(sessionType) {
  sessionTypeElements.forEach((element) => {
    element.checked = element.value === sessionType;
  });
}

function setSelectedMatchVenue(matchVenue) {
  matchVenueElements.forEach((element) => {
    element.checked = element.value === matchVenue;
  });
}

function updateMatchVenueVisibility() {
  const isMatch = getSelectedSessionType() === "Match";
  matchVenueOptionsElement.classList.toggle("hidden", !isMatch);
}

function loadSavedSession() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return {
      type: "Training",
      venue: "Home",
      attendance: {},
      feesPaid: {}
    };
  }

  return JSON.parse(saved);
}

function saveSession() {
  const session = {
    type: getSelectedSessionType(),
    venue: getSelectedMatchVenue(),
    attendance,
    feesPaid
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function cleanUpFeesPaid() {
  Object.keys(feesPaid).forEach((playerId) => {
    if (!shouldShowFeePaidButton(playerId)) {
      delete feesPaid[playerId];
    }
  });
}

function setPlayerStatus(playerId, status) {
  attendance[playerId] = status;

  if (!shouldTrackFeeForStatus(status)) {
    delete feesPaid[playerId];
  }

  saveSession();
  renderPlayers();
  updateSummary();
}

function toggleFeePaid(playerId) {
  feesPaid[playerId] = !feesPaid[playerId];
  saveSession();
  renderPlayers();
}

function getVisibleStatuses() {
  return isMatch() ? MATCH_STATUSES : TRAINING_STATUSES;
}

function getPlayerStatusForCurrentSession(playerId) {
  const status = attendance[playerId];

  if (isMatch() && status === "Absent") {
    return "No Show";
  }

  if (!isMatch() && status === "No Show") {
    return "Absent";
  }

  return status;
}

function shouldTrackFeeForStatus(status) {
  return status === "Present" || status === "Late";
}

function shouldShowFeePaidButton(playerId) {
  return isHomeMatch() && shouldTrackFeeForStatus(getPlayerStatusForCurrentSession(playerId));
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

      const visibleStatuses = getVisibleStatuses();
      const showFeePaid = shouldShowFeePaidButton(player.id);
      const buttonCount = visibleStatuses.length + (showFeePaid ? 1 : 0);
      buttonGrid.style.setProperty("--button-count", buttonCount);
      buttonGrid.classList.add(`button-count-${buttonCount}`);

      visibleStatuses.forEach((status) => {
        const button = document.createElement("button");
        button.className = "status-button";
        button.classList.add(`status-${status.toLowerCase().replace(/\s+/g, "-")}`);
        button.type = "button";
        button.textContent = status;

        if (getPlayerStatusForCurrentSession(player.id) === status) {
          button.classList.add("selected");
        }

        button.addEventListener("click", () => setPlayerStatus(player.id, status));
        buttonGrid.appendChild(button);
      });

      if (showFeePaid) {
        const feeButton = document.createElement("button");
        feeButton.className = "fee-paid-button";
        feeButton.type = "button";
        feeButton.textContent = feesPaid[player.id] ? "Paid ✓" : "Paid";
        feeButton.title = feesPaid[player.id] ? "Fee Paid" : "Fee Not Paid";

        if (feesPaid[player.id]) {
          feeButton.classList.add("selected");
        }

        feeButton.addEventListener("click", () => toggleFeePaid(player.id));
        buttonGrid.appendChild(feeButton);
      }

      card.appendChild(name);
      card.appendChild(buttonGrid);
      playerListElement.appendChild(card);
    });
}

function updateSummary() {
  const activePlayers = players.filter((player) => player.active);
  const presentCount = activePlayers.filter((player) => {
    const status = getPlayerStatusForCurrentSession(player.id);
    return status === "Present" || status === "Late";
  }).length;
  const missingCount = activePlayers.length - presentCount;

  summaryTotalElement.textContent = `${activePlayers.length} players`;
  summaryPresentElement.textContent = `${presentCount} present`;
  summaryMissingElement.textContent = `${missingCount} missing`;
}

function buildExportData() {
  const exportDate = todayAsLocalDate();
  const sessionType = getSelectedSessionType();
  const matchVenue = getSelectedMatchVenue();
  const includeFeePaid = sessionType === "Match" && matchVenue === "Home";

  return {
    team: "Welling United Red OBDSFL",
    season: "2026/27",
    session: {
      date: exportDate,
      type: sessionType,
      venue: sessionType === "Match" ? matchVenue : null
    },
    attendance: players
      .filter((player) => player.active)
      .map((player) => {
        const record = {
          playerId: player.id,
          displayName: player.displayName,
          status: getPlayerStatusForCurrentSession(player.id) || "Unmarked"
        };

        if (includeFeePaid && shouldTrackFeeForStatus(record.status)) {
          const feePaid = Boolean(feesPaid[player.id]);
          record.feePaid = feePaid;
          record.paymentStatus = feePaid ? "Paid" : "Not Paid";

          if (!feePaid) {
            record.latePayment = true;
          }
        }

        return record;
      })
  };
}

function getUnpaidHomeMatchPlayers() {
  if (!isHomeMatch()) {
    return [];
  }

  return players
    .filter((player) => player.active)
    .filter((player) => {
      const status = getPlayerStatusForCurrentSession(player.id);
      return shouldTrackFeeForStatus(status) && !feesPaid[player.id];
    });
}

function showUnpaidWarning(unpaidPlayers) {
  unpaidPlayerListElement.innerHTML = "";

  unpaidPlayers.forEach((player) => {
    const listItem = document.createElement("li");
    listItem.textContent = player.displayName;
    unpaidPlayerListElement.appendChild(listItem);
  });

  unpaidWarningElement.classList.remove("hidden");
}

function hideUnpaidWarning() {
  unpaidWarningElement.classList.add("hidden");
}

function downloadExportJson(data = buildExportData()) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const exportDate = data.session.date;
  const sessionType = data.session.type.toLowerCase();
  const venue = data.session.venue ? `-${data.session.venue.toLowerCase()}` : "";

  const link = document.createElement("a");
  link.href = url;
  link.download = `attendance-${exportDate}-${sessionType}${venue}.json`;
  link.click();

  URL.revokeObjectURL(url);
}

function getSupabaseConfig() {
  return window.WELLING_SUPABASE_CONFIG || { url: "", anonKey: "" };
}

function isSupabaseConfigured() {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.anonKey && window.supabase);
}

function getSupabaseClient() {
  const config = getSupabaseConfig();
  return window.supabase.createClient(config.url, config.anonKey);
}

function buildSessionRow(data) {
  return {
    team: data.team,
    season: data.season,
    session_date: data.session.date,
    session_type: data.session.type,
    venue: data.session.venue,
    payload: data
  };
}

function buildRecordRows(sessionId, data) {
  return data.attendance.map((record) => ({
    session_id: sessionId,
    player_id: record.playerId,
    display_name: record.displayName,
    status: record.status,
    fee_paid: typeof record.feePaid === "boolean" ? record.feePaid : null,
    payment_status: record.paymentStatus || null,
    late_payment: Boolean(record.latePayment)
  }));
}

function setSubmitButtonBusy(isBusy) {
  exportButton.disabled = isBusy;
  exportButton.textContent = isBusy ? "Submitting..." : "Submit";
}

async function submitToSupabase(data) {
  const supabaseClient = getSupabaseClient();

  const { data: insertedSession, error: sessionError } = await supabaseClient
    .from("attendance_sessions")
    .insert(buildSessionRow(data))
    .select("id")
    .single();

  if (sessionError) {
    throw sessionError;
  }

  const recordRows = buildRecordRows(insertedSession.id, data);

  const { error: recordsError } = await supabaseClient
    .from("attendance_records")
    .insert(recordRows);

  if (recordsError) {
    throw recordsError;
  }

  return insertedSession.id;
}

async function submitAttendance({ force = false } = {}) {
  const unpaidPlayers = getUnpaidHomeMatchPlayers();

  if (!force && unpaidPlayers.length > 0) {
    showUnpaidWarning(unpaidPlayers);
    return;
  }

  const data = buildExportData();

  if (!isSupabaseConfigured()) {
    downloadExportJson(data);
    window.alert("Supabase is not configured yet, so a JSON file has been downloaded instead.");
    return;
  }

  try {
    setSubmitButtonBusy(true);
    await submitToSupabase(data);
    window.alert("Attendance submitted to Supabase.");
  } catch (error) {
    console.error(error);
    window.alert("Supabase submit failed. A JSON backup will download now.");
    downloadExportJson(data);
  } finally {
    setSubmitButtonBusy(false);
  }
}

function clearSession() {
  const confirmed = window.confirm("Clear all attendance marks and fee paid marks for this session?");

  if (!confirmed) {
    return;
  }

  attendance = {};
  feesPaid = {};
  saveSession();
  renderPlayers();
  updateSummary();
}

async function init() {
  const savedSession = loadSavedSession();

  setSelectedSessionType(savedSession.type || "Training");
  setSelectedMatchVenue(savedSession.venue || "Home");
  attendance = savedSession.attendance || {};
  feesPaid = savedSession.feesPaid || {};
  updateMatchVenueVisibility();

  const response = await fetch("players.json");
  players = await response.json();

  renderPlayers();
  updateSummary();

  sessionTypeElements.forEach((element) => {
    element.addEventListener("change", () => {
      updateMatchVenueVisibility();
      cleanUpFeesPaid();
      saveSession();
      renderPlayers();
    });
  });

  matchVenueElements.forEach((element) => {
    element.addEventListener("change", () => {
      cleanUpFeesPaid();
      saveSession();
      renderPlayers();
    });
  });

  exportButton.addEventListener("click", () => submitAttendance());
  continueSubmitButton.addEventListener("click", () => {
    hideUnpaidWarning();
    submitAttendance({ force: true });
  });
  cancelSubmitButton.addEventListener("click", hideUnpaidWarning);
  clearButton.addEventListener("click", clearSession);
}

init();
