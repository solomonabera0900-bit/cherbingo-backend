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

// የጨዋታው ሁኔታ (Game State)
let gameState = {
  status: 'WAITING', // 'WAITING', 'SELECTION', 'PLAYING'
  calledNumbers: [],
  players: {}, // socketId -> { id, username, cardId, cardGrid }
  spectators: new Set(),
  timer: null,
  selectionTimer: 30
};

// 5x5 Bingo Grid ማፍለቂያ function
function generateBingoCard() {
  const card = [];
  const ranges = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];
  for (let col = 0; col < 5; col++) {
    let [min, max] = ranges[col];
    let nums = [];
    while (nums.length < 5) {
      let r = Math.floor(Math.random() * (max - min + 1)) + min;
      if (!nums.includes(r)) nums.push(r);
    }
    card.push(nums);
  }
  // transpose to 5x5 row-major grid
  let grid = [];
  for (let r = 0; r < 5; r++) {
    let row = [];
    for (let c = 0; c < 5; c++) {
      if (r === 2 && c === 2) row.push('FREE'); // Center free space
      else row.push(card[c][r]);
    }
    grid.push(row);
  }
  return grid;
}

// የ BINGO አሸናፊነት ማረጋገጫ (Horizontal, Vertical, Diagonal ONLY)
function checkBingoWinner(cardGrid, calledNumbers) {
  const isMarked = (val) => val === 'FREE' || calledNumbers.includes(val);

  // 1. Check Horizontal Rows
  for (let r = 0; r < 5; r++) {
    if (cardGrid[r].every(isMarked)) return true;
  }

  // 2. Check Vertical Columns
  for (let c = 0; c < 5; c++) {
    let colWin = true;
    for (let r = 0; r < 5; r++) {
      if (!isMarked(cardGrid[r][c])) { colWin = false; break; }
    }
    if (colWin) return true;
  }

  // 3. Check Main Diagonal (Top-Left to Bottom-Right)
  let diag1 = true;
  for (let i = 0; i < 5; i++) {
    if (!isMarked(cardGrid[i][i])) { diag1 = false; break; }
  }
  if (diag1) return true;

  // 4. Check Anti-Diagonal (Top-Right to Bottom-Left)
  let diag2 = true;
  for (let i = 0; i < 5; i++) {
    if (!isMarked(cardGrid[i][4 - i])) { diag2 = false; break; }
  }
  if (diag2) return true;

  return false;
}

// የጨዋታ አጀማመር እና የቁጥሮች ጥሪ (በየ 5 ሰከንዱ)
function startGameLoop() {
  gameState.status = 'PLAYING';
  gameState.calledNumbers = [];
  io.emit('game_started', { status: gameState.status });

  let availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1);

  gameState.timer = setInterval(() => {
    if (availableNumbers.length === 0 || gameState.status !== 'PLAYING') {
      clearInterval(gameState.timer);
      return;
    }

    // Random ቁጥር መምረጥ
    const randomIndex = Math.floor(Math.random() * availableNumbers.length);
    const drawnNumber = availableNumbers.splice(randomIndex, 1)[0];
    gameState.calledNumbers.push(drawnNumber);

    // ቁጥሩን ለሁሉም ማስተላለፍ (በየ 5 ሰከንዱ)
    io.emit('number_drawn', {
      number: drawnNumber,
      history: gameState.calledNumbers
    });

  }, 5000); // 5 Seconds Interval
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // ጨዋታው ከተጀመረ ተመልካች (Spectator) ይሆናሉ
  if (gameState.status === 'PLAYING') {
    gameState.spectators.add(socket.id);
    socket.emit('spectator_mode', { message: 'ጨዋታው ተጀምሯል! ቀጣዩን ዙር ይበብቁ።' });
  }

  // ካርቴላ መምረጥ (ከ 1 እስከ 400)
  socket.on('select_card', (data) => {
    if (gameState.status === 'PLAYING') return;

    const cardGrid = generateBingoCard();
    gameState.players[socket.id] = {
      id: socket.id,
      cardId: data.cardId, // 1 - 400
      cardGrid: cardGrid
    };

    socket.emit('card_assigned', { cardId: data.cardId, cardGrid: cardGrid });
  });

  // Bingo Claims
  socket.on('claim_bingo', () => {
    const player = gameState.players[socket.id];
    if (!player || gameState.status !== 'PLAYING') return;

    const isWinner = checkBingoWinner(player.cardGrid, gameState.calledNumbers);

    if (isWinner) {
      clearInterval(gameState.timer);
      gameState.status = 'ENDED';
      io.emit('game_over', { winnerId: socket.id, cardId: player.cardId });
    } else {
      socket.emit('invalid_bingo', { message: 'እስካሁን ቢንጎ አልሞሉም!' });
    }
  });

  socket.on('disconnect', () => {
    delete gameState.players[socket.id];
    gameState.spectators.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));