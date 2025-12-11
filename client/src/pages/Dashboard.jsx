<<<<<<< Updated upstream
import React, { useState } from "react";
=======
// client/src/pages/Dashboard.jsx

import React, { useState, useEffect, useRef } from "react";
>>>>>>> Stashed changes
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import * as echarts from "echarts";
import "../styles.css";

<<<<<<< Updated upstream
const Dashboard = () => {
  const [logs, setLogs] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const navigate = useNavigate();

  // --------------------------------------------------
  // FUNCTION: SEND DAILY REPORTS
  // --------------------------------------------------
  const sendMessages = () => {
    setLogs([]);
    setIsSending(true);

    const eventSource = new EventSource("http://localhost:3000/send");

    eventSource.onmessage = (event) => {
      if (event.data === "[DONE]") {
        eventSource.close();
        setIsSending(false);
        return;
      }
      setLogs((prev) => [...prev, event.data]);
    };

    eventSource.onerror = (err) => {
      console.error("❌ SSE error:", err);
      setLogs((prev) => [...prev, "❌ Connection error."]);
      setIsSending(false);
      eventSource.close();
    };
  };

  // --------------------------------------------------
  // FUNCTION: SEND WEEKLY MENU
  // --------------------------------------------------
  const sendWeeklyMenu = () => {
    setLogs([]);
    setIsSending(true);

    const eventSource = new EventSource("http://localhost:3000/send-menu");

    eventSource.onmessage = (event) => {
      if (event.data === "[DONE]") {
        eventSource.close();
        setIsSending(false);
        return;
      }
      setLogs((prev) => [...prev, event.data]);
    };

    eventSource.onerror = (err) => {
      console.error("❌ SSE error:", err);
      setLogs((prev) => [...prev, "❌ Connection error."]);
      setIsSending(false);
      eventSource.close();
=======
// Markdown → HTML
const renderMarkdownAsHtml = (markdownText) => {
    if (!markdownText) return "";
    let html = markdownText.replace(/\n/g, "<br/>");
    html = html.replace(/\*\*([^\*]+)\*\*/g, "<strong>$1</strong>");
    return html;
};

const REPORT_BOX_STYLE = {
    backgroundColor: "white",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    padding: "20px",
    marginTop: "25px",
    boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
    wordBreak: "break-word",
};

const Dashboard = () => {
    const navigate = useNavigate();

    const [logs, setLogs] = useState([]);
    const [isSending, setIsSending] = useState(false);

    const [activeTab, setActiveTab] = useState("daily");

    const [teacherReport, setTeacherReport] = useState(null);
    const [visualData, setVisualData] = useState(null);
    const [isProcessingAI, setIsProcessingAI] = useState(false);

    // Chart refs
    const radarChartRef = useRef(null);
    const barChartRef = useRef(null);
    const lineChartRef = useRef(null);

    // ---------------------------
    // DAILY REPORTS (existing)
    // ---------------------------
    const sendDaily = () => {
        setIsSending(true);
        const es = new EventSource("/send");

        es.onmessage = (e) => {
            if (e.data === "[DONE]") {
                es.close();
                setIsSending(false);
                return;
            }
            setLogs((prev) => [...prev, e.data]);
        };
    };

    // ---------------------------
    // WEEKLY MENU
    // ---------------------------
    const sendMenu = () => {
        setIsSending(true);
        const es = new EventSource("/send-menu");

        es.onmessage = (e) => {
            if (e.data === "[DONE]") {
                es.close();
                setIsSending(false);
                return;
            }
            setLogs((prev) => [...prev, e.data]);
        };
    };

    // ---------------------------
    // STUDENT STATUS
    // ---------------------------
    const fetchStatus = async () => {
        const res = await fetch("/student-status");
        const json = await res.json();
        setLogs((prev) => [...prev, "📊 Student Status:", JSON.stringify(json)]);
    };

    // ---------------------------
    // FETCH VISUAL DATA
    // ---------------------------
    const fetchVisualData = async () => {
        try {
            const response = await fetch("/api/teacher-visual");
            const rawText = await response.text();

            console.log("📩 RAW response from backend:", rawText);

            let raw;
            try {
                raw = JSON.parse(rawText);
            } catch (err) {
                console.error("❌ JSON parse failed:", err);
                return;
            }

            console.log("📊 Parsed JSON:", raw);

            const teachers = raw?.[0]?.teachers;

            if (!Array.isArray(teachers)) {
                console.error("❌ visualData missing or wrong shape:", raw);
                return;
            }

            console.log("🎯 Setting visualData:", teachers);
            setVisualData(teachers);
        } catch (err) {
            console.error("❌ Visual Fetch Error:", err);
        }
>>>>>>> Stashed changes
    };
  };

  // --------------------------------------------------
  // FUNCTION: FETCH STUDENT REPORT STATUS (SUPABASE)
  // --------------------------------------------------
  const fetchStudentStatus = async () => {
    setLogs((prev) => [...prev, "📊 Fetching student report status..."]);
    try {
      const response = await fetch("http://localhost:3000/student-status");
      const data = await response.json();

<<<<<<< Updated upstream
      if (data.message) {
        setLogs((prev) => [...prev, `✅ Status: ${data.message}`]);
      } else {
        setLogs((prev) => [...prev, "⚠️ Received empty status."]);
      }
    } catch (error) {
      console.error("Error fetching status:", error);
      setLogs((prev) => [...prev, "❌ Error fetching status from server."]);
    }
  };

  // --------------------------------------------------
  // FUNCTION: CLEAR LOGS
  // --------------------------------------------------
  const clearLogs = () => {
    setLogs([]);
  };

  // --------------------------------------------------
  // FUNCTION: LOGOUT
  // --------------------------------------------------
  const handleLogout = () => {
    localStorage.removeItem("loggedIn");
    navigate("/");
  };

  // --------------------------------------------------
  // RENDER DASHBOARD
  // --------------------------------------------------
  return (
    <div className="dashboard-container">
      <Navbar onLogout={handleLogout} />
      <div className="dashboard-content">
        <h2>🎓 Kindergarten Teacher Dashboard</h2>
        <p>Click below to send WhatsApp updates to parents.</p>

        <div className="button-section">
          <button
            className="send-btn"
            onClick={sendMessages}
            disabled={isSending}
          >
            {isSending ? "📨 Sending Daily Reports..." : "🚀 Send Daily Reports"}
          </button>

          <button
            className="send-btn"
            onClick={sendWeeklyMenu}
            disabled={isSending}
          >
            {isSending ? "🍱 Sending Weekly Menu..." : "📆 Send Weekly Menu"}
          </button>

          <button
            className="send-btn"
            style={{ background: "#8b5cf6" }} // Violet color for distinction
            onClick={fetchStudentStatus}
            disabled={isSending}
          >
            📊 Student Report Status
          </button>

          <button className="clear-btn" onClick={clearLogs}>
            🧹 Clear Logs
          </button>
=======
    useEffect(() => {
        if (teacherReport) fetchVisualData();
    }, [teacherReport]);

    // ---------------------------
    // RENDER CHARTS
    // ---------------------------
    useEffect(() => {
        if (!visualData) return;

        const names = visualData.map((t) => t.name);

        const radarScores = visualData.map((t) => [
            t.classroomManagement,
            t.differentiateInstruction,
            t.socialEmotional,
            t.numeracy,
            t.fineMotor,
            t.creativeArts
        ]);

        const suitability = visualData.map((t) => t.suitabilityScore);
        const expYears = visualData.map((t) => t.experienceYears);

        // 🎨 COLOR PALETTE (10 colors)
        const colors = [
            "#3b82f6", "#22c55e", "#ef4444", "#a855f7", "#f97316",
            "#06b6d4", "#84cc16", "#ec4899", "#6366f1", "#0ea5e9"
        ];

        // ------------------ RADAR CHART ------------------
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
                    orient: "horizontal"
                },
                radar: {
                    indicator: [
                        { name: "Classroom", max: 5 },
                        { name: "Differentiation", max: 5 },
                        { name: "Social Emotional", max: 5 },
                        { name: "Numeracy", max: 5 },
                        { name: "Fine Motor", max: 5 },
                        { name: "Creative Arts", max: 5 }
                    ]
                },
                series: radarScores.map((scores, i) => ({
                    type: "radar",
                    name: names[i],
                    data: [scores],
                    itemStyle: { color: colors[i % colors.length] },
                    lineStyle: { color: colors[i % colors.length], width: 2 },
                    areaStyle: { opacity: 0.1, color: colors[i % colors.length] }
                }))
            });
        }

        // ------------------ BAR CHART ------------------
        if (barChartRef.current) {
            echarts.dispose(barChartRef.current);
            const bar = echarts.init(barChartRef.current);

            bar.setOption({
                title: { text: "Suitability Scores" },
                color: colors,
                xAxis: {
                    type: "category",
                    data: names,
                    axisLabel: { interval: 0, rotate: 25 }
                },
                yAxis: { type: "value" },
                series: [
                    {
                        type: "bar",
                        data: suitability,
                        barWidth: "50%",
                        itemStyle: {
                            color: (params) => colors[params.dataIndex % colors.length]
                        }
                    }
                ]
            });
        }

        // ------------------ LINE CHART ------------------
        if (lineChartRef.current) {
            echarts.dispose(lineChartRef.current);
            const line = echarts.init(lineChartRef.current);

            line.setOption({
                title: { text: "Experience Years" },
                color: colors,
                xAxis: {
                    type: "category",
                    data: names,
                    axisLabel: { interval: 0, rotate: 25 }
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
                            color: (params) => colors[params.dataIndex % colors.length]
                        }
                    }
                ]
            });
        }
    }, [visualData]);

    // ---------------------------
    // AI ANALYSIS
    // ---------------------------
    const triggerN8n = async () => {
        setIsProcessingAI(true);
        setTeacherReport(null);
        setVisualData(null);

        try {
            const res = await fetch("/api/teacher-analysis-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ trigger: true }),
            });

            const json = await res.json();
            setTeacherReport(json);
        } catch (err) {
            console.error(err);
        }

        setIsProcessingAI(false);
    };

    // ---------------------------
    // UI
    // ---------------------------
    return (
        <div className="dashboard-container">
            <Navbar onLogout={() => { localStorage.removeItem("loggedIn"); navigate("/"); }} />

            <div className="dashboard-content">
                <h2>🎓 Kindergarten Teacher Dashboard</h2>
                <p>Select an option.</p>

                {/* TABS */}
                <div className="tabs">
                    <button className={`tab-btn ${activeTab === "daily" ? "active" : ""}`} onClick={() => setActiveTab("daily")}>Daily</button>
                    <button className={`tab-btn ${activeTab === "menu" ? "active" : ""}`} onClick={() => setActiveTab("menu")}>Menu</button>
                    <button className={`tab-btn ${activeTab === "status" ? "active" : ""}`} onClick={() => setActiveTab("status")}>Student Status</button>
                    <button className={`tab-btn ${activeTab === "ai" ? "active" : ""}`} onClick={() => setActiveTab("ai")}>🧠 Teacher Performance Analyser</button>
                </div>

                {/* ---------------- DAILY TAB ---------------- */}
                {activeTab === "daily" && (
                    <button className="send-btn" onClick={sendDaily}>
                        {isSending ? "Sending..." : "Send Daily Reports"}
                    </button>
                )}

                {/* ---------------- MENU TAB ---------------- */}
                {activeTab === "menu" && (
                    <button className="send-btn" onClick={sendMenu}>
                        {isSending ? "Sending..." : "Send Weekly Menu"}
                    </button>
                )}

                {/* ---------------- STATUS TAB ---------------- */}
                {activeTab === "status" && (
                    <button className="send-btn" onClick={fetchStatus}>
                        Fetch Student Status
                    </button>
                )}

                {/* ---------------- AI REPORT TAB ---------------- */}
                {activeTab === "ai" && (
                    <>
                        <button className="send-btn" style={{ background: "#EF4444" }} onClick={triggerN8n}>
                            {isProcessingAI ? "⏳ Processing..." : "🚀 Generate AI Teacher Report"}
                        </button>

                        {/* Charts */}
                        {visualData && (
                            <>
                                <h3 style={{ marginTop: "30px" }}>📊 Teacher Performance Visuals</h3>

                                <div ref={radarChartRef} style={{ width: "100%", height: "350px" }} />
                                <div ref={barChartRef} style={{ width: "100%", height: "350px", marginTop: "30px" }} />
                                <div ref={lineChartRef} style={{ width: "100%", height: "350px", marginTop: "30px" }} />
                            </>
                        )}

                        {/* AI Report */}
                        {teacherReport?.output && (
                            <div
                                style={REPORT_BOX_STYLE}
                                dangerouslySetInnerHTML={{
                                    __html: renderMarkdownAsHtml("<h3>📘 AI Teacher Report</h3><br/>" + teacherReport.output)
                                }}
                            />
                        )}
                    </>
                )}

                {/* LOG BOX FOR DAILY + STATUS */}
                <div className="log-box">
                    {logs.map((log, idx) => (
                        <p key={idx}>{log}</p>
                    ))}
                </div>
            </div>
>>>>>>> Stashed changes
        </div>

        <div className="log-box">
          {logs.length === 0 ? (
            <p className="muted">🕒 No logs yet. Click a button to start.</p>
          ) : (
            logs.map((log, i) => {
              let colorClass = "";
              if (log.includes("✅")) colorClass = "green";
              else if (log.includes("⚠️")) colorClass = "yellow";
              else if (log.includes("❌")) colorClass = "red";
              return (
                <p key={i} className={colorClass}>
                  {log}
                </p>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
