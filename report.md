# 1. Title Page

**Project Title:** FloorGPT - Floor Plan to 3D Building Visualizer  
**Student Name:** ____________________  
**Roll Number:** ____________________  
**Program / Semester:** ENCT 201 / ____________________  
**Subject:** Computer Graphics & Visualization  
**Instructor Name:** ____________________  
**Department:** ____________________  
**Submission Date:** ____________________

*(Format attached at the end.)*

---

# 2. Acknowledgement

I would like to thank my instructor for guidance and regular feedback during this project. I also thank my classmates for their suggestions during testing and presentation practice. This project helped me understand how AI can work with computer graphics to solve real problems.

---

# 3. Abstract

FloorGPT is a web-based project that converts a floor plan image into a 3D building preview. The user uploads an image file, and the system sends it to a Gemini model for analysis. The model returns structured JSON data containing rooms, walls, doors, windows, and basic metadata. After that, the app validates and normalizes this JSON so the data is safe and consistent. Then, a Three.js scene is generated to show floors, walls, roof, lighting, labels, and camera views.

The project is built using React, Vite, Three.js, Tailwind CSS, and Zod. It also supports demo and mock modes, so the app can still work when the API key is missing. The viewer includes useful controls like top view, wireframe, shading mode, shadows, light intensity, minimap, flythrough, and walkthrough. This project shows a practical use of AI + visualization for architecture and interior planning, and it gives a strong base for future improvements.

---

# 4. Table of Contents

1. Title Page  
2. Acknowledgement  
3. Abstract  
4. Table of Contents  
5. Introduction  
6. Objectives  
7. Tools and Technologies Used  
8. Methodology / System Design  
9. Implementation  
10. Results / Output  
11. Discussion  
12. Conclusion  
13. Future Work  
14. References  
15. Appendix (Optional)

---

# 5. Introduction

In building design, reading a 2D floor plan and imagining a 3D space takes time and skill. Many students and clients find it difficult to understand room flow, scale, and layout only from a flat drawing. FloorGPT solves this by taking a floor plan image and generating both structured scene data and a live 3D model.

This project combines computer vision (through Gemini image understanding) with computer graphics (Three.js rendering). The goal is not only to parse data but also to make visualization interactive and easy to explore. The user can upload an image, inspect generated JSON, and check the 3D output in one interface.

This makes FloorGPT useful for learning, prototyping, and presentation in computer graphics and visualization work.

---

# 6. Objectives

- Build a web app that accepts floor plan image upload.
- Convert floor plan content into structured JSON scene data.
- Validate and normalize AI output to avoid broken geometry.
- Generate a 3D building scene from parsed data.
- Add interactive viewer controls for better analysis.
- Support demo/mock workflows for reliable testing.
- Keep the UI simple and clear for classroom use.

---

# 7. Tools and Technologies Used

- **Programming Language:** JavaScript (ES Modules)
- **Frontend Framework:** React 19
- **Build Tool:** Vite
- **3D Library:** Three.js
- **Styling:** Tailwind CSS
- **Validation Library:** Zod
- **Upload Utility:** react-dropzone
- **Icons:** lucide-react
- **AI Service:** Google Gemini API (model configurable, default is `gemini-3.1-pro-preview`)
- **Development Tools:** VS Code, ESLint, npm

---

# 8. Methodology / System Design

The system follows a staged pipeline with a validation layer between AI analysis and 3D rendering:

1. **Image Input and Validation Stage**  
   The user uploads a floor plan image (PNG/JPG/WEBP). `UploadPanel` checks file type and size, shows a preview, and forwards the file to the app layer.

2. **Mode Selection Stage**  
   The app decides whether to run live Gemini analysis, demo mode, or mock fallback mode when an API key is not available.

3. **Space Audit Stage**  
   In live mode, Gemini first performs a space-audit pass to detect visible room labels and estimate how many spaces should appear in the final scene.

4. **Scene Extraction Stage**  
   The image is then processed with a stricter scene-graph prompt. If some labeled rooms are missing, the service retries with missing labels highlighted.

5. **Response Cleanup Stage**  
   The app removes markdown fences, extracts the first JSON object, and repairs small JSON issues when possible.

6. **Validation and Normalization Stage**  
   `sceneParser` uses Zod schemas to validate rooms, walls, doors, windows, style, and metadata. It also applies defaults, safe limits, and derived values such as area and room count.

7. **Scene Build Stage**  
   `SceneBuilder` creates floors, walls, openings, ceilings, roof elements, textures, and material setup from the normalized scene graph.

8. **Rendering and Interaction Stage**  
   The 3D scene is rendered with camera controls, lighting presets, minimap, labels, fullscreen mode, and walkthrough/flythrough interactions.

9. **Output Review Stage**  
   The user can inspect and copy the generated scene JSON for debugging and verification.

**System Flow Diagram**

