# [MM] 견적 비교 및 거래선 채택 Fiori 프로그램 2차 개발 설계서 V1.1.1

- 작성일: 2026-06-06
- 대상 프로그램: `[MM] 견적 비교 및 거래선 채택`
- UI5 프로젝트: `D:\sapcodeproject_usb\ui5\quote_comparison`
- Backend OData Service: `ZGWD3MM0005_SRV`
- Backend DPC Extension Class: `ZCL_ZGWD3MM0005_DPC_EXT`
- 2차 개발 주제: 선택 RFQ 기준 PO 생성
- 본 문서 상태: V1.1.0 이후 Backend Echo API 확정 내용을 반영한 UI5 개발 기준 설계서

---

## 1. 문서 목적

본 문서는 `[MM] 견적 비교 및 거래선 채택` Fiori 프로그램의 2차 개발 범위인 **PO 생성 기능**을 UI5에 연결하기 위한 기준 설계서이다.

초기 V1.0.0 설계에서는 `CreatePoFromRfq` Function Import와 `EXECUTE_ACTION` 방식으로 PO 생성 API를 설계했다. 그러나 SAP Gateway Client 테스트 결과 Function Import 요청이 DPC_EXT까지 도달하지 못하고 Gateway URI Parser 단계에서 실패하였다.

이에 따라 V1.1.0에서 Backend API 방식을 다음과 같이 전환하였다.

```text
기존:
CreatePoFromRfq Function Import
-> EXECUTE_ACTION

변경:
PoCreateRequestSet EntitySet
-> CREATE_ENTITY
-> io_data_provider->read_entry_data
```

V1.1.1은 이 전환 결과를 확정 기준으로 삼아, UI5에서 `oModel.create("/PoCreateRequestSet", payload)` 방식으로 PO 생성 요청을 보내고, Backend 응답을 기존 Footer `MessagePopover`에 표시하는 구현 방향을 정리한다.

---

## 2. 설계 변경 이력

| 버전 | 핵심 내용 |
|---|---|
| V1.0.0 | Function Import `CreatePoFromRfq` 기준 설계 |
| V1.1.0 | Function Import 방식 중단, `PoCreateRequestSet + CREATE_ENTITY` 방식으로 전환 |
| V1.1.1 | Backend Echo API 성공 결과 반영, UI5 연결 설계 확정 |

---

## 3. 기존 1차 개발 완료 범위

2차 개발은 1차 개발의 조회/비교/채택 기능 위에 PO 생성 기능을 추가한다.

| 영역 | 완료 내용 |
|---|---|
| RFQ Header 조회 | `RFQHeaderSet` 기반 조회조건, KPI, Header 목록 |
| RFQ Item 조회 | 선택 RFQ 기준 `RFQItemSet` 조회 |
| MQ 비교 | 선택 RFQ Item 기준 `MQCompareSet` 조회 |
| 금액 비교 차트 | `NetwrKrw` 기준 Bar Chart 표시 |
| MQ 상세 | `MQDetailSet` 기반 Dialog 조회 |
| 단건 채택/취소 | `QuotationItemSet` MERGE |
| 일괄 채택/취소 | RFQ Item별 자동추천 MQ 기준 순차 처리 |
| Search Help | RFQ, MQ, 공급업체, 자재, 플랜트, 회사코드, 구매조직, 구매그룹 |
| 유효성 검증 | Footer `MessagePopover` 표시 |
| 업무 처리 메시지 | `processMessages` 모델 + Footer `MessagePopover` |
| PO 생성 완료 방어 | PO 생성 Item은 채택/취소/선택 비활성화 |

---

## 4. 2차 개발 목표

### 4.1 업무 목표

사용자가 RFQ Header를 선택한 뒤 `PO 생성` 버튼을 누르면, Backend가 해당 RFQ의 채택된 MQ Item을 기준으로 PO를 생성한다.

