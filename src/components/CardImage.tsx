import { memo, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  getCardImageCandidates,
  markCardImageFailed,
  markCardImageResolved,
  preloadCardImage,
} from "../config/cardImage";

type Props = {
  cardCode: string;
  imageUrl?: string;
  alt: string;
  fallbackLabel?: string;
  loading?: "lazy" | "eager";
  decoding?: "async" | "auto" | "sync";
  fetchPriority?: "high" | "low" | "auto";
  draggable?: boolean;
  className?: string;
  style?: CSSProperties;
  eagerResolve?: boolean;
};

function getFallbackSvg(label: string): string {
  const encodedLabel = encodeURIComponent(label || "NO IMAGE");

  return `data:image/svg+xml;utf8,
  <svg xmlns="http://www.w3.org/2000/svg" width="360" height="500">
    <rect width="100%" height="100%" fill="%2308171f"/>
    <text x="50%" y="45%" text-anchor="middle" fill="%23cbd5e1" font-size="28">NO IMAGE</text>
    <text x="50%" y="55%" text-anchor="middle" fill="%239ca3af" font-size="20">${encodedLabel}</text>
  </svg>`;
}

function CardImage({
  cardCode,
  imageUrl,
  alt,
  fallbackLabel,
  loading = "lazy",
  decoding = "async",
  fetchPriority = "auto",
  draggable = false,
  className,
  style,
  eagerResolve = false,
}: Props) {
  const normalizedCode = String(cardCode ?? "").trim().toUpperCase();
  const candidateKey = `${normalizedCode}__${String(imageUrl ?? "").trim()}`;
  const candidates = useMemo(
    () => getCardImageCandidates(normalizedCode, imageUrl),
    [candidateKey]
  );
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [candidateKey]);

  useEffect(() => {
    if (!eagerResolve) return;
    if (!normalizedCode) return;

    void preloadCardImage(normalizedCode, imageUrl);
  }, [eagerResolve, candidateKey]);

  const currentSrc = candidates[candidateIndex] ?? getFallbackSvg(fallbackLabel ?? normalizedCode);

  return (
    <img
      key={`${candidateKey}-${candidateIndex}`}
      src={currentSrc}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      draggable={draggable}
      onLoad={(event) => {
        const resolvedUrl = event.currentTarget.currentSrc || event.currentTarget.src;
        if (resolvedUrl.startsWith("data:image/svg+xml")) return;
        markCardImageResolved(normalizedCode, resolvedUrl);
      }}
      onError={(event) => {
        const failedUrl = event.currentTarget.currentSrc || event.currentTarget.src;
        if (!failedUrl.startsWith("data:image/svg+xml")) {
          markCardImageFailed(failedUrl);
        }

        setCandidateIndex((prev) => {
          const next = prev + 1;
          return next < candidates.length ? next : prev;
        });

        if (candidateIndex >= candidates.length - 1) {
          event.currentTarget.onerror = null;
          event.currentTarget.src = getFallbackSvg(fallbackLabel ?? normalizedCode);
        }
      }}
    />
  );
}

export default memo(CardImage);
