import axios from 'axios';

const api = axios.create({ baseURL: '/api/executions' });

export const getExecution = (id) => api.get(`/${id}`);
export const listExecutions = (params = {}) => api.get('/', { params });
export const approveStep = (executionId, stepNumber, approvedBy = 'user') =>
  api.post(`/${executionId}/steps/${stepNumber}/approve`, { approvedBy });
export const rejectStep = (executionId, stepNumber, rejectedBy = 'user') =>
  api.post(`/${executionId}/steps/${stepNumber}/reject`, { rejectedBy });
export const cancelExecution = (executionId) =>
  api.post(`/${executionId}/cancel`);

export default api;
