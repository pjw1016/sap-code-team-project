sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "code/d3/quotecomparison/model/formatter"
], (Controller, JSONModel, Filter, FilterOperator, MessageToast, formatter) => {
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
         * 실제 OData 응답은 `work` 모델에 넣고, 화면 제어 상태는 `view` 모델에 둔다.
         * 이렇게 나누면 조회 데이터가 바뀌어도 레이아웃 상태와 업무 데이터가 서로 섞이지 않는다.
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
         * FCL은 최초 진입 시 Begin Column만 보여준다.
         * RFQ Header 행을 선택하거나 RFQ Header 조회 결과가 정확히 1건일 때 Mid Column을 연다.
         */
        _createInitialViewData() {
            return {
                Busy: false,
                AdvancedFilterVisible: false,
                FclLayout: "OneColumn"
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

        /**
         * 조회 버튼 이벤트.
         *
         * 이번 단계에서는 Begin Column에 필요한 RFQHeaderSet만 조회한다.
         * Header 행을 클릭했을 때 RFQItemSet을 읽는 로직은 다음 단계에서 붙인다.
         */
        onSearch() {
            return this._loadRfqHeaders();
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

            oView.setModel(new JSONModel(this._createInitialFilterData()), "filter");

            if (oViewModel) {
                oViewModel.setProperty("/AdvancedFilterVisible", false);
            }
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
         * RFQHeaderSet을 조회하여 Begin Column의 RFQ Header 목록, KPI, 건수를 갱신한다.
         *
         * SAPUI5 OData V2 Model의 `read`는 success/error 콜백 방식이다.
         * 이 화면에서는 조회 이후 여러 후속 처리가 이어지므로 `_readEntitySet`에서 Promise로 감싼 뒤
         * then/catch/finally 흐름으로 작성한다.
         */
        _loadRfqHeaders() {
            const oView = this.getView();
            const oViewModel = oView.getModel("view");
            const oWorkModel = oView.getModel("work");
            const aFilters = this._buildHeaderFilters();

            if (oViewModel) {
                oViewModel.setProperty("/Busy", true);
            }

            this._clearSelectionAndComparisonArea();

            return this._readEntitySet("/RFQHeaderSet", aFilters).then((aRows) => {
                oWorkModel.setProperty("/RfqHeaders", aRows);
                this._updateRfqHeaderCountFromRows();
                this._updateHeaderKpis(aRows);

                if (aRows.length === 1) {
                    /*
                     * RFQ 번호로 1건만 조회된 경우에는 사용자가 목록을 다시 누르지 않아도 Mid Column을 연다.
                     * Header 조회 자체는 성공으로 유지해야 하므로, Item 조회 실패는 RFQHeaderSet catch로 전파하지 않는다.
                     */
                    this._openMidColumnForRfq(aRows[0]).catch(() => {});
                }

                return aRows;
            }).catch((oError) => {
                oWorkModel.setProperty("/RfqHeaders", []);
                this._updateRfqHeaderCountFromRows();
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
            this._addTextFilter(aFilters, "Name1", oFilter.Name1, FilterOperator.Contains);
            this._addTextFilter(aFilters, "Matnr", oFilter.Matnr, FilterOperator.EQ);
            this._addTextFilter(aFilters, "Maktx", oFilter.Maktx, FilterOperator.Contains);
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
         * 공급업체명/자재명은 설계서 기준으로 부분 검색 성격이 있어 Contains를 사용하고,
         * 코드성 필드는 정확히 일치해야 하므로 EQ를 사용한다.
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
         * RFQ Item 하위 단계의 선택/비교 데이터를 비운다.
         *
         * Header를 바꿔 선택하면 이전 Header의 Item, MQ 후보, 차트가 남아 있으면 안 된다.
         * Header 자체와 Begin 목록은 유지하고, Mid Column 안쪽의 하위 업무 데이터만 초기화한다.
         */
        _clearRfqItemDependentArea() {
            const oWorkModel = this.getView().getModel("work");

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
         * 사용자에게 짧은 처리 메시지를 표시한다.
         *
         * 조회 실패처럼 화면 전환이 필요 없는 오류는 MessageToast로 가볍게 알린다.
         * 상세한 오류 메시지 수집과 MessagePopover 연결은 후속 유효성/오류처리 단계에서 확장한다.
         */
        _showToast(sMessage) {
            if (sMessage) {
                MessageToast.show(sMessage);
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
