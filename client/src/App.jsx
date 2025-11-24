import { useState } from "react";

function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isSending, setIsSending] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();

    // Simple hardcoded login – change if you want
    if (username === "teacher" && password === "1234") {
      setIsLoggedIn(true);
    } else {
      alert("Invalid username or password");
    }
  };

  const appendLog = (msg) => {
    setLogs((prev) => [...prev, msg]);
  };

  const callSSEEndpoint = (path) => {
    setIsSending(true);
    setLogs([]);

    const eventSource = new EventSource(path);

    eventSource.onmessage = (event) => {
      const data = event.data;
      appendLog(data);

      if (data === "[DONE]") {
        eventSource.close();
        setIsSending(false);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE error", err);
      appendLog("❌ Connection error");
      eventSource.close();
      setIsSending(false);
    };
  };

  // 🔴 CHANGE 1: ADD CONFIRMATION DIALOG 🔴
  const handleSendDaily = () => {
    if (window.confirm("Are you sure you want to send the DAILY REPORTS to all parents?")) {
      callSSEEndpoint("/send");
    }
  };

  const handleSendMenu = () => {
    if (window.confirm("Are you sure you want to send the WEEKLY MENU to all parents?")) {
      callSSEEndpoint("/send-menu");
    }
  };

  // ===========================
  // LOGIN PAGE
  // ===========================
  if (!isLoggedIn) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #f5a6ff 0%, #a5c6ff 50%, #c1fff2 100%)",
        }}
      >
        <div
          style={{
            background: "white",
            padding: "40px 50px",
            borderRadius: "20px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
            width: "100%",
            maxWidth: "420px",
          }}
        >
          <h1
            style={{
              textAlign: "center",
              marginBottom: "30px",
              color: "#1e88ff",
            }}
          >
            <span style={{ fontSize: "32px", marginRight: "8px" }}>🧑‍🏫</span>
            <span>Teacher Login</span>
          </h1>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: "20px" }}>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: "1px solid #d0e3ff",
                  backgroundColor: "#f3f7ff",
                  fontSize: "16px",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: "1px solid #d0e3ff",
                  backgroundColor: "#f3f7ff",
                  fontSize: "16px",
                  outline: "none",
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                width: "100%",
                padding: "12px 0",
                border: "none",
                borderRadius: "10px",
                backgroundColor: "#1e88ff",
                color: "white",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ===========================
  // DASHBOARD PAGE AFTER LOGIN
  // ===========================
  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "40px",
        background:
          "linear-gradient(135deg, #f5a6ff 0%, #a5c6ff 50%, #c1fff2 100%)",
      }}
    >
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          background: "white",
          borderRadius: "20px",
          padding: "30px 30px 20px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ margin: 0, color: "#1e88ff" }}>
            🏫 WhatsApp Sheets Automation
          </h2>
          <button
            onClick={() => setIsLoggedIn(false)}
            style={{
              border: "none",
              background: "transparent",
              color: "#ff5454",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>

        <p style={{ marginTop: 0, marginBottom: "20px" }}>
          Welcome, <strong>{username}</strong>. Choose an action below:
        </p>

        {/* 🔴 CHANGE 2: NEW CONTAINER FOR VERTICAL SPACING 🔴 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column", 
            gap: "24px", // Increased spacing for clear module separation
            marginBottom: "20px",
          }}
        >
          <button
            onClick={handleSendDaily}
            disabled={isSending}
            style={{
              padding: "12px 0",
              borderRadius: "10px",
              border: "none",
              backgroundColor: "#1e88ff",
              color: "white",
              fontSize: "15px",
              fontWeight: "bold",
              cursor: isSending ? "not-allowed" : "pointer",
            }}
          >
            {isSending ? "Sending..." : "Send Daily Reports"}
          </button>

          <button
            onClick={handleSendMenu}
            disabled={isSending}
            style={{
              padding: "12px 0",
              borderRadius: "10px",
              border: "none",
              backgroundColor: "#00b894",
              color: "white",
              fontSize: "15px",
              fontWeight: "bold",
              cursor: isSending ? "not-allowed" : "pointer",
            }}
          >
            {isSending ? "Sending..." : "Send Weekly Menu"}
          </button>
          
          {/* PLACEHOLDER BUTTONS FOR COMPLETENESS FROM IMAGE */}
          <button
            style={{
                padding: "12px 0",
                borderRadius: "10px",
                border: "none",
                backgroundColor: "#7f59ff", 
                color: "white",
                fontSize: "15px",
                fontWeight: "bold",
                cursor: "pointer",
            }}
          >
            Student Report Status
          </button>

          <button
            style={{
                padding: "12px 0",
                borderRadius: "10px",
                border: "none",
                backgroundColor: "#ff9f1a", 
                color: "white",
                fontSize: "15px",
                fontWeight: "bold",
                cursor: "pointer",
            }}
          >
            Clear Logs
          </button>

        </div>

        <div
          style={{
            backgroundColor: "#0b1020",
            color: "#e0e0e0",
            padding: "12px",
            borderRadius: "10px",
            height: "260px",
            overflowY: "auto",
            fontFamily: "monospace",
            fontSize: "13px",
            whiteSpace: "pre-wrap",
          }}
        >
          {logs.length === 0 ? (
            <span style={{ color: "#777" }}>
              Logs will appear here after you start sending…
            </span>
          ) : (
            logs.map((line, idx) => <div key={idx}>{line}</div>)
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
