import { create } from "zustand";

export const defaultTransform = () => ({
  offset: [0, 0],
  repeat: [1, 1],
  rotation: 0,
  flipY: true,
});

export const useStudioStore = create((set, get) => ({
  project: null,
  setProject: (project) => set({ project }),

  vrmUrl: null,
  vrmFilename: null,
  setVrm: (vrmUrl, vrmFilename) => set({ vrmUrl, vrmFilename }),
  clearVrm: () => set({ vrmUrl: null, vrmFilename: null }),

  expressions: {},
  setExpression: (name, value) => set((s) => ({ expressions: { ...s.expressions, [name]: value } })),
  resetExpressions: () => set({ expressions: {} }),
  availableExpressions: [],
  setAvailableExpressions: (list) => set({ availableExpressions: list }),
  availableMaterials: [],
  setAvailableMaterials: (list) => set({ availableMaterials: list }),

  materialAssignments: {},
  assignMaterial: (materialName, asset) =>
    set((s) => ({ materialAssignments: { ...s.materialAssignments, [materialName]: asset } })),
  clearMaterialAssignment: (materialName) =>
    set((s) => { const next = { ...s.materialAssignments }; delete next[materialName]; return { materialAssignments: next }; }),

  // Per-material 2D texture transforms — offset [x,y], repeat [x,y], rotation (rad), flipY
  materialTransforms: {},
  setMaterialTransform: (materialName, transform) =>
    set((s) => ({ materialTransforms: { ...s.materialTransforms, [materialName]: { ...(s.materialTransforms[materialName] || defaultTransform()), ...transform } } })),
  resetMaterialTransform: (materialName) =>
    set((s) => { const next = { ...s.materialTransforms }; delete next[materialName]; return { materialTransforms: next }; }),

  // Cross-dialog handoff: user extracts a UV template in MaterialsPanel and
  // Texture Lab reference tab picks it up automatically.
  pendingUvReference: null,
  setPendingUvReference: (payload) => set({ pendingUvReference: payload }),
  clearPendingUvReference: () => set({ pendingUvReference: null }),


  // Animation
  animationClip: "idle",
  setAnimationClip: (clip) => set({ animationClip: clip }),
  animationSpeed: 1.0,
  setAnimationSpeed: (v) => set({ animationSpeed: v }),
  animationLoop: true,
  setAnimationLoop: (v) => set({ animationLoop: v }),
  animationDuration: 0, // 0 = no override; otherwise seconds
  setAnimationDuration: (v) => set({ animationDuration: v }),
  talkEmotion: "neutral", // neutral | happy | sad | angry | surprised | relaxed
  setTalkEmotion: (v) => set({ talkEmotion: v }),
  autoBlink: true,
  setAutoBlink: (v) => set({ autoBlink: v }),
  lookAtMouse: true,
  setLookAtMouse: (v) => set({ lookAtMouse: v }),

  // Pose
  boneOffsets: {},
  setBoneOffset: (bone, axis, value) =>
    set((s) => ({
      boneOffsets: {
        ...s.boneOffsets,
        [bone]: { ...(s.boneOffsets[bone] || { x: 0, y: 0, z: 0 }), [axis]: value },
      },
    })),
  setBoneOffsetFull: (bone, off) =>
    set((s) => ({ boneOffsets: { ...s.boneOffsets, [bone]: { ...off } } })),
  resetBoneOffsets: () => set({ boneOffsets: {} }),
  poseSafetyEnabled: true,
  setPoseSafetyEnabled: (v) => set({ poseSafetyEnabled: v }),

  // Procedural animation keyframes
  customFrames: [], // [{id, time, boneOffsets, expressions}]
  addKeyframe: (time) =>
    set((s) => {
      const kf = {
        id: `kf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        time,
        boneOffsets: JSON.parse(JSON.stringify(s.boneOffsets || {})),
        expressions: { ...(s.expressions || {}) },
      };
      return { customFrames: [...s.customFrames, kf].sort((a, b) => a.time - b.time) };
    }),
  removeKeyframe: (id) => set((s) => ({ customFrames: s.customFrames.filter((k) => k.id !== id) })),
  clearKeyframes: () => set({ customFrames: [] }),
  updateKeyframeTime: (id, newTime) =>
    set((s) => ({
      customFrames: s.customFrames
        .map((k) => (k.id === id ? { ...k, time: newTime } : k))
        .sort((a, b) => a.time - b.time),
    })),
  applyKeyframeToScene: (id) => {
    const kf = get().customFrames.find((k) => k.id === id);
    if (!kf) return;
    set({ boneOffsets: JSON.parse(JSON.stringify(kf.boneOffsets || {})), expressions: { ...(kf.expressions || {}) } });
  },

  // Lighting
  lightingPreset: "studio",
  setLightingPreset: (v) => set({ lightingPreset: v }),
  background: "gradient",
  setBackground: (v) => set({ background: v }),
  backgroundColor: "#0F1318",
  setBackgroundColor: (v) => set({ backgroundColor: v }),

  // HQ / subdivision
  subdivisionLevel: 0, // 0 = off, 1 or 2 = iterations
  setSubdivisionLevel: (v) => set({ subdivisionLevel: v }),
  subdivideRequest: 0,
  requestSubdivideApply: () => set((s) => ({ subdivideRequest: s.subdivideRequest + 1 })),

  // Recent assets
  recentAssets: [],
  addRecentAsset: (asset) => set((s) => ({ recentAssets: [asset, ...s.recentAssets].slice(0, 60) })),
  bumpAssets: 0,
  bumpAssetsList: () => set((s) => ({ bumpAssets: s.bumpAssets + 1 })),

  // UI
  isTextureLabOpen: false,
  setTextureLabOpen: (v) => set({ isTextureLabOpen: v }),
  isReferenceStudioOpen: false,
  setReferenceStudioOpen: (v) => set({ isReferenceStudioOpen: v }),
  isProjectsOpen: false,
  setProjectsOpen: (v) => set({ isProjectsOpen: v }),
  isSettingsOpen: false,
  setSettingsOpen: (v) => set({ isSettingsOpen: v }),
  isAnalyzerOpen: false,
  setAnalyzerOpen: (v) => set({ isAnalyzerOpen: v }),

  screenshotRequest: 0,
  requestScreenshot: () => set((s) => ({ screenshotRequest: s.screenshotRequest + 1 })),
}));
