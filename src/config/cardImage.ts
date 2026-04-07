const CARD_IMAGE_BASE_URL = String(import.meta.env.VITE_CARD_IMAGE_BASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

const resolvedImageUrlCache = new Map<string, string>();
const failedImageUrlSet = new Set<string>();
const preloadPromiseCache = new Map<string, Promise<boolean>>();
const attemptedCodeCache = new Set<string>();

function normalizeCode(cardCode: string): string {
  return String(cardCode ?? "").trim().toUpperCase();
}

export function buildCardImageUrl(code: string, extension: "webp" | "png"): string {
  const normalizedCode = normalizeCode(code);

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
  const normalizedCode = normalizeCode(cardCode);

  if (!normalizedCode) {
    return candidates;
  }

  const cachedResolvedUrl = resolvedImageUrlCache.get(normalizedCode);
  if (cachedResolvedUrl && !failedImageUrlSet.has(cachedResolvedUrl)) {
    candidates.push(cachedResolvedUrl);
  }

  const trimmedImageUrl = String(imageUrl ?? "").trim();
  if (
    trimmedImageUrl &&
    !candidates.includes(trimmedImageUrl) &&
    !failedImageUrlSet.has(trimmedImageUrl)
  ) {
    candidates.push(trimmedImageUrl);
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
  const normalizedCode = normalizeCode(cardCode);
  const normalizedUrl = String(resolvedUrl ?? "").trim();

  if (!normalizedCode || !normalizedUrl) return;

  resolvedImageUrlCache.set(normalizedCode, normalizedUrl);
  failedImageUrlSet.delete(normalizedUrl);
}

export function markCardImageFailed(url: string) {
  const normalizedUrl = String(url ?? "").trim();
  if (!normalizedUrl) return;
  failedImageUrlSet.add(normalizedUrl);
}

export function getResolvedCardImageUrl(cardCode: string): string | undefined {
  return resolvedImageUrlCache.get(normalizeCode(cardCode));
}

function loadImage(url: string): Promise<boolean> {
  const cachedPromise = preloadPromiseCache.get(url);
  if (cachedPromise) {
    return cachedPromise;
  }

  const nextPromise = new Promise<boolean>((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";

    img.onload = () => {
      resolve(true);
    };

    img.onerror = () => {
      markCardImageFailed(url);
      resolve(false);
    };

    img.src = url;
  });

  preloadPromiseCache.set(url, nextPromise);
  return nextPromise;
}

export async function preloadCardImage(cardCode: string, imageUrl?: string): Promise<string | null> {
  const normalizedCode = normalizeCode(cardCode);
  if (!normalizedCode) return null;

  const cachedResolvedUrl = resolvedImageUrlCache.get(normalizedCode);
  if (cachedResolvedUrl && !failedImageUrlSet.has(cachedResolvedUrl)) {
    return cachedResolvedUrl;
  }

  const candidates = getCardImageCandidates(normalizedCode, imageUrl);
  for (const candidate of candidates) {
    const ok = await loadImage(candidate);
    if (!ok) continue;

    markCardImageResolved(normalizedCode, candidate);
    return candidate;
  }

  attemptedCodeCache.add(normalizedCode);
  return null;
}

export function hasTriedResolvingCardImage(cardCode: string): boolean {
  return attemptedCodeCache.has(normalizeCode(cardCode));
}
