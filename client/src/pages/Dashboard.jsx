// client/src/pages/Dashboard.jsx

import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import "../styles.css";

// ----------------------------------------------------------------------
// 1. CHART LIBRARY IMPORTS
// ----------------------------------------------------------------------
import {
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, BarChart, Bar
} from 'recharts';

// --------------------------------------------------
// HELPER FUNCTION: Convert Markdown to HTML for display
// --------------------------------------------------
const renderMarkdownAsHtml = (markdownText) => {
    if (!markdownText) return '';

    let html = markdownText.replace(/\n/g, '<br/>');
    html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/##\s*([^<]+)/g, '<h2>$1</h2>');
    html = html.replace(/---\s*<br\/>/g, '<hr>');

    return html;
};

// --------------------------------------------------
// BASE STYLE FOR THE REPORT BOX
// --------------------------------------------------
const REPORT_BOX_STYLE = {
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    borderRadius: '12px',
    padding: '25px',
    marginTop: '25px',
    boxShadow: '0 6px 12px rgba(0, 0, 0, 0.1)',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
};


// ======================================================================
// 3. CHART COMPONENTS (MOVED OUTSIDE DASHBOARD TO FIX HOOKS ERROR)
// ======================================================================

const StudentTrendLineChart = ({ trendData }) => {
    if (!trendData.trend_data || trendData.trend_data.length < 2) {
        return <p style={{color: '#F97316', textAlign: 'center'}}>Insufficient data points to display trend graph.</p>;
    }
    
    return (
        <div style={{ padding: '15px', border: '1px solid #0088FE', borderRadius: '8px', marginBottom: '20px', backgroundColor: '#f0faff' }}>
            <h3 style={{ color: '#0088FE', borderBottom: '2px solid #0088FE', paddingBottom: '5px' }}>
                 {trendData.name} - Performance Score Trend
            </h3>
            <div style={{ width: '100%', height: 250, padding: '10px' }}>
                <ResponsiveContainer width="100%" height="90%">
                    <LineChart data={trendData.trend_data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                        <XAxis dataKey="period" stroke="#333" interval={0} angle={-30} textAnchor="end" height={50} />
                        <YAxis stroke="#333" domain={[0, 100]} label={{ value: 'Score %', angle: -90, position: 'insideLeft', fill: '#333' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', color: 'white', borderRadius: '5px' }} formatter={(value) => [`Score: ${value}%`, 'Period']} />
                        <Legend />
                        <Line type="monotone" dataKey="score" stroke="#0088FE" strokeWidth={3} dot={{ stroke: '#0088FE', strokeWidth: 2, r: 5 }} activeDot={{ r: 8 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const BehaviorPieChart = ({ studentBehaviorData }) => {
    const data = studentBehaviorData;
    if (data.length < 2) return <p style={{ textAlign: 'center', marginTop: '50px', color: '#999' }}>Insufficient data for Pie Chart (Need at least 2 categories).</p>;

    const total = data.reduce((sum, entry) => sum + entry.value, 0);
    return (
        <div style={{ width: '100%', height: 280, padding: '10px' }}>
            <h4 style={{ textAlign: 'center', margin: '0 0 10px 0', color: '#2563EB', textTransform: 'uppercase', fontSize: '1.1em', fontWeight: '800' }}>BEHAVIOR BREAKDOWN</h4>
            <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                    <Pie data={data} dataKey="value" nameKey="name" cx="40%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={3} labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}>
                        {data.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color || '#ccc'} stroke="#fff" strokeWidth={2} />))}
                    </Pie>
                    <Tooltip formatter={(value, name, props) => [`Count: ${value}`, name]} />
                    <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ paddingLeft: '10px' }} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};

const TeacherSkillsBarChart = ({ teacherData }) => {
    if (!teacherData || !teacherData.skillData || teacherData.skillData.length === 0) return null;

    return (
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
                                <Cell key={`cell-${index}`} fill={entry.color || '#007bff'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <h4 style={{ marginTop: '15px' }}>Detailed Notes:</h4>
            <div
                style={{ backgroundColor: 'white', padding: '10px', borderRadius: '4px', border: '1px solid #eee' }}
                dangerouslySetInnerHTML={{ __html: renderMarkdownAsHtml(teacherData.output) }}
            />
        </div>
    );
};

// ======================================================================
// 4. DUMMY DATA FOR DEMONSTRATION
// ======================================================================

const DUMMY_STUDENT_STATUS_DATA = {
    message: `
General Analysis:

After carefully analyzing the daily reports, here's a comprehensive breakdown:

1. Tarun Kumar R
- **Risk Level: Medium**
- Reasoning: Consistently poor appetite across multiple reports
- Positive notes: Cheerful behavior, calm mood, enjoyed painting

2. Aswin S
- **Risk Level: Low**
- Reasoning:
    * Excellent appetite
    * Cheerful behavior
    * Fair sleeping
    * Excited mood

3. Kumaran KS
- **Risk Level: Low**
- Reasoning:
    * Average appetite
    * Excellent sleeping
    * Cheerful behavior
    * Calm mood
- Positive note about eating lunch fully

4. Kamesh S
- **Risk Level: High**
- Reasoning:
    * Poor appetite
    * Restless sleeping
    * Quiet behavior
- Potential signs of underlying concern
- **Observation: Needs closer monitoring**

General Notes for Teachers/Parents:

1. **Special Attention Required:** Kamesh S shows multiple potential risk indicators. Tarun Kumar R has consistent appetite issues.
2. **Positive Observations:** Most students display cheerful behaviors. No severe mood or behavioral problems detected.

Recommendations:

* Conduct a one-on-one check with Kamesh S to understand any underlying issues.
* Monitor Tarun Kumar R's appetite and ensure proper nutrition.
* Continue current positive engagement strategies for Aswin S and Kumaran KS.

Key Patterns:

- Appetite variations are the most noticeable difference among students.
- Sleep quality shows moderate variations.
- Overall mood and behavior remain predominantly positive.

**Risk Level Summary:**
- High Risk: 1 student (**Kamesh S**)
- Medium Risk: 1 student (**Tarun Kumar R**)
- Low Risk: 2 students (**Aswin S, Kumaran KS**)
    `,
    
    // Data for the BehaviorPieChart (Focus on general observations)
    behavior_data: [
        { name: 'Cheerful Mood', value: 4, color: '#10B981' }, // Green
        { name: 'Calm Mood', value: 2, color: '#3B82F6' }, // Blue
        { name: 'Excited/Restless', value: 2, color: '#F59E0B' }, // Yellow
        { name: 'Quiet/Concerned', value: 1, color: '#EF4444' }, // Red
    ],
    
    // Data for Individual Student Analysis & Trends (Line Chart)
    student_reports: [
        {
            name: 'Tarun Kumar R',
            risk: 'Medium',
            report_text: "**Appetite:** Consistently low food intake. **Behavior:** Engaged in painting, happy. **Action:** Monitor food and offer high-calorie snacks.",
            trend_data: [
                { period: 'Mon', score: 65 },
                { period: 'Tue', score: 70 },
                { period: 'Wed', score: 60 },
                { period: 'Thu', score: 75 },
                { period: 'Fri', score: 68 },
            ]
        },
        {
            name: 'Aswin S',
            risk: 'Low',
            report_text: "**Appetite:** Excellent. **Behavior:** Highly cheerful, excited. **Action:** Continue positive reinforcement. Ensure energy levels remain stable.",
            trend_data: [
                { period: 'Mon', score: 90 },
                { period: 'Tue', score: 95 },
                { period: 'Wed', score: 88 },
                { period: 'Thu', score: 92 },
                { period: 'Fri', score: 96 },
            ]
        },
        {
            name: 'Kumaran KS',
            risk: 'Low',
            report_text: "**Appetite:** Average, finished lunch. **Behavior:** Calm and well-behaved. **Action:** General positive encouragement. No immediate concerns.",
            trend_data: [
                { period: 'Mon', score: 80 },
                { period: 'Tue', score: 82 },
                { period: 'Wed', score: 85 },
                { period: 'Thu', score: 81 },
                { period: 'Fri', score: 84 },
            ]
        },
        {
            name: 'Kamesh S',
            risk: 'High',
            report_text: "**Appetite:** Poor intake. **Sleep:** Restless. **Behavior:** Unusually quiet. **Action:** Immediate one-on-one conversation required. Alert parents.",
            trend_data: [
                { period: 'Mon', score: 70 },
                { period: 'Tue', score: 65 },
                { period: 'Wed', score: 55 },
                { period: 'Thu', score: 50 },
                { period: 'Fri', score: 45 },
            ]
        }
    ]
};

// ======================================================================
// 5. DASHBOARD COMPONENT
// ======================================================================

const Dashboard = () => {
    // Core App State
    const [logs, setLogs] = useState([]);
    const [isSending, setIsSending] = useState(false);
    const [activeTab, setActiveTab] = useState("daily");
    const navigate = useNavigate();

    // DYNAMIC DATA STATES
    const [teacherReport, setTeacherReport] = useState([]); 
    const [isProcessingAI, setIsProcessingAI] = useState(false);
    const [aiError, setAiError] = useState(null);
    const [studentStatusText, setStudentStatusText] = useState("");
    const [studentReports, setStudentReports] = useState([]); 
    const [studentBehaviorData, setStudentBehaviorData] = useState([]); 

    // --------------------------------------------------
    // CORE FUNCTION IMPLEMENTATIONS (FIXED AND RESTORED)
    // --------------------------------------------------
    
    // FIXED: SEND DAILY REPORTS (Restored Functionality)
    const sendMessages = () => {
        setLogs([]);
        setIsSending(true);

        const eventSource = new EventSource("/send");

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
            setLogs((prev) => [...prev, "❌ Connection error during Daily Reports."]);
            setIsSending(false);
            eventSource.close();
        };
    };

    // FIXED: SEND WEEKLY MENU (Restored Functionality)
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
            setLogs((prev) => [...prev, event.data]);
        };

        eventSource.onerror = (err) => {
            console.error("❌ SSE error:", err);
            setLogs((prev) => [...prev, "❌ Connection error during Weekly Menu."]);
            setIsSending(false);
            eventSource.close();
        };
    };

    // MODIFIED: fetchStudentStatus (DYNAMIC DATA MAPPING - NOW USING DUMMY DATA)
    const fetchStudentStatus = async () => {
        setLogs((prev) => [...prev, "📡 Connecting to n8n for Student Status... (Using Dummy Data for Charts)"]);
        setStudentStatusText("Loading...");
        setStudentReports([]); 
        setStudentBehaviorData([]);
        setIsProcessingAI(true); // Use processing state for loading

        try {
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 1000)); 
            
            const data = DUMMY_STUDENT_STATUS_DATA;

            if (data) {
                setLogs((prev) => [...prev, "✅ Student Status Data Received! (Including Graph Data)"]);
                
                // Map the dummy data to the state variables
                setStudentStatusText(data.message || "No overall text report available.");
                setStudentBehaviorData(data.behavior_data || []); 
                setStudentReports(data.student_reports || []); 
            } else {
                setLogs((prev) => [...prev, `❌ Status Error: No data received`]);
                setStudentStatusText(`❌ Error fetching status: No data received`);
            }
            
        } catch (error) {
            setLogs((prev) => [...prev, "❌ Error fetching student status."]);
            setStudentStatusText("❌ Error fetching student status.");
        } finally {
            setIsProcessingAI(false);
        }
    };


    // MODIFIED: triggerN8nAnalysis (DYNAMIC DATA MAPPING)
    const triggerN8nAnalysis = async () => {
        setLogs((prev) => [...prev, "🤖 Triggering AI Teacher Report via n8n..."]);
        setIsProcessingAI(true);
        setTeacherReport([]);
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
            
            setTeacherReport(data || []); 
            
            setLogs((prev) => [...prev, "✅ AI Report received successfully!"]);

        } catch (err) {
            setLogs((prev) => [...prev, `❌ AI Report failed: ${err.message}`]);
            setAiError(`Error generating report: ${err.message}`);
        } finally {
            setIsProcessingAI(false);
        }
    };

    const clearLogs = () => {
        setLogs([]);
        setTeacherReport(null);
        setAiError(null);
        setStudentStatusText("");
        setStudentReports([]);
        setStudentBehaviorData([]);
    };

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
                <p>Click below to send updates or generate AI reports.</p>

                {/* TABS NAVIGATION */}
                <div className="tabs">
                    <button className={`tab-btn ${activeTab === "daily" ? "active" : ""}`} onClick={() => setActiveTab("daily")}>Daily Reports</button>
                    <button className={`tab-btn ${activeTab === "menu" ? "active" : ""}`} onClick={() => setActiveTab("menu")}>Weekly Menu</button>
                    <button className={`tab-btn ${activeTab === "status" ? "active" : ""}`} onClick={() => setActiveTab("status")}>Student Status</button>
                    <button className={`tab-btn ${activeTab === "ai" ? "active" : ""}`} onClick={() => setActiveTab("ai")}>🧠 AI Reports</button>
                </div>

                {/* ACTION BUTTONS */}
                <div className="button-section">
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
                {/* STUDENT STATUS - GRAPHS AND TEXT (Dynamic Data) */}
                {/* ========================================================== */}
                {activeTab === "status" && (
                    <div className="student-report-display">
                        <h2>Student Status - Overview</h2>
                        <div style={{ ...REPORT_BOX_STYLE, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            
                            {/* 1. GLOBAL PIE CHART (Behavior/Appetite) */}
                            <div style={{ borderBottom: '1px solid #e0e0e0', paddingBottom: '20px', padding: '10px 0' }}>
                                {studentBehaviorData.length > 0 ? (
                                    <BehaviorPieChart studentBehaviorData={studentBehaviorData} />
                                ) : (
                                    <p style={{ color: '#F97316', textAlign: 'center' }}>Click 'Student Report Status' to load behavior breakdown chart.</p>
                                )}
                            </div>
                            
                            {/* 2. OVERALL TEXT REPORT (General Notes) */}
                            <div style={{ width: '100%', marginBottom: '30px' }}>
                                <h3>General Analysis:</h3>
                                <div
                                    style={{ backgroundColor: '#f9fafb', padding: '15px', borderRadius: '4px', border: '1px solid #ddd' }}
                                    dangerouslySetInnerHTML={{ __html: renderMarkdownAsHtml(studentStatusText || "Report status will appear here.") }}
                                />
                            </div>

                            {/* 3. INDIVIDUAL STUDENT REPORTS (Looping) */}
                            <div style={{ width: '100%', marginTop: '20px', borderTop: '2px solid #2563EB', paddingTop: '20px' }}>
                                <h2>Individual Student Analysis & Trends</h2>
                                {studentReports.length > 0 ? (
                                    studentReports.map((student, index) => (
                                        <div key={index} style={{ ...REPORT_BOX_STYLE, padding: '15px', marginBottom: '30px', border: '2px solid #ccc', backgroundColor: '#fafafa' }}>
                                            <h3 style={{ color: '#8b5cf6', borderBottom: '1px dashed #ccc', paddingBottom: '10px', marginBottom: '15px' }}>
                                                Student: {student.name || `Student ${index + 1}`} - Risk: <span style={{ color: student.risk === 'High' ? '#EF4444' : student.risk === 'Medium' ? '#F59E0B' : '#10B981', fontWeight: 'bold' }}>{student.risk || 'N/A'}</span>
                                            </h3>
                                            
                                            {/* Line Chart for this Student */}
                                            {student.trend_data && student.trend_data.length > 0 ? (
                                                <StudentTrendLineChart trendData={{ name: student.name, trend_data: student.trend_data }} />
                                            ) : (
                                                <p style={{color: '#F97316'}}>No specific trend data available for this student.</p>
                                            )}
                                            
                                            {/* Specific Markdown Report for this Student */}
                                            <h4 style={{ marginTop: '15px' }}>Specific Report Details:</h4>
                                            <div
                                                style={{ backgroundColor: 'white', padding: '10px', borderRadius: '4px', border: '1px solid #eee' }}
                                                dangerouslySetInnerHTML={{ __html: renderMarkdownAsHtml(student.report_text || 'No specific report text provided.') }}
                                            />
                                        </div>
                                    ))
                                ) : (
                                    <p style={{ color: '#F97316' }}>No individual student report data found. Click the button to fetch the analysis.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {/* END STUDENT STATUS */}


                {/* 5. AI REPORTS - CHART FOR EACH TEACHER */}
                {activeTab === "ai" && (
                    <div className="ai-report-display">
                        <h2>AI Teacher Report - Detailed Assessment</h2>
                        {isProcessingAI && (<p className="yellow">⏳ AI Analysis in progress. This may take a moment...</p>)}
                        {aiError && (<p className="red">❌ AI Report Error: {aiError}</p>)}

                        {teacherReport.length > 0 ? (
                            <div style={{ marginTop: '20px' }}>
                                {teacherReport.map((teacher, index) => (
                                    <TeacherSkillsBarChart key={index} teacherData={teacher} />
                                ))}
                            </div>
                        ) : (
                            <p style={{ color: '#F97316' }}>Click 'Generate Teacher AI Report' to fetch dynamic assessment data.</p>
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