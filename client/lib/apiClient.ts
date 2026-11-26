import axios from "axios";

const TOKEN_KEY = "intelinota_admin_token";
const SESSION_KEY = "intelinota_session_id";

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

axios.interceptors.request.use((config) => {
  if (config.url?.startsWith("/api")) {
    config.headers["X-Session-Id"] = getSessionId();
  }

  const token = localStorage.getItem(TOKEN_KEY);
  if (token && config.url?.startsWith("/api/admin")) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default axios;
