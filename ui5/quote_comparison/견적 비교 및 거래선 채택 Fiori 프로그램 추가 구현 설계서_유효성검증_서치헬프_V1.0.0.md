# 견적 비교 및 거래선 채택 Fiori 프로그램 추가 구현 설계서

- 문서명: 유효성 검증 및 서치헬프 추가 구현 설계서
- 버전: V1.0.0
- 작성일: 2026-06-01
- 대상 프로그램: [MM] 견적 비교 및 거래선 채택 Fiori 프로그램
- 대상 경로: `D:\sapcodeproject_usb\ui5\quote_comparison`

---

## 1. 문서 목적

본 문서는 기존에 개발된 견적 비교 및 거래선 채택 Fiori 프로그램에 다음 기능을 추가하기 위한 상세 설계서이다.

1. 조회조건 입력값에 대한 유효성 검증 기능
2. 유효성 오류를 Footer MessagePopover로 표시하는 기능
3. RFQ 번호, 공급업체, 자재, 플랜트, MM견적, 회사코드, 구매조직, 구매그룹에 대한 Search Help 기능
4. Search Help 선택 시 관련 명칭 필드를 자동 입력하는 기능

기존 프로그램의 핵심 기능인 RFQ 조회, KPI, RFQ Item 조회, MQ 비교, 차트, MQ 상세조회, 채택/채택취소 처리는 유지한다. 본 설계는 해당 기능을 되돌리거나 구조를 크게 바꾸지 않고, 조회조건 영역의 사용성과 입력 안정성을 보강하는 것을 목표로 한다.

---

## 2. 기준 및 참고 자료

### 2.1 SAPUI5 공식 기준

- SAPUI5 Demo Kit 1.120.44
  - `sap.m.MessagePopover`
  - `sap.m.MessageItem`
  - `sap.m.TableSelectDialog`
  - `sap.m.Input`
  - `sap.m.DatePicker`
  - `sap.m.Bar`, `sap.m.OverflowToolbar`
- Fiori Design Guidelines
  - 오류 메시지는 사용자가 문제 위치와 해결 방법을 알 수 있도록 명확하게 제공한다.
  - 여러 입력 오류가 있는 경우 MessagePopover처럼 한 곳에서 오류 목록을 확인할 수 있는 패턴을 사용한다.
  - 값 도움말은 사용자가 정확한 코드를 모를 때 검색과 선택을 통해 입력할 수 있게 제공한다.

### 2.2 프로젝트 내부 참고 자료

- 기존 견적 비교 및 거래선 채택 프로그램 설계서 V2.1.0
- 현재 `quote_comparison` UI5 코드
- 납기지연 및 미입고 현황 조회 Fiori 프로그램
  - Footer 기반 MessagePopover 유효성 검증 패턴
  - `TableSelectDialog` 기반 Search Help 패턴
  - 공급업체코드 선택 시 공급업체명 자동 입력 패턴
  - 자재코드 선택 시 자재명 자동 입력 패턴

---

## 3. 인터뷰 확정 사항

| 구분 | 확정 내용 |
|---|---|
| 유효성 오류 표시 방식 | Footer 영역에 MessagePopover 버튼을 표시한다. |
| UX 기준 | 납기지연 및 미입고 현황 조회 프로그램과 동일한 Footer UX를 따른다. |
| Search Help 방식 | `sap.m.TableSelectDialog`를 사용한다. |
| Search Help 데이터 소스 | CDS View 기반 OData를 사용한다. |
| 기존 CDS 재사용 | 플랜트, 공급업체, 자재, 회사코드는 기존 납기지연 프로그램에서 사용한 CDS OData를 재사용한다. |
| 신규 CDS 필요 | RFQ 번호, MM견적(MQ)번호는 신규 CDS View 및 OData가 필요하다. |
| Search Help 대상 | RFQ 번호, 공급업체코드, 자재코드, 플랜트 코드, MM견적(MQ)번호, 회사코드, 구매조직, 구매그룹 |
| 자동 입력 | 공급업체코드 선택 시 공급업체명 자동 입력, 자재코드 선택 시 자재명 자동 입력 |
| 기타 미확정 항목 | 별도 언급이 없는 항목은 구현 추천안 기준으로 진행한다. |

