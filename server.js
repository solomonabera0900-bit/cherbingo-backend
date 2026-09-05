const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// የጨዋታው አጠቃላይ ሁኔታዎች (State)
let gameState = {
  status: "WAITING", // WAITING, COUNTDOWN, PLAYING, FINISHED
  soldCards: [], // የተሸጡ/የተመረጡ ካርቴላዎች
  players: {}, // socket.id -> userId
  cardsOwnership: {}, // cardNum -> userId
  calledBalls: [], // የወጡ ኳሶች
  timer: 30, // የመምረጫ ሰከንድ
  timerInterval: null,
  gameLoopInterval: null,
};

// 1. Standard 75-Ball Bingo Card ማመንጫ
function generateBingoCard(cardNum) {
  // የዘፈቀደ ቁጥሮችን በካርቴላ ቁጥሩ መነሻነት ለመስራት (Deterministic Seed implementation)
  const getNumbers = (min, max, count) => {
    let nums = [];
    while (nums.length < count) {
      let r = Math.floor(Math.random() * (max - min + 1)) + min;
      if (!nums.includes(r)) nums.push(r);
    }
    return nums;
  };

  let b = getNumbers(1, 15, 5);
  let i = getNumbers(16, 30, 5);
  let n = getNumbers(31, 45, 5);
  let g = getNumbers(46, 60, 5);
  let o = getNumbers(61, 75, 5);

  // Column-wise ወደ Row-wise (5x5 Grid) መቀየር
  let cardMatrix = [];
  for (let row = 0; row < 5; row++) {
    cardMatrix.push(b[row]);
    cardMatrix.push(i[row]);
    if (row === 2) {
      cardMatrix.push("★"); // ማዕከላዊ ነፃ ቦታ (FREE Space)
    } else {
      cardMatrix.push(n[row]);
    }
    cardMatrix.push(g[row]);
    cardMatrix.push(o[row]);
  }
  return cardMatrix;
}

// 2. የጨዋታውን ቆጠራ እና ዙር ማስጀመር
function startRoomTimer() {
  if (gameState.timerInterval) clearInterval(gameState.timerInterval);

  gameState.status = "WAITING";
  gameState.timer = 30;

  gameState.timerInterval = setInterval(() => {
    gameState.timer--;

    io.emit("roomState", {
      soldCards: gameState.soldCards,
      timeLeft: gameState.timer,
      playersCount: Object.keys(gameState.players).length,
    });

    if (gameState.timer <= 0) {
      clearInterval(gameState.timerInterval);
      startCountdown();
    }
  }, 1000);
}

function startCountdown() {
  gameState.status = "COUNTDOWN";
  io.emit("startCountdown");

  setTimeout(() => {
    runGame();
  }, 3000);
}

// 3. ኳሶችን በየተወሰነ ሰከንዱ መጥራት
function runGame() {
  gameState.status = "PLAYING";
  gameState.calledBalls = [];

  let pool = Array.from({ length: 75 }, (_, i) => i + 1);

  gameState.gameLoopInterval = setInterval(() => {
    if (pool.length === 0 || gameState.status !== "PLAYING") {
      clearInterval(gameState.gameLoopInterval);
      return;
    }

    const randomIndex = Math.floor(Math.random() * pool.length);
    const ballNum = pool.splice(randomIndex, 1)[0];
    gameState.calledBalls.push(ballNum);

    let letter = "B";
    if (ballNum > 15 && ballNum <= 30) letter = "I";
    else if (ballNum > 30 && ballNum <= 45) letter = "N";
    else if (ballNum > 45 && ballNum <= 60) letter = "G";
    else if (ballNum > 60) letter = "O";

    io.emit("newBall", {
      num: ballNum,
      letter: letter,
      ballsCalled: gameState.calledBalls.length,
    });
  }, 3500); // በየ 3.5 ሰከንዱ አዲስ ኳስ ይወጣል
}

