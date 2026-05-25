const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const SESSIONS_DIR = path.join(DATA_DIR, "sessions");
const ANALYTICS_DIR = path.join(DATA_DIR, "analytics");

if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
if (!fs.existsSync(ANALYTICS_DIR)) fs.mkdirSync(ANALYTICS_DIR, { recursive: true });

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, "public", req.url === "/" ? "index.html" : req.url);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || "text/plain";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404);
        res.end("404 Not Found");
      } else {
        res.writeHead(500);
        res.end("500 Internal Server Error");
      }
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    }
  });
});

const wss = new WebSocket.Server({ server });

const sessions = new Map();

function generatePIN() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function sanitizeString(str) {
  return str
    .replace(/[<>\"'&]/g, "")
    .substring(0, 20)
    .trim();
}

function calculateScore(correct, timeRemaining, totalTime, streak) {
  const baseScore = correct ? 100 : 0;
  const timeBonus = correct ? Math.round((timeRemaining / totalTime) * 50) : 0;
  const streakMultiplier = 1 + streak * 0.1;
  return Math.round((baseScore + timeBonus) * streakMultiplier);
}

function saveSessionAnalytics(session) {
  const analytics = {
    sessionId: session.pin,
    createdAt: session.createdAt,
    finishedAt: new Date().toISOString(),
    rounds: session.rounds,
    totalPlayers: session.players.size,
    finalScores: Array.from(session.players.values())
      .map((p) => ({ nickname: p.nickname, totalScore: p.totalScore }))
      .sort((a, b) => b.totalScore - a.totalScore),
    gameDetails: session.gameHistory || [],
  };

  const filename = `session_${session.pin}_${Date.now()}.json`;
  fs.writeFileSync(path.join(ANALYTICS_DIR, filename), JSON.stringify(analytics, null, 2));
  console.log(`📊 Analytics guardados: ${filename}`);
}

wss.on("connection", (ws) => {
  let clientInfo = { role: null, pin: null, nickname: null };

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      const { event, payload } = data;

      switch (event) {
        case "CREATE_ROOM": {
          const pin = generatePIN();
          const subjects = ["senses", "drawing"];
          const gameOrder = [0, 1];

          const session = {
            pin,
            host: ws,
            players: new Map(),
            state: "lobby",
            currentRound: 0,
            totalRounds: gameOrder.length,
            rounds: [],
            gameHistory: [],
            createdAt: new Date().toISOString(),
            timer: null,
            subjects: subjects,
            gameOrder: gameOrder,
          };

          sessions.set(pin, session);
          clientInfo = { role: "host", pin };
          ws.send(JSON.stringify({ event: "ROOM_CREATED", payload: { pin, subjects } }));
          console.log(`🏠 Sala creada: ${pin} - Materias: ${subjects.join(", ")}`);
          break;
        }

        case "JOIN_ROOM": {
          const pin = sanitizeString(payload.pin);
          const nickname = sanitizeString(payload.nickname);
          const session = sessions.get(pin);

          if (!session) {
            ws.send(JSON.stringify({ event: "ERROR", payload: { message: "Sala no encontrada" } }));
            return;
          }

          // Check if player already exists (re-joining with nickname)
          if (session.players.has(ws) && nickname) {
            const player = session.players.get(ws);
            const oldNickname = player.nickname;
            player.nickname = nickname;
            clientInfo = { role: "player", pin, nickname };

            ws.send(
              JSON.stringify({
                event: "JOINED",
                payload: { nickname, playerId: player.id, playerCount: session.players.size },
              }),
            );

            session.host.send(
              JSON.stringify({
                event: "PLAYER_JOINED",
                payload: { nickname, count: session.players.size, oldNickname },
              }),
            );

            broadcastPlayerList(session);
            console.log(`👤 ${nickname} completó registro en sala ${pin}`);
            break;
          }

          if (session.players.size >= 20) {
            ws.send(JSON.stringify({ event: "ERROR", payload: { message: "Sala llena (max 20)" } }));
            return;
          }

          const playerId = `player_${Date.now()}`;
          session.players.set(ws, {
            id: playerId,
            nickname: nickname || "Anonimo",
            totalScore: 0,
            streak: 0,
            correctAnswers: 0,
          });

          clientInfo = { role: "player", pin, nickname: nickname || "Anonimo" };
          ws.send(
            JSON.stringify({
              event: "JOINED",
              payload: { nickname: nickname || "Anonimo", playerId, playerCount: session.players.size },
            }),
          );

          session.host.send(
            JSON.stringify({
              event: "PLAYER_JOINED",
              payload: { nickname: nickname || "Anonimo", count: session.players.size },
            }),
          );

          broadcastPlayerList(session);
          console.log(`👤 ${nickname || "Anonimo"} se unió a sala ${pin}`);
          break;
        }

        case "START_GAME": {
          const session = sessions.get(clientInfo.pin);
          if (!session || clientInfo.role !== "host") return;

          session.currentRound = 0;
          session.state = "playing";
          broadcastToSession(session, { event: "GAME_STARTING", payload: { totalRounds: session.totalRounds } });
          setTimeout(() => startNextRound(session), 3000);
          break;
        }

        case "SUBMIT_ANSWER": {
          const session = sessions.get(clientInfo.pin);
          if (!session || clientInfo.role !== "player") return;

          const player = session.players.get(ws);
          if (!player || session.state !== "playing") return;

          const round = session.rounds[session.currentRound];
          if (!round) return;

          const isCorrect = validateAnswer(round, payload.answers);
          player.correctAnswers += isCorrect ? 1 : 0;
          player.streak = isCorrect ? player.streak + 1 : 0;

          const score = calculateScore(isCorrect, payload.timeRemaining, round.timeLimit, player.streak);
          player.totalScore += score;

          if (!round.submissions) round.submissions = new Set();
          round.submissions.add(ws);

          if (round.answerMode === "drawing") {
            if (!round.drawings) round.drawings = new Map();
            const drawing = payload?.answers?.drawing || payload?.answers?.dataUrl || null;
            round.drawings.set(ws, { nickname: player.nickname, drawing });
          }

          session.host.send(
            JSON.stringify({
              event: "SUBMISSION_UPDATE",
              payload: { submitted: round.submissions.size, total: session.players.size },
            }),
          );

          ws.send(
            JSON.stringify({
              event: "ANSWER_RESULT",
              payload: { correct: isCorrect, score, totalScore: player.totalScore, streak: player.streak },
            }),
          );

          // Verificar si todos han respondido y finalizar automáticamente
          if (checkAllSubmissionsComplete(session)) {
            notifyAllSubmissionsComplete(session);
            clearInterval(session.timer);
            finishRound(session);
          }
          break;
        }

        case "NEXT_ROUND": {
          const session = sessions.get(clientInfo.pin);
          if (!session || clientInfo.role !== "host") return;
          startNextRound(session);
          break;
        }

        case "END_GAME": {
          const session = sessions.get(clientInfo.pin);
          if (!session || clientInfo.role !== "host") return;
          endGame(session);
          break;
        }

        case "LEAVE_ROOM": {
          handlePlayerDisconnect(ws, clientInfo);
          break;
        }
      }
    } catch (e) {
      console.error("Error procesando mensaje:", e);
    }
  });

  ws.on("close", () => {
    handlePlayerDisconnect(ws, clientInfo);
  });
});

