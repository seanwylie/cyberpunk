import { defineConfig } from 'vite';
export default defineConfig({ base: './', define: { __BUILD__: JSON.stringify(String(Date.now())) }, build: { target: 'es2022', outDir: 'dist' }, server: { port: 5173 } });
