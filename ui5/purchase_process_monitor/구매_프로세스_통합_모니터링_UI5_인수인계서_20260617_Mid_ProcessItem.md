# 구매 프로세스 통합 모니터링 UI5 인수인계서

작성일: 2026.06.17  
대상 프로젝트: `ui5/purchase_process_monitor`  
기준 설계서: `구매 프로세스 통합 모니터링 Fiori 조회 프로그램 설계서_V1.2.1.md`  
현재 개발 초점: Flexible Column Layout Mid Column, PO 조달 흐름 상세

## 1. 현재 결론

현재 Begin Column의 조회/필터/KPI/조달 문서 목록 기능은 대부분 구현되어 있고, Mid Column은 PO 문서 선택 후 상세 화면을 여는 구조까지 구현되어 있다.

최근 작업에서는 설계서 기준에 맞춰 Mid Column의 조달 문서 흐름을 `sap.suite.ui.commons.ProcessFlow`로 표시하도록 변경했고, 그 아래에 `ProcessItemSet` 기반 `sap.m.Table` 품목별 진행 상태 영역을 1차 구현했다.

중요한 결정 사항은 다음과 같다.

| 항목 | 결정 |
| --- | --- |
| 조달 문서 흐름 표시 | 카드 UI가 아니라 `sap.suite.ui.commons.ProcessFlow` 사용 |
| ProcessFlow 클릭 | 사용하지 않음 |
| 단계 선택 방식 | ProcessFlow 아래 `SegmentedButton`으로 PR/RFQ/MQ/PO/GR/IV 선택 |
| 단계 버튼 현재 동작 | 선택 단계 값을 `view>/selectedProcessStage`에 저장 |
| 다음 단계 | 선택 단계에 따라 `ProcessItemSet` 테이블 필터링 |

## 2. 현재 완료된 주요 기능

| 영역 | 상태 | 설명 |
| --- | --- | --- |
| 프로젝트 기본 설정 | 완료 | `manifest.json`, `Component.js`, `sap.f.FlexibleColumnLayout` 기반 |
| 공통 모델 | 완료 | `filter`, `view`, `dashboard`, `weekly`, `delay`, `rfq`, `detail` JSONModel 사용 |
| Begin Column 조회 조건 | 완료 | 기준일, 조회기간, 지연 상태, 문서유형, 상세조건 |
| 조회기간 필터 | 완료 | `LookbackMonths`를 Backend로 전송 |
| 자재명/공급업체명 부분일치 | 완료 | `Maktx`, `Name1` 필터를 Backend로 전송 |
| PR/RFQ/PO 번호 필터 | 완료 | 문서번호 입력 시 `DocType`, `DocNo` 정책으로 조회 |
| 문서유형 필터 | 완료 | 전체/PR/RFQ/PO 선택 가능 |
| KPI 요약 | 완료 | PR 처리 지연, RFQ 미접수, MQ 채택 지연, PO 납기 지연, 입고 후 미송장, 정상 |
| KPI 필터 해제 | 완료 | 아이콘 버튼으로 기본 지연 상태 필터 복원 |
| 조달 문서 목록 | 완료 | `DelayListSet` 기반 목록 표시 |
| 조달 문서 목록 정렬/그룹 | 완료 | ViewSettingsDialog 기반 정렬/그룹 |
| 조달 문서 목록 새로고침 | 완료 | 현재 조회조건 기준 재조회 |
| Row 선택 분기 | 완료 | PR/RFQ는 안내, PO는 Mid Column 오픈 |
| Mid 확장/닫기 | 완료 | 우측 상단 확장/닫기 버튼 동작 |
| ProcessFlowSet 조회 | 완료 | PO 선택 시 Backend 조회 |
| ProcessFlow 표시 | 완료 | `sap.suite.ui.commons.ProcessFlow`로 PR -> RFQ -> MQ -> PO -> GR -> IV 표시 |
| ProcessItemSet 조회 | 완료 | PO 선택 시 Backend 조회 |
| 품목별 진행 상태 테이블 | 1차 완료 | `ProcessItemSet` 결과를 `sap.m.Table`로 표시 |

