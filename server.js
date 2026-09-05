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

// የጨዋታ ክፍሎች (Rooms) እና ሁኔታዎቻቸው
const rooms = {
    play: { name: "Regular Play", fee: 10, numbersDrawn: [], timer: null, isRunning: false, players: {} },
    super: { name: "SuperBingo", fee: 50, numbersDrawn: [], timer: null, isRunning: false, players: {} },
    bonus: { name: "GoodBingo Bonus", fee: 0, numbersDrawn: [], timer: null, isRunning: false, players: {} }
};

// ቢንጎ ማሸነፉን ማረጋገጫ (1 Line ወይም 4 Corners)
function checkBingoWin(card, drawnNumbers) {
    const drawnSet = new Set(drawnNumbers);
    
    // 1. 4 Corners Check (አራቱ ኮርነሮች)
    const corners = [card[0][0], card[0][4], card[4][0], card[4][4]];
    const hasFourCorners = corners.every(num => num === 'FREE' || drawnSet.has(num));
    if (hasFourCorners) return { win: true, type: "4 Corners (አራት ኮርነሮች)" };

    // 2. Horizontal Lines Check (የአግድም መስመሮች)
    for (let r = 0; r < 5; r++) {
        if (card[r].every(num => num === 'FREE' || drawnSet.has(num))) {
            return { win: true, type: `Horizontal Line ${r + 1}` };
        }
    }

    // 3. Vertical Lines Check (የቁመት መስመሮች)
    for (let c = 0; c < 5; c++) {
        let colWin = true;
        for (let r = 0; r < 5; r++) {
            if (card[r][c] !== 'FREE' && !drawnSet.has(card[r][c])) {
                colWin = false;
                break;
            }
        }
        if (colWin) return { win: true, type: `Vertical Line ${c + 1}` };
    }

    // 4. Diagonal Lines Check (የዲያጎናል/ሰያፍ መስመሮች)
    let diag1 = true, diag2 = true;
    for (let i = 0; i < 5; i++) {
        if (card[i][i] !== 'FREE' && !drawnSet.has(card[i][i])) diag1 = false;
        if (card[i][4 - i] !== 'FREE' && !drawnSet.has(card[i][4 - i])) diag2 = false;
    }
    if (diag1 || diag2) return { win: true, type: "Diagonal Line" };

    return { win: false };
}

// ቁጥር በየጊዜው መጣያ (Game Loop)
function startGameLoop(roomId) {
    const room = rooms[roomId];
    if (room.isRunning) return;
    
    room.isRunning = true;
    room.numbersDrawn = [];

    const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
    
    room.timer = setInterval(() => {
        if (availableNumbers.length === 0) {
            clearInterval(room.timer);
            room.isRunning = false;
            io.to(roomId).emit('game_over', { message: "ጨዋታው አለቀ! አሸናፊ አልተገኘም።" });
            return;
        }

        const randomIndex = Math.floor(Math.random() * availableNumbers.length);
        const drawnNumber = availableNumbers.splice(randomIndex, 1)[0];
        room.numbersDrawn.push(drawnNumber);

        io.to(roomId).emit('number_drawn', {
            number: drawnNumber,
            allDrawn: room.numbersDrawn
        });
    }, 3000); // በየ 3 ሰከንዱ ቁጥር ይጣላል
}

io.on('connection', (socket) => {
    console.log('ተጫዋች ተቀላቅሏል:', socket.id);

    // ወደ ክፍል መግባት
    socket.on('join_room', ({ roomId, userId, userName, card }) => {
        socket.join(roomId);
        if (!rooms[roomId]) return;

        rooms[roomId].players[socket.id] = { userId, userName, card };
        
        socket.emit('room_joined', {
            roomId,
            drawnNumbers: rooms[roomId].numbersDrawn,
            isRunning: rooms[roomId].isRunning
        });

        // ቢያንስ 1 ተጫዋች ሲገባ ጨዋታው ይጀምራል
        if (!rooms[roomId].isRunning) {
            startGameLoop(roomId);
        }
    });

    // BINGO ጥያቄ ሲላክ
    socket.on('claim_bingo', ({ roomId, card }) => {
        const room = rooms[roomId];
        if (!room) return;

        const result = checkBingoWin(card, room.numbersDrawn);

        if (result.win) {
            clearInterval(room.timer);
            room.isRunning = false;
            
            const winner = room.players[socket.id] || { userName: "ተጫዋች" };
            io.to(roomId).emit('bingo_winner', {
                winnerName: winner.userName,
                winType: result.type,
                message: `🎉 BINGO! ${winner.userName} በ ${result.type} አሸንፏል!`
            });
        } else {
            socket.emit('bingo_rejected', { message: "❌ ገና አልሞሉም! እባክዎ እንደገና ያረጋግጡ።" });
        }
    });

    socket.on('disconnect', () => {
        for (const roomId in rooms) {
            delete rooms[roomId].players[socket.id];
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`cherbingo-backend running on port ${PORT}`));