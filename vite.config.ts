import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { authPlugin } from './server/vite-auth.ts';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), authPlugin()],
  server: { strictPort: true },
  preview: { strictPort: true },
});