## 3. 최근 변경 파일

| 파일 | 변경 내용 |
| --- | --- |
| `webapp/view/Main.view.xml` | Mid Column에 `sap.suite.ui.commons.ProcessFlow`, 단계 선택 `SegmentedButton`, `ProcessItemSet` 기반 `sap.m.Table` 추가 |
| `webapp/controller/Main.controller.js` | PO 선택 시 `_readProcessFlow`, `_readProcessItems` 병렬 조회. 단계 선택 이벤트 `onProcessStageSelect` 유지 |
| `webapp/model/models.js` | `selectedProcessStage`, `processItems`, `processItemCount` 등 Mid 상세 상태 관리 |
| `webapp/model/formatter.js` | `formatQuantityWithUnit` 추가 |
| `webapp/test/unit/model/formatter.js` | `formatQuantityWithUnit` 단위 테스트 추가 |
| `webapp/test/unit/controller/Main.controller.js` | Mid Column/ProcessFlow 관련 테스트 보강 |
| `webapp/test/unit/model/models.js` | 모델 초기값 테스트 보강 |
| `manifest.json` | `sap.suite.ui.commons` 사용 가능하도록 의존성 반영 |

## 4. Mid Column 현재 구조

### 4.1 화면 구성

Mid Column은 현재 다음 순서로 구성되어 있다.

1. `PO 조달 흐름 상세` DynamicPage Title
2. 우측 상단 확장/닫기 버튼
3. `조달 문서 흐름` 패널
4. `sap.suite.ui.commons.ProcessFlow`
5. `선택 단계` SegmentedButton
6. `품목별 진행 상태` 패널
7. `ProcessItemSet` 기반 `sap.m.Table`
8. Footer 버튼 영역

### 4.2 ProcessFlow 정책

`sap.suite.ui.commons.ProcessFlow`는 현재 시각화 전용이다.

이유는 다음과 같다.

| 이유 | 설명 |
| --- | --- |
| UI5 ProcessFlow 클릭 제어 한계 | 상태나 focus 처리에 따라 특정 노드만 클릭 가능해지는 현상이 있었다 |
| 사용성 | 사용자가 명확하게 PR/RFQ/MQ/PO/GR/IV 버튼을 눌러 선택하는 방식이 더 직관적이다 |
| 구현 안정성 | ProcessFlow는 흐름 시각화에 집중시키고, 실제 단계 선택은 `SegmentedButton`에서 처리한다 |

따라서 `ProcessFlow`의 `nodePress` 이벤트는 사용하지 않는다.

### 4.3 단계 선택 버튼

현재 버튼은 다음 키를 가진다.

```text
PR, RFQ, MQ, PO, GR, IV
```

현재 동작은 다음과 같다.

```text
사용자가 버튼 선택
-> onProcessStageSelect 실행
-> view>/selectedProcessStage 저장
```

아직 테이블 필터링까지는 연결하지 않았다. 다음 단계에서 구현해야 한다.

## 5. ProcessItemSet 테이블 현재 표시 필드

현재 `품목별 진행 상태` 테이블은 다음 컬럼을 가진다.

| 컬럼 | 바인딩 | 설명 |
| --- | --- | --- |
| 품목 | `ItemNo` | `formatItemNo`로 앞자리 0 제거 |
| 자재 | `Matnr`, `Maktx` | 코드와 자재명 표시 |
| 공급업체 | `Lifnr`, `Name1` | 코드와 공급업체명 표시 |
| 플랜트 | `Werks`, `PlantName` | 플랜트 코드와 명칭 표시 |
| 현재단계 | `CurrentStage` | 현재 진행 단계 |
| 상태 | `DelayStatusText`, `Criticality` | 상태 텍스트와 색상 |
| 수량 | `Quantity`, `ReceivedQuantity`, `InvoicedQuantity`, `Meins` | 수량과 단위를 함께 표시 |
| 지연일 | `DelayDays`, `Criticality` | 지연일과 색상 |

