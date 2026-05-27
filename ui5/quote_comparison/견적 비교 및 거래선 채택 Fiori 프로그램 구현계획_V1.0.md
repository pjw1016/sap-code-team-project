# 견적 비교 및 거래선 채택 Fiori App 구현계획 V1.0

> 기준 설계서: `견적 비교 및 거래선 채택 Fiori 프로그램 설계서_V2.1.0.md`

**목표:** `quote_comparison` SAPUI5 Freestyle App에서 RFQ 조회, RFQ Item 조회, MQ 비교, MQ 상세 Dialog, MQ 채택/채택취소를 구현한다.

**Architecture:** 화면은 `sap.f.DynamicPage + sap.f.FlexibleColumnLayout + sap.m.IconTabBar` 구조로 구성한다. Backend 상태/추천/선택 가능 여부는 `ZCL_ZGWD3MM0005_DPC_EXT`가 계산한 값을 신뢰하고, UI5는 표시와 사용자 Action 연결에 집중한다.

**Tech Stack:** SAPUI5 1.120.23/1.120.44, OData V2 Model, `sap.m`, `sap.f`, `sap.ui.layout`, `sap.ui.table`, `sap.viz`, SAP Gateway Service `ZGWD3MM0005_SRV`

---

## 0. 구현 원칙

| 원칙 | 적용 방식 |
| --- | --- |
| 최신 설계서 기준 | V2.1.0 설계서만 실제 개발 기준으로 사용 |
| CSS 최소화 | `style.css`는 최소 보정만 허용 |
| Search Help 제외 | 이번 구현에서는 `showValueHelp`와 `TableSelectDialog`를 구현하지 않음 |
| Backend 계산값 신뢰 | `CanSelect`, `RecommendYn`, `CurrentAwardYn`, `BlockReason`, `CanCancelAward`를 UI에서 재계산하지 않음 |
| 단계별 검증 | 각 작업 후 `npm run build` 또는 브라우저 실행으로 확인 |
| 하드코딩 최소화 | 화면 텍스트는 가능한 `i18n.properties`로 관리 |

---

## 1. 파일 작업 범위

| 파일 | 작업 |
| --- | --- |
| `webapp/manifest.json` | 필요 UI5 library 추가, ODataModel 설정 보정 |
| `webapp/model/formatter.js` | 신규 생성, 날짜/금액/상태 표시 함수 구현 |
| `webapp/fragment/MQDetailDialog.fragment.xml` | 신규 생성, MQ 상세 Dialog 구현 |
| `webapp/view/Main.view.xml` | 전체 화면 Layout 신규 구현 |
| `webapp/controller/Main.controller.js` | Model 초기화, 조회, 선택, 저장, 오류 처리 구현 |
| `webapp/i18n/i18n.properties` | 화면 텍스트 추가 |
| `webapp/css/style.css` | 필요 시 최소 보정만 추가 |
| `webapp/test/unit/controller/Main.controller.js` | 기본 컨트롤러 생성 테스트 보정 |

---

## 2. 개발 순서 요약

```text
Task 1. manifest.json 라이브러리 보강
Task 2. i18n 텍스트 정리
Task 3. formatter.js 생성
Task 4. MQDetailDialog.fragment.xml 생성
Task 5. Main.view.xml Layout 구현
Task 6. Main.controller.js Model 초기화
Task 7. 조회조건 Filter 변환 구현
Task 8. RFQHeaderSet 조회 + KPI 계산 구현
Task 9. RFQItemSet 조회 구현
Task 10. MQCompareSet 조회 + Radio 선택 구현
Task 11. ChartRows + VizFrame 연결 구현
Task 12. MQDetailSet Dialog 연결 구현
Task 13. QuotationItemSet AWARD/CANCEL 구현
Task 14. Backend Error 파싱 + MessagePopover 구현
Task 15. Build/Mock/Gateway 테스트
```

---

## Task 1. manifest.json 라이브러리 보강

**Files:**
- Modify: `D:\sapcodeproject_usb\ui5\quote_comparison\webapp\manifest.json`

### 목표

V2.1.0에서 사용할 UI5 library를 명시한다.

### 변경 내용

`sap.ui5/dependencies/libs`에 다음 library를 추가한다.

```json
"libs": {
  "sap.m": {},
  "sap.ui.core": {},
  "sap.f": {},
  "sap.ui.layout": {},
  "sap.ui.table": {},
  "sap.viz": {}
}
```

기본 ODataModel은 Batch 제외 정책에 맞춰 설정한다.

```json
"": {
  "dataSource": "mainService",
  "preload": true,
  "settings": {
    "useBatch": false,
    "defaultCountMode": "None"
  }
}
```

### 검증

Run:

```powershell
npm run build
```

Expected:

```text
Build completes without missing library errors.
```

---

## Task 2. i18n 텍스트 정리

**Files:**
- Modify: `D:\sapcodeproject_usb\ui5\quote_comparison\webapp\i18n\i18n.properties`

### 목표

화면 텍스트를 하드코딩하지 않고 i18n으로 관리한다.

### 추가할 주요 Key

