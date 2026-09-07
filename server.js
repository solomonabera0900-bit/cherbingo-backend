const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');

// --- 1. EXPRESS & SOCKET.IO SETUP ---
const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// --- 2. TELEGRAM BOT SETUP ---
const BOT_TOKEN = process.env.BOT_TOKEN || "YOUR_BOT_TOKEN_HERE";
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || "YOUR_ADMIN_TELEGRAM_ID";
const WEB_APP_URL = "https://cherbingo-frontend-i6ci.vercel.app";

const bot = new Telegraf(BOT_TOKEN);
const userStates = {};

// የተጫዋቾች ቀሪ ሂሳብ (Temporary Database)
const userBalances = {}; // { userId: balance }

// --- የቴሌግራም መልእክት መላኪያ ረዳት ተግባር (Helper Function) ---
async function sendTelegramMsg(chatId, text) {
    if (!chatId) return;
    try {
        await bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (err) {
        console.error(`Error sending message to ${chatId}:`, err.message);
    }
}

bot.start((ctx) => {
    const firstName = ctx.from.first_name || "ተጫዋች";
    ctx.reply(
        `እንኳን ወደ Chernet Bingo በደህና መጡ ${firstName}! 🎯\n\n` +
        `ታች ያለውን ቁልፍ በመጫን ጨዋታውን መጀመር ይችላሉ፦`,
        Markup.inlineKeyboard([
            [Markup.button.webApp("🎮 ጨዋታውን ጀምር (Play Bingo)", WEB_APP_URL)]
        ])
    );
});

bot.command('play', (ctx) => {
    ctx.reply(
        "🕹 PLAY IN:\nChoose a room to join the game:",
        Markup.inlineKeyboard([
            [Markup.button.webApp("🎮 PLAY | 10 ብር", WEB_APP_URL)],
            [Markup.button.webApp("🔥 SuperBingo | 50 ብር", WEB_APP_URL)],
            [Markup.button.webApp("⚽️ GoodBingo Bonus", WEB_APP_URL)]
        ])
    );
});

bot.command('balance', (ctx) => {
    const userId = ctx.from.id;
    const balance = userBalances[userId] || 0.00;
    ctx.reply(`💰 ቀሪ ሂሳብዎ (Available): ${balance.toFixed(2)} ETB`);
});

bot.command('deposit', (ctx) => {
    ctx.reply(
        `የ TELE-Birr አካውንት\n\n` +
        `( Merchant ID ) - 715516 (Betelihem)\n\n` +
        `1. በላይ ባለው የ TELE-Birr አካውንት ክፍያ ይፈጽሙ\n` +
        `2. የደረሰዎትን SMS ሙሉውን ኮፒ በማድረግ እዚህ ፔስት ያድርጉ።`
    );
});

bot.command('withdraw', (ctx) => {
    userStates[ctx.from.id] = 'awaiting_withdraw';
    ctx.reply("📩 እባክዎ የሚያወጡትን የገንዘብ መጠን ያስገቡ፦");
});

bot.command('instructions', (ctx) => {
    ctx.reply("ℹ️ **የጨዋታ ህጎች**\nአንድ መስመር ወይም አራት ኮርነሮችን ቀድሞ የሞላ ያሸንፋል!");
});

bot.on('text', (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    if (userStates[userId] === 'awaiting_withdraw') {
        const amount = parseInt(text);
        if (isNaN(amount) || amount < 100) {
            return ctx.reply("❌ ዝቅተኛው የማውጫ መጠን 100 ብር ነው።");
        }
        delete userStates[userId];
        return ctx.reply(`✅ የ ${amount} ETB ወጪ ጥያቄዎ ተቀብለናል።`);
    }
});

bot.launch().catch((err) => console.error("Bot launch error:", err));

// --- 3. BINGO GAME LOGIC & DATABASE ---
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
                if (row === 2 && col === 2) {
                    card.push('★');
                } else {
                    card.push(columns[col][row]);
                }
            }
        }
        bingoCardsDatabase[cardNo] = card;
    }
}
generateBingoCards();

// የጨዋታው ሁኔታ (State)
let roomState = {
    status: 'WAITING',
    cardOwners: {}, // { cardNum(Number): socketId }
    players: {},    // socketId: { userId, userName, cards: [] }
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

function broadcastRoomState() {
    const soldCardsList = Object.keys(roomState.cardOwners).map(Number);
    io.emit('roomState', {
        soldCards: soldCardsList,
        timeLeft: roomState.timeLeft,
        playersCount: Object.keys(roomState.players).length,
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
    
    setTimeout(() => {
        startLiveGame();
    }, 3000);
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
            letter: getBallLetter(drawnNum),
            ballsCalled: roomState.calledNumbers.length
        });

    }, 4000);
}

