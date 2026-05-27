# 견적 비교 및 거래선 채택 Fiori App 설계서 V2.0

## 0. 문서 목적

본 문서는 삼만리 모빌리티 MM 모듈의 `[MM] 견적 비교 및 거래선 채택` SAPUI5 Freestyle App 개발을 위한 V2.0 화면/프론트엔드 설계서다.

V1.2.1 설계서는 Backend OData, 업무 범위, EntitySet, 채택/취소 정책을 정의한 기준 문서이며, V2.0은 다음 내용을 추가로 확정한다.

| 구분 | V2.0 반영 내용 |
| --- | --- |
| 화면 구조 | `DynamicPage + FlexibleColumnLayout + IconTabBar` 구조 확정 |
| UI5 컨트롤 | SAPUI5 SDK 1.120.44 기준 적용 컨트롤 확정 |
| CSS 정책 | SAPUI5 표준 컨트롤/속성 우선, CSS 최소 사용 |
| Search Help | `sap.m.TableSelectDialog` 공통 Search Help 방식 |
| 유효성 검사 | `sap.m.MessagePopover` + 필드 `ValueState` 병행 |
| 테이블 정책 | 목록은 `sap.m.Table`, MQ 비교는 `sap.ui.table.Table` |
| 상세 팝업 | MQ 상세는 `sap.m.Dialog` |
| 저장 정책 | 현재 선택 RFQ Item의 MQ 1건만 단건 MERGE |

---

## 1. 기준 문서 및 참고자료

### 1-1. 프로젝트 기준 문서

| 문서 | 용도 |
| --- | --- |
| `AGENT.md` | SAP 개발 학습, 답변, 코드 작성 원칙 |
| `Business.md` | 삼만리 모빌리티 프로젝트 업무 배경 |
| `견적 비교 및 거래선 채택 Fiori 프로그램 설계서_V1.2.1.md` | Backend/OData/업무 처리 기준 |

### 1-2. 개발 참고자료

| 자료 | 사용 기준 |
| --- | --- |
| `D:\sapcodeproject_usb\ui5\ui5 참고용 코드 모음` | 기존 UI5 코드 스타일 참고 |
| `D:\sapcodeproject_usb\ui5\delayed_po_monitor` | 이전 MM Fiori 프로그램 구현 패턴 참고 |
| `D:\sapcodeproject_usb\SAP 개발 교재\SAP Fiori & OData.pdf` | Fiori/OData 개발 참고 |
| SAPUI5 Demo Kit 1.120.44 | UI5 Control API/Sample 참고 |
| Fiori Design Guidelines v1.120 | 화면 패턴 및 UI 요소 사용 기준 |

### 1-3. 공식 참고 URL

| 구분 | URL |
| --- | --- |
| SAPUI5 Demo Kit | https://ui5.sap.com/1.120.44/ |
| DynamicPage API | https://ui5.sap.com/1.120.44/#/api/sap.f.DynamicPage |
| FlexibleColumnLayout API | https://ui5.sap.com/1.120.44/#/api/sap.f.FlexibleColumnLayout |
| IconTabBar API | https://ui5.sap.com/1.120.44/#/api/sap.m.IconTabBar |
| sap.m.Table API | https://ui5.sap.com/1.120.44/#/api/sap.m.Table |
| sap.ui.table.Table API | https://ui5.sap.com/1.120.44/#/api/sap.ui.table.Table |
| Dialog API | https://ui5.sap.com/1.120.44/#/api/sap.m.Dialog |
| Fiori Floorplan Overview | https://www.sap.com/design-system/fiori-design-web/v1-120/page-types/floorplan-overview |

---

## 2. 프로그램 개요

| 항목 | 내용 |
| --- | --- |
| 앱명 | `[MM] 견적 비교 및 거래선 채택` |
| UI5 프로젝트명 | `quote_comparison` |
| 개발 방식 | Freestyle SAPUI5 + SAP Gateway OData V2 |
| 대상 모듈 | MM |
| 대상 업무 | RFQ 기준 MQ 견적 비교 및 거래선 채택 |
| Backend OData Service | `ZGWD3MM0005_SRV` |
| Service Root | `/sap/opu/odata/SAP/ZGWD3MM0005_SRV/` |
| 핵심 DB 변경 테이블 | `ZTD3MM0017` |
| 핵심 DB 변경 필드 | `ZTD3MM0017-SELIDC` |
| V2.0 UI 목표 | 조회, 비교, 추천 확인, 단건 채택/취소, 상세 조회 |

본 앱은 RFQ Item별로 여러 MQ 후보를 비교하고, 구매 담당자가 최종 거래선 MQ 1건을 채택하도록 지원한다.

업무 흐름은 다음과 같다.

```text
RFQ Header 조회
→ RFQ 선택
→ RFQ Item 조회
→ RFQ Item 선택
→ MQ 후보 비교
→ 추천 MQ 확인
→ 담당자 MQ 1건 선택
→ 채택 또는 채택취소
→ ZTD3MM0017-SELIDC 반영
```

---

## 3. V2.0 확정 설계 요약

| 항목 | 확정 내용 |
| --- | --- |
| 전체 화면 | `sap.f.DynamicPage` |
| 좌우 분할 | `sap.f.FlexibleColumnLayout` |
| FCL 구조 | Begin Column + Mid Column 사용, End Column 미사용 |
| Mid Column 구성 | `sap.m.IconTabBar` |
| RFQ Header 목록 | `sap.m.Table` + Pop-in |
| RFQ Item 목록 | `sap.m.Table` |
| MQ 비교 목록 | `sap.ui.table.Table` |
| MQ 선택 | `sap.m.RadioButton` |
| KPI 위치 | Begin Column 상단 |
| KPI 컨트롤 | `sap.m.GenericTile` + `sap.m.NumericContent` |
| Chart | `sap.viz.ui5.controls.VizFrame` Bar Chart |
| MQ 상세 | `sap.m.Dialog` |
| Search Help | `sap.m.TableSelectDialog` |
| 메시지 | `sap.m.MessagePopover`, `sap.m.MessageStrip`, `MessageToast`, `MessageBox` |
| 유효성 검사 | MessagePopover 누적 + 필드 ValueState |
| CSS | 간격 보정 수준만 최소 사용 |
| 저장 후 처리 | Header/Item/MQ 모두 재조회 |
| 테스트 | Mock + 실제 Gateway 둘 다 확인 |

---

## 4. 전체 화면 Layout

### 4-1. 전체 구조

```text
sap.f.DynamicPage
├─ DynamicPageTitle
│  ├─ 앱 제목
│  └─ 주요 Action 표시
│
├─ DynamicPageHeader
│  └─ 조회조건 영역
│     ├─ 기본조건
│     ├─ 상세조건
│     └─ 조회/초기화/상세조건 토글 버튼
│
└─ DynamicPageContent
   └─ sap.f.FlexibleColumnLayout
      ├─ Begin Column
      │  ├─ KPI 영역
      │  └─ RFQ Header 목록
      │
      └─ Mid Column
         ├─ 선택 RFQ 요약 Header
         ├─ sap.m.IconTabBar
         │  ├─ RFQ Item 목록 탭
         │  ├─ 금액 비교 차트 탭
         │  └─ MQ 비교 목록 탭
         └─ Action Toolbar
```

### 4-2. 레이아웃 선택 이유

| 구조 | 선택 이유 |
| --- | --- |
| DynamicPage | 조회조건과 업무 본문을 명확히 구분할 수 있음 |
| FlexibleColumnLayout | RFQ 목록과 선택 RFQ 상세를 나란히 보여주기 좋음 |
| IconTabBar | Mid Column의 정보량을 줄이고 단계별 확인이 쉬움 |
| Dialog | MQ 상세를 보되 현재 비교 화면 맥락을 유지할 수 있음 |

---

## 5. DynamicPage Header 조회조건 설계

### 5-1. 조회조건 구성 원칙

조회조건은 `sap.ui.layout.form.SimpleForm` 또는 `sap.ui.layout.form.Form` 기반으로 구성한다.

CSS로 필드 폭을 강하게 조정하지 않고, UI5 Form의 반응형 레이아웃을 우선 사용한다.

| 구분 | 정책 |
| --- | --- |
| 기본조건 | 항상 표시 |
| 상세조건 | 버튼으로 표시/숨김 |
| 코드 필드 | 핵심 코드 필드는 ValueHelp 제공 |
| 날짜 필드 | `sap.m.DatePicker` 사용 |
| 채택상태 | `sap.m.MultiComboBox` 사용 |
| 버튼 위치 | Header 우측 또는 Header 하단 Toolbar |

### 5-2. 기본조건

| 화면 필드 | Control | Model Path | 비고 |
| --- | --- | --- | --- |
| RFQ 번호 | `sap.m.Input` | `filter>/RfqNo` | ValueHelp 적용 |
| 문서일자 From | `sap.m.DatePicker` | `filter>/DocDateFrom` | `yyyy-MM-dd` |
| 문서일자 To | `sap.m.DatePicker` | `filter>/DocDateTo` | `yyyy-MM-dd` |
| 채택상태 | `sap.m.MultiComboBox` | `filter>/AwardStatus` | `N`, `P`, `A`, `PO` |

### 5-3. 상세조건

| 화면 필드 | Control | Model Path | ValueHelp |
| --- | --- | --- | --- |
| 공급업체코드 | `sap.m.Input` | `filter>/Lifnr` | O |
| 공급업체명 | `sap.m.Input` | `filter>/Name1` | X |
| 자재코드 | `sap.m.Input` | `filter>/Matnr` | O |
| 자재명 | `sap.m.Input` | `filter>/Maktx` | X |
| 플랜트코드 | `sap.m.Input` | `filter>/Werks` | O |
| 납기일 From | `sap.m.DatePicker` | `filter>/EindtFrom` | X |
| 납기일 To | `sap.m.DatePicker` | `filter>/EindtTo` | X |
| MM견적(MQ)번호 | `sap.m.Input` | `filter>/MqNo` | O |
| 회사코드 | `sap.m.Input` | `filter>/Bukrs` | O |
| 구매조직 | `sap.m.Input` | `filter>/Ekorg` | O |
| 구매그룹 | `sap.m.Input` | `filter>/Ekgrp` | O |

### 5-4. Header 버튼

| 버튼 | Control | Handler | 설명 |
| --- | --- | --- | --- |
| 상세조건 / 상세조건 닫기 | `sap.m.Button` | `onToggleAdvancedFilter` | 상세조건 표시 전환 |
| 초기화 | `sap.m.Button` | `onReset` | 필터, 선택, 메시지 초기화 |
| 조회 | `sap.m.Button` | `onSearch` | RFQ Header 조회 |

---

## 6. Begin Column 설계

### 6-1. Begin Column 목적

Begin Column은 RFQ Header 조회 결과를 탐색하는 영역이다.

```text
Begin Column
├─ KPI Summary
└─ RFQ Header Table
```

### 6-2. KPI 영역

KPI는 조회된 RFQ Header 결과 기준으로 Frontend에서 계산한다.

| KPI | 기준 | 표시 예시 |
| --- | --- | --- |
| 미채택 건수 | `AwardStatus = 'N'` | `12 건` |
| 부분 채택 건수 | `AwardStatus = 'P'` | `7 건` |
| 채택 건수 | `AwardStatus = 'A'` | `5 건` |
| PO 생성 완료 건수 | `AwardStatus = 'PO'` | `3 건` |

권장 Control:

```text
sap.m.GenericTile
└─ sap.m.TileContent
   └─ sap.m.NumericContent
```

KPI Tile 클릭은 V2.0 필수 기능으로 보지 않는다. 다만 구현 여유가 있으면 해당 상태로 RFQ Header Table을 Frontend 필터링할 수 있다.

### 6-3. RFQ Header 목록

Control:

```xml
<Table
  id="idRfqHeaderTable"
  items="{work>/RfqHeaders}"
  mode="SingleSelectMaster"
  selectionChange=".onRfqSelectionChange">
</Table>
```

주요 컬럼:

| 우선순위 | 컬럼 | Entity Field | 반응형 정책 |
| --- | --- | --- | --- |
| 1 | RFQ 번호 | `RfqNo` | 항상 표시 |
| 2 | 문서일자 | `DocDate` | 항상 표시 |
| 3 | 채택상태 | `AwardStatusText` | 항상 표시 |
| 4 | 통화 | `Waers` | Pop-in 가능 |
| 5 | 구매조직 | `Ekorg` | Pop-in |
| 6 | 공급업체 수 | `VendorCount` | Pop-in |
| 7 | RFQ Item 수 | `RfqItemCount` | Pop-in |

상태 표시는 `sap.m.ObjectStatus`를 사용한다.

```xml
<ObjectStatus
  text="{work>AwardStatusText}"
  state="{work>AwardStatusState}"/>
```

---

## 7. Mid Column 설계

### 7-1. Mid Column 목적

Mid Column은 선택된 RFQ를 기준으로 Item과 MQ 후보를 비교하고 채택/취소하는 영역이다.

```text
Mid Column
├─ 선택 RFQ 요약 Header
├─ IconTabBar
│  ├─ RFQ Item 목록
│  ├─ 금액 비교 차트
│  └─ MQ 비교 목록
└─ Action Toolbar
```

### 7-2. 선택 RFQ 요약 Header

표시 항목:

| 표시 항목 | 기준 필드 |
| --- | --- |
| RFQ 번호 | `RfqNo` |
| RFQ Item 수 | `RfqItemCount` |
| MQ 수 | `MqCount` |
| 공급업체 수 | `VendorCount` |
| 채택상태 | `AwardStatusText` |

권장 Control:

| 정보 | Control |
| --- | --- |
| 제목 | `sap.m.Title` |
| 상태 | `sap.m.ObjectStatus` |
| 보조 수치 | `sap.m.Text` 또는 `sap.m.ObjectNumber` |

---

## 8. IconTabBar 설계

### 8-1. 탭 구성

Control:

```xml
<IconTabBar
  id="idMainIconTabBar"
  selectedKey="{view>/SelectedTabKey}"
  expandable="false">
</IconTabBar>
```

| 탭 Key | 탭명 | 목적 |
| --- | --- | --- |
| `items` | RFQ Item 목록 | 선택 RFQ의 품목 목록 확인 |
| `chart` | 금액 비교 차트 | 선택 RFQ Item의 MQ 금액 비교 |
| `compare` | MQ 비교 목록 | MQ 후보 상세 비교 및 선택 |

### 8-2. 탭 전환 정책

| 상황 | 처리 |
| --- | --- |
| RFQ 미선택 | Mid Column 비활성 안내 표시 |
| RFQ 선택 직후 | `items` 탭 활성 |
| RFQ Item 선택 직후 | `compare` 탭으로 이동 가능 |
| MQ 비교 조회 완료 | `chart`, `compare` 탭 활성 |
| RFQ 변경 | 기존 Item/MQ 선택 초기화 |

---

## 9. RFQ Item 목록 탭

### 9-1. 목적

RFQ Header 선택 후 해당 RFQ의 Item 목록을 확인하고, 비교할 RFQ Item 1건을 선택한다.

Control:

```xml
<Table
  id="idRfqItemTable"
  items="{work>/RfqItems}"
  mode="SingleSelectMaster"
  selectionChange=".onRfqItemSelectionChange">
</Table>
```

### 9-2. 컬럼

| 우선순위 | 컬럼 | Entity Field | 표시 Control |
| --- | --- | --- | --- |
| 1 | RFQ Item | `RfqItem` | `Text` |
| 2 | 자재코드 | `Matnr` | `ObjectIdentifier` |
| 3 | 자재명 | `Maktx` | `Text` |
| 4 | 요청수량 | `ReqQty` | `ObjectNumber` |
| 5 | 단위 | `Meins` | `Text` |
| 6 | 납기일 | `Eindt` | `Text` |
| 7 | 유효 MQ 수 | `ValidMqCount` | `ObjectNumber` |
| 8 | 미응답 MQ 수 | `NoResponseMqCount` | `ObjectNumber` |
| 9 | 현재 채택 공급업체 | `AwardName1` | `Text` |
| 10 | 상태 | `ItemStatusText` | `ObjectStatus` |

### 9-3. 선택 시 처리

```text
RFQ Item 선택
→ workModel CurrentRfqItem 갱신
→ MQCompareSet 조회
→ MqCompareRows 생성
→ 기존 SelectedMq 초기화
→ CurrentAwardYn 기준 UiSelected 세팅
→ Chart 데이터 갱신
→ MQ 비교 목록 탭 사용 가능
```

---

## 10. 금액 비교 차트 탭

### 10-1. 목적

선택 RFQ Item의 MQ 후보별 환산금액(KRW)을 시각적으로 비교한다.

권장 Control:

```text
sap.viz.ui5.controls.VizFrame
```

Chart Type:

```text
bar
```

### 10-2. 데이터 기준

| 항목 | 기준 |
| --- | --- |
| 데이터 모델 | `work>/MqCompareRows` |
| Dimension | 공급업체명 또는 MQ 번호 |
| Measure | `NetwrKrw` |
| 제외 기준 | 미응답 MQ 또는 환산금액 없음 |
| 강조 정보 | 추천 여부, 현재 채택 여부 |

### 10-3. Chart 탭 보조 정보

Chart 탭에는 차트만 단독으로 두지 않고 간단한 요약 정보를 함께 표시한다.

| 요약 정보 | 기준 |
| --- | --- |
| 최저 환산금액 | `RecommendYn = 'X'` MQ |
| 현재 채택 MQ | `CurrentAwardYn = 'X'` MQ |
| 유효 MQ 수 | `CanSelect = 'X'` 또는 응답 완료 MQ |
| 미응답 MQ 수 | `ResponseStatus` 기준 |

차트 조각 클릭으로 MQ를 바로 선택하는 기능은 V2.0 필수로 보지 않는다. 선택은 MQ 비교 목록의 RadioButton을 기준으로 한다.

---

## 11. MQ 비교 목록 탭

### 11-1. 목적

MQ 비교 목록은 실제 거래선 채택을 결정하는 핵심 영역이다.

Control:

```xml
<table:Table
  id="idMqCompareTable"
  rows="{work>/MqCompareRows}"
  selectionMode="None"
  visibleRowCount="8"
  enableColumnReordering="true">
</table:Table>
```

Namespace:

```xml
xmlns:table="sap.ui.table"
```

### 11-2. 탭 구성

```text
MQ 비교 목록 탭
├─ MessageStrip
├─ sap.ui.table.Table
└─ 보조 안내 Text
```

`MessageStrip`은 미응답 MQ, PO 생성 MQ, 선택 불가 조건을 사용자에게 안내한다.

### 11-3. 주요 컬럼

| 우선순위 | 컬럼 | Entity Field | Control |
| --- | --- | --- | --- |
| 1 | 선택 | `UiSelected` | `sap.m.RadioButton` |
| 2 | MQ 번호 | `MqNo` | `Text` |
| 3 | MQ Item | `MqItem` | `Text` |
| 4 | 공급업체코드 | `Lifnr` | `Text` |
| 5 | 공급업체명 | `Name1` | `Text` |
| 6 | 견적수량 | `QuoteQty` | `ObjectNumber` |
| 7 | 원통화 단가 | `Netpr` | `ObjectNumber` |
| 8 | 원통화 금액 | `Netwr` | `ObjectNumber` |
| 9 | 통화 | `Waers` | `Text` |
| 10 | 환율 | `Kursf` | `Text` |
| 11 | 환산금액(KRW) | `NetwrKrw` | `ObjectNumber` |
| 12 | 납기일 | `Eindt` | `Text` |
| 13 | 현재채택 | `CurrentAwardYn` | `ObjectStatus` |
| 14 | 자동추천 | `RecommendYn` | `ObjectStatus` |
| 15 | 응답상태 | `ResponseStatusText` | `ObjectStatus` |
| 16 | PO생성여부 | `PoCreatedYn` | `ObjectStatus` |
| 17 | 선택불가사유 | `BlockReason` | `Text` |

### 11-4. MQ 선택 정책

| 조건 | 처리 |
| --- | --- |
| `CanSelect = 'X'` | RadioButton 활성 |
| 미응답 MQ | 표시하되 RadioButton 비활성 |
| PO 생성 MQ | 표시하되 선택/취소 불가 |
| 현재 채택 MQ | RadioButton 비활성, 현재 채택 상태 표시 |
| 추천 MQ | 추천 상태 표시, 자동추천 버튼으로 선택 가능 |

RadioButton 선택 시 현재 RFQ Item 안에서는 1건만 `UiSelected = true`가 되어야 한다.

---

## 12. Action Toolbar 설계

### 12-1. 위치

채택 관련 버튼은 Mid Column 전체 하단 Action Toolbar에 둔다.

이유:

```text
RFQ Item 탭, Chart 탭, MQ 비교 탭을 오가더라도
현재 선택 MQ에 대한 주요 Action 위치가 변하지 않도록 하기 위함이다.
```

### 12-2. 버튼

| 버튼 | Type | Handler | 활성 조건 |
| --- | --- | --- | --- |
| 자동추천 적용 | `Transparent` | `onAutoRecommend` | 추천 MQ 존재 |
| 채택 | `Emphasized` | `onSaveAward` | 선택 가능 MQ 선택 |
| 채택취소 | `Default` | `onCancelCurrentItemAward` | 현재 Item에 채택 MQ 존재, PO 미생성 |
| MQ 상세 | `Default` | `onOpenSelectedMqDetail` | MQ 선택 또는 현재 채택 MQ 존재 |

### 12-3. 채택 전 확인

채택 저장 전에는 항상 확인 Dialog를 표시한다.

권장 메시지:

```text
선택한 MQ를 이 RFQ Item의 최종 거래선으로 채택하시겠습니까?
기존 채택 MQ가 있으면 자동으로 해제됩니다.
```

사용 Control:

```text
sap.m.MessageBox.confirm
```

---

## 13. MQ 상세 Dialog 설계

### 13-1. 진입 방식

MQ 상세는 다음 두 방식 모두 제공한다.

| 방식 | 설명 |
| --- | --- |
| MQ Table Row 클릭 | 클릭한 MQ 상세 조회 |
| MQ 상세 버튼 | 현재 선택 MQ 또는 현재 채택 MQ 상세 조회 |

### 13-2. Dialog 구조

Control:

```xml
<Dialog
  id="idMqDetailDialog"
  title="{i18n>mqDetailDialogTitle}">
</Dialog>
```

구성:

```text
MQ 상세 Dialog
├─ 제목/부제
├─ 1. 기본정보
├─ 2. 견적정보
├─ 3. 참조정보
├─ 4. 상태정보
└─ Footer
   ├─ 이 MQ 선택
   └─ 닫기
```

### 13-3. 섹션별 필드

#### 기본정보

| 필드 | Entity Field |
| --- | --- |
| RFQ 번호 | `RfqNo` |
| RFQ Item | `RfqItem` |
| MQ 번호 | `MqNo` |
| MQ Item | `MqItem` |
| 공급업체코드 | `Lifnr` |
| 공급업체명 | `Name1` |
| 자재코드 | `Matnr` |
| 자재명 | `Maktx` |
| 플랜트코드 | `Werks` |
| 플랜트명 | `WerksName` |

#### 견적정보

| 필드 | Entity Field |
| --- | --- |
| 견적수량 | `QuoteQty` |
| 단위 | `Meins` |
| 원통화 단가 | `Netpr` |
| 가격단위 | `Peinh` |
| 원통화 금액 | `Netwr` |
| 통화 | `Waers` |
| 환율 기준일 | `ExchangeDate` |
| 환율 | `Kursf` |
| 환산단가(KRW) | `NetprKrw` |
| 환산금액(KRW) | `NetwrKrw` |
| 납기일 | `Eindt` |

#### 참조정보

| 필드 | Entity Field |
| --- | --- |
| 회사코드 | `Bukrs` |
| 회사명 | `Butxt` |
| 구매조직 | `Ekorg` |
| 구매조직명 | `Ekotx` |
| 구매그룹 | `Ekgrp` |
| 구매그룹명 | `Eknam` |
| PR 번호 | `Banfn` |
| 지급조건 | `Zterm` |
| 헤더 텍스트 | `HeadTxt` |

#### 상태정보

| 필드 | Entity Field | 표시 |
| --- | --- | --- |
| 응답상태 | `ResponseStatusText` | `ObjectStatus` |
| 현재채택여부 | `CurrentAwardYn` | `ObjectStatus` |
| 자동추천여부 | `RecommendYn` | `ObjectStatus` |
| 선택가능여부 | `CanSelect` | `ObjectStatus` |
| 선택불가사유 | `BlockReason` | `Text` |
| PO 생성여부 | `PoCreatedYn` | `ObjectStatus` |
| PO 번호 | `PoNo` | `Text` |
| PO Item | `PoItem` | `Text` |

### 13-4. Dialog 버튼

| 버튼 | Handler | 활성 조건 |
| --- | --- | --- |
| 이 MQ 선택 | `onSelectMqFromDialog` | `CanSelect = 'X'` |
| 닫기 | `onCloseMqDetailDialog` | 항상 |

---

## 14. Search Help 설계

### 14-1. 기본 정책

이전 `delayed_po_monitor`와 동일하게 `sap.m.TableSelectDialog` 기반 공통 Search Help를 사용한다.

Input에는 다음 속성을 사용한다.

```xml
<Input
  showValueHelp="true"
  valueHelpRequest=".onValueHelpRequest">
  <customData>
    <core:CustomData key="helpType" value="VENDOR"/>
  </customData>
</Input>
```

### 14-2. V2.0 ValueHelp 적용 범위

핵심 코드 필드만 우선 적용한다.

| helpType | 대상 필드 | 비고 |
| --- | --- | --- |
| `RFQ` | RFQ 번호 | 가능하면 RFQ Header 기준 |
| `VENDOR` | 공급업체코드 | 공급업체 코드/명 |
| `MATERIAL` | 자재코드 | 자재코드/자재명 |
| `PLANT` | 플랜트코드 | 플랜트코드/명 |
| `COMPANY` | 회사코드 | 회사코드/명 |
| `PURORG` | 구매조직 | 구매조직/명 |
| `PURGRP` | 구매그룹 | 구매그룹/명 |
| `MQ` | MM견적(MQ)번호 | MQ 번호 |

### 14-3. Search Help 구현 원칙

| 항목 | 정책 |
| --- | --- |
| Dialog 생성 | 공통 함수 `_openValueHelpDialog` |
| 필드 구분 | `helpType` |
| 데이터 조회 | 필요 시 Help OData 또는 기존 Service 활용 |
| 선택 처리 | 선택한 Row 값으로 Input 갱신 |
| 보조 필드 | 자재명/공급업체명 등 자동 세팅 가능 |
| Dialog 크기 | 컬럼 수에 따라 `contentWidth`, `contentHeight` 조정 |

---

## 15. 유효성 검사 및 메시지 설계

### 15-1. 메시지 컨트롤

| 용도 | Control |
| --- | --- |
| 유효성 오류 누적 | `sap.m.MessagePopover` |
| 메시지 항목 | `sap.m.MessageItem` |
| 필드 오류 표시 | `ValueState`, `ValueStateText` |
| 처리 성공 | `sap.m.MessageToast` |
| 채택 전 확인 | `sap.m.MessageBox.confirm` |
| Backend 오류 | `MessageBox.error` 또는 MessagePopover |

### 15-2. 유효성 검사 항목

| No | 검사 | 메시지 |
| --- | --- | --- |
| 1 | 문서일자 From > To | 문서일자 종료일은 시작일보다 빠를 수 없습니다. |
| 2 | 납기일 From > To | 납기일 종료일은 시작일보다 빠를 수 없습니다. |
| 3 | RFQ 미선택 상태에서 Item/MQ 조회 시도 | RFQ를 먼저 선택하세요. |
| 4 | RFQ Item 미선택 상태에서 MQ 저장 시도 | RFQ Item을 먼저 선택하세요. |
| 5 | MQ 미선택 상태에서 채택 | 채택할 MQ를 선택하세요. |
| 6 | 선택 불가 MQ 채택 시도 | 선택할 수 없는 MQ입니다. |
| 7 | 현재 채택 MQ 없음 상태에서 취소 | 채택된 MQ가 없습니다. |

### 15-3. 메시지 처리 흐름

```text
사용자 Action
→ Frontend Validation
→ MessagePopover 초기화
→ 오류가 있으면 MessagePopover 표시
→ 오류가 없으면 OData 호출
→ 성공 시 MessageToast
→ 실패 시 Backend Error 파싱 후 표시
```

---

## 16. Frontend Model 설계

### 16-1. Model 목록

| Model | 용도 |
| --- | --- |
| 기본 ODataModel | Gateway 조회/저장 |
| `filterModel` | 조회조건 |
| `viewModel` | 화면 상태, Busy, 버튼 활성화 |
| `workModel` | 조회 결과와 현재 선택 데이터 |
| `messageModel` | MessagePopover 메시지 |
| `detailModel` | MQ 상세 Dialog 데이터 |

### 16-2. filterModel

```json
{
  "RfqNo": "",
  "DocDateFrom": null,
  "DocDateTo": null,
  "AwardStatus": [],
  "Lifnr": "",
  "Name1": "",
  "Matnr": "",
  "Maktx": "",
  "Werks": "",
  "EindtFrom": null,
  "EindtTo": null,
  "MqNo": "",
  "Bukrs": "",
  "Ekorg": "",
  "Ekgrp": ""
}
```

### 16-3. viewModel

```json
{
  "Busy": false,
  "AdvancedFilterVisible": false,
  "HasRfqSelected": false,
  "HasRfqItemSelected": false,
  "HasMqRows": false,
  "CanAutoRecommend": false,
  "CanSaveAward": false,
  "CanCancelAward": false,
  "CanOpenMqDetail": false,
  "SelectedTabKey": "items",
  "SelectedRfqTitle": "",
  "SelectedItemTitle": ""
}
```

### 16-4. workModel

```json
{
  "CurrentRfqNo": "",
  "CurrentRfqItem": "",
  "SelectedMq": {
    "RfqNo": "",
    "RfqItem": "",
    "MqNo": "",
    "MqItem": "",
    "Lifnr": "",
    "Name1": ""
  },
  "HasUnsavedChanges": false,
  "RfqHeaders": [],
  "RfqItems": [],
  "MqCompareRows": [],
  "ChartRows": [],
  "Kpi": {
    "NotAwarded": 0,
    "PartiallyAwarded": 0,
    "Awarded": 0,
    "PoCreated": 0
  }
}
```

### 16-5. messageModel

```json
{
  "Messages": []
}
```

### 16-6. detailModel

```json
{
  "MqDetail": {}
}
```

---

## 17. Formatter 설계

파일:

```text
webapp/model/formatter.js
```

필요 함수:

| 함수 | 역할 |
| --- | --- |
| `formatDate` | OData Date 표시 |
| `formatQuantity` | 수량 표시 |
| `formatAmount` | 금액 천단위 표시 |
| `formatCurrencyAmount` | 금액 + 통화 표시 |
| `formatAwardState` | 상태코드 → UI5 State |
| `formatBooleanText` | `X/blank` → 예/아니오 |
| `formatBooleanState` | `X/blank` → UI5 State |
| `formatCanSelect` | 선택 가능 여부 표시 |
| `formatBlockReason` | 선택 불가 사유 표시 |
| `formatResponseState` | 응답상태 → UI5 State |
| `formatPoCreatedText` | PO 생성 여부 표시 |

---

## 18. 주요 Event Handler 설계

| Handler | 역할 |
| --- | --- |
| `onInit` | Model 초기화 |
| `onSearch` | RFQ Header 조회 |
| `onReset` | 조회조건, 선택, 메시지 초기화 |
| `onToggleAdvancedFilter` | 상세조건 표시/숨김 |
| `onValueHelpRequest` | Search Help 공통 진입 |
| `onRfqSelectionChange` | RFQ 선택 후 RFQItemSet 조회 |
| `onRfqItemSelectionChange` | RFQ Item 선택 후 MQCompareSet 조회 |
| `onMainTabSelect` | IconTabBar 탭 전환 처리 |
| `onMqRadioSelect` | MQ 임시 선택 |
| `onAutoRecommend` | 추천 MQ를 임시 선택 |
| `onSaveAward` | 선택 MQ AWARD |
| `onCancelCurrentItemAward` | 현재 채택 MQ CANCEL |
| `onMqRowPress` | Row 클릭 MQ 상세 조회 |
| `onOpenSelectedMqDetail` | 선택 MQ 상세 조회 |
| `onSelectMqFromDialog` | Dialog의 MQ를 현재 선택 MQ로 반영 |
| `onCloseMqDetailDialog` | MQ 상세 Dialog 닫기 |
| `onMessagePopoverPress` | 메시지 Popover 열기 |

Private 함수:

| Function | 역할 |
| --- | --- |
| `_initModels` | JSONModel 초기화 |
| `_buildHeaderFilters` | RFQHeaderSet Filter 생성 |
| `_validateSearchFilters` | 조회조건 유효성 검사 |
| `_loadRfqHeaders` | RFQHeaderSet 조회 |
| `_loadRfqItems` | RFQItemSet 조회 |
| `_loadMqCompare` | MQCompareSet 조회 |
| `_loadMqDetail` | MQDetailSet 조회 |
| `_updateQuotationItem` | AWARD/CANCEL MERGE 공통 |
| `_refreshAfterAward` | 저장 후 Header/Item/MQ 재조회 |
| `_calculateKpi` | RFQ Header 기준 KPI 계산 |
| `_prepareChartRows` | Chart 데이터 구성 |
| `_setSelectedMq` | SelectedMq 갱신 |
| `_clearSelectionBelowRfq` | RFQ 변경 시 하위 선택 초기화 |
| `_clearSelectionBelowItem` | RFQ Item 변경 시 MQ 선택 초기화 |
| `_addMessage` | MessagePopover 메시지 추가 |
| `_clearMessages` | 메시지 초기화 |
| `_showBackendError` | Gateway Error 파싱 |
| `_setBusy` | Busy 상태 제어 |

---

## 19. OData 호출 설계

### 19-1. RFQ Header 조회

```javascript
oModel.read("/RFQHeaderSet", {
  filters: aFilters,
  success: function (oData) {
    var aRows = oData.results || [];
    oWorkModel.setProperty("/RfqHeaders", aRows);
    this._calculateKpi(aRows);
  }.bind(this),
  error: function (oError) {
    this._showBackendError(oError);
  }.bind(this)
});
```

### 19-2. RFQ Item 조회

```javascript
oModel.read("/RFQItemSet", {
  filters: [
    new Filter("RfqNo", FilterOperator.EQ, sRfqNo)
  ],
  success: function (oData) {
    oWorkModel.setProperty("/RfqItems", oData.results || []);
  }.bind(this),
  error: function (oError) {
    this._showBackendError(oError);
  }.bind(this)
});
```

### 19-3. MQ 비교 조회

```javascript
oModel.read("/MQCompareSet", {
  filters: [
    new Filter("RfqNo", FilterOperator.EQ, sRfqNo),
    new Filter("RfqItem", FilterOperator.EQ, sRfqItem)
  ],
  success: function (oData) {
    var aRows = oData.results || [];

    aRows.forEach(function (oRow) {
      oRow.UiSelected = oRow.CurrentAwardYn === "X";
    });

    oWorkModel.setProperty("/MqCompareRows", aRows);
    this._prepareChartRows(aRows);
  }.bind(this),
  error: function (oError) {
    this._showBackendError(oError);
  }.bind(this)
});
```

### 19-4. MQ 상세 조회

```javascript
var sPath = "/MQDetailSet(MqNo='" + encodeURIComponent(sMqNo) +
  "',MqItem='" + encodeURIComponent(sMqItem) + "')";

oModel.read(sPath, {
  success: function (oData) {
    oDetailModel.setProperty("/MqDetail", oData);
    this._openMqDetailDialog();
  }.bind(this),
  error: function (oError) {
    this._showBackendError(oError);
  }.bind(this)
});
```

### 19-5. 채택/취소 MERGE

```javascript
_updateQuotationItem: function (sMqNo, sMqItem, sActionType) {
  var oModel = this.getView().getModel();
  var sPath = "/QuotationItemSet(MqNo='" + encodeURIComponent(sMqNo) +
    "',MqItem='" + encodeURIComponent(sMqItem) + "')";

  var oPayload = {
    MqNo: sMqNo,
    MqItem: sMqItem,
    ActionType: sActionType
  };

  this._setBusy(true);

  oModel.update(sPath, oPayload, {
    merge: true,
    success: function () {
      this._setBusy(false);
      this._refreshAfterAward();
    }.bind(this),
    error: function (oError) {
      this._setBusy(false);
      this._showBackendError(oError);
    }.bind(this)
  });
}
```

---

## 20. 채택/취소 업무 규칙

### 20-1. 단일 채택 정책

하나의 RFQ Item에는 MQ 1건만 채택될 수 있다.

| 계층 | 처리 |
| --- | --- |
| UI | RadioButton으로 1건만 선택 |
| workModel | `SelectedMq` 1건만 유지 |
| 저장 | `QuotationItemSet` 단건 MERGE |
| Backend | 같은 RFQ Item 기존 `SELIDC` 해제 후 신규 MQ만 `X` |

### 20-2. AWARD

```text
선택 MQ 확인
→ Frontend 유효성 검사
→ MessageBox.confirm
→ QuotationItemSet MERGE ActionType = AWARD
→ 성공 시 Header/Item/MQ 재조회
```

### 20-3. CANCEL

```text
현재 채택 MQ 확인
→ PO 생성 여부 확인
→ MessageBox.confirm
→ QuotationItemSet MERGE ActionType = CANCEL
→ 성공 시 Header/Item/MQ 재조회
```

---

## 21. 파일 구조 설계

V2.0 개발 후 목표 구조:

```text
webapp/
├─ Component.js
├─ manifest.json
├─ index.html
├─ view/
│  ├─ App.view.xml
│  └─ Main.view.xml
├─ controller/
│  ├─ App.controller.js
│  └─ Main.controller.js
├─ fragment/
│  └─ MQDetailDialog.fragment.xml
├─ model/
│  ├─ models.js
│  └─ formatter.js
├─ css/
│  └─ style.css
├─ i18n/
│  └─ i18n.properties
└─ localService/
   └─ mainService/
      └─ metadata.xml
```

CSS 파일은 유지하되, 다음 목적에만 제한적으로 사용한다.

| 허용 | 설명 |
| --- | --- |
| 최소 간격 보정 | UI5 표준 class만으로 부족한 경우 |
| 테이블 높이 보정 | 화면 깨짐 방지 목적 |
| 숨김/표시 보정 | 컨트롤 속성으로 해결 불가한 경우 |

다음 목적의 CSS는 사용하지 않는다.

| 지양 | 이유 |
| --- | --- |
| 색상 직접 지정 | `ObjectStatus`, `ValueState` 우선 |
| 카드 디자인 직접 구현 | `GenericTile`, `Panel`, `Toolbar` 우선 |
| 버튼 스타일 직접 변경 | `Button type` 우선 |
| 복잡한 레이아웃 강제 | UI5 Layout 컨트롤 우선 |

---

## 22. manifest.json 반영 사항

필요 UI5 Library:

| Library | 사용 |
| --- | --- |
| `sap.m` | 기본 컨트롤, Table, Dialog, Button 등 |
| `sap.ui.core` | Core, CustomData |
| `sap.f` | DynamicPage, FlexibleColumnLayout |
| `sap.ui.layout` | SimpleForm/Form |
| `sap.ui.table` | MQ Compare Table |
| `sap.viz` | VizFrame Bar Chart |

V2.0에서는 `manifest.json`의 `sap.ui5/dependencies/libs`에 위 라이브러리를 명시한다.

---

## 23. i18n 설계

화면에 표시되는 텍스트는 가능하면 `i18n.properties`로 관리한다.

주요 Key 예시:

```properties
appTitle=[MM] 견적 비교 및 거래선 채택
title=[MM] 견적 비교 및 거래선 채택

filterBasicTitle=기본조건
filterAdvancedTitle=상세조건
showAdvancedFilter=상세조건
hideAdvancedFilter=상세조건 닫기
reset=초기화
search=조회

kpiNotAwarded=미채택 건수
kpiPartiallyAwarded=부분 채택 건수
kpiAwarded=채택 건수
kpiPoCreated=PO 생성 완료 건수

rfqHeaderListTitle=RFQ 헤더 목록
rfqItemTabTitle=RFQ Item 목록
chartTabTitle=금액 비교 차트
mqCompareTabTitle=MQ 비교 목록

autoRecommend=자동추천 적용
saveAward=채택
cancelAward=채택취소
mqDetail=MQ 상세
close=닫기
selectThisMq=이 MQ 선택
```

---

## 24. 테스트 시나리오

### 24-1. 화면 테스트

| No | 테스트 | 기대 결과 |
| --- | --- | --- |
| 1 | 앱 실행 | DynamicPage Header와 FCL 화면 표시 |
| 2 | 상세조건 버튼 클릭 | 상세조건 표시/숨김 |
| 3 | 조회조건 초기화 | 모든 필터 초기화 |
| 4 | 조회 실행 | RFQ Header Table 표시 |
| 5 | KPI 확인 | 상태별 건수 표시 |
| 6 | RFQ 선택 | RFQ Item 목록 표시 |
| 7 | RFQ Item 선택 | MQ 비교 데이터 조회 |
| 8 | IconTabBar 전환 | 각 탭 내용 정상 표시 |
| 9 | MQ Radio 선택 | 1건만 선택 |
| 10 | MQ 상세 열기 | Dialog 표시 |

### 24-2. 유효성 테스트

| No | 테스트 | 기대 결과 |
| --- | --- | --- |
| 1 | 문서일자 From > To | MessagePopover 표시 |
| 2 | 납기일 From > To | MessagePopover 표시 |
| 3 | MQ 미선택 후 채택 | 선택 필요 메시지 |
| 4 | 선택 불가 MQ 채택 시도 | Radio 비활성 또는 오류 메시지 |
| 5 | PO 생성 MQ 취소 시도 | Backend 오류 표시 |

### 24-3. OData 테스트

| No | 테스트 | 기대 결과 |
| --- | --- | --- |
| 1 | RFQHeaderSet 조회 | Header 목록 반환 |
| 2 | RFQItemSet 조회 | 선택 RFQ Item 반환 |
| 3 | MQCompareSet 조회 | MQ 후보 반환 |
| 4 | MQDetailSet 조회 | 상세 Dialog 데이터 반환 |
| 5 | QuotationItemSet AWARD | HTTP 204, `SELIDC = X` |
| 6 | QuotationItemSet CANCEL | HTTP 204, `SELIDC = space` |
| 7 | 저장 후 재조회 | Header/Item/MQ 상태 반영 |

### 24-4. 테스트 환경

| 환경 | 목적 |
| --- | --- |
| Mock Server | 화면 구조와 기본 바인딩 검증 |
| 실제 Gateway | RFQ/MQ 조회, 채택/취소 동작 검증 |

---

## 25. V2.0 제외 범위

V1.2.1 제외 범위를 유지한다.

| 기능 | 처리 |
| --- | --- |
| PO 생성 | V2 이후 |
| PO Preview | V2 이후 |
| 채택 이력 저장 | V2 이후 |
| Batch 다건 저장 | V2 이후 |
| Variant 저장 | V2 이후 |
| 가격조건 상세 탭 | V2 이후 |
| 채택 사유 입력 | V2 이후 |
| 공급업체 평가 점수 | V2 이후 |
| Lock Object 동시성 제어 | V2 이후 또는 리팩토링 후보 |

---

## 26. 개발 순서

V2.0 설계 기준 개발 순서는 다음과 같다.

```text
Step 1. manifest.json 라이브러리 확인/추가
Step 2. formatter.js 생성
Step 3. MQDetailDialog.fragment.xml 생성
Step 4. Main.view.xml 전체 Layout 구현
Step 5. filterModel/viewModel/workModel/messageModel/detailModel 초기화
Step 6. Header Filter 및 유효성 검사 구현
Step 7. Search Help 공통 TableSelectDialog 구현
Step 8. RFQ Header 조회 및 KPI 계산 구현
Step 9. RFQ Item 조회 구현
Step 10. MQCompareSet 조회 및 Radio 선택 구현
Step 11. Chart 데이터 구성 및 VizFrame 구현
Step 12. MQ 상세 Dialog 구현
Step 13. AWARD/CANCEL MERGE 구현
Step 14. 저장 후 재조회 구현
Step 15. Mock 테스트
Step 16. 실제 Gateway 테스트
```

---

## 27. 최종 요약 표

| 구분 | V2.0 확정 내용 |
| --- | --- |
| 전체 화면 | `sap.f.DynamicPage` |
| 화면 분할 | `sap.f.FlexibleColumnLayout` |
| Begin Column | KPI + RFQ Header Table |
| Mid Column | 선택 RFQ 요약 + `sap.m.IconTabBar` |
| 탭 1 | RFQ Item 목록 |
| 탭 2 | 금액 비교 차트 |
| 탭 3 | MQ 비교 목록 |
| RFQ Header Table | `sap.m.Table` + Pop-in |
| RFQ Item Table | `sap.m.Table` |
| MQ Compare Table | `sap.ui.table.Table` |
| MQ 선택 | `sap.m.RadioButton` |
| KPI | `sap.m.GenericTile` + `sap.m.NumericContent` |
| 상태 표시 | `sap.m.ObjectStatus` |
| 금액 표시 | `sap.m.ObjectNumber` |
| 차트 | `sap.viz.ui5.controls.VizFrame` |
| 상세 팝업 | `sap.m.Dialog` |
| Search Help | `sap.m.TableSelectDialog` |
| 메시지 | `sap.m.MessagePopover` + `ValueState` |
| 저장 방식 | `QuotationItemSet` 단건 MERGE |
| 채택 | `ActionType = AWARD` |
| 취소 | `ActionType = CANCEL` |
| 저장 후 처리 | Header/Item/MQ 재조회 |
| CSS 정책 | UI5 표준 우선, 최소 보정만 허용 |
| 테스트 | Mock + 실제 Gateway |