function startNextRound(session) {
  if (session.currentRound >= session.totalRounds) {
    endGame(session);
    return;
  }

  const games = getGameForRound(session, session.currentRound);
  const round = {
    number: session.currentRound + 1,
    gameType: games.type,
    gameData: games.data,
    answerMode: games.answerMode || null,
    timeLimit: games.timeLimit,
    submissions: new Set(),
    drawings: games.answerMode === "drawing" ? new Map() : null,
  };

  session.rounds.push(round);
  session.state = "playing";

  const introPayload = {
    roundNumber: round.number,
    totalRounds: session.totalRounds,
    gameType: round.gameType,
    gameName: games.name,
    description: games.description,
  };

  broadcastToSession(session, { event: "ROUND_INTRO", payload: introPayload });
  console.log(`🎮 Ronda ${round.number}: ${games.name}`);

  setTimeout(() => {
    const gamePayload = {
      roundNumber: round.number,
      gameType: round.gameType,
      answerMode: round.answerMode,
      timeLimit: round.timeLimit,
      gameData: round.gameData,
    };
    broadcastToSession(session, { event: "START_ROUND", payload: gamePayload });

    const startTime = Date.now();

    session.timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = round.timeLimit - elapsed;

      broadcastToSession(session, {
        event: "TIMER_UPDATE",
        payload: { remaining, total: round.timeLimit },
      });

      if (remaining <= 0) {
        clearInterval(session.timer);
        finishRound(session);
      }
    }, 1000);
  }, 3000);
}

