export const GAME_ITEM_IMAGE_SPEC = {
  standardSizePx: 128,
  standardWidth: 128,
  standardHeight: 128,
  slotDisplaySizePx: 64,
  aspectRatio: '1:1 (квадрат)',
  maxFileSizeBytes: 10 * 1024 * 1024, // до 10 МБ исходник (авто-сжатие до ~15–40 КБ)
  maxFileSizeLabel: '2 МБ (2048 КБ)',
  recommendedWeightLabel: 'до 150 КБ (авто-сжатие до ~15–40 КБ)',
  allowedMimeTypes: [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'image/bmp',
    'image/avif'
  ],
  allowedFormatsLabel: 'PNG, JPG/JPEG, WEBP, GIF, SVG'
};

export interface ProcessedItemImageResult {
  ok: boolean;
  success: boolean;
  dataUrl?: string;
  width?: number;
  height?: number;
  originalWidth?: number;
  originalHeight?: number;
  originalSizeKb?: number;
  finalSizeKb?: number;
  compressedSizeKb?: number;
  error?: string;
}

/**
 * Validates and converts an uploaded image file to the standard 128x128 (1:1) square game item icon format
 * using 'cover' mode ("Заполнить квадрат 1:1").
 */
export async function processUploadedItemImage(
  file: File,
  _fitMode: 'cover' | 'contain' = 'cover'
): Promise<ProcessedItemImageResult> {
  if (!file) {
    return { ok: false, success: false, error: 'Файл не выбран.' };
  }

  const originalSizeKb = Math.max(1, Math.round(file.size / 1024));

  const isAllowedType =
    !file.type ||
    file.type.startsWith('image/') ||
    GAME_ITEM_IMAGE_SPEC.allowedMimeTypes.includes(file.type) ||
    /\.(png|jpe?g|webp|gif|svg|bmp|avif|jfif|heic)$/i.test(file.name);

  if (!isAllowedType) {
    return {
      ok: false,
      success: false,
      error: `Неподдерживаемый формат файла. Разрешены: ${GAME_ITEM_IMAGE_SPEC.allowedFormatsLabel}.`
    };
  }

  if (file.size > GAME_ITEM_IMAGE_SPEC.maxFileSizeBytes) {
    return {
      ok: false,
      success: false,
      error: `Файл слишком большой (${originalSizeKb} КБ). Пожалуйста, выберите картинку меньшего веса.`
    };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => {
      resolve({ ok: false, success: false, error: 'Не удалось прочитать выбранный файл.' });
    };
    reader.onload = () => {
      const srcData = reader.result as string;
      const isGif =
        file.type === 'image/gif' ||
        /\.gif$/i.test(file.name) ||
        (typeof srcData === 'string' && srcData.startsWith('data:image/gif'));

      // IMPORTANT: If the uploaded file is an animated GIF, do NOT draw it onto an HTML5 <canvas>,
      // because canvas flattens GIFs into a static single frame! Return the GIF dataUrl directly.
      if (isGif && srcData) {
        const imgCheck = new Image();
        imgCheck.onload = () => {
          resolve({
            ok: true,
            success: true,
            dataUrl: srcData,
            width: imgCheck.naturalWidth || 128,
            height: imgCheck.naturalHeight || 128,
            originalWidth: imgCheck.naturalWidth || 128,
            originalHeight: imgCheck.naturalHeight || 128,
            originalSizeKb,
            finalSizeKb: originalSizeKb,
            compressedSizeKb: originalSizeKb
          });
        };
        imgCheck.onerror = () => {
          resolve({
            ok: true,
            success: true,
            dataUrl: srcData,
            width: 128,
            height: 128,
            originalWidth: 128,
            originalHeight: 128,
            originalSizeKb,
            finalSizeKb: originalSizeKb,
            compressedSizeKb: originalSizeKb
          });
        };
        imgCheck.src = srcData;
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const targetSize = GAME_ITEM_IMAGE_SPEC.standardSizePx; // 128x128 standard square
          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({ ok: false, success: false, error: 'Ошибка обработки изображения (Canvas).' });
            return;
          }

          ctx.clearRect(0, 0, targetSize, targetSize);

          const srcW = Math.max(1, img.naturalWidth || img.width || targetSize);
          const srcH = Math.max(1, img.naturalHeight || img.height || targetSize);

          // Строго режим "Заполнить квадрат (1:1)" (cover) без ошибок и пустых полей
          const scale = Math.max(targetSize / srcW, targetSize / srcH);
          const drawW = srcW * scale;
          const drawH = srcH * scale;
          const offsetX = (targetSize - drawW) / 2;
          const offsetY = (targetSize - drawH) / 2;
          ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

          // Prefer WebP for compact storage in Supabase JSONB, fallback to PNG/JPEG
          let dataUrl = '';
          try {
            dataUrl = canvas.toDataURL('image/webp', 0.86);
          } catch {
            dataUrl = '';
          }
          if (!dataUrl || !dataUrl.startsWith('data:image/webp')) {
            try {
              dataUrl = canvas.toDataURL('image/png');
            } catch {
              dataUrl = srcData;
            }
          }

          // If still somewhat large (>60KB), compress to 96x96 WebP/JPEG
          if (dataUrl.length > 65000) {
            const smallCanvas = document.createElement('canvas');
            smallCanvas.width = 96;
            smallCanvas.height = 96;
            const sCtx = smallCanvas.getContext('2d');
            if (sCtx) {
              sCtx.clearRect(0, 0, 96, 96);
              sCtx.drawImage(canvas, 0, 0, 96, 96);
              let smallerUrl = '';
              try {
                smallerUrl = smallCanvas.toDataURL('image/webp', 0.8);
              } catch {
                smallerUrl = '';
              }
              if (!smallerUrl || !smallerUrl.startsWith('data:image/webp')) {
                try {
                  smallerUrl = smallCanvas.toDataURL('image/jpeg', 0.82);
                } catch {
                  smallerUrl = '';
                }
              }
              if (smallerUrl && smallerUrl.startsWith('data:image/')) {
                dataUrl = smallerUrl;
              }
            }
          }

          const approxBytes = Math.round((dataUrl.length * 3) / 4);
          const compressedSizeKb = Math.max(1, Math.round(approxBytes / 1024));

          resolve({
            ok: true,
            success: true,
            dataUrl,
            width: srcW,
            height: srcH,
            originalWidth: srcW,
            originalHeight: srcH,
            originalSizeKb,
            finalSizeKb: compressedSizeKb,
            compressedSizeKb
          });
        } catch (_err) {
          // Fallback to raw dataUrl if canvas fails
          if (srcData && srcData.startsWith('data:image/')) {
            resolve({
              ok: true,
              success: true,
              dataUrl: srcData,
              width: 128,
              height: 128,
              originalSizeKb,
              finalSizeKb: originalSizeKb,
              compressedSizeKb: originalSizeKb
            });
          } else {
            resolve({
              ok: false,
              success: false,
              error: 'Ошибка при подгонке изображения под стандартный квадрат игры.'
            });
          }
        }
      };
      img.onerror = () => {
        resolve({
          ok: false,
          success: false,
          error: 'Файл поврежден или не является корректным изображением.'
        });
      };
      img.src = srcData;
    };
    reader.readAsDataURL(file);
  });
}

