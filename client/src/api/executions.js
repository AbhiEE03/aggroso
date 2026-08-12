import axios from "axios";

const baseURL = (import.meta.env.VITE_API_URL || "/api") + "/executions";
const api = axios.create({ baseURL });

export const getExecution = (id) => api.get(`/${id}`);
export const listExecutions = (params = {}) => api.get("/", { params });
export const approveStep = (executionId, stepNumber, approvedBy = "user") =>
	api.post(`/${executionId}/steps/${stepNumber}/approve`, { approvedBy });
export const rejectStep = (executionId, stepNumber, rejectedBy = "user") =>
	api.post(`/${executionId}/steps/${stepNumber}/reject`, { rejectedBy });
export const cancelExecution = (executionId) =>
	api.post(`/${executionId}/cancel`);
export const getExecutionAuditLog = (id) => api.get(`/${id}/audit-log`);

export default api;
