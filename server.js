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
// SUPABASE CONFIGURATION (optional, only if envs exist)
// =======================================================
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
}

// =======================================================
// ROUTE: GET STUDENT REPORT STATUS
//   1. Try Supabase ("Student data storing final")
//   2. If not configured / error → try n8n webhook
// =======================================================
app.get("/student-status", async (req, res) => {
  // 1) Supabase path (if configured)
  if (supabase) {
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
      return res.json({ message: statusMessage });
    } catch (err) {
      console.error("Supabase /student-status error:", err.message);
      // fall through to webhook if configured
    }
  }

  // 2) n8n webhook fallback
  if (process.env.N8N_STUDENT_REPORT_WEBHOOK_URL) {
    try {
      const resp = await fetch(process.env.N8N_STUDENT_REPORT_WEBHOOK_URL);
      const text = await resp.text();

      try {
        return res.json(JSON.parse(text));
      } catch {
        return res.json({ message: text });
      }
    } catch (err) {
      console.error("Webhook /student-status error:", err.message);
      return res
        .status(500)
        .json({ message: "❌ Error fetching student status." });
    }
  }

  // 3) Nothing configured
  return res.json({
    message:
      "⚠️ No student status backend configured (no Supabase or N8N env vars).",
  });
});

// =======================================================
// ROUTE: SEND DAILY REPORTS (SSE)
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

      sendLog(
        `➡️ Sending message to ${phone} (${studentName || "Unknown"})...`
      );

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
// ROUTE: SEND WEEKLY MENU (SSE, one message to all parents)
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

    let menuTable = "*🍽 Weekly Food Menu 🍽*\n\n";
    menuTable += "📅 *Day* — *Menu*\n";
    menuTable += "──────────────────────\n";
    for (const row of rows) {
      const [day, food] = row;
      menuTable += `• ${day || "N/A"} — ${food || "N/A"}\n`;
    }
    menuTable += "\nHave a delicious week ahead! 😋\n- Kindergarten Team 🏫✨";

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
// ROUTE: AI TEACHER ANALYSIS TEXT REPORT (n8n webhook)
// =======================================================
app.post("/api/teacher-analysis-report", async (req, res) => {
  const webhook = process.env.N8N_TEACHER_REPORT_WEBHOOK_URL;

  if (!webhook) {
    console.warn("N8N_TEACHER_REPORT_WEBHOOK_URL is not set.");
    return res.json({
      output:
        "Demo teacher report.\n\nTeacher: Anita Kapoor\nVerdict: Suitable\nStrengths:\n- Example strength\nWeaknesses:\n- Example weakness",
    });
  }

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const text = await response.text();

    // Accept both JSON and plain text from n8n
    try {
      return res.json(JSON.parse(text));
    } catch {
      return res.json({ output: text });
    }
  } catch (err) {
    console.error("Teacher analysis webhook error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// =======================================================
// ROUTE: TEACHER VISUAL CHART DATA
// ✅ Essential fix: FLATTEN teachers from webhook so ALL teachers appear
// Always return same shape: { teachers: [...] }
// =======================================================
app.get("/api/teacher-visual", async (req, res) => {
  const webhook = process.env.N8N_TEACHER_VISUAL_URL;

  if (webhook) {
    try {
      const response = await fetch(webhook);
      const text = await response.text();

      let raw;
      try {
        raw = JSON.parse(text);
      } catch (err) {
        console.error("Teacher visual JSON parse error:", err.message);
        throw new Error("Invalid JSON from visual webhook");
      }

      let teachers = [];

      // CASE 1: [{ teachers:[...] }, { teachers:[...] }]  -> flatten all
      if (Array.isArray(raw)) {
        raw.forEach((item) => {
          if (Array.isArray(item?.teachers)) {
            teachers.push(...item.teachers);
          }
        });

        // CASE 2: raw is already array of teacher objects
        if (teachers.length === 0 && raw.length && raw[0]?.name) {
          teachers = raw;
        }
      }

      // CASE 3: { teachers:[...] }
      if (Array.isArray(raw?.teachers)) {
        teachers = raw.teachers;
      }

      if (!teachers.length) {
        console.warn("⚠️ No teachers found in visual webhook response");
        throw new Error("No teacher data");
      }

      console.log(`✅ Visual teachers count: ${teachers.length}`);

      // ✅ Always return consistent format
      return res.json({ teachers });
    } catch (err) {
      console.error("Teacher visual webhook error:", err.message);
      // fall through to sample data
    }
  } else {
    console.warn("N8N_TEACHER_VISUAL_URL not set, using sample data.");
  }

  // FALLBACK SAMPLE DATA (same format)
  return res.json({
    teachers: [
      {
        name: "Anita Kapoor",
        classroomManagement: 4,
        differentiateInstruction: 5,
        socialEmotional: 4,
        numeracy: 3,
        fineMotor: 4,
        creativeArts: 5,
        suitabilityScore: 72,
        experienceYears: 2,
      },
      {
        name: "Rahul Sinha",
        classroomManagement: 5,
        differentiateInstruction: 4,
        socialEmotional: 5,
        numeracy: 4,
        fineMotor: 3,
        creativeArts: 4,
        suitabilityScore: 92,
        experienceYears: 7,
      },
      {
        name: "Zara Menon",
        classroomManagement: 3,
        differentiateInstruction: 4,
        socialEmotional: 3,
        numeracy: 4,
        fineMotor: 4,
        creativeArts: 3,
        suitabilityScore: 76,
        experienceYears: 5,
      },
      {
        name: "Jacob Fernandes",
        classroomManagement: 2,
        differentiateInstruction: 3,
        socialEmotional: 2,
        numeracy: 3,
        fineMotor: 2,
        creativeArts: 3,
        suitabilityScore: 62,
        experienceYears: 1,
      },
      {
        name: "Meera Iyer",
        classroomManagement: 4,
        differentiateInstruction: 4,
        socialEmotional: 5,
        numeracy: 4,
        fineMotor: 5,
        creativeArts: 4,
        suitabilityScore: 88,
        experienceYears: 6,
      },
      {
        name: "Kunal Verma",
        classroomManagement: 3,
        differentiateInstruction: 3,
        socialEmotional: 4,
        numeracy: 3,
        fineMotor: 3,
        creativeArts: 4,
        suitabilityScore: 70,
        experienceYears: 3,
      },
    ],
  });
});

// =======================================================
// SERVE FRONTEND BUILD (EXPRESS 5 SAFE)
// =======================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, "client", "dist");
app.use(express.static(distPath));

// ✅ Express 5 safe SPA fallback using REGEX
// This avoids path-to-regexp wildcard crashes.
app.get(/^(?!\/api|\/send|\/send-menu|\/student-status).*/, (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// =======================================================
// START SERVER
// =======================================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log("✨ /api/teacher-visual and /student-status ready");
});
