# Codex 개발 인수인계 문서

## 0. 문서 목적

이 문서는 집 노트북의 Codex가 기존 대화 맥락 없이도 **삼만리 모빌리티 MM Fiori 앱 개발을 이어서 진행**할 수 있도록 작성한 개발 인수인계 문서다.

현재까지 Backend/Gateway 개발은 거의 완료되었고, 다음 단계는 **Gateway 통합 테스트 정리 후 SAPUI5 FreeStyle App 개발**이다.

---

## 1. 프로젝트 기본 맥락

| 항목 | 내용 |
|---|---|
| 프로젝트 | SAP CODE 아카데미 팀프로젝트 |
| 대상 기업 | 삼만리 모빌리티 |
| 산업군 | 자전거 제조 기업 |
| 사용 모듈 | SD, MM, PP, FI |
| 사용자 담당 | MM |
| 앱 주제 | 납기 지연 및 미입고 현황 조회 Fiori App |
| 앱 유형 | SAPUI5 FreeStyle App |
| Backend | SAP Gateway OData V2 |
| 기준 프로세스 | PO → GR |
| 기준 단위 | PO Item |

이 앱의 핵심 목적은 다음이다.

```text
기준일 현재 PO로 발주한 자재가 납기일까지 입고되었는가?
입고되지 않았다면 어떤 공급업체, 어떤 자재, 어떤 PO Item이 문제인가?
```

---

## 2. 개발 원칙

Codex는 앞으로 코드를 작성할 때 아래 원칙을 지켜야 한다.

| 항목 | 원칙 |
|---|---|
| ABAP SQL | `SELECT *` 지양, `FIELDS`에 필드명 명시 |
| SELECT 방식 | `SELECT~ENDSELECT` 금지 |
| 성능 | LOOP 안 SELECT 금지 |
| 데이터 전달 | 가능하면 `INTO CORRESPONDING FIELDS OF TABLE` 사용 |
| OData 방식 | DDIC Structure 기반 SEGW + DPC_EXT Redefine |
| CDS/View | OData 직접 노출이 아니라 Gateway 내부 조회 소스로 사용 |
| 계산 로직 | Gateway ABAP에서 수행 |
| UI5 | FreeStyle MVC 구조 사용 |
| Function Import | 사용하지 않음 |
| `$expand` | 이번 앱에서는 사용하지 않음 |

사용자 선호 코드 스타일:

```abap
***   [1. 단계 제목]**
*   - 설명
*   - 설명
```

다만 기존 구현 코드 일부는 아래 스타일도 혼재되어 있다.

```abap
"------------------------------------------------------------------
" [1] 단계 제목
" 설명
"------------------------------------------------------------------
```

새 코드는 가능하면 `*** [1. ...]**` 스타일로 통일하는 것이 좋다.

---

## 3. V4/V4.1 설계 핵심

최초 확정 설계는 V4였고, Gateway 테스트 중 KPI Entity 필터 수신 문제 때문에 **V4.1 보정**이 들어갔다.

### 3.1 V4 핵심

```text
1. OData는 DDIC Structure 기반 SEGW로 생성한다.
2. 내부 조회는 CDS View 2개 + DB View 1개를 사용한다.
3. PO-GR 상태 계산은 Gateway DPC_EXT에서 한다.
4. 메인 테이블과 KPI는 GET_PO_GR_STATUS_DATA 공통 메소드 결과를 사용한다.
5. KPI는 현재 검색조건 기준으로 계산하되 StatusCode 필터는 제외한다.
```

### 3.2 V4.1 보정

문제:

```text
DelayedPoKpiSet?$filter=BaseDate ... 호출 시 400 발생
원인: DelayedPoKpi Entity Type에 BaseDate Property가 없음
```

해결:

`ZSD3MM0008 / DelayedPoKpi`에 필터 수신용 Property를 추가했다.

추가 필드:

| Component | 용도 |
|---|---|
| `BASE_DATE` | 기준일 필터 |
| `EINDT` | 납기일 필터 |
| `WERKS` | 플랜트 필터 |
| `BUKRS` | 회사코드 필터 |
| `EBELN` | PO번호 필터 |
| `LIFNR` | 공급업체 필터 |
| `NAME1` | 공급업체명 필터 |
| `MATNR` | 자재코드 필터 |
| `MAKTX` | 자재명 필터 |
| `STATUS_CODE` | 상태 필터 수신용, KPI 계산에서는 제외 |

