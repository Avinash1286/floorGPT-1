# FloorGPT Demo Questions and Answers

This file contains likely questions a teacher may ask after the FloorGPT demo, along with short and practical answers.

## 1. What is FloorGPT?

**Answer:**  
FloorGPT is a web application that takes a 2D floor plan image and converts it into structured scene data, then generates an interactive 3D building preview using Three.js.

## 2. What problem does this project solve?

**Answer:**  
It reduces the difficulty of imagining a 3D building from a 2D floor plan. Many users can read the plan but cannot easily visualize room arrangement, scale, and flow. This project makes the layout easier to understand.

## 3. Why did you choose this project?

**Answer:**  
I chose it because it combines two important areas of the course: AI-based image understanding and computer graphics. It is also a practical project with clear real-world use in architecture, planning, and presentation.

## 4. What is the main workflow of the system?

**Answer:**  
The workflow is:
1. Upload a floor plan image.
2. Send it to Gemini for analysis.
3. Extract structured JSON from the AI response.
4. Validate and normalize the data.
5. Build a 3D scene from rooms, walls, doors, and windows.
6. Render the result in an interactive viewer.

## 5. Why did you use Gemini in this project?

**Answer:**  
Gemini is used for image understanding. It reads the floor plan image and estimates rooms, walls, doors, windows, and metadata. This avoids manually entering the scene data.

## 6. Why is validation necessary after the AI response?

**Answer:**  
AI output is not always perfectly structured or fully accurate. Validation is necessary to check missing fields, invalid values, wrong data types, and broken geometry before generating the 3D model.

## 7. What does normalization mean in your project?

**Answer:**  
Normalization means converting the parsed AI output into a safe and consistent format. For example, it sets default values, clamps invalid positions, corrects ranges, and ensures the final scene graph is usable by the renderer.

## 8. Which technologies did you use and why?

**Answer:**  
I used React for UI, Vite for fast development and build, Three.js for 3D rendering, Tailwind CSS for styling, Zod for validation, and Gemini API for floor plan understanding. Each tool supports a different part of the pipeline efficiently.

## 9. Why did you choose Three.js?

**Answer:**  
Three.js provides a strong WebGL-based 3D rendering system with cameras, lights, materials, geometry, and interaction support. It is well suited for building a browser-based architectural viewer.

## 10. How do you convert 2D floor plan data into 3D objects?

**Answer:**  
Each room is treated as a rectangular area in 2D with `x`, `y`, `width`, and `height`. These values are mapped into 3D space by using the floor plan coordinates on the ground plane and assigning height on the vertical axis. Then floors, walls, ceilings, and roof elements are created as 3D geometry.

## 11. What mathematical formulas are used in the project?

**Answer:**  
Some important formulas are:
- Room center: `centerX = x + width / 2`, `centerZ = y + height / 2`
- Room area: `area = width * height`
- Wall length: `L = sqrt((x2 - x1)^2 + (y2 - y1)^2)`
- Wall midpoint: `((x1 + x2) / 2, (y1 + y2) / 2)`
- Wall rotation for diagonal walls: `theta = atan2(y2 - y1, x2 - x1)`
- Opening position on wall: `center = normalizedPosition * wallLength`

These formulas are used to place geometry correctly in the 3D scene.

## 12. How are doors and windows handled?

**Answer:**  
Doors and windows are treated as openings on walls. Their position is stored as a normalized value from 0 to 1 along the wall. The system converts that into actual wall coordinates and creates wall gaps and frame elements in the 3D model.

## 13. What is a scene graph in this project?

**Answer:**  
The scene graph is the structured JSON that describes the building. It contains rooms, walls, doors, windows, style information, and metadata. This JSON acts as the bridge between AI output and 3D rendering.

## 14. What happens if the API key is missing or the AI request fails?

**Answer:**  
The project supports mock and demo modes. If the API key is missing, the app can still show a generated sample scene so the rest of the UI and 3D pipeline can be demonstrated.

## 15. How does the system improve reliability?

**Answer:**  
It improves reliability through multiple stages: strict prompting, JSON cleanup, retry logic when labels are missing, schema validation with Zod, default values, and controlled geometry generation.

## 16. What are the main features of the viewer?

**Answer:**  
The viewer supports perspective and top view, wireframe mode, shading changes, shadow toggle, light intensity control, room labels, minimap, fullscreen mode, flythrough, and walkthrough.

## 17. What are the limitations of the current system?

**Answer:**  
The biggest limitation is that the accuracy depends on the quality of the floor plan image and the correctness of the AI extraction. Complex plans, unclear text, and unusual layouts can still produce approximate or incomplete output.

## 18. Is the output always dimensionally accurate?

**Answer:**  
No. The system tries to estimate realistic dimensions, but the output is still approximate unless the floor plan clearly includes readable measurements. So the current prototype is better for visualization than exact construction use.

## 19. How is this project related to computer graphics?

**Answer:**  
It uses core computer graphics concepts such as coordinate transformation, geometry construction, mesh generation, materials, lighting, camera control, rendering, and interactive visualization.

## 20. How is AI used differently from graphics in this project?

**Answer:**  
AI is used to understand the input image and generate structured spatial data. Graphics is used after that to convert the structured data into visible 3D geometry and render it interactively.

## 21. Why did you keep the project web-based?

**Answer:**  
A web-based system is easy to run, demonstrate, and share. It works in a browser without requiring heavy installation, which makes it practical for classroom presentations and future deployment.

## 22. How do you handle performance in the app?

**Answer:**  
The project improves performance by lazy-loading the 3D viewer and splitting large dependencies into chunks during build. This reduces initial load cost and keeps the app more responsive.

## 23. What are the possible real-world applications of this project?

**Answer:**  
It can be useful in architecture education, quick design prototyping, interior planning, client presentation, and early-stage building visualization.

## 24. What improvements would you make in the future?

**Answer:**  
Future improvements include better dimension accuracy, support for multi-floor buildings, export options, manual correction tools, better furniture generation, and quantitative evaluation against ground-truth plans.

## 25. If your teacher asks "What is the main contribution of your project?", what should you answer?

**Answer:**  
The main contribution is an end-to-end pipeline that combines AI-based floor plan understanding with real-time 3D visualization in a single browser application. It reduces manual work and makes floor plan interpretation more interactive and understandable.

## 26. If your teacher asks "Why is this project a prototype and not a final production system?", what should you answer?

**Answer:**  
It is a prototype because the AI output is still approximate, the system is not yet fully tested on large real-world datasets, and it lacks features such as precise CAD integration, multi-user workflow, strong evaluation metrics, and full editing tools.

## 27. If your teacher asks "What did you personally learn from this project?", what should you answer?

**Answer:**  
I learned how to combine AI output with graphics rendering, how to validate uncertain machine-generated data, how scene graphs can connect data and visualization, and how user interaction improves the usefulness of a graphics system.

## 28. Short closing answer for viva

**Answer:**  
FloorGPT is a practical prototype that shows how AI and computer graphics can work together: AI extracts the floor plan structure, and the graphics pipeline converts it into an interactive 3D model for easier understanding and presentation.