export const CLAN_EMBLEM_SPEC = {
  maxSizePx: 100, // максимальный размер 100х100 пикселей
  maxWidth: 100,
  maxHeight: 100,
  maxFileSizeBytes: 500 * 1024, // до 500 КБ для поддержки GIF и PNG/JPEG
  maxFileSizeKb: 200,
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'],
  allowedFormatsLabel: 'PNG, JPEG, GIF'
};

export const STANDARD_CLAN_ICONS = [
  '🛡️', '⚔️', '🦅', '🐉', '👑', '🐺', '🦁', '⚡',
  '⚜️', '🔱', '💀', '🧿', '🏹', '🔮', '🗡️', '🩸',
  '🏆', '🔥', '🦂', '🐍', '𓋹', '𓂀', '𓆣', '𓇳',
  '💎', '⭐', '☀️', '🌙', '🗿', '🚩', '🪐', '⚓'
];

export interface ClanEmblemGeneratorConfig {
  shape: 'shield' | 'circle' | 'diamond' | 'hexagon' | 'banner' | 'octagon';
  pattern: 'radial' | 'split_v' | 'split_h' | 'split_diag' | 'quarters' | 'rays' | 'chevron';
  primaryColor: string;
  secondaryColor: string;
  borderColor: string;
  symbol: string;
  customText?: string;
  crest: string;
  borderStyle: 'double' | 'rivets' | 'glow';
}

export const CLAN_EMBLEM_COLOR_PRESETS: {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  borderColor: string;
}[] = [
  { id: 'ra_gold', name: '☀️ Золото Ра', primaryColor: '#78350f', secondaryColor: '#d97706', borderColor: '#fde047' },
  { id: 'anubis_blood', name: '🩸 Кровь Анубиса', primaryColor: '#111827', secondaryColor: '#991b1b', borderColor: '#f87171' },
  { id: 'osiris_jade', name: '🐍 Изумруд Осириса', primaryColor: '#064e3b', secondaryColor: '#10b981', borderColor: '#6ee7b7' },
  { id: 'lunar_eclipse', name: '🌙 Затмение Луны', primaryColor: '#1e1b4b', secondaryColor: '#6d28d9', borderColor: '#c084fc' },
  { id: 'frost_pharaoh', name: '💎 Ледяной Трон', primaryColor: '#0c4a6e', secondaryColor: '#0284c7', borderColor: '#7dd3fc' },
  { id: 'royal_obsidian', name: '👑 Чёрный Обсидиан', primaryColor: '#090d16', secondaryColor: '#334155', borderColor: '#f59e0b' },
  { id: 'desert_storm', name: '🦂 Песчаная Буря', primaryColor: '#451a03', secondaryColor: '#b45309', borderColor: '#fcd34d' },
  { id: 'phoenix_flame', name: '🔥 Пламя Феникса', primaryColor: '#7f1d1d', secondaryColor: '#ea580c', borderColor: '#fde047' }
];

