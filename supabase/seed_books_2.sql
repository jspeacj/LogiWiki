-- ============================================================================
-- LogiWiki — 사람 저작 서적 시드 #2 (TypeScript / 알고리즘 / Python)
--
-- 실행 조건: 0001~0008 마이그레이션 완료 + 프로필 1개 이상 존재.
-- 결과: 서적 3권이 status='draft' 로 삽입된다.
--        → /wiki/admin/books 에서 검토 후 [발행하기] 를 눌러야 공개된다.
-- 멱등: 같은 slug 가 있으면 건너뛴다. 여러 번 실행해도 안전.
-- ============================================================================

alter table public.books disable trigger books_rate_limit;

do $$
declare
  author uuid;
  book   uuid;
begin
  select p.id into author
    from public.profiles p
    join auth.users u on u.id = p.id
   where lower(u.email) = 'jspeacj@gmail.com'
   limit 1;

  if author is null then
    select id into author from public.profiles order by created_at limit 1;
  end if;

  if author is null then
    raise notice 'LogiWiki seed_books_2: 프로필이 없습니다. 앱에서 먼저 가입한 뒤 다시 실행하세요.';
    return;
  end if;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 1) TypeScript — 타입 시스템
  -- ══════════════════════════════════════════════════════════════════════════
  if not exists (select 1 from public.books where slug = 'typescript-type-system' and language = 'ko') then
    insert into public.books (slug, language, title, description, topic, author_id, source, status)
    values (
      'typescript-type-system', 'ko',
      'TypeScript 타입 시스템의 사고방식',
      '구조적 타이핑, 좁히기(narrowing), 유니온과 제네릭까지. 타입을 "선언"이 아니라 "값의 집합"으로 보기 시작하면 TypeScript 에러 메시지가 갑자기 읽히기 시작합니다.',
      'typescript', author, 'human', 'draft'
    )
    returning id into book;

    insert into public.chapters (book_id, slug, title, body, sort_order) values
    (book, 'structural-typing', '구조적 타이핑 — 이름이 아니라 모양',
$md$## 학습 목표

- Java·C# 의 명목적 타이핑과 TypeScript 의 구조적 타이핑 차이를 설명할 수 있다.
- "타입은 값의 집합"이라는 관점으로 할당 가능성을 판단할 수 있다.

## 이름이 달라도 모양이 같으면 같은 타입

Java 라면 아래 코드는 컴파일되지 않습니다. `Point` 를 구현한다고 선언하지 않았으니까요. TypeScript 는 통과합니다.

```ts
interface Point {
  x: number;
  y: number;
}

function distance(p: Point): number {
  return Math.sqrt(p.x ** 2 + p.y ** 2);
}

const vector = { x: 3, y: 4, label: "속도" };
distance(vector);   // OK — 모양이 맞으면 된다 (5)
```

TypeScript 는 **선언이 아니라 구조**를 봅니다. `x: number` 와 `y: number` 를 가지고 있으면 `Point` 로 취급합니다. 추가 속성(`label`)이 있어도 상관없습니다. 이것을 **구조적 타이핑(structural typing)** 또는 덕 타이핑이라고 부릅니다.

## 타입 = 값의 집합

TypeScript 를 이해하는 가장 강력한 관점은 이것입니다.

> 타입은 **그 타입에 속하는 값들의 집합**이다.

| 타입 | 집합 |
| --- | --- |
| `never` | 공집합 (아무 값도 없음) |
| `undefined` | `{ undefined }` — 원소 1개 |
| `boolean` | `{ true, false }` — 원소 2개 |
| `number` | 모든 숫자 |
| `unknown` | 전체 집합 |

이 관점에서 보면 **할당 가능성 = 부분집합 관계**입니다.

```ts
type A = "red" | "blue";           // { "red", "blue" }
type B = "red" | "blue" | "green"; // { "red", "blue", "green" }

let a: A = "red";
let b: B = a;    // OK — A ⊂ B
let c: A = b;    // 에러 — B ⊄ A ("green" 이 A 에 없다)
```

유니온(`|`)은 합집합, 인터섹션(`&`)은 교집합입니다.

## 흔한 함정: 객체 리터럴만 엄격하다

```ts
const vector = { x: 3, y: 4, label: "속도" };
distance(vector);              // OK

distance({ x: 3, y: 4, label: "속도" });   // 에러!
// '{ x: number; y: number; label: string; }' 형식의 인수는
// 'Point' 형식의 매개 변수에 할당될 수 없습니다.
```

같은 값인데 왜 하나는 되고 하나는 안 될까요? **객체 리터럴을 직접 넘길 때만** TypeScript 가 "초과 속성 검사(excess property check)" 를 추가로 수행하기 때문입니다. 변수를 거치면 이 검사가 꺼집니다.

의도된 동작입니다. 리터럴을 바로 쓰는 경우는 오타(`lable` vs `label`)일 가능성이 높으니 잡아주는 것이고, 변수를 거친 경우는 "다른 데서 쓰던 객체를 재활용" 하는 정상적인 패턴이니 통과시키는 것입니다.

## 요약

- TypeScript 는 **이름이 아니라 구조**로 타입을 판단한다.
- 타입은 값의 집합, 할당 가능성은 부분집합 관계다.
- 객체 리터럴을 직접 넘길 때만 초과 속성 검사가 추가로 걸린다.

## 연습

`type X = string | number` 와 `type Y = string & number` 중 하나는 `never` 와 같습니다. 어느 쪽이고 왜 그럴까요?
$md$, 1000),

    (book, 'narrowing', '좁히기(narrowing)와 유니온',
$md$## 학습 목표

- 컨트롤 플로우에 따라 타입이 자동으로 좁혀지는 과정을 설명할 수 있다.
- 판별 유니온(discriminated union)으로 안전한 분기를 설계할 수 있다.

## 좁히기: 컴파일러는 코드 흐름을 읽는다

```ts
function print(value: string | number) {
  value.toUpperCase();   // 에러 — number 에는 toUpperCase 가 없다

  if (typeof value === "string") {
    value.toUpperCase(); // OK — 여기서 value 는 string
  } else {
    value.toFixed(2);    // OK — 여기서 value 는 number
  }
}
```

`typeof` 검사를 통과한 블록 안에서는 타입이 **자동으로 좁혀집니다**. 별도의 캐스팅이 필요 없습니다. 이것이 TypeScript 가 다른 타입 시스템과 크게 다른 점입니다.

좁히기를 유발하는 장치들:

| 장치 | 예 |
| --- | --- |
| `typeof` | `typeof x === "string"` |
| `instanceof` | `x instanceof Date` |
| `in` | `"radius" in shape` |
| 진리값 검사 | `if (x)` → `null`/`undefined` 제거 |
| 동등 비교 | `x === null` |

## 판별 유니온 — 실전에서 가장 많이 쓰는 패턴

각 멤버에 **공통 리터럴 필드(태그)** 를 두면 그 필드로 완벽하게 분기할 수 있습니다.

```ts
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rect"; width: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;   // radius 접근 가능
    case "rect":
      return shape.width * shape.height;    // width/height 접근 가능
  }
}
```

`kind` 하나만 보면 나머지 필드가 확정됩니다. API 응답(`{ status: "success" | "error" }`), 리듀서 액션 등 어디에나 적용됩니다.

## never 로 빠짐없음(exhaustiveness) 강제하기

`Shape` 에 새 도형을 추가했는데 `area` 를 고치는 걸 잊으면? **컴파일 에러로 잡을 수 있습니다.**

```ts
function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle": return Math.PI * shape.radius ** 2;
    case "rect":   return shape.width * shape.height;
    default:
      // 모든 케이스를 처리했다면 shape 는 never (공집합)
      const _exhaustive: never = shape;
      throw new Error(`처리되지 않은 도형: ${_exhaustive}`);
  }
}
```

새 멤버 `{ kind: "triangle" }` 를 추가하는 순간 `shape` 가 `never` 가 아니게 되어 `_exhaustive` 할당이 에러를 냅니다. **타입을 확장했을 때 고쳐야 할 곳을 컴파일러가 알려주는** 강력한 패턴입니다.

## 흔한 함정: as 로 입 막기

```ts
const user = response as User;   // 컴파일러: "네 말대로 하죠"
```

`as` 는 검사가 아니라 **컴파일러에게 조용히 하라고 명령하는 것**입니다. 런타임에는 아무 검증도 하지 않습니다. 외부 데이터(API 응답, `JSON.parse`)에는 `as` 대신 **타입 가드**나 zod 같은 런타임 검증 라이브러리를 쓰세요.

```ts
function isUser(v: unknown): v is User {
  return typeof v === "object" && v !== null && "id" in v;
}

if (isUser(response)) {
  response.id;   // 여기서만 안전하다
}
```

## 요약

- 컴파일러는 `typeof`/`in`/진리값 검사 등을 읽고 **타입을 자동으로 좁힌다**.
- 판별 유니온 + `switch` 가 실전 표준 패턴이다.
- `never` 할당으로 **빠짐없이 처리했는지** 컴파일 타임에 강제할 수 있다.
- `as` 는 검증이 아니다. 외부 데이터는 타입 가드로 검사하라.

## 연습

`value: string | null` 에서 `if (value)` 로 좁히면 `string` 만 남을까요? 빈 문자열 `""` 를 생각해 보세요.
$md$, 2000),

    (book, 'generics-and-utility-types', '제네릭과 유틸리티 타입',
$md$## 학습 목표

- 제네릭 함수가 타입 정보를 "흘려보내는" 방식을 이해한다.
- `Partial`·`Pick`·`Record` 같은 유틸리티 타입이 실제로 어떻게 만들어졌는지 안다.

## 제네릭은 타입 정보를 잃지 않게 한다

```ts
// 나쁨: 타입이 뭉개진다
function first(arr: any[]): any {
  return arr[0];
}
const x = first([1, 2, 3]);   // x: any — 숫자라는 걸 잊어버렸다

// 좋음: 들어온 타입이 나가는 타입에 이어진다
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}
const y = first([1, 2, 3]);   // y: number | undefined
```

제네릭의 본질은 "아무 타입이나 받는 것"이 아니라 **입력과 출력의 타입 관계를 표현하는 것**입니다. `any` 는 관계를 끊고, 제네릭은 잇습니다.

## keyof 와 인덱스 접근

```ts
function get<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { id: 1, name: "김철수" };

get(user, "name");   // string 으로 추론된다
get(user, "email");  // 에러 — "email" 은 keyof user 가 아니다
```

- `keyof T` — T 의 키들의 유니온. 여기선 `"id" | "name"`.
- `T[K]` — T 에서 K 키의 값 타입.

이 둘을 조합하면 **키에 따라 반환 타입이 달라지는** 함수를 타입 안전하게 만들 수 있습니다.

## 유틸리티 타입은 마법이 아니다

자주 쓰는 것들의 실제 정의는 놀랄 만큼 짧습니다.

```ts
// 모든 속성을 선택적으로
type Partial<T> = { [K in keyof T]?: T[K] };

// 모든 속성을 읽기 전용으로
type Readonly<T> = { readonly [K in keyof T]: T[K] };

// 일부 키만 골라내기
type Pick<T, K extends keyof T> = { [P in K]: T[P] };

// 키-값 맵
type Record<K extends keyof any, V> = { [P in K]: V };
```

`[K in keyof T]` 를 **매핑된 타입(mapped type)** 이라고 합니다. "T 의 각 키 K 에 대해" 라는 뜻의 반복문입니다.

실전 사용:

```ts
interface User {
  id: number;
  name: string;
  email: string;
}

type UserUpdate = Partial<User>;            // 모든 필드 선택적 — PATCH 요청 바디
type UserPreview = Pick<User, "id" | "name">; // 목록 카드용
type UserMap = Record<string, User>;         // id → User
type UserWithoutId = Omit<User, "id">;       // 생성 요청 바디
```

**중복 선언을 하지 마세요.** `User` 하나만 정의하고 나머지는 유틸리티 타입으로 파생시키면, `User` 가 바뀔 때 전부 자동으로 따라옵니다.

## 흔한 함정: 제네릭을 남용하기

```ts
// 과함 — T 가 한 번밖에 안 쓰인다
function log<T>(value: T): void {
  console.log(value);
}

// 충분하다
function log(value: unknown): void {
  console.log(value);
}
```

> **원칙**: 타입 파라미터가 **최소 두 곳**(입력↔출력, 또는 여러 입력 사이)에서 관계를 맺을 때만 제네릭을 쓴다. 한 번만 등장한다면 그건 그냥 `unknown` 이다.

## 요약

- 제네릭은 **입출력의 타입 관계**를 표현하는 도구다. `any` 와 반대다.
- `keyof T` + `T[K]` 로 키에 따라 반환 타입이 달라지는 함수를 만든다.
- 유틸리티 타입은 매핑된 타입으로 만들어진 짧은 정의다. **파생시켜 쓰고 중복 선언하지 말 것.**
- 타입 파라미터가 한 번만 쓰이면 제네릭이 필요 없다.

## 연습

`Omit<T, K>` 를 `Pick` 과 `Exclude` 를 이용해 직접 정의해 보세요.
$md$, 3000);

    raise notice 'LogiWiki seed_books_2: [TypeScript 타입 시스템] 생성 완료 (draft).';
  end if;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 2) 알고리즘 — 시간복잡도와 자료구조 선택
  -- ══════════════════════════════════════════════════════════════════════════
  if not exists (select 1 from public.books where slug = 'algorithm-complexity' and language = 'ko') then
    insert into public.books (slug, language, title, description, topic, author_id, source, status)
    values (
      'algorithm-complexity', 'ko',
      '시간복잡도와 자료구조 선택',
      'Big-O 를 외우는 것이 아니라 "왜 그 복잡도가 나오는가"를 이해합니다. 배열·해시·트리 중 무엇을 언제 쓸지, 코딩 테스트와 실무에서 반복해 마주치는 판단 기준을 정리합니다.',
      'algorithm', author, 'human', 'draft'
    )
    returning id into book;

    insert into public.chapters (book_id, slug, title, body, sort_order) values
    (book, 'big-o', 'Big-O 는 무엇을 재는가',
$md$## 학습 목표

- Big-O 가 측정하는 것과 측정하지 않는 것을 구분할 수 있다.
- 코드를 보고 시간복잡도를 계산할 수 있다.

## Big-O 는 "성장률"이다

Big-O 는 실행 시간(초)이 아니라 **입력이 커질 때 연산 횟수가 어떤 속도로 늘어나는가**를 나타냅니다. 그래서 상수와 낮은 차수 항은 버립니다.

```
3n² + 100n + 5000  →  O(n²)
```

`n` 이 10 이면 100n 이 지배적이지만, `n` 이 1,000,000 이면 `n²` 앞에서 나머지는 무의미해집니다. Big-O 는 **큰 입력에서의 최종 승부**를 봅니다.

| 복잡도 | 이름 | n=1,000,000 일 때 대략 |
| --- | --- | --- |
| O(1) | 상수 | 1 |
| O(log n) | 로그 | 20 |
| O(n) | 선형 | 1,000,000 |
| O(n log n) | 선형로그 | 20,000,000 |
| O(n²) | 이차 | 1,000,000,000,000 |

O(n²) 와 O(n log n) 의 차이가 곧 "몇 초"와 "몇 시간"의 차이입니다.

## 계산 규칙 3가지

**1. 순차 실행은 더하고, 큰 쪽만 남긴다.**

```python
for x in arr:      # O(n)
    print(x)
for y in arr:      # O(n)
    print(y)
# O(n) + O(n) = O(2n) = O(n)
```

**2. 중첩은 곱한다.**

```python
for x in arr:          # n번
    for y in arr:      # 각각 n번
        print(x, y)
# O(n × n) = O(n²)
```

**3. 절반씩 줄이면 O(log n).**

```python
def binary_search(arr, target):
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
# 매 반복마다 탐색 범위가 절반 → O(log n)
```

100만 개를 찾는 데 20번이면 됩니다. **정렬돼 있다는 전제**가 있어야 한다는 걸 잊지 마세요.

## 흔한 함정 1: 숨어 있는 반복문

```python
# 겉보기엔 반복문 하나 — 사실은 O(n²)
result = []
for x in arr:
    if x in result:      # 리스트의 in 은 O(n) 선형 탐색!
        continue
    result.append(x)
```

`list.in` 은 처음부터 끝까지 훑습니다. `set` 으로 바꾸면 O(1) 이 되어 전체가 O(n) 이 됩니다.

```python
seen = set()
result = []
for x in arr:
    if x in seen:        # set 의 in 은 O(1)
        continue
    seen.add(x)
    result.append(x)
```

**라이브러리 함수의 복잡도를 모르면 자기 코드의 복잡도도 모릅니다.**

## 흔한 함정 2: 문자열 이어붙이기

```python
s = ""
for word in words:
    s += word        # 매번 새 문자열 생성 → O(n²)

s = "".join(words)   # O(n)
```

Java 의 `String +` 도 반복문 안에서는 같은 문제입니다(`StringBuilder` 를 쓰세요).

## 요약

- Big-O 는 **성장률**이다. 상수와 낮은 차수는 버린다.
- 순차 = 더하기(큰 쪽만), 중첩 = 곱하기, 절반씩 = log.
- **라이브러리 연산의 복잡도를 알아야 한다.** `list.in` 은 O(n), `set.in` 은 O(1).

## 연습

배열에서 중복된 원소가 있는지 판별하는 함수를 O(n) 으로 작성해 보세요.
$md$, 1000),

    (book, 'array-vs-hash', '배열 · 해시 · 트리 — 무엇을 언제 쓰나',
$md$## 학습 목표

- 세 자료구조의 연산별 복잡도를 근거와 함께 설명할 수 있다.
- 문제를 보고 어떤 자료구조를 쓸지 즉시 판단할 수 있다.

## 한 장의 비교표

| 연산 | 배열(동적) | 해시(딕셔너리/셋) | 균형 트리 |
| --- | --- | --- | --- |
| 인덱스 접근 | **O(1)** | — | — |
| 값으로 검색 | O(n) | **O(1)** 평균 | O(log n) |
| 삽입/삭제(끝) | O(1) 분할상환 | **O(1)** | O(log n) |
| 삽입/삭제(중간) | O(n) | **O(1)** | O(log n) |
| **정렬 순서 유지** | ❌ | ❌ | **✅** |
| 범위 검색 | O(n) | ❌ | **O(log n)** |

## 왜 그런 복잡도가 나오나

**배열** — 메모리에 연속으로 놓입니다. 그래서 `arr[i]` 는 시작 주소 + i×크기 로 **계산 한 번**에 접근합니다(O(1)). 대신 중간에 삽입하면 뒤쪽을 전부 밀어야 합니다(O(n)).

**해시** — 키를 해시 함수로 숫자(버킷 번호)로 바꿔 그 자리에 바로 넣습니다. 계산 한 번이라 O(1). 대신 **순서가 없고**, 해시 충돌이 몰리면 최악 O(n) 으로 퇴화합니다.

**균형 트리** — 정렬 상태를 유지하며 절반씩 좁힙니다(O(log n)). 해시보다 느리지만 **순서와 범위 검색**을 얻습니다. DB 인덱스가 해시가 아니라 B-트리인 이유가 이것입니다.

## 판단 기준

> **"무엇으로 찾는가"를 먼저 물어보세요.**

- **위치(인덱스)로 찾는다** → 배열
- **키로 찾는다, 순서는 상관없다** → 해시 (대부분의 경우 정답)
- **정렬 순서가 필요하다 / 범위로 찾는다("10~20 사이")** → 트리
- **양 끝에서만 넣고 뺀다** → 스택·큐(덱)

## 실전 예제: 두 수의 합

"배열에서 더해서 target 이 되는 두 수의 인덱스를 찾아라."

```python
# 나쁨: 모든 쌍을 확인 — O(n²)
def two_sum(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]

# 좋음: "지금까지 본 값"을 해시에 기록 — O(n)
def two_sum(nums, target):
    seen = {}                       # 값 → 인덱스
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:      # O(1) 조회
            return [seen[complement], i]
        seen[num] = i
```

**패턴**: 이중 반복문이 보이면 "안쪽 반복문을 해시 조회로 바꿀 수 있나?"를 먼저 물어보세요. O(n²) → O(n) 으로 떨어지는 문제의 절반은 이 패턴입니다.

## 흔한 함정: 해시의 O(1) 은 평균이다

해시는 **평균** O(1) 이고 **최악** O(n) 입니다. 또 키를 해싱하는 비용이 있으므로, 키가 긴 문자열이면 "O(1)"이 생각보다 비쌉니다. n 이 아주 작을 때(수십 개)는 배열 선형 탐색이 더 빠른 경우도 많습니다. **복잡도는 큰 n 에서의 이야기**라는 걸 잊지 마세요.

## 요약

- 배열=위치, 해시=키, 트리=순서. **"무엇으로 찾는가"** 가 선택 기준이다.
- 이중 반복문 → 해시로 안쪽을 대체할 수 있는지 먼저 확인하라.
- 해시의 O(1) 은 평균이며 순서를 잃는다. 범위·정렬이 필요하면 트리.

## 연습

전화번호부처럼 "이름으로 찾기"와 "가나다순 출력"이 모두 필요하다면 어떤 자료구조를 쓰거나 조합해야 할까요?
$md$, 2000),

    (book, 'sorting', '정렬 — 어떤 것을 언제',
$md$## 학습 목표

- 대표 정렬 알고리즘의 복잡도와 특징을 구분할 수 있다.
- **안정 정렬(stable sort)** 이 왜 중요한지 실무 예로 설명할 수 있다.

## 비교 기반 정렬의 한계는 O(n log n)

원소를 두 개씩 비교해서 정렬하는 방식은 **이론적으로 O(n log n) 보다 빠를 수 없습니다.** 그러니 O(n log n) 정렬을 만났다면 그게 최선입니다.

| 알고리즘 | 평균 | 최악 | 안정성 | 메모리 |
| --- | --- | --- | --- | --- |
| 버블/삽입 | O(n²) | O(n²) | 안정 | O(1) |
| 퀵 정렬 | O(n log n) | **O(n²)** | 불안정 | O(log n) |
| 병합 정렬 | O(n log n) | O(n log n) | **안정** | O(n) |
| 힙 정렬 | O(n log n) | O(n log n) | 불안정 | O(1) |

- **퀵 정렬**: 평균이 가장 빠르고 캐시 효율이 좋아 실전 기본값이지만, 피벗을 잘못 고르면 최악 O(n²). (이미 정렬된 배열 + 첫 원소 피벗이 대표적 함정)
- **병합 정렬**: 최악에도 O(n log n) 을 보장하고 **안정적**이지만 추가 메모리가 필요.

Python 의 `sorted()`, Java 의 `Arrays.sort(Object[])` 는 **팀소트(Timsort)** 를 씁니다 — 병합 정렬 기반이라 안정적이고, 이미 정렬된 구간을 찾아내 실전 데이터에서 매우 빠릅니다.

## 안정 정렬이 왜 중요한가

**안정(stable)** = 같은 값의 원소들이 원래 순서를 유지한다.

이게 실무에서 결정적인 이유는 **다중 기준 정렬**입니다.

```python
people = [
    ("김철수", 30),
    ("이영희", 25),
    ("박민수", 30),
]

# 이름순으로 먼저 정렬한 뒤
people.sort(key=lambda p: p[0])
# 나이순으로 정렬하면 — 같은 나이 안에서는 이름순이 유지된다
people.sort(key=lambda p: p[1])

# [("이영희", 25), ("김철수", 30), ("박민수", 30)]
#                  ^^^^^^ 같은 30살 안에서 이름순 유지 (안정 정렬 덕분)
```

불안정 정렬이었다면 같은 나이 안의 순서가 뒤죽박죽이 됩니다. **"부차 기준으로 먼저 정렬하고, 주 기준으로 나중에 정렬한다"** — 안정 정렬에서만 성립하는 강력한 기법입니다.

## 정렬하지 않고 푸는 게 더 빠를 때

"가장 큰 K 개를 구하라"에 전체 정렬(O(n log n))은 과합니다.

```python
import heapq
# 힙으로 상위 K개만 — O(n log k)
top_k = heapq.nlargest(3, nums)
```

K 가 작으면 훨씬 빠릅니다. **문제가 요구하는 것보다 더 많은 일을 하고 있지 않은지** 늘 확인하세요.

## 흔한 함정: 반복문 안에서 정렬하기

```python
for query in queries:
    data.sort()          # 매번 O(n log n) — 전체가 O(q·n log n)
    ...

data.sort()              # 한 번만
for query in queries:    # 이후엔 이진 탐색 O(log n)
    ...
```

**정렬은 한 번 해두고 재사용**하는 전처리입니다.

## 요약

- 비교 기반 정렬의 하한은 **O(n log n)**. 그걸 만났으면 최선이다.
- 퀵=평균 최고·최악 O(n²), 병합=최악 보장·안정, 힙=메모리 O(1).
- **안정 정렬**이면 "부차 기준 → 주 기준" 순으로 두 번 정렬해 다중 기준을 구현할 수 있다.
- 상위 K개만 필요하면 힙(O(n log k))이 전체 정렬보다 빠르다.

## 연습

이미 정렬된 100만 개 배열에서 특정 값의 **개수**를 세는 가장 빠른 방법은 무엇일까요? (힌트: 이진 탐색 두 번)
$md$, 3000);

    raise notice 'LogiWiki seed_books_2: [알고리즘 복잡도] 생성 완료 (draft).';
  end if;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 3) Python — 파이썬다운 코드
  -- ══════════════════════════════════════════════════════════════════════════
  if not exists (select 1 from public.books where slug = 'pythonic-code' and language = 'ko') then
    insert into public.books (slug, language, title, description, topic, author_id, source, status)
    values (
      'pythonic-code', 'ko',
      '파이썬다운 코드 쓰기',
      '컴프리헨션, 이터레이터와 제너레이터, 그리고 파이썬 초보자가 반드시 한 번은 당하는 가변 기본 인자와 late binding 함정까지. 문법이 아니라 "왜 그렇게 동작하는가"를 다룹니다.',
      'python', author, 'human', 'draft'
    )
    returning id into book;

    insert into public.chapters (book_id, slug, title, body, sort_order) values
    (book, 'comprehensions', '컴프리헨션',
$md$## 학습 목표

- 리스트/딕셔너리/셋 컴프리헨션을 자유롭게 쓸 수 있다.
- 컴프리헨션을 **쓰지 말아야 할 때**를 판단할 수 있다.

## 기본 형태

```python
# 반복문
squares = []
for n in range(10):
    squares.append(n ** 2)

# 컴프리헨션 — 같은 일, 한 줄
squares = [n ** 2 for n in range(10)]
```

읽는 순서는 **`for` 부터** 입니다. "range(10)의 각 n에 대해, n**2 를 모은다."

## 필터링과 변형

```python
# 조건: for 뒤의 if
evens = [n for n in range(10) if n % 2 == 0]      # [0, 2, 4, 6, 8]

# 삼항 연산: for 앞의 if/else
labels = ["짝" if n % 2 == 0 else "홀" for n in range(4)]  # ['짝','홀','짝','홀']
```

`if` 의 **위치가 의미를 바꿉니다.** 뒤에 오면 걸러내고, 앞에 오면 변형합니다.

## 딕셔너리와 셋

```python
words = ["apple", "banana", "cherry"]

lengths = {w: len(w) for w in words}       # {'apple': 5, 'banana': 6, ...}
initials = {w[0] for w in words}           # {'a', 'b', 'c'}  ← 셋
```

`{}` 안에 `k: v` 가 있으면 딕셔너리, 값만 있으면 셋입니다.

## 중첩 — 반복문과 같은 순서로 쓴다

```python
matrix = [[1, 2], [3, 4]]

# 평탄화
flat = [x for row in matrix for x in row]   # [1, 2, 3, 4]

# 같은 코드를 반복문으로 풀면 순서가 똑같다
flat = []
for row in matrix:       # 바깥쪽이 먼저
    for x in row:        # 안쪽이 나중
        flat.append(x)
```

헷갈리면 **반복문으로 풀어 쓴 순서 그대로 왼쪽부터 나열**한다고 기억하세요.

## 흔한 함정: 컴프리헨션 남용

```python
# 읽을 수 없다 — 이건 파이썬답지 않다
result = [transform(x) for sub in data if sub for x in sub if x and check(x)]
```

컴프리헨션의 목적은 **짧게 쓰는 것이 아니라 읽기 쉽게 쓰는 것**입니다. 조건이 두 개를 넘거나 중첩이 두 겹을 넘으면 그냥 `for` 문으로 쓰세요. 부수효과(파일 쓰기, print)를 위해 컴프리헨션을 쓰는 것도 안티패턴입니다.

```python
# 나쁨: 결과 리스트를 버리면서 부수효과만 노림
[print(x) for x in items]

# 좋음
for x in items:
    print(x)
```

## 요약

- `[식 for x in 반복가능 if 조건]` — `for` 부터 읽는다.
- `if` 가 뒤면 필터, 앞이면 삼항 변형.
- `{}` 로 딕셔너리·셋 컴프리헨션도 된다.
- **조건 3개 이상 / 중첩 3겹 이상 / 부수효과** → 반복문으로 돌아가라.

## 연습

`words = ["a", "bb", "ccc"]` 에서 길이가 2 이상인 단어만 대문자로 바꾼 리스트를 컴프리헨션으로 만들어 보세요.
$md$, 1000),

    (book, 'generators', '이터레이터와 제너레이터',
$md$## 학습 목표

- `for` 문이 내부적으로 무엇을 하는지 설명할 수 있다.
- 제너레이터로 **메모리를 쓰지 않고** 큰 데이터를 처리할 수 있다.

## for 문의 정체

```python
for x in [1, 2, 3]:
    print(x)
```

파이썬은 내부적으로 이렇게 합니다.

```python
it = iter([1, 2, 3])       # 이터레이터를 얻고
while True:
    try:
        x = next(it)       # 하나씩 꺼내다가
        print(x)
    except StopIteration:  # 다 떨어지면 멈춘다
        break
```

`__iter__` 와 `__next__` 만 있으면 무엇이든 `for` 에 넣을 수 있습니다. 리스트여야 할 이유가 전혀 없습니다.

## 제너레이터 — yield 하나로 이터레이터 만들기

```python
def countdown(n):
    while n > 0:
        yield n            # 값을 내놓고 여기서 "일시정지"
        n -= 1

for x in countdown(3):
    print(x)               # 3, 2, 1
```

`yield` 가 있으면 그 함수는 **호출해도 실행되지 않습니다.** 제너레이터 객체를 반환할 뿐이고, `next()` 를 부를 때마다 `yield` 까지 실행하고 **상태를 유지한 채 멈춥니다.**

## 왜 중요한가 — 메모리

10GB 로그 파일에서 에러 줄만 세어야 한다면?

```python
# 나쁨: 파일 전체를 메모리에 올린다 — 10GB
lines = open("app.log").readlines()
errors = [l for l in lines if "ERROR" in l]
print(len(errors))

# 좋음: 한 줄씩 흘려보낸다 — 메모리는 한 줄 분량
def error_lines(path):
    with open(path) as f:
        for line in f:                 # 파일 객체 자체가 이터레이터다
            if "ERROR" in line:
                yield line

print(sum(1 for _ in error_lines("app.log")))
```

제너레이터는 **값을 만들어 두는 게 아니라, 필요할 때 하나씩 계산합니다(지연 평가).** 그래서 무한 수열도 표현할 수 있습니다.

```python
def naturals():
    n = 1
    while True:            # 무한 루프인데 멈추지 않는다
        yield n
        n += 1

import itertools
print(list(itertools.islice(naturals(), 5)))   # [1, 2, 3, 4, 5]
```

## 제너레이터 표현식

컴프리헨션의 `[]` 를 `()` 로 바꾸면 제너레이터가 됩니다.

```python
squares_list = [n ** 2 for n in range(1_000_000)]   # 리스트 생성 — 메모리 큼
squares_gen  = (n ** 2 for n in range(1_000_000))   # 제너레이터 — 메모리 거의 0

total = sum(n ** 2 for n in range(1_000_000))       # 함수 인자면 괄호 생략 가능
```

`sum`, `any`, `all`, `max` 처럼 **한 번 훑고 끝나는** 함수에 넘길 때는 리스트를 만들 이유가 없습니다.

## 흔한 함정: 제너레이터는 한 번만 쓸 수 있다

```python
gen = (n for n in range(3))
print(list(gen))   # [0, 1, 2]
print(list(gen))   # []  ← 이미 소진됐다!
```

리스트와 달리 **재사용이 안 됩니다.** 두 번 순회해야 한다면 리스트로 변환하거나 제너레이터를 다시 만드세요. `len()` 도 쓸 수 없습니다(끝까지 가보기 전엔 길이를 모르니까요).

## 요약

- `for` 는 `iter()` + `next()` + `StopIteration` 이다.
- `yield` 가 있으면 제너레이터. 호출 시점이 아니라 **`next()` 시점에** 실행된다.
- 지연 평가라 **메모리를 거의 쓰지 않는다.** 큰 파일·무한 수열에 적합.
- **한 번 소진하면 끝.** `len()` 불가, 재사용 불가.

## 연습

`sum([n ** 2 for n in range(10**7)])` 와 `sum(n ** 2 for n in range(10**7))` 의 메모리 사용량 차이를 설명해 보세요.
$md$, 2000),

    (book, 'gotchas', '파이썬의 유명한 함정들',
$md$## 학습 목표

- 가변 기본 인자와 late binding 함정을 재현하고 고칠 수 있다.
- 얕은 복사/깊은 복사의 차이를 안다.

## 함정 1 — 가변 기본 인자

```python
def add_item(item, items=[]):     # 위험!
    items.append(item)
    return items

print(add_item("a"))   # ['a']
print(add_item("b"))   # ['a', 'b']   ← 왜 'a' 가 남아 있지?
```

**기본값은 함수 정의 시점에 딱 한 번 평가됩니다.** 그 리스트 하나를 모든 호출이 공유합니다.

```python
def add_item(item, items=None):   # 올바른 관용구
    if items is None:
        items = []
    items.append(item)
    return items
```

리스트·딕셔너리·셋 등 **가변 객체를 기본값으로 쓰지 마세요.** `None` 을 두고 함수 안에서 만드는 것이 표준 패턴입니다.

## 함정 2 — 반복문 안의 클로저 (late binding)

```python
funcs = []
for i in range(3):
    funcs.append(lambda: i)

print([f() for f in funcs])   # [2, 2, 2]  ← [0, 1, 2] 가 아니다!
```

람다는 `i` 의 **값**이 아니라 **변수 자체**를 기억합니다. 호출 시점(반복문이 끝난 뒤)에 `i` 를 읽으니 전부 마지막 값 2 입니다.

```python
# 해법: 기본 인자로 지금의 값을 붙잡는다
for i in range(3):
    funcs.append(lambda i=i: i)   # 기본값은 정의 시점에 평가 → 값이 고정된다

print([f() for f in funcs])   # [0, 1, 2]
```

역설적이지만, 함정 1의 원인("기본값은 정의 시점에 평가된다")이 함정 2의 **해법**입니다.

## 함정 3 — is 와 == 를 혼동하기

```python
a = [1, 2]
b = [1, 2]
a == b     # True  — 값이 같은가
a is b     # False — 같은 객체인가

x = 256
y = 256
x is y     # True  — 작은 정수는 캐싱되어 재사용된다

x = 257
y = 257
x is y     # False — 구현 세부사항이다. 절대 의존하지 말 것
```

> **규칙**: 값 비교는 `==`. `is` 는 **`None` 검사에만** 쓴다 (`if x is None`).

## 함정 4 — 얕은 복사

```python
original = [[1, 2], [3, 4]]
copied = original[:]          # 얕은 복사
copied[0].append(99)

print(original)   # [[1, 2, 99], [3, 4]]  ← 원본도 바뀌었다!
```

`[:]` 나 `list()` 는 **바깥 리스트만** 새로 만들고, 안쪽 리스트는 같은 객체를 가리킵니다.

```python
import copy
deep = copy.deepcopy(original)   # 중첩된 것까지 전부 새로
```

중첩 구조를 복사할 땐 `copy.deepcopy` 를 쓰세요. (다만 깊은 복사는 느리므로, 애초에 불변 자료구조나 튜플을 쓰는 설계가 더 나을 때가 많습니다.)

## 요약

- 기본값은 **정의 시점에 한 번** 평가된다 → 가변 기본 인자 금지, `None` 관용구.
- 클로저는 값이 아니라 **변수**를 붙잡는다 → 기본 인자로 고정.
- `is` 는 객체 동일성. **`None` 검사에만** 쓴다.
- `[:]` 는 얕은 복사. 중첩 구조는 `copy.deepcopy`.

## 연습

`def f(x, cache={}):` 형태로 메모이제이션을 구현하는 코드를 종종 봅니다. 이것은 함정일까요, 아니면 의도적인 활용일까요? 근거를 들어 설명해 보세요.
$md$, 3000);

    raise notice 'LogiWiki seed_books_2: [파이썬다운 코드] 생성 완료 (draft).';
  end if;
