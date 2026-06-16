## 화면 설계 V1.2.1

# 구매 프로세스 통합 모니터링 Fiori 조회 프로그램 설계서 V1.2.1

## 1. 문서 정보

| 항목 | 내용 |
| --- | --- |
| 문서명 | 구매 프로세스 통합 모니터링 Fiori 조회 프로그램 설계서 |
| 버전 | V1.2.1 |
| 작성일 | 2026.06.16 |
| 기준 문서 | V1.2 설계서 |
| 작성 목적 | Backend 구현 완료 후 UI5 개발 기준 확정 |
| 대상 기업 | 삼만리 모빌리티 |
| 대상 모듈 | MM 중심, GR/IV 단계에서 FI 연계 |
| 개발 방식 | SAPUI5 Freestyle + SAP Gateway OData V2 |
| Backend 개발 상태 | SAP Gateway OData V2 구현 완료 |
| Frontend 개발 상태 | UI5 개발 착수 전 |
| 기준 UI5 버전 | SAPUI5 1.120.x |
| 기준 화면 구조 | `sap.f.FlexibleColumnLayout` Begin/Mid 2컬럼 |

### 1.1 V1.2.1 작성 목적

V1.2.1은 V1.2 설계서를 새로 갈아엎는 문서가 아니다. V1.2의 업무 설계와 화면 방향은 유지하되, SAP GUI에서 Backend OData 개발을 완료한 뒤 확정된 실제 연동 계약과 UI5 화면 결정을 반영한다.

따라서 UI5 개발 시에는 다음 우선순위를 따른다.

```text
1. V1.2.1의 Backend 확정 계약
2. V1.2의 업무 설계 원칙
3. 실제 OData metadata
4. UI5 구현 중 발견되는 Gateway 응답
```

### 1.2 V1.2 대비 주요 보정사항

| 구분 | V1.2 | V1.2.1 확정 |
| --- | --- | --- |
| OData Service | `ZGWD3MM_PROC_MON_SRV` 계열로 설계 | `ZGWD3MM0002_SRV` 사용 |
| Backend Class | 설계 단계 | `ZCL_ZGWD3MM0002_DPC_EXT` |
| EntitySet | 설계 기준 8개 | 8개 주요 EntitySet 구현 및 URI 200 테스트 완료 |
| 조회조건 | 기본/상세 조건 설계 | PR번호는 기본 조회조건으로 유지 |
| RFQ 현황 | 기준일 조건 가능성 포함 | `RfqQuotationStatusSet`에는 `KeyDate` 필터 없음 |
| Process Flow | Header 기준 전체 흐름 | 현재 PO 기준 흐름 중심 |
| RFQ Row 클릭 | Mid 상세 가능성 | PO Flow 호출 금지, RFQ/MQ 현황 표시 |
| PR KPI | 구현 범위 포함 | 현재 Backend는 0 반환, 후속 확장 표시 |
| Mid Table | 품목별 지연 현황 + 관련 문서 목록 | 기본 화면에는 품목별 진행 상태 Table 1개 표시 |
| 관련 문서 목록 | Mid에 표시 | 문서 상세 Dialog 내부에서 표시 |
| 기존 앱 이동 | 납기/미입고 앱 이동 포함 | PO 선택 시 액션 버튼 유지 |
| `DocYear` | 검토 필요 | GR/IV 문서 Key에 포함 |
| Criticality | Backend 반환값 정의 | UI5 formatter에서 컨트롤별 상태값으로 변환 |

---

## 2. 프로그램 개요

| 항목 | 내용 |
| --- | --- |
| 프로그램명 | 구매 프로세스 통합 모니터링 Fiori 조회 프로그램 |
| 화면명 | 조달 프로세스 통합 모니터링 |
| 앱 성격 | 구매/조달 프로세스 병목 모니터링 앱 |
| 적용 프로세스 | PR → RFQ/RQ → MQ → PO → GR → IV |
| 주요 사용자 | 구매 담당자, 조달 관리자, MM 담당자 |
| 핵심 목적 | 구매 프로세스의 현재 병목과 지연 Item을 조기에 식별 |
| 조회 성격 | 조회 전용 |
| 화면 구조 | Flexible Column Layout Begin/Mid 2컬럼 |
| 기존 앱 연계 | 납기 지연 및 미입고 현황 조회 Fiori 프로그램으로 이동 |

### 2.1 V1.2.1의 개발 기준

V1.2.1의 핵심은 다음과 같다.

