# 견적 비교 및 거래선 채택 Fiori App 설계서 V2.1.0

## 0. 문서 목적

본 문서는 `[MM] 견적 비교 및 거래선 채택` SAPUI5 Freestyle App 개발을 위한 V2.1.0 설계서다.

V2.0 설계서는 화면 Layout과 UI5 컨트롤 구성을 확정한 문서이며, V2.1.0은 SAP GUI에서 구현된 Backend DPC Extension Class `ZCL_ZGWD3MM0005_DPC_EXT` 분석 결과를 반영한 개발 기준 문서다.

V2.1.0의 핵심 변경점은 다음이다.

| 구분 | V2.1.0 반영 내용 |
| --- | --- |
| Backend 기준 | `ZCL_ZGWD3MM0005_DPC_EXT` 실제 로직 기준으로 UI5 호출 방식 보정 |
| 날짜 필터 | UI 내부 From/To 값을 OData `DocDate`, `Eindt`의 `GE`, `LE` Filter로 변환 |
| 상태 필터 | `AwardStatus` 다중 선택은 OR Filter로 구성 |
| Search Help | 이번 구현 범위에서 제외. 추후 CDS View 생성 후 연결 |
| 선택 가능 여부 | UI5에서 재계산하지 않고 Backend `CanSelect`, `BlockReason` 사용 |
| 추천 여부 | UI5에서 재계산하지 않고 Backend `RecommendYn` 사용 |
| 채택취소 | `RFQItemSet-CanCancelAward`를 우선 기준으로 버튼 활성화 |
| 성공 메시지 | Update 성공 callback 기준으로 UI5 고정 메시지 표시 |
| 오류 메시지 | Gateway Business Exception의 `responseText` 파싱 |
| 상태 State | Backend가 내려주는 `None`, `Warning`, `Success`, `Error` 그대로 사용 |

---

## 1. 기준 문서 및 참고자료

| 문서/자료 | 용도 |
| --- | --- |
| `AGENT.md` | SAP 개발 학습, 답변, 코드 작성 원칙 |
| `Business.md` | 삼만리 모빌리티 프로젝트 업무 배경 |
| `견적 비교 및 거래선 채택 Fiori 프로그램 설계서_V1.2.1.md` | 최초 업무/OData 설계 기준 |
| `견적 비교 및 거래선 채택 Fiori 프로그램 설계서_V2.0.md` | 화면 Layout 및 UI5 컨트롤 기준 |
| `ZCL_ZGWD3MM0005_DPC_EXT` | 실제 Backend 처리 로직 기준 |
| `D:\sapcodeproject_usb\ui5\delayed_po_monitor` | 기존 MM Fiori 구현 스타일 참고 |
| SAPUI5 Demo Kit 1.120.44 | UI5 Control API/Sample 기준 |
| SAP Fiori Design Guidelines v1.120 | 화면 패턴 기준 |

---

## 2. 프로그램 개요

| 항목 | 내용 |
| --- | --- |
| 앱명 | `[MM] 견적 비교 및 거래선 채택` |
| UI5 프로젝트명 | `quote_comparison` |
| 개발 방식 | Freestyle SAPUI5 + SAP Gateway OData V2 |
| 대상 모듈 | MM |
| Backend OData Service | `ZGWD3MM0005_SRV` |
| Service Root | `/sap/opu/odata/SAP/ZGWD3MM0005_SRV/` |
| DPC Extension Class | `ZCL_ZGWD3MM0005_DPC_EXT` |
| 핵심 변경 테이블 | `ZTD3MM0017` |
| 핵심 변경 필드 | `ZTD3MM0017-SELIDC` |
| V2.1.0 목표 | Backend 실제 로직에 맞는 UI5 화면/호출/검증 설계 확정 |

업무 흐름:

```text
RFQ Header 조회
→ RFQ Header 선택
→ RFQ Item 조회
→ RFQ Item 선택
→ MQ 후보 비교 조회
→ 추천/현재채택/선택가능 상태 확인
→ MQ 1건 선택
→ 채택 또는 채택취소
→ Backend MERGE 처리
→ Header/Item/MQ 재조회
```

---

## 3. Backend Class 분석 반영 요약

### 3-1. 구현된 EntitySet