수량은 `formatQuantityWithUnit`으로 표시한다.

예:

```text
10 EA
5 EA
0 EA
```

## 6. 검증 상태

최근 검증 결과는 다음과 같다.

| 명령 | 결과 | 비고 |
| --- | --- | --- |
| `npm run build` | 성공 | UI5 XML/JS 빌드 성공 |
| `npm run lint` | 성공 | 에러 없음, 기존 warning 4건 존재 |

현재 남아 있는 lint warning은 기존성 경고로 판단된다.

| 파일 | 경고 |
| --- | --- |
| `dist/test/testsuite.qunit-dbg.js` | unused eslint-disable |
| `webapp/controller/Main.controller.js` | `max-params`, `no-nested-ternary` |
| `webapp/test/testsuite.qunit.js` | unused eslint-disable |

## 7. 현재 주의해야 할 점

### 7.1 한글 인코딩

이전 PowerShell 출력에서 일부 기존 문서와 XML 한글이 깨져 보인 이력이 있다.  
실제 파일 저장은 UTF-8 기준으로 했고, 최근 `npm run build`는 성공했다.

다만 XML에 한글 라벨을 직접 넣을 때 깨짐 위험이 있으면 XML 숫자 엔티티를 사용한 구간이 있다.

예:

```xml
<Text text="&#54408;&#47785;" />
```

화면에는 `품목`으로 표시된다.

### 7.2 ProcessFlow 클릭 이벤트

ProcessFlow 노드 클릭을 다시 살리는 방향은 권장하지 않는다.

이전 테스트에서 PR~GR 노드는 비활성/회색처럼 보이고 IV만 클릭되는 문제가 있었다.  
현재 설계는 ProcessFlow를 시각화 전용으로 두고 단계 버튼을 사용하는 방식으로 정리했다.

### 7.3 단계 버튼과 테이블 필터

현재 `SegmentedButton`은 선택값만 저장한다.

다음 개발에서 다음 중 하나를 선택해야 한다.

| 방식 | 설명 | 추천 |
| --- | --- | --- |
| Frontend 필터 | 이미 조회한 `processItems` 배열을 단계별로 필터링 | 추천 |
| Backend 재조회 | 단계 선택마다 OData 재호출 | 비추천 |

추천은 Frontend 필터다. 이미 PO 기준 품목 진행 상태를 모두 받았기 때문에 단계 선택은 화면 필터로 충분하다.

## 8. 다음 개발 순서

다음 작업은 원래 단계표 기준으로 29단계의 후속 작업이다.

| 우선순위 | 작업 | 설명 |
| --- | --- | --- |
| 1 | 단계 버튼별 품목 테이블 필터 | `selectedProcessStage`에 따라 `processItems`를 필터링 |
| 2 | 필터용 원본 배열 분리 | `/processItemsAll` 또는 유사 프로퍼티로 원본 보관 권장 |
| 3 | 선택 단계 표시 개선 | 테이블 Header 또는 Toolbar에 현재 선택 단계 표시 |
| 4 | Mid Column PO 요약 영역 구현 | 선택 PO 기본 정보 표시 |
| 5 | `ProcessDocumentSet` 조회 | PO 관련 PO/GR/IV 문서 목록 조회 |
| 6 | 문서 상세 Dialog Fragment | 관련 문서 클릭 시 상세 Dialog 표시 |
| 7 | `DocumentDetailSet` 조회 | 선택 문서 상세 필드 표시 |
| 8 | 지연 산식 Popover | Working Day 기준 산식 설명 |
| 9 | 납기/미입고 앱 이동 버튼 | 기존 납기 지연 및 미입고 현황 앱으로 이동 |
| 10 | Busy/Error/No Data/반응형 정리 | Mid/Dialog까지 포함해 마무리 |

