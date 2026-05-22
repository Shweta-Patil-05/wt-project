const joinBtn = document.getElementById("joinBtn");
const roomInput = document.getElementById("roomId");
const statusMessage = document.getElementById("statusMessage");

function showMessage(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = "status-message " + type;
}

joinBtn.addEventListener("click", () => {
  const roomId = roomInput.value.trim();

  if (!roomId) {
    showMessage("Please enter a room ID.", "error");
    return;
  }

  showMessage("Joining room...", "success");

  // Redirect to game page with room ID
  setTimeout(() => {
    window.location.href = `/index.html?room=${roomId}`;
  }, 800);
});