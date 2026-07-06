# plan.md

## Objectives
- Prove and harden the **core AI workflows** for anime-only creation: (1) prompt → anime textures, (2) reference image → anime variation, (3) prompt/reference → multi-angle turnaround sheet.
- Deliver a stable V1 **VRM companion driver**: load VRM, render in 3D, runtime animations + expressions + basic posing, apply generated textures to VRM materials.
- Ensure **viewport reliability** across diverse VRMs (robust camera auto-framing, safe controls), so users can consistently preview animations/poses/textures.
- Improve **AI-driven texture application fidelity**: streamline generation and ensure textures map correctly to intended VRM material slots/UVs (minimize stretching/misalignment), with repeatable user workflows.
- Persist projects (VRM + generated assets + settings) and ensure end-to-end reliability with incremental testing.

---

## Phase 1 — Core Workflow POC (Isolation: AI image generation)

### User Stories (POC)
1. As a user, I can run a script that generates an anime texture from a prompt and saves it as a PNG.
2. As a user, I can provide a reference image and get an anime-styled variation back.
3. As a user, I can generate a 4-angle turnaround sheet (front/side/back/3-4) from a single prompt.
4. As a user, I can enforce “anime-only” style constraints and reject non-anime outputs.
5. As a user, I can reproduce results with saved prompts + parameters.

### Implementation Steps
- Websearch: confirm **Gemini “Nano Banana” image generation** best practices (img2img, prompt structuring, safety filters, output formats).
- Create `scripts/poc_nano_banana.py`:
  - Modes: `--text2img`, `--img2img`, `--turnaround`.
  - Inputs: prompt, optional reference image, seed/variation params.
  - Outputs: save PNGs + JSON manifest (prompt, params, timestamps).
- Define strict prompt template (anime-only): style tokens + negative constraints.
- Add automated checks:
  - Validate output dimensions and file size.
  - Basic “anime-ness” heuristic: prompt tags + optional lightweight classifier (only if readily available).
- Iterate until: success rate acceptable, turnaround consistency acceptable, and outputs are stable.

### Success Criteria
- Script runs locally end-to-end and reliably produces:
  - ≥1 high-quality anime texture image per prompt.
  - ≥1 plausible anime variation from reference image.
  - A 4-panel turnaround sheet in one run (or 4 separate images).
- All outputs saved deterministically with a manifest for later app ingestion.

**Status**: COMPLETE (superseded by full in-app workflow in Phase 2).

---

## Phase 2 — V1 App Development (FARM + Web VRM driver)

### User Stories (V1)
1. As a user, I can upload a `.vrm` file and see it rendered in a 3D viewport.
2. As a user, I can trigger preset animations (idle/wave/dance/walk) and see them play smoothly.
3. As a user, I can control facial expressions with sliders (blink/smile/angry + vowel mouth shapes).
4. As a user, I can generate anime textures in-app and preview/apply them to VRM materials (face/hair/clothes).
5. As a user, I can save a project (VRM + textures + selected settings) and reload it later.
6. As a user, when I import a VRM, the character spawns **centered and fully visible** (no cut-off), regardless of avatar height/mesh structure.
7. As a user, I can apply textures with **UV-accurate alignment workflows** and can rollback to originals.

### Implementation Steps
- Repo setup:
  - `frontend/` React + Vite + Three.js + `@pixiv/three-vrm` + Zustand.
  - `backend/` FastAPI + MongoDB (project metadata) + local blob storage (or GridFS) for images.
- Backend (FastAPI):
  - `POST /api/generate/texture` (prompt → image)
  - `POST /api/generate/variant` (ref image + prompt → image)
  - `POST /api/generate/turnaround` (prompt/ref → 4 images)
  - `POST /api/projects` `GET /api/projects` `GET /api/projects/{id}`
  - Store manifests from Phase 1 structure.
- Frontend core screens (studio layout):
  - **Viewport**: VRM loader, orbit controls, lighting presets, background options.
  - **Animation panel**: preset clips, play/stop, speed.
  - **Expressions panel**: VRM blendshape sliders + auto-blink toggle.
  - **Texture Lab**: prompt + reference upload + results grid + “apply to material slot”.
  - **Projects**: gallery list + open/save.
- VRM runtime features (client-side):
  - Load VRM, setup humanoid, spring bones enabled.
  - Animation mixer + bundled clips.
  - Expression mapping to VRM blendshapes.
  - Material mapping UI (pick VRM material → set baseColorMap to generated texture).

#### Viewport Reliability / Camera Auto-frame (P0) — COMPLETED
- Clean rewrite of camera targeting math in `frontend/src/components/VRMViewer.jsx`.
- Fix root cause: `computeVRMBoundingBox` was accidentally nested inside `makeGradientTexture`, throwing `ReferenceError` and forcing silent fallback to hardcoded camera coords.
- Implement robust VRM bounding-box union (per mesh/skinned mesh) and aspect-aware fit-to-frame using both vertical/horizontal FOV.
- Verified with **testing_agent_v3**: 12/12 tests passed (centering, full visibility, wave animation, orbit controls, no console errors).

#### UV-Accurate Texture Pipeline (P1) — COMPLETED
Key deliverables:
- New `frontend/src/lib/materialUtils.js`:
  - `classifyMaterial()` + `CATEGORY_ORDER/LABELS`
  - `extractUvTemplate()` (UV wireframe + optional diffuse underlay → PNG data URL)
  - `applyTexture()` (supports optional 2D transform)
  - `updateMaterialTransform()` (live slider updates)
  - `restoreMaterial()` (rollback to original map)
