// client/src/pages/Dashboard.jsx

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import * as echarts from "echarts";
import "../styles.css";

/**
 * Simple Markdown → HTML converter for the AI report text.
 * Supports:
 * - line breaks
 * - **bold** text
 */
const renderMarkdownAsHtml = (markdownText) => {
  if (!markdownText) return "";
  let html = markdownText.replace(/\n/g, "<br />");
  html = html.replace(/\*\*([^\*]+)\*\*/g, "<strong>$1</strong>");
  return html;
};

const REPORT_BOX_STYLE = {
  backgroundColor: "white",
  border: "1px solid #e0e0e0",
  borderRadius: "8px",
  padding: "20px",
  marginTop: "25px",
  boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
  wordBreak: "break-word",
};

const Dashboard = () => {
  const navigate = useNavigate();

  // -----------------------------
  // Core state
  // -----------------------------
  const [logs, setLogs] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState("daily");

  // AI + Visuals state
  const [teacherReport, setTeacherReport] = useState(null);
  const [visualData, setVisualData] = useState(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  // ECharts refs
  const radarChartRef = useRef(null);
  const barChartRef = useRef(null);
  const lineChartRef = useRef(null);

  // -----------------------------
  // Helpers
  // -----------------------------
  const appendLog = (msg) => {
    const text =
      typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
    setLogs((prev) => [...prev, text]);
  };

  const clearLogs = () => setLogs([]);

  const handleLogout = () => {
    localStorage.removeItem("loggedIn");
    navigate("/");
  };

  // ======================================================
  // DAILY REPORTS (original behaviour, SSE)
  // ======================================================
  const sendDaily = () => {
    setLogs([]);
    setIsSending(true);

    // Use relative URL so Vite proxy / Render works:
    const eventSource = new EventSource("/send");

    eventSource.onmessage = (event) => {
      if (event.data === "[DONE]") {
        eventSource.close();
        setIsSending(false);
        return;
      }
      appendLog(event.data);
    };

    eventSource.onerror = (err) => {
      console.error("❌ SSE error (daily):", err);
      appendLog("❌ Connection error while sending daily reports.");
      setIsSending(false);
      eventSource.close();
    };
  };

  // ======================================================
  // WEEKLY MENU (original behaviour, SSE)
  // ======================================================
  const sendWeeklyMenu = () => {
    setLogs([]);
    setIsSending(true);

    const eventSource = new EventSource("/send-menu");

    eventSource.onmessage = (event) => {
      if (event.data === "[DONE]") {
        eventSource.close();
        setIsSending(false);
        return;
      }
      appendLog(event.data);
    };

    eventSource.onerror = (err) => {
      console.error("❌ SSE error (menu):", err);
      appendLog("❌ Connection error while sending weekly menu.");
      setIsSending(false);
      eventSource.close();
    };
  };

  // ======================================================
  // STUDENT REPORT STATUS (Supabase)
  // ======================================================
  const fetchStudentStatus = async () => {
    appendLog("📊 Fetching student report status...");
    try {
      // Relative path so it works in dev (proxy) + prod (Render)
      const response = await fetch("/student-status");
      const data = await response.json();

      if (data?.message) {
        appendLog(`✅ Status: ${data.message}`);
      } else {
        appendLog("⚠️ Received empty status.");
      }
    } catch (error) {
      console.error("Error fetching status:", error);
      appendLog("❌ Error fetching status from server.");
    }
  };

  // ======================================================
  // AI + VISUAL DATA
  // ======================================================

  /**
   * Fetch the visual data for charts from backend.
   * Backend returns something like:
   * [
   *   {
   *     teachers: [
   *       {
   *         name: "Teacher A",
   *         classroomManagement: 4,
   *         differentiateInstruction: 5,
   *         socialEmotional: 4,
   *         numeracy: 3,
   *         fineMotor: 4,
   *         creativeArts: 5,
   *         suitabilityScore: 4.7,
   *         experienceYears: 6
   *       },
   *       ...
   *     ]
   *   }
   * ]
   */
  const fetchVisualData = async () => {
    try {
      const response = await fetch("/api/teacher-visual");
      const rawText = await response.text();

      let raw;
      try {
        raw = JSON.parse(rawText);
      } catch (err) {
        console.error("❌ JSON parse failed:", err);
        appendLog("❌ Failed to parse visual data JSON.");
        return;
      }

      const teachers = raw?.[0]?.teachers;
      if (!Array.isArray(teachers)) {
        console.error("❌ visualData missing or wrong shape:", raw);
        appendLog("❌ Visual data missing or in wrong shape.");
        return;
      }

      setVisualData(teachers);
    } catch (err) {
      console.error("❌ Visual Fetch Error:", err);
      appendLog("❌ Error fetching teacher visual data.");
    }
  };

  /**
   * Trigger the backend (n8n / server) to generate AI teacher analysis report.
   */
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

      // After AI report is ready, fetch visual data for graphs
      fetchVisualData();
    } catch (err) {
      console.error(err);
      appendLog("❌ Failed to generate AI teacher report.");
    } finally {
      setIsProcessingAI(false);
    }
  };

  // ======================================================
  // CHART RENDERING (ECharts)
  // ======================================================
  useEffect(() => {
    if (!visualData || visualData.length === 0) return;

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

    // ------------- RADAR CHART -------------
    if (radarChartRef.current) {
      echarts.dispose(radarChartRef.current);
      const radar = echarts.init(radarChartRef.current);

      radar.setOption({
        title: { text: "Teacher Skill Radar" },
        color: colors,
        tooltip: {},
        legend: {
          data: names,
          bottom: 0,
          type: "scroll",
          orient: "horizontal",
        },
        radar: {
          indicator: [
            { name: "Classroom", max: 5 },
            { name: "Differentiation", max: 5 },
            { name: "Social Emotional", max: 5 },
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
          lineStyle: { color: colors[i % colors.length], width: 2 },
          areaStyle: {
            opacity: 0.1,
            color: colors[i % colors.length],
          },
        })),
      });
    }

    // ------------- BAR CHART -------------
    if (barChartRef.current) {
      echarts.dispose(barChartRef.current);
      const bar = echarts.init(barChartRef.current);

      bar.setOption({
        title: { text: "Suitability Scores" },
        color: colors,
        xAxis: {
          type: "category",
          data: names,
          axisLabel: { interval: 0, rotate: 25 },
        },
        yAxis: { type: "value" },
        series: [
          {
            type: "bar",
            data: suitability,
            barWidth: "50%",
            itemStyle: {
              color: (params) =>
                colors[params.dataIndex % colors.length],
            },
          },
        ],
      });
    }

    // ------------- LINE CHART -------------
    if (lineChartRef.current) {
      echarts.dispose(lineChartRef.current);
      const line = echarts.init(lineChartRef.current);

      line.setOption({
        title: { text: "Experience Years" },
        color: colors,
        xAxis: {
          type: "category",
          data: names,
          axisLabel: { interval: 0, rotate: 25 },
        },
        yAxis: { type: "value" },
        series: [
          {
            type: "line",
            smooth: true,
            data: expYears,
            symbolSize: 10,
            lineStyle: { width: 3 },
            itemStyle: {
              color: (params) =>
                colors[params.dataIndex % colors.length],
            },
          },
        ],
      });
    }
  }, [visualData]);

  // ======================================================
  // JSX RENDER
  // ======================================================
  return (
    <>
      <Navbar onLogout={handleLogout} />

      <div className="dashboard-container">
        <h2>🎓 Kindergarten Teacher Dashboard</h2>
        <p>Use the tabs below to send updates, view status, or run AI analysis.</p>

        {/* Tabs */}
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
            🧠 Teacher Performance Analyser
          </button>
        </div>

        {/* CONTENT AREA */}
        <div className="dashboard-content">
          {/* DAILY TAB */}
          {activeTab === "daily" && (
            <div className="tab-panel">
              <h3>📆 Daily Student Reports</h3>
              <p>Send today&apos;s WhatsApp updates to all parents.</p>
              <button
                className="send-btn"
                onClick={sendDaily}
                disabled={isSending}
              >
                {isSending
                  ? "📨 Sending Daily Reports..."
                  : "🚀 Send Daily Reports"}
              </button>
            </div>
          )}

          {/* MENU TAB */}
          {activeTab === "menu" && (
            <div className="tab-panel">
              <h3>🍱 Weekly Menu</h3>
              <p>Send this week&apos;s food menu to all parents via WhatsApp.</p>
              <button
                className="send-btn"
                onClick={sendWeeklyMenu}
                disabled={isSending}
              >
                {isSending
                  ? "🍽 Sending Weekly Menu..."
                  : "📆 Send Weekly Menu"}
              </button>
            </div>
          )}

          {/* STATUS TAB */}
          {activeTab === "status" && (
            <div className="tab-panel">
              <h3>📊 Student Report Status</h3>
              <p>See which student reports have been submitted.</p>
              <button
                className="send-btn"
                style={{ background: "#8b5cf6" }}
                onClick={fetchStudentStatus}
                disabled={isSending}
              >
                📊 Check Report Status
              </button>
            </div>
          )}

          {/* AI TAB */}
          {activeTab === "ai" && (
            <div className="tab-panel">
              <h3>🧠 Teacher Performance Analyser</h3>
              <p>Run AI analysis over teacher performance and visualise results.</p>

              <button
                className="send-btn"
                style={{ background: "#ef4444" }}
                onClick={triggerN8n}
                disabled={isProcessingAI}
              >
                {isProcessingAI
                  ? "⏳ Processing AI Report..."
                  : "🚀 Generate AI Teacher Report"}
              </button>

              {/* Charts */}
              {visualData && (
                <div style={{ marginTop: "30px" }}>
                  <h3>📊 Teacher Performance Visuals</h3>
                  <div
                    ref={radarChartRef}
                    style={{
                      width: "100%",
                      height: "350px",
                      marginTop: "20px",
                    }}
                  />
                  <div
                    ref={barChartRef}
                    style={{
                      width: "100%",
                      height: "320px",
                      marginTop: "30px",
                    }}
                  />
                  <div
                    ref={lineChartRef}
                    style={{
                      width: "100%",
                      height: "320px",
                      marginTop: "30px",
                    }}
                  />
                </div>
              )}

              {/* AI Report Text */}
              {teacherReport?.output && (
                <div
                  style={REPORT_BOX_STYLE}
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdownAsHtml(teacherReport.output),
                  }}
                />
              )}
            </div>
          )}

          {/* LOGS SECTION (shared by all tabs) */}
          <div className="logs-section">
            <div className="logs-header">
              <h3>Logs</h3>
              <button className="clear-btn" onClick={clearLogs}>
                🧹 Clear Logs
              </button>
            </div>

            {logs.length === 0 ? (
              <p className="muted">
                🕒 No logs yet. Use the buttons above to start an action.
              </p>
            ) : (
              <ul className="logs-list">
                {logs.map((log, i) => {
                  let colorClass = "";
                  if (log.includes("✅")) colorClass = "green";
                  else if (log.includes("⚠️")) colorClass = "yellow";
                  else if (log.includes("❌")) colorClass = "red";

                  return (
                    <li key={i} className={`log-item ${colorClass}`}>
                      {log}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
