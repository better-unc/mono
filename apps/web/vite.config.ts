import { defineConfig } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import react from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tailwindcss(),
    tsconfigPaths(),
    tanstackStart({
      srcDirectory: ".",
      router: {
        routesDirectory: "app",
      },
    }),
    react(),
  ],
})

