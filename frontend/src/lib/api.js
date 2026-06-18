// src/lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export async function fetchApi(endpoint, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt_token') : null;
  
  let path = endpoint;
  if (path.startsWith('/api')) {
    path = path.substring(4);
  }
  
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData = {};
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      errorData = await response.json().catch(() => ({}));
    } else {
      const text = await response.text().catch(() => "");
      errorData = { message: text || `API Error: ${response.statusText}` };
    }

    if (response.status === 401) {
      const isAuthEndpoint = path.startsWith('/v1/auth') || path === '/me' || path.includes('/auth/');
      const isSessionExpired = errorData.error_code === 'session_expired';

      if (isAuthEndpoint || isSessionExpired) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('jwt_token');
          window.location.href = '/login';
        }
      }
    }
    throw new Error(errorData.detail || errorData.message || `API Error: ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}
