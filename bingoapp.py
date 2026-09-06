import os
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters
)

# Logging (የስህተት መልእክቶችን ለመከታተል)
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# ቦት ቶከን (ከ Environment Variable ወይም በቀጥታ ከዚሁ ይወስዳል)
TOKEN = os.getenv("8677559720:AAF5alz9e2Ejoxb-HTKehicesJTyfRkrArE")

# የ Vercel Web App ሊንክ
WEB_APP_URL = "https://chernetbingo-frontend.vercel.app"

# 1. /start - WebApp ቁልፍን ጨምሮ መልእክት ይልካል
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_first_name = update.effective_user.first_name
    
    # WebApp መክፈቻ Inline Button
    keyboard = [
        [
            InlineKeyboardButton(
                "🎮 ጨዋታውን ጀምር (Play Bingo)", 
                web_app=WebAppInfo(url=WEB_APP_URL)
            )
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    text = (
        f"እንኳን ወደ Chernet Bingo በደህና መጡ {user_first_name}! 🎯\n\n"
        "ታች ያለውን ቁልፍ በመጫን ጨዋታውን መጀመር ይችላሉ፦\n"
        "ወይም ሌሎችን አማራጮች ለማየት /play, /balance, /instructions ይጠቀሙ።"
    )
    
    await update.message.reply_text(text, reply_markup=reply_markup)

# 2. /play - የክፍል መምረጫ አዝራሮች
async def play_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = "🕹 PLAY IN:\nChoose a room to join the game:"
    
    keyboard = [
        [InlineKeyboardButton("🎮 PLAY | 10 ብር", callback_data="room_10")],
        [InlineKeyboardButton("GoldenBingo | 50 ብር", callback_data="room_50")],
        [InlineKeyboardButton("⚽️ GoodBingo Bonus", callback_data="room_bonus")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(text, reply_markup=reply_markup)

# 3. /balance - ቀሪ ሂሳብ ማሳያ
async def balance_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_balance = "00.00"  # ከዳታቤዝ ጋር ማያያዝ ይቻላል
    message_text = f"💰 ቀሪ ሂሳብ (Available): {user_balance} ETB"
    await update.message.reply_text(message_text)

# 4. /deposit - የቴሌብር ክፍያ መመሪያ
async def deposit_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    deposit_text = (
        "የ TELE-Birr አካውንት\n\n"
        "( Merchant ID )\n"
        "      ወይም -  715516 (Betelihem)\n"
        "( የሽያጭ መለያ )\n\n"
        "መመሪያ\n\n"
        "1. በላይ ባለው የ TELE-Birr አካውንት ( ለግብይት ለመክፈል ) ወይም ( Pay for Merchant ) በሚለው አማራጭ ገንዘቡን ያስገቡ\n"
        "2. ብሩን ስትልኩ የከፈላችሁበትን መረጃ የያዘ አጭር የጽሁፍ መልእክት(sms) ከ TELE-Birr ይደርሳችኋል\n"
        "3. የደረሳችሁን አጭር የጽሁፍ መልእክት(sms) ሙሉውን ኮፒ(copy) በማድረግ ከታች ባለው የቴሌግራም የጽሁፍ ማበያወ ላይ ፔስት(paste) በማድረግ ይላኩት\n\n"
        "የሚያጋጥማችሁ የክፍያ ችግር ካለ\n"
        "@GoodBingoSupport በዚህ ስፖርት ማወራት ይችላሉ"
    )
    await update.message.reply_text(deposit_text)

# 5. /withdraw - ወጪ ማድረጊያ ጥያቄ
async def withdraw_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['awaiting_withdraw_amount'] = True
    await update.message.reply_text(
        "📩 *ገንዘብ ያውጡ (Withdraw Funds)*\n"
        "እባክዎ የሚያወጡትን የገንዘብ መጠን ያስገቡ (Enter amount to withdraw):",
        parse_mode="Markdown"
    )

# 6. /instructions - የጨዋታ ህጎች
async def instructions_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    instructions_text = (
        "ℹ️ **የጨዋታ ህጎች (Game Rules)**\n"
        "────────────────────\n"
        "ጨዋታውን ለማሸነፍ በተፈለገበት አንድ መስመር ወይም አራቱን ኮርነሮች ቀድሞ ማግኘት\n\n"
        "```\n"
        "  B  I  N  G  O\n"
        "+--+--+--+--+--+\n"
        "|✅|✅|✅|✅|✅| <- መስመር\n"
        "+--+--+--+--+--+\n"
        "|  |  |  |  |  |\n"
        "+--+--+--+--+--+\n"
        "|  |  |  |  |  |\n"
        "+--+--+--+--+--+\n"
        "  B  I  N  G  O\n"
        "+--+--+--+--+--+\n"
        "|✅|  |  |  |✅| <- 4 ኮርነሮች\n"
        "+--+--+--+--+--+\n"
        "|  |  |  |  |  |\n"
        "+--+--+--+--+--+\n"
        "|✅|  |  |  |✅|\n"
        "+--+--+--+--+--+\n"
        "```\n\n"
        "💰 ከአንድ በላይ አሸናፊ ካለ ደራሽ ገንዘቡን ይከፋፈላሉ"
    )
    await update.message.reply_text(instructions_text, parse_mode="Markdown")

# 7. /history & /register
async def history_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("📜 እስካሁን ምንም የግብይት ታሪክ የሎትም።")

async def register_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("✅ ምዝገባዎ ቀደም ሲል ተጠናቋል!")

# 8. የጽሁፍ መልእክቶችን ማስተናገጃ (Withdraw Validation)
async def handle_messages(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_text = update.message.text
    
    # ተጠቃሚው የወጪ መጠን እያስገባ ከሆነ
    if context.user_data.get('awaiting_withdraw_amount'):
        if user_text.isdigit():
            amount = int(user_text)
            if amount < 100:
                await update.message.reply_text("❌ ዝቅተኛው የማውጫ መጠን 100 ብር ነው። (Min withdraw 100 ETB).")
            else:
                current_balance = 00.0  # ከዳታቤዝ የሚወሰድ
                if amount > current_balance:
                    await update.message.reply_text("❌ በቂ ሂሳብ የሎትም (Insufficient balance).")
                    context.user_data['awaiting_withdraw_amount'] = False
                else:
                    await update.message.reply_text(f"✅ የ {amount} ETB ወጪ ጥያቄዎ ተቀብለናል።")
                    context.user_data['awaiting_withdraw_amount'] = False
        else:
            await update.message.reply_text("እባክዎን ቁጥር ብቻ ያስገቡ።")

def main():
    # ቦት አፕሊኬሽን መገንባት
    app = ApplicationBuilder().token(TOKEN).build()

    # ሁሉንም Command Handlers ማያያዝ
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("play", play_command))
    app.add_handler(CommandHandler("balance", balance_command))
    app.add_handler(CommandHandler("deposit", deposit_command))
    app.add_handler(CommandHandler("withdraw", withdraw_command))
    app.add_handler(CommandHandler("instructions", instructions_command))
    app.add_handler(CommandHandler("history", history_command))
    app.add_handler(CommandHandler("register", register_command))

    # የጽሁፍ መልእክቶችን መከታተያ (Message Handler)
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_messages))

    print("ቦቱ መስራት ጀምሯል...")
    app.run_polling()

if __name__ == '__main__':
    main()