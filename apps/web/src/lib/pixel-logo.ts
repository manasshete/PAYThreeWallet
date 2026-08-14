export type LogoPixel = { gx: number; gy: number; id: string };

export type PixelGrid = {
  pixels: LogoPixel[];
  cols: number;
  rows: number;
  step: number;
};

const MAX_PIXELS = 320;
const gridCache = new Map<string, Promise<PixelGrid>>();

export function extractLogoPixels(
  src: string,
  startStep = 4
): Promise<PixelGrid> {
  const key = `${src}:${startStep}`;
  const cached = gridCache.get(key);
  if (cached) return cached;

  const promise = new Promise<PixelGrid>((resolve, reject) => {
    const img = new window.Image();
    img.src = src;
    img.onload = () => {
      let step = startStep;

      const sample = (sampleStep: number): PixelGrid => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return { pixels: [], cols: 0, rows: 0, step: sampleStep };

        ctx.drawImage(img, 0, 0);
        const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);
        const pixels: LogoPixel[] = [];

        for (let y = 0; y < height; y += sampleStep) {
          for (let x = 0; x < width; x += sampleStep) {
            const i = (y * width + x) * 4;
            const alpha = data[i + 3];
            const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
            if (alpha > 80 && brightness > 80) {
              pixels.push({
                gx: Math.floor(x / sampleStep),
                gy: Math.floor(y / sampleStep),
                id: `${x}-${y}`,
              });
            }
          }
        }

        return {
          pixels,
          cols: Math.ceil(width / sampleStep),
          rows: Math.ceil(height / sampleStep),
          step: sampleStep,
        };
      };

      let grid = sample(step);
      while (grid.pixels.length > MAX_PIXELS && step < 16) {
        step += 2;
        grid = sample(step);
      }

      resolve(grid);
    };
    img.onerror = () => reject(new Error("logo load failed"));
  });

  gridCache.set(key, promise);
  return promise;
}
