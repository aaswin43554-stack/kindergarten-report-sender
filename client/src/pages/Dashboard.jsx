import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import "../styles.css";

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
  // FUNCTION: SEND WEEKLY MENU
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
  // FUNCTION: FETCH STUDENT REPORT STATUS (SUPABASE)
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
