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
  // Apply a full named face look at once (replaces current weights).
  applyExpressionSet: (obj) => set({ expressions: { ...(obj || {}) } }),
  // Named expression presets — save/load face looks, persisted to localStorage.
  expressionPresets: (() => {
    try { return JSON.parse(localStorage.getItem("vcs.exprPresets") || "[]"); } catch (_) { return []; }
  })(),
  saveExpressionPreset: (name) => set((s) => {
    const clean = { ...s.expressions };
    for (const k of Object.keys(clean)) if (!clean[k]) delete clean[k]; // drop zeros
    const preset = {
      id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: (name || `Look ${s.expressionPresets.length + 1}`).trim(),
      expressions: clean,
    };
    const next = [...s.expressionPresets.filter((p) => p.name !== preset.name), preset];
    try { localStorage.setItem("vcs.exprPresets", JSON.stringify(next)); } catch (_) { /* quota */ }
    return { expressionPresets: next };
  }),
  applyExpressionPreset: (id) => set((s) => {
    const p = s.expressionPresets.find((x) => x.id === id);
    return p ? { expressions: { ...p.expressions } } : {};
  }),
  deleteExpressionPreset: (id) => set((s) => {
    const next = s.expressionPresets.filter((x) => x.id !== id);
    try { localStorage.setItem("vcs.exprPresets", JSON.stringify(next)); } catch (_) { /* ignore */ }
    return { expressionPresets: next };
  }),
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
  setAnimationClip: (clip) => set({ animationClip: clip, vrmaUrl: null }),
  // Real VRM Animation (.vrma) playback. When vrmaUrl is set it takes over from
  // the procedural clips; picking a procedural clip clears it.
  vrmaUrl: null,
  vrmaName: "",
  setVrma: (url, name) => set({ vrmaUrl: url, vrmaName: name }),
  clearVrma: () => set({ vrmaUrl: null, vrmaName: "" }),
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
  // Live driver: mirror Alpecca's real mood/voice state onto the clip + emotion
  alpeccaLive: false,
  setAlpeccaLive: (v) => set({ alpeccaLive: v }),
  alpeccaStatus: "", // last driver status line for the UI
  setAlpeccaStatus: (v) => set({ alpeccaStatus: v }),

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
  // Bloom (emissive glow) — how strongly bright/emissive pixels halo.
  bloomStrength: 0.55,
  setBloomStrength: (v) => set({ bloomStrength: v }),

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
