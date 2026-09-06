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

// --- 2. TELEGRAM BOT SETUP (የተስተካከለ) ---
const BOT_TOKEN = process.env.BOT_TOKEN || "YOUR_BOT_TOKEN_HERE";
const WEB_APP_URL = "https://cherbingo-frontend-i6ci.vercel.app"; // ትክክለኛው የ Vercel ሊንክህ

const bot = new Telegraf(BOT_TOKEN);
const userStates = {};

// Bot /start
bot.start((ctx) => {
    const firstName = ctx.from.first_name || "ተጫዋች";
    ctx.reply(
        `እንኳን ወደ Chernet Bingo በደህና መጡ ${firstName}! 🎯\n\n` +
        `ታች ያለውን ቁልፍ በመጫን ጨዋታውን መጀመር ይችላሉ፦\n` +
        `ወይም ሌሎችን አማራጮች ለማየት /play, /balance, /instructions ይጠቀሙ።`,
        Markup.inlineKeyboard([
            [Markup.button.webApp("🎮 ጨዋታውን ጀምር (Play Bingo)", WEB_APP_URL)]
        ])
    );
});

// Bot /play - እያንዳንዱ የክፍል ቁልፍ ሲጫን WebApp ይከፍታል
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

// Bot /balance
bot.command('balance', (ctx) => {
    const userBalance = "50.00";
    ctx.reply(`💰 ቀሪ ሂሳብ (Available): ${userBalance} ETB`);
});

// Bot /deposit
bot.command('deposit', (ctx) => {
    const depositText = 
        `የ TELE-Birr አካውንት\n\n` +
        `( Merchant ID )\n` +
        `      ወይም -  715516 (Betelihem)\n` +
        `( የሽያጭ መለያ )\n\n` +
        `መመሪያ\n\n` +
        `1. በላይ ባለው የ TELE-Birr አካውንት ( ለግብይት ለመክፈል ) ወይም ( Pay for Merchant ) በሚለው አማራጭ ገንዘቡን ያስገቡ\n` +
        `2. ብሩን ስትልኩ የከፈላችሁበትን መረጃ የያዘ አጭር የጽሁፍ መልእክት(sms) ከ TELE-Birr ይደርሳችኋል\n` +
        `3. የደረሳችሁን አጭር የጽሁፍ መልእክት(sms) ሙሉውን ኮፒ(copy) በማድረግ ከታች ባለው የቴሌግራም የጽሁፍ ማበያወ ላይ ፔስት(paste) በማድረግ ይላኩት\n\n` +
        `የሚያጋጥማችሁ የክፍያ ችግር ካለ\n` +
        `@GoodBingoSupport በዚህ ስፖርት ማወራት ይችላሉ`;
    ctx.reply(depositText);
});

// Bot /withdraw
bot.command('withdraw', (ctx) => {
    userStates[ctx.from.id] = 'awaiting_withdraw';
    ctx.reply(
        "📩 *ገንዘብ ያውጡ (Withdraw Funds)*\n" +
        "እባክዎ የሚያወጡትን የገንዘብ መጠን ያስገቡ (Enter amount to withdraw):",
        { parse_mode: 'Markdown' }
    );
});

// Bot /instructions
bot.command('instructions', (ctx) => {
    const instructionsText = 
        `ℹ️ **የጨዋታ ህጎች (Game Rules)**\n` +
        `────────────────────\n` +
        `ጨዋታውን ለማሸነፍ በተፈለገበት አንድ መስመር ወይም አራቱን ኮርነሮች ቀድሞ ማግኘት\n\n` +
        `\`\`\`\n` +
        `  B  I  N  G  O\n` +
        `+--+--+--+--+--+\n` +
        `|✅|✅|✅|✅|✅| <- መስመር\n` +
        `+--+--+--+--+--+\n` +
        `|  |  |  |  |  |\n` +
        `+--+--+--+--+--+\n` +
        `|  |  |  |  |  |\n` +
        `+--+--+--+--+--+\n` +
        `  B  I  N  G  O\n` +
        `+--+--+--+--+--+\n` +
        `|✅|  |  |  |✅| <- 4 ኮርነሮች\n` +
        `+--+--+--+--+--+\n` +
        `|  |  |  |  |  |\n` +
        `+--+--+--+--+--+\n` +
        `|✅|  |  |  |✅|\n` +
        `+--+--+--+--+--+\n` +
        `\`\`\`\n\n` +
        `💰 ከአንድ በላይ አሸናፊ ካለ ደራሽ ገንዘቡን ይከፋፈላሉ`;
    ctx.replyWithMarkdown(instructionsText);
});