`KPI_ID`만 Key이고, 나머지는 Nullable 체크했다.

---

## 4. 관련 CBO 테이블

| 역할 | 프로젝트 테이블 | 표준 SAP 유사 역할 | 사용 목적 |
|---|---|---|---|
| 구매문서 Header | `ZTD3MM0016` | EKKO | PO 헤더, 공급업체, 조직 정보 |
| 구매문서 Item | `ZTD3MM0017` | EKPO | PO Item, 자재, 수량, 납기일 |
| 자재문서 Header | `ZTD3MM0018` | MKPF | 전기일, 이동유형 |
| 자재문서 Item | `ZTD3MM0019` | MSEG | 101/102 이력, PO 참조 |
| 공급업체 마스터 | `ZTD3MM0007` | LFA1 | 공급업체명 |
| 자재 마스터 | `ZTD3MM0001` | MARA | 자재명 |
| 이동유형 마스터 | `ZTD3MM0014` | T156 | 이동유형명 |

중요한 프로젝트 기준:

```text
BWART는 표준처럼 MSEG가 아니라 프로젝트 CBO 기준 ZTD3MM0018-BWART에 있음.
따라서 101/102 필터는 반드시 ZTD3MM0018 기준으로 처리한다.
```

---

## 5. 상태/수량 계산 로직

### 5.1 입고수량 계산

```text
Gr101Qty = SUM(101 수량)
Gr102Qty = SUM(102 수량)
GrQty    = Gr101Qty - Gr102Qty
OpenRaw  = PoQty - GrQty
OpenQty  = MAX(OpenRaw, 0)
```

`102` 수량은 DB에 양수로 저장되어 있고, Gateway에서 차감한다.

### 5.2 상태 코드

| 상태코드 | 상태명 | 조건 | UI5 State |
|---|---|---|---|
| `C` | 입고완료 | `GrQty >= PoQty` | `Success` |
| `O` | 미입고 예정 | `GrQty <= 0` and `Eindt >= BaseDate` | `None` |
| `D` | 미입고 지연 | `GrQty <= 0` and `Eindt < BaseDate` | `Error` |
| `P` | 부분입고 | `0 < GrQty < PoQty` and `Eindt >= BaseDate` | `Information` |
| `L` | 부분입고 지연 | `0 < GrQty < PoQty` and `Eindt < BaseDate` | `Warning` |

### 5.3 지연일수

```text
IF Eindt < BaseDate AND GrQty < PoQty.
  DelayDays = BaseDate - Eindt.
ELSE.
  DelayDays = 0.
ENDIF.
```

---

## 6. View/CDS 현황

### 6.1 CDS View 1: `ZCDS_D3_MM_0010`

역할:

```text
PO Header + PO Item + 공급업체 + 자재 기본정보 조회
```

주요 원천:

```text
ZTD3MM0016 EKKO
INNER JOIN ZTD3MM0017 EKPO
LEFT OUTER JOIN ZTD3MM0007 LFA1
LEFT OUTER JOIN ZTD3MM0001 MARA
```

주요 필드:

```text
Ebeln, Ebelp, Bsart, Lifnr, Name1, Ekorg, Ekgrp, Bukrs, Bedat,
Matnr, Maktx, Werks, Lgort, PoQty, Meins, Netpr, Peinh, Netwr,
ItemWaers, HeadWaers, Eindt
```

조건:

```abap
where ekko.bsart = 'PO'
  and ekko.lvorm = ''
  and ekpo.lvorm = ''
```

### 6.2 CDS View 2: `ZCDS_D3_MM_0011`

역할:

```text
PO Item별 101/102 입고수량 집계
```

주요 원천:

```text
ZTD3MM0019 MSEG
INNER JOIN ZTD3MM0018 MKPF
```

주요 필드:

```text
Ebeln, Ebelp, Meins, Gr101Qty, Gr102Qty, LastGrDate
```

중요 구현 규칙:

```abap
else cast( 0 as abap.quan( 13, 3 ) )
```

CDS에서 `SUM + CASE + QUAN` 조합을 쓸 때 `else 0`을 그대로 쓰면 타입 오류가 발생했기 때문에 위 CAST가 필요했다.

### 6.3 DB View: `ZDVD3MM0016`

역할:

