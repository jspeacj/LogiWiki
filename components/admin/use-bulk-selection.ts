"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * 검수 목록의 일괄 선택 상태 (서적·퀴즈 패널 공용).
 *
 * 두 패널이 같은 선택 UX 를 쓰므로 로직을 한곳에 둔다 — 한쪽에만 "목록이 갱신됐는데 선택이
 * 남아 있는" 버그가 생기는 걸 막는다.
 *
 * `ids` 는 현재 화면에 보이는 항목들이다. 승인·반려 후 목록이 줄어들면 사라진 id 의 선택은
 * 자동으로 무시된다(아래 selected 가 ids 로 교집합을 뜬다) — 서버 액션이 stale id 를
 * 받지 않게 하는 1차 방어다(서버도 status 로 한 번 더 좁힌다).
 */
export function useBulkSelection(ids: string[]) {
  const [raw, setRaw] = useState<Set<string>>(new Set());

  // 화면에 없는 id 는 선택으로 치지 않는다(목록 refresh 후 잔여 선택 방어).
  const selected = useMemo(() => ids.filter((id) => raw.has(id)), [ids, raw]);

  const toggle = useCallback((id: string) => {
    setRaw((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setRaw(new Set()), []);

  const allSelected = ids.length > 0 && selected.length === ids.length;

  const toggleAll = useCallback(() => {
    setRaw((prev) => {
      const everySelected = ids.length > 0 && ids.every((id) => prev.has(id));
      return everySelected ? new Set() : new Set(ids);
    });
  }, [ids]);

  return {
    /** 화면에 실제로 존재하는 선택 id 목록. */
    selected,
    isSelected: useCallback((id: string) => raw.has(id), [raw]),
    toggle,
    toggleAll,
    clear,
    allSelected,
    /** 일부만 선택됨 — 전체선택 체크박스의 indeterminate 표시용. */
    someSelected: selected.length > 0 && !allSelected,
  };
}
