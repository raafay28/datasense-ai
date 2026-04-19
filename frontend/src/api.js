import axios from "axios";

// In development, proxy handles it (localhost:5000)
// In production, this points to your Render backend
const API_BASE = process.env.REACT_APP_API_URL || "";

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

export default api;