```properties
appTitle=[MM] 견적 비교 및 거래선 채택
appDescription=RFQ 기준 MQ 견적 비교 및 거래선 채택
title=[MM] 견적 비교 및 거래선 채택

filterBasicTitle=기본조건
filterAdvancedTitle=상세조건
showAdvancedFilter=상세조건
hideAdvancedFilter=상세조건 닫기
reset=초기화
search=조회

rfqNo=RFQ 번호
docDateFrom=문서일자 From
docDateTo=문서일자 To
awardStatus=채택상태
lifnr=공급업체코드
name1=공급업체명
matnr=자재코드
maktx=자재명
werks=플랜트코드
eindtFrom=납기일 From
eindtTo=납기일 To
mqNo=MM견적(MQ)번호
bukrs=회사코드
ekorg=구매조직
ekgrp=구매그룹

kpiNotAwarded=미채택 건수
kpiPartiallyAwarded=부분 채택 건수
kpiAwarded=채택 건수
kpiPoCreated=PO 생성 완료 건수
countUnit=건

rfqHeaderListTitle=RFQ 헤더 목록
selectedRfqTitle=선택 RFQ
rfqItemTabTitle=RFQ Item 목록
chartTabTitle=금액 비교 차트
mqCompareTabTitle=MQ 비교 목록

autoRecommend=자동추천 적용
saveAward=채택
cancelAward=채택취소
mqDetail=MQ 상세
close=닫기
selectThisMq=이 MQ 선택

msgSelectRfq=RFQ를 먼저 선택하세요.
msgSelectRfqItem=RFQ Item을 먼저 선택하세요.
msgSelectMq=채택할 MQ를 선택하세요.
msgAwardSuccess=견적이 채택되었습니다.
msgCancelSuccess=견적 채택이 취소되었습니다.
msgDefaultError=처리 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.
msgConfirmAward=선택한 MQ를 이 RFQ Item의 최종 거래선으로 채택하시겠습니까?
msgConfirmCancel=현재 채택된 MQ를 채택취소하시겠습니까?
```

### 검증

Run:

```powershell
npm run build
```

Expected:

```text
Build completes. Missing i18n key warnings are not expected in the browser console after screen implementation.
```

---

## Task 3. formatter.js 생성

**Files:**
- Create: `D:\sapcodeproject_usb\ui5\quote_comparison\webapp\model\formatter.js`
- Modify: `D:\sapcodeproject_usb\ui5\quote_comparison\webapp\controller\Main.controller.js`

### 목표

날짜, 수량, 금액, Boolean 표시, 상태 표시를 View에서 재사용한다.

### 구현 함수

```javascript
sap.ui.define([], function () {
    "use strict";

    return {
        formatDate: function (vDate) {
            if (!vDate) {
                return "";
            }

            if (vDate instanceof Date) {
                return vDate.toISOString().slice(0, 10);
            }

            return String(vDate).slice(0, 10);
        },

        formatQuantity: function (vValue) {
            var fValue = Number(vValue);

            if (isNaN(fValue)) {
                return "";
            }

            return fValue.toLocaleString();
        },

        formatAmount: function (vValue) {
            var fValue = Number(vValue);

            if (isNaN(fValue)) {
                return "";
            }

            return fValue.toLocaleString();
        },

        formatCurrencyAmount: function (vValue, sCurrency) {
            var fValue = Number(vValue);

            if (isNaN(fValue)) {
                return "";
            }

            return fValue.toLocaleString() + (sCurrency ? " " + sCurrency : "");
        },

        formatBooleanText: function (sValue) {
            return sValue === "X" ? "예" : "아니오";
        },

        formatBooleanState: function (sValue) {
            return sValue === "X" ? "Success" : "None";
        },

        formatCanSelectText: function (sValue) {
            return sValue === "X" ? "선택 가능" : "선택 불가";
        },

        formatCanSelectState: function (sValue) {
            return sValue === "X" ? "Success" : "Warning";
        },

        formatResponseState: function (sStatus) {
            return sStatus === "R" ? "Success" : "Warning";
        }
    };
});
```

### Controller 연결

`Main.controller.js`의 dependency에 formatter를 추가한다.

```javascript
"code/d3/quotecomparison/model/formatter"
```

Controller 안에 다음 속성을 둔다.

```javascript
formatter: formatter,
```

### 검증

Run:

```powershell
npm run build
```

Expected:

```text
formatter module resolves without UI5 loader errors.
```

---

## Task 4. MQDetailDialog.fragment.xml 생성

**Files:**
- Create: `D:\sapcodeproject_usb\ui5\quote_comparison\webapp\fragment\MQDetailDialog.fragment.xml`

### 목표

`MQDetailSet` 단건 조회 결과를 4개 섹션으로 표시한다.

### 구조

