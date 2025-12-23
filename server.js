// server.js
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

// ✅ If you're on Node < 18, install: npm i node-fetch
// and uncomment the next line:
// import fetch from "node-fetch";

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
// SUPABASE CONFIGURATION (optional)
// =======================================================
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
}

// =======================================================
// HELPERS
// =======================================================
const normalizeRisk = (s) => {
  if (!s) return "UNKNOWN";
  const up = String(s).toUpperCase();
  if (up.includes("HIGH")) return "HIGH";
  if (up.includes("MED")) return "MEDIUM";
  if (up.includes("LOW")) return "LOW";
  return "UNKNOWN";
};

const riskOrder = { HIGH: 0, MEDIUM: 1, LOW: 2, UNKNOWN: 9 };

const splitBullets = (s) =>
  String(s || "")
    .replace(/\r\n/g, "\n")
    .split(/\n|•|\u2022|-\s+|\*\s+/g)
    .map((x) => x.trim())
    .filter((x) => x && x.length > 2)
    .slice(0, 10);

const buildResponse = (students) => {
  const riskCounts = { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
  const riskScores = (students || []).map((s) => ({
    name: s.name,
    score: s.risk_score || 0,
    risk: s.risk_level,
  }));

  for (const s of students || []) {
    const key = s.risk_level || "UNKNOWN";
    riskCounts[key] = (riskCounts[key] || 0) + 1;
  }

  const message = [
    "📌 Student Risk Report (Ordered)",
    "",
    ...(students || []).map((s, i) => {
      const reasons =
        s.reasons?.length ? `Reasons: ${s.reasons.join(", ")}` : "Reasons: N/A";
      const recs =
        s.recommendations?.length
          ? `Recommendations: ${s.recommendations.join(", ")}`
          : "Recommendations: N/A";
      return `${i + 1}. ${s.name} — ${s.risk_level} (Score: ${s.risk_score})\n   ${reasons}\n   ${recs}`;
    }),
  ].join("\n");

  return {
    summary: "Student risk assessment generated.",
    message,
    students,
    charts: { riskCounts, riskScores },
  };
};

// ✅ Robust fetch helper (gives you the REAL reason when n8n fails)
const fetchText = async (url) => {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
    },
    redirect: "follow",
  });

  const contentType = res.headers.get("content-type") || "";
  const text = await res.text().catch(() => "");
  const preview = text.slice(0, 500);

  console.log("---- N8N DEBUG ----");
  console.log("URL:", url);
  console.log("Status:", res.status);
  console.log("Content-Type:", contentType);
  console.log("Body length:", text.length);
  console.log("Preview:", preview);
  console.log("-------------------");

  return { res, contentType, text, preview };
};

