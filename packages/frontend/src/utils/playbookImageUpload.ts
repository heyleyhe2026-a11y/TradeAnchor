const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function uploadPlaybookImage(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('IMAGE_TOO_LARGE');
  }

  const token = localStorage.getItem('accessToken');
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch('/api/v1/playbooks/upload-image', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) throw new Error('UPLOAD_FAILED');

  const data = await res.json();
  if (!data.success || !data.url) throw new Error('NO_URL');

  return data.url as string;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('READ_FAILED'));
    reader.readAsDataURL(file);
  });
}

export async function uploadPlaybookImageWithFallback(file: File): Promise<string> {
  try {
    return await uploadPlaybookImage(file);
  } catch {
    return readFileAsDataUrl(file);
  }
}