---

## 4. 현재 코드 상태 요약

### 4.1 조회조건 필드

현재 View의 조회조건은 기본조건과 상세조건으로 나뉜다.

| 영역 | 필드 | Control ID | 바인딩 경로 |
|---|---|---|---|
| 기본조건 | RFQ 번호 | `idRfqNoInput` | `filter>/RfqNo` |
| 기본조건 | 문서일자 From | `idDocDateFromPicker` | `filter>/DocDateFrom` |
| 기본조건 | 문서일자 To | `idDocDateToPicker` | `filter>/DocDateTo` |
| 기본조건 | 채택상태 | `idAwardStatusCombo` | `filter>/AwardStatus` |
| 상세조건 | 공급업체코드 | `idLifnrInput` | `filter>/Lifnr` |
| 상세조건 | 공급업체명 | `idName1Input` | `filter>/Name1` |
| 상세조건 | 자재코드 | `idMatnrInput` | `filter>/Matnr` |
| 상세조건 | 자재명 | `idMaktxInput` | `filter>/Maktx` |
| 상세조건 | 플랜트 | `idWerksInput` | `filter>/Werks` |
| 상세조건 | 납기일 From | `idEindtFromPicker` | `filter>/EindtFrom` |
| 상세조건 | 납기일 To | `idEindtToPicker` | `filter>/EindtTo` |
| 상세조건 | MM견적(MQ)번호 | `idMqNoInput` | `filter>/MqNo` |
| 상세조건 | 회사코드 | `idBukrsInput` | `filter>/Bukrs` |
| 상세조건 | 구매조직 | `idEkorgInput` | `filter>/Ekorg` |
| 상세조건 | 구매그룹 | `idEkgrpInput` | `filter>/Ekgrp` |

### 4.2 현재 메시지 처리

현재 프로그램에는 `MessageToast` 기반 간단 메시지 출력 로직이 있다.

- 성공 메시지, 안내 메시지는 `MessageToast` 유지
- 유효성 검증 오류는 신규 `MessagePopover`로 분리
- Backend business exception은 향후 `MessageBox` 또는 별도 오류 메시지 표시 로직으로 확장

---

## 5. 구현 범위

### 5.1 포함 범위

1. 조회조건 유효성 검증
2. 유효성 오류 MessagePopover 표시
3. 유효성 오류 발생 필드 ValueState 표시
4. 오류 메시지 선택 시 해당 필드로 포커스 이동
5. 상세조건 오류 발생 시 상세조건 영역 자동 펼침
6. Search Help 아이콘 표시
7. TableSelectDialog 공통 생성 로직
8. Search Help 선택값을 filter model에 반영
9. 공급업체명, 자재명 자동 입력
10. Search Help 관련 i18n 문구 추가

### 5.2 제외 범위

1. RFQ 번호 Search Help용 CDS View 실제 ABAP 생성
2. MQ 번호 Search Help용 CDS View 실제 ABAP 생성
3. 구매조직, 구매그룹 Search Help용 CDS View 실제 ABAP 생성
4. Gateway Service 등록 및 SEGW 확장
5. Backend business exception 구조 변경
6. 채택/채택취소 프로세스 변경

단, 제외 범위에 해당하는 Backend 작업이 완료되면 UI5 manifest의 dataSource와 named model만 연결하여 Search Help를 활성화할 수 있도록 설계한다.

---

## 6. 유효성 검증 설계

### 6.1 기본 방향

조회 버튼을 누르면 OData 조회를 실행하기 전에 Frontend 유효성 검증을 먼저 수행한다.

검증 오류가 없을 때만 기존 RFQ Header 조회 로직을 실행한다. 검증 오류가 하나라도 있으면 조회를 중단하고 Footer MessagePopover를 표시한다.

### 6.2 Message Model

유효성 메시지는 별도 JSONModel인 `messages` 모델에 저장한다.