function finishRound(session) {
  session.state = "results";
  clearInterval(session.timer);
  session.currentRound++;

  const round = session.rounds[session.currentRound - 1];
  const sortedPlayers = Array.from(session.players.entries())
    .map(([ws, p]) => ({ nickname: p.nickname, score: p.totalScore, correct: p.correctAnswers }))
    .sort((a, b) => b.score - a.score);

  const top5 = sortedPlayers.slice(0, 5);
  const isLastRound = session.currentRound >= session.totalRounds;

  const roundResultPayload = {
    correctAnswers: round.gameData.correctAnswers,
    top5,
    roundNumber: round.number,
    isLastRound: isLastRound,
  };

  if (round.answerMode === "drawing") {
    roundResultPayload.drawings = Array.from(round.drawings.values()).filter((entry) => entry.drawing);
  }

  session.host.send(
    JSON.stringify({
      event: "ROUND_RESULT",
      payload: roundResultPayload,
    }),
  );

  session.players.forEach((p, client) => {
    if (client.readyState === WebSocket.OPEN) {
      const playerScore = sortedPlayers.find((s) => s.nickname === p.nickname);
      client.send(
        JSON.stringify({
          event: "PLAYER_RESULT",
          payload: {
            rank: sortedPlayers.findIndex((s) => s.nickname === p.nickname) + 1,
            totalPlayers: sortedPlayers.length,
            score: playerScore?.score || 0,
            correct: p.correctAnswers,
          },
        }),
      );
    }
  });

  console.log(`📊 Ronda ${round.number} terminada - Top: ${top5[0]?.nickname}`);
}

function endGame(session) {
  session.state = "ended";
  clearInterval(session.timer);

  const finalScores = Array.from(session.players.values())
    .map((p) => ({ nickname: p.nickname, totalScore: p.totalScore, correctAnswers: p.correctAnswers }))
    .sort((a, b) => b.totalScore - a.totalScore);

  const podium = finalScores.slice(0, 3);

  broadcastToSession(session, {
    event: "GAME_ENDED",
    payload: { podium, allPlayers: finalScores },
  });

  saveSessionAnalytics(session);
  console.log(`🏆 Juego terminado - Ganador: ${podium[0]?.nickname}`);

  setTimeout(() => {
    sessions.delete(session.pin);
  }, 60000);
}

function broadcastToSession(session, message) {
  session.host.send(JSON.stringify(message));
  session.players.forEach((p, client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

function broadcastPlayerList(session) {
  const playerList = Array.from(session.players.values()).map((p) => p.nickname);

  // Send to host
  if (session.host && session.host.readyState === WebSocket.OPEN) {
    session.host.send(
      JSON.stringify({
        event: "PLAYER_LIST_UPDATE",
        payload: { players: playerList },
      }),
    );
  }

  // Send to all players
  session.players.forEach((p, client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          event: "PLAYER_LIST_UPDATE",
          payload: { players: playerList },
        }),
      );
    }
  });
}