function traceEmblemShapePath(
  ctx: CanvasRenderingContext2D,
  shape: ClanEmblemGeneratorConfig['shape'],
  cx: number,
  cy: number,
  r: number
) {
  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
  } else if (shape === 'diamond') {
    ctx.moveTo(cx, cy - r * 1.04);
    ctx.lineTo(cx + r * 0.96, cy);
    ctx.lineTo(cx, cy + r * 1.04);
    ctx.lineTo(cx - r * 0.96, cy);
    ctx.closePath();
  } else if (shape === 'hexagon') {
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else if (shape === 'octagon') {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI / 4) * i - Math.PI / 8;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else if (shape === 'banner') {
    const top = cy - r * 0.95;
    const bottom = cy + r * 0.98;
    const left = cx - r * 0.82;
    const right = cx + r * 0.82;
    ctx.moveTo(left, top);
    ctx.lineTo(right, top);
    ctx.lineTo(right, bottom);
    ctx.lineTo(cx, bottom - r * 0.28);
    ctx.lineTo(left, bottom);
    ctx.closePath();
  } else {
    // Classic Heraldic Shield ('shield')
    const top = cy - r * 0.92;
    const bottom = cy + r * 1.02;
    const left = cx - r * 0.88;
    const right = cx + r * 0.88;
    ctx.moveTo(left, top);
    ctx.quadraticCurveTo(cx, top - r * 0.08, right, top);
    ctx.lineTo(right, cy - r * 0.05);
    ctx.bezierCurveTo(right, cy + r * 0.52, cx + r * 0.35, cy + r * 0.82, cx, bottom);
    ctx.bezierCurveTo(cx - r * 0.35, cy + r * 0.82, left, cy + r * 0.52, left, cy - r * 0.05);
    ctx.closePath();
  }
}

/**
 * Generates a 100x100 transparent PNG Data URL of a custom heraldic clan emblem using HTML5 Canvas 2D.
 */
