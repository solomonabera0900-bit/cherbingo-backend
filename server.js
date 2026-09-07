const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

// --- 1. SETUP EXPRESS & SOCKET.IO ---
const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- 2. DATABASE CONNECTION (MongoDB) ---
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://solomonabera0900_db_user:1yxOtyBZFM14Th74@cherbingo.gllgiai.mongodb.net/bingoGame?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Database Connected Successfully!"))
    .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// የተጫዋች ዳታ ሞዴል
const userSchema = new mongoose.Schema({
    telegramId: { type: String, required: true, unique: true },
    firstName: String,
    username: String,
    balance: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// --- 3. TELEGRAM BOT SETUP & ADMIN COMMANDS ---
const BOT_TOKEN = process.env.BOT_TOKEN || "YOUR_BOT_TOKEN_HERE";
const WEB_APP_URL = process.env.WEB_APP_URL || "https://cherbingo-frontend-i6ci.vercel.app";
const ADMIN_ID = process.env.ADMIN_ID || "1136433526"; 

const bot = new Telegraf(BOT_TOKEN);

// /start command
bot.start(async (ctx) => {
    const telegramId = String(ctx.from.id);
    const firstName = ctx.from.first_name || "ተጫዋች";
    const username = ctx.from.username || "";

    try {
        let user = await User.findOne({ telegramId });
        if (!user) {
            user = new User({ telegramId, firstName, username, balance: 0 });
            await user.save();
        }

        ctx.reply(
            `እንኳን ወደ Chernet Bingo በደህና መጡ ${firstName}! 🎯\n\n` +
            `💰 ቀሪ ሂሳብዎ: ${user.balance.toFixed(2)} ETB\n\n` +
            `ታች ያለውን ቁልፍ በመጫን ጨዋታውን መጀመር ይችላሉ፦`,
            Markup.inlineKeyboard([
                [Markup.button.webApp("🎮 ጨዋታውን ጀምር (Play Bingo)", WEB_APP_URL)]
            ])
        );
    } catch (err) {
        console.error("Start command error:", err);
    }
});

// /balance command
bot.command('balance', async (ctx) => {
    const telegramId = String(ctx.from.id);
    const user = await User.findOne({ telegramId });
    if (user) {
        ctx.reply(`💰 ቀሪ ሂሳብዎ (Available): ${user.balance.toFixed(2)} ETB`);
    } else {
        ctx.reply("❌ እባክዎን አስቀድመው /start በመጫን ይመዝገቡ።");
    }
});

// Admin Add Balance
bot.command('addbalance', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) {
        return ctx.reply("❌ ለዚህ ትእዛዝ ፈቃድ የሎትም።");
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 3) {
        return ctx.reply("⚠️ አጠቃቀም፦ /addbalance <TELEGRAM_ID> <መጠን>");
    }

    const targetId = args[1];
    const amount = parseFloat(args[2]);

    if (isNaN(amount) || amount <= 0) {
        return ctx.reply("❌ እባክዎ ትክክለኛ የገንዘብ መጠን ያስገቡ።");
    }

    try {
        const user = await User.findOneAndUpdate(
            { telegramId: targetId },
            { $inc: { balance: amount } },
            { new: true }
        );

        if (!user) return ctx.reply("❌ ይህ ተጫዋች በሲስተሙ ውስጥ አልተገኘም።");

        ctx.reply(`✅ ለተጫዋች ${user.firstName} (${targetId}) ${amount} ETB ገቢ ሆኗል! \nአዲሱ ቀሪ ሂሳብ: ${user.balance} ETB`);
        
        bot.telegram.sendMessage(targetId, `🎉 ${amount} ETB በስኬት ገቢ ሆኖልዎታል።\n💰 አሁን ያለዎት ቀሪ ሂሳብ: ${user.balance} ETB`);
    } catch (err) {
        ctx.reply("❌ ስህተት ተፈጥሯል: " + err.message);
    }
});

// Admin Deduct Balance
bot.command('deductbalance', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) {
        return ctx.reply("❌ ለዚህ ትእዛዝ ፈቃድ የሎትም።");
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 3) {
        return ctx.reply("⚠️ አጠቃቀም፦ /deductbalance <TELEGRAM_ID> <መጠን>");
    }

    const targetId = args[1];
    const amount = parseFloat(args[2]);

    try {
        const user = await User.findOne({ telegramId: targetId });
        if (!user) return ctx.reply("❌ ተጫዋቹ አልተገኘም።");

        if (user.balance < amount) {
            return ctx.reply(`❌ የተጫዋቹ ቀሪ ሂሳብ (${user.balance} ETB) ከሚቀነሰው ያነሳል።`);
        }

        user.balance -= amount;
        await user.save();

        ctx.reply(`✅ ከተጫዋች ${user.firstName} (${targetId}) ${amount} ETB ተቀንሷል። \nአዲሱ ቀሪ ሂሳብ: ${user.balance} ETB`);
        
        bot.telegram.sendMessage(targetId, `💸 ከሂሳብዎ ${amount} ETB ወጪ ተደርጓል።\n💰 ቀሪ ሂሳብ: ${user.balance} ETB`);
    } catch (err) {
        ctx.reply("❌ ስህተት ተፈጥሯል: " + err.message);
    }
});

bot.launch().catch((err) => console.error("Bot launch error:", err));

