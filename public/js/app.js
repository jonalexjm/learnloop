// LearnLoop - App.js (Lógica común de WebSocket)
class LearnLoopClient {
  constructor() {
    this.ws = null;
    this.role = null;
    this.pin = null;
    this.nickname = null;
    this.connected = false;
  }

  connect() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.connected = true;
      this.onConnected();
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.onDisconnected();
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };
  }

  send(event, payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, payload }));
    }
  }

  handleMessage(data) {
    const { event, payload } = data;

    switch (event) {
      case "ROOM_CREATED":
        this.onRoomCreated(payload);
        break;
      case "JOINED":
        this.onJoined(payload);
        break;
      case "ERROR":
        this.onError(payload);
        break;
      case "PLAYER_JOINED":
        this.onPlayerJoined(payload);
        break;
      case "PLAYER_LEFT":
        this.onPlayerLeft(payload);
        break;
      case "PLAYER_LIST_UPDATE":
        this.onPlayerListUpdate(payload);
        break;
      case "GAME_STARTING":
        this.onGameStarting(payload);
        break;
      case "ROUND_INTRO":
        this.onRoundIntro(payload);
        break;
      case "START_ROUND":
        this.onStartRound(payload);
        break;
      case "TIMER_UPDATE":
        this.onTimerUpdate(payload);
        break;
      case "SUBMISSION_UPDATE":
        this.onSubmissionUpdate(payload);
        break;
      case "ALL_SUBMISSIONS_COMPLETE":
        this.onAllSubmissionsComplete(payload);
        break;
      case "ROUND_RESULT":
        this.onRoundResult(payload);
        break;
      case "PLAYER_RESULT":
        this.onPlayerResult(payload);
        break;
      case "GAME_ENDED":
        this.onGameEnded(payload);
        break;
      case "HOST_DISCONNECTED":
        this.onHostDisconnected();
        break;
    }
  }

  onConnected() {}
  onDisconnected() {}
  onRoomCreated(payload) {}
  onJoined(payload) {}
  onError(payload) {}
  onPlayerJoined(payload) {}
  onPlayerLeft(payload) {}
  onPlayerListUpdate(payload) {}
  onGameStarting(payload) {}
  onRoundIntro(payload) {}
  onStartRound(payload) {}
  onTimerUpdate(payload) {}
  onSubmissionUpdate(payload) {}
  onAllSubmissionsComplete(payload) {}
  onRoundResult(payload) {}
  onPlayerResult(payload) {}
  onGameEnded(payload) {}
  onHostDisconnected() {}
}

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const screen = document.getElementById(screenId);
  if (screen) screen.classList.add("active");
}

function updateConnectionStatus(connected) {
  const statusDot = document.querySelector(".status-dot");
  const statusText = document.getElementById("connection-text");
  if (statusDot) {
    statusDot.classList.toggle("connected", connected);
  }
  if (statusText) {
    statusText.textContent = connected ? "Conectado" : "Desconectado";
  }
}

function generateQRCode(pin, baseUrl = "") {
  const qrContainer = document.getElementById("qr-canvas");
  if (!qrContainer) return;

  // Limpiar contenedor anterior
  qrContainer.innerHTML = "";

  const origin = baseUrl || window.location.origin;
  const normalizedOrigin = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  const url = `${normalizedOrigin}/player.html?pin=${pin}`;

  // Usar API de QRServer que genera QR confiable como imagen
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;

  const img = document.createElement("img");
  img.src = qrImageUrl;
  img.alt = "QR Code";
  img.style.display = "block";
  img.style.margin = "0 auto";

  qrContainer.appendChild(img);
}

window.LearnLoopClient = LearnLoopClient;
window.showScreen = showScreen;
window.updateConnectionStatus = updateConnectionStatus;
window.generateQRCode = generateQRCode;
