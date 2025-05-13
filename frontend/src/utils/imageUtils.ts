// utils/imageUtils.ts
export async function resizeImage(file: File, maxSize = 128): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const img = new Image();

    reader.onload = () => {
      if (!reader.result) return reject("Could not read image file.");

      img.onload = () => {
        const canvas = document.createElement("canvas");

        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        const width = img.width * scale;
        const height = img.height * scale;

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return reject("Could not get canvas context.");

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject("Image compression failed.");
            }
          },
          "image/jpeg", // or 'image/webp' for better compression
          0.6 // Quality setting: 0 = worst, 1 = best
        );
      };

      img.onerror = () => reject("Image failed to load.");
      img.src = reader.result as string;
    };

    reader.onerror = () => reject("Failed to read file.");
    reader.readAsDataURL(file);
  });
}
