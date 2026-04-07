import { defineConfig, searchForWorkspaceRoot } from "vite";
import react from "@vitejs/plugin-react";

const PROJECT_ROOT = "C:/Users/DESKTOP/Desktop/lycee-overture";
const EXTERNAL_CARD_IMAGE_DIR = "C:/Users/DESKTOP/Desktop/lycee-card-images/cards";

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        PROJECT_ROOT,
        EXTERNAL_CARD_IMAGE_DIR,
      ],
    },
  },
});