```json
{
  "items": [
    {
      "type": "Error",
      "title": "문서일자 From은 문서일자 To보다 이후일 수 없습니다.",
      "subtitle": "문서일자 From",
      "description": "시작일과 종료일을 확인한 후 다시 조회하세요.",
      "controlId": "idDocDateFromPicker",
      "filterPath": "/DocDateFrom"
    }
  ],
  "count": 1,
  "buttonIcon": "sap-icon://message-error",
  "buttonType": "Negative",
  "buttonText": "오류 1건"
}
```

### 6.3 Footer 배치

Mid 컬럼에는 이미 채택/채택취소 Footer가 있다. 유효성 검증 MessagePopover는 Begin 컬럼 조회조건 기준 기능이므로 Begin ObjectPageLayout에도 Footer를 추가한다.

권장 구조는 다음과 같다.

```xml
<uxap:ObjectPageLayout
    id="idBeginObjectPage"
    showFooter="{= ${messages>/count} > 0 }">
    ...
    <uxap:footer>
        <OverflowToolbar>
            <Button
                id="idValidationMessageButton"
                icon="{messages>/buttonIcon}"
                type="{messages>/buttonType}"
                text="{messages>/buttonText}"
                tooltip="{i18n>validationMessageButtonTooltip}"
                press=".onMessagePopoverPress"/>
            <ToolbarSpacer/>
        </OverflowToolbar>
    </uxap:footer>
</uxap:ObjectPageLayout>
```

### 6.4 검증 대상 및 규칙

| 필드 | 검증 규칙 | 오류 처리 |
|---|---|---|
| RFQ 번호 | 입력 시 최대 10자리, 영문/숫자만 허용 | ValueState Error |
| 문서일자 From | 입력 시 `yyyy-MM-dd` 실제 날짜 검증 | ValueState Error |
| 문서일자 To | 입력 시 `yyyy-MM-dd` 실제 날짜 검증 | ValueState Error |
| 문서일자 From/To | From <= To | 양쪽 또는 From 필드 Error |
| 문서일자 | 회사 기준일 2020-03-15 이전 입력 불가 | ValueState Error |
| 공급업체코드 | 입력 시 최대 10자리, 영문/숫자만 허용 | ValueState Error |
| 공급업체명 | 자유 텍스트, 필수 검증 없음 | 검증 제외 |
| 자재코드 | 입력 시 최대 18자리, 영문/숫자만 허용 | ValueState Error |
| 자재명 | 자유 텍스트, 필수 검증 없음 | 검증 제외 |
| 플랜트 | 입력 시 최대 4자리, 영문/숫자만 허용 | ValueState Error |
| 납기일 From | 입력 시 `yyyy-MM-dd` 실제 날짜 검증 | ValueState Error |
| 납기일 To | 입력 시 `yyyy-MM-dd` 실제 날짜 검증 | ValueState Error |
| 납기일 From/To | From <= To | 양쪽 또는 From 필드 Error |
| 납기일 | 회사 기준일 2020-03-15 이전 입력 불가 | ValueState Error |
| MQ 번호 | 입력 시 최대 10자리, 영문/숫자만 허용 | ValueState Error |
| 회사코드 | 입력 시 최대 4자리, 영문/숫자만 허용 | ValueState Error |
| 구매조직 | 입력 시 최대 4자리, 영문/숫자만 허용 | ValueState Error |
| 구매그룹 | 입력 시 최대 3자리, 영문/숫자만 허용 | ValueState Error |
| 채택상태 | MultiComboBox 선택값 기준, 별도 검증 없음 | 검증 제외 |

### 6.5 코드 존재 여부 검증

코드 존재 여부 검증은 Search Help용 OData 연결 이후 단계적으로 적용한다.

1차 구현에서는 입력 형식, 길이, 날짜 범위 검증을 먼저 적용한다. Search Help named model 연결이 완료된 후에는 다음 존재 여부 검증을 추가한다.

