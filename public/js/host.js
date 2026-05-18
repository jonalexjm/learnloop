// LearnLoop - Host.js (Lógica del Profesor)

class HostClient extends LearnLoopClient {
  constructor() {
    super();
    this.rounds = 5;
    this.currentRound = 0;
    this.totalPlayers = 0;
  }

  onConnected() {
    updateConnectionStatus(true);
  }

  onDisconnected() {
    updateConnectionStatus(false);
  }

  onRoomCreated(payload) {
    this.pin = payload.pin;
    document.getElementById("room-pin").textContent = this.pin;
    generateQRCode(this.pin);
    showScreen("lobby-screen");
  }

  onPlayerJoined(payload) {
    this.totalPlayers = payload.count || payload.playerCount || this.totalPlayers;
    this.updatePlayerCount();
    this.enableStartButton();
    console.log("🎉 Nuevo jugador llegó:", payload.nickname, "Total:", this.totalPlayers);
  }

  onPlayerLeft(payload) {
    this.totalPlayers = payload.count;
    this.updatePlayerCount();

    const playersList = document.getElementById("players-list");
    if (playersList) {
      const chips = playersList.querySelectorAll(".player-chip");
      const toRemove = Array.from(chips).find((chip) => chip.textContent === payload.nickname);
      if (toRemove) toRemove.remove();
    }
  }

  onPlayerListUpdate(payload) {
    console.log("📋 Actualizando lista de jugadores:", payload.players);
    this.updatePlayersList(payload.players);
  }

  updatePlayerCount() {
    document.getElementById("player-count").textContent = this.totalPlayers;
    document.getElementById("total-players").textContent = this.totalPlayers;
  }

  enableStartButton() {
    const btn = document.getElementById("start-game-btn");
    if (this.totalPlayers > 0) {
      btn.disabled = false;
    }
  }

  updatePlayersList(players) {
    const container = document.getElementById("players-list");

    if (players.length === 0) {
      container.innerHTML = '<p class="empty-msg">Esperando jugadores...</p>';
      return;
    }

    container.innerHTML = players
      .map(
        (name) => `
            <div class="player-chip">${name}</div>
        `,
      )
      .join("");
  }

  onGameStarting(payload) {
    showScreen("intro-screen");
  }

  onRoundIntro(payload) {
    showScreen("intro-screen");

    document.getElementById("current-round").textContent = payload.roundNumber;
    document.getElementById("total-rounds").textContent = payload.totalRounds;
    document.getElementById("game-title").textContent = payload.gameName;
    document.getElementById("game-description").textContent = payload.description;

    this.startCountdown(3);
  }

  startCountdown(seconds) {
    const countdownEl = document.getElementById("countdown");
    let count = seconds;

    const interval = setInterval(() => {
      countdownEl.textContent = count;
      count--;

      if (count < 0) {
        clearInterval(interval);
        this.showGameScreen();
      }
    }, 1000);
  }

  showGameScreen() {
    showScreen("game-screen");
  }

  onStartRound(payload) {
    showScreen("game-screen");

    document.getElementById("game-type-badge").textContent = this.getGameTypeLabel(payload.gameType);
    document.getElementById("game-name-display").textContent = payload.gameType;

    this.renderHostGame(payload);
    this.startTimer(payload.timeLimit);
  }

  getGameTypeLabel(type) {
    const labels = {
      drag_drop: "🎯 Arrastre",
      classify: "📂 Clasificar",
    };
    return labels[type] || "🎮 Juego";
  }

  renderHostGame(payload) {
    const display = document.getElementById("game-display");
    const gameData = payload.gameData;

    if (payload.gameType === "drag_drop") {
      display.innerHTML = this.renderDragDropHost(gameData);
    } else if (payload.gameType === "classify") {
      display.innerHTML = this.renderClassifyHost(gameData);
    }
  }

