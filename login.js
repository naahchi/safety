/*
 * Configure these values for each tool.
 * Keep this file free of passwords, secrets, and private user data.
 */
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxVI0BKZjLwVqJrxQAqnnCb-hLmmSw_CK9VkQwxbC3-AOSx0U3UaUWZQ3m2QT43ZEPR/exec";
const REDIRECT_AFTER_LOGIN = "protected-example.html";
const SESSION_KEY = "tool_login_session_v1";

const loginForm = document.getElementById("loginForm");
const bridgeForm = document.getElementById("bridgeForm");
const payloadField = document.getElementById("payloadField");
const message = document.getElementById("message");
const submitButton = document.getElementById("submitButton");
let pendingRequestId = null;
let pendingAction = null;

function setMessage(text, success = false) {
  message.textContent = text;
  message.classList.toggle("success", success);
}

function sendRequest(payload) {
  if (!GAS_WEB_APP_URL.startsWith("https://script.google.com/macros/s/") ||
      GAS_WEB_APP_URL.includes("PASTE_YOUR")) {
    setMessage("Setup incomplete: add your Apps Script /exec URL in login.js.");
    return;
  }
  pendingRequestId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);
  pendingAction = payload.action;
  payload.requestId = pendingRequestId;
  payloadField.value = JSON.stringify(payload);
  bridgeForm.action = GAS_WEB_APP_URL;
  bridgeForm.submit();
}

window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "GAS_LOGIN_RESULT" || data.requestId !== pendingRequestId) return;
  pendingRequestId = null;
  if (submitButton) {
    submitButton.disabled = false;
    submitButton.textContent = "Sign in";
  }
  const result = data.result || {};
  if (pendingAction === "login") {
    if (!result.ok) {
      setMessage(result.error || "Login failed.");
      return;
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      token: result.token, username: result.username, expiresAt: result.expiresAt
    }));
    setMessage("Login successful. Redirecting…", true);
    window.location.assign(REDIRECT_AFTER_LOGIN);
  } else if (pendingAction === "verify") {
    if (!result.ok) {
      sessionStorage.removeItem(SESSION_KEY);
      window.location.assign("index.html");
    }
  }
});

if (loginForm) {
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    setMessage("");
    submitButton.disabled = true;
    submitButton.textContent = "Checking…";
    sendRequest({
      action: "login",
      username: document.getElementById("username").value,
      password: document.getElementById("password").value
    });
  });
}

function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); }
  catch (_) { return null; }
}

// Expose a small helper for demo pages. Call it on page load.
// This verifies the session with the backend; static page contents themselves remain public.
window.ToolLogin = {
  getSession,
  verify() {
    const session = getSession();
    if (!session || !session.token || Date.now() > session.expiresAt) {
      sessionStorage.removeItem(SESSION_KEY);
      window.location.assign("index.html");
      return;
    }
    sendRequest({ action: "verify", token: session.token });
  },
  logout() {
    const session = getSession();
    sessionStorage.removeItem(SESSION_KEY);
    if (session && session.token) sendRequest({ action: "logout", token: session.token });
    window.location.assign("index.html");
  }
};