| EntitySet | Backend Method | UI5 용도 |
| --- | --- | --- |
| `RFQHeaderSet` | `RFQHEADERSET_GET_ENTITYSET` | RFQ Header 목록, KPI 기준 |
| `RFQItemSet` | `RFQITEMSET_GET_ENTITYSET` | 선택 RFQ의 Item 목록 |
| `MQCompareSet` | `MQCOMPARESETSET_GET_ENTITYSET` | 선택 RFQ Item의 MQ 후보 비교 |
| `MQDetailSet` | `MQDETAILSET_GET_ENTITY` | MQ 상세 Dialog |
| `QuotationItemSet` | `QUOTATIONITEMSET_GET_ENTITY`, `QUOTATIONITEMSET_UPDATE_ENTITY` | 채택/채택취소 |

### 3-2. Backend가 계산해서 내려주는 값

UI5는 아래 값을 다시 계산하지 않고 Backend 결과를 신뢰한다.

| 계산값 | EntitySet | UI5 사용 |
| --- | --- | --- |
| Header 채택상태 | `RFQHeaderSet` | `AwardStatus`, `AwardStatusText`, `AwardStatusState` 표시 |
| Item 채택상태 | `RFQItemSet` | `ItemStatusText`, `ItemStatusState` 표시 |
| 채택취소 가능 여부 | `RFQItemSet` | `CanCancelAward`로 버튼 활성화 |
| 미응답 여부 | `MQCompareSet`, `MQDetailSet` | `ResponseStatusText` 표시 |
| 현재 채택 여부 | `MQCompareSet`, `MQDetailSet` | `CurrentAwardYn` 표시 |
| 자동 추천 여부 | `MQCompareSet`, `MQDetailSet` | `RecommendYn` 표시 |
| PO 생성 여부 | `MQCompareSet`, `MQDetailSet`, `RFQItemSet` | 선택/취소 차단 표시 |
| 선택 가능 여부 | `MQCompareSet`, `MQDetailSet` | `CanSelect`, `BlockReason` 사용 |
| KRW 환산금액 | `MQCompareSet`, `MQDetailSet` | Chart/Table 금액 표시 |

---

## 4. 전체 화면 Layout

V2.0에서 확정한 화면 구조를 유지한다.

```text
sap.f.DynamicPage
├─ DynamicPageTitle
├─ DynamicPageHeader
│  └─ 조회조건 영역
└─ DynamicPageContent
   └─ sap.f.FlexibleColumnLayout
      ├─ Begin Column
      │  ├─ KPI Summary
      │  └─ RFQ Header Table
      └─ Mid Column
         ├─ 선택 RFQ 요약 Header
         ├─ sap.m.IconTabBar
         │  ├─ RFQ Item 목록
         │  ├─ 금액 비교 차트
         │  └─ MQ 비교 목록
         └─ Action Toolbar
```

| 영역 | Control |
| --- | --- |
| 전체 페이지 | `sap.f.DynamicPage` |
| 좌우 분할 | `sap.f.FlexibleColumnLayout` |
| Mid Column 탭 | `sap.m.IconTabBar` |
| RFQ Header 목록 | `sap.m.Table` |
| RFQ Item 목록 | `sap.m.Table` |
| MQ 비교 목록 | `sap.ui.table.Table` |
| KPI | `sap.m.GenericTile`, `sap.m.NumericContent` |
| Chart | `sap.viz.ui5.controls.VizFrame` |
| 상세 팝업 | `sap.m.Dialog` |

---

## 5. Search Help 정책

### 5-1. V2.1.0 확정

이번 구현에서는 Search Help를 구현하지 않는다.

| 항목 | 결정 |
| --- | --- |
| Search Help UI 구조 | V2.0 설계에는 남겨두되 V2.1.0 구현 범위 제외 |
| 실제 구현 시점 | 추후 CDS View 생성 후 연결 |
| 참고 방식 | 이전 `delayed_po_monitor`처럼 `sap.m.TableSelectDialog` 사용 |
| 현재 입력 방식 | 직접 입력 |

### 5-2. V2.1.0 화면 반영

V2.1.0에서는 코드 필드에 `showValueHelp="true"`를 바로 넣지 않는다.

이유:

```text
현재 DPC_EXT Class에는 공급업체/자재/플랜트/회사/구매조직/구매그룹 전용
Search Help EntitySet이 없다.

따라서 UI만 먼저 열어두면 사용자에게 동작하지 않는 F4 Help처럼 보일 수 있다.
이번 버전에서는 직접 입력으로 개발하고, CDS View가 준비되면 TableSelectDialog를 연결한다.
```