// ✅ One parser for student status (works with many formats)
const parseStudentsFromAnything = (raw) => {
  // If already JSON { students: [...] }
  if (raw?.students && Array.isArray(raw.students)) {
    const students = raw.students.map((s, idx) => ({
      id: s.id ?? String(idx),
      name: s.name || s.studentName || s.student_name || `Student ${idx + 1}`,
      risk_level: normalizeRisk(s.risk_level || s.riskLevel || s.risk || s.level),
      risk_score: Number(s.risk_score ?? s.score ?? 0) || 0,
      reasons: Array.isArray(s.reasons) ? s.reasons : [],
      recommendations: Array.isArray(s.recommendations) ? s.recommendations : [],
    }));
    return students.filter((s) => s.risk_level !== "UNKNOWN");
  }

  // Otherwise treat it as text
  const analysisText =
    (typeof raw === "string" && raw) ||
    raw?.message ||
    raw?.output ||
    raw?.result ||
    raw?.data ||
    JSON.stringify(raw);

  const text = String(analysisText || "")
    .replace(/\r\n/g, "\n")
    .trim();

  // split blocks
  let blocks = [];
  if (/\n\s*\d+[.)]\s+/.test(text)) {
    blocks = text.split(/\n(?=\s*\d+[.)]\s+)/g);
  } else if (/Student\s*:/i.test(text)) {
    blocks = text.split(/(?=Student\s*:)/gi);
  } else if (/Name\s*:/i.test(text)) {
    blocks = text.split(/(?=Name\s*:)/gi);
  } else if (/\n\s*\n/.test(text)) {
    blocks = text.split(/\n\s*\n+/g);
  } else {
    blocks = [text];
  }

  blocks = blocks.map((b) => b.trim()).filter(Boolean);

  const getSection = (blockText, labels) => {
    const labelGroup = labels.join("|");
    const stopGroup =
      "(Reasons?|Concerns?|Challenges?|Specific Concerns?|Recommendations?|Guidance|Next Steps?|Notes?|General Notes|Observations?)";
    const re = new RegExp(
      `(?:^|\\n)\\s*(?:${labelGroup})\\s*[:\\-—]\\s*([\\s\\S]*?)(?=(?:\\n\\s*${stopGroup}\\s*[:\\-—])|$)`,
      "i"
    );
    const m = String(blockText || "").match(re);
    return (m?.[1] || "").trim();
  };

  const students = blocks
    .map((b, idx) => {
      // header patterns
      const headerMatch =
        b.match(/^\s*\d+[.)]\s*([^\n—-]+?)\s*(?:—|-)\s*(HIGH|MEDIUM|LOW)(?:\s*RISK)?/i) ||
        b.match(/^\s*([^\n—-]+?)\s*(?:—|-)\s*(HIGH|MEDIUM|LOW)(?:\s*RISK)?/i) ||
        b.match(/Name\s*:\s*([^\n]+)[\s\S]*?(?:Risk|Risk Level)\s*:\s*(HIGH|MEDIUM|LOW)/i) ||
        b.match(/Student\s*:\s*([^\n]+)[\s\S]*?(?:Risk|Risk Level)\s*:\s*(HIGH|MEDIUM|LOW)/i);

      if (!headerMatch) return null;

      const name = String(headerMatch[1] || "").trim();
      const risk_level = normalizeRisk(headerMatch[2]);

      const reasonsRaw = getSection(b, [
        "Reasons?",
        "Concerns?",
        "Challenges?",
        "Specific Concerns?",
        "Observations?",
      ]);
      const recRaw = getSection(b, ["Recommendations?", "Guidance", "Next Steps?"]);

      const reasons = splitBullets(reasonsRaw);
      const recommendations = splitBullets(recRaw);

      const risk_score =
        risk_level === "HIGH" ? 80 : risk_level === "MEDIUM" ? 55 : risk_level === "LOW" ? 25 : 0;

      return {
        id: String(idx),
        name,
        risk_level,
        risk_score,
        reasons,
        recommendations,
      };
    })
    .filter(Boolean);

  students.sort((a, b) => {
    const ao = riskOrder[a.risk_level] ?? 9;
    const bo = riskOrder[b.risk_level] ?? 9;
    if (ao !== bo) return ao - bo;
    return (b.risk_score ?? 0) - (a.risk_score ?? 0);
  });

  return students;
};

// =======================================================
// ROUTE: STUDENT STATUS (TEXT)
// =======================================================
app.get("/student-status", async (req, res) => {
  try {
    const webhook =
      process.env.N8N_STUDENT_STATUS_TEXT_URL ||
      "https://myaidesigntools.app.n8n.cloud/webhook/module-2_latest";

    const { res: n8nRes, contentType, text, preview } = await fetchText(webhook);

    // n8n failure
    if (!n8nRes.ok) {
      return res.status(500).json({
        summary: "N8N student-status failed",
        error: `N8N responded with ${n8nRes.status}`,
        contentType,
        rawPreview: preview,
        rawText: text,
        students: [],
      });
    }

    // parse JSON if possible
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      raw = text;
    }

    const students = parseStudentsFromAnything(raw);

    if (!students.length) {
      return res.json({
        summary: "No students parsed from webhook text.",
        message: "⚠️ Parser could not detect student blocks. Check rawText.",
        students: [],
        rawText: text,
        contentType,
      });
    }

    const out = buildResponse(students);
    return res.json({ ...out, rawText: text, contentType });
  } catch (err) {
    console.error("❌ Student status error:", err);
    return res.status(500).json({
      summary: "Server error",
      message: `❌ Error fetching status: ${err.message}`,
      students: [],
      rawText: null,
    });
  }
});

