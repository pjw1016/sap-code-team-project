# 견적 비교 및 거래선 채택 Fiori App 설계서 V1.2.1

## 0. 문서 목적

본 문서는 **삼만리 모빌리티 MM 모듈의 “견적 비교 및 거래선 채택” Fiori App** 개발을 위한 최종 설계서다.

Codex는 현재 프로젝트 맥락과 UI5 구현 상태를 모른다고 가정한다. 따라서 본 설계서는 다음을 모두 포함한다.

```
1. 앱의 업무 목적
2. 화면 Layout
3. 조회조건
4. OData Service / EntitySet
5. Backend 구현 완료 범위
6. UI5 신규 개발 범위
7. 채택/취소 처리 방식
8. RFQ Item당 MQ 1건 채택 보장 정책
9. Codex 작업 순서
10. 테스트 시나리오
```

---

# 1. 프로그램 개요

| 항목 | 내용 |
| --- | --- |
| 앱명 | 견적 비교 및 거래선 채택 |
| UI5 프로젝트명 | `quote_comparison` |
| 개발 방식 | Freestyle SAPUI5 + SAP Gateway OData |
| 대상 모듈 | MM |
| 대상 업무 | RFQ 기준 MQ 견적 비교 및 거래선 채택 |
| Backend OData Service | `ZGWD3MM0005_SRV` |
| Service Root | `/sap/opu/odata/SAP/ZGWD3MM0005_SRV/` |
| DPC Extension Class | `ZCL_ZGWD3MM0005_DPC_EXT` |
| 핵심 DB 변경 테이블 | `ZTD3MM0017` |
| 핵심 DB 변경 필드 | `ZTD3MM0017-SELIDC` |
| 현재 Gateway 상태 | 구현 및 단독 테스트 완료 |
| 현재 UI5 상태 | 0%, 신규 개발 시작 필요 |
| V1.2.1 UI5 목표 | RFQ 조회, Item 조회, MQ 비교, 상세 Dialog, 거래선 채택/취소 연결 |

---

# 2. 업무 배경 및 목적

삼만리 모빌리티는 자전거 제조 기업이며, 부품 구매 과정에서 하나의 RFQ에 대해 여러 공급업체가 MQ 견적을 제출한다.

구매 담당자는 RFQ Item별로 여러 MQ 후보를 비교한 뒤, 최종적으로 **하나의 MQ Item만 채택**해야 한다. 채택된 MQ는 이후 PO 생성의 기준이 된다.

본 Fiori App은 다음 흐름을 지원한다.

```
RFQ 조회
→ RFQ Item 확인
→ MQ 후보 비교
→ 금액/환율/납기/응답상태 확인
→ 시스템 추천 확인
→ 담당자 MQ 채택 또는 채택취소
→ ZTD3MM0017-SELIDC 반영
→ 이후 PO 생성 시 채택 MQ 참조
```

V1.2.1의 핵심 목표는 다음이다.

```
PO 생성 전, RFQ Item별 채택 MQ를 Fiori 화면에서 명확히 비교·선택하고,
그 결과를 Gateway를 통해 ZTD3MM0017-SELIDC에 반영한다.
```

---

# 3. 적용 프로세스

## 3-1. 전체 업무 흐름

```
구매요청(PR)
→ 견적요청(RFQ / RQ)
→ 공급업체 견적(MQ)
→ 견적 비교 및 거래선 채택 ← 본 앱
→ 구매오더(PO) 생성 ← V2 또는 기존 SAP GUI 구매문서 생성 프로그램 연계
```

## 3-2. 본 앱 처리 범위

| 단계 | 처리 여부 | 설명 |
| --- | --- | --- |
| RFQ Header 조회 | O | `ZTD3MM0016-BSART = 'RQ'` |
| RFQ Item 조회 | O | RFQ Header 선택 후 Item 조회 |
| MQ 후보 비교 | O | RFQ Item에 연결된 MQ 후보 조회 |
| MQ 상세 조회 | O | Dialog 팝업 |
| 환율 환산 | O | `ZTD3FI0008` 기준 KRW 환산 |
| 자동 추천 표시 | O | 최저 환산금액 기준 추천 |
| MQ 채택 저장 | O | `QuotationItemSet` MERGE |
| MQ 채택취소 | O | `QuotationItemSet` MERGE |
| PO 생성 여부 표시 | O | PO 참조 여부 표시 |
| PO 생성 | X | V2 범위 |
| 채택 이력 저장 | X | V2 범위 |
| Batch 다건 저장 | X | V1.2.1 제외 |

---

# 4. 화면 Layout 설계

## 4-1. 전체 Layout

화면은 **Dynamic Page + Flexible Column Layout** 구조로 구현한다.

```
Dynamic Page
├─ Header Area
│  ├─ 기본조건
│  │  ├─ RFQ 번호
│  │  ├─ 문서일자 From
│  │  ├─ 문서일자 To
│  │  └─ 채택상태
│  │
│  ├─ 상세조건
│  │  ├─ 공급업체코드
│  │  ├─ 공급업체명
│  │  ├─ 자재코드
│  │  ├─ 자재명
│  │  ├─ 플랜트코드
│  │  ├─ 납기일 From
│  │  ├─ 납기일 To
│  │  ├─ MM견적(MQ)번호
│  │  ├─ 회사코드
│  │  ├─ 구매조직
│  │  └─ 구매그룹
│  │
│  └─ Header Button
│     ├─ 상세조건 / 상세조건 닫기
│     ├─ 초기화
│     └─ 조회
│
└─ Content Area
   └─ FlexibleColumnLayout
      ├─ Begin Column
      │  ├─ KPI Card 영역
      │  └─ RFQ Header List
      │
      └─ Mid Column
         ├─ 선택 RFQ 요약 Header
         ├─ RFQ Item List
         ├─ MQ 비교 Bar Chart
         └─ MQ 견적 비교 Table
```

## 4-2. Flexible Column 정책

| 영역 | 사용 여부 | 설명 |
| --- | --- | --- |
| Begin Column | O | RFQ Header 목록과 KPI 카드 |
| Mid Column | O | 선택 RFQ의 Item, Chart, MQ 비교 |
| End Column | X | MQ 상세는 End Column이 아니라 Dialog 사용 |

## 4-3. MQ 상세 표시 정책

MQ 상세는 FlexibleColumnLayout의 End Column을 사용하지 않는다.

```
MQ 비교 Table Row 클릭
→ MQDetailSet(MqNo='...',MqItem='...') 조회
→ MQ 상세 Dialog Open
```

Dialog 구성:

```
MQ 상세 Dialog
├─ Header 정보
├─ Item 정보
├─ 견적/환율 정보
└─ 상태/PO 정보
```