UI5는 PO Header/Item 상세 데이터를 직접 만들지 않고, RFQ 번호만 Backend에 전달한다.

```text
UI5
-> 선택 RFQ 번호 전달
-> Backend가 RFQ/MQ/PR/PO 관련 데이터 조회
-> Backend가 PO 생성 가능 여부 검증
-> Backend가 PO Header/Item 생성
-> Backend가 처리 요약 응답 반환
-> UI5가 MessagePopover 표시 및 화면 refresh
```

### 4.2 UI 목표

| 목표 | 설명 |
|---|---|
| PO 생성 버튼 추가 | Mid Column Footer에 추가 |
| 확인 팝업 표시 | 실제 OData 호출 전 사용자 확인 |
| OData POST 호출 | `PoCreateRequestSet`에 `create` 요청 |
| 결과 메시지 표시 | 기존 Footer `processMessages` MessagePopover 재사용 |
| 성공 후 데이터 갱신 | RFQ Header, RFQ Item, MQ Compare, Chart/KPI 재조회 |
| Mid Column 유지 | PO 생성 후에도 현재 선택 RFQ 화면 유지 |

---

## 5. Backend 확정 API

### 5.1 Service

| 항목 | 값 |
|---|---|
| Service | `/sap/opu/odata/SAP/ZGWD3MM0005_SRV/` |
| EntitySet | `/PoCreateRequestSet` |
| Method | `POST` |
| UI5 호출 방식 | `oModel.create()` |
| Backend Method | `POCREATEREQUESTS_CREATE_ENTITY` |

주의: 예상 메소드명은 `POCREATEREQUESTSET_CREATE_ENTITY`였으나, Runtime Generate 결과 실제 재정의 메소드명은 `POCREATEREQUESTS_CREATE_ENTITY`이다.

### 5.2 DDIC Structure

Backend에서는 PO 생성 요청/응답용 DDIC Structure를 생성했다.

| 항목 | 값 |
|---|---|
| Structure | `ZSD3MM0022` |
| 용도 | OData Request/Response 구조 |
| DB 저장 여부 | DB 테이블 아님 |

구성 필드:

| Component | Type | 설명 |
|---|---|---|
| `RFQ_NO` | `ZED3_MM_EBELN` | PO 생성 대상 RFQ 번호 |
| `MESSAGE_TYPE` | `SYMSGTY` | 처리 결과 유형 |
| `MESSAGE_TEXT` | `BAPI_MSG` | 처리 결과 메시지 |
| `PO_COUNT` | `INT4` | 생성 PO Header 수 |
| `PO_ITEM_COUNT` | `INT4` | 생성 PO Item 수 |
| `FIRST_PO_NO` | `ZED3_MM_EBELN` | 대표 PO 번호 |
| `CREATED_PO_NOS` | `CHAR255` | 생성 PO 번호 목록 |
| `SKIPPED_ITEM_COUNT` | `INT4` | 제외 Item 수 |
| `ERROR_COUNT` | `INT4` | 오류 수 |

### 5.3 OData Entity

| 항목 | 값 |
|---|---|
| Entity Type | `PoCreateRequest` |
| EntitySet | `PoCreateRequestSet` |
| Key | `RfqNo` |
| Creatable | 허용 |
| 응답 필드 Nullable | 허용 |

Property 매핑:

| OData Property | ABAP Field Name | 설명 |
|---|---|---|
| `RfqNo` | `RFQ_NO` | RFQ 번호 |
| `MessageType` | `MESSAGE_TYPE` | 메시지 유형 |
| `MessageText` | `MESSAGE_TEXT` | 메시지 내용 |
| `PoCount` | `PO_COUNT` | 생성 PO Header 수 |
| `PoItemCount` | `PO_ITEM_COUNT` | 생성 PO Item 수 |
| `FirstPoNo` | `FIRST_PO_NO` | 대표 PO 번호 |
| `CreatedPoNos` | `CREATED_PO_NOS` | 생성 PO 번호 목록 |
| `SkippedItemCount` | `SKIPPED_ITEM_COUNT` | 제외 Item 수 |
| `ErrorCount` | `ERROR_COUNT` | 오류 수 |