export function generateClanEmblemDataUrl(config: ClanEmblemGeneratorConfig): string {
  const size = CLAN_EMBLEM_SPEC.maxSizePx; // 100x100
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '🛡️';

  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2 + 2;
  const radius = 41;

  // 1. Outer Glow / Drop Shadow
  ctx.save();
  traceEmblemShapePath(ctx, config.shape, cx, cy, radius);
  ctx.shadowColor = config.borderStyle === 'glow' ? config.borderColor : 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = config.borderStyle === 'glow' ? 10 : 6;
  ctx.fillStyle = config.primaryColor;
  ctx.fill();
  ctx.restore();

  // 2. Clip inside shield shape & render background pattern
  ctx.save();
  traceEmblemShapePath(ctx, config.shape, cx, cy, radius);
  ctx.clip();

  if (config.pattern === 'radial') {
    const grad = ctx.createRadialGradient(cx, cy - 4, 4, cx, cy, radius * 1.15);
    grad.addColorStop(0, config.secondaryColor);
    grad.addColorStop(1, config.primaryColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  } else if (config.pattern === 'split_v') {
    ctx.fillStyle = config.primaryColor;
    ctx.fillRect(0, 0, cx, size);
    ctx.fillStyle = config.secondaryColor;
    ctx.fillRect(cx, 0, cx, size);
  } else if (config.pattern === 'split_h') {
    ctx.fillStyle = config.primaryColor;
    ctx.fillRect(0, 0, size, cy);
    ctx.fillStyle = config.secondaryColor;
    ctx.fillRect(0, cy, size, size - cy);
  } else if (config.pattern === 'split_diag') {
    ctx.fillStyle = config.primaryColor;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = config.secondaryColor;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(size, 0);
    ctx.lineTo(0, size);
    ctx.closePath();
    ctx.fill();
  } else if (config.pattern === 'quarters') {
    ctx.fillStyle = config.primaryColor;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = config.secondaryColor;
    ctx.fillRect(0, 0, cx, cy);
    ctx.fillRect(cx, cy, size - cx, size - cy);
  } else if (config.pattern === 'rays') {
    ctx.fillStyle = config.primaryColor;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = config.secondaryColor;
    const numRays = 12;
    for (let i = 0; i < numRays; i += 2) {
      const a1 = (i * Math.PI * 2) / numRays;
      const a2 = ((i + 1) * Math.PI * 2) / numRays;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a1) * size, cy + Math.sin(a1) * size);
      ctx.lineTo(cx + Math.cos(a2) * size, cy + Math.sin(a2) * size);
      ctx.closePath();
      ctx.fill();
    }
  } else if (config.pattern === 'chevron') {
    ctx.fillStyle = config.primaryColor;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = config.secondaryColor;
    ctx.beginPath();
    ctx.moveTo(0, cy + 16);
    ctx.lineTo(cx, cy - 18);
    ctx.lineTo(size, cy + 16);
    ctx.lineTo(size, cy + 34);
    ctx.lineTo(cx, cy);
    ctx.lineTo(0, cy + 34);
    ctx.closePath();
    ctx.fill();
  }

  // Subtle top-down metallic sheen inside shield
  const sheen = ctx.createLinearGradient(0, cy - radius, 0, cy + radius);
  sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
  sheen.addColorStop(0.45, 'rgba(255,255,255,0.0)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  // 3. Shield Metallic Border & Inner Rim
  ctx.save();
  traceEmblemShapePath(ctx, config.shape, cx, cy, radius);
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = config.borderColor;
  ctx.stroke();

  if (config.borderStyle === 'double' || config.borderStyle === 'glow') {
    traceEmblemShapePath(ctx, config.shape, cx, cy, radius - 4.5);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.stroke();
  } else if (config.borderStyle === 'rivets') {
    const rivetCount = 8;
    for (let i = 0; i < rivetCount; i++) {
      const a = (i * Math.PI * 2) / rivetCount - Math.PI / 2;
      const rx = cx + (radius - 3.2) * Math.cos(a);
      const ry = cy + (radius - 3.2) * Math.sin(a);
      ctx.beginPath();
      ctx.arc(rx, ry, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();
    }
  }
  ctx.restore();

  // 4. Central Charge (Symbol or Custom Clan Tag Text)
  const cleanText = (config.customText || '').trim().toUpperCase().slice(0, 5);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;

  if (cleanText.length > 0) {
    const fontSize = cleanText.length <= 2 ? 26 : cleanText.length === 3 ? 21 : 17;
    ctx.font = `900 ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#090d16';
    ctx.strokeText(cleanText, cx, cy + 2);
    ctx.fillStyle = config.borderColor;
    ctx.fillText(cleanText, cx, cy + 2);
  } else {
    ctx.font = '36px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.fillText(config.symbol || '🛡️', cx, cy + 2);
  }
  ctx.restore();

  // 5. Optional Top Crest (Crown / Fleur-de-lis / Star)
  if (config.crest && config.crest !== 'none') {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 4;
    ctx.font = '18px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.fillText(config.crest, cx, 11);
    ctx.restore();
  }

  return canvas.toDataURL('image/png');
}

/**
 * Validates and converts an uploaded Clan Emblem:
 * - Format PNG, JPEG, WEBP, or GIF (animated GIFs preserved!)
 * - Max dimensions fitted squarely to 100x100 px
 * - Optional automatic background removal (`removeBg: true`) using Canvas BFS flood-fill
 */
export async function processUploadedClanEmblem(
  file: File,
  options?: { removeBg?: boolean }
): Promise<ProcessedItemImageResult> {
  if (!file) {
    return { ok: false, success: false, error: 'Файл эмблемы не выбран.' };
  }

  const originalSizeKb = Math.max(1, Math.round(file.size / 1024));

  if (file.size > CLAN_EMBLEM_SPEC.maxFileSizeBytes * 4) {
    return {
      ok: false,
      success: false,
      error: `Файл слишком тяжелый (${originalSizeKb} КБ). Максимальный вес исходника: 2 МБ.`
    };
  }

  const isAllowed =
    file.type === 'image/png' ||
    file.type === 'image/jpeg' ||
    file.type === 'image/jpg' ||
    file.type === 'image/gif' ||
    file.type === 'image/webp' ||
    /\.(png|jpe?g|gif|webp)$/i.test(file.name);

  if (!isAllowed) {
    return {
      ok: false,
      success: false,
      error: 'Недопустимый формат файла. Разрешены PNG, JPEG, WEBP и GIF.'
    };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => {
      resolve({ ok: false, success: false, error: 'Не удалось прочитать файл эмблемы.' });
    };
    reader.onload = () => {
      const srcData = reader.result as string;
      const isGif =
        file.type === 'image/gif' ||
        /\.gif$/i.test(file.name) ||
        (typeof srcData === 'string' && srcData.startsWith('data:image/gif'));

      if (isGif && srcData) {
        if (file.size > CLAN_EMBLEM_SPEC.maxFileSizeBytes) {
          resolve({
            ok: false,
            success: false,
            error: `Анимированный GIF слишком тяжелый (${originalSizeKb} КБ). Максимум: 500 КБ.`
          });
          return;
        }
        resolve({
          ok: true,
          success: true,
          dataUrl: srcData,
          width: 100,
          height: 100,
          originalWidth: 100,
          originalHeight: 100,
          originalSizeKb,
          finalSizeKb: originalSizeKb,
          compressedSizeKb: originalSizeKb
        });
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const targetSize = CLAN_EMBLEM_SPEC.maxSizePx; // 100x100
          const srcW = Math.max(1, img.naturalWidth || img.width || targetSize);
          const srcH = Math.max(1, img.naturalHeight || img.height || targetSize);

          let dataUrl = '';
          if (options?.removeBg) {
            dataUrl = removeCharacterBackgroundAndTrimToPng(img, targetSize);
          } else {
            const canvas = document.createElement('canvas');
            canvas.width = targetSize;
            canvas.height = targetSize;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve({ ok: false, success: false, error: 'Ошибка контекста Canvas при обработке эмблемы.' });
              return;
            }

            ctx.clearRect(0, 0, targetSize, targetSize);

            // Center crop to 100x100
            const scale = Math.max(targetSize / srcW, targetSize / srcH);
            const drawW = srcW * scale;
            const drawH = srcH * scale;
            const offsetX = (targetSize - drawW) / 2;
            const offsetY = (targetSize - drawH) / 2;

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

            // Prefer png to preserve transparency if available, else jpeg
            const isPng = file.type === 'image/png' || file.type === 'image/webp' || /\.(png|webp)$/i.test(file.name);
            dataUrl = isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.92);
          }

          const approxBytes = Math.round((dataUrl.length * 3) / 4);
          const compressedSizeKb = Math.max(1, Math.round(approxBytes / 1024));

          if (compressedSizeKb > 250) {
            resolve({
              ok: false,
              success: false,
              error: `Итоговый размер эмблемы (${compressedSizeKb} КБ) превышает лимит.`
            });
            return;
          }

          resolve({
            ok: true,
            success: true,
            dataUrl,
            width: targetSize,
            height: targetSize,
            originalWidth: srcW,
            originalHeight: srcH,
            originalSizeKb,
            finalSizeKb: compressedSizeKb,
            compressedSizeKb
          });
        } catch (_err) {
          resolve({
            ok: false,
            success: false,
            error: 'Ошибка при кадрировании эмблемы клана.'
          });
        }
      };
      img.onerror = () => {
        resolve({
          ok: false,
          success: false,
          error: 'Файл поврежден или не может быть загружен как изображение.'
        });
      };
      img.src = srcData;
    };
    reader.readAsDataURL(file);
  });
}

export const CHARACTER_SKIN_IMAGE_SPEC = {
  standardSizePx: 64,
  pyramidCellDisplayPx: 22,
  profileDisplayPx: 56,
  aspectRatio: '1:1 (прозрачный спрайт воина 64×64px / в клетке Пирамиды 22×22px)',
  maxFileSizeBytes: 5 * 1024 * 1024,
  allowedFormatsLabel: 'PNG, WEBP, GIF (анимация), JPG, SVG (авто-удаление фона)'
};

interface RgbCluster {
  r: number;
  g: number;
  b: number;
  count: number;
}

function colorDist(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Автоматически удаляет фон вокруг персонажа (белый, черный, цветной, градиентный или «шахматку» фейкового PNG),
 * сохраняет родной прозрачный фон (если он уже есть), обрезает пустые поля вокруг силуэта воина
 * и возвращает чистый прозрачный PNG-спрайт 64x64px, чтобы по Пирамиде ходил именно сам воин, а не квадратная картинка.
 */
export function removeCharacterBackgroundAndTrimToPng(
  img: HTMLImageElement,
  targetSize: number = CHARACTER_SKIN_IMAGE_SPEC.standardSizePx
): string {
  const srcW = Math.max(1, img.naturalWidth || img.width || targetSize);
  const srcH = Math.max(1, img.naturalHeight || img.height || targetSize);

  // 1. Отрисовываем во временный рабочий холст (до 192px) для точного выделения контура персонажа
  const maxWorkDim = 192;
  const workScale = Math.min(1, maxWorkDim / Math.max(srcW, srcH));
  const w = Math.max(16, Math.round(srcW * workScale));
  const h = Math.max(16, Math.round(srcH * workScale));

  const workCanvas = document.createElement('canvas');
  workCanvas.width = w;
  workCanvas.height = h;
  const wCtx = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!wCtx) {
    throw new Error('Canvas 2D context unavailable');
  }

  wCtx.clearRect(0, 0, w, h);
  wCtx.imageSmoothingEnabled = true;
  wCtx.imageSmoothingQuality = 'high';
  wCtx.drawImage(img, 0, 0, w, h);

  const imgData = wCtx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const totalPixels = w * h;

  // 2. Анализируем пиксели по периметру (внешняя рамка в 2 пикселя)
  let borderTotal = 0;
  let borderTransparent = 0;
  const buckets = new Map<string, RgbCluster>();

  const addBorderSample = (x: number, y: number) => {
    const idx = (y * w + x) * 4;
    const a = data[idx + 3];
    borderTotal++;
    if (a < 35) {
      borderTransparent++;
      return;
    }
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const key = `${r >> 4}_${g >> 4}_${b >> 4}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.r += r;
      existing.g += g;
      existing.b += b;
      existing.count++;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
  };

  for (let x = 0; x < w; x++) {
    addBorderSample(x, 0);
    if (h > 1) addBorderSample(x, h - 1);
    if (h > 3) {
      addBorderSample(x, 1);
      addBorderSample(x, h - 2);
    }
  }
  for (let y = 2; y < h - 2; y++) {
    addBorderSample(0, y);
    if (w > 1) addBorderSample(w - 1, y);
    if (w > 3) {
      addBorderSample(1, y);
      addBorderSample(w - 2, y);
    }
  }

  const transparentBorderRatio = borderTotal > 0 ? borderTransparent / borderTotal : 0;

  // Определяем доминирующие цвета фона на границе (поддержка однотонного фона, градиента и 2-цветной шахматки)
  const dominantBgColors = Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((c) => ({
      r: Math.round(c.r / c.count),
      g: Math.round(c.g / c.count),
      b: Math.round(c.b / c.count),
      count: c.count
    }));

  // Также добавляем 4 угла, если они непрозрачные
  const corners = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1]
  ];
  for (const [cx, cy] of corners) {
    const cIdx = (cy * w + cx) * 4;
    if (data[cIdx + 3] >= 35) {
      const cr = data[cIdx];
      const cg = data[cIdx + 1];
      const cb = data[cIdx + 2];
      const alreadyIn = dominantBgColors.some((c) => colorDist(cr, cg, cb, c.r, c.g, c.b) < 20);
      if (!alreadyIn) {
        dominantBgColors.push({ r: cr, g: cg, b: cb, count: 1 });
      }
    }
  }

  // Проверяем, является ли фон «шахматкой» (бело-серые квадратики фейкового прозрачного PNG)
  const isNeutralLight = (r: number, g: number, b: number) => {
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    return maxC - minC <= 22 && minC >= 165;
  };
  const neutralLightBorderCount = dominantBgColors
    .filter((c) => isNeutralLight(c.r, c.g, c.b))
    .reduce((acc, c) => acc + c.count, 0);
  const hasCheckerboardOrWhiteBg =
    borderTotal - borderTransparent > 0 &&
    neutralLightBorderCount / Math.max(1, borderTotal - borderTransparent) >= 0.55;

  const minDistToBgPalette = (r: number, g: number, b: number): number => {
    let best = 999;
    for (let i = 0; i < dominantBgColors.length; i++) {
      const bg = dominantBgColors[i];
      const d = colorDist(r, g, b, bg.r, bg.g, bg.b);
      if (d < best) best = d;
    }
    return best;
  };

  // 3. Если граница не полностью прозрачна — запускаем волновой алгоритм (BFS Flood-Fill) от всех краев внутрь к контуру воина
  if (transparentBorderRatio < 0.92 && dominantBgColors.length > 0) {
    const backupAlpha = new Uint8ClampedArray(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      backupAlpha[i] = data[i * 4 + 3];
    }

    const isBg = new Uint8Array(totalPixels);
    const visited = new Uint8Array(totalPixels);
    const queue = new Int32Array(totalPixels);
    let qHead = 0;
    let qTail = 0;

    const tryEnqueueSeed = (x: number, y: number) => {
      const pIdx = y * w + x;
      if (visited[pIdx]) return;
      const idx = pIdx * 4;
      const a = data[idx + 3];
      if (a < 35) {
        visited[pIdx] = 1;
        isBg[pIdx] = 1;
        queue[qTail++] = pIdx;
        return;
      }
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      if (minDistToBgPalette(r, g, b) <= 58 || (hasCheckerboardOrWhiteBg && isNeutralLight(r, g, b))) {
        visited[pIdx] = 1;
        isBg[pIdx] = 1;
        queue[qTail++] = pIdx;
      }
    };

    for (let x = 0; x < w; x++) {
      tryEnqueueSeed(x, 0);
      tryEnqueueSeed(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      tryEnqueueSeed(0, y);
      tryEnqueueSeed(w - 1, y);
    }

    const dirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1]
    ];

    while (qHead < qTail) {
      const curr = queue[qHead++];
      const cx = curr % w;
      const cy = (curr / w) | 0;
      const cIdx = curr * 4;
      const cr = data[cIdx];
      const cg = data[cIdx + 1];
      const cb = data[cIdx + 2];

      for (let d = 0; d < 8; d++) {
        const nx = cx + dirs[d][0];
        const ny = cy + dirs[d][1];
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const nPos = ny * w + nx;
        if (visited[nPos]) continue;

        const nIdx = nPos * 4;
        const na = data[nIdx + 3];
        if (na < 35) {
          visited[nPos] = 1;
          isBg[nPos] = 1;
          queue[qTail++] = nPos;
          continue;
        }

        const nr = data[nIdx];
        const ng = data[nIdx + 1];
        const nb = data[nIdx + 2];

        const distPalette = minDistToBgPalette(nr, ng, nb);
        const distParent = colorDist(nr, ng, nb, cr, cg, cb);

        const matchesBg =
          distPalette <= 46 ||
          (distParent <= 18 && distPalette <= 74) ||
          (hasCheckerboardOrWhiteBg && isNeutralLight(nr, ng, nb));

        if (matchesBg) {
          visited[nPos] = 1;
          isBg[nPos] = 1;
          queue[qTail++] = nPos;
        }
      }
    }

    // Применяем прозрачность к найденному фону и делаем мягкое сглаживание (anti-aliasing) на границе силуэта воина
    let remainingForeground = 0;
    for (let p = 0; p < totalPixels; p++) {
      if (isBg[p]) {
        data[p * 4 + 3] = 0;
      } else if (data[p * 4 + 3] >= 35) {
        remainingForeground++;
      }
    }

    // Защита: если алгоритм случайно стер почти всё изображение (< 4% пикселей осталось), откатываем альфу
    if (remainingForeground < totalPixels * 0.04) {
      for (let p = 0; p < totalPixels; p++) {
        data[p * 4 + 3] = backupAlpha[p];
      }
    } else {
      // Мягкая очистка ореола (defringe) вокруг контура персонажа
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const p = y * w + x;
          if (isBg[p]) continue;
          const idx = p * 4;
          if (data[idx + 3] === 0) continue;

          // Проверяем, граничит ли пиксель с удаленным фоном
          const touchesBg =
            isBg[p - 1] ||
            isBg[p + 1] ||
            isBg[p - w] ||
            isBg[p + w] ||
            isBg[p - w - 1] ||
            isBg[p - w + 1] ||
            isBg[p + w - 1] ||
            isBg[p + w + 1];

          if (touchesBg) {
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const d = minDistToBgPalette(r, g, b);
            if (d < 68) {
              const factor = Math.max(0.1, Math.min(1, (d - 26) / 42));
              data[idx + 3] = Math.round(data[idx + 3] * factor);
            }
          }
        }
      }
    }

    wCtx.putImageData(imgData, 0, 0);
  }

  // 4. Находим точные границы силуэта персонажа (Auto-Trim пустых прозрачных полей),
  // чтобы воин занимал весь стандартный рост в клетке Пирамиды
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3];
      if (a > 28) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    minX = 0;
    minY = 0;
    maxX = w - 1;
    maxY = h - 1;
  }

  const cropW = Math.max(1, maxX - minX + 1);
  const cropH = Math.max(1, maxY - minY + 1);

  // 5. Рисуем вырезанного воина по центру финального прозрачного PNG 64x64px
  const outCanvas = document.createElement('canvas');
  outCanvas.width = targetSize;
  outCanvas.height = targetSize;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) {
    throw new Error('Output Canvas 2D context unavailable');
  }

  outCtx.clearRect(0, 0, targetSize, targetSize);
  const pad = 2; // небольшой отступ 2px от краев 64x64, чтобы не обрезалась тень
  const availSize = targetSize - pad * 2;
  const scale = Math.min(availSize / cropW, availSize / cropH);
  const drawW = cropW * scale;
  const drawH = cropH * scale;
  const offsetX = Math.round((targetSize - drawW) / 2);
  const offsetY = Math.round((targetSize - drawH) / 2);

  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(workCanvas, minX, minY, cropW, cropH, offsetX, offsetY, drawW, drawH);

  // Всегда сохраняем скины персонажа строго в PNG, так как PNG на 100% сохраняет альфа-канал прозрачности на всех устройствах
  return outCanvas.toDataURL('image/png');
}