end $$;

alter table public.books enable trigger books_rate_limit;

-- ============================================================================
-- 퀴즈 시드 #2 — 객관식(mcq). AI API 없이 즉시 채점된다.
-- ============================================================================
do $$
begin
  if exists (select 1 from public.quizzes where topic = 'typescript' and prompt like '%구조적%') then
    raise notice 'LogiWiki seed_books_2: 퀴즈 이미 존재.';
    return;
  end if;

  insert into public.quizzes (type, topic, difficulty, language, prompt, choices, answer, explanation, source, status) values
  -- ── TypeScript ──
  ('mcq', 'typescript', 'easy', 'ko',
   'TypeScript 가 타입 호환성을 판단하는 방식은?',
   '[{"key":"a","text":"명목적 타이핑 — 선언한 이름이 같아야 한다"},{"key":"b","text":"구조적 타이핑 — 모양(속성)이 맞으면 된다"},{"key":"c","text":"런타임에 실제 값을 검사한다"},{"key":"d","text":"상속 관계만 본다"}]'::jsonb,
   'b',
   'TypeScript 는 구조적 타이핑을 씁니다. interface 를 구현한다고 선언하지 않아도, 필요한 속성을 모두 가지고 있으면 그 타입으로 취급됩니다.',
   'human', 'published'),

  ('mcq', 'typescript', 'medium', 'ko',
   'switch 문의 default 절에서 const _e: never = shape; 를 쓰는 이유는?',
   '[{"key":"a","text":"런타임 성능을 높이려고"},{"key":"b","text":"모든 케이스를 처리했는지 컴파일 타임에 강제하려고"},{"key":"c","text":"에러를 무시하려고"},{"key":"d","text":"타입을 any 로 만들려고"}]'::jsonb,
   'b',
   '모든 케이스를 처리했다면 그 지점의 타입은 never(공집합)입니다. 유니온에 새 멤버를 추가하면 never 가 아니게 되어 컴파일 에러가 나므로, 고쳐야 할 곳을 컴파일러가 알려줍니다.',
   'human', 'published'),

  ('mcq', 'typescript', 'medium', 'ko',
   '다음 중 as 단언(assertion)에 대한 설명으로 옳은 것은?',
   '[{"key":"a","text":"런타임에 타입을 검증한다"},{"key":"b","text":"컴파일 타임 검사만 우회할 뿐 런타임 검증은 하지 않는다"},{"key":"c","text":"값을 실제로 변환한다"},{"key":"d","text":"타입 가드와 동일하다"}]'::jsonb,
   'b',
   'as 는 컴파일러에게 "내가 안다"고 주장하는 것일 뿐, 런타임에는 아무 일도 하지 않습니다. API 응답 같은 외부 데이터는 타입 가드나 런타임 검증 라이브러리로 확인해야 합니다.',
   'human', 'published'),

  -- ── 알고리즘 ──
  ('mcq', 'algorithm', 'easy', 'ko',
   '3n² + 100n + 5000 의 시간복잡도를 Big-O 로 나타내면?',
   '[{"key":"a","text":"O(n)"},{"key":"b","text":"O(n²)"},{"key":"c","text":"O(3n²)"},{"key":"d","text":"O(n² + n)"}]'::jsonb,
   'b',
   'Big-O 는 입력이 커질 때의 성장률만 봅니다. 상수 계수(3)와 낮은 차수 항(100n, 5000)은 모두 버립니다.',
   'human', 'published'),

  ('mcq', 'algorithm', 'medium', 'ko',
   'Python 에서 for x in arr: if x in result 형태의 코드가 O(n²) 이 되는 이유는?',
   '[{"key":"a","text":"for 문이 두 번 중첩돼서"},{"key":"b","text":"리스트의 in 연산이 O(n) 선형 탐색이라서"},{"key":"c","text":"append 가 O(n) 이라서"},{"key":"d","text":"Python 이 느려서"}]'::jsonb,
   'b',
   'list 의 in 은 처음부터 끝까지 훑는 O(n) 연산입니다. 이것이 n번 반복되어 O(n²)이 됩니다. result 를 set 으로 바꾸면 in 이 O(1)이 되어 전체가 O(n)이 됩니다.',
   'human', 'published'),

  ('mcq', 'algorithm', 'medium', 'ko',
   '안정 정렬(stable sort)의 정의로 옳은 것은?',
   '[{"key":"a","text":"최악의 경우에도 O(n log n) 을 보장한다"},{"key":"b","text":"추가 메모리를 쓰지 않는다"},{"key":"c","text":"같은 값을 가진 원소들의 원래 순서가 유지된다"},{"key":"d","text":"항상 오름차순으로 정렬된다"}]'::jsonb,
   'c',
   '안정 정렬은 동일한 키를 가진 원소들의 상대적 순서를 보존합니다. 덕분에 부차 기준으로 먼저 정렬한 뒤 주 기준으로 다시 정렬하는 다중 기준 정렬이 가능합니다.',
   'human', 'published'),

  -- ── Python ──
  ('mcq', 'python', 'medium', 'ko',
   'def add(item, items=[]) 처럼 리스트를 기본 인자로 쓰면 안 되는 이유는?',
   '[{"key":"a","text":"문법 오류이기 때문"},{"key":"b","text":"기본값이 함수 정의 시점에 한 번만 평가되어 모든 호출이 같은 리스트를 공유하기 때문"},{"key":"c","text":"성능이 느리기 때문"},{"key":"d","text":"리스트는 인자로 못 받기 때문"}]'::jsonb,
   'b',
   '기본값은 함수가 정의될 때 딱 한 번 평가됩니다. 그 리스트 객체 하나를 모든 호출이 공유하므로 호출할수록 값이 누적됩니다. items=None 을 두고 함수 안에서 생성하는 것이 표준 관용구입니다.',
   'human', 'published'),

  ('mcq', 'python', 'medium', 'ko',
   '[n ** 2 for n in range(10**7)] 대신 (n ** 2 for n in range(10**7)) 를 쓰면 얻는 이점은?',
   '[{"key":"a","text":"실행 속도가 항상 10배 빨라진다"},{"key":"b","text":"값을 미리 만들지 않고 필요할 때 하나씩 생성해 메모리를 거의 쓰지 않는다"},{"key":"c","text":"결과를 여러 번 재사용할 수 있다"},{"key":"d","text":"len() 을 쓸 수 있게 된다"}]'::jsonb,
   'b',
   '괄호를 쓰면 제너레이터 표현식이 되어 지연 평가됩니다. 메모리를 거의 쓰지 않지만, 한 번 소진하면 재사용할 수 없고 len() 도 쓸 수 없습니다.',
   'human', 'published'),

  ('mcq', 'python', 'easy', 'ko',
   'is 연산자를 써야 하는 경우는?',
   '[{"key":"a","text":"문자열의 내용이 같은지 비교할 때"},{"key":"b","text":"두 리스트의 값이 같은지 비교할 때"},{"key":"c","text":"값이 None 인지 검사할 때"},{"key":"d","text":"숫자의 크기를 비교할 때"}]'::jsonb,
   'c',
   'is 는 두 이름이 같은 객체를 가리키는지(동일성) 검사합니다. 값 비교는 == 를 쓰고, is 는 x is None 처럼 None 검사에만 쓰는 것이 원칙입니다.',
   'human', 'published');

  raise notice 'LogiWiki seed_books_2: 퀴즈 9개 생성 완료 (published).';
end $$;