### 5.4 Request

```http
POST /sap/opu/odata/SAP/ZGWD3MM0005_SRV/PoCreateRequestSet
```

Header:

```text
Accept: application/json
Content-Type: application/json
X-CSRF-Token: <Fetched Token>
```

Body:

```json
{
  "RfqNo": "RQ10000002"
}
```

### 5.5 현재 Echo Response

현재 Backend는 실제 PO 생성 로직이 아니라 Echo 응답만 반환한다.

```json
{
  "d": {
    "RfqNo": "RQ10000002",
    "MessageType": "S",
    "MessageText": "RFQ RQ10000002 기준 PO 생성 요청이 정상적으로 수신되었습니다.",
    "PoCount": 0,
    "PoItemCount": 0,
    "FirstPoNo": "",
    "CreatedPoNos": "",
    "SkippedItemCount": 0,
    "ErrorCount": 0
  }
}
```

Gateway Client 테스트 결과:

| 항목 | 결과 |
|---|---|
| HTTP Status | `201 Created` |
| Breakpoint | `POCREATEREQUESTS_CREATE_ENTITY` 진입 확인 |
| Request Body Mapping | `ls_request-rfq_no = RQ10000002` 확인 |
| 현재 Backend 처리 | Echo 응답 |

---

## 6. Function Import 처리 방침

기존 Function Import는 더 이상 UI5에서 사용하지 않는다.

| 객체 | 처리 |
|---|---|
| `CreatePoFromRfq` Function Import | 미사용 상태로 유지 |
| `PoCreateResult` | 당장 삭제하지 않음 |
| `PoCreateResultSet` | 당장 삭제하지 않음 |
| `EXECUTE_ACTION` 재정의 | 당장 삭제하지 않음 |

삭제하지 않는 이유:

- 현재 Backend 전환 안정화가 우선이다.
- `PoCreateRequestSet` 방식이 UI5까지 안정적으로 붙은 뒤 정리 여부를 판단한다.
- 삭제 시 Runtime Generate와 metadata 영향 범위를 다시 검토해야 한다.

UI5 구현에서는 `callFunction()`을 사용하지 않는다.

---

## 7. UI5 화면 설계

### 7.1 버튼 위치

`PO 생성` 버튼은 Mid Column Footer에 추가한다.

권장 위치:

```text
Footer MessagePopover 버튼
-> ToolbarSpacer
-> PO 생성
-> 채택
-> 채택취소
```

현재 Mid Column Footer에는 이미 아래 버튼들이 있다.

| 버튼 | 용도 |
|---|---|
| `idProcessMessageButton` | 업무 처리 결과 MessagePopover |
| `채택` | 선택 MQ 채택 |
| `채택취소` | 채택 MQ 취소 |

여기에 `PO 생성` 버튼을 `채택` 버튼 왼쪽에 추가한다.

예상 XML:

```xml
<Button
    text="{i18n>createPo}"
    type="Emphasized"
    enabled="{= !!${work>/SelectedRfq/RfqNo} &amp;&amp; ${work>/SelectedRfq/AwardStatus} !== 'PO' }"
    press=".onCreatePo"/>
```

### 7.2 버튼 활성화 조건

UI에서 최소한의 조건만 막는다.

| 조건 | 처리 |
|---|---|
| 선택 RFQ 없음 | 비활성화 또는 클릭 시 Warning 표시 |
| 선택 RFQ 있음 | 활성화 |
| Header 상태 `PO` | 비활성화 |
| 세부 PO 생성 가능 여부 | Backend가 최종 판단 |

UI에서 모든 RFQ Item의 채택 여부를 완벽히 검사하지 않는다. 실제 생성 가능 여부는 Backend가 판단한다.

