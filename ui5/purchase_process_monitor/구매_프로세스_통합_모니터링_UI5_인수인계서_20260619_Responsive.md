# 구매 프로세스 통합 모니터링 UI5 인수인계서

작성일: 2026.06.19  
대상 프로젝트: `ui5/purchase_process_monitor`  
기준 설계서: `구매 프로세스 통합 모니터링 Fiori 조회 프로그램 설계서_V1.2.1.md`  
현재 완료 단계: 38단계 `반응형 스타일 정리`  
다음 권장 단계: 39단계 `전체 수동 통합 테스트`

## 1. 현재 결론

Begin Column의 조회조건, KPI, 주간 요약, 조달 문서 목록과 Mid Column의 PO 상세 기능까지 구현되어 있다.

현재 PO 행을 선택하면 다음 EntitySet을 병렬 조회한다.

1. `ProcessFlowSet`: PR -> RFQ -> MQ -> PO -> GR -> IV 흐름
2. `ProcessItemSet`: PO 품목별 진행 상태
3. `ProcessDocumentSet`: PO와 연결된 관련 문서
4. `DocumentDetailSet`: 선택한 관련 문서의 상세 필드

33단계 지연 산식 Popover, 35단계 Busy, 36단계 오류 메시지, 37단계 No Data, 38단계 반응형 정리까지 완료했다.

34단계 납기/미입고 앱 이동은 대상 앱의 Semantic Object, Action, 전달 파라미터가 확정되지 않아 보류 상태다.

## 2. 단계별 개발 현황

| 단계 | 개발 항목 | 상태 | 비고 |
| --- | --- | --- | --- |
| 1~5 | 프로젝트 설정, 모델, Formatter, Begin/Mid 골격 | 완료 | FCL 기반 화면 |
| 6~7 | 기본/상세 조회조건 UI | 완료 | 기준일, 기간, 상태, 문서유형, 상세조건 |
| 8~18 | 조회 필터 기능 | 완료 | PR/RFQ/PO, 자재, 공급업체, 플랜트, 명칭 검색 |
| 19~20 | RFQ/MQ 별도 현황 | 제외 | 조달 문서 목록으로 통합 |
| 21~24 | 문서 행 선택 분기 | 완료 | PR/RFQ 안내, PO Mid 오픈 |
| 25 | `ProcessFlowSet` 조회 | 완료 | PO 기준 |
| 26 | `ProcessItemSet` 조회 | 완료 | 품목번호 정렬 |
| 27 | Mid PO 요약 | 완료 | DelayList 선택 행 재사용 |
| 28 | ProcessFlow 표시 | 완료 | 시각화 전용 |
| 29 | 품목별 진행 상태 Table | 완료 | 단계 선택 필터 포함 |
| 30~32 | 관련 문서 Dialog 및 상세 조회 | 완료 | `ProcessDocumentSet`, `DocumentDetailSet` |
| 33 | 지연 산식 ResponsivePopover | 완료 | 화면에서 지연일 재계산하지 않음 |
| 34 | 납기/미입고 앱 이동 | 보류 | Intent 계약 확인 필요 |
| 35 | Busy 처리 고도화 | 완료 | Begin/Mid/Dialog 분리, 중복 요청 방지 |
| 36 | 오류 메시지 고도화 | 완료 | Gateway 업무 메시지 우선, 기술 문구 차단 |
| 37 | No Data 처리 | 완료 | Begin/Mid/Dialog 상태별 안내 |
| 38 | 반응형 스타일 정리 | 완료 | 모바일 필터, Table pop-in, Flow 스크롤 |
| 39 | 전체 수동 통합 테스트 | 미완료 | 다음 작업 |
| 40 | `npm run build` | 완료 | 2026.06.19 성공 |
| 41 | `npm run lint` | 완료 | 오류 0건, 기존 경고 4건 |

## 3. 이번 인수인계서에 반영된 추가 개발

### 3.1 33단계 지연 산식 Popover

파일: `webapp/fragment/DelayFormulaPopover.fragment.xml`

- `sap.m.ResponsivePopover` 사용
- 선택 PO, 지연상태, 조회 기준일, 산정 기준일, 지연 근무일 표시
- 단순 Calendar Day 차이가 아니라 근무일과 상태별 처리 허용기간을 반영한다는 안내 표시
- Frontend에서 공휴일 또는 지연일을 다시 계산하지 않음

### 3.2 35단계 Busy 처리

- Begin: `view>/busy`
- Mid: `view>/midBusy`
- Dialog: `view>/dialogBusy`
- `busyIndicatorDelay="0"`으로 즉시 표시
- `_pBeginLoad`, `_pMidLoad`를 사용해 연속 클릭 시 같은 OData 요청이 중복 실행되지 않게 처리
- 성공과 오류 모두 `finally`에서 Busy 해제