### 5-3. 추후 구현 예정 Help Type

| Help Type | 대상 필드 | 추후 데이터 소스 |
| --- | --- | --- |
| `RFQ` | RFQ 번호 | CDS View 또는 RFQ Header Help Service |
| `VENDOR` | 공급업체코드 | 공급업체 CDS View |
| `MATERIAL` | 자재코드 | 자재 CDS View |
| `PLANT` | 플랜트코드 | 플랜트 CDS View |
| `COMPANY` | 회사코드 | 회사코드 CDS View |
| `PURORG` | 구매조직 | 구매조직 CDS View |
| `PURGRP` | 구매그룹 | 구매그룹 CDS View |
| `MQ` | MM견적(MQ)번호 | MQ Header/Item Help CDS View |

---

## 6. 조회조건 설계

### 6-1. UI 내부 Model

UI 내부 `filterModel`은 사용자가 이해하기 쉬운 From/To 구조를 유지한다.

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

### 6-2. OData Filter 변환 기준

Backend `GET_FILTER_VALUES`는 `DocDateFrom`, `DocDateTo`, `EindtFrom`, `EindtTo`라는 Property를 받지 않는다.

따라서 UI5 호출 시 아래처럼 변환한다.

| UI 내부 값 | OData Property | Operator |
| --- | --- | --- |
| `DocDateFrom` | `DocDate` | `GE` |
| `DocDateTo` | `DocDate` | `LE` |
| `EindtFrom` | `Eindt` | `GE` |
| `EindtTo` | `Eindt` | `LE` |

예시:

```javascript
if (oFilter.DocDateFrom) {
  aFilters.push(new Filter("DocDate", FilterOperator.GE, oFilter.DocDateFrom));
}

if (oFilter.DocDateTo) {
  aFilters.push(new Filter("DocDate", FilterOperator.LE, oFilter.DocDateTo));
}

if (oFilter.EindtFrom) {
  aFilters.push(new Filter("Eindt", FilterOperator.GE, oFilter.EindtFrom));
}

if (oFilter.EindtTo) {
  aFilters.push(new Filter("Eindt", FilterOperator.LE, oFilter.EindtTo));
}
```

### 6-3. 채택상태 MultiComboBox Filter

Backend는 `AwardStatus`를 Range로 받을 수 있게 구현되어 있다.

UI5에서는 MultiComboBox 선택값을 OR Filter로 만든다.

```javascript
var aStatusFilters = aAwardStatusKeys.map(function (sKey) {
  return new Filter("AwardStatus", FilterOperator.EQ, sKey);
});

if (aStatusFilters.length > 0) {
  aFilters.push(new Filter({
    filters: aStatusFilters,
    and: false
  }));
}
```

| 상태 코드 | 텍스트 |
| --- | --- |
| `N` | 미채택 |
| `P` | 일부채택 |
| `A` | 채택 |
| `PO` | PO생성 |

주의:

```text
AwardStatus는 DB 원천 필드가 아니라 Backend 계산 필드다.
Backend는 Header 조회 후 상태를 계산한 뒤 AwardStatus Range로 후처리한다.
UI5는 이 점을 고려해서 Header 조회 결과가 늦게 올 수 있음을 Busy 상태로 표시한다.
```

---

## 7. Backend Filter Property 매핑

UI5에서 반드시 아래 Property 이름을 사용한다.

| 화면 필드 | UI 내부 Model | OData Filter Property | Backend 필드 |
| --- | --- | --- | --- |
| RFQ 번호 | `RfqNo` | `RfqNo` | `es_filter-rfq_no` |
| RFQ Item | `RfqItem` | `RfqItem` | `es_filter-rfq_item` |
| 문서일자 From | `DocDateFrom` | `DocDate GE` | `es_filter-doc_from` |
| 문서일자 To | `DocDateTo` | `DocDate LE` | `es_filter-doc_to` |
| 채택상태 | `AwardStatus` | `AwardStatus` | `et_award_status_range` |
| 공급업체코드 | `Lifnr` | `Lifnr` | `es_filter-lifnr` |
| 공급업체명 | `Name1` | `Name1` | `es_filter-name1` |
| 자재코드 | `Matnr` | `Matnr` | `es_filter-matnr` |
| 자재명 | `Maktx` | `Maktx` | `es_filter-maktx` |
| 플랜트코드 | `Werks` | `Werks` | `es_filter-werks` |
| 납기일 From | `EindtFrom` | `Eindt GE` | `es_filter-eindt_from` |
| 납기일 To | `EindtTo` | `Eindt LE` | `es_filter-eindt_to` |
| MQ 번호 | `MqNo` | `MqNo` | `es_filter-mq_no` |
| MQ Item | `MqItem` | `MqItem` | `es_filter-mq_item` |
| 회사코드 | `Bukrs` | `Bukrs` | `es_filter-bukrs` |
| 구매조직 | `Ekorg` | `Ekorg` | `es_filter-ekorg` |
| 구매그룹 | `Ekgrp` | `Ekgrp` | `es_filter-ekgrp` |

