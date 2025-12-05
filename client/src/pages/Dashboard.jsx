// client/src/pages/Dashboard.jsx

import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import "../styles.css";

// ----------------------------------------------------------------------
// 1. CHART LIBRARY IMPORTS
// ----------------------------------------------------------------------
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell,
} from 'recharts';

// --------------------------------------------------
// NEW HELPER FUNCTION: Convert Markdown to HTML for display
// --------------------------------------------------
const renderMarkdownAsHtml = (markdownText) => {
    if (!markdownText) return '';

    // Convert newlines to breaks
    let html = markdownText.replace(/\n/g, '<br/>');

    // Convert **Bold Text** to <strong>Bold Text</strong>
    html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');

    // Convert ## Header to <h2>Header</h2>
    html = html.replace(/##\s*([^<]+)/g, '<h2>$1</h2>');

    // Convert --- (horizontal rules)
    html = html.replace(/---\s*<br\/>/g, '<hr>');

    return html;
};

// --------------------------------------------------
// INLINE STYLE FOR THE REPORT BOX
// --------------------------------------------------
const REPORT_BOX_STYLE = {
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '15px',
    marginTop: '20px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.05)',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
};

// ======================================================================
// 2. CHART DATA STRUCTURES (Placeholder data for demonstration)
// ======================================================================

// Data for Student Status (Bar Chart - Risk Levels)
const STUDENT_RISK_DATA = [
    { name: 'Low Risk', students: 18, color: '#4ADE80' },
    { name: 'Medium Risk', students: 7, color: '#FCD34D' },
    { name: 'High Risk', students: 3, color: '#F87171' },
];

// Data for Student Status (Pie Chart - Behavior/Appetite)
const STUDENT_BEHAVIOR_DATA = [
    { name: 'Positive Notes', value: 45, color: '#3B82F6' },
    { name: 'Appetite Issues', value: 30, color: '#EF4444' },
    { name: 'Restless Sleeping', value: 25, color: '#A855F7' },
];

// Placeholder for the detailed text that comes from fetchStudentStatus
const STUDENT_TEXT_REPORT_PLACEHOLDER = `## **Overall Student Status**
---
**Quick Summary:** The cohort shows moderate engagement, but 10% are in a **High Risk** category due to repeated sleep and appetite issues. Requires targeted intervention.

**Appetite Notes:** 30% of students documented with appetite issues this week.
**Restless Sleeping:** 25% of reports noted restless sleep patterns.
**Positive Behavior:** 45% of reports included positive behavioral notes.

**Targeted Students (Example):**
1. **Tarun Kumar R** - Medium Risk (Consistent poor appetite)
2. **Kamesh S** - High Risk (Multiple issues noted)
`;

// ======================================================================
// MODIFIED: AI Reports Placeholder - Now includes 3 teachers
// ======================================================================
const AI_TEACHER_REPORTS_PLACEHOLDER = [
    {
        name: "Tarun Kumar",
        verdict: "Not Suitable",
        skillData: [
            { name: 'Exp (Yrs)', score: 7, max: 10, color: '#10B981' },
            { name: 'Class Mgmt.', score: 8, max: 10, color: '#2563EB' },
            { name: 'DAP View', score: 4, max: 10, color: '#F97316' },
            { name: 'Portfolio Eval.', score: 9, max: 10, color: '#6366F1' },
        ],
        output: "Verdict: **Not Suitable**\nStrengths: 7+ years of experience... [Detailed Text for Tarun]"
    },
    {
        name: "Radhika Sharma",
        verdict: "Suitable",
        skillData: [
            { name: 'Exp (Yrs)', score: 5, max: 10, color: '#10B981' },
            { name: 'Class Mgmt.', score: 7, max: 10, color: '#2563EB' },
            { name: 'DAP View', score: 9, max: 10, color: '#F97316' },
            { name: 'Portfolio Eval.', score: 8, max: 10, color: '#6366F1' },
        ],
        output: "Verdict: **Suitable**\nStrengths: 5 years of experience... [Detailed Text for Radhika Sharma]"
    },
    {
        name: "Anita Joseph",
        verdict: "Suitable",
        skillData: [
            { name: 'Exp (Yrs)', score: 2, max: 10, color: '#10B981' },
            { name: 'Class Mgmt.', score: 6, max: 10, color: '#2563EB' },
            { name: 'DAP View', score: 8, max: 10, color: '#F97316' },
            { name: 'Portfolio Eval.', score: 7, max: 10, color: '#6366F1' },
        ],
        output: "Verdict: **Suitable**\nStrengths: Good proficiency in Creative Arts... Weaknesses: Limited experience (1-3 years)... [Detailed Text for Anita Joseph]"
    }
];
// ======================================================================


const Dashboard = () => {
    // Existing state
    const [logs, setLogs] = useState([]);
    const [isSending, setIsSending] = useState(false);
    const [activeTab, setActiveTab] = useState("daily");
    const navigate = useNavigate();

    // UPDATED STATE
    const [teacherReport, setTeacherReport] = useState(null);
    const [isProcessingAI, setIsProcessingAI] = useState(false);
    const [aiError, setAiError] = useState(null);
    const [studentStatusText, setStudentStatusText] = useState("");

    // --------------------------------------------------
    // Existing functions (sendMessages, sendWeeklyMenu, triggerN8nAnalysis, clearLogs, handleLogout)
    // --------------------------------------------------

    const sendMessages = () => { /* ... existing logic ... */ };
    const sendWeeklyMenu = () => { /* ... existing logic ... */ };

    // MODIFIED: fetchStudentStatus
    const fetchStudentStatus = async () => {
        console.log("📡 Starting Student Status request...");
        setLogs((prev) => [...prev, "📡 Connecting to n8n for Student Status..."]);
        setStudentStatusText("Loading...");

        try {
            const response = await fetch("/student-status");

            if (!response.ok) {
                setLogs((prev) => [...prev, `❌ Server Error: ${response.status}`]);
                setStudentStatusText(`❌ Server Error: ${response.status}`);
                return;
            }

            const data = await response.json();

            if (data && data.message) {
                setLogs((prev) => [...prev, "✅ Student Status Received!"]);
                setStudentStatusText(data.message);
            } else {
                setLogs((prev) => [...prev, "⚠️ No status found from n8n."]);
                // If real data is empty, use placeholder for demonstration
                setStudentStatusText(STUDENT_TEXT_REPORT_PLACEHOLDER); 
            }
            

        } catch (error) {
            console.error("❌ Student Status Exception:", error);
            setLogs((prev) => [...prev, "❌ Error fetching student status."]);
            setStudentStatusText("❌ Error fetching student status.");
        }
    };


    // MODIFIED: triggerN8nAnalysis (using placeholder data for demo)
    const triggerN8nAnalysis = async () => {
        setLogs((prev) => [...prev, "🤖 Triggering AI Teacher Report via n8n..."]);
        setIsProcessingAI(true);
        setTeacherReport(null);
        setAiError(null);

        try {
            const response = await fetch('/api/teacher-analysis-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trigger: true }),
            });

            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(errorBody.details || `HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            
            // *****************************************************************
            // Use placeholder data for reliable chart rendering in demo
            setTeacherReport(AI_TEACHER_REPORTS_PLACEHOLDER); 
            // setTeacherReport(data); // <-- UNCOMMENT THIS LINE TO USE REAL API DATA
            // *****************************************************************
            
            setLogs((prev) => [...prev, "✅ AI Report received successfully!"]);

        } catch (err) {
            console.error('AI Report Fetch Error:', err);
            setAiError(`Error generating report: ${err.message}`);
            setLogs((prev) => [...prev, `❌ AI Report failed: ${err.message.substring(0, 80)}...`]);
        } finally {
            setIsProcessingAI(false);
        }
    };

    const clearLogs = () => { /* ... existing logic ... */ };
    const handleLogout = () => { /* ... existing logic ... */ };


    // ======================================================================
    // 3. MODIFIED CHART COMPONENTS (Professional/Game Aesthetics)
    // ======================================================================

    const RiskLevelBarChart = useMemo(() => ({ data }) => (
        <div style={{ width: '100%', height: 280, padding: '10px' }}>
            <h4 style={{ textAlign: 'center', margin: '0 0 10px 0', color: '#2563EB', textTransform: 'uppercase', fontSize: '1.1em', fontWeight: '800' }}>RISK ASSESSMENT</h4>
            <ResponsiveContainer width="100%" height="90%">
                <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis type="number" stroke="#333" />
                    <YAxis dataKey="name" type="category" stroke="#333" tick={{ fontWeight: 'bold' }} />
                    <Tooltip 
                        cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }}
                        contentStyle={{ backgroundColor: '#1F2937', border: 'none', color: 'white', borderRadius: '5px' }}
                    />
                    <Bar dataKey="students" radius={[5, 5, 0, 0]} label={{ position: 'right', fill: '#333', fontSize: 12 }}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    ), [STUDENT_RISK_DATA]);

    const BehaviorPieChart = useMemo(() => ({ data }) => {
        const total = data.reduce((sum, entry) => sum + entry.value, 0);
        return (
            <div style={{ width: '100%', height: 280, padding: '10px' }}>
                <h4 style={{ textAlign: 'center', margin: '0 0 10px 0', color: '#2563EB', textTransform: 'uppercase', fontSize: '1.1em', fontWeight: '800' }}>BEHAVIOR BREAKDOWN</h4>
                <ResponsiveContainer width="100%" height="90%">
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="value"
                            nameKey="name"
                            cx="40%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={3} // Added for visual separation
                            fill="#8884d8"
                            labelLine={false} // Cleaned up look
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} stroke="#fff" strokeWidth={2} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(value, name, props) => [`${(value / total * 100).toFixed(1)}%`, name]} />
                        <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ paddingLeft: '10px' }} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        );
    }, [STUDENT_BEHAVIOR_DATA]);

    const TeacherSkillsBarChart = useMemo(() => ({ teacherData }) => (
        <div style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '20px', backgroundColor: '#f9f9f9' }}>
            <h3 style={{ color: teacherData.verdict === 'Suitable' ? '#10B981' : '#EF4444', borderBottom: '2px solid #ccc', paddingBottom: '5px' }}>
                Teacher: {teacherData.name} (Verdict: {teacherData.verdict})
            </h3>
            <div style={{ width: '100%', height: 250, padding: '10px' }}>
                <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={teacherData.skillData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis dataKey="name" stroke="#333" />
                        <YAxis domain={[0, 10]} label={{ value: 'Score / 10', angle: -90, position: 'insideLeft', fill: '#333' }} stroke="#333" />
                        <Tooltip 
                            cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }}
                            contentStyle={{ backgroundColor: '#1F2937', border: 'none', color: 'white', borderRadius: '5px' }}
                            formatter={(value, name, props) => [`${value} / ${props.payload.max}`, props.payload.name]} />
                        <Bar dataKey="score" radius={[5, 5, 0, 0]} label={{ position: 'top', fill: '#333', fontSize: 12 }}>
                            {teacherData.skillData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            {/* Detailed text report for this specific teacher */}
            <h4 style={{ marginTop: '15px' }}>Detailed Notes:</h4>
            <div
                style={{ backgroundColor: 'white', padding: '10px', borderRadius: '4px', border: '1px solid #eee' }}
                dangerouslySetInnerHTML={{ __html: renderMarkdownAsHtml(teacherData.output) }}
            />
        </div>
    ), [AI_TEACHER_REPORTS_PLACEHOLDER]);


    // --------------------------------------------------
    // RENDER DASHBOARD
    // --------------------------------------------------
    return (
        <div className="dashboard-container">
            <Navbar onLogout={handleLogout} />
            <div className="dashboard-content">
                <h2>🎓 Kindergarten Teacher Dashboard</h2>
                <p>Click below to send updates or generate AI reports.</p>

                {/* TABS NAVIGATION */}
                <div className="tabs">
                    {/* ... Existing Tabs ... */}
                    <button
                        className={`tab-btn ${activeTab === "daily" ? "active" : ""}`}
                        onClick={() => setActiveTab("daily")}
                    >Daily Reports</button>
                    <button
                        className={`tab-btn ${activeTab === "menu" ? "active" : ""}`}
                        onClick={() => setActiveTab("menu")}
                    >Weekly Menu</button>
                    <button
                        className={`tab-btn ${activeTab === "status" ? "active" : ""}`}
                        onClick={() => setActiveTab("status")}
                    >Student Status</button>
                    <button
                        className={`tab-btn ${activeTab === "ai" ? "active" : ""}`}
                        onClick={() => setActiveTab("ai")}
                    >🧠 AI Reports</button>
                </div>

                {/* ACTION BUTTONS */}
                <div className="button-section">
                    {/* ... Existing Buttons ... */}
                    {activeTab === "daily" && (<button className="send-btn" onClick={sendMessages} disabled={isSending}>
                        {isSending ? "📨 Sending Daily Reports..." : "🚀 Send Daily Reports"}
                    </button>)}
                    {activeTab === "menu" && (<button className="send-btn" onClick={sendWeeklyMenu} disabled={isSending}>
                        {isSending ? "🍱 Sending Weekly Menu..." : "📆 Send Weekly Menu"}
                    </button>)}
                    {activeTab === "status" && (<button
                        className="send-btn" style={{ background: "#8b5cf6" }} onClick={fetchStudentStatus}
                        disabled={isSending || isProcessingAI}
                    >📊 Student Report Status</button>)}
                    {activeTab === "ai" && (<button
                        className="send-btn" style={{ background: "#ef4444" }} onClick={triggerN8nAnalysis}
                        disabled={isSending || isProcessingAI}
                    >{isProcessingAI ? "🧠 Running AI Analysis..." : "🚀 Generate Teacher AI Report"}</button>)}
                    <button className="clear-btn" onClick={clearLogs}>🧹 Clear Logs</button>
                </div>

                {/* ========================================================== */}
                {/* STUDENT STATUS - GRAPH AND TEXT */}
                {/* ========================================================== */}
                {activeTab === "status" && (
                    <div className="student-report-display">
                        <h2>Student Status - Overview</h2>
                        {/* Main container for the status report */}
                        <div style={{ ...REPORT_BOX_STYLE, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            
                            {/* TOP SECTION: GRAPHS - Use Flex for separation and responsiveness */}
                            <div style={{ 
                                display: 'flex', 
                                flexWrap: 'wrap', 
                                justifyContent: 'space-around', 
                                borderBottom: '1px solid #e0e0e0', 
                                paddingBottom: '20px',
                                // Added padding/margin to prevent charts from touching edges
                                padding: '10px 0', 
                            }}>
                                {/* Student Risk Bar Chart */}
                                <div style={{ flex: '1 1 45%', minWidth: '300px' }}>
                                    <RiskLevelBarChart data={STUDENT_RISK_DATA} />
                                </div>
                                {/* Student Behavior Pie Chart */}
                                <div style={{ flex: '1 1 45%', minWidth: '300px' }}>
                                    <BehaviorPieChart data={STUDENT_BEHAVIOR_DATA} />
                                </div>
                            </div>
                            
                            {/* BOTTOM SECTION: DETAILED TEXT REPORT (Handles Dynamic Data) */}
                            <div style={{ width: '100%', marginTop: '10px' }}>
                                <h3>📋 Detailed Student Risk/Behavior Report:</h3>
                                <div
                                    style={{ backgroundColor: '#f9fafb', padding: '15px', borderRadius: '4px', border: '1px solid #ddd' }}
                                    dangerouslySetInnerHTML={{ __html: renderMarkdownAsHtml(studentStatusText || "Click 'Student Report Status' to fetch the detailed text status.") }}
                                />
                            </div>
                        </div>
                    </div>
                )}
                {/* ========================================================== */}
                {/* END STUDENT STATUS */}
                {/* ========================================================== */}


                {/* 5. AI REPORTS - CHART FOR EACH TEACHER */}
                {activeTab === "ai" && (
                    <div className="ai-report-display">
                        <h2>AI Teacher Report - Detailed Assessment</h2>
                        {isProcessingAI && (
                            <p className="yellow">⏳ AI Analysis in progress. This may take a moment...</p>
                        )}
                        {aiError && (
                            <p className="red">❌ AI Report Error: {aiError}</p>
                        )}

                        {/* RENDER A CHART BLOCK FOR EACH TEACHER */}
                        {teacherReport && teacherReport.length > 0 && (
                            <div style={{ marginTop: '20px' }}>
                                {teacherReport.map((teacher, index) => (
                                    <TeacherSkillsBarChart key={index} teacherData={teacher} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {/* END AI REPORT DISPLAY SECTION */}


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