function handlePlayerDisconnect(ws, clientInfo) {
  if (clientInfo.role === "host" && clientInfo.pin) {
    const session = sessions.get(clientInfo.pin);
    if (session) {
      broadcastToSession(session, { event: "HOST_DISCONNECTED", payload: {} });
      sessions.delete(clientInfo.pin);
      console.log(`🚪 Host desconectado, sala ${clientInfo.pin} cerrada`);
    }
  } else if (clientInfo.role === "player" && clientInfo.pin) {
    const session = sessions.get(clientInfo.pin);
    if (session && session.players.has(ws)) {
      const player = session.players.get(ws);
      session.players.delete(ws);

      session.host.send(
        JSON.stringify({
          event: "PLAYER_LEFT",
          payload: { nickname: player.nickname, count: session.players.size },
        }),
      );
      console.log(`👋 ${player.nickname} salió de la sala`);
    }
  }
}

function validateAnswer(round, answers) {
  const gameData = round.gameData;

  if (round.answerMode === "item_to_zone") {
    return validateItemToZoneAnswer(answers, gameData.correctAnswers);
  }

  if (round.answerMode === "drawing") {
    const drawing = answers?.drawing || answers?.dataUrl || null;
    return typeof drawing === "string" && drawing.startsWith("data:image/");
  }

  if (round.gameType === "drag_drop" || round.gameType === "classify") {
    return JSON.stringify(answers) === JSON.stringify(gameData.correctAnswers);
  }
  return false;
}

function validateItemToZoneAnswer(answers, correctAnswers) {
  if (!Array.isArray(answers) || !Array.isArray(correctAnswers)) {
    return false;
  }

  if (answers.length !== correctAnswers.length) {
    return false;
  }

  const byItem = new Map();
  answers.forEach((answer) => {
    if (answer && answer.itemId && answer.zoneId) {
      byItem.set(answer.itemId, answer.zoneId);
    }
  });

  if (byItem.size !== correctAnswers.length) {
    return false;
  }

  return correctAnswers.every(({ itemId, zoneId }) => byItem.get(itemId) === zoneId);
}

function checkAllSubmissionsComplete(session) {
  const round = session.rounds[session.currentRound];
  if (!round) return false;

  const submitted = round.submissions?.size || 0;
  const total = session.players.size;

  return submitted === total && total > 0;
}

function notifyAllSubmissionsComplete(session) {
  broadcastToSession(session, {
    event: "ALL_SUBMISSIONS_COMPLETE",
    payload: { totalSubmissions: session.players.size },
  });
}