| 필드 | 검증 데이터 소스 | 처리 |
|---|---|---|
| 공급업체코드 | `vendorHelp` | 존재하지 않으면 오류 |
| 자재코드 | `materialHelp` | 존재하지 않으면 오류 |
| 플랜트 | `plantHelp` | 존재하지 않으면 오류 |
| 회사코드 | `companyHelp` | 존재하지 않으면 오류 |
| RFQ 번호 | `rfqHelp` | 신규 OData 연결 후 검증 |
| MQ 번호 | `mqHelp` | 신규 OData 연결 후 검증 |
| 구매조직 | `purchOrgHelp` | OData 연결 후 검증 |
| 구매그룹 | `purchGroupHelp` | OData 연결 후 검증 |

### 6.6 Controller 함수 설계

신규 또는 확장 대상 함수는 다음과 같다.

| 함수 | 역할 |
|---|---|
| `_createEmptyValidationMessages` | messages 모델 초기 구조 생성 |
| `_validateSearchConditions` | 전체 조회조건 유효성 검증 진입점 |
| `_validateDateRange` | From/To 날짜 범위 검증 |
| `_isDateInputValueValid` | DatePicker 입력값 유효 여부 확인 |
| `_isStrictDateString` | `yyyy-MM-dd` 문자열 형식과 실제 달력 날짜 확인 |
| `_getCompanyStartDate` | 회사 기준일 `2020-03-15` 반환 |
| `_isDateBefore` | 기준일 이전 여부 확인 |
| `_validateSingleSearchCode` | 코드형 필드의 길이/허용문자 검증 |
| `_showSearchValidationErrors` | MessagePopover 표시 |
| `_clearSearchValidationStates` | 이전 ValueState 초기화 |
| `_clearValidationStateByFilterPath` | 특정 filter path의 오류 상태 제거 |
| `_setInputValueState` | Control ValueState 설정 |
| `_setValidationMessages` | messages 모델 갱신 |
| `_removeValidationMessageByInputId` | 특정 필드 메시지 제거 |
| `_getValidationMessagePopover` | MessagePopover lazy 생성 |
| `_openValidationMessagePopoverDelayed` | 렌더링 이후 MessagePopover 열기 |
| `_focusValidationTarget` | MessageItem 선택 시 대상 필드 포커스 |
| `_getValidationTargetLabel` | 오류 메시지에 표시할 필드 라벨 반환 |

### 6.7 onSearch 연계

기존 `onSearch`는 다음 흐름으로 확장한다.

```javascript
onSearch: function () {
    // 조회 전 이전 오류 상태를 초기화한다.
    this._clearSearchValidationStates();

    // Frontend 유효성 검증을 먼저 수행한다.
    if (!this._validateSearchConditions()) {
        this._showSearchValidationErrors();
        return;
    }

    // 오류가 없을 때만 기존 RFQ Header 조회 로직을 실행한다.
    this._loadRfqHeaders();
}
```

실제 구현 시 현재 `onSearch` 내부 구조에 맞게 기존 조회 로직을 별도 함수로 분리하거나, 현재 로직 앞단에 검증 로직을 삽입한다.

### 6.8 i18n 추가 문구

예상 i18n key는 다음과 같다.

```properties
validationMessageButtonTooltip=입력 오류 목록
validationErrorCount=오류 {0}건
validationMessageDescription=입력값을 확인한 후 다시 조회하세요.
validationDateFormatInvalid={0}은(는) yyyy-MM-dd 형식의 실제 날짜여야 합니다.
validationDateRangeInvalid={0}은(는) {1}보다 이후일 수 없습니다.
validationDateBeforeCompanyStart={0}은(는) 회사 기준일 2020-03-15 이전일 수 없습니다.
validationCodeLengthInvalid={0}은(는) 최대 {1}자리까지 입력할 수 있습니다.
validationCodeFormatInvalid={0}은(는) 영문과 숫자만 입력할 수 있습니다.
validationCodeNotFound={0}에 존재하지 않는 값입니다.
```

---

## 7. Search Help 설계

### 7.1 기본 방향

조회조건의 코드 입력 필드에는 `showValueHelp="true"`와 `valueHelpRequest=".onValueHelpRequest"`를 추가한다. 어떤 Search Help를 열지 구분하기 위해 각 Input에 `core:CustomData`를 부여한다.

예시는 다음과 같다.

