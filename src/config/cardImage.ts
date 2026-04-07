const CARD_IMAGE_BASE_URL = String(import.meta.env.VITE_CARD_IMAGE_BASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

const resolvedImageUrlCache = new Map<string, string>();
const failedImageUrlSet = new Set<string>();

export function buildCardImageUrl(code: string, extension: "webp" | "png"): string {
  const normalizedCode = code.trim().toUpperCase();

  if (!normalizedCode) {
    return "";
  }

  if (CARD_IMAGE_BASE_URL) {
    return `${CARD_IMAGE_BASE_URL}/${normalizedCode}.${extension}`;
  }

  return `/cards/${normalizedCode}.${extension}`;
}

export function getCardImageCandidates(cardCode: string, imageUrl?: string): string[] {
  const candidates: string[] = [];
  const normalizedCode = cardCode.trim().toUpperCase();

  if (!normalizedCode) {
    return candidates;
  }

  const cachedResolvedUrl = resolvedImageUrlCache.get(normalizedCode);
  if (cachedResolvedUrl) {
    candidates.push(cachedResolvedUrl);
  }

  if (imageUrl && imageUrl.trim().length > 0) {
    const trimmed = imageUrl.trim();
    if (!candidates.includes(trimmed) && !failedImageUrlSet.has(trimmed)) {
      candidates.push(trimmed);
    }
  }

  const webpUrl = buildCardImageUrl(normalizedCode, "webp");
  const pngUrl = buildCardImageUrl(normalizedCode, "png");

  for (const url of [webpUrl, pngUrl]) {
    if (!url) continue;
    if (failedImageUrlSet.has(url)) continue;
    if (candidates.includes(url)) continue;
    candidates.push(url);
  }

  return candidates;
}

export function markCardImageResolved(cardCode: string, resolvedUrl: string) {
  const normalizedCode = cardCode.trim().toUpperCase();
  if (!normalizedCode || !resolvedUrl) return;
  resolvedImageUrlCache.set(normalizedCode, resolvedUrl);
}

export function markCardImageFailed(url: string) {
  if (!url) return;
  failedImageUrlSet.add(url);
}

export function preloadCardImage(cardCode: string, imageUrl?: string) {
  const candidates = getCardImageCandidates(cardCode, imageUrl);
  if (candidates.length === 0) return;

  const normalizedCode = cardCode.trim().toUpperCase();
  let attempt = 0;

  const tryNext = () => {
    if (attempt >= candidates.length) return;

    const url = candidates[attempt];
    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";
    img.onload = () => {
      markCardImageResolved(normalizedCode, url);
    };
    img.onerror = () => {
      markCardImageFailed(url);
      attempt += 1;
      tryNext();
    };
    img.src = url;
  };

  tryNext();
}