const transparentSkinRuntimeCache = new Map<string, string>();

/**
 * Гарантирует, что любой уже загруженный статичный скин (data:image/...) имеет прозрачный фон.
 * Результат кэшируется в памяти для мгновенного рендера в Пирамиде.
 */
export function ensureTransparentCharacterDataUrl(dataUrl: string): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.startsWith('data:image/gif') || dataUrl.startsWith('data:image/svg')) {
    return Promise.resolve(dataUrl);
  }
  const cached = transparentSkinRuntimeCache.get(dataUrl);
  if (cached) {
    return Promise.resolve(cached);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const cleaned = removeCharacterBackgroundAndTrimToPng(img, CHARACTER_SKIN_IMAGE_SPEC.standardSizePx);
        transparentSkinRuntimeCache.set(dataUrl, cleaned);
        transparentSkinRuntimeCache.set(cleaned, cleaned);
        resolve(cleaned);
      } catch {
        transparentSkinRuntimeCache.set(dataUrl, dataUrl);
        resolve(dataUrl);
      }
    };
    img.onerror = () => {
      resolve(dataUrl);
    };
    img.src = dataUrl;
  });
}

/**
 * Обрабатывает загружаемую картинку или GIF для Скина Персонажа:
 * - Сохраняет анимацию GIF без потери кадров
 * - Автоматически сохраняет прозрачный фон ИЛИ удаляет непрозрачный фон (белый/черный/цветной/шахматку),
 *   обрезает пустые поля вокруг воина и сохраняет в стандартный прозрачный PNG 64x64px,
 *   чтобы по Пирамиде передвигался сам игрок, а не квадратная картинка.
 */
