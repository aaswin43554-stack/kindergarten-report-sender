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
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// =======================================================
// TWILIO CONFIGURATION
// =======================================================
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

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
// ROUTE: GET STUDENT REPORT STATUS (FROM SUPABASE)
// =======================================================
app.get("/student-status", async (req, res) => {
  try {
    // Fetch the first row from 'Student data storing final' table
    const { data, error } = await supabase
      .from("Student data storing final")
      .select("*")
      .limit(1)
      .single();

    if (error) throw error;

    if (!data) {
      return res.json({ message: "⚠️ No data found in Supabase." });
    }

    // Choose a useful field or fallback to the whole row
    const statusMessage =
      data.message || data.status || data.report || JSON.stringify(data);

    res.json({ message: statusMessage });
  } catch (error) {
    console.error("Supabase Error:", error);
    res
      .status(500)
      .json({ message: `❌ Error fetching status: ${error.message}` });
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
      sendLog("[DONE]");
      return res.end();
    }

    sendLog(`✅ Found ${rows.length} rows. Preparing to send messages...`);

    for (const row of rows) {
      const [
        studentName,
        appetite,
        sleeping,
        behaviour,
        mood,
        note,
        phone,
        messageFromSheet,
      ] = row;

      if (!phone) {
        sendLog(
          `⚠️ Skipping ${studentName || "Unnamed"} (missing phone number)`
        );
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

    // Collect unique phone numbers from column C
    const phones = [...new Set(rows.map((r) => r[2]).filter(Boolean))];

    sendLog(
      `✅ Found ${rows.length} menu rows and ${phones.length} unique phone numbers.`
    );

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
// AI TEACHER ANALYSIS TEXT REPORT (n8n webhook)
// =======================================================
app.post("/api/teacher-analysis-report", async (req, res) => {
  try {
    const webhook = process.env.N8N_TEACHER_REPORT_WEBHOOK_URL;
    if (!webhook) {
      return res
        .status(500)
        .json({ error: "N8N_TEACHER_REPORT_WEBHOOK_URL is not set" });
    }

    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const json = await response.json();
    return res.json(json);
  } catch (err) {
    console.error("Teacher report error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// =======================================================
// TEACHER VISUAL CHART DATA (n8n webhook)
// =======================================================
app.get("/api/teacher-visual", async (req, res) => {
  try {
    const webhook = process.env.N8N_TEACHER_VISUAL_URL;
    if (!webhook) {
      return res
        .status(500)
        .json({ error: "N8N_TEACHER_VISUAL_URL is not set" });
    }

    const response = await fetch(webhook);
    const json = await response.json();

    return res.json(json);
  } catch (err) {
    console.error("Teacher visual error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// =======================================================
// SERVE FRONTEND BUILD
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
  console.log("✨ /api/teacher-visual ready");
});