---

## 8. RFQ Header 조회 설계

### 8-1. 호출

```text
GET /RFQHeaderSet
```

적용 Filter:

```text
RfqNo
DocDate GE/LE
AwardStatus OR
Lifnr
Name1
Matnr
Maktx
Werks
Eindt GE/LE
MqNo
Bukrs
Ekorg
Ekgrp
```

### 8-2. UI 표시 필드

| 컬럼 | Backend Field | Control |
| --- | --- | --- |
| RFQ 번호 | `RfqNo` | `ObjectIdentifier` |
| 문서일자 | `DocDate` | `Text` |
| 통화 | `Waers` | `Text` |
| 구매조직 | `Ekorg` | `Text` |
| 공급업체 수 | `VendorCount` | `ObjectNumber` |
| RFQ Item 수 | `RfqItemCount` | `ObjectNumber` |
| MQ 수 | `MqCount` | `ObjectNumber` |
| 채택상태 | `AwardStatusText`, `AwardStatusState` | `ObjectStatus` |

### 8-3. KPI 계산

KPI는 Frontend에서 조회된 Header 결과를 기준으로 계산한다.

| KPI | 기준 |
| --- | --- |
| 미채택 | `AwardStatus = 'N'` |
| 일부채택 | `AwardStatus = 'P'` |
| 채택 | `AwardStatus = 'A'` |
| PO생성 | `AwardStatus = 'PO'` |

---

## 9. RFQ Item 조회 설계

### 9-1. 호출

```text
GET /RFQItemSet?$filter=RfqNo eq '<선택 RFQ>'
```

### 9-2. UI 표시 필드

| 컬럼 | Backend Field | Control |
| --- | --- | --- |
| RFQ Item | `RfqItem` | `Text` |
| 자재코드 | `Matnr` | `ObjectIdentifier` |
| 자재명 | `Maktx` | `Text` |
| 요청수량 | `ReqQty` | `ObjectNumber` |
| 단위 | `Meins` | `Text` |
| 납기일 | `Eindt` | `Text` |
| 유효 MQ 수 | `ValidMqCount` | `ObjectNumber` |
| 미응답 MQ 수 | `NoResponseMqCount` | `ObjectNumber` |
| 현재 채택 공급업체 | `AwardName1` | `Text` |
| 상태 | `ItemStatusText`, `ItemStatusState` | `ObjectStatus` |

### 9-3. 채택취소 활성 조건

채택취소 버튼은 선택 RFQ Item의 `CanCancelAward`를 우선 기준으로 한다.

```text
CanCancelAward = 'X' → 채택취소 버튼 활성
그 외 → 채택취소 버튼 비활성
```

UI5에서 PO 생성 여부나 채택 여부를 별도로 재계산하지 않는다.

---

## 10. MQ 비교 조회 설계

### 10-1. 호출

```text
GET /MQCompareSet?$filter=RfqNo eq '<선택 RFQ>' and RfqItem eq '<선택 RFQ Item>'
```

### 10-2. Backend 계산값 사용

| 기능 | Backend Field | UI5 처리 |
| --- | --- | --- |
| Radio 활성화 | `CanSelect` | `CanSelect === 'X'`일 때만 enabled |
| 선택불가 사유 | `BlockReason` | 컬럼/Tooltip/MessageStrip에 표시 |
| 현재 채택 | `CurrentAwardYn` | ObjectStatus 표시 |
| 자동 추천 | `RecommendYn` | ObjectStatus 표시, 자동추천 버튼 기준 |
| 응답 상태 | `ResponseStatusText` | ObjectStatus 표시 |
| PO 생성 | `PoCreatedYn` | ObjectStatus 표시 |
| 환산금액 | `NetwrKrw` | Table/Chart 표시 |
| 환율 기준일 | `ExchangeDate` | 상세 정보 표시 |

