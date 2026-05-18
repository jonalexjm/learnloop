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

function getGameForRound(session, roundIndex) {
  const gameIndex = session.gameOrder[roundIndex];
  const allGames = [
    {
      subject: "english",
      name: "The Five Senses",
      description: "Drag each sense to the correct part of the face!",
      type: "drag_drop",
      timeLimit: 60,
      data: {
        layout: "face-senses",
        items: [
          { id: "sight", label: "Sight", icon: "👁" },
          { id: "hearing", label: "Hearing", icon: "🔊" },
          { id: "smell", label: "Smell", icon: "👃" },
          { id: "taste", label: "Taste", icon: "👅" },
          { id: "touch", label: "Touch", icon: "✋" },
        ],
        dropZones: [
          { id: "sight", label: "Sight", x: 50, y: 32 },
          { id: "hearing", label: "Hearing", x: 82, y: 44 },
          { id: "smell", label: "Smell", x: 50, y: 44 },
          { id: "taste", label: "Taste", x: 50, y: 62 },
          { id: "touch", label: "Touch", x: 18, y: 44 },
        ],
        correctAnswers: [
          { zoneId: "sight", itemId: "sight" },
          { zoneId: "hearing", itemId: "hearing" },
          { zoneId: "smell", itemId: "smell" },
          { zoneId: "taste", itemId: "taste" },
          { zoneId: "touch", itemId: "touch" },
        ],
      },
    },
  ];
  return allGames[gameIndex % allGames.length];
}

function generateGameOrder(totalRounds) {
  const gameOrder = [];
  for (let i = 0; i < totalRounds; i++) {
    gameOrder.push(i % 1);
  }
  return gameOrder;
}

function validateAnswer(round, answers) {
  const gameData = round.gameData;
  if (round.gameType === "drag_drop") {
    const correctPairs = (gameData.correctAnswers || []).map((ca) => `${ca.zoneId}:${ca.itemId}`).sort();
    const userPairs = (answers || []).map((a) => `${a.zoneId}:${a.itemId}`).sort();
    return JSON.stringify(correctPairs) === JSON.stringify(userPairs);
  }
  return false;
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
  if (session.host && session.host.readyState === WebSocket.OPEN) {
    session.host.send(
      JSON.stringify({
        event: "PLAYER_LIST_UPDATE",
        payload: { players: playerList },
      }),
    );
  }
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
    timeLimit: games.timeLimit,
    submissions: new Set(),
  };
  session.rounds.push(round);
  session.state = "playing";

  broadcastToSession(session, {
    event: "ROUND_INTRO",
    payload: {
      roundNumber: round.number,
      totalRounds: session.totalRounds,
      gameType: round.gameType,
      gameName: games.name,
      description: games.description,
    },
  });
  console.log(`🎮 Ronda ${round.number}: ${games.name}`);

  setTimeout(() => {
    broadcastToSession(session, {
      event: "START_ROUND",
      payload: {
        roundNumber: round.number,
        gameType: round.gameType,
        timeLimit: round.timeLimit,
        gameData: round.gameData,
      },
    });

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

  session.host.send(
    JSON.stringify({
      event: "ROUND_RESULT",
      payload: {
        correctAnswers: round.gameData.correctAnswers,
        top5,
        roundNumber: round.number,
        isLastRound,
      },
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

wss.on("connection", (ws) => {
  let clientInfo = { role: null, pin: null, nickname: null };

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      const { event, payload } = data;

      switch (event) {
        case "CREATE_ROOM": {
          const pin = generatePIN();
          const totalRounds = payload.rounds || 5;
          const gameOrder = generateGameOrder(totalRounds);

          const session = {
            pin,
            host: ws,
            players: new Map(),
            state: "lobby",
            currentRound: 0,
            totalRounds,
            rounds: [],
            gameHistory: [],
            createdAt: new Date().toISOString(),
            timer: null,
            subjects: ["english"],
            gameOrder,
          };

          sessions.set(pin, session);
          clientInfo = { role: "host", pin };
          ws.send(JSON.stringify({ event: "ROOM_CREATED", payload: { pin, subjects: ["english"] } }));
          console.log(`🏠 Sala creada: ${pin}`);
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

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║           🎓 LEARNLOOP SERVER                      ║
║           http://localhost:${PORT}                  ║
╚═══════════════════════════════════════════════════╝
    `);
});
