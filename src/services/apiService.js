/**
 * API Service wrapper for ChronoShare endpoints
 */

export async function uploadShareableItem(formData) {
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
  return response.json();
}

export async function fetchFileMetadata(code) {
  const response = await fetch(`/api/file/${code}`);
  return response.json();
}

export async function downloadShareableItem(code, password) {
  const response = await fetch(`/api/download/${code}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return response;
}

export async function deleteShareableItem(code, deleteToken) {
  const response = await fetch(`/api/delete/${code}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deleteToken }),
  });
  return response.json();
}

export async function fetchServerStats() {
  const response = await fetch('/api/stats');
  if (!response.ok) return null;
  return response.json();
}
