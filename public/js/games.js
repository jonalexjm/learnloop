// LearnLoop - Games.js (Utilidades adicionales para juegos)

const GameUtils = {
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    },

    checkDragDropAnswer(answers, correctAnswers) {
        const correctPairs = correctAnswers.map(ca => 
            `${ca.zoneId}:${ca.itemId}`
        );
        
        const userPairs = Object.entries(answers).map(([zoneId, itemId]) => 
            `${zoneId}:${itemId}`
        );
        
        return JSON.stringify(correctPairs.sort()) === JSON.stringify(userPairs.sort());
    },

    checkClassifyAnswer(answers, correctAnswers) {
        for (const [category, items] of Object.entries(correctAnswers)) {
            const userItems = Object.entries(answers)
                .filter(([itemId, cat]) => cat === category)
                .map(([itemId]) => itemId);
            
            const correctItems = items.sort();
            const userSorted = userItems.sort();
            
            if (JSON.stringify(correctItems) !== JSON.stringify(userSorted)) {
                return false;
            }
        }
        return true;
    },

    getEmojiForCategory(category) {
        const emojis = {
            'par': '2️⃣',
            'impar': '1️⃣',
            'verb': '🏃',
            'noun': '📦',
            'adj': '🎨',
            'verbo': '🏃',
            'sustantivo': '📦',
            'verbo': '🏃',
            'sustantivo': '📦',
            'adj': '🎨'
        };
        return emojis[category] || '📝';
    },

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
    },

    animateScoreChange(element, newScore) {
        const currentScore = parseInt(element.textContent) || 0;
        const diff = newScore - currentScore;
        
        if (diff > 0) {
            element.style.transform = 'scale(1.3)';
            element.style.color = '#22c55e';
            
            setTimeout(() => {
                element.style.transform = 'scale(1)';
                element.style.color = '';
            }, 300);
        }
    }
};

window.GameUtils = GameUtils;