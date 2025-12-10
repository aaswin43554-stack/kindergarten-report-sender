// =======================================================
// IMPORT DEPENDENCIES
// =======================================================
import express from "express";
import twilio from "twilio";
import { google } from "googleapis";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";

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
let auth;

if (fs.existsSync("credentials.json")) {
    console.log("✅ Using credentials.json for Google Auth.");
    auth = new google.auth.GoogleAuth({
        keyFile: "credentials.json",
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
} else {
    console.log("⚠️ credentials.json not found — using ENV variables.");

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!email || !key) {
        console.error("❌ Missing Google Auth ENV variables!");
    }

    auth = new google.auth.GoogleAuth({
        credentials: { client_email: email, private_key: key },
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
}

const sheets = google.sheets({ version: "v4", auth });

// =======================================================
// ROUTE: GET STUDENT STATUS (MODULE 2)
// =======================================================
app.get("/student-status", async (req, res) => {
    try {
        const webhook = process.env.N8N_STUDENT_REPORT_WEBHOOK_URL;
        const resp = await fetch(webhook);
        const text = await resp.text();

        try {
            return res.json(JSON.parse(text));
        } catch {
            return res.json({ raw: text });
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// =======================================================
// ROUTE: SEND DAILY REPORTS
// =======================================================
app.get("/send", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const log = (msg) => res.write(`data: ${msg}\n\n`);

    try {
        log("📊 Fetching sheet data...");
        const result = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SHEET_ID,
            range: "Daily Report!A2:H",
        });

        const rows = result.data.values || [];
        log(`Found ${rows.length} rows`);

        for (const row of rows) {
            const [name, appetite, sleep, behavior, mood, note, phone] = row;

            if (!phone) {
                log(`Skipping ${name} (no phone)`);
                continue;
            }

            const msg = `
Daily report for ${name}

🍽 Appetite: ${appetite}
😴 Sleep: ${sleep}
😊 Behavior: ${behavior}
🎭 Mood: ${mood}
📝 Note: ${note}
`;

            await client.messages.create({
                from: process.env.TWILIO_WHATSAPP_FROM,
                to: `whatsapp:${phone}`,
                body: msg,
            });

            log(`Sent to ${phone}`);
        }

        log("[DONE]");
        res.end();
    } catch (err) {
        log(`ERROR: ${err.message}`);
        res.end();
    }
});

// =======================================================
// ROUTE: SEND WEEKLY MENU
// =======================================================
app.get("/send-menu", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    const log = (msg) => res.write(`data: ${msg}\n\n`);

    try {
        const result = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SHEET_ID,
            range: "WeeklyMenu!A2:C",
        });

        const rows = result.data.values || [];
        let menu = "*🍽 Weekly Menu 🍽*\n\n";

        for (const r of rows) {
            menu += `• ${r[0]}: ${r[1]}\n`;
        }

        const phones = [...new Set(rows.map((r) => r[2]).filter(Boolean))];

        for (const p of phones) {
            await client.messages.create({
                from: process.env.TWILIO_WHATSAPP_FROM,
                to: `whatsapp:${p}`,
                body: menu,
            });
            log(`Menu sent to ${p}`);
        }

        log("[DONE]");
        res.end();
    } catch (e) {
        log(`ERROR: ${e.message}`);
        res.end();
    }
});

// =======================================================
// ROUTE: AI TEACHER ANALYSIS TEXT REPORT
// =======================================================
app.post("/api/teacher-analysis-report", async (req, res) => {
    try {
        const webhook = process.env.N8N_TEACHER_REPORT_WEBHOOK_URL;
        const response = await fetch(webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req.body),
        });

        const json = await response.json();
        return res.json(json);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// =======================================================
// ROUTE: TEACHER VISUAL CHART DATA
// =======================================================
app.get("/api/teacher-visual", async (req, res) => {
    try {
        const webhook = process.env.N8N_TEACHER_VISUAL_URL;

        const response = await fetch(webhook);
        const json = await response.json();

        return res.json(json);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// =======================================================
// START SERVER
// =======================================================
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Backend running at: http://localhost:${PORT}`);
    console.log(`✨ /api/teacher-visual ready`);
});
