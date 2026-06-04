sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/MessagePopover",
    "sap/m/MessageItem",
    "sap/m/TableSelectDialog",
    "sap/m/ColumnListItem",
    "sap/m/Column",
    "sap/m/Text",
    "sap/ui/core/Fragment",
    "code/d3/quotecomparison/model/formatter"
], (Controller, JSONModel, Filter, FilterOperator, Sorter, MessageToast, MessageBox, MessagePopover, MessageItem, TableSelectDialog, ColumnListItem, Column, Text, Fragment, formatter) => {
    "use strict";

    return Controller.extend("code.d3.quotecomparison.controller.Main", {
        formatter: formatter,

        onInit() {
            this._initViewModels();
            this._applyHeaderQuickAwardStatusFilter("", true);
        },

        onExit() {
            /*
             * 유효성 검증 MessagePopover는 후속 단계에서 사용자가 오류 버튼을 누를 때 동적으로 생성한다.
             * 동적 컨트롤은 View가 종료될 때 명시적으로 destroy해야 화면을 다시 열었을 때
             * 이전 Popover 인스턴스와 이벤트 핸들러가 남지 않는다.
             */
            if (this._oValidationMessagePopover) {
                this._oValidationMessagePopover.destroy();
                this._oValidationMessagePopover = null;
            }

            if (this._oProcessMessagePopover) {
                this._oProcessMessagePopover.destroy();
                this._oProcessMessagePopover = null;
            }

            if (this._oValueHelpDialog) {
                this._oValueHelpDialog.destroy();
                this._oValueHelpDialog = null;
            }
        },

        /**
         * 화면에서 사용하는 JSONModel을 초기화한다.
         *
         * view  : Busy, 상세조건 표시 여부, FlexibleColumnLayout 상태처럼 화면 제어용 값
         * filter: DynamicPage Header의 조회조건 값
         * work  : RFQ/MQ 조회 결과, 선택된 RFQ/MQ, KPI처럼 업무 화면에 표시되는 값
         *
         * 실제 OData 응답은 `work` 모델에 넣고, 화면 제어 상태는 `view` 모델에 둔다.
         * 이렇게 나누면 조회 데이터가 바뀌어도 레이아웃 상태와 업무 데이터가 서로 섞이지 않는다.
         */
        _initViewModels() {
            const oView = this.getView();

            oView.setModel(new JSONModel(this._createInitialViewData()), "view");
            oView.setModel(new JSONModel(this._createInitialFilterData()), "filter");
            oView.setModel(new JSONModel(this._createInitialWorkData()), "work");
            oView.setModel(new JSONModel(this._createInitialDetailData()), "detail");
            oView.setModel(new JSONModel(this._createEmptyValidationMessages()), "messages");
            oView.setModel(new JSONModel(this._createEmptyProcessMessages()), "processMessages");
        },

        /**
         * 화면 제어 모델의 초기값을 반환한다.
         *
         * FCL은 최초 진입 시 Begin Column만 보여준다.
         * RFQ Header 행을 선택하거나 RFQ Header 조회 결과가 정확히 1건일 때 Mid Column을 연다.
         */
        _createInitialViewData() {
            return {
                Busy: false,
                AdvancedFilterVisible: false,
                FclLayout: "OneColumn",
                HeaderTableStatusSummary: "",
                HeaderTableSortGroupSummary: "",
                HeaderTableQuickAwardStatus: "",
                HeaderTableSortKey: "",
                HeaderTableSortDescending: false,
                HeaderTableGroupKey: "",
                HeaderTableGroupDescending: false
            };
        },

        /**
         * 조회조건 모델의 초기값을 반환한다.
         *
         * DatePicker의 dateValue는 Date 객체 또는 null을 기대하므로 날짜 필드는 null로 둔다.
         * 채택상태는 MultiComboBox의 selectedKeys 바인딩에 맞춰 배열로 둔다.
         */
        _createInitialFilterData() {
            return {
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
            };
        },

        /**
         * 업무 데이터 모델의 초기값을 반환한다.
         *
         * 현재 화면은 Header -> Item -> MQ 비교 순서로 단계적으로 데이터를 채운다.
         * 따라서 Header 조회 전에는 모든 배열과 선택 객체를 비워 두고, 조회 단계마다 해당 경로만 갱신한다.
         */
        _createInitialWorkData() {
            return {
                Kpi: {
                    NotAwarded: 0,
                    PartiallyAwarded: 0,
                    Awarded: 0,
                    PoCreated: 0
                },
                RfqHeaderCount: 0,
                RfqHeaders: [],
                RfqItems: [],
                MqCompareRows: [],
                ChartRows: [],
                SelectedRfq: {},
                SelectedRfqItem: {},
                SelectedMq: {}
            };
        },

        _createInitialDetailData() {
            return {
                MqDetail: {}
            };
        },

        /**
         * 조회조건 유효성 검증 메시지 모델의 초기값을 반환한다.
         *
         * SAPUI5의 sap.m.MessagePopover는 목록 바인딩으로 MessageItem 배열을 표시한다.
         * 따라서 화면에는 오류 목록(items)과 Footer 버튼 표시용 요약값(count, buttonText 등)을 함께 둔다.
         * 1단계에서는 모델 구조만 준비하고, 실제 오류 누적과 Footer 연결은 다음 단계에서 붙인다.
         */
        _createEmptyValidationMessages() {
            return {
                items: [],
                count: 0,
                buttonText: "",
                buttonIcon: "sap-icon://message-popup",
                buttonType: "Transparent"
            };
        },

        /**
         * 채택/채택취소 같은 업무 처리 결과 MessagePopover 모델의 초기값을 반환한다.
         *
         * 조회조건 검증 메시지는 사용자가 조회 전에 입력값을 고쳐야 하는 오류이고,
         * 업무 처리 메시지는 채택/채택취소 실행 후 어떤 RFQ Item이 처리되었는지 알려주는 결과다.
         * 두 메시지를 같은 모델에 섞으면 사용자가 원인과 결과를 구분하기 어렵기 때문에 별도 모델로 둔다.
         */
        _createEmptyProcessMessages() {
            return {
                items: [],
                count: 0,
                buttonText: "",
                buttonIcon: "sap-icon://message-popup",
                buttonType: "Transparent"
            };
        },

        /**
         * 조회 버튼 이벤트.
         *
         * RFQ Header 조회 전에 조회조건 유효성 검증을 먼저 수행한다.
         * 잘못된 날짜 조건으로 Gateway 조회를 보내면 사용자는 빈 결과와 입력 오류를 구분하기 어렵다.
         * 따라서 Frontend에서 명확히 판단 가능한 날짜 오류는 여기서 차단한다.
         */
        onSearch() {
            this._clearSearchValidationStates();

            if (!this._validateSearchConditions()) {
                this._openValidationMessagePopoverDelayed();
                return Promise.resolve(false);
            }

            return this._validateSearchHelpCodeExistence().then((aErrors) => {
                if (aErrors.length > 0) {
                    this._setValidationMessages(aErrors);
                    this._openValidationMessagePopoverDelayed();
                    return false;
                }

                return this._loadRfqHeaders();
            }).catch(() => {
                this._setValidationMessages([
                    this._createValidationError(
                        "",
                        this._getText("validationTechnicalError") || "조회조건 검증 중 오류가 발생했습니다.",
                        this._getText("searchConditionTitle") || "조회조건"
                    )
                ]);
                this._openValidationMessagePopoverDelayed();
                return false;
            });
        },

        /**
         * 조회조건 Input의 Search Help 요청 이벤트.
         *
         * XML View의 Input에는 core:CustomData로 helpType이 들어 있다.
         * 예:
         * - VENDOR   : 공급업체 Search Help
         * - MATERIAL : 자재 Search Help
         * - PLANT    : 플랜트 Search Help
         * - COMPANY  : 회사코드 Search Help
         *
         * 실제 Dialog 생성은 공통 함수로 위임하여, 추후 RFQ/MQ/구매조직/구매그룹 Help가 추가되어도
         * 설정 객체만 늘리면 같은 흐름을 재사용할 수 있게 한다.
         */
        onValueHelpRequest(oEvent) {
            const oInput = oEvent && oEvent.getSource && oEvent.getSource();
            const sHelpType = oInput && oInput.data("helpType");
            const oConfig = this._getValueHelpConfig(sHelpType);

            if (!oConfig) {
                this._showToast(this._getText("valueHelpUnknown") || "알 수 없는 Search Help입니다.");
                return;
            }

            this._openValueHelpDialog(oConfig);
        },

        /**
         * 조회조건 유효성 메시지 버튼 이벤트.
         *
         * MessagePopover는 오류가 있을 때만 필요한 컨트롤이므로 최초 클릭 시점에 생성한다.
         * SAPUI5 SDK의 MessagePopover 패턴처럼 버튼을 기준 컨트롤로 넘겨 openBy 처리하면
         * Popover가 Footer 버튼 위치에 맞춰 안정적으로 열린다.
         */
        onMessagePopoverPress(oEvent) {
            const oSource = oEvent && oEvent.getSource && oEvent.getSource();

            if (oSource) {
                this._getValidationMessagePopover().openBy(oSource);
            }
        },

        /**
         * 채택/채택취소 업무 처리 결과 MessagePopover 버튼 이벤트.
         *
         * 조회조건 오류 MessagePopover와 별개로 운영한다.
         * 일괄 채택 기능은 여러 RFQ Item을 대상으로 하므로 성공/제외/오류 메시지가 동시에 발생할 수 있다.
         * 따라서 결과 메시지 전용 Popover를 두어 사용자가 처리 결과를 한 곳에서 확인하도록 한다.
         */
        onProcessMessagePopoverPress(oEvent) {
            const oSource = oEvent && oEvent.getSource && oEvent.getSource();

            if (oSource) {
                this._getProcessMessagePopover().openBy(oSource);
            }
        },

        /**
         * RFQ Item 목록 헤더의 "일괄 채택" 버튼 이벤트.
         *
         * QuotationItemSet 단건 MERGE를 RFQ Item별로 순차 호출하고,
         * 각 Item의 성공/제외/오류 결과를 footer MessagePopover에 표시한다.
         */
        onBulkAward() {
            const oWorkModel = this.getView().getModel("work");
            const oSelectedRfq = oWorkModel ? (oWorkModel.getProperty("/SelectedRfq") || {}) : {};
            const aRfqItems = oWorkModel ? (oWorkModel.getProperty("/RfqItems") || []) : [];

            if (!oSelectedRfq.RfqNo) {
                this._setProcessMessages([
                    this._createProcessMessage(
                        "Warning",
                        this._getText("msgSelectRfq") || "RFQ를 먼저 선택하세요.",
                        this._getText("bulkAward") || "일괄 채택"
                    )
                ]);
                this._openProcessMessagePopoverDelayed();
                return Promise.resolve(false);
            }

            return this._confirmAction(
                this._getText("msgConfirmBulkAward") ||
                "선택 RFQ의 미채택 RFQ Item에 대해 자동추천 MQ를 일괄 채택하시겠습니까?"
            ).then((bConfirmed) => {
                if (!bConfirmed) {
                    return false;
                }

                return this._executeBulkAward(oSelectedRfq, aRfqItems);
            });
        },

        /**
         * RFQ Item 목록 헤더의 "일괄 채택취소" 버튼 이벤트.
         *
         * QuotationItemSet 단건 MERGE를 RFQ Item별로 순차 호출하고,
         * PO 미생성 채택 Item만 채택취소 대상으로 처리한다.
         */
        onBulkCancelAward() {
            const oWorkModel = this.getView().getModel("work");
            const oSelectedRfq = oWorkModel ? (oWorkModel.getProperty("/SelectedRfq") || {}) : {};
            const aRfqItems = oWorkModel ? (oWorkModel.getProperty("/RfqItems") || []) : [];

            if (!oSelectedRfq.RfqNo) {
                this._setProcessMessages([
                    this._createProcessMessage(
                        "Warning",
                        this._getText("msgSelectRfq") || "RFQ를 먼저 선택하세요.",
                        this._getText("bulkCancelAward") || "일괄 채택취소"
                    )
                ]);
                this._openProcessMessagePopoverDelayed();
                return Promise.resolve(false);
            }

            return this._confirmAction(
                this._getText("msgConfirmBulkCancelAward") ||
                "선택 RFQ의 채택 가능 RFQ Item에 대해 일괄 채택취소하시겠습니까?"
            ).then((bConfirmed) => {
                if (!bConfirmed) {
                    return false;
                }

                return this._executeBulkCancelAward(oSelectedRfq, aRfqItems);
            });
        },

        /**
         * 조회조건 초기화 버튼 이벤트.
         *
         * 필터 값은 최초 상태로 되돌리고, 상세조건 영역도 닫는다.
         * 이미 조회된 Header 목록은 사용자가 새로 조회하기 전까지 유지한다.
         */
        onReset() {
            const oView = this.getView();
            const oViewModel = oView.getModel("view");
            const oFilterModel = oView.getModel("filter");
            const oInitialFilterData = this._createInitialFilterData();

            if (oFilterModel) {
                oFilterModel.setData(oInitialFilterData);
                oFilterModel.updateBindings(true);
            } else {
                oView.setModel(new JSONModel(oInitialFilterData), "filter");
            }

            this._resetSearchConditionControlValues();
            this._clearSearchValidationStates();

            if (oViewModel) {
                oViewModel.setProperty("/AdvancedFilterVisible", false);
            }

            this._applyHeaderQuickAwardStatusFilter("", true);
        },

        /**
         * RFQ Header KPI 카드 클릭 이벤트.
         *
         * KPI 카드는 조회 결과 요약 숫자를 유지한 상태에서 RFQ Header Table만 빠르게 좁혀 보는 용도다.
         * 따라서 조회조건 모델은 변경하지 않고, 이미 조회된 Table binding에만 채택상태 필터를 적용한다.
         */
        onKpiAwardStatusPress(oEvent) {
            const oSource = oEvent && oEvent.getSource && oEvent.getSource();
            const sAwardStatus = oSource && oSource.data && oSource.data("awardStatus");

            if (!sAwardStatus) {
                this._showToast(this._getText("msgKpiAwardFilterUnknown") || "알 수 없는 KPI 필터입니다.");
                return Promise.resolve(null);
            }

            this._applyHeaderQuickAwardStatusFilter(sAwardStatus);
            this._showToast(this._getText("msgKpiAwardFilterApplied") || "KPI 채택상태 필터를 적용했습니다.");

            return Promise.resolve(sAwardStatus);
        },

        /**
         * KPI로 적용한 채택상태 빠른 필터를 해제한다.
         *
         * 검색조건 전체 초기화가 아니라 채택상태 조건만 비운 뒤 현재 다른 조회조건은 유지하고 재조회한다.
         */
        onClearAwardStatusQuickFilter() {
            this._applyHeaderQuickAwardStatusFilter("");
            this._showToast(this._getText("msgKpiAwardFilterCleared") || "KPI 채택상태 필터를 해제했습니다.");

            return Promise.resolve(null);
        },

        /**
         * RFQ Header Table 정렬/그룹 설정 Dialog를 연다.
         *
         * Dialog는 Fragment로 분리하고 최초 1회만 생성해 재사용한다.
         */
        onOpenRfqHeaderTableSettings() {
            const oView = this.getView();

            if (!this._pRfqHeaderTableSettingsDialog) {
                this._pRfqHeaderTableSettingsDialog = Fragment.load({
                    id: oView.getId(),
                    name: "code.d3.quotecomparison.fragment.RfqHeaderTableSettings",
                    controller: this
                }).then((oDialog) => {
                    if (oView.addDependent) {
                        oView.addDependent(oDialog);
                    }

                    return oDialog;
                });
            }

            return this._pRfqHeaderTableSettingsDialog.then((oDialog) => {
                oDialog.open();
                return oDialog;
            });
        },

        /**
         * ViewSettingsDialog의 선택값을 sap.m.Table Binding Sorter로 변환한다.
         */
        onRfqHeaderTableSettingsConfirm(oEvent) {
            const oSortItem = oEvent.getParameter("sortItem");
            const oGroupItem = oEvent.getParameter("groupItem");
            const sSortKey = oSortItem && oSortItem.getKey();
            const sGroupKey = oGroupItem && oGroupItem.getKey();
            const bSortDescending = oEvent.getParameter("sortDescending");
            const bGroupDescending = oEvent.getParameter("groupDescending");

            this._applyHeaderTableSorters(sSortKey, bSortDescending, sGroupKey, bGroupDescending);
        },

        /**
         * RFQ Header Table의 정렬/그룹만 초기화한다.
         *
         * 조회조건과 조회 결과는 유지하고, 사용자가 바꾼 Table 표시 방식만 원복한다.
         */
        onResetRfqHeaderTableSettings() {
            this._resetHeaderTableSettings();
            this._showToast(this._getText("msgTableSettingsResetDone") || "정렬/그룹 조건을 초기화했습니다.");
        },

        /**
         * 상세조건 열기/닫기 버튼 이벤트.
         *
         * 버튼 문구는 XML의 expression binding이 `view>/AdvancedFilterVisible` 값을 보고
         * "상세조건" 또는 "상세조건 닫기"로 자동 전환한다.
         */
        onToggleAdvancedFilter() {
            const oViewModel = this.getView().getModel("view");
            const bVisible = oViewModel.getProperty("/AdvancedFilterVisible");

            oViewModel.setProperty("/AdvancedFilterVisible", !bVisible);
        },

        /**
         * RFQ Header 선택 이벤트.
         *
         * Begin Column의 RFQ Header 행을 선택하면 Mid Column을 열고,
         * 선택한 Header를 Mid 영역의 ObjectPage Header에 바인딩한 뒤 RFQItemSet을 조회한다.
         */
        onRfqSelectionChange(oEvent) {
            const oSelectedRfq = this._getSelectedObjectFromEvent(oEvent);

            if (!oSelectedRfq) {
                return;
            }

            return this._openMidColumnForRfq(oSelectedRfq);
        },

        /**
         * Mid Column을 전체 화면으로 확장한다.
         *
         * SAPUI5 FlexibleColumnLayout은 문자열 레이아웃 값을 기준으로 컬럼 표시 방식을 바꾼다.
         * `MidColumnFullScreen`은 SDK 샘플의 full-screen 버튼과 같은 의미로,
         * 선택한 RFQ의 비교 영역을 넓게 확인해야 할 때 사용한다.
         */
        onEnterMidFullScreen() {
            this._setFclLayout("MidColumnFullScreen");
        },

        /**
         * Mid Column 전체 화면을 해제하고 Begin + Mid 2컬럼 비교 화면으로 돌아간다.
         *
         * RFQ 목록과 상세 비교를 동시에 보는 것이 이 프로그램의 기본 작업 흐름이므로
         * 전체 화면 해제 시에는 `TwoColumnsMidExpanded`로 복귀시킨다.
         */
        onExitMidFullScreen() {
            this._setFclLayout("TwoColumnsMidExpanded");
        },

        /**
         * Mid Column을 닫고 선택된 RFQ 및 비교 영역을 초기화한다.
         *
         * 닫기 버튼은 화면 배치만 바꾸는 것이 아니라, 사용자가 더 이상 선택 RFQ를 보고 있지 않다는 뜻이다.
         * 따라서 기존 `_clearSelectionAndComparisonArea`를 재사용해 Header 선택, RFQ Item, MQ 비교 데이터까지 함께 비운다.
         */
        onCloseMidColumn() {
            this._clearSelectionAndComparisonArea();
        },

        /**
         * RFQ Item 선택 이벤트.
         *
         * 선택된 RFQ Item을 work 모델에 보관하고 이전 Item의 MQ 선택/비교표/차트 데이터를 초기화한다.
         * 그 다음 Backend가 계산한 MQ 후보 비교 결과를 MQCompareSet에서 조회한다.
         */
        onRfqItemSelectionChange(oEvent) {
            const oSelectedItem = this._getSelectedObjectFromEvent(oEvent);
            const oWorkModel = this.getView().getModel("work");

            if (!oSelectedItem || !oWorkModel) {
                return Promise.resolve([]);
            }

            oWorkModel.setProperty("/SelectedRfqItem", oSelectedItem);
            oWorkModel.setProperty("/SelectedMq", {});
            oWorkModel.setProperty("/MqCompareRows", []);
            oWorkModel.setProperty("/ChartRows", []);

            return this._loadMqCompareForRfqItem(oSelectedItem);
        },

        /**
         * MQ 비교표 RadioButton 선택 이벤트.
         *
         * sap.ui.table.Table의 행 컨텍스트 처리와 단일 선택 제어는 MQ 비교 기능 구현 단계에서 작성한다.
         */
        onMqRadioSelect(oEvent) {
            const oSelectedRow = this._getObjectFromEventSource(oEvent);

            if (this._isSelectedRfqItemPoCreated() || !oSelectedRow || oSelectedRow.CanSelect !== "X") {
                return;
            }

            this._setSelectedMq(oSelectedRow);
        },

        /**
         * 자동추천 적용 버튼 이벤트.
         *
         * 설계서 기준으로 자동추천은 UI5에서 가격/납기 조건을 다시 계산하지 않는다.
         * Backend가 계산해서 내려준 RecommendYn과 CanSelect만 신뢰한다.
         *
         * RecommendYn = X 이더라도 이미 채택됐거나, 미응답이거나, PO 생성 등으로
         * CanSelect가 X가 아니면 채택 대상으로 자동 지정하지 않는다.
         */
        onApplyAutoRecommend() {
            if (this._isSelectedRfqItemPoCreated()) {
                this._showToast(this._getText("msgPoCreatedNoChange") || "이미 PO가 생성되어 변경할 수 없습니다.");
                return;
            }

            const oRecommendedRow = this._findSelectableRecommendedMq();

            if (!oRecommendedRow) {
                this._showToast(this._getText("msgNoSelectableRecommend") || "선택 가능한 추천 MQ가 없습니다.");
                return;
            }

            this._setSelectedMq(oRecommendedRow);
        },

        /**
         * MQ 상세 Dialog 열기 이벤트.
         *
         * Fragment 로딩과 MQDetailSet 단건 조회는 상세 팝업 연결 단계에서 작성한다.
         */
        onOpenMqDetail() {
            const oSelectedMq = this.getView().getModel("work").getProperty("/SelectedMq");

            if (!oSelectedMq || !oSelectedMq.MqNo || !oSelectedMq.MqItem) {
                this._showToast(this._getText("msgSelectMq") || "채택할 MQ를 선택하세요.");
                return Promise.resolve(null);
            }

            return this._loadMqDetail(oSelectedMq.MqNo, oSelectedMq.MqItem);
        },

        onOpenMqDetailFromRow(oEvent) {
            const oRow = this._getObjectFromEventSource(oEvent);

            if (!oRow || !oRow.MqNo || !oRow.MqItem) {
                return Promise.resolve(null);
            }

            return this._loadMqDetail(oRow.MqNo, oRow.MqItem);
        },

        /**
         * 채택 버튼 이벤트.
         *
         * 선택된 MQ 1건을 현재 RFQ Item의 최종 거래선으로 채택한다.
         * 실제 기존 채택 MQ 해제와 신규 채택 처리는 Backend `QuotationItemSet_UPDATE_ENTITY`가
         * `ActionType = AWARD`를 기준으로 단건 트랜잭션에서 처리한다.
         */
        onSaveAward() {
            const oWorkModel = this.getView().getModel("work");
            const oSelectedMq = oWorkModel ? (oWorkModel.getProperty("/SelectedMq") || {}) : {};

            if (this._isSelectedRfqItemPoCreated()) {
                this._showToast(this._getText("msgPoCreatedNoChange") || "이미 PO가 생성되어 변경할 수 없습니다.");
                return Promise.resolve(null);
            }

            if (!oSelectedMq.MqNo || !oSelectedMq.MqItem) {
                this._showToast(this._getText("msgSelectMq") || "채택할 MQ를 선택하세요.");
                return Promise.resolve(null);
            }

            return this._confirmAction(this._getText("msgConfirmAward") || "선택한 MQ를 이 RFQ Item의 최종 거래선으로 채택하시겠습니까?")
                .then((bConfirmed) => {
                    if (!bConfirmed) {
                        return null;
                    }

                    return this._updateQuotationItem(
                        oSelectedMq.MqNo,
                        oSelectedMq.MqItem,
                        "AWARD",
                        this._getText("msgAwardSuccess") || "견적이 채택되었습니다."
                    );
                });
        },

        /**
         * 채택취소 버튼 이벤트.
         *
         * 채택취소는 현재 RFQ Item에 이미 채택된 MQ를 대상으로만 수행한다.
         * 화면 버튼도 `CanCancelAward = X`일 때만 활성화하지만, 사용자가 오래된 화면 상태에서
         * 버튼을 누르거나 테스트 코드가 직접 호출할 수 있으므로 Controller에서도 한 번 더 방어한다.
         *
         * Backend는 `ActionType = CANCEL`을 받으면 해당 MQ Item의 SELIDC를 해제하고,
         * PO 생성 여부 같은 업무 제약은 DPC_EXT에서 최종 검증한다.
         */
        onCancelAward() {
            const oWorkModel = this.getView().getModel("work");
            const oSelectedRfqItem = oWorkModel ? (oWorkModel.getProperty("/SelectedRfqItem") || {}) : {};
            const sAwardMqNo = oSelectedRfqItem.AwardMqNo;
            const sAwardMqItem = oSelectedRfqItem.AwardMqItem;

            if (this._isSelectedRfqItemPoCreated(oSelectedRfqItem)) {
                this._showToast(this._getText("msgPoCreatedNoChange") || "이미 PO가 생성되어 변경할 수 없습니다.");
                return Promise.resolve(null);
            }

            if (oSelectedRfqItem.CanCancelAward !== "X" || !sAwardMqNo || !sAwardMqItem) {
                this._showToast(this._getText("msgNoAwardToCancel") || "채택취소할 MQ가 없습니다.");
                return Promise.resolve(null);
            }

            return this._confirmAction(this._getText("msgConfirmCancel") || "현재 채택된 MQ를 채택취소하시겠습니까?")
                .then((bConfirmed) => {
                    if (!bConfirmed) {
                        return null;
                    }

                    return this._updateQuotationItem(
                        sAwardMqNo,
                        sAwardMqItem,
                        "CANCEL",
                        this._getText("msgCancelSuccess") || "견적 채택이 취소되었습니다."
                    );
                });
        },

        /**
         * 상세 Dialog 안의 "이 MQ 선택" 버튼 이벤트.
         *
         * Dialog에서 MQ를 선택한 뒤 비교표의 선택 상태와 맞추는 로직은 상세 팝업 연결 단계에서 작성한다.
         */
        onSelectMqFromDialog() {
            const oDetailModel = this.getView().getModel("detail");
            const oMqDetail = oDetailModel ? (oDetailModel.getProperty("/MqDetail") || {}) : {};
            const oCompareRow = this._findMqCompareRow(oMqDetail.MqNo, oMqDetail.MqItem);

            if (this._isSelectedRfqItemPoCreated()) {
                this._showToast(this._getText("msgPoCreatedNoChange") || "이미 PO가 생성되어 변경할 수 없습니다.");
                return;
            }

            /*
             * Dialog의 "이 MQ 선택"은 상세 조회가 아니라 채택 대상 지정 기능이다.
             * 따라서 UI에서 임의로 가능 여부를 재계산하지 않고, Backend가 내려준
             * MQ 비교 행의 CanSelect 값을 다시 확인한다.
             *
             * 이미 채택된 MQ, 미응답 MQ, PO 생성 MQ처럼 CanSelect가 X가 아닌 행은
             * 상세 조회만 허용하고 work>/SelectedMq는 덮어쓰지 않는다.
             */
            if (!oCompareRow || oCompareRow.CanSelect !== "X") {
                return;
            }

            this._setSelectedMq(oCompareRow);
            this.onCloseMqDetailDialog();
        },

        /**
         * 상세 Dialog 닫기 버튼 이벤트.
         *
         * 실제 Dialog close 처리는 Fragment 연결 단계에서 작성한다.
         */
        onCloseMqDetailDialog() {
            const oDialog = this.byId("idMqDetailDialog");

            if (oDialog && oDialog.close) {
                oDialog.close();
            }
        },

        /**
         * 비어 있는 이벤트 핸들러.
         *
         * XMLView가 먼저 안정적으로 렌더링되도록 임시로 남겨두는 안전장치다.
         */
        onPlaceholderAction() {
        },

        /**
         * RFQHeaderSet을 조회하여 Begin Column의 RFQ Header 목록, KPI, 건수를 갱신한다.
         *
         * SAPUI5 OData V2 Model의 `read`는 success/error 콜백 방식이다.
         * 이 화면에서는 조회 이후 여러 후속 처리가 이어지므로 `_readEntitySet`에서 Promise로 감싼 뒤
         * then/catch/finally 흐름으로 작성한다.
         */
        _loadRfqHeaders(mOptions = {}) {
            const oView = this.getView();
            const oViewModel = oView.getModel("view");
            const oWorkModel = oView.getModel("work");
            const aFilters = this._buildHeaderFilters();
            const bKeepComparisonContext = mOptions.keepComparisonContext === true;

            if (oViewModel) {
                oViewModel.setProperty("/Busy", true);
            }

            /*
             * 일반 조회는 이전 비교 컨텍스트를 지우지만, 채택 후 재조회는 사용자가 보던
             * Mid Column과 선택 RFQ Item을 유지해야 하므로 초기화를 건너뛴다.
             */
            if (!bKeepComparisonContext) {
                this._clearSelectionAndComparisonArea();
            }

            return this._readEntitySet("/RFQHeaderSet", aFilters).then((aRows) => {
                oWorkModel.setProperty("/RfqHeaders", aRows);
                this._applyHeaderQuickAwardStatusFilter("", true);
                this._updateHeaderKpis(aRows);
                this._reapplyHeaderTableSorters();

                if (!bKeepComparisonContext && aRows.length === 1) {
                    /*
                     * RFQ 번호로 1건만 조회된 경우에는 사용자가 목록을 다시 누르지 않아도 Mid Column을 연다.
                     * Header 조회 자체는 성공으로 유지해야 하므로, Item 조회 실패는 RFQHeaderSet catch로 전파하지 않는다.
                     */
                    this._openMidColumnForRfq(aRows[0]).catch(() => {});
                }

                return aRows;
            }).catch((oError) => {
                oWorkModel.setProperty("/RfqHeaders", []);
                this._applyHeaderQuickAwardStatusFilter("", true);
                this._updateHeaderKpis([]);
                this._showToast(this._getText("msgLoadRfqHeaderError") || "RFQ Header 조회 중 오류가 발생했습니다.");
                throw oError;
            }).finally(() => {
                if (oViewModel) {
                    oViewModel.setProperty("/Busy", false);
                }
            });
        },

        /**
         * 조회조건 JSONModel 값을 Gateway가 이해할 수 있는 OData Filter 배열로 변환한다.
         *
         * Backend DPC_EXT의 GET_FILTER_VALUES는 Metadata 기준 CamelCase Property명을 읽는다.
         * 따라서 ABAP 필드명(RFQ_NO, DOC_DATE)이 아니라 OData Property명(RfqNo, DocDate)을 사용한다.
         */
        _buildHeaderFilters() {
            const oFilterModel = this.getView().getModel("filter");
            const oFilter = oFilterModel ? oFilterModel.getData() : {};
            const aFilters = [];

            this._addTextFilter(aFilters, "RfqNo", oFilter.RfqNo, FilterOperator.EQ);
            this._addDateFilter(aFilters, "DocDate", FilterOperator.GE, oFilter.DocDateFrom);
            this._addDateFilter(aFilters, "DocDate", FilterOperator.LE, oFilter.DocDateTo);
            this._addTextFilter(aFilters, "Lifnr", oFilter.Lifnr, FilterOperator.EQ);
            this._addTextFilter(aFilters, "Name1", oFilter.Name1, FilterOperator.EQ);
            this._addTextFilter(aFilters, "Matnr", oFilter.Matnr, FilterOperator.EQ);
            this._addTextFilter(aFilters, "Maktx", oFilter.Maktx, FilterOperator.EQ);
            this._addTextFilter(aFilters, "Werks", oFilter.Werks, FilterOperator.EQ);
            this._addDateFilter(aFilters, "Eindt", FilterOperator.GE, oFilter.EindtFrom);
            this._addDateFilter(aFilters, "Eindt", FilterOperator.LE, oFilter.EindtTo);
            this._addTextFilter(aFilters, "MqNo", oFilter.MqNo, FilterOperator.EQ);
            this._addTextFilter(aFilters, "Bukrs", oFilter.Bukrs, FilterOperator.EQ);
            this._addTextFilter(aFilters, "Ekorg", oFilter.Ekorg, FilterOperator.EQ);
            this._addTextFilter(aFilters, "Ekgrp", oFilter.Ekgrp, FilterOperator.EQ);
            this._addAwardStatusFilters(aFilters, oFilter.AwardStatus);

            return aFilters;
        },

        /**
         * 문자열 조건을 Filter 배열에 추가한다.
         *
         * 빈 값은 조회조건이 아니므로 Filter를 만들지 않는다.
         * 공급업체명/자재명도 UI5에서는 EQ로 전송한다.
         * 이유:
         * - Backend DPC_EXT는 it_filter_select_options의 LOW 값을 읽은 뒤,
         *   ABAP 내부에서 `NS` 비교로 부분검색을 수행한다.
         * - UI5에서 Contains를 보내면 Gateway가 substringof 함수 형태로 변환할 수 있어,
         *   현재 DPC_EXT의 단순 select_options 해석 방식과 맞지 않을 수 있다.
         * - 따라서 납기지연 프로그램과 동일하게 문자열 값은 EQ로 전달하고,
         *   실제 부분일치 판단은 Backend 로직에 맡긴다.
         */
        _addTextFilter(aFilters, sProperty, sValue, sOperator) {
            const sCleanValue = typeof sValue === "string" ? sValue.trim() : sValue;

            if (sCleanValue) {
                aFilters.push(new Filter(sProperty, sOperator, sCleanValue));
            }
        },

        /**
         * 선택 RFQ의 RFQItemSet을 조회한다.
         *
         * Backend DPC_EXT의 RFQITEMSET_GET_ENTITYSET은 `RfqNo eq '...'` 조건을 기준으로
         * 해당 RFQ의 품목과 품목별 채택상태, 채택 MQ, 채택취소 가능 여부를 계산해서 내려준다.
         * UI5에서는 이 계산 결과를 그대로 `work>/RfqItems`에 담고, 이후 RFQ Item 선택 시 MQCompareSet을 이어서 조회한다.
         */
        _loadRfqItemsForRfq(sRfqNo) {
            const oWorkModel = this.getView().getModel("work");
            const aFilters = this._buildRfqItemFilters(sRfqNo);

            this._clearRfqItemDependentArea();

            if (!sRfqNo) {
                return Promise.resolve([]);
            }

            return this._readEntitySet("/RFQItemSet", aFilters).then((aRows) => {
                if (oWorkModel) {
                    oWorkModel.setProperty("/RfqItems", aRows);
                }

                return aRows;
            }).catch((oError) => {
                if (oWorkModel) {
                    oWorkModel.setProperty("/RfqItems", []);
                }

                this._showToast(this._getText("msgLoadRfqItemError") || "RFQ Item 목록 조회 중 오류가 발생했습니다.");
                throw oError;
            });
        },

        /**
         * RFQItemSet 조회용 OData Filter를 만든다.
         *
         * DPC_EXT의 필터 해석 메서드는 OData Property명 기준으로 `RfqNo`를 읽는다.
         * 따라서 화면에서 선택한 Header의 RfqNo를 그대로 EQ 조건으로 전달한다.
         */
        _buildRfqItemFilters(sRfqNo) {
            const aFilters = [];

            this._addTextFilter(aFilters, "RfqNo", sRfqNo, FilterOperator.EQ);

            return aFilters;
        },

        /**
         * 선택 RFQ Item의 MQCompareSet을 조회한다.
         *
         * DPC_EXT는 RFQ 번호와 RFQ Item 번호를 함께 받아야 후보 MQ를 정확히 비교할 수 있다.
         * 조회된 Row에는 RadioButton 바인딩용 UI 전용 필드 `UiSelected`를 false로 추가한다.
         * 실제 선택 가능 여부는 Backend의 `CanSelect`를 그대로 사용하고, 여기서는 자동 선택하지 않는다.
         */
        _loadMqCompareForRfqItem(oRfqItem) {
            const oView = this.getView();
            const oWorkModel = oView.getModel("work");
            const oSelectedRfq = oWorkModel ? (oWorkModel.getProperty("/SelectedRfq") || {}) : {};
            const sRfqNo = oRfqItem && (oRfqItem.RfqNo || oSelectedRfq.RfqNo);
            const sRfqItem = oRfqItem && oRfqItem.RfqItem;
            const aFilters = this._buildMqCompareFilters(sRfqNo, sRfqItem);

            if (!sRfqNo || !sRfqItem) {
                return Promise.resolve([]);
            }

            return this._readEntitySet("/MQCompareSet", aFilters).then((aRows) => {
                const aPreparedRows = this._sortMqCompareRowsByNetwrKrw((aRows || []).map((oRow) => Object.assign({}, oRow, {
                    UiSelected: false
                })));

                if (oWorkModel) {
                    oWorkModel.setProperty("/MqCompareRows", aPreparedRows);
                    oWorkModel.setProperty("/ChartRows", this._prepareChartRows(aPreparedRows));
                }

                return aPreparedRows;
            }).catch((oError) => {
                if (oWorkModel) {
                    oWorkModel.setProperty("/MqCompareRows", []);
                    oWorkModel.setProperty("/ChartRows", []);
                }

                this._showToast(this._getText("msgLoadMqCompareError") || "MQ 비교 목록 조회 중 오류가 발생했습니다.");
                throw oError;
            });
        },

        /**
         * MQCompareSet 조회용 필터를 만든다.
         *
         * Backend 필터 해석 기준에 맞춰 `RfqNo eq ...`와 `RfqItem eq ...`를 모두 전달한다.
         */
        _buildMqCompareFilters(sRfqNo, sRfqItem) {
            const aFilters = [];

            this._addTextFilter(aFilters, "RfqNo", sRfqNo, FilterOperator.EQ);
            this._addTextFilter(aFilters, "RfqItem", sRfqItem, FilterOperator.EQ);

            return aFilters;
        },

        /**
         * MQ 비교 목록에서 금액 비교 차트에 필요한 행만 추려낸다.
         *
         * 미응답 MQ와 환산총액이 없는 MQ는 차트에 표시해도 비교 의미가 약하므로 제외한다.
         * 차트 X축에는 긴 공급업체명 대신 공급업체코드를 사용하고,
         * 막대 순서는 MQ 비교 목록과 동일하게 KRW 환산총액 오름차순으로 맞춘다.
         */
        _prepareChartRows(aRows) {
            const aChartRows = (aRows || []).reduce((aPreparedChartRows, oRow) => {
                const iNetwrKrw = Number(oRow && oRow.NetwrKrw);

                if (!oRow || oRow.ResponseStatus === "N" || !Number.isFinite(iNetwrKrw) || iNetwrKrw <= 0) {
                    return aPreparedChartRows;
                }

                aPreparedChartRows.push({
                    RfqNo: oRow.RfqNo,
                    RfqItem: oRow.RfqItem,
                    MqNo: oRow.MqNo,
                    MqItem: oRow.MqItem,
                    Lifnr: oRow.Lifnr || oRow.MqNo,
                    Name1: oRow.Name1 || oRow.MqNo,
                    NetwrKrw: iNetwrKrw,
                    RecommendYn: oRow.RecommendYn,
                    CurrentAwardYn: oRow.CurrentAwardYn
                });

                return aPreparedChartRows;
            }, []);

            return this._sortMqCompareRowsByNetwrKrw(aChartRows);
        },

        /**
         * MQ 비교 목록과 차트 데이터를 KRW 환산총액 기준 오름차순으로 정렬한다.
         *
         * 사용자는 가장 낮은 견적부터 검토하는 흐름이 자연스럽기 때문에,
         * 테이블 행과 차트 막대가 모두 같은 순서를 갖도록 한 곳에서 정렬한다.
         */
        _sortMqCompareRowsByNetwrKrw(aRows) {
            return (aRows || []).slice().sort((oLeft, oRight) => {
                const iLeftNetwrKrw = this._getNetwrKrwSortValue(oLeft);
                const iRightNetwrKrw = this._getNetwrKrwSortValue(oRight);
                const iAmountCompare = iLeftNetwrKrw - iRightNetwrKrw;

                if (iAmountCompare !== 0) {
                    return iAmountCompare;
                }

                // 환산총액이 같은 경우에도 화면 순서가 흔들리지 않도록 MQ 번호와 품목을 보조 정렬 기준으로 둔다.
                return String((oLeft && oLeft.MqNo) || "").localeCompare(String((oRight && oRight.MqNo) || "")) ||
                    String((oLeft && oLeft.MqItem) || "").localeCompare(String((oRight && oRight.MqItem) || ""));
            });
        },

        /**
         * KRW 환산총액 정렬용 숫자 값을 반환한다.
         *
         * 값이 비어 있거나 숫자로 바꿀 수 없으면 맨 뒤로 보내기 위해 무한대 값을 사용한다.
         */
        _getNetwrKrwSortValue(oRow) {
            const iNetwrKrw = Number(oRow && oRow.NetwrKrw);

            return Number.isFinite(iNetwrKrw) ? iNetwrKrw : Number.POSITIVE_INFINITY;
        },

        /**
         * 현재 선택된 RFQ Item이 이미 PO 생성 완료 상태인지 확인한다.
         *
         * PO 생성 후에는 채택/채택취소처럼 DB 상태를 바꾸는 작업을 허용하면 안 된다.
         * Backend에서도 최종 차단하지만, 사용자가 변경 가능한 화면으로 오해하지 않도록
         * UI 이벤트에서도 한 번 더 막는다.
         */
        _isSelectedRfqItemPoCreated(oRfqItem) {
            const oWorkModel = this.getView().getModel("work");
            const oSelectedRfqItem = oRfqItem || (oWorkModel ? (oWorkModel.getProperty("/SelectedRfqItem") || {}) : {});

            return oSelectedRfqItem.ItemStatus === "PO"
                || oSelectedRfqItem.PoCreatedYn === "X"
                || !!oSelectedRfqItem.PoNo;
        },

        _setSelectedMq(oSelectedRow) {
            const oWorkModel = this.getView().getModel("work");
            const sMqNo = oSelectedRow && oSelectedRow.MqNo;
            const sMqItem = oSelectedRow && oSelectedRow.MqItem;

            if (!oWorkModel || !sMqNo || !sMqItem) {
                return;
            }

            const aUpdatedRows = (oWorkModel.getProperty("/MqCompareRows") || []).map((oRow) => {
                return Object.assign({}, oRow, {
                    UiSelected: oRow.MqNo === sMqNo && oRow.MqItem === sMqItem
                });
            });
            const oSelectedFromRows = aUpdatedRows.find((oRow) => {
                return oRow.MqNo === sMqNo && oRow.MqItem === sMqItem;
            }) || oSelectedRow;

            oWorkModel.setProperty("/MqCompareRows", aUpdatedRows);
            oWorkModel.setProperty("/SelectedMq", {
                RfqNo: oSelectedFromRows.RfqNo,
                RfqItem: oSelectedFromRows.RfqItem,
                MqNo: oSelectedFromRows.MqNo,
                MqItem: oSelectedFromRows.MqItem,
                Lifnr: oSelectedFromRows.Lifnr,
                Name1: oSelectedFromRows.Name1,
                CanSelect: oSelectedFromRows.CanSelect,
                BlockReason: oSelectedFromRows.BlockReason,
                RecommendYn: oSelectedFromRows.RecommendYn,
                CurrentAwardYn: oSelectedFromRows.CurrentAwardYn
            });
        },

        _findMqCompareRow(sMqNo, sMqItem) {
            const oWorkModel = this.getView().getModel("work");
            const aRows = oWorkModel ? (oWorkModel.getProperty("/MqCompareRows") || []) : [];

            if (!sMqNo || !sMqItem) {
                return null;
            }

            return aRows.find((oRow) => {
                return oRow.MqNo === sMqNo && oRow.MqItem === sMqItem;
            }) || null;
        },

        _findSelectableRecommendedMq() {
            const oWorkModel = this.getView().getModel("work");
            const aRows = oWorkModel ? (oWorkModel.getProperty("/MqCompareRows") || []) : [];

            return aRows.find((oRow) => {
                return oRow.RecommendYn === "X" && oRow.CanSelect === "X";
            }) || null;
        },

        /**
         * RFQ Header sap.m.Table에 정렬/그룹 Sorter를 적용한다.
         *
         * SAPUI5 Table/List 정렬은 별도 테이블 데이터를 다시 만들지 않고,
         * Binding에 Sorter 배열을 전달하는 방식으로 처리한다.
         */
        /**
         * KPI 카드로 선택한 채택상태를 RFQ Header Table에만 적용한다.
         *
         * 중요:
         * - 이 필터는 DynamicPage Header의 조회조건(`filter` 모델)을 바꾸지 않는다.
         * - 따라서 KPI 숫자는 마지막 조회 버튼으로 읽어온 RFQHeaderSet 결과 기준을 유지한다.
         * - 화면 목록만 좁혀 보여주기 위해 sap.m.Table의 items binding에 Application filter를 건다.
         */
        _applyHeaderQuickAwardStatusFilter(sAwardStatus, bSuppressToast) {
            const oView = this.getView();
            const oViewModel = oView.getModel("view");
            const oTable = this.byId("idRfqHeaderTable");
            const oBinding = oTable && oTable.getBinding && oTable.getBinding("items");
            const aTableFilters = sAwardStatus ? [
                new Filter("AwardStatus", FilterOperator.EQ, sAwardStatus)
            ] : [];

            if (oViewModel) {
                oViewModel.setProperty("/HeaderTableQuickAwardStatus", sAwardStatus || "");
            }

            if (oBinding && typeof oBinding.filter === "function") {
                oBinding.filter(aTableFilters, "Application");
            }

            this._updateRfqHeaderCountForQuickFilter(sAwardStatus);
            this._updateHeaderTableStateSummary();

            return bSuppressToast === true ? null : aTableFilters;
        },

        /**
         * RFQ Header 목록 제목의 (N)은 현재 화면에 보이는 목록 건수를 의미한다.
         *
         * KPI 숫자는 조회 결과 기준으로 유지하지만, 테이블 제목은 사용자가 보고 있는
         * 목록의 건수와 맞아야 하므로 빠른 필터가 있으면 해당 상태만 다시 센다.
         */
        _updateRfqHeaderCountForQuickFilter(sAwardStatus) {
            const oWorkModel = this.getView().getModel("work");
            const aRows = oWorkModel ? (oWorkModel.getProperty("/RfqHeaders") || []) : [];
            const iCount = sAwardStatus
                ? aRows.filter((oRow) => oRow && oRow.AwardStatus === sAwardStatus).length
                : aRows.length;

            if (oWorkModel) {
                oWorkModel.setProperty("/RfqHeaderCount", iCount);
            }
        },

        _applyHeaderTableSorters(sSortKey, bSortDescending, sGroupKey, bGroupDescending) {
            const oTable = this.byId("idRfqHeaderTable");
            const oBinding = oTable && oTable.getBinding && oTable.getBinding("items");
            const aSorters = [];

            this._setHeaderTableSortGroupState(sSortKey, bSortDescending, sGroupKey, bGroupDescending);

            if (!oBinding) {
                return;
            }

            if (sGroupKey) {
                /*
                 * 그룹 Sorter는 배열의 첫 번째에 둔다.
                 * 그래야 같은 그룹이 먼저 모이고, 그 안에서 별도 정렬 조건이 적용된다.
                 */
                aSorters.push(this._createHeaderTableSorter(
                    sGroupKey,
                    bGroupDescending,
                    this._getHeaderTableGroup.bind(this, sGroupKey)
                ));
            }

            if (sSortKey && sSortKey !== sGroupKey) {
                aSorters.push(this._createHeaderTableSorter(sSortKey, bSortDescending));
            }

            oBinding.sort(aSorters);
        },

        _reapplyHeaderTableSorters() {
            const oViewModel = this.getView().getModel("view");

            if (!oViewModel) {
                return;
            }

            this._applyHeaderTableSorters(
                oViewModel.getProperty("/HeaderTableSortKey"),
                oViewModel.getProperty("/HeaderTableSortDescending"),
                oViewModel.getProperty("/HeaderTableGroupKey"),
                oViewModel.getProperty("/HeaderTableGroupDescending")
            );
        },

        _resetHeaderTableSettings() {
            this._applyHeaderTableSorters("", false, "", false);
            this._resetHeaderTableSettingsDialog();
        },

        _resetHeaderTableSettingsDialog() {
            const oDialog = this.byId("idRfqHeaderTableSettingsDialog");

            if (!oDialog) {
                return;
            }

            if (typeof oDialog.setSortDescending === "function") {
                oDialog.setSortDescending(false);
            }

            if (typeof oDialog.setGroupDescending === "function") {
                oDialog.setGroupDescending(false);
            }

            this._clearViewSettingsItems(oDialog.getSortItems && oDialog.getSortItems());
            this._clearViewSettingsItems(oDialog.getGroupItems && oDialog.getGroupItems());
        },

        _clearViewSettingsItems(aItems) {
            (aItems || []).forEach((oItem) => {
                if (oItem && typeof oItem.setSelected === "function") {
                    oItem.setSelected(false);
                }
            });
        },

        _createHeaderTableSorter(sKey, bDescending, vGroup) {
            /*
             * Gateway Decimal/Integer가 문자열로 들어올 수 있는 필드는 숫자 comparator를 사용한다.
             * 예: "10"과 "2"를 문자열 비교하면 10이 2보다 앞서는 문제가 생길 수 있다.
             */
            const fnComparator = this._isHeaderNumericSortKey(sKey) ? this._compareNumericValues.bind(this) : undefined;

            return new Sorter(sKey, bDescending, vGroup, fnComparator);
        },

        _isHeaderNumericSortKey(sKey) {
            return [
                "RfqItemCount",
                "MqCount",
                "VendorCount",
                "AwardItemCount",
                "PoItemCount"
            ].indexOf(sKey) > -1;
        },

        _compareNumericValues(vA, vB) {
            let fA = Number(vA);
            let fB = Number(vB);

            if (Number.isNaN(fA)) {
                fA = 0;
            }

            if (Number.isNaN(fB)) {
                fB = 0;
            }

            if (fA < fB) {
                return -1;
            }

            if (fA > fB) {
                return 1;
            }

            return 0;
        },

        _getHeaderTableGroup(sProperty, oContext) {
            const oRow = oContext && oContext.getObject ? oContext.getObject() : {};
            let sKey = oRow[sProperty] || "";
            let sText = sKey || this._getText("notAvailable") || "N/A";

            if (sProperty === "AwardStatus") {
                sText = oRow.AwardStatusText || this._getAwardStatusTextByCode(sKey);
            } else if (sProperty === "DocDate") {
                sText = formatter.formatDate(oRow.DocDate);
                sKey = sText;
            } else if (sProperty === "Bukrs" && oRow.Butxt) {
                sText = sKey + " - " + oRow.Butxt;
            } else if (sProperty === "Ekorg" && oRow.Ekotx) {
                sText = sKey + " - " + oRow.Ekotx;
            } else if (sProperty === "Ekgrp" && oRow.Eknam) {
                sText = sKey + " - " + oRow.Eknam;
            }

            return {
                key: sKey,
                text: this._getHeaderTableSettingLabel(sProperty) + ": " + (sText || this._getText("notAvailable") || "N/A")
            };
        },

        _setHeaderTableSortGroupState(sSortKey, bSortDescending, sGroupKey, bGroupDescending) {
            const oViewModel = this.getView().getModel("view");

            if (!oViewModel) {
                return;
            }

            oViewModel.setProperty("/HeaderTableSortKey", sSortKey || "");
            oViewModel.setProperty("/HeaderTableSortDescending", !!bSortDescending);
            oViewModel.setProperty("/HeaderTableGroupKey", sGroupKey || "");
            oViewModel.setProperty("/HeaderTableGroupDescending", !!bGroupDescending);

            this._updateHeaderTableStateSummary();
        },

        _updateHeaderTableStateSummary() {
            const oViewModel = this.getView().getModel("view");

            if (!oViewModel) {
                return;
            }

            oViewModel.setProperty("/HeaderTableStatusSummary", this._getHeaderTableStatusSummary());
            oViewModel.setProperty("/HeaderTableSortGroupSummary", this._getHeaderTableSortGroupSummary());
        },

        _getHeaderTableStatusSummary() {
            const oViewModel = this.getView().getModel("view");
            const oFilterModel = this.getView().getModel("filter");
            const sQuickAwardStatus = oViewModel && oViewModel.getProperty("/HeaderTableQuickAwardStatus");
            const aAwardStatus = oFilterModel ? (oFilterModel.getProperty("/AwardStatus") || []) : [];

            if (sQuickAwardStatus) {
                return (this._getText("tableStatusSummaryPrefix") || "상태")
                    + ": "
                    + this._getAwardStatusTextByCode(sQuickAwardStatus);
            }

            if (!aAwardStatus.length) {
                return this._getText("tableStatusSummaryAll") || "상태: 전체";
            }

            return (this._getText("tableStatusSummaryPrefix") || "상태")
                + ": "
                + aAwardStatus.map((sStatus) => this._getAwardStatusTextByCode(sStatus)).filter(Boolean).join(", ");
        },

        _getHeaderTableSortGroupSummary() {
            const oViewModel = this.getView().getModel("view");
            const aParts = [];
            const sSortKey = oViewModel && oViewModel.getProperty("/HeaderTableSortKey");
            const sGroupKey = oViewModel && oViewModel.getProperty("/HeaderTableGroupKey");

            if (sSortKey) {
                aParts.push(
                    (this._getText("tableSortSummaryPrefix") || "정렬")
                    + ": "
                    + this._getHeaderTableSettingLabel(sSortKey)
                    + " "
                    + this._getOrderText(oViewModel.getProperty("/HeaderTableSortDescending"))
                );
            }

            if (sGroupKey) {
                aParts.push(
                    (this._getText("tableGroupSummaryPrefix") || "그룹")
                    + ": "
                    + this._getHeaderTableSettingLabel(sGroupKey)
                    + " "
                    + this._getOrderText(oViewModel.getProperty("/HeaderTableGroupDescending"))
                );
            }

            return aParts.length ? aParts.join(" / ") : (this._getText("tableSortGroupSummaryDefault") || "정렬/그룹: 기본");
        },

        _getHeaderTableSettingLabel(sKey) {
            const mLabelKeyByProperty = {
                RfqNo: "rfqNo",
                DocDate: "docDate",
                RfqItemCount: "rfqItemCount",
                MqCount: "mqCount",
                VendorCount: "vendorCount",
                AwardStatus: "awardStatus",
                Bukrs: "bukrs",
                Ekorg: "ekorg",
                Ekgrp: "ekgrp"
            };

            return mLabelKeyByProperty[sKey] ? this._getText(mLabelKeyByProperty[sKey]) : sKey;
        },

        _getOrderText(bDescending) {
            return bDescending ? (this._getText("sortDescending") || "내림차순") : (this._getText("sortAscending") || "오름차순");
        },

        _getAwardStatusTextByCode(sStatus) {
            const mTextKeyByStatus = {
                N: "awardStatusN",
                P: "awardStatusP",
                A: "awardStatusA",
                PO: "awardStatusPO"
            };

            return mTextKeyByStatus[sStatus] ? this._getText(mTextKeyByStatus[sStatus]) : sStatus;
        },

        /**
         * RFQ Item 하위 단계의 선택/비교 데이터를 비운다.
         *
         * Header를 바꿔 선택하면 이전 Header의 Item, MQ 후보, 차트가 남아 있으면 안 된다.
         * Header 자체와 Begin 목록은 유지하고, Mid Column 안쪽의 하위 업무 데이터만 초기화한다.
         */
        _clearRfqItemDependentArea() {
            const oWorkModel = this.getView().getModel("work");

            this._clearTableSelection("idRfqItemTable");

            if (oWorkModel) {
                oWorkModel.setProperty("/RfqItems", []);
                oWorkModel.setProperty("/SelectedRfqItem", {});
                oWorkModel.setProperty("/SelectedMq", {});
                oWorkModel.setProperty("/MqCompareRows", []);
                oWorkModel.setProperty("/ChartRows", []);
            }
        },

        /**
         * 날짜 조건을 Filter 배열에 추가한다.
         *
         * OData V2의 Edm.DateTime 필터는 Date 객체를 넘기면 UI5 ODataModel이 직렬화한다.
         * 자정 값을 그대로 쓰면 브라우저/서버 시간대 차이로 전날이 될 수 있으므로,
         * 납기지연 조회 프로그램과 동일하게 날짜 전용 조건은 정오 기준 Date로 보정한다.
         */
        _addDateFilter(aFilters, sProperty, sOperator, oDate) {
            if (oDate instanceof Date && !Number.isNaN(oDate.getTime())) {
                aFilters.push(new Filter(sProperty, sOperator, this._normalizeDate(oDate)));
            }
        },

        /**
         * MultiComboBox의 채택상태 선택값을 OR Filter로 변환한다.
         *
         * 예: 미채택(N), 일부채택(P)을 같이 선택하면
         * `(AwardStatus eq 'N' or AwardStatus eq 'P')` 형태로 Gateway에 전달된다.
         */
        _addAwardStatusFilters(aFilters, aAwardStatus) {
            const aStatusKeys = Array.isArray(aAwardStatus) ? aAwardStatus.filter(Boolean) : [];

            if (!aStatusKeys.length) {
                return;
            }

            aFilters.push(new Filter({
                filters: aStatusKeys.map((sStatus) => {
                    return new Filter("AwardStatus", FilterOperator.EQ, sStatus);
                }),
                and: false
            }));
        },

        /**
         * SAPUI5 OData V2 Model의 read 호출을 Promise 형태로 감싼다.
         *
         * OData 응답은 보통 `{ results: [...] }` 형태로 내려오므로 배열만 반환한다.
         * 단건 응답이 들어오더라도 이 함수는 EntitySet 조회 전용이므로 빈 배열로 방어한다.
         */
        _readEntitySet(sPath, aFilters) {
            const oModel = this.getOwnerComponent().getModel();

            return new Promise((resolve, reject) => {
                if (!oModel || !oModel.read) {
                    reject(new Error("Default ODataModel is not available."));
                    return;
                }

                oModel.read(sPath, {
                    filters: aFilters || [],
                    success: (oData) => {
                        resolve(oData && Array.isArray(oData.results) ? oData.results : []);
                    },
                    error: reject
                });
            });
        },

        _readEntity(sPath) {
            const oModel = this.getOwnerComponent().getModel();

            return new Promise((resolve, reject) => {
                if (!oModel || !oModel.read) {
                    reject(new Error("Default ODataModel is not available."));
                    return;
                }

                oModel.read(sPath, {
                    success: (oData) => {
                        resolve(oData || {});
                    },
                    error: reject
                });
            });
        },

        _updateEntity(sPath, oPayload, mParameters) {
            const oModel = this.getOwnerComponent().getModel();

            return new Promise((resolve, reject) => {
                if (!oModel || !oModel.update) {
                    reject(new Error("Default ODataModel update is not available."));
                    return;
                }

                oModel.update(sPath, oPayload, Object.assign({}, mParameters, {
                    success: resolve,
                    error: reject
                }));
            });
        },

        _confirmAction(sMessage) {
            return new Promise((resolve) => {
                MessageBox.confirm(sMessage, {
                    onClose: (sAction) => {
                        resolve(sAction === MessageBox.Action.OK);
                    }
                });
            });
        },

        _updateQuotationItem(sMqNo, sMqItem, sActionType, sSuccessMessage) {
            const oViewModel = this.getView().getModel("view");
            const sPath = this._createQuotationItemPath(sMqNo, sMqItem);
            const oPayload = {
                MqNo: sMqNo,
                MqItem: sMqItem,
                ActionType: sActionType
            };

            if (!sPath) {
                return Promise.resolve(null);
            }

            if (oViewModel) {
                oViewModel.setProperty("/Busy", true);
            }

            /*
             * 설계서 기준 채택/취소는 Function Import가 아니라 QuotationItemSet 단건 MERGE다.
             * Gateway가 성공 시 204 No Content를 줄 수 있으므로 success body에 의존하지 않고,
             * 성공 callback 자체를 기준으로 메시지와 재조회를 처리한다.
             */
            return this._updateEntity(sPath, oPayload, {
                merge: true
            }).then(() => {
                this._showToast(sSuccessMessage);
                return this._refreshAfterAward();
            }).catch((oError) => {
                this._showToast(this._getText("msgDefaultError") || "처리 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.");
                throw oError;
            }).finally(() => {
                if (oViewModel) {
                    oViewModel.setProperty("/Busy", false);
                }
            });
        },

        _createQuotationItemPath(sMqNo, sMqItem) {
            const oModel = this.getOwnerComponent().getModel();

            if (!sMqNo || !sMqItem) {
                return "";
            }

            if (oModel && oModel.createKey) {
                return oModel.createKey("/QuotationItemSet", {
                    MqNo: sMqNo,
                    MqItem: sMqItem
                });
            }

            return "/QuotationItemSet(MqNo='" + this._escapeODataKeyValue(sMqNo) + "',MqItem='" + this._escapeODataKeyValue(sMqItem) + "')";
        },

        _findRfqHeaderByNo(aHeaders, sRfqNo) {
            if (!sRfqNo) {
                return null;
            }

            return (aHeaders || []).find((oHeader) => {
                return oHeader && oHeader.RfqNo === sRfqNo;
            }) || null;
        },

        _refreshAfterAward() {
            const oView = this.getView();
            const oViewModel = oView.getModel("view");
            const oWorkModel = oView.getModel("work");
            const oSelectedRfq = oWorkModel ? (oWorkModel.getProperty("/SelectedRfq") || {}) : {};
            const oSelectedRfqItem = oWorkModel ? (oWorkModel.getProperty("/SelectedRfqItem") || {}) : {};
            const sCurrentLayout = oViewModel ? oViewModel.getProperty("/FclLayout") : "";
            const sRfqNo = oSelectedRfqItem.RfqNo || oSelectedRfq.RfqNo;
            const sRfqItem = oSelectedRfqItem.RfqItem;

            /*
             * 채택 성공 후에는 Header KPI, Item 상태/채택 공급업체, MQ 비교 상태가 모두 바뀔 수 있다.
             * 따라서 Header -> Item -> MQ 순서로 다시 읽는다. Item 재조회 중 하위 영역이 초기화되므로,
             * 기존에 사용자가 보고 있던 RFQ와 RFQ Item 컨텍스트는 다시 세팅한 뒤 MQCompareSet을 호출한다.
            */
            return this._loadRfqHeaders({
                keepComparisonContext: true
            }).then((aHeaders) => {
                if (!sRfqNo) {
                    return null;
                }

                const oUpdatedRfq = this._findRfqHeaderByNo(aHeaders, sRfqNo) || oSelectedRfq;

                if (oWorkModel) {
                    /*
                     * RFQ Header list is re-read after AWARD/CANCEL, so the Mid header must
                     * point to the refreshed Header row. Keeping the old object leaves
                     * AwardStatusText stale even though the Begin table already changed.
                     */
                    oWorkModel.setProperty("/SelectedRfq", oUpdatedRfq);
                }

                return this._loadRfqItemsForRfq(sRfqNo).then((aItems) => {
                    const oUpdatedItem = (aItems || []).find((oItem) => {
                        return oItem.RfqItem === sRfqItem;
                    }) || oSelectedRfqItem;

                    if (oWorkModel) {
                        oWorkModel.setProperty("/SelectedRfq", oUpdatedRfq);
                        oWorkModel.setProperty("/SelectedRfqItem", oUpdatedItem || {});
                    }

                    if (!sRfqItem) {
                        return [];
                    }

                    return this._loadMqCompareForRfqItem(Object.assign({}, oUpdatedItem || {}, {
                        RfqNo: sRfqNo,
                        RfqItem: sRfqItem
                    })).then((aRows) => {
                        /*
                         * Header/Item/MQ를 다시 읽어도 저장 직전 사용자가 보고 있던 FCL 배치를 복원한다.
                         * 채택은 데이터 변경이지 화면 닫기가 아니므로 `onCloseMidColumn`의 OneColumn 초기화와 분리한다.
                         */
                        if (oViewModel && sCurrentLayout) {
                            oViewModel.setProperty("/FclLayout", sCurrentLayout);
                        }

                        return aRows;
                    });
                });
            });
        },

        /**
         * 선택 RFQ의 RFQ Item을 순차적으로 일괄 채택한다.
         *
         * 처리 기준:
         * - PO 생성 Item은 변경하지 않는다.
         * - 이미 채택된 Item은 중복 채택하지 않고 결과 메시지만 남긴다.
         * - 미채택 Item은 MQCompareSet을 RFQ Item 단위로 조회한 뒤 Backend가 계산한
         *   RecommendYn = X, CanSelect = X MQ만 채택한다.
         * - 각 Item의 성공/제외/오류 결과는 footer MessagePopover에 누적 표시한다.
         */
        _executeBulkAward(oSelectedRfq, aRfqItems) {
            const oViewModel = this.getView().getModel("view");
            const aItems = aRfqItems || [];
            const aResults = [];

            if (oViewModel) {
                oViewModel.setProperty("/Busy", true);
            }

            if (!aItems.length) {
                this._setProcessMessages([
                    this._createProcessMessage(
                        "Warning",
                        this._getText("msgBulkNoTarget") || "처리 대상 RFQ Item이 없습니다.",
                        this._getText("bulkAward") || "일괄 채택"
                    )
                ]);
                this._openProcessMessagePopoverDelayed();

                if (oViewModel) {
                    oViewModel.setProperty("/Busy", false);
                }

                return Promise.resolve(false);
            }

            return this._executeSequential(aItems, (oItem) => {
                return this._processBulkAwardItem(oSelectedRfq, oItem).then((oResult) => {
                    aResults.push(oResult);
                });
            }).then(() => {
                const aMessages = aResults.map((oResult) => oResult.message);
                const bChanged = aResults.some((oResult) => oResult.changed);

                this._setProcessMessages(aMessages);

                if (!bChanged) {
                    this._openProcessMessagePopoverDelayed();
                    return false;
                }

                return this._refreshAfterAward().catch((oError) => {
                    aMessages.push(this._createProcessMessage(
                        "Error",
                        this._getText("msgBulkRefreshError") ||
                        "일괄 처리 후 화면 데이터 갱신 중 오류가 발생했습니다.",
                        this._getText("bulkAward") || "일괄 채택",
                        this._getODataErrorText(oError)
                    ));
                    this._setProcessMessages(aMessages);
                }).then(() => {
                    this._openProcessMessagePopoverDelayed();
                    return true;
                });
            }).finally(() => {
                if (oViewModel) {
                    oViewModel.setProperty("/Busy", false);
                }
            });
        },

        /**
         * RFQ Item 1건에 대한 일괄 채택 처리를 수행한다.
         *
         * 단건 채택 버튼의 `_updateQuotationItem`은 toast와 refresh를 함께 수행하므로
         * 일괄 처리에서는 refresh 없는 `_updateQuotationItemForBulk`를 사용한다.
         */
        _processBulkAwardItem(oSelectedRfq, oRfqItem) {
            const sRfqItem = this._getBulkItemNo(oRfqItem);
            const sSubtitle = this._getText("bulkAward") || "일괄 채택";

            if (this._isSelectedRfqItemPoCreated(oRfqItem)) {
                return Promise.resolve({
                    changed: false,
                    message: this._createProcessMessage(
                        "Error",
                        this._getText("msgBulkSkipPoCreated", [sRfqItem]) ||
                        "RFQ Item " + sRfqItem + ": 이미 PO가 생성되어 제외되었습니다.",
                        sSubtitle
                    )
                });
            }

            if (this._isRfqItemAwarded(oRfqItem)) {
                return Promise.resolve({
                    changed: false,
                    message: this._createProcessMessage(
                        "Error",
                        this._getText("msgBulkSkipAlreadyAwarded", [sRfqItem]) ||
                        "RFQ Item " + sRfqItem + ": 이미 채택되어 제외되었습니다.",
                        sSubtitle
                    )
                });
            }

            return this._readMqCompareRowsForBulkItem(oSelectedRfq, oRfqItem).then((aRows) => {
                const oRecommendedMq = this._findSelectableRecommendedMqInRows(aRows);

                if (!oRecommendedMq) {
                    return {
                        changed: false,
                        message: this._createProcessMessage(
                            "Error",
                            this._getText("msgBulkSkipNoRecommend", [sRfqItem]) ||
                            "RFQ Item " + sRfqItem + ": 선택 가능한 자동추천 MQ가 없어 제외되었습니다.",
                            sSubtitle
                        )
                    };
                }

                return this._updateQuotationItemForBulk(
                    oRecommendedMq.MqNo,
                    oRecommendedMq.MqItem,
                    "AWARD"
                ).then(() => {
                    return {
                        changed: true,
                        message: this._createProcessMessage(
                            "Success",
                            this._getText("msgBulkAwardSuccess", [sRfqItem, oRecommendedMq.MqNo, oRecommendedMq.MqItem]) ||
                            "RFQ Item " + sRfqItem + ": 자동추천 MQ " + oRecommendedMq.MqNo + "/" + oRecommendedMq.MqItem + "가 채택되었습니다.",
                            sSubtitle
                        )
                    };
                });
            }).catch((oError) => {
                return {
                    changed: false,
                    message: this._createProcessMessage(
                        "Error",
                        this._getText("msgBulkAwardError", [sRfqItem]) ||
                        "RFQ Item " + sRfqItem + ": 일괄 채택 처리 중 오류가 발생했습니다.",
                        sSubtitle,
                        this._getODataErrorText(oError)
                    )
                };
            });
        },

        /**
         * 선택 RFQ의 채택 가능 RFQ Item을 순차적으로 일괄 채택취소한다.
         */
        _executeBulkCancelAward(oSelectedRfq, aRfqItems) {
            const oViewModel = this.getView().getModel("view");
            const aItems = aRfqItems || [];
            const aResults = [];

            if (oViewModel) {
                oViewModel.setProperty("/Busy", true);
            }

            if (!aItems.length) {
                this._setProcessMessages([
                    this._createProcessMessage(
                        "Warning",
                        this._getText("msgBulkNoTarget") || "처리 대상 RFQ Item이 없습니다.",
                        this._getText("bulkCancelAward") || "일괄 채택취소"
                    )
                ]);
                this._openProcessMessagePopoverDelayed();

                if (oViewModel) {
                    oViewModel.setProperty("/Busy", false);
                }

                return Promise.resolve(false);
            }

            return this._executeSequential(aItems, (oItem) => {
                return this._processBulkCancelAwardItem(oItem).then((oResult) => {
                    aResults.push(oResult);
                });
            }).then(() => {
                const aMessages = aResults.map((oResult) => oResult.message);
                const bChanged = aResults.some((oResult) => oResult.changed);

                this._setProcessMessages(aMessages);

                if (!bChanged) {
                    this._openProcessMessagePopoverDelayed();
                    return false;
                }

                return this._refreshAfterAward().catch((oError) => {
                    aMessages.push(this._createProcessMessage(
                        "Error",
                        this._getText("msgBulkRefreshError") ||
                        "일괄 처리 후 화면 데이터 갱신 중 오류가 발생했습니다.",
                        this._getText("bulkCancelAward") || "일괄 채택취소",
                        this._getODataErrorText(oError)
                    ));
                    this._setProcessMessages(aMessages);
                }).then(() => {
                    this._openProcessMessagePopoverDelayed();
                    return true;
                });
            }).finally(() => {
                if (oViewModel) {
                    oViewModel.setProperty("/Busy", false);
                }
            });
        },

        /**
         * RFQ Item 1건에 대한 일괄 채택취소 처리를 수행한다.
         */
        _processBulkCancelAwardItem(oRfqItem) {
            const sRfqItem = this._getBulkItemNo(oRfqItem);
            const sAwardMqNo = oRfqItem && oRfqItem.AwardMqNo;
            const sAwardMqItem = oRfqItem && oRfqItem.AwardMqItem;
            const sSubtitle = this._getText("bulkCancelAward") || "일괄 채택취소";

            if (this._isSelectedRfqItemPoCreated(oRfqItem)) {
                return Promise.resolve({
                    changed: false,
                    message: this._createProcessMessage(
                        "Error",
                        this._getText("msgBulkSkipPoCreated", [sRfqItem]) ||
                        "RFQ Item " + sRfqItem + ": 이미 PO가 생성되어 제외되었습니다.",
                        sSubtitle
                    )
                });
            }

            if (!oRfqItem || oRfqItem.CanCancelAward !== "X" || !sAwardMqNo || !sAwardMqItem) {
                return Promise.resolve({
                    changed: false,
                    message: this._createProcessMessage(
                        "Error",
                        this._getText("msgBulkSkipNoAward", [sRfqItem]) ||
                        "RFQ Item " + sRfqItem + ": 채택취소할 MQ가 없어 제외되었습니다.",
                        sSubtitle
                    )
                });
            }

            return this._updateQuotationItemForBulk(
                sAwardMqNo,
                sAwardMqItem,
                "CANCEL"
            ).then(() => {
                return {
                    changed: true,
                    message: this._createProcessMessage(
                        "Success",
                        this._getText("msgBulkCancelSuccess", [sRfqItem, sAwardMqNo, sAwardMqItem]) ||
                        "RFQ Item " + sRfqItem + ": 채택 MQ " + sAwardMqNo + "/" + sAwardMqItem + "가 취소되었습니다.",
                        sSubtitle
                    )
                };
            }).catch((oError) => {
                return {
                    changed: false,
                    message: this._createProcessMessage(
                        "Error",
                        this._getText("msgBulkCancelError", [sRfqItem]) ||
                        "RFQ Item " + sRfqItem + ": 일괄 채택취소 처리 중 오류가 발생했습니다.",
                        sSubtitle,
                        this._getODataErrorText(oError)
                    )
                };
            });
        },

        /**
         * 일괄 채택용 MQCompareSet 조회.
         *
         * 일반 `_loadMqCompareForRfqItem`은 화면의 MQ 비교표와 차트를 갱신한다.
         * 일괄 처리 중에는 사용자가 보고 있는 선택 Item/차트를 계속 유지해야 하므로
         * work 모델을 변경하지 않는 별도 조회 helper를 사용한다.
         */
        _readMqCompareRowsForBulkItem(oSelectedRfq, oRfqItem) {
            const sRfqNo = (oRfqItem && oRfqItem.RfqNo) || (oSelectedRfq && oSelectedRfq.RfqNo);
            const sRfqItem = oRfqItem && oRfqItem.RfqItem;

            if (!sRfqNo || !sRfqItem) {
                return Promise.resolve([]);
            }

            return this._readEntitySet("/MQCompareSet", this._buildMqCompareFilters(sRfqNo, sRfqItem))
                .then((aRows) => {
                    return this._sortMqCompareRowsByNetwrKrw((aRows || []).map((oRow) => {
                        return Object.assign({}, oRow);
                    }));
                });
        },

        _findSelectableRecommendedMqInRows(aRows) {
            return (aRows || []).find((oRow) => {
                return oRow && oRow.RecommendYn === "X" && oRow.CanSelect === "X";
            }) || null;
        },

        _updateQuotationItemForBulk(sMqNo, sMqItem, sActionType) {
            const sPath = this._createQuotationItemPath(sMqNo, sMqItem);

            if (!sPath) {
                return Promise.reject(new Error("MQ key is missing."));
            }

            return this._updateEntity(sPath, {
                MqNo: sMqNo,
                MqItem: sMqItem,
                ActionType: sActionType
            }, {
                merge: true
            });
        },

        _executeSequential(aItems, fnHandler) {
            return (aItems || []).reduce((pChain, oItem) => {
                return pChain.then(() => fnHandler(oItem));
            }, Promise.resolve());
        },

        _isRfqItemAwarded(oRfqItem) {
            /*
             * 채택 여부는 상태 코드와 취소 가능 플래그를 기준으로 판단한다.
             *
             * 주의:
             * AwardMqNo / AwardMqItem은 화면 표시나 후속 처리를 위해 내려오는 보조 식별값일 수 있다.
             * 이 값만 보고 채택으로 판단하면, 미채택 Item인데도 "이미 채택"으로 오판할 수 있다.
             * 실제로 채택된 Item은 Backend RFQItemSet에서 ItemStatus = A 또는 CanCancelAward = X로
             * 내려오므로 이 두 값만 채택 판단 기준으로 사용한다.
             */
            return !!(oRfqItem && (
                oRfqItem.ItemStatus === "A" ||
                oRfqItem.CanCancelAward === "X"
            ));
        },

        _getBulkItemNo(oRfqItem) {
            return (oRfqItem && oRfqItem.RfqItem) || "-";
        },

        /**
         * Gateway Business Exception / Technical Error에서 사용자에게 보여줄 수 있는
         * 메시지를 최대한 추출한다.
         */
        _getODataErrorText(oError) {
            const sDefaultMessage = this._getText("msgDefaultError") ||
                "처리 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.";
            let oParsed;

            if (!oError) {
                return sDefaultMessage;
            }

            if (oError.responseText) {
                try {
                    oParsed = JSON.parse(oError.responseText);
                    return (oParsed && oParsed.error && oParsed.error.message && oParsed.error.message.value) ||
                        sDefaultMessage;
                } catch (oParseError) {
                    return oError.responseText;
                }
            }

            return oError.message || sDefaultMessage;
        },

        _loadMqDetail(sMqNo, sMqItem) {
            const oView = this.getView();
            const oViewModel = oView.getModel("view");
            const oDetailModel = oView.getModel("detail");
            const sPath = this._createMqDetailPath(sMqNo, sMqItem);

            if (!sPath) {
                return Promise.resolve(null);
            }

            if (oViewModel) {
                oViewModel.setProperty("/Busy", true);
            }

            return this._readEntity(sPath).then((oData) => {
                if (oDetailModel) {
                    oDetailModel.setProperty("/MqDetail", oData || {});
                }

                return this._openMqDetailDialog().then(() => oData);
            }).catch((oError) => {
                if (oDetailModel) {
                    oDetailModel.setProperty("/MqDetail", {});
                }

                this._showToast(this._getText("msgLoadMqDetailError") || "MQ 상세정보 조회 중 오류가 발생했습니다.");
                throw oError;
            }).finally(() => {
                if (oViewModel) {
                    oViewModel.setProperty("/Busy", false);
                }
            });
        },

        _createMqDetailPath(sMqNo, sMqItem) {
            const oModel = this.getOwnerComponent().getModel();

            if (!sMqNo || !sMqItem) {
                return "";
            }

            if (oModel && oModel.createKey) {
                return oModel.createKey("/MQDetailSet", {
                    MqNo: sMqNo,
                    MqItem: sMqItem
                });
            }

            return "/MQDetailSet(MqNo='" + this._escapeODataKeyValue(sMqNo) + "',MqItem='" + this._escapeODataKeyValue(sMqItem) + "')";
        },

        _escapeODataKeyValue(sValue) {
            return String(sValue).replace(/'/g, "''");
        },

        _openMqDetailDialog() {
            const oView = this.getView();

            if (!this._pMqDetailDialog) {
                this._pMqDetailDialog = Fragment.load({
                    id: oView.getId(),
                    name: "code.d3.quotecomparison.fragment.MQDetailDialog",
                    controller: this
                }).then((oDialog) => {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            return this._pMqDetailDialog.then((oDialog) => {
                oDialog.open();
                return oDialog;
            });
        },

        /**
         * RFQ Header 상태별 KPI를 계산한다.
         *
         * Backend가 Header별 AwardStatus를 이미 계산해서 내려주므로,
         * UI5에서는 조회 결과 배열을 순회하며 상태 코드별 건수만 세면 된다.
         */
        _updateHeaderKpis(aRows) {
            const oWorkModel = this.getView().getModel("work");
            const oKpi = {
                NotAwarded: 0,
                PartiallyAwarded: 0,
                Awarded: 0,
                PoCreated: 0
            };

            (aRows || []).forEach((oRow) => {
                switch (oRow.AwardStatus) {
                    case "N":
                        oKpi.NotAwarded += 1;
                        break;
                    case "P":
                        oKpi.PartiallyAwarded += 1;
                        break;
                    case "A":
                        oKpi.Awarded += 1;
                        break;
                    case "PO":
                        oKpi.PoCreated += 1;
                        break;
                    default:
                        break;
                }
            });

            if (oWorkModel) {
                oWorkModel.setProperty("/Kpi", oKpi);
            }
        },

        /**
         * 새 Header 조회 전에 하위 비교 영역을 초기화한다.
         *
         * RFQ Header를 다시 조회하면 이전 Header의 RFQ Item/MQ 후보가 남아 있으면 안 된다.
         * 따라서 Begin Column 목록은 조회 결과로 갱신하되, Mid Column 관련 선택값과 비교 데이터는 비운다.
         */
        _clearSelectionAndComparisonArea() {
            const oView = this.getView();
            const oViewModel = oView.getModel("view");
            const oWorkModel = oView.getModel("work");

            this._clearTableSelection("idRfqHeaderTable");
            this._clearTableSelection("idRfqItemTable");

            if (oViewModel) {
                oViewModel.setProperty("/FclLayout", "OneColumn");
            }

            if (oWorkModel) {
                oWorkModel.setProperty("/SelectedRfq", {});
                oWorkModel.setProperty("/SelectedRfqItem", {});
                oWorkModel.setProperty("/SelectedMq", {});
                oWorkModel.setProperty("/RfqItems", []);
                oWorkModel.setProperty("/MqCompareRows", []);
                oWorkModel.setProperty("/ChartRows", []);
            }
        },

        /**
         * FlexibleColumnLayout의 현재 배치를 변경한다.
         *
         * 레이아웃 변경은 여러 버튼에서 반복되므로 작은 헬퍼로 모아둔다.
         * 이렇게 해두면 이후 SemanticHelper를 도입하더라도 이 함수 안에서만 변경하면 된다.
         */
        _clearTableSelection(sTableId) {
            const oTable = this.byId(sTableId);

            if (oTable && oTable.removeSelections) {
                oTable.removeSelections(true);
            }
        },

        _setFclLayout(sLayout) {
            const oViewModel = this.getView().getModel("view");

            if (oViewModel) {
                oViewModel.setProperty("/FclLayout", sLayout);
            }
        },

        /**
         * 날짜만 의미 있는 조회조건을 정오 기준 Date로 보정한다.
         *
         * 이 방식은 날짜가 UTC 변환 과정에서 전날로 밀리는 문제를 줄이기 위한 실무 방어 코드다.
         */
        _normalizeDate(oDate) {
            return new Date(oDate.getFullYear(), oDate.getMonth(), oDate.getDate(), 12, 0, 0);
        },

        /**
         * i18n 텍스트를 읽는다.
         *
         * 테스트나 초기 렌더링 시점에 i18n 모델이 아직 없을 수 있으므로 방어적으로 빈 문자열을 반환한다.
         */
        _getText(sKey, aArgs) {
            const oI18nModel = this.getView().getModel("i18n");
            const oBundle = oI18nModel && oI18nModel.getResourceBundle && oI18nModel.getResourceBundle();

            return oBundle && oBundle.getText ? oBundle.getText(sKey, aArgs) : "";
        },

        /**
         * Search Help 설정을 반환한다.
         *
         * CDS OData Service는 manifest.json의 named model로 등록해 두고,
         * 이 함수에서는 화면 Help Type과 OData 모델/EntitySet/표시 컬럼/입력 대상 필드의 관계만 정의한다.
         *
         * targetFields:
         * - key     : Search Help OData 결과 Property
         * - value   : filter JSONModel에 반영할 경로
         * - control : ValueState를 초기화할 화면 Input ID
         *
         * 공급업체와 자재는 코드를 선택하면 명칭까지 함께 채운다.
         */
        _getValueHelpConfig(sHelpType) {
            const mConfig = {
                RFQ: {
                    model: "rfqHelp",
                    path: "/ZCDS_D3_MM_0021",
                    title: this._getText("valueHelpRfqTitle") || "RFQ 검색",
                    searchFields: ["RfqNo", "Bukrs", "BukrsName", "Ekorg", "EkorgName", "Ekgrp", "EkgrpName"],
                    columns: [
                        { label: this._getText("rfqNo") || "RFQ번호", property: "RfqNo" },
                        { label: this._getText("docDate") || "문서일자", property: "DocDate", formatter: "date" },
                        { label: this._getText("bukrs") || "회사코드", property: "Bukrs" },
                        { label: this._getText("bukrsName") || "회사명", property: "BukrsName" },
                        { label: this._getText("ekorg") || "구매조직", property: "Ekorg" },
                        { label: this._getText("ekgrp") || "구매그룹", property: "Ekgrp" }
                    ],
                    targetFields: {
                        RfqNo: {
                            path: "/RfqNo",
                            controlId: "idRfqNoInput"
                        }
                    }
                },
                MQ: {
                    model: "mqHelp",
                    path: "/ZCDS_D3_MM_0022",
                    title: this._getText("valueHelpMqTitle") || "MQ 검색",
                    searchFields: ["MqNo", "Lifnr", "Name1", "Bukrs", "BukrsName", "Ekorg", "EkorgName", "Ekgrp", "EkgrpName"],
                    columns: [
                        { label: this._getText("mqNo") || "MM견적(MQ)번호", property: "MqNo" },
                        { label: this._getText("lifnr") || "공급업체코드", property: "Lifnr" },
                        { label: this._getText("name1") || "공급업체명", property: "Name1" },
                        { label: this._getText("docDate") || "문서일자", property: "DocDate", formatter: "date" },
                        { label: this._getText("bukrs") || "회사코드", property: "Bukrs" },
                        { label: this._getText("ekorg") || "구매조직", property: "Ekorg" },
                        { label: this._getText("ekgrp") || "구매그룹", property: "Ekgrp" }
                    ],
                    targetFields: {
                        MqNo: {
                            path: "/MqNo",
                            controlId: "idMqNoInput"
                        }
                    }
                },
                PLANT: {
                    model: "plantHelp",
                    path: "/ZCDS_D3_MM_0012",
                    title: this._getText("valueHelpPlantTitle") || "플랜트 검색",
                    searchFields: ["Werks", "WerksName"],
                    columns: [
                        { label: this._getText("werks") || "플랜트코드", property: "Werks" },
                        { label: this._getText("werksName") || "플랜트명", property: "WerksName" }
                    ],
                    targetFields: {
                        Werks: {
                            path: "/Werks",
                            controlId: "idWerksInput"
                        }
                    }
                },
                VENDOR: {
                    model: "vendorHelp",
                    path: "/ZCDS_D3_MM_0013",
                    title: this._getText("valueHelpVendorTitle") || "공급업체 검색",
                    searchFields: ["Lifnr", "Name1", "Land1", "Waers"],
                    columns: [
                        { label: this._getText("lifnr") || "공급업체코드", property: "Lifnr" },
                        { label: this._getText("name1") || "공급업체명", property: "Name1" },
                        { label: this._getText("land1") || "국가", property: "Land1" },
                        { label: this._getText("waers") || "통화", property: "Waers" }
                    ],
                    targetFields: {
                        Lifnr: {
                            path: "/Lifnr",
                            controlId: "idLifnrInput"
                        },
                        Name1: {
                            path: "/Name1",
                            controlId: "idName1Input"
                        }
                    }
                },
                MATERIAL: {
                    model: "materialHelp",
                    path: "/ZCDS_D3_MM_0014",
                    title: this._getText("valueHelpMaterialTitle") || "자재 검색",
                    searchFields: ["Matnr", "Maktx", "Maktg", "Mtart", "MtartName", "Matkl", "MatklName"],
                    columns: [
                        { label: this._getText("matnr") || "자재코드", property: "Matnr", formatter: "matnrExternal" },
                        { label: this._getText("maktx") || "자재명", property: "Maktx" },
                        { label: this._getText("mtart") || "자재유형", property: "Mtart" },
                        { label: this._getText("mtartName") || "자재유형명", property: "MtartName" },
                        { label: this._getText("meins") || "단위", property: "Meins" }
                    ],
                    targetFields: {
                        Matnr: {
                            path: "/Matnr",
                            controlId: "idMatnrInput"
                        },
                        Maktx: {
                            path: "/Maktx",
                            controlId: "idMaktxInput"
                        }
                    },
                    alpha: true
                },
                COMPANY: {
                    model: "companyHelp",
                    path: "/ZCDS_D3_MM_0016",
                    title: this._getText("valueHelpCompanyTitle") || "회사코드 검색",
                    searchFields: ["Bukrs", "BukrsName", "Waers", "Land1"],
                    columns: [
                        { label: this._getText("bukrs") || "회사코드", property: "Bukrs" },
                        { label: this._getText("bukrsName") || "회사명", property: "BukrsName" },
                        { label: this._getText("waers") || "통화", property: "Waers" },
                        { label: this._getText("land1") || "국가", property: "Land1" }
                    ],
                    targetFields: {
                        Bukrs: {
                            path: "/Bukrs",
                            controlId: "idBukrsInput"
                        }
                    }
                },
                PURCH_ORG: {
                    model: "purchOrgHelp",
                    path: "/ZCDS_D3_MM_0023",
                    title: this._getText("valueHelpPurchOrgTitle") || "구매조직 검색",
                    searchFields: ["Ekorg", "EkorgName"],
                    columns: [
                        { label: this._getText("ekorg") || "구매조직", property: "Ekorg" },
                        { label: this._getText("ekotx") || "구매조직명", property: "EkorgName" }
                    ],
                    targetFields: {
                        Ekorg: {
                            path: "/Ekorg",
                            controlId: "idEkorgInput"
                        }
                    }
                },
                PURCH_GROUP: {
                    model: "purchGroupHelp",
                    path: "/ZCDS_D3_MM_0024",
                    title: this._getText("valueHelpPurchGroupTitle") || "구매그룹 검색",
                    searchFields: ["Ekgrp", "EkgrpName"],
                    columns: [
                        { label: this._getText("ekgrp") || "구매그룹", property: "Ekgrp" },
                        { label: this._getText("eknam") || "구매그룹명", property: "EkgrpName" }
                    ],
                    targetFields: {
                        Ekgrp: {
                            path: "/Ekgrp",
                            controlId: "idEkgrpInput"
                        }
                    }
                }
            };

            return mConfig[sHelpType];
        },

        /**
         * Search Help Dialog의 크기를 컬럼 수에 따라 정한다.
         *
         * 별도 CSS를 만들지 않고 TableSelectDialog의 표준 contentWidth/contentHeight 속성만 사용한다.
         */
        _getValueHelpDialogSize(oConfig) {
            const iColumnCount = oConfig && Array.isArray(oConfig.columns) ? oConfig.columns.length : 0;

            if (iColumnCount <= 2) {
                return {
                    contentWidth: "38rem",
                    contentHeight: "18rem"
                };
            }

            if (iColumnCount <= 4) {
                return {
                    contentWidth: "56rem",
                    contentHeight: "24rem"
                };
            }

            return {
                contentWidth: "68rem",
                contentHeight: "28rem"
            };
        },

        /**
         * sap.m.TableSelectDialog 기반 공통 Search Help Dialog를 연다.
         *
         * SAPUI5 SDK의 TableSelectDialog 사용 패턴과 동일하게
         * items aggregation에 Help OData EntitySet을 바인딩하고, 검색과 선택 반영을 한 곳에서 처리한다.
         */
        _openValueHelpDialog(oConfig) {
            const oHelpModel = this.getOwnerComponent().getModel(oConfig.model);
            const aColumns = oConfig.columns || [];
            const oDialogSize = this._getValueHelpDialogSize(oConfig);
            let oTemplate;

            if (!oHelpModel) {
                this._showToast(this._getText("valueHelpModelMissing") || "Search Help 모델을 찾을 수 없습니다.");
                return;
            }

            if (this._oValueHelpDialog) {
                this._oValueHelpDialog.destroy();
                this._oValueHelpDialog = null;
            }

            oTemplate = new ColumnListItem({
                cells: aColumns.map(function (oColumnConfig) {
                    return new Text({
                        text: {
                            path: oConfig.model + ">" + oColumnConfig.property,
                            formatter: this._formatValueHelpCell.bind(this, oColumnConfig)
                        },
                        wrapping: false
                    });
                }.bind(this))
            });

            this._oValueHelpDialog = new TableSelectDialog({
                title: oConfig.title,
                noDataText: this._getText("valueHelpNoData") || "조회된 데이터가 없습니다.",
                growing: true,
                growingThreshold: 20,
                multiSelect: false,
                rememberSelections: false,
                contentWidth: oDialogSize.contentWidth,
                contentHeight: oDialogSize.contentHeight,
                draggable: true,
                resizable: true,
                search: function (oEvent) {
                    const sSearchValue = oEvent.getParameter("value");
                    const oBinding = oEvent.getSource().getBinding("items");

                    if (oBinding) {
                        oBinding.filter(this._buildValueHelpFilters(oConfig, sSearchValue));
                    }
                }.bind(this),
                confirm: function (oEvent) {
                    this._applySelectedValueHelp(oConfig, oEvent.getParameter("selectedItem"));
                }.bind(this)
            });

            aColumns.forEach(function (oColumnConfig) {
                this._oValueHelpDialog.addColumn(new Column({
                    header: new Text({
                        text: oColumnConfig.label
                    })
                }));
            }.bind(this));

            this._oValueHelpDialog.setModel(oHelpModel, oConfig.model);
            this._oValueHelpDialog.bindAggregation("items", {
                path: oConfig.model + ">" + oConfig.path,
                template: oTemplate,
                templateShareable: false
            });

            this.getView().addDependent(this._oValueHelpDialog);
            this._oValueHelpDialog.open();
        },

        /**
         * Search Help Dialog 검색어를 OData Filter로 변환한다.
         *
         * 여러 검색 대상 필드는 OR 조건으로 묶는다.
         * 자재코드는 DB 내부값이 ALPHA 형식일 수 있으므로, 숫자 검색어는 내부형식 검색 조건도 함께 추가한다.
         */
        _buildValueHelpFilters(oConfig, sSearchValue) {
            const sValue = String(sSearchValue || "").trim();
            let aFilters = [];
            let sInternalMatnr;

            if (!sValue) {
                return [];
            }

            aFilters = (oConfig.searchFields || []).map(function (sProperty) {
                return new Filter(sProperty, FilterOperator.Contains, sValue);
            });

            if (oConfig.alpha) {
                sInternalMatnr = this._toInternalMatnr(sValue);

                if (sInternalMatnr && sInternalMatnr !== sValue) {
                    aFilters.push(new Filter("Matnr", FilterOperator.Contains, sInternalMatnr));
                }
            }

            return aFilters.length ? [new Filter({
                filters: aFilters,
                and: false
            })] : [];
        },

        /**
         * Search Help가 연결된 코드형 조회조건의 존재 여부를 검증한다.
         *
         * 검증 대상은 현재 CDS/OData Help가 준비된 4개 코드 필드로 한정한다.
         * - 회사코드(Bukrs)
         * - 플랜트코드(Werks)
         * - 공급업체코드(Lifnr)
         * - 자재코드(Matnr)
         *
         * 공급업체명(Name1), 자재명(Maktx)은 부분검색 조건이므로 존재 검증 대상이 아니다.
         */
        _validateSearchHelpCodeExistence() {
            const aValidationConfigs = this._getSearchHelpCodeValidationConfigs();

            return Promise.all(aValidationConfigs.map(function (oConfig) {
                return this._validateSingleSearchHelpCode(oConfig);
            }.bind(this))).then(function (aResults) {
                return aResults.reduce(function (aErrors, aResult) {
                    return aErrors.concat(aResult || []);
                }, []);
            });
        },

        /**
         * Search Help 존재 검증 대상 설정을 반환한다.
         *
         * helpType은 `_getValueHelpConfig`의 설정을 재사용한다.
         * 이렇게 하면 Dialog와 존재 검증이 같은 named model / EntitySet을 바라보게 되어
         * Search Help로 선택 가능한 값과 직접 입력 검증 기준이 어긋나지 않는다.
         */
        _getSearchHelpCodeValidationConfigs() {
            return [
                {
                    helpType: "RFQ",
                    filterPath: "/RfqNo",
                    property: "RfqNo",
                    controlId: "idRfqNoInput",
                    labelKey: "rfqNo"
                },
                {
                    helpType: "MQ",
                    filterPath: "/MqNo",
                    property: "MqNo",
                    controlId: "idMqNoInput",
                    labelKey: "mqNo"
                },
                {
                    helpType: "COMPANY",
                    filterPath: "/Bukrs",
                    property: "Bukrs",
                    controlId: "idBukrsInput",
                    labelKey: "bukrs"
                },
                {
                    helpType: "PLANT",
                    filterPath: "/Werks",
                    property: "Werks",
                    controlId: "idWerksInput",
                    labelKey: "werks"
                },
                {
                    helpType: "VENDOR",
                    filterPath: "/Lifnr",
                    property: "Lifnr",
                    controlId: "idLifnrInput",
                    labelKey: "lifnr"
                },
                {
                    helpType: "MATERIAL",
                    filterPath: "/Matnr",
                    property: "Matnr",
                    controlId: "idMatnrInput",
                    labelKey: "matnr",
                    alpha: true
                },
                {
                    helpType: "PURCH_ORG",
                    filterPath: "/Ekorg",
                    property: "Ekorg",
                    controlId: "idEkorgInput",
                    labelKey: "ekorg"
                },
                {
                    helpType: "PURCH_GROUP",
                    filterPath: "/Ekgrp",
                    property: "Ekgrp",
                    controlId: "idEkgrpInput",
                    labelKey: "ekgrp"
                }
            ];
        },

        /**
         * 단일 코드 필드의 존재 여부를 Help OData에서 확인한다.
         *
         * 빈 값은 조회조건 미입력으로 보므로 오류가 아니다.
         * 자재코드는 화면 외부 형식(예: 100002)을 DB 내부 형식(예: 0000100002)으로 변환해 검증한다.
         */
        _validateSingleSearchHelpCode(oConfig) {
            const oFilterModel = this.getView().getModel("filter");
            const oHelpConfig = this._getValueHelpConfig(oConfig.helpType);
            const sRawValue = String((oFilterModel && oFilterModel.getProperty(oConfig.filterPath)) || "").trim();
            const sCheckValue = oConfig.alpha ? this._toInternalMatnr(sRawValue) : sRawValue;

            if (!sRawValue) {
                return Promise.resolve([]);
            }

            if (!oHelpConfig) {
                return Promise.resolve([
                    this._createCodeExistenceValidationError(oConfig)
                ]);
            }

            return this._readNamedEntitySet(
                oHelpConfig.model,
                oHelpConfig.path,
                [new Filter(oConfig.property, FilterOperator.EQ, sCheckValue)],
                { "$top": 1 }
            ).then(function (aRows) {
                return aRows.length > 0 ? [] : [
                    this._createCodeExistenceValidationError(oConfig)
                ];
            }.bind(this));
        },

        /**
         * named OData model의 EntitySet을 Promise로 읽는다.
         *
         * Main ODataModel이 아닌 Search Help 전용 named model을 사용해야 하므로
         * `_readEntitySet`과 분리했다.
         */
        _readNamedEntitySet(sModelName, sPath, aFilters, mUrlParameters) {
            const oModel = this.getOwnerComponent().getModel(sModelName);

            return new Promise(function (resolve, reject) {
                if (!oModel || typeof oModel.read !== "function") {
                    reject(new Error("Named ODataModel is not available: " + sModelName));
                    return;
                }

                oModel.read(sPath, {
                    filters: aFilters || [],
                    urlParameters: mUrlParameters || {},
                    success: function (oData) {
                        resolve(oData && Array.isArray(oData.results) ? oData.results : []);
                    },
                    error: reject
                });
            });
        },

        /**
         * 코드 존재 여부 검증 오류를 MessagePopover용 객체로 만든다.
         */
        _createCodeExistenceValidationError(oConfig) {
            const sLabel = this._getText(oConfig.labelKey);

            return this._createValidationError(
                oConfig.controlId,
                this._getText("validationCodeNotFound", [sLabel]) || sLabel + "에 존재하지 않는 값입니다.",
                sLabel
            );
        },

        /**
         * Search Help에서 선택한 값을 filter 모델에 반영한다.
         *
         * 공급업체와 자재는 코드와 명칭을 함께 입력한다.
         */
        _applySelectedValueHelp(oConfig, oSelectedItem) {
            const oContext = oSelectedItem && oSelectedItem.getBindingContext(oConfig.model);
            const oData = oContext && oContext.getObject();
            const oFilterModel = this.getView().getModel("filter");

            if (!oData || !oFilterModel) {
                return;
            }

            Object.keys(oConfig.targetFields || {}).forEach(function (sProperty) {
                const oTarget = oConfig.targetFields[sProperty];
                let vValue = oData[sProperty];

                if (oConfig.alpha && sProperty === "Matnr") {
                    vValue = this._toExternalMatnr(vValue);
                }

                oFilterModel.setProperty(oTarget.path, vValue || "");
                this._setInputValueState(oTarget.controlId, "None", "");
            }.bind(this));
        },

        /**
         * Search Help Dialog 셀 표시값을 보정한다.
         */
        _formatValueHelpCell(oColumnConfig, vValue) {
            if (oColumnConfig.formatter === "matnrExternal") {
                return this._toExternalMatnr(vValue);
            }

            if (oColumnConfig.formatter === "date") {
                return formatter.formatDate(vValue);
            }

            return vValue || "";
        },

        /**
         * 자재코드를 DB 조회용 ALPHA 내부 형식으로 변환한다.
         */
        _toInternalMatnr(sValue) {
            const sMatnr = String(sValue || "").trim();

            if (!sMatnr) {
                return "";
            }

            if (/^\d+$/.test(sMatnr) && sMatnr.length < 10) {
                return sMatnr.padStart(10, "0");
            }

            return sMatnr;
        },

        /**
         * 자재코드를 화면 표시용 외부 형식으로 변환한다.
         */
        _toExternalMatnr(sValue) {
            const sMatnr = String(sValue || "").trim();

            if (!sMatnr) {
                return "";
            }

            return sMatnr.replace(/^0+/, "") || "0";
        },

        /**
         * 조회조건 오류 목록을 표시할 MessagePopover를 반환한다.
         *
         * MessagePopover는 messages 모델의 /items 배열을 sap.m.MessageItem 목록으로 표시한다.
         * 현재 단계에서는 Footer 버튼과 Popover 골격만 연결하고,
         * 실제 items 생성은 다음 유효성 검증 단계에서 수행한다.
         */
        _getValidationMessagePopover() {
            if (!this._oValidationMessagePopover) {
                this._oValidationMessagePopover = new MessagePopover({
                    items: {
                        path: "messages>/items",
                        template: new MessageItem({
                            type: "{messages>type}",
                            title: "{messages>title}",
                            subtitle: "{messages>subtitle}",
                            description: "{messages>description}"
                        })
                    },
                    itemSelect: function (oEvent) {
                        this._focusValidationTarget(oEvent);
                    }.bind(this)
                });

                this.getView().addDependent(this._oValidationMessagePopover);
            }

            return this._oValidationMessagePopover;
        },

        /**
         * 채택/채택취소 처리 결과 MessagePopover를 반환한다.
         *
         * 검증 MessagePopover와 동일한 `sap.m.MessagePopover` 패턴을 사용하지만,
         * 바인딩 모델은 `processMessages`로 분리한다.
         * 이렇게 하면 조회조건 오류와 업무 처리 결과가 서로 덮어쓰지 않는다.
         */
        _getProcessMessagePopover() {
            if (!this._oProcessMessagePopover) {
                this._oProcessMessagePopover = new MessagePopover({
                    items: {
                        path: "processMessages>/items",
                        template: new MessageItem({
                            type: "{processMessages>type}",
                            title: "{processMessages>title}",
                            subtitle: "{processMessages>subtitle}",
                            description: "{processMessages>description}"
                        })
                    }
                });

                this.getView().addDependent(this._oProcessMessagePopover);
            }

            return this._oProcessMessagePopover;
        },

        /**
         * 유효성 검증 직후 MessagePopover를 자동으로 열기 위한 헬퍼다.
         *
         * messages 모델이 갱신된 직후에는 Footer 버튼이 아직 렌더링되지 않았을 수 있다.
         * 그래서 짧게 지연한 뒤 버튼을 찾아 openBy 기준 컨트롤로 사용한다.
         */
        _openValidationMessagePopoverDelayed() {
            setTimeout(function () {
                const oButton = this.byId("idValidationMessageButton");

                if (oButton && oButton.getVisible()) {
                    this._getValidationMessagePopover().openBy(oButton);
                }
            }.bind(this), 0);
        },

        /**
         * 업무 처리 결과 MessagePopover를 자동으로 연다.
         *
         * RFQ Item Table headerToolbar의 결과 버튼은 processMessages 모델 갱신 후 렌더링될 수 있으므로
         * 검증 MessagePopover와 동일하게 짧게 지연한 뒤 openBy 기준 컨트롤로 사용한다.
         */
        _openProcessMessagePopoverDelayed() {
            setTimeout(function () {
                const oButton = this.byId("idProcessMessageButton");

                if (oButton && oButton.getVisible()) {
                    this._getProcessMessagePopover().openBy(oButton);
                }
            }.bind(this), 0);
        },

        /**
         * 조회조건 전체 유효성 검증 진입점이다.
         *
         * 3단계에서는 날짜 조건만 검증한다.
         * 코드 길이/형식 검증과 Search Help 기반 존재 여부 검증은 다음 단계에서 같은 반환 구조를 재사용한다.
         */
        _validateSearchConditions() {
            const aErrors = [];

            aErrors.push.apply(aErrors, this._validateDateRange({
                fromControlId: "idDocDateFromPicker",
                toControlId: "idDocDateToPicker",
                fromPath: "/DocDateFrom",
                toPath: "/DocDateTo",
                fromLabelKey: "docDateFrom",
                toLabelKey: "docDateTo",
                rangeMessageKey: "validationDocDateRangeInvalid"
            }));
            aErrors.push.apply(aErrors, this._validateDateRange({
                fromControlId: "idEindtFromPicker",
                toControlId: "idEindtToPicker",
                fromPath: "/EindtFrom",
                toPath: "/EindtTo",
                fromLabelKey: "eindtFrom",
                toLabelKey: "eindtTo",
                rangeMessageKey: "validationEindtRangeInvalid"
            }));
            this._setValidationMessages(aErrors);

            return aErrors.length === 0;
        },

        /**
         * From/To 구조의 DatePicker 쌍을 검증한다.
         *
         * 검증 순서:
         * 1. 사용자가 직접 입력한 문자열이 yyyy-MM-dd 형식의 실제 날짜인지 확인한다.
         * 2. 정상 날짜이면 회사 기준일인 2020-03-15 이전인지 확인한다.
         * 3. From과 To가 모두 정상 날짜일 때 From > To 여부를 확인한다.
         */
        _validateDateRange(oConfig) {
            const oFilterModel = this.getView().getModel("filter");
            const oCompanyStartDate = this._getCompanyStartDate();
            const aDateFields = [
                {
                    controlId: oConfig.fromControlId,
                    path: oConfig.fromPath,
                    labelKey: oConfig.fromLabelKey,
                    peerLabelKey: oConfig.toLabelKey
                },
                {
                    controlId: oConfig.toControlId,
                    path: oConfig.toPath,
                    labelKey: oConfig.toLabelKey,
                    peerLabelKey: oConfig.fromLabelKey
                }
            ];
            const mInvalidByControlId = {};
            const aErrors = [];
            let oFromDate;
            let oToDate;

            aDateFields.forEach(function (oField) {
                const sLabel = this._getText(oField.labelKey);
                const oDate = oFilterModel && oFilterModel.getProperty(oField.path);

                if (!this._isDateInputValueValid(oField.controlId)) {
                    mInvalidByControlId[oField.controlId] = true;
                    aErrors.push(this._createValidationError(
                        oField.controlId,
                        this._getText("validationDateFormatInvalid"),
                        sLabel
                    ));
                    return;
                }

                if (this._isDateBefore(oDate, oCompanyStartDate)) {
                    aErrors.push(this._createValidationError(
                        oField.controlId,
                        this._getText("validationDateBeforeCompanyStart"),
                        sLabel
                    ));
                }
            }.bind(this));

            oFromDate = oFilterModel && oFilterModel.getProperty(oConfig.fromPath);
            oToDate = oFilterModel && oFilterModel.getProperty(oConfig.toPath);

            if (!mInvalidByControlId[oConfig.fromControlId]
                && !mInvalidByControlId[oConfig.toControlId]
                && this._isValidDateObject(oFromDate)
                && this._isValidDateObject(oToDate)
                && this._normalizeDate(oFromDate).getTime() > this._normalizeDate(oToDate).getTime()) {
                const sRangeMessage = this._getText(oConfig.rangeMessageKey);

                aErrors.push(
                    this._createValidationError(
                        oConfig.fromControlId,
                        sRangeMessage,
                        this._getText(oConfig.fromLabelKey)
                    ),
                    this._createValidationError(
                        oConfig.toControlId,
                        sRangeMessage,
                        this._getText(oConfig.toLabelKey)
                    )
                );
            }

            return aErrors;
        },

        /**
         * DatePicker에 사용자가 입력한 문자열이 정상 날짜인지 확인한다.
         *
         * DatePicker의 dateValue는 잘못된 문자열을 Date 객체로 변환하지 못할 수 있다.
         * 그래서 사용자가 실제로 입력한 getValue 문자열을 기준으로 한 번 더 검증한다.
         * 빈 값은 조회조건 미입력으로 보므로 오류가 아니다.
         */
        _isDateInputValueValid(sControlId) {
            const oDatePicker = this.byId(sControlId);
            const sValue = oDatePicker && typeof oDatePicker.getValue === "function"
                ? String(oDatePicker.getValue() || "").trim()
                : "";

            return !sValue || this._isStrictDateString(sValue);
        },

        /**
         * yyyy-MM-dd 형식과 실제 달력 날짜 여부를 함께 검증한다.
         *
         * 정규식만 사용하면 2026-05-32 같은 날짜도 형식상 통과할 수 있다.
         * 따라서 Date 객체 생성 후 연/월/일이 입력값과 동일한지 다시 비교한다.
         */
        _isStrictDateString(sValue) {
            const aMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(sValue || "").trim());
            let iYear;
            let iMonth;
            let iDay;
            let oDate;

            if (!aMatch) {
                return false;
            }

            iYear = Number(aMatch[1]);
            iMonth = Number(aMatch[2]);
            iDay = Number(aMatch[3]);
            oDate = new Date(iYear, iMonth - 1, iDay);

            return oDate.getFullYear() === iYear
                && oDate.getMonth() === iMonth - 1
                && oDate.getDate() === iDay;
        },

        /**
         * 삼만리 모빌리티 프로젝트의 업무 기준일을 반환한다.
         *
         * 이전 납기지연 조회 프로그램과 동일하게 회사 기준일 이전 날짜는 조회조건으로 허용하지 않는다.
         */
        _getCompanyStartDate() {
            return this._normalizeDate(new Date(2020, 2, 15));
        },

        /**
         * 비교 대상 날짜가 기준일보다 과거인지 확인한다.
         */
        _isDateBefore(oDate, oMinDate) {
            if (!this._isValidDateObject(oDate) || !this._isValidDateObject(oMinDate)) {
                return false;
            }

            return this._normalizeDate(oDate).getTime() < this._normalizeDate(oMinDate).getTime();
        },

        /**
         * JavaScript Date 객체가 실제 유효한 날짜인지 확인한다.
         */
        _isValidDateObject(oDate) {
            return oDate instanceof Date && !isNaN(oDate.getTime());
        },

        /**
         * MessagePopover와 ValueState 표시에서 함께 사용할 검증 오류 객체를 만든다.
         */
        _createValidationError(sControlId, sMessage, sSubtitle) {
            return {
                type: "Error",
                title: sMessage,
                subtitle: sSubtitle,
                description: this._getText("validationMessageDescription"),
                controlId: sControlId
            };
        },

        /**
         * 채택/채택취소 처리 결과 MessagePopover에 표시할 메시지 객체를 만든다.
         *
         * Backend 일괄 처리 연결 후에는 ABAP 응답의 MessageType/MessageText를
         * 이 구조로 변환하면 단건 처리와 일괄 처리 결과를 같은 화면 패턴으로 표시할 수 있다.
         */
        _createProcessMessage(sType, sTitle, sSubtitle, sDescription) {
            return {
                type: sType || "Information",
                title: sTitle || "",
                subtitle: sSubtitle || "",
                description: sDescription || ""
            };
        },

        /**
         * 검증 오류 목록을 messages 모델에 반영하고 관련 필드의 ValueState도 갱신한다.
         */
        _setValidationMessages(aErrors) {
            const oMessagesModel = this.getView().getModel("messages");
            const oViewModel = this.getView().getModel("view");
            const iCount = (aErrors || []).length;
            const bHasAdvancedFilterError = (aErrors || []).some(function (oError) {
                return this._isAdvancedFilterControl(oError.controlId);
            }.bind(this));

            (aErrors || []).forEach(function (oError) {
                this._setInputValueState(oError.controlId, "Error", oError.title);
            }.bind(this));

            if (bHasAdvancedFilterError && oViewModel) {
                oViewModel.setProperty("/AdvancedFilterVisible", true);
            }

            if (oMessagesModel) {
                oMessagesModel.setData({
                    items: aErrors || [],
                    count: iCount,
                    buttonText: iCount ? this._getText("validationErrorCount", [iCount]) : "",
                    buttonIcon: iCount ? "sap-icon://message-error" : "sap-icon://message-popup",
                    buttonType: iCount ? "Negative" : "Transparent"
                });
            }
        },

        /**
         * 채택/채택취소 처리 결과를 processMessages 모델에 반영한다.
         *
         * Error가 하나라도 있으면 Negative, Warning이 있으면 Attention,
         * 그 외에는 정보성 버튼으로 표시한다.
         */
        _setProcessMessages(aMessages) {
            const oProcessMessagesModel = this.getView().getModel("processMessages");
            const aItems = aMessages || [];
            const iCount = aItems.length;
            const bHasError = aItems.some(function (oMessage) {
                return oMessage && oMessage.type === "Error";
            });
            const bHasWarning = aItems.some(function (oMessage) {
                return oMessage && oMessage.type === "Warning";
            });

            if (!oProcessMessagesModel) {
                return;
            }

            oProcessMessagesModel.setData({
                items: aItems,
                count: iCount,
                buttonText: iCount ? this._getText("processMessageCount", [iCount]) : "",
                buttonIcon: bHasError ? "sap-icon://message-error" : (bHasWarning ? "sap-icon://message-warning" : "sap-icon://message-information"),
                buttonType: bHasError ? "Negative" : (bHasWarning ? "Attention" : "Accept")
            });
        },

        /**
         * 조회조건 컨트롤의 ValueState와 ValueStateText를 설정한다.
         */
        _setInputValueState(sControlId, sState, sText) {
            const oControl = sControlId && this.byId(sControlId);

            if (!oControl) {
                return;
            }

            if (typeof oControl.setValueState === "function") {
                oControl.setValueState(sState);
            }

            if (typeof oControl.setValueStateText === "function") {
                oControl.setValueStateText(sText || "");
            }
        },

        /**
         * 이전 조회 시 표시된 유효성 오류 상태를 초기화한다.
         *
         * 새 조회를 시작할 때는 과거 오류 표시가 남아 있으면 안 되므로,
         * 날짜 필드 ValueState와 messages 모델을 먼저 비운다.
         */
        _clearSearchValidationStates() {
            [
                "idDocDateFromPicker",
                "idDocDateToPicker",
                "idEindtFromPicker",
                "idEindtToPicker"
            ].concat(this._getSearchCodeControlIds()).forEach(function (sControlId) {
                this._setInputValueState(sControlId, "None", "");
            }.bind(this));

            const oMessagesModel = this.getView().getModel("messages");

            if (oMessagesModel) {
                oMessagesModel.setData(this._createEmptyValidationMessages());
            }
        },

        /**
         * Search Help 또는 코드 존재 여부 검증 대상이 되는 코드형 조회조건 Control ID 목록이다.
         *
         * 길이/문자 형식 검증은 하지 않는다.
         * 향후 Search Help OData 연결 후에는 이 목록을 기준으로 실제 코드 존재 여부만 검증한다.
         */
        _getSearchCodeControlIds() {
            return [
                "idRfqNoInput",
                "idLifnrInput",
                "idMatnrInput",
                "idWerksInput",
                "idMqNoInput",
                "idBukrsInput",
                "idEkorgInput",
                "idEkgrpInput"
            ];
        },

        /**
         * 조회조건 컨트롤의 화면 표시값을 실제로 비운다.
         *
         * 모델만 초기화하면 일반 Input은 대부분 갱신되지만, DatePicker에 잘못된 날짜 문자열을 직접 입력한 경우
         * 해당 문자열이 dateValue 모델에 반영되지 않고 컨트롤의 value에만 남을 수 있다.
         * 그래서 초기화 버튼에서는 filter 모델과 함께 화면 컨트롤 값도 명시적으로 비워
         * 사용자가 보는 조회조건과 내부 모델 상태가 항상 동일해지도록 한다.
         */
        _resetSearchConditionControlValues() {
            const aTextInputIds = [
                "idRfqNoInput",
                "idLifnrInput",
                "idName1Input",
                "idMatnrInput",
                "idMaktxInput",
                "idWerksInput",
                "idMqNoInput",
                "idBukrsInput",
                "idEkorgInput",
                "idEkgrpInput"
            ];
            const aDatePickerIds = [
                "idDocDateFromPicker",
                "idDocDateToPicker",
                "idEindtFromPicker",
                "idEindtToPicker"
            ];
            const oAwardStatusCombo = this.byId("idAwardStatusCombo");

            aTextInputIds.forEach(function (sControlId) {
                const oControl = this.byId(sControlId);

                if (oControl && typeof oControl.setValue === "function") {
                    oControl.setValue("");
                }
            }.bind(this));

            aDatePickerIds.forEach(function (sControlId) {
                const oDatePicker = this.byId(sControlId);

                if (!oDatePicker) {
                    return;
                }

                if (typeof oDatePicker.setDateValue === "function") {
                    oDatePicker.setDateValue(null);
                }

                if (typeof oDatePicker.setValue === "function") {
                    oDatePicker.setValue("");
                }
            }.bind(this));

            if (oAwardStatusCombo && typeof oAwardStatusCombo.setSelectedKeys === "function") {
                oAwardStatusCombo.setSelectedKeys([]);
            }
        },

        /**
         * MessagePopover의 항목을 클릭했을 때 관련 조회조건 필드로 포커스를 이동한다.
         *
         * 상세조건 영역의 필드는 기본적으로 접혀 있을 수 있으므로,
         * 먼저 상세조건을 펼친 뒤 다음 렌더링 타이밍에 focus를 준다.
         */
        _focusValidationTarget(oEvent) {
            const oItem = oEvent.getParameter("item")
                || oEvent.getParameter("messageItem")
                || oEvent.getParameter("listItem");
            const oContext = oItem && oItem.getBindingContext("messages");
            const oMessage = oContext && oContext.getObject();
            const sControlId = oMessage && (oMessage.controlId || oMessage.inputId);
            const oViewModel = this.getView().getModel("view");
            const oControl = sControlId && this.byId(sControlId);

            if (!sControlId || !oControl) {
                return;
            }

            if (this._isAdvancedFilterControl(sControlId) && oViewModel) {
                oViewModel.setProperty("/AdvancedFilterVisible", true);
            }

            if (typeof oControl.focus === "function") {
                setTimeout(function () {
                    oControl.focus();
                }, 0);
            }
        },

        /**
         * 전달받은 Control ID가 상세조건 영역의 필드인지 확인한다.
         *
         * MessagePopover 항목 선택 시 상세조건을 자동으로 펼쳐야 하는지 판단하기 위한 목록이다.
         * 조회조건 필드가 추가되면 이 배열에 ID만 추가하면 된다.
         */
        _isAdvancedFilterControl(sControlId) {
            return [
                "idLifnrInput",
                "idName1Input",
                "idMatnrInput",
                "idMaktxInput",
                "idWerksInput",
                "idEindtFromPicker",
                "idEindtToPicker",
                "idMqNoInput",
                "idBukrsInput",
                "idEkorgInput",
                "idEkgrpInput"
            ].indexOf(sControlId) > -1;
        },

        /**
         * 사용자에게 짧은 처리 메시지를 표시한다.
         *
         * 조회 실패처럼 화면 전환이 필요 없는 오류는 MessageToast로 가볍게 알린다.
         * 상세한 오류 메시지 수집과 MessagePopover 연결은 후속 유효성/오류처리 단계에서 확장한다.
         */
        _showToast(sMessage) {
            if (sMessage) {
                /*
                 * sap.m.MessageToast의 기본 폭은 짧은 성공 메시지에 맞춰져 있어
                 * 한국어 업무 메시지가 쉽게 2~3줄로 줄바꿈된다.
                 * SAP 검사 기준에서 권장되는 최대 폭인 35em을 사용해
                 * 메시지를 넓게 보여주되 Fiori 표준 범위는 넘지 않게 한다.
                 */
                MessageToast.show(sMessage, {
                    width: "35em",
                    duration: 4000
                });
            }
        },

        /**
         * sap.m.Table의 selectionChange 이벤트에서 선택된 행 객체를 꺼낸다.
         *
         * 이번 화면에서는 RFQ Header 목록과 RFQ Item 목록 모두 sap.m.Table을 사용한다.
         * 두 테이블의 선택 이벤트가 같은 형태이므로 공통 헬퍼로 분리해 둔다.
         */
        _getSelectedObjectFromEvent(oEvent) {
            let oListItem;
            let oContext;

            if (!oEvent || !oEvent.getParameter) {
                return null;
            }

            oListItem = oEvent.getParameter("listItem") || oEvent.getParameter("selectedItem");

            if (!oListItem || !oListItem.getBindingContext) {
                return null;
            }

            oContext = oListItem.getBindingContext("work") || oListItem.getBindingContext();

            if (!oContext || !oContext.getObject) {
                return null;
            }

            return oContext.getObject();
        },

        _getObjectFromEventSource(oEvent) {
            const oSource = oEvent && oEvent.getSource && oEvent.getSource();
            const oContext = oSource && oSource.getBindingContext &&
                (oSource.getBindingContext("work") || oSource.getBindingContext());

            if (!oContext || !oContext.getObject) {
                return null;
            }

            return oContext.getObject();
        },

        /**
         * 선택된 RFQ Header를 Mid Column의 Header 영역에 반영하고 FCL을 2컬럼으로 전환한다.
         *
         * Header 선택 직후 RFQItemSet까지 조회해 Mid 첫 섹션을 채운다.
         */
        _openMidColumnForRfq(oRfq) {
            const oView = this.getView();
            const oViewModel = oView.getModel("view");
            const oWorkModel = oView.getModel("work");

            if (oWorkModel) {
                oWorkModel.setProperty("/SelectedRfq", oRfq || {});
            }

            if (oViewModel) {
                oViewModel.setProperty("/FclLayout", "TwoColumnsMidExpanded");
            }

            return this._loadRfqItemsForRfq(oRfq && oRfq.RfqNo);
        },

        /**
         * RFQ Header 조회 결과가 1건뿐이면 Mid Column을 자동으로 연다.
         *
         * 사용자가 RFQ 번호를 정확히 넣어 1건만 조회한 경우에는 Begin 목록에서 다시 클릭하지 않아도
         * 바로 RFQ Item/MQ 비교 영역으로 이동하는 것이 자연스럽다.
         */
        _openMidColumnIfSingleHeader() {
            const oWorkModel = this.getView().getModel("work");
            const aRfqHeaders = oWorkModel ? (oWorkModel.getProperty("/RfqHeaders") || []) : [];

            this._updateRfqHeaderCountFromRows();

            if (aRfqHeaders.length === 1) {
                this._openMidColumnForRfq(aRfqHeaders[0]);
            }
        },

        /**
         * RFQ Header 목록 제목의 (N)을 갱신한다.
         *
         * sap.m.Table의 items 바인딩 자체에서도 count를 읽을 수 있지만,
         * OData 조회 후 Controller에서 명시적으로 건수를 세팅하면 KPI 계산과 같은 후속 로직에서도
         * 같은 값을 재사용할 수 있다.
         */
        _updateRfqHeaderCountFromRows() {
            const oWorkModel = this.getView().getModel("work");
            const aRfqHeaders = oWorkModel ? (oWorkModel.getProperty("/RfqHeaders") || []) : [];

            if (oWorkModel) {
                oWorkModel.setProperty("/RfqHeaderCount", aRfqHeaders.length);
            }
        }
    });
});
