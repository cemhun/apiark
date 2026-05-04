import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes("monaco-editor") || id.includes("@monaco-editor")) return "monaco";
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) return "react";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("@dnd-kit")) return "dnd-kit";
          if (id.includes("@stoplight")) return "spectral";
          if (id.includes("@xterm")) return "xterm";
          if (id.includes("node_modules/i18next") || id.includes("react-i18next")) return "i18n";
          if (id.includes("node_modules/zustand")) return "zustand";
          if (id.includes("@tauri-apps")) return "tauri";
        },
      },
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
