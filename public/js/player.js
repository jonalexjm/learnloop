// LearnLoop - Player.js (Lógica del Jugador)

class PlayerClient extends LearnLoopClient {
  constructor() {
    super();
    this.playerId = null;
    this.score = 0;
    this.streak = 0;
    this.currentGameType = null;
    this.currentGameData = null;
    this.gameAnswers = {};
    this.submitted = false;
    this.selectedAvatar = "🦊";
    this.nicknameConfirmed = false;
    this.touchDragState = {
      item: null,
      target: null,
    };
  }

  onConnected() {
    updateConnectionStatus(true);
    const urlParams = new URLSearchParams(window.location.search);
    const pinFromUrl = urlParams.get("pin");
    if (pinFromUrl) {
      document.getElementById("pin-input").value = pinFromUrl;
    }
  }

  onDisconnected() {
    updateConnectionStatus(false);
  }

  onJoined(payload) {
    this.playerId = payload.playerId;
    document.getElementById("player-room-pin").textContent = this.pin;
    showScreen("nickname-screen");
  }

  onError(payload) {
    alert("Error: " + payload.message);
  }

  onGameStarting(payload) {
    showScreen("player-lobby-screen");
  }

  onRoundIntro(payload) {
    showScreen("player-intro-screen");
    document.getElementById("player-game-title").textContent = payload.gameName;
    document.getElementById("player-game-desc").textContent = payload.description;
    this.startPlayerCountdown(3);
  }

  startPlayerCountdown(seconds) {
    const countdownEl = document.getElementById("player-countdown");
    let count = seconds;
    const interval = setInterval(() => {
      countdownEl.textContent = count;
      count--;
      if (count < 0) clearInterval(interval);
    }, 1000);
  }

  onStartRound(payload) {
    this.currentGameType = payload.gameType;
    this.currentGameData = payload.gameData;
    this.gameAnswers = {};
    this.submitted = false;

    document.getElementById("submit-answer-btn").disabled = false;
    document.getElementById("submit-answer-btn").textContent = "✅ Enviar Respuesta";

    showScreen("player-game-screen");
    this.renderPlayerGame(payload);
    this.startPlayerTimer(payload.timeLimit);
  }

  renderPlayerGame(payload) {
    const gameArea = document.getElementById("player-game-area");
    if (payload.gameType === "drag_drop") {
      gameArea.innerHTML = this.renderDragDropGame(payload.gameData);
      this.initDragDropGame();
    } else if (payload.gameType === "classify") {
      gameArea.innerHTML = this.renderClassifyGame(payload.gameData);
      this.initClassifyGame();
    }
  }