```text
Begin Column = 전체 조달 병목 모니터링
Mid Column   = 선택한 PO의 조달 흐름과 품목별 진행 상태 확인
Dialog       = 관련 문서 목록 및 문서 상세 확인
```

RFQ 관련 행은 현재 Backend 구현 범위상 PO Flow를 호출하지 않는다. RFQ 행 선택 시에는 RFQ/MQ 현황 영역에서 해당 RFQ 상태를 확인하는 방식으로 처리한다.

---

## 3. 실제 Backend 연동 정보

### 3.1 OData Service

| 항목 | 값 |
| --- | --- |
| OData Service | `ZGWD3MM0002_SRV` |
| Base URI | `/sap/opu/odata/sap/ZGWD3MM0002_SRV/` |
| Backend Class | `ZCL_ZGWD3MM0002_DPC_EXT` |
| 구현 방식 | DPC_EXT 메소드 재정의 |
| 현재 상태 | 주요 EntitySet 구현 및 URI 200 테스트 완료 |

UI5 `manifest.json`의 `mainService`는 다음 URI를 사용한다.

```json
"/sap/opu/odata/sap/ZGWD3MM0002_SRV/"
```

### 3.2 구현 완료 EntitySet

| EntitySet | 역할 | UI 사용 위치 |
| --- | --- | --- |
| `DashboardSummarySet` | 상단 KPI 카드용 집계 | Begin KPI |
| `WeeklySummarySet` | 금주 구매/입고/송장 요약 | Begin 주간 요약 |
| `DelayListSet` | 지연/미완료 문서 Header 목록 | Begin 지연 대상 목록 |
| `RfqQuotationStatusSet` | RFQ별 견적 접수/채택 현황 | Begin RFQ/MQ 현황 |
| `ProcessFlowSet` | PR → RFQ → MQ → PO → GR → IV 흐름 | Mid PO 흐름 카드 |
| `ProcessItemSet` | 선택 문서의 품목별 진행 상태 | Mid 품목별 진행 상태 Table |
| `ProcessDocumentSet` | 관련 PO/GR/IV 문서 목록 | 문서 상세 Dialog |
| `DocumentDetailSet` | PO/GR/IV 상세 필드 목록 | 문서 상세 Dialog |

### 3.3 Backend Helper 및 필터

Backend의 `GET_COMMON_FILTERS`는 다음 필터를 처리한다.

| Filter Property | 의미 | UI 위치 |
| --- | --- | --- |
| `KeyDate` | 조회 기준일 | 기본 조회조건 |
| `LookbackMonths` | 조회 개월 수 | 기본 조회조건 |
| `PrNo` | 구매요청 번호 | 기본 조회조건 |
| `PoNo` | 구매오더 번호 | 기본 조회조건 |
| `Matnr` | 자재코드 | 상세 조회조건 |
| `Lifnr` | 공급업체코드 | 상세 조회조건 |
| `Werks` | 플랜트 | 상세 조회조건 |
| `DelayStatus` | 지연상태 | KPI 클릭 또는 목록 필터 |

기본값:

| 항목 | 기본값 |
| --- | --- |
| `KeyDate` | `SY-DATUM` |
| `LookbackMonths` | `3` |

주의:

```text
RfqQuotationStatusSet에는 metadata상 KeyDate Property가 없다.
따라서 UI5에서 RfqQuotationStatusSet 호출 시 KeyDate 필터를 전달하지 않는다.
```

---

## 4. 조회조건 설계

### 4.1 기본 조회조건

기본 조회조건은 화면 상단에 항상 표시한다.

| 항목 | UI Control | 필수 | 기본값 | OData Filter |
| --- | --- | --- | --- | --- |
| 기준일 | `sap.m.DatePicker` | 필수 | 현재일 | `KeyDate` |
| 조회기간 | `sap.m.RadioButtonGroup` 또는 `sap.m.SegmentedButton` | 필수 | 최근 3개월 | `LookbackMonths` |
| PR번호 | `sap.m.Input` + Value Help | 선택 | 공백 | `PrNo` |
| PO번호 | `sap.m.Input` + Value Help | 선택 | 공백 | `PoNo` |

PR번호는 V1.2의 기본 조회조건이므로 V1.2.1에서도 유지한다. Mockup에서 PR번호가 누락된 화면은 참고용이며, 실제 UI5 구현 기준이 아니다.

### 4.2 조회기간 선택값

초기 UI에서는 다음 두 가지를 우선 제공한다.