### 10-3. RadioButton 정책

```xml
<RadioButton
  selected="{work>UiSelected}"
  enabled="{= ${work>CanSelect} === 'X' }"
  select=".onMqRadioSelect"/>
```

처리 규칙:

```text
1. 사용자가 RadioButton 선택
2. 같은 MqCompareRows 내 모든 UiSelected 초기화
3. 선택 Row만 UiSelected = true
4. workModel>/SelectedMq 갱신
5. viewModel>/CanSaveAward 갱신
```

### 10-4. 자동추천 적용

자동추천 버튼은 `RecommendYn = 'X'`이고 `CanSelect = 'X'`인 Row를 선택한다.

```text
추천 MQ가 있어도 CanSelect가 X가 아니면 선택하지 않는다.
```

UI5는 `NetwrKrw`, `Eindt` 기준 추천 로직을 다시 계산하지 않는다.

### 10-5. Chart 데이터

Chart는 Backend 환산 결과를 사용한다.

| 기준 | 처리 |
| --- | --- |
| `NetwrKrw > 0` | Chart 표시 대상 |
| `ResponseStatus = 'N'` | Chart에서 제외 |
| `RecommendYn = 'X'` | 보조 표시 또는 Tooltip |
| `CurrentAwardYn = 'X'` | 보조 표시 또는 Tooltip |

---

## 11. MQ 상세 Dialog 설계

### 11-1. 호출

```text
GET /MQDetailSet(MqNo='<MQ 번호>',MqItem='<MQ 품목>')
```

### 11-2. Dialog 구성

V2.0의 4섹션 구조를 유지한다.

| 섹션 | 주요 필드 |
| --- | --- |
| 기본정보 | RFQ/MQ 번호, 공급업체, 자재, 플랜트, 저장위치 |
| 견적정보 | 수량, 단가, 원통화 금액, 환율, KRW 환산금액, 납기일 |
| 참조정보 | 회사코드, 구매조직, 구매그룹, PR, 지급조건, 헤더 텍스트 |
| 상태정보 | 응답상태, 현재채택, 자동추천, 선택가능, PO 생성 여부 |

### 11-3. Dialog의 `이 MQ 선택` 버튼

`MQDetailSet`도 `CanSelect`, `BlockReason`을 내려준다.

```text
CanSelect = 'X' → 이 MQ 선택 버튼 활성
그 외 → 비활성
```

Dialog에서 선택 시:

```text
1. 현재 Detail의 MqNo/MqItem을 MqCompareRows에서 찾음
2. 해당 Row가 CanSelect = 'X'인지 재확인
3. _setSelectedMq 실행
4. Dialog 닫기
```

---

## 12. 채택/채택취소 설계

### 12-1. 호출 URL

```text
MERGE /QuotationItemSet(MqNo='<MQ 번호>',MqItem='<MQ 품목>')
```

### 12-2. 채택 Payload

```json
{
  "MqNo": "MQ70000002",
  "MqItem": "00010",
  "ActionType": "AWARD"
}
```

### 12-3. 채택취소 Payload

```json
{
  "MqNo": "MQ70000002",
  "MqItem": "00010",
  "ActionType": "CANCEL"
}
```

### 12-4. UI5 Update 호출

```javascript
oModel.update(sPath, oPayload, {
  merge: true,
  success: function () {
    MessageToast.show(sSuccessMessage);
    this._refreshAfterAward();
  }.bind(this),
  error: function (oError) {
    this._showBackendError(oError);
  }.bind(this)
});
```

### 12-5. 성공 메시지 정책

Backend는 `er_entity-message_text`를 세팅하지만, Gateway MERGE 성공 시 `204 No Content`가 올 수 있다.

따라서 UI5는 성공 Body에 의존하지 않는다.

| ActionType | UI5 성공 메시지 |
| --- | --- |
| `AWARD` | 견적이 채택되었습니다. |
| `CANCEL` | 견적 채택이 취소되었습니다. |

### 12-6. 저장 후 재조회

저장 성공 후 아래 데이터를 모두 재조회한다.