function checkBingoWinner(cardArray, calledNumbers) {
    const calledSet = new Set(calledNumbers);
    calledSet.add('★');

    const isMarked = (index) => calledSet.has(cardArray[index]);

    for (let i = 0; i < 5; i++) {
        let rowStart = i * 5;
        if ([0, 1, 2, 3, 4].every(col => isMarked(rowStart + col))) return true;
    }

    for (let col = 0; col < 5; col++) {
        if ([0, 1, 2, 3, 4].every(row => isMarked(row * 5 + col))) return true;
    }

    if ([0, 6, 12, 18, 24].every(index => isMarked(index))) return true;
    if ([4, 8, 12, 16, 20].every(index => isMarked(index))) return true;

    return false;
}

// --- 4. SOCKET.IO EVENTS ---
io.on('connection', (socket) => {

    // መጀመሪያ ሲገናኝ ያለውን ሁኔታ መላክ
    socket.emit('roomState', {
        soldCards: Object.keys(roomState.cardOwners).map(Number),
        timeLeft: roomState.timeLeft,
        playersCount: Object.keys(roomState.players).length,
        status: roomState.status,
        calledNumbers: roomState.calledNumbers
    });

    if (roomState.status === 'WAITING' && !roomState.timerInterval) {
        startLobbyTimer();
    }

    // --- DEPOSIT HANDLER ---
    socket.on('requestDeposit', ({ userId, userName, amount, txn }) => {
        console.log(`[DEPOSIT] User: ${userName} (${userId}), Amount: ${amount}, Txn: ${txn}`);
        
        if (ADMIN_CHAT_ID && ADMIN_CHAT_ID !== "YOUR_ADMIN_TELEGRAM_ID") {
            const adminDepositMsg = 
                `📥 **አዲስ የገቢ (Deposit) ጥያቄ**\n\n` +
                `👤 ተጫዋች: ${userName} (ID: \`${userId}\`)\n` +
                `💰 መጠን: ${amount} ETB\n` +
                `🧾 Txn ID: \`${txn}\`\n\n` +
                `ሂሳቡን ለማፅደቅ ከተረጋገጠ በኋላ Balance ይጨምሩለት።`;

            sendTelegramMsg(ADMIN_CHAT_ID, adminDepositMsg);
        }

        if (!userBalances[userId]) userBalances[userId] = 0;
        socket.emit('balanceUpdate', { balance: userBalances[userId] });
    });
// በBackend በኩል የሚደረግ የአውቶሜሽን ምሳሌ
socket.on('requestDeposit', async (data) => {
  // 1. የክፍያ API ጥያቄ በመላክ ማረጋገጥ
  const isVerified = await verifyWithTelebirr(data.txn, data.amount);

  if (isVerified) {
    // 2. ሂሳቡን አውቶማቲክ ማዘመን
    updateUserBalance(data.userId, data.amount);
    socket.emit('balanceUpdate', { newBalance: updatedBalance });
  } else {
    socket.emit('errorMessage', 'የተሳሳተ የትራንዛክሽን ቁጥር ወይም ያልደረሰ ክፍያ!');
  }
});
    // --- WITHDRAW HANDLER ---
    socket.on('requestWithdraw', async ({ userId, userName, amount, account }) => {
        const withdrawAmt = parseFloat(amount);
        const currentBal = userBalances[userId] || 0;

        console.log(`[WITHDRAW] User: ${userName} (${userId}), Amount: ${withdrawAmt}, Acc: ${account}`);

        if (currentBal < withdrawAmt) {
            return socket.emit('withdrawError', { message: "በቂ ያልሆነ ቀሪ ሂሳብ!" });
        }

        // ቀሪ ሂሳብ መቀነስ
        userBalances[userId] -= withdrawAmt;
        socket.emit('balanceUpdate', { balance: userBalances[userId] });

        const timeString = new Date().toLocaleTimeString('am-ET');

        // ለተጫዋቹ የሚላክ ማሳወቂያ
        const playerMsg = 
            `💸 *የገንዘብ ማውጣት ጥያቄዎ ተመዝግቧል*\n\n` +
            `💵 *የተጠየቀው መጠን:* \`${withdrawAmt}\` ETB\n` +
            `🏦 *የተላከበት አካውንት:* \`${account}\`\n` +
            `⏰ *ሰዓት:* ${timeString}\n\n` +
            `የቤት አድሚኑ ጥያቄዎን ተቀብሎ በቅርቡ ክፍያውን ይፈጽማል።`;
        
        await sendTelegramMsg(userId, playerMsg);

        // ለአድሚኑ የሚላክ ማሳወቂያ
        if (ADMIN_CHAT_ID && ADMIN_CHAT_ID !== "YOUR_ADMIN_TELEGRAM_ID") {
            const adminMsg = 
                `⚠️ *አዲስ የገንዘብ ማውጣት ጥያቄ!*\n\n` +
                `👤 *ተጫዋች:* ${userName}\n` +
                `🆔 *Telegram ID:* \`${userId}\`\n` +
                `💵 *የተጠየቀው መጠን:* \`${withdrawAmt}\` ETB\n` +
                `🏦 *አካውንት/ስልክ:* \`${account}\`\n` +
                `⏰ *ሰዓት:* ${timeString}\n\n` +
                `እባክዎን ክፍያውን ፈጽመው በቦቱ ይደብቁ/ያጽድቁ።`;
            
            await sendTelegramMsg(ADMIN_CHAT_ID, adminMsg);
        }
    });

    // --- CARD SELECTION ---
    socket.on('selectCard', ({ cardNum, userId, userName }) => {
        const targetCard = Number(cardNum);

        if (roomState.status !== 'WAITING') {
            return socket.emit('cardSelectFailed', { cardNum: targetCard, message: "ጨዋታው ተጀምሯል!" });
        }

        if (roomState.cardOwners[targetCard] && roomState.cardOwners[targetCard] !== socket.id) {
            return socket.emit('cardSelectFailed', {
                cardNum: targetCard,
                message: "ይህ ካርቴላ በሌላ ተጫዋች ቀድሞ ተይዟል!"
            });
        }

        roomState.cardOwners[targetCard] = socket.id;

        if (!roomState.players[socket.id]) {
            roomState.players[socket.id] = { userId, userName, cards: [] };
        }

        if (!roomState.players[socket.id].cards.includes(targetCard)) {
            roomState.players[socket.id].cards.push(targetCard);
        }

        if (userId) {
            const userBal = userBalances[userId] || 0.00;
            socket.emit('balanceUpdate', { balance: userBal });
        }

        socket.emit('cardSelectSuccess', { cardNum: targetCard });
        broadcastRoomState();
    });

    // --- DESELECT CARD ---
    socket.on('deselectCard', ({ cardNum }) => {
        const targetCard = Number(cardNum);

        if (roomState.cardOwners[targetCard] === socket.id) {
            delete roomState.cardOwners[targetCard];

            if (roomState.players[socket.id]) {
                roomState.players[socket.id].cards = roomState.players[socket.id].cards.filter(c => c !== targetCard);
                if (roomState.players[socket.id].cards.length === 0) {
                    delete roomState.players[socket.id];
                }
            }
            broadcastRoomState();
        }
    });

    // --- GET USER CARDS ---
    socket.on('getUserCards', ({ chosenCards }, callback) => {
        let userCards = {};
        if (Array.isArray(chosenCards)) {
            chosenCards.forEach(cardNo => {
                const targetCard = Number(cardNo);
                if (bingoCardsDatabase[targetCard]) {
                    userCards[targetCard] = bingoCardsDatabase[targetCard];
                }
            });
        }
        if (typeof callback === 'function') {
            callback(userCards);
        }
    });

    // --- CLAIM BINGO ---
    socket.on('claimBingo', async ({ cardNo, userId, userName }) => {
        if (roomState.status !== 'PLAYING') return;

        const targetCard = Number(cardNo);
        const cardArray = bingoCardsDatabase[targetCard];

        if (cardArray && checkBingoWinner(cardArray, roomState.calledNumbers)) {
            roomState.status = 'FINISHED';
            clearInterval(roomState.gameInterval);
            
            const totalPrize = Object.keys(roomState.cardOwners).length * 20;

            if (userId) {
                userBalances[userId] = (userBalances[userId] || 0) + totalPrize;
                socket.emit('balanceUpdate', { balance: userBalances[userId] });
            }

            io.emit('gameWinner', {
                userId,
                userName: userName || "አሸናፊ",
                cardNo: targetCard,
                prize: totalPrize,
                cardMatrix: cardArray
            });

            // የቴሌግራም ማሳወቂያዎች
            const timeString = new Date().toLocaleTimeString('am-ET');

            const playerBingoMsg = 
                `🎉 *እንኳን ደስ አለዎት! BINGO አድርገዋል!* 🎉\n\n` +
                `💰 *የአሸናፊነት መጠን:* \`${totalPrize}\` ETB\n` +
                `🎫 *የካርድ ቁጥር:* \`${targetCard}\`\n` +
                `⏰ *ሰዓት:* ${timeString}\n\n` +
                `መልካም እድል! ሂሳብዎ ላይ ተጨምሯል።`;

            await sendTelegramMsg(userId, playerBingoMsg);

            if (ADMIN_CHAT_ID && ADMIN_CHAT_ID !== "YOUR_ADMIN_TELEGRAM_ID") {
                const adminBingoMsg = 
                    `🔔 *አዲስ የ BINGO አሸናፊ!*\n\n` +
                    `👤 *ተጫዋች:* ${userName || 'ያልታወቀ'}\n` +
                    `🆔 *Telegram ID:* \`${userId}\`\n` +
                    `💰 *ያሸነፈው መጠን:* \`${totalPrize}\` ETB\n` +
                    `🎫 *የካርድ ቁጥር:* \`${targetCard}\`\n` +
                    `⏰ *ሰዓት:* ${timeString}`;

                await sendTelegramMsg(ADMIN_CHAT_ID, adminBingoMsg);
            }

            setTimeout(() => {
                resetRoom();
            }, 6000);
        }
    });

    // --- DISCONNECT ---
    socket.on('disconnect', () => {
        if (roomState.players[socket.id]) {
            const userCards = roomState.players[socket.id].cards || [];
            
            if (roomState.status === 'WAITING') {
                userCards.forEach(cardNum => {
                    delete roomState.cardOwners[cardNum];
                });
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

// --- 5. SERVER LISTEN ---
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`CherBingo Backend running on port ${PORT}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));