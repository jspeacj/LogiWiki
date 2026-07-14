-- ============================================================================
-- LogiWiki — 사람 저작 서적 시드 (Claude Code 로 작성 → 관리자 검수 후 발행)
--
-- 실행 조건:
--   1) 0001~0008 마이그레이션 완료
--   2) 관리자 계정(jspeacj@gmail.com)으로 앱에서 최소 1회 가입 → profiles 행 존재
--      (없으면 가장 먼저 가입한 프로필을 저자로 사용)
--
-- 결과: 서적 3권이 **status='draft'** 로 들어간다.
--   → /wiki/admin/books 에서 내용을 검토하고 [발행하기] 를 눌러야 공개된다.
--   → 이것이 이 플랫폼의 "사람 검수" 규칙이다. 자동 발행하지 않는다.
--
-- 멱등: 같은 slug 가 이미 있으면 건너뛴다. 여러 번 실행해도 안전.
-- ============================================================================

-- 서적 작성 레이트리밋(60초 쿨다운)은 사람의 연속 작성을 막기 위한 것이라,
-- 한 트랜잭션에서 여러 권을 시드할 때는 잠시 끈다. 끝나면 반드시 다시 켠다.
alter table public.books disable trigger books_rate_limit;

do $$
declare
  author uuid;
  book   uuid;
