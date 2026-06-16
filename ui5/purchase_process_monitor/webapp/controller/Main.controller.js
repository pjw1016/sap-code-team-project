/*global Promise*/

sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "code/d3/purchaseprocessmonitor/model/formatter",
    "code/d3/purchaseprocessmonitor/model/models"
], (Controller, MessageToast, MessageBox, Filter, FilterOperator, formatter, models) => {
    "use strict";

    return Controller.extend("code.d3.purchaseprocessmonitor.controller.Main", {
        formatter: formatter,

        onInit() {
            /*
             * Main.view.xml은 하나의 ODataModel만 직접 보는 화면이 아니라,
             * 조회조건, FCL 상태, 선택 문서 상세 데이터를 함께 관리해야 한다.
             * 그래서 화면 상태를 역할별 JSONModel로 나눈다.
             *
             * filter : 기준일/조회기간/PR번호/PO번호/상세조건 등 OData Filter 생성 기준
             * view   : Busy, FCL layout, 상세조건 펼침 여부, 선택 문서 상태
             * dashboard : DashboardSummarySet 결과를 표시할 KPI 카드 데이터
             * weekly : WeeklySummarySet 결과를 표시할 주간 요약 데이터
             * detail : Mid Column과 Dialog에 표시할 Flow/Item/Document 데이터
             */
            this.getView().setModel(models.createFilterModel(), "filter");
            this.getView().setModel(models.createViewModel(), "view");
            this.getView().setModel(models.createDashboardModel(), "dashboard");
            this.getView().setModel(models.createWeeklyModel(), "weekly");
            this.getView().setModel(models.createDetailModel(), "detail");

            this._loadInitialData();
        },

        /**
         * 조회 버튼 이벤트.
         *
         * 현재 단계에서는 Begin Column의 요약 영역부터 Backend와 연결한다.
         * DashboardSummarySet과 WeeklySummarySet은 서로 독립적인 집계이므로 병렬로 조회한다.
         * 이후 단계에서 DelayListSet, RfqQuotationStatusSet 조회도 같은 흐름에 추가한다.
         */
        onSearch() {
            return this._loadBeginSummary();
        },

        /**
         * 화면 최초 진입 시 기본 조회조건으로 요약 데이터를 자동 조회한다.
         *
         * ODataModel의 metadataLoaded가 있으면 metadata 로딩 완료 후 조회한다.
         * 이렇게 해야 Gateway metadata가 준비되기 전에 read가 실행되는 타이밍 문제를 줄일 수 있다.
         * 테스트나 예외 환경처럼 ODataModel이 아직 없으면 조용히 건너뛰고 사용자가 조회 버튼으로 다시 시도할 수 있다.
         *
         * @returns {Promise|null} 자동 조회 Promise. ODataModel이 없으면 null
         */
        _loadInitialData() {
            var oODataModel = this.getOwnerComponent && this.getOwnerComponent().getModel();

            if (!oODataModel) {
                return null;
            }

            if (typeof oODataModel.metadataLoaded === "function") {
                return oODataModel.metadataLoaded().then(function () {
                    return this._loadBeginSummary();
                }.bind(this));
            }

            return this._loadBeginSummary();
        },

        /**
         * 조회조건 초기화 버튼 이벤트.
         *
         * filter 모델을 새 기본값 모델로 교체하면 DatePicker, SegmentedButton,
         * Input 바인딩 값이 모두 초기 상태로 돌아간다.
         * DelayStatus는 KPI 카드 클릭으로만 적용하는 내부 필터이므로 함께 초기화한다.
         */
        onResetFilters() {
            var oView = this.getView();
            var oViewModel = oView.getModel("view");

            oView.setModel(models.createFilterModel(), "filter");

            if (oViewModel) {
                oViewModel.setProperty("/selectedDelayStatus", "");
            }
        },

        /**
         * KPI 필터 해제 버튼 이벤트.
         *
         * 이후 KPI 카드를 클릭하면 view>/selectedDelayStatus에 DelayStatus가 저장되고,
         * DelayListSet 조회 시 그 값만 필터로 전달한다.
         * 현재 단계에서는 OData 재조회 전이므로 선택 상태만 초기화하고 사용자에게 동작을 알려준다.
         */
        onClearKpiFilter() {
            var oViewModel = this.getView().getModel("view");

            if (oViewModel) {
                oViewModel.setProperty("/selectedDelayStatus", "");
            }

            MessageToast.show("KPI 필터를 해제했습니다.");
        },

        /**
         * 상세 조회조건 접기/펼치기 버튼 이벤트.
         *
         * 기본 조회조건은 기준일, 조회기간, PR번호, PO번호이고,
         * 상세 조회조건은 자재코드, 자재명, 공급업체, 공급업체명, 플랜트이다.
         * 사용자가 자주 쓰는 기본 조건을 먼저 보게 하고,
         * 추가 조건은 필요할 때만 펼치도록 한다.
         */
        onToggleAdvancedFilters() {
            var oViewModel = this.getView().getModel("view");
            var bVisible = Boolean(oViewModel.getProperty("/showAdvancedFilters"));

            oViewModel.setProperty("/showAdvancedFilters", !bVisible);
        },

        /**
         * Begin Column 상단 요약 데이터를 조회한다.
         *
         * 현재 Backend metadata 기준:
         * - DashboardSummarySet: KeyDate만 Entity Property로 존재한다.
         * - WeeklySummarySet: KeyDate만 Entity Property로 존재한다.
         *
         * 따라서 PR번호/PO번호/자재/공급업체/플랜트 조건은 지금 단계에서 Summary EntitySet에
         * $filter로 보내지 않는다. 존재하지 않는 Property를 $filter에 넣으면 Gateway에서
         * "invalid property" 오류가 발생할 수 있기 때문이다.
         *
         * @returns {Promise} 두 요약 조회가 모두 끝난 뒤 resolve되는 Promise
         */
        _loadBeginSummary() {
            var oView = this.getView();
            var oViewModel = oView.getModel("view");

            if (oViewModel) {
                oViewModel.setProperty("/busy", true);
            }

            return Promise.all([
                this._readDashboardSummary(),
                this._readWeeklySummary()
            ]).then(function () {
                MessageToast.show("요약 데이터를 조회했습니다.");
            }).catch(function (oError) {
                this._resetSummaryModels();
                MessageBox.error(this._getODataErrorMessage(oError));
            }.bind(this)).finally(function () {
                if (oViewModel) {
                    oViewModel.setProperty("/busy", false);
                }
            });
        },

        /**
         * DashboardSummarySet을 조회해 dashboard JSONModel에 반영한다.
         *
         * @returns {Promise<object>} DashboardSummarySet 첫 번째 행
         */
        _readDashboardSummary() {
            return this._readEntitySet("/DashboardSummarySet", this._buildSummaryFilters()).then(function (aRows) {
                var oDashboardModel = this.getView().getModel("dashboard");
                var oRow = aRows[0] || models.createDashboardModel().getData();

                oDashboardModel.setData(Object.assign(models.createDashboardModel().getData(), oRow));
                return oRow;
            }.bind(this));
        },

        /**
         * WeeklySummarySet을 조회해 weekly JSONModel에 반영한다.
         *
         * @returns {Promise<object>} WeeklySummarySet 첫 번째 행
         */
        _readWeeklySummary() {
            return this._readEntitySet("/WeeklySummarySet", this._buildSummaryFilters()).then(function (aRows) {
                var oWeeklyModel = this.getView().getModel("weekly");
                var oRow = aRows[0] || models.createWeeklyModel().getData();

                oWeeklyModel.setData(Object.assign(models.createWeeklyModel().getData(), oRow));
                return oRow;
            }.bind(this));
        },

        /**
         * Summary EntitySet에 안전하게 보낼 수 있는 OData Filter를 만든다.
         *
         * 다른 조회조건도 화면에는 존재하지만, Summary EntityType에 없는 Property는 제외한다.
         * Backend SEGW metadata가 확장되면 여기에서 허용 Property만 추가하면 된다.
         *
         * @returns {sap.ui.model.Filter[]} ODataModel.read에 전달할 Filter 배열
         */
        _buildSummaryFilters() {
            var oFilterData = this.getView().getModel("filter").getData();
            var aFilters = [];

            if (oFilterData.KeyDate) {
                aFilters.push(new Filter("KeyDate", FilterOperator.EQ, this._normalizeDate(oFilterData.KeyDate)));
            }

            return aFilters;
        },

        /**
         * OData V2 Model의 read 콜백 API를 Promise로 감싼다.
         *
         * @param {string} sPath EntitySet 경로. 예: "/DashboardSummarySet"
         * @param {sap.ui.model.Filter[]} aFilters 조회 필터 배열
         * @returns {Promise<object[]>} EntitySet 결과 배열
         */
        _readEntitySet(sPath, aFilters) {
            var oModel = this.getOwnerComponent().getModel();

            if (!oModel || typeof oModel.read !== "function") {
                return Promise.reject(new Error("Default ODataModel is not available."));
            }

            return new Promise(function (resolve, reject) {
                oModel.read(sPath, {
                    filters: aFilters || [],
                    success: function (oData) {
                        resolve(oData && oData.results ? oData.results : []);
                    },
                    error: reject
                });
            });
        },

        /**
         * UI5 DatePicker와 OData Filter에서 사용할 날짜를 로컬 날짜 00:00:00으로 정규화한다.
         *
         * @param {Date|string|null|undefined} vDate 조회조건 날짜 값
         * @returns {Date|null} 정규화된 Date 객체. 유효하지 않으면 null
         */
        _normalizeDate(vDate) {
            var oDate = vDate instanceof Date ? vDate : new Date(vDate);

            if (!oDate || isNaN(oDate.getTime())) {
                return null;
            }

            return new Date(oDate.getFullYear(), oDate.getMonth(), oDate.getDate());
        },

        /**
         * 요약 조회 실패 시 화면 값을 기본 상태로 되돌린다.
         */
        _resetSummaryModels() {
            var oView = this.getView();

            oView.setModel(models.createDashboardModel(), "dashboard");
            oView.setModel(models.createWeeklyModel(), "weekly");
        },

        /**
         * OData 오류 객체에서 사용자가 이해할 수 있는 메시지를 추출한다.
         *
         * @param {object|Error|string} vError ODataModel.read error 콜백 값
         * @returns {string} 화면에 표시할 오류 메시지
         */
        _getODataErrorMessage(vError) {
            if (vError && vError.message) {
                return vError.message;
            }

            if (vError && vError.responseText) {
                return vError.responseText;
            }

            return "요약 데이터 조회 중 오류가 발생했습니다.";
        }
    });
});
