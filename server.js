const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// --- 1. የ 400 ካርቴላዎች መረጃ ማመንጫ (Card Data Generator) ---
const bingoCardsDatabase = {};

function generateBingoCards() {
    for (let cardNo = 1; cardNo <= 400; cardNo++) {
        let card = [];
        const ranges = [
            [1, 15], [16, 30], [31, 45], [46, 60], [61, 75]
        ];

        let columns = ranges.map(([min, max]) => {
            let nums = new Set();
            while (nums.size < 5) {
                nums.add(Math.floor(Math.random() * (max - min + 1)) + min);
            }
            return Array.from(nums);
        });

        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                if (row === 2 && col === 2) {
                    card.push('★'); // Free Space
                } else {
                    card.push(columns[col][row]);
                }
            }
        }
        bingoCardsDatabase[cardNo] = card;
    }
}
generateBingoCards();

// --- 2. የጨዋታው ሁኔታ (Game State Management) ---
let roomState = {
    status: 'WAITING', // WAITING, COUNTDOWN, PLAYING
    soldCards: [],
    players: {},
    timeLeft: 30,
    calledNumbers: [],
    availableNumbers: Array.from({ length: 75 }, (_, i) => i + 1),
    timerInterval: null,
    gameInterval: null
};

function getBallLetter(num) {
    if (num <= 15) return 'B';
    if (num <= 30) return 'I';
    if (num <= 45) return 'N';
    if (num <= 60) return 'G';
    return 'O';
}

// የሎቢ ሰዓት ቆጣሪ (Lobby Timer)
function startLobbyTimer() {
    if (roomState.timerInterval) return;

    roomState.timerInterval = setInterval(() => {
        roomState.timeLeft--;
        
        io.emit('roomState', {
            soldCards: roomState.soldCards,
            timeLeft: roomState.timeLeft,
            playersCount: Object.keys(roomState.players).length,
            status: roomState.status,
            calledNumbers: roomState.calledNumbers
        });

        if (roomState.timeLeft <= 0) {
            clearInterval(roomState.timerInterval);
            roomState.timerInterval = null;

            if (roomState.soldCards.length > 0) {
                startCountdownPhase();
            } else {
                roomState.timeLeft = 30;
                startLobbyTimer();
            }
        }
    }, 1000);
}

// የካውንትዳውን ምዕራፍ (3-2-1 Countdown)
function startCountdownPhase() {
    roomState.status = 'COUNTDOWN';
    io.emit('startCountdown');
    
    setTimeout(() => {
        startLiveGame();
    }, 3000);
}

// --- 3. ጨዋታውን ማስጀመር እና በየ 5 ሰከንዱ ቁጥር መጥራት ---
function startLiveGame() {
    roomState.status = 'PLAYING';
    io.emit('gameStarted');

    if (roomState.gameInterval) clearInterval(roomState.gameInterval);

    roomState.gameInterval = setInterval(() => {
        if (roomState.availableNumbers.length === 0) {
            clearInterval(roomState.gameInterval);
            resetRoom();
            return;
        }

        const randomIndex = Math.floor(Math.random() * roomState.availableNumbers.length);
        const drawnNum = roomState.availableNumbers.splice(randomIndex, 1)[0];
        
        roomState.calledNumbers.push(drawnNum);

        io.emit('newBall', {
            num: drawnNum,
            letter: getBallLetter(drawnNum),
            ballsCalled: roomState.calledNumbers.length
        });

    }, 5000); // በየ 5 ሰከንዱ
}

// --- 4. የቢንጎ ህግ ማረጋገጫ (Bingo Logic Validation) ---
function checkBingoWinner(cardArray, calledNumbers) {
    const calledSet = new Set(calledNumbers);
    calledSet.add('★');

    const isMarked = (index) => calledSet.has(cardArray[index]);

    for (let i = 0; i < 5; i++) {
        let rowStart = i * 5;
        if ([0, 1, 2, 3, 4].every(col => isMarked(rowStart + col))) {
            return true;
        }
    }

    for (let col = 0; col < 5; col++) {
        if ([0, 1, 2, 3, 4].every(row => isMarked(row * 5 + col))) {
            return true;
        }
    }

    if ([0, 6, 12, 18, 24].every(index => isMarked(index))) return true;
    if ([4, 8, 12, 16, 20].every(index => isMarked(index))) return true;

    return false;
}

// --- 5. የ Socket.io ክስተቶች (Socket Connection Handlers) ---
io.on('connection', (socket) => {

    // አዲስ ለገባ ተጫዋች አሁን ያለውን የክፍል ሁኔታና የወጡ ቁጥሮች ማድረስ (Spectator Mode Support)
    socket.emit('roomState', {
        soldCards: roomState.soldCards,
        timeLeft: roomState.timeLeft,
        playersCount: Object.keys(roomState.players).length,
        status: roomState.status,
        calledNumbers: roomState.calledNumbers
    });

    if (roomState.status === 'WAITING' && !roomState.timerInterval) {
        startLobbyTimer();
    }

    socket.on('selectCard', ({ cardNum, userId }) => {
        if (!roomState.soldCards.includes(cardNum)) {
            roomState.soldCards.push(cardNum);
            roomState.players[userId] = socket.id;

            io.emit('roomState', {
                soldCards: roomState.soldCards,
                timeLeft: roomState.timeLeft,
                playersCount: Object.keys(roomState.players).length,
                status: roomState.status,
                calledNumbers: roomState.calledNumbers
            });
        }
    });

    socket.on('deselectCard', ({ cardNum, userId }) => {
        roomState.soldCards = roomState.soldCards.filter(c => c !== cardNum);
        
        io.emit('roomState', {
            soldCards: roomState.soldCards,
            timeLeft: roomState.timeLeft,
            playersCount: Object.keys(roomState.players).length,
            status: roomState.status,
            calledNumbers: roomState.calledNumbers
        });
    });

    socket.on('getUserCards', ({ chosenCards, userId }, callback) => {
        let userCards = {};
        chosenCards.forEach(cardNo => {
            if (bingoCardsDatabase[cardNo]) {
                userCards[cardNo] = bingoCardsDatabase[cardNo];
            }
        });
        callback(userCards);
    });

    socket.on('claimBingo', ({ cardNo, userId, userName }) => {
        const cardArray = bingoCardsDatabase[cardNo];

        if (cardArray && checkBingoWinner(cardArray, roomState.calledNumbers)) {
            clearInterval(roomState.gameInterval);
            const totalPrize = roomState.soldCards.length * 20;

            io.emit('gameWinner', {
                userId,
                userName,
                cardNo,
                prize: totalPrize
            });

            setTimeout(() => {
                resetRoom();
            }, 5000);
        }
    });

    socket.on('disconnect', () => {
        // Disconnect handling logic
    });
});

function resetRoom() {
    clearInterval(roomState.gameInterval);
    clearInterval(roomState.timerInterval);

    roomState = {
        status: 'WAITING',
        soldCards: [],
        players: {},
        timeLeft: 30,
        calledNumbers: [],
        availableNumbers: Array.from({ length: 75 }, (_, i) => i + 1),
        timerInterval: null,
        gameInterval: null
    };

    io.emit('roomReset');
    startLobbyTimer();
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`CherBingo Backend running on port ${PORT}`);
});