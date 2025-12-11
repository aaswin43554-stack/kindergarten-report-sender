import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
<<<<<<< Updated upstream
=======
    proxy: {
      "/send": "http://localhost:3000",
      "/send-menu": "http://localhost:3000",
      "/student-status": "http://localhost:3000",
      "/api": "http://localhost:3000",          // all backend API routes
      "/teacher": "http://localhost:3000",
    },
>>>>>>> Stashed changes
  },
});
 