### 7.3 확인 팝업

PO 생성은 DB 생성 작업이므로 버튼 클릭 후 확인 팝업을 띄운다.

문구:

```text
선택 RFQ 기준으로 PO를 생성하시겠습니까?
이미 PO가 생성된 Item과 미채택 Item은 제외될 수 있습니다.
```

확인 시에만 OData POST를 호출한다.

취소 시에는 아무 OData 요청도 보내지 않는다.

---

## 8. UI5 Controller 설계

### 8.1 추가 메소드

`Main.controller.js`에 아래 메소드를 추가한다.

| 메소드 | 역할 |
|---|---|
| `onCreatePo` | PO 생성 버튼 이벤트 진입점 |
| `_createPoForSelectedRfq` | `oModel.create("/PoCreateRequestSet", payload)` 호출 |
| `_handleCreatePoSuccess` | Backend success 응답 처리 |
| `_handleCreatePoError` | OData error callback 처리 |
| `_mapBackendMessageType` | Backend `S/W/E/I`를 UI5 MessageType으로 변환 |
| `_buildCreatePoMessages` | Backend 요약 필드를 MessagePopover 메시지 배열로 변환 |

### 8.2 onCreatePo

```javascript
onCreatePo() {
    const oWorkModel = this.getView().getModel("work");
    const oSelectedRfq = oWorkModel && oWorkModel.getProperty("/SelectedRfq") || {};
    const sRfqNo = oSelectedRfq.RfqNo;

    if (!sRfqNo) {
        this._setProcessMessages([
            this._createProcessMessage(
                "Warning",
                this._getText("msgSelectRfq") || "RFQ를 먼저 선택하세요.",
                this._getText("processCreatePo") || "PO 생성"
            )
        ]);
        this._openProcessMessagePopoverDelayed();
        return;
    }

    MessageBox.confirm(this._getText("msgConfirmCreatePo"), {
        actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
        emphasizedAction: MessageBox.Action.OK,
        onClose: (sAction) => {
            if (sAction !== MessageBox.Action.OK) {
                return;
            }

            this._createPoForSelectedRfq(sRfqNo)
                .then((oData) => this._handleCreatePoSuccess(oData))
                .catch((oError) => this._handleCreatePoError(oError));
        }
    });
}
```

### 8.3 OData 호출

```javascript
_createPoForSelectedRfq(sRfqNo) {
    const oModel = this.getView().getModel();

    return new Promise((resolve, reject) => {
        oModel.create("/PoCreateRequestSet", {
            RfqNo: sRfqNo
        }, {
            success: resolve,
            error: reject
        });
    });
}
```

### 8.4 Backend MessageType 매핑

| Backend `MessageType` | UI5 MessageType |
|---|---|
| `S` | `Success` |
| `W` | `Warning` |
| `E` | `Error` |
| `I` | `Information` |
| 기타 | `Information` |

```javascript
_mapBackendMessageType(sMessageType) {
    switch (sMessageType) {
        case "S":
            return "Success";
        case "W":
            return "Warning";
        case "E":
            return "Error";
        case "I":
            return "Information";
        default:
            return "Information";
    }
}
```

### 8.5 Success 응답 처리

중요한 점은 **OData success callback이어도 업무 오류일 수 있다**는 것이다.

예:

```json
{
  "MessageType": "E",
  "MessageText": "PO 생성 대상 Item이 없습니다."
}
```

따라서 success callback에서는 반드시 `MessageType`을 확인한다.

처리 기준:

| 조건 | 처리 |
|---|---|
| `MessageType = S` | MessagePopover 표시, refresh 수행 |
| `MessageType = W` + `PoCount > 0` | MessagePopover 표시, refresh 수행 |
| `MessageType = W` + `PoCount = 0` | MessagePopover 표시, refresh 생략 |
| `MessageType = E` | MessagePopover Error 표시, refresh 생략 |

### 8.6 Error callback 처리

