const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const statusMessage = document.getElementById("statusMessage");

function showMessage(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = "status-message " + type;
}

function clearMessage() {
  statusMessage.textContent = "";
  statusMessage.className = "status-message";
}

function switchToLogin() {
  loginTab.classList.add("active");
  registerTab.classList.remove("active");
  loginForm.classList.add("active-form");
  registerForm.classList.remove("active-form");
}

function switchToRegister() {
  registerTab.classList.add("active");
  loginTab.classList.remove("active");
  registerForm.classList.add("active-form");
  loginForm.classList.remove("active-form");
}

loginTab.addEventListener("click", () => {
  clearMessage();
  switchToLogin();
});

registerTab.addEventListener("click", () => {
  clearMessage();
  switchToRegister();
});

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("registerUsername").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value.trim();

  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, email, password })
    });

    const data = await response.json();

    if (response.ok) {
      registerForm.reset();
      switchToLogin();
      showMessage("Registration successful. Please login now.", "success");
    } else {
      showMessage(data.message || "Registration failed.", "error");
    }
  } catch (error) {
    showMessage("Server error during registration.", "error");
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
      showMessage("Login successful. Redirecting to lobby...", "success");

      setTimeout(() => {
        window.location.href = "/lobby.html";
      }, 1000);
    } else {
      showMessage(data.message || "Login failed.", "error");
    }
  } catch (error) {
    showMessage("Server error during login.", "error");
  }
});

switchToRegister();