| 표시값 | 전달값 |
| --- | --- |
| 최근 3개월 | `3` |
| 최근 6개월 | `6` |

V1.2에 있던 12개월은 필요 시 후순위로 추가한다. 개발 마감과 성능을 고려해 초기 화면에는 3개월/6개월만 노출한다.

### 4.3 상세 조회조건

상세 조회조건은 접기/펼치기 영역으로 제공한다.

| 항목 | UI Control | OData Filter | 처리 |
| --- | --- | --- | --- |
| 자재코드 | `sap.m.Input` + Value Help | `Matnr` | Item 조건 |
| 공급업체코드 | `sap.m.Input` + Value Help | `Lifnr` | Header/Item 조건 |
| 플랜트 | `sap.m.Input` + Value Help | `Werks` | Item 조건 |

V1.2에 있던 자재명, 공급업체명, 플랜트명은 초기 UI에서는 표시 보조값 또는 후순위 조건으로 둔다. Backend 공통 필터에 명시된 조건을 우선 구현한다.

### 4.4 지연상태 필터

`DelayStatus`는 사용자가 직접 Select로 고르는 방식보다 KPI 카드 클릭으로 적용하는 방식을 기본으로 한다.

| KPI | 전달 DelayStatus |
| --- | --- |
| RFQ 미접수 | `RFQ_NO_QUOTATION` |
| MQ 채택 지연 | `MQ_SELECTION_DELAY` |
| PO 납기 지연 | `PO_DELIVERY_DELAY` |
| 입고 후 미송장 | `IV_INCOMPLETE` |

PR 처리 지연은 현재 Backend에서 0으로 반환하므로 클릭 시 안내 메시지를 표시한다.

```text
PR 처리 지연은 후속 확장 예정입니다.
```

---

## 5. 화면 구조

### 5.1 전체 구조

V1.2.1의 화면은 `sap.f.FlexibleColumnLayout` 기반 Begin/Mid 2컬럼으로 구성한다.

```text
[Begin Column]
- 조회조건
- KPI 카드
- 금주 구매/입고/송장 요약
- RFQ/MQ 현황
- 지연 대상 목록

        ↓ PO 행 클릭

[Mid Column]
- 선택 PO 요약
- PR/RFQ/MQ/PO/GR/IV 흐름 카드
- 품목별 진행 상태 Table
- 액션 버튼

        ↓ 문서 상세 보기

[Dialog]
- 관련 문서 목록
- 선택 문서 상세 필드
```

### 5.2 FCL Layout

| 상황 | Layout |
| --- | --- |
| 최초 진입 | `OneColumn` |
| PO Header 선택 | `TwoColumnsMidExpanded` |
| Mid 전체화면 | `MidColumnFullScreen` |
| Mid 닫기 | `OneColumn` |
| RFQ Header 선택 | `OneColumn` 유지 또는 RFQ 현황 강조 |

RFQ 행 선택 시에는 PO 기준 `ProcessFlowSet`, `ProcessItemSet`, `ProcessDocumentSet`을 호출하지 않는다.

### 5.3 Begin Column

Begin Column의 표시 순서는 다음과 같다.

```text
1. 조회조건
2. KPI 카드
3. 주간 구매/입고/송장 요약
4. RFQ/MQ 현황
5. 지연 대상 목록
```

KPI 카드:

| 순서 | KPI | Backend Property | UI 정책 |
| --- | --- | --- | --- |
| 1 | RFQ 미접수 | `RfqNoqHdrCnt`, `RfqNoqItmCnt` | 클릭 시 `RFQ_NO_QUOTATION` 필터 |
| 2 | MQ 채택 지연 | `MqSelDlyHdrCnt`, `MqSelDlyItmCnt` | 클릭 시 `MQ_SELECTION_DELAY` 필터 |
| 3 | PO 납기 지연 | `PoDlvDlyHdrCnt`, `PoDlvDlyItmCnt` | 클릭 시 `PO_DELIVERY_DELAY` 필터 |
| 4 | 입고 후 미송장 | `IvIncHdrCnt`, `IvIncItmCnt` | 클릭 시 `IV_INCOMPLETE` 필터 |
| 5 | PR 처리 지연 | `PrDlyHdrCnt`, `PrDlyItmCnt` | 표시하되 후속 확장 안내 |
| 6 | 금주 입고 완료 | `WeeklySummarySet.CompGrHdrCnt` | 보조 KPI로 표시 가능 |