// Bot /history & /register
bot.command('history', (ctx) => ctx.reply("📜 እስካሁን ምንም የግብይት ታሪክ የሎትም።"));
bot.command('register', (ctx) => ctx.reply("✅ ምዝገባዎ ቀደም ሲል ተጠናቋል!"));

// Bot Message listener
bot.on('text', (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    if (userStates[userId] === 'awaiting_withdraw') {
        const amount = parseInt(text);
        if (isNaN(amount)) {
            return ctx.reply("እባክዎን ቁጥር ብቻ ያስገቡ።");
        }
        if (amount < 100) {
            return ctx.reply("❌ ዝቅተኛው የማውጫ መጠን 100 ብር ነው። (Min withdraw 100 ETB).");
        }
        const currentBalance = 50.0;
        if (amount > currentBalance) {
            delete userStates[userId];
            return ctx.reply("❌ በቂ ሂሳብ የሎትም (Insufficient balance).");
        }
        delete userStates[userId];
        return ctx.reply(`✅ የ ${amount} ETB ወጪ ጥያቄዎ ተቀብለናል።`);
    }
});

// ቦቱን ማስነሳት
bot.launch().then(() => {
    console.log("Telegram Bot started successfully!");
}).catch((err) => {
    console.error("Bot launch error:", err);
});


// --- 3. BINGO GAME LOGIC & SOCKET.IO ---
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

let roomState = {
    status: 'WAITING',
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

    }, 5000);
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

io.on('connection', (socket) => {

    // አዲስ ለገባ ተጫዋች አሁን ያለውን የክፍል ሁኔታና የተያዙ ካርቴላዎች ማሳወቅ
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

    // 1. ካርቴላ ሲመረጥ (Select Card)
    socket.on('selectCard', ({ cardNum, userId }) => {
        if (!roomState.soldCards.includes(cardNum)) {
            roomState.soldCards.push(cardNum);
            
            // የትኛውን ካርቴላ የትኛው ተጫዋች እንደያዘው መመዝገብ
            roomState.players[socket.id] = { userId, cardNum };

            // ለሁሉም ተጫዋቾች የተያዙትን ካርቴላዎች አዘምን (ይህ ካርቴላ ከሌሎች ላይ ይጠፋል)
            io.emit('roomState', {
                soldCards: roomState.soldCards,
                timeLeft: roomState.timeLeft,
                playersCount: Object.keys(roomState.players).length,
                status: roomState.status,
                calledNumbers: roomState.calledNumbers
            });
        }
    });

    // 2. ካርቴላ ሲተው/ሲሰረዝ (Deselect Card - ለሌሎች Active እንዲሆን)
    socket.on('deselectCard', ({ cardNum, userId }) => {
        // ካርቴላውን ከተያዙት (soldCards) ዝርዝር ውስጥ ማውጣት
        roomState.soldCards = roomState.soldCards.filter(c => c !== cardNum);
        
        // የተጫዋቹን መረጃ ማጽዳት
        delete roomState.players[socket.id];
        
        // ለሁሉም ተጫዋቾች አበስር (ካርቴላው ለሌሎች ድጋሚ ክፍት/Active ይሆናል)
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

    // 3. ተጫዋቹ ጨዋታው ሳይጀምር ከወጣ (Disconnect/Closed WebApp) ካርቴላውን ነፃ ማድረግ
    socket.on('disconnect', () => {
        if (roomState.players[socket.id]) {
            const userCard = roomState.players[socket.id].cardNum;
            
            // ጨዋታው በይጠባበቅ ላይ (WAITING) ከሆነ ብቻ ካርቴላውን ነፃ አድርገው
            if (roomState.status === 'WAITING' && userCard) {
                roomState.soldCards = roomState.soldCards.filter(c => c !== userCard);
                delete roomState.players[socket.id];

                // ለሌሎች ተጫዋቾች የተለቀቀውን ካርቴላ ማሳወቅ
                io.emit('roomState', {
                    soldCards: roomState.soldCards,
                    timeLeft: roomState.timeLeft,
                    playersCount: Object.keys(roomState.players).length,
                    status: roomState.status,
                    calledNumbers: roomState.calledNumbers
                });
            }
        }
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

// --- 4. SERVER LISTEN ---
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`CherBingo Backend & Bot running on port ${PORT}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));