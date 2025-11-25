import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/send": "http://localhost:3000",
      "/send-menu": "http://localhost:3000",
      "/student-status": "http://localhost:3000",
    },
  },
});
