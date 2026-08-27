import { invokeFunction } from '@/lib/supabase';

interface UploadCredentials {
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
  folder: string;
  fileName: string;
}

/** Mints a one-time signed ImageKit upload token (`owner-photo-upload`). */
async function mintUploadCredentials(): Promise<UploadCredentials> {
  return invokeFunction<UploadCredentials>('owner-photo-upload', {});
}

/**
 * Uploads a photo straight to ImageKit from the browser, using a token
 * minted server-side so the ImageKit private key never reaches the client.
 * Returns the resulting ImageKit file path (relative, the same shape every
 * other `image_path`/`about_photo_path` value in this app already uses).
 */
export async function uploadOwnerPhoto(file: File): Promise<string> {
  const creds = await mintUploadCredentials();

  const form = new FormData();
  form.append('file', file);
  form.append('publicKey', creds.publicKey);
  form.append('token', creds.token);
  form.append('expire', String(creds.expire));
  form.append('signature', creds.signature);
  form.append('folder', creds.folder);
  form.append('fileName', creds.fileName);
  form.append('useUniqueFileName', 'true');

  const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    throw new Error('The photo could not be uploaded. Please try again.');
  }

  const data = (await res.json()) as { filePath?: string };
  if (!data.filePath) {
    throw new Error('The photo could not be uploaded. Please try again.');
  }

  return data.filePath;
}