### 3.3 36단계 오류 메시지

공통 함수: `_getODataErrorMessage`

처리 원칙:

1. Gateway JSON의 `error.message.value` 업무 메시지 우선
2. 연결 실패, 권한, 400, 404, 500 오류를 사용자용 문구로 변환
3. `HTTP request failed`, `Internal Server Error`, Backend, Frontend 같은 기술 문구를 화면에 표시하지 않음
4. 오류 Dialog 제목은 `조회 오류`로 통일

### 3.4 37단계 No Data 처리

| 영역 | 0건 안내 |
| --- | --- |
| 조달 문서 목록 | 조건을 변경한 후 다시 조회하도록 안내 |
| ProcessFlow | 정보성 MessageStrip 표시 |
| 품목 전체 | 선택 PO의 품목 진행 정보가 없다고 표시 |
| 단계 필터 | 선택한 단계에 해당하는 품목이 없다고 표시 |
| 문서 상세 미선택 | 관련 문서를 선택하도록 안내 |
| 문서 상세 0건 | 선택한 문서의 상세 정보가 없다고 표시 |

### 3.5 38단계 반응형 정리

- 기본 및 상세 조회조건 12개에 `ppmFilterField` 클래스 적용
- 600px 이하에서 조회조건을 한 열, 폭 100%로 배치
- 모바일에서 주간 요약 패널의 데스크톱 최소 높이 제거
- ProcessFlow `scrollable="true"` 적용
- 조달 문서 목록에서 기준문서 열을 항상 남는 대표 열로 설정
- 품목 Table은 품목번호를 대표 열로 두고 자재 열은 Tablet 이하에서 pop-in
- 관련 문서 Table은 문서번호를 대표 열로 두고 단계 열은 pop-in
- Mid와 Dialog Table의 폭을 `100%`로 설정
- 별도 디자인 CSS를 추가하지 않고 UI5 표준 Table pop-in과 FlexBox 줄바꿈을 우선 사용

## 4. 주요 파일

| 파일 | 역할 |
| --- | --- |
| `webapp/view/Main.view.xml` | Begin/Mid 전체 화면, 반응형 Table, ProcessFlow |
| `webapp/controller/Main.controller.js` | 필터, 조회, FCL, Busy, 오류, Dialog 이벤트 |
| `webapp/fragment/DelayFormulaPopover.fragment.xml` | 지연 산식 안내 |
| `webapp/fragment/DocumentDetailDialog.fragment.xml` | 관련 문서 및 문서 상세 |
| `webapp/model/models.js` | JSONModel 초기 구조 |
| `webapp/model/formatter.js` | 상태, 수량, 요약, No Data 문구 |
| `webapp/css/style.css` | 요약 영역과 모바일 조회조건 보조 스타일 |
| `webapp/test/unit/controller/Main.controller.js` | Controller 단위 테스트 |
| `webapp/test/unit/model/formatter.js` | Formatter와 No Data 문구 테스트 |
| `webapp/test/unit/model/models.js` | 모델 초기값 테스트 |
| `webapp/test/unit/view/Main.view.js` | 반응형 XML/CSS 구조 테스트 |

## 5. 현재 OData EntitySet 사용 현황

| EntitySet | 상태 | 용도 |
| --- | --- | --- |
| `DashboardSummarySet` | 사용 | KPI 요약 |
| `WeeklySummarySet` | 사용 | 주간 구매/입고/송장 요약 |
| `DelayListSet` | 사용 | 조달 문서 목록 |
| `ProcessFlowSet` | 사용 | PO 조달 흐름 |
| `ProcessItemSet` | 사용 | 품목별 진행 상태 |
| `ProcessDocumentSet` | 사용 | 관련 문서 목록 |
| `DocumentDetailSet` | 사용 | 선택 문서 상세 필드 |
| `RfqQuotationStatusSet` | 제외/보류 | 별도 RFQ/MQ Table 제거 |

## 6. 반드시 확인할 보류 사항

### 6.1 지연일 Backend 검증

테스트 화면에서 다음 사례가 확인되었다.

```text
조회 기준일: 2026.06.18
산정 기준일: 2026.06.06
지연 근무일: 4일
```

화면은 Backend의 `BaseDate`, `DelayDays`를 그대로 표시한다. 두 날짜의 단순 차이가 12일이라고 해서 화면 값이 반드시 잘못된 것은 아니다. 주말, 공휴일, 상태별 처리 허용기간을 제외할 수 있기 때문이다.

다만 4일이 업무 규칙과 정확히 일치하는지는 Backend의 다음 항목으로 검증해야 한다.

