import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const http = axios.create({ baseURL: API_BASE, timeout: 180000 });

export const api = {
  health: () => http.get("/").then((r) => r.data),

  // Generation
  generateTexture: (prompt, kind = "texture", project_id = null) =>
    http.post("/generate/texture", { prompt, kind, project_id }).then((r) => r.data),
  generateConcept: (prompt, project_id = null) =>
    http.post("/generate/concept", { prompt, project_id }).then((r) => r.data),
  generateVariant: ({ prompt, reference_asset_id, reference_data_url, project_id }) =>
    http.post("/generate/variant", { prompt, reference_asset_id, reference_data_url, project_id }).then((r) => r.data),
  generateTurnaround: ({ character_desc, reference_asset_id, reference_data_url, project_id }) =>
    http.post("/generate/turnaround", { character_desc, reference_asset_id, reference_data_url, project_id }).then((r) => r.data),

  // Assets
  listAssets: (params = {}) => http.get("/assets", { params }).then((r) => r.data),
  deleteAsset: (id) => http.delete(`/assets/${id}`).then((r) => r.data),

  // Projects
  listProjects: () => http.get("/projects").then((r) => r.data),
  createProject: (name, description = "") =>
    http.post("/projects", { name, description }).then((r) => r.data),
  getProject: (id) => http.get(`/projects/${id}`).then((r) => r.data),
  updateProject: (id, patch) => http.patch(`/projects/${id}`, patch).then((r) => r.data),
  deleteProject: (id) => http.delete(`/projects/${id}`).then((r) => r.data),

  // VRM
  uploadVrm: (project_id, file) => {
    const fd = new FormData();
    fd.append("file", file);
    return http
      .post(`/projects/${project_id}/vrm`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
  vrmUrl: (project_id) => `${API_BASE}/projects/${project_id}/vrm`,
};
