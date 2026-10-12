import { defineConfig, loadEnv, type Plugin } from 'vite';
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
// Build identity: git short sha (+ '-dirty') and build time, baked into the bundle and published as dist/version.json (served no-cache) for the in-game update check.
const sha = (() => { if (process.env.BUILD_SHA) return process.env.BUILD_SHA; try { const s = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); let d = ''; try { d = execSync('git status --porcelain --untracked-files=no', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() ? '-dirty' : ''; } catch { } return s + d; } catch { return 'nogit'; } })();
const BUILD_MS = Date.now(), BUILD_TIME = new Date(BUILD_MS).toISOString();
function versionJson(): Plugin { return { name: 'wv-version-json', apply: 'build', closeBundle() { mkdirSync('dist', { recursive: true }); writeFileSync('dist/version.json', JSON.stringify({ id: sha, time: BUILD_TIME, build: String(BUILD_MS) })); } }; }
// @ts-ignore plain-JS server module shared with the serverless function
import { storyMiddleware, createStoryService } from './server/story_beat.mjs';
// Dev/preview-only story proxy: OPENAI_API_KEY is read from the server env (.env, not committed) and never reaches the client bundle.
function storyProxy(): Plugin {
  const env = { ...process.env, ...loadEnv('development', process.cwd(), '') } as Record<string, string>;
  const mw = storyMiddleware(createStoryService({ env }), env);
  return { name: 'wv-story-proxy', configureServer(s) { s.middlewares.use(mw); }, configurePreviewServer(s) { s.middlewares.use(mw); } };
}
export default defineConfig({ base: './', plugins: [storyProxy(), versionJson()], define: { __BUILD__: JSON.stringify(String(BUILD_MS)), __BUILD_ID__: JSON.stringify(sha), __BUILD_TIME__: JSON.stringify(BUILD_TIME) }, build: { target: 'es2022', outDir: 'dist' }, server: { port: 5173 } });