---

# 5. 조회조건 설계

## 5-1. 기본조건

기본조건은 사용자가 가장 자주 사용하는 RFQ 검색 조건이다.

| 화면 필드 | UI Control | OData Filter / 처리 기준 | 기준 테이블/필드 |
| --- | --- | --- | --- |
| RFQ 번호 | Input + ValueHelp | `RfqNo` | `ZTD3MM0016-EBELN` |
| 문서일자 From | DatePicker | `DocDateFrom` | `ZTD3MM0016-BEDAT >= From` |
| 문서일자 To | DatePicker | `DocDateTo` | `ZTD3MM0016-BEDAT <= To` |
| 채택상태 | 체크박스형 ListBox 또는 MultiComboBox | `AwardStatus` | Backend 계산값 |

## 5-2. 채택상태 선택값

| 코드 | 텍스트 | 의미 |
| --- | --- | --- |
| `N` | 미채택 | 채택된 MQ가 없는 RFQ |
| `P` | 일부채택 | 일부 RFQ Item만 채택된 RFQ |
| `A` | 채택 | 전체 RFQ Item이 채택된 RFQ |
| `PO` | PO생성 | 채택 MQ를 참조한 PO가 생성된 RFQ |

채택상태는 DB 단일 필드가 아니라 Backend 계산값이다.

따라서 RFQ Header 조회 후 Item/MQ/PO 정보를 집계하여 `AwardStatus`를 계산하고, 사용자가 선택한 상태와 일치하는 Header만 반환한다.

## 5-3. 상세조건

상세조건은 RFQ Header, RFQ Item, MQ Header, MQ Item, 조직 정보를 기준으로 조회 범위를 좁히는 조건이다.

| 화면 필드 | UI Control | OData Filter / 처리 기준 | 기준 테이블/필드 |
| --- | --- | --- | --- |
| 공급업체코드 | Input + ValueHelp | `Lifnr` | MQ Header `ZTD3MM0016-LIFNR` |
| 공급업체명 | Input | `Name1` contains | `ZTD3MM0007-NAME1` |
| 자재코드 | Input + ValueHelp | `Matnr` | RFQ/MQ Item `ZTD3MM0017-MATNR` |
| 자재명 | Input | `Maktx` contains | `ZTD3MM0001-MAKTX` |
| 플랜트코드 | Input + ValueHelp | `Werks` | RFQ/MQ Item `ZTD3MM0017-WERKS` |
| 납기일 From | DatePicker | `EindtFrom` | `ZTD3MM0017-EINDT >= From` |
| 납기일 To | DatePicker | `EindtTo` | `ZTD3MM0017-EINDT <= To` |
| MM견적(MQ)번호 | Input + ValueHelp | `MqNo` | MQ Item `ZTD3MM0017-EBELN` |
| 회사코드 | Input + ValueHelp | `Bukrs` | RFQ/MQ Header `ZTD3MM0016-BUKRS` |
| 구매조직 | Input + ValueHelp | `Ekorg` | RFQ/MQ Header `ZTD3MM0016-EKORG` |
| 구매그룹 | Input + ValueHelp | `Ekgrp` | RFQ/MQ Header `ZTD3MM0016-EKGRP` |

## 5-4. 조회조건 주의사항

`MqItem`은 화면 조회조건에 넣지 않는다.

| 항목 | 처리 |
| --- | --- |
| `MqNo` | 상세조건으로 제공 |
| `MqItem` | OData Key, 내부 처리, 상세 조회에서만 사용 |

즉, 사용자는 MQ 번호까지만 조회조건으로 입력하고, MQ Item은 시스템 내부에서 처리한다.

---

# 6. 화면 영역별 상세 설계

## 6-1. Begin Column

Begin Column은 RFQ 목록 중심 영역이다.

```
Begin Column
├─ KPI Card
│  ├─ 미채택 건수
│  ├─ 부분채택 건수
│  ├─ 채택 건수
│  └─ PO 생성 완료 건수
│
└─ RFQ Header List
```

## 6-2. KPI Card 설계

RFQ Header List 상단에는 현재 조회조건 기준의 상태 집계를 표시한다.

| 카드 | 기준 필드 | 설명 |
| --- | --- | --- |
| 미채택 건수 | `AwardStatus = 'N'` | 아직 채택 MQ가 없는 RFQ 수 |
| 부분채택 건수 | `AwardStatus = 'P'` | 일부 RFQ Item만 채택된 RFQ 수 |
| 채택 건수 | `AwardStatus = 'A'` | 전체 RFQ Item이 채택된 RFQ 수 |
| PO 생성 완료 건수 | `AwardStatus = 'PO'` | 채택 MQ를 참조한 PO가 생성된 RFQ 수 |

KPI Card는 화면에 조회된 RFQ Header 결과 기준으로 Frontend에서 계산해도 되고, Backend에서 집계값을 추가로 제공해도 된다. V1.2.1에서는 구현 단순화를 위해 **Frontend 계산**을 우선한다.

## 6-3. RFQ Header List

Control:

```
<Table
id="idRfqHeaderTable"
items="{/RFQHeaderSet}"
mode="SingleSelectMaster"
selectionChange=".onRfqSelectionChange">
</Table>
```

기본 표시 컬럼:

| 컬럼 | Entity Field | 설명 |
| --- | --- | --- |
| RFQ 번호 | `RfqNo` | RFQ 문서번호 |
| 문서일자 | `DocDate` | RFQ 생성일 |
| 회사코드 | `Bukrs` | 회사코드 |
| 통화 | `Waers` | RFQ 통화 |
| 채택상태 | `AwardStatusText` | 미채택/일부채택/채택/PO생성 |

추가 표시 가능 컬럼:

| 컬럼 | Entity Field |
| --- | --- |
| 회사명 | `Butxt` |
| 구매조직 | `Ekorg` |
| 구매조직명 | `Ekotx` |
| 구매그룹 | `Ekgrp` |
| 구매그룹명 | `Eknam` |
| RFQ Item 수 | `RfqItemCount` |
| MQ 수 | `MqCount` |
| 공급업체 수 | `VendorCount` |
| 채택 Item 수 | `AwardItemCount` |
| PO 생성 Item 수 | `PoItemCount` |

## 6-4. Mid Column

Mid Column은 선택된 RFQ의 상세 분석 영역이다.

```
Mid Column
├─ 선택 RFQ 요약 Header
├─ RFQ Item List
├─ MQ 비교 Bar Chart
└─ MQ 견적 비교 Table
```

## 6-5. 선택 RFQ 요약 Header

RFQ Header List에서 선택한 RFQ의 요약 정보를 표시한다.