function getLegacyGameForRound(roundIndex) {
  const games = [
    {
      name: "Matemáticas: Operaciones",
      description: "Arrastra cada operación a su resultado correcto",
      type: "drag_drop",
      timeLimit: 45,
      data: {
        background: "math",
        items: [
          { id: "i1", text: "5 + 3", correctZone: "z1" },
          { id: "i2", text: "10 - 4", correctZone: "z2" },
          { id: "i3", text: "2 × 6", correctZone: "z3" },
          { id: "i4", text: "15 ÷ 3", correctZone: "z4" },
        ],
        dropZones: [
          { id: "z1", text: "8", x: 20, y: 30 },
          { id: "z2", text: "6", x: 50, y: 30 },
          { id: "z3", text: "12", x: 80, y: 30 },
          { id: "z4", text: "5", x: 50, y: 70 },
        ],
        correctAnswers: [
          { zoneId: "z1", itemId: "i1" },
          { zoneId: "z2", itemId: "i2" },
          { zoneId: "z3", itemId: "i3" },
          { zoneId: "z4", itemId: "i4" },
        ],
      },
    },
    {
      name: "Matemáticas: Par o Impar",
      description: "Clasifica cada número en el contenedor correcto",
      type: "classify",
      timeLimit: 40,
      data: {
        categories: [
          { id: "par", label: "PAR", x: 15, y: 20 },
          { id: "impar", label: "IMPAR", x: 55, y: 20 },
        ],
        items: [
          { id: "n1", text: "8", correctCategory: "par" },
          { id: "n2", text: "15", correctCategory: "impar" },
          { id: "n3", text: "22", correctCategory: "par" },
          { id: "n4", text: "31", correctCategory: "impar" },
          { id: "n5", text: "44", correctCategory: "par" },
          { id: "n6", text: "57", correctCategory: "impar" },
        ],
        correctAnswers: { par: ["n1", "n3", "n5"], impar: ["n2", "n4", "n6"] },
      },
    },
    {
      name: "Inglés: Vocabulario",
      description: "Arrastra cada palabra a su traducción correcta",
      type: "drag_drop",
      timeLimit: 45,
      data: {
        background: "english",
        items: [
          { id: "i1", text: "Apple", correctZone: "z1" },
          { id: "i2", text: "House", correctZone: "z2" },
          { id: "i3", text: "Water", correctZone: "z3" },
          { id: "i4", text: "Book", correctZone: "z4" },
        ],
        dropZones: [
          { id: "z1", text: "🍎 Manzana", x: 20, y: 30 },
          { id: "z2", text: "🏠 Casa", x: 50, y: 30 },
          { id: "z3", text: "💧 Agua", x: 80, y: 30 },
          { id: "z4", text: "📖 Libro", x: 50, y: 70 },
        ],
        correctAnswers: [
          { zoneId: "z1", itemId: "i1" },
          { zoneId: "z2", itemId: "i2" },
          { zoneId: "z3", itemId: "i3" },
          { zoneId: "z4", itemId: "i4" },
        ],
      },
    },
    {
      name: "Inglés: Partes del Discurso",
      description: "Clasifica cada palabra: Verbo, Sustantivo o Adjetivo",
      type: "classify",
      timeLimit: 40,
      data: {
        categories: [
          { id: "verb", label: "VERBS", x: 10, y: 20 },
          { id: "noun", label: "NOUNS", x: 40, y: 20 },
          { id: "adj", label: "ADJECTIVES", x: 70, y: 20 },
        ],
        items: [
          { id: "w1", text: "Run", correctCategory: "verb" },
          { id: "w2", text: "Dog", correctCategory: "noun" },
          { id: "w3", text: "Beautiful", correctCategory: "adj" },
          { id: "w4", text: "Eat", correctCategory: "verb" },
          { id: "w5", text: "Car", correctCategory: "noun" },
          { id: "w6", text: "Happy", correctCategory: "adj" },
        ],
        correctAnswers: { verb: ["w1", "w4"], noun: ["w2", "w5"], adj: ["w3", "w6"] },
      },
    },
    {
      name: "Gramática: Acentuación",
      description: "Coloca la tilde en la sílaba correcta",
      type: "drag_drop",
      timeLimit: 40,
      data: {
        background: "accent",
        items: [
          { id: "i1", text: "camion", correctZone: "z1" },
          { id: "i2", text: "raton", correctZone: "z2" },
          { id: "i3", text: "joven", correctZone: "z3" },
          { id: "i4", text: "caliz", correctZone: "z4" },
        ],
        dropZones: [
          { id: "z1", text: "camión", x: 20, y: 30 },
          { id: "z2", text: "ratón", x: 50, y: 30 },
          { id: "z3", text: "joven", x: 80, y: 30 },
          { id: "z4", text: "cáiz", x: 50, y: 70 },
        ],
        correctAnswers: [
          { zoneId: "z1", itemId: "i1" },
          { zoneId: "z2", itemId: "i2" },
          { zoneId: "z3", itemId: "i3" },
          { zoneId: "z4", itemId: "i4" },
        ],
      },
    },
    {
      name: "Gramática: Clasifica la palabra",
      description: "Clasifica cada palabra en su categoría gramatical",
      type: "classify",
      timeLimit: 40,
      data: {
        categories: [
          { id: "verbo", label: "VERBO", x: 10, y: 20 },
          { id: "sustantivo", label: "SUSTANTIVO", x: 40, y: 20 },
          { id: "adj", label: "ADJETIVO", x: 70, y: 20 },
        ],
        items: [
          { id: "p1", text: "Correr", correctCategory: "verbo" },
          { id: "p2", text: "Mesa", correctCategory: "sustantivo" },
          { id: "p3", text: "Rojo", correctCategory: "adj" },
          { id: "p4", text: "Hablar", correctCategory: "verbo" },
          { id: "p5", text: "Libro", correctCategory: "sustantivo" },
          { id: "p6", text: "Grande", correctCategory: "adj" },
        ],
        correctAnswers: { verbo: ["p1", "p4"], sustantivo: ["p2", "p5"], adj: ["p3", "p6"] },
      },
    },
  ];

  return games[roundIndex % games.length];
}

