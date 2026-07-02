const TRAINING_STATUSES = ["Present", "Late", "Absent", "Injured"];
const MATCH_STATUSES = ["Present", "Late", "No Show", "Unavailable", "Injured", "Rotated"];
const STORAGE_KEY = "welling-red-attendance-v1";
const USER_STORAGE_KEY = "welling-red-attendance-user-v1";
const ADMIN_STORAGE_KEY = "welling-red-attendance-admin-unlocked-v1";

const APP_USERS = [
  { name: "Dan", role: "admin" },
  { name: "John", role: "manager" },
  { name: "Joe", role: "manager" },
  { name: "Ryan", role: "manager" }
];

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
const successMessageElement = document.getElementById("success-message");
const successMessageTextElement = document.getElementById("success-message-text");
const successOkButton = document.getElementById("success-ok");
const viewSessionsButton = document.getElementById("view-sessions");
const sessionsViewElement = document.getElementById("sessions-view");
const closeSessionsButton = document.getElementById("close-sessions");
const sessionsStatusElement = document.getElementById("sessions-status");
const sessionsListElement = document.getElementById("sessions-list");
const sessionDetailsElement = document.getElementById("session-details");
const userSelectionElement = document.getElementById("user-selection");
const userOptionsElement = document.getElementById("user-options");
const currentUserNameElement = document.getElementById("current-user-name");
const changeUserButton = document.getElementById("change-user");
const adminUnlockButton = document.getElementById("admin-unlock");
const adminToolsElement = document.getElementById("admin-tools");
const exportExcelCsvButton = document.getElementById("export-excel-csv");
const adminLockButton = document.getElementById("admin-lock");

let players = [];
let attendance = {};
let feesPaid = {};
let isSubmitting = false;
let expandedSessionId = null;
let currentUser = null;
let isAdminUnlocked = localStorage.getItem(ADMIN_STORAGE_KEY) === "true";

function todayAsLocalDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function getConfiguredAdminPin() {
  const config = getSupabaseConfig();
  return config.adminPin || "1234";
}

function loadSavedUser() {
  const savedUserName = localStorage.getItem(USER_STORAGE_KEY);
  if (!savedUserName) {
    return null;
  }

  return APP_USERS.find((user) => user.name === savedUserName) || null;
}

function saveSelectedUser(user) {
  currentUser = user;
  localStorage.setItem(USER_STORAGE_KEY, user.name);
  hideUserSelection();
  updateUserUi();
}

function getCurrentUserName() {
  return currentUser ? currentUser.name : "Unknown";
}

function renderUserOptions() {
  userOptionsElement.innerHTML = "";

  APP_USERS.forEach((user) => {
    const button = document.createElement("button");
    const buttonClasses = ["user-option"];

    if (user.role === "admin") {
      buttonClasses.push("admin-user");
    }

    if (currentUser && currentUser.name === user.name) {
      buttonClasses.push("selected-user");
    }

    button.className = buttonClasses.join(" ");
    button.type = "button";
    button.textContent = currentUser && currentUser.name === user.name ? `${user.name} ✓` : user.name;
    button.addEventListener("click", () => saveSelectedUser(user));
    userOptionsElement.appendChild(button);
  });
}

function showUserSelection() {
  renderUserOptions();
  userSelectionElement.classList.remove("hidden");
}

function hideUserSelection() {
  userSelectionElement.classList.add("hidden");
}

function updateUserUi() {
  currentUserNameElement.textContent = currentUser ? `User: ${currentUser.name}` : "No user selected";

  const isAdminUser = currentUser && currentUser.role === "admin";
  adminUnlockButton.classList.toggle("hidden", !isAdminUser);

  if (!isAdminUser) {
    isAdminUnlocked = false;
    localStorage.removeItem(ADMIN_STORAGE_KEY);
  }

  adminToolsElement.classList.toggle("hidden", !(isAdminUser && isAdminUnlocked));
  adminUnlockButton.textContent = isAdminUnlocked ? "Admin ✓" : "Admin";
}

function changeUser() {
  showUserSelection();
}

