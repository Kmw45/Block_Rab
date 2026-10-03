# 블록 미궁 (가제)

블록을 밀어 길을 열고 출구에 도달하는 모바일 논리 퍼즐. Vite + TypeScript + Canvas로 만든 웹 게임이다.

- 플레이: https://block-labyrinth.pages.dev
- 개발자 모드(모든 스테이지 열림, 광고 없음, 저장 분리): https://block-labyrinth.pages.dev/?dev
- GDD: https://claude.ai/code/artifact/38c0884a-fdfc-4671-bb4b-43b88e8d4c1f

## 명령

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm test` | 규칙·별·뽑기 테스트 |
| `npm run build` | 타입 검사 후 `dist`에 빌드 |
| `npm run levels -- 150` | 레벨 30개 재생성(월드당 150초). `src/data/levels.json`을 덮어쓴다 |
| `npm run e2e` | Edge로 처음부터 끝까지 자동 플레이. 개발 서버가 5183 포트에 떠 있어야 한다 |
| `node tools/gen-sprites.mjs` | Codex CLI로 그림 생성. `art/source`에 없는 것만 만든다 |
| `node tools/build-sprites.mjs` | `art/source` 원본을 게임용 크기로 줄여 `public/assets/sprites`에 넣는다 |

개발 서버에서는 `?go=select`, `?go=cosmetics&gold=500`, `?go=play:3-2`, `?go=tut:0`으로 화면에 바로 갈 수 있다. 배포본에서는 `?dev`를 함께 붙인다.

## 구조

- `src/core/` 규칙과 솔버. 화면과 분리된 순수 코드이고 플레이·힌트·레벨 생성이 함께 쓴다.
- `src/data/` 레벨(`levels.json`, 생성물), 튜토리얼, 아이템, 월드 색.
- `src/game/` 저장·골드·뽑기(`store.ts`), 소리 합성(`audio.ts`), 광고 자리(`ads.ts`), 문구(`i18n.ts`).
- `src/render/` 캔버스 그리기. `sprites.ts`가 `manifest.json`의 그림을 불러오고, 그림이 없으면 코드로 그린 도형으로 대신한다.
- `src/ui/app.ts` 모든 화면.
- `tools/` 레벨 생성, 그림 생성·변환, 점검 스크립트.
- `art/source/` GPT로 생성한 그림 원본. 다시 뽑으면 한도를 쓰고 같은 그림이 나오지 않으므로 보관한다.

## 지금 상태 (GDD와 다른 점 포함)

GDD 문서는 초기 기획 그대로이고 아래 변경은 반영되지 않았다.

- 엔진은 웹(GDD는 Unity 추천안).
- 월드 5개가 던전 컨셉을 갖고 바닥 기믹이 다르다: 1 무너진 유적(구덩이), 2 버려진 광산(일방통행), 3 얼음 동굴(빙판), 4 마법 서고(마법진), 5 미궁의 심장(전부). GDD는 "제약은 블록에만 둔다"였다.
- 튜토리얼 4단계와 새 규칙 카드가 있다. GDD는 "설명 글은 넣지 않는다"였다.
- 뽑기는 30종(스킨 22, 자국 8), 1회 40골드, 최대 10연속. GDD는 24종, 50골드.
- 블록은 출구와 마법진 칸에 들어갈 수 없다. 구덩이에 빠진 블록은 바닥이 된다.
- 레벨은 전부 생성기가 만들고 솔버가 걸러 낸 것이다. 사람이 해 보고 재미를 확인한 적은 없다.

## 아직 안 된 것

- 광고는 2초짜리 자리 표시 화면이다. AdMob, 광고 동의 화면, Android 앱 포장은 하지 않았다.
- 실기기에서 돌려 보지 않았다.
- 글꼴은 Google Fonts를 인터넷에서 불러온다. 오프라인 앱에서는 파일로 넣어야 한다.
- 개인정보처리방침(`public/privacy.html`)은 초안이고 운영자 정보가 비어 있다.
- 제목과 로고는 가제이고 로고는 글꼴로 그린다.
- 타이틀 그림 속 캐릭터는 팔다리를 넣기 전 모습이다.
- 이동 자국 8종과 색종이는 코드로 그린다.
- `?dev` 개발자 모드는 출시 빌드에서 빼야 한다.

## 배포

Cloudflare Pages 프로젝트 `block-labyrinth`. 게임을 수정하면 테스트와 빌드가 통과한 뒤 바로 다시 배포한다(사용자 지시).

```
npm run build
# 반드시 프로젝트 폴더 밖에서 실행한다
npx wrangler pages deploy <dist 절대경로> --project-name block-labyrinth --branch main --commit-dirty=true
node tools/diagnose.mjs https://block-labyrinth.pages.dev/
```

프로젝트 폴더 안에서 wrangler를 실행하면 자동 설정이 `package.json`에 패키지를 추가한다.

## 그림 만들기

Codex CLI(`codex login` 필요)의 이미지 생성을 쓴다. `tools/gen-sprites.mjs`의 목록에 항목을 추가하고 실행한 뒤 `build-sprites.mjs`를 돌린다. 그림을 다시 뽑으려면 `art/source`에서 그 파일을 지우거나 옮긴다.

- 바닥과 벽은 회색으로 한 장씩 만들고 월드 색을 곱해 쓴다.
- 버튼·패널 같은 UI는 글자 없는 빈 판으로 만들어 CSS `border-image`로 늘려 쓴다(`styles.css`의 `.has-ui`).
- 빛 효과(`fx_spark`, `fx_ring`, `fx_burst`)는 검은 배경으로 생성하고 변환 때 밝기를 투명도로 바꾼다.
- 이미지 생성은 한글을 정확히 그리지 못한다. 글자가 들어가는 그림은 만들지 않는다.

## 주의

- Windows PowerShell 5.1은 BOM 없는 `.ps1`을 ANSI로 읽는다. 한글이 든 수정 스크립트를 `.ps1`로 돌리면 글자가 깨져 들어간다. 한글이 든 일괄 수정은 Node 스크립트로 한다.
- 레벨을 재생성하면 `levels.json`이 통째로 바뀌어 기존 플레이 기록의 별이 다른 레벨의 것이 된다.
- 아이템 수나 뽑기 가격을 바꾸면 `tools/sim-gacha.ts`로 수급을 다시 확인한다.
