const relative_url = "/api"; // Used in production when backend hosts the frontend
const dev_url = "http://localhost:5360/api";

// Use relative URL in production, dev URL in development
export const API_BASE_URL = import.meta.env.PROD ? relative_url : dev_url;
