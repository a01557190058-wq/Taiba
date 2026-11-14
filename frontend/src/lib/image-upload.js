import { api } from './api.js';

/**
 * Browser-side image preparation shared by the dashboard editors.
 *
 * Photos are downscaled and re-encoded before upload so large phone photos
 * stay within the server limit without failing. GIFs are uploaded untouched
 * because re-encoding would freeze their animation.
 */
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024; // the browser downscales before upload
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function loadImageSource(file) {
  if (typeof createImageBitmap === 'function') {
    // `from-image` honours the EXIF orientation of phone photos.
    return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() =>
      createImageBitmap(file)
    );
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('تعذّر قراءة الصورة.'));
    };
    image.src = url;
  });
}

/** Downscales an image to fit within `maxSize` and re-encodes it as JPEG. */
export async function resizeImage(file, maxSize, suffix = 'image', quality = 0.86) {
  if (file.type === 'image/gif') return file;

  const source = await loadImageSource(file);
  const width = source.width;
  const height = source.height;
  if (!width || !height) throw new Error('أبعاد الصورة غير صالحة.');

  const scale = Math.min(1, maxSize / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('تعذّر تجهيز الصورة.');
  // A white background keeps transparent PNGs looking right as JPEG.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(source, 0, 0, targetWidth, targetHeight);
  if (typeof source.close === 'function') source.close();

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality)
  );
  if (!blob) throw new Error('تعذّر ضغط الصورة.');

  const base = (file.name || 'photo').replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${base}-${suffix}.jpg`, { type: 'image/jpeg' });
}

/** Uploads already-prepared files and returns the server file descriptors. */
export async function uploadImageFiles(endpoint, files) {
  const formData = new FormData();
  files.forEach((file) => formData.append('images', file));
  const data = await api(endpoint, { method: 'POST', body: formData });
  return data && Array.isArray(data.files) ? data.files : [];
}

/** Resizes and uploads one image, returning its public URL. */
export async function uploadImage(endpoint, file, maxSize) {
  const prepared = await resizeImage(file, maxSize);
  const uploaded = await uploadImageFiles(endpoint, [prepared]);
  if (!uploaded.length) throw new Error('لم يتم استلام الملف من الخادم.');
  return uploaded[0].url;
}
