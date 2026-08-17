// Legacy compatibility file.
// Matchday v3 now lives entirely in matchday.js.
// Keep only the first-page user toggle behaviour here until index.html is tidied.
(() => {
  const container = document.getElementById("user-options");
  if (!container) return;

  container.addEventListener("click", (event) => {
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
})();