begin
  -- 저자 = 관리자 프로필(없으면 최초 가입자).
  select p.id into author
    from public.profiles p
    join auth.users u on u.id = p.id
   where lower(u.email) = 'jspeacj@gmail.com'
   limit 1;

  if author is null then
    select id into author from public.profiles order by created_at limit 1;
  end if;

  if author is null then
    raise notice 'LogiWiki seed_books: 프로필이 없습니다. 앱에서 먼저 가입한 뒤 다시 실행하세요.';
    return;
  end if;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 1) Java — 실전 제네릭
  -- ══════════════════════════════════════════════════════════════════════════
  if not exists (select 1 from public.books where slug = 'java-generics' and language = 'ko') then
    insert into public.books (slug, language, title, description, topic, author_id, source, status)
    values (
      'java-generics', 'ko',
      '실전 Java 제네릭',
      '타입 파라미터부터 와일드카드(PECS), 타입 소거의 함정까지. 컴파일러가 무엇을 검사하고 무엇을 지우는지 이해하면 제네릭 코드가 갑자기 쉬워집니다.',
      'java', author, 'human', 'draft'
    )
    returning id into book;

    insert into public.chapters (book_id, slug, title, body, sort_order) values
    (book, 'why-generics', '제네릭은 무엇을 해결하는가',
$md$## 학습 목표

- 제네릭이 없던 시절의 코드가 왜 위험했는지 설명할 수 있다.
- 제네릭이 **런타임이 아니라 컴파일 타임**에 무엇을 보장하는지 구분할 수 있다.

## 문제: 타입 없는 컨테이너

Java 5 이전의 컬렉션은 모든 것을 `Object` 로 담았습니다.

```java
List list = new ArrayList();
list.add("hello");
list.add(42);              // 아무도 막지 않는다

String s = (String) list.get(1);  // 컴파일은 통과, 실행 시 ClassCastException
```

문제는 `list.get(1)` 이 터진다는 게 아닙니다. **잘못된 값이 들어간 시점(`add(42)`)과 터지는 시점(`get`)이 멀리 떨어져 있다**는 것입니다. 원인을 찾으려면 리스트에 무엇이 언제 들어갔는지 전부 추적해야 합니다.

## 해법: 타입을 파라미터로

```java
List<String> list = new ArrayList<>();
list.add("hello");
list.add(42);              // 컴파일 에러 — 여기서 즉시 막힌다

String s = list.get(0);    // 캐스팅 불필요
```

제네릭이 하는 일은 두 가지입니다.

1. **오류를 앞당긴다.** 런타임 `ClassCastException` 이 컴파일 에러로 바뀝니다.
2. **캐스팅을 지운다.** `(String)` 을 손으로 쓰지 않아도 됩니다. (사실 컴파일러가 대신 넣어줍니다 — 4장에서 다룹니다.)

## 흔한 함정: raw type 은 전염된다

제네릭 클래스를 타입 인자 없이 쓰는 것을 **raw type** 이라고 합니다.

```java
List<String> safe = new ArrayList<>();
List raw = safe;           // 경고만 뜨고 통과
raw.add(42);               // 컴파일 통과!
String s = safe.get(0);    // 런타임 폭발
```

`raw` 를 거치는 순간 컴파일러의 검사가 통째로 꺼집니다. **레거시 코드와의 호환을 위해 남아 있을 뿐, 새 코드에서는 절대 쓰지 마세요.** IDE의 "raw type" 경고를 켜두는 것을 권합니다.

## 요약

- 제네릭은 **컴파일 타임 안전장치**다. 런타임에는 타입 정보가 대부분 사라진다.
- 얻는 것: 이른 오류 발견 + 캐스팅 제거.
- raw type 은 그 안전장치를 무력화한다. 쓰지 말 것.

## 연습

`Box` 라는 클래스가 값 하나를 담는다고 할 때, `Box` 에 `String` 을 넣고 `Integer` 로 꺼내려는 코드가 **컴파일 시점에** 막히도록 선언하려면 어떻게 해야 할까요?
$md$, 1000),

    (book, 'type-parameters', '타입 파라미터 선언하기',
$md$## 학습 목표

- 제네릭 클래스와 제네릭 메서드를 직접 선언할 수 있다.
- 타입 파라미터에 **상한(bound)** 을 걸어 사용 가능한 연산을 늘릴 수 있다.

## 제네릭 클래스

타입 파라미터는 클래스 이름 뒤 `<>` 안에 선언합니다.

```java
public class Box<T> {
    private T value;

    public void set(T value) { this.value = value; }
    public T get() { return value; }
}

Box<String> box = new Box<>();   // 다이아몬드 연산자 — 타입 추론
box.set("hello");
String s = box.get();            // 캐스팅 없음
```

관례적으로 `T`(Type), `E`(Element), `K`/`V`(Key/Value), `R`(Result) 를 씁니다.

## 제네릭 메서드

메서드 단위로도 타입 파라미터를 선언할 수 있습니다. **반환 타입 앞**에 `<T>` 가 온다는 점이 낯설지만, 이 위치가 "이 메서드는 T 를 스스로 도입한다"는 선언입니다.

```java
public static <T> List<T> listOf(T a, T b) {
    List<T> list = new ArrayList<>();
    list.add(a);
    list.add(b);
    return list;
}

List<String> names = listOf("a", "b");   // T 는 String 으로 추론된다
```

## 상한: 타입 파라미터로 무엇을 할 수 있게 할 것인가

문제가 하나 있습니다. `T` 는 아무 타입이나 될 수 있으므로, 컴파일러는 `T` 에 대해 **`Object` 의 메서드밖에 호출할 수 없다**고 가정합니다.

```java
public static <T> T max(T a, T b) {
    return a.compareTo(b) > 0 ? a : b;   // 컴파일 에러 — T 에 compareTo 가 있는지 모른다
}
```

`extends` 로 상한을 걸면 컴파일러가 그 타입의 메서드를 허용합니다.

```java
public static <T extends Comparable<T>> T max(T a, T b) {
    return a.compareTo(b) > 0 ? a : b;   // OK
}

max(3, 7);           // 7
max("apple", "pie"); // "pie"
```

`extends` 는 클래스든 인터페이스든 똑같이 씁니다(`implements` 를 쓰지 않습니다). `&` 로 여러 개를 걸 수도 있습니다: `<T extends Comparable<T> & Serializable>`.

## 흔한 함정: static 필드에는 T 를 쓸 수 없다

```java
public class Box<T> {
    private static T shared;   // 컴파일 에러
}
```

`T` 는 **인스턴스마다** 정해지는데 static 필드는 클래스당 하나뿐이라, `Box<String>` 과 `Box<Integer>` 가 어떤 `T` 를 공유해야 할지 정의되지 않습니다.

## 요약

- 클래스: `class Box<T>`, 메서드: `static <T> T method(...)` — 위치가 다르다.
- 상한 `<T extends X>` 를 걸어야 `T` 에 대해 `X` 의 메서드를 호출할 수 있다.
- static 컨텍스트에서는 클래스의 타입 파라미터를 쓸 수 없다.

## 연습

숫자 리스트의 합을 구하는 `static <T extends Number> double sum(List<T> list)` 를 작성해 보세요. 힌트: `Number` 에는 `doubleValue()` 가 있습니다.
$md$, 2000),

    (book, 'wildcards-pecs', '와일드카드와 PECS',
$md$## 학습 목표

- `List<Object>` 와 `List<?>` 와 `List<? extends Object>` 의 차이를 설명할 수 있다.
- PECS(Producer Extends, Consumer Super) 규칙을 언제 적용해야 하는지 판단할 수 있다.

## 제네릭은 공변(covariant)이 아니다

이것이 제네릭에서 가장 많이 걸려 넘어지는 지점입니다.

```java
Object[] arr = new String[1];   // 배열은 통과한다 (공변)
arr[0] = 42;                    // 런타임 ArrayStoreException

List<Object> list = new ArrayList<String>();  // 컴파일 에러!
```

`String` 은 `Object` 의 하위 타입이지만, **`List<String>` 은 `List<Object>` 의 하위 타입이 아닙니다.** 왜냐하면 만약 허용된다면 `list.add(42)` 를 막을 방법이 없어지기 때문입니다. 배열이 저지른 실수를 제네릭은 반복하지 않습니다.

## 그래서 와일드카드가 필요하다

"어떤 타입의 리스트든 받아서 출력만 하겠다"를 표현하려면 `?` 를 씁니다.

```java
static void printAll(List<?> list) {   // 무엇의 리스트인지는 모른다
    for (Object o : list) {
        System.out.println(o);
    }
}

printAll(List.of("a", "b"));   // OK
printAll(List.of(1, 2, 3));    // OK
```

단, **모르는 타입에는 넣을 수 없습니다.** `list.add(...)` 는 컴파일 에러입니다(`null` 만 예외). 무엇을 담는 리스트인지 모르는데 아무거나 넣게 하면 안전이 깨지니까요.

## PECS

상한/하한 와일드카드는 다음 규칙으로 외웁니다.

> **Producer → `extends`, Consumer → `super`**

- 데이터를 **읽어오기만** 하는(= 생산자) 파라미터 → `? extends T`
- 데이터를 **넣기만** 하는(= 소비자) 파라미터 → `? super T`

```java
// src 에서 읽고(생산), dst 에 넣는다(소비)
public static <T> void copy(List<? extends T> src, List<? super T> dst) {
    for (T item : src) {
        dst.add(item);
    }
}

List<Integer> ints = List.of(1, 2, 3);
List<Number> nums = new ArrayList<>();
copy(ints, nums);   // Integer 를 읽어 Number 에 넣는다 — OK
```

`? extends T` 리스트에서는 **꺼낸 값이 T 임이 보장**되지만 넣을 수는 없고, `? super T` 리스트에는 **T 를 넣을 수 있지만** 꺼내면 `Object` 로만 받습니다. 각 방향으로 안전한 연산만 열어주는 것입니다.

## 흔한 함정: 반환 타입에 와일드카드를 쓰지 말 것

```java
public List<? extends Number> getNumbers() { ... }   // 나쁜 설계
```

호출한 쪽이 결과를 다시 와일드카드로 다뤄야 해서 전염됩니다. **와일드카드는 파라미터에만** 쓰고, 반환 타입은 구체적으로 두세요.

## 요약

- `List<String>` 은 `List<Object>` 의 하위 타입이 **아니다**.
- `<?>` = 타입을 모르는 리스트. 읽기만 가능.
- **PECS**: 생산자면 `extends`, 소비자면 `super`.
- 와일드카드는 파라미터에만.

## 연습

`Collections.max(Collection<? extends T> coll)` 의 시그니처에서 왜 `extends` 인지 설명해 보세요.
$md$, 3000),

    (book, 'type-erasure', '타입 소거의 함정',
$md$## 학습 목표

- 컴파일된 바이트코드에 타입 인자가 **남지 않는다**는 사실과 그 결과를 설명할 수 있다.
- 소거 때문에 생기는 대표적인 제약 4가지를 회피할 수 있다.

## 소거(erasure)란

Java 제네릭은 **컴파일 타임 전용**입니다. 컴파일이 끝나면 타입 인자는 지워집니다.

```java
// 우리가 쓴 코드
List<String> list = new ArrayList<>();
String s = list.get(0);

// 컴파일 후 (대략)
List list = new ArrayList();
String s = (String) list.get(0);   // 컴파일러가 캐스팅을 넣어준다
```

즉 런타임에는 `List<String>` 도 `List<Integer>` 도 그냥 `List` 입니다. 이 설계는 제네릭 이전 코드와의 호환을 위한 것이었고, 그 대가로 아래 제약들이 생겼습니다.

## 제약 1 — 런타임에 타입을 비교할 수 없다

```java
if (list instanceof List<String>) { }   // 컴파일 에러
List<String>.class                      // 존재하지 않음
```

`List<String>.class` 와 `List<Integer>.class` 가 같은 객체이므로 애초에 구분이 불가능합니다.

## 제약 2 — 제네릭 배열을 만들 수 없다

```java
T[] arr = new T[10];                // 컴파일 에러
List<String>[] arr = new List<String>[10];  // 컴파일 에러
```

배열은 런타임에 자기 원소 타입을 알고 검사하는데, `T` 는 런타임에 존재하지 않아 검사할 수 없기 때문입니다. 우회하려면 `Object[]` 로 만들고 캐스팅하거나(경고 발생), 그냥 `List<T>` 를 쓰세요.

## 제약 3 — 오버로딩이 충돌한다

```java
void print(List<String> list) { }
void print(List<Integer> list) { }   // 컴파일 에러: 소거 후 시그니처가 같다
```

## 제약 4 — 힙 오염(heap pollution)

```java
static void unsafe(List<String>... lists) {   // 경고: varargs + 제네릭
    Object[] arr = lists;
    arr[0] = List.of(42);          // 컴파일러가 막지 못한다
    String s = lists[0].get(0);    // ClassCastException
}
```

가변인자는 내부적으로 배열이라 제약 2와 충돌합니다. 정말 안전하다고 확신할 때만 `@SafeVarargs` 를 붙이세요.

## 우회: 타입 토큰

런타임에 타입이 정말 필요하다면 `Class<T>` 를 명시적으로 넘깁니다.

```java
public static <T> T fromJson(String json, Class<T> type) {
    // type 으로 런타임에 무엇을 만들지 알 수 있다
}

User user = fromJson(body, User.class);
```

Jackson·Gson 같은 라이브러리가 이 방식을 쓰는 이유입니다.

## 요약

- 런타임에 타입 인자는 **없다**. `List<String>` == `List<Integer>` == `List`.
- 그 결과: `instanceof` 불가, 제네릭 배열 불가, 소거 후 시그니처 충돌, 힙 오염.
- 런타임 타입이 필요하면 `Class<T>` 토큰을 넘긴다.

## 연습

`new ArrayList<String>().getClass() == new ArrayList<Integer>().getClass()` 는 `true` 일까요, `false` 일까요? 이유와 함께 답해 보세요.
$md$, 4000);

    raise notice 'LogiWiki seed_books: [Java 제네릭] 생성 완료 (draft).';
  end if;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 2) JavaScript — 비동기
  -- ══════════════════════════════════════════════════════════════════════════
  if not exists (select 1 from public.books where slug = 'javascript-async' and language = 'ko') then
    insert into public.books (slug, language, title, description, topic, author_id, source, status)
    values (
      'javascript-async', 'ko',
      'JavaScript 비동기 완전정복',
      '이벤트 루프가 실제로 무엇을 하는지부터 시작해 콜백·프로미스·async/await 를 하나의 그림으로 잇습니다. 왜 setTimeout(0) 이 Promise 보다 늦게 실행되는지 설명할 수 있게 됩니다.',
      'javascript', author, 'human', 'draft'
    )
    returning id into book;

    insert into public.chapters (book_id, slug, title, body, sort_order) values
    (book, 'event-loop', '이벤트 루프는 무엇을 하는가',
$md$## 학습 목표

- 콜 스택 / 태스크 큐 / 마이크로태스크 큐의 역할을 구분할 수 있다.
- 임의의 비동기 코드의 **출력 순서를 예측**할 수 있다.

## 자바스크립트는 싱글 스레드다

JS 엔진은 한 번에 하나의 코드만 실행합니다. 그런데도 네트워크 요청이 화면을 멈추지 않는 이유는, **기다리는 일을 엔진이 하지 않기 때문**입니다. 타이머·네트워크·파일 IO는 런타임(브라우저·Node)이 담당하고, 끝나면 콜백을 큐에 넣어줍니다.

이벤트 루프는 아주 단순한 규칙 하나로 동작합니다.

> **콜 스택이 비면**, 큐에서 하나를 꺼내 실행한다.

## 큐는 하나가 아니다

여기서 대부분의 혼란이 생깁니다. 큐는 최소 두 종류입니다.

| 큐 | 무엇이 들어가나 | 우선순위 |
| --- | --- | --- |
| **마이크로태스크 큐** | `Promise` 콜백, `queueMicrotask`, `MutationObserver` | 높음 |
| **매크로태스크(태스크) 큐** | `setTimeout`, `setInterval`, I/O, UI 이벤트 | 낮음 |

규칙은 이렇습니다.

1. 콜 스택이 빈다.
2. **마이크로태스크 큐를 전부 비운다.** (실행 중 새로 추가된 것까지)
3. 매크로태스크를 **딱 하나** 꺼내 실행한다.
4. 2번으로 돌아간다.

## 예제: 출력 순서 맞히기

```js
console.log("1");

setTimeout(() => console.log("2"), 0);

Promise.resolve().then(() => console.log("3"));

console.log("4");
```

출력은 `1 → 4 → 3 → 2` 입니다.

- `1`, `4` 는 동기 코드라 먼저.
- `3` 은 마이크로태스크 → 스택이 비자마자 실행.
- `2` 는 매크로태스크 → 마이크로태스크를 다 비운 **뒤에** 실행.

`setTimeout(fn, 0)` 은 "지금 당장"이 아니라 **"다음 매크로태스크 차례에"** 라는 뜻입니다.

## 흔한 함정: 마이크로태스크로 이벤트 루프 굶기기

마이크로태스크 큐는 **완전히 빌 때까지** 비웁니다. 그래서 이런 코드는 브라우저를 멈춥니다.

```js
function loop() {
  Promise.resolve().then(loop);   // 자기 자신을 계속 마이크로태스크로 추가
}
loop();   // 매크로태스크(렌더링 포함)가 영원히 차례를 못 얻는다
```

무거운 반복 작업을 쪼갤 때는 `setTimeout` 이나 `requestIdleCallback` 처럼 **매크로태스크**를 쓰세요.

## 요약

- JS 는 싱글 스레드. 기다리는 일은 런타임이 대신한다.
- 마이크로태스크(Promise)가 매크로태스크(setTimeout)보다 **항상 먼저**.
- 마이크로태스크 큐는 통째로 비우고, 매크로태스크는 하나씩 꺼낸다.

## 연습

아래 출력 순서를 예측해 보세요.

```js
setTimeout(() => console.log("A"), 0);
Promise.resolve().then(() => {
  console.log("B");
  Promise.resolve().then(() => console.log("C"));
});
console.log("D");
```
$md$, 1000),

    (book, 'promises', '콜백에서 프로미스로',
$md$## 학습 목표

- 콜백 지옥의 진짜 문제(중첩이 아니라 **에러 처리와 합성**)를 설명할 수 있다.
- 프로미스의 3가지 상태와 체이닝 규칙을 정확히 이해한다.

## 콜백의 진짜 문제

콜백 지옥이라고 하면 보통 들여쓰기를 떠올리지만, 실제로 아픈 건 **에러 처리**입니다.

```js
getUser(id, (err, user) => {
  if (err) return handle(err);
  getOrders(user, (err, orders) => {
    if (err) return handle(err);         // 매 단계마다 반복
    getItems(orders[0], (err, items) => {
      if (err) return handle(err);       // 하나라도 빠뜨리면 조용히 삼켜진다
      console.log(items);
    });
  });
});
```

에러 처리가 각 단계에 흩어지고, `try/catch` 로 감쌀 수도 없습니다(콜백은 다른 시점에 다른 스택에서 실행되니까요).

## 프로미스: 미래의 값을 객체로

프로미스는 **아직 없는 값을 지금 다룰 수 있는 객체**입니다. 상태는 셋 중 하나입니다.

- `pending` — 아직 결정되지 않음
- `fulfilled` — 값과 함께 성공
- `rejected` — 이유와 함께 실패

한번 `fulfilled`/`rejected` 가 되면 **다시 바뀌지 않습니다.**

```js
getUser(id)
  .then(user => getOrders(user))
  .then(orders => getItems(orders[0]))
  .then(items => console.log(items))
  .catch(handle);          // 어느 단계에서 터지든 여기로 온다
```

에러 처리가 **한 곳으로 모입니다.** 이게 프로미스의 핵심 가치입니다.

## 체이닝 규칙 — `then` 은 항상 새 프로미스를 반환한다

이 규칙 하나만 알면 체이닝이 전부 설명됩니다.

```js
Promise.resolve(1)
  .then(v => v + 1)              // 값을 반환 → 그 값으로 fulfilled 된 프로미스
  .then(v => Promise.resolve(v)) // 프로미스를 반환 → 그게 풀릴 때까지 기다림
  .then(v => { throw new Error("boom"); })  // 던짐 → rejected 프로미스
  .then(v => console.log("실행 안 됨"))
  .catch(e => console.log(e.message));      // "boom"
```

- 값을 반환 → 다음 `then` 에 그 값이 전달된다.
- **프로미스를 반환 → 자동으로 기다린다(unwrap).**
- 던지면 → 가장 가까운 `catch` 로 점프.

## 흔한 함정: return 을 빠뜨리기

```js
getUser(id)
  .then(user => {
    getOrders(user);              // return 이 없다!
  })
  .then(orders => console.log(orders));   // undefined — 기다리지 않았다
```

콜백에서 프로미스를 **반환하지 않으면** 체인이 그것을 기다리지 않습니다. 화살표 함수의 중괄호를 쓸 때 특히 자주 발생합니다.

## 요약

- 콜백의 문제는 중첩이 아니라 **분산된 에러 처리**다.
- 프로미스는 상태가 한 번만 바뀌는 미래 값이다.
- `then` 은 새 프로미스를 반환한다. 값이면 전달, 프로미스면 기다림, 던지면 `catch`.
- 콜백 안에서 프로미스는 **반드시 return**.

## 연습

`.then(v => v + 1)` 과 `.then(v => { v + 1; })` 의 결과가 어떻게 다른지 설명해 보세요.
$md$, 2000),

    (book, 'async-await', 'async / await',
$md$## 학습 목표

- `async` 함수가 실제로 무엇을 반환하는지 안다.
- `await` 를 동기 코드처럼 읽되, 실제로는 무엇이 일어나는지 설명할 수 있다.

## async 함수는 항상 프로미스를 반환한다

```js
async function f() {
  return 1;
}

f();                    // Promise { 1 }  ← 1 이 아니다
f().then(v => console.log(v));   // 1
```

`return 1` 을 써도 호출자는 프로미스를 받습니다. 그래서 `async` 함수 안에서 던진 예외는 **rejected 프로미스**가 됩니다.

## await 는 "여기서 멈추고 나중에 재개"

```js
async function load(id) {
  const user = await getUser(id);        // 여기서 함수가 일시정지
  const orders = await getOrders(user);  // 위가 끝나야 실행
  return orders;
}
```

읽기는 동기 코드처럼 읽히지만, 실제로는 `await` 지점에서 **함수가 통째로 중단되고 제어권을 이벤트 루프에 돌려줍니다.** 프로미스가 풀리면 마이크로태스크로 나머지가 재개됩니다. 스레드를 막지 않는다는 뜻입니다.

## try/catch 가 돌아온다

프로미스 체인의 `.catch` 대신 익숙한 문법을 씁니다.

```js
async function load(id) {
  try {
    const user = await getUser(id);
    return await getOrders(user);
  } catch (e) {
    console.error("불러오기 실패:", e);
    return [];
  } finally {
    hideSpinner();
  }
}
```

## 흔한 함정 1 — 불필요한 직렬 실행

```js
// 나쁨: 순차적으로 기다린다 (200ms + 200ms = 400ms)
const a = await fetchA();
const b = await fetchB();

// 좋음: 동시에 시작한다 (200ms)
const [a, b] = await Promise.all([fetchA(), fetchB()]);
```

`b` 가 `a` 에 의존하지 않는다면 직렬로 기다릴 이유가 없습니다. **`await` 를 줄 세우기 전에 의존 관계를 확인**하세요.

## 흔한 함정 2 — 반복문 안의 await

```js
// 100개를 순차 처리 — 매우 느리다
for (const id of ids) {
  await process(id);
}

// 동시에 — 단, 100개가 한꺼번에 나간다는 뜻이기도 하다
await Promise.all(ids.map(id => process(id)));
```

둘 다 정답이 아닙니다. **순차가 의도라면 첫 번째가 맞고**(예: API 레이트리밋), 아니라면 두 번째를 쓰되 동시 실행 개수를 제한하는 것이 안전합니다.

## 흔한 함정 3 — forEach 안의 async

```js
ids.forEach(async (id) => {
  await process(id);
});
console.log("완료");   // 거짓말! 아무것도 안 끝났다
```

`forEach` 는 콜백의 반환값(프로미스)을 무시합니다. `for...of` 나 `Promise.all(map(...))` 을 쓰세요.

## 요약

- `async` 함수는 **항상** 프로미스를 반환한다.
- `await` 는 함수를 일시정지할 뿐, 스레드를 막지 않는다.
- 의존하지 않는 작업은 `Promise.all` 로 동시에.
- `forEach` + `async` 는 기다리지 않는다.

## 연습

`await Promise.all([...])` 은 하나라도 실패하면 즉시 rejected 됩니다. **일부가 실패해도 나머지 결과를 받고 싶다면** 어떤 메서드를 써야 할까요?
$md$, 3000);

    raise notice 'LogiWiki seed_books: [JavaScript 비동기] 생성 완료 (draft).';
  end if;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 3) Database — 인덱스와 실행계획
  -- ══════════════════════════════════════════════════════════════════════════
  if not exists (select 1 from public.books where slug = 'sql-index-basics' and language = 'ko') then
    insert into public.books (slug, language, title, description, topic, author_id, source, status)
    values (
      'sql-index-basics', 'ko',
      'SQL 인덱스와 실행계획 읽기',
      '인덱스를 걸었는데 왜 안 타는가? B-트리의 동작 원리에서 출발해 복합 인덱스의 컬럼 순서, EXPLAIN 읽는 법, 인덱스를 무력화하는 흔한 쿼리 패턴을 다룹니다.',
      'database', author, 'human', 'draft'
    )
    returning id into book;

    insert into public.chapters (book_id, slug, title, body, sort_order) values
    (book, 'how-index-works', '인덱스는 어떻게 빠른가',
$md$## 학습 목표

- 인덱스가 없을 때와 있을 때의 탐색 비용 차이를 설명할 수 있다.
- 인덱스가 **공짜가 아니라는 것**(쓰기 비용·용량)을 이해한다.

## 인덱스가 없으면: 전체 탐색

```sql
select * from users where email = 'a@b.com';
```

인덱스가 없다면 DB는 테이블의 **모든 행을 처음부터 끝까지** 읽으며 비교합니다(Full Table Scan). 100만 행이면 100만 번 비교합니다. 시간 복잡도로는 O(n) 입니다.

## B-트리: 책의 색인과 같다

대부분의 관계형 DB에서 인덱스는 **B-트리**(정확히는 B+트리)입니다. 정렬된 값들을 트리로 유지하므로, 찾는 값이 어느 가지에 있는지 절반씩 좁혀갈 수 있습니다.

```
                [ m ]
              /       \
        [ d, h ]      [ q, u ]
        /   |   \      /   |   \
    ...   ...   ...  ...  ...  ...
```

100만 행이라도 트리의 깊이는 3~4 수준이라, **디스크 접근 3~4번**이면 원하는 행의 위치를 찾습니다. O(log n) 입니다.

이것이 인덱스가 "빠른" 이유의 전부입니다. 마법이 아니라 **정렬된 자료구조**입니다.

## 인덱스가 잘 듣는 연산 / 못 듣는 연산

정렬돼 있다는 성질에서 무엇이 가능한지가 결정됩니다.

| 연산 | 인덱스 사용 | 이유 |
| --- | --- | --- |
| `= 'x'` | ✅ | 한 지점을 찾으면 된다 |
| `> 10`, `between` | ✅ | 정렬돼 있으니 범위가 연속이다 |
| `like 'abc%'` | ✅ | 앞부분이 고정 → 범위 검색 |
| `like '%abc'` | ❌ | 뒤에서 매칭 — 정렬이 도움이 안 된다 |
| `order by`, `group by` | ✅ | 이미 정렬돼 있어 정렬 단계를 건너뛴다 |

## 인덱스는 공짜가 아니다

인덱스를 거는 대가는 셋입니다.

1. **쓰기가 느려진다.** `insert`/`update`/`delete` 마다 트리도 갱신해야 합니다. 인덱스 5개면 쓰기 비용이 5배 붙습니다.
2. **용량을 먹는다.** 인덱스는 별도의 자료구조입니다.
3. **선택도가 낮으면 무용지물.** 값이 `Y`/`N` 뿐인 컬럼에 인덱스를 걸면, 어차피 절반을 읽어야 하므로 옵티마이저가 그냥 풀 스캔을 택합니다.

> **원칙**: 인덱스는 "일단 다 걸어두는 것"이 아니라, **실제로 느린 쿼리를 보고 거는 것**입니다.

## 요약

- 인덱스 = 정렬된 B-트리. O(n) 탐색을 O(log n) 으로 바꾼다.
- 정렬에서 이득을 보는 연산(`=`, 범위, 접두 `like`, `order by`)만 인덱스를 탄다.
- 쓰기 비용·용량이라는 대가가 있다. 선택도 낮은 컬럼은 효과가 없다.

## 연습

성별(`M`/`F`)만 저장하는 컬럼에 인덱스를 거는 것이 대개 무의미한 이유를 "선택도" 라는 말로 설명해 보세요.
$md$, 1000),

    (book, 'composite-index', '복합 인덱스와 컬럼 순서',
$md$## 학습 목표

- 복합 인덱스에서 **컬럼 순서가 왜 결정적인지** 설명할 수 있다.
- 어떤 쿼리가 인덱스를 "일부만" 타는지 판단할 수 있다.

## 왼쪽 접두사 규칙 (Leftmost Prefix)

```sql
create index idx_user on users (last_name, first_name, age);
```

이 인덱스는 **`(last_name, first_name, age)` 순서로 정렬된 전화번호부**라고 생각하면 정확합니다. 성으로 먼저 정렬하고, 같은 성 안에서 이름으로, 같은 이름 안에서 나이로.

전화번호부에서 "성이 김"인 사람은 쉽게 찾습니다. "성이 김이고 이름이 철수"도 쉽습니다. 하지만 **"이름이 철수인 사람 전부"** 는? 성을 모르면 처음부터 끝까지 다 뒤져야 합니다.

| 쿼리 조건 | 인덱스 사용 |
| --- | --- |
| `last_name = '김'` | ✅ (첫 컬럼) |
| `last_name = '김' and first_name = '철수'` | ✅ (앞 두 컬럼) |
| `last_name = '김' and age = 30` | ⚠️ `last_name` 까지만 |
| `first_name = '철수'` | ❌ 사용 못 함 |
| `age = 30` | ❌ 사용 못 함 |

**규칙: 인덱스는 왼쪽부터 연속으로만 쓸 수 있다.** 중간을 건너뛸 수 없습니다.

## 범위 조건은 거기서 멈춘다

이것이 두 번째로 중요한 규칙입니다.

```sql
-- 인덱스: (status, created_at)
select * from orders
 where status = 'paid'          -- 등호 → 다음 컬럼도 사용 가능
   and created_at > '2026-01-01';  -- 범위 → 여기까지
```

이건 잘 동작합니다. 하지만 순서를 바꾸면:

```sql
-- 인덱스: (created_at, status)  ← 순서가 나쁨
 where created_at > '2026-01-01'   -- 범위 조건이 먼저 나오면
   and status = 'paid';            -- status 는 인덱스로 못 거른다
```

범위 조건을 만나는 순간 **그 뒤의 컬럼은 정렬이 흩어져** 더 이상 인덱스로 좁힐 수 없습니다.

> **설계 규칙**: 등호(`=`) 조건 컬럼을 **앞에**, 범위(`>`, `<`, `between`) 조건 컬럼을 **뒤에** 둔다.

## 커버링 인덱스

쿼리가 필요로 하는 **모든 컬럼이 인덱스에 들어 있으면**, DB는 테이블을 아예 읽지 않아도 됩니다.

```sql
create index idx_cover on orders (user_id, status, total);

select status, total from orders where user_id = 7;
-- 인덱스만 읽고 끝. 테이블 접근 0회.
```

실행계획에서 `Index Only Scan`(Postgres) / `Using index`(MySQL) 로 표시됩니다. 읽기가 많은 쿼리에서 효과가 큽니다.

## 요약

- 복합 인덱스는 **왼쪽부터 연속으로만** 쓸 수 있다. 중간을 건너뛸 수 없다.
- **등호 조건 먼저, 범위 조건 나중.** 범위를 만나면 뒤 컬럼은 못 쓴다.
- 필요한 컬럼이 전부 인덱스에 있으면 테이블을 안 읽는다(커버링 인덱스).

## 연습

`where a = 1 and b > 5 and c = 3` 을 가장 잘 지원하는 복합 인덱스의 컬럼 순서는 무엇일까요?
$md$, 2000),

    (book, 'explain-and-pitfalls', 'EXPLAIN 읽기와 인덱스를 죽이는 패턴',
$md$## 학습 목표

- `EXPLAIN` 출력에서 무엇을 먼저 봐야 하는지 안다.
- 인덱스가 있는데도 안 타는 대표적인 쿼리 패턴을 고칠 수 있다.

## EXPLAIN 은 무엇을 알려주나

```sql
explain analyze
select * from orders where user_id = 7;
```

```
Index Scan using idx_orders_user on orders  (cost=0.29..8.31 rows=1 width=64)
                                            (actual time=0.021..0.023 rows=1 loops=1)
  Index Cond: (user_id = 7)
Planning Time: 0.087 ms
Execution Time: 0.041 ms
```

초보자가 볼 것은 딱 세 가지입니다.

1. **스캔 방식** — `Index Scan` 인가 `Seq Scan`(풀 스캔)인가?
2. **rows 추정치 vs actual rows** — 크게 어긋나면 통계가 낡은 것(`ANALYZE` 필요).
3. **가장 비싼 노드** — 실행계획은 트리이고, 안쪽(들여쓰기 깊은 곳)부터 실행됩니다.

`EXPLAIN` 은 계획만 보여주고, `EXPLAIN ANALYZE` 는 **실제로 실행**해서 진짜 시간을 보여줍니다. 느린 쿼리를 잡을 때는 `ANALYZE` 를 쓰세요. (단, `UPDATE`/`DELETE` 에 붙이면 정말 실행되니 트랜잭션으로 감싸고 롤백하세요.)

## 인덱스를 죽이는 패턴 4가지

### 1. 컬럼에 함수/연산을 씌우기

```sql
-- 나쁨: created_at 인덱스를 못 쓴다
where date(created_at) = '2026-07-14'
where price * 1.1 > 1000

-- 좋음: 컬럼을 그대로 두고 범위로 바꾼다
where created_at >= '2026-07-14' and created_at < '2026-07-15'
where price > 1000 / 1.1
```

인덱스는 **컬럼의 원본 값**으로 정렬돼 있습니다. 컬럼을 가공하는 순간 그 정렬은 쓸모없어집니다. **가공은 항상 반대쪽(상수 쪽)으로 옮기세요.**

### 2. 앞이 열린 LIKE

```sql
where email like '%@gmail.com'   -- 인덱스 사용 불가
```

접두사가 고정되지 않으면 범위 검색이 불가능합니다. 이런 검색이 잦다면 전문 검색 인덱스(Postgres `pg_trgm`, GIN)를 고려하세요.

### 3. 암묵적 타입 변환

```sql
-- user_id 가 bigint 인데 문자열로 비교
where user_id = '7'      -- DB에 따라 컬럼 쪽이 캐스팅되며 인덱스가 죽는다
```

타입을 맞춰 넘기세요. ORM 을 쓸 때 조용히 발생하는 흔한 원인입니다.

### 4. 선택도가 낮은 조건

```sql
where is_deleted = false   -- 전체의 99% 가 false 라면
```

옵티마이저가 "어차피 대부분을 읽는다"고 판단해 인덱스를 무시합니다. 이건 **버그가 아니라 올바른 판단**입니다. 이럴 땐 부분 인덱스(`create index ... where is_deleted = true`)를 고려하세요.

## 요약

- `EXPLAIN ANALYZE` 로 스캔 방식, 추정 vs 실제 행 수, 가장 비싼 노드를 본다.
- 인덱스를 죽이는 4대 패턴: **컬럼 가공 / 앞이 열린 LIKE / 타입 불일치 / 낮은 선택도**.
- 가공은 항상 상수 쪽으로 옮긴다.

## 연습

`where substring(phone, 1, 3) = '010'` 을 인덱스를 탈 수 있는 형태로 바꿔 보세요.
$md$, 3000);

    raise notice 'LogiWiki seed_books: [SQL 인덱스] 생성 완료 (draft).';
  end if;
