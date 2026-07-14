"use client";

import { useEffect } from "react";
import { useTheme } from "@/lib/theme/context";

/**
 * 챕터 본문의 ```mermaid 블록을 SVG 다이어그램으로 그린다.
 *
 * - 서버가 <pre class="mermaid">원문</pre> 을 내려주고, 여기서 브라우저가 그린다.
 *   서버 렌더를 하지 않는 이유: mermaid 는 DOM 이 필요해 jsdom 을 끌어오는데, 그게
 *   챕터 라우트를 500 으로 만들었던 ERR_REQUIRE_ESM 의 원인이었다.
 * - mermaid 는 무겁다(수백 KB). **다이어그램이 있는 챕터에서만** 이 컴포넌트를 렌더하고,
 *   그마저도 동적 import 로 늦게 불러온다. 다이어그램 없는 페이지는 한 바이트도 받지 않는다.
 * - securityLevel: "strict" — 라벨의 HTML 을 허용하지 않는다(mermaid 경유 XSS 차단).
 */
export function Mermaid() {
  const { resolved } = useTheme();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const nodes = document.querySelectorAll<HTMLElement>("pre.mermaid");
      if (nodes.length === 0) return;

      try {
        const mermaid = (await import("mermaid")).default;
        if (cancelled) return;

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: resolved === "light" ? "default" : "dark",
          fontFamily: "inherit",
        });

        // 테마가 바뀌면 다시 그려야 하므로, 이미 그려진 노드는 원문으로 되돌린다.
        nodes.forEach((node) => {
          const source = node.dataset.source;
          if (source) {
            node.textContent = source;
            node.removeAttribute("data-processed");
          } else {
            node.dataset.source = node.textContent ?? "";
          }
        });

        await mermaid.run({ nodes: Array.from(nodes) });
      } catch (e) {
        // 다이어그램 문법이 틀렸어도 페이지는 살아 있어야 한다 → 원문(코드)이 그대로 보인다.
        console.error("[mermaid] 렌더 실패 — 원문을 그대로 표시합니다", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resolved]);

  return null;
}