```xml
<Input
    id="idLifnrInput"
    value="{filter>/Lifnr}"
    maxLength="10"
    showValueHelp="true"
    valueHelpRequest=".onValueHelpRequest"
    placeholder="{i18n>inputPlaceholder}">
    <customData>
        <core:CustomData key="helpType" value="VENDOR"/>
    </customData>
</Input>
```

### 7.2 Search Help 대상

| Help Type | 필드 | Control ID | 대상 모델 | OData Path | 상태 |
|---|---|---|---|---|---|
| `RFQ` | RFQ 번호 | `idRfqNoInput` | `rfqHelp` | `/ZCDS_D3_MM_RQ_HELP` | 신규 필요 |
| `VENDOR` | 공급업체코드 | `idLifnrInput` | `vendorHelp` | `/ZCDS_D3_MM_0013` | 기존 재사용 |
| `MATERIAL` | 자재코드 | `idMatnrInput` | `materialHelp` | `/ZCDS_D3_MM_0014` | 기존 재사용 |
| `PLANT` | 플랜트 | `idWerksInput` | `plantHelp` | `/ZCDS_D3_MM_0012` | 기존 재사용 |
| `MQ` | MM견적(MQ)번호 | `idMqNoInput` | `mqHelp` | `/ZCDS_D3_MM_MQ_HELP` | 신규 필요 |
| `COMPANY` | 회사코드 | `idBukrsInput` | `companyHelp` | `/ZCDS_D3_MM_0016` | 기존 재사용 |
| `PUR_ORG` | 구매조직 | `idEkorgInput` | `purchOrgHelp` | `/ZCDS_D3_MM_EKORG_HELP` | 확인 필요 |
| `PUR_GROUP` | 구매그룹 | `idEkgrpInput` | `purchGroupHelp` | `/ZCDS_D3_MM_EKGRP_HELP` | 확인 필요 |

OData Path 명칭은 Backend CDS View 및 SEGW 등록 결과에 따라 조정한다.

### 7.3 Search Help 컬럼 설계

#### 7.3.1 RFQ 번호

| 컬럼 | 필드 | 설명 |
|---|---|---|
| RFQ 번호 | `RfqNo` | 구매요청 견적요청 번호 |
| 문서일자 | `DocDate` | RFQ 문서일자 |
| 회사코드 | `Bukrs` | 회사코드 |
| 구매조직 | `Ekorg` | 구매조직 |
| 구매그룹 | `Ekgrp` | 구매그룹 |
| 채택상태 | `AwardStatusText` | 채택상태 텍스트 |

#### 7.3.2 공급업체

| 컬럼 | 필드 | 설명 |
|---|---|---|
| 공급업체코드 | `Lifnr` | Vendor 코드 |
| 공급업체명 | `Name1` | Vendor 명칭 |
| 국가 | `Land1` | 국가코드 |
| 통화 | `Waers` | 기본 통화 |

선택 시 `filter>/Lifnr`, `filter>/Name1`에 값을 입력한다.

#### 7.3.3 자재

| 컬럼 | 필드 | 설명 |
|---|---|---|
| 자재코드 | `Matnr` | Material 코드 |
| 자재명 | `Maktx` | Material 명칭 |
| 자재유형 | `Mtart` | 자재유형 |
| 기본단위 | `Meins` | 기본단위 |

선택 시 `filter>/Matnr`, `filter>/Maktx`에 값을 입력한다.

#### 7.3.4 플랜트

| 컬럼 | 필드 | 설명 |
|---|---|---|
| 플랜트 | `Werks` | Plant 코드 |
| 플랜트명 | `WerksName` | Plant 명칭 |

#### 7.3.5 MM견적(MQ)번호

| 컬럼 | 필드 | 설명 |
|---|---|---|
| MQ 번호 | `MqNo` | MM 견적 번호 |
| 공급업체코드 | `Lifnr` | 공급업체 |
| 공급업체명 | `Name1` | 공급업체명 |
| 문서일자 | `DocDate` | 견적 문서일자 |
| 응답상태 | `ResponseStatusText` | 응답상태 |

#### 7.3.6 회사코드