```xml
<core:FragmentDefinition
    xmlns="sap.m"
    xmlns:core="sap.ui.core"
    xmlns:form="sap.ui.layout.form">
    <Dialog
        id="idMqDetailDialog"
        title="{i18n>mqDetail}"
        contentWidth="60rem"
        contentHeight="42rem"
        resizable="true"
        draggable="true">
        <content>
            <VBox class="sapUiSmallMargin">
                <Title text="1. 기본정보" level="H3"/>
                <form:SimpleForm editable="false" layout="ResponsiveGridLayout">
                    <Label text="{i18n>rfqNo}"/>
                    <Text text="{detail>/MqDetail/RfqNo}"/>
                    <Label text="RFQ Item"/>
                    <Text text="{detail>/MqDetail/RfqItem}"/>
                    <Label text="{i18n>mqNo}"/>
                    <Text text="{detail>/MqDetail/MqNo}"/>
                    <Label text="MQ Item"/>
                    <Text text="{detail>/MqDetail/MqItem}"/>
                    <Label text="{i18n>lifnr}"/>
                    <Text text="{detail>/MqDetail/Lifnr}"/>
                    <Label text="{i18n>name1}"/>
                    <Text text="{detail>/MqDetail/Name1}"/>
                    <Label text="{i18n>matnr}"/>
                    <Text text="{detail>/MqDetail/Matnr}"/>
                    <Label text="{i18n>maktx}"/>
                    <Text text="{detail>/MqDetail/Maktx}"/>
                </form:SimpleForm>

                <Title text="2. 견적정보" level="H3"/>
                <form:SimpleForm editable="false" layout="ResponsiveGridLayout">
                    <Label text="견적수량"/>
                    <ObjectNumber number="{path:'detail>/MqDetail/QuoteQty', formatter:'.formatter.formatQuantity'}" unit="{detail>/MqDetail/Meins}"/>
                    <Label text="원통화 금액"/>
                    <ObjectNumber number="{path:'detail>/MqDetail/Netwr', formatter:'.formatter.formatAmount'}" unit="{detail>/MqDetail/Waers}"/>
                    <Label text="환율"/>
                    <Text text="{detail>/MqDetail/Kursf}"/>
                    <Label text="환산금액(KRW)"/>
                    <ObjectNumber number="{path:'detail>/MqDetail/NetwrKrw', formatter:'.formatter.formatAmount'}" unit="{detail>/MqDetail/Kwaers}"/>
                    <Label text="납기일"/>
                    <Text text="{path:'detail>/MqDetail/Eindt', formatter:'.formatter.formatDate'}"/>
                </form:SimpleForm>

                <Title text="3. 참조정보" level="H3"/>
                <form:SimpleForm editable="false" layout="ResponsiveGridLayout">
                    <Label text="{i18n>bukrs}"/>
                    <Text text="{detail>/MqDetail/Bukrs}"/>
                    <Label text="{i18n>ekorg}"/>
                    <Text text="{detail>/MqDetail/Ekorg}"/>
                    <Label text="{i18n>ekgrp}"/>
                    <Text text="{detail>/MqDetail/Ekgrp}"/>
                    <Label text="PR 번호"/>
                    <Text text="{detail>/MqDetail/Banfn}"/>
                    <Label text="지급조건"/>
                    <Text text="{detail>/MqDetail/Zterm}"/>
                </form:SimpleForm>

                <Title text="4. 상태정보" level="H3"/>
                <form:SimpleForm editable="false" layout="ResponsiveGridLayout">
                    <Label text="응답상태"/>
                    <ObjectStatus text="{detail>/MqDetail/ResponseStatusText}" state="{path:'detail>/MqDetail/ResponseStatus', formatter:'.formatter.formatResponseState'}"/>
                    <Label text="현재채택"/>
                    <ObjectStatus text="{path:'detail>/MqDetail/CurrentAwardYn', formatter:'.formatter.formatBooleanText'}" state="{path:'detail>/MqDetail/CurrentAwardYn', formatter:'.formatter.formatBooleanState'}"/>
                    <Label text="자동추천"/>
                    <ObjectStatus text="{path:'detail>/MqDetail/RecommendYn', formatter:'.formatter.formatBooleanText'}" state="{path:'detail>/MqDetail/RecommendYn', formatter:'.formatter.formatBooleanState'}"/>
                    <Label text="선택가능"/>
                    <ObjectStatus text="{path:'detail>/MqDetail/CanSelect', formatter:'.formatter.formatCanSelectText'}" state="{path:'detail>/MqDetail/CanSelect', formatter:'.formatter.formatCanSelectState'}"/>
                    <Label text="선택불가사유"/>
                    <Text text="{detail>/MqDetail/BlockReason}"/>
                </form:SimpleForm>
            </VBox>
        </content>
        <beginButton>
            <Button
                text="{i18n>selectThisMq}"
                type="Emphasized"
                enabled="{= ${detail>/MqDetail/CanSelect} === 'X' }"
                press=".onSelectMqFromDialog"/>
        </beginButton>
        <endButton>
            <Button text="{i18n>close}" press=".onCloseMqDetailDialog"/>
        </endButton>
    </Dialog>
</core:FragmentDefinition>
```

### 검증

Run:

```powershell
npm run build
```

Expected:

```text
XML fragment parses without namespace or binding syntax errors.
```

---

## Task 5. Main.view.xml Layout 구현

**Files:**
- Modify: `D:\sapcodeproject_usb\ui5\quote_comparison\webapp\view\Main.view.xml`

### 목표

V2.1.0 기준 화면 골격을 구현한다.

### Namespace

```xml
xmlns:mvc="sap.ui.core.mvc"
xmlns="sap.m"
xmlns:core="sap.ui.core"
xmlns:f="sap.f"
xmlns:form="sap.ui.layout.form"
xmlns:table="sap.ui.table"
xmlns:viz="sap.viz.ui5.controls"
xmlns:viz.data="sap.viz.ui5.data"
xmlns:viz.feeds="sap.viz.ui5.controls.common.feeds"
```

### 상위 구조

```xml
<mvc:View
    controllerName="code.d3.quotecomparison.controller.Main"
    xmlns:mvc="sap.ui.core.mvc"
    xmlns="sap.m"
    xmlns:core="sap.ui.core"
    xmlns:f="sap.f"
    xmlns:form="sap.ui.layout.form"
    xmlns:table="sap.ui.table"
    xmlns:viz="sap.viz.ui5.controls"
    xmlns:viz.data="sap.viz.ui5.data"
    xmlns:viz.feeds="sap.viz.ui5.controls.common.feeds">
    <f:DynamicPage id="idDynamicPage" showFooter="true" busy="{view>/Busy}">
        <f:title>
            <f:DynamicPageTitle>
                <f:heading>
                    <Title text="{i18n>title}"/>
                </f:heading>
            </f:DynamicPageTitle>
        </f:title>
        <f:header>
            <!-- 조회조건 구현 -->
        </f:header>
        <f:content>
            <!-- FlexibleColumnLayout 구현 -->
        </f:content>
        <f:footer>
            <!-- Action Toolbar 구현 -->
        </f:footer>
    </f:DynamicPage>
</mvc:View>
```

### 포함할 영역

| 영역 | 구현 Control |
| --- | --- |
| 조회조건 | `form:SimpleForm`, `Input`, `DatePicker`, `MultiComboBox` |
| KPI | `HBox`, `GenericTile`, `NumericContent` |
| RFQ Header | `sap.m.Table` |
| Mid Column | `IconTabBar` |
| RFQ Item | `sap.m.Table` |
| Chart | `VizFrame` |
| MQ Compare | `sap.ui.table.Table` |
| Footer | `OverflowToolbar`, `Button` |

