// LearnLoop - Player.js (Lógica del Jugador)

class PlayerClient extends LearnLoopClient {
  constructor() {
    super();
    this.playerId = null;
    this.score = 0;
    this.streak = 0;
    this.currentGameType = null;
    this.currentGameData = null;
    this.currentAnswerMode = null;
    this.gameAnswers = {};
    this.submitted = false;
    this.selectedAvatar = "🦊";
    this.nicknameConfirmed = false;
    this.selectedSenseItemId = null;
    this.isTouchDraggingSense = false;
    this.touchSenseGhost = null;
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

      if (count < 0) {
        clearInterval(interval);
      }
    }, 1000);
  }

  onStartRound(payload) {
    this.currentGameType = payload.gameType;
    this.currentGameData = payload.gameData;
    this.currentAnswerMode = payload.answerMode || null;
    this.gameAnswers = {};
    this.submitted = false;
    this.selectedSenseItemId = null;
    this.clearTouchSenseGhost();

    document.getElementById("submit-answer-btn").disabled = false;
    document.getElementById("submit-answer-btn").textContent = "✅ Enviar Respuesta";

    showScreen("player-game-screen");
    this.renderPlayerGame(payload);
    this.startPlayerTimer(payload.timeLimit);
  }

  renderPlayerGame(payload) {
    const gameArea = document.getElementById("player-game-area");

    if (payload.gameData?.mode === "senses_svg") {
      gameArea.innerHTML = this.renderSensesSVGGame(payload.gameData);
      this.initSensesSVGGame(payload.gameData);
    } else if (payload.gameType === "drag_drop") {
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
            <div class="drop-zone" data-zone-id="${zone.id}" 
                 style="left: ${zone.x}%; top: ${zone.y}%;">
                ${zone.text}
            </div>
        `,
      )
      .join("");

    const items = gameData.items
      .map(
        (item) => `
            <div class="drag-item" data-item-id="${item.id}" draggable="true">
                ${item.text}
            </div>
        `,
      )
      .join("");

    return `
            <div class="drag-game-container">
                <div class="game-area" style="position: relative; min-height: 350px;">
                    ${dropZones}
                </div>
                <div class="items-row" id="items-pool">
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

  renderSensesSVGGame(gameData) {
    const items = gameData.items
      .map(
        (item) => `
          <button type="button" class="sense-item-card" data-item-id="${item.id}" draggable="true">
            <span class="sense-item-icon">${item.icon || "✨"}</span>
            <span class="sense-item-label">${item.text}</span>
          </button>
        `,
      )
      .join("");

    return `
      <div class="senses-game-shell">
        <div class="senses-instruction">${gameData.instruction || "Drag each sense to the correct place."}</div>
        <div class="senses-layout">
          <div class="senses-side-column" id="senses-left-zones"></div>
          <div class="senses-svg-stage">
            <div class="senses-svg-frame" id="senses-svg-frame"></div>
          </div>
          <div class="senses-side-column" id="senses-right-zones"></div>
        </div>
        <div class="senses-items-pool" id="senses-items-pool">
          ${items}
        </div>
      </div>
    `;
  }

  async initSensesSVGGame(gameData) {
    this.setupSensesSideTargets(gameData);

    const frame = document.getElementById("senses-svg-frame");
    if (frame && gameData.svgPath) {
      try {
        const response = await fetch(gameData.svgPath);
        if (response.ok) {
          frame.innerHTML = await response.text();
        } else {
          frame.innerHTML = `<img src="${gameData.svgPath}" alt="Body outline" class="senses-fallback-image">`;
        }
      } catch {
        frame.innerHTML = `<img src="${gameData.svgPath}" alt="Body outline" class="senses-fallback-image">`;
      }
    }

    const cards = document.querySelectorAll(".sense-item-card");
    cards.forEach((card) => this.makeSenseItemDraggable(card));
  }

  setupSensesSideTargets(gameData) {
    const leftColumn = document.getElementById("senses-left-zones");
    const rightColumn = document.getElementById("senses-right-zones");

    if (!leftColumn || !rightColumn) {
      return;
    }

    const zones = gameData.dropZones || [];
    const leftZones = zones.filter((zone) => zone.side === "left");
    const rightZones = zones.filter((zone) => zone.side !== "left");

    leftColumn.innerHTML = leftZones
      .map(
        (zone) => `
          <div class="sense-target" data-zone-id="${zone.id}" data-zone-name="${zone.text}">
            <div class="sense-target-name">${zone.text}</div>
            <div class="sense-target-value">Drop Here</div>
          </div>
        `,
      )
      .join("");

    rightColumn.innerHTML = rightZones
      .map(
        (zone) => `
          <div class="sense-target" data-zone-id="${zone.id}" data-zone-name="${zone.text}">
            <div class="sense-target-name">${zone.text}</div>
            <div class="sense-target-value">Drop Here</div>
          </div>
        `,
      )
      .join("");

    const targets = document.querySelectorAll(".sense-target");
    targets.forEach((target) => {
      target.addEventListener("dragover", (e) => {
        e.preventDefault();
        target.classList.add("hover");
      });

      target.addEventListener("dragleave", () => {
        target.classList.remove("hover");
      });

      target.addEventListener("drop", (e) => {
        e.preventDefault();
        target.classList.remove("hover");

        const itemId = e.dataTransfer.getData("text/plain");
        this.assignSenseToZone(itemId, target.dataset.zoneId);
      });

      target.addEventListener("click", () => {
        if (this.selectedSenseItemId) {
          this.assignSenseToZone(this.selectedSenseItemId, target.dataset.zoneId);
        }
      });
    });
  }

  makeSenseItemDraggable(card) {
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", card.dataset.itemId);
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
    });

    card.addEventListener("click", () => {
      if (card.dataset.ignoreClick === "true") {
        card.dataset.ignoreClick = "false";
        return;
      }

      const itemId = card.dataset.itemId;

      if (this.selectedSenseItemId === itemId) {
        this.selectedSenseItemId = null;
      } else {
        this.selectedSenseItemId = itemId;
      }

      document.querySelectorAll(".sense-item-card").forEach((el) => {
        el.classList.toggle("selected", el.dataset.itemId === this.selectedSenseItemId);
      });
    });

    card.addEventListener(
      "touchstart",
      () => {
        this.isTouchDraggingSense = false;
        this.selectedSenseItemId = card.dataset.itemId;
        card.classList.add("dragging");

        document.querySelectorAll(".sense-item-card").forEach((el) => {
          el.classList.toggle("selected", el.dataset.itemId === this.selectedSenseItemId);
        });
      },
      { passive: true },
    );

    card.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();

        const touch = e.touches[0];
        if (!touch) {
          return;
        }

        if (!this.isTouchDraggingSense) {
          this.isTouchDraggingSense = true;
          this.createTouchSenseGhost(card, touch);
        }

        this.updateTouchSenseGhostPosition(touch);
        const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);
        const target = elementAtPoint?.closest(".sense-target");

        document.querySelectorAll(".sense-target").forEach((zone) => zone.classList.remove("hover"));
        if (target) {
          target.classList.add("hover");
        }
      },
      { passive: false },
    );

    card.addEventListener("touchend", (e) => {
      card.classList.remove("dragging");
      document.querySelectorAll(".sense-target").forEach((zone) => zone.classList.remove("hover"));

      if (!this.isTouchDraggingSense) {
        this.clearTouchSenseGhost();
        return;
      }

      const touch = e.changedTouches[0];
      const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);
      const target = elementAtPoint?.closest(".sense-target");

      if (target?.dataset?.zoneId) {
        this.assignSenseToZone(card.dataset.itemId, target.dataset.zoneId);
      }

      card.dataset.ignoreClick = "true";
      this.isTouchDraggingSense = false;
      this.clearTouchSenseGhost();
    });

    card.addEventListener("touchcancel", () => {
      card.classList.remove("dragging");
      this.isTouchDraggingSense = false;
      this.clearTouchSenseGhost();
      document.querySelectorAll(".sense-target").forEach((zone) => zone.classList.remove("hover"));
    });
  }

  createTouchSenseGhost(card, touch) {
    this.clearTouchSenseGhost();

    const ghost = card.cloneNode(true);
    const width = Math.max(card.getBoundingClientRect().width, 96);

    ghost.classList.add("sense-item-ghost");
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.width = `${Math.round(width)}px`;

    document.body.appendChild(ghost);
    this.touchSenseGhost = ghost;
    this.updateTouchSenseGhostPosition(touch);
  }

  updateTouchSenseGhostPosition(touch) {
    if (!this.touchSenseGhost || !touch) {
      return;
    }

    this.touchSenseGhost.style.left = `${touch.clientX}px`;
    this.touchSenseGhost.style.top = `${touch.clientY}px`;
  }

  clearTouchSenseGhost() {
    if (!this.touchSenseGhost) {
      return;
    }

    this.touchSenseGhost.remove();
    this.touchSenseGhost = null;
  }

  assignSenseToZone(itemId, zoneId) {
    if (!itemId || !zoneId) {
      return;
    }

    const previousZoneForItem = Object.keys(this.gameAnswers).find(
      (existingZoneId) => this.gameAnswers[existingZoneId] === itemId,
    );

    if (previousZoneForItem && previousZoneForItem !== zoneId) {
      delete this.gameAnswers[previousZoneForItem];
    }

    this.gameAnswers[zoneId] = itemId;
    this.selectedSenseItemId = null;

    const cards = document.querySelectorAll(".sense-item-card");
    cards.forEach((card) => {
      const cardItemId = card.dataset.itemId;
      const isPlaced = Object.values(this.gameAnswers).includes(cardItemId);
      card.classList.toggle("placed", isPlaced);
      card.classList.remove("selected");
    });

    this.refreshSenseTargets();
  }

  refreshSenseTargets() {
    const targets = document.querySelectorAll(".sense-target");
    targets.forEach((target) => {
      const zoneId = target.dataset.zoneId;
      const valueEl = target.querySelector(".sense-target-value");
      const itemId = this.gameAnswers[zoneId];

      if (!valueEl) {
        return;
      }

      if (!itemId) {
        valueEl.textContent = "Drop Here";
        target.classList.remove("filled");
        return;
      }

      const item = this.currentGameData.items.find((entry) => entry.id === itemId);
      valueEl.textContent = item ? `${item.icon || ""} ${item.text}`.trim() : "Drop Here";
      target.classList.add("filled");
    });
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
        element.dataset.touchStartY = e.touches[0].clientY;
      },
      { passive: true },
    );

    element.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);

        if (element && element.classList.contains("drop-zone")) {
          element.classList.add("hover");
        }
      },
      { passive: false },
    );

    element.addEventListener("touchend", (e) => {
      const touch = e.changedTouches[0];
      const element = document.elementFromPoint(touch.clientX, touch.clientY);

      if (element && element.classList.contains("drop-zone")) {
        const zoneId = element.dataset.zoneId;
        const itemId = e.target.dataset.itemId;

        if (itemId && zoneId) {
          this.gameAnswers[zoneId] = itemId;
          e.target.style.display = "none";
          element.classList.add("correct");
        }
      }
    });
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

    const timeRemaining = Number.parseInt(document.getElementById("player-timer").textContent, 10);

    let answers = Object.entries(this.gameAnswers).map(([zoneId, itemId]) => ({
      zoneId,
      itemId,
    }));

    if (this.currentAnswerMode === "item_to_zone") {
      answers = Object.entries(this.gameAnswers).map(([zoneId, itemId]) => ({
        itemId,
        zoneId,
      }));
    }

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

    // Mostrar top 3
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

  // Selector de avatar
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

    // Bloquear botón
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

          // Decodificar QR usando jsQR
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code) {
            // Extraer PIN de la URL
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