V1.2는 KPI 5개를 기준으로 했으나, Backend가 `WeeklySummarySet`을 구현했으므로 금주 입고 완료는 보조 KPI 또는 주간 요약 영역에서 표현한다.

### 5.4 Mid Column

Mid Column은 PO 행 선택 시에만 상세 조회 영역으로 사용한다.

```text
1. 선택 PO 요약
2. 조달 흐름 카드
3. 품목별 진행 상태 Table
4. 하단 액션 버튼
```

Mid Column에는 기본적으로 `sap.m.Table`을 1개만 둔다.

| 화면 요소 | EntitySet | 표시 방식 |
| --- | --- | --- |
| 조달 흐름 카드 | `ProcessFlowSet` | `HBox`/`FlexBox` 기반 카드형 |
| 품목별 진행 상태 | `ProcessItemSet` | `sap.m.Table` |
| 관련 문서 목록 | `ProcessDocumentSet` | Dialog 내부 |
| 문서 상세 필드 | `DocumentDetailSet` | Dialog 내부 |

V1.2에서 "관련 문서 목록"은 Mid 구성 요소로 정의되어 있었지만, V1.2.1에서는 화면 복잡도를 줄이기 위해 상시 Table로 노출하지 않는다. 사용자가 `문서 상세 보기` 버튼을 누르면 Dialog에서 관련 문서 목록을 표시한다.

### 5.5 문서 상세 Dialog

문서 상세 Dialog는 2단 구조로 구성한다.

```text
[상단]
- ProcessDocumentSet 기반 관련 문서 목록

[하단 또는 우측]
- 선택한 관련 문서의 DocumentDetailSet FieldName / FieldValue 목록
```

Dialog 처리 순서:

```text
1. 문서 상세 보기 버튼 클릭
2. ProcessDocumentSet 조회
3. 관련 문서 목록 표시
4. 관련 문서 Row 선택
5. DocumentDetailSet 조회
6. FieldName / FieldValue 표시
```

---

## 6. 사용자 이벤트 흐름

### 6.1 최초 진입

호출 대상:

```text
DashboardSummarySet
WeeklySummarySet
DelayListSet
RfqQuotationStatusSet
```

주의:

```text
RfqQuotationStatusSet 호출에는 KeyDate 필터를 넣지 않는다.
```

### 6.2 조회 버튼 클릭

조회 버튼 클릭 시 다음 EntitySet을 재조회한다.

| EntitySet | 필터 |
| --- | --- |
| `DashboardSummarySet` | `KeyDate`, `LookbackMonths`, `PrNo`, `PoNo`, `Matnr`, `Lifnr`, `Werks` |
| `WeeklySummarySet` | `KeyDate`, `LookbackMonths`, `PrNo`, `PoNo`, `Matnr`, `Lifnr`, `Werks` |
| `DelayListSet` | `KeyDate`, `LookbackMonths`, `PrNo`, `PoNo`, `Matnr`, `Lifnr`, `Werks`, `DelayStatus` |
| `RfqQuotationStatusSet` | `RfqNo`만 선택적으로 사용 |

### 6.3 KPI 카드 클릭

KPI 카드를 클릭하면 `DelayListSet`만 `DelayStatus`를 적용해 재조회한다. KPI와 주간 요약은 현재 검색 범위의 전체 상태를 보여주기 위해 지연상태 필터를 적용하지 않는다.

### 6.4 DelayList Row 선택

선택 Row의 `DocType`에 따라 분기한다.

| DocType | 처리 |
| --- | --- |
| `PO` | Mid Column 열기, `ProcessFlowSet`, `ProcessItemSet` 조회 |
| `RFQ` | Mid PO Flow 호출 금지, RFQ/MQ 현황에서 해당 RFQ 강조 |
| 기타 | 안내 메시지 표시 |

PO 선택 시 호출:

```text
ProcessFlowSet?$filter=ContextDocType eq 'PO' and ContextDocNo eq '<DocNo>'
ProcessItemSet?$filter=ContextDocType eq 'PO' and ContextDocNo eq '<DocNo>'
```

문서 상세 Dialog를 열 때 호출:

```text
ProcessDocumentSet?$filter=ContextDocType eq 'PO' and ContextDocNo eq '<DocNo>'
```

관련 문서 선택 시 호출:

```text
DocumentDetailSet?$filter=Stage eq '<Stage>' and DocNo eq '<DocNo>' and DocYear eq '<DocYear>' and ItemNo eq '<ItemNo>'
```