### 검증

Run:

```powershell
npm run build
```

Expected:

```text
Main.view.xml parses without XML namespace errors.
```

---

## Task 6. Main.controller.js Model 초기화

**Files:**
- Modify: `D:\sapcodeproject_usb\ui5\quote_comparison\webapp\controller\Main.controller.js`

### 목표

화면에 필요한 JSONModel을 초기화한다.

### Dependency

```javascript
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "code/d3/quotecomparison/model/formatter"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, MessageBox, Fragment, formatter) {
```

### onInit 구조

```javascript
onInit: function () {
    this.formatter = formatter;
    this._pMqDetailDialog = null;
    this._initModels();
},
```

### _initModels

```javascript
_initModels: function () {
    this.getView().setModel(new JSONModel({
        RfqNo: "",
        DocDateFrom: null,
        DocDateTo: null,
        AwardStatus: [],
        Lifnr: "",
        Name1: "",
        Matnr: "",
        Maktx: "",
        Werks: "",
        EindtFrom: null,
        EindtTo: null,
        MqNo: "",
        Bukrs: "",
        Ekorg: "",
        Ekgrp: ""
    }), "filter");

    this.getView().setModel(new JSONModel({
        Busy: false,
        AdvancedFilterVisible: false,
        HasRfqSelected: false,
        HasRfqItemSelected: false,
        HasMqRows: false,
        CanAutoRecommend: false,
        CanSaveAward: false,
        CanCancelAward: false,
        CanOpenMqDetail: false,
        SelectedTabKey: "items",
        SelectedRfqTitle: "",
        SelectedItemTitle: ""
    }), "view");

    this.getView().setModel(new JSONModel({
        CurrentRfqNo: "",
        CurrentRfqItem: "",
        SelectedMq: {},
        RfqHeaders: [],
        RfqItems: [],
        MqCompareRows: [],
        ChartRows: [],
        Kpi: {
            NotAwarded: 0,
            PartiallyAwarded: 0,
            Awarded: 0,
            PoCreated: 0
        }
    }), "work");

    this.getView().setModel(new JSONModel({
        Messages: []
    }), "message");

    this.getView().setModel(new JSONModel({
        MqDetail: {}
    }), "detail");
}
```

### 검증

Run:

```powershell
npm run build
```

Expected:

```text
Controller loads and all named models are available.
```

---

## Task 7. 조회조건 Filter 변환 구현

**Files:**
- Modify: `D:\sapcodeproject_usb\ui5\quote_comparison\webapp\controller\Main.controller.js`

### 목표

V2.1.0 기준으로 UI 내부 From/To 값을 Backend가 이해하는 OData Property로 변환한다.

### 구현 함수

```javascript
_buildHeaderFilters: function () {
    var oFilter = this.getView().getModel("filter").getData();
    var aFilters = [];

    if (oFilter.RfqNo) {
        aFilters.push(new Filter("RfqNo", FilterOperator.EQ, oFilter.RfqNo));
    }

    if (oFilter.DocDateFrom) {
        aFilters.push(new Filter("DocDate", FilterOperator.GE, oFilter.DocDateFrom));
    }

    if (oFilter.DocDateTo) {
        aFilters.push(new Filter("DocDate", FilterOperator.LE, oFilter.DocDateTo));
    }

    if (oFilter.Lifnr) {
        aFilters.push(new Filter("Lifnr", FilterOperator.EQ, oFilter.Lifnr));
    }

    if (oFilter.Name1) {
        aFilters.push(new Filter("Name1", FilterOperator.Contains, oFilter.Name1));
    }

    if (oFilter.Matnr) {
        aFilters.push(new Filter("Matnr", FilterOperator.EQ, oFilter.Matnr));
    }

    if (oFilter.Maktx) {
        aFilters.push(new Filter("Maktx", FilterOperator.Contains, oFilter.Maktx));
    }

    if (oFilter.Werks) {
        aFilters.push(new Filter("Werks", FilterOperator.EQ, oFilter.Werks));
    }

    if (oFilter.EindtFrom) {
        aFilters.push(new Filter("Eindt", FilterOperator.GE, oFilter.EindtFrom));
    }

    if (oFilter.EindtTo) {
        aFilters.push(new Filter("Eindt", FilterOperator.LE, oFilter.EindtTo));
    }

    if (oFilter.MqNo) {
        aFilters.push(new Filter("MqNo", FilterOperator.EQ, oFilter.MqNo));
    }

    if (oFilter.Bukrs) {
        aFilters.push(new Filter("Bukrs", FilterOperator.EQ, oFilter.Bukrs));
    }

    if (oFilter.Ekorg) {
        aFilters.push(new Filter("Ekorg", FilterOperator.EQ, oFilter.Ekorg));
    }

    if (oFilter.Ekgrp) {
        aFilters.push(new Filter("Ekgrp", FilterOperator.EQ, oFilter.Ekgrp));
    }

    this._appendAwardStatusFilters(aFilters, oFilter.AwardStatus);

    return aFilters;
},

_appendAwardStatusFilters: function (aFilters, aAwardStatus) {
    var aStatusFilters;

    if (!Array.isArray(aAwardStatus) || aAwardStatus.length === 0) {
        return;
    }

    aStatusFilters = aAwardStatus.map(function (sKey) {
        return new Filter("AwardStatus", FilterOperator.EQ, sKey);
    });

    aFilters.push(new Filter({
        filters: aStatusFilters,
        and: false
    }));
}
```

### 검증

Run:

```powershell
npm run build
```

Expected:

```text
Build succeeds. Browser Network tab shows DocDate/Eindt, not DocDateFrom/EindtFrom, in OData filters.
```

---

## Task 8. RFQHeaderSet 조회 + KPI 계산 구현

**Files:**
- Modify: `D:\sapcodeproject_usb\ui5\quote_comparison\webapp\controller\Main.controller.js`

### 목표

조회 버튼 클릭 시 RFQ Header 목록과 KPI를 갱신한다.

### 구현 함수

```javascript
onSearch: function () {
    if (!this._validateSearchFilters()) {
        return;
    }

    this._clearSelectionBelowRfq();
    this._loadRfqHeaders();
},

_loadRfqHeaders: function () {
    var oModel = this.getView().getModel();
    var oWorkModel = this.getView().getModel("work");
    var aFilters = this._buildHeaderFilters();

    this._setBusy(true);

    oModel.read("/RFQHeaderSet", {
        filters: aFilters,
        success: function (oData) {
            var aRows = oData.results || [];

            oWorkModel.setProperty("/RfqHeaders", aRows);
            this._calculateKpi(aRows);
            this._setBusy(false);
        }.bind(this),
        error: function (oError) {
            this._setBusy(false);
            this._showBackendError(oError);
        }.bind(this)
    });
},

_calculateKpi: function (aRows) {
    var oKpi = {
        NotAwarded: 0,
        PartiallyAwarded: 0,
        Awarded: 0,
        PoCreated: 0
    };

    aRows.forEach(function (oRow) {
        if (oRow.AwardStatus === "N") {
            oKpi.NotAwarded += 1;
        } else if (oRow.AwardStatus === "P") {
            oKpi.PartiallyAwarded += 1;
        } else if (oRow.AwardStatus === "A") {
            oKpi.Awarded += 1;
        } else if (oRow.AwardStatus === "PO") {
            oKpi.PoCreated += 1;
        }
    });

    this.getView().getModel("work").setProperty("/Kpi", oKpi);
}
```

### 검증

Run:

```powershell
npm run start-mock
```

Expected:

```text
App opens. Clicking 조회 calls RFQHeaderSet. Header table and KPI model are updated.
```

---

## Task 9. RFQItemSet 조회 구현

**Files:**
- Modify: `D:\sapcodeproject_usb\ui5\quote_comparison\webapp\controller\Main.controller.js`

### 목표

RFQ Header 선택 시 RFQ Item 목록을 조회한다.

### 구현 함수

```javascript
onRfqSelectionChange: function (oEvent) {
    var oItem = oEvent.getParameter("listItem");
    var oContext = oItem && oItem.getBindingContext("work");
    var oRfq;

    if (!oContext) {
        return;
    }

    oRfq = oContext.getObject();

    this.getView().getModel("work").setProperty("/CurrentRfqNo", oRfq.RfqNo);
    this.getView().getModel("view").setProperty("/HasRfqSelected", true);
    this.getView().getModel("view").setProperty("/SelectedRfqTitle", oRfq.RfqNo);
    this.getView().getModel("view").setProperty("/SelectedTabKey", "items");

    this._clearSelectionBelowItem();
    this._loadRfqItems(oRfq.RfqNo);
},

_loadRfqItems: function (sRfqNo) {
    var oModel = this.getView().getModel();
    var oWorkModel = this.getView().getModel("work");

    this._setBusy(true);

    oModel.read("/RFQItemSet", {
        filters: [
            new Filter("RfqNo", FilterOperator.EQ, sRfqNo)
        ],
        success: function (oData) {
            oWorkModel.setProperty("/RfqItems", oData.results || []);
            this._setBusy(false);
        }.bind(this),
        error: function (oError) {
            this._setBusy(false);
            this._showBackendError(oError);
        }.bind(this)
    });
}
```

### 검증

Run:

```powershell
npm run start-mock
```

Expected:

```text
Selecting an RFQ calls RFQItemSet with RfqNo filter and fills the RFQ Item tab.
```

---

## Task 10. MQCompareSet 조회 + Radio 선택 구현

**Files:**
- Modify: `D:\sapcodeproject_usb\ui5\quote_comparison\webapp\controller\Main.controller.js`

### 목표

RFQ Item 선택 시 MQ 후보를 조회하고, `CanSelect` 기준으로 RadioButton을 제어한다.

### 구현 함수

```javascript
onRfqItemSelectionChange: function (oEvent) {
    var oItem = oEvent.getParameter("listItem");
    var oContext = oItem && oItem.getBindingContext("work");
    var oRfqItem;

    if (!oContext) {
        return;
    }

    oRfqItem = oContext.getObject();

    this.getView().getModel("work").setProperty("/CurrentRfqItem", oRfqItem.RfqItem);
    this.getView().getModel("view").setProperty("/HasRfqItemSelected", true);
    this.getView().getModel("view").setProperty("/CanCancelAward", oRfqItem.CanCancelAward === "X");
    this.getView().getModel("view").setProperty("/SelectedItemTitle", oRfqItem.RfqItem + " / " + (oRfqItem.Maktx || ""));

    this._loadMqCompare(oRfqItem.RfqNo, oRfqItem.RfqItem);
},

_loadMqCompare: function (sRfqNo, sRfqItem) {
    var oModel = this.getView().getModel();
    var oWorkModel = this.getView().getModel("work");

    this._setBusy(true);

    oModel.read("/MQCompareSet", {
        filters: [
            new Filter("RfqNo", FilterOperator.EQ, sRfqNo),
            new Filter("RfqItem", FilterOperator.EQ, sRfqItem)
        ],
        success: function (oData) {
            var aRows = oData.results || [];

            aRows.forEach(function (oRow) {
                oRow.UiSelected = false;
            });

            oWorkModel.setProperty("/MqCompareRows", aRows);
            this._prepareChartRows(aRows);
            this._updateMqActionState();
            this._setBusy(false);
        }.bind(this),
        error: function (oError) {
            this._setBusy(false);
            this._showBackendError(oError);
        }.bind(this)
    });
},

onMqRadioSelect: function (oEvent) {
    var oContext = oEvent.getSource().getBindingContext("work");
    var oRow = oContext && oContext.getObject();

    if (!oRow || oRow.CanSelect !== "X") {
        return;
    }

    this._setSelectedMq(oRow);
},

_setSelectedMq: function (oSelectedRow) {
    var oWorkModel = this.getView().getModel("work");
    var aRows = oWorkModel.getProperty("/MqCompareRows") || [];

    aRows.forEach(function (oRow) {
        oRow.UiSelected = oRow.MqNo === oSelectedRow.MqNo && oRow.MqItem === oSelectedRow.MqItem;
    });

    oWorkModel.setProperty("/MqCompareRows", aRows);
    oWorkModel.setProperty("/SelectedMq", {
        RfqNo: oSelectedRow.RfqNo,
        RfqItem: oSelectedRow.RfqItem,
        MqNo: oSelectedRow.MqNo,
        MqItem: oSelectedRow.MqItem,
        Lifnr: oSelectedRow.Lifnr,
        Name1: oSelectedRow.Name1
    });

    this.getView().getModel("view").setProperty("/CanSaveAward", true);
    this.getView().getModel("view").setProperty("/CanOpenMqDetail", true);
}
```