| 재조회 대상 | 이유 |
| --- | --- |
| `RFQHeaderSet` | Header 상태/KPI 갱신 |
| `RFQItemSet` | Item 상태/채택 공급업체/취소 가능 여부 갱신 |
| `MQCompareSet` | 현재채택/선택가능/BlockReason 갱신 |

---

## 13. Backend 오류 처리 설계

### 13-1. Backend 오류 방식

Backend는 업무 오류를 `/IWBEP/CX_MGW_BUSI_EXCEPTION`으로 발생시킨다.

대표 메시지:

| 상황 | Backend 메시지 |
| --- | --- |
| MQ Key 없음 | MQ 번호 또는 MQ 품목번호가 없습니다. |
| Body 없음 | 요청 본문 데이터가 없습니다. |
| ActionType 오류 | 처리유형은 AWARD 또는 CANCEL만 허용됩니다. |
| URI/Body 불일치 | URI의 MQ 번호와 본문의 MQ 번호가 다릅니다. |
| MQ 없음 | 존재하지 않거나 삭제된 MQ 견적입니다. |
| 원본 RFQ 없음 | 원본 RFQ 정보가 없는 MQ는 처리할 수 없습니다. |
| PO 생성 | 이미 PO가 생성되어 채택 정보를 변경할 수 없습니다. |
| 미응답 MQ | 미응답 MQ는 채택할 수 없습니다. |
| 이미 채택 | 이미 채택된 견적입니다. |
| 취소 불가 | 채택된 견적만 채택취소할 수 있습니다. |

### 13-2. UI5 오류 파싱

`_showBackendError`는 `oError.responseText`를 우선 파싱한다.

처리 순서:

```text
1. oError.responseText 존재 여부 확인
2. JSON.parse 시도
3. error.message.value 확인
4. innererror.errordetails 배열 확인
5. 실패 시 기본 오류 메시지 표시
6. MessagePopover 또는 MessageBox.error로 표시
```

권장 기본 메시지:

```text
처리 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.
```

---

## 14. 상태 표시 정책

Backend `get_ui_state`는 다음 값을 반환한다.

| 상태 코드 | 텍스트 | UI5 State |
| --- | --- | --- |
| `N` | 미채택 | `None` |
| `P` | 일부채택 | `Warning` |
| `A` | 채택 | `Success` |
| `PO` | PO생성 | `Success` |

주의:

```text
Backend STATUS_STATE 계열 필드는 CHAR10이다.
따라서 길이가 11인 Information은 사용하지 않는다.
UI5도 PO 상태를 임의로 Information으로 바꾸지 않고 Backend 값을 그대로 사용한다.
```

---

## 15. Frontend Model 보정

### 15-1. viewModel

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

### 15-2. workModel

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

---

## 16. 주요 Handler 보정

| Handler | V2.1.0 기준 |
| --- | --- |
| `onSearch` | Search Help 미구현 상태에서 직접 입력값 기준 RFQHeaderSet 조회 |
| `_buildHeaderFilters` | From/To를 `DocDate`, `Eindt` GE/LE로 변환 |
| `_buildAwardStatusFilters` | MultiComboBox 선택값을 OR Filter로 변환 |
| `onRfqSelectionChange` | RFQ Item 조회 후 `items` 탭 활성화 |
| `onRfqItemSelectionChange` | MQCompareSet 조회 후 ChartRows 구성 |
| `onMqRadioSelect` | `CanSelect = 'X'` Row만 선택 |
| `onAutoRecommend` | `RecommendYn = 'X'` 및 `CanSelect = 'X'` Row 선택 |
| `onSaveAward` | 성공 Body에 의존하지 않고 success callback에서 메시지 표시 |
| `onCancelCurrentItemAward` | `CanCancelAward = 'X'` 기준 |
| `_showBackendError` | Business Exception responseText 파싱 |

---

## 17. V2.1.0 구현 범위

### 17-1. 포함

| 기능 | 포함 여부 |
| --- | --- |
| DynamicPage + FCL Layout | O |
| 기본/상세 조회조건 | O |
| 직접 입력 기반 조회 | O |
| 채택상태 MultiComboBox | O |
| RFQ Header 목록 | O |
| KPI 계산 | O |
| RFQ Item 목록 | O |
| MQ 비교 목록 | O |
| 금액 비교 Chart | O |
| MQ 상세 Dialog | O |
| RadioButton 단일 선택 | O |
| 자동추천 적용 | O |
| 채택/채택취소 MERGE | O |
| Backend Error 파싱 | O |