---

## 7. OData EntitySet 계약

### 7.1 DashboardSummarySet

목적: KPI 카드 집계.

주요 Property:

| Property | 의미 |
| --- | --- |
| `SummaryId` | 고정값 `DASHBOARD` |
| `KeyDate` | 조회 기준일 |
| `PrDlyHdrCnt` / `PrDlyItmCnt` | PR 처리 지연 Header/Item 수 |
| `RfqNoqHdrCnt` / `RfqNoqItmCnt` | RFQ 미접수 Header/Item 수 |
| `MqSelDlyHdrCnt` / `MqSelDlyItmCnt` | MQ 채택 지연 Header/Item 수 |
| `PoDlvDlyHdrCnt` / `PoDlvDlyItmCnt` | PO 납기 지연 Header/Item 수 |
| `IvIncHdrCnt` / `IvIncItmCnt` | 입고 후 미송장 Header/Item 수 |

현재 Backend에서 PR KPI는 0으로 반환한다.

### 7.2 WeeklySummarySet

목적: 주간 구매/입고/송장 요약.

주요 Property:

| Property | 의미 |
| --- | --- |
| `SummaryId` | 고정값 `WEEKLY` |
| `KeyDate` | 기준일 |
| `WeekFrom` / `WeekTo` | 주간 시작/종료일 |
| `PurchaseAmt` | 주간 PO 금액 |
| `ReceiptAmt` | 주간 GR 금액 |
| `InvoiceAmt` | 주간 IV 금액 |
| `Waers` | 통화 |
| `CompGrHdrCnt` | 전량 입고 Header 수 |
| `IvIncHdrCnt` | 미송장 Header 수 |

### 7.3 DelayListSet

목적: 지연/미완료 문서 Header 목록.

Key:

```text
DocType + DocNo
```

주요 Property:

| Property | 의미 |
| --- | --- |
| `DocType` | `RFQ` 또는 `PO` |
| `DocNo` | 기준 문서번호 |
| `KeyDate` | 기준일 |
| `DelayStatus` | 지연상태 코드 |
| `DelayStatusText` | 지연상태 텍스트 |
| `DelayPriority` | 지연 우선순위 |
| `BaseDate` | 지연 판단 기준일 |
| `DelayDays` | Working Day 기준 지연일수 |
| `TotalItemCount` | 전체 품목 수 |
| `DelayedItemCount` | 지연 품목 수 |
| `MaterialSummary` | 대표 자재 요약 |
| `VendorSummary` | 공급업체 요약 |
| `PlantSummary` | 플랜트 요약 |
| `Remark` | 비고 |
| `Criticality` | Backend 업무 상태 |

DelayStatus:

| 코드 | 의미 |
| --- | --- |
| `RFQ_NO_QUOTATION` | RFQ 생성 후 MQ 미접수 |
| `MQ_SELECTION_DELAY` | MQ 접수 후 채택 미완료 |
| `PO_DELIVERY_DELAY` | PO 납기 초과 후 미입고 |
| `IV_INCOMPLETE` | 입고 후 송장검증 미완료 |

### 7.4 RfqQuotationStatusSet

목적: RFQ별 견적 접수 및 채택 현황.

주의:

```text
KeyDate 필터를 전달하지 않는다.
```

주요 Property:

| Property | 의미 |
| --- | --- |
| `RfqNo` | RFQ 번호 |
| `DocDate` | RFQ 생성일 |
| `ElapsedWdays` | 경과 Working Day |
| `MqCount` | MQ 수 |
| `VendorCount` | 견적 제출 공급업체 수 |
| `TotalRfqItemCnt` | RFQ 전체 품목 수 |
| `QuotedRfqItemCnt` | MQ 접수 품목 수 |
| `AwardRfqItemCnt` | 채택 완료 품목 수 |
| `UnawardRfqItemCnt` | 미채택 품목 수 |
| `AwardRate` | 채택률 |
| `ReceptionStatus` / `ReceptionStatusText` | 견적 접수 상태 |
| `AwardStatus` / `AwardStatusText` | 채택 상태 |
| `ReceptionDelayYn` | 접수 지연 여부 |
| `SelectionDelayYn` | 채택 지연 여부 |
| `MaxSelDelayDays` | 최대 채택 지연일수 |
| `ReceptionCrit` | 접수 상태 Criticality |
| `AwardCrit` | 채택 상태 Criticality |
| `Criticality` | 종합 Criticality |

