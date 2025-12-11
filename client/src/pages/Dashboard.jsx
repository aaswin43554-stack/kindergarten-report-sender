// client/src/pages/Dashboard.jsx

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import * as echarts from "echarts";

// -----------------------------------------------------------------------------
// INLINE CSS (requested)
// -----------------------------------------------------------------------------
const InlineStyles = () => (
  <style>{`
  
  body {
    background: #ffffff !important;
  }

  .dashboard-page {
    min-height: 100vh;
    background: #ffffff;
    display: flex;
    justify-content: center;
  }

  .dashboard-container {
    max-width: 1100px;
    width: 100%;
    padding: 32px 24px 40px;
    margin: 0 auto;
  }

  .dashboard-title {
    font-size: 2.6rem;
    font-weight: 800;
    text-align: center;
    margin-bottom: 8px;
    color: #222;
  }

  .dashboard-subtitle {
    text-align: center;
    color: #555;
    font-size: 1.1rem;
    margin-bottom: 24px;
  }

  .tabs {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-bottom: 25px;
  }

  .tab-btn {
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid #ddd;
    background: #f5f5f5;
    cursor: pointer;
    font-size: 0.95rem;
    transition: 0.2s ease-in-out;
  }

  .tab-btn:hover {
    background: #e8e8e8;
  }

  .tab-btn.active {
    background: #4f46e5;
    color: white;
    font-weight: 600;
    border-color: #4f46e5;
  }

  .tab-panel {
    text-align: center;
    padding: 20px 10px;
  }

  .send-btn {
    background: #10b981;
    color: white;
    padding: 14px 28px;
    border-radius: 10px;
    font-size: 1.2rem;
    border: none;
    cursor: pointer;
    transition: 0.2s;
  }

  .send-btn:hover {
    background: #0d966c;
  }

  .clear-btn {
    background: #f59e0b;
    padding: 8px 16px;
    border-radius: 8px;
    color: white;
    border: none;
    cursor: pointer;
  }

  .logs-section {
    margin-top: 20px;
    padding: 20px;
    border-radius: 10px;
    background: #fafafa;
  }

  .logs-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .logs-list {
    margin-top: 14px;
    list-style: none;
    padding-left: 0;
  }

  .log-item {
    padding: 4px 0;
    font-size: 0.95rem;
  }

  .log-item.green { color: #16a34a; }
  .log-item.yellow { color: #d97706; }
  .log-item.red { color: #dc2626; }

  /* ------------------------------------------------------------------ */
  /* TEACHER PERFORMANCE AI REPORT STYLES                               */
  /* ------------------------------------------------------------------ */
  .teacher-report-box {
    background: white;
    border: 1px solid #e5e7eb;
    padding: 22px;
    margin-top: 20px;
    border-radius: 12px;
    box-shadow: 0 4px 10px rgba(0,0,0,0.06);
    text-align: left;
    max-height: 70vh;
    overflow-y: auto;
    line-height: 1.55;
  }

  .teacher-name {
    font-size: 1.3rem;
    margin-top: 12px;
    color: #111;
    display: block;
  }

  .teacher-verdict {
    font-size: 1.05rem;
    color: #444;
    margin-bottom: 4px;
    display: block;
  }

  .bullet {
    margin-left: 22px;
    display: block;
  }

  `}</style>
);

// -----------------------------------------------------------------------------
// Markdown → HTML converter WITH teacher formatting + bullets
// -----------------------------------------------------------------------------
const renderMarkdownAsHtml = (markdownText) => {
  if (!markdownText) return "";

  let html = markdownText;

  // Convert "- text" into bullet points
  html = html.replace(/\n-\s+/g, `<br /><span class="bullet">• `);

  // Replace Teacher: NAME
  html = html.replace(
    /Teacher:\s*([^\n<]+)/g,
    `<br /><span class="teacher-name">👩‍🏫 <strong>$1</strong></span>`
  );

  // Replace Verdict:
  html = html.replace(
    /Verdict:\s*([^\n<]+)/g,
    `<span class="teacher-verdict"><strong>Verdict: $1</strong></span>`
  );

  // Basic bold formatting
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Convert newlines to <br>
  html = html.replace(/\n/g, "<br />");

  return html;
};

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------
const Dashboard = () => {
  const navigate = useNavigate();

  const [logs, setLogs] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState("daily");

  const [teacherReport, setTeacherReport] = useState(null);
  const [visualData, setVisualData] = useState(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  const radarChartRef = useRef(null);
  const barChartRef = useRef(null);
  const lineChartRef = useRef(null);

  const appendLog = (msg) =>
    setLogs((prev) => [...prev, typeof msg === "string" ? msg : JSON.stringify(msg)]);

  const clearLogs = () => setLogs([]);

  const handleLogout = () => {
    localStorage.removeItem("loggedIn");
    navigate("/");
  };

  // ---------------- DAILY REPORTS ----------------
  const sendDaily = () => {
    setLogs([]);
    setIsSending(true);

    const es = new EventSource("/send");

    es.onmessage = (e) => {
      if (e.data === "[DONE]") {
        es.close();
        setIsSending(false);
      } else appendLog(e.data);
    };

    es.onerror = () => {
      appendLog("❌ Error sending daily reports.");
      es.close();
      setIsSending(false);
    };
  };

  // ---------------- WEEKLY MENU ----------------
  const sendWeeklyMenu = () => {
    setLogs([]);
    setIsSending(true);

    const es = new EventSource("/send-menu");

    es.onmessage = (e) => {
      if (e.data === "[DONE]") {
        es.close();
        setIsSending(false);
      } else appendLog(e.data);
    };

    es.onerror = () => {
      appendLog("❌ Error sending weekly menu.");
      es.close();
      setIsSending(false);
    };
  };

  // ---------------- STUDENT STATUS ----------------
  const fetchStudentStatus = async () => {
    appendLog("📊 Fetching student status...");
    try {
      const res = await fetch("/student-status");
      const json = await res.json();
      appendLog(json.message || "⚠️ No status returned.");
    } catch {
      appendLog("❌ Error fetching student status.");
    }
  };

  // ---------------- VISUAL DATA ----------------
  const fetchVisualData = async () => {
    try {
      const response = await fetch("/api/teacher-visual");
      const rawText = await response.text();

      let raw;
      try {
        raw = JSON.parse(rawText);
      } catch {
        appendLog("❌ Could not parse AI visual data JSON.");
        return;
      }

      let teachers = null;

      if (Array.isArray(raw) && raw[0]?.teachers) teachers = raw[0].teachers;
      else if (raw.teachers) teachers = raw.teachers;
      else if (Array.isArray(raw)) teachers = raw;
      else if (Array.isArray(raw.data)) teachers = raw.data;

      if (!teachers) {
        appendLog("❌ Visual data missing or in wrong format.");
        return;
      }

      setVisualData(teachers);
      appendLog("✅ Visual data loaded.");
    } catch (err) {
      appendLog("❌ Error loading visual data.");
    }
  };

  // ---------------- AI TEACHER REPORT ----------------
  const triggerN8n = async () => {
    setIsProcessingAI(true);
    setTeacherReport(null);
    setVisualData(null);

    appendLog("🤖 Generating AI teacher report...");

    try {
      const res = await fetch("/api/teacher-analysis-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: true }),
      });

      const json = await res.json();
      setTeacherReport(json);
      appendLog("✅ AI teacher report generated.");

      fetchVisualData();
    } catch {
      appendLog("❌ AI report failed.");
    }

    setIsProcessingAI(false);
  };

  // ---------------- ECHARTS ----------------
  useEffect(() => {
    if (!visualData) return;

    const names = visualData.map((t) => t.name);
    const radarScores = visualData.map((t) => [
      t.classroomManagement,
      t.differentiateInstruction,
      t.socialEmotional,
      t.numeracy,
      t.fineMotor,
      t.creativeArts,
    ]);
    const suitability = visualData.map((t) => t.suitabilityScore);
    const expYears = visualData.map((t) => t.experienceYears);

    const colors = [
      "#3b82f6",
      "#22c55e",
      "#ef4444",
      "#a855f7",
      "#f97316",
      "#06b6d4",
      "#84cc16",
      "#ec4899",
      "#6366f1",
      "#0ea5e9",
    ];

    // Radar
    if (radarChartRef.current) {
      echarts.dispose(radarChartRef.current);
      const chart = echarts.init(radarChartRef.current);
      chart.setOption({
        title: { text: "Teacher Skill Radar" },
        tooltip: {},
        legend: { bottom: 0 },
        radar: {
          indicator: [
            { name: "Classroom", max: 5 },
            { name: "Differentiation", max: 5 },
            { name: "Soc-Emotional", max: 5 },
            { name: "Numeracy", max: 5 },
            { name: "Fine Motor", max: 5 },
            { name: "Creative Arts", max: 5 },
          ],
        },
        series: radarScores.map((scores, i) => ({
          type: "radar",
          name: names[i],
          data: [scores],
          itemStyle: { color: colors[i % colors.length] },
          areaStyle: { opacity: 0.1 },
        })),
      });
    }

    // Bar
    if (barChartRef.current) {
      echarts.dispose(barChartRef.current);
      const chart = echarts.init(barChartRef.current);
      chart.setOption({
        title: { text: "Suitability Scores" },
        xAxis: { type: "category", data: names },
        yAxis: { type: "value" },
        series: [
          {
            type: "bar",
            data: suitability,
            itemStyle: {
              color: (p) => colors[p.dataIndex % colors.length],
            },
          },
        ],
      });
    }

    // Line
    if (lineChartRef.current) {
      echarts.dispose(lineChartRef.current);
      const chart = echarts.init(lineChartRef.current);
      chart.setOption({
        title: { text: "Experience Years" },
        xAxis: { type: "category", data: names },
        yAxis: { type: "value" },
        series: [
          {
            type: "line",
            smooth: true,
            data: expYears,
            itemStyle: { color: "#4f46e5" },
          },
        ],
      });
    }
  }, [visualData]);

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------
  return (
    <>
      <InlineStyles /> {/* Inject CSS */}
      <Navbar onLogout={handleLogout} />

      <div className="dashboard-page">
        <div className="dashboard-container">

          <h1 className="dashboard-title">🎓 Kindergarten Teacher Dashboard</h1>
          <p className="dashboard-subtitle">
            Use the tabs below to send updates, view status, or run AI analysis.
          </p>

          {/* TAB BUTTONS */}
          <div className="tabs">
            <button
              className={`tab-btn ${activeTab === "daily" ? "active" : ""}`}
              onClick={() => setActiveTab("daily")}
            >
              Daily
            </button>

            <button
              className={`tab-btn ${activeTab === "menu" ? "active" : ""}`}
              onClick={() => setActiveTab("menu")}
            >
              Menu
            </button>

            <button
              className={`tab-btn ${activeTab === "status" ? "active" : ""}`}
              onClick={() => setActiveTab("status")}
            >
              Student Status
            </button>

            <button
              className={`tab-btn ${activeTab === "ai" ? "active" : ""}`}
              onClick={() => setActiveTab("ai")}
            >
              🧠 Teacher Performance
            </button>
          </div>

          {/* TAB CONTENT */}
          <div className="dashboard-content">

            {activeTab === "daily" && (
              <div className="tab-panel">
                <h3>📆 Daily Student Reports</h3>
                <p>Send WhatsApp updates to parents.</p>
                <button className="send-btn" onClick={sendDaily}>
                  🚀 Send Daily Reports
                </button>
              </div>
            )}

            {activeTab === "menu" && (
              <div className="tab-panel">
                <h3>🍱 Weekly Menu</h3>
                <p>Message all parents with the weekly food menu.</p>
                <button className="send-btn" onClick={sendWeeklyMenu}>
                  🍽 Send Weekly Menu
                </button>
              </div>
            )}

            {activeTab === "status" && (
              <div className="tab-panel">
                <h3>📊 Student Report Status</h3>
                <button
                  className="send-btn"
                  style={{ background: "#8b5cf6" }}
                  onClick={fetchStudentStatus}
                >
                  📊 Check Status
                </button>
              </div>
            )}

            {activeTab === "ai" && (
              <div className="tab-panel">
                <h3>🧠 Teacher Performance</h3>
                <p>Generate AI insights + visual analytics.</p>

                <button
                  className="send-btn"
                  style={{ background: "#ef4444" }}
                  onClick={triggerN8n}
                >
                  🚀 Generate AI Report
                </button>

                {/* Charts */}
                {visualData && (
                  <>
                    <div ref={radarChartRef} style={{ height: 350, marginTop: 20 }} />
                    <div ref={barChartRef} style={{ height: 300, marginTop: 30 }} />
                    <div ref={lineChartRef} style={{ height: 300, marginTop: 30 }} />
                  </>
                )}

                {/* AI Text */}
                {teacherReport?.output && (
                  <div
                    className="teacher-report-box"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdownAsHtml(teacherReport.output),
                    }}
                  />
                )}
              </div>
            )}

            {/* LOGS */}
            <div className="logs-section">
              <div className="logs-header">
                <h3>Logs</h3>
                <button className="clear-btn" onClick={clearLogs}>🧹 Clear Logs</button>
              </div>

              {logs.length === 0 ? (
                <p className="muted">No logs yet. Start an action.</p>
              ) : (
                <ul className="logs-list">
                  {logs.map((log, i) => (
                    <li key={i} className={`log-item 
                      ${log.includes("❌") ? "red" : ""}
                      ${log.includes("⚠️") ? "yellow" : ""}
                      ${log.includes("✅") ? "green" : ""}
                    `}>
                      {log}
                    </li>
                  ))}
                </ul>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
