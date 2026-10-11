
## Walker frame cache (quiet box, 1280x720, software raster, medians of 2-3 runs)
| | submit p95 x1 | submit p95 x4 CPU | draw+raster p95 x1 | x4 |
|---|---|---|---|---|
| before | 6.6-8.5 ms | 33-36 ms | 38-50 ms | 172-185 ms |
| after  | 4.5-4.8 ms | 20-27 ms | 35.5-37 ms | 158-171 ms |
Walkers (up to 11) used to composite 5-6 canvas ops each per frame (frame blend + multiply tint + destination-in mask + scaled blit); steady walkers now blit one cached, tinted frame (bounded LRU of 360 canvases). The remaining cost is software rasterisation of the town items (headless SwiftShader), not JS submit. A full profile pass (draw-call counts, GC, HUD DOM) was not completed because the box was saturated (load 70) when the pass began.