// --- 4. BINGO GAME LOGIC ---
const bingoCardsDatabase = {};
function generateBingoCards() {
    for (let cardNo = 1; cardNo <= 400; cardNo++) {
        let card = [];
        const ranges = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];
        let columns = ranges.map(([min, max]) => {
            let nums = new Set();
            while (nums.size < 5) {
                nums.add(Math.floor(Math.random() * (max - min + 1)) + min);
            }
            return Array.from(nums);
        });
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                if (row === 2 && col === 2) card.push('★');
                else card.push(columns[col][row]);
            }
        }
        bingoCardsDatabase[cardNo] = card;
    }
}
generateBingoCards();

let roomState = {
    status: 'WAITING',
    cardOwners: {},
    players: {},
    timeLeft: 30,
    calledNumbers: [],
    availableNumbers: Array.from({ length: 75 }, (_, i) => i + 1),
    timerInterval: null,
    gameInterval: null
};

function broadcastRoomState() {
    const soldCardsCount = Object.keys(roomState.cardOwners).length;
    const derashAmount = soldCardsCount * 10;

    io.emit('roomState', {
        soldCards: Object.keys(roomState.cardOwners).map(Number),
        timeLeft: roomState.timeLeft,
        playersCount: soldCardsCount,
        derash: derashAmount,
        status: roomState.status,
        calledNumbers: roomState.calledNumbers
    });
}

function startLobbyTimer() {
    if (roomState.timerInterval) return;
    roomState.timerInterval = setInterval(() => {
        roomState.timeLeft--;
        broadcastRoomState();
        if (roomState.timeLeft <= 0) {
            clearInterval(roomState.timerInterval);
            roomState.timerInterval = null;
            if (Object.keys(roomState.cardOwners).length > 0) {
                startCountdownPhase();
            } else {
                roomState.timeLeft = 30;
                startLobbyTimer();
            }
        }
    }, 1000);
}

function startCountdownPhase() {
    roomState.status = 'COUNTDOWN';
    io.emit('startCountdown');
    setTimeout(() => { startLiveGame(); }, 3000);
}

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
            letter: drawnNum <= 15 ? 'B' : drawnNum <= 30 ? 'I' : drawnNum <= 45 ? 'N' : drawnNum <= 60 ? 'G' : 'O',
            ballsCalled: roomState.calledNumbers.length
        });
    }, 4000);
}

// SOCKET EVENTS
io.on('connection', (socket) => {
    
    socket.on('getUserBalance', async ({ userId }) => {
        try {
            const user = await User.findOne({ telegramId: String(userId) });
            if (user) {
                socket.emit('userBalanceUpdate', { balance: user.balance });
            }
        } catch (e) {
            console.error("User balance error:", e);
        }
    });

    socket.on('getCardData', ({ cardNum }) => {
        const card = bingoCardsDatabase[cardNum];
        if (card) {
            socket.emit('cardDataResponse', { cardNum, card });
        }
    });

    broadcastRoomState();

    if (roomState.status === 'WAITING' && !roomState.timerInterval) {
        startLobbyTimer();
    }

    socket.on('selectCard', async ({ cardNum, userId, userName }) => {
        const targetCard = Number(cardNum);
        if (roomState.status !== 'WAITING') {
            return socket.emit('cardSelectFailed', { cardNum: targetCard, message: "ጨዋታው ተጀምሯል!" });
        }
        if (roomState.cardOwners[targetCard] && roomState.cardOwners[targetCard] !== socket.id) {
            return socket.emit('cardSelectFailed', { cardNum: targetCard, message: "ይህ ካርቴላ ተይዟል!" });
        }

        try {
            const user = await User.findOne({ telegramId: String(userId) });
            if (!user || user.balance < 10) {
                return socket.emit('cardSelectFailed', { cardNum: targetCard, message: "በቂ ሂሳብ የሎትም! እባክዎ ሂሳብዎን ይሙሉ።" });
            }

            user.balance -= 10;
            await user.save();

            roomState.cardOwners[targetCard] = socket.id;
            if (!roomState.players[socket.id]) {
                roomState.players[socket.id] = { userId, userName, cards: [] };
            }
            roomState.players[socket.id].cards.push(targetCard);

            socket.emit('cardSelectSuccess', { cardNum: targetCard, newBalance: user.balance });
            broadcastRoomState();
        } catch (e) {
            socket.emit('cardSelectFailed', { cardNum: targetCard, message: "የክፍያ ስህተት ተፈጥሯል" });
        }
    });

    socket.on('deselectCard', async ({ cardNum, userId }) => {
        const targetCard = Number(cardNum);
        if (roomState.cardOwners[targetCard] === socket.id) {
            delete roomState.cardOwners[targetCard];

            const updatedUser = await User.findOneAndUpdate(
                { telegramId: String(userId) },
                { $inc: { balance: 10 } },
                { new: true }
            );

            if (roomState.players[socket.id]) {
                roomState.players[socket.id].cards = roomState.players[socket.id].cards.filter(c => c !== targetCard);
                if (roomState.players[socket.id].cards.length === 0) delete roomState.players[socket.id];
            }

            socket.emit('userBalanceUpdate', { balance: updatedUser ? updatedUser.balance : 0 });
            broadcastRoomState();
        }
    });

    socket.on('disconnect', () => {
        if (roomState.players[socket.id]) {
            const userCards = roomState.players[socket.id].cards || [];
            if (roomState.status === 'WAITING') {
                userCards.forEach(cardNum => delete roomState.cardOwners[cardNum]);
                delete roomState.players[socket.id];
                broadcastRoomState();
            }
        }
    });
});

function resetRoom() {
    if (roomState.gameInterval) clearInterval(roomState.gameInterval);
    if (roomState.timerInterval) clearInterval(roomState.timerInterval);
    roomState = {
        status: 'WAITING',
        cardOwners: {},
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

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`CherBingo Backend running on port ${PORT}`));