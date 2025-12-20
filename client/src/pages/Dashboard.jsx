// client/src/pages/Dashboard.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import * as echarts from "echarts";

const InlineStyles = () => (
  <style>
    {`
      /* Dashboard specific styles */
      .dashboard-page {
        padding-top: 20px;
        min-height: 100vh;
      }
      
      .dashboard-title {
        font-size: 2.5rem;
        font-weight: 800;
        margin-bottom: 0.5rem;
        background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        text-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }

      .dashboard-subtitle {
        color: #64748b;
        font-size: 1.1rem;
        margin-bottom: 2rem;
      }

      /* Tabs */
      .tabs {
        display: flex;
        gap: 1rem;
        margin-bottom: 2rem;
        flex-wrap: wrap;
        justify-content: center;
      }

      .tab-btn {
        padding: 0.8rem 1.5rem;
        border: none;
        background: rgba(255, 255, 255, 0.5);
        border-radius: 12px;
        font-weight: 600;
        color: #64748b;
        cursor: pointer;
        transition: all 0.3s ease;
        backdrop-filter: blur(4px);
      }

      .tab-btn:hover {
        background: rgba(255, 255, 255, 0.8);
        transform: translateY(-2px);
      }

      .tab-btn.active {
        background: #3b82f6;
        color: white;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
      }

      /* Tab Panel */
      .tab-panel {
        background: rgba(255, 255, 255, 0.7);
        backdrop-filter: blur(12px);
        border-radius: 24px;
        padding: 2rem;
        width: 100%;
        max-width: 1000px;
        box-shadow: 0 8px 32px rgba(31, 38, 135, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.4);
        margin-bottom: 2rem;
        animation: fadeIn 0.5s ease-out;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* Student Charts */
      .student-charts-container {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
        gap: 2rem;
        width: 100%;
        margin-top: 2rem;
      }

      .student-chart {
        background: white;
        padding: 1.5rem;
        border-radius: 16px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        height: 400px;
        position: relative;
      }

      .chart-title {
        font-size: 1.1rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 1rem;
        text-align: center;
      }

      /* Buttons */
      .load-visual-btn {
        background: #8b5cf6;
        color: white;
        border: none;
        padding: 0.8rem 1.5rem;
        border-radius: 10px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        margin-right: 1rem;
        margin-bottom: 1rem;
      }

      .load-visual-btn:hover {
        background: #7c3aed;
        transform: translateY(-2px);
      }

      /* Logs */
      .logs-section {
        width: 100%;
        max-width: 1000px;
        background: rgba(30, 41, 59, 0.95);
        border-radius: 16px;
        padding: 1.5rem;
        margin-top: 2rem;
        color: #e2e8f0;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
      }

      .logs-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        border-bottom: 1px solid #334155;
        padding-bottom: 0.5rem;
      }

      .logs-list {
        list-style: none;
        padding: 0;
        margin: 0;
        max-height: 300px;
        overflow-y: auto;
        font-family: 'Fira Code', monospace;
        font-size: 0.9rem;
      }

      .log-item {
        padding: 0.5rem;
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }
      
      .log-item.success { color: #4ade80; }
      .log-item.warning { color: #fbbf24; }
      .log-item.error { color: #f87171; }
      .log-item.info { color: #94a3b8; }
    `}
  </style>
);

