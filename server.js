const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const BOT_TOKEN = process.env.BOT_TOKEN || "8677559720:AAF5alz9e2Ejoxb-HTKehicesJTyfRkrArE";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://cherbingo.vercel.app";

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// In-Memory Database
const usersDb = {};

function getUserData(userId) {
    if (!usersDb[userId]) {
        usersDb[userId] = {
            registered: true,
            balance: 50.00,
            history: [
                { type: "GAME BUY", time: "14:12", amt: 10.00, bal: 50.00, status: "SUCCESS" },
                { type: "DEPOSIT TELE BIRR", time: "14:11", amt: 20.00, bal: 60.00, status: "SUCCESS" }
            ]
        };
    }
    return usersDb[userId];
}

// ---------------- TELEGRAM BOT COMMANDS ----------------

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || "ተጫዋች";
    const text = `👋 **እንኳን ወደ Cherbingo በሰላም መጡ፣ ${firstName}!**\n\n` +
                 `🎮 ጨዋታ መጀመር ከፈለጉ /play የሚለውን ይጫኑ ወይም ከታች ያሉትን ትዕዛዞች ይጠቀሙ::`;
    bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
});

bot.onText(/\/register/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userData = getUserData(userId);

    if (userData.registered) {
        bot.sendMessage(chatId, "✅ ቀደም ብለው ተመዝግበዋል።");
    } else {
        userData.registered = true;
        bot.sendMessage(chatId, "✅ ምዝገባዎ በስኬት ተጠናቋል!");
    }
});

bot.onText(/\/play/, (msg) => {
    const chatId = msg.chat.id;
    const options = {
        parse_mode: "Markdown",
        reply_markup: {
            inline_keyboard: [
                [{ text: "🎮 PLAY  |  10 ብር", web_app: { url: FRONTEND_URL } }],
                [{ text: "🔥 SuperBingo  |  50 ብር", web_app: { url: FRONTEND_URL } }],
                [{ text: "⚽ Cherbingo Bonus", web_app: { url: FRONTEND_URL } }]
            ]
        }
    };
    bot.sendMessage(chatId, "📍 **PLAY IN:**\nለመጫወት የሚፈልጉትን ክፍል (Room) ይምረጡ:", options);
});

bot.onText(/\/balance/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const balance = getUserData(userId).balance;
    bot.sendMessage(chatId, `💰 **ቀሪ ሂሳብ (Available): ${balance.toFixed(2)} ETB**`, { parse_mode: "Markdown" });
});

bot.onText(/\/deposit/, (msg) => {
    const chatId = msg.chat.id;
    const options = {
        parse_mode: "Markdown",
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "CBE BIRR", callback_data: "dep_cbe" },
                    { text: "TELE BIRR", callback_data: "dep_tele" }
                ]
            ]
        }
    };
    bot.sendMessage(chatId, "💳 **የማስገቢያ መንገድ ይምረጡ (Select Deposit Method)**\n\nእባክዎ ሂሳብ ለመሙላት የሚጠቀሙበትን መንገድ ይምረጡ:", options);
});

bot.onText(/\/withdraw/, (msg) => {
    const chatId = msg.chat.id;
    const text = "📬 **ገንዘብ ያውጡ (Withdraw Funds)**\n\n" +
                 "እባክዎ የሚያወጡትን የገንዘብ መጠን እና የሂሳብ ቁጥርዎን ያስገቡ:\n" +
                 "*(ምሳሌ፡ 100 0912345678 Telebirr)*";
    bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
});

bot.onText(/\/history/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const history = getUserData(userId).history;

    let text = "📜 **የክፍያ ታሪክ**\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n";
    history.forEach((item) => {
        text += `🔹 **${item.type} (${item.time})**\n` +
                `💰 **መጠን:** ${item.amt.toFixed(2)} ETB\n` +
                `💳 **ቀሪ ሂሳብ:** ${item.bal.toFixed(2)} ETB\n` +
                `✅ **Status:** ${item.status}\n` +
                `⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n`;
    });
    bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
});

bot.onText(/\/instructions/, (msg) => {
    const chatId = msg.chat.id;
    const rulesCard = 
`\`\`\`
    B   I   N   G   O
+---+---+---+---+---+
| ✅| ✅| ✅| ✅| ✅| <- መስመር
+---+---+---+---+---+
|   |   |   |   |   |
+---+---+---+---+---+
|   |   |   |   |   |
+---+---+---+---+---+
    B   I   N   G   O
+---+---+---+---+---+
| ✅|   |   |   | ✅|
+---+---+---+---+---| <- 4 ኮርነሮች
|   |   |   |   |   |
+---+---+---+---+---+
| ✅|   |   |   | ✅|
+---+---+---+---+---+
\`\`\``;

    const text = "ℹ️ **የጨዋታ ህጎች (Game Rules)**\n" +
                 "⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n" +
                 "ጨዋታውን ለማሸነፍ ከተፈለገበት አንድ መስመር ወይም አራቱን ኮርነሮች ቀድሞ ማግኘት ያስፈልጋል።\n\n" +
                 `${rulesCard}\n\n` +
                 "💰 **ከአንድ በላይ አሸናፊ ካለ ደራሽ ገንዘቡ እኩል ይከፈላል።**";

    bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
});

// ---------------- BUTTON HANDLERS ----------------

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    bot.answerCallbackQuery(query.id);

    if (query.data === "dep_tele") {
        const teleText = "📍 **የ TELE-Birr አካውንት**\n\n" +
                         "Merchant ID / የሽያጭ መለያ: **11111 (Chernet Gobezie Nigat)**\n\n" +
                         "**መመሪያ:**\n" +
                         "1. ከላይ ባለው የ TELE-Birr አካውንት (Pay for Merchant) በሚለው ገንዘብ ያስገቡ።\n" +
                         "2. ብሩን ስትልኩ የከፈላችሁበትን መረጃ የያዘ አጭር የጽሁፍ መልእክት (SMS) ይደርሳችኋል።\n" +
                         "3. የደረሳችሁን SMS ሙሉውን Copy በማድረግ እዚህ Telegram ላይ Paste አድርገው ይላኩ።\n\n" +
                         "የሚያጋጥማችሁ የክፍያ ችግር ካለ፦\n" +
                         "@CherbingoSupport";
        bot.sendMessage(chatId, teleText, { parse_mode: "Markdown" });
    } else if (query.data === "dep_cbe") {
        const cbeText = "📍 **የ CBE-Birr አካውንት**\n\n" +
                        "CBE-BIRR Merchant: **00000 (Chernet Gobezie Nigat)**\n\n" +
                        "**መመሪያ:**\n" +
                        "1. ከላይ ባለው የ CBE-Birr አካውንት Pay for Merchant በሚለው ገንዘብ ያስገቡ።\n" +
                        "2. ብሩን ስትልኩ የከፈላችሁበትን መረጃ የያዘ አጭር የጽሁፍ መልእክት (SMS) ይደርሳችኋል።\n" +
                        "3. የደረሳችሁን SMS ሙሉውን Copy በማድረግ እዚህ Telegram ላይ Paste አድርገው ይላኩ።\n\n" +
                        "የሚያጋጥማችሁ የክፍያ ችግር ካለ፦\n" +
                        "@CherbingoSupport";
        bot.sendMessage(chatId, cbeText, { parse_mode: "Markdown" });
    }
});

// ---------------- SMS TEXT PASTE HANDLER ----------------

bot.on('message', (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;

    const chatId = msg.chat.id;
    const text = msg.text || "";

    if (text.toLowerCase().includes("telebirr") || text.toLowerCase().includes("cbe") || text.toLowerCase().includes("txn")) {
        bot.sendMessage(
            chatId,
            "⏳ **የክፍያ መልእክትዎ ደርሶናል!**\nመረጃው እየተመረመረ ነው፤ በጥቂት ደቂቃዎች ውስጥ ሂሳብዎ ላይ ይደመራል።",
            { parse_mode: "Markdown" }
        );
    }
});

// ---------------- API ENDPOINTS FOR FRONTEND ----------------

app.get('/api/user/:id', (req, res) => {
    const userId = req.params.id;
    res.json(getUserData(userId));
});

app.listen(PORT, () => {
    console.log(`🤖 Cherbingo Backend server running on port ${PORT}...`);
});