```text
상세 Fragment 팝업용 101/102 개별 입고 이력 조회
```

주요 원천:

```text
ZTD3MM0019 MSEG
+ ZTD3MM0018 MKPF
+ ZTD3MM0014 T156
```

주요 필드:

```text
Mblnr, Mjahr, Zeile, Ebeln, Ebelp, Bwart, BwartText,
Budat, Bldat, Matnr, Werks, Lgort, Meins, Menge, Smbln, Smblp
```

`SignedQty`, `SignText`는 DB View에 넣지 않고 Gateway에서 계산한다.

---

## 7. OData EntitySet 현황

Service:

```text
ZGWD3MM0007_SRV
/sap/opu/odata/sap/ZGWD3MM0007_SRV/
```

### 7.1 `DelayedPoSet`

용도:

```text
PO Item별 납기 지연/미입고 상태 조회
```

Key:

```text
Ebeln + Ebelp
```

주요 Property:

```text
Ebeln, Ebelp, Bsart, Bukrs, Ekorg, Ekgrp, Werks, Lgort,
Lifnr, Name1, Matnr, Maktx, Meins,
Bedat, Eindt, BaseDate, LastGrDate,
PoQty, Gr101Qty, Gr102Qty, GrQty, OpenQty,
StatusCode, StatusText, StatusState, DelayDays,
Netpr, Peinh, Netwr, Waers
```

### 7.2 `DelayedPoKpiSet`

용도:

```text
KPI 카드 4개 조회
```

Key:

```text
KpiId
```

결과 Property:

```text
KpiId, OpenPoItemCnt, DelayedItemCnt, NoReceiptDelayCnt, DelayedVendorCnt
```

필터 수신용 Property:

```text
BaseDate, Eindt, Werks, Bukrs, Ebeln, Lifnr, Name1, Matnr, Maktx, StatusCode
```

주의:

```text
StatusCode는 수신만 하고 KPI 계산에서는 제외한다.
ExcludeCompleted는 Property로 만들지 않았다.
```

### 7.3 `PoGrHistorySet`

용도:

```text
선택한 PO Item의 101/102 GR 이력 조회
```

Key:

```text
Mblnr + Mjahr + Zeile
```

주요 Property:

```text
Mblnr, Mjahr, Zeile, Ebeln, Ebelp, Bwart, BwartText,
Budat, Bldat, Matnr, Werks, Lgort, Meins, Menge,
SignedQty, SignText, Smbln, Smblp
```

---

## 8. DPC_EXT 구현 현황

Class:

```text
ZCL_ZGWD3MM0007_DPC_EXT
```

### 8.1 Redefine 완료 메소드

```abap
METHODS delayedposet_get_entityset REDEFINITION.
METHODS delayedpokpiset_get_entityset REDEFINITION.
METHODS pogrhistoryset_get_entityset REDEFINITION.
```

### 8.2 Private Types

```abap
TYPES:
  BEGIN OF ty_s_filter,
    base_date  TYPE dats,
    eindt_from TYPE dats,
    eindt_to   TYPE dats,
    werks      TYPE zed3_pp_werks,
    bukrs      TYPE zed3_fi_bukrs,
    ebeln      TYPE zed3_mm_ebeln,
    lifnr      TYPE zed3_mm_lifnr,
    name1      TYPE zed3_mm_name1,
    matnr      TYPE zed3_mm_matnr,
    maktx      TYPE zed3_mm_maktx,
  END OF ty_s_filter,

  ty_t_status_range TYPE RANGE OF char1.
```

### 8.3 Private Helper Methods

```abap
METHODS get_filter_values
  IMPORTING
    it_filter_select_options TYPE /iwbep/t_mgw_select_option
  EXPORTING
    es_filter                TYPE ty_s_filter
    et_status_range          TYPE ty_t_status_range.

METHODS get_po_gr_status_data
  IMPORTING
    is_filter              TYPE ty_s_filter
    it_status_range        TYPE ty_t_status_range
    iv_apply_status_filter TYPE abap_bool
  EXPORTING
    et_entityset           TYPE zcl_zgwd3mm0007_mpc=>tt_delayedpo.
```

### 8.4 `GET_FILTER_VALUES`

역할:

```text
OData $filter 조건을 ABAP 내부 구조로 변환한다.
```

처리 Property:

```text
BaseDate, Eindt, Werks, Bukrs, Ebeln, Lifnr, Name1, Matnr, Maktx, StatusCode
```

주의:

```text
DDIC 필드명 BASE_DATE가 아니라 OData Property명 BaseDate 기준으로 CASE 분기한다.
```

### 8.5 `GET_PO_GR_STATUS_DATA`

역할:

```text
PO 기본정보와 GR 집계정보를 결합하여 DelayedPo 결과를 만든다.
```

처리 흐름:

```text
1. ZCDS_D3_MM_0010에서 PO 기본정보 조회
2. ZCDS_D3_MM_0011에서 GR 집계정보 조회
3. EBELN + EBELP 기준 결합
4. GrQty = Gr101Qty - Gr102Qty 계산
5. OpenQty 계산 및 0 보정
6. 상태코드/상태명/UI5 State 계산
7. DelayDays 계산
8. iv_apply_status_filter = abap_true일 때만 StatusCode 필터 적용
```

### 8.6 `DELAYEDPOSET_GET_ENTITYSET`

역할:

```text
메인 목록 조회
```

호출 구조:

```abap
get_filter_values( ... ).
get_po_gr_status_data(
  iv_apply_status_filter = abap_true
).
```

### 8.7 `DELAYEDPOKPISET_GET_ENTITYSET`

역할:

```text
KPI 카드 4개 계산 후 KpiId = MAIN 1건 반환
```

호출 구조:

```abap
get_filter_values( ... ).
get_po_gr_status_data(
  iv_apply_status_filter = abap_false
).
```

KPI 계산:

```text
OpenPoItemCnt     = StatusCode <> 'C'
DelayedItemCnt    = StatusCode IN ('D', 'L')
NoReceiptDelayCnt = StatusCode = 'D'
DelayedVendorCnt  = DISTINCT Lifnr WHERE StatusCode IN ('D', 'L')
```

### 8.8 `POGRHISTORYSET_GET_ENTITYSET`

역할:

```text
상세 팝업에서 선택한 PO Item의 101/102 이력 조회
```

조회 기준:

```text
Ebeln + Ebelp
```

조회 소스:

```text
ZDVD3MM0016
```

중요 로직:

```abap
IF lv_ebeln IS INITIAL OR lv_ebelp IS INITIAL.
  RETURN.
ENDIF.
```

전체 이력 조회 방지를 위해 `Ebeln` 또는 `Ebelp`가 없으면 빈 결과를 반환한다.

SignedQty 계산:

```abap
CASE bwart.
  WHEN '101'.
    signed_qty = menge.
    sign_text  = '입고'.
  WHEN '102'.
    signed_qty = menge * -1.
    sign_text  = '입고취소'.
ENDCASE.
```

---

## 9. 해결했던 오류와 원인

### 9.1 `DelayedPoSet` 500 Error

에러:

```text
Property 'LastGrDate' has invalid value '00000000'
Value '00000000' violates facet information 'nullable=false'
```

원인:

```text
GR 이력이 없는 PO는 LastGrDate가 00000000인데,
OData Metadata에서 LastGrDate가 nullable=false였음.
```

해결:

```text
SEGW Entity Type에서 Key 필드 제외 대부분 Nullable 체크.
LastGrDate는 반드시 Nullable 허용.
Generate Runtime Objects + Cache Cleanup.
```

### 9.2 `DelayedPoKpiSet` 400 Error

에러:

```text
Property BaseDate not found in type DelayedPoKpi
```

원인:

```text
DelayedPoKpi Entity Type에 BaseDate Property가 없는데 $filter로 BaseDate를 사용함.
```

해결:

```text
ZSD3MM0008과 DelayedPoKpi Entity에 필터 수신용 Property 추가.
KpiId만 Key 유지.
추가 필드는 Nullable 체크.
```

---

## 10. 테스트 완료 URI

### 10.1 `DelayedPoSet` 단건 조회

```text
/sap/opu/odata/sap/ZGWD3MM0007_SRV/DelayedPoSet?$filter=Ebeln eq 'PO80000003'&$format=json
```

확인 결과:

```text
PO80000003 / 00010
PoQty = 18
Gr101Qty = 8
Gr102Qty = 0
GrQty = 8
OpenQty = 10
StatusCode = P
StatusText = 부분입고
StatusState = Information
DelayDays = 0
```

정상 판정:

```text
0 < GrQty < PoQty
Eindt >= BaseDate
→ 부분입고 P
```

