// =======================================================
// IMPORT DEPENDENCIES
// =======================================================
import express from "express";
import twilio from "twilio";
import { google } from "googleapis";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// =======================================================
// TWILIO CONFIGURATION
// =======================================================
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// =======================================================
// GOOGLE SHEETS CONFIGURATION
// =======================================================
import fs from "fs";

let auth;
if (fs.existsSync("credentials.json")) {
  console.log("✅ Found credentials.json, using file for Google Auth.");
  auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
} else {
  console.log("⚠️ credentials.json not found, attempting to use Environment Variables.");

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !key) {
    console.error("❌ MISSING GOOGLE AUTH ENV VARIABLES!");
    console.error("GOOGLE_SERVICE_ACCOUNT_EMAIL:", email ? "Set" : "Missing");
    console.error("GOOGLE_PRIVATE_KEY:", key ? "Set" : "Missing");
  } else {
    console.log("✅ Environment variables found. Configuring Google Auth...");
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Key length: ${key.length} chars`);
  }

  auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: key?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

const sheets = google.sheets({ version: "v4", auth });

// =======================================================
// SUPABASE CONFIGURATION
// =======================================================
import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// =======================================================
// ROUTE: GET STUDENT REPORT STATUS (FROM SUPABASE)
// =======================================================
app.get("/student-status", async (req, res) => {
  try {
    // Fetch the first row from 'Student data storing final' table
    // Assuming the table has a column named 'message' or similar
    // We select all columns and take the first row
    const { data, error } = await supabase
      .from("Student data storing final")
      .select("*")
      .limit(1)
      .single();

    if (error) throw error;

    if (!data) {
      return res.json({ message: "⚠️ No data found in Supabase." });
    }

    // Return the entire object or a specific field
    // Adjust 'message' to the actual column name if needed
    const statusMessage = data.message || data.status || data.report || JSON.stringify(data);
    res.json({ message: statusMessage });
  } catch (error) {
    console.error("Supabase Error:", error);
    res.status(500).json({ message: `❌ Error fetching status: ${error.message}` });
  }
});

// =======================================================
// ROUTE: SEND DAILY REPORTS
// =======================================================
app.get("/send", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendLog = (msg) => res.write(`data: ${msg}\n\n`);

  try {
    sendLog("📊 Fetching data from Google Sheet...");
    const sheetId = process.env.SHEET_ID;
    const range = "Daily Report!A2:H";
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
    });

    const rows = result.data.values;
    if (!rows || rows.length === 0) {
      sendLog("⚠️ No data found in Google Sheet.");
      return res.end();
    }

    sendLog(`✅ Found ${rows.length} rows. Preparing to send messages...`);

    for (const row of rows) {
      const [studentName, appetite, sleeping, behaviour, mood, note, phone, messageFromSheet] = row;

      if (!phone) {
        sendLog(`⚠️ Skipping ${studentName || "Unnamed"} (missing phone number)`);
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
        `;

      sendLog(`➡️ Sending message to ${phone} (${studentName || "Unknown"})...`);
      try {
        await client.messages.create({
          from: process.env.TWILIO_WHATSAPP_FROM,
          to: `whatsapp:${phone}`,
          body: messageBody,
        });
        sendLog(`✅ Message sent successfully to ${phone}`);
      } catch (err) {
        sendLog(`❌ Failed to send to ${phone}: ${err.message}`);
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
// ROUTE: SEND WEEKLY MENU (ONE MESSAGE TO ALL PARENTS)
// =======================================================
app.get("/send-menu", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendLog = (msg) => res.write(`data: ${msg}\n\n`);

  try {
    sendLog("🍱 Fetching weekly food menu from Google Sheet...");

    const sheetId = process.env.SHEET_ID;
    const range = "WeeklyMenu!A2:C";
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
    });

    const rows = result.data.values;

    if (!rows || rows.length === 0) {
      sendLog("⚠️ No data found in WeeklyMenu sheet.");
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

    // Collect unique phone numbers
    const phones = [...new Set(rows.map((r) => r[2]).filter(Boolean))];

    sendLog(`✅ Found ${rows.length} menu rows and ${phones.length} unique phone numbers.`);

    for (const phone of phones) {
      sendLog(`➡️ Sending weekly menu to ${phone}...`);
      try {
        await client.messages.create({
          from: process.env.TWILIO_WHATSAPP_FROM,
          to: `whatsapp:${phone}`,
          body: menuTable,
        });
        sendLog(`✅ Menu message sent successfully to ${phone}`);
      } catch (err) {
        sendLog(`❌ Failed to send to ${phone}: ${err.message}`);
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
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
