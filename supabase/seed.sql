-- ============================================================================
-- LogiWiki — 데모 서적 시드 (선택)
-- 0001~0002 마이그레이션 실행 + 프로필이 1개 이상 존재할 때 동작한다.
-- (books.author_id 가 profiles 를 FK 참조 → 먼저 가입해 프로필을 만든 뒤 실행)
-- Supabase SQL Editor 에 붙여넣어 실행. 이미 시드됐으면 무시.
-- ============================================================================
do $$
declare
  author uuid;
  book uuid;
begin
  select id into author from public.profiles order by created_at limit 1;
  if author is null then
    raise notice 'LogiWiki seed: 프로필이 없습니다. 먼저 가입 후 다시 실행하세요.';
    return;
  end if;

  if exists (select 1 from public.books where slug = 'react-hooks-guide' and language = 'ko') then
    raise notice 'LogiWiki seed: 이미 시드됨.';
    return;
  end if;

  insert into public.books (slug, language, title, description, topic, author_id, source, status, published_at)
  values (
    'react-hooks-guide', 'ko',
    '실전 React Hooks 완벽 가이드',
    'useState·useEffect 부터 커스텀 훅 설계까지, 실무에서 바로 쓰는 React Hooks 를 예제 중심으로 정리한 데모 서적입니다.',
    'react', author, 'human', 'published', now()
  )
  returning id into book;

  insert into public.chapters (book_id, slug, title, body, sort_order) values
  (book, 'intro', '들어가며',
$md$# 들어가며

React Hooks 는 함수형 컴포넌트에서 상태와 생명주기를 다루는 표준 방법입니다.

- 클래스 없이 상태 관리
- 로직 재사용(커스텀 훅)
- 관심사 분리

> 이 서적은 **AI 초안 + 사람 검수** 워크플로를 검증하기 위한 데모 콘텐츠입니다.
$md$, 1000),
  (book, 'usestate', 'useState 로 상태 다루기',
$md$## useState

가장 기본이 되는 훅입니다.

```jsx
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

### 함정
- 상태 업데이트는 **비동기**로 배칭됩니다.
- 이전 값이 필요하면 함수형 업데이트 `setCount(c => c + 1)` 를 쓰세요.
$md$, 2000),
  (book, 'custom-hooks', '커스텀 훅 설계',
$md$## 커스텀 훅

`use` 로 시작하는 함수로 로직을 캡슐화합니다.

```jsx
function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = () => setOn((v) => !v);
  return [on, toggle];
}
```

| 원칙 | 설명 |
| --- | --- |
| 단일 책임 | 하나의 관심사만 |
| 조합 가능 | 훅 안에서 다른 훅 사용 |
$md$, 3000);

  raise notice 'LogiWiki seed: 데모 서적 생성 완료.';
end $$;