function getGameForRound(session, roundIndex) {
  const gameIndex = session.gameOrder[roundIndex] || 0;
  const allGames = [
    {
      subject: "senses",
      name: "Five Senses",
      description: "Drag each sense to the correct body part.",
      type: "drag_drop",
      timeLimit: 120,
      answerMode: "item_to_zone",
      data: {
        mode: "senses_svg",
        svgPath: "img/1.svg",
        instruction: "Drag each sense to the correct place.",
        items: [
          { id: "sense_vision", text: "Sight", icon: "👀" },
          { id: "sense_hearing", text: "Hearing", icon: "👂" },
          { id: "sense_smell", text: "Smell", icon: "👃" },
          { id: "sense_taste", text: "Taste", icon: "👅" },
          { id: "sense_touch", text: "Touch", icon: "✋" },
        ],
        dropZones: [
          { id: "zone_eyes", text: "Eyes", side: "left" },
          { id: "zone_ear", text: "Ear", side: "left" },
          { id: "zone_nose", text: "Nose", side: "center" },
          { id: "zone_mouth", text: "Mouth", side: "right" },
          { id: "zone_hands", text: "Hands", side: "right" },
        ],
        correctAnswers: [
          { itemId: "sense_vision", zoneId: "zone_eyes" },
          { itemId: "sense_hearing", zoneId: "zone_ear" },
          { itemId: "sense_smell", zoneId: "zone_nose" },
          { itemId: "sense_taste", zoneId: "zone_mouth" },
          { itemId: "sense_touch", zoneId: "zone_hands" },
        ],
      },
    },
    {
      subject: "drawing",
      name: "Dibuja tu idea",
      description: "Dibuja algo relacionado con el tema en tu pantalla.",
      type: "drawing",
      timeLimit: 120,
      answerMode: "drawing",
      data: {
        prompt: "Dibuja tu cosa favorita usando los sentidos.",
        colors: ["#111827", "#ef4444", "#f59e0b", "#22c55e", "#06b6d4", "#8b5cf6"],
        brushSizes: [4, 8, 12, 18],
      },
    },
  ];

  return allGames[gameIndex] || allGames[0];
}

function generateGameOrder(subjects, totalRounds) {
  const subjectGames = {
    math: [0, 1],
    english: [2, 3],
    grammar: [4, 5],
  };

  let availableGames = [];
  subjects.forEach((sub) => {
    availableGames = availableGames.concat(subjectGames[sub] || []);
  });

  const gameOrder = [];
  for (let i = 0; i < totalRounds; i++) {
    const randomIndex = Math.floor(Math.random() * availableGames.length);
    gameOrder.push(availableGames[randomIndex]);
  }

  return gameOrder;
}

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║           🎓 LEARNLOOP SERVER                      ║
║           http://localhost:${PORT}                  ║
╚═══════════════════════════════════════════════════╝
    `);
});