### 10.2 `DelayedPoKpiSet` 기준일 필터

```text
/sap/opu/odata/sap/ZGWD3MM0007_SRV/DelayedPoKpiSet?$filter=BaseDate eq datetime'2026-05-18T00:00:00'&$format=json
```

확인 결과:

```text
KpiId = MAIN
OpenPoItemCnt = 49
DelayedItemCnt = 12
NoReceiptDelayCnt = 10
DelayedVendorCnt = 4
```

필터 수신용 필드들은 응답에서 `null` 또는 빈 문자열로 나오는 것이 정상이다. 출력용 값이 아니라 `$filter` 수신용 Property이기 때문이다.

### 10.3 `PoGrHistorySet` 상세 이력

```text
/sap/opu/odata/sap/ZGWD3MM0007_SRV/PoGrHistorySet?$filter=Ebeln eq 'PO80000006' and Ebelp eq '00010'
```

확인 결과:

| Mblnr | Bwart | Menge | SignedQty | SignText |
|---|---:|---:|---:|---|
| `GR80000004` | `101` | 10 | 10 | 입고 |
| `GR80000005` | `102` | 4 | -4 | 입고취소 |

정상 판정:

```text
실제 반영수량 = 10 - 4 = 6
```

---

## 11. 현재 완료 위치

현재 전체 단계 중 **21단계까지 완료**된 상태다.

| 단계 | 작업 | 상태 |
|---:|---|---|
| 1 | V4 설계서 확정 | 완료 |
| 2 | `ZSD3MM0007` Structure 설계/생성 | 완료 |
| 3 | `ZSD3MM0008` Structure 설계/생성 | 완료 |
| 4 | `ZSD3MM0009` Structure 설계/생성 | 완료 |
| 5 | 테스트 데이터 생성 | 완료 |
| 6 | SE11 Structure 3개 생성 | 완료 |
| 7 | CDS `ZCDS_D3_MM_0010` 생성 | 완료 |
| 8 | CDS `ZCDS_D3_MM_0011` 생성 | 완료 |
| 9 | DB View `ZDVD3MM0016` 생성 | 완료 |
| 10 | CDS/View 단독 테스트 | 완료 |
| 11 | SEGW 프로젝트 생성 | 완료 |
| 12 | DDIC Structure Import | 완료 |
| 13 | EntitySet/Key 지정 | 완료 |
| 14 | Runtime Generate | 완료 |
| 15 | Gateway Service 등록 | 완료 |
| 16 | `$metadata` 테스트 | 완료 |
| 17 | DPC_EXT Helper 정의 | 완료 |
| 18 | `GET_FILTER_VALUES`, `GET_PO_GR_STATUS_DATA` 구현 | 완료 |
| 19 | `DELAYEDPOSET_GET_ENTITYSET` 구현 | 완료 |
| 20 | `DELAYEDPOKPISET_GET_ENTITYSET` 구현 | 완료 |
| 20-1 | KPI 필터용 Property 추가 | 완료 |
| 21 | `POGRHISTORYSET_GET_ENTITYSET` 구현 | 완료 |

---

## 12. 다음에 할 작업

### 12.1 권장 다음 단계: Gateway 통합 테스트 정리

UI5로 바로 넘어가도 되지만, 먼저 Gateway Client 테스트 URI와 기대값을 정리하는 것이 좋다.

필수 테스트:

| 번호 | URI | 목적 |
|---:|---|---|
| 1 | `/DelayedPoSet?$filter=Ebeln eq 'PO80000003'` | 부분입고 P 단건 확인 |
| 2 | `/DelayedPoSet?$filter=Ebeln eq 'PO80000006'` | 102 반영 L 확인 |
| 3 | `/DelayedPoSet?$filter=StatusCode eq 'D'` | 상태 필터 확인 |
| 4 | `/DelayedPoSet?$filter=BaseDate eq datetime'2026-05-18T00:00:00'` | 기준일 필터 확인 |
| 5 | `/DelayedPoKpiSet?$filter=BaseDate eq datetime'2026-05-18T00:00:00'` | KPI 기준일 필터 확인 |
| 6 | `/DelayedPoKpiSet?$filter=Ebeln eq 'PO80000003' and BaseDate eq datetime'2026-05-18T00:00:00'` | KPI 검색조건 반영 확인 |
| 7 | `/PoGrHistorySet?$filter=Ebeln eq 'PO80000006' and Ebelp eq '00010'` | 상세 GR 이력 확인 |
| 8 | `/PoGrHistorySet` | 필터 없을 때 빈 결과 확인 |