end $$;

alter table public.books enable trigger books_rate_limit;

-- ============================================================================
-- 퀴즈 시드 — 객관식(mcq) 위주.
-- mcq 는 서버에서 정답 문자열을 정확 비교하므로 **AI API 없이 즉시 채점**된다.
-- (서술형/코드형은 Claude API 가 필요하므로 지금은 넣지 않는다.)
-- ============================================================================
do $$
begin
  if exists (select 1 from public.quizzes where topic = 'java' and prompt like '%와일드카드%') then
    raise notice 'LogiWiki seed_books: 퀴즈 이미 존재.';
    return;
  end if;

  insert into public.quizzes (type, topic, difficulty, language, prompt, choices, answer, explanation, source, status) values
  -- ── Java ──
  ('mcq', 'java', 'easy', 'ko',
   'Java 제네릭이 타입 안전성을 보장하는 시점은 언제인가요?',
   '[{"key":"a","text":"컴파일 타임"},{"key":"b","text":"클래스 로딩 시점"},{"key":"c","text":"런타임"},{"key":"d","text":"GC 수행 시점"}]'::jsonb,
   'a',
   '제네릭은 컴파일 타임 전용 장치입니다. 컴파일이 끝나면 타입 인자는 소거(erasure)되어 런타임에는 남지 않습니다.',
   'human', 'published'),

  ('mcq', 'java', 'medium', 'ko',
   'PECS 원칙에 따를 때, 컬렉션에서 값을 읽기만 하는 파라미터에 써야 할 와일드카드는?',
   '[{"key":"a","text":"? super T"},{"key":"b","text":"? extends T"},{"key":"c","text":"?"},{"key":"d","text":"T"}]'::jsonb,
   'b',
   'Producer Extends, Consumer Super. 값을 생산(읽기)하는 쪽은 ? extends T 를 써야 꺼낸 값이 T 임이 보장됩니다. 대신 넣을 수는 없습니다.',
   'human', 'published'),

  ('mcq', 'java', 'medium', 'ko',
   '다음 중 타입 소거(erasure) 때문에 컴파일 에러가 나는 것은?',
   '[{"key":"a","text":"List<String> list = new ArrayList<>();"},{"key":"b","text":"T[] arr = new T[10];"},{"key":"c","text":"static <T> void f(T t) {}"},{"key":"d","text":"class Box<T extends Comparable<T>> {}"}]'::jsonb,
   'b',
   '배열은 런타임에 자기 원소 타입을 알아야 하는데 T 는 소거되어 런타임에 존재하지 않습니다. 그래서 제네릭 배열은 생성할 수 없습니다.',
   'human', 'published'),

  -- ── JavaScript ──
  ('mcq', 'javascript', 'medium', 'ko',
   '다음 코드의 출력 순서로 옳은 것은?

console.log("1");
setTimeout(() => console.log("2"), 0);
Promise.resolve().then(() => console.log("3"));
console.log("4");',
   '[{"key":"a","text":"1 2 3 4"},{"key":"b","text":"1 4 2 3"},{"key":"c","text":"1 4 3 2"},{"key":"d","text":"1 3 4 2"}]'::jsonb,
   'c',
   '동기 코드(1, 4)가 먼저 실행되고, 콜 스택이 비면 마이크로태스크 큐(Promise → 3)를 전부 비운 뒤에 매크로태스크(setTimeout → 2)를 하나 꺼냅니다.',
   'human', 'published'),

  ('mcq', 'javascript', 'easy', 'ko',
   'async 함수가 return 1; 을 실행했을 때 호출자가 받는 값은?',
   '[{"key":"a","text":"숫자 1"},{"key":"b","text":"1 로 resolve 된 Promise"},{"key":"c","text":"undefined"},{"key":"d","text":"에러가 발생한다"}]'::jsonb,
   'b',
   'async 함수는 무엇을 반환하든 항상 Promise 로 감싸 반환합니다. 값을 쓰려면 await 하거나 .then() 을 붙여야 합니다.',
   'human', 'published'),

  ('mcq', 'javascript', 'medium', 'ko',
   '서로 의존하지 않는 두 비동기 작업 fetchA() 와 fetchB() 를 가장 빠르게 처리하는 방법은?',
   '[{"key":"a","text":"const a = await fetchA(); const b = await fetchB();"},{"key":"b","text":"const [a, b] = await Promise.all([fetchA(), fetchB()]);"},{"key":"c","text":"[fetchA, fetchB].forEach(async f => await f());"},{"key":"d","text":"setTimeout 으로 각각 감싼다"}]'::jsonb,
   'b',
   'await 를 줄 세우면 순차 실행되어 시간이 합산됩니다. 의존 관계가 없다면 Promise.all 로 동시에 시작해야 합니다. forEach 는 콜백의 프로미스를 무시하므로 기다리지 않습니다.',
   'human', 'published'),

  -- ── Database ──
  ('mcq', 'database', 'easy', 'ko',
   '(last_name, first_name, age) 순서의 복합 인덱스가 있을 때, 인덱스를 전혀 사용할 수 없는 조건은?',
   '[{"key":"a","text":"where last_name = ''김''"},{"key":"b","text":"where last_name = ''김'' and first_name = ''철수''"},{"key":"c","text":"where first_name = ''철수''"},{"key":"d","text":"where last_name = ''김'' and age = 30"}]'::jsonb,
   'c',
   '복합 인덱스는 왼쪽부터 연속으로만 사용할 수 있습니다(leftmost prefix). 첫 컬럼인 last_name 을 건너뛰면 인덱스를 탈 수 없습니다.',
   'human', 'published'),

  ('mcq', 'database', 'medium', 'ko',
   '다음 중 created_at 인덱스를 사용하지 못하게 만드는 쿼리는?',
   '[{"key":"a","text":"where created_at >= ''2026-07-14''"},{"key":"b","text":"where date(created_at) = ''2026-07-14''"},{"key":"c","text":"where created_at between ''2026-01-01'' and ''2026-12-31''"},{"key":"d","text":"order by created_at desc"}]'::jsonb,
   'b',
   '인덱스는 컬럼의 원본 값으로 정렬돼 있습니다. 컬럼에 함수를 씌우면 그 정렬을 쓸 수 없습니다. 가공은 항상 상수 쪽으로 옮겨 범위 조건으로 바꾸세요.',
   'human', 'published'),

  ('mcq', 'database', 'medium', 'ko',
   'where a = 1 and b > 5 and c = 3 을 가장 잘 지원하는 복합 인덱스 순서는?',
   '[{"key":"a","text":"(b, a, c)"},{"key":"b","text":"(a, b, c)"},{"key":"c","text":"(a, c, b)"},{"key":"d","text":"(c, b, a)"}]'::jsonb,
   'c',
   '등호 조건(a, c)을 앞에, 범위 조건(b)을 뒤에 둡니다. 범위 조건을 만나면 그 뒤 컬럼은 정렬이 흩어져 인덱스로 좁힐 수 없기 때문입니다.',
   'human', 'published');

  raise notice 'LogiWiki seed_books: 퀴즈 9개 생성 완료 (published).';
end $$;
