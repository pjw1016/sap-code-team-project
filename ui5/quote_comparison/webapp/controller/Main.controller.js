sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "code/d3/quotecomparison/model/formatter"
], (Controller, JSONModel, formatter) => {
    "use strict";

    return Controller.extend("code.d3.quotecomparison.controller.Main", {
        formatter: formatter,

        onInit() {
            this._initViewModels();
        },

        /**
         * 화면에서 사용하는 JSONModel을 초기화한다.
         *
         * view  : Busy, 상세조건 표시 여부, FlexibleColumnLayout 상태처럼 화면 제어용 값
         * filter: DynamicPage Header의 조회조건 값
         * work  : RFQ/MQ 조회 결과, 선택된 RFQ/MQ, KPI처럼 업무 화면에 표시되는 값
         *
         * 실제 OData 연동은 다음 단계에서 붙이지만, 레이아웃과 바인딩은 지금부터
         * 같은 모델 경로를 사용하게 해 두어 이후 Controller 로직을 크게 바꾸지 않게 한다.
         */
        _initViewModels() {
            const oView = this.getView();

            oView.setModel(new JSONModel(this._createInitialViewData()), "view");
            oView.setModel(new JSONModel(this._createInitialFilterData()), "filter");
            oView.setModel(new JSONModel(this._createInitialWorkData()), "work");
        },

        /**
         * 화면 제어 모델의 초기값을 반환한다.
         *
         * FCL은 처음부터 Mid Column을 보여주면 빈 상세화면이 먼저 노출된다.
         * 따라서 최초 진입 시에는 OneColumn으로 Begin Column만 보여주고,
         * RFQ Header를 선택하거나 조회 결과가 1건뿐인 경우에만 Mid Column을 연다.
         */
        _createInitialViewData() {
            return {
                Busy: false,
                AdvancedFilterVisible: false,
                FclLayout: "OneColumn",
                SelectedTabKey: "items"
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
         * 현재 단계에서는 실제 데이터 조회 전이므로 배열은 비워둔다.
         * 경로를 먼저 확정해 두면 XMLView가 안정적으로 렌더링되고,
         * OData 연동 단계에서는 같은 경로에 조회 결과만 넣으면 된다.
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

        /**
         * 조회 버튼 이벤트.
         *
         * 다음 OData 연동 단계에서 RFQHeaderSet 조회 성공 후 아래 두 메서드를 호출한다.
         * - _updateRfqHeaderCountFromRows(): RFQ 헤더 목록 타이틀의 (N) 갱신
         * - _openMidColumnIfSingleHeader(): 조회 결과가 1건이면 Mid Column 자동 오픈
         *
         * 현재는 데이터 조회가 없으므로 빈 배열 기준으로만 안정적으로 동작하게 둔다.
         */
        onSearch() {
            this._updateRfqHeaderCountFromRows();
            this._openMidColumnIfSingleHeader();
        },

        /**
         * 조회조건 초기화 버튼 이벤트.
         *
         * 필터 값은 최초 상태로 되돌리고, 상세조건 영역도 닫는다.
         * 업무 조회 결과는 사용자가 별도로 재조회하기 전까지 유지할 수 있으므로 여기서는 건드리지 않는다.
         */
        onReset() {
            const oView = this.getView();
            const oViewModel = oView.getModel("view");

            oView.setModel(new JSONModel(this._createInitialFilterData()), "filter");

            if (oViewModel) {
                oViewModel.setProperty("/AdvancedFilterVisible", false);
            }
        },

        /**
         * 상세조건 열기/닫기 버튼 이벤트.
         *
         * 버튼 문구는 XML의 expression binding이 view>/AdvancedFilterVisible 값을 보고
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
         * 사용자가 Begin Column의 RFQ Header 행을 선택하면 Mid Column을 열고,
         * 선택한 Header를 Mid 영역의 ObjectHeader에 바인딩한다.
         * 실제 RFQItemSet 조회는 다음 OData 연동 단계에서 이 메서드 뒤에 붙인다.
         */
        onRfqSelectionChange(oEvent) {
            const oSelectedRfq = this._getSelectedObjectFromEvent(oEvent);

            if (!oSelectedRfq) {
                return;
            }

            this._openMidColumnForRfq(oSelectedRfq);
        },

        /**
         * RFQ Item 선택 이벤트.
         *
         * 실제 MQCompareSet 조회는 다음 단계에서 연결한다.
         * 지금은 선택된 RFQ Item을 work 모델에 보관하여 하단 버튼/상세 영역 바인딩이 깨지지 않게 한다.
         */
        onRfqItemSelectionChange(oEvent) {
            const oSelectedItem = this._getSelectedObjectFromEvent(oEvent);
            const oWorkModel = this.getView().getModel("work");

            if (oSelectedItem && oWorkModel) {
                oWorkModel.setProperty("/SelectedRfqItem", oSelectedItem);
            }
        },

        /**
         * MQ 비교표 RadioButton 선택 이벤트.
         *
         * sap.ui.table.Table의 행 컨텍스트 처리와 단일 선택 제어는 MQ 비교 기능 구현 단계에서 작성한다.
         */
        onMqRadioSelect() {
        },

        /**
         * 자동추천 적용 버튼 이벤트.
         *
         * Backend RecommendYn 값을 기준으로 선택 가능한 MQ를 자동 선택하는 로직은 다음 단계에서 작성한다.
         */
        onApplyAutoRecommend() {
        },

        /**
         * MQ 상세 Dialog 열기 이벤트.
         *
         * Fragment 로딩과 MQDetailSet 단건 조회는 상세 팝업 연결 단계에서 작성한다.
         */
        onOpenMqDetail() {
        },

        /**
         * 채택 버튼 이벤트.
         *
         * QuotationItemSet MERGE 호출은 OData Update 단계에서 작성한다.
         */
        onSaveAward() {
        },

        /**
         * 채택취소 버튼 이벤트.
         *
         * QuotationItemSet MERGE 호출은 OData Update 단계에서 작성한다.
         */
        onCancelAward() {
        },

        /**
         * 상세 Dialog 안의 "이 Item 선택" 버튼 이벤트.
         *
         * Dialog에서 MQ를 선택한 뒤 비교표의 선택 상태와 맞추는 로직은 상세 팝업 연결 단계에서 작성한다.
         */
        onSelectMqFromDialog() {
        },

        /**
         * 상세 Dialog 닫기 버튼 이벤트.
         *
         * 실제 Dialog close 처리는 Fragment 연결 단계에서 작성한다.
         */
        onCloseMqDetailDialog() {
        },

        /**
         * 비어 있는 이벤트 핸들러.
         *
         * XMLView가 먼저 안정적으로 렌더링되도록 임시로 남겨두는 안전장치다.
         */
        onPlaceholderAction() {
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

        /**
         * 선택된 RFQ Header를 Mid Column의 Header 영역에 반영하고 FCL을 2컬럼으로 전환한다.
         *
         * 실제 데이터 연동 단계에서는 이 메서드 뒤에 RFQItemSet 조회를 호출하면 된다.
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