| 컬럼 | 필드 | 설명 |
|---|---|---|
| 회사코드 | `Bukrs` | Company Code |
| 회사명 | `BukrsName` | 회사명 |
| 통화 | `Waers` | 회사 통화 |
| 국가 | `Land1` | 국가 |

#### 7.3.7 구매조직

| 컬럼 | 필드 | 설명 |
|---|---|---|
| 구매조직 | `Ekorg` | Purchasing Organization |
| 구매조직명 | `EkorgName` | 구매조직명 |
| 회사코드 | `Bukrs` | 연결 회사코드 |

#### 7.3.8 구매그룹

| 컬럼 | 필드 | 설명 |
|---|---|---|
| 구매그룹 | `Ekgrp` | Purchasing Group |
| 구매그룹명 | `EkgrpName` | 구매그룹명 |

### 7.4 Controller 공통 함수 설계

| 함수 | 역할 |
|---|---|
| `onValueHelpRequest` | Input의 `helpType`을 읽고 Search Help 실행 |
| `_getValueHelpConfig` | helpType별 모델, path, 컬럼, 검색필드, targetPath 반환 |
| `_getValueHelpDialogSize` | Help Type별 Dialog 폭/높이 반환 |
| `_openValueHelpDialog` | TableSelectDialog 생성 및 바인딩 |
| `_buildValueHelpFilters` | Dialog 검색어를 OData Filter로 변환 |
| `_applySelectedValueHelp` | 선택된 row 값을 filter model에 반영 |
| `_formatValueHelpCell` | 날짜/금액/텍스트 등 표시값 포맷 |

### 7.5 Search Help Config 예시

```javascript
_getValueHelpConfig: function (sHelpType) {
    var mConfig = {
        VENDOR: {
            titleKey: "valueHelpVendorTitle",
            modelName: "vendorHelp",
            path: "/ZCDS_D3_MM_0013",
            keyField: "Lifnr",
            textField: "Name1",
            targetPath: "/Lifnr",
            targetTextPath: "/Name1",
            searchFields: ["Lifnr", "Name1"],
            columns: [
                { labelKey: "lifnr", field: "Lifnr" },
                { labelKey: "name1", field: "Name1" },
                { labelKey: "land1", field: "Land1" },
                { labelKey: "waers", field: "Waers" }
            ]
        }
    };

    return mConfig[sHelpType];
}
```

### 7.6 manifest 모델 추가 설계

`manifest.json`에는 Search Help용 OData model을 named model로 추가한다.

예시 구조는 다음과 같다.

```json
{
  "sap.app": {
    "dataSources": {
      "vendorHelpService": {
        "uri": "/sap/opu/odata/sap/Z.../",
        "type": "OData",
        "settings": {
          "odataVersion": "2.0"
        }
      }
    }
  },
  "sap.ui5": {
    "models": {
      "vendorHelp": {
        "dataSource": "vendorHelpService",
        "settings": {
          "useBatch": false
        }
      }
    }
  }
}
```

실제 Service URI는 기존 납기지연 프로그램의 manifest와 Gateway 등록명을 확인하여 반영한다.

---

## 8. Backend 연계 필요 사항

### 8.1 신규 필요 OData

| 대상 | 필요 여부 | 설명 |
|---|---|---|
| RFQ 번호 Search Help | 필요 | RFQ Header 기준 조회 도움말 |
| MQ 번호 Search Help | 필요 | MM견적 Header/Item 기준 조회 도움말 |
| 구매조직 Search Help | 확인 필요 | 기존 CDS가 없으면 신규 생성 |
| 구매그룹 Search Help | 확인 필요 | 기존 CDS가 없으면 신규 생성 |

### 8.2 권장 CDS 필드

#### RFQ 번호 Search Help

| 필드 | 설명 |
|---|---|
| `RfqNo` | RFQ 번호 |
| `DocDate` | 문서일자 |
| `Bukrs` | 회사코드 |
| `BukrsName` | 회사명 |
| `Ekorg` | 구매조직 |
| `EkorgName` | 구매조직명 |
| `Ekgrp` | 구매그룹 |
| `EkgrpName` | 구매그룹명 |
| `AwardStatus` | 채택상태 |
| `AwardStatusText` | 채택상태명 |