OData error callback은 HTTP/Gateway/Runtime 오류다.

처리 기준:

- 기존 `_getODataErrorText` 사용
- Footer `processMessages`에 Error 메시지 표시
- `MessageBox.error`보다 기존 MessagePopover 패턴 우선

---

## 9. MessagePopover 설계

기존 `processMessages` 모델과 Footer `MessagePopover`를 그대로 재사용한다.

### 9.1 기본 메시지

Backend의 `MessageText`는 항상 1건 표시한다.

```text
[Success] RFQ RQ10000002 기준 PO 생성 요청이 정상적으로 수신되었습니다.
```

### 9.2 추가 메시지

Backend 응답 필드가 있으면 추가 메시지를 만든다.

| 조건 | 추가 메시지 |
|---|---|
| `CreatedPoNos` 존재 | `생성 PO: {CreatedPoNos}` |
| `PoCount > 0` | `PO {PoCount}건이 생성되었습니다.` |
| `PoItemCount > 0` | `PO Item {PoItemCount}건이 생성되었습니다.` |
| `SkippedItemCount > 0` | `제외 RFQ Item {SkippedItemCount}건이 있습니다.` |
| `ErrorCount > 0` | `오류 {ErrorCount}건이 있습니다.` |

`CreatedPoNos`가 길 경우 title에는 요약을 표시하고, description에 전체 목록을 표시한다.

### 9.3 버튼 상태

기존 `_setProcessMessages`가 아래 기준으로 Footer 버튼 상태를 정한다.

| 메시지 구성 | 버튼 Type |
|---|---|
| Error 포함 | `Negative` |
| Warning 포함 | `Attention` |
| Success/Information만 | `Accept` |

이 기준을 그대로 사용한다.

---

## 10. Refresh 설계

PO 생성 후 실제 Backend 로직이 붙으면 다음 데이터가 모두 영향을 받는다.

| 대상 | 이유 |
|---|---|
| `RFQHeaderSet` | Header 상태/KPI 갱신 |
| `RFQItemSet` | Item별 PO 생성 여부/상태 갱신 |
| `MQCompareSet` | MQ별 선택 가능 여부/PO 상태 갱신 |
| Chart | MQ 비교 데이터 기반 차트 갱신 |
| KPI | Header 상태별 건수 갱신 |

따라서 `MessageType = S`이거나 `MessageType = W`이면서 `PoCount > 0`이면 기존 refresh 흐름을 호출한다.

권장 재사용 함수:

```text
_refreshAfterAward()
```

이 함수가 이미 Header/Item/MQ 재조회 및 FCL 레이아웃 유지 패턴을 갖고 있으므로 PO 생성 후 refresh에도 재사용할 수 있다. 이름은 향후 `_refreshAfterDocumentChange` 같은 일반명으로 리팩토링할 수 있으나, 이번 단계에서는 불필요한 리팩토링을 하지 않는다.

---

## 11. Busy 및 중복 클릭 방지

PO 생성 요청 중에는 중복 호출을 막아야 한다.

### 11.1 Busy 처리

전체 View Busy를 사용한다.

```javascript
const oViewModel = this.getView().getModel("view");
oViewModel.setProperty("/Busy", true);
```

완료 후 반드시 false로 복구한다.

### 11.2 중복 호출 방지

별도 flag를 둔다.

```javascript
if (this._bCreatingPo) {
    return;
}

this._bCreatingPo = true;
```

`finally`에서 false로 되돌린다.

Busy만으로도 대부분 막히지만, OData 요청 중복 방어를 위해 flag를 별도로 둔다.

---

## 12. i18n 설계

아래 Key를 추가한다.