### 7.5 ProcessFlowSet

목적: 선택 PO 기준 조달 흐름 카드 표시.

현재 구현 기준:

```text
ContextDocType = 'PO'
ContextDocNo   = 선택 PO 번호
```

Stage:

```text
PR → RFQ → MQ → PO → GR → IV
```

주요 Property:

| Property | 의미 |
| --- | --- |
| `ContextDocType` | 기준 문서 유형 |
| `ContextDocNo` | 기준 문서 번호 |
| `Stage` | 단계 |
| `StageOrder` | 표시 순서 |
| `StageText` | 단계 표시명 |
| `NodeTitle` | 노드 제목 |
| `NodeSubtext` | 노드 보조 설명 |
| `Status` | 단계 상태 |
| `Criticality` | Backend 업무 상태 |
| `DocumentCount` | 문서 수 |
| `ItemCount` | 품목 수 |
| `DelayedItemCount` | 지연 품목 수 |
| `ReceptionStatus` | 견적 접수 상태 |
| `AwardStatus` | 채택 상태 |
| `AwardedItemCount` | 채택 품목 수 |
| `ParentStage` | 이전 단계 |
| `ChildStage` | 다음 단계 |

### 7.6 ProcessItemSet

목적: 선택 PO의 품목별 진행 상태 표시.

Key:

```text
ContextDocType + ContextDocNo + ItemNo
```

주요 Property:

| Property | 의미 |
| --- | --- |
| `ItemNo` | 품목번호 |
| `Matnr` / `Maktx` | 자재코드/자재명 |
| `Werks` / `PlantName` | 플랜트/플랜트명 |
| `Lifnr` / `Name1` | 공급업체/공급업체명 |
| `CurrentStage` | 현재 진행 단계 |
| `DelayStatus` / `DelayStatusText` | 지연상태 |
| `DelayPriority` | 지연 우선순위 |
| `BaseDate` | 기준일 |
| `DelayDays` | 지연일수 |
| `Quantity` | PO 수량 |
| `ReceivedQuantity` | 순입고수량 |
| `OpenQuantity` | 미입고수량 |
| `InvoicedQuantity` | 송장검증수량 |
| `Meins` | 단위 |
| `Remark` | 비고 |
| `Criticality` | Backend 업무 상태 |

Mid Column의 기본 Table은 이 EntitySet을 사용한다.

### 7.7 ProcessDocumentSet

목적: 선택 PO와 관련된 PO/GR/IV 실제 문서 목록.

Key:

```text
ContextDocType + ContextDocNo + Stage + DocNo + DocYear + ItemNo
```

`DocYear` 규칙:

| Stage | DocYear |
| --- | --- |
| `PO` | `0000` |
| `GR` | `MJAHR` |
| `IV` | `GJAHR` |

V1.2.1에서는 이 EntitySet을 Mid Column 상시 Table로 표시하지 않고, 문서 상세 Dialog에서 사용한다.

### 7.8 DocumentDetailSet

목적: 관련 문서 선택 시 상세 필드를 FieldName/FieldValue 형태로 표시.

Key:

```text
Stage + DocNo + DocYear + ItemNo + DisplayOrder
```

주요 Property:

| Property | 의미 |
| --- | --- |
| `Stage` | 문서 단계 |
| `DocNo` | 문서번호 |
| `DocYear` | 문서연도 |
| `ItemNo` | 품목번호 |
| `DisplayOrder` | 표시 순서 |
| `GroupName` | 그룹명 |
| `FieldName` | 필드명 |
| `FieldValue` | 필드값 |

---

## 8. Criticality와 UI 상태 매핑

Backend는 업무 상태를 다음 문자열로 반환한다.

| Backend Criticality | 의미 |
| --- | --- |
| `Positive` | 정상/완료 |
| `Information` | 정보/진행 |
| `Critical` | 주의/처리 필요 |
| `Negative` | 지연/오류성 상태 |
| `None` | 상태 없음 |

Frontend는 업무 상태를 다시 계산하지 않는다. 다만 UI5 Control이 요구하는 상태값으로 formatter에서 변환한다.

| Backend Criticality | `sap.m.ObjectStatus.state` | 일반 색상 의미 |
| --- | --- | --- |
| `Positive` | `Success` | 녹색 |
| `Information` | `Information` | 파란색 |
| `Critical` | `Warning` | 주황색 |
| `Negative` | `Error` | 빨간색 |
| `None` | `None` | 기본 |

