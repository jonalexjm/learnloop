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
        document.getElementById('room-pin').textContent = this.pin;
        generateQRCode(this.pin);
        showScreen('lobby-screen');
    }

    onPlayerJoined(payload) {
        this.totalPlayers = payload.count || payload.playerCount || this.totalPlayers;
        this.updatePlayerCount();
        this.enableStartButton();
        console.log('🎉 Nuevo jugador llegó:', payload.nickname, 'Total:', this.totalPlayers);
    }

    onPlayerLeft(payload) {
        this.totalPlayers = payload.count;
        this.updatePlayerCount();
        
        const playersList = document.getElementById('players-list');
        if (playersList) {
            const chips = playersList.querySelectorAll('.player-chip');
            const toRemove = Array.from(chips).find(chip => chip.textContent === payload.nickname);
            if (toRemove) toRemove.remove();
        }
    }

    onPlayerListUpdate(payload) {
        console.log('📋 Actualizando lista de jugadores:', payload.players);
        this.updatePlayersList(payload.players);
    }

    updatePlayerCount() {
        document.getElementById('player-count').textContent = this.totalPlayers;
        document.getElementById('total-players').textContent = this.totalPlayers;
    }

    enableStartButton() {
        const btn = document.getElementById('start-game-btn');
        if (this.totalPlayers > 0) {
            btn.disabled = false;
        }
    }

    updatePlayersList(players) {
        const container = document.getElementById('players-list');
        
        if (players.length === 0) {
            container.innerHTML = '<p class="empty-msg">Esperando jugadores...</p>';
            return;
        }

        container.innerHTML = players.map(name => `
            <div class="player-chip">${name}</div>
        `).join('');
    }

    onGameStarting(payload) {
        showScreen('intro-screen');
    }

    onRoundIntro(payload) {
        showScreen('intro-screen');
        
        document.getElementById('current-round').textContent = payload.roundNumber;
        document.getElementById('total-rounds').textContent = payload.totalRounds;
        document.getElementById('game-title').textContent = payload.gameName;
        document.getElementById('game-description').textContent = payload.description;
        
        this.startCountdown(3);
    }

    startCountdown(seconds) {
        const countdownEl = document.getElementById('countdown');
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
        showScreen('game-screen');
    }

    onStartRound(payload) {
        showScreen('game-screen');
        
        document.getElementById('game-type-badge').textContent = this.getGameTypeLabel(payload.gameType);
        document.getElementById('game-name-display').textContent = payload.gameType;
        
        this.renderHostGame(payload);
        this.startTimer(payload.timeLimit);
    }

    getGameTypeLabel(type) {
        const labels = {
            'drag_drop': '🎯 Arrastre',
            'classify': '📂 Clasificar'
        };
        return labels[type] || '🎮 Juego';
    }

    renderHostGame(payload) {
        const display = document.getElementById('game-display');
        const gameData = payload.gameData;
        
        if (payload.gameType === 'drag_drop') {
            display.innerHTML = this.renderDragDropHost(gameData);
        } else if (payload.gameType === 'classify') {
            display.innerHTML = this.renderClassifyHost(gameData);
        }
    }

    renderDragDropHost(gameData) {
        const dropZones = gameData.dropZones.map(zone => `
            <div class="drop-zone" style="position: absolute; left: ${zone.x}%; top: ${zone.y}%; transform: translate(-50%, -50%);" data-zone-id="${zone.id}">
                ${zone.text}
            </div>
        `).join('');

        const items = gameData.items.map(item => `
            <div class="drag-item" data-item-id="${item.id}">
                ${item.text}
            </div>
        `).join('');

        return `
            <div class="drag-game-container" style="position: relative; height: 400px;">
                <p style="text-align: center; color: var(--gray); margin-bottom: 20px;">
                    Los jugadores están resolviendo el juego...
                </p>
                <div style="display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; margin-top: 100px;">
                    ${items}
                </div>
            </div>
        `;
    }

    renderClassifyHost(gameData) {
        const categories = gameData.categories.map(cat => `
            <div class="category-box" data-category-id="${cat.id}">
                <h4>${cat.label}</h4>
            </div>
        `).join('');

        const items = gameData.items.map(item => `
            <div class="classify-item" data-item-id="${item.id}">
                ${item.text}
            </div>
        `).join('');

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
        const circle = document.getElementById('timer-circle');
        const text = document.getElementById('timer-text');
        
        const circumference = 2 * Math.PI * 45;
        circle.style.strokeDasharray = circumference;
        
        let remaining = seconds;
        
        const updateTimer = () => {
            text.textContent = remaining;
            const offset = circumference * (1 - remaining / seconds);
            circle.style.strokeDashoffset = offset;
            
            if (remaining <= 10) {
                circle.style.stroke = '#ef4444';
            } else if (remaining <= 20) {
                circle.style.stroke = '#f59e0b';
            } else {
                circle.style.stroke = '#22c55e';
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
        const text = document.getElementById('timer-text');
        if (text) text.textContent = payload.remaining;
    }

    onSubmissionUpdate(payload) {
        document.getElementById('submission-count').textContent = payload.submitted;
    }

    onAllSubmissionsComplete(payload) {
        // Mostrar un indicador visual de que todos han respondido
        const submissionCount = document.getElementById('submission-count');
        if (submissionCount) {
            submissionCount.style.color = '#22c55e';
            submissionCount.style.fontWeight = 'bold';
            submissionCount.style.fontSize = '1.2em';
            
            // Animar con un pulso
            submissionCount.style.animation = 'pulse 0.6s ease-in-out 2';
        }
        
        // Log para confirmación
        console.log('✅ Todos los participantes han respondido. La ronda finalizará automáticamente...');
    }

    onRoundResult(payload) {
        showScreen('results-screen');
        
        document.getElementById('result-title').textContent = `Resultados - Ronda ${payload.roundNumber}`;
        
        const solutionDisplay = document.getElementById('solution-display');
        solutionDisplay.innerHTML = payload.correctAnswers.map(ca => 
            `<span style="padding: 10px 20px; background: var(--gradient); border-radius: 10px;">✓</span>`
        ).join('');
        
        const podiumList = document.getElementById('podium-list');
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        
        podiumList.innerHTML = payload.top5.map((player, i) => {
            const displayName = player.nickname.split(' ').slice(1).join(' ') || player.nickname;
            return `
                <div class="podium-item">
                    <span class="podium-rank">${medals[i]}</span>
                    <span class="podium-name">${displayName}</span>
                    <span class="podium-score">${player.score} pts</span>
                </div>
            `;
        }).join('');

        // Si es la última ronda, no mostrar botón de siguiente ronda
        // Mostrar automáticamente el结果final inmediatamente
        const nextBtn = document.getElementById('next-round-btn');
        if (payload.isLastRound) {
            nextBtn.style.display = 'none';
            // Llamar directamente para mostrar el resultado final
            hostClient.send('NEXT_ROUND', {});
        } else {
            nextBtn.style.display = 'inline-block';
        }
    }

    onGameEnded(payload) {
        showScreen('final-screen');
        
        const podium = payload.podium;
        
        // Podio principal
        document.getElementById('first-name').textContent = podium[0]?.nickname.split(' ').slice(1).join(' ') || '-';
        document.getElementById('first-score').textContent = podium[0]?.totalScore || '0';
        document.getElementById('second-name').textContent = podium[1]?.nickname.split(' ').slice(1).join(' ') || '-';
        document.getElementById('second-score').textContent = podium[1]?.totalScore || '0';
        document.getElementById('third-name').textContent = payload.allPlayers.length > 2 ? (podium[2]?.nickname.split(' ').slice(1).join(' ') || '-') : '-';
        document.getElementById('third-score').textContent = payload.allPlayers.length > 2 ? (podium[2]?.totalScore || '0') : '0';
        
        // Tabla de posiciones completa
        const allScoresList = document.getElementById('all-scores-list');
        allScoresList.innerHTML = payload.allPlayers.map((player, i) => {
            let rowClass = '';
            if (i === 0) rowClass = 'gold';
            else if (i === 1) rowClass = 'silver';
            else if (i === 2) rowClass = 'bronze';
            
            const displayName = player.nickname.split(' ').slice(1).join(' ') || player.nickname;
            
            return `
                <div class="table-row ${rowClass}">
                    <span class="col-pos">${i + 1}º</span>
                    <span class="col-name">${displayName}</span>
                    <span class="col-score">${player.totalScore} pts</span>
                </div>
            `;
        }).join('');
    }

    onError(payload) {
        alert('Error: ' + payload.message);
    }

    onHostDisconnected() {
        alert('La sesión ha terminado.');
        location.reload();
    }
}

const hostClient = new HostClient();

document.addEventListener('DOMContentLoaded', () => {
    hostClient.connect();
    
    document.getElementById('create-room-btn').addEventListener('click', () => {
        const rounds = parseInt(document.getElementById('rounds-input').value) || 5;
        
        // Obtener materias seleccionadas
        const subjects = [];
        if (document.getElementById('math-subject').checked) subjects.push('math');
        if (document.getElementById('english-subject').checked) subjects.push('english');
        if (document.getElementById('grammar-subject').checked) subjects.push('grammar');
        
        if (subjects.length === 0) {
            alert('Selecciona al menos una materia');
            return;
        }
        
        hostClient.rounds = rounds;
        hostClient.subjects = subjects;
        hostClient.send('CREATE_ROOM', { rounds, subjects });
    });

    document.getElementById('start-game-btn').addEventListener('click', () => {
        hostClient.send('START_GAME', {});
    });

    document.getElementById('next-round-btn').addEventListener('click', () => {
        hostClient.send('NEXT_ROUND', {});
    });
});

function adjustRounds(delta) {
    const input = document.getElementById('rounds-input');
    let value = parseInt(input.value) + delta;
    value = Math.max(1, Math.min(10, value));
    input.value = value;
}