- Rewritten `frontend/src/components/panels/MaterialsPanel.jsx`:
  - Grouped materials: Face/Eyes/Hair/Skin/Tops/Bottoms/Shoes/Outfit/Accessory/Other
  - Per-material **Fit** controls: offset / repeat / rotation
  - **UV → Lab** handoff (extracts UV template and opens Texture Lab)
  - **Save UV** download
  - **Original** restore per material
- Store updates (`frontend/src/store/studioStore.js`):
  - Added `materialTransforms`, `pendingUvReference` handoff + `defaultTransform()`
- Updated `frontend/src/components/dialogs/TextureLabDialog.jsx`:
  - Consumes `pendingUvReference`
  - Shows UV workflow banner and auto-populates variant prompt
  - Auto-applies generated variant to the source material when UV workflow is active
- Backend update (`backend/ai_service.py`):
  - `generate_variant()` now detects UV-preserving prompts (UV/layout/seams/boundaries) and uses a stricter instruction to respect seams.

Verification:
- Verified with **testing_agent_v3**: 11/11 tests passed (UV→Lab, Save UV, grouping, Fit sliders, clear UV target, regressions).

### Testing (end of Phase 2)
- 1 full E2E pass:
  - Upload VRM → render (centered) → play animation → change expressions → generate texture → apply → save project → reload project.
- Fix until stable (no broken core flows).

**Status**: COMPLETE (P0 camera centering + P1 UV texture pipeline both shipped and verified; no known regressions).

### Success Criteria
- V1 runs locally with no mocks for AI generation.
- VRM loads and animates; textures generate and visibly apply; projects persist and reload.
- Imported VRMs consistently auto-frame into view (centered, no cut-off) across varied avatars.
- Users can align textures to UVs via UV template workflow; can transform and rollback per material.

---

## Phase 3 — Feature Expansion (Model creation workflow + better runtime control)

### User Stories (Expansion)
1. As a user, I can generate a character sheet (turnaround) and keep it attached to a project.
2. As a user, I can run an image-to-3D job (with my own API key) and see the resulting mesh preview.
3. As a user, I can export generated assets (PNGs + manifests) from a project.
4. As a user, I can create and save pose presets (idle pose, wave pose).
5. As a user, I can record a short animation preview clip (or capture timed screenshots) for sharing.
6. As a user, I can save/reload **per-material texture assignments + transforms** as part of a project.

### Implementation Steps
- Reference Studio:
  - Turnaround generator UI (grid), prompt library, regenerate per-panel.
  - Attach turnaround images to project metadata.
- Image-to-3D integration (fal.ai Trellis/Hunyuan3D):
  - Add API key settings page (stored locally in browser storage; never log).
  - Job submission + polling + result viewer.
  - If no key: disable with clear CTA (no mocked “success”).
- VRM driver upgrades:
  - Pose editor (limited bone rotations) + save pose presets.
  - Simple timeline: sequence of preset animations + expressions.
- Project persistence upgrades (newly enabled by Phase 2 P1 work):
  - Save `materialAssignments` (asset id/url) + `materialTransforms` into project.
  - On project load, re-apply textures + transforms to the VRM.
  - Add quick “before/after” preview and one-click rollback for the whole avatar.

### Testing (end of Phase 3)
- E2E: turnaround → save → reload → image-to-3D (if key) → view result → export.
- E2E: apply UV workflow texture → tweak transforms → save project → reload → verify textures/transforms persist.

### Success Criteria
- Model creation workflow is usable end-to-end (where key exists) and never silently fails.
- Projects reliably persist VRM + assigned textures + transforms and restore them correctly.

---

## Phase 4 — Advanced Driver Capabilities (optional, after review)

### User Stories (Advanced)
1. As a user, I can enable webcam face tracking to drive expressions live.
2. As a user, I can stream motion data in/out via VMC/OSC.
3. As a user, I can calibrate tracking and save calibration per avatar.
4. As a user, I can switch between “performance mode” and “quality mode”.
5. As a user, I can export performance recordings.

### Implementation Steps
- Add MediaPipe/Kalidokit pipeline for face tracking.
- Map landmarks → VRM blendshapes + head/eye look.
- Optional: VMC protocol bridge.

---

## Next Actions (Immediate)
1. **Persist UV pipeline state into Projects (new top priority)**
   - Extend backend project schema to store:
     - `materialAssignments`: `{ materialName: { assetId, dataUrl, kind, prompt, ... } }`
     - `materialTransforms`: `{ materialName: { offset, repeat, rotation, flipY } }`
   - On project load: re-apply `applyTexture()` and `updateMaterialTransform()`.
2. **Turnaround Attachment & Export**
   - Add turnaround generation UI and store outputs in project assets.
   - Add export bundle: images + manifests + project JSON.
3. **UX polish for UV workflow**
   - Add “Apply to category” bulk actions (face/hair/top/bottom) using `classifyMaterial()`.
   - Add a “UV template gallery” per material for iterative generations.
4. **Testing mandate for Phase 3 persistence work**
   - Frontend testing_agent_v3 after persistence:
     - Import VRM → UV → Lab → apply → tweak Fit sliders → save project → reload → verify textures + transforms restored.