  renderDragDropGame(gameData) {
    const dropZones = gameData.dropZones
      .map(
        (zone) => `
        <div class="drop-zone sense-zone" data-zone-id="${zone.id}"
             style="position:absolute; left:${zone.x}%; top:${zone.y}%; transform:translate(-50%,-50%);">
          <span class="sense-zone-label">${zone.label}</span>
        </div>
      `,
      )
      .join("");

    const items = gameData.items
      .map(
        (item) => `
        <div class="drag-item sense-card" data-item-id="${item.id}" draggable="true">
          <span class="sense-card-icon">${item.icon || ""}</span>
          <span class="sense-card-label">${item.label}</span>
        </div>
      `,
      )
      .join("");

    return `
      <div class="drag-game-container senses-game-container">
        <p class="sense-instruction">🧒 Drag each sense to the correct part of the face!</p>
        <div class="senses-board">
          <svg class="face-svg" viewBox="0 0 400 480" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="headGrad" cx="50%" cy="40%">
                <stop offset="0%" stop-color="#fde68a"/>
                <stop offset="100%" stop-color="#fbbf24"/>
              </radialGradient>
              <radialGradient id="cheekGrad" cx="50%" cy="50%">
                <stop offset="0%" stop-color="#fca5a5"/>
                <stop offset="100%" stop-color="#f87171" stop-opacity="0"/>
              </radialGradient>
            </defs>
            <!-- Hair -->
            <ellipse cx="200" cy="140" rx="155" ry="120" fill="#92400e"/>
            <ellipse cx="200" cy="120" rx="150" ry="100" fill="#b45309"/>
            <!-- Head -->
            <ellipse cx="200" cy="220" rx="130" ry="155" fill="url(#headGrad)" stroke="#d97706" stroke-width="3"/>
            <!-- Left ear -->
            <ellipse cx="68" cy="230" rx="30" ry="45" fill="#fbbf24" stroke="#d97706" stroke-width="3"/>
            <ellipse cx="68" cy="230" rx="18" ry="30" fill="#fde68a"/>
            <!-- Right ear -->
            <ellipse cx="332" cy="230" rx="30" ry="45" fill="#fbbf24" stroke="#d97706" stroke-width="3"/>
            <ellipse cx="332" cy="230" rx="18" ry="30" fill="#fde68a"/>
            <!-- Hair bangs -->
            <path d="M 80 150 Q 120 100 200 95 Q 280 100 320 150 Q 300 120 200 110 Q 100 120 80 150Z" fill="#b45309"/>
            <!-- Left eye -->
            <ellipse cx="150" cy="195" rx="28" ry="30" fill="#fff" stroke="#92400e" stroke-width="2"/>
            <circle cx="150" cy="197" r="14" fill="#3b82f6"/>
            <circle cx="150" cy="197" r="8" fill="#1e3a5f"/>
            <circle cx="145" cy="190" r="5" fill="#fff"/>
            <!-- Right eye -->
            <ellipse cx="250" cy="195" rx="28" ry="30" fill="#fff" stroke="#92400e" stroke-width="2"/>
            <circle cx="250" cy="197" r="14" fill="#3b82f6"/>
            <circle cx="250" cy="197" r="8" fill="#1e3a5f"/>
            <circle cx="245" cy="190" r="5" fill="#fff"/>
            <!-- Eyelashes -->
            <path d="M 122 185 L 115 178" stroke="#92400e" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M 130 172 L 125 164" stroke="#92400e" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M 278 185 L 285 178" stroke="#92400e" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M 270 172 L 275 164" stroke="#92400e" stroke-width="2.5" stroke-linecap="round"/>
            <!-- Eyebrows -->
            <path d="M 120 158 Q 150 145 180 158" stroke="#92400e" stroke-width="4" fill="none" stroke-linecap="round"/>
            <path d="M 220 158 Q 250 145 280 158" stroke="#92400e" stroke-width="4" fill="none" stroke-linecap="round"/>
            <!-- Nose -->
            <path d="M 200 215 Q 188 248 195 258 Q 200 263 205 258 Q 212 248 200 215Z" fill="#f59e0b" stroke="#d97706" stroke-width="2"/>
            <!-- Cheeks -->
            <circle cx="118" cy="260" r="22" fill="url(#cheekGrad)" opacity="0.6"/>
            <circle cx="282" cy="260" r="22" fill="url(#cheekGrad)" opacity="0.6"/>
            <!-- Mouth - big smile -->
            <path d="M 148 300 Q 200 348 252 300" stroke="#dc2626" stroke-width="4" fill="#fca5a5" stroke-linecap="round"/>
            <!-- Teeth hint -->
            <path d="M 165 305 Q 200 315 235 305" stroke="#fff" stroke-width="2" fill="none"/>
            <!-- Neck -->
            <rect x="175" y="365" width="50" height="40" rx="10" fill="#fde68a" stroke="#d97706" stroke-width="2"/>
            <!-- Shirt -->
            <path d="M 130 400 Q 200 380 270 400 L 280 480 L 120 480Z" fill="#38bdf8" stroke="#0ea5e9" stroke-width="3"/>
            <path d="M 175 395 Q 200 410 225 395" stroke="#0ea5e9" stroke-width="2" fill="none"/>
          </svg>
          ${dropZones}
        </div>
        <div class="items-row senses-items-row" id="items-pool">
          ${items}
        </div>
      </div>
    `;
  }