### 검증

Run:

```powershell
npm run start-mock
```

Expected:

```text
Selecting an RFQ Item calls MQCompareSet. Only CanSelect = X rows can be selected.
```

---

## Task 11. ChartRows + VizFrame 연결 구현

**Files:**
- Modify: `D:\sapcodeproject_usb\ui5\quote_comparison\webapp\controller\Main.controller.js`
- Modify: `D:\sapcodeproject_usb\ui5\quote_comparison\webapp\view\Main.view.xml`

### 목표

Backend `NetwrKrw` 기준으로 금액 비교 Bar Chart를 표시한다.

### Controller 구현

```javascript
_prepareChartRows: function (aRows) {
    var aChartRows = (aRows || []).filter(function (oRow) {
        return oRow.ResponseStatus !== "N" && Number(oRow.NetwrKrw) > 0;
    }).map(function (oRow) {
        return {
            Vendor: oRow.Name1 || oRow.MqNo,
            MqNo: oRow.MqNo,
            NetwrKrw: Number(oRow.NetwrKrw),
            RecommendYn: oRow.RecommendYn,
            CurrentAwardYn: oRow.CurrentAwardYn
        };
    });

    this.getView().getModel("work").setProperty("/ChartRows", aChartRows);
    this.getView().getModel("view").setProperty("/HasMqRows", aRows.length > 0);
    this.getView().getModel("view").setProperty("/CanAutoRecommend", aRows.some(function (oRow) {
        return oRow.RecommendYn === "X" && oRow.CanSelect === "X";
    }));
}
```

### View 핵심 구조

```xml
<viz:VizFrame
    id="idMqAmountChart"
    vizType="bar"
    width="100%"
    height="20rem">
    <viz:dataset>
        <viz.data:FlattenedDataset data="{work>/ChartRows}">
            <viz.data:dimensions>
                <viz.data:DimensionDefinition name="공급업체" value="{work>Vendor}"/>
            </viz.data:dimensions>
            <viz.data:measures>
                <viz.data:MeasureDefinition name="환산금액(KRW)" value="{work>NetwrKrw}"/>
            </viz.data:measures>
        </viz.data:FlattenedDataset>
    </viz:dataset>
    <viz:feeds>
        <viz.feeds:FeedItem uid="valueAxis" type="Measure" values="환산금액(KRW)"/>
        <viz.feeds:FeedItem uid="categoryAxis" type="Dimension" values="공급업체"/>
    </viz:feeds>
</viz:VizFrame>
```

### 검증

Run:

```powershell
npm run start-mock
```

Expected:

```text
Chart tab shows a bar chart when MQCompareSet returns valid NetwrKrw values.
```

---

## Task 12. MQDetailSet Dialog 연결 구현

**Files:**
- Modify: `D:\sapcodeproject_usb\ui5\quote_comparison\webapp\controller\Main.controller.js`

### 목표

MQ 상세 버튼 또는 Row Action으로 `MQDetailSet`을 조회하고 Dialog를 연다.

### 구현 함수

```javascript
onOpenSelectedMqDetail: function () {
    var oSelectedMq = this.getView().getModel("work").getProperty("/SelectedMq");

    if (!oSelectedMq || !oSelectedMq.MqNo || !oSelectedMq.MqItem) {
        MessageToast.show(this.getView().getModel("i18n").getResourceBundle().getText("msgSelectMq"));
        return;
    }

    this._loadMqDetail(oSelectedMq.MqNo, oSelectedMq.MqItem);
},

onMqRowPress: function (oEvent) {
    var oContext = oEvent.getSource().getBindingContext("work");
    var oRow = oContext && oContext.getObject();

    if (!oRow) {
        return;
    }

    this._loadMqDetail(oRow.MqNo, oRow.MqItem);
},

_loadMqDetail: function (sMqNo, sMqItem) {
    var oModel = this.getView().getModel();
    var sPath = "/MQDetailSet(MqNo='" + encodeURIComponent(sMqNo) + "',MqItem='" + encodeURIComponent(sMqItem) + "')";

    this._setBusy(true);

    oModel.read(sPath, {
        success: function (oData) {
            this.getView().getModel("detail").setProperty("/MqDetail", oData);
            this._openMqDetailDialog();
            this._setBusy(false);
        }.bind(this),
        error: function (oError) {
            this._setBusy(false);
            this._showBackendError(oError);
        }.bind(this)
    });
},

_openMqDetailDialog: function () {
    var oView = this.getView();

    if (!this._pMqDetailDialog) {
        this._pMqDetailDialog = Fragment.load({
            id: oView.getId(),
            name: "code.d3.quotecomparison.fragment.MQDetailDialog",
            controller: this
        }).then(function (oDialog) {
            oView.addDependent(oDialog);
            return oDialog;
        });
    }

    this._pMqDetailDialog.then(function (oDialog) {
        oDialog.open();
    });
},

onCloseMqDetailDialog: function () {
    var oDialog = this.byId("idMqDetailDialog");

    if (oDialog) {
        oDialog.close();
    }
},

onSelectMqFromDialog: function () {
    var oDetail = this.getView().getModel("detail").getProperty("/MqDetail");
    var aRows = this.getView().getModel("work").getProperty("/MqCompareRows") || [];
    var oRow = aRows.find(function (oItem) {
        return oItem.MqNo === oDetail.MqNo && oItem.MqItem === oDetail.MqItem;
    });

    if (oRow && oRow.CanSelect === "X") {
        this._setSelectedMq(oRow);
        this.onCloseMqDetailDialog();
    }
}
```