`GenericTile`, `ObjectNumber`, 카드 Border 등은 별도 formatter를 두어 같은 Backend 상태를 각 Control에 맞게 변환한다.

---

## 9. 기존 납기/미입고 앱 이동

### 9.1 기본 원칙

V1.2의 기존 앱 이동 기능은 유지한다. 납기 지연 및 미입고 현황 조회 Fiori 프로그램으로 이동하는 버튼은 Mid Column 하단 액션 영역에 배치한다.

버튼명:

```text
납기/미입고 앱 이동
```

또는

```text
납기·미입고 현황 이동
```

### 9.2 표시 조건

| 선택 상태 | 버튼 처리 |
| --- | --- |
| PO 행 선택 | 활성화 |
| RFQ 행 선택 | 숨김 또는 비활성화 |
| PO 납기 지연 | 활성화 |
| 입고 후 미송장 | 활성화 가능 |
| RFQ 미접수/MQ 채택 지연 | 숨김 권장 |

### 9.3 이동 방식

1순위는 Fiori Launchpad `CrossApplicationNavigation` Intent를 사용한다.

```text
URL 직접 하드코딩은 사용하지 않는다.
```

전달 파라미터:

| 파라미터 | 값 |
| --- | --- |
| `PoNo` | 선택 PO 번호 |
| `KeyDate` | 조회 기준일 |
| `Werks` | 선택 행 또는 조회조건의 플랜트 |

구현 전 확인 항목:

| 항목 | 확인 대상 |
| --- | --- |
| Semantic Object | 납기/미입고 앱 Target Mapping |
| Action | 납기/미입고 앱 Target Mapping |
| PO 파라미터명 | 대상 앱 manifest 및 Component |
| 플랜트 파라미터명 | 대상 앱 조회조건 |
| 기준일 파라미터명 | 대상 앱 조회조건 |

---

## 10. 예외 및 메시지 처리

| 상황 | 처리 |
| --- | --- |
| 조회 결과 없음 | `조회 조건에 해당하는 조달 상태 데이터가 없습니다.` |
| PR KPI 클릭 | `PR 처리 지연은 후속 확장 예정입니다.` |
| RFQ 행 클릭 | RFQ/MQ 현황 영역에서 해당 RFQ를 표시 |
| RFQ 행에서 PO Flow 요청 | 호출하지 않음 |
| `RfqQuotationStatusSet` 기준일 필터 필요 | 현재 Backend 미지원 안내 또는 후속 개선 |
| 기존 앱 Intent 미설정 | `연결 대상 앱 설정이 아직 완료되지 않았습니다.` |
| OData 부분 실패 | 실패 영역만 메시지 표시, 다른 영역은 유지 |

---

## 11. UI5 구현 파일 기준

현재 프로젝트 경로:

```text
D:\sapcodeproject_usb\ui5\purchase_process_monitor
```

현재 주요 파일:

| 파일 | 현재 상태 | 개발 방향 |
| --- | --- | --- |
| `webapp/manifest.json` | `ZGWD3MM0002_SRV` 연결됨 | `sap.f`, 필요 시 `sap.ui.layout` 라이브러리 추가 |
| `webapp/view/App.view.xml` | 기본 `sap.m.App` | FCL 라우팅 수용 가능 |
| `webapp/view/Main.view.xml` | 빈 Page 수준 | FCL Begin/Mid 화면으로 변경 |
| `webapp/controller/Main.controller.js` | 빈 `onInit` | OData 조회, 이벤트, FCL 상태 구현 |
| `webapp/model/models.js` | device 모델만 있음 | view 모델 생성 함수 추가 가능 |
| `webapp/model/formatter.js` | 없음 | Criticality/날짜/금액 formatter 신규 생성 |
| `webapp/fragment` | 없음 | 문서 상세 Dialog fragment 신규 생성 |
| `webapp/css/style.css` | 기본 파일 | 카드/Flow 보조 스타일 추가 |

---

## 12. UI5 개발 순서

### 12.1 1단계: 프로젝트 기본 설정

```text
1. manifest.json에 sap.f 추가
2. 필요 시 sap.ui.layout 추가
3. formatter.js 생성
4. fragment 폴더 생성
5. Main.controller.js 기본 모델 구조 생성
```

### 12.2 2단계: Begin Column 구현

```text
1. 기본 조회조건 구현
   - 기준일
   - 조회기간 3개월/6개월
   - PR번호
   - PO번호

2. 상세 조회조건 구현
   - 자재코드
   - 공급업체
   - 플랜트

3. 조회/초기화 버튼 구현
```