  renderClassifyGame(gameData) {
    const categories = gameData.categories
      .map(
        (cat) => `
        <div class="category-box" data-category-id="${cat.id}">
          <h4>${cat.label}</h4>
          <div class="category-items" data-category="${cat.id}"></div>
        </div>
      `,
      )
      .join("");

    const items = gameData.items
      .map(
        (item) => `
        <div class="classify-item" data-item-id="${item.id}" draggable="true">
          ${item.text}
        </div>
      `,
      )
      .join("");

    return `
      <div class="classify-game-container">
        <div class="categories-row">
          ${categories}
        </div>
        <div class="items-pool" id="items-pool">
          ${items}
        </div>
      </div>
    `;
  }

  initDragDropGame() {
    const dragItems = document.querySelectorAll(".drag-item");
    const dropZones = document.querySelectorAll(".drop-zone");

    dragItems.forEach((item) => {
      this.makeDraggable(item);
    });

    dropZones.forEach((zone) => {
      zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        zone.classList.add("hover");
      });

      zone.addEventListener("dragleave", () => {
        zone.classList.remove("hover");
      });

      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("hover");

        const itemId = e.dataTransfer.getData("text/plain");
        const zoneId = zone.dataset.zoneId;

        if (itemId && zoneId) {
          this.gameAnswers[zoneId] = itemId;

          const item = document.querySelector(`.drag-item[data-item-id="${itemId}"]`);
          if (item) {
            item.style.display = "none";
          }

          zone.classList.add("correct");
        }
      });
    });
  }

  makeDraggable(element) {
    element.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", element.dataset.itemId);
      element.classList.add("dragging");
    });

    element.addEventListener("dragend", () => {
      element.classList.remove("dragging");
    });

    element.addEventListener(
      "touchstart",
      (e) => {
        this.touchDragState.item = element;
        this.touchDragState.target = null;
        element.classList.add("dragging");
        element.style.pointerEvents = "none";
      },
      { passive: false },
    );

    element.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const target = this.getTouchDropTarget(touch.clientX, touch.clientY);

        this.clearTouchHoverStates();

        if (target) {
          target.classList.add(target.classList.contains("drop-zone") ? "hover" : "drag-over");
          this.touchDragState.target = target;
        }
      },
      { passive: false },
    );

    const finishTouchDrag = (e) => {
      const touch = e.changedTouches[0];
      const target = this.getTouchDropTarget(touch.clientX, touch.clientY) || this.touchDragState.target;
      const itemElement = this.touchDragState.item || element;

      if (target && itemElement) {
        this.handleTouchDrop(itemElement, target);
      }

      this.clearTouchHoverStates();

      if (itemElement) {
        itemElement.classList.remove("dragging");
        itemElement.style.pointerEvents = "";
      }

      this.touchDragState.item = null;
      this.touchDragState.target = null;
    };

    element.addEventListener("touchend", finishTouchDrag);
    element.addEventListener("touchcancel", finishTouchDrag);
  }

  getTouchDropTarget(x, y) {
    const pointElement = document.elementFromPoint(x, y);
    return pointElement ? pointElement.closest(".drop-zone, .category-box") : null;
  }

  clearTouchHoverStates() {
    document.querySelectorAll(".drop-zone.hover, .category-box.drag-over").forEach((target) => {
      target.classList.remove("hover", "drag-over");
    });
  }

  handleTouchDrop(itemElement, target) {
    const itemId = itemElement?.dataset?.itemId;
    if (!itemId || !target) return;

    if (target.classList.contains("drop-zone")) {
      const zoneId = target.dataset.zoneId;
      if (!zoneId) return;

      this.gameAnswers[zoneId] = itemId;
      itemElement.style.display = "none";
      target.classList.add("correct");
      return;
    }

    if (target.classList.contains("category-box")) {
      const categoryId = target.dataset.categoryId;
      if (!categoryId) return;

      this.gameAnswers[itemId] = categoryId;
      const itemsContainer = target.querySelector(".category-items");

      if (itemsContainer) {
        itemsContainer.appendChild(itemElement);
        itemElement.draggable = false;
      }
    }
  }

  initClassifyGame() {
    const classifyItems = document.querySelectorAll(".classify-item");
    const categoryBoxes = document.querySelectorAll(".category-box");

    classifyItems.forEach((item) => {
      this.makeDraggable(item);

      item.addEventListener("dragend", () => {
        const dropZone = document.querySelector(".category-box.drag-over");
        if (dropZone) {
          dropZone.classList.remove("drag-over");
        }
      });
    });

    categoryBoxes.forEach((box) => {
      box.addEventListener("dragover", (e) => {
        e.preventDefault();
        box.classList.add("drag-over");
      });

      box.addEventListener("dragleave", () => {
        box.classList.remove("drag-over");
      });

      box.addEventListener("drop", (e) => {
        e.preventDefault();
        box.classList.remove("drag-over");

        const itemId = e.dataTransfer.getData("text/plain");
        const categoryId = box.dataset.categoryId;

        if (itemId && categoryId) {
          this.gameAnswers[itemId] = categoryId;

          const item = document.querySelector(`.classify-item[data-item-id="${itemId}"]`);
          if (item) {
            const itemsContainer = box.querySelector(".category-items");
            itemsContainer.appendChild(item);
            item.draggable = false;
          }
        }
      });
    });
  }

  startPlayerTimer(seconds) {
    const timerEl = document.getElementById("player-timer");
    let remaining = seconds;

    const interval = setInterval(() => {
      timerEl.textContent = remaining;
      remaining--;

      if (remaining < 0) {
        clearInterval(interval);
        if (!this.submitted) {
          this.submitAnswer();
        }
      }
    }, 1000);
  }

  onTimerUpdate(payload) {
    const timerEl = document.getElementById("player-timer");
    if (timerEl) timerEl.textContent = payload.remaining;
  }

  submitAnswer() {
    if (this.submitted) return;

    this.submitted = true;
    document.getElementById("submit-answer-btn").disabled = true;
    document.getElementById("submit-answer-btn").textContent = "⏳ Enviado...";

    const timeRemaining = parseInt(document.getElementById("player-timer").textContent);

    const answers = Object.entries(this.gameAnswers).map(([zoneId, itemId]) => ({
      zoneId,
      itemId,
    }));

    this.send("SUBMIT_ANSWER", {
      answers: answers,
      timeRemaining: timeRemaining,
    });
  }

  onPlayerResult(payload) {
    showScreen("player-result-screen");

    const feedback = document.getElementById("result-feedback");
    const scoreEl = document.getElementById("result-score");
    const totalEl = document.getElementById("result-total");
    const positionEl = document.getElementById("result-position");
    const totalPlayersEl = document.getElementById("result-total-players");

    this.score = payload.totalScore;

    if (payload.correct) {
      feedback.innerHTML = "🎉 ¡Correcto!";
      feedback.className = "result-feedback correct";
      scoreEl.textContent = `+${payload.score}`;
    } else {
      feedback.innerHTML = "❌ Incorrecto";
      feedback.className = "result-feedback wrong";
      scoreEl.textContent = "+0";
    }

    totalEl.textContent = this.score;
    positionEl.textContent = `#${payload.rank}`;
    totalPlayersEl.textContent = `de ${payload.totalPlayers}`;

    document.getElementById("streak-display").textContent = payload.streak || 0;
    document.getElementById("score-display").textContent = this.score;
  }

  onGameEnded(payload) {
    showScreen("player-final-screen");

    const rankEl = document.getElementById("final-rank");
    const messageEl = document.getElementById("final-message");
    const scoreEl = document.getElementById("final-score");

    const myResult = payload.allPlayers.find((p) => p.nickname === this.nickname);
    const rank = myResult ? payload.allPlayers.indexOf(myResult) + 1 : 0;

    rankEl.textContent = `#${rank}`;
    rankEl.className = rank <= 3 ? `rank-${rank}` : "rank-other";

    if (rank === 1) {
      messageEl.textContent = "¡Eres el Champion! 🏆";
    } else if (rank <= 3) {
      messageEl.textContent = "¡Excelente trabajo! 🎉";
    } else {
      messageEl.textContent = "¡Buen juego! 👍";
    }

    scoreEl.textContent = myResult ? myResult.totalScore : 0;

    const top3List = document.getElementById("player-top3-list");
    const top3 = payload.allPlayers.slice(0, 3);

    const medals = ["🥇", "🥈", "🥉"];
    top3List.innerHTML = top3
      .map((player, i) => {
        const displayName = player.nickname.split(" ").slice(1).join(" ") || player.nickname;
        return `
          <div class="top3-item ${i === 0 ? "first" : i === 1 ? "second" : "third"}">
            <span class="top3-rank">${medals[i]}</span>
            <span class="top3-name">${displayName}</span>
            <span class="top3-score">${player.totalScore}</span>
          </div>
        `;
      })
      .join("");
  }

  onError(payload) {
    alert("Error: " + payload.message);
  }

  onHostDisconnected() {
    alert("El profesor ha terminado la sesión.");
    location.href = "index.html";
  }
}

