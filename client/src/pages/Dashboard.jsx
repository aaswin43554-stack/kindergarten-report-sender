// client/src/pages/Dashboard.jsx

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import "../styles.css";

const Dashboard = () => {
  // Existing state
  const [logs, setLogs] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState("daily"); // Default tab
  const navigate = useNavigate();

  // NEW STATE for the Teacher Report data
  const [teacherReport, setTeacherReport] = useState(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiError, setAiError] = useState(null);

  // --------------------------------------------------
  // FUNCTION: SEND DAILY REPORTS (Existing)
  // --------------------------------------------------
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
      setLogs((prev) => [...prev, "❌ Connection error."]);
      setIsSending(false);
      eventSource.close();
    };
  };

  // --------------------------------------------------
  // FUNCTION: SEND WEEKLY MENU (Existing)
  // --------------------------------------------------
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
      setLogs((prev) => [...prev, "❌ Connection error."]);
      setIsSending(false);
      eventSource.close();
    };
  };

  // --------------------------------------------------
  // FUNCTION: FETCH STUDENT REPORT STATUS (Existing)
  // --------------------------------------------------
  const fetchStudentStatus = async () => {
    setLogs((prev) => [...prev, "📊 Fetching student report status..."]);
    try {
      const response = await fetch("/student-status");
      const data = await response.json();

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
  // NEW FUNCTION: TRIGGER N8N TEACHER ANALYSIS
  // --------------------------------------------------
  const triggerN8nAnalysis = async () => {
    setLogs((prev) => [...prev, "🤖 Triggering AI Teacher Report via n8n..."]);
    setIsProcessingAI(true);
    setTeacherReport(null);
    setAiError(null);

    try {
      // Call the backend endpoint created in server.js
      const response = await fetch('/api/teacher-analysis-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // You can send any request body data here if needed
        body: JSON.stringify({ trigger: true }), 
      });

      if (!response.ok) {
        // Attempt to read the error from the server
        const errorBody = await response.json();
        throw new Error(errorBody.details || `HTTP error! Status: ${response.status}`);
      }

      // The backend waits for n8n and returns the final JSON data
      const data = await response.json();
      
      setTeacherReport(data); // Store the incoming JSON data
      setLogs((prev) => [...prev, "✅ AI Report received successfully!"]);

    } catch (err) {
      console.error('AI Report Fetch Error:', err);
      setAiError(`Error generating report: ${err.message}`);
      setLogs((prev) => [...prev, `❌ AI Report failed: ${err.message.substring(0, 80)}...`]);
    } finally {
      setIsProcessingAI(false);
    }
  };

  // --------------------------------------------------
  // FUNCTION: CLEAR LOGS (Existing)
  // --------------------------------------------------
  const clearLogs = () => {
    setLogs([]);
    setTeacherReport(null); // Also clear the report when clearing logs
    setAiError(null);
  };

  // --------------------------------------------------
  // FUNCTION: LOGOUT (Existing)
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
        <p>Click below to send updates or generate AI reports.</p>

        {/* TABS NAVIGATION - ADDING NEW TAB */}
        <div className="tabs">
          {/* Existing Tabs */}
          <button
            className={`tab-btn ${activeTab === "daily" ? "active" : ""}`}
            onClick={() => setActiveTab("daily")}
          >
            Daily Reports
          </button>
          <button
            className={`tab-btn ${activeTab === "menu" ? "active" : ""}`}
            onClick={() => setActiveTab("menu")}
          >
            Weekly Menu
          </button>
          <button
            className={`tab-btn ${activeTab === "status" ? "active" : ""}`}
            onClick={() => setActiveTab("status")}
          >
            Student Status
          </button>
          {/* NEW TAB */}
          <button
            className={`tab-btn ${activeTab === "ai" ? "active" : ""}`}
            onClick={() => setActiveTab("ai")}
          >
            🧠 AI Reports
          </button>
        </div>

        {/* ACTION BUTTONS & AI REPORT DISPLAY */}
        <div className="button-section">
          {/* Existing Buttons */}
          {activeTab === "daily" && (
            <button className="send-btn" onClick={sendMessages} disabled={isSending}>
              {isSending ? "📨 Sending Daily Reports..." : "🚀 Send Daily Reports"}
            </button>
          )}

          {activeTab === "menu" && (
            <button className="send-btn" onClick={sendWeeklyMenu} disabled={isSending}>
              {isSending ? "🍱 Sending Weekly Menu..." : "📆 Send Weekly Menu"}
            </button>
          )}

          {activeTab === "status" && (
            <button 
              className="send-btn" 
              style={{ background: "#8b5cf6" }} 
              onClick={fetchStudentStatus} 
              disabled={isSending || isProcessingAI} // Disable if any other major task is running
            >
              📊 Student Report Status
            </button>
          )}
          
          {/* NEW AI REPORT BUTTON */}
          {activeTab === "ai" && (
            <button 
              className="send-btn" 
              style={{ background: "#ef4444" }} // Red color for distinction
              onClick={triggerN8nAnalysis} 
              disabled={isSending || isProcessingAI}
            >
              {isProcessingAI ? "🧠 Running AI Analysis..." : "🚀 Generate Teacher AI Report"}
            </button>
          )}

          <button className="clear-btn" onClick={clearLogs}>
            🧹 Clear Logs
          </button>
        </div>
        
        {/* NEW AI REPORT DISPLAY SECTION */}
        {activeTab === "ai" && (
          <div className="ai-report-display">
            {isProcessingAI && (
              <p className="yellow">⏳ AI Analysis in progress. This may take a moment...</p>
            )}
            
            {aiError && (
              <p className="red">❌ AI Report Error: {aiError}</p>
            )}

            {teacherReport && (
              <>
                <h3>✅ Generated Teacher Report Data:</h3>
                <div style={{ maxHeight: '300px', overflowY: 'scroll', backgroundColor: '#f9f9f9', padding: '10px', border: '1px solid #ddd' }}>
                  {/* Since we don't know the exact structure, we display the raw JSON */}
                  <pre>{JSON.stringify(teacherReport, null, 2)}</pre>
                </div>
                {/* To fully replicate the "Student Report Section," you would replace the <pre> tag
                    with a dedicated component to format the data: 
                    <TeacherReportDisplay data={teacherReport} />
                */}
              </>
            )}
          </div>
        )}
        {/* END NEW AI REPORT DISPLAY SECTION */}


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