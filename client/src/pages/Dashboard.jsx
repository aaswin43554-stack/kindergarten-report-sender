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

      .dashboard-container {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0 16px 40px;
        box-sizing: border-box;
      }
      
      .dashboard-title {
        font-size: 2.5rem;
        font-weight: 800;
        margin-bottom: 0.5rem;
        background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        text-shadow: 0 2px 10px rgba(0,0,0,0.1);
        text-align: center;
      }

      .dashboard-subtitle {
        color: #64748b;
        font-size: 1.1rem;
        margin-bottom: 2rem;
        text-align: center;
        max-width: 900px;
      }

      /* Tabs */
      .tabs {
        display: flex;
        justify-content: center;
        gap: 10px;
        margin-bottom: 25px;
        flex-wrap: wrap;
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
        background: rgba(139, 92, 246, 0.18);
        color: #4c1d95;
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

      /* Buttons */
      .send-btn {
        background: #10b981;
        color: white;
        border: none;
        padding: 0.9rem 1.4rem;
        border-radius: 12px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
        margin-top: 12px;
      }

      .send-btn:hover {
        filter: brightness(0.95);
        transform: translateY(-2px);
      }

      .send-btn:disabled {
        opacity: 0.65;
        cursor: not-allowed;
        transform: none;
      }

      .load-visual-btn {
        background: #8b5cf6;
        color: white;
        border: none;
        padding: 0.8rem 1.5rem;
        border-radius: 10px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        margin-right: 0.8rem;
        margin-bottom: 0.8rem;
      }

      .load-visual-btn:hover {
        background: #7c3aed;
        transform: translateY(-2px);
      }

      .student-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        margin-top: 12px;
      }

      /* Student Charts */
      .student-charts-container {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
        gap: 2rem;
        width: 100%;
        margin-top: 1.5rem;
      }

      .student-chart {
        background: white;
        padding: 1.5rem;
        border-radius: 16px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        height: 420px;
        position: relative;
      }

      .chart-title {
        font-size: 1.1rem;
        font-weight: 800;
        color: #1e293b;
        margin-bottom: 1rem;
        text-align: center;
      }

      /* Logs */
      .logs-section {
        width: 100%;
        max-width: 1000px;
        background: rgba(30, 41, 59, 0.95);
        border-radius: 16px;
        padding: 1.5rem;
        margin-top: 1.5rem;
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

      .clear-btn {
        border: none;
        background: rgba(148, 163, 184, 0.18);
        color: #e2e8f0;
        padding: 8px 12px;
        border-radius: 10px;
        cursor: pointer;
        font-weight: 700;
      }

      .clear-btn:hover {
        background: rgba(148, 163, 184, 0.28);
      }

      .logs-list {
        list-style: none;
        padding: 0;
        margin: 0;
        max-height: 300px;
        overflow-y: auto;
        font-family: 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 0.9rem;
      }

      .log-item {
  padding: 0.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.05);

  white-space: pre-wrap;   /* ✅ shows ordered lines */
  word-break: break-word;  /* ✅ avoids overflow */
}


      .log-item.green { color: #4ade80; }
      .log-item.yellow { color: #fbbf24; }
      .log-item.red { color: #f87171; }
      .log-item.info { color: #94a3b8; }

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
        margin-top: 16px;
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

      .section-heading {
        margin-top: 10px;
        font-weight: 800;
      }

      .no-data-message {
        background: rgba(255,255,255,0.7);
        border-radius: 14px;
        padding: 16px;
        border: 1px dashed rgba(100,116,139,0.5);
        color: #334155;
      }
    `}
  </style>
);

const renderMarkdownAsHtml = (markdownText) => {
  if (!markdownText) return "";

  let text = String(markdownText).replace(/\r\n/g, "\n").trim();

  const PARA_TOKEN = "__PARA_BREAK__";
  text = text.replace(/\n{2,}/g, PARA_TOKEN);
  text = text.replace(/\n/g, " ");
  text = text.replace(new RegExp(PARA_TOKEN, "g"), "\n\n");

  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  let html = "";

  for (let p of paragraphs) {
    p = p.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    if (/^Teacher:\s*/i.test(p)) {
      const name = p.replace(/^Teacher:\s*/i, "").trim();
      html += `<div class="teacher-name">👩‍🏫 <strong>${name}</strong></div>`;
      continue;
    }

    if (/^Verdict:\s*/i.test(p)) {
      const v = p.replace(/^Verdict:\s*/i, "").trim();
      html += `<div class="teacher-verdict"><strong>Verdict: ${v}</strong></div>`;
      continue;
    }

    const headingMatch = p.match(
      /^(On Teacher Performance:|Strengths:|Weaknesses:|Guidance:|Challenges:|Final Verdict:|Final Suggested Role:|Final Suggestion:)(.*)$/i
    );
    if (headingMatch) {
      const label = headingMatch[1];
      const rest = headingMatch[2].trim();
      html += `<div class="section-heading"><strong>${label}</strong>${rest ? " " + rest : ""}</div>`;
      continue;
    }

    if (/^- /.test(p)) {
      const item = p.replace(/^- /, "").trim();
      html += `<div class="bullet">• ${item}</div>`;
      continue;
    }

    html += `<div>${p}</div>`;
  }

  return html;
};

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

  // -------------------- ECHART INSTANCES --------------------
  const radarInstanceRef = useRef(null);
  const barInstanceRef = useRef(null);
  const lineInstanceRef = useRef(null);

  // -------------------- HELPERS --------------------
  const appendLog = (msg, type = "info") => {
    const colorClass =
      {
        success: "green",
        warning: "yellow",
        error: "red",
        info: "info",
      }[type] || "info";

    setLogs((prev) => [
      ...prev,
      {
        text: typeof msg === "string" ? msg : JSON.stringify(msg),
        type: colorClass,
      },
    ]);
  };

  const clearLogs = () => setLogs([]);

  const handleLogout = () => {
    if (onLogout) onLogout();
    navigate("/");
  };

  // Resize charts on window resize
  useEffect(() => {
    const onResize = () => {
      radarInstanceRef.current?.resize?.();
      barInstanceRef.current?.resize?.();
      lineInstanceRef.current?.resize?.();

      // student charts resize
      const sr = studentRadarRef.current ? echarts.getInstanceByDom(studentRadarRef.current) : null;
      const sk = studentRiskRef.current ? echarts.getInstanceByDom(studentRiskRef.current) : null;
      sr?.resize?.();
      sk?.resize?.();
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ---------------------------------------------------------------------------
  // DAILY REPORTS (SSE)
  // ---------------------------------------------------------------------------
  const sendDaily = () => {
    setLogs([]);
    setIsSending(true);

    const es = new EventSource("/send");

    es.onmessage = (e) => {
      if (e.data === "[DONE]") {
        es.close();
        setIsSending(false);
      } else appendLog(e.data, "info");
    };

    es.onerror = () => {
      appendLog("❌ Error sending daily reports.", "error");
      es.close();
      setIsSending(false);
    };
  };

  // ---------------------------------------------------------------------------
  // WEEKLY MENU (SSE)
  // ---------------------------------------------------------------------------
  const sendWeeklyMenu = () => {
    setLogs([]);
    setIsSending(true);

    const es = new EventSource("/send-menu");

    es.onmessage = (e) => {
      if (e.data === "[DONE]") {
        es.close();
        setIsSending(false);
      } else appendLog(e.data, "info");
    };

    es.onerror = () => {
      appendLog("❌ Error sending weekly menu.", "error");
      es.close();
      setIsSending(false);
    };
  };

  // ---------------------------------------------------------------------------
  // STUDENT STATUS (TEXT / ORDERED message from backend)
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
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const json = await response.json();

      if (!json.students || !Array.isArray(json.students)) {
        appendLog("❌ Invalid data format from server.", "error");
        return;
      }

      setStudentVisual(json.students);
      appendLog(`✅ Loaded data for ${json.students.length} students.`, "success");
    } catch (err) {
      appendLog(`❌ Student visuals fetch failed: ${err.message}`, "error");
    }
  };

  // ---------------------------------------------------------------------------
  // MOCK STUDENT DATA FOR TESTING
  // ---------------------------------------------------------------------------
  const loadMockStudentData = () => {
    appendLog("📋 Loading mock student data for testing...", "warning");

    const mockStudents = [
      { name: "Emma Johnson", avgAppetite: 4.2, avgSleep: 3.8, avgBehaviour: 4.5, avgMood: 4.0, riskLevel: "Low" },
      { name: "Noah Smith", avgAppetite: 2.8, avgSleep: 3.0, avgBehaviour: 2.5, avgMood: 2.2, riskLevel: "High" },
      { name: "Olivia Davis", avgAppetite: 3.5, avgSleep: 4.0, avgBehaviour: 3.8, avgMood: 3.5, riskLevel: "Medium" },
      { name: "Liam Wilson", avgAppetite: 4.5, avgSleep: 4.2, avgBehaviour: 4.8, avgMood: 4.5, riskLevel: "Low" },
      { name: "Sophia Brown", avgAppetite: 3.0, avgSleep: 2.5, avgBehaviour: 3.2, avgMood: 2.8, riskLevel: "High" },
    ];

    setStudentVisual(mockStudents);
    appendLog("✅ Mock student data loaded successfully.", "success");
  };

  // ---------------------------------------------------------------------------
  // TEACHER VISUAL DATA
  // ---------------------------------------------------------------------------
  const fetchVisualData = async () => {
  appendLog("📊 Loading teacher visual analytics...", "info");

  try {
    const res = await fetch("/api/teacher-visual");
    const json = await res.json();

    let teachers = [];

    // ✅ preferred format from backend: { teachers: [...] }
    if (Array.isArray(json?.teachers)) {
      teachers = json.teachers;
    }
    // fallback if backend returns array wrapper
    else if (Array.isArray(json)) {
      // if it’s like [{ teachers:[...] }, { teachers:[...] }]
      json.forEach((item) => {
        if (Array.isArray(item?.teachers)) teachers.push(...item.teachers);
      });

      // or array of teacher objects directly
      if (teachers.length === 0 && json.length && json[0]?.name) {
        teachers = json;
      }
    }

    if (!teachers.length) {
      appendLog("❌ Teacher visual data missing / wrong format.", "error");
      return;
    }

    appendLog(`✅ Teacher visuals loaded for ${teachers.length} teachers.`, "success");
    setVisualData(teachers); // ✅ will now have all 10
  } catch (err) {
    appendLog(`❌ Error loading teacher visuals: ${err.message}`, "error");
  }
};

  // ---------------------------------------------------------------------------
  // AI TEACHER REPORT (n8n)
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

      // load visuals after report
      fetchVisualData();
    } catch {
      appendLog("❌ AI report failed.", "error");
    }

    setIsProcessingAI(false);
  };

  // ---------------------------------------------------------------------------
  // TEACHER ECHARTS (Radar + Bar + Line)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!visualData || !Array.isArray(visualData) || visualData.length === 0) return;

    const colors = [
      "#3b82f6", "#22c55e", "#ef4444", "#a855f7", "#f97316",
      "#06b6d4", "#84cc16", "#ec4899", "#6366f1", "#0ea5e9"
    ];

    const names = visualData.map((t) => t.name || "Teacher");
    const radarScores = visualData.map((t) => ([
      Number(t.classroomManagement ?? 0),
      Number(t.differentiateInstruction ?? 0),
      Number(t.socialEmotional ?? 0),
      Number(t.numeracy ?? 0),
      Number(t.fineMotor ?? 0),
      Number(t.creativeArts ?? 0),
    ]));

    const suitability = visualData.map((t) => Number(t.suitabilityScore ?? 0));
    const expYears = visualData.map((t) => Number(t.experienceYears ?? 0));

    // Radar
    if (radarChartRef.current) {
      echarts.dispose(radarChartRef.current);
      const chart = echarts.init(radarChartRef.current);
      radarInstanceRef.current = chart;

      chart.setOption({
        title: { text: "Teacher Skill Radar", left: "center" },
        tooltip: { trigger: "item" },

        legend: {
          top: "middle",
          right: 10,
          orient: "vertical",
          type: "scroll",
          height: "80%",
          itemGap: 10,
          textStyle: { fontSize: 12 },
          data: names,
        },

        radar: {
          radius: "48%",
          center: ["38%", "50%"],
          name: { fontSize: 12, color: "#333" },
          nameGap: 18,
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
          lineStyle: { width: 2, color: colors[i % colors.length] },
          itemStyle: { color: colors[i % colors.length] },
          areaStyle: { opacity: 0.12, color: colors[i % colors.length] },
        })),
      });
    }

    // Bar
    if (barChartRef.current) {
      echarts.dispose(barChartRef.current);
      const chart = echarts.init(barChartRef.current);
      barInstanceRef.current = chart;

      chart.setOption({
        title: { text: "Suitability Scores", left: "center" },
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          formatter: (params) => {
            const p = params[0];
            return `${p.axisValue}<br/>Suitability Score: <b>${p.data}</b>`;
          },
        },
        grid: { left: 50, right: 30, top: 80, bottom: 140, containLabel: true },
        xAxis: {
          type: "category",
          data: names,
          axisTick: { alignWithLabel: true },
          axisLabel: { interval: 0, rotate: 40, hideOverlap: false },
        },
        yAxis: { type: "value" },
        series: [
          {
            type: "bar",
            data: suitability,
            barWidth: "55%",
            itemStyle: {
              color: (p) => colors[p.dataIndex % colors.length],
              borderRadius: [6, 6, 0, 0],
            },
          },
        ],
      });
    }

    // Line
    if (lineChartRef.current) {
      echarts.dispose(lineChartRef.current);
      const chart = echarts.init(lineChartRef.current);
      lineInstanceRef.current = chart;

      chart.setOption({
        title: { text: "Experience Years", left: "center" },
        tooltip: {
          trigger: "axis",
          formatter: (params) => {
            const p = params[0];
            return `${p.axisValue}<br/>Experience: <b>${p.data}</b> years`;
          },
        },
        grid: { left: 50, right: 30, top: 80, bottom: 140, containLabel: true },
        xAxis: {
          type: "category",
          data: names,
          axisLabel: { interval: 0, rotate: 40, hideOverlap: false },
        },
        yAxis: { type: "value" },
        series: [
          {
            type: "line",
            smooth: true,
            data: expYears,
            symbolSize: 9,
            lineStyle: { width: 3 },
          },
        ],
      });
    }

    setTimeout(() => {
      radarInstanceRef.current?.resize?.();
      barInstanceRef.current?.resize?.();
      lineInstanceRef.current?.resize?.();
    }, 50);
  }, [visualData]);

  // ---------------------------------------------------------------------------
  // STUDENT ECHARTS (Radar + Risk)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!studentVisual || !studentRadarRef.current || studentVisual.length === 0) return;

    // Dispose old
    const old = echarts.getInstanceByDom(studentRadarRef.current);
    if (old) echarts.dispose(old);

    const chart = echarts.init(studentRadarRef.current);
    const names = studentVisual.map((s) => s.name);

    const colors = [
      "#3b82f6", "#22c55e", "#ef4444", "#a855f7", "#f97316",
      "#06b6d4", "#84cc16", "#ec4899", "#6366f1", "#0ea5e9"
    ];

    chart.setOption({
      title: { show: false },
      legend: { bottom: 10, type: "scroll", data: names, textStyle: { fontSize: 12 } },
      tooltip: {
        trigger: "item",
        formatter: (params) => {
          const student = studentVisual[params.seriesIndex];
          return `
            <strong>${student.name}</strong><br/>
            Appetite: ${Number(student.avgAppetite).toFixed(1)}/5<br/>
            Sleep: ${Number(student.avgSleep).toFixed(1)}/5<br/>
            Behaviour: ${Number(student.avgBehaviour).toFixed(1)}/5<br/>
            Mood: ${Number(student.avgMood).toFixed(1)}/5
          `;
        },
      },
      radar: {
        center: ["50%", "50%"],
        radius: "65%",
        indicator: [
          { name: "Appetite", max: 5 },
          { name: "Sleep", max: 5 },
          { name: "Behaviour", max: 5 },
          { name: "Mood", max: 5 },
        ],
      },
      series: studentVisual.map((student, index) => ({
        type: "radar",
        name: student.name,
        data: [[
          Number(student.avgAppetite) || 0,
          Number(student.avgSleep) || 0,
          Number(student.avgBehaviour) || 0,
          Number(student.avgMood) || 0,
        ]],
        symbol: "circle",
        symbolSize: 7,
        itemStyle: { color: colors[index % colors.length] },
        lineStyle: { width: 2, color: colors[index % colors.length] },
        areaStyle: { opacity: 0.1, color: colors[index % colors.length] },
      })),
    });

    return () => chart.dispose();
  }, [studentVisual]);

  useEffect(() => {
    if (!studentVisual || !studentRiskRef.current || studentVisual.length === 0) return;

    const old = echarts.getInstanceByDom(studentRiskRef.current);
    if (old) echarts.dispose(old);

    const chart = echarts.init(studentRiskRef.current);
    const names = studentVisual.map((s) => s.name);

    const highRiskData = [];
    const mediumRiskData = [];
    const lowRiskData = [];

    studentVisual.forEach((student) => {
      const r = String(student.riskLevel || "").toLowerCase();
      if (r === "high") {
        highRiskData.push(1); mediumRiskData.push(0); lowRiskData.push(0);
      } else if (r === "medium") {
        highRiskData.push(0); mediumRiskData.push(1); lowRiskData.push(0);
      } else {
        highRiskData.push(0); mediumRiskData.push(0); lowRiskData.push(1);
      }
    });

    chart.setOption({
      title: { text: "Student Risk Levels", left: "center", textStyle: { fontSize: 18, fontWeight: "bold" } },
      legend: { bottom: 10, data: ["High Risk", "Medium Risk", "Low Risk"], textStyle: { fontSize: 12 } },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const index = params[0].dataIndex;
          const student = studentVisual[index];
          const risk = student?.riskLevel || "Low";
          return `<strong>${student.name}</strong><br/>Risk Level: <strong>${risk}</strong>`;
        },
      },
      grid: { left: "3%", right: "4%", bottom: "15%", top: "15%", containLabel: true },
      xAxis: { type: "category", data: names, axisLabel: { interval: 0, rotate: 30, fontSize: 12, margin: 10 } },
      yAxis: { type: "value", min: 0, max: 1, axisLabel: { formatter: (v) => (v === 1 ? "✓" : "") } },
      series: [
        { name: "High Risk", type: "bar", stack: "total", data: highRiskData, barWidth: "60%" },
        { name: "Medium Risk", type: "bar", stack: "total", data: mediumRiskData, barWidth: "60%" },
        { name: "Low Risk", type: "bar", stack: "total", data: lowRiskData, barWidth: "60%" },
      ],
    });

    return () => chart.dispose();
  }, [studentVisual]);

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------
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

          {/* DAILY */}
          {activeTab === "daily" && (
            <div className="tab-panel">
              <h3>📨 Daily Reports</h3>
              <button className="send-btn" onClick={sendDaily} disabled={isSending}>
                {isSending ? "Sending..." : "🚀 Send Daily Reports"}
              </button>
            </div>
          )}

          {/* MENU */}
          {activeTab === "menu" && (
            <div className="tab-panel">
              <h3>🍽️ Weekly Menu</h3>
              <button className="send-btn" onClick={sendWeeklyMenu} disabled={isSending}>
                {isSending ? "Sending..." : "📤 Send Weekly Menu"}
              </button>
            </div>
          )}

          {/* STUDENT STATUS */}
          {activeTab === "status" && (
            <div className="tab-panel">
              <h3>📊 Student Status & Analytics</h3>

              <div className="student-actions">
                <button className="load-visual-btn" onClick={fetchStudentVisual}>
                  📊 Load Student Analytics
                </button>

                <button
                  className="load-visual-btn"
                  onClick={loadMockStudentData}
                  style={{ background: "#6b7280" }}
                >
                  🧪 Load Mock Data
                </button>

                <button
                  className="load-visual-btn"
                  onClick={fetchStudentStatus}
                  style={{ background: "#10b981" }}
                >
                  📄 Check Status (Text)
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
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      background: "white",
                      padding: "20px",
                      borderRadius: "12px",
                      marginTop: "10px",
                      overflowX: "auto",
                      boxShadow: "0 4px 10px rgba(0,0,0,0.06)",
                    }}
                  >
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
                            <td style={{ padding: "12px" }}>{Number(student.avgAppetite).toFixed(1)}</td>
                            <td style={{ padding: "12px" }}>{Number(student.avgSleep).toFixed(1)}</td>
                            <td style={{ padding: "12px" }}>{Number(student.avgBehaviour).toFixed(1)}</td>
                            <td style={{ padding: "12px" }}>{Number(student.avgMood).toFixed(1)}</td>
                            <td style={{ padding: "12px" }}>
                              <span
                                style={{
                                  padding: "4px 12px",
                                  borderRadius: "20px",
                                  color: "white",
                                  fontSize: "0.85rem",
                                  background:
                                    student.riskLevel === "High"
                                      ? "#ef4444"
                                      : student.riskLevel === "Medium"
                                      ? "#f59e0b"
                                      : "#10b981",
                                }}
                              >
                                {student.riskLevel}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="no-data-message">
                  <p><strong>No student data loaded yet.</strong></p>
                  <p>Click “Load Student Analytics” or “Load Mock Data”.</p>
                </div>
              )}
            </div>
          )}

          {/* TEACHER AI */}
          {activeTab === "ai" && (
            <div className="tab-panel">
              <h3>🧠 Teacher Performance</h3>
              <p>Generate AI insights and visual analytics for each teacher.</p>

              <button
                className="send-btn"
                style={{ background: "#ef4444" }}
                onClick={triggerN8n}
                disabled={isProcessingAI}
              >
                {isProcessingAI ? "⏳ Processing..." : "🚀 Generate AI Report"}
              </button>

              {Array.isArray(visualData) && visualData.length > 0 && (
                <>
                  <div ref={radarChartRef} style={{ height: 560, marginTop: 30 }} />
                  <div ref={barChartRef} style={{ height: 480, marginTop: 40 }} />
                  <div ref={lineChartRef} style={{ height: 480, marginTop: 40 }} />
                </>
              )}

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
              <button className="clear-btn" onClick={clearLogs}>
                🧹 Clear Logs
              </button>
            </div>

            {logs.length === 0 ? (
              <p style={{ color: "#94a3b8", fontStyle: "italic" }}>No logs yet.</p>
            ) : (
              <ul className="logs-list">
                {logs.map((log, i) => (
                  <li key={i} className={`log-item ${log.type || "info"}`}>
                    {log.text}
                  </li>
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
