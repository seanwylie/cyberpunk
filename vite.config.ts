import { defineConfig, loadEnv, type Plugin } from 'vite';
// @ts-ignore plain-JS server module shared with the serverless function
import { storyMiddleware, createStoryService } from './server/story_beat.mjs';
// Dev/preview-only story proxy: OPENAI_API_KEY is read from the server env (.env, not committed) and never reaches the client bundle.
function storyProxy(): Plugin {
  const env = { ...process.env, ...loadEnv('development', process.cwd(), '') } as Record<string, string>;
  const mw = storyMiddleware(createStoryService({ env }), env);
  return { name: 'wv-story-proxy', configureServer(s) { s.middlewares.use(mw); }, configurePreviewServer(s) { s.middlewares.use(mw); } };
}
export default defineConfig({ base: './', plugins: [storyProxy()], define: { __BUILD__: JSON.stringify(String(Date.now())) }, build: { target: 'es2022', outDir: 'dist' }, server: { port: 5173 } });