```text
Floor Plan Image
      |
      v
UploadPanel.jsx
(file validation + preview)
      |
      v
App.jsx
(state management + mode selection)
      |
      +-----------------------------+
      |                             |
      | Demo / Mock path            | Live Gemini path
      |                             |
      v                             v
Bundled / generated scene      geminiService.js
sample JSON                    |-> space audit
      |                         |-> scene parse
      |                         |-> retry if labels are missing
      |                         |-> style profile
      +-------------+-----------+
                    |
                    v
sceneParser.js
(Zod validation + normalization)
                    |
                    v
Normalized Scene Graph
                    |
                    v
SceneBuilder.js + TextureFactory.js
(geometry + materials + roof + openings)
                    |
                    v
Renderer.js + CameraControls.js + LightingSetup.js
                    |
                    v
ViewerPanel.jsx
(toolbar + labels + minimap + navigation)
                    |
                    v
3D Building Preview + JSON Preview
```

**Mathematical Formulation Used for 3D Scene Generation**

FloorGPT converts a 2D floor plan scene graph into 3D geometry by treating plan coordinates as ground-plane values and mapping height on the vertical axis. The project uses an estimated metric scale where `1 unit ~= 1 meter`.

1. **2D to 3D Coordinate Mapping**  
   A room defined in 2D as `(x, y, width, height)` is placed in 3D by mapping:
   `X = x`, `Z = y`, and `Y = vertical height`.

   The room center used for placement is:
   `centerX = x + width / 2`
   `centerZ = y + height / 2`

   So the room group position becomes:
   `P_room = (x + width / 2, 0, y + height / 2)`

2. **Room Floor and Ceiling Geometry**  
   Each room is modeled as rectangular box-based surfaces:
   `FloorBox = (width, floorThickness, height)`
   `CeilingBox = (width, ceilingThickness, height)`

   Floor position:
   `Y_floor = floorThickness / 2`

   Ceiling position:
   `Y_ceiling = wallHeight`

3. **Room Area and Total Area Calculation**  
   For each room:
   `A_room = width * height`

   Total floor area:
   `A_total = sum(width_i * height_i)`

   This is used in metadata and dashboard scene metrics.

4. **Wall Length, Midpoint, and Rotation**  
   For an explicit wall segment with endpoints `(x1, y1)` and `(x2, y2)`:
   `dx = x2 - x1`
   `dz = y2 - y1`

   Wall length:
   `L = sqrt(dx^2 + dz^2)`

   Wall midpoint in 3D:
   `M = ((x1 + x2) / 2, wallHeight / 2, (y1 + y2) / 2)`

   For diagonal walls, rotation about the Y-axis is:
   `theta = atan2(dz, dx)`

5. **Room Boundary Wall Generation**  
   For a rectangular room, the boundary walls are derived from the room footprint:
   North wall: `(x, y) -> (x + width, y)`
   East wall: `(x + width, y) -> (x + width, y + height)`
   South wall: `(x + width, y + height) -> (x, y + height)`
   West wall: `(x, y + height) -> (x, y)`

6. **Door and Window Opening Placement**  
   Doors and windows are defined by a normalized wall position `p`, where:
   `0 <= p <= 1`

   The normalized position is clamped:
   `p' = clamp(p, 0, 1)`

   For a wall of length `L`, opening center along the wall:
   `c = p' * L`

   If the opening width is `w_open`, then:
   `start = c - w_open / 2`
   `end = c + w_open / 2`

   For windows, the top of the opening is:
   `top = sillHeight + openingHeight`

   The internal center used to place the opening mesh is:
   `centerAlong = -L / 2 + start + (end - start) / 2`
   `centerY = sillHeight + openingHeight / 2`

7. **Scene Bounds and Centering**  
   To center the whole building in the viewer, the scene bounds are computed as:
   `minX = min(all room and wall x values)`
   `maxX = max(all room and wall x values)`
   `minZ = min(all room and wall y values)`
   `maxZ = max(all room and wall y values)`

   Scene center:
   `sceneCenterX = (minX + maxX) / 2`
   `sceneCenterZ = (minZ + maxZ) / 2`

   Then the root object is shifted by:
   `x' = x - sceneCenterX`
   `z' = z - sceneCenterZ`

8. **Camera Path / Walkthrough Support**  
   For navigation and flythrough, waypoint direction is based on the vector between room centers:
   `dirX = nextCenterX - currentCenterX`
   `dirZ = nextCenterZ - currentCenterZ`

   Magnitude:
   `d = sqrt(dirX^2 + dirZ^2)`

   Normalized direction:
   `uX = dirX / d`
   `uZ = dirZ / d`

   This helps place the camera slightly behind each room target during flythrough.

This design keeps modules separated, so each part can be improved without breaking the full pipeline.

---

# 9. Implementation

The main implementation is divided into practical modules:

- **App Layer (`App.jsx`)**  
  Handles selected file state, scene graph state, raw JSON output, loading/error states, demo toggling, response source tracking, and data flow between the upload, viewer, and JSON preview panels.

- **Upload Panel (`UploadPanel.jsx`)**  
  Validates image type and size, supports drag-and-drop upload, shows file preview, and starts the analysis process.

- **Gemini Service (`services/geminiService.js`)**  
  Converts the image to inline request data, runs the space-audit prompt, scene-parse prompt, retry logic for missing labels, and exterior style profiling. It also handles timeout control, debug logging, JSON cleanup, and mock fallback when no API key is present.

- **Parser Layer (`services/sceneParser.js`)**  
  Validates and normalizes AI output using Zod; ensures safe numeric ranges, valid wall/opening values, color cleanup, and required defaults.

- **Utility Layer (`utils/sceneBuilder.js`, `utils/geometryHelpers.js`, `utils/colorPalette.js`)**  
  Provides empty scene defaults, scene metrics, opening geometry helpers, and validated room color generation used by both parser and renderer.

- **Scene Generation (`three/SceneBuilder.js`, `three/TextureFactory.js`)**  
  Converts scene graph data into floors, explicit wall meshes, ceilings, roof elements, textured materials, and door/window openings using coordinate mapping, wall-length calculation, midpoint placement, and rotation formulas.

- **Rendering and Camera Control (`three/Renderer.js`, `three/CameraControls.js`)**  
  Configures the WebGL renderer, tone mapping, shadow behavior, resize handling, and orbit-based navigation.

- **Lighting and Environment (`three/LightingSetup.js`)**  
  Adds ambient, hemisphere, directional, and point lights with environment presets and scene-fitted lighting updates.

- **Viewer Layer (`ViewerPanel.jsx`, `Toolbar.jsx`, `Minimap.jsx`, `JsonPreview.jsx`)**  
  Manages camera modes, shading options, wireframe, labels, minimap, fullscreen mode, flythrough, walkthrough, and JSON inspection.

- **Performance Handling**  
  Viewer is lazy-loaded and Vite manual chunking separates `three-core`, `three-examples`, React vendor, and UI vendor bundles.


---

# 10. Results / Output

The project currently produces these outputs:

- Successful upload and preview of floor plan images.
- AI-generated scene graph JSON with room and wall structure.
- Safe normalized scene graph even when raw AI output has minor issues.
- Real-time 3D building view with floor, walls, roof, and textures.
- Toolbar controls for perspective/top view, shading mode, shadows, wireframe, and light level.
- Visual aids such as room labels and minimap with camera marker.
- Demo mode and mock mode support for offline/classroom demonstrations.

Overall, the system runs as a complete prototype from image input to interactive 3D output.

---

# 11. Discussion

The project shows that combining AI parsing with graphics rendering can reduce manual modeling work. The strongest part is the modular design: upload, AI service, parser, and renderer are clearly separated. This makes debugging easier and improves reliability.

There are also practical challenges. AI output quality depends on image clarity and label readability. Some floor plans can still produce missing or approximate room dimensions. To reduce failures, the project includes strict prompts, JSON extraction, validation, and fallback behavior.

The final result is useful for semester demonstration and gives a strong base for future research in automated architectural visualization.

---

# 12. Conclusion

FloorGPT successfully demonstrates an end-to-end workflow for converting 2D floor plans into structured JSON and interactive 3D scenes. The project meets key goals in graphics and visualization: geometry creation, lighting, camera interaction, and real-time rendering. It also shows how AI can speed up scene preparation.

The current version is stable enough for educational use and prototype demos. With further refinement, this approach can support more accurate and detailed design workflows.

---

# 13. Future Work

- Improve dimension detection accuracy for complex plans.
- Add support for multi-floor stair connectivity and vertical navigation.
- Add export options (GLTF/OBJ/PDF snapshot reports).
- Add manual edit tools to fix AI mistakes directly in UI.
- Improve furniture generation and semantic object placement.
- Add stronger quantitative evaluation (accuracy score vs ground truth).
- Add user accounts and project save/load support.

---

# 14. References

1. Three.js Documentation: https://threejs.org/docs/  
2. React Documentation: https://react.dev/  
3. Vite Documentation: https://vite.dev/guide/  
4. Tailwind CSS Documentation: https://tailwindcss.com/docs  
5. Zod Documentation: https://zod.dev/  
6. Google AI / Gemini API Docs: https://ai.google.dev/

---

# 15. Appendix (Optional)

- Suggested appendix items for final submission:
  - Screenshot of upload panel.
  - Screenshot of generated 3D scene in perspective mode.
  - Screenshot of top-view mode with minimap.
  - Screenshot of JSON preview panel.
  - Sample input floor plan image used in testing.
  - Short code snippets for parser and scene builder modules.