### 12.3 3단계: 최초 데이터 조회

최초 진입 시 호출:

```text
DashboardSummarySet
WeeklySummarySet
DelayListSet
RfqQuotationStatusSet
```

단, `RfqQuotationStatusSet`에는 `KeyDate` 필터를 전달하지 않는다.

### 12.4 4단계: KPI와 DelayList 연동

```text
1. KPI 카드 바인딩
2. KPI 클릭 이벤트 구현
3. DelayStatus 기반 DelayListSet 재조회
4. PR KPI 클릭 시 후속 확장 메시지 표시
```

### 12.5 5단계: PO 선택과 Mid Column

```text
1. DelayList Row 선택 이벤트 구현
2. DocType 분기
3. PO이면 Mid Column 열기
4. ProcessFlowSet 조회
5. ProcessItemSet 조회
6. Flow 카드와 품목별 진행 상태 Table 표시
```

### 12.6 6단계: RFQ 선택 처리

```text
1. RFQ Row 선택 시 PO Flow 호출 금지
2. RfqQuotationStatusSet에서 해당 RFQ 강조 또는 필터링
3. 사용자에게 RFQ/MQ 현황 영역에서 확인하도록 안내
```

### 12.7 7단계: Dialog와 앱 이동

```text
1. 문서 상세 보기 버튼 구현
2. ProcessDocumentSet 조회
3. 관련 문서 목록 Dialog 표시
4. 관련 문서 선택 시 DocumentDetailSet 조회
5. 납기/미입고 앱 이동 버튼 구현
6. 지연 산식 보기 Popover 구현
```

### 12.8 8단계: 검증

검증 항목:

| 항목 | 확인 |
| --- | --- |
| `$metadata` 로딩 | 정상 |
| 최초 조회 | 4개 EntitySet 정상 |
| 기준일 Date 필터 | Gateway 오류 없음 |
| PR번호 조건 | Filter 생성 정상 |
| PO번호 조건 | Filter 생성 정상 |
| RFQ 현황 | `KeyDate` 없이 조회 |
| KPI 클릭 | DelayList 필터 정상 |
| PO 행 클릭 | Mid Column 정상 |
| RFQ 행 클릭 | PO Flow 미호출 |
| 문서 상세 Dialog | 관련 문서 및 상세 필드 표시 |
| 납기/미입고 앱 이동 | Intent 또는 안내 메시지 |

---

## 13. 후속 개선 항목

| 항목 | 현재 상태 | 후속 방향 |
| --- | --- | --- |
| PR 처리 지연 실제 계산 | 0 반환 | Backend 보강 시 KPI 활성화 |
| RFQ 기준 ProcessFlow | 미구현 | 필요 시 Backend Entity 확장 |
| `RfqQuotationStatusSet` 기준일 필터 | 없음 | 기준일 연동 필요 시 Backend 보강 |
| Value Help EntitySet | 미확정 | UI5 개발 중 필요 시 추가 |
| MockServer 데이터 | 없음 | 실제 Gateway 우선, 필요 시 후순위 |
| End Column | 제외 | 문서 상세 요구가 커지면 검토 |

---

## 14. 최종 확정 요약

| 항목 | V1.2.1 결정 |
| --- | --- |
| 설계서 성격 | V1.2 보정본 |
| UI5 개발 기준 서비스 | `ZGWD3MM0002_SRV` |
| 화면 구조 | FCL Begin/Mid 2컬럼 |
| 기본 조회조건 | 기준일, 조회기간, PR번호, PO번호 |
| 상세 조회조건 | 자재코드, 공급업체, 플랜트 |
| RFQ 행 클릭 | PO Flow 호출 금지, RFQ/MQ 현황 표시 |
| PO 행 클릭 | Mid Column 열고 Flow/품목 상태 조회 |
| Mid Table | `ProcessItemSet` 기반 Table 1개 |
| 관련 문서 목록 | Dialog 내부에서 `ProcessDocumentSet` 사용 |
| 문서 상세 | `DocumentDetailSet` 사용 |
| PR KPI | 표시하되 후속 확장 안내 |
| 기존 납기/미입고 앱 이동 | PO 선택 시 버튼 유지 |
| Criticality | Backend 업무 상태를 formatter에서 UI5 상태값으로 변환 |
| 데이터 검증 | 실제 Gateway 우선 |
