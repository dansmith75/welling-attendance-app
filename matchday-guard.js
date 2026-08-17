// Matchday starting-lineup guard.
// Hard limit: maximum 11 starters. Fewer than 11 remains allowed.
(() => {
  const MAX_STARTERS = 11;
  const starterList = document.getElementById("matchday-starter-list");
  const startButton = document.getElementById("matchday-start");

  if (!starterList || !startButton) return;

  function selectedStarterCount() {
    return starterList.querySelectorAll('input[type="checkbox"]:checked').length;
  }

  // Capture the change before matchday.js adds the player to state.starterIds.
  starterList.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "checkbox" || !input.checked) return;

    if (selectedStarterCount() > MAX_STARTERS) {
      event.stopImmediatePropagation();
      input.checked = false;
      window.alert("Starting lineup is limited to a maximum of 11 players.");
      return;
    }
  }, true);

  // Secondary safety check. This also catches an older saved Matchday state
  // that may already contain more than 11 starters.
  document.addEventListener("click", (event) => {
    if (event.target !== startButton) return;

    if (typeof state !== "undefined" && Array.isArray(state.starterIds) && state.starterIds.length > MAX_STARTERS) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.alert(`You currently have ${state.starterIds.length} starters selected. Reduce the starting lineup to 11 or fewer.`);
    }
  }, true);
})();