function unlockAdmin() {
  if (!currentUser || currentUser.role !== "admin") {
    window.alert("Admin tools are only available to Dan.");
    return;
  }

  if (isAdminUnlocked) {
    adminToolsElement.classList.toggle("hidden");
    return;
  }

  const enteredPin = window.prompt("Enter admin PIN");

  if (enteredPin === null) {
    return;
  }

  if (enteredPin !== getConfiguredAdminPin()) {
    window.alert("Incorrect PIN.");
    return;
  }

  isAdminUnlocked = true;
  localStorage.setItem(ADMIN_STORAGE_KEY, "true");
  updateUserUi();
}

function lockAdmin() {
  isAdminUnlocked = false;
  localStorage.removeItem(ADMIN_STORAGE_KEY);
  updateUserUi();
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
      venue: sessionType === "Match" ? matchVenue : null,
      submittedBy: getCurrentUserName()
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

function showSuccessMessage(sessionId) {
  successMessageTextElement.textContent = `Attendance saved to Supabase. Session ${sessionId.slice(0, 8)} has been created and this screen has been cleared.`;
  successMessageElement.classList.remove("hidden");
}

function hideSuccessMessage() {
  successMessageElement.classList.add("hidden");
}

function hasMarkedPlayers() {
  return players
    .filter((player) => player.active)
    .some((player) => Boolean(getPlayerStatusForCurrentSession(player.id)));
}

function resetCurrentSessionMarks() {
  attendance = {};
  feesPaid = {};
  saveSession();
  renderPlayers();
  updateSummary();
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
    submitted_by: data.session.submittedBy,
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
  clearButton.disabled = isBusy;
  viewSessionsButton.disabled = isBusy;
  adminUnlockButton.disabled = isBusy;
  exportExcelCsvButton.disabled = isBusy;
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
  if (isSubmitting) {
    return;
  }

  if (!currentUser) {
    showUserSelection();
    return;
  }

  if (!hasMarkedPlayers()) {
    window.alert("No players have been marked yet.");
    return;
  }

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
    isSubmitting = true;
    setSubmitButtonBusy(true);
    const sessionId = await submitToSupabase(data);
    resetCurrentSessionMarks();
    showSuccessMessage(sessionId);
  } catch (error) {
    console.error(error);
    window.alert("Supabase submit failed. A JSON backup will download now.");
    downloadExportJson(data);
  } finally {
    isSubmitting = false;
    setSubmitButtonBusy(false);
  }
}


function formatSessionTitle(session) {
  const venue = session.venue ? ` - ${session.venue}` : "";
  return `${session.session_date} - ${session.session_type}${venue}`;
}

function countSessionStatuses(records) {
  return records.reduce((counts, record) => {
    counts[record.status] = (counts[record.status] || 0) + 1;
    return counts;
  }, {});
}

function renderStatusCounts(records) {
  const counts = countSessionStatuses(records);
  const entries = Object.entries(counts);

  if (entries.length === 0) {
    return "No records";
  }

  return entries
    .map(([status, count]) => `${status}: ${count}`)
    .join(" · ");
}

function showSessionsView() {
  sessionsViewElement.classList.remove("hidden");
  loadRecentSessions();
}

function hideSessionsView() {
  sessionsViewElement.classList.add("hidden");
  sessionsListElement.innerHTML = "";
  sessionDetailsElement.innerHTML = "";
  expandedSessionId = null;
}

function setSessionsStatus(message) {
  sessionsStatusElement.textContent = message;
}

async function loadRecentSessions() {
  if (!isSupabaseConfigured()) {
    sessionsListElement.innerHTML = "";
    sessionDetailsElement.innerHTML = "";
    setSessionsStatus("Supabase is not configured, so recent sessions cannot be loaded.");
    return;
  }

  setSessionsStatus("Loading recent sessions...");
  sessionsListElement.innerHTML = "";
  sessionDetailsElement.innerHTML = "";
  expandedSessionId = null;

  try {
    const supabaseClient = getSupabaseClient();
    const { data: sessions, error } = await supabaseClient
      .from("attendance_sessions")
      .select("id, session_date, session_type, venue, submitted_by, submitted_at")
      .order("submitted_at", { ascending: false })
      .limit(10);

    if (error) {
      throw error;
    }

    if (!sessions || sessions.length === 0) {
      setSessionsStatus("No submitted sessions found yet.");
      return;
    }

    setSessionsStatus("Tap a session to view the player records.");

    sessions.forEach((session) => {
      const sessionItem = document.createElement("div");
      sessionItem.className = "session-item";

      const button = document.createElement("button");
      button.className = "session-row";
      button.type = "button";
      button.setAttribute("aria-expanded", "false");

      const title = document.createElement("span");
      title.className = "session-row-title";
      title.textContent = formatSessionTitle(session);

      const meta = document.createElement("span");
      meta.className = "session-row-meta";
      const submittedBy = session.submitted_by ? ` by ${session.submitted_by}` : "";
      meta.textContent = `Submitted${submittedBy} · ${new Date(session.submitted_at).toLocaleString()}`;

      const details = document.createElement("div");
      details.className = "session-details inline hidden";
      details.id = `session-details-${session.id}`;

      button.appendChild(title);
      button.appendChild(meta);
      button.addEventListener("click", () => toggleSessionDetails(session, sessionItem, button, details));

      sessionItem.appendChild(button);
      sessionItem.appendChild(details);
      sessionsListElement.appendChild(sessionItem);
    });
  } catch (error) {
    console.error(error);
    setSessionsStatus("Could not load recent sessions. Check Supabase settings or table columns.");
  }
}