### 검증

Run:

```powershell
npm run start-mock
```

Expected:

```text
MQ 상세 button opens Dialog with MQDetailSet data. 이 MQ 선택 only works for CanSelect = X.
```

---

## Task 13. QuotationItemSet AWARD/CANCEL 구현

**Files:**
- Modify: `D:\sapcodeproject_usb\ui5\quote_comparison\webapp\controller\Main.controller.js`

### 목표

단건 MERGE로 채택/채택취소를 처리하고 성공 후 재조회한다.

### 구현 함수

```javascript
onSaveAward: function () {
    var oBundle = this.getView().getModel("i18n").getResourceBundle();
    var oSelectedMq = this.getView().getModel("work").getProperty("/SelectedMq");

    if (!oSelectedMq || !oSelectedMq.MqNo || !oSelectedMq.MqItem) {
        MessageToast.show(oBundle.getText("msgSelectMq"));
        return;
    }

    MessageBox.confirm(oBundle.getText("msgConfirmAward"), {
        onClose: function (sAction) {
            if (sAction === MessageBox.Action.OK) {
                this._updateQuotationItem(oSelectedMq.MqNo, oSelectedMq.MqItem, "AWARD", oBundle.getText("msgAwardSuccess"));
            }
        }.bind(this)
    });
},

onCancelCurrentItemAward: function () {
    var oBundle = this.getView().getModel("i18n").getResourceBundle();
    var aRows = this.getView().getModel("work").getProperty("/MqCompareRows") || [];
    var oCurrentAward = aRows.find(function (oRow) {
        return oRow.CurrentAwardYn === "X";
    });

    if (!this.getView().getModel("view").getProperty("/CanCancelAward") || !oCurrentAward) {
        MessageToast.show("채택취소 가능한 MQ가 없습니다.");
        return;
    }

    MessageBox.confirm(oBundle.getText("msgConfirmCancel"), {
        onClose: function (sAction) {
            if (sAction === MessageBox.Action.OK) {
                this._updateQuotationItem(oCurrentAward.MqNo, oCurrentAward.MqItem, "CANCEL", oBundle.getText("msgCancelSuccess"));
            }
        }.bind(this)
    });
},

_updateQuotationItem: function (sMqNo, sMqItem, sActionType, sSuccessMessage) {
    var oModel = this.getView().getModel();
    var sPath = "/QuotationItemSet(MqNo='" + encodeURIComponent(sMqNo) + "',MqItem='" + encodeURIComponent(sMqItem) + "')";
    var oPayload = {
        MqNo: sMqNo,
        MqItem: sMqItem,
        ActionType: sActionType
    };

    this._setBusy(true);

    oModel.update(sPath, oPayload, {
        merge: true,
        success: function () {
            MessageToast.show(sSuccessMessage);
            this._refreshAfterAward();
        }.bind(this),
        error: function (oError) {
            this._setBusy(false);
            this._showBackendError(oError);
        }.bind(this)
    });
},

_refreshAfterAward: function () {
    var sRfqNo = this.getView().getModel("work").getProperty("/CurrentRfqNo");
    var sRfqItem = this.getView().getModel("work").getProperty("/CurrentRfqItem");

    this._loadRfqHeaders();

    if (sRfqNo) {
        this._loadRfqItems(sRfqNo);
    }

    if (sRfqNo && sRfqItem) {
        this._loadMqCompare(sRfqNo, sRfqItem);
    } else {
        this._setBusy(false);
    }
}
```

### 검증

Run:

```powershell
npm run start-local
```

Expected:

```text
AWARD/CANCEL sends MERGE to QuotationItemSet. On success, Header/Item/MQ data refresh.
```

---

## Task 14. Backend Error 파싱 + MessagePopover 구현

**Files:**
- Modify: `D:\sapcodeproject_usb\ui5\quote_comparison\webapp\controller\Main.controller.js`
- Modify: `D:\sapcodeproject_usb\ui5\quote_comparison\webapp\view\Main.view.xml`

### 목표

Gateway Business Exception 메시지를 사용자가 읽을 수 있게 표시한다.

### Controller 구현