## 9. 다음 단계 구현 추천안

다음 단계는 `ProcessItemSet` 테이블을 선택 단계별로 필터링하는 것이다.

추천 모델 구조는 다음과 같다.

| 모델 경로 | 역할 |
| --- | --- |
| `detail>/processItemsAll` | Backend에서 받은 원본 전체 품목 |
| `detail>/processItems` | 화면 Table에 표시할 필터 결과 |
| `detail>/processItemCount` | 현재 표시 중인 품목 수 |
| `view>/selectedProcessStage` | 현재 선택 단계 |

추천 흐름은 다음과 같다.

```text
PO 선택
-> ProcessItemSet 조회
-> detail>/processItemsAll 저장
-> 기본 선택 단계는 빈 값 또는 전체
-> detail>/processItems 표시

단계 버튼 클릭
-> view>/selectedProcessStage 저장
-> processItemsAll에서 CurrentStage 또는 단계 관련 필드 기준 필터
-> detail>/processItems 갱신
-> detail>/processItemCount 갱신
```

단, Backend의 `ProcessItemSet`에 단계별 판정 필드가 어떤 이름으로 오는지 먼저 확인해야 한다.  
현재 화면에는 `CurrentStage`를 표시하고 있으므로 1차 기준은 `CurrentStage`가 될 가능성이 높다.

## 10. 수동 테스트 케이스

다음 개발자가 이어받기 전에 현재 상태에서 확인할 수 있는 테스트는 다음과 같다.

| 테스트 | 기대 결과 |
| --- | --- |
| PO 문서 행 클릭 | Mid Column 열림 |
| PR 문서 행 클릭 | PO 상세 대상이 아니라는 안내 표시 |
| RFQ 문서 행 클릭 | PO 상세 대상이 아니라는 안내 표시 |
| Mid 확장 버튼 클릭 | Mid Column 확장 |
| Mid 닫기 버튼 클릭 | OneColumn으로 복귀 |
| ProcessFlow 표시 | PR -> RFQ -> MQ -> PO -> GR -> IV 흐름 표시 |
| 단계 버튼 클릭 | 버튼 선택 상태 변경, 콘솔 오류 없음 |
| 품목별 진행 상태 테이블 | ProcessItemSet 결과 행 표시 |
| 품목 테이블 데이터 없음 | noDataText 표시 |
| 모바일 폭 축소 | 뒤쪽 컬럼이 pop-in 처리 |

## 11. Backend 관련 전제

현재 Frontend는 다음 OData EntitySet을 사용하거나 사용할 예정이다.

| EntitySet | 상태 | 용도 |
| --- | --- | --- |
| `DashboardSummarySet` | 사용 중 | KPI 요약 |
| `WeeklySummarySet` | 사용 중 | 주간 구매/입고/송장 요약 |
| `DelayListSet` | 사용 중 | 조달 문서 목록 |
| `ProcessFlowSet` | 사용 중 | PO 조달 문서 흐름 |
| `ProcessItemSet` | 사용 중 | PO 품목별 진행 상태 |
| `ProcessDocumentSet` | 미구현 | 관련 문서 목록 |
| `DocumentDetailSet` | 미구현 | 문서 상세 Dialog |

## 12. 현재 요약

| 구분 | 상태 |
| --- | --- |
| Begin Column | 거의 완료 |
| 조회조건/필터 | 완료 |
| KPI/주간 요약 | 완료 |
| 조달 문서 목록 | 완료 |
| PO Mid Column 열기 | 완료 |
| ProcessFlowSet 조회 | 완료 |
| `sap.suite.ui.commons.ProcessFlow` 표시 | 완료 |
| ProcessFlow 클릭 사용 | 제외 |
| 단계 선택 버튼 | 1차 완료 |
| ProcessItemSet 조회 | 완료 |
| 품목별 진행 상태 Table | 1차 완료 |
| 다음 개발 | 단계 버튼별 품목 테이블 필터링 |
