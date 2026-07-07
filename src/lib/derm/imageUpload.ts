// Lightweight client-side image compression for demo-safe visual evidence.
// No AI, no OCR, no diagnostic interpretation — just resize + JPEG re-encode.

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
export const ACCEPTED_IMAGE_EXT = ".jpg,.jpeg,.png,.webp";

// Post-compression size cap for the data URL string (base64 chars).
// ~700KB base64 ≈ ~520KB decoded — safe for a demo text field.
export const MAX_DATA_URL_CHARS = 700_000;

// Max raw file size we'll even try to compress (30MB).
export const MAX_RAW_FILE_BYTES = 30 * 1024 * 1024;

export interface CompressedImage {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
}

export interface CompressResult {
  ok: boolean;
  image?: CompressedImage;
  error?: string;
}

export async function compressImageFile(
  file: File,
  opts: { maxDim?: number; quality?: number } = {},
): Promise<CompressResult> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return {
      ok: false,
      error: "Unsupported file type. Please upload a JPG, PNG, or WEBP image.",
    };
  }
  if (file.size > MAX_RAW_FILE_BYTES) {
    return {
      ok: false,
      error: "Image is too large. Please upload a smaller image (under 30MB).",
    };
  }

  const maxDim = opts.maxDim ?? 1024;
  const quality = opts.quality ?? 0.8;

  try {
    const objectUrl = URL.createObjectURL(file);
    const img = await loadImage(objectUrl);
    URL.revokeObjectURL(objectUrl);

    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { ok: false, error: "Browser could not process this image." };
    }
    ctx.drawImage(img, 0, 0, w, h);

    let dataUrl = canvas.toDataURL("image/jpeg", quality);

    // If still too large, try a stricter pass.
    if (dataUrl.length > MAX_DATA_URL_CHARS) {
      const w2 = Math.round(w * 0.75);
      const h2 = Math.round(h * 0.75);
      const c2 = document.createElement("canvas");
      c2.width = w2;
      c2.height = h2;
      const cx2 = c2.getContext("2d");
      if (cx2) {
        cx2.drawImage(img, 0, 0, w2, h2);
        dataUrl = c2.toDataURL("image/jpeg", 0.65);
      }
    }

    if (dataUrl.length > MAX_DATA_URL_CHARS) {
      return {
        ok: false,
        error:
          "Image is too large even after compression. Please upload a smaller image.",
      };
    }

    return {
      ok: true,
      image: {
        dataUrl,
        width: w,
        height: h,
        bytes: dataUrl.length,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: `Could not read image: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = src;
  });
}