```properties
createPo=PO 생성
processCreatePo=PO 생성
msgConfirmCreatePo=선택 RFQ 기준으로 PO를 생성하시겠습니까?\n이미 PO가 생성된 Item과 미채택 Item은 제외될 수 있습니다.
msgSelectRfq=RFQ를 먼저 선택하세요.
msgCreatePoSuccess=PO 생성이 완료되었습니다. 생성 PO: {0}
msgCreatePoNoTarget=PO 생성 대상 Item이 없습니다.
msgCreatePoError=PO 생성 중 오류가 발생했습니다.
msgCreatePoCreatedNos=생성 PO: {0}
msgCreatePoCount=PO {0}건이 생성되었습니다.
msgCreatePoItemCount=PO Item {0}건이 생성되었습니다.
msgCreatePoSkipped=제외 RFQ Item {0}건이 있습니다.
msgCreatePoErrorCount=오류 {0}건이 있습니다.
```

기존 i18n 네이밍과 충돌하면 기존 명명 규칙에 맞춰 조정한다.

---

## 13. Local Metadata 설계

UI5의 `webapp/localService/mainService/metadata.xml`에도 `PoCreateRequest`와 `PoCreateRequestSet`을 반영한다.

실서버 연결만 사용하면 필수는 아니지만, 아래 이유로 갱신하는 것이 좋다.

| 이유 | 설명 |
|---|---|
| 테스트 일관성 | local metadata 기준 테스트/Mock 환경 유지 |
| 개발자 이해 | UI5 프로젝트만 봐도 API 구조 확인 가능 |
| OData 모델 참조 | metadata 기반 EntitySet 확인 가능 |

추가 대상:

```xml
<EntityType Name="PoCreateRequest">
  <Key>
    <PropertyRef Name="RfqNo"/>
  </Key>
  <Property Name="RfqNo" Type="Edm.String" Nullable="false" MaxLength="10"/>
  <Property Name="MessageType" Type="Edm.String" MaxLength="1"/>
  <Property Name="MessageText" Type="Edm.String" MaxLength="220"/>
  <Property Name="PoCount" Type="Edm.Int32"/>
  <Property Name="PoItemCount" Type="Edm.Int32"/>
  <Property Name="FirstPoNo" Type="Edm.String" MaxLength="10"/>
  <Property Name="CreatedPoNos" Type="Edm.String" MaxLength="255"/>
  <Property Name="SkippedItemCount" Type="Edm.Int32"/>
  <Property Name="ErrorCount" Type="Edm.Int32"/>
</EntityType>

<EntitySet Name="PoCreateRequestSet" EntityType="ZGWD3MM0005_SRV.PoCreateRequest" sap:creatable="true"/>
```

---

## 14. Backend 실제 PO 생성 로직 기준

현재 Backend는 Echo 응답만 반환한다. 실제 PO 생성 로직은 UI5 연결 성공 후 Backend에서 단계적으로 확장한다.

### 14.1 생성 대상

```text
채택 완료 + PO 미생성 RFQ Item
```

### 14.2 제외 대상

| 대상 | 처리 |
|---|---|
| 이미 PO 생성된 Item | 제외 Warning |
| 미채택 Item | 제외 Warning |
| 생성 대상 0건 | Warning 응답 |

### 14.3 치명 오류

아래 오류는 전체 생성 중단 대상이다.

| 오류 | 처리 |
|---|---|
| 채택 MQ 수량 0 이하 | Error |
| 단가 0 이하 | Error |
| 가격단위 0 이하 | Error |
| 납기일 없음 | Error |
| 공급업체 없음 | Error |
| 회사코드/구매조직/구매그룹 없음 | Error |
| 통화/지급조건 없음 | Error |
| 기존 PO 중복 | Error 또는 제외 정책 확정 필요 |

### 14.4 PO Header 그룹핑

```text
BUKRS + EKORG + EKGRP + LIFNR + ZTERM + WAERS
```

### 14.5 번호 채번

| 항목 | 값 |
|---|---|
| Number Range Object | `ZNRD3MM01` |
| Interval | `01` |
| 채번 시점 | 모든 검증 통과 후 |

### 14.6 저장 정책