  renderDragDropHost(gameData) {
    const dropZones = (gameData.dropZones || [])
      .map(
        (zone) => `
            <div class="drop-zone sense-zone" style="position:absolute; left:${zone.x}%; top:${zone.y}%; transform:translate(-50%,-50%);" data-zone-id="${zone.id}">
                <span class="sense-zone-label">${zone.label}</span>
            </div>
        `,
      )
      .join("");

    const items = (gameData.items || [])
      .map(
        (item) => `
            <div class="drag-item sense-card" data-item-id="${item.id}">
                <span class="sense-card-icon">${item.icon || ""}</span>
                <span class="sense-card-label">${item.label}</span>
            </div>
        `,
      )
      .join("");

    return `
            <div class="drag-game-container senses-game-container">
                <p style="text-align:center; color:var(--gray); margin-bottom:15px;">
                    Los jugadores están arrastrando los sentidos al rostro...
                </p>
                <div class="senses-board">
                    <svg class="face-svg" viewBox="0 0 400 480" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <radialGradient id="headGradH" cx="50%" cy="40%">
                                <stop offset="0%" stop-color="#fde68a"/>
                                <stop offset="100%" stop-color="#fbbf24"/>
                            </radialGradient>
                            <radialGradient id="cheekGradH" cx="50%" cy="50%">
                                <stop offset="0%" stop-color="#fca5a5"/>
                                <stop offset="100%" stop-color="#f87171" stop-opacity="0"/>
                            </radialGradient>
                        </defs>
                        <ellipse cx="200" cy="140" rx="155" ry="120" fill="#92400e"/>
                        <ellipse cx="200" cy="120" rx="150" ry="100" fill="#b45309"/>
                        <ellipse cx="200" cy="220" rx="130" ry="155" fill="url(#headGradH)" stroke="#d97706" stroke-width="3"/>
                        <ellipse cx="68" cy="230" rx="30" ry="45" fill="#fbbf24" stroke="#d97706" stroke-width="3"/>
                        <ellipse cx="68" cy="230" rx="18" ry="30" fill="#fde68a"/>
                        <ellipse cx="332" cy="230" rx="30" ry="45" fill="#fbbf24" stroke="#d97706" stroke-width="3"/>
                        <ellipse cx="332" cy="230" rx="18" ry="30" fill="#fde68a"/>
                        <path d="M 80 150 Q 120 100 200 95 Q 280 100 320 150 Q 300 120 200 110 Q 100 120 80 150Z" fill="#b45309"/>
                        <ellipse cx="150" cy="195" rx="28" ry="30" fill="#fff" stroke="#92400e" stroke-width="2"/>
                        <circle cx="150" cy="197" r="14" fill="#3b82f6"/>
                        <circle cx="150" cy="197" r="8" fill="#1e3a5f"/>
                        <circle cx="145" cy="190" r="5" fill="#fff"/>
                        <ellipse cx="250" cy="195" rx="28" ry="30" fill="#fff" stroke="#92400e" stroke-width="2"/>
                        <circle cx="250" cy="197" r="14" fill="#3b82f6"/>
                        <circle cx="250" cy="197" r="8" fill="#1e3a5f"/>
                        <circle cx="245" cy="190" r="5" fill="#fff"/>
                        <path d="M 122 185 L 115 178" stroke="#92400e" stroke-width="2.5" stroke-linecap="round"/>
                        <path d="M 130 172 L 125 164" stroke="#92400e" stroke-width="2.5" stroke-linecap="round"/>
                        <path d="M 278 185 L 285 178" stroke="#92400e" stroke-width="2.5" stroke-linecap="round"/>
                        <path d="M 270 172 L 275 164" stroke="#92400e" stroke-width="2.5" stroke-linecap="round"/>
                        <path d="M 120 158 Q 150 145 180 158" stroke="#92400e" stroke-width="4" fill="none" stroke-linecap="round"/>
                        <path d="M 220 158 Q 250 145 280 158" stroke="#92400e" stroke-width="4" fill="none" stroke-linecap="round"/>
                        <path d="M 200 215 Q 188 248 195 258 Q 200 263 205 258 Q 212 248 200 215Z" fill="#f59e0b" stroke="#d97706" stroke-width="2"/>
                        <circle cx="118" cy="260" r="22" fill="url(#cheekGradH)" opacity="0.6"/>
                        <circle cx="282" cy="260" r="22" fill="url(#cheekGradH)" opacity="0.6"/>
                        <path d="M 148 300 Q 200 348 252 300" stroke="#dc2626" stroke-width="4" fill="#fca5a5" stroke-linecap="round"/>
                        <path d="M 165 305 Q 200 315 235 305" stroke="#fff" stroke-width="2" fill="none"/>
                        <rect x="175" y="365" width="50" height="40" rx="10" fill="#fde68a" stroke="#d97706" stroke-width="2"/>
                        <path d="M 130 400 Q 200 380 270 400 L 280 480 L 120 480Z" fill="#38bdf8" stroke="#0ea5e9" stroke-width="3"/>
                        <path d="M 175 395 Q 200 410 225 395" stroke="#0ea5e9" stroke-width="2" fill="none"/>
                    </svg>
                    ${dropZones}
                </div>
                <div style="display:flex; justify-content:center; gap:20px; flex-wrap:wrap; margin-top:20px;">
                    ${items}
                </div>
            </div>
        `;
  }

  renderClassifyHost(gameData) {
    const categories = gameData.categories
      .map(
        (cat) => `
            <div class="category-box" data-category-id="${cat.id}">
                <h4>${cat.label}</h4>
            </div>
        `,
      )
      .join("");

    const items = gameData.items
      .map(
        (item) => `
            <div class="classify-item" data-item-id="${item.id}">
                ${item.text}
            </div>
        `,
      )
      .join("");

    return `
            <div class="classify-game-container">
                <p style="text-align: center; color: var(--gray); margin-bottom: 20px;">
                    Los jugadores están clasificando...
                </p>
                <div class="categories-row">
                    ${categories}
                </div>
                <div class="items-pool" style="margin-top: 30px;">
                    ${items}
                </div>
            </div>
        `;
  }