```javascript
_showBackendError: function (oError) {
    var oBundle = this.getView().getModel("i18n").getResourceBundle();
    var sMessage = oBundle.getText("msgDefaultError");
    var oResponse;

    if (oError && oError.responseText) {
        try {
            oResponse = JSON.parse(oError.responseText);

            if (oResponse.error && oResponse.error.message && oResponse.error.message.value) {
                sMessage = oResponse.error.message.value;
            } else if (
                oResponse.error &&
                oResponse.error.innererror &&
                Array.isArray(oResponse.error.innererror.errordetails) &&
                oResponse.error.innererror.errordetails.length > 0
            ) {
                sMessage = oResponse.error.innererror.errordetails[0].message;
            }
        } catch (oParseError) {
            sMessage = oError.message || sMessage;
        }
    }

    this.getView().getModel("message").setProperty("/Messages", [{
        type: "Error",
        title: "오류",
        description: sMessage
    }]);

    MessageBox.error(sMessage);
},

_validateSearchFilters: function () {
    var oFilter = this.getView().getModel("filter").getData();
    var aMessages = [];

    if (oFilter.DocDateFrom && oFilter.DocDateTo && oFilter.DocDateFrom > oFilter.DocDateTo) {
        aMessages.push({
            type: "Error",
            title: "문서일자 오류",
            description: "문서일자 종료일은 시작일보다 빠를 수 없습니다."
        });
    }

    if (oFilter.EindtFrom && oFilter.EindtTo && oFilter.EindtFrom > oFilter.EindtTo) {
        aMessages.push({
            type: "Error",
            title: "납기일 오류",
            description: "납기일 종료일은 시작일보다 빠를 수 없습니다."
        });
    }

    this.getView().getModel("message").setProperty("/Messages", aMessages);

    if (aMessages.length > 0) {
        MessageBox.error(aMessages[0].description);
        return false;
    }

    return true;
}
```

### 검증

Run:

```powershell
npm run start-local
```

Expected:

```text
Backend Business Exception text is shown in MessageBox and stored in messageModel.
```

---

## Task 15. Build/Mock/Gateway 테스트

**Files:**
- No direct file changes unless defects are found.

### 목표

개발 결과가 빌드되고, Mock과 실제 Gateway 흐름에서 동작하는지 확인한다.

### Build 검증

Run:

```powershell
npm run build
```

Expected:

```text
Build completes successfully.
```

### Mock 실행

Run:

```powershell
npm run start-mock
```

Expected:

```text
App opens through FLP preview. Static layout, model binding, tabs, dialog open flow can be checked.
```

### 실제 Gateway 실행

Run:

```powershell
npm run start-local
```

Expected:

```text
App calls /sap/opu/odata/sap/ZGWD3MM0005_SRV through configured proxy.
```

### 기능 테스트 체크리스트

| No | 테스트 | 기대 결과 |
| --- | --- | --- |
| 1 | 조회조건 없이 조회 | RFQ Header 목록 표시 |
| 2 | 문서일자 From/To 조회 | `DocDate` GE/LE Filter 호출 |
| 3 | 납기일 From/To 조회 | `Eindt` GE/LE Filter 호출 |
| 4 | 채택상태 다중 선택 | `AwardStatus` OR Filter 호출 |
| 5 | RFQ 선택 | RFQ Item 조회 |
| 6 | RFQ Item 선택 | MQ Compare 조회 |
| 7 | 추천 적용 | `RecommendYn = X` Row 선택 |
| 8 | 선택 불가 MQ | RadioButton 비활성 |
| 9 | MQ 상세 | Dialog 표시 |
| 10 | 채택 | MERGE AWARD 호출 후 재조회 |
| 11 | 채택취소 | MERGE CANCEL 호출 후 재조회 |
| 12 | Backend 오류 | Business Exception 메시지 표시 |

---

## 3. 구현 완료 기준

구현 완료는 아래 조건을 모두 만족해야 한다.

| 기준 | 완료 조건 |
| --- | --- |
| Build | `npm run build` 성공 |
| 화면 | DynamicPage/FCL/IconTabBar 구조 렌더링 |
| 조회 | RFQHeaderSet, RFQItemSet, MQCompareSet 호출 성공 |
| 선택 | MQ RadioButton 단일 선택 정상 |
| Chart | `NetwrKrw` 기준 Bar Chart 표시 |
| Dialog | MQDetailSet 조회 후 Dialog 표시 |
| 채택 | QuotationItemSet AWARD MERGE 성공 |
| 취소 | QuotationItemSet CANCEL MERGE 성공 |
| 오류 | Backend Business Exception 메시지 표시 |
| Search Help | 이번 구현에는 포함하지 않음 |

---

## 4. 구현 시 주의사항

| 주의 | 내용 |
| --- | --- |
| Search Help | 이번 버전에서 구현하지 않는다. `showValueHelp`도 넣지 않는다. |
| 날짜 필터 | `DocDateFrom`, `DocDateTo`를 OData Property로 보내면 안 된다. |
| 납기 필터 | `EindtFrom`, `EindtTo`를 OData Property로 보내면 안 된다. |
| 추천 로직 | UI에서 금액 비교로 추천을 다시 계산하지 않는다. |
| 선택 가능 | `CanSelect`만 Radio 활성화 기준으로 사용한다. |
| 채택취소 | `CanCancelAward`를 우선 기준으로 사용한다. |
| 성공 응답 | MERGE 성공 Body에 의존하지 않는다. |
| CSS | 화면이 깨지는 경우의 최소 보정만 허용한다. |

---

## 5. 최종 요약 표

| 구분 | 구현계획 V1.0 내용 |
| --- | --- |
| 기준 설계서 | `설계서_V2.1.0.md` |
| 개발 방식 | 단계별 구현 후 검증 |
| Search Help | 제외 |
| 주요 View | `Main.view.xml` |
| 주요 Controller | `Main.controller.js` |
| 신규 파일 | `formatter.js`, `MQDetailDialog.fragment.xml` |
| 핵심 조회 | `RFQHeaderSet`, `RFQItemSet`, `MQCompareSet`, `MQDetailSet` |
| 핵심 저장 | `QuotationItemSet` MERGE |
| 검증 | Build, Mock, 실제 Gateway |
