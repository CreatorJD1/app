import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const http = axios.create({ baseURL: API_BASE, timeout: 300000 });

// Access-token support for split deployments (frontend on one origin, backend
// on another): same-origin deploys ride the vcs_token cookie the backend drops
// on a ?token= visit, but lax cookies don't travel on cross-site XHR — so we
// remember the token from the URL and send it as a header instead.
try {
  const urlToken = new URLSearchParams(window.location.search).get("token");
  if (urlToken) localStorage.setItem("vcs_token", urlToken);
  const stored = localStorage.getItem("vcs_token");
  if (stored) http.defaults.headers.common["X-VCS-Token"] = stored;
} catch (_) { /* SSR / storage-blocked environments: cookie path still works */ }

export const api = {
  health: () => http.get("/").then((r) => r.data),

  generateTexture: (prompt, kind = "texture", project_id = null) =>
    http.post("/generate/texture", { prompt, kind, project_id }).then((r) => r.data),
  generateConcept: (prompt, project_id = null) =>
    http.post("/generate/concept", { prompt, project_id }).then((r) => r.data),
  generateVariant: ({ prompt, reference_asset_id, reference_data_url, reference_data_urls, project_id }) =>
    http.post("/generate/variant", { prompt, reference_asset_id, reference_data_url, reference_data_urls, project_id }).then((r) => r.data),
  extractOutfit: ({ reference_data_url, reference_data_urls, notes, provider, project_id }) =>
    http.post("/extract/outfit", { reference_data_url, reference_data_urls, notes, provider, project_id }).then((r) => r.data),
  generateMaterialTexture: ({ uv_template_data_url, garment_data_url, original_atlas_data_url, region, description, palette, guard, provider, strength, mode, project_id }) =>
    http.post("/generate/material_texture", { uv_template_data_url, garment_data_url, original_atlas_data_url, region, description, palette, guard, provider, strength, mode, project_id }).then((r) => r.data),
  generateTurnaround: ({ character_desc, reference_asset_id, reference_data_url, project_id }) =>
    http.post("/generate/turnaround", { character_desc, reference_asset_id, reference_data_url, project_id }).then((r) => r.data),
  generateWardrobe: ({ theme, palette, pieces, project_id }) =>
    http.post("/generate/wardrobe", { theme, palette, pieces, project_id }).then((r) => r.data),
  generateAccessories: ({ theme, kinds, project_id }) =>
    http.post("/generate/accessories", { theme, kinds, project_id }).then((r) => r.data),

  analyzeCharacter: ({ reference_data_url, notes, project_id, generate_turnaround }) =>
    http.post("/analyze/character", { reference_data_url, notes, project_id, generate_turnaround }).then((r) => r.data),

  saveUpscale: ({ source_asset_id, data_url, width, height, label, project_id }) =>
    http.post("/assets/save_upscale", { source_asset_id, data_url, width, height, label, project_id }).then((r) => r.data),

  listAssets: (params = {}) => http.get("/assets", { params }).then((r) => r.data),
  deleteAsset: (id) => http.delete(`/assets/${id}`).then((r) => r.data),

  listProjects: () => http.get("/projects").then((r) => r.data),
  createProject: (name, description = "") =>
    http.post("/projects", { name, description }).then((r) => r.data),
  getProject: (id) => http.get(`/projects/${id}`).then((r) => r.data),
  updateProject: (id, patch) => http.patch(`/projects/${id}`, patch).then((r) => r.data),
  deleteProject: (id) => http.delete(`/projects/${id}`).then((r) => r.data),

  uploadVrm: (project_id, file) => {
    const fd = new FormData();
    fd.append("file", file);
    return http.post(`/projects/${project_id}/vrm`, fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
  },
  vrmUrl: (project_id) => `${API_BASE}/projects/${project_id}/vrm`,

  alpeccaPose: (speaking = false) =>
    http.get("/alpecca/pose", { params: { speaking } }).then((r) => r.data),

  vroidHubHelp: () => http.get("/vroid_hub/help").then((r) => r.data),
  vroidHubImportUrl: ({ project_id, url }) =>
    http.post("/vroid_hub/import_url", { project_id, url }).then((r) => r.data),
};