### 12.2 그 다음 단계: UI5 FreeStyle App 개발

남은 UI5 단계:

| 단계 | 작업 |
|---:|---|
| 23 | UI5 FreeStyle 프로젝트 생성 |
| 24 | `manifest.json`에 OData Service 등록 |
| 25 | `Main.view.xml` 검색조건/KPI/Table 구현 |
| 26 | `Main.controller.js` 초기값/조회 로직 구현 |
| 27 | `PoItemDetail.fragment.xml` 구현 |
| 28 | 행 클릭 → 상세 이력 조회 → Dialog Open 연결 |
| 29 | `formatter.js`, `i18n.properties` 정리 |
| 30 | 상태코드별 통합 테스트 |
| 31 | KPI와 테이블 건수 정합성 검증 |
| 32 | 시연 데이터 보정 |
| 33 | 최종 화면 점검 및 오류 수정 |

---

## 13. UI5 개발 시작 시 Codex가 따라야 할 구조

파일 구조:

```text
webapp
├─ controller
│  └─ Main.controller.js
├─ view
│  └─ Main.view.xml
├─ fragment
│  └─ PoItemDetail.fragment.xml
├─ model
│  └─ formatter.js
├─ i18n
│  └─ i18n.properties
├─ Component.js
└─ manifest.json
```

모델 구조:

| 모델명 | 타입 | 용도 |
|---|---|---|
| 기본 모델 | ODataModel V2 | Gateway Service 호출 |
| `view` | JSONModel | 검색조건, 화면 제어값 |
| `kpi` | JSONModel | KPI 카드 값 |
| `detail` | JSONModel | 선택한 PO Item 상세 |
| `grHistory` | JSONModel | 상세 팝업 101/102 이력 |

Controller 메소드 후보:

```javascript
onInit
onSearch
onReset
onToggleAdvanced
onItemPress
onCloseDetailDialog
_buildFilters
_loadMainTable
_loadKpiData
_loadGrHistory
```

---

## 14. UI5 기본 조회 조건

초기값:

| 조건 | 기본값 |
|---|---|
| 기준일 | 오늘 |
| 납기일 From | 기준일 - 90일 |
| 납기일 To | 기준일 월 말일 |
| 상태 | `O`, `D`, `P`, `L` |
| 입고완료 제외 | true |
| 플랜트 | 전체 |

주의:

```text
ExcludeCompleted는 OData Property가 아니다.
입고완료 제외 체크 시 UI5에서 StatusCode 필터를 O/D/P/L로 만들어야 한다.
입고완료 포함 시 StatusCode 필터를 보내지 않는다.
```

KPI 조회 시:

```text
UI5에서 같은 Filter 배열을 DelayedPoKpiSet에 보내도 된다.
Backend에서 StatusCode는 수신하지만 KPI 계산에서는 제외한다.
```

---

## 15. UI5 화면 구성 목표

### 15.1 메인 화면

구성:

```text
1. 검색조건 영역
2. KPI 카드 영역
3. 결과 테이블
4. 상세 Dialog Fragment
```

### 15.2 KPI 카드 4개

| 카드 | OData Property |
|---|---|
| 미입고 PO Item | `OpenPoItemCnt` |
| 납기 지연 건수 | `DelayedItemCnt` |
| 미입고 지연 건수 | `NoReceiptDelayCnt` |
| 지연 공급업체 수 | `DelayedVendorCnt` |

### 15.3 메인 테이블 기본 컬럼

| 순서 | 컬럼 | OData Property |
|---:|---|---|
| 1 | 상태 | `StatusText`, `StatusState` |
| 2 | 지연일수 | `DelayDays` |
| 3 | 납기일 | `Eindt` |
| 4 | PO번호 | `Ebeln` |
| 5 | 항목 | `Ebelp` |
| 6 | 공급업체 | `Lifnr` |
| 7 | 공급업체명 | `Name1` |
| 8 | 자재 | `Matnr` |
| 9 | 자재명 | `Maktx` |
| 10 | 발주수량 | `PoQty` |
| 11 | 입고수량 | `GrQty` |
| 12 | 미입고수량 | `OpenQty` |

