const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

let roomState = {
    status: 'SELECTION', 
    soldCards: {},
    playersCount: 0,
    selectionTimeLeft: 30
};

let calledNumbers = [];
let availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
let gameInterval = null;
let selectionInterval = null;

function generateBingoCard(cardNo) {
    let card = [];
    const ranges = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];
    let cols = ranges.map(([min, max]) => {
        let nums = new Set();
        while (nums.size < 5) {
            nums.add(Math.floor(Math.random() * (max - min + 1)) + min);
        }
        return Array.from(nums);
    });

    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
            if (row === 2 && col === 2) {
                card.push('★');
            } else {
                card.push(cols[col][row]);
            }
        }
    }
    return card;
}

function startSelectionPhase() {
    roomState.status = 'SELECTION';
    roomState.soldCards = {};
    roomState.selectionTimeLeft = 30;
    calledNumbers = [];
    availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1);

    io.emit('roomReset');

    if (selectionInterval) clearInterval(selectionInterval);

    selectionInterval = setInterval(() => {
        roomState.selectionTimeLeft--;
        
        io.emit('roomState', {
            soldCards: Object.keys(roomState.soldCards).map(Number),
            timeLeft: roomState.selectionTimeLeft,
            playersCount: io.engine.clientsCount,
            status: roomState.status
        });

        if (roomState.selectionTimeLeft <= 0) {
            clearInterval(selectionInterval);
            startCountdown();
        }
    }, 1000);
}

function startCountdown() {
    io.emit('startCountdown');
    setTimeout(() => { startBingoGame(); }, 3000);
}

function startBingoGame() {
    roomState.status = 'PLAYING';
    io.emit('gameStarted');

    if (gameInterval) clearInterval(gameInterval);

    // 2. በየ 5 ሰከንዱ ቁጥር መጥራት
    gameInterval = setInterval(() => {
        if (availableNumbers.length === 0) {
            // 1. ማንም ባይገባም 75ቱ ሲያልቁ ዳግም ማስጀመር
            clearInterval(gameInterval);
            setTimeout(() => { startSelectionPhase(); }, 3000);
            return;
        }

        const randomIndex = Math.floor(Math.random() * availableNumbers.length);
        const calledNum = availableNumbers.splice(randomIndex, 1)[0];
        calledNumbers.push(calledNum);

        let letter = '';
        if (calledNum <= 15) letter = 'B';
        else if (calledNum <= 30) letter = 'I';
        else if (calledNum <= 45) letter = 'N';
        else if (calledNum <= 60) letter = 'G';
        else letter = 'O';

        io.emit('newBall', {
            num: calledNum,
            letter: letter,
            ballsCalled: calledNumbers.length
        });

    }, 5000);
}

io.on('connection', (socket) => {
    socket.emit('roomState', {
        soldCards: Object.keys(roomState.soldCards).map(Number),
        timeLeft: roomState.selectionTimeLeft,
        playersCount: io.engine.clientsCount,
        status: roomState.status
    });

    socket.on('selectCard', ({ cardNum, userId }) => {
        if (roomState.status === 'SELECTION' && !roomState.soldCards[cardNum]) {
            roomState.soldCards[cardNum] = userId;
            io.emit('cardSold', { cardNum, userId });
        }
    });

    socket.on('deselectCard', ({ cardNum, userId }) => {
        if (roomState.status === 'SELECTION' && roomState.soldCards[cardNum] === userId) {
            delete roomState.soldCards[cardNum];
            io.emit('cardFreed', { cardNum });
        }
    });

    socket.on('getUserCards', ({ chosenCards, userId }, callback) => {
        let cardsData = {};
        chosenCards.forEach(cardNo => {
            cardsData[cardNo] = generateBingoCard(cardNo);
        });
        callback(cardsData);
    });

    socket.on('claimBingo', ({ cardNo, userId, userName }) => {
        if (roomState.status === 'PLAYING') {
            clearInterval(gameInterval);
            const prize = Object.keys(roomState.soldCards).length * 20;
            
            io.emit('gameWinner', {
                userName: userName || 'ተጫዋች',
                cardNo: cardNo,
                prize: prize,
                cardMatrix: []
            });

            setTimeout(() => { startSelectionPhase(); }, 7000);
        }
    });

    socket.on('disconnect', () => {
        io.emit('playersUpdate', { count: io.engine.clientsCount });
    });
});

startSelectionPhase();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`CherBingo Server running on port ${PORT}`);
});