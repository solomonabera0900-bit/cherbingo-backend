import os
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

# ቦት ቶከን
TOKEN = os.getenv("BOT_TOKEN", "YOUR_TELEGRAM_BOT_TOKEN_HERE")

# የ Vercel Frontend ሊንክህ እዚህ ይገባል
WEB_APP_URL = "https://chernetbingo-frontend.vercel.app" 

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [
            InlineKeyboardButton(
                "🎮 ጨዋታውን ጀምር (Play Bingo)", 
                web_app=WebAppInfo(url=WEB_APP_URL)
            )
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "እንኳን ወደ Chernet Bingo በደህና መጡ! 🎯\n\nታች ያለውን ቁልፍ በመጫን ጨዋታውን መጀመር ይችላሉ፦",
        reply_markup=reply_markup
    )

if __name__ == '__main__':
    app = ApplicationBuilder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    print("Bot is running...")
    app.run_polling()