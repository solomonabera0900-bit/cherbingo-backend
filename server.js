const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Serve static HTML file
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.send('Cherbingo Backend is running successfully!');
});

let soldCards = new Set();
let players = new Set();
let timeLeft = 30;
let gameInProgress = false;
let calledBalls = [];
let gameInterval = null;

// 1-400 ለሚሆኑ ካርቴላዎች ማትሪክስ ማዘጋጀት
const cardsDatabase = {};
for (let i = 1; i <= 400; i++) {
    cardsDatabase[i] = generateBingoCard();
}

function generateBingoCard() {
    let card = [];
    let ranges = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];
    let cols = [];
    for (let c = 0; c < 5; c++) {
        let col = [];
        while (col.length < 5) {
            let r = Math.floor(Math.random() * (ranges[c][1] - ranges[c][0] + 1)) + ranges[c][0];
            if (!col.includes(r)) col.push(r);
        }
        cols.push(col);
    }
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            if (r === 2 && c === 2) card.push('★');
            else card.push(cols[c][r]);
        }
    }
    return card;
}

// 30 ሰከንድ የሎቢ ቆጠራ
setInterval(() => {
    if (!gameInProgress) {
        timeLeft--;
        if (timeLeft <= 0) {
            if (soldCards.size > 0) {
                gameInProgress = true;
                io.emit('startCountdown');
                setTimeout(startLiveCaller, 4000);
            } else {
                timeLeft = 30;
            }
        }
        io.emit('roomState', {
            soldCards: Array.from(soldCards),
            timeLeft: timeLeft,
            playersCount: players.size
        });
    }
}, 1000);

function startLiveCaller() {
    calledBalls = [];
    let availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1);

    gameInterval = setInterval(() => {
        if (availableNumbers.length > 0 && gameInProgress) {
            let randomIndex = Math.floor(Math.random() * availableNumbers.length);
            let num = availableNumbers.splice(randomIndex, 1)[0];
            calledBalls.push(num);

            let letter = "B";
            if (num > 15 && num <= 30) letter = "I";
            else if (num > 30 && num <= 45) letter = "N";
            else if (num > 45 && num <= 60) letter = "G";
            else if (num > 60) letter = "O";

            io.emit('newBall', { num, letter, ballsCalled: calledBalls.length });
        } else {
            clearInterval(gameInterval);
        }
    }, 3000);
}

io.on('connection', (socket) => {
    players.add(socket.id);

    socket.on('selectCard', ({ cardNum }) => {
        soldCards.add(cardNum);
    });

    socket.on('deselectCard', ({ cardNum }) => {
        soldCards.delete(cardNum);
    });

    socket.on('getUserCards', ({ chosenCards }, callback) => {
        let res = {};
        chosenCards.forEach(c => { res[c] = cardsDatabase[c]; });
        callback(res);
    });

    socket.on('claimBingo', ({ cardNo, userName }) => {
        if (!gameInProgress) return;
        clearInterval(gameInterval);
        gameInProgress = false;

        let prize = soldCards.size * 20;
        let rawMatrix = cardsDatabase[cardNo];
        let cardMatrix = rawMatrix.map(v => {
            if (v === '★') return { v, status: 'star' };
            if (calledBalls.includes(v)) return { v, status: 'green' };
            return { v, status: 'normal' };
        });

        io.emit('gameWinner', {
            userName,
            cardNo,
            prize,
            cardMatrix
        });

        setTimeout(() => {
            soldCards.clear();
            timeLeft = 30;
        }, 6000);
    });

    socket.on('disconnect', () => {
        players.delete(socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));