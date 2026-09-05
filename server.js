const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const sampleCards = [
  [1,16,31,46,61, 2,17,32,47,62, 3,18,0,48,63, 4,19,34,49,64, 5,20,35,50,65],
  [6,21,36,51,66, 7,22,37,52,67, 8,23,0,53,68, 9,24,39,54,69, 10,25,40,55,70],
  [11,26,41,56,71, 12,27,42,57,72, 13,28,0,58,73, 14,29,44,59,74, 15,30,45,60,75]
];

let players = {};
let drawnNumbers = [];
let gameState = 'WAITING';
let countdown = 30;
let gameInterval = null;
let timerInterval = null;

io.on('connection', (socket) => {
  console.log('ተጫዋች ተቀላቀለ:', socket.id);

  players[socket.id] = {
    id: socket.id,
    card: null,
    marked: [12]
  };

  socket.emit('availableCards', sampleCards);
  socket.emit('statusUpdate', { state: gameState, countdown });

  socket.on('selectCard', (cardIndex) => {
    if (gameState === 'WAITING' && sampleCards[cardIndex]) {
      players[socket.id].card = sampleCards[cardIndex];
      socket.emit('cardAssigned', sampleCards[cardIndex]);
    }
  });

  socket.on('claimBingo', (markedIndices) => {
    const player = players[socket.id];
    if (!player || !player.card || gameState !== 'PLAYING') return;

    const isValidNumbers = markedIndices.every(idx => {
      if (idx === 12) return true;
      return drawnNumbers.includes(player.card[idx]);
    });

    if (!isValidNumbers) {
      socket.emit('bingoResult', { success: false, message: 'ያልወጡ ቁጥሮችን መርጠሃል!' });
      return;
    }

    if (checkBingoRules(markedIndices)) {
      io.emit('gameOver', { winner: socket.id });
      resetGame();
    } else {
      socket.emit('bingoResult', { success: false, message: 'ትክክለኛ የBingo መስመር አልሰራህም!' });
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
  });
});

function checkBingoRules(marked) {
  const set = new Set(marked);

  for (let i = 0; i < 5; i++) {
    let row = [i*5, i*5+1, i*5+2, i*5+3, i*5+4];
    if (row.every(idx => set.has(idx))) return true;
  }

  for (let i = 0; i < 5; i++) {
    let col = [i, i+5, i+10, i+15, i+20];
    if (col.every(idx => set.has(idx))) return true;
  }

  let diag1 = [0, 6, 12, 18, 24];
  let diag2 = [4, 8, 12, 16, 20];
  if (diag1.every(idx => set.has(idx))) return true;
  if (diag2.every(idx => set.has(idx))) return true;

  let corners = [0, 4, 20, 24];
  if (corners.every(idx => set.has(idx))) return true;

  return false;
}

timerInterval = setInterval(() => {
  if (gameState === 'WAITING') {
    countdown--;
    io.emit('statusUpdate', { state: gameState, countdown });

    if (countdown <= 0) {
      startGame();
    }
  }
}, 1000);

function startGame() {
  gameState = 'PLAYING';
  io.emit('statusUpdate', { state: gameState, countdown: 0 });

  gameInterval = setInterval(() => {
    if (drawnNumbers.length >= 75) {
      resetGame();
      return;
    }
    let rand;
    do {
      rand = Math.floor(Math.random() * 75) + 1;
    } while (drawnNumbers.includes(rand));

    drawnNumbers.push(rand);
    io.emit('newNumber', rand);
  }, 5000);
}

function resetGame() {
  clearInterval(gameInterval);
  gameState = 'WAITING';
  countdown = 30;
  drawnNumbers = [];
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));