### 17-2. 제외

| 기능 | 제외 이유 |
| --- | --- |
| Search Help 구현 | CDS View 생성 후 연결 예정 |
| PO 생성 | 후속 개발 범위 |
| Batch 다건 저장 | 후속 개발 범위 |
| Variant 저장 | 후속 개발 범위 |
| 채택 이력 저장 | 후속 개발 범위 |
| 채택 사유 입력 | 후속 개발 범위 |
| 공급업체 평가 점수 | 후속 개발 범위 |

---

## 18. 개발 순서

```text
Step 1. manifest.json 라이브러리 확인/추가
Step 2. formatter.js 생성
Step 3. MQDetailDialog.fragment.xml 생성
Step 4. Main.view.xml Layout 구현
Step 5. filterModel/viewModel/workModel/messageModel/detailModel 초기화
Step 6. Header Filter UI 구현
Step 7. 날짜/상태 OData Filter 변환 구현
Step 8. RFQHeaderSet 조회 및 KPI 계산 구현
Step 9. RFQItemSet 조회 구현
Step 10. MQCompareSet 조회 구현
Step 11. RadioButton 단일 선택 구현
Step 12. 자동추천 적용 구현
Step 13. VizFrame Chart 구현
Step 14. MQDetailSet Dialog 구현
Step 15. QuotationItemSet AWARD/CANCEL 구현
Step 16. Backend Business Exception 파싱 구현
Step 17. 저장 후 Header/Item/MQ 재조회 구현
Step 18. Mock 테스트
Step 19. 실제 Gateway 테스트
```

---

## 19. 테스트 시나리오

| No | 테스트 | 기대 결과 |
| --- | --- | --- |
| 1 | 조회조건 없이 조회 | RFQ Header 목록 표시 |
| 2 | 문서일자 From/To 조회 | `DocDate` GE/LE Filter로 호출 |
| 3 | 납기일 From/To 조회 | `Eindt` GE/LE Filter로 호출 |
| 4 | 채택상태 다중 선택 | `AwardStatus` OR Filter로 호출 |
| 5 | RFQ Header 선택 | RFQ Item 목록 표시 |
| 6 | RFQ Item 선택 | MQ 비교 목록 표시 |
| 7 | 추천 MQ 적용 | `RecommendYn = X` Row 선택 |
| 8 | 선택 불가 MQ | RadioButton 비활성 |
| 9 | MQ 상세 조회 | Dialog 표시 |
| 10 | Dialog에서 선택 | `CanSelect = X`인 경우만 선택 |
| 11 | 채택 저장 | MERGE 성공 후 재조회 |
| 12 | 채택취소 | `CanCancelAward = X`일 때만 가능 |
| 13 | 미응답 MQ 채택 시도 | Backend 오류 표시 |
| 14 | PO 생성 MQ 변경 시도 | Backend 오류 표시 |
| 15 | Search Help 버튼 | 이번 버전에서는 표시하지 않음 |

---

## 20. 최종 요약 표

| 구분 | V2.1.0 확정 내용 |
| --- | --- |
| 화면 구조 | V2.0의 `DynamicPage + FCL + IconTabBar` 유지 |
| Backend 기준 | `ZCL_ZGWD3MM0005_DPC_EXT` 실제 로직 반영 |
| 날짜 Filter | `DocDate`, `Eindt`에 `GE`, `LE` 사용 |
| 상태 Filter | `AwardStatus` OR Filter |
| Search Help | 이번 구현 제외, 추후 CDS View 연결 |
| Header 상태 | Backend `AwardStatusText/State` 사용 |
| Item 상태 | Backend `ItemStatusText/State` 사용 |
| 채택취소 | `CanCancelAward = 'X'` 기준 |
| MQ 선택 | `CanSelect = 'X'` 기준 |
| 자동추천 | `RecommendYn = 'X'` 기준 |
| Chart | Backend `NetwrKrw` 기준 |
| Update 성공 | success callback에서 UI5 메시지 표시 |
| Backend 오류 | Business Exception `responseText` 파싱 |
| 상태 색상 | Backend `None/Warning/Success/Error` 그대로 사용 |
| 구현 범위 | Search Help 제외한 조회/비교/상세/채택/취소 |