function collapseExpandedSession() {
  if (!expandedSessionId) {
    return;
  }

  const openDetails = document.getElementById(`session-details-${expandedSessionId}`);
  const openButton = document.querySelector(`[data-session-id="${expandedSessionId}"]`);

  if (openDetails) {
    openDetails.classList.add("hidden");
    openDetails.innerHTML = "";
  }

  if (openButton) {
    openButton.classList.remove("selected");
    openButton.setAttribute("aria-expanded", "false");
  }

  expandedSessionId = null;
}

async function toggleSessionDetails(session, sessionItem, button, detailsElement) {
  button.dataset.sessionId = session.id;

  if (expandedSessionId === session.id && !detailsElement.classList.contains("hidden")) {
    collapseExpandedSession();
    return;
  }

  collapseExpandedSession();

  expandedSessionId = session.id;
  button.classList.add("selected");
  button.setAttribute("aria-expanded", "true");
  detailsElement.classList.remove("hidden");
  detailsElement.innerHTML = `<p class="sessions-status">Loading ${formatSessionTitle(session)}...</p>`;

  await loadSessionDetails(session, detailsElement);
}

async function loadSessionDetails(session, targetElement) {
  try {
    const supabaseClient = getSupabaseClient();
    const { data: records, error } = await supabaseClient
      .from("attendance_records")
      .select("player_id, display_name, status, fee_paid, payment_status, late_payment")
      .eq("session_id", session.id)
      .order("display_name", { ascending: true });

    if (error) {
      throw error;
    }

    const detailTitle = document.createElement("h3");
    detailTitle.textContent = formatSessionTitle(session);

    const summary = document.createElement("p");
    summary.className = "detail-summary";
    summary.textContent = `${records.length} player records · ${renderStatusCounts(records)}`;

    const list = document.createElement("div");
    list.className = "record-list";

    records.forEach((record) => {
      const row = document.createElement("div");
      row.className = "record-row";

      const name = document.createElement("span");
      name.className = "record-name";
      name.textContent = record.display_name;

      const status = document.createElement("span");
      status.className = `record-status record-${record.status.toLowerCase().replace(/\s+/g, "-")}`;
      status.textContent = record.status;

      row.appendChild(name);
      row.appendChild(status);

      if (record.payment_status) {
        const payment = document.createElement("span");
        payment.className = record.fee_paid ? "record-payment paid" : "record-payment not-paid";
        payment.textContent = record.fee_paid ? "Paid" : "Not Paid";
        row.appendChild(payment);
      }

      list.appendChild(row);
    });

    targetElement.innerHTML = "";
    targetElement.appendChild(detailTitle);
    targetElement.appendChild(summary);
    targetElement.appendChild(list);
  } catch (error) {
    console.error(error);
    targetElement.innerHTML = `<p class="sessions-status error">Could not load player records. Check Supabase select policies for attendance_records.</p>`;
  }
}


function csvEscape(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  if (stringValue.includes('"') || stringValue.includes(",") || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function downloadCsv(filename, rows) {
  // The BOM at the start helps Excel open UTF-8 CSV files cleanly.
  const csv = `\uFEFF${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function makeSessionKey(session) {
  const datePart = session.session_date || "unknown-date";
  const typePart = (session.session_type || "session").toLowerCase();
  const venuePart = (session.venue || "na").toLowerCase();

  return `${datePart}-${typePart}-${venuePart}-${String(session.id).slice(0, 8)}`;
}

function makeAttendanceRecordKey(session, record) {
  return `${makeSessionKey(session)}-${record.player_id}`;
}

function yesNoBlank(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return value ? "Yes" : "No";
}

async function exportExcelCsv() {
  if (!isAdminUnlocked || !currentUser || currentUser.role !== "admin") {
    window.alert("Unlock admin tools first.");
    return;
  }

  if (!isSupabaseConfigured()) {
    window.alert("Supabase is not configured, so the Excel CSV cannot be exported.");
    return;
  }

  try {
    exportExcelCsvButton.disabled = true;
    exportExcelCsvButton.textContent = "Exporting...";

    const supabaseClient = getSupabaseClient();
    const { data: sessions, error: sessionsError } = await supabaseClient
      .from("attendance_sessions")
      .select("id, session_date, session_type, venue, submitted_by, submitted_at")
      .order("submitted_at", { ascending: false });

    if (sessionsError) {
      throw sessionsError;
    }

    if (!sessions || sessions.length === 0) {
      window.alert("There are no sessions to export yet.");
      return;
    }

    const sessionIds = sessions.map((session) => session.id);
    const { data: records, error: recordsError } = await supabaseClient
      .from("attendance_records")
      .select("session_id, player_id, display_name, status, fee_paid, payment_status, late_payment")
      .in("session_id", sessionIds);

    if (recordsError) {
      throw recordsError;
    }

    const sessionsById = sessions.reduce((lookup, session) => {
      lookup[session.id] = session;
      return lookup;
    }, {});

    const rows = [[
      "RecordKey",
      "SessionKey",
      "SessionId",
      "SessionDate",
      "SessionType",
      "Venue",
      "PlayerId",
      "DisplayName",
      "Status",
      "FeePaid",
      "PaymentStatus",
      "LatePayment",
      "SubmittedBy",
      "SubmittedAt",
      "Source"
    ]];

    const sortedRecords = (records || [])
      .filter((record) => sessionsById[record.session_id])
      .sort((a, b) => {
        const sessionA = sessionsById[a.session_id];
        const sessionB = sessionsById[b.session_id];
        const dateCompare = String(sessionA.session_date || "").localeCompare(String(sessionB.session_date || ""));

        if (dateCompare !== 0) {
          return dateCompare;
        }

        const submittedCompare = String(sessionA.submitted_at || "").localeCompare(String(sessionB.submitted_at || ""));

        if (submittedCompare !== 0) {
          return submittedCompare;
        }

        return String(a.display_name || "").localeCompare(String(b.display_name || ""));
      });

    sortedRecords.forEach((record) => {
      const session = sessionsById[record.session_id];

      rows.push([
        makeAttendanceRecordKey(session, record),
        makeSessionKey(session),
        record.session_id,
        session.session_date,
        session.session_type,
        session.venue || "",
        record.player_id,
        record.display_name,
        record.status,
        yesNoBlank(record.fee_paid),
        record.payment_status || "",
        yesNoBlank(record.late_payment),
        session.submitted_by || "",
        session.submitted_at || "",
        "App"
      ]);
    });

    downloadCsv(`welling-attendance-excel-${todayAsLocalDate()}.csv`, rows);
    showSuccessMessage("Excel CSV exported.");
  } catch (error) {
    console.error(error);
    window.alert("Could not export Excel CSV. Check Supabase select policies and table columns.");
  } finally {
    exportExcelCsvButton.disabled = false;
    exportExcelCsvButton.textContent = "Export Excel CSV";
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
  currentUser = loadSavedUser();
  updateUserUi();
  showUserSelection();

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
  successOkButton.addEventListener("click", hideSuccessMessage);
  viewSessionsButton.addEventListener("click", showSessionsView);
  closeSessionsButton.addEventListener("click", hideSessionsView);
  clearButton.addEventListener("click", clearSession);
  changeUserButton.addEventListener("click", changeUser);
  adminUnlockButton.addEventListener("click", unlockAdmin);
  adminLockButton.addEventListener("click", lockAdmin);
  exportExcelCsvButton.addEventListener("click", exportExcelCsv);
}

init();