| 표시 항목 | 기준 필드 |
| --- | --- |
| RFQ 번호 | `RfqNo` |
| RFQ Item 수 | `RfqItemCount` |
| MQ 수 | `MqCount` |
| 공급업체 수 | `VendorCount` |
| 채택 상태 | `AwardStatusText` |

예시 표시:

```
RFQ 상세 / RQ70000002 / Item 3건
```

## 6-6. RFQ Item List

Control:

```
<Table
id="idRfqItemTable"
items="{/RFQItemSet}"
mode="SingleSelectMaster"
selectionChange=".onRfqItemSelectionChange">
</Table>
```

컬럼:

| 컬럼 | Entity Field | 설명 |
| --- | --- | --- |
| RFQ Item | `RfqItem` | RFQ 품목번호 |
| 자재코드 | `Matnr` | 자재코드 |
| 자재명 | `Maktx` | 자재명 |
| 요청수량 | `ReqQty` | RFQ 요청수량 |
| 단위 | `Meins` | 단위 |
| 납기일 | `Eindt` | 요청 납기일 |
| 유효 MQ 수 | `ValidMqCount` | 응답 완료 MQ 수 |
| 미응답 MQ 수 | `NoResponseMqCount` | 미응답 MQ 수 |
| 현재 채택 공급업체 | `AwardName1` | 채택 MQ의 공급업체명 |
| 상태 | `ItemStatusText` | 미채택/채택/PO생성 |

RFQ Item 선택 시:

```
선택 RFQ Item
→ MQCompareSet 조회
→ Bar Chart 갱신
→ MQ 비교 Table 갱신
```

## 6-7. MQ 비교 Bar Chart

Bar Chart는 선택 RFQ Item의 MQ 후보별 금액 비교를 시각화한다.

권장 기준:

| 항목 | 값 |
| --- | --- |
| Chart Type | Bar Chart |
| X축 | 공급업체명 또는 MQ 번호 |
| Y축 | `NetwrKrw` |
| 데이터 소스 | `workModel>/MqCompareRows` |
| 미응답 MQ | Chart에서 제외 또는 별도 표시 |
| 추천 MQ | `RecommendYn = X` 표시 |
| 현재 채택 MQ | `CurrentAwardYn = X` 표시 |

Chart 목적:

```
구매 담당자가 MQ별 환산금액을 빠르게 비교할 수 있도록 한다.
```

## 6-8. MQ 견적 비교 Table

Control:

```
<table:Table
id="idMqCompareTable"
rows="{work>/MqCompareRows}"
selectionMode="None"
visibleRowCount="8"
enableColumnReordering="true">
</table:Table>
```

RadioButton 컬럼:

```
<table:Columnwidth="4rem">
<Labeltext="선택"/>
<table:template>
<RadioButton
selected="{work>UiSelected}"
enabled="{= ${work>CanSelect} === 'X' }"
select=".onMqRadioSelect"/>
</table:template>
</table:Column>
```

주요 컬럼:

| 컬럼 | Entity Field | 설명 |
| --- | --- | --- |
| 선택 | `UiSelected` | Frontend 임시 선택 |
| MQ 번호 | `MqNo` | MQ 문서번호 |
| MQ Item | `MqItem` | MQ 품목번호 |
| 공급업체코드 | `Lifnr` | 공급업체 |
| 공급업체명 | `Name1` | 공급업체명 |
| 자재코드 | `Matnr` | 자재 |
| 자재명 | `Maktx` | 자재명 |
| 견적수량 | `QuoteQty` | MQ 견적수량 |
| 단위 | `Meins` | 단위 |
| 원통화 단가 | `Netpr` | MQ 단가 |
| 가격단위 | `Peinh` | 가격단위 |
| 원통화 금액 | `Netwr` | MQ 금액 |
| 통화 | `Waers` | 거래통화 |
| 환율 | `Kursf` | KRW 환율 |
| 환산단가(KRW) | `NetprKrw` | KRW 환산단가 |
| 환산금액(KRW) | `NetwrKrw` | KRW 환산금액 |
| 납기일 | `Eindt` | 납기일 |
| 현재채택 | `CurrentAwardYn` | 현재 DB 채택 여부 |
| 자동추천 | `RecommendYn` | 시스템 추천 여부 |
| 응답상태 | `ResponseStatusText` | 응답/미응답 |
| PO생성여부 | `PoCreatedYn` | PO 생성 여부 |
| 선택불가사유 | `BlockReason` | 선택 불가 이유 |

---

# 7. 주요 테이블 및 필드

## 7-1. `ZTD3MM0016` 구매문서 Header

| 필드 | 의미 | 사용 |
| --- | --- | --- |
| `EBELN` | 구매문서 번호 | RFQ/MQ/PO 번호 |
| `BSART` | 문서유형 | `RQ`, `MQ`, `PO` 구분 |
| `LIFNR` | 공급업체 | MQ Header 기준 |
| `EKORG` | 구매조직 | 조회/표시 |
| `EKGRP` | 구매그룹 | 조회/표시 |
| `BUKRS` | 회사코드 | 조회/표시 |
| `BEDAT` | 문서일자 | RFQ 문서일자 |
| `WAERS` | 통화 | 표시 |
| `ZTERM` | 지급조건 | MQ 상세 |
| `HEAD_TXT` | 헤더 텍스트 | MQ 상세 |
| `LVORM` | 삭제 플래그 | `space`만 조회 |

## 7-2. `ZTD3MM0017` 구매문서 Item

| 필드 | 의미 | 사용 |
| --- | --- | --- |
| `EBELN` | 구매문서 번호 | RFQ/MQ/PO 번호 |
| `EBELP` | 구매문서 품목 | RFQ/MQ/PO Item |
| `MATNR` | 자재코드 | 자재 조인 |
| `WERKS` | 플랜트 | 플랜트 조인 |
| `LGORT` | 저장위치 | 저장위치 조인 |
| `MENGE` | 수량 | 요청/견적 수량 |
| `MEINS` | 단위 | 표시 |
| `NETPR` | 단가 | MQ 비교 |
| `PEINH` | 가격단위 | 표시 |
| `NETWR` | 금액 | 추천/비교 |
| `WAERS` | 거래통화 | 환율 환산 |
| `EINDT` | 납기일 | 비교/추천 |
| `BANFN` | PR 번호 | MQ 상세 |
| `ANFNR` | 원본 RFQ 번호 | MQ → RFQ 연결 |
| `ANFPS` | 원본 RFQ 품목 | MQ → RFQ Item 연결 |
| `QTNFN` | 원본 MQ 번호 | PO → MQ 연결 |
| `QTNFP` | 원본 MQ 품목 | PO → MQ Item 연결 |
| `SELIDC` | 견적 채택 여부 | 핵심 Update 필드 |
| `LVORM` | 삭제 플래그 | `space`만 조회 |

핵심 Update 필드:

```
ZTD3MM0017-SELIDC
```

---

# 8. OData EntitySet 설계

## 8-1. EntitySet 목록

| EntitySet | 용도 | Method | 구현 상태 |
| --- | --- | --- | --- |
| `RFQHeaderSet` | RFQ Header 목록 조회 | `GET_ENTITYSET` | 완료 |
| `RFQItemSet` | 선택 RFQ의 Item 목록 조회 | `GET_ENTITYSET` | 완료 |
| `MQCompareSet` | 선택 RFQ Item의 MQ 비교 목록 조회 | `GET_ENTITYSET` | 완료 |
| `MQDetailSet` | MQ 상세 Dialog 조회 | `GET_ENTITY` | 완료 |
| `QuotationItemSet` | 채택/취소 단건 처리 | `GET_ENTITY`, `UPDATE_ENTITY` | 완료 |

주의:

```
외부 EntitySet명: MQCompareSet
Generated DPC 메소드명: MQCOMPARESETSET_GET_ENTITYSET
```

## 8-2. Entity Key

| EntitySet | Key |
| --- | --- |
| `RFQHeaderSet` | `RfqNo` |
| `RFQItemSet` | `RfqNo`, `RfqItem` |
| `MQCompareSet` | `MqNo`, `MqItem` |
| `MQDetailSet` | `MqNo`, `MqItem` |
| `QuotationItemSet` | `MqNo`, `MqItem` |

---

# 9. Entity 상세 설계

## 9-1. `RFQHeaderSet`

| Property | 설명 |
| --- | --- |
| `RfqNo` | RFQ 번호 |
| `DocDate` | 문서일자 |
| `Bukrs` | 회사코드 |
| `Butxt` | 회사명 |
| `Ekorg` | 구매조직 |
| `Ekotx` | 구매조직명 |
| `Ekgrp` | 구매그룹 |
| `Eknam` | 구매그룹명 |
| `Waers` | 통화 |
| `RfqItemCount` | RFQ Item 수 |
| `MqCount` | MQ 수 |
| `VendorCount` | 공급업체 수 |
| `AwardItemCount` | 채택 Item 수 |
| `PoItemCount` | PO 생성 Item 수 |
| `AwardStatus` | Header 상태 코드 |
| `AwardStatusText` | Header 상태 텍스트 |
| `AwardStatusState` | UI5 ObjectStatus State |

## 9-2. `RFQItemSet`

| Property | 설명 |
| --- | --- |
| `RfqNo` | RFQ 번호 |
| `RfqItem` | RFQ Item |
| `Matnr` | 자재코드 |
| `Maktx` | 자재명 |
| `Werks` | 플랜트 |
| `WerksName` | 플랜트명 |
| `Lgort` | 저장위치 |
| `Lgobe` | 저장위치명 |
| `ReqQty` | 요청수량 |
| `Meins` | 단위 |
| `Eindt` | 납기일 |
| `ValidMqCount` | 유효 MQ 수 |
| `NoResponseMqCount` | 미응답 MQ 수 |
| `AwardMqNo` | 채택 MQ 번호 |
| `AwardMqItem` | 채택 MQ Item |
| `AwardLifnr` | 채택 공급업체 |
| `AwardName1` | 채택 공급업체명 |
| `PoCreatedYn` | PO 생성 여부 |
| `PoNo` | PO 번호 |
| `PoItem` | PO Item |
| `ItemStatus` | Item 상태 코드 |
| `ItemStatusText` | Item 상태 텍스트 |
| `ItemStatusState` | UI5 상태 |
| `CanCancelAward` | 채택취소 가능 여부 |

## 9-3. `MQCompareSet`

| Property | 설명 |
| --- | --- |
| `RfqNo` | 원본 RFQ 번호 |
| `RfqItem` | 원본 RFQ Item |
| `MqNo` | MQ 번호 |
| `MqItem` | MQ Item |
| `Lifnr` | 공급업체코드 |
| `Name1` | 공급업체명 |
| `Matnr` | 자재코드 |
| `Maktx` | 자재명 |
| `Werks` | 플랜트 |
| `WerksName` | 플랜트명 |
| `Lgort` | 저장위치 |
| `Lgobe` | 저장위치명 |
| `QuoteQty` | 견적수량 |
| `Meins` | 단위 |
| `Netpr` | 원통화 단가 |
| `Peinh` | 가격단위 |
| `Netwr` | 원통화 금액 |
| `Waers` | 거래통화 |
| `ExchangeDate` | 환율 기준일 |
| `Kursf` | 환율 |
| `NetprKrw` | KRW 환산단가 |
| `NetwrKrw` | KRW 환산금액 |
| `Kwaers` | 회사통화, KRW |
| `Eindt` | 납기일 |
| `CurrentAwardYn` | 현재 채택 여부 |
| `RecommendYn` | 자동 추천 여부 |
| `ResponseStatus` | 응답상태 코드 |
| `ResponseStatusText` | 응답상태 텍스트 |
| `PoCreatedYn` | PO 생성 여부 |
| `PoNo` | PO 번호 |
| `PoItem` | PO Item |
| `CanSelect` | 선택 가능 여부 |
| `BlockReason` | 선택 불가 사유 |

## 9-4. `MQDetailSet`

`MQDetailSet`은 `MQCompareSet`의 주요 필드에 상세 Dialog용 참조정보를 추가한다.

| 추가 Property | 설명 |
| --- | --- |
| `Bukrs` | 회사코드 |
| `Butxt` | 회사명 |
| `Ekorg` | 구매조직 |
| `Ekotx` | 구매조직명 |
| `Ekgrp` | 구매그룹 |
| `Eknam` | 구매그룹명 |
| `Banfn` | PR 번호 |
| `Zterm` | 지급조건 |
| `HeadTxt` | 헤더 텍스트 |

## 9-5. `QuotationItemSet`

채택/취소 처리용 EntitySet이다.

### Key

| Property | 기준 |
| --- | --- |
| `MqNo` | `ZTD3MM0017-EBELN` |
| `MqItem` | `ZTD3MM0017-EBELP` |

### Properties

| Property | 설명 |
| --- | --- |
| `MqNo` | MQ 번호 |
| `MqItem` | MQ Item |
| `RfqNo` | 원본 RFQ 번호 |
| `RfqItem` | 원본 RFQ Item |
| `ActionType` | `AWARD` 또는 `CANCEL` |
| `MessageType` | `S`, `W`, `E` |
| `MessageText` | 처리 메시지 |

---

# 10. RFQ Item 단일 채택 보장 정책

본 앱에서는 하나의 RFQ Item에 대해 여러 MQ 후보가 존재할 수 있으나, 업무적으로 최종 채택 가능한 MQ는 반드시 1건이다.

## 10-1. 기준

| 기준 | 필드 |
| --- | --- |
| RFQ Item 식별 | `ANFNR + ANFPS` |
| MQ Item 식별 | `EBELN + EBELP` |
| 채택 여부 | `ZTD3MM0017-SELIDC` |

## 10-2. Backend 처리 원칙

`ActionType = 'AWARD'` 요청이 들어오면 다음 순서로 처리한다.

```
1. 선택 MQ의 존재 여부 확인
2. 선택 MQ가 MQ 문서인지 확인
3. 선택 MQ의 원본 RFQ Item 확인
4. 같은 RFQ Item에 PO가 생성되었는지 확인
5. 미응답 MQ인지 확인
6. 같은 RFQ Item의 기존 채택 MQ를 모두 해제
7. 선택 MQ 1건만 SELIDC = 'X' 처리
```

즉, 같은 `ANFNR + ANFPS` 조합 안에서는 최종적으로 `SELIDC = 'X'`인 MQ Item이 최대 1건만 존재해야 한다.

## 10-3. UI5 처리 원칙

UI5에서도 RFQ Item 기준으로 하나의 MQ만 선택되도록 처리한다.

| 계층 | 처리 방식 |
| --- | --- |
| MQ 비교 Table | RadioButton 사용 |
| workModel | 현재 RFQ Item 기준 선택 MQ 1건만 저장 |
| 저장 버튼 | 선택 MQ 1건만 `QuotationItemSet` MERGE 호출 |
| Backend | 기존 채택 해제 후 신규 1건만 채택 |

---

# 11. Backend 처리 로직

## 11-1. `RFQHeaderSet_GET_ENTITYSET`

처리 기준:

```
ZTD3MM0016-BSART = 'RQ'
ZTD3MM0016-LVORM = space
```

처리 흐름:

```
1. RFQ Header 조건 조회
2. RFQ Item 조회
3. RFQ Item을 참조하는 MQ 조회
4. MQ를 참조하는 PO 조회
5. Header별 RFQ Item 수, MQ 수, 공급업체 수 계산
6. 채택 Item 수 계산
7. PO 생성 Item 수 계산
8. AwardStatus 계산
9. UI5 State 계산
10. EntitySet 반환
```

## 11-2. `RFQItemSet_GET_ENTITYSET`

처리 기준:

```
RFQ Header BSART = 'RQ'
RFQ Item LVORM = space
```

처리 흐름:

```
1. 선택 RFQ의 Item 조회
2. 자재명, 플랜트명, 저장위치명 조인
3. 연결 MQ 조회
4. PO 생성 여부 조회
5. 유효 MQ 수, 미응답 MQ 수 계산
6. 채택 MQ 정보 계산
7. ItemStatus 계산
8. EntitySet 반환
```

## 11-3. `MQCompareSet_GET_ENTITYSET`

처리 기준:

```
MQ Header BSART = 'MQ'
MQ Header LVORM = space
MQ Item LVORM = space
MQ Item ANFNR = RfqNo
MQ Item ANFPS = RfqItem
```

처리 흐름:

```
1. 선택 RFQ Item에 연결된 MQ 후보 조회
2. 공급업체/자재/플랜트/저장위치명 조인
3. 필요한 통화 목록 수집
4. ZTD3FI0008 환율 조회
5. KRW 환산단가/환산금액 계산
6. PO 생성 여부 조회
7. 추천 MQ 계산
8. CurrentAwardYn 계산
9. CanSelect / BlockReason 계산
10. EntitySet 반환
```

## 11-4. `MQDetailSet_GET_ENTITY`

처리 기준:

```
Key = MqNo + MqItem
```

처리 흐름:

```
1. MQ 단건 조회
2. Header 정보 조회
3. Item 정보 조회
4. 공급업체/자재/조직/저장위치 정보 조인
5. 환율/환산금액 계산
6. 현재채택/추천/PO 여부 계산
7. Dialog용 Entity 반환
```

## 11-5. `QuotationItemSet_GET_ENTITY`

필요 이유:

```
QuotationItemSet은 MqNo + MqItem을 Key로 가지는 Single Entity이다.
Gateway Runtime은 MERGE/PUT 처리 과정에서도 Single Entity URI 처리를 위해
GET_ENTITY 구현을 요구할 수 있다.
```

처리 흐름:

```
1. URI Key에서 MqNo, MqItem 추출
2. MQ Header/Item 존재 여부 확인
3. ANFNR/ANFPS에서 RfqNo/RfqItem 반환
4. ActionType/MessageType/MessageText는 blank 반환
```

## 11-6. `QuotationItemSet_UPDATE_ENTITY`

### 호출 방식

```
MERGE /sap/opu/odata/SAP/ZGWD3MM0005_SRV/QuotationItemSet(MqNo='MQ70000002',MqItem='00010')
```

Header:

```
Content-Type: application/json
Accept: application/json
X-CSRF-Token: <token>
```

채택 Body:

```
{
  "MqNo":"MQ70000002",
  "MqItem":"00010",
  "ActionType":"AWARD"
}
```

채택취소 Body:

```
{
  "MqNo":"MQ70000002",
  "MqItem":"00010",
  "ActionType":"CANCEL"
}
```

### `AWARD` 처리

```
1. URI Key에서 MqNo, MqItem 추출
2. Body의 ActionType 확인
3. Body의 MqNo/MqItem과 URI Key 일치 여부 검증
4. MQ 존재 여부 확인
5. MQ Header BSART = 'MQ' 확인
6. MQ Item의 ANFNR/ANFPS 확보
7. 같은 RFQ Item에 PO 생성 여부 확인
8. 미응답 MQ 여부 확인
9. 이미 채택된 MQ인지 확인
10. 같은 RFQ Item의 기존 SELIDC = 'X' 전체 해제
11. 선택 MQ의 SELIDC = 'X'
12. 성공 시 204 No Content
```

### `CANCEL` 처리

```
1. URI Key에서 MqNo, MqItem 추출
2. MQ 존재 여부 확인
3. 같은 RFQ Item에 PO 생성 여부 확인
4. 현재 MQ가 SELIDC = 'X'인지 확인
5. 현재 MQ의 SELIDC = space
6. 성공 시 204 No Content
```

### Commit 정책

```
DPC_EXT의 UPDATE_ENTITY 안에서는 COMMIT WORK를 직접 수행하지 않는다.
Gateway Framework가 Change Request의 LUW를 관리한다.
```

---

# 12. 환율 및 금액 환산 설계

## 12-1. 환율 기준

| 항목 | 값 |
| --- | --- |
| 테이블 | `ZTD3FI0008` |
| 환율유형 | `KURST = 'M'` |
| 기준통화 | `FCURR = 거래통화` |
| 대상통화 | `TCURR = 'KRW'` |
| 기준일자 | `GDATU <= SY-DATUM` |
| 선택 기준 | 같은 통화쌍 중 `GDATU` 최신 1건 |

## 12-2. KRW인 경우

```
WAERS = KRW
KWAERS = KRW
KURSF = 1
NETPR_KRW = NETPR
NETWR_KRW = NETWR
```

## 12-3. 외화인 경우

현재 CBO 금액 Scale 이슈를 반영하여 외화는 `/100` 보정을 적용한다.

```
NETPR_KRW = (NETPR * KURSF) / 100
NETWR_KRW = (NETWR * KURSF) / 100
```

## 12-4. 환율 미유지 시

| 상황 | 처리 |
| --- | --- |
| 외화인데 환율 없음 | `Kursf`, `NetprKrw`, `NetwrKrw` Clear |
| 환산금액 0 이하 | 추천 대상 제외 |
| 동일 통화 | 환율 테이블 조회 생략, `Kursf = 1` |

---

# 13. 추천 및 선택 가능 여부 설계

## 13-1. 미응답 판정

Backend 기준:

```
NETPR <= 0 OR MENGE <= 0
```

| 조건 | 처리 |
| --- | --- |
| `NETPR <= 0` | 미응답 |
| `MENGE <= 0` | 미응답 |
| 미응답 MQ | 추천 제외, 선택 불가 |
| Backend Update | 재검증 후 Business Exception |

## 13-2. 자동 추천 기준

```
1. 미응답 MQ 제외
2. 환산금액 NETWR_KRW <= 0 제외
3. NETWR_KRW가 가장 낮은 MQ 추천
4. 금액이 같으면 EINDT가 빠른 MQ 추천
```

주의:

```
RecommendYn은 시스템 추천값이다.
CurrentAwardYn은 실제 사용자가 채택한 값이다.
둘은 다를 수 있다.
```

## 13-3. 선택 가능 여부

| 우선순위 | 조건 | `CanSelect` | `BlockReason` |
| --- | --- | --- | --- |
| 1 | 미응답 MQ | blank | 미응답 MQ는 채택할 수 없습니다. |
| 2 | PO 생성 MQ | blank | 이미 PO가 생성되어 변경할 수 없습니다. |
| 3 | 현재 채택 MQ | blank | 이미 채택된 견적입니다. |
| 4 | 그 외 응답 MQ | X | blank |

---

# 14. Batch 업데이트 정책

V1.2.1에서는 **Batch 다건 Update를 구현하지 않는다.**

## 14-1. 현재 가능한 것

현재 Gateway에서 검증 완료된 것은 **단건 MERGE Update**다.

```
MERGE /QuotationItemSet(MqNo='...',MqItem='...')
```

단, 하나의 단건 MERGE 안에서 다음은 처리된다.

```
같은 RFQ Item의 기존 채택 MQ 전체 해제
→ 선택 MQ 1건만 SELIDC = 'X'
```

즉, 아래 처리는 가능하다.

| 처리 | 가능 여부 |
| --- | --- |
| 같은 RFQ Item 안에서 기존 채택 해제 + 신규 채택 | O |
| 하나의 RFQ Item에 대해 MQ 1건만 채택 | O |
| 여러 RFQ Item을 한 번에 저장 | X |
| 여러 MERGE를 `$batch`로 묶어 한 번에 전송 | X |

## 14-2. Batch를 V2로 미루는 이유

| 이유 | 설명 |
| --- | --- |
| 현재 업무 단위 | 사용자가 RFQ Item 1건을 보고 MQ 1건 채택 |
| Backend 검증 완료 범위 | 단건 MERGE |
| UI5 1차 구현 난이도 | 단건 저장이 안정적 |
| Batch 필요성 | 여러 RFQ Item을 한 번에 저장할 때 필요 |
| V1.2.1 목표 | 안정적인 채택/취소 화면 연결 |

따라서 V1.2.1의 `[채택 저장]` 버튼은 **현재 선택 RFQ Item의 MQ 1건만 저장**한다.

---

# 15. Frontend Model 설계

## 15-1. 사용 Model

| Model | 용도 |
| --- | --- |
| 기본 ODataModel | Gateway 조회/저장 |
| `filterModel` | 조회조건 |
| `viewModel` | 화면 상태, Busy, 버튼 활성화 |
| `workModel` | MQ 비교 데이터, 임시 선택 |
| `messageModel` | Message Popover |

## 15-2. `filterModel`

```
{
  "RfqNo":"",
  "DocDateFrom":null,
  "DocDateTo":null,
  "AwardStatus": [],
  "Lifnr":"",
  "Name1":"",
  "Matnr":"",
  "Maktx":"",
  "Werks":"",
  "EindtFrom":null,
  "EindtTo":null,
  "MqNo":"",
  "Bukrs":"",
  "Ekorg":"",
  "Ekgrp":""
}
```

## 15-3. `viewModel`

```
{
  "Busy":false,
  "AdvancedFilterVisible":false,
  "HasRfqSelected":false,
  "HasRfqItemSelected":false,
  "CanSaveAward":false,
  "CanCancelAward":false,
  "SelectedRfqTitle":"",
  "SelectedItemTitle":""
}
```

## 15-4. `workModel`

V1.2.1은 단건 저장이므로 현재 선택 RFQ Item 기준으로 단순하게 설계한다.

```
{
  "CurrentRfqNo":"",
  "CurrentRfqItem":"",
  "SelectedMq": {
    "RfqNo":"",
    "RfqItem":"",
    "MqNo":"",
    "MqItem":"",
    "Lifnr":"",
    "Name1":""
  },
  "HasUnsavedChanges":false,
  "RfqHeaders": [],
  "RfqItems": [],
  "MqCompareRows": [],
  "MqDetail": {}
}
```

---

# 16. UI5 Event Handler 설계

| Handler | 역할 |
| --- | --- |
| `onInit` | Model 초기화 |
| `onSearch` | RFQ Header 조회 |
| `onReset` | 조회조건 초기화 |
| `onToggleAdvancedFilter` | 상세조건 열기/닫기 |
| `onRfqSelectionChange` | RFQ 선택 후 RFQItemSet 조회 |
| `onRfqItemSelectionChange` | RFQ Item 선택 후 MQCompareSet 조회 |
| `onMqRadioSelect` | MQ 임시 선택 |
| `onAutoRecommend` | 추천 MQ를 임시 선택 |
| `onSaveAward` | 선택 MQ를 MERGE로 AWARD |
| `onCancelCurrentItemAward` | 현재 채택 MQ를 MERGE로 CANCEL |
| `onMqRowPress` | MQ 상세 Dialog 열기 |
| `onCloseMqDetailDialog` | MQ 상세 Dialog 닫기 |
| `_loadRfqHeaders` | RFQHeaderSet 조회 |
| `_loadRfqItems` | RFQItemSet 조회 |
| `_loadMqCompare` | MQCompareSet 조회 |
| `_updateQuotationItem` | AWARD/CANCEL 공통 MERGE 호출 |
| `_refreshAfterAward` | 저장 후 Header/Item/Compare 재조회 |
| `_showBackendError` | Gateway Error 파싱 및 표시 |
| `_setBusy` | Busy 상태 제어 |

---

# 17. UI5 OData 호출 설계

## 17-1. RFQ Header 조회

```
oModel.read("/RFQHeaderSet", {
  filters:aFilters,
  success:function (oData) {
oWorkModel.setProperty("/RfqHeaders",oData.results|| []);
  },
  error:function (oError) {
this._showBackendError(oError);
  }.bind(this)
});
```

## 17-2. RFQ Item 조회

```
oModel.read("/RFQItemSet", {
  filters: [
newFilter("RfqNo",FilterOperator.EQ,sRfqNo)
  ],
  success:function (oData) {
oWorkModel.setProperty("/RfqItems",oData.results|| []);
  },
  error:function (oError) {
this._showBackendError(oError);
  }.bind(this)
});
```

## 17-3. MQ 비교 조회

```
oModel.read("/MQCompareSet", {
  filters: [
newFilter("RfqNo",FilterOperator.EQ,sRfqNo),
newFilter("RfqItem",FilterOperator.EQ,sRfqItem)
  ],
  success:function (oData) {
varaRows=oData.results|| [];

aRows.forEach(function (oRow) {
oRow.UiSelected=oRow.CurrentAwardYn==="X";
    });

oWorkModel.setProperty("/MqCompareRows",aRows);
  },
  error:function (oError) {
this._showBackendError(oError);
  }.bind(this)
});
```

## 17-4. 채택 저장 MERGE

```
_updateQuotationItem:function (sMqNo,sMqItem,sActionType) {
varoModel=this.getView().getModel();

varsPath="/QuotationItemSet(MqNo='"+encodeURIComponent(sMqNo)+
"',MqItem='"+encodeURIComponent(sMqItem)+"')";

varoPayload= {
    MqNo:sMqNo,
    MqItem:sMqItem,
    ActionType:sActionType
  };

this._setBusy(true);

oModel.update(sPath,oPayload, {
    merge:true,

    success:function () {
this._setBusy(false);
this._refreshAfterAward();
    }.bind(this),

    error:function (oError) {
this._setBusy(false);
this._showBackendError(oError);
    }.bind(this)
  });
}
```

주의:

```
UI5 ODataModel.update() 호출 시 merge: true를 사용한다.
Backend Gateway Client 검증 기준도 MERGE이다.
```

---

# 18. UI5 파일 구조

```
webapp/
├─ Component.js
├─ manifest.json
├─ index.html
├─ view/
│  └─ Main.view.xml
├─ controller/
│  └─ Main.controller.js
├─ fragment/
│  └─ MQDetailDialog.fragment.xml
├─ model/
│  ├─ models.js
│  └─ formatter.js
└─ i18n/
   └─ i18n.properties
```

---

# 19. formatter.js 설계

필요 Formatter:

| 함수 | 역할 |
| --- | --- |
| `formatDate` | OData Date 표시 |
| `formatQuantity` | 수량 표시 |
| `formatAmount` | 금액 천단위 표시 |
| `formatCurrencyAmount` | 금액 + 통화 표시 |
| `formatAwardState` | 상태코드 → UI5 State |
| `formatBooleanText` | `X/blank` → 예/아니오 |
| `formatCanSelect` | 선택 가능 여부 표시 |
| `formatBlockReason` | 선택 불가 사유 표시 |

---

# 20. Message 처리 설계

## 20-1. 성공 메시지

| 상황 | 메시지 |
| --- | --- |
| 채택 성공 | 견적이 채택되었습니다. |
| 채택취소 성공 | 견적 채택이 취소되었습니다. |
| 자동추천 적용 | 최적 견적 추천이 적용되었습니다. |

## 20-2. 오류 메시지

Backend Business Exception의 메시지를 우선 표시한다.

주요 메시지:

| 상황 | 메시지 |
| --- | --- |
| 미응답 MQ 채택 | 미응답 MQ는 채택할 수 없습니다. |
| PO 생성 MQ 변경 | 이미 PO가 생성되어 채택 정보를 변경할 수 없습니다. |
| 이미 채택된 MQ 재채택 | 이미 채택된 견적입니다. |
| 미채택 MQ 취소 | 채택된 견적만 채택취소할 수 있습니다. |
| 선택 없음 | 채택할 MQ를 선택하세요. |

---

# 21. Gateway Client 검증 완료 내역

## 21-1. AWARD 테스트

요청:

```
MERGE /sap/opu/odata/SAP/ZGWD3MM0005_SRV/QuotationItemSet(MqNo='MQ70000002',MqItem='00010')
```

Body:

```
{
  "MqNo":"MQ70000002",
  "MqItem":"00010",
  "ActionType":"AWARD"
}
```

결과:

| 항목 | 결과 |
| --- | --- |
| HTTP Status | `204 No Content` |
| DB 반영 | 성공 |
| `MQ70000002-SELIDC` | `X` |
| 기존 채택 MQ | `SELIDC = space` |
| 샘플데이터 원복 | 완료 |

---

# 22. UI5 개발 순서

Codex는 UI5 개발이 0%인 상태에서 시작한다고 가정한다.

## Step 1. 프로젝트 기본 구조 확인/생성

```
1. manifest.json 확인
2. Service URL 등록
3. Main.view.xml 생성
4. Main.controller.js 생성
5. formatter.js 생성
6. MQDetailDialog.fragment.xml 생성
```

## Step 2. Model 초기화

```
1. filterModel 생성
2. viewModel 생성
3. workModel 생성
4. messageModel 생성
```

## Step 3. Header Filter 구현

```
1. 기본조건 UI 구현
2. 상세조건 UI 구현
3. 상세조건 토글 구현
4. 초기화 버튼 구현
5. 조회 버튼 구현
```

## Step 4. Begin Column 구현

```
1. KPI Card 4개 구현
2. RFQ Header List sap.m.Table 구현
3. onSearch 구현
4. onRfqSelectionChange 구현
```

