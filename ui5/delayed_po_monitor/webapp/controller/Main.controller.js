sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "sap/ui/core/Fragment",
    "sap/viz/ui5/format/ChartFormatter",
    "sap/viz/ui5/api/env/Format",
    "sap/m/Text",
    "sap/m/MessageToast",
    "sap/m/TableSelectDialog",
    "sap/m/ColumnListItem",
    "sap/m/Column",
    "sap/m/MessagePopover",
    "sap/m/MessageItem",
    "code/d3/delayedpomonitor/model/chartHelper",
    "code/d3/delayedpomonitor/model/formatter"
], function (Controller, JSONModel, Filter, FilterOperator, Sorter, Fragment, ChartFormatter, Format, Text, MessageToast, TableSelectDialog, ColumnListItem, Column, MessagePopover, MessageItem, chartHelper, formatter) {
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
            this._initStatusChartLabelFormatter();

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
            // Search Help Dialog는 사용자가 F4를 누를 때 동적으로 만들기 때문에 종료 시 명시적으로 정리한다.
            if (this._oValueHelpDialog) {
                this._oValueHelpDialog.destroy();
                this._oValueHelpDialog = null;
            }

            // 유효성 검증 메시지 Popover도 동적 생성 컨트롤이므로 Controller 종료 시 정리한다.
            if (this._oValidationMessagePopover) {
                this._oValidationMessagePopover.destroy();
                this._oValidationMessagePopover = null;
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
            var oScrollPosition = this._capturePageScrollPosition();

            /*
             * 조회 전 유효성 검증을 먼저 수행한다.
             * 존재하지 않는 코드성 조건으로 Gateway 조회를 보내면 빈 결과인지 오류인지 사용자가 구분하기 어렵다.
             * 따라서 Search Help CDS OData를 기준으로 코드 존재 여부를 먼저 확인하고,
             * 문제가 있으면 실제 메인/KPI/차트 조회를 중단한다.
             */
            return this._validateSearchConditions().then(function (bValid) {
                var aTableFilters;
                var aSummaryFilters;

                if (!bValid) {
                    return false;
                }

                // 메인 테이블은 사용자가 선택한 상태 필터까지 적용한다.
                // 예: 상태를 '미입고 지연(D)'만 선택하면 테이블도 D만 표시한다.
                aTableFilters = this._buildFilters(true);

                // KPI와 상태 차트는 상태 필터를 제외한 검색조건 기준으로 계산한다.
                // 이유: 상태 필터까지 적용하면 KPI 카드가 선택한 상태 기준으로만 줄어들어
                //      '전체 미입고/지연 현황 요약'이라는 의미가 약해진다.
                aSummaryFilters = this._buildFilters(false);

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
            }.bind(this)).finally(function () {
                /*
                 * 일반 조회/초기화는 "현재 화면에서 조건만 다시 적용"하는 동작이다.
                 * 테이블 데이터가 갱신될 때 sap.m.Table 내부 포커스나 growing 렌더링 때문에
                 * 브라우저가 결과 테이블 쪽으로 따라 내려가는 경우가 있어, 조회 전 위치로 되돌린다.
                 *
                 * KPI 카드/차트 클릭은 이 Promise가 끝난 뒤 _scrollToResultTable()을 별도로 호출하므로
                 * 빠른 필터의 "결과 테이블로 이동" 동작은 그대로 유지된다.
                 */
                this._restorePageScrollPosition(oScrollPosition);
            }.bind(this));
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

            /*
             * 초기화 버튼은 차트 필터 해제 버튼과 다르게 화면 전체를 기본 상태로 되돌리는 기능이다.
             * 그런데 차트 조각이 선택된 상태에서 vizSelection([])을 호출하면 VizFrame이 deselectData 이벤트를 늦게 발생시킬 수 있다.
             * 그 이벤트가 onStatusChartSelect로 들어가면 "차트 상태 선택이 해제..." Toast와 테이블 자동 스크롤이 실행된다.
             *
             * 따라서 초기화 흐름이 완전히 끝날 때까지 차트 선택 이벤트를 억제한다.
             */
            this._bSuppressChartSelectionEvent = true;
            this._clearStatusChartSelection(true);
            this._resetTableSettings();
            this._clearSearchValidationStates();

            this.onSearch().then(function () {
                /*
                 * 차트는 재조회 후 다시 렌더링되므로, 조회 완료 뒤 한 번 더 선택 상태를 지운다.
                 * 이렇게 해야 사용자가 차트 조각을 선택한 상태에서 초기화해도 파란 선택 테두리/회색 강조가 남지 않는다.
                 */
                this._clearStatusChartSelection(true);
                this._resetTableSettings();
            }.bind(this)).finally(function () {
                /*
                 * 일부 VizFrame 버전은 선택 해제 이벤트를 늦게 발생시킨다.
                 * 초기화 직후 들어오는 지연 deselectData까지 무시해야
                 * 차트 필터 해제 메시지와 테이블 자동 스크롤이 다시 발생하지 않는다.
                 */
                this._releaseChartSelectionSuppression(200);
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

        onValueHelpRequest: function (oEvent) {
            /*
             * 검색조건 Input의 F4 버튼 공통 진입점이다.
             *
             * Main.view.xml의 각 Input에는 helpType CustomData가 들어 있다.
             * 예:
             * - PLANT    -> plantHelp 모델 -> ZCDS_D3_MM_0012_CDS
             * - MATERIAL -> materialHelp 모델 -> ZCDS_D3_MM_0014_CDS
             *
             * 이렇게 한 곳에서 처리하면 필드가 늘어나도 Dialog 생성 로직을 복사하지 않고,
             * _getValueHelpConfig 설정만 추가해서 확장할 수 있다.
             */
            var oInput = oEvent.getSource();
            var sHelpType = oInput && oInput.data("helpType");
            var oConfig = this._getValueHelpConfig(sHelpType);

            if (!oConfig) {
                this._showToast(this._text("valueHelpUnknown"));
                return;
            }

            this._openValueHelpDialog(oConfig);
        },

        onMessagePopoverPress: function (oEvent) {
            /*
             * footer의 메시지 버튼을 눌렀을 때 MessagePopover를 연다.
             * SAPUI5 SDK 샘플과 동일하게 Button을 기준으로 openBy 처리한다.
             */
            this._getValidationMessagePopover().openBy(oEvent.getSource());
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

            this.onSearch().then(function (vSearchResult) {
                if (vSearchResult === false) {
                    return;
                }

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
            this.onSearch().then(function (vSearchResult) {
                if (vSearchResult === false) {
                    return;
                }

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

            this.onSearch().then(function (vSearchResult) {
                if (vSearchResult === false) {
                    return;
                }

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
            this.getView().setModel(new JSONModel(this._createEmptyValidationMessages()), "messages");
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

        _createEmptyValidationMessages: function () {
            /*
             * MessagePopover 표시용 JSONModel 기본값이다.
             * 오류가 없을 때는 count가 0이라 footer 메시지 버튼이 보이지 않는다.
             */
            return {
                items: [],
                count: 0,
                buttonText: "",
                buttonIcon: "sap-icon://message-popup",
                buttonType: "Transparent"
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

        _getValueHelpConfig: function (sHelpType) {
            /*
             * Search Help 설정 테이블이다.
             *
             * CDS OData Service 자체는 manifest.json의 named model로 이미 등록되어 있다.
             * 여기서는 화면에서 어떤 Help Type이 어떤 모델/EntitySet/컬럼/세팅 대상과 연결되는지만 정의한다.
             *
             * targetFields 의미:
             * - key: CDS OData 결과 Property
             * - value: view JSONModel의 검색조건 경로
             *
             * 예: 공급업체를 선택하면 Lifnr은 공급업체코드 Input에, Name1은 공급업체명 Input에 같이 들어간다.
             */
            var mConfig = {
                PLANT: {
                    model: "plantHelp",
                    path: "/ZCDS_D3_MM_0012",
                    title: this._text("valueHelpPlantTitle"),
                    searchFields: ["Werks", "WerksName"],
                    columns: [
                        { label: this._text("werks"), property: "Werks" },
                        { label: this._text("werksName"), property: "WerksName" }
                    ],
                    targetFields: {
                        Werks: "/filters/werks"
                    }
                },
                COMPANY: {
                    model: "companyHelp",
                    path: "/ZCDS_D3_MM_0016",
                    title: this._text("valueHelpCompanyTitle"),
                    searchFields: ["Bukrs", "BukrsName", "Waers", "Land1"],
                    columns: [
                        { label: this._text("bukrs"), property: "Bukrs" },
                        { label: this._text("bukrsName"), property: "BukrsName" },
                        { label: this._text("waers"), property: "Waers" },
                        { label: this._text("land1"), property: "Land1" }
                    ],
                    targetFields: {
                        Bukrs: "/filters/bukrs"
                    }
                },
                PO: {
                    model: "poHelp",
                    path: "/ZCDS_D3_MM_0015",
                    title: this._text("valueHelpPoTitle"),
                    searchFields: ["Ebeln", "Lifnr", "Name1", "BukrsName", "EkorgName", "EkgrpName"],
                    columns: [
                        { label: this._text("colEbeln"), property: "Ebeln" },
                        { label: this._text("colLifnr"), property: "Lifnr" },
                        { label: this._text("colName1"), property: "Name1" },
                        { label: this._text("bedat"), property: "Bedat", type: "date" },
                        { label: this._text("bukrs"), property: "Bukrs" },
                        { label: this._text("bukrsName"), property: "BukrsName" },
                        { label: this._text("ekorg"), property: "Ekorg" },
                        { label: this._text("ekorgName"), property: "EkorgName" },
                        { label: this._text("ekgrp"), property: "Ekgrp" },
                        { label: this._text("ekgrpName"), property: "EkgrpName" },
                        { label: this._text("waers"), property: "Waers" }
                    ],
                    targetFields: {
                        Ebeln: "/filters/ebeln"
                    }
                },
                VENDOR: {
                    model: "vendorHelp",
                    path: "/ZCDS_D3_MM_0013",
                    title: this._text("valueHelpVendorTitle"),
                    searchFields: ["Lifnr", "Name1", "Land1", "Waers"],
                    columns: [
                        { label: this._text("lifnr"), property: "Lifnr" },
                        { label: this._text("name1"), property: "Name1" },
                        { label: this._text("land1"), property: "Land1" },
                        { label: this._text("waers"), property: "Waers" }
                    ],
                    targetFields: {
                        Lifnr: "/filters/lifnr",
                        Name1: "/filters/name1"
                    }
                },
                MATERIAL: {
                    model: "materialHelp",
                    path: "/ZCDS_D3_MM_0014",
                    title: this._text("valueHelpMaterialTitle"),
                    searchFields: ["Matnr", "Maktx", "Maktg", "Mtart", "MtartName", "Matkl", "MatklName"],
                    columns: [
                        { label: this._text("matnr"), property: "Matnr", formatter: "matnrExternal" },
                        { label: this._text("maktx"), property: "Maktx" },
                        { label: this._text("mtart"), property: "Mtart" },
                        { label: this._text("mtartName"), property: "MtartName" },
                        { label: this._text("matkl"), property: "Matkl" },
                        { label: this._text("matklName"), property: "MatklName" },
                        { label: this._text("meins"), property: "Meins" }
                    ],
                    targetFields: {
                        Matnr: "/filters/matnr",
                        Maktx: "/filters/maktx"
                    },
                    alpha: true
                }
            };

            return mConfig[sHelpType];
        },

        _openValueHelpDialog: function (oConfig) {
            /*
             * sap.m.TableSelectDialog 기반 공통 Search Help 팝업이다.
             *
             * SDK 샘플의 핵심 구조:
             * - Input의 valueHelpRequest에서 Dialog를 연다.
             * - Dialog 내부 Table에 데이터를 바인딩한다.
             * - search 이벤트에서 Binding Filter를 바꾼다.
             * - confirm 이벤트에서 선택 행 데이터를 화면 Input에 반영한다.
             *
             * 이 앱에서는 5개 CDS OData Help를 같은 Dialog 생성 로직으로 처리한다.
             */
            var oHelpModel = this.getOwnerComponent().getModel(oConfig.model);
            var aColumns = oConfig.columns || [];
            var oTemplate;

            if (!oHelpModel) {
                this._showToast(this._text("valueHelpModelMissing"));
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
                noDataText: this._text("valueHelpNoData"),
                growing: true,
                growingThreshold: 20,
                multiSelect: false,
                rememberSelections: false,
                draggable: true,
                resizable: true,
                search: function (oEvent) {
                    var sSearchValue = oEvent.getParameter("value");
                    var oBinding = oEvent.getSource().getBinding("items");

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

        _buildValueHelpFilters: function (oConfig, sSearchValue) {
            /*
             * Search Help 팝업 검색어를 CDS OData $filter로 변환한다.
             *
             * 여러 필드는 OR 조건으로 묶는다.
             * 예: 공급업체 Help에서 Korea 입력
             * -> Lifnr contains 'Korea' OR Name1 contains 'Korea' OR Land1 contains 'Korea' ...
             *
             * 자재코드는 내부 ALPHA 값으로 저장되어 있으므로 숫자 검색어는 내부형식 검색 조건도 같이 넣는다.
             */
            var sValue = String(sSearchValue || "").trim();
            var aFilters = [];
            var sInternalMatnr;

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

        _applySelectedValueHelp: function (oConfig, oSelectedItem) {
            /*
             * Search Help에서 선택한 행을 검색조건 JSONModel에 반영한다.
             *
             * 단일 필드만 채우는 경우:
             * - 플랜트: Werks
             * - 회사코드: Bukrs
             * - PO: Ebeln
             *
             * 코드와 명칭을 같이 채우는 경우:
             * - 공급업체: Lifnr + Name1
             * - 자재: Matnr + Maktx
             */
            var oContext = oSelectedItem && oSelectedItem.getBindingContext(oConfig.model);
            var oData = oContext && oContext.getObject();
            var oViewModel = this.getView().getModel("view");

            if (!oData || !oViewModel) {
                return;
            }

            Object.keys(oConfig.targetFields || {}).forEach(function (sProperty) {
                var vValue = oData[sProperty];
                var sFilterPath = oConfig.targetFields[sProperty];

                if (oConfig.alpha && sProperty === "Matnr") {
                    vValue = this._toExternalMatnr(vValue);
                }

                oViewModel.setProperty(sFilterPath, vValue || "");
                this._clearValidationStateByFilterPath(sFilterPath);
            }.bind(this));
        },

        _formatValueHelpCell: function (oColumnConfig, vValue) {
            // Search Help Dialog 안에서만 사용하는 표시 보정이다.
            if (oColumnConfig.formatter === "matnrExternal") {
                return this._toExternalMatnr(vValue);
            }

            if (oColumnConfig.type === "date") {
                return formatter.formatDate(vValue);
            }

            return vValue || "";
        },

        _toInternalMatnr: function (sValue) {
            /*
             * 자재코드 ALPHA 입력 보정.
             *
             * 프로젝트 자재코드는 내부적으로 10자리 ALPHA 형식(예: 0000100001)으로 저장되어 있다.
             * 사용자는 화면에서 100001처럼 앞의 0을 빼고 입력할 수 있으므로,
             * OData 검색/검증에는 내부형식으로 바꿔서 보내야 한다.
             */
            var sMatnr = String(sValue || "").trim();

            if (!sMatnr) {
                return "";
            }

            if (/^\d+$/.test(sMatnr) && sMatnr.length < 10) {
                return sMatnr.padStart(10, "0");
            }

            return sMatnr;
        },

        _toExternalMatnr: function (sValue) {
            /*
             * 자재코드 ALPHA 출력 보정.
             *
             * CDS OData가 0000100001을 반환하더라도 화면 검색조건에는 사용자가 읽기 쉬운
             * 100001 형태로 보여주는 것이 자연스럽다.
             */
            var sMatnr = String(sValue || "").trim();

            if (!sMatnr) {
                return "";
            }

            return sMatnr.replace(/^0+/, "") || "0";
        },

        _getSearchValidationConfig: function () {
            /*
             * 조회조건 유효성 검증 대상 목록이다.
             *
             * 검증 범위는 사용자가 인터뷰에서 확정한 코드성 필드만 포함한다.
             * 공급업체명(Name1), 자재명(Maktx)은 부분검색용 텍스트이므로 존재 여부 검증을 하지 않는다.
             *
             * 검증 방식:
             * - 화면 입력값이 비어 있으면 전체 조회 조건이므로 검증하지 않는다.
             * - 값이 있으면 해당 Search Help CDS OData에 EQ 조회를 보낸다.
             * - 결과가 0건이면 존재하지 않는 코드로 보고 조회를 중단한다.
             */
            return [
                {
                    inputId: "werksInput",
                    filterPath: "/filters/werks",
                    helpType: "PLANT",
                    property: "Werks",
                    messageKey: "validationWerksNotFound"
                },
                {
                    inputId: "bukrsInput",
                    filterPath: "/filters/bukrs",
                    helpType: "COMPANY",
                    property: "Bukrs",
                    messageKey: "validationBukrsNotFound"
                },
                {
                    inputId: "ebelnInput",
                    filterPath: "/filters/ebeln",
                    helpType: "PO",
                    property: "Ebeln",
                    messageKey: "validationEbelnNotFound"
                },
                {
                    inputId: "lifnrInput",
                    filterPath: "/filters/lifnr",
                    helpType: "VENDOR",
                    property: "Lifnr",
                    messageKey: "validationLifnrNotFound"
                },
                {
                    inputId: "matnrInput",
                    filterPath: "/filters/matnr",
                    helpType: "MATERIAL",
                    property: "Matnr",
                    messageKey: "validationMatnrNotFound",
                    alpha: true
                }
            ];
        },

        _validateSearchConditions: function () {
            /*
             * 조회 버튼 클릭 시점의 1차 유효성 검증이다.
             *
             * 여기서 true를 반환해야만 메인 테이블/KPI/차트 OData 조회가 실행된다.
             * 현재 단계에서는 MessagePopover까지는 만들지 않고,
             * 입력 필드 ValueState와 MessageToast로 오류를 알려준다.
             * MessagePopover 누적 표시는 다음 단계에서 이 결과 구조를 재사용해 확장할 수 있다.
             */
            var aErrors = [];

            this._clearSearchValidationStates();

            aErrors = aErrors.concat(this._validateDateRange());

            return Promise.all(this._getSearchValidationConfig().map(function (oConfig) {
                return this._validateSingleSearchCode(oConfig);
            }.bind(this))).then(function (aCodeErrors) {
                aCodeErrors.forEach(function (oError) {
                    if (oError) {
                        aErrors.push(oError);
                    }
                });

                if (aErrors.length) {
                    this._showSearchValidationErrors(aErrors);
                    return false;
                }

                return true;
            }.bind(this)).catch(function () {
                /*
                 * 검증용 OData 호출 자체가 실패한 경우다.
                 * 이 상태에서 본 조회를 계속 진행하면 잘못된 조건으로 조회될 수 있으므로 중단한다.
                 */
                this._showToast(this._text("validationTechnicalError"));
                return false;
            }.bind(this));
        },

        _validateDateRange: function () {
            // 납기일 From이 To보다 늦으면 업무적으로 말이 안 되는 조회조건이므로 바로 차단한다.
            var oFilterData = this.getView().getModel("view").getProperty("/filters");
            var oFromDate = oFilterData && oFilterData.eindtFrom;
            var oToDate = oFilterData && oFilterData.eindtTo;
            var bHasFrom = oFromDate instanceof Date && !isNaN(oFromDate.getTime());
            var bHasTo = oToDate instanceof Date && !isNaN(oToDate.getTime());

            if (bHasFrom && bHasTo && oFromDate.getTime() > oToDate.getTime()) {
                return [
                    {
                        inputId: "eindtFromPicker",
                        message: this._text("validationEindtRangeInvalid")
                    },
                    {
                        inputId: "eindtToPicker",
                        message: this._text("validationEindtRangeInvalid")
                    }
                ];
            }

            return [];
        },

        _validateSingleSearchCode: function (oValidationConfig) {
            /*
             * 코드성 검색조건 하나의 존재 여부를 Search Help OData로 확인한다.
             * 예: 플랜트 P99999 입력 -> PlantHelp CDS에 Werks eq 'P99999' 조회 -> 0건이면 오류.
             */
            var oViewModel = this.getView().getModel("view");
            var sInputValue = String(oViewModel.getProperty(oValidationConfig.filterPath) || "").trim();
            var oHelpConfig;
            var sFilterValue;

            if (!sInputValue) {
                return Promise.resolve(null);
            }

            oHelpConfig = this._getValueHelpConfig(oValidationConfig.helpType);
            sFilterValue = oValidationConfig.alpha ? this._toInternalMatnr(sInputValue) : sInputValue;

            return this._readNamedEntitySet(
                oHelpConfig.model,
                oHelpConfig.path,
                [new Filter(oValidationConfig.property, FilterOperator.EQ, sFilterValue)]
            ).then(function (aResults) {
                if (aResults.length) {
                    return null;
                }

                return {
                    inputId: oValidationConfig.inputId,
                    message: this._text(oValidationConfig.messageKey)
                };
            }.bind(this));
        },

        _showSearchValidationErrors: function (aErrors) {
            /*
             * 검증 오류를 화면에 반영한다.
             *
             * 1. 해당 Input/DatePicker에 ValueState=Error를 표시한다.
             * 2. 상세조건 안의 필드 오류가 있으면 사용자가 바로 볼 수 있도록 상세조건을 펼친다.
             * 3. MessagePopover 모델에 오류를 누적해 footer 메시지 버튼으로 표시한다.
             */
            var bHasAdvancedFieldError = false;

            (aErrors || []).forEach(function (oError) {
                this._setInputValueState(oError.inputId, "Error", oError.message);

                if ([
                    "bukrsInput",
                    "ebelnInput",
                    "lifnrInput",
                    "matnrInput"
                ].indexOf(oError.inputId) > -1) {
                    bHasAdvancedFieldError = true;
                }
            }.bind(this));

            if (bHasAdvancedFieldError) {
                this.getView().getModel("view").setProperty("/advancedVisible", true);
            }

            this._setValidationMessages(aErrors);
            this._openValidationMessagePopoverDelayed();
        },

        _clearSearchValidationStates: function () {
            // 조회조건 전체의 ValueState를 초기화한다. Reset/재조회/검증 시작 전에 호출한다.
            [
                "baseDatePicker",
                "eindtFromPicker",
                "eindtToPicker",
                "werksInput",
                "bukrsInput",
                "ebelnInput",
                "lifnrInput",
                "matnrInput"
            ].forEach(function (sInputId) {
                this._setInputValueState(sInputId, "None", "");
            }.bind(this));

            this._setValidationMessages([]);
        },

        _clearValidationStateByFilterPath: function (sFilterPath) {
            /*
             * Search Help에서 값을 선택했을 때 해당 필드의 오류 상태만 지운다.
             * 다른 필드에 아직 오류가 있을 수 있으므로 전체 초기화는 하지 않는다.
             */
            var mInputIdByFilterPath = {
                "/filters/werks": "werksInput",
                "/filters/bukrs": "bukrsInput",
                "/filters/ebeln": "ebelnInput",
                "/filters/lifnr": "lifnrInput",
                "/filters/matnr": "matnrInput"
            };
            var sInputId = mInputIdByFilterPath[sFilterPath];

            if (sInputId) {
                this._setInputValueState(sInputId, "None", "");
                this._removeValidationMessageByInputId(sInputId);
            }
        },

        _setInputValueState: function (sInputId, sState, sText) {
            // Input과 DatePicker는 모두 setValueState/setValueStateText를 지원하므로 공통 처리한다.
            var oInput = this.byId(sInputId);

            if (!oInput) {
                return;
            }

            if (typeof oInput.setValueState === "function") {
                oInput.setValueState(sState);
            }

            if (typeof oInput.setValueStateText === "function") {
                oInput.setValueStateText(sText || "");
            }
        },

        _setValidationMessages: function (aErrors) {
            /*
             * 검증 오류 배열을 MessagePopover 표시 모델로 변환한다.
             *
             * MessagePopover는 sap.m.MessageItem 목록을 받는다.
             * 이 앱에서는 각 메시지에 inputId를 같이 보관해 두었다가,
             * 사용자가 메시지를 누르면 해당 검색조건 Input으로 포커스를 이동시킨다.
             */
            var aItems = (aErrors || []).map(function (oError) {
                return {
                    type: "Error",
                    title: oError.message,
                    subtitle: this._getValidationTargetLabel(oError.inputId),
                    description: this._text("validationMessageDescription"),
                    inputId: oError.inputId
                };
            }.bind(this));
            var oMessagesModel = this.getView().getModel("messages");

            if (!oMessagesModel) {
                return;
            }

            oMessagesModel.setData({
                items: aItems,
                count: aItems.length,
                buttonText: aItems.length ? String(aItems.length) : "",
                buttonIcon: aItems.length ? "sap-icon://message-error" : "sap-icon://message-popup",
                buttonType: aItems.length ? "Negative" : "Transparent"
            });
        },

        _removeValidationMessageByInputId: function (sInputId) {
            /*
             * F4 Search Help에서 올바른 값을 선택한 경우,
             * 해당 필드에 남아 있던 오류 메시지만 제거한다.
             */
            var oMessagesModel = this.getView().getModel("messages");
            var aItems;

            if (!oMessagesModel || !sInputId) {
                return;
            }

            aItems = (oMessagesModel.getProperty("/items") || []).filter(function (oItem) {
                return oItem.inputId !== sInputId;
            });

            this._setValidationMessages(aItems.map(function (oItem) {
                return {
                    inputId: oItem.inputId,
                    message: oItem.title
                };
            }));
        },

        _getValidationMessagePopover: function () {
            /*
             * SDK 샘플의 MessagePopover 생성 방식을 이 앱에 맞게 공통화한 함수다.
             * 최초 1회만 생성하고 이후에는 재사용한다.
             */
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

        _openValidationMessagePopoverDelayed: function () {
            /*
             * 검증 실패 직후에는 footer 버튼의 visible 바인딩이 아직 렌더링되기 전일 수 있다.
             * 그래서 한 tick 뒤에 MessagePopover를 열어 버튼 DOM이 준비된 뒤 안정적으로 표시한다.
             */
            setTimeout(function () {
                var oButton = this.byId("messagePopoverBtn");

                if (oButton && oButton.getVisible()) {
                    this._getValidationMessagePopover().openBy(oButton);
                }
            }.bind(this), 0);
        },

        _focusValidationTarget: function (oEvent) {
            /*
             * MessagePopover의 메시지를 클릭하면 해당 조회조건 필드로 이동한다.
             * 상세조건 안의 필드라면 먼저 상세조건 영역을 펼친 뒤 포커스를 준다.
             */
            var oItem = oEvent.getParameter("item")
                || oEvent.getParameter("messageItem")
                || oEvent.getParameter("listItem");
            var oContext = oItem && oItem.getBindingContext("messages");
            var oMessage = oContext && oContext.getObject();
            var sInputId = oMessage && oMessage.inputId;
            var oInput;

            if (!sInputId) {
                return;
            }

            if ([
                "bukrsInput",
                "ebelnInput",
                "lifnrInput",
                "matnrInput"
            ].indexOf(sInputId) > -1) {
                this.getView().getModel("view").setProperty("/advancedVisible", true);
            }

            oInput = this.byId(sInputId);

            if (oInput && typeof oInput.focus === "function") {
                setTimeout(function () {
                    oInput.focus();
                }, 0);
            }
        },

        _getValidationTargetLabel: function (sInputId) {
            // MessagePopover subtitle에 표시할 필드명을 Input ID 기준으로 찾는다.
            var mLabelKeyByInputId = {
                eindtFromPicker: "eindtFrom",
                eindtToPicker: "eindtTo",
                werksInput: "werks",
                bukrsInput: "bukrs",
                ebelnInput: "ebeln",
                lifnrInput: "lifnr",
                matnrInput: "matnr"
            };
            var sLabelKey = mLabelKeyByInputId[sInputId];

            return sLabelKey ? this._text(sLabelKey) : this._text("notAvailable");
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
            // 화면에는 100001처럼 외부형식으로 보여주지만, OData 조회는 내부 ALPHA 형식으로 맞춰 보낸다.
            this._addTextFilter(aFilters, "Matnr", this._toInternalMatnr(oFilterData.matnr));
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

        _capturePageScrollPosition: function () {
            /*
             * 현재 Page의 세로 스크롤 위치를 저장한다.
             *
             * SAPUI5 앱 안에서는 브라우저 window가 아니라 sap.m.Page의 내부 스크롤 컨테이너가
             * 실제 스크롤을 담당하는 경우가 많다. 그래서 Page ScrollDelegate를 우선 사용하고,
             * 혹시 해당 API를 사용할 수 없는 실행 환경에서는 브라우저 window 스크롤 값을 보조로 저장한다.
             */
            var oPage = this.byId("page");
            var oScrollDelegate = oPage && typeof oPage.getScrollDelegate === "function"
                ? oPage.getScrollDelegate()
                : null;

            if (oScrollDelegate && typeof oScrollDelegate.getScrollTop === "function") {
                return {
                    type: "page",
                    top: oScrollDelegate.getScrollTop()
                };
            }

            return {
                type: "window",
                top: window.pageYOffset || document.documentElement.scrollTop || 0
            };
        },

        _restorePageScrollPosition: function (oScrollPosition) {
            /*
             * 조회/초기화 직후 저장해 둔 스크롤 위치로 복원한다.
             *
             * setTimeout을 사용하는 이유:
             * - OData 응답을 JSONModel에 넣으면 Table 행이 다시 렌더링된다.
             * - 렌더링과 포커스 보정이 끝난 다음 tick에 위치를 되돌려야
             *   자동으로 테이블 쪽으로 내려가는 현상을 안정적으로 막을 수 있다.
             */
            var oPage = this.byId("page");
            var iTop = oScrollPosition && typeof oScrollPosition.top === "number" ? oScrollPosition.top : 0;

            setTimeout(function () {
                var oScrollDelegate = oPage && typeof oPage.getScrollDelegate === "function"
                    ? oPage.getScrollDelegate()
                    : null;

                if (oScrollDelegate && typeof oScrollDelegate.scrollTo === "function") {
                    oScrollDelegate.scrollTo(0, iTop, 0);
                    return;
                }

                if (typeof window.scrollTo === "function") {
                    window.scrollTo(0, iTop);
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

        _readNamedEntitySet: function (sModelName, sPath, aFilters) {
            /*
             * Search Help처럼 기본 ODataModel이 아닌 named ODataModel을 읽기 위한 공통 함수다.
             *
             * 기존 _readEntitySet은 ZGWD3MM0007_SRV 전용 기본 모델을 사용한다.
             * 이번 유효성 검증은 plantHelp/materialHelp 같은 별도 CDS Publish OData를 사용하므로
             * 모델명을 받아서 동일한 Promise 방식으로 read한다.
             */
            var oModel = this.getOwnerComponent().getModel(sModelName);

            return new Promise(function (resolve, reject) {
                if (!oModel) {
                    reject(new Error("Named OData model is not available: " + sModelName));
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

            this._iStatusChartTotalCount = iTotalCount;

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
                var sLabelText = this._formatStatusChartCountPercent(iCount, iTotalCount);
                var sSummaryText = sStatusText + " " + sLabelText;

                return {
                    StatusCode: oStatus.code,
                    StatusText: sStatusText,
                    Count: iCount,
                    Percent: fPercent,
                    PercentText: sPercentText,
                    LabelText: sLabelText,
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

        _initStatusChartLabelFormatter: function () {
            /*
             * 상태 도넛 차트의 데이터 라벨을 "5건(20.12%)" 형태로 표시하기 위한 초기화다.
             *
             * 기존에는 "건" 단위를 i18n의 countUnit에서 가져와 VizFrame Popover/Tooltip에 표시했다.
             * 그런데 화면 건수 표기를 "(12)" 형태로 바꾸면서 countUnit을 제거하면,
             * 차트 Tooltip이 countUnit 문자열 자체를 표시하는 문제가 생긴다.
             *
             * 그래서 차트 Tooltip/Popover는 사용하지 않고,
             * 도넛 조각 옆 라벨에 건수와 비율을 직접 표시한다.
             */
            var oChart = this.byId("statusDistributionChart");
            var oChartFormatter;

            if (!oChart || this._bStatusChartLabelFormatterInitialized) {
                return;
            }

            oChartFormatter = ChartFormatter.getInstance();
            oChartFormatter.registerCustomFormatter("dpmStatusChartCountPercent", function (vValue) {
                return this._formatStatusChartCountPercent(vValue, this._iStatusChartTotalCount || 0);
            }.bind(this));
            Format.numericFormatter(oChartFormatter);

            this._applyStatusChartProperties(oChart);
            this._bStatusChartLabelFormatterInitialized = true;
        },

        _applyStatusChartProperties: function (oChart) {
            /*
             * 차트 표시 속성은 Controller에서 한 번 더 명시한다.
             * XML에도 기본값이 있지만, custom formatter는 JS에서 등록해야 하므로
             * dataLabel.formatString도 같은 위치에서 맞춰 둔다.
             */
            if (!oChart || typeof oChart.setVizProperties !== "function") {
                return;
            }

            oChart.setVizProperties({
                tooltip: {
                    visible: false
                },
                plotArea: {
                    dataLabel: {
                        visible: true,
                        type: "value",
                        /*
                         * 기본값처럼 라벨 겹침 숨김을 켜 두면 작은 조각의 라벨이 자동으로 빠질 수 있다.
                         * 이 차트는 상태가 최대 5개로 고정되어 있고, 업무상 5개 상태의 건수/비율을 모두 보는 것이 중요하므로
                         * 약간 가까워 보이더라도 모든 라벨을 표시하도록 한다.
                         */
                        hideWhenOverlap: false,
                        formatString: "dpmStatusChartCountPercent"
                    }
                }
            });
        },

        _formatStatusChartCountPercent: function (vCount, iTotalCount) {
            /*
             * 차트 라벨 전용 표시 포맷이다.
             * 예: Count=5, Total=24 -> "5건(20.83%)"
             */
            var iCount = Number(vCount) || 0;
            var iTotal = Number(iTotalCount) || 0;
            var fPercent = iTotal > 0 ? (iCount / iTotal) * 100 : 0;

            return iCount + "건(" + fPercent.toFixed(2) + "%)";
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
