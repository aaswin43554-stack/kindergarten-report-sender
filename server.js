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
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// =======================================================
// GOOGLE SHEETS CONFIGURATION
// =======================================================
const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });

// =======================================================
// STUDENT STATUS (N8N)
// =======================================================
app.get("/student-status", async (req, res) => {
  try {
    const webhook = process.env.N8N_STUDENT_STATUS_URL || process.env.N8N_WEBHOOK_URL;

    if (!webhook) {
      return res.json({
        message: "⚠️ System info: N8N_STUDENT_STATUS_URL is missing in .env",
      });
    }

    console.log("📊 Fetching student status text from N8N...", webhook);
    const response = await fetch(webhook);

    if (!response.ok) {
      throw new Error(`N8N responded with ${response.status}`);
    }

    // Attempt to parse JSON
    // If n8n returns a string immediately (which can happen), handle that.
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // It's simple text
      return res.json({ message: text });
    }

    // If it's JSON, look for common fields
    const message =
      data.message ||
      data.output ||
      data.result ||
      (typeof data === "string" ? data : JSON.stringify(data));

    return res.json({ message });
  } catch (err) {
    console.error("❌ Student status error:", err);
    return res.json({ message: `❌ Error fetching status: ${err.message}` });
  }
});

// =======================================================
// SEND DAILY REPORTS
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

    const rows = result.data.values || [];

    if (rows.length === 0) {
      sendLog("⚠️ No data found in Google Sheet.");
      sendLog("[DONE]");
      return res.end();
    }

    sendLog(`✅ Found ${rows.length} rows. Preparing messages...`);

    for (const row of rows) {
      const [
        studentName,
        appetite,
        sleeping,
        behaviour,
        mood,
        note,
        phone,
        customMessage,
      ] = row;

      if (!phone) {
        sendLog(`⚠️ Missing phone number for ${studentName || "Unknown"}`);
        continue;
      }

      const message =
        customMessage ||
        `🌞 Good evening!\n\n👧 Student: ${studentName}\n🍽 Appetite: ${appetite}\n💤 Sleeping: ${sleeping}\n😊 Behaviour: ${behaviour}\n🎭 Mood: ${mood}\n📝 Note: ${note}\n\nYour child had a wonderful day at school! 💖`;

      sendLog(`➡️ Sending message to ${phone}...`);

      try {
        await client.messages.create({
          from: process.env.TWILIO_WHATSAPP_FROM,
          to: `whatsapp:${phone}`,
          body: message,
        });

        sendLog(`✅ Successfully sent to ${phone}`);
      } catch (err) {
        sendLog(`❌ Error sending to ${phone}: ${err.message}`);
      }
    }

    sendLog("🎉 All daily reports sent!");
    sendLog("[DONE]");
    res.end();
  } catch (err) {
    sendLog(`❌ Error: ${err.message}`);
    sendLog("[DONE]");
    res.end();
  }
});

// =======================================================
// SEND WEEKLY MENU
// =======================================================
app.get("/send-menu", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendLog = (msg) => res.write(`data: ${msg}\n\n`);

  try {
    sendLog("🍱 Fetching weekly menu...");

    const sheetId = process.env.SHEET_ID;
    const range = "WeeklyMenu!A2:C";

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
    });

    const rows = result.data.values || [];

    if (rows.length === 0) {
      sendLog("⚠️ No menu data found.");
      sendLog("[DONE]");
      return res.end();
    }

    let menu = "*🍽 Weekly Menu 🍽*\n\n📅 *Day — Menu*\n";

    rows.forEach(([day, food]) => {
      menu += `• ${day}: ${food}\n`;
    });

    const numbers = [...new Set(rows.map((r) => r[2]).filter(Boolean))];

    for (const phone of numbers) {
      sendLog(`➡️ Sending menu to ${phone}...`);
      try {
        await client.messages.create({
          from: process.env.TWILIO_WHATSAPP_FROM,
          to: `whatsapp:${phone}`,
          body: menu,
        });
        sendLog(`✅ Sent to ${phone}`);
      } catch (err) {
        sendLog(`❌ Failed: ${err.message}`);
      }
    }

    sendLog("🎉 Weekly menu sent to all parents!");
    sendLog("[DONE]");
    res.end();
  } catch (err) {
    sendLog(`❌ Error: ${err.message}`);
    sendLog("[DONE]");
    res.end();
  }
});

// =======================================================
// AI TEACHER TEXT REPORT (n8n)
// =======================================================
app.post("/api/teacher-analysis-report", async (req, res) => {
  try {
    const url = process.env.N8N_TEACHER_REPORT_WEBHOOK_URL;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const json = await response.json();
    res.json(json);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================================================
// TEACHER VISUAL (n8n)
// =======================================================
app.get("/api/teacher-visual", async (req, res) => {
  try {
    const url = process.env.N8N_TEACHER_VISUAL_URL;
    const response = await fetch(url);
    const json = await response.json();
    return res.json(json);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// =======================================================
// STUDENT VISUAL ANALYTICS (n8n)
// =======================================================
app.get("/api/student-visual", async (req, res) => {
  try {
    const webhook = process.env.N8N_STUDENT_VISUAL_URL;

    console.log("🎒 Fetching student visual data...");

    const response = await fetch(webhook);
    const raw = await response.json();

    console.log("🔹 Raw N8N response:", raw);

    let data = raw;

    // n8n sometimes returns JSON as string
    if (raw.output && typeof raw.output === "string") {
      data = JSON.parse(raw.output);
    }

    // validate students array
    if (!Array.isArray(data.students) || data.students.length === 0) {
      console.warn("⚠️ No student visual data found");
      return res.json({ students: [] });
    }

    // force numeric values (VERY IMPORTANT)
    const students = data.students.map((s) => ({
      ...s,
      avgAppetite: Number(s.avgAppetite) || 0,
      avgSleep: Number(s.avgSleep) || 0,
      avgBehaviour: Number(s.avgBehaviour) || 0,
      avgMood: Number(s.avgMood) || 0,
    }));

    return res.json({ students });

  } catch (err) {
    console.error("❌ Student visual error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// =======================================================
// STATIC FRONTEND (EXPRESS v5 FIX)
// =======================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, "client", "dist");
app.use(express.static(distPath));

// must be app.use(), not app.get()
app.use((req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// =======================================================
// START SERVER
// =======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
