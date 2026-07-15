"use client";

import { useEffect } from "react";

/**
 * 루트 레이아웃 자체에서 에러가 났을 때의 최종 폴백.
 *
 * global-error 는 루트 레이아웃(<html>/<body> 포함)을 통째로 대체하므로 globals.css(Tailwind)
 * 가 적용되지 않는다 → 인라인 스타일로 최소한의 브랜드 화면만 그린다. 흔치 않은 경로다.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", error.message, error.digest);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          background: "#0a0b0f",
          color: "#e6e8ef",
          fontFamily: "system-ui, -apple-system, sans-serif",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0 }}>
          문제가 발생했어요
        </h1>
        <p style={{ color: "#9aa0b4", margin: 0, maxWidth: "28rem" }}>
          일시적인 오류일 수 있습니다. 다시 시도해 주세요.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            padding: "0.65rem 1.25rem",
            borderRadius: "9999px",
            border: "none",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          다시 시도
        </button>
      </body>
    </html>
  );
}
