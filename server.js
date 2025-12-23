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

// ✅ Needed because you use createClient below
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
  keyFile: "credentials.json",
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
// ✅ GLOBAL HELPERS (so ALL blocks can use them safely)
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

// ✅ this is required because you call buildResponse later
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

// =======================================================
// ROUTE: STUDENT STATUS (TEXT ONLY -> ordered message)
// =======================================================
app.get("/student-status", async (req, res) => {
  try {
    const webhook =
      process.env.N8N_STUDENT_STATUS_TEXT_URL ||
      "https://myaidesigntools.app.n8n.cloud/webhook/module-2_latest";

    console.log("📊 Fetching student status TEXT from N8N...", webhook);

    const response = await fetch(webhook);
    if (!response.ok) throw new Error(`N8N responded with ${response.status}`);

    const rawText = await response.text();

    let raw;
    try {
      raw = JSON.parse(rawText);
    } catch {
      raw = rawText;
    }

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

// ✅ Better splitting: split by numbered blocks on NEW LINES too
const studentBlocks = text
  .split(/\n(?=\s*\d+\.\s+)/g)
  .map((s) => s.trim())
  .filter(Boolean);

// ✅ Extract bullets better (handles •, -, 1), 1., newlines)
const splitBullets = (s) =>
  String(s || "")
    .replace(/\r\n/g, "\n")
    .split(/\n|•|- |\u2022/g)
    .map((x) => x.trim())
    .filter((x) => x && x.length > 2)
    .slice(0, 10);

// ✅ Accept MANY header formats
// Examples handled:
// "1. Kamesh S - HIGH RISK"
// "1. Kamesh S — HIGH"
// "1. Kamesh S - High Risk"
// "1. Kamesh S - MEDIUM"
// "1. Kamesh S - LOW"
const parseHeader = (block) => {
  const headerPatterns = [
  // 1) "1. Name - HIGH RISK"
  /^\s*\d+\.\s*([^\n—-]+?)\s*(?:—|-)\s*(HIGH|MEDIUM|LOW)\s*(?:RISK)?/im,

  // 2) "Name: Kamesh S" and later "Risk: HIGH"
  /Name\s*:\s*([^\n]+)[\s\S]*?(?:Risk|Risk Level)\s*:\s*(HIGH|MEDIUM|LOW)/im,

  // 3) "Student: Kamesh S" and later "Risk: HIGH"
  /Student\s*:\s*([^\n]+)[\s\S]*?(?:Risk|Risk Level)\s*:\s*(HIGH|MEDIUM|LOW)/im,
];

let head = null;
for (const re of headerPatterns) {
  const m = b.match(re);
  if (m) {
    head = { name: m[1].trim(), risk_level: normalizeRisk(m[2]) };
    break;
  }
}

if (!head) return null; // ✅ don't create fake Student 1..5

  if (!headerMatch) return null;

  return {
    name: headerMatch[1].trim(),
    risk_level: normalizeRisk(headerMatch[2]),
  };
};

// ✅ Extract Reasons + Recommendations (supports ":" or "-" and multiline)
const parseSection = (block, label) => {
  const re = new RegExp(
    `${label}\\s*[:\\-]\\s*([\\s\\S]*?)(?=\\n\\s*(Reasons|Recommendations|Observations|Notes|General Notes)\\s*[:\\-]|$)`,
    "i"
  );
  const m = block.match(re);
  return m?.[1]?.trim() || "";
};

// ✅ IMPROVED PARSER FOR REASONS AND RECOMMENDATIONS
let students = studentBlocks
  .map((block, idx) => {
    const b = String(block || "").trim();
    if (!b) return null;

    // ✅ Stronger header detection (supports "-", "—", "HIGH", "HIGH RISK")
    const headerMatch =
  b.match(/^\s*\d+[.)]\s*([^\n—-]+?)\s*(?:—|-)\s*(HIGH|MEDIUM|LOW)/i) ||   // 1) Name - HIGH
  b.match(/^\s*\d+\.\s*([^\n—-]+?)\s*(?:—|-)\s*(HIGH|MEDIUM|LOW)(?:\s*RISK)?/i) || // 1. Name - HIGH RISK
  b.match(/^\s*([^\n—-]+?)\s*(?:—|-)\s*(HIGH|MEDIUM|LOW)(?:\s*RISK)?/i) || // Name - HIGH
  b.match(/Name\s*:\s*([^\n]+)[\s\S]*?(?:Risk|Risk Level)\s*:\s*(HIGH|MEDIUM|LOW)/i) || // Name: X ... Risk: HIGH
  b.match(/Student\s*:\s*([^\n]+)[\s\S]*?(?:Risk|Risk Level)\s*:\s*(HIGH|MEDIUM|LOW)/i);  // Student: X ... Risk: HIGH

    // ✅ If no header → DO NOT create "Student 1"
    if (!headerMatch) return null;

    const name = headerMatch[1].trim();
    const risk_level = normalizeRisk(headerMatch[2]);

    // ✅ Extract sections (Reasons/Recommendations) robustly
    const getSection = (text, labels) => {
      const labelGroup = labels.join("|");
      const stopGroup =
        "(Reasons?|Concerns?|Challenges?|Recommendations?|Guidance|Next Steps?|Notes?|General Notes)";
      const re = new RegExp(
        `(?:^|\\n)\\s*(${labelGroup})\\s*[:\\-—]\\s*([\\s\\S]*?)(?=(?:\\n\\s*${stopGroup}\\s*[:\\-—])|$)`,
        "i"
      );
      const m = text.match(re);
      return (m?.[2] || "").trim();
    };

    const splitBullets = (s) =>
      String(s || "")
        .replace(/\r\n/g, "\n")
        .split(/\n|•|\u2022|-\s+|\*\s+/g)
        .map((x) => x.trim())
        .filter((x) => x && x.length > 2)
        .slice(0, 10);

    const reasonsRaw = getSection(b, ["Reasons?", "Concerns?", "Challenges?", "Specific Concerns?"]);
    const recRaw = getSection(b, ["Recommendations?", "Guidance", "Next Steps?"]);

    const reasons = splitBullets(reasonsRaw);
    const recommendations = splitBullets(recRaw);

    const risk_score =
      risk_level === "HIGH" ? 80 :
      risk_level === "MEDIUM" ? 55 :
      risk_level === "LOW" ? 25 : 0;

    return {
      id: String(idx),
      name,
      risk_level,
      risk_score,
      reasons,
      recommendations
    };
  })
  .filter(Boolean);

// ✅ If nothing parsed, return raw text so you can SEE what webhook sent
if (!students.length) {
  return res.json({
    summary: "No students parsed from webhook text.",
    message: "⚠️ Parser could not detect student blocks. Check rawText.",
    students: [],
    rawText,
  });
}
students.sort((a, b) => {
  const ao = riskOrder[a.risk_level] ?? 9;
  const bo = riskOrder[b.risk_level] ?? 9;
  if (ao !== bo) return ao - bo;
  return (b.risk_score ?? 0) - (a.risk_score ?? 0);
});

const message = [
  "📌 Student Risk Report (Ordered)",
  "",
  ...students.map((s, i) => {
    const reasonsText = s.reasons.length ? s.reasons.join(", ") : "N/A";
    const recText = s.recommendations.length ? s.recommendations.join(", ") : "N/A";
    return `${i + 1}. ${s.name} — ${s.risk_level} (Score: ${s.risk_score})\n   Reasons: ${reasonsText}\n   Recommendations: ${recText}`;
  }),
].join("\n");

return res.json({
  summary: "Student risk assessment generated.",
  message,
  students,
  rawText,
});

  } catch (err) {
    console.error("❌ Student status error:", err);
    return res.status(500).json({
      message: `❌ Error fetching status: ${err.message}`,
      students: [],
      rawText: null,
    });
  }
});