#### MQ 번호 Search Help

| 필드 | 설명 |
|---|---|
| `MqNo` | MM견적 번호 |
| `MqItem` | MM견적 Item |
| `RfqNo` | 연결 RFQ 번호 |
| `RfqItem` | 연결 RFQ Item |
| `Lifnr` | 공급업체코드 |
| `Name1` | 공급업체명 |
| `DocDate` | 문서일자 |
| `ResponseStatus` | 응답상태 |
| `ResponseStatusText` | 응답상태명 |

---

## 9. 오류 메시지 처리 기준

| 구분 | 표시 방식 | 예시 |
|---|---|---|
| 조회조건 Frontend 검증 오류 | Footer MessagePopover | 날짜 형식 오류, From/To 역전, 코드 길이 오류 |
| Search Help 데이터 없음 | MessageToast 또는 Dialog noDataText | 검색 결과 없음 |
| Search Help OData 기술 오류 | MessageBox.error | 서비스 호출 실패 |
| 채택/채택취소 Backend business 오류 | MessageBox.error | 미응답 MQ, PO 생성 MQ, 이미 채택된 MQ |
| 성공 메시지 | MessageToast | 조회 완료, 채택 완료 |

---

## 10. 테스트 케이스

### 10.1 유효성 검증

| 번호 | 시나리오 | 입력 | 기대 결과 |
|---|---|---|---|
| V-01 | 정상 조회 | 모든 조건 공백 또는 정상 값 | 기존 RFQ Header 조회 실행 |
| V-02 | 문서일자 형식 오류 | `2026-05-32` | 조회 중단, MessagePopover 표시, DatePicker Error |
| V-03 | 문서일자 From/To 역전 | From `2026-06-10`, To `2026-06-01` | 조회 중단, 날짜 범위 오류 표시 |
| V-04 | 납기일 형식 오류 | `2026-02-30` | 조회 중단, MessagePopover 표시 |
| V-05 | 납기일 From/To 역전 | From `2026-07-01`, To `2026-06-01` | 조회 중단, 날짜 범위 오류 표시 |
| V-06 | 회사 기준일 이전 | 문서일자 `2020-03-14` | 기준일 이전 오류 표시 |
| V-07 | RFQ 번호 길이 초과 | 11자리 이상 | 길이 오류 표시 |
| V-08 | 코드 특수문자 입력 | `RQ0000@001` | 형식 오류 표시 |
| V-09 | 상세조건 오류 | 상세조건 접힌 상태에서 자재코드 오류 | 상세조건 자동 펼침, 해당 필드 Error |
| V-10 | 오류 수정 후 재조회 | 오류 필드 정상값 변경 후 조회 | MessagePopover 사라지고 조회 실행 |

### 10.2 Search Help

| 번호 | 시나리오 | 기대 결과 |
|---|---|---|
| S-01 | RFQ 번호 ValueHelp 클릭 | RFQ Search Help Dialog 표시 |
| S-02 | 공급업체 ValueHelp 선택 | 공급업체코드와 공급업체명이 함께 입력 |
| S-03 | 자재 ValueHelp 선택 | 자재코드와 자재명이 함께 입력 |
| S-04 | 플랜트 ValueHelp 선택 | 플랜트 코드 입력 |
| S-05 | 회사코드 ValueHelp 선택 | 회사코드 입력 |
| S-06 | MQ 번호 ValueHelp 선택 | MQ 번호 입력 |
| S-07 | 구매조직 ValueHelp 선택 | 구매조직 입력 |
| S-08 | 구매그룹 ValueHelp 선택 | 구매그룹 입력 |
| S-09 | Dialog 검색 | 검색어 기준으로 목록 필터링 |
| S-10 | 검색 결과 없음 | Dialog에 데이터 없음 문구 표시 |

---

## 11. 개발 단계

### 1단계. 유효성 검증 기반 구조 추가

1. `manifest.json` 또는 Component 초기화 흐름에 `messages` JSONModel 추가
2. `Main.controller.js`에 MessagePopover, MessageItem import 추가
3. `_createEmptyValidationMessages`, `_setValidationMessages` 구현
4. i18n 유효성 메시지 문구 추가