  startTimer(seconds) {
    const circle = document.getElementById("timer-circle");
    const text = document.getElementById("timer-text");

    const circumference = 2 * Math.PI * 45;
    circle.style.strokeDasharray = circumference;

    let remaining = seconds;

    const updateTimer = () => {
      text.textContent = remaining;
      const offset = circumference * (1 - remaining / seconds);
      circle.style.strokeDashoffset = offset;

      if (remaining <= 10) {
        circle.style.stroke = "#ef4444";
      } else if (remaining <= 20) {
        circle.style.stroke = "#f59e0b";
      } else {
        circle.style.stroke = "#22c55e";
      }

      remaining--;

      if (remaining < 0) {
        clearInterval(timerInterval);
      }
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
  }

  onTimerUpdate(payload) {
    const text = document.getElementById("timer-text");
    if (text) text.textContent = payload.remaining;
  }

  onSubmissionUpdate(payload) {
    document.getElementById("submission-count").textContent = payload.submitted;
  }

  onAllSubmissionsComplete(payload) {
    const submissionCount = document.getElementById("submission-count");
    if (submissionCount) {
      submissionCount.style.color = "#22c55e";
      submissionCount.style.fontWeight = "bold";
      submissionCount.style.fontSize = "1.2em";
      submissionCount.style.animation = "pulse 0.6s ease-in-out 2";
    }
    console.log("✅ Todos los participantes han respondido. La ronda finalizará automáticamente...");
  }

  onRoundResult(payload) {
    showScreen("results-screen");

    document.getElementById("result-title").textContent = `Resultados - Ronda ${payload.roundNumber}`;

    const solutionDisplay = document.getElementById("solution-display");
    solutionDisplay.innerHTML = payload.correctAnswers
      .map((ca) => `<span style="padding: 10px 20px; background: var(--gradient); border-radius: 10px;">✓</span>`)
      .join("");

    const podiumList = document.getElementById("podium-list");
    const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];

    podiumList.innerHTML = payload.top5
      .map((player, i) => {
        const displayName = player.nickname.split(" ").slice(1).join(" ") || player.nickname;
        return `
                <div class="podium-item">
                    <span class="podium-rank">${medals[i]}</span>
                    <span class="podium-name">${displayName}</span>
                    <span class="podium-score">${player.score} pts</span>
                </div>
            `;
      })
      .join("");

    const nextBtn = document.getElementById("next-round-btn");
    if (payload.isLastRound) {
      nextBtn.style.display = "none";
      hostClient.send("NEXT_ROUND", {});
    } else {
      nextBtn.style.display = "inline-block";
    }
  }

  onGameEnded(payload) {
    showScreen("final-screen");

    const podium = payload.podium;

    document.getElementById("first-name").textContent = podium[0]?.nickname.split(" ").slice(1).join(" ") || "-";
    document.getElementById("first-score").textContent = podium[0]?.totalScore || "0";
    document.getElementById("second-name").textContent = podium[1]?.nickname.split(" ").slice(1).join(" ") || "-";
    document.getElementById("second-score").textContent = podium[1]?.totalScore || "0";
    document.getElementById("third-name").textContent =
      payload.allPlayers.length > 2 ? podium[2]?.nickname.split(" ").slice(1).join(" ") || "-" : "-";
    document.getElementById("third-score").textContent =
      payload.allPlayers.length > 2 ? podium[2]?.totalScore || "0" : "0";

    const allScoresList = document.getElementById("all-scores-list");
    allScoresList.innerHTML = payload.allPlayers
      .map((player, i) => {
        let rowClass = "";
        if (i === 0) rowClass = "gold";
        else if (i === 1) rowClass = "silver";
        else if (i === 2) rowClass = "bronze";

        const displayName = player.nickname.split(" ").slice(1).join(" ") || player.nickname;

        return `
                <div class="table-row ${rowClass}">
                    <span class="col-pos">${i + 1}º</span>
                    <span class="col-name">${displayName}</span>
                    <span class="col-score">${player.totalScore} pts</span>
                </div>
            `;
      })
      .join("");
  }

  onError(payload) {
    alert("Error: " + payload.message);
  }

  onHostDisconnected() {
    alert("La sesión ha terminado.");
    location.reload();
  }
}

const hostClient = new HostClient();

document.addEventListener("DOMContentLoaded", () => {
  hostClient.connect();

  document.getElementById("create-room-btn").addEventListener("click", () => {
    const rounds = parseInt(document.getElementById("rounds-input").value) || 5;
    hostClient.rounds = rounds;
    hostClient.subjects = ["english"];
    hostClient.send("CREATE_ROOM", { rounds, subjects: ["english"] });
  });

  document.getElementById("start-game-btn").addEventListener("click", () => {
    hostClient.send("START_GAME", {});
  });

  document.getElementById("next-round-btn").addEventListener("click", () => {
    hostClient.send("NEXT_ROUND", {});
  });
});

function adjustRounds(delta) {
  const input = document.getElementById("rounds-input");
  let value = parseInt(input.value) + delta;
  value = Math.max(1, Math.min(10, value));
  input.value = value;
}