생성 대상 Item 기준 All-or-Nothing으로 처리한다.

```text
생성 대상 중 하나라도 치명 오류 발생
-> 전체 Rollback
-> MessageType = E 또는 Gateway Exception
```

---

## 15. UI5 테스트 시나리오

현재 Backend가 Echo 응답만 반환하는 상태에서도 아래 테스트가 가능하다.

| 테스트 | 기대 결과 |
|---|---|
| RFQ 미선택 상태에서 PO 생성 클릭 | Footer MessagePopover Warning |
| RFQ 선택 후 PO 생성 클릭 | 확인 팝업 표시 |
| 확인 팝업 취소 | OData 호출 없음 |
| 확인 팝업 확인 | `POST /PoCreateRequestSet` 호출 |
| Backend Echo 응답 수신 | Footer MessagePopover Success |
| OData error 발생 | Footer MessagePopover Error |
| MessageType = E 응답 | success callback이어도 Error MessagePopover 표시 |
| MessageType = S 응답 | MessagePopover 표시 후 refresh 구조 실행 |
| PO 생성 중 중복 클릭 | 중복 OData 호출 없음 |

---

## 16. 개발 단계

### 16.1 설계/문서

1. V1.1.1 설계서 작성
2. 기존 V1.0.0 Function Import 설계와 차이점 명확화
3. Backend Echo API 기준 UI5 연결 범위 확정

### 16.2 UI5 Metadata

4. `webapp/localService/mainService/metadata.xml`에 `PoCreateRequest` EntityType 추가
5. `PoCreateRequestSet` EntitySet 추가

### 16.3 UI5 View

6. Mid Column Footer에 `PO 생성` 버튼 추가
7. 버튼 활성화 조건 적용

### 16.4 UI5 i18n

8. PO 생성 버튼/확인/메시지 i18n 추가

### 16.5 UI5 Controller

9. `onCreatePo` 구현
10. `_createPoForSelectedRfq` 구현
11. `_handleCreatePoSuccess` 구현
12. `_handleCreatePoError` 구현
13. `_mapBackendMessageType` 구현
14. `_buildCreatePoMessages` 구현
15. Busy 및 중복 클릭 방어 구현
16. 성공/경고 응답 후 refresh 연결

### 16.6 테스트

17. RFQ 미선택 테스트
18. 확인 팝업 취소 테스트
19. Echo API 성공 테스트
20. Backend `MessageType = E` 가정 테스트
21. OData error callback 테스트
22. refresh 후 Mid Column 유지 확인

### 16.7 후속 Backend

23. Backend 실제 RFQ Header 검증 구현
24. RFQ Item/MQ Item 조회 구현
25. 생성/제외/오류 대상 분류 구현
26. PO Header 그룹핑 구현
27. SNRO 채번 구현
28. PO Header/Item INSERT 구현
29. PR 참조 갱신 구현
30. Commit/Rollback 구현
31. 실제 생성 후 UI5 회귀 테스트

---

## 17. 최종 요약

| 구분 | V1.1.1 기준 |
|---|---|
| Backend API | `PoCreateRequestSet + CREATE_ENTITY` |
| UI5 호출 | `oModel.create("/PoCreateRequestSet", { RfqNo: sRfqNo })` |
| 기존 Function Import | 사용하지 않음 |
| 현재 Backend 상태 | Echo 응답 성공, 실제 PO 생성 미구현 |
| 실제 DPC_EXT 메소드 | `POCREATEREQUESTS_CREATE_ENTITY` |
| UI 버튼 위치 | Mid Column Footer |
| 메시지 표시 | 기존 `processMessages` + Footer `MessagePopover` |
| 성공 후 갱신 | RFQHeaderSet/RFQItemSet/MQCompareSet/Chart/KPI refresh |
| 설계 핵심 | UI5는 RFQ 번호만 전달하고, 생성 가능 여부와 PO 생성은 Backend가 담당 |

