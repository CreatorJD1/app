import { create } from "zustand";

export const useStudioStore = create((set, get) => ({
  // Project
  project: null,
  setProject: (project) => set({ project }),

  // VRM state
  vrmUrl: null,
  vrmFilename: null,
  setVrm: (vrmUrl, vrmFilename) => set({ vrmUrl, vrmFilename }),
  clearVrm: () => set({ vrmUrl: null, vrmFilename: null }),

  // Expression values (0..1) e.g. {happy: 0.5, blink: 0.2}
  expressions: {},
  setExpression: (name, value) =>
    set((s) => ({ expressions: { ...s.expressions, [name]: value } })),
  resetExpressions: () => set({ expressions: {} }),

  // Available expression names discovered from loaded VRM
  availableExpressions: [],
  setAvailableExpressions: (list) => set({ availableExpressions: list }),

  // Available materials discovered from loaded VRM
  availableMaterials: [], // [{name, uuid}]
  setAvailableMaterials: (list) => set({ availableMaterials: list }),

  // Material assignments (materialName -> assetId + dataUrl)
  materialAssignments: {},
  assignMaterial: (materialName, asset) =>
    set((s) => ({
      materialAssignments: { ...s.materialAssignments, [materialName]: asset },
    })),
  clearMaterialAssignment: (materialName) =>
    set((s) => {
      const next = { ...s.materialAssignments };
      delete next[materialName];
      return { materialAssignments: next };
    }),

  // Animation state
  animationClip: "idle", // idle | wave | dance | walk | sit | none
  setAnimationClip: (clip) => set({ animationClip: clip }),
  animationSpeed: 1.0,
  setAnimationSpeed: (v) => set({ animationSpeed: v }),
  autoBlink: true,
  setAutoBlink: (v) => set({ autoBlink: v }),
  lookAtMouse: true,
  setLookAtMouse: (v) => set({ lookAtMouse: v }),

  // Bone rotations (radians) for pose editing
  boneOffsets: {}, // {boneName: {x,y,z}}
  setBoneOffset: (bone, axis, value) =>
    set((s) => ({
      boneOffsets: {
        ...s.boneOffsets,
        [bone]: { ...(s.boneOffsets[bone] || { x: 0, y: 0, z: 0 }), [axis]: value },
      },
    })),
  resetBoneOffsets: () => set({ boneOffsets: {} }),

  // Lighting / camera
  lightingPreset: "studio", // studio | soft | rim | sunset
  setLightingPreset: (v) => set({ lightingPreset: v }),
  background: "gradient", // gradient | color | transparent
  setBackground: (v) => set({ background: v }),
  backgroundColor: "#0F1318",
  setBackgroundColor: (v) => set({ backgroundColor: v }),

  // Recent assets in current session
  recentAssets: [],
  addRecentAsset: (asset) =>
    set((s) => ({ recentAssets: [asset, ...s.recentAssets].slice(0, 40) })),

  // UI state
  isTextureLabOpen: false,
  setTextureLabOpen: (v) => set({ isTextureLabOpen: v }),
  isReferenceStudioOpen: false,
  setReferenceStudioOpen: (v) => set({ isReferenceStudioOpen: v }),
  isProjectsOpen: false,
  setProjectsOpen: (v) => set({ isProjectsOpen: v }),
  isSettingsOpen: false,
  setSettingsOpen: (v) => set({ isSettingsOpen: v }),

  // Screenshot request (increments to trigger snap)
  screenshotRequest: 0,
  requestScreenshot: () => set((s) => ({ screenshotRequest: s.screenshotRequest + 1 })),
}));
