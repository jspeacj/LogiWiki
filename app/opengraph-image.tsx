import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const alt = siteConfig.ogTitle;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * 소셜 미리보기 카드.
 *
 * 이 zone 은 원래 opengraph-image 를 두지 않는 것이 규약이었다. 그런데 허브 연결 후
 * 색인 대상이 되면서 사이트맵 181개 URL 이 **전부 og:image 없이** 공유되고 있었다
 * (2026-07-24 실측). 형제 zone 은 모두 카드가 있어 형평도 맞지 않았다 — 그래서 신설한다.
 *
 * Satori(next/og)로 그린다. 알아둘 것 (메인 repo MIGRATION.md 함정 F 의 부록):
 * - `⇄`·`◷` 같은 특수문자는 Satori 기본 폰트에 글리프가 없어 **두부(□)로 깨진다.**
 * - ⚠️ CSS border-triangle 트릭(`width:0;height:0;border-*:transparent`)도 쓰지 말 것.
 *   Satori 는 이걸 삼각형으로 접지 못하고 **네모로 렌더한다.** 도형이 필요하면 SVG 를 쓴다.
 * - 자식이 둘 이상인 div 에는 `display:flex` 를 명시해야 한다(Satori 요구사항).
 * - 결과물은 반드시 눈으로 확인할 것. Next 16 은 `.next/server/app/opengraph-image.body` 에
 *   정적 PNG 로 떨어진다.
 *
 * ⚠️ 이 파일만 만들어서는 부족하다. metadataBase 가 origin 이라 파일 규약은 basePath 없이
 * `https://logikitapps.com/opengraph-image`(= **허브 카드**)로 해석된다. 그래서 lib/site.ts 의
 * `OG_IMAGES` 로 `/wiki` 를 붙여 **명시 지정**하고, openGraph 를 여는 모든 페이지가 그걸
 * 펼쳐 넣어야 한다(함정 F).
 */

/** 카드에 싣는 주제 — 실제로 발행된 서적이 있는 분야만. 없는 걸 카드에 넣지 않는다. */
const TOPICS = ["Java", "C++", "JavaScript", "React", "Kubernetes"];

/** 펼친 책 — 헤더/앱 런처의 lucide BookOpen 과 같은 정체성(SVG). */
function Book() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 5h6a3 3 0 013 3v11a2.5 2.5 0 00-2.5-2.5H2z" />
      <path d="M22 5h-6a3 3 0 00-3 3v11a2.5 2.5 0 012.5-2.5H22z" />
    </svg>
  );
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "radial-gradient(125% 125% at 50% 0%, #1a1836 0%, #07070b 55%)",
          color: "#f3f4f8",
          fontFamily: "sans-serif",
        }}
      >
        {/* 브랜드 글로우 */}
        <div
          style={{
            position: "absolute",
            top: -180,
            left: 380,
            width: 520,
            height: 520,
            borderRadius: 9999,
            background: "radial-gradient(circle, rgba(99,102,241,0.42), transparent 70%)",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Book />
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>
            {siteConfig.name}
          </div>
        </div>

        <div
          style={{
            marginTop: 48,
            fontSize: 66,
            fontWeight: 800,
            letterSpacing: -2.5,
            lineHeight: 1.12,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span>IT 개념을 서적처럼,</span>
          <span
            style={{
              background: "linear-gradient(120deg, #8b5cf6, #22d3ee)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            퀴즈로 확인하며.
          </span>
        </div>

        <div style={{ marginTop: 44, display: "flex", gap: 14 }}>
          {TOPICS.map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "14px 26px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.05)",
                fontSize: 24,
                fontWeight: 600,
                color: "#c7cbe0",
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