// =======================================================
// STUDENT VISUAL ANALYTICS (VISUAL webhook ONLY) - ROBUST
// =======================================================
app.get("/api/student-visual", async (req, res) => {
  try {
    const webhook =
      process.env.N8N_STUDENT_VISUAL_URL ||
      "https://myaidesigntools.app.n8n.cloud/webhook/MODULE_2_VISUAL";

    console.log("🎒 Fetching student visual data...", webhook);

    const response = await fetch(webhook, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    const contentType = response.headers.get("content-type") || "";
    const bodyText = await response.text().catch(() => "");

    console.log("✅ n8n status:", response.status);
    console.log("✅ n8n content-type:", contentType);
    console.log("✅ n8n body preview:", bodyText.slice(0, 300));

    if (!response.ok) {
      return res.status(500).json({
        error: `N8N responded with ${response.status}`,
        contentType,
        rawPreview: bodyText.slice(0, 300),
        students: [],
      });
    }

    let raw;
    try {
      raw = JSON.parse(bodyText);
    } catch {
      return res.status(500).json({
        error: "Student visual webhook returned non-JSON",
        contentType,
        rawPreview: bodyText.slice(0, 300),
        students: [],
      });
    }

    // unwrap common formats
    let data = raw;
    if (Array.isArray(data) && data.length === 1) data = data[0];
    if (data?.output && typeof data.output === "string") {
      try { data = JSON.parse(data.output); } catch {}
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
      meta: { status: response.status, contentType },
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
// ✅ PRESERVED: your 2nd student visual route (renamed to avoid override)
// =======================================================
app.get("/api/student-visual-alt", async (req, res) => {
  try {
    const webhook =
      process.env.N8N_STUDENT_VISUAL_URL ||
      "https://myaidesigntools.app.n8n.cloud/webhook/MODULE_2_VISUAL";

    console.log("🎒 Fetching student visual data...", webhook);

    const response = await fetch(webhook);
    if (!response.ok) throw new Error(`N8N responded with ${response.status}`);

    const raw = await response.json();

    let data = raw;
    if (raw?.output && typeof raw.output === "string") data = JSON.parse(raw.output);
    if (Array.isArray(data) && data[0]?.students) data = data[0];

    const students = Array.isArray(data?.students) ? data.students : [];

    const normalized = students.map((s) => ({
      ...s,
      avgAppetite: Number(s.avgAppetite) || 0,
      avgSleep: Number(s.avgSleep) || 0,
      avgBehaviour: Number(s.avgBehaviour) || 0,
      avgMood: Number(s.avgMood) || 0,
      riskLevel: s.riskLevel || s.risk_level || "Low",
    }));

    return res.json({ students: normalized });
  } catch (err) {
    console.error("❌ Student visual error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// =======================================================
// ✅ FIXED: your “orphan” block is now a real route
// This keeps ALL your code, but removes the crash.
// =======================================================
app.get("/student-status-full", async (req, res) => {
  try {
    const parseFromTextOrJson = (raw) => {
      // If n8n already returns { students: [...] } — use it directly
      if (raw?.students && Array.isArray(raw.students)) {
        const students = raw.students.map((s, idx) => ({
          id: s.id || String(idx),
          name: s.name || s.studentName || `Student ${idx + 1}`,
          risk_level: normalizeRisk(s.risk_level || s.risk || s.level),
          risk_score: Number(s.risk_score ?? s.score ?? 0) || 0,
          reasons: Array.isArray(s.reasons) ? s.reasons : [],
          observations: Array.isArray(s.observations) ? s.observations : [],
          recommendations: Array.isArray(s.recommendations)
            ? s.recommendations
            : [],
        }));

        return students;
      }

      const analysisText =
        (typeof raw === "string" && raw) ||
        raw?.message ||
        raw?.output ||
        raw?.result ||
        raw?.data ||
        JSON.stringify(raw);

      const text = String(analysisText || "")
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+/g, " ")
        .trim();
      
       // ✅ Split into blocks using MULTIPLE patterns:
// 1) "1. " numbered
// 2) "Student:" sections
// 3) "Name:" sections
// 4) fallback: split by blank lines
let studentBlocks = [];

if (/\n\s*\d+\.\s+/.test(text)) {
  studentBlocks = text.split(/\n(?=\s*\d+\.\s+)/g);      // 1. Name
} else if (/\n\s*\d+\)\s+/.test(text)) {
  studentBlocks = text.split(/\n(?=\s*\d+\)\s+)/g);      // 1) Name
} else if (/Student\s*:/i.test(text)) {
  studentBlocks = text.split(/(?=Student\s*:)/gi);       // Student:
} else if (/Name\s*:/i.test(text)) {
  studentBlocks = text.split(/(?=Name\s*:)/gi);          // Name:
} else if (/\n\s*\n/.test(text)) {
  studentBlocks = text.split(/\n\s*\n+/g);               // blank lines
} else {
  studentBlocks = [text];                                // fallback
}

studentBlocks = studentBlocks.map((s) => s.trim()).filter(Boolean);

      const splitBullets = (s) =>
  String(s || "")
    .replace(/\r\n/g, "\n")
    .split(/\n|•|\u2022|-\s+|\*\s+/g)
    .map((x) => x.trim())
    .filter((x) => x && x.length > 2)
    .slice(0, 10);

      const students = studentBlocks
        .map((b, idx) => {
          const block = b.trim();

          const m = block.match(
            /(?:\d+\.\s*)?([A-Za-z][A-Za-z\s.]*?)\s*-\s*(HIGH|MEDIUM|LOW)\s*RISK/i
          );

          const name = m?.[1]?.trim() || `Student ${idx + 1}`;
          const risk_level = normalizeRisk(m?.[2] || "UNKNOWN");

          const reasonsMatch = block.match(
            /Reasons?\s*[:\-]\s*(.*?)(?=\s(?:Observations?|Recommendations?|Guidance|Challenges|General\s*Notes?|Notes?|$))/i
          );

          const recMatch = block.match(
            /Recommendations?\s*[:\-]\s*(.*?)(?=\s(?:Observations?|Guidance|Challenges|General\s*Notes?|Notes?|$))/i
          );

          const reasonsRaw = reasonsMatch?.[1] || "";
          const recRaw = recMatch?.[1] || "";

          const risk_score =
            risk_level === "HIGH"
              ? 80
              : risk_level === "MEDIUM"
              ? 55
              : risk_level === "LOW"
              ? 25
              : 0;

          return {
            id: String(idx),
            name,
            risk_level,
            risk_score,
            reasons: splitBullets(reasonsRaw),
            observations: [],
            recommendations: splitBullets(recRaw),
          };
        })
        .filter(
          (s) =>
            s.name &&
            !s.name.toLowerCase().includes("risk assessment summary") &&
            s.risk_level !== "UNKNOWN"
        );

      return students;
    };

    // -----------------------------
    // 1) Supabase path (if configured)
    // -----------------------------
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("Student data storing final")
          .select("*")
          .limit(1)
          .single();

        if (error) throw error;

        if (data) {
          const maybe = data.students || data;
          const raw =
            (typeof data === "string" && data) ||
            data.message ||
            data.status ||
            data.report ||
            maybe;

          const students = parseFromTextOrJson(raw);
          return res.json(buildResponse(students));
        }
      } catch (err) {
        console.error("Supabase /student-status error:", err.message);
      }
    }

    // -----------------------------
    // 2) n8n webhook fallback
    // -----------------------------
    const webhook =
      process.env.N8N_STUDENT_STATUS_URL ||
      process.env.N8N_WEBHOOK_URL ||
      process.env.N8N_STUDENT_REPORT_WEBHOOK_URL ||
      "https://myaidesigntools.app.n8n.cloud/webhook/module-2_latest";

    console.log("📊 Fetching student status from N8N...", webhook);

    const response = await fetch(webhook);
    if (!response.ok) throw new Error(`N8N responded with ${response.status}`);

    const rawText = await response.text();
    console.log("----- STUDENT STATUS RAW START -----");
console.log(rawText);
console.log("----- STUDENT STATUS RAW END -----");


    let raw;
    try {
      raw = JSON.parse(rawText);
    } catch {
      raw = rawText;
    }

    const students = parseFromTextOrJson(raw);
    return res.json(buildResponse(students));
  } catch (err) {
    console.error("❌ Student status error:", err);
    return res.status(500).json({
      message: `❌ Error fetching status: ${err.message}`,
      students: [],
      charts: {
        riskCounts: { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
        riskScores: [],
      },
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

      let raw;
      try {
        raw = JSON.parse(text);
      } catch (err) {
        console.error("Teacher visual JSON parse error:", err.message);
        throw new Error("Invalid JSON from visual webhook");
      }

      let teachers = [];

      if (Array.isArray(raw)) {
        raw.forEach((item) => {
          if (Array.isArray(item?.teachers)) {
            teachers.push(...item.teachers);
          }
        });

        if (teachers.length === 0 && raw.length && raw[0]?.name) {
          teachers = raw;
        }
      }

      if (Array.isArray(raw?.teachers)) {
        teachers = raw.teachers;
      }

      if (!teachers.length) {
        console.warn("⚠️ No teachers found in visual webhook response");
        throw new Error("No teacher data");
      }

      console.log(`✅ Visual teachers count: ${teachers.length}`);
      return res.json({ teachers });
    } catch (err) {
      console.error("Teacher visual webhook error:", err.message);
    }
  } else {
    console.warn("N8N_TEACHER_VISUAL_URL not set, using sample data.");
  }

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
// ✅ PRESERVED: your last student visual block (renamed to avoid override)
// =======================================================
app.get("/api/student-visual-v2", async (req, res) => {
  try {
    const webhook =
      process.env.N8N_STUDENT_VISUAL_URL ||
      "https://myaidesigntools.app.n8n.cloud/webhook/MODULE_2_VISUAL";

    console.log("🎒 Fetching student visual data...", webhook);

    const response = await fetch(webhook);
    if (!response.ok) throw new Error(`N8N responded with ${response.status}`);

    const raw = await response.json();

    console.log("🔹 Raw N8N response:", raw);

    let data = raw;

    if (raw?.output && typeof raw.output === "string") {
      try {
        data = JSON.parse(raw.output);
      } catch {
        data = raw;
      }
    }

    if (Array.isArray(data) && data.length && data[0]?.students) {
      data = data[0];
    }

    if (!Array.isArray(data?.students) || data.students.length === 0) {
      console.warn("⚠️ No student visual data found");
      return res.json({ students: [] });
    }

    const students = data.students.map((s) => ({
      ...s,
      avgAppetite: Number(s.avgAppetite) || 0,
      avgSleep: Number(s.avgSleep) || 0,
      avgBehaviour: Number(s.avgBehaviour) || 0,
      avgMood: Number(s.avgMood) || 0,
      riskLevel: s.riskLevel || s.risk_level || s.risk || "Low",
    }));

    return res.json({ students });
  } catch (err) {
    console.error("❌ Student visual error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// =======================================================
// SERVE FRONTEND BUILD (EXPRESS 5 SAFE)
// =======================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, "client", "dist");
app.use(express.static(distPath));

// ✅ Express 5 safe SPA fallback using REGEX
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