const playerClient = new PlayerClient();

document.addEventListener("DOMContentLoaded", () => {
  playerClient.connect();

  const pinInput = document.getElementById("pin-input");
  pinInput.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
  });

  document.getElementById("join-btn").addEventListener("click", () => {
    const pin = pinInput.value;
    if (pin.length !== 4) {
      alert("Ingresa un PIN de 4 dígitos");
      return;
    }
    playerClient.pin = pin;
    playerClient.send("JOIN_ROOM", { pin: pin, nickname: "" });
  });

  document.querySelectorAll(".avatar-option").forEach((option) => {
    option.addEventListener("click", () => {
      document.querySelectorAll(".avatar-option").forEach((o) => o.classList.remove("selected"));
      option.classList.add("selected");
      playerClient.selectedAvatar = option.dataset.avatar;
    });
  });

  document.getElementById("confirm-nickname-btn").addEventListener("click", () => {
    const nickname = document.getElementById("nickname-input").value.trim();
    if (nickname.length < 2) {
      alert("Ingresa un nombre de al menos 2 caracteres");
      return;
    }

    const btn = document.getElementById("confirm-nickname-btn");
    btn.disabled = true;
    btn.textContent = "✅ Confirmado";
    playerClient.nicknameConfirmed = true;

    playerClient.nickname = playerClient.selectedAvatar + " " + nickname;
    playerClient.send("JOIN_ROOM", {
      pin: playerClient.pin,
      nickname: playerClient.nickname,
    });
  });

  document.getElementById("scan-qr-btn").addEventListener("click", async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      const video = document.getElementById("qr-video");
      const scanner = document.getElementById("qr-scanner");

      video.srcObject = stream;
      scanner.classList.remove("hidden");

      const canvas = document.getElementById("qr-canvas");
      const ctx = canvas.getContext("2d");
      let scanning = true;

      const scan = () => {
        if (!scanning) return;

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code) {
            const urlParams = new URLSearchParams(new URL(code.data).search);
            const pin = urlParams.get("pin");

            if (pin) {
              scanning = false;
              video.srcObject.getTracks().forEach((track) => track.stop());
              scanner.classList.add("hidden");

              document.getElementById("pin-input").value = pin;
              playerClient.joinRoom();
            }
          }
        }

        if (scanning) {
          requestAnimationFrame(scan);
        }
      };

      scan();
    } catch (err) {
      alert("No se pudo acceder a la cámara");
      console.error(err);
    }
  });

  document.getElementById("close-scanner").addEventListener("click", () => {
    const video = document.getElementById("qr-video");
    if (video.srcObject) {
      video.srcObject.getTracks().forEach((track) => track.stop());
    }
    document.getElementById("qr-scanner").classList.add("hidden");
  });

  document.getElementById("submit-answer-btn").addEventListener("click", () => {
    playerClient.submitAnswer();
  });
});