### 2단계. Begin Footer MessagePopover UI 추가

1. Begin ObjectPageLayout에 `showFooter` 바인딩 추가
2. Begin Footer에 MessagePopover 버튼 추가
3. `onMessagePopoverPress` 구현
4. MessageItem 선택 시 대상 필드 포커스 이동 구현

### 3단계. 날짜 유효성 검증 구현

1. 문서일자 From/To 형식 검증
2. 납기일 From/To 형식 검증
3. From/To 범위 검증
4. 회사 기준일 `2020-03-15` 이전 입력 방지
5. 오류 발생 시 ValueState Error 표시

### 4단계. 코드형 필드 유효성 검증 구현

1. RFQ 번호, 공급업체코드, 자재코드, 플랜트, MQ 번호, 회사코드, 구매조직, 구매그룹 길이 검증
2. 영문/숫자 형식 검증
3. 상세조건 필드 오류 발생 시 상세조건 영역 자동 펼침
4. `onSearch` 앞단에 검증 로직 연결

### 5단계. Search Help UI 속성 추가

1. 대상 Input에 `showValueHelp="true"` 추가
2. `valueHelpRequest=".onValueHelpRequest"` 추가
3. `core:CustomData key="helpType"` 추가
4. 공급업체명, 자재명 자동 입력 대상 확인

### 6단계. Search Help named model 연결

1. 기존 CDS OData 확인
2. `plantHelp`, `vendorHelp`, `materialHelp`, `companyHelp` named model 추가
3. RFQ, MQ, 구매조직, 구매그룹 OData는 Backend 준비 후 추가
4. Service URI 및 EntitySet 명칭 최종 반영

### 7단계. TableSelectDialog 공통 로직 구현

1. `onValueHelpRequest` 구현
2. `_getValueHelpConfig` 구현
3. `_openValueHelpDialog` 구현
4. `_buildValueHelpFilters` 구현
5. `_applySelectedValueHelp` 구현
6. `_formatValueHelpCell` 구현

### 8단계. Search Help별 상세 설정 구현

1. 공급업체 Search Help 구현 및 명칭 자동 입력
2. 자재 Search Help 구현 및 명칭 자동 입력
3. 플랜트 Search Help 구현
4. 회사코드 Search Help 구현
5. RFQ 번호 Search Help 구현
6. MQ 번호 Search Help 구현
7. 구매조직 Search Help 구현
8. 구매그룹 Search Help 구현

### 9단계. 코드 존재 여부 검증 확장

1. Search Help OData를 이용한 코드 존재 여부 확인
2. 존재하지 않는 코드 입력 시 MessagePopover 오류 표시
3. 직접 입력값과 Search Help 선택값 모두 동일 기준으로 검증

### 10단계. 최종 QA

1. 유효성 검증 수동 테스트
2. Search Help 수동 테스트
3. 기존 RFQ 조회 기능 회귀 테스트
4. Mid 컬럼 RFQ Item, 차트, MQ 비교 목록 회귀 테스트
5. 채택/채택취소 버튼 활성화 및 처리 회귀 테스트
6. 작은 화면에서 Dialog와 Footer MessagePopover 표시 확인

---

## 12. 요약 표

| 항목 | 설계 결론 |
|---|---|
| 유효성 검증 표시 | Begin Footer MessagePopover 사용 |
| 유효성 검증 1차 범위 | 날짜 형식, 날짜 범위, 회사 기준일, 코드 길이/형식 |
| 유효성 검증 2차 범위 | Search Help OData 연결 후 코드 존재 여부 검증 |
| Search Help Control | `sap.m.TableSelectDialog` |
| Search Help 대상 | RFQ, 공급업체, 자재, 플랜트, MQ, 회사코드, 구매조직, 구매그룹 |
| 기존 OData 재사용 | 공급업체, 자재, 플랜트, 회사코드 |
| 신규 OData 필요 | RFQ 번호, MQ 번호, 구매조직, 구매그룹 |
| 자동 입력 | 공급업체명, 자재명 |
| 개발 우선순위 | 유효성 검증 먼저, 이후 Search Help 구현 |

