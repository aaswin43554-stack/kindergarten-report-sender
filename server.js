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
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

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
// ROUTE: STUDENT STATUS (Structured + Ordered + Chart-ready)
// - 1) Try Supabase (if configured)
// - 2) Fallback to n8n webhook
// - Always returns: { message, students, charts, summary }

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

    const text = String(analysisText || "").replace(/\r\n/g, "\n").trim();

    const normalizeRisk = (s) => {
      if (!s) return "UNKNOWN";
      const up = String(s).toUpperCase();
      if (up.includes("HIGH")) return "HIGH";
      if (up.includes("MED")) return "MEDIUM";
      if (up.includes("LOW")) return "LOW";
      return "UNKNOWN";
    };

    const riskOrder = { HIGH: 0, MEDIUM: 1, LOW: 2, UNKNOWN: 9 };

    const blocks = text.split(/(?=\d+\.\s)/g).filter(Boolean);
    const studentBlocks = blocks.length ? blocks : [text];

    const splitBullets = (s) =>
      String(s || "")
        .replace(/\s+/g, " ")
        .split(/(?:\s*[•\-]\s+|\s*\d+\.\s+|\s*\d+\)\s+|;\s+|,\s+|\.\s+(?=[A-Z]))/)
        .map((x) => x.trim())
        .filter((x) => x && x.length > 2)
        .slice(0, 8);

    let students = studentBlocks.map((block, idx) => {
      const b = block.trim();

      const head = b.match(/(?:\d+\.\s*)?(.+?)\s*-\s*(HIGH|MEDIUM|LOW)\s*RISK/i);
      const name = (head?.[1] || `Student ${idx + 1}`).trim();
      const risk_level = normalizeRisk(head?.[2] || "UNKNOWN");

      const reasonsMatch = b.match(
        /Reasons?\s*[:\-]\s*(.*?)(?=\s*(Recommendations?|General Notes|Notes|$))/is
      );
      const recMatch = b.match(
        /Recommendations?\s*[:\-]\s*(.*?)(?=\s*(General Notes|Notes|$))/is
      );

      const reasons = splitBullets(reasonsMatch?.[1] || "");
      const recommendations = splitBullets(recMatch?.[1] || "");

      const risk_score =
        risk_level === "HIGH" ? 80 :
        risk_level === "MEDIUM" ? 55 :
        risk_level === "LOW" ? 25 : 0;

      return { id: String(idx), name, risk_level, risk_score, reasons, recommendations };
    });

    students = students.filter((s) => s.name && s.name.length > 1);

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

    // ✅ IMPORTANT: no illegal return outside — this is inside route
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
// STUDENT VISUAL ANALYTICS (VISUAL webhook ONLY)
// =======================================================
app.get("/api/student-visual", async (req, res) => {
  try {
    const webhook =
      process.env.N8N_STUDENT_VISUAL_URL ||
      "https://myaidesigntools.app.n8n.cloud/webhook/MODULE_2_VISUAL";

    console.log("🎒 Fetching student visual data...", webhook);

    const response = await fetch(webhook);
    if (!response.ok) throw new Error(`N8N responded with ${response.status}`);

    const text = await response.text();

    let raw;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      throw new Error("Student visual webhook returned non-JSON text");
    }

    // ✅ Normalize possible shapes from n8n
    // Possible outputs:
    // 1) { students:[...] }
    // 2) [{ students:[...] }]
    // 3) { output:"{students:[...]}" }
    // 4) [{ output:"{students:[...]}" }]
    let data = raw;

    if (Array.isArray(data) && data.length === 1) data = data[0];

    if (data?.output && typeof data.output === "string") {
      try {
        data = JSON.parse(data.output);
      } catch {
        // keep as-is
      }
    }

    if (Array.isArray(data) && data[0]?.students) data = data[0];

    const students = Array.isArray(data?.students) ? data.students : [];

    // ✅ Ensure numeric values for charts
    const normalized = students.map((s) => ({
      ...s,
      name: s.name || s.studentName || "Unknown",
      avgAppetite: Number(s.avgAppetite) || 0,
      avgSleep: Number(s.avgSleep) || 0,
      avgBehaviour: Number(s.avgBehaviour) || 0,
      avgMood: Number(s.avgMood) || 0,
      riskLevel: s.riskLevel || s.risk_level || "Low",
    }));

    console.log("✅ Student visuals count:", normalized.length);

    return res.json({ students: normalized });
  } catch (err) {
    console.error("❌ Student visual error:", err.message);
    return res.status(500).json({ error: err.message, students: [] });
  }
});


app.get("/api/student-visual", async (req, res) => {
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
          recommendations: Array.isArray(s.recommendations) ? s.recommendations : [],
        }));

        return students;
      }

      // Convert anything into a single text blob we can parse if needed
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


      // Split into numbered student blocks: "1. Name - HIGH RISK ..."
      const blocks = text.split(/\s(?=\d+\.\s)/g).filter(Boolean);
      const studentBlocks = blocks.length ? blocks : [text];

      const splitBullets = (s) =>
  String(s || "")
    .replace(/\s+/g, " ")
    .split(/(?:\s*[•\-]\s+|\s*\d+\.\s+|\s*\d+\)\s+|;\s+|\.\s+(?=[A-Z])|,\s+)/)
    .map((x) => x.trim())
    .filter((x) => x && x.length > 2)
    .slice(0, 8);


      const students = studentBlocks
        .map((b, idx) => {
          const block = b.trim();

          // Extract "Name - RISK"
          const m = block.match(
            /(?:\d+\.\s*)?([A-Za-z][A-Za-z\s.]*?)\s*-\s*(HIGH|MEDIUM|LOW)\s*RISK/i
          );

          const name = m?.[1]?.trim() || `Student ${idx + 1}`;
          const risk_level = normalizeRisk(m?.[2] || "UNKNOWN");

          // Extract sections (best-effort)
          const reasonsMatch = block.match(
  /Reasons?\s*[:\-]\s*(.*?)(?=\s(?:Observations?|Recommendations?|Guidance|Challenges|General\s*Notes?|Notes?|$))/i
);

const recMatch = block.match(
  /Recommendations?\s*[:\-]\s*(.*?)(?=\s(?:Observations?|Guidance|Challenges|General\s*Notes?|Notes?|$))/i
);

          const reasonsRaw = reasonsMatch?.[1] || "";
          const recRaw = recMatch?.[1] || "";

          const risk_score =
            risk_level === "HIGH" ? 80 :
            risk_level === "MEDIUM" ? 55 :
            risk_level === "LOW" ? 25 : 0;

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
          // Try to interpret Supabase row as either structured students or text
          // Common fields you used: message / status / report
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
        // fall through to webhook
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
// STUDENT VISUAL ANALYTICS (n8n)
// =======================================================
app.get("/api/student-visual", async (req, res) => {
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

    // n8n sometimes returns JSON as string
    if (raw?.output && typeof raw.output === "string") {
      try {
        data = JSON.parse(raw.output);
      } catch {
        data = raw;
      }
    }

    // Some n8n flows may return an array wrapper: [{ students: [...] }]
    if (Array.isArray(data) && data.length && data[0]?.students) {
      data = data[0];
    }

    // validate students array
    if (!Array.isArray(data?.students) || data.students.length === 0) {
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

      // optional: if riskLevel comes in different key formats
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
