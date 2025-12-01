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
// ROUTE: GET STUDENT STATUS (N8N MODULE 2)
// =======================================================
app.get("/student-status", async (req, res) => {
    const webhook = process.env.N8N_STUDENT_REPORT_WEBHOOK_URL;

    if (!webhook) {
        console.error("❌ Missing N8N_STUDENT_REPORT_WEBHOOK_URL in .env");
        return res.status(500).json({ message: "Webhook URL missing." });
    }

    console.log("📡 Calling n8n student-status URL:", webhook);

    try {
        const response = await fetch(webhook, { method: "GET" });

        console.log("📥 n8n status code:", response.status);

        const text = await response.text();
        console.log("📦 n8n raw response:", text);

        let json;
        try {
            json = JSON.parse(text);
        } catch {
            console.log("⚠️ Response is not JSON.");
            return res.status(500).json({ message: "Invalid JSON from n8n", raw: text });
        }

        return res.status(200).json(json);
    } catch (err) {
        console.error("❌ Error calling n8n:", err.message);
        return res.status(500).json({ message: "Server error", details: err.message });
    }
});

// =======================================================
// ROUTE: SEND DAILY REPORTS (SSE STREAM)
// =======================================================
app.get("/send", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const sendLog = (msg) => res.write(`data: ${msg}\n\n`);

    try {
        sendLog("📊 Fetching data from Google Sheet...");
        const result = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SHEET_ID,
            range: "Daily Report!A2:H",
        });

        const rows = result.data.values || [];
        if (rows.length === 0) {
            sendLog("⚠️ No data found in Google Sheet.");
            return res.end();
        }

        sendLog(`✅ Found ${rows.length} rows.`);

        for (const row of rows) {
            const [studentName, appetite, sleeping, behaviour, mood, note, phone, messageFromSheet] = row;

            if (!phone) {
                sendLog(`⚠️ Skipping ${studentName} (no phone)`);
                continue;
            }

            const message = messageFromSheet || `
🌞 Good evening parent!

Daily report for ${studentName}:

🍽 Appetite: ${appetite}
😴 Sleeping: ${sleeping}
😊 Behaviour: ${behaviour}
🎭 Mood: ${mood}
📝 Note: ${note}

Regards,
Kindergarten Team
`;

            sendLog(`➡️ Sending message to ${phone}...`);

            try {
                await client.messages.create({
                    from: process.env.TWILIO_WHATSAPP_FROM,
                    to: `whatsapp:${phone}`,
                    body: message,
                });

                sendLog(`✅ Sent to ${phone}`);
            } catch (err) {
                sendLog(`❌ Failed: ${err.message}`);
            }
        }

        sendLog("🎉 All messages sent!");
        sendLog("[DONE]");
        res.end();
    } catch (error) {
        sendLog(`❌ Error: ${error.message}`);
        sendLog("[DONE]");
        res.end();
    }
});

// =======================================================
// ROUTE: SEND WEEKLY MENU (SSE)
// =======================================================
app.get("/send-menu", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");

    const sendLog = (msg) => res.write(`data: ${msg}\n\n`);

    try {
        sendLog("🍱 Fetching weekly menu...");

        const result = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SHEET_ID,
            range: "WeeklyMenu!A2:C",
        });

        const rows = result.data.values || [];

        if (rows.length === 0) {
            sendLog("⚠️ No menu data found.");
            return res.end();
        }

        let menu = "*🍽 Weekly Menu 🍽*\n\n";
        for (const row of rows) {
            const [day, food] = row;
            menu += `• ${day}: ${food}\n`;
        }

        const phones = [...new Set(rows.map((r) => r[2]).filter(Boolean))];

        for (const phone of phones) {
            sendLog(`➡️ Sending menu to ${phone}...`);
            try {
                await client.messages.create({
                    from: process.env.TWILIO_WHATSAPP_FROM,
                    to: `whatsapp:${phone}`,
                    body: menu,
                });

                sendLog(`✅ Menu sent to ${phone}`);
            } catch (err) {
                sendLog(`❌ Failed: ${err.message}`);
            }
        }

        sendLog("🎉 Menu sent!");
        sendLog("[DONE]");
        res.end();
    } catch (error) {
        sendLog(`❌ Error: ${error.message}`);
        res.end();
    }
});

// =======================================================
// ROUTE: AI TEACHER ANALYSIS (N8N MODULE 3)
// =======================================================
app.post("/api/teacher-analysis-report", async (req, res) => {
    const webhook = process.env.N8N_TEACHER_REPORT_WEBHOOK_URL;

    if (!webhook) {
        console.error("❌ Missing N8N_TEACHER_REPORT_WEBHOOK_URL");
        return res.status(500).json({ error: "Webhook not configured" });
    }

    try {
        const response = await fetch(webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req.body),
        });

        if (!response.ok) {
            const txt = await response.text();
            return res.status(500).json({ error: "n8n error", raw: txt });
        }

        const json = await response.json();
        return res.status(200).json(json);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

// =======================================================
// NOTE: FRONTEND SERVING DISABLED FOR DEVELOPMENT
// DO NOT ENABLE THIS UNTIL PRODUCTION BUILD
// =======================================================
// ❌ THIS BREAKS VITE PROXY DURING DEVELOPMENT
//
// const distPath = path.join(__dirname, "client", "dist");
// app.use(express.static(distPath));
// app.get("*", (req, res) => {
//   res.sendFile(path.join(distPath, "index.html"));
// });

// =======================================================
// START SERVER
// =======================================================
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Backend running at: http://localhost:${PORT}`);
    console.log(`✨ Student Status ready at /student-status`);
});