## Step 5. Mid Column 구현

```
1. 선택 RFQ 요약 Header 구현
2. RFQ Item List sap.m.Table 구현
3. onRfqItemSelectionChange 구현
4. MQ Bar Chart 구현
5. MQ Compare sap.ui.table.Table 구현
```

## Step 6. MQ 선택 로직 구현

```
1. RadioButton Column 구현
2. CanSelect가 X가 아니면 Radio 비활성
3. onMqRadioSelect 구현
4. 동일 RFQ Item 내 1건만 UiSelected = true
5. SelectedMq에 선택 MQ 저장
```

## Step 7. 채택 저장 구현

```
1. onSaveAward 구현
2. 선택 MQ 검증
3. 확인 팝업
4. _updateQuotationItem(..., "AWARD") 호출
5. 성공 후 재조회
```

## Step 8. 채택취소 구현

```
1. onCancelCurrentItemAward 구현
2. 현재 RFQ Item의 채택 MQ 확인
3. PO 생성 여부 확인
4. 확인 팝업
5. _updateQuotationItem(..., "CANCEL") 호출
6. 성공 후 재조회
```

## Step 9. MQ 상세 Dialog 구현

```
1. MQ Row 클릭 이벤트 구현
2. MQDetailSet 단건 조회
3. Dialog Fragment Open
4. Header/Item/금액/상태 Section 표시
```

## Step 10. 통합 테스트

```
1. RFQ 조회
2. RFQ 선택
3. RFQ Item 선택
4. MQ 후보 표시
5. Radio 선택
6. 채택 저장
7. DB 반영 확인
8. 채택취소
9. PO 생성 MQ 차단
10. 미응답 MQ 차단
```

---

# 23. UI5 통합 테스트 시나리오

| No | 테스트 | 기대 결과 |
| --- | --- | --- |
| 1 | 조회조건 입력 후 조회 | RFQ Header List 표시 |
| 2 | KPI Card 확인 | 상태별 건수 표시 |
| 3 | RFQ Header 선택 | RFQ Item List 표시 |
| 4 | RFQ Item 선택 | MQ Bar Chart + MQ Compare Table 표시 |
| 5 | `CanSelect = X` MQ Radio 선택 | 해당 MQ만 선택 |
| 6 | 이미 채택된 MQ 확인 | Radio 비활성, BlockReason 표시 |
| 7 | 채택 저장 | MERGE 204, `SELIDC = X` |
| 8 | 기존 채택 MQ 자동 해제 | 기존 `SELIDC = space` |
| 9 | Compare 재조회 | `CurrentAwardYn` 이동 |
| 10 | RFQ Item 재조회 | `AwardMqNo`, `AwardName1` 변경 |
| 11 | Header 재조회 | `AwardStatus` 반영 |
| 12 | 채택취소 | `SELIDC = space` |
| 13 | PO 생성 MQ 취소 시도 | Backend Error 표시 |
| 14 | 미응답 MQ 채택 시도 | 선택 불가 또는 Error |
| 15 | MQ 상세 Dialog | 상세정보 정상 표시 |
| 16 | 추천/채택 차이 확인 | `RecommendYn`과 `CurrentAwardYn` 별도 표시 |
| 17 | 샘플데이터 원복 | 기존 채택 상태 복구 |

---

# 24. V1.2.1 제외 범위

| 기능 | 처리 |
| --- | --- |
| PO 생성 | V2 |
| PO Preview | V2 |
| 채택 이력 저장 | V2 |
| Batch 다건 저장 | V2 또는 선택사항 |
| Variant 저장 | V2 |
| 가격조건 상세 탭 | V2 |
| 채택 사유 입력 | V2 |
| 공급업체 평가 점수 | V2 |
| Lock Object 동시성 제어 | V2 또는 리팩토링 후보 |

---

# 25. Codex에게 전달할 핵심 지시사항

```
이 UI5 앱은 현재 0% 상태에서 시작한다.

Backend Gateway는 이미 구현되어 있으며,
다음 OData Service를 사용한다.

Service:
  /sap/opu/odata/SAP/ZGWD3MM0005_SRV/

핵심 EntitySet:
  RFQHeaderSet
  RFQItemSet
  MQCompareSet
  MQDetailSet
  QuotationItemSet

채택/취소는 QuotationItemSet에 MERGE로 호출한다.

채택:
  ActionType = "AWARD"

취소:
  ActionType = "CANCEL"

하나의 RFQ Item에는 MQ 1건만 채택되어야 한다.
UI에서는 RadioButton으로 1건만 선택하게 하고,
Backend는 기존 SELIDC를 해제한 뒤 신규 MQ만 SELIDC = X로 처리한다.

V1.2.1에서는 Batch 다건 저장을 구현하지 않는다.
현재 선택 RFQ Item의 MQ 1건만 저장한다.
```

---

# 최종 요약 표

| 구분 | V1.2.1 확정 내용 |
| --- | --- |
| 앱 목적 | RFQ 기준 MQ 비교 및 거래선 채택 |
| UI5 상태 | 0%, 신규 개발 시작 |
| Backend 상태 | Gateway 구현 및 테스트 완료 |
| 실제 Service | `ZGWD3MM0005_SRV` |
| Service Root | `/sap/opu/odata/SAP/ZGWD3MM0005_SRV/` |
| DPC_EXT | `ZCL_ZGWD3MM0005_DPC_EXT` |
| 화면 구조 | Dynamic Page + FCL Begin/Mid |
| End Column | 사용 안 함 |
| MQ 상세 | Dialog |
| 기본조건 | RFQ번호, 문서일자 From/To, 채택상태 |
| 상세조건 | 공급업체, 자재, 플랜트, 납기일, MQ번호, 회사코드, 구매조직, 구매그룹 |
| KPI Card | 미채택/부분채택/채택/PO생성 완료 |
| RFQ Header List | `sap.m.Table` |
| RFQ Item List | `sap.m.Table` |
| MQ 비교 Table | `sap.ui.table.Table` |
| Chart | MQ별 `NetwrKrw` 비교 Bar Chart |
| 핵심 EntitySet | `RFQHeaderSet`, `RFQItemSet`, `MQCompareSet`, `MQDetailSet`, `QuotationItemSet` |
| `QuotationItemSet` Key | `MqNo + MqItem` |
| 채택 Method | `MERGE` |
| 채택 ActionType | `AWARD` |
| 취소 ActionType | `CANCEL` |
| 실제 Update 필드 | `ZTD3MM0017-SELIDC` |
| 단일 채택 정책 | RFQ Item당 MQ 1건만 채택 |
| Batch | V1.2.1 제외 |
| 다음 작업 | UI5 화면 및 Controller 전체 신규 구현 |