export async function processUploadedCharacterSkin(file: File): Promise<ProcessedItemImageResult> {
  if (!file) {
    return { ok: false, success: false, error: 'Файл скина не выбран.' };
  }

  const originalSizeKb = Math.max(1, Math.round(file.size / 1024));
  if (file.size > CHARACTER_SKIN_IMAGE_SPEC.maxFileSizeBytes) {
    return {
      ok: false,
      success: false,
      error: `Файл слишком большой (${originalSizeKb} КБ). Выберите файл до 5 МБ.`
    };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => {
      resolve({ ok: false, success: false, error: 'Не удалось прочитать файл скина.' });
    };
    reader.onload = () => {
      const srcData = reader.result as string;
      const isGif =
        file.type === 'image/gif' ||
        /\.gif$/i.test(file.name) ||
        (typeof srcData === 'string' && srcData.startsWith('data:image/gif'));

      if (isGif && srcData) {
        const imgCheck = new Image();
        imgCheck.onload = () => {
          resolve({
            ok: true,
            success: true,
            dataUrl: srcData,
            width: CHARACTER_SKIN_IMAGE_SPEC.standardSizePx,
            height: CHARACTER_SKIN_IMAGE_SPEC.standardSizePx,
            originalWidth: imgCheck.naturalWidth || 64,
            originalHeight: imgCheck.naturalHeight || 64,
            originalSizeKb,
            finalSizeKb: originalSizeKb,
            compressedSizeKb: originalSizeKb
          });
        };
        imgCheck.onerror = () => {
          resolve({
            ok: true,
            success: true,
            dataUrl: srcData,
            width: CHARACTER_SKIN_IMAGE_SPEC.standardSizePx,
            height: CHARACTER_SKIN_IMAGE_SPEC.standardSizePx,
            originalWidth: 64,
            originalHeight: 64,
            originalSizeKb,
            finalSizeKb: originalSizeKb,
            compressedSizeKb: originalSizeKb
          });
        };
        imgCheck.src = srcData;
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const targetSize = CHARACTER_SKIN_IMAGE_SPEC.standardSizePx; // 64x64 standard character sprite
          const srcW = Math.max(1, img.naturalWidth || img.width || targetSize);
          const srcH = Math.max(1, img.naturalHeight || img.height || targetSize);

          const dataUrl = removeCharacterBackgroundAndTrimToPng(img, targetSize);
          transparentSkinRuntimeCache.set(dataUrl, dataUrl);

          const approxBytes = Math.round((dataUrl.length * 3) / 4);
          const compressedSizeKb = Math.max(1, Math.round(approxBytes / 1024));

          resolve({
            ok: true,
            success: true,
            dataUrl,
            width: targetSize,
            height: targetSize,
            originalWidth: srcW,
            originalHeight: srcH,
            originalSizeKb,
            finalSizeKb: compressedSizeKb,
            compressedSizeKb
          });
        } catch (_e) {
          resolve({
            ok: true,
            success: true,
            dataUrl: srcData,
            width: 64,
            height: 64,
            originalSizeKb,
            finalSizeKb: originalSizeKb,
            compressedSizeKb: originalSizeKb
          });
        }
      };
      img.onerror = () => {
        resolve({ ok: false, success: false, error: 'Не удалось загрузить изображение скина.' });
      };
      img.src = srcData;
    };
    reader.readAsDataURL(file);
  });
}



