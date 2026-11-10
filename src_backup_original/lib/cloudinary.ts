// =============================================================================
// CLOUDINARY — Centralised Image Upload Utility
// Cloud Name : c7xpodk5
// Upload Preset: akdcrm (unsigned)
// =============================================================================

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string;

export const isCloudinaryConfigured = Boolean(
  CLOUD_NAME &&
    UPLOAD_PRESET &&
    !CLOUD_NAME.includes('your-cloud') &&
    !UPLOAD_PRESET.includes('your-preset')
);

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  asset_id: string;
  format: string;
  bytes: number;
}

/**
 * Upload a File to Cloudinary using an unsigned upload preset.
 * Returns the secure HTTPS URL of the uploaded asset.
 *
 * @param file    - The File object to upload
 * @param folder  - Optional Cloudinary folder path e.g. "akd-crm/projects/proj-123"
 */
export async function uploadToCloudinary(
  file: File,
  folder?: string
): Promise<CloudinaryUploadResult> {
  if (!isCloudinaryConfigured) {
    throw new Error('Cloudinary is not configured. Check VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in your .env file.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  if (folder) {
    formData.append('folder', folder);
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(
      `Cloudinary upload failed: ${(errData as any)?.error?.message || response.statusText}`
    );
  }

  const data = await response.json() as CloudinaryUploadResult;
  return data;
}

/**
 * Delete an image from Cloudinary by public_id.
 * NOTE: Deletion from client-side requires a signed request (needs secret key).
 * For unsigned presets, we skip actual deletion — images auto-expire or are
 * managed from the Cloudinary dashboard.
 * This function is a no-op placeholder for future signed-delete integration.
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  // Client-side deletion requires a signed API call (secret key not safe in browser).
  // Images can be managed/deleted from the Cloudinary dashboard at:
  // https://console.cloudinary.com/app/c7xpodk5/assets
  console.info(`[Cloudinary] Photo ${publicId} can be removed from the Cloudinary dashboard.`);
}
