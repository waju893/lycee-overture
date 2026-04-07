const CARD_IMAGE_BASE_URL = String(import.meta.env.VITE_CARD_IMAGE_BASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

const resolvedImageUrlCache = new Map<string, string>();
const preloadPromiseCache = new Map<string, Promise<boolean>>();
const attemptedCodeCache = new Set<string>();

function normalizeCode(cardCode: string): string {
  return String(cardCode ?? "").trim().toUpperCase();
}

function buildUrl(basePath: string, code: string, extension: "webp" | "png"): string {
  const trimmedBasePath = String(basePath ?? "").trim().replace(/\/+$/, "");
  const normalizedCode = normalizeCode(code);

  if (!trimmedBasePath || !normalizedCode) {
    return "";
  }

  return `${trimmedBasePath}/${normalizedCode}.${extension}`;
}

function getDefaultBasePaths(): string[] {
  const candidates = [
    CARD_IMAGE_BASE_URL,
    "/cards",
    "/cards/webp",
    "/cards/png",
    "/public/cards",
    "/public/cards/webp",
    "/public/cards/png",
  ];

  return candidates.filter(Boolean);
}

export function buildCardImageUrl(code: string, extension: "webp" | "png"): string {
  const normalizedCode = normalizeCode(code);

  if (!normalizedCode) {
    return "";
  }

  const primaryBasePath = CARD_IMAGE_BASE_URL || "/cards";
  return buildUrl(primaryBasePath, normalizedCode, extension);
}

export function getCardImageCandidates(cardCode: string, imageUrl?: string): string[] {
  const candidates: string[] = [];
  const normalizedCode = normalizeCode(cardCode);

  if (!normalizedCode) {
    return candidates;
  }

  const cachedResolvedUrl = resolvedImageUrlCache.get(normalizedCode);
  if (cachedResolvedUrl && !candidates.includes(cachedResolvedUrl)) {
    candidates.push(cachedResolvedUrl);
  }

  const trimmedImageUrl = String(imageUrl ?? "").trim();
  if (trimmedImageUrl && !candidates.includes(trimmedImageUrl)) {
    candidates.push(trimmedImageUrl);
  }

  for (const basePath of getDefaultBasePaths()) {
    for (const extension of ["webp", "png"] as const) {
      const nextUrl = buildUrl(basePath, normalizedCode, extension);
      if (!nextUrl || candidates.includes(nextUrl)) continue;
      candidates.push(nextUrl);
    }
  }

  return candidates;
}

export function markCardImageResolved(cardCode: string, resolvedUrl: string) {
  const normalizedCode = normalizeCode(cardCode);
  const normalizedUrl = String(resolvedUrl ?? "").trim();

  if (!normalizedCode || !normalizedUrl) return;

  resolvedImageUrlCache.set(normalizedCode, normalizedUrl);
}

export function markCardImageFailed(_url: string) {
  // 실패 URL을 전역 차단하지 않는다.
  // 개발 서버 재시작, 경로 변경, 최초 로딩 타이밍 차이로 한 번 실패한 URL이
  // 이후에도 계속 막혀 버리면 모든 화면에서 NO IMAGE가 고정될 수 있다.
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

    img.onload = () => {
      resolve(true);
    };

    img.onerror = () => {
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
  if (cachedResolvedUrl) {
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