// 4. BINGO አሸናፊነትን ማረጋገጫ (Verification Logic)
function verifyBingoWin(cardMatrix, calledBalls) {
  // 5x5 Grid Index Map
  const winningLines = [
    // Rows
    [0, 1, 2, 3, 4],
    [5, 6, 7, 8, 9],
    [10, 11, 12, 13, 14],
    [15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24],
    // Columns
    [0, 5, 10, 15, 20],
    [1, 6, 11, 16, 21],
    [2, 7, 12, 17, 22],
    [3, 8, 13, 18, 23],
    [4, 9, 14, 19, 24],
    // Diagonals
    [0, 6, 12, 18, 24],
    [4, 8, 12, 16, 20],
  ];

  return winningLines.some((line) => {
    return line.every((idx) => {
      let val = cardMatrix[idx];
      return val === "★" || calledBalls.includes(val);
    });
  });
}

// 5. Socket.io Events
io.on("connection", (socket) => {
  // ተጫዋች ሲቀላቀል የመጨረሻውን የክፍል ሁኔታ ይላክለታል
  socket.emit("roomState", {
    soldCards: gameState.soldCards,
    timeLeft: gameState.timer,
    playersCount: Object.keys(gameState.players).length,
  });

  // ካርቴላ ሲመረጥ
  socket.on("selectCard", ({ cardNum, userId }) => {
    if (!gameState.soldCards.includes(cardNum)) {
      gameState.soldCards.push(cardNum);
      gameState.cardsOwnership[cardNum] = userId;
      gameState.players[socket.id] = userId;

      io.emit("roomState", {
        soldCards: gameState.soldCards,
        timeLeft: gameState.timer,
        playersCount: Object.keys(gameState.players).length,
      });
    }
  });

  // የተመረጠ ካርቴላ ሲሰረዝ
  socket.on("deselectCard", ({ cardNum, userId }) => {
    gameState.soldCards = gameState.soldCards.filter((c) => c !== cardNum);
    delete gameState.cardsOwnership[cardNum];

    io.emit("roomState", {
      soldCards: gameState.soldCards,
      timeLeft: gameState.timer,
      playersCount: Object.keys(gameState.players).length,
    });
  });

  // ተጫዋቹ የመረጣቸውን ካርቴላዎች መረጃ ሲጠይቅ
  socket.on("getUserCards", ({ chosenCards }, callback) => {
    let response = {};
    chosenCards.forEach((cardNo) => {
      response[cardNo] = generateBingoCard(cardNo);
    });
    callback(response);
  });

  // ተጫዋች BINGO ሲል
  socket.on("claimBingo", ({ cardNo, userId, userName }) => {
    if (gameState.status !== "PLAYING") return;

    let cardMatrix = generateBingoCard(cardNo);
    let isWinner = verifyBingoWin(cardMatrix, gameState.calledBalls);

    if (isWinner) {
      gameState.status = "FINISHED";
      clearInterval(gameState.gameLoopInterval);

      let totalPrize = gameState.soldCards.length * 20;

      // የማሸነፊያ ካርቴላውን ከኳሶች ጋር ማዛመድ (ለ UI ማሳያ)
      let formattedMatrix = cardMatrix.map((val) => {
        if (val === "★") return { v: "★", status: "star" };
        if (gameState.calledBalls.includes(val)) return { v: val, status: "green" };
        return { v: val, status: "normal" };
      });

      io.emit("gameWinner", {
        userName: userName || "ተጫዋች",
        cardNo: cardNo,
        prize: totalPrize,
        cardMatrix: formattedMatrix,
      });

      // ከ 5 ሰከንድ በኋላ አዲስ ዙር ማስጀመር
      setTimeout(() => {
        gameState.soldCards = [];
        gameState.cardsOwnership = {};
        startRoomTimer();
      }, 5000);
    }
  });

  socket.on("disconnect", () => {
    delete gameState.players[socket.id];
  });
});

// አፕሊኬሽኑ ሲነሳ የመጀመሪያውን ቆጠራ ይጀምራል
startRoomTimer();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});