// =======================================================
// ROUTE: STUDENT VISUAL ANALYTICS (VISUAL webhook)
// =======================================================
app.get("/api/student-visual", async (req, res) => {
  try {
    const webhook =
      process.env.N8N_STUDENT_VISUAL_URL ||
      "https://myaidesigntools.app.n8n.cloud/webhook/MODULE_2_VISUAL";

    const { res: n8nRes, contentType, text, preview } = await fetchText(webhook);

    if (!n8nRes.ok) {
      return res.status(500).json({
        error: `N8N responded with ${n8nRes.status}`,
        contentType,
        rawPreview: preview,
        students: [],
      });
    }

    // ✅ IMPORTANT: empty body => your exact issue (rawPreview is "")
    if (!text || text.trim().length === 0) {
      return res.status(500).json({
        error: "Student visual webhook returned EMPTY body (check n8n execution / credentials / response)",
        contentType,
        rawPreview: preview,
        students: [],
      });
    }

    // If HTML comes back, show it clearly
    if (String(contentType).toLowerCase().includes("text/html")) {
      return res.status(500).json({
        error: "Student visual webhook returned HTML (usually auth/login/redirect). Fix n8n webhook URL.",
        contentType,
        rawPreview: preview,
        students: [],
      });
    }

    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      return res.status(500).json({
        error: "Student visual webhook returned non-JSON",
        contentType,
        rawPreview: preview,
        students: [],
      });
    }

    // unwrap formats
    let data = raw;
    if (Array.isArray(data) && data.length === 1) data = data[0];
    if (data?.output && typeof data.output === "string") {
      try {
        data = JSON.parse(data.output);
      } catch {
        // keep
      }
    }
    if (data?.data?.students) data = data.data;
    if (Array.isArray(data) && data[0]?.students) data = data[0];

    const students =
      (Array.isArray(data?.students) && data.students) ||
      (Array.isArray(data) && data) ||
      [];

    const normalizeRiskLabel = (v) => {
      const up = String(v || "").toLowerCase();
      if (up.includes("high")) return "High";
      if (up.includes("med")) return "Medium";
      if (up.includes("low")) return "Low";
      return "Low";
    };

    const normalized = students.map((s, idx) => ({
      id: s.id ?? String(idx),
      name: s.name || s.studentName || s.student_name || "Unknown",
      avgAppetite: Number(s.avgAppetite ?? s.appetite ?? s.avg_appetite) || 0,
      avgSleep: Number(s.avgSleep ?? s.sleep ?? s.avg_sleep) || 0,
      avgBehaviour: Number(s.avgBehaviour ?? s.behaviour ?? s.avg_behaviour) || 0,
      avgMood: Number(s.avgMood ?? s.mood ?? s.avg_mood) || 0,
      riskLevel: normalizeRiskLabel(s.riskLevel ?? s.risk_level ?? s.risk ?? "Low"),
    }));

    return res.json({
      students: normalized,
      meta: { status: n8nRes.status, contentType },
    });
  } catch (err) {
    console.error("❌ Student visual error:", err);
    return res.status(500).json({
      error: err.message || "Unknown server error",
      students: [],
    });
  }
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

    const rows = result.data.values || [];

    if (rows.length === 0) {
      sendLog("⚠️ No data found in Google Sheet.");
      sendLog("[DONE]");
      return res.end();
    }

    sendLog(`✅ Found ${rows.length} rows. Preparing messages...`);

    for (const row of rows) {
      const [studentName, appetite, sleeping, behaviour, mood, note, phone, customMessage] = row;

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
// ROUTE: SEND WEEKLY MENU (SSE)
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
// ROUTE: AI TEACHER ANALYSIS TEXT REPORT (n8n webhook)
// =======================================================
app.post("/api/teacher-analysis-report", async (req, res) => {
  const webhook = process.env.N8N_TEACHER_REPORT_WEBHOOK_URL;

  if (!webhook) {
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
// =======================================================
app.get("/api/teacher-visual", async (req, res) => {
  const webhook = process.env.N8N_TEACHER_VISUAL_URL;

  if (webhook) {
    try {
      const response = await fetch(webhook);
      const text = await response.text();
      const raw = JSON.parse(text);

      let teachers = [];
      if (Array.isArray(raw?.teachers)) teachers = raw.teachers;
      else if (Array.isArray(raw)) teachers = raw;

      if (!teachers.length) throw new Error("No teacher data");

      return res.json({ teachers });
    } catch (err) {
      console.error("Teacher visual webhook error:", err.message);
    }
  }

  // fallback sample
  return res.json({
    teachers: [
      { name: "Anita Kapoor", classroomManagement: 4, differentiateInstruction: 5, socialEmotional: 4, numeracy: 3, fineMotor: 4, creativeArts: 5, suitabilityScore: 72, experienceYears: 2 },
      { name: "Rahul Sinha", classroomManagement: 5, differentiateInstruction: 4, socialEmotional: 5, numeracy: 4, fineMotor: 3, creativeArts: 4, suitabilityScore: 92, experienceYears: 7 },
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

// ✅ do NOT intercept your backend routes
app.get(
  /^(?!\/api|\/send|\/send-menu|\/student-status).*/,
  (req, res) => res.sendFile(path.join(distPath, "index.html"))
);

// =======================================================
// START SERVER
// =======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
