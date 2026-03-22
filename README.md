# FloorGPT

FloorGPT is a React + Three.js web application that transforms floor plan images into structured scene data and renders an interactive 3D building model.

## Current implementation status

- ✅ Phase 1 complete: project setup, polished upload UX, JSON preview, and interactive 3D viewer shell
- ✅ Phase 2 complete: Gemini parsing hardening with robust JSON extraction and normalization
- ✅ Default Gemini model set to `gemini-3.1-pro-preview`
- ✅ Phase 3 complete: geometry generation includes door/window wall cutouts and explicit wall rendering from parsed wall segments
- ✅ Phase 4 complete: lighting rig, shadow toggle, and shading modes (Phong/Lambert/Basic) are integrated
- ✅ Phase 5 complete: CSS2D room labels, minimap overlay, flythrough interactions, and collapsible JSON preview are integrated

## Tech stack

- React + Vite
- Three.js + WebGL
- Tailwind CSS
- Google Gemini API (Vision via inline image request)

## Quick start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create local environment file:

   ```bash
   cp .env.example .env.local
   ```

   On Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Add your Gemini API key to `.env.local`:

   ```env
   VITE_GEMINI_API_KEY=your_key_here
   VITE_GEMINI_MODEL=gemini-3.1-pro-preview
   ```

   `VITE_GEMINI_MODEL` is optional, but defaults to `gemini-3.1-pro-preview`.

4. Run the app:

   ```bash
   npm run dev
   ```

5. Build for production:

   ```bash
   npm run build
   ```

## Notes

- If no API key is set, the app automatically uses a mock floor plan response so the UI and 3D pipeline remain fully testable.
- The Gemini service strips fences, extracts JSON objects, and repairs minor syntax issues (like trailing commas) before parsing.
- The parser now normalizes partially malformed lists safely and keeps valid rooms/walls/doors/windows.
- Viewer toolbar supports shading mode switching, shadow on/off, and light intensity tuning for evaluation demos.
- Viewer now includes CSS2D room labels, a live minimap camera indicator, and a start/stop flythrough mode.
- Performance pass: 3D viewer is lazy-loaded with `React.lazy`, and Vite splits Three.js into dedicated vendor chunks for improved caching and startup cost.