숨김/보조 컬럼:

```text
Bukrs, Werks, Lgort, Ekorg, Ekgrp, Bsart,
Waers, Netpr, Peinh, Netwr, Bedat, LastGrDate
```

---

## 16. UI5 상세 Dialog 목표

행 클릭 시:

```text
1. 선택 행을 detail JSONModel에 저장
2. Ebeln/Ebelp 기준으로 PoGrHistorySet 호출
3. grHistory JSONModel에 결과 저장
4. PoItemDetail.fragment.xml Dialog Open
```

상세 이력 테이블 컬럼:

| 컬럼 | Property |
|---|---|
| 자재문서번호 | `Mblnr` |
| 회계연도 | `Mjahr` |
| 항목 | `Zeile` |
| 이동유형 | `Bwart` |
| 이동유형명 | `BwartText` |
| 전기일 | `Budat` |
| 문서일 | `Bldat` |
| 수량 | `Menge` |
| 계산반영수량 | `SignedQty` |
| 표시구분 | `SignText` |

---

## 17. Codex에게 주는 다음 작업 지시문

다음 작업을 시작할 때 Codex에게 아래처럼 지시하면 된다.

```text
현재 SAP Gateway OData V2 Service ZGWD3MM0007_SRV의 Backend 구현은 완료되어 있다.
EntitySet은 DelayedPoSet, DelayedPoKpiSet, PoGrHistorySet 3개다.

다음 단계는 SAPUI5 FreeStyle App 개발이다.
파일 구조는 webapp/controller/Main.controller.js, webapp/view/Main.view.xml, webapp/fragment/PoItemDetail.fragment.xml, webapp/model/formatter.js, i18n/i18n.properties 기준으로 만든다.

ODataModel V2로 /sap/opu/odata/sap/ZGWD3MM0007_SRV/를 사용한다.

Main.view.xml에는 검색조건, KPI 카드 4개, 메인 테이블을 구현한다.
Main.controller.js에는 onInit, onSearch, onReset, onToggleAdvanced, onItemPress, _buildFilters, _loadMainTable, _loadKpiData, _loadGrHistory를 구현한다.

조회 시 DelayedPoSet과 DelayedPoKpiSet을 같은 검색조건으로 호출한다.
단, ExcludeCompleted는 OData Property가 아니므로, 체크 시 StatusCode 필터 O/D/P/L을 만들어서 보낸다.
KPI 쪽은 StatusCode를 수신하지만 Backend에서 계산에는 제외한다.

행 클릭 시 선택한 Ebeln/Ebelp로 PoGrHistorySet을 호출하고 상세 Dialog Fragment를 연다.

UI5 코드는 초급자가 이해할 수 있게 주석을 충분히 달고, 하드코딩은 최소화한다.
```

---

## 18. 주의사항

1. `LastGrDate`는 GR이 없으면 null일 수 있다. UI5에서 날짜 포맷 시 null 방어가 필요하다.
2. OData V2 날짜는 JSON에서 `/Date(밀리초)/` 형태로 내려올 수 있다. formatter에서 처리한다.
3. KPI 응답의 `BaseDate`, `Eindt`, `Werks` 등 필터용 필드는 null/빈 문자열이어도 정상이다.
4. `PoGrHistorySet`은 `Ebeln`, `Ebelp` 필터 없으면 빈 결과가 정상이다.
5. `StatusState`는 UI5 `ObjectStatus`의 `state`에 그대로 바인딩할 수 있다.
6. `PoQty`, `GrQty`, `OpenQty`, `Menge`, `SignedQty`는 문자열처럼 내려와도 UI5 표시에는 문제 없다. 계산이 필요하면 Number 변환한다.
7. `ExcludeCompleted`는 OData에 없다. UI5 내부 상태로만 관리한다.

---

## 19. 최종 현재 상태 요약

| 구분 | 상태 |
|---|---|
| Backend Structure | 완료 |
| CDS View 2개 | 완료 |
| DB View 1개 | 완료 |
| SEGW Service | 완료 |
| Metadata | 정상 |
| `DelayedPoSet` | 정상 |
| `DelayedPoKpiSet` | 정상 |
| `PoGrHistorySet` | 정상 |
| Gateway 주요 오류 | 해결 완료 |
| 다음 작업 | UI5 FreeStyle App 개발 |

