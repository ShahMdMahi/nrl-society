"use client";

/**
 * Image compression utilities for client-side image processing
 * Compresses images before upload to reduce bandwidth and storage costs
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1
  maxSizeKB?: number;
  outputType?: "image/jpeg" | "image/webp" | "image/png";
}

const defaultOptions: CompressionOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
  maxSizeKB: 1024, // 1MB
  outputType: "image/jpeg",
};

/**
 * Compress an image file
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Compressed file or original if compression not needed
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const opts = { ...defaultOptions, ...options };

  // Skip compression for GIFs (animated) and already small files
  if (file.type === "image/gif") {
    return file;
  }

  // Skip if file is already smaller than target
  if (opts.maxSizeKB && file.size <= opts.maxSizeKB * 1024) {
    // Still resize if needed
    const needsResize = await checkIfResizeNeeded(file, opts);
    if (!needsResize) {
      return file;
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      const maxW = opts.maxWidth || defaultOptions.maxWidth!;
      const maxH = opts.maxHeight || defaultOptions.maxHeight!;

      if (width > maxW || height > maxH) {
        const ratio = Math.min(maxW / width, maxH / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;

      // Draw image with white background (for transparent PNGs)
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob with compression
      const outputType = opts.outputType || "image/jpeg";
      let quality = opts.quality || 0.8;

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            resolve(file); // Return original if compression fails
            return;
          }

          // If still too large, reduce quality iteratively
          if (opts.maxSizeKB && blob.size > opts.maxSizeKB * 1024) {
            const compressedBlob = await reduceQuality(
              canvas,
              outputType,
              opts.maxSizeKB * 1024,
              quality
            );
            const compressedFile = new File([compressedBlob], file.name, {
              type: outputType,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            const compressedFile = new File([blob], file.name, {
              type: outputType,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          }
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      resolve(file); // Return original if loading fails
    };

    // Load image from file
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      resolve(file);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Check if image needs resizing based on dimensions
 */
async function checkIfResizeNeeded(
  file: File,
  opts: CompressionOptions
): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxW = opts.maxWidth || defaultOptions.maxWidth!;
      const maxH = opts.maxHeight || defaultOptions.maxHeight!;
      resolve(img.width > maxW || img.height > maxH);
    };
    img.onerror = () => resolve(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Iteratively reduce quality to meet size target
 */
async function reduceQuality(
  canvas: HTMLCanvasElement,
  outputType: string,
  maxSize: number,
  startQuality: number
): Promise<Blob> {
  let quality = startQuality;
  let blob: Blob | null = null;

  while (quality > 0.1) {
    blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), outputType, quality);
    });

    if (blob && blob.size <= maxSize) {
      return blob;
    }

    quality -= 0.1;
  }

  // Return the smallest we could get
  return (
    blob ||
    (await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), outputType, 0.1);
    }))
  );
}

/**
 * Compress multiple images in parallel
 */
export async function compressImages(
  files: File[],
  options: CompressionOptions = {}
): Promise<File[]> {
  return Promise.all(files.map((file) => compressImage(file, options)));
}

/**
 * Get file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