1. 상태별 허용기간 시작일과 종료일
2. 사용한 Factory Calendar 또는 근무일 달력
3. 토요일, 일요일, 공휴일 제외 결과
4. 조회 기준일 포함 여부
5. 산정 기준일 포함 여부

Frontend에서 임의로 날짜 차이를 다시 계산하지 않는다.

### 6.2 납기/미입고 앱 이동

34단계 구현 전에 다음 계약을 확정해야 한다.

| 항목 | 확인 필요 내용 |
| --- | --- |
| Semantic Object | 이동 대상 앱의 Object |
| Action | display 또는 별도 Action |
| `PoNo` | 파라미터 명과 형식 |
| `KeyDate` | 날짜 전달 형식 |
| `Werks` | 필수 여부 |
| 권한 | 대상 앱 실행 권한 |

계약 확정 후 `sap.ushell.Container.getServiceAsync("CrossApplicationNavigation")` 방식으로 연결하는 것이 권장된다.

## 7. 다음 작업: 39단계 전체 수동 통합 테스트

### 7.1 조회 테스트

1. 최초 조회 3개월/6개월
2. PR/RFQ/PO 번호 단건 조회
3. 자재코드/자재명 조회
4. 공급업체코드/공급업체명 조회
5. 플랜트 조회
6. 지연상태 단건/다건 조회
7. 문서유형 PR/RFQ/PO 조회
8. KPI 카드 단건 필터 및 필터 해제
9. 정렬/그룹/초기화/새로고침

### 7.2 Mid 및 Dialog 테스트

1. PR/RFQ 선택 시 Mid 미호출 확인
2. PO 선택 시 Flow/Item/Document 병렬 조회
3. 단계 버튼별 품목 필터
4. 지연 산식 Popover 열기/닫기
5. 관련 문서 Dialog 열기
6. PO/GR/IV 문서별 상세 필드 조회
7. 0건, 오류, 연속 클릭 시 Busy와 메시지 확인

### 7.3 반응형 테스트 권장 폭

| 화면 | 권장 폭 | 확인사항 |
| --- | --- | --- |
| 넓은 데스크톱 | 1440px 이상 | KPI/주간 요약 좌우 배치 |
| 노트북 | 1024px | Begin 목록과 Toolbar 겹침 없음 |
| 태블릿 | 768px | Table pop-in과 FCL Mid 표시 |
| 모바일 | 390px | 조회조건 한 열, 버튼 overflow |
| 작은 모바일 | 360px | 가로 스크롤과 텍스트 겹침 없음 |

모바일에서는 조회조건 필드가 한 열로 표시되어야 하며, 조달 문서 목록과 품목 Table은 대표 열을 유지하고 나머지 정보가 행 아래 pop-in으로 표시되어야 한다.

## 8. 검증 결과

2026.06.19 기준 실행 명령:

```powershell
npm run build
npm run lint
git diff --check
```

| 검증 | 결과 |
| --- | --- |
| UI5 build | 성공 |
| ESLint error | 0건 |
| ESLint warning | 기존 4건 |
| whitespace error | 없음 |

현재 남은 경고:

| 위치 | 내용 |
| --- | --- |
| `dist/test/testsuite.qunit-dbg.js` | unused eslint-disable |
| `Main.controller.js` | `max-params` |
| `Main.controller.js` | `no-nested-ternary` |
| `webapp/test/testsuite.qunit.js` | unused eslint-disable |

UI5 build의 i18n fallback locale `en` 경고도 남아 있으나 빌드는 성공한다.

## 9. 다음 개발 순서

| 순서 | 단계 | 작업 |
| --- | --- | --- |
| 1 | 39 | 전체 수동 통합 테스트 및 발견 오류 수정 |
| 2 | 보류 검증 | 지연 근무일 Backend 산식 확인 |
| 3 | 34 | 대상 앱 Intent 계약 확정 후 앱 이동 구현 |
| 4 | 40~41 | 최종 build/lint 재검증 |

## 10. 최종 요약

| 구분 | 상태 |
| --- | --- |
| Begin 조회/필터/KPI | 완료 |
| 조달 문서 목록 및 정렬/그룹 | 완료 |
| PO Mid Column | 완료 |
| ProcessFlow/품목 Table | 완료 |
| 관련 문서 및 상세 Dialog | 완료 |
| 지연 산식 Popover | 완료, Backend 산식 검증 필요 |
| Busy/Error/No Data | 완료 |
| 반응형 구조 | 완료, 실제 기기 수동 확인 필요 |
| 앱 이동 | 보류 |
| 다음 단계 | 39단계 전체 수동 통합 테스트 |
