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
<<<<<<< HEAD
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
=======
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
>>>>>>> 90c4f33d55caf13cfdac6bcfdd68e69aacb99eda
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
<<<<<<< HEAD
// SEND DAILY REPORTS
=======
// ROUTE: SEND DAILY REPORTS (SSE)
>>>>>>> 90c4f33d55caf13cfdac6bcfdd68e69aacb99eda
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

<<<<<<< HEAD
      sendLog(`➡️ Sending message to ${phone}...`);
=======
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
>>>>>>> 90c4f33d55caf13cfdac6bcfdd68e69aacb99eda

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
<<<<<<< HEAD
// SEND WEEKLY MENU
=======
// ROUTE: SEND WEEKLY MENU (SSE, one message to all parents)
>>>>>>> 90c4f33d55caf13cfdac6bcfdd68e69aacb99eda
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

<<<<<<< HEAD
    let menu = "*🍽 Weekly Menu 🍽*\n\n📅 *Day — Menu*\n";

    rows.forEach(([day, food]) => {
      menu += `• ${day}: ${food}\n`;
    });
=======
    let menuTable = "*🍽 Weekly Food Menu 🍽*\n\n";
    menuTable += "📅 *Day* — *Menu*\n";
    menuTable += "──────────────────────\n";
    for (const row of rows) {
      const [day, food] = row;
      menuTable += `• ${day || "N/A"} — ${food || "N/A"}\n`;
    }
    menuTable += "\nHave a delicious week ahead! 😋\n- Kindergarten Team 🏫✨";

    const phones = [...new Set(rows.map((r) => r[2]).filter(Boolean))];
>>>>>>> 90c4f33d55caf13cfdac6bcfdd68e69aacb99eda

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
<<<<<<< HEAD
// AI TEACHER TEXT REPORT (n8n)
// =======================================================
app.post("/api/teacher-analysis-report", async (req, res) => {
  try {
    const url = process.env.N8N_TEACHER_REPORT_WEBHOOK_URL;

    const response = await fetch(url, {
=======
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
>>>>>>> 90c4f33d55caf13cfdac6bcfdd68e69aacb99eda
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

<<<<<<< HEAD
    const json = await response.json();
    res.json(json);
  } catch (err) {
    res.status(500).json({ error: err.message });
=======
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
>>>>>>> 90c4f33d55caf13cfdac6bcfdd68e69aacb99eda
  }
});

// =======================================================
<<<<<<< HEAD
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
=======
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
>>>>>>> 90c4f33d55caf13cfdac6bcfdd68e69aacb99eda
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
<<<<<<< HEAD
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
=======
// SERVE FRONTEND BUILD (EXPRESS 5 SAFE)
>>>>>>> 90c4f33d55caf13cfdac6bcfdd68e69aacb99eda
// =======================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, "client", "dist");
app.use(express.static(distPath));

<<<<<<< HEAD
// must be app.use(), not app.get()
app.use((req, res) => {
=======
// ✅ Express 5 safe SPA fallback using REGEX
// This avoids path-to-regexp wildcard crashes.
app.get(/^(?!\/api|\/send|\/send-menu|\/student-status).*/, (req, res) => {
>>>>>>> 90c4f33d55caf13cfdac6bcfdd68e69aacb99eda
  res.sendFile(path.join(distPath, "index.html"));
});

// =======================================================
// START SERVER
// =======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
<<<<<<< HEAD
  console.log(`🚀 Server running at http://localhost:${PORT}`);
=======
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log("✨ /api/teacher-visual and /student-status ready");
>>>>>>> 90c4f33d55caf13cfdac6bcfdd68e69aacb99eda
});
