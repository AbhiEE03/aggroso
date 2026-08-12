import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
	baseURL: baseURL,
	headers: { "Content-Type": "application/json" },
});

// ── Skills API ────────────────────────────────

/** Fetch all skills. Optional ?status=draft|published */
export const getSkills = (status) =>
	api.get("/skills", { params: status ? { status } : {} });

/** Fetch a single skill by ID */
export const getSkill = (id) => api.get(`/skills/${id}`);

/** Create a new skill (always starts as draft) */
export const createSkill = (data) => api.post("/skills", data);

/** Update a draft skill */
export const updateSkill = (id, data) => api.put(`/skills/${id}`, data);

/** Publish a draft skill */
export const publishSkill = (id) => api.post(`/skills/${id}/publish`);

/** Run a read-only test against a skill with sample input */
export const testSkill = (id, sampleInput) =>
	api.post(`/skills/${id}/test`, { sampleInput });

/** Execute a published skill with real Gemini planning */
export const executeSkill = (id, input) =>
	api.post(`/skills/${id}/execute`, { input });

/** Fetch all versions of a skill */
export const getSkillVersions = (id) => api.get(`/skills/${id}/versions`);

/** Compare two versions of a skill */
export const compareSkillVersions = (from, to) =>
  api.get(`/skills/versions/compare`, { params: { from, to } });

export default api;
