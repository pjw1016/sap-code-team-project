sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "sap/ui/core/Fragment",
    "sap/viz/ui5/controls/Popover",
    "sap/m/Text",
    "sap/m/MessageToast",
    "code/d3/delayedpomonitor/model/chartHelper",
    "code/d3/delayedpomonitor/model/formatter"
], function (Controller, JSONModel, Filter, FilterOperator, Sorter, Fragment, ChartPopover, Text, MessageToast, chartHelper, formatter) {
    "use strict";

    /*
     * Main.controller.js는 이 앱의 실제 업무 흐름을 담당한다.
     * 주요 역할:
     * 1. 검색조건 초기값 생성
     * 2. OData EntitySet 조회
     * 3. KPI/차트/테이블 JSONModel 갱신
     * 4. 행 클릭 시 상세 팝업과 101/102 입고 이력 조회
     */
    return Controller.extend("code.d3.delayedpomonitor.controller.Main", {
        formatter: formatter,

        onInit() {
            var oODataModel = this.getOwnerComponent().getModel();

            // 상세 팝업은 처음부터 만들지 않고, 사용자가 행을 누를 때 1번만 로드해서 재사용한다.
            this._pDetailDialog = null;
            this._initModels();
            this._initStatusChartPopover();

            // OData metadata가 준비된 뒤 조회해야 EntitySet/Property 정보가 안정적으로 잡힌다.
            if (oODataModel && oODataModel.metadataLoaded) {
                oODataModel.metadataLoaded().then(function () {
                    this.onSearch();
                }.bind(this)).catch(function () {
                    this._showToast(this._text("metadataLoadError"));
                }.bind(this));
            } else {
                this.onSearch();
            }
        },

        onExit: function () {
            // Controller가 종료될 때 동적으로 만든 VizFrame Popover도 같이 정리한다.
            if (this._oStatusChartPopover) {
                this._oStatusChartPopover.destroy();
                this._oStatusChartPopover = null;
            }
        },

        // onSearch: function () {
        //     var aTableFilters = this._buildFilters(true);
        //     var aChartFilters = this._buildFilters(false);

        //     this._loadMainTable(aTableFilters);
        //     this._loadKpiData(aTableFilters);
        //     this._loadStatusChart(aChartFilters);
        // },

        onSearch: function () {
            /*
             * 같은 검색조건이라도 화면 영역마다 상태 필터 적용 여부가 다르다.
             * - 메인 테이블: 사용자가 선택한 상태만 조회
             * - KPI/차트: 현재 검색조건의 전체 상태 분포와 요약을 보여주기 위해 상태 필터 제외
             */
            // 메인 테이블은 사용자가 선택한 상태 필터까지 적용한다.
            // 예: 상태를 '미입고 지연(D)'만 선택하면 테이블도 D만 표시한다.
            var aTableFilters = this._buildFilters(true);

            // KPI와 상태 차트는 상태 필터를 제외한 검색조건 기준으로 계산한다.
            // 이유: 상태 필터까지 적용하면 KPI 카드가 선택한 상태 기준으로만 줄어들어
            //      '전체 미입고/지연 현황 요약'이라는 의미가 약해진다.
            var aSummaryFilters = this._buildFilters(false);

            this._updateTableStateSummary();

            /*
             * 각 조회 메소드는 Promise를 반환한다.
             * 일반 조회 버튼에서는 반환값을 사용하지 않아도 되지만,
             * KPI 클릭 기능에서는 "조회가 끝난 뒤 정렬/그룹을 적용"해야 하므로
             * Promise.all 결과를 반환해 후속 처리가 가능하게 둔다.
             */
            return Promise.all([
                this._loadMainTable(aTableFilters),
                this._loadKpiData(aSummaryFilters),
                this._loadStatusChart(aSummaryFilters)
            ]);
        },

        onReset: function () {
            // 검색조건, KPI, 차트, 입고 이력과 화면 선택 상태를 초기 상태로 되돌린 뒤 즉시 다시 조회한다.
            this.getView().getModel("view").setData(this._createInitialViewState());
            this.getView().getModel("kpi").setData(this._createEmptyKpi());
            this.getView().getModel("chart").setData(this._createEmptyChart());
            this.getView().getModel("grHistory").setData({
                items: [],
                busy: false
            });

            this._clearStatusChartSelection();
            this._resetTableSettings();

            this.onSearch().then(function () {
                /*
                 * 차트는 재조회 후 다시 렌더링되므로, 조회 완료 뒤 한 번 더 선택 상태를 지운다.
                 * 이렇게 해야 사용자가 차트 조각을 선택한 상태에서 초기화해도 파란 선택 테두리/회색 강조가 남지 않는다.
                 */
                this._clearStatusChartSelection();
                this._resetTableSettings();
            }.bind(this));
        },

        onToggleAdvanced: function () {
            // 상세조건 영역은 같은 화면 안에서 접었다 펼치는 방식으로 처리한다.
            var oViewModel = this.getView().getModel("view");
            oViewModel.setProperty("/advancedVisible", !oViewModel.getProperty("/advancedVisible"));
        },

        onBaseDateChange: function (oEvent) {
            // DatePicker가 파싱하지 못한 날짜는 조회 전에 사용자에게 알려준다.
            if (!oEvent.getParameter("valid")) {
                this._showToast(this._text("invalidDate"));
            }
        },

        onItemPress: function (oEvent) {
            // 테이블 행의 view 모델 데이터를 상세 팝업의 detail 모델로 복사한다.
            var oContext = oEvent.getSource().getBindingContext("view");
            var oItem = oContext && oContext.getObject();

            if (!oItem) {
                return;
            }

            this.getView().getModel("detail").setData(oItem);

            // 선택한 PO Item 기준으로 GR History를 먼저 읽고, 조회가 끝난 뒤 팝업을 연다.
            this._loadGrHistory(oItem).then(function () {
                this._openDetailDialog();
            }.bind(this));
        },

        onCloseDetailDialog: function () {
            if (this._pDetailDialog) {
                this._pDetailDialog.then(function (oDialog) {
                    oDialog.close();
                });
            }
        },

        onOpenTableSettings: function () {
            var oView = this.getView();

            // 정렬/그룹 Dialog도 Fragment로 분리해 두고, 최초 1회만 로드해서 재사용한다.
            if (!this._pTableSettingsDialog) {
                this._pTableSettingsDialog = Fragment.load({
                    id: oView.getId(),
                    name: "code.d3.delayedpomonitor.fragment.TableSettings",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._pTableSettingsDialog.then(function (oDialog) {
                oDialog.open();
            });
        },

        onTableSettingsConfirm: function (oEvent) {
            /*
             * ViewSettingsDialog에서 선택한 정렬/그룹 조건을 sap.m.Table 바인딩에 적용한다.
             * UI5 Table의 sort/group은 바인딩 Sorter 배열을 바꿔주는 방식으로 처리한다.
             */
            var oSortItem = oEvent.getParameter("sortItem");
            var oGroupItem = oEvent.getParameter("groupItem");
            var sSortKey = oSortItem && oSortItem.getKey();
            var sGroupKey = oGroupItem && oGroupItem.getKey();
            var bSortDescending = oEvent.getParameter("sortDescending");
            var bGroupDescending = oEvent.getParameter("groupDescending");

            this._applyTableSorters(sSortKey, bSortDescending, sGroupKey, bGroupDescending);
        },

        onResetTableSettingsPress: function () {
            /*
             * 메인 테이블 툴바의 "정렬/그룹 초기화" 버튼 처리다.
             *
             * 검색조건 초기화와 다른 점:
             * - 검색조건, KPI, 차트, 조회 데이터는 그대로 둔다.
             * - 현재 sap.m.Table 바인딩에 적용된 정렬/그룹 Sorter만 제거한다.
             *
             * 사용자가 공급업체 그룹/지연일수 정렬 등을 잠깐 적용해 본 뒤
             * 원래 조회 순서로 돌아가고 싶을 때 사용하는 기능이다.
             */
            this._resetTableSettings();
            this._showToast(this._text("tableSettingsResetDone"));
        },

        onKpiPress: function (oEvent) {
            /*
             * KPI 카드를 단순 숫자 표시가 아니라 "빠른 필터 버튼"처럼 사용한다.
             * 예:
             * - 미입고 지연 건수 클릭 → 상태 필터를 D로 바꾸고 테이블 재조회
             * - 지연 공급업체 수 클릭 → D/L 상태로 조회한 뒤 공급업체별 그룹 적용
             */
            var oTile = oEvent.getSource();
            var sAction = oTile && oTile.data("kpiAction");
            var oConfig = this._getKpiQuickActionConfig(sAction);
            var oViewModel = this.getView().getModel("view");

            if (!oConfig) {
                this._showToast(this._text("kpiQuickFilterUnknown"));
                return;
            }

            /*
             * 상태 MultiComboBox는 view>/filters/statusCodes에 바인딩되어 있다.
             * 여기 값을 바꾸면 화면의 선택값도 같이 바뀌고, _buildFilters(true)가
             * 다음 조회에서 해당 상태조건을 OData $filter로 만든다.
             */
            oViewModel.setProperty("/filters/statusCodes", oConfig.statusCodes.slice());

            this.onSearch().then(function () {
                /*
                 * JSONModel Table은 데이터가 view>/items에 들어온 뒤 binding.sort를 적용해야
                 * 사용자가 실제로 보는 행 순서와 그룹 헤더가 갱신된다.
                 */
                this._applyTableSorters(
                    oConfig.sortKey,
                    oConfig.sortDescending,
                    oConfig.groupKey,
                    oConfig.groupDescending
                );

                /*
                 * KPI 카드는 화면 상단의 요약 정보라서, 필터 적용 후 결과 테이블이 바로 보이지 않을 수 있다.
                 * 조회와 정렬/그룹 적용이 끝난 뒤 테이블 위치로 이동시켜 사용자가 결과를 즉시 확인하게 한다.
                 */
                this._scrollToResultTable();
                this._showToast(this._text(oConfig.messageKey));
            }.bind(this));
        },

        onStatusChartSelect: function (oEvent) {
            /*
             * VizFrame 도넛 차트는 기본적으로 여러 조각을 선택할 수 있다.
             * 기존 구현은 선택 배열의 첫 번째 값만 읽어서 단건 필터처럼 동작했다.
             * 이제는 현재 선택된 모든 상태를 읽어 MultiComboBox의 상태 배열과 동일한 방식으로 반영한다.
             */
            if (this._bSuppressChartSelectionEvent) {
                return;
            }

            var aStatusCodes = this._getStatusCodesFromChartSelection(oEvent);
            var bDeselectEvent = oEvent.getId && oEvent.getId() === "deselectData";
            var bSelectionCleared = bDeselectEvent && aStatusCodes.length === 0;

            if (!bSelectionCleared && aStatusCodes.length === 0) {
                return;
            }

            if (bSelectionCleared) {
                /*
                 * 차트 선택을 모두 해제한 경우에는 상태 필터를 완전히 비우지 않는다.
                 * 이 앱의 기본 조회 목적은 문제건 중심 모니터링이므로 기본 상태 O/D/P/L로 되돌린다.
                 */
                aStatusCodes = this._getDefaultProblemStatusCodes();
            }

            this.getView().getModel("view").setProperty("/filters/statusCodes", aStatusCodes);
            this.onSearch().then(function () {
                /*
                 * 차트도 요약 영역에 있으므로, 상태 선택 후에는 필터링된 테이블 위치로 내려간다.
                 * 이렇게 해야 사용자가 스크롤을 직접 내리지 않아도 "무엇이 필터링됐는지" 바로 확인할 수 있다.
                 */
                this._scrollToResultTable();

                if (bSelectionCleared) {
                    this._showToast(this._text("chartFilterCleared"));
                } else {
                    this._showToast(this._text("chartFilterApplied"));
                }
            }.bind(this));
        },

        onClearChartFilter: function () {
            /*
             * 요약 패널의 명시적 필터 해제 버튼이다.
             * 전체 초기화와 달리 기준일/납기일/플랜트 같은 검색조건은 유지하고,
             * 차트 선택 상태, 상태 필터, 테이블 정렬/그룹을 기본 상태로 되돌린다.
             *
             * 정렬/그룹까지 같이 해제하는 이유:
             * - KPI 빠른 필터는 상태 필터뿐 아니라 정렬/그룹도 자동으로 바꾼다.
             *   예: "지연 공급업체 수" KPI는 D/L 상태 + 지연일수 정렬 + 공급업체 그룹을 적용한다.
             * - 사용자가 필터 해제를 눌렀는데 정렬/그룹이 그대로 남아 있으면
             *   화면상으로는 아직 KPI 조건 일부가 남아 있는 것처럼 보인다.
             * - 따라서 필터 해제 버튼은 상태와 테이블 표시 조건을 함께 기본값으로 되돌린다.
             *
             * 이 버튼은 "해제"가 목적이므로 KPI/차트 클릭과 다르게 테이블로 자동 스크롤하지 않는다.
             * 사용자가 요약 영역에 머문 상태에서 필터가 풀렸는지 확인할 수 있게 두는 것이 자연스럽다.
             */
            /*
             * _clearStatusChartSelection은 내부적으로 VizFrame의 vizSelection([])을 호출한다.
             * 이때 UI5/VizFrame은 deselectData 이벤트를 다시 발생시킬 수 있고,
             * 그 이벤트가 onStatusChartSelect로 들어오면 자동 스크롤이 실행된다.
             *
             * 따라서 필터 해제 버튼 흐름에서는 차트 선택 이벤트를 조회 완료 시점까지 억제한다.
             */
            this._bSuppressChartSelectionEvent = true;
            this._clearStatusChartSelection(true);
            this.getView().getModel("view").setProperty("/filters/statusCodes", this._getDefaultProblemStatusCodes());

            this.onSearch().then(function () {
                this._clearStatusChartSelection(true);
                this._resetTableSettings();
                this._showToast(this._text("summaryFilterCleared"));
            }.bind(this)).finally(function () {
                /*
                 * 일부 VizFrame 버전은 vizSelection([]) 직후 deselectData 이벤트를 조금 늦게 발생시킨다.
                 * 필터 해제 버튼에서는 그 늦은 이벤트도 자동 스크롤을 만들면 안 되므로,
                 * 일반 초기화보다 조금 더 늦게 suppress를 해제한다.
                 */
                this._releaseChartSelectionSuppression(200);
            }.bind(this));
        },

        _initModels: function () {
            // OData 결과는 화면에서 바로 쓰기 편하도록 JSONModel에 복사해서 관리한다.
            this.getView().setModel(new JSONModel(this._createInitialViewState()), "view");
            this.getView().setModel(new JSONModel(this._createEmptyKpi()), "kpi");
            this.getView().setModel(new JSONModel(this._createEmptyChart()), "chart");
            this.getView().setModel(new JSONModel({}), "detail");
            this.getView().setModel(new JSONModel({
                items: [],
                busy: false
            }), "grHistory");
        },

        _createInitialViewState: function () {
            // 기본 조회범위는 V4 설계 기준: 기준일 - 90일 ~ 기준일 월 말일.
            var oBaseDate = this._normalizeDate(new Date());
            var oEindtFrom = this._addDays(oBaseDate, -90);
            var oEindtTo = new Date(oBaseDate.getFullYear(), oBaseDate.getMonth() + 1, 0);

            return {
                filters: {
                    baseDate: oBaseDate,
                    eindtFrom: oEindtFrom,
                    eindtTo: oEindtTo,
                    werks: "",
                    // 기본 상태는 문제건 중심으로 설정한다. C(입고완료)는 사용자가 필요할 때 선택한다.
                    statusCodes: this._getDefaultProblemStatusCodes(),
                    // excludeCompleted: true,  "입고완료 제외" 체크박스 더이상 사용 안 함
                    bukrs: "",
                    ebeln: "",
                    lifnr: "",
                    name1: "",
                    matnr: "",
                    maktx: ""
                },
                advancedVisible: false,
                tableBusy: false,
                items: [],
                tableCount: 0,
                tableSortKey: "",
                tableSortDescending: false,
                tableGroupKey: "",
                tableGroupDescending: false,
                tableStatusSummary: "",
                tableSortGroupSummary: ""
            };
        },

        _createEmptyKpi: function () {
            // KPI 조회 실패 또는 초기화 시 화면이 undefined를 표시하지 않도록 기본값을 제공한다.
            return {
                KpiId: "MAIN",
                OpenPoItemCnt: 0,
                DelayedItemCnt: 0,
                NoReceiptDelayCnt: 0,
                DelayedVendorCnt: 0
            };
        },

        _createEmptyChart: function () {
            // 상태 차트도 데이터가 없을 때 빈 배열/0건으로 안전하게 초기화한다.
            return {
                statusDistribution: [],
                totalCount: 0
            };
        },

        _getStatusConfig: function () {
            /*
             * 납기상태 코드의 기준 정보를 한 곳에 모아둔다.
             *
             * 왜 필요한가?
             * - 기존에는 O/D/P/L/C 상태코드, 상태명 i18n key, UI5 State 값이 여러 메소드에 흩어져 있었다.
             * - 상태명이 바뀌거나 새로운 상태가 추가되면 여러 곳을 동시에 고쳐야 해서 누락 위험이 생긴다.
             * - 이제 차트, KPI 빠른 필터, 테이블 요약, 상태 텍스트 변환은 이 설정을 기준으로 동작한다.
             *
             * 필드 의미:
             * - code: Gateway/OData에서 내려오는 상태코드
             * - textKey: i18n.properties의 상태명 key
             * - state: ObjectStatus 등에서 사용하는 UI5 상태값
             * - defaultProblem: 초기 조회/초기화 시 기본으로 선택할 문제건 상태 여부
             * - delayed: 납기 지연 KPI에서 함께 보는 상태 여부
             * - noReceiptDelay: 미입고 지연 KPI에서 보는 상태 여부
             */
            return [
                { code: "O", textKey: "statusO", state: "None", defaultProblem: true, delayed: false, noReceiptDelay: false },
                { code: "D", textKey: "statusD", state: "Error", defaultProblem: true, delayed: true, noReceiptDelay: true },
                { code: "P", textKey: "statusP", state: "Information", defaultProblem: true, delayed: false, noReceiptDelay: false },
                { code: "L", textKey: "statusL", state: "Warning", defaultProblem: true, delayed: true, noReceiptDelay: false },
                { code: "C", textKey: "statusC", state: "Success", defaultProblem: false, delayed: false, noReceiptDelay: false }
            ];
        },

        _getStatusCodesByFlag: function (sFlagName) {
            /*
             * 상태 설정에서 특정 flag가 true인 상태코드만 추출한다.
             * 예: defaultProblem이 true인 상태만 모으면 기본 문제건 O/D/P/L이 된다.
             */
            return this._getStatusConfig().filter(function (oStatus) {
                return !!oStatus[sFlagName];
            }).map(function (oStatus) {
                return oStatus.code;
            });
        },

        _getAllStatusCodes: function () {
            // 상태 전체 선택 여부를 비교할 때 사용하는 전체 상태코드 목록이다.
            return this._getStatusConfig().map(function (oStatus) {
                return oStatus.code;
            });
        },

        _getStatusConfigByCode: function (sStatusCode) {
            // 상태코드 하나에 해당하는 설정을 찾는다. 없으면 undefined가 반환된다.
            return this._getStatusConfig().find(function (oStatus) {
                return oStatus.code === sStatusCode;
            });
        },

        _buildFilters: function (bIncludeStatusFilter) {
            /*
             * 화면 검색조건(JSONModel)을 ODataModel.read에서 사용할 Filter 배열로 변환한다.
             * bIncludeStatusFilter가 false이면 StatusCode 조건을 빼서 KPI/차트용 조회에 사용한다.
             */
            var oFilterData = this.getView().getModel("view").getProperty("/filters");
            var aFilters = [];

            this._addDateFilter(aFilters, "BaseDate", FilterOperator.EQ, oFilterData.baseDate);
            this._addEindtFilters(aFilters, oFilterData.eindtFrom, oFilterData.eindtTo);
            this._addTextFilter(aFilters, "Werks", oFilterData.werks);
            this._addTextFilter(aFilters, "Bukrs", oFilterData.bukrs);
            this._addTextFilter(aFilters, "Ebeln", oFilterData.ebeln);
            this._addTextFilter(aFilters, "Lifnr", oFilterData.lifnr);
            this._addTextFilter(aFilters, "Name1", oFilterData.name1);
            this._addTextFilter(aFilters, "Matnr", oFilterData.matnr);
            this._addTextFilter(aFilters, "Maktx", oFilterData.maktx);

            if (bIncludeStatusFilter !== false) {
                this._addStatusFilters(aFilters, oFilterData.statusCodes);
            }

            return aFilters;
        },

        _loadMainTable: function (aFilters) {
            var oViewModel = this.getView().getModel("view");

            // 테이블 조회 중에는 busy 표시를 켜서 사용자가 조회 중임을 알 수 있게 한다.
            oViewModel.setProperty("/tableBusy", true);

            return this._readEntitySet("/DelayedPoSet", aFilters).then(function (aResults) {
                // OData 결과를 view>/items에 넣으면 Main.view.xml의 Table이 자동 갱신된다.
                oViewModel.setProperty("/items", aResults);
                oViewModel.setProperty("/tableCount", aResults.length);
            }.bind(this)).catch(function (oError) {
                oViewModel.setProperty("/items", []);
                oViewModel.setProperty("/tableCount", 0);
                this._showToast(this._getErrorMessage(oError, "mainLoadError"));
            }.bind(this)).finally(function () {
                oViewModel.setProperty("/tableBusy", false);
            }.bind(this));
        },

        _loadStatusChart: function (aFilters) {
            // 차트는 별도 EntitySet 없이 DelayedPoSet 결과를 클라이언트에서 상태별로 집계한다.
            return this._readEntitySet("/DelayedPoSet", aFilters).then(function (aResults) {
                this._updateStatusChart(aResults);
            }.bind(this)).catch(function () {
                this.getView().getModel("chart").setData(this._createEmptyChart());
            }.bind(this));
        },

        _loadKpiData: function (aFilters) {
            var oKpiModel = this.getView().getModel("kpi");

            // KPI EntitySet은 KpiId = MAIN 1건을 반환하므로 첫 번째 결과만 사용한다.
            return this._readEntitySet("/DelayedPoKpiSet", aFilters).then(function (aResults) {
                oKpiModel.setData(aResults[0] || this._createEmptyKpi());
            }.bind(this)).catch(function (oError) {
                oKpiModel.setData(this._createEmptyKpi());
                this._showToast(this._getErrorMessage(oError, "kpiLoadError"));
            }.bind(this));
        },

        _loadGrHistory: function (oPoItem) {
            var oHistoryModel = this.getView().getModel("grHistory");
            // 상세 이력은 선택한 PO Item의 Ebeln/Ebelp 기준으로만 조회한다.
            var aFilters = [
                new Filter("Ebeln", FilterOperator.EQ, oPoItem.Ebeln),
                new Filter("Ebelp", FilterOperator.EQ, oPoItem.Ebelp)
            ];

            oHistoryModel.setProperty("/busy", true);

            return this._readEntitySet("/PoGrHistorySet", aFilters).then(function (aResults) {
                oHistoryModel.setProperty("/items", aResults);
            }).catch(function (oError) {
                oHistoryModel.setProperty("/items", []);
                this._showToast(this._getErrorMessage(oError, "historyLoadError"));
            }.bind(this)).finally(function () {
                oHistoryModel.setProperty("/busy", false);
            });
        },

        _scrollToResultTable: function () {
            /*
             * KPI/차트 빠른 필터 적용 후 메인 테이블로 자동 이동한다.
             *
             * 왜 필요한가?
             * - KPI와 차트는 화면 상단 요약 영역에 있다.
             * - 사용자가 KPI 카드나 차트를 클릭하면 실제 결과는 아래 sap.m.Table에 반영된다.
             * - 자동 스크롤이 없으면 사용자는 필터가 적용됐는지 확인하려고 직접 아래로 내려가야 한다.
             *
             * 구현 기준:
             * - 현재 화면의 루트 컨테이너는 sap.m.Page(id="page")다.
             * - SAPUI5 SDK 기준으로 sap.m.Page는 scrollToElement(oElement, iTime)을 제공한다.
             * - 이 API를 우선 사용하고, 혹시 Page 스크롤 API를 사용할 수 없는 환경이면
             *   브라우저 표준 DOM scrollIntoView를 보조 수단으로 사용한다.
             *
             * setTimeout을 사용하는 이유:
             * - onSearch()가 끝나면 JSONModel 데이터는 들어왔지만, 브라우저 렌더링은 다음 tick에 반영될 수 있다.
             * - 한 번 늦춰서 실행하면 테이블 행/그룹 헤더가 화면에 반영된 뒤 안정적으로 스크롤할 수 있다.
             */
            var oPage = this.byId("page");
            var oTable = this.byId("delayedPoTable");

            if (!oTable) {
                return;
            }

            setTimeout(function () {
                var oTableDomRef = oTable.getDomRef && oTable.getDomRef();

                if (oPage && typeof oPage.scrollToElement === "function") {
                    oPage.scrollToElement(oTable, 450);
                    return;
                }

                if (oTableDomRef && typeof oTableDomRef.scrollIntoView === "function") {
                    oTableDomRef.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });
                }
            }, 0);
        },

        _readEntitySet: function (sPath, aFilters) {
            // ODataModel.read는 콜백 방식이므로 Promise로 감싸서 then/catch 흐름으로 사용한다.
            var oModel = this.getOwnerComponent().getModel();

            return new Promise(function (resolve, reject) {
                if (!oModel) {
                    reject(new Error("Default OData model is not available."));
                    return;
                }

                oModel.read(sPath, {
                    filters: aFilters,
                    success: function (oData) {
                        resolve(oData && oData.results ? oData.results : []);
                    },
                    error: reject
                });
            });
        },

        _updateStatusChart: function (aItems) {
            var oChartModel = this.getView().getModel("chart");
            var mCounts = {};
            // 차트는 공통 상태 설정 순서대로 O/D/P/L/C를 보여준다. 데이터가 없어도 Count 0으로 표시한다.
            var aStatusConfig = this._getStatusConfig();
            var aDistribution;
            var iTotalCount = (aItems || []).length;

            (aItems || []).forEach(function (oItem) {
                // StatusCode별 건수를 단순 누적한다.
                var sCode = oItem.StatusCode || "";
                mCounts[sCode] = (mCounts[sCode] || 0) + 1;
            });

            aDistribution = aStatusConfig.map(function (oStatus) {
                var iCount = mCounts[oStatus.code] || 0;
                var fPercent = iTotalCount > 0 ? (iCount / iTotalCount) * 100 : 0;
                var sPercentText = fPercent.toFixed(2) + "%";
                var sStatusText = this._text(oStatus.textKey);
                var sSummaryText = sStatusText + " " + iCount + this._text("countUnit") + "(" + sPercentText + ")";

                return {
                    StatusCode: oStatus.code,
                    StatusText: sStatusText,
                    Count: iCount,
                    Percent: fPercent,
                    PercentText: sPercentText,
                    SummaryText: sSummaryText,
                    TooltipText: sSummaryText,
                    StatusState: oStatus.state
                };
            }.bind(this));

            oChartModel.setData({
                statusDistribution: aDistribution,
                totalCount: iTotalCount
            });
        },

        _getStatusCodeByText: function (sStatusText) {
            // 차트 이벤트는 표시 텍스트를 넘겨주므로, 다시 상태코드 O/D/P/L/C로 변환한다.
            var oMatchedStatus = this._getStatusConfig().find(function (oStatus) {
                return this._text(oStatus.textKey) === sStatusText;
            }.bind(this));

            return oMatchedStatus ? oMatchedStatus.code : "";
        },

        _getDefaultProblemStatusCodes: function () {
            /*
             * 앱의 기본 조회 상태다.
             * 입고완료(C)는 사용자가 직접 보고 싶을 때만 선택하고,
             * 기본 화면/초기화/차트 선택 해제는 문제건 중심인 O/D/P/L로 복귀한다.
             */
            return this._getStatusCodesByFlag("defaultProblem");
        },

        _getStatusCodesFromChartSelection: function (oEvent) {
            /*
             * VizFrame의 selectData/deselectData 이벤트에서 현재 선택된 상태코드 배열을 만든다.
             *
             * 핵심 포인트:
             * - oEvent.getParameter("data")는 이벤트가 발생한 데이터 포인트를 준다.
             * - 다중 선택 상태 전체를 보려면 가능하면 VizFrame의 vizSelection() 결과를 우선 사용한다.
             * - 시스템/버전에 따라 vizSelection()이 배열을 반환하지 않을 수 있어 이벤트 data를 보조로 사용한다.
             */
            var oChart = oEvent.getSource();
            var vCurrentSelection = oChart && typeof oChart.vizSelection === "function" ? oChart.vizSelection() : [];
            var bDeselectEvent = oEvent.getId && oEvent.getId() === "deselectData";
            var aSelectedData = Array.isArray(vCurrentSelection) ? vCurrentSelection : [];
            var aStatusCodes = [];

            /*
             * deselectData에서 현재 선택 배열이 비었다는 것은 사용자가 모든 선택을 해제했다는 뜻이다.
             * 이때 이벤트 data로 fallback하면 방금 해제한 항목이 다시 필터로 들어가므로 fallback하지 않는다.
             */
            if (aSelectedData.length === 0 && !bDeselectEvent) {
                aSelectedData = oEvent.getParameter("data") || [];
            }

            aSelectedData.forEach(function (oDataPoint) {
                var sStatusCode = this._getChartDataPointStatusCode(oDataPoint);

                if (sStatusCode) {
                    aStatusCodes.push(sStatusCode);
                }
            }.bind(this));

            return this._getUniqueStatusCodes(aStatusCodes);
        },

        _getChartDataPointStatusCode: function (oDataPoint) {
            /*
             * 차트 선택 이벤트에서 상태코드를 구한다.
             *
             * 목표:
             * - 내부 필터는 화면 문구가 아니라 StatusCode(O/D/P/L/C)를 기준으로 동작하게 한다.
             * - 상태명 문구가 나중에 바뀌어도 필터 로직이 최대한 흔들리지 않게 한다.
             *
             * 실제 VizFrame 이벤트는 차트의 Dimension 값을 중심으로 넘기기 때문에,
             * 시스템/버전에 따라 StatusCode가 직접 없고 상태명만 있을 수 있다.
             * 그래서 StatusCode를 먼저 찾고, 없으면 상태명으로 보정한다.
             *
             * 현재 프로젝트의 VizFrame 이벤트 예:
             *   oDataPoint.data.Status = "미입고 지연"
             */
            var vData = oDataPoint && oDataPoint.data;
            var sStatusCode;
            var sStatusText;

            if (!vData) {
                return "";
            }

            sStatusCode = this._extractStatusCodeFromVizData(vData);
            if (sStatusCode) {
                return sStatusCode;
            }

            sStatusText = this._extractStatusTextFromVizData(vData);
            return this._getStatusCodeByText(sStatusText);
        },

        _getUniqueStatusCodes: function (aStatusCodes) {
            // 같은 차트 조각이 중복으로 들어와도 OData 필터는 한 번만 만들도록 중복을 제거한다.
            var mSeen = {};

            return (aStatusCodes || []).filter(function (sStatusCode) {
                if (mSeen[sStatusCode]) {
                    return false;
                }

                mSeen[sStatusCode] = true;
                return true;
            });
        },

        _getKpiQuickActionConfig: function (sAction) {
            /*
             * KPI 카드별 빠른 필터 정책을 한 곳에 모아둔다.
             * 이렇게 분리하면 나중에 "미입고 PO Item은 납기일순이 아니라 지연일수순으로 보자"처럼
             * 업무 기준이 바뀌어도 XML을 건드리지 않고 이 설정만 바꾸면 된다.
             */
            var mConfig = {
                OPEN_PO_ITEM: {
                    // C(입고완료)를 제외한 문제/관심 상태 전체를 보여준다.
                    statusCodes: this._getDefaultProblemStatusCodes(),
                    sortKey: "Eindt",
                    sortDescending: false,
                    groupKey: "",
                    groupDescending: false,
                    messageKey: "kpiQuickFilterOpenPoItem"
                },
                DELAYED_ITEM: {
                    // 납기 지연은 미입고 지연(D)과 부분입고 지연(L)을 함께 본다.
                    statusCodes: this._getStatusCodesByFlag("delayed"),
                    sortKey: "DelayDays",
                    sortDescending: true,
                    groupKey: "",
                    groupDescending: false,
                    messageKey: "kpiQuickFilterDelayedItem"
                },
                NO_RECEIPT_DELAY: {
                    // 입고수량이 0 이하이고 납기가 지난 D 상태만 집중해서 본다.
                    statusCodes: this._getStatusCodesByFlag("noReceiptDelay"),
                    sortKey: "DelayDays",
                    sortDescending: true,
                    groupKey: "",
                    groupDescending: false,
                    messageKey: "kpiQuickFilterNoReceiptDelay"
                },
                DELAYED_VENDOR: {
                    // 공급업체 대응 목적이므로 D/L 상태를 공급업체별로 묶어서 보여준다.
                    statusCodes: this._getStatusCodesByFlag("delayed"),
                    sortKey: "DelayDays",
                    sortDescending: true,
                    groupKey: "Lifnr",
                    groupDescending: false,
                    messageKey: "kpiQuickFilterDelayedVendor"
                }
            };

            return mConfig[sAction];
        },

        _initStatusChartPopover: function () {
            /*
             * VizFrame의 기본 tooltip 대신 차트 전용 Popover를 연결한다.
             * 사용자가 도넛 조각에 마우스를 올리면 "미입고 예정 12건(27.91%)"처럼
             * 상태명, 건수, 비율을 한 줄로 보여주기 위한 처리다.
             */
            var oChart = this.byId("statusDistributionChart");
            var sCountFormat = this._text("chartCountFormat");

            if (!oChart || this._oStatusChartPopover) {
                return;
            }

            this._applyStatusChartProperties(oChart, sCountFormat);

            this._oStatusChartPopover = new ChartPopover({
                // 기본 Popover의 숫자 행에도 "건" 단위가 붙도록 포맷을 지정한다.
                formatString: sCountFormat,
                customDataControl: function (oPopoverData) {
                    var sStatusCode = this._getChartStatusCodeFromPopoverData(oPopoverData);
                    var sTooltipText = this._getChartTooltipTextByStatusCode(sStatusCode);

                    return new Text({
                        text: sTooltipText || this._text("notAvailable"),
                        wrapping: false
                    });
                }.bind(this)
            });

            this.getView().addDependent(this._oStatusChartPopover);
            this._oStatusChartPopover.connect(oChart.getVizUid());
        },

        _applyStatusChartProperties: function (oChart, sCountFormat) {
            /*
             * 차트 숫자 라벨의 "건" 표시를 i18n 기준으로 적용한다.
             *
             * 이유:
             * - VizFrame의 vizProperties는 XML에서 object literal 형태로 작성되어 있다.
             * - 이 형태 안에 i18n 바인딩을 직접 섞으면 UI5 버전/파서에 따라 해석이 불안정할 수 있다.
             * - SAPUI5 SDK에서 VizFrame은 setVizProperties로 속성을 동적으로 변경할 수 있으므로,
             *   컨트롤러에서 ResourceBundle 값을 읽어 formatString만 명확하게 덮어쓴다.
             */
            if (!oChart || typeof oChart.setVizProperties !== "function") {
                return;
            }

            oChart.setVizProperties({
                plotArea: {
                    dataLabel: {
                        formatString: sCountFormat
                    }
                }
            });
        },

        _clearStatusChartSelection: function (bKeepSuppressed) {
            /*
             * VizFrame 선택 상태를 화면에서 제거한다.
             * 차트 선택은 필터 값(view>/filters/statusCodes)과 별개로 VizFrame 내부에도 남기 때문에
             * 초기화 시 내부 선택도 함께 지워야 사용자가 "완전히 초기화됐다"고 느낀다.
             *
             * vizSelection으로 선택을 지울 때 deselectData 이벤트가 같이 발생할 수 있다.
             * 그 이벤트가 onStatusChartSelect를 다시 타면 초기화 중 상태 필터가 빈 배열로 바뀔 수 있으므로
             * 내부 초기화 중에는 차트 선택 이벤트를 잠깐 무시한다.
             *
             * bKeepSuppressed = true:
             * - 호출자가 여러 비동기 작업을 이어서 처리하는 중이라는 뜻이다.
             * - 이 경우 이 메소드 안에서 suppress flag를 바로 풀지 않고,
             *   호출자가 안전한 시점에 _releaseChartSelectionSuppression을 직접 호출한다.
             */
            var oChart = this.byId("statusDistributionChart");

            if (!oChart || typeof oChart.vizSelection !== "function") {
                return;
            }

            this._bSuppressChartSelectionEvent = true;

            try {
                oChart.vizSelection([], {
                    clearSelection: true
                });
            } catch (oError) {
                // 일부 UI5/VizFrame 버전에서 선택 해제 API가 다르게 동작해도 초기화 흐름은 계속 진행한다.
            } finally {
                if (!bKeepSuppressed) {
                    this._releaseChartSelectionSuppression();
                }
            }
        },

        _releaseChartSelectionSuppression: function (iDelay) {
            /*
             * 차트 선택 이벤트 억제를 다음 브라우저 tick에서 해제한다.
             *
             * 즉시 false로 바꾸지 않는 이유:
             * - vizSelection([]) 직후 deselectData 이벤트가 비동기로 늦게 들어올 수 있다.
             * - setTimeout 0으로 한 번 늦추면 같은 렌더링 흐름에서 발생한 선택 해제 이벤트를 더 안전하게 무시할 수 있다.
             *
             * iDelay:
             * - 기본값은 0ms다.
             * - 필터 해제 버튼처럼 늦게 들어오는 deselectData까지 막아야 하는 경우에는 더 긴 지연 시간을 넘긴다.
             */
            setTimeout(function () {
                this._bSuppressChartSelectionEvent = false;
            }.bind(this), iDelay || 0);
        },

        _resetTableSettings: function () {
            // 테이블 바인딩의 정렬/그룹을 제거하고, Dialog가 이미 생성되어 있으면 선택 상태도 초기화한다.
            this._applyTableSorters("", false, "", false);
            this._resetTableSettingsDialog();
        },

        _resetTableSettingsDialog: function () {
            var oDialog = this.byId("tableSettingsDialog");

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

        _clearViewSettingsItems: function (aItems) {
            (aItems || []).forEach(function (oItem) {
                if (oItem && typeof oItem.setSelected === "function") {
                    oItem.setSelected(false);
                }
            });
        },

        _getChartStatusCodeFromPopoverData: function (oPopoverData) {
            /*
             * Popover가 넘기는 데이터 구조는 VizFrame 내부 구조라 UI5 버전/차트 타입에 따라 조금 달라질 수 있다.
             * 차트 선택 로직과 마찬가지로 StatusCode를 먼저 찾고, 없으면 상태명으로 상태코드를 보정한다.
             */
            var sStatusCode = this._extractStatusCodeFromVizData(oPopoverData);
            var sStatusText;

            if (sStatusCode) {
                return sStatusCode;
            }

            sStatusText = this._extractStatusTextFromVizData(oPopoverData);
            return this._getStatusCodeByText(sStatusText);
        },

        _extractStatusCodeFromVizData: function (vData) {
            /*
             * VizFrame 이벤트/Popover 데이터 안에서 StatusCode 값을 우선 추출한다.
             *
             * 차트의 화면 Dimension은 사용자가 읽기 쉬운 상태명(Status)이지만,
             * 내부 필터는 O/D/P/L/C 코드가 더 안정적이다.
             * 따라서 데이터 구조 안에 StatusCode 또는 code 성격의 값이 있으면 그것을 우선 사용한다.
             */
            var sStatusCode = chartHelper.extractNamedValue(vData, [
                "StatusCode",
                "Status Code",
                "code"
            ]);

            return this._getStatusConfigByCode(sStatusCode) ? sStatusCode : "";
        },

        _extractStatusTextFromVizData: function (vData) {
            /*
             * VizFrame 이벤트/Popover 데이터에서 상태 텍스트를 꺼내는 공통 헬퍼다.
             * 우선 명확한 차원명(Status) 값을 찾고, 그래도 없으면 알려진 상태 텍스트와 정확히 같은 문자열만 찾는다.
             */
            var sStatusText = chartHelper.extractNamedValue(vData, [
                "Status",
                "StatusText",
                this._text("chartStatusDimension")
            ]);

            if (sStatusText) {
                return sStatusText;
            }

            return chartHelper.findKnownText(vData, function (sText) {
                return !!this._getStatusCodeByText(sText);
            }.bind(this));
        },

        _getChartTooltipTextByStatusCode: function (sStatusCode) {
            // 차트 모델에 이미 계산해 둔 TooltipText를 상태코드 기준으로 찾아 반환한다.
            var aDistribution = this.getView().getModel("chart").getProperty("/statusDistribution") || [];
            var oMatchedStatus = aDistribution.find(function (oStatus) {
                return oStatus.StatusCode === sStatusCode;
            });

            return oMatchedStatus && oMatchedStatus.TooltipText || "";
        },

        _applyTableSorters: function (sSortKey, bSortDescending, sGroupKey, bGroupDescending) {
            /*
             * sap.ui.model.Sorter는 Table/List Binding에 정렬 기준을 전달하는 객체다.
             * 세 번째 파라미터에 function을 넘기면 그룹 헤더 텍스트를 직접 만들 수 있다.
             */
            var oTable = this.byId("delayedPoTable");
            var oBinding = oTable && oTable.getBinding("items");
            var aSorters = [];

            this._setTableSortGroupState(sSortKey, bSortDescending, sGroupKey, bGroupDescending);

            if (!oBinding) {
                return;
            }

            if (sGroupKey) {
                // 그룹은 항상 첫 번째 Sorter로 넣어야 같은 그룹끼리 모여서 표시된다.
                aSorters.push(this._createTableSorter(
                    sGroupKey,
                    bGroupDescending,
                    this._getTableGroup.bind(this, sGroupKey)
                ));
            }

            if (sSortKey && sSortKey !== sGroupKey) {
                // 그룹 필드와 정렬 필드가 다를 때만 두 번째 Sorter를 추가해 중복 정렬을 피한다.
                aSorters.push(this._createTableSorter(sSortKey, bSortDescending));
            }

            oBinding.sort(aSorters);
        },

        _createTableSorter: function (sKey, bDescending, vGroup) {
            /*
             * sap.ui.model.Sorter 생성 공통 함수다.
             *
             * 왜 별도 함수로 뺐는가?
             * - 일반 문자열/날짜 필드는 UI5 기본 Sorter 비교 방식으로 충분하다.
             * - 하지만 OData V2의 Edm.Decimal 값은 JSONModel에 문자열 형태로 들어오는 경우가 많다.
             * - 예를 들어 미입고수량이 "9", "50", "6"처럼 문자열이면 기본 비교에서는
             *   숫자 크기가 아니라 문자 순서로 비교되어 9가 50보다 앞에 오는 문제가 생긴다.
             *
             * SAPUI5 Sorter는 네 번째 파라미터로 comparator 함수를 받을 수 있다.
             * 그래서 수량 필드만 Number(...) 기준의 숫자 비교 함수를 연결한다.
             */
            var fnComparator = this._isQuantitySortKey(sKey) ? this._compareNumericValues.bind(this) : undefined;

            return new Sorter(sKey, bDescending, vGroup, fnComparator);
        },

        _isQuantitySortKey: function (sKey) {
            /*
             * 숫자 비교가 꼭 필요한 테이블 정렬 필드 목록이다.
             *
             * 발주수량/입고수량/미입고수량은 화면에는 "20 EA"처럼 보이지만,
             * 실제 정렬 대상 값은 PoQty/GrQty/OpenQty다.
             * 이 값들은 OData Decimal 특성상 문자열로 들어올 수 있으므로
             * 반드시 숫자로 바꿔 비교해야 한다.
             */
            return [
                "PoQty",
                "GrQty",
                "OpenQty"
            ].indexOf(sKey) > -1;
        },

        _compareNumericValues: function (vA, vB) {
            /*
             * Sorter comparator는 오름차순 기준으로 -1, 0, 1을 반환한다.
             * 내림차순 처리는 Sorter의 bDescending 값이 담당하므로,
             * 여기서는 순수하게 숫자 크기만 비교한다.
             *
             * Number(...)로 바꿀 수 없는 값은 0으로 보정한다.
             * 이번 앱의 수량 필드는 값이 비어 있으면 업무적으로도 0에 가깝게 보이는 것이 자연스럽다.
             */
            var fA = Number(vA);
            var fB = Number(vB);

            if (isNaN(fA)) {
                fA = 0;
            }

            if (isNaN(fB)) {
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

        _setTableSortGroupState: function (sSortKey, bSortDescending, sGroupKey, bGroupDescending) {
            var oViewModel = this.getView().getModel("view");

            if (!oViewModel) {
                return;
            }

            oViewModel.setProperty("/tableSortKey", sSortKey || "");
            oViewModel.setProperty("/tableSortDescending", !!bSortDescending);
            oViewModel.setProperty("/tableGroupKey", sGroupKey || "");
            oViewModel.setProperty("/tableGroupDescending", !!bGroupDescending);

            this._updateTableStateSummary();
        },

        _updateTableStateSummary: function () {
            var oViewModel = this.getView().getModel("view");

            if (!oViewModel) {
                return;
            }

            oViewModel.setProperty("/tableStatusSummary", this._getStatusFilterSummary());
            oViewModel.setProperty("/tableSortGroupSummary", this._getSortGroupSummary());
        },

        _getStatusFilterSummary: function () {
            var aStatusCodes = this.getView().getModel("view").getProperty("/filters/statusCodes") || [];
            var aDefaultCodes = this._getDefaultProblemStatusCodes();
            var aAllCodes = this._getAllStatusCodes();
            var aStatusTexts;

            if (!aStatusCodes.length || this._isSameStatusSet(aStatusCodes, aAllCodes)) {
                return this._text("tableStatusSummaryAll");
            }

            if (this._isSameStatusSet(aStatusCodes, aDefaultCodes)) {
                return this._text("tableStatusSummaryDefault");
            }

            aStatusTexts = aStatusCodes.map(function (sCode) {
                return this._getStatusTextByCode(sCode);
            }.bind(this)).filter(Boolean);

            return this._text("tableStatusSummaryPrefix") + ": " + (aStatusTexts.join(", ") || this._text("notAvailable"));
        },

        _getSortGroupSummary: function () {
            var oViewModel = this.getView().getModel("view");
            var aParts = [];
            var sSortKey = oViewModel.getProperty("/tableSortKey");
            var sGroupKey = oViewModel.getProperty("/tableGroupKey");

            if (sSortKey) {
                aParts.push(
                    this._text("tableSortSummaryPrefix")
                    + ": "
                    + this._getTableSettingLabel(sSortKey)
                    + " "
                    + this._getOrderText(oViewModel.getProperty("/tableSortDescending"))
                );
            }

            if (sGroupKey) {
                aParts.push(
                    this._text("tableGroupSummaryPrefix")
                    + ": "
                    + this._getTableSettingLabel(sGroupKey)
                    + " "
                    + this._getOrderText(oViewModel.getProperty("/tableGroupDescending"))
                );
            }

            return aParts.length ? aParts.join(" / ") : this._text("tableSortGroupSummaryDefault");
        },

        _getTableSettingLabel: function (sKey) {
            var mLabelKeyByProperty = {
                StatusText: "colStatus",
                StatusCode: "colStatus",
                DelayDays: "colDelayDays",
                Eindt: "colEindt",
                Ebeln: "colEbeln",
                Lifnr: "colLifnr",
                Name1: "colName1",
                Matnr: "colMatnr",
                Maktx: "colMaktx",
                PoQty: "colPoQty",
                GrQty: "colGrQty",
                OpenQty: "colOpenQty"
            };

            return mLabelKeyByProperty[sKey] ? this._text(mLabelKeyByProperty[sKey]) : sKey;
        },

        _getOrderText: function (bDescending) {
            return bDescending ? this._text("sortDescending") : this._text("sortAscending");
        },

        _getStatusTextByCode: function (sStatusCode) {
            var oStatus = this._getStatusConfigByCode(sStatusCode);

            return oStatus ? this._text(oStatus.textKey) : "";
        },

        _isSameStatusSet: function (aLeftCodes, aRightCodes) {
            var aLeft = (aLeftCodes || []).slice().sort();
            var aRight = (aRightCodes || []).slice().sort();

            return aLeft.length === aRight.length && aLeft.every(function (sCode, iIndex) {
                return sCode === aRight[iIndex];
            });
        },

        _getTableGroup: function (sProperty, oContext) {
            // 그룹 헤더에는 단순 코드보다 사용자가 이해하기 쉬운 텍스트를 표시한다.
            var oItem = oContext && oContext.getObject ? oContext.getObject() : {};
            var sKey;
            var sText;

            if (sProperty === "StatusCode") {
                sKey = oItem.StatusCode || "";
                sText = oItem.StatusText || this._text("notAvailable");
                return {
                    key: sKey,
                    text: this._text("colStatus") + ": " + sText
                };
            }

            if (sProperty === "Lifnr") {
                sKey = oItem.Lifnr || "";
                sText = sKey || this._text("notAvailable");

                if (oItem.Name1) {
                    sText += " - " + oItem.Name1;
                }

                return {
                    key: sKey,
                    text: this._text("colLifnr") + ": " + sText
                };
            }

            if (sProperty === "Ebeln") {
                sText = oItem.Ebeln || this._text("notAvailable");
                return {
                    key: oItem.Ebeln || "",
                    text: this._text("colEbeln") + ": " + sText
                };
            }

            if (sProperty === "Matnr") {
                sKey = oItem.Matnr || "";
                sText = sKey || this._text("notAvailable");

                if (oItem.Maktx) {
                    sText += " - " + oItem.Maktx;
                }

                return {
                    key: sKey,
                    text: this._text("colMatnr") + ": " + sText
                };
            }

            if (sProperty === "Eindt") {
                sText = formatter.formatDate(oItem.Eindt);
                return {
                    key: sText,
                    text: this._text("colEindt") + ": " + sText
                };
            }

            return {
                key: oItem[sProperty] || "",
                text: oItem[sProperty] || this._text("notAvailable")
            };
        },

        _openDetailDialog: function () {
            var oView = this.getView();

            // Fragment.load는 비동기 Promise를 반환하므로, Promise를 보관해 중복 생성을 막는다.
            if (!this._pDetailDialog) {
                this._pDetailDialog = Fragment.load({
                    id: oView.getId(),
                    name: "code.d3.delayedpomonitor.fragment.PoItemDetail",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._pDetailDialog.then(function (oDialog) {
                oDialog.open();
            });
        },

        _addTextFilter: function (aFilters, sProperty, sValue) {
            var sCleanValue = (sValue || "").trim();

            // 빈 문자열은 필터로 보내지 않는다. 값이 있을 때만 EQ 조건을 만든다.
            if (sCleanValue) {
                aFilters.push(new Filter(sProperty, FilterOperator.EQ, sCleanValue));
            }
        },

        _addDateFilter: function (aFilters, sProperty, sOperator, oDate) {
            // DatePicker 값이 정상 Date 객체일 때만 OData 날짜 필터를 추가한다.
            if (oDate instanceof Date && !isNaN(oDate.getTime())) {
                aFilters.push(new Filter(sProperty, sOperator, this._normalizeDate(oDate)));
            }
        },

        _addEindtFilters: function (aFilters, oFromDate, oToDate) {
            // 납기일 From/To 입력 조합에 따라 BT, GE, LE 중 적절한 OData 필터를 만든다.
            var bHasFrom = oFromDate instanceof Date && !isNaN(oFromDate.getTime());
            var bHasTo = oToDate instanceof Date && !isNaN(oToDate.getTime());

            if (bHasFrom && bHasTo) {
                aFilters.push(new Filter("Eindt", FilterOperator.BT, this._normalizeDate(oFromDate), this._normalizeDate(oToDate)));
            } else if (bHasFrom) {
                aFilters.push(new Filter("Eindt", FilterOperator.GE, this._normalizeDate(oFromDate)));
            } else if (bHasTo) {
                aFilters.push(new Filter("Eindt", FilterOperator.LE, this._normalizeDate(oToDate)));
            }
        },

        _addStatusFilters: function (aFilters, aStatusCodes) {
            var aCodes = Array.isArray(aStatusCodes) ? aStatusCodes.slice() : [];

            // 상태를 하나도 선택하지 않으면 상태 조건 없이 조회한다.
            if (!aCodes.length) {
                return;
            }

            // 여러 상태는 OR 조건으로 묶는다. 예: StatusCode = 'D' OR StatusCode = 'L'
            aFilters.push(new Filter({
                filters: aCodes.map(function (sCode) {
                    return new Filter("StatusCode", FilterOperator.EQ, sCode);
                }),
                and: false
            }));
        },

        _normalizeDate: function (oDate) {
            // Use noon to prevent date-only filters from moving to the previous day
            // when UI5 serializes Edm.DateTime values across time zones.
            return new Date(oDate.getFullYear(), oDate.getMonth(), oDate.getDate(), 12, 0, 0);
        },

        _addDays: function (oDate, iDays) {
            var oResult = new Date(oDate.getTime());
            oResult.setDate(oResult.getDate() + iDays);
            return this._normalizeDate(oResult);
        },

        _getErrorMessage: function (oError, sFallbackKey) {
            // Gateway 오류 메시지가 JSON으로 내려오면 그 메시지를 우선 표시하고, 없으면 i18n 기본문구를 사용한다.
            var sFallback = this._text(sFallbackKey);
            var sResponseText = oError && oError.responseText;

            if (!sResponseText) {
                return sFallback;
            }

            try {
                return JSON.parse(sResponseText).error.message.value || sFallback;
            } catch (oParseError) {
                return sFallback;
            }
        },

        _text: function (sKey) {
            // 컨트롤러에서 i18n 문구를 짧게 가져오기 위한 헬퍼다.
            return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(sKey);
        },

        _showToast: function (sMessage) {
            /*
             * MessageToast를 화면 곳곳에서 직접 호출하면 폭/시간/위치 같은 표시 규칙이 흩어진다.
             * 그래서 이 앱에서는 토스트 표시를 이 헬퍼 하나로 모은다.
             *
             * width를 기본값보다 넓게 잡은 이유:
             * - 한국어 문장은 기본 MessageToast 폭에서 2~3줄로 쉽게 줄바꿈된다.
             * - 30rem 정도면 데스크톱 화면에서 대부분의 안내 문구가 1~2줄 안에 들어온다.
             * - SAPUI5 SDK 기준으로 MessageToast.show의 width 옵션은 공식 지원된다.
             *
             * 주의:
             * MessageToast는 View 안에 직접 그려지는 컨트롤이 아니라 UI5 Popup으로 생성된다.
             * 그래서 테마 CSS 영향으로 브라우저에서 기대보다 좁게 보일 수 있다.
             * 이 앱에서는 width 옵션을 넘기고, css/style.css에서도 같은 폭을 한 번 더 보강한다.
             * 실제 화면 폭을 바꾸려면 css/style.css의 .sapMMessageToast width 값도 같이 확인한다.
             */
            MessageToast.show(sMessage, {
                width: "30rem"
            });
        }
    });
});
