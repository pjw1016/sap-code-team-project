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
             * delay : DelayListSet 결과를 표시할 지연 대상 목록 데이터
             * rfq : RfqQuotationStatusSet 결과 모델. 현재 화면에서는 조달 문서 목록으로 통합 표시하므로 조회하지 않는다.
             * detail : Mid Column과 Dialog에 표시할 Flow/Item/Document 데이터
             */
            this.getView().setModel(models.createFilterModel(), "filter");
            this.getView().setModel(models.createViewModel(), "view");
            this.getView().setModel(models.createDashboardModel(), "dashboard");
            this.getView().setModel(models.createWeeklyModel(), "weekly");
            this.getView().setModel(models.createDelayListModel(), "delay");
            this.getView().setModel(models.createRfqStatusModel(), "rfq");
            this.getView().setModel(models.createDetailModel(), "detail");

            this._loadInitialData();
        },

        /**
         * 조회 버튼 이벤트.
         *
         * 현재 단계에서는 Begin Column의 핵심 조회 데이터를 Backend와 연결한다.
         * DashboardSummarySet, WeeklySummarySet, DelayListSet은 서로 독립적인 조회이므로 병렬로 조회한다.
         * RFQ/MQ 진행 상태는 조달 문서 목록의 RFQ Header 행으로 통합 표시한다.
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
            var oOwnerComponent = this.getOwnerComponent && this.getOwnerComponent();
            var oODataModel = oOwnerComponent && oOwnerComponent.getModel();

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
         * KPI 요약 카드 클릭 이벤트.
         *
         * KPI 카드는 지연상태 MultiComboBox와 같은 filter>/DelayStatuses 배열을 사용한다.
         * 그래서 카드를 누르면 별도 내부 필터를 만들지 않고, MultiComboBox 선택 배열에 상태 코드를
         * 추가/제거한 뒤 같은 조회 로직을 다시 실행한다.
         *
         * @param {sap.ui.base.Event} oEvent GenericTile press 이벤트
         * @returns {Promise|null} 재조회 Promise. 상태 코드를 찾지 못하면 null
         */
        onKpiDelayStatusPress(oEvent) {
            var oSource = oEvent && oEvent.getSource && oEvent.getSource();
            var sDelayStatus = oSource && oSource.data && oSource.data("delayStatus");

            if (!sDelayStatus) {
                MessageToast.show("알 수 없는 KPI 필터입니다.");
                return Promise.resolve(null);
            }

            this._selectSingleDelayStatus(sDelayStatus);
            return this._loadBeginSummary();
        },

        /**
         * KPI 카드에서 선택한 지연상태 하나만 조회조건으로 설정한다.
         *
         * MultiComboBox selectedKeys가 같은 배열에 바인딩되어 있으므로,
         * 이 함수에서 filter>/DelayStatuses를 `[선택 상태]`로 교체하면
         * 화면 콤보박스도 클릭한 KPI 상태 하나만 선택된 형태로 즉시 바뀐다.
         *
         * @param {string} sDelayStatus 선택할 DelayStatus 코드
         * @returns {string[]} 변경 후 선택된 DelayStatus 배열
         */
        _selectSingleDelayStatus(sDelayStatus) {
            var oFilterModel = this.getView().getModel("filter");
            var aNextStatuses = [sDelayStatus];

            oFilterModel.setProperty("/DelayStatuses", aNextStatuses);
            return aNextStatuses;
        },

        /**
         * 조달 문서 목록 정렬/그룹 설정 버튼 이벤트.
         *
         * 이번 단계에서는 견적 비교 프로그램과 동일한 위치/아이콘의 Toolbar 버튼만 먼저 배치한다.
         * 실제 sap.m.ViewSettingsDialog 연결은 이후 단계에서 DelayListSet 컬럼 기준이 확정되면 구현한다.
         */
        onOpenDelayTableSettings() {
            MessageToast.show("정렬/그룹 설정은 다음 단계에서 연결합니다.");
        },

        /**
         * 조달 문서 목록 정렬/그룹 초기화 버튼 이벤트.
         *
         * 아직 정렬/그룹 Sorter를 적용하지 않으므로 사용자에게 현재 상태를 알려준다.
         */
        onResetDelayTableSettings() {
            MessageToast.show("정렬/그룹 조건이 아직 적용되지 않았습니다.");
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
                this._readWeeklySummary(),
                this._readDelayList()
            ]).then(function (aResults) {
                /*
                 * KPI 카드는 조달 문서 목록의 상태 필터 역할을 한다.
                 * 따라서 Backend DashboardSummarySet 집계값이 아니라, 실제 목록에 내려온
                 * DelayListSet Header 대표 상태 기준으로 다시 계산해야 카드 합계와 목록 건수가 맞는다.
                 */
                this._updateDashboardCountsFromDelayRows(aResults[2]);
                MessageToast.show("모니터링 데이터를 조회했습니다.");
            }.bind(this)).catch(function (oError) {
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
         * DelayListSet을 조회해 delay JSONModel에 반영한다.
         *
         * DelayListSet은 Header 기준 목록이므로 같은 DocType/DocNo가 한 행으로 내려온다.
         * 화면에서는 rows 배열을 sap.m.Table에 바인딩하고, count로 패널 제목 건수를 표시한다.
         *
         * @returns {Promise<object[]>} DelayListSet 결과 배열
         */
        _readDelayList() {
            var aDelayStatuses = this._getSelectedDelayStatuses();
            var oReadPromise;

            /*
             * Gateway DPC_EXT 구현에 따라 같은 Property(DelayStatus)의 OR 조건을
             * 첫 번째 값만 처리하는 경우가 있다.
             *
             * 사용자는 MultiComboBox에서 여러 상태를 선택하지만, Backend에는 상태별 단건 조건으로
             * 나누어 조회하면 기존 단건 필터 로직을 그대로 활용할 수 있고 결과 누락도 막을 수 있다.
             */
            if (aDelayStatuses.length > 1) {
                oReadPromise = Promise.all(aDelayStatuses.map(function (sDelayStatus) {
                    return this._readEntitySet("/DelayListSet", this._buildDelayListFilters([sDelayStatus]));
                }.bind(this))).then(this._mergeDelayListRows.bind(this));
            } else {
                oReadPromise = this._readEntitySet("/DelayListSet", this._buildDelayListFilters());
            }

            return oReadPromise.then(function (aRows) {
                var oDelayModel = this.getView().getModel("delay");
                var aDelayRows = Array.isArray(aRows) ? aRows : [];

                oDelayModel.setData({
                    rows: aDelayRows,
                    count: aDelayRows.length
                });

                return aDelayRows;
            }.bind(this));
        },

        /**
         * 현재 조회조건 모델에서 선택된 지연상태 코드를 읽는다.
         *
         * MultiComboBox selectedKeys는 배열이지만, 테스트나 예외 상황에서 값이 없을 수 있으므로
         * 항상 배열로 정규화해서 반환한다.
         *
         * @returns {string[]} 선택된 DelayStatus 코드 배열
         */
        _getSelectedDelayStatuses() {
            var oFilterModel = this.getView().getModel("filter");
            var oFilterData = oFilterModel && typeof oFilterModel.getData === "function" ? oFilterModel.getData() : {};

            return Array.isArray(oFilterData.DelayStatuses) ? oFilterData.DelayStatuses.filter(Boolean) : [];
        },

        /**
         * 상태별로 나누어 조회한 DelayListSet 결과를 하나의 배열로 합친다.
         *
         * 같은 문서가 중복 반환될 가능성에 대비해 DocType + DocNo + DelayStatus 기준으로 한 번만 남긴다.
         * 조달 문서 목록은 Header 목록이므로 이 조합이면 사용자가 보는 대표 행의 중복을 막을 수 있다.
         *
         * @param {object[][]} aRowGroups 상태별 DelayListSet 조회 결과 배열
         * @returns {object[]} 중복 제거 후 합쳐진 DelayListSet 행 배열
         */
        _mergeDelayListRows(aRowGroups) {
            var mSeen = {};
            var aMergedRows = [];

            (Array.isArray(aRowGroups) ? aRowGroups : []).forEach(function (aRows) {
                (Array.isArray(aRows) ? aRows : []).forEach(function (oRow) {
                    var sKey = [
                        oRow.DocType || "",
                        oRow.DocNo || "",
                        oRow.DelayStatus || ""
                    ].join("|");

                    if (!mSeen[sKey]) {
                        mSeen[sKey] = true;
                        aMergedRows.push(oRow);
                    }
                });
            });

            return aMergedRows;
        },

        /**
         * DelayListSet 결과를 기준으로 KPI 카드 수량을 다시 계산한다.
         *
         * 조달 문서 목록은 Header 대표 상태 기준으로 한 문서가 한 행으로 내려온다.
         * KPI 카드가 목록 필터 역할을 하려면 DashboardSummarySet의 별도 집계값보다
         * 이 rows 배열에서 직접 계산한 값이 사용자 기대와 더 잘 맞는다.
         *
         * @param {object[]} aRows DelayListSet Header 목록
         */
        _updateDashboardCountsFromDelayRows(aRows) {
            var oDashboardModel = this.getView().getModel("dashboard");
            var oBaseData = Object.assign(models.createDashboardModel().getData(), oDashboardModel.getData());
            var aDelayRows = Array.isArray(aRows) ? aRows : [];

            function toInteger(vValue) {
                var iValue = Number(vValue);

                if (vValue === null || vValue === undefined || vValue === "" || isNaN(iValue)) {
                    return 0;
                }

                return Math.trunc(iValue);
            }

            function addCount(sHeaderField, sItemField, oRow, bUseTotalItemCount) {
                oBaseData[sHeaderField] = toInteger(oBaseData[sHeaderField]) + 1;
                oBaseData[sItemField] = toInteger(oBaseData[sItemField])
                    + toInteger(bUseTotalItemCount ? oRow.TotalItemCount : oRow.DelayedItemCount);
            }

            oBaseData.PrDlyHdrCnt = 0;
            oBaseData.PrDlyItmCnt = 0;
            oBaseData.RfqNoqHdrCnt = 0;
            oBaseData.RfqNoqItmCnt = 0;
            oBaseData.MqSelDlyHdrCnt = 0;
            oBaseData.MqSelDlyItmCnt = 0;
            oBaseData.PoDlvDlyHdrCnt = 0;
            oBaseData.PoDlvDlyItmCnt = 0;
            oBaseData.IvIncHdrCnt = 0;
            oBaseData.IvIncItmCnt = 0;
            oBaseData.NormalHdrCnt = 0;
            oBaseData.NormalItmCnt = 0;

            aDelayRows.forEach(function (oRow) {
                switch (oRow.DelayStatus) {
                    case "RFQ_NO_QUOTATION":
                        addCount("RfqNoqHdrCnt", "RfqNoqItmCnt", oRow, false);
                        break;
                    case "MQ_SELECTION_DELAY":
                        addCount("MqSelDlyHdrCnt", "MqSelDlyItmCnt", oRow, false);
                        break;
                    case "PO_DELIVERY_DELAY":
                        addCount("PoDlvDlyHdrCnt", "PoDlvDlyItmCnt", oRow, false);
                        break;
                    case "IV_INCOMPLETE":
                        addCount("IvIncHdrCnt", "IvIncItmCnt", oRow, false);
                        break;
                    case "PR_DELAY":
                        addCount("PrDlyHdrCnt", "PrDlyItmCnt", oRow, false);
                        break;
                    case "NORMAL":
                        addCount("NormalHdrCnt", "NormalItmCnt", oRow, true);
                        break;
                    default:
                        break;
                }
            });

            oDashboardModel.setData(oBaseData);
        },

        /**
         * RfqQuotationStatusSet을 조회해 rfq JSONModel에 반영한다.
         *
         * 이 EntitySet은 Backend metadata상 KeyDate가 없으므로 기준일 필터를 전달하지 않는다.
         * 화면에서는 RFQ별 견적 접수상태, 채택상태, 품목 진행도를 가볍게 보여준다.
         *
         * @returns {Promise<object[]>} RfqQuotationStatusSet 결과 배열
         */
        _readRfqStatus() {
            return this._readEntitySet("/RfqQuotationStatusSet", this._buildRfqStatusFilters()).then(function (aRows) {
                var oRfqModel = this.getView().getModel("rfq");
                var aRfqRows = Array.isArray(aRows) ? aRows : [];

                oRfqModel.setData({
                    rows: aRfqRows,
                    count: aRfqRows.length
                });

                return aRfqRows;
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
         * DelayListSet에 안전하게 보낼 수 있는 OData Filter를 만든다.
         *
         * 지연 상태 MultiComboBox는 filter>/DelayStatuses 배열에 선택된 상태 코드를 보관한다.
         * 여러 상태가 선택되면 Gateway에는 다음과 같은 OR 조건으로 전달한다.
         * 예: (DelayStatus eq 'PO_DELIVERY_DELAY' or DelayStatus eq 'IV_INCOMPLETE')
         *
         * @returns {sap.ui.model.Filter[]} DelayListSet 조회용 Filter 배열
         */
        _buildDelayListFilters(aDelayStatuses) {
            var oView = this.getView();
            var oFilterData = oView.getModel("filter").getData();
            var sPoNo = this._normalizeSearchText(oFilterData.PoNo);
            var aFilters = [];

            if (oFilterData.KeyDate) {
                aFilters.push(new Filter("KeyDate", FilterOperator.EQ, this._normalizeDate(oFilterData.KeyDate)));
            }

            /*
             * DelayListSet의 Key는 DocType + DocNo이다.
             * 화면 조회조건 이름은 사용자가 이해하기 쉬운 PoNo이지만,
             * Backend에는 PoNo Property가 없으므로 PO번호 입력 시
             * DocType='PO'와 DocNo='<입력 PO번호>' 조합으로 변환해서 전달한다.
             */
            if (sPoNo) {
                aFilters.push(new Filter("DocType", FilterOperator.EQ, "PO"));
                aFilters.push(new Filter("DocNo", FilterOperator.EQ, sPoNo));
            }

            this._addDelayStatusFilters(aFilters, Array.isArray(aDelayStatuses) ? aDelayStatuses : oFilterData.DelayStatuses);

            return aFilters;
        },

        /**
         * 지연상태 MultiComboBox 선택값을 DelayListSet용 OR Filter로 변환한다.
         *
         * selectedKeys 바인딩값은 배열이므로, 선택 상태가 2개 이상이면 하나의 복합 Filter로 묶는다.
         * 이렇게 해야 OData V2 요청에서 `A 또는 B 또는 C` 조건으로 해석된다.
         *
         * @param {sap.ui.model.Filter[]} aFilters 누적 Filter 배열
         * @param {string[]} aDelayStatuses MultiComboBox에서 선택된 DelayStatus 코드 배열
         */
        _addDelayStatusFilters(aFilters, aDelayStatuses) {
            var aStatusKeys = Array.isArray(aDelayStatuses) ? aDelayStatuses.filter(Boolean) : [];

            if (!aStatusKeys.length) {
                return;
            }

            if (aStatusKeys.length === 1) {
                aFilters.push(new Filter("DelayStatus", FilterOperator.EQ, aStatusKeys[0]));
                return;
            }

            aFilters.push(new Filter({
                filters: aStatusKeys.map(function (sStatus) {
                    return new Filter("DelayStatus", FilterOperator.EQ, sStatus);
                }),
                and: false
            }));
        },

        /**
         * RfqQuotationStatusSet 조회용 Filter를 만든다.
         *
         * V1.2.1 결정사항:
         * - RfqQuotationStatusSet에는 KeyDate Property가 없다.
         * - 따라서 기준일 필터를 넣지 않는다.
         * - 현재 화면에는 RFQ번호 직접 조회조건도 없으므로 빈 배열을 반환한다.
         *
         * @returns {sap.ui.model.Filter[]} RFQ/MQ 현황 조회용 Filter 배열
         */
        _buildRfqStatusFilters() {
            return [];
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
         * 조회조건 문자열을 OData 필터에 넣기 전에 정규화한다.
         *
         * Input Control은 사용자가 앞뒤 공백을 넣거나 소문자로 입력할 수 있다.
         * 문서번호/코드 계열 조건은 Backend의 고정 길이 코드와 비교되므로,
         * Controller에서 trim + 대문자 변환을 한 번 수행해 필터 누락 가능성을 줄인다.
         *
         * @param {string|number|null|undefined} vValue 조회조건 입력값
         * @returns {string} 공백 제거 및 대문자 변환된 검색어. 값이 없으면 빈 문자열
         */
        _normalizeSearchText(vValue) {
            return String(vValue || "").trim().toUpperCase();
        },

        /**
         * 요약 조회 실패 시 화면 값을 기본 상태로 되돌린다.
         */
        _resetSummaryModels() {
            var oView = this.getView();

            oView.setModel(models.createDashboardModel(), "dashboard");
            oView.setModel(models.createWeeklyModel(), "weekly");
            oView.setModel(models.createDelayListModel(), "delay");
            oView.setModel(models.createRfqStatusModel(), "rfq");
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
