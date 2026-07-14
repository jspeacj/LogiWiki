"use client";

import { useEffect } from "react";

/**
 * 챕터 본문의 코드블록마다 복사 버튼을 붙인다.
 *
 * /about 에서 "붙여넣어 실행되는 코드" 를 편집 기준으로 내걸었는데, 정작 사이트에서
 * 코드를 깔끔하게 복사할 방법이 없었다(줄 단위 span 이 잔뜩이라 드래그도 지저분하다).
 * 기술 서적 독자가 가장 자주 하는 동작이 이것이다.
 *
 * 본문은 dangerouslySetInnerHTML 로 들어오므로 React 트리 밖이다 → DOM 을 직접 만진다.
 * (mermaid.tsx 와 같은 패턴)
 */
export function CodeCopy() {
  useEffect(() => {
    const blocks = document.querySelectorAll<HTMLPreElement>(".book-prose pre.shiki");

    const cleanups: Array<() => void> = [];

    blocks.forEach((pre) => {
      if (pre.dataset.copyReady === "true") return;
      pre.dataset.copyReady = "true";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "code-copy-btn";
      btn.textContent = "복사";
      btn.setAttribute("aria-label", "코드 복사");

      let timer: ReturnType<typeof setTimeout> | undefined;

      const onClick = async () => {
        // pre.textContent 는 shiki 의 색상 span 을 벗겨낸 원본 코드 그대로다.
        const code = pre.querySelector("code")?.textContent ?? pre.textContent ?? "";
        try {
          await navigator.clipboard.writeText(code);
          btn.textContent = "복사됨";
          btn.dataset.copied = "true";
        } catch {
          // 클립보드 권한이 없거나 비보안 컨텍스트(http) — 사용자에게 알린다.
          btn.textContent = "복사 실패";
        }
        clearTimeout(timer);
        timer = setTimeout(() => {
          btn.textContent = "복사";
          delete btn.dataset.copied;
        }, 1600);
      };

      btn.addEventListener("click", onClick);
      pre.appendChild(btn);

      cleanups.push(() => {
        clearTimeout(timer);
        btn.removeEventListener("click", onClick);
        btn.remove();
        delete pre.dataset.copyReady;
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
