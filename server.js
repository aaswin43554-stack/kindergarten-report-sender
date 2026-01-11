// =======================================================
// IMPORT DEPENDENCIES
// =======================================================
import express from "express";
import { google } from "googleapis";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

// SUPABASE
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// =======================================================
// GOOGLE SHEETS CONFIGURATION
// =======================================================
const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json", // service account key file
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});
const sheets = google.sheets({ version: "v4", auth });

// =======================================================
// SUPABASE CONFIGURATION
// =======================================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// =======================================================
// TELEGRAM WEBHOOK CONFIGURATION (n8n)
// =======================================================
const TELEGRAM_WEBHOOK_URL =
  process.env.TELEGRAM_WEBHOOK_URL ||
  "https://myaidesigntools.app.n8n.cloud/webhook/telegram_trigger";

/**
 * Sends a message via n8n webhook -> Telegram Bot
 * n8n should expect JSON:
 * { chat_id: "...", text: "..." }
 */
async function sendTelegramWebhook({ chatId, text }) {
  const resp = await fetch(TELEGRAM_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Webhook failed: ${resp.status} ${resp.statusText} ${errText}`);
  }

  // Optional: if you want to log webhook response
  // const data = await resp.json().catch(() => ({}));
  // return data;
}

// =======================================================
// ROUTE: GET STUDENT REPORT STATUS (FROM SUPABASE)
// =======================================================
app.get("/student-status", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("Student data storing final")
      .select("*")
      .limit(1)
      .single();

    if (error) throw error;

    if (!data) {
      return res.json({ message: "⚠️ No data found in Supabase." });
    }

    const statusMessage =
      data.message || data.status || data.report || JSON.stringify(data);

    res.json({ message: statusMessage });
  } catch (error) {
    console.error("Supabase Error:", error);
    res.status(500).json({ message: `❌ Error fetching status: ${error.message}` });
  }
});

// =======================================================
// ROUTE: SEND DAILY REPORTS (Telegram)
// =======================================================
app.get("/send", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendLog = (msg) => res.write(`data: ${msg}\n\n`);

  try {
    sendLog("📊 Fetching data from Google Sheet...");

    const sheetId = process.env.SHEET_ID;

    /**
     * EXPECTED SHEET COLUMNS (Daily Report!A2:H)
     * A: studentName
     * B: appetite
     * C: sleeping
     * D: behaviour
     * E: mood
     * F: note
     * G: telegramChatId   <-- IMPORTANT (replace old phone)
     * H: messageFromSheet (optional custom message)
     */
    const range = "Daily Report!A2:H";

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
    });

    const rows = result.data.values;
    if (!rows || rows.length === 0) {
      sendLog("⚠️ No data found in Google Sheet.");
      sendLog("[DONE]");
      return res.end();
    }

    sendLog(`✅ Found ${rows.length} rows. Preparing to send Telegram messages...`);

    for (const row of rows) {
      const [
        studentName,
        appetite,
        sleeping,
        behaviour,
        mood,
        note,
        telegramChatId,
        messageFromSheet,
      ] = row;

      if (!telegramChatId) {
        sendLog(`⚠️ Skipping ${studentName || "Unnamed"} (missing Telegram chat_id)`);
        continue;
      }

      const messageBody =
        messageFromSheet ||
        `
🌞 Good evening, dear parent!

Here’s today’s daily report for your little one 🧸💕

👧 Student: ${studentName || "Unknown"}
🍽 Appetite: ${appetite || "N/A"}
💤 Sleeping: ${sleeping || "N/A"}
😊 Behaviour: ${behaviour || "N/A"}
🎭 Mood: ${mood || "N/A"}
📝 Note: ${note || "No note provided."}

Your child had a wonderful day at school today! 💖
- The Kindergarten Team 🏫✨
        `.trim();

      sendLog(`➡️ Sending Telegram message to chat_id=${telegramChatId} (${studentName || "Unknown"})...`);

      try {
        await sendTelegramWebhook({
          chatId: telegramChatId,
          text: messageBody,
        });
        sendLog(`✅ Message sent successfully to chat_id=${telegramChatId}`);
      } catch (err) {
        sendLog(`❌ Failed to send to chat_id=${telegramChatId}: ${err.message}`);
      }
    }

    sendLog("🎉 All daily reports sent successfully!");
    sendLog("[DONE]");
    res.end();
  } catch (error) {
    sendLog(`❌ Error in /send: ${error.message}`);
    sendLog("[DONE]");
    res.end();
  }
});

// =======================================================
// ROUTE: SEND WEEKLY MENU (ONE MESSAGE TO ALL PARENTS) - Telegram
// =======================================================
app.get("/send-menu", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendLog = (msg) => res.write(`data: ${msg}\n\n`);

  try {
    sendLog("🍱 Fetching weekly food menu from Google Sheet...");

    const sheetId = process.env.SHEET_ID;

    /**
     * EXPECTED SHEET COLUMNS (WeeklyMenu!A2:C)
     * A: day
     * B: food
     * C: telegramChatId
     */
    const range = "WeeklyMenu!A2:C";

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
    });

    const rows = result.data.values;

    if (!rows || rows.length === 0) {
      sendLog("⚠️ No data found in WeeklyMenu sheet.");
      sendLog("[DONE]");
      return res.end();
    }

    // Prepare the table of day + food
    let menuTable = "*🍽 Weekly Food Menu 🍽*\n\n";
    menuTable += "📅 *Day* — *Menu*\n";
    menuTable += "──────────────────────\n";

    for (const row of rows) {
      const [day, food] = row;
      menuTable += `• ${day || "N/A"} — ${food || "N/A"}\n`;
    }

    menuTable += "\nHave a delicious week ahead! 😋\n- Kindergarten Team 🏫✨";

    // Collect unique Telegram chat IDs (column C)
    const chatIds = [...new Set(rows.map((r) => r[2]).filter(Boolean))];

    sendLog(`✅ Found ${rows.length} menu rows and ${chatIds.length} unique Telegram chat IDs.`);

    for (const chatId of chatIds) {
      sendLog(`➡️ Sending weekly menu to chat_id=${chatId}...`);

      try {
        await sendTelegramWebhook({
          chatId,
          text: menuTable,
        });
        sendLog(`✅ Menu message sent successfully to chat_id=${chatId}`);
      } catch (err) {
        sendLog(`❌ Failed to send to chat_id=${chatId}: ${err.message}`);
      }
    }

    sendLog("🎉 Weekly menu message sent to all parents successfully!");
    sendLog("[DONE]");
    res.end();
  } catch (error) {
    sendLog(`❌ Error in /send-menu: ${error.message}`);
    sendLog("[DONE]");
    res.end();
  }
});

// =======================================================
// SERVE FRONTEND (OPTIONAL BUILD SUPPORT)
// =======================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, "client", "dist");
app.use(express.static(distPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// =======================================================
// START SERVER
// =======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
