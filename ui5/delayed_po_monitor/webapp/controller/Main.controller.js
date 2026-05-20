sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "sap/ui/core/Fragment",
    "sap/m/MessageToast",
    "code/d3/delayedpomonitor/model/formatter"
], function (Controller, JSONModel, Filter, FilterOperator, Sorter, Fragment, MessageToast, formatter) {
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

            // OData metadata가 준비된 뒤 조회해야 EntitySet/Property 정보가 안정적으로 잡힌다.
            if (oODataModel && oODataModel.metadataLoaded) {
                oODataModel.metadataLoaded().then(function () {
                    this.onSearch();
                }.bind(this)).catch(function () {
                    MessageToast.show(this._text("metadataLoadError"));
                }.bind(this));
            } else {
                this.onSearch();
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
            // 검색조건, KPI, 입고 이력을 초기 상태로 되돌린 뒤 즉시 다시 조회한다.
            this.getView().getModel("view").setData(this._createInitialViewState());
            this.getView().getModel("kpi").setData(this._createEmptyKpi());
            this.getView().getModel("grHistory").setData({
                items: [],
                busy: false
            });
            this.onSearch();
        },

        onToggleAdvanced: function () {
            // 상세조건 영역은 같은 화면 안에서 접었다 펼치는 방식으로 처리한다.
            var oViewModel = this.getView().getModel("view");
            oViewModel.setProperty("/advancedVisible", !oViewModel.getProperty("/advancedVisible"));
        },

        onBaseDateChange: function (oEvent) {
            // DatePicker가 파싱하지 못한 날짜는 조회 전에 사용자에게 알려준다.
            if (!oEvent.getParameter("valid")) {
                MessageToast.show(this._text("invalidDate"));
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
                MessageToast.show(this._text("kpiQuickFilterUnknown"));
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

                MessageToast.show(this._text(oConfig.messageKey));
            }.bind(this));
        },

        onStatusChartSelect: function (oEvent) {
            // 도넛 차트 조각을 클릭하면 해당 상태코드만 메인 테이블 필터로 세팅한다.
            var aSelectedData = oEvent.getParameter("data") || [];
            var oSelectedData = aSelectedData[0] && aSelectedData[0].data;
            var sStatusText = oSelectedData && oSelectedData.Status;
            var sStatusCode = this._getStatusCodeByText(sStatusText);

            if (!sStatusCode) {
                return;
            }

            this.getView().getModel("view").setProperty("/filters/statusCodes", [sStatusCode]);
            this.onSearch();
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
                    statusCodes: ["O", "D", "P", "L"],
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
                tableCount: 0
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
                MessageToast.show(this._getErrorMessage(oError, "mainLoadError"));
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
                MessageToast.show(this._getErrorMessage(oError, "kpiLoadError"));
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
                MessageToast.show(this._getErrorMessage(oError, "historyLoadError"));
            }.bind(this)).finally(function () {
                oHistoryModel.setProperty("/busy", false);
            });
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
            // 차트는 항상 5개 상태를 같은 순서로 보여준다. 데이터가 없어도 Count 0으로 표시한다.
            var aStatusConfig = [
                { code: "O", text: this._text("statusO") },
                { code: "D", text: this._text("statusD") },
                { code: "P", text: this._text("statusP") },
                { code: "L", text: this._text("statusL") },
                { code: "C", text: this._text("statusC") }
            ];
            var aDistribution;

            (aItems || []).forEach(function (oItem) {
                // StatusCode별 건수를 단순 누적한다.
                var sCode = oItem.StatusCode || "";
                mCounts[sCode] = (mCounts[sCode] || 0) + 1;
            });

            aDistribution = aStatusConfig.map(function (oStatus) {
                return {
                    StatusCode: oStatus.code,
                    StatusText: oStatus.text,
                    Count: mCounts[oStatus.code] || 0
                };
            });

            oChartModel.setData({
                statusDistribution: aDistribution,
                totalCount: (aItems || []).length
            });
        },

        _getStatusCodeByText: function (sStatusText) {
            // 차트 이벤트는 표시 텍스트를 넘겨주므로, 다시 상태코드 O/D/P/L/C로 변환한다.
            var mStatusCodeByText = {};

            mStatusCodeByText[this._text("statusO")] = "O";
            mStatusCodeByText[this._text("statusD")] = "D";
            mStatusCodeByText[this._text("statusP")] = "P";
            mStatusCodeByText[this._text("statusL")] = "L";
            mStatusCodeByText[this._text("statusC")] = "C";

            return mStatusCodeByText[sStatusText] || "";
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
                    statusCodes: ["O", "D", "P", "L"],
                    sortKey: "Eindt",
                    sortDescending: false,
                    groupKey: "",
                    groupDescending: false,
                    messageKey: "kpiQuickFilterOpenPoItem"
                },
                DELAYED_ITEM: {
                    // 납기 지연은 미입고 지연(D)과 부분입고 지연(L)을 함께 본다.
                    statusCodes: ["D", "L"],
                    sortKey: "DelayDays",
                    sortDescending: true,
                    groupKey: "",
                    groupDescending: false,
                    messageKey: "kpiQuickFilterDelayedItem"
                },
                NO_RECEIPT_DELAY: {
                    // 입고수량이 0 이하이고 납기가 지난 D 상태만 집중해서 본다.
                    statusCodes: ["D"],
                    sortKey: "DelayDays",
                    sortDescending: true,
                    groupKey: "",
                    groupDescending: false,
                    messageKey: "kpiQuickFilterNoReceiptDelay"
                },
                DELAYED_VENDOR: {
                    // 공급업체 대응 목적이므로 D/L 상태를 공급업체별로 묶어서 보여준다.
                    statusCodes: ["D", "L"],
                    sortKey: "DelayDays",
                    sortDescending: true,
                    groupKey: "Lifnr",
                    groupDescending: false,
                    messageKey: "kpiQuickFilterDelayedVendor"
                }
            };

            return mConfig[sAction];
        },

        _applyTableSorters: function (sSortKey, bSortDescending, sGroupKey, bGroupDescending) {
            /*
             * sap.ui.model.Sorter는 Table/List Binding에 정렬 기준을 전달하는 객체다.
             * 세 번째 파라미터에 function을 넘기면 그룹 헤더 텍스트를 직접 만들 수 있다.
             */
            var oTable = this.byId("delayedPoTable");
            var oBinding = oTable && oTable.getBinding("items");
            var aSorters = [];

            if (!oBinding) {
                return;
            }

            if (sGroupKey) {
                // 그룹은 항상 첫 번째 Sorter로 넣어야 같은 그룹끼리 모여서 표시된다.
                aSorters.push(new Sorter(
                    sGroupKey,
                    bGroupDescending,
                    this._getTableGroup.bind(this, sGroupKey)
                ));
            }

            if (sSortKey && sSortKey !== sGroupKey) {
                // 그룹 필드와 정렬 필드가 다를 때만 두 번째 Sorter를 추가해 중복 정렬을 피한다.
                aSorters.push(new Sorter(sSortKey, bSortDescending));
            }

            oBinding.sort(aSorters);
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

        // _addStatusFilters: function (aFilters, aStatusCodes, bExcludeCompleted) {
        //     var aCodes = Array.isArray(aStatusCodes) ? aStatusCodes.slice() : [];

        //     if (bExcludeCompleted) {
        //         aCodes = aCodes.length ? aCodes.filter(function (sCode) {
        //             return sCode !== "C";
        //         }) : ["O", "D", "P", "L"];
        //     }

        //     if (!aCodes.length) {
        //         return;
        //     }

        //     aFilters.push(new Filter({
        //         filters: aCodes.map(function (sCode) {
        //             return new Filter("StatusCode", FilterOperator.EQ, sCode);
        //         }),
        //         and: false
        //     }));
        // },

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
        }
    });
});
