import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const Login = ({ setIsLoggedIn }) => {
  // local state for input fields and error msg
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // navigate hook for routing
  const navigate = useNavigate();

  const handleLogin = () => {
    // simple static login (you can change later)
    if (username === "teacher" && password === "1234") {
      // store login info
      localStorage.setItem("loggedIn", "true");
      setIsLoggedIn(true);

      // redirect to dashboard
      navigate("/dashboard");
    } else {
      setError("❌ Invalid username or password!");
    }
  };

  return (
    <div className="login-container">
      <h2>🧑‍🏫 Teacher Login</h2>

      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={handleLogin}>Login</button>

      {error && <p className="error">{error}</p>}
    </div>
  );
};

export default Login;