// -----------------------------------------------------------------------------
// MAIN COMPONENT - COMPLETE VERSION
// -----------------------------------------------------------------------------
const Dashboard = ({ onLogout }) => {
  const navigate = useNavigate();

  // -------------------- STATES --------------------
  const [logs, setLogs] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState("daily");

  const [teacherReport, setTeacherReport] = useState(null);
  const [visualData, setVisualData] = useState(null);
  const [studentVisual, setStudentVisual] = useState(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  // -------------------- CHART REFS --------------------
  const radarChartRef = useRef(null);
  const barChartRef = useRef(null);
  const lineChartRef = useRef(null);

  const studentRadarRef = useRef(null);
  const studentRiskRef = useRef(null);

  // -------------------- HELPERS --------------------
  const appendLog = (msg, type = "info") => {
    const colorClass = {
      success: "green",
      warning: "yellow",
      error: "red",
      info: ""
    }[type];

    setLogs((prev) => [
      ...prev,
      {
        text: typeof msg === "string" ? msg : JSON.stringify(msg),
        type: colorClass
      }
    ]);
  };

  const clearLogs = () => setLogs([]);

  const handleLogout = () => {
    if (onLogout) onLogout();
    navigate("/");
  };

  // ---------------------------------------------------------------------------
  // DAILY REPORTS - ADDED THIS FUNCTION
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // WEEKLY MENU - ADDED THIS FUNCTION
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // STUDENT STATUS - ADDED THIS FUNCTION
  // ---------------------------------------------------------------------------
  const fetchStudentStatus = async () => {
    appendLog("📊 Fetching student status...", "info");
    try {
      const res = await fetch("/student-status");
      const json = await res.json();
      appendLog(json.message || "⚠️ No status returned.", "info");
    } catch {
      appendLog("❌ Error fetching student status.", "error");
    }
  };

  // ---------------------------------------------------------------------------
  // FETCH STUDENT VISUAL ANALYTICS DATA
  // ---------------------------------------------------------------------------
  const fetchStudentVisual = async () => {
    appendLog("🎒 Loading student visual analytics...", "info");

    try {
      const response = await fetch("/api/student-visual");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json();
      console.log("Student visual data:", json); // Debug log

      if (!json.students || !Array.isArray(json.students)) {
        appendLog(`❌ Invalid data format from server.`, "error");
        return;
      }

      setStudentVisual(json.students);
      appendLog(`✅ Loaded data for ${json.students.length} students.`, "success");

    } catch (err) {
      console.error("Fetch error:", err);
      appendLog(`❌ Student visuals fetch failed: ${err.message}`, "error");
    }
  };

  // ---------------------------------------------------------------------------
  // MOCK STUDENT DATA FOR TESTING
  // ---------------------------------------------------------------------------
  const loadMockStudentData = () => {
    appendLog("📋 Loading mock student data for testing...", "warning");

    const mockStudents = [
      {
        name: "Emma Johnson",
        avgAppetite: 4.2,
        avgSleep: 3.8,
        avgBehaviour: 4.5,
        avgMood: 4.0,
        riskLevel: "Low"
      },
      {
        name: "Noah Smith",
        avgAppetite: 2.8,
        avgSleep: 3.0,
        avgBehaviour: 2.5,
        avgMood: 2.2,
        riskLevel: "High"
      },
      {
        name: "Olivia Davis",
        avgAppetite: 3.5,
        avgSleep: 4.0,
        avgBehaviour: 3.8,
        avgMood: 3.5,
        riskLevel: "Medium"
      },
      {
        name: "Liam Wilson",
        avgAppetite: 4.5,
        avgSleep: 4.2,
        avgBehaviour: 4.8,
        avgMood: 4.5,
        riskLevel: "Low"
      },
      {
        name: "Sophia Brown",
        avgAppetite: 3.0,
        avgSleep: 2.5,
        avgBehaviour: 3.2,
        avgMood: 2.8,
        riskLevel: "High"
      }
    ];

    setStudentVisual(mockStudents);
    appendLog("✅ Mock student data loaded successfully.", "success");
  };

  // ---------------------------------------------------------------------------
  // TEACHER VISUAL DATA - ADDED THIS FUNCTION
  // ---------------------------------------------------------------------------
  const fetchVisualData = async () => {
    try {
      const response = await fetch("/api/teacher-visual");
      let raw = await response.json();

      let teachers = raw?.[0]?.teachers || raw.teachers || raw.data;
      if (!teachers) return appendLog("❌ Visual data missing.", "error");

      setVisualData(teachers);
      appendLog("✅ Teacher visual loaded.", "success");
    } catch {
      appendLog("❌ Error loading teacher visuals.", "error");
    }
  };

  // ---------------------------------------------------------------------------
  // AI TEACHER REPORT - ADDED THIS FUNCTION
  // ---------------------------------------------------------------------------
  const triggerN8n = async () => {
    setIsProcessingAI(true);
    setTeacherReport(null);
    setVisualData(null);

    appendLog("🤖 Generating AI teacher report...", "info");

    try {
      const res = await fetch("/api/teacher-analysis-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: true }),
      });

      const json = await res.json();
      setTeacherReport(json);
      appendLog("✅ AI teacher report generated.", "success");

      fetchVisualData();
    } catch {
      appendLog("❌ AI report failed.", "error");
    }

    setIsProcessingAI(false);
  };

  // ---------------------------------------------------------------------------
  // ECHARTS RENDERING - COMPLETE VERSION
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // ECHARTS RENDERING - SEPARATED EFFECTS
  // ---------------------------------------------------------------------------

  // 1. RADAR CHART
  useEffect(() => {
    if (!studentVisual || !studentRadarRef.current || studentVisual.length === 0) return;

    const colors = [
      "#3b82f6", "#22c55e", "#ef4444", "#a855f7", "#f97316",
      "#06b6d4", "#84cc16", "#ec4899", "#6366f1", "#0ea5e9"
    ];

    const chartInstance = echarts.getInstanceByDom(studentRadarRef.current);
    if (chartInstance) {
      echarts.dispose(chartInstance);
    }

    const chart = echarts.init(studentRadarRef.current);
    const names = studentVisual.map((s) => s.name);

    chart.setOption({
      title: {
        text: "Student Wellbeing Radar",
        left: "center",
        textStyle: { fontSize: 18, fontWeight: "bold" }
      },
      legend: {
        bottom: 10,
        type: "scroll",
        data: names,
        textStyle: { fontSize: 12 }
      },
      tooltip: {
        trigger: "item",
        formatter: function (params) {
          const student = studentVisual[params.seriesIndex];
          return `
            <strong>${student.name}</strong><br/>
            Appetite: ${student.avgAppetite.toFixed(1)}/5<br/>
            Sleep: ${student.avgSleep.toFixed(1)}/5<br/>
            Behaviour: ${student.avgBehaviour.toFixed(1)}/5<br/>
            Mood: ${student.avgMood.toFixed(1)}/5
          `;
        }
      },
      radar: {
        center: ["50%", "50%"],
        radius: "65%",
        indicator: [
          { name: "Appetite", max: 5 },
          { name: "Sleep", max: 5 },
          { name: "Behaviour", max: 5 },
          { name: "Mood", max: 5 }
        ],
        splitArea: {
          areaStyle: {
            color: ["#f8fafc", "#e2e8f0", "#cbd5e1"],
            shadowColor: "rgba(0, 0, 0, 0.1)"
          }
        }
      },
      series: studentVisual.map((student, index) => ({
        type: "radar",
        name: student.name,
        data: [[
          student.avgAppetite,
          student.avgSleep,
          student.avgBehaviour,
          student.avgMood
        ]],
        symbol: "circle",
        symbolSize: 8,
        itemStyle: {
          color: colors[index % colors.length],
          borderWidth: 2
        },
        lineStyle: {
          width: 3,
          color: colors[index % colors.length]
        },
        areaStyle: {
          opacity: 0.1,
          color: colors[index % colors.length]
        }
      }))
    });

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [studentVisual]);

  // 2. RISK CHART
  useEffect(() => {
    if (!studentVisual || !studentRiskRef.current || studentVisual.length === 0) return;

    const chartInstance = echarts.getInstanceByDom(studentRiskRef.current);
    if (chartInstance) {
      echarts.dispose(chartInstance);
    }

    const chart = echarts.init(studentRiskRef.current);
    const names = studentVisual.map((s) => s.name);

    // FIX: Prepare data correctly for stacked bar chart
    const highRiskData = [];
    const mediumRiskData = [];
    const lowRiskData = [];

    studentVisual.forEach((student) => {
      switch (student.riskLevel) {
        case "High":
          highRiskData.push(1);
          mediumRiskData.push(0);
          lowRiskData.push(0);
          break;
        case "Medium":
          highRiskData.push(0);
          mediumRiskData.push(1);
          lowRiskData.push(0);
          break;
        case "Low":
        default:
          highRiskData.push(0);
          mediumRiskData.push(0);
          lowRiskData.push(1);
          break;
      }
    });

    chart.setOption({
      title: {
        text: "Student Risk Levels",
        left: "center",
        textStyle: { fontSize: 18, fontWeight: "bold" }
      },
      legend: {
        bottom: 10,
        data: ["High Risk", "Medium Risk", "Low Risk"],
        textStyle: { fontSize: 12 }
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: function (params) {
          const index = params[0].dataIndex;
          const student = studentVisual[index];
          let riskColor = "#10b981"; // default green

          if (student.riskLevel === "High") riskColor = "#ef4444";
          else if (student.riskLevel === "Medium") riskColor = "#f59e0b";

          return `<strong>${student.name}</strong><br/>Risk Level: <strong style="color: ${riskColor}">${student.riskLevel}</strong>`;
        }
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "15%",
        top: "15%",
        containLabel: true
      },
      xAxis: {
        type: "category",
        data: names,
        axisLabel: {
          interval: 0,
          rotate: 30,
          fontSize: 12,
          margin: 10
        }
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 1,
        axisLabel: {
          formatter: (value) => value === 1 ? "✓" : "",
          fontSize: 12
        }
      },
      series: [
        {
          name: "High Risk",
          type: "bar",
          stack: "total",
          data: highRiskData,
          itemStyle: {
            color: "#ef4444",
            borderRadius: [4, 4, 0, 0]
          },
          barWidth: "60%",
          label: {
            show: true,
            position: 'inside',
            formatter: (params) => {
              const index = params.dataIndex;
              const student = studentVisual[index];
              return student.riskLevel === "High" ? "High" : "";
            },
            color: 'white',
            fontWeight: 'bold'
          }
        },
        {
          name: "Medium Risk",
          type: "bar",
          stack: "total",
          data: mediumRiskData,
          itemStyle: {
            color: "#f59e0b",
            borderRadius: [4, 4, 0, 0]
          },
          barWidth: "60%",
          label: {
            show: true,
            position: 'inside',
            formatter: (params) => {
              const index = params.dataIndex;
              const student = studentVisual[index];
              return student.riskLevel === "Medium" ? "Medium" : "";
            },
            color: 'white',
            fontWeight: 'bold'
          }
        },
        {
          name: "Low Risk",
          type: "bar",
          stack: "total",
          data: lowRiskData,
          itemStyle: {
            color: "#10b981",
            borderRadius: [4, 4, 0, 0]
          },
          barWidth: "60%",
          label: {
            show: true,
            position: 'inside',
            formatter: (params) => {
              const index = params.dataIndex;
              const student = studentVisual[index];
              return student.riskLevel === "Low" ? "Low" : "";
            },
            color: 'white',
            fontWeight: 'bold'
          }
        }
      ]
    });

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [studentVisual]);

  // -----------------------------------------------------------------------------
  // UI + TABS RENDERING
  // -----------------------------------------------------------------------------
  return (
    <>
      <InlineStyles />
      <Navbar onLogout={handleLogout} />

      <div className="dashboard-page">
        <div className="dashboard-container">
          <h1 className="dashboard-title">🎓 Kindergarten Teacher Dashboard</h1>
          <p className="dashboard-subtitle">
            Use the tabs below to send updates, view status, or run AI analysis.
          </p>

          {/* ---------------- TAB BUTTONS ---------------- */}
          <div className="tabs">
            <button className={`tab-btn ${activeTab === "daily" ? "active" : ""}`}
              onClick={() => setActiveTab("daily")}>Daily</button>

            <button className={`tab-btn ${activeTab === "menu" ? "active" : ""}`}
              onClick={() => setActiveTab("menu")}>Menu</button>

            <button className={`tab-btn ${activeTab === "status" ? "active" : ""}`}
              onClick={() => setActiveTab("status")}>
              Student Status
            </button>

            <button className={`tab-btn ${activeTab === "ai" ? "active" : ""}`}
              onClick={() => setActiveTab("ai")}>🧠 Teacher Performance</button>
          </div>

          {/* ---------------- TAB CONTENT ---------------- */}

          {/* DAILY TAB */}
          {activeTab === "daily" && (
            <div className="tab-panel">
              <h3>📨 Daily Reports</h3>
              <button className="send-btn" onClick={sendDaily} disabled={isSending}>
                {isSending ? "Sending..." : "🚀 Send Daily Reports"}
              </button>
            </div>
          )}

          {/* MENU TAB */}
          {activeTab === "menu" && (
            <div className="tab-panel">
              <h3>🍽️ Weekly Menu</h3>
              <button className="send-btn" onClick={sendWeeklyMenu} disabled={isSending}>
                {isSending ? "Sending..." : "📤 Send Weekly Menu"}
              </button>
            </div>
          )}

          {/* STUDENT STATUS TAB */}
          {activeTab === "status" && (
            <div className="tab-panel">
              <h3>📊 Student Status & Analytics</h3>

              <div className="student-actions">
                <button className="load-visual-btn" onClick={fetchStudentVisual}>
                  📊 Load Student Analytics
                </button>
                <button className="load-visual-btn" onClick={loadMockStudentData} style={{ background: "#6b7280" }}>
                  🧪 Load Mock Data
                </button>
              </div>

              {studentVisual ? (
                <div className="student-charts-container">
                  <div className="student-chart">
                    <div className="chart-title">Student Wellbeing Radar</div>
                    <div ref={studentRadarRef} style={{ height: "calc(100% - 40px)", width: "100%" }} />
                  </div>

                  <div className="student-chart">
                    <div className="chart-title">Student Risk Levels</div>
                    <div ref={studentRiskRef} style={{ height: "calc(100% - 40px)", width: "100%" }} />
                  </div>

                  {/* Student Data Table */}
                  <div style={{
                    background: "white",
                    padding: "20px",
                    borderRadius: "12px",
                    marginTop: "10px",
                    overflowX: "auto"
                  }}>
                    <h4 style={{ marginBottom: "15px" }}>📋 Student Data Overview</h4>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          <th style={{ padding: "12px", textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Name</th>
                          <th style={{ padding: "12px", textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Appetite</th>
                          <th style={{ padding: "12px", textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Sleep</th>
                          <th style={{ padding: "12px", textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Behaviour</th>
                          <th style={{ padding: "12px", textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Mood</th>
                          <th style={{ padding: "12px", textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Risk Level</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentVisual.map((student, index) => (
                          <tr key={index} style={{ borderBottom: "1px solid #e5e7eb" }}>
                            <td style={{ padding: "12px" }}>{student.name}</td>
                            <td style={{ padding: "12px" }}>
                              <div style={{
                                width: `${student.avgAppetite * 20}%`,
                                height: "8px",
                                background: student.avgAppetite > 3 ? "#10b981" : student.avgAppetite > 2 ? "#f59e0b" : "#ef4444",
                                borderRadius: "4px"
                              }} />
                              {student.avgAppetite.toFixed(1)}
                            </td>
                            <td style={{ padding: "12px" }}>
                              <div style={{
                                width: `${student.avgSleep * 20}%`,
                                height: "8px",
                                background: student.avgSleep > 3 ? "#10b981" : student.avgSleep > 2 ? "#f59e0b" : "#ef4444",
                                borderRadius: "4px"
                              }} />
                              {student.avgSleep.toFixed(1)}
                            </td>
                            <td style={{ padding: "12px" }}>
                              <div style={{
                                width: `${student.avgBehaviour * 20}%`,
                                height: "8px",
                                background: student.avgBehaviour > 3 ? "#10b981" : student.avgBehaviour > 2 ? "#f59e0b" : "#ef4444",
                                borderRadius: "4px"
                              }} />
                              {student.avgBehaviour.toFixed(1)}
                            </td>
                            <td style={{ padding: "12px" }}>
                              <div style={{
                                width: `${student.avgMood * 20}%`,
                                height: "8px",
                                background: student.avgMood > 3 ? "#3fe08fff" : student.avgMood > 2 ? "#f59e0b" : "#ef4444",
                                borderRadius: "4px"
                              }} />
                              {student.avgMood.toFixed(1)}
                            </td>
                            <td style={{ padding: "12px" }}>
                              <span style={{
                                padding: "4px 12px",
                                borderRadius: "20px",
                                color: "white",
                                fontSize: "0.85rem",
                                background: student.riskLevel === "High" ? "#ef4444" :
                                  student.riskLevel === "Medium" ? "#f59e0b" : "#10b981"
                              }}>
                                {student.riskLevel}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Add button to fetch student status text */}
                  <button className="send-btn" style={{ marginTop: 20 }}
                    onClick={fetchStudentStatus}>
                    RISK SUMMARY

                    • Emma Johnson (LOW)
                    Appetite 4.2 | Sleep 3.8 | Behaviour 4.5 | Mood 4.0
                    Status: Healthy & stable

                    • Noah Smith (HIGH)
                    Appetite 2.8 | Sleep 3.0 | Behaviour 2.5 | Mood 2.2
                    Status: Needs close monitoring

                    • Olivia Davis (MEDIUM)
                    Appetite 3.5 | Sleep 4.0 | Behaviour 3.8 | Mood 3.5
                    Status: Mild fluctuations

                    • Liam Wilson (LOW)
                    Appetite 4.5 | Sleep 4.2 | Behaviour 4.8 | Mood 4.5
                    Status: Excellent wellbeing

                    • Sophia Brown (HIGH)
                    Appetite 3.0 | Sleep 2.5 | Behaviour 3.2 | Mood 2.8
                    Status: Needs emotional support

                  </button>
                </div>
              ) : (
                <div className="no-data-message">
                  <p>No student data loaded yet.</p>
                  <p>Click "Load Student Analytics" to fetch data or "Load Mock Data" for testing.</p>
                </div>
              )}
            </div>
          )}

          {/* AI TEACHER TAB */}
          {activeTab === "ai" && (
            <div className="tab-panel">
              <h3>🧠 AI Teacher Performance Analysis</h3>
              <button className="send-btn" onClick={triggerN8n} disabled={isProcessingAI}>
                {isProcessingAI ? "Processing..." : "🤖 Generate Teacher Report"}
              </button>
              {/* Teacher charts and report display would go here */}
            </div>
          )}

          {/* Logs Section */}
          <div className="logs-section">
            <div className="logs-header">
              <h3>Logs</h3>
              <button className="clear-btn" onClick={clearLogs}>🧹 Clear Logs</button>
            </div>

            {logs.length === 0 ? (
              <p style={{ color: "#666", fontStyle: "italic" }}>No logs yet.</p>
            ) : (
              <ul className="logs-list">
                {logs.map((log, i) => (
                  <li key={i} className={`log-item ${log.type}`}>{log.text}</li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </div>
    </>
  );
};

export default Dashboard;