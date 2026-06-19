/*global Promise*/

sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "sap/ui/core/Fragment",
    "code/d3/purchaseprocessmonitor/model/formatter",
    "code/d3/purchaseprocessmonitor/model/models"
], (Controller, MessageToast, MessageBox, Filter, FilterOperator, Sorter, Fragment, formatter, models) => {
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
            this._updateDelayTableStateSummary();
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

            this._updateDelayTableStateSummary();
        },

        /**
         * KPI 필터 해제 버튼 이벤트.
         *
         * KPI 카드 클릭 또는 지연 상태 ComboBox 변경으로 좁혀진 상태 필터를
         * 화면의 기본 지연/미처리 상태 5개로 되돌린 뒤 같은 조회조건으로 Begin 영역을 다시 조회한다.
         *
         * 기본값은 "정상"을 제외한 PR/RFQ/MQ/PO/IV 지연 상태 전체이며,
         * filter>/DelayStatuses를 직접 갱신하면 MultiComboBox 선택값도 함께 복원된다.
         *
         * @returns {Promise} Begin Column 재조회 Promise
         */
        onClearKpiFilter() {
            var oView = this.getView();
            var oFilterModel = oView.getModel("filter");
            var oViewModel = oView.getModel("view");

            if (oFilterModel) {
                oFilterModel.setProperty("/DelayStatuses", this._getDefaultDelayStatuses());
            }

            if (oViewModel) {
                oViewModel.setProperty("/selectedDelayStatus", "");
            }

            this._updateDelayTableStateSummary();
            MessageToast.show("KPI 필터를 기본 지연 상태로 되돌렸습니다.");
            return this._loadBeginSummary();
        },

        /**
         * 화면 진입 시 사용하는 기본 지연 상태 배열을 반환한다.
         *
         * models.createFilterModel()의 기본값을 복사해서 사용하면
         * 초기 조회, 전체 초기화, KPI 필터 해제의 기준이 한 곳으로 유지된다.
         * 배열은 참조 공유를 피하기 위해 slice()로 복사한다.
         *
         * @returns {string[]} 정상(NORMAL)을 제외한 기본 지연/미처리 상태 코드 배열
         */
        _getDefaultDelayStatuses() {
            var oDefaultFilterData = models.createFilterModel().getData();

            return Array.isArray(oDefaultFilterData.DelayStatuses) ? oDefaultFilterData.DelayStatuses.slice() : [];
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
            this._updateDelayTableStateSummary();
            return this._loadBeginSummary();
        },

        /**
         * 지연 상태 MultiComboBox 선택 완료 이벤트.
         *
         * 사용자가 직접 ComboBox에서 상태를 바꾸는 경우에는 아직 조회 버튼을 누르기 전이라도
         * 목록 Header의 "상태: ..." 문구를 즉시 갱신한다.
         */
        onDelayStatusSelectionFinish() {
            this._updateDelayTableStateSummary();
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
            var oView = this.getView();

            if (!this._pDelayTableSettingsDialog) {
                this._pDelayTableSettingsDialog = Fragment.load({
                    id: oView.getId(),
                    name: "code.d3.purchaseprocessmonitor.fragment.DelayTableSettings",
                    controller: this
                }).then(function (oDialog) {
                    if (oView.addDependent) {
                        oView.addDependent(oDialog);
                    }

                    return oDialog;
                });
            }

            return this._pDelayTableSettingsDialog.then(function (oDialog) {
                oDialog.open();
                return oDialog;
            });
        },

        /**
         * 조달 문서 목록 정렬/그룹 초기화 버튼 이벤트.
         *
         * 아직 정렬/그룹 Sorter를 적용하지 않으므로 사용자에게 현재 상태를 알려준다.
         */
        onResetDelayTableSettings() {
            this._resetDelayTableSettings();
            MessageToast.show("정렬/그룹 조건을 초기화했습니다.");
        },

        /**
         * ViewSettingsDialog의 선택값을 sap.m.Table Binding Sorter로 변환한다.
         *
         * @param {sap.ui.base.Event} oEvent ViewSettingsDialog confirm 이벤트
         */
        onDelayTableSettingsConfirm(oEvent) {
            var oSortItem = oEvent.getParameter("sortItem");
            var oGroupItem = oEvent.getParameter("groupItem");
            var sSortKey = oSortItem && oSortItem.getKey();
            var sGroupKey = oGroupItem && oGroupItem.getKey();
            var bSortDescending = oEvent.getParameter("sortDescending");
            var bGroupDescending = oEvent.getParameter("groupDescending");

            this._applyDelayTableSorters(sSortKey, bSortDescending, sGroupKey, bGroupDescending);
        },

        /**
         * Mid Column을 전체화면으로 확장한다.
         *
         * FlexibleColumnLayout은 문자열 layout 값으로 컬럼 표시 방식을 제어한다.
         * `MidColumnFullScreen`은 Begin Column을 숨기고 Mid Column을 넓게 보여주는 표준 레이아웃이다.
         * 이후 ProcessFlow/품목 Table이 들어오면 사용자가 좁은 화면에서도 상세 정보를 확인할 때 사용한다.
         */
        onEnterMidFullScreen() {
            this._setFclLayout("MidColumnFullScreen");
        },

        /**
         * Mid Column 전체화면을 해제하고 Begin + Mid 2컬럼 화면으로 돌아간다.
         *
         * 이 앱의 기본 상세 흐름은 왼쪽 조달 문서 목록과 오른쪽 PO 상세를 함께 보는 구조다.
         * 따라서 전체화면 해제 시에는 PO 선택 직후와 같은 `TwoColumnsMidExpanded`로 복귀한다.
         */
        onExitMidFullScreen() {
            this._setFclLayout("TwoColumnsMidExpanded");
        },

        /**
         * Mid Column을 닫고 선택 PO 컨텍스트를 초기화한다.
         *
         * 닫기 버튼은 단순히 오른쪽 컬럼만 숨기는 동작이 아니라,
         * 사용자가 현재 선택 PO 상세 확인을 종료했다는 의미다.
         * 그래서 선택 문서번호와 Mid 상세 모델을 함께 비워 다음 PO 선택 시 이전 데이터가 남지 않게 한다.
         */
        onCloseMidColumn() {
            var oView = this.getView();
            var oViewModel = oView.getModel("view");
            var oDetailModel = oView.getModel("detail");

            if (oViewModel) {
                oViewModel.setProperty("/layout", "OneColumn");
                oViewModel.setProperty("/selectedDocType", "");
                oViewModel.setProperty("/selectedDocNo", "");
                oViewModel.setProperty("/selectedProcessStage", "");
            }

            if (oDetailModel) {
                oDetailModel.setData(models.createDetailModel().getData());
            }
        },

        /**
         * 조달 문서 목록 행 선택 이벤트.
         *
         * 20단계에서는 PR/RFQ/PO 후속 동작을 바로 실행하지 않고,
         * 사용자가 선택한 기준 문서 정보를 view 모델에 저장하는 것까지만 처리한다.
         * 이렇게 해두면 다음 단계에서 DocType 기준으로 PR 안내, RFQ 강조, PO Mid Column 열기를
         * 같은 선택 상태 위에 안정적으로 붙일 수 있다.
         *
         * @param {sap.ui.base.Event} oEvent ColumnListItem press 이벤트
         */
        onDelayListItemPress(oEvent) {
            var oItem = oEvent && oEvent.getSource && oEvent.getSource();
            var oContext = oItem && oItem.getBindingContext && oItem.getBindingContext("delay");
            var oRow = oContext && oContext.getObject && oContext.getObject();
            var oViewModel = this.getView().getModel("view");
            var sDocType = oRow && oRow.DocType ? oRow.DocType : "";
            var sDocNo = oRow && oRow.DocNo ? oRow.DocNo : "";

            if (!oRow || !oViewModel) {
                MessageToast.show("선택한 조달 문서 정보를 읽을 수 없습니다.");
                return;
            }

            oViewModel.setProperty("/selectedDocType", sDocType);
            oViewModel.setProperty("/selectedDocNo", sDocNo);

            /*
             * V1.2.1 기준 Mid Column 상세 화면은 PO를 기준으로 PR/RFQ/MQ/PO/GR/IV 흐름을 보여준다.
             * PR과 RFQ는 아직 PO가 확정되지 않았거나 PO Flow의 기준 문서가 아니므로
             * ProcessFlowSet/ProcessItemSet을 호출하지 않고 Begin Column에 머무르게 한다.
             */
            if (sDocType === "PR") {
                oViewModel.setProperty("/layout", "OneColumn");
                MessageToast.show("PR 문서는 PO 조달 흐름 상세 대상이 아닙니다. PO 문서를 선택하세요.");
                return;
            }

            if (sDocType === "RFQ") {
                oViewModel.setProperty("/layout", "OneColumn");
                MessageToast.show("RFQ 문서는 PO 조달 흐름 상세 대상이 아닙니다. PO 문서를 선택하세요.");
                return;
            }

            if (sDocType === "PO") {
                // Mid Column 상단 요약에서 목록의 Header 집계값을 재사용할 수 있도록 선택 행 전체를 넘긴다.
                this._openMidColumnForPo(sDocNo, oRow);
                return;
            }

            oViewModel.setProperty("/layout", "OneColumn");
            MessageToast.show("지원하지 않는 문서유형입니다: " + (sDocType || "-"));
        },

        /**
         * 선택한 PO 기준으로 Mid Column을 열고 ProcessFlowSet 데이터를 조회한다.
         *
         * Mid Column은 PO를 기준으로 PR → RFQ → MQ → PO → GR → IV 흐름을 보여준다.
         * 따라서 Backend에는 ContextDocType='PO', ContextDocNo=선택 PO 번호를 전달한다.
         * 이후 단계에서 같은 Context 필터를 ProcessItemSet, ProcessDocumentSet에도 재사용한다.
         *
         * @param {string} sPoNo 선택한 PO 번호
         * @param {object} oSelectedRow Begin Column의 DelayListSet 선택 행
         * @returns {Promise} ProcessFlowSet 조회 Promise
         */
        _openMidColumnForPo(sPoNo, oSelectedRow) {
            var oView = this.getView();
            var oViewModel = oView.getModel("view");
            var oDetailModel = oView.getModel("detail");
            var oPoSummary = {
                DocType: "PO",
                DocNo: sPoNo || "",
                DelayStatusText: oSelectedRow && oSelectedRow.DelayStatusText || "",
                Criticality: oSelectedRow && oSelectedRow.Criticality || "None",
                BaseDate: oSelectedRow && oSelectedRow.BaseDate || null,
                DelayDays: oSelectedRow && oSelectedRow.DelayDays || 0,
                DelayedItemCount: oSelectedRow && oSelectedRow.DelayedItemCount || 0,
                TotalItemCount: oSelectedRow && oSelectedRow.TotalItemCount || 0
            };

            /*
             * Mid Busy는 오른쪽 컬럼만 차단하므로 사용자는 왼쪽 목록을 다시 누를 수 있다.
             * 기존 상세 조회가 끝나기 전에 새 Flow/Item/Document 요청을 만들면 응답 순서에 따라
             * 서로 다른 PO 데이터가 섞일 수 있으므로 진행 중인 Promise를 그대로 반환한다.
             */
            if (this._pMidLoad) {
                return this._pMidLoad;
            }

            if (oViewModel) {
                oViewModel.setProperty("/layout", "TwoColumnsMidExpanded");
                oViewModel.setProperty("/midBusy", true);
                oViewModel.setProperty("/selectedProcessStage", "");
                // 다른 PO를 연 경우 이전 Dialog에서 선택했던 관련 문서 문맥을 제거한다.
                oViewModel.setProperty("/selectedDocumentStage", "");
                oViewModel.setProperty("/selectedDocumentNo", "");
                oViewModel.setProperty("/selectedDocumentYear", "");
                oViewModel.setProperty("/selectedDocumentItemNo", "");
            }

            if (oDetailModel) {
                oDetailModel.setData(models.createDetailModel().getData());
                /*
                 * 상세 OData 조회보다 먼저 선택 PO 요약을 저장한다.
                 * 따라서 ProcessFlowSet/ProcessItemSet 응답을 기다리는 동안에도 사용자는
                 * 어떤 PO를 열었는지와 현재 지연 상태를 즉시 확인할 수 있다.
                 */
                oDetailModel.setProperty("/poSummary", oPoSummary);
            }

            MessageToast.show("PO 조달 흐름 상세를 표시합니다: PO " + sPoNo);

            /*
             * PO 상세 화면은 같은 기준 문서(ContextDocType/ContextDocNo)를 사용해
             * 상단 ProcessFlowSet과 하단 ProcessItemSet을 함께 조회한다.
             */
            this._pMidLoad = Promise.all([
                this._readProcessFlow("PO", sPoNo),
                this._readProcessItems("PO", sPoNo),
                this._readProcessDocuments("PO", sPoNo)
            ]).catch(function (oError) {
                if (oDetailModel) {
                    oDetailModel.setData(models.createDetailModel().getData());
                    // 상세 조회가 실패해도 사용자가 선택한 PO 문맥은 상단 요약에 유지한다.
                    oDetailModel.setProperty("/poSummary", oPoSummary);
                }

                MessageBox.error(
                    this._getODataErrorMessage(oError, "PO 상세 정보를 조회하지 못했습니다."),
                    { title: "조회 오류" }
                );
                throw oError;
            }.bind(this)).finally(function () {
                if (oViewModel) {
                    oViewModel.setProperty("/midBusy", false);
                }

                this._pMidLoad = null;
            }.bind(this));

            return this._pMidLoad;
        },

        /**
         * ProcessFlowSet을 조회해 detail 모델에 저장한다.
         *
         * Backend가 StageOrder를 내려주므로 화면에서는 단계 순서대로 정렬해 표시한다.
         * 이 정렬은 업무 판정이 아니라 표시 순서 보정이므로 Frontend에서 수행해도 안전하다.
         *
         * @param {string} sContextDocType 기준 문서유형. 현재는 PO
         * @param {string} sContextDocNo 기준 문서번호
         * @returns {Promise<object[]>} 조회된 ProcessFlowSet 행 배열
         */
        /**
         * ProcessItemSet을 조회해 detail 모델에 저장한다.
         *
         * Mid Column은 선택 PO 기준의 조달 흐름 상세 화면이므로 품목 테이블도 선택한 PO를
         * ContextDocType/ContextDocNo로 전달해 Backend에서 계산된 품목별 진행 상태를 받는다.
         * PR/RFQ/MQ/GR/IV 단계 클릭 필터는 다음 단계에서 이 전체 품목 배열을 기준으로 적용한다.
         *
         * @param {string} sContextDocType 기준 문서유형. 현재는 PO
         * @param {string} sContextDocNo 기준 문서번호
         * @returns {Promise<object[]>} 조회 후 품목번호 기준으로 정렬된 ProcessItemSet 행 배열
         */
        _readProcessItems(sContextDocType, sContextDocNo) {
            return this._readEntitySet("/ProcessItemSet", this._buildProcessContextFilters(sContextDocType, sContextDocNo))
                .then(function (aRows) {
                    var oDetailModel = this.getView().getModel("detail");
                    var aItemRows = (Array.isArray(aRows) ? aRows : []).slice().sort(function (oLeft, oRight) {
                        /*
                         * SAP 품목번호는 '00010', '10'처럼 문자열로 들어올 수 있다.
                         * 화면에서는 업무 순서가 중요하므로 숫자로 비교하고, 숫자 변환이 불가능한 값은
                         * 문자열 비교로 보정해 예외 데이터에서도 정렬이 깨지지 않게 한다.
                         */
                        var iLeft = Number(oLeft.ItemNo || 0);
                        var iRight = Number(oRight.ItemNo || 0);

                        if (!Number.isNaN(iLeft) && !Number.isNaN(iRight) && iLeft !== iRight) {
                            return iLeft - iRight;
                        }

                        return String(oLeft.ItemNo || "").localeCompare(String(oRight.ItemNo || ""));
                    });

                    if (oDetailModel) {
                        /*
                         * Backend 원본과 화면 표시 배열을 분리한다.
                         * 같은 배열 객체를 두 경로에서 공유하면 이후 필터/정렬 과정에서 원본까지 바뀔 수 있으므로
                         * slice()로 별도 배열을 만들어 단계 버튼을 반복 선택해도 항상 전체 원본에서 다시 계산한다.
                         */
                        oDetailModel.setProperty("/processItemsAll", aItemRows.slice());
                        oDetailModel.setProperty("/processItems", aItemRows.slice());
                        oDetailModel.setProperty("/processItemCount", aItemRows.length);
                    }

                    return aItemRows;
                }.bind(this));
        },

        /**
         * 선택 PO와 연결된 PR/RFQ/MQ/PO/GR/IV 문서 목록을 조회한다.
         *
         * ProcessDocumentSet은 이후 문서 상세 Dialog의 탐색 기준이 된다.
         * 이번 단계에서는 화면을 추가하지 않고, 선택 PO를 열 때 관련 문서를 미리 조회해
         * detail 모델에 보관하는 책임만 수행한다.
         *
         * Backend 결과 순서에 의존하면 호출 시점마다 문서 배열 순서가 달라질 수 있으므로
         * 조달 업무 흐름(PR → RFQ → MQ → PO → GR → IV), 문서번호, 회계연도, 품목번호 순으로 정렬한다.
         * 이 정렬은 상태 판정이 아니라 화면 탐색 순서만 안정화하는 Frontend 표시 로직이다.
         *
         * @param {string} sContextDocType 기준 문서유형. 현재는 PO
         * @param {string} sContextDocNo 기준 문서번호
         * @returns {Promise<object[]>} 정렬된 ProcessDocumentSet 행 배열
         */
        _readProcessDocuments(sContextDocType, sContextDocNo) {
            return this._readEntitySet("/ProcessDocumentSet", this._buildProcessContextFilters(sContextDocType, sContextDocNo))
                .then(function (aRows) {
                    var oDetailModel = this.getView().getModel("detail");
                    var mStageOrder = {
                        PR: 10,
                        RFQ: 20,
                        MQ: 30,
                        PO: 40,
                        GR: 50,
                        IV: 60
                    };
                    var aDocumentRows = (Array.isArray(aRows) ? aRows : []).slice().sort(function (oLeft, oRight) {
                        var sLeftStage = String(oLeft.Stage || "").trim().toUpperCase();
                        var sRightStage = String(oRight.Stage || "").trim().toUpperCase();
                        var iStageDifference = (mStageOrder[sLeftStage] || 999) - (mStageOrder[sRightStage] || 999);
                        var iDocumentDifference;
                        var iYearDifference;
                        var iLeftItem;
                        var iRightItem;

                        if (iStageDifference !== 0) {
                            return iStageDifference;
                        }

                        // 정의되지 않은 단계끼리는 단계 코드까지 비교해 결과 순서를 고정한다.
                        if (sLeftStage !== sRightStage) {
                            return sLeftStage.localeCompare(sRightStage);
                        }

                        iDocumentDifference = String(oLeft.DocNo || "").localeCompare(String(oRight.DocNo || ""));
                        if (iDocumentDifference !== 0) {
                            return iDocumentDifference;
                        }

                        iYearDifference = String(oLeft.DocYear || "").localeCompare(String(oRight.DocYear || ""));
                        if (iYearDifference !== 0) {
                            return iYearDifference;
                        }

                        iLeftItem = Number(oLeft.ItemNo || 0);
                        iRightItem = Number(oRight.ItemNo || 0);
                        if (!Number.isNaN(iLeftItem) && !Number.isNaN(iRightItem) && iLeftItem !== iRightItem) {
                            return iLeftItem - iRightItem;
                        }

                        return String(oLeft.ItemNo || "").localeCompare(String(oRight.ItemNo || ""));
                    });

                    if (oDetailModel) {
                        oDetailModel.setProperty("/processDocuments", aDocumentRows);
                        oDetailModel.setProperty("/processDocumentCount", aDocumentRows.length);
                    }

                    return aDocumentRows;
                }.bind(this));
        },

        /**
         * 문서 상세 Dialog를 최초 한 번만 로드하고 이후에는 같은 인스턴스를 재사용한다.
         *
         * Controller.loadFragment를 사용하면 Fragment의 상대 경로, Controller 이벤트 연결,
         * View 종속성 관리가 UI5 표준 방식으로 처리된다. Dialog 상단에는 이미 조회한
         * ProcessDocumentSet 목록을 표시하고, 행 선택 시 하단에 DocumentDetailSet 결과를 표시한다.
         *
         * @returns {Promise<sap.m.Dialog>} 열린 문서 상세 Dialog
         */
        onOpenDocumentDetailDialog() {
            if (!this._pDocumentDetailDialog) {
                this._pDocumentDetailDialog = this.loadFragment({
                    name: "code.d3.purchaseprocessmonitor.fragment.DocumentDetailDialog"
                }).catch(function (oError) {
                    // 로드 실패 Promise를 보관하면 재시도도 계속 실패하므로 캐시를 비운다.
                    this._pDocumentDetailDialog = null;
                    throw oError;
                }.bind(this));
            }

            return this._pDocumentDetailDialog.then(function (oDialog) {
                oDialog.open();
                return oDialog;
            });
        },

        /**
         * 문서 상세 Dialog 닫기 버튼 이벤트.
         * Dialog 인스턴스는 파괴하지 않고 유지해 다음 열기에서 Fragment를 다시 만들지 않는다.
         *
         * @returns {Promise<sap.m.Dialog|null>} 닫힌 Dialog, 아직 생성되지 않았으면 null
         */
        onCloseDocumentDetailDialog() {
            if (!this._pDocumentDetailDialog) {
                return Promise.resolve(null);
            }

            return this._pDocumentDetailDialog.then(function (oDialog) {
                oDialog.close();
                return oDialog;
            });
        },

        /**
         * 선택한 PO의 지연 산식 설명을 ResponsivePopover로 표시한다.
         *
         * SAPUI5의 ResponsivePopover는 데스크톱/태블릿에서는 전달한 버튼 옆에 Popover로 열리고,
         * 휴대폰에서는 전체 화면 Dialog로 전환된다. Fragment는 최초 클릭 시 한 번만 로드하고
         * 이후에는 같은 인스턴스를 재사용해 불필요한 컨트롤 생성을 막는다.
         *
         * 이 Popover의 목적은 Backend가 반환한 BaseDate와 DelayDays를 설명하는 것이다.
         * 공휴일과 Working Day 계산을 Frontend에서 다시 수행하면 Backend 판정과 달라질 수 있으므로
         * Controller에서는 날짜 차이를 계산하지 않는다.
         *
         * @param {sap.ui.base.Event} oEvent 지연 산식 보기 Button press 이벤트
         * @returns {Promise<sap.m.ResponsivePopover|null>} 열린 Popover. 기준 버튼이 없으면 null
         */
        onOpenDelayFormulaPopover(oEvent) {
            var oSource = oEvent && oEvent.getSource && oEvent.getSource();

            if (!oSource) {
                return Promise.resolve(null);
            }

            if (!this._pDelayFormulaPopover) {
                this._pDelayFormulaPopover = this.loadFragment({
                    name: "code.d3.purchaseprocessmonitor.fragment.DelayFormulaPopover"
                }).catch(function (oError) {
                    // 로드에 실패한 Promise를 보관하면 다음 클릭도 같은 실패를 재사용하므로 캐시를 비운다.
                    this._pDelayFormulaPopover = null;
                    throw oError;
                }.bind(this));
            }

            return this._pDelayFormulaPopover.then(function (oPopover) {
                oPopover.openBy(oSource);
                return oPopover;
            });
        },

        /**
         * 휴대폰 Dialog 모드에서 표시되는 닫기 버튼과 데스크톱 Popover 닫기를 공통 처리한다.
         *
         * @returns {Promise<sap.m.ResponsivePopover|null>} 닫힌 Popover 또는 아직 생성 전이면 null
         */
        onCloseDelayFormulaPopover() {
            if (!this._pDelayFormulaPopover) {
                return Promise.resolve(null);
            }

            return this._pDelayFormulaPopover.then(function (oPopover) {
                oPopover.close();
                return oPopover;
            });
        },

        /**
         * Dialog 상단 관련 문서 행 선택 이벤트.
         *
         * DocumentDetailSet의 Key 필터인 Stage/DocNo/DocYear/ItemNo를 view 모델에 저장하고,
         * 선택한 문서의 상세 필드를 즉시 조회한다. 새 문서를 선택하는 순간에는 이전 문서의
         * 상세 값이 잠깐 남아 보이지 않도록 documentDetails 배열을 먼저 비운다.
         *
         * @param {sap.ui.base.Event} oEvent ProcessDocumentSet Table itemPress 이벤트
         * @returns {Promise<object[]>|undefined} 조회된 DocumentDetailSet 행 목록
         */
        onProcessDocumentPress(oEvent) {
            var oItem = oEvent && oEvent.getParameter && oEvent.getParameter("listItem");
            var oContext = oItem && oItem.getBindingContext && oItem.getBindingContext("detail");
            var oDocument = oContext && oContext.getObject && oContext.getObject();
            var oViewModel = this.getView().getModel("view");
            var oDetailModel = this.getView().getModel("detail");

            if (!oDocument || !oViewModel) {
                MessageToast.show("관련 문서 정보를 읽을 수 없습니다.");
                return Promise.resolve([]);
            }

            oViewModel.setProperty("/selectedDocumentStage", oDocument.Stage || "");
            oViewModel.setProperty("/selectedDocumentNo", oDocument.DocNo || "");
            oViewModel.setProperty("/selectedDocumentYear", oDocument.DocYear || "");
            oViewModel.setProperty("/selectedDocumentItemNo", oDocument.ItemNo || "");

            if (oDetailModel) {
                oDetailModel.setProperty("/documentDetails", []);
            }

            oViewModel.setProperty("/dialogBusy", true);

            return this._readDocumentDetails(
                oDocument.Stage,
                oDocument.DocNo,
                oDocument.DocYear,
                oDocument.ItemNo
            ).catch(function (oError) {
                // UI 이벤트 Promise에서 오류를 다시 throw하면 브라우저에 Unhandled Promise가 남는다.
                // 사용자에게 OData 오류를 안내하고 빈 상세 목록을 유지하는 방식으로 종료한다.
                MessageBox.error(
                    this._getODataErrorMessage(oError, "문서 상세 정보를 조회하지 못했습니다."),
                    { title: "조회 오류" }
                );
                return [];
            }.bind(this)).finally(function () {
                oViewModel.setProperty("/dialogBusy", false);
            });
        },

        /**
         * 선택한 관련 문서의 상세 필드를 DocumentDetailSet에서 조회한다.
         *
         * Stage/DocNo/DocYear/ItemNo 네 값은 Backend Entity Key를 식별하는 필터다.
         * 어떤 필드를 보여줄지는 Backend가 GroupName/FieldName/FieldValue 형태로 결정하므로,
         * Frontend는 업무 필드를 하드코딩하지 않고 DisplayOrder 순서만 보장한다.
         *
         * @param {string} sStage 문서 단계(PR/RFQ/MQ/PO/GR/IV)
         * @param {string} sDocNo 문서번호
         * @param {string} sDocYear 문서연도
         * @param {string} sItemNo 문서품목번호
         * @returns {Promise<object[]>} DisplayOrder 순으로 정렬된 상세 필드 목록
         * @private
         */
        _readDocumentDetails(sStage, sDocNo, sDocYear, sItemNo) {
            var aFilters = [
                new Filter("Stage", FilterOperator.EQ, this._normalizeSearchText(sStage)),
                new Filter("DocNo", FilterOperator.EQ, this._normalizeSearchText(sDocNo)),
                new Filter("DocYear", FilterOperator.EQ, this._normalizeSearchText(sDocYear)),
                new Filter("ItemNo", FilterOperator.EQ, this._normalizeSearchText(sItemNo))
            ];

            return this._readEntitySet("/DocumentDetailSet", aFilters).then(function (aRows) {
                var oDetailModel = this.getView().getModel("detail");
                var aDetailRows = (Array.isArray(aRows) ? aRows : []).slice().sort(function (oLeft, oRight) {
                    return Number(oLeft.DisplayOrder || 0) - Number(oRight.DisplayOrder || 0);
                });

                if (oDetailModel) {
                    oDetailModel.setProperty("/documentDetails", aDetailRows);
                }

                return aDetailRows;
            }.bind(this));
        },

        _readProcessFlow(sContextDocType, sContextDocNo) {
            return this._readEntitySet("/ProcessFlowSet", this._buildProcessContextFilters(sContextDocType, sContextDocNo))
                .then(function (aRows) {
                    var oDetailModel = this.getView().getModel("detail");
                    var aFlowRows = (Array.isArray(aRows) ? aRows : []).slice().sort(function (oLeft, oRight) {
                        return Number(oLeft.StageOrder || 0) - Number(oRight.StageOrder || 0);
                    });
                    var oProcessFlowData = this._toProcessFlowData(aFlowRows);

                    if (oDetailModel) {
                        oDetailModel.setProperty("/processFlow", aFlowRows);
                        oDetailModel.setProperty("/processFlowCount", aFlowRows.length);
                        oDetailModel.setProperty("/processFlowNodes", oProcessFlowData.nodes);
                        oDetailModel.setProperty("/processFlowLanes", oProcessFlowData.lanes);
                    }

                    /*
                     * sap.suite.ui.commons.ProcessFlow는 nodes/lanes 바인딩 변경 후 내부 그래프를 다시 계산해야 한다.
                     * SDK 샘플도 JSONModel 로드 완료 후 updateModel()을 호출한다.
                     * 여기서는 OData 조회 결과를 JSONModel에 직접 넣으므로, 모델 반영 직후 한 번 갱신한다.
                     */
                    if (this.byId && this.byId("poProcessFlow") && this.byId("poProcessFlow").updateModel) {
                        this.byId("poProcessFlow").updateModel();
                    }

                    return aFlowRows;
                }.bind(this));
        },


        /**
         * ProcessFlow 아래 단계 선택 버튼 이벤트.
         *
         * ProcessFlow는 조달 흐름을 시각화하는 용도로만 사용한다.
         * 단계별 품목 Table 필터 기준은 사용자가 명확히 조작할 수 있는 SegmentedButton에서 관리한다.
         *
         * @param {sap.ui.base.Event} oEvent SegmentedButton selectionChange 이벤트
         */
        onProcessStageSelect(oEvent) {
            var oItem = oEvent && oEvent.getParameter && oEvent.getParameter("item");
            var sStage = oItem && oItem.getKey ? oItem.getKey() : "";
            var oViewModel = this.getView().getModel("view");

            if (oViewModel) {
                oViewModel.setProperty("/selectedProcessStage", sStage || "");
            }

            this._applyProcessStageFilter(sStage);
        },

        /**
         * 선택한 조달 단계에 해당하는 품목만 화면용 배열에 반영한다.
         *
         * ProcessItemSet은 PO 상세를 열 때 한 번만 조회한다. 이후 PR/RFQ/MQ/PO/GR/IV 버튼을
         * 전환할 때는 추가 OData 요청 없이 processItemsAll 원본 배열의 CurrentStage를 비교한다.
         * Backend 문자열에 공백이나 소문자가 포함되어도 정상 비교되도록 양쪽 값을 정규화한다.
         * 선택 단계가 비어 있으면 전체 원본을 다시 표시하므로 초기 로딩에도 같은 함수를 사용할 수 있다.
         *
         * @param {string} sStage 사용자가 선택한 단계 키
         * @returns {object[]} 현재 Table에 표시하도록 필터링된 품목 배열
         */
        _applyProcessStageFilter(sStage) {
            var oDetailModel = this.getView().getModel("detail");
            var aAllItems = oDetailModel && oDetailModel.getProperty("/processItemsAll");
            var sNormalizedStage = String(sStage || "").trim().toUpperCase();
            var aFilteredItems = (Array.isArray(aAllItems) ? aAllItems : []).filter(function (oRow) {
                if (!sNormalizedStage) {
                    return true;
                }

                return String(oRow && oRow.CurrentStage || "").trim().toUpperCase() === sNormalizedStage;
            });

            if (oDetailModel) {
                oDetailModel.setProperty("/processItems", aFilteredItems);
                oDetailModel.setProperty("/processItemCount", aFilteredItems.length);
            }

            return aFilteredItems;
        },

        /**
         * Backend ProcessFlowSet 결과를 sap.suite.ui.commons.ProcessFlow 바인딩 구조로 변환한다.
         *
         * ProcessFlow는 업무 EntitySet 원본 필드명을 직접 이해하지 않는다.
         * 그래서 Stage/StageOrder/ChildStage/Criticality 같은 Backend 필드를
         * ProcessFlowNode와 ProcessFlowLaneHeader가 요구하는 id/lane/children/state 구조로 매핑한다.
         *
         * @param {object[]} aFlowRows StageOrder 기준으로 정렬된 ProcessFlowSet 행
         * @returns {{nodes: object[], lanes: object[]}} ProcessFlow 바인딩 데이터
         */
        _toProcessFlowData(aFlowRows) {
            var mExistingStage = {};
            var aRows = Array.isArray(aFlowRows) ? aFlowRows : [];
            var aLanes;
            var aNodes;

            aRows.forEach(function (oRow) {
                if (oRow && oRow.Stage) {
                    mExistingStage[oRow.Stage] = true;
                }
            });

            aLanes = aRows.map(function (oRow, iIndex) {
                var sStage = oRow.Stage || String(iIndex);

                return {
                    id: sStage,
                    icon: this._getProcessStageIcon(sStage),
                    label: oRow.StageText || sStage,
                    /*
                     * ProcessFlowLaneHeader.position은 화면의 Lane 위치이며 0부터 빠짐없이 이어져야 한다.
                     * Backend StageOrder는 정렬용 업무 순서일 뿐이고 10,20,30처럼 간격이 있을 수 있다.
                     * StageOrder를 그대로 position으로 쓰면 중간 Lane이 undefined가 되어
                     * ProcessFlowRenderer에서 getLaneId 오류가 발생한다.
                     */
                    position: iIndex
                };
            }.bind(this));

            aNodes = aRows.map(function (oRow, iIndex) {
                var sStage = oRow.Stage || String(iIndex);
                var sChildStage = oRow.ChildStage && mExistingStage[oRow.ChildStage] ? oRow.ChildStage : "";
                var iDocumentCount = Number(oRow.DocumentCount || 0);
                var iItemCount = Number(oRow.ItemCount || 0);
                var iDelayedItemCount = Number(oRow.DelayedItemCount || 0);

                return {
                    id: sStage,
                    lane: sStage,
                    title: oRow.NodeTitle || oRow.StageText || sStage,
                    titleAbbreviation: oRow.StageText || sStage,
                    children: sChildStage ? [sChildStage] : null,
                    state: this._toProcessFlowNodeState(oRow.Criticality),
                    stateText: oRow.Status || oRow.StageText || "",
                    texts: [
                        "문서 " + iDocumentCount + "건 / 품목 " + iItemCount + "건",
                        "지연 품목 " + iDelayedItemCount + "건"
                    ],
                    highlighted: iDelayedItemCount > 0 || oRow.Criticality === "Negative" || oRow.Criticality === "Critical",
                    focused: false
                };
            }.bind(this));

            return {
                nodes: aNodes,
                lanes: aLanes
            };
        },

        /**
         * Backend Criticality를 ProcessFlowNode.state 값으로 변환한다.
         *
         * sap.m.ObjectStatus와 달리 ProcessFlowNode는 Positive/Negative/Critical/Neutral/Planned 계열 값을 사용한다.
         * Backend의 Information/None은 별도 문제 상태가 아니므로 Neutral로 표시한다.
         *
         * @param {string} sCriticality Backend Criticality
         * @returns {string} sap.suite.ui.commons.ProcessFlowNodeState 문자열
         */
        _toProcessFlowNodeState(sCriticality) {
            switch (sCriticality) {
                case "Positive":
                    return "Positive";
                case "Negative":
                    return "Negative";
                case "Critical":
                    return "Critical";
                default:
                    return "Neutral";
            }
        },

        /**
         * 조달 단계별 ProcessFlow Lane 아이콘을 반환한다.
         *
         * 아이콘은 업무 판정이 아니라 시각적 식별 보조다.
         * Stage 코드가 추가되더라도 기본 문서 아이콘으로 표시해 화면이 깨지지 않게 한다.
         *
         * @param {string} sStage PR/RFQ/MQ/PO/GR/IV 등 단계 코드
         * @returns {string} sap-icon URI
         */
        _getProcessStageIcon(sStage) {
            var mIconByStage = {
                PR: "sap-icon://request",
                RFQ: "sap-icon://request",
                MQ: "sap-icon://target-group",
                PO: "sap-icon://sales-order",
                GR: "sap-icon://shipping-status",
                IV: "sap-icon://expense-report"
            };

            return mIconByStage[sStage] || "sap-icon://document";
        },

        /**
         * PO 상세 EntitySet들이 공통으로 사용하는 Context 필터를 만든다.
         *
         * ProcessFlowSet, ProcessItemSet, ProcessDocumentSet은 모두 선택한 기준 문서를
         * ContextDocType + ContextDocNo 조합으로 받는다.
         *
         * @param {string} sContextDocType 기준 문서유형
         * @param {string} sContextDocNo 기준 문서번호
         * @returns {sap.ui.model.Filter[]} Context 필터 배열
         */
        _buildProcessContextFilters(sContextDocType, sContextDocNo) {
            return [
                new Filter("ContextDocType", FilterOperator.EQ, this._normalizeSearchText(sContextDocType)),
                new Filter("ContextDocNo", FilterOperator.EQ, this._normalizeSearchText(sContextDocNo))
            ];
        },

        /**
         * FCL layout 값을 안전하게 변경한다.
         *
         * 버튼 핸들러마다 view 모델 접근 코드를 반복하지 않기 위한 작은 공통 함수다.
         * 테스트 환경처럼 view 모델이 없을 수 있는 경우에는 조용히 종료한다.
         *
         * @param {string} sLayout sap.f.LayoutType에 해당하는 문자열 레이아웃 값
         */
        _setFclLayout(sLayout) {
            var oViewModel = this.getView().getModel("view");

            if (oViewModel) {
                oViewModel.setProperty("/layout", sLayout);
            }
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

            /*
             * 조회 버튼, KPI 카드, 새로고침은 모두 같은 Begin 조회 함수를 사용한다.
             * 사용자가 응답 전에 다시 눌러도 동일한 OData 요청을 중복 전송하지 않도록
             * 진행 중인 Promise를 보관하고, 완료된 뒤에만 다음 조회를 허용한다.
             */
            if (this._pBeginLoad) {
                return this._pBeginLoad;
            }

            if (oViewModel) {
                oViewModel.setProperty("/busy", true);
            }

            this._pBeginLoad = Promise.all([
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
                MessageBox.error(
                    this._getODataErrorMessage(oError, "모니터링 데이터를 조회하지 못했습니다."),
                    { title: "조회 오류" }
                );
            }.bind(this)).finally(function () {
                if (oViewModel) {
                    oViewModel.setProperty("/busy", false);
                }

                // 완료된 Promise는 제거해 이후 조회조건 변경 후 새 요청을 실행할 수 있게 한다.
                this._pBeginLoad = null;
            }.bind(this));

            return this._pBeginLoad;
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
            return this._readEntitySet("/WeeklySummarySet", this._buildWeeklySummaryFilters()).then(function (aRows) {
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
            var aBackendDelayStatuses = this._toBackendDelayStatuses(aDelayStatuses);
            var oReadPromise;

            /*
             * Gateway DPC_EXT 구현에 따라 같은 Property(DelayStatus)의 OR 조건을
             * 첫 번째 값만 처리하는 경우가 있다.
             *
             * 사용자는 MultiComboBox에서 여러 상태를 선택하지만, Backend에는 상태별 단건 조건으로
             * 나누어 조회하면 기존 단건 필터 로직을 그대로 활용할 수 있고 결과 누락도 막을 수 있다.
             */
            if (aBackendDelayStatuses.length > 1) {
                oReadPromise = Promise.all(aBackendDelayStatuses.map(function (sDelayStatus) {
                    return this._readEntitySet("/DelayListSet", this._buildDelayListFilters([sDelayStatus]));
                }.bind(this))).then(this._mergeDelayListRows.bind(this));
            } else {
                oReadPromise = this._readEntitySet("/DelayListSet", this._buildDelayListFilters(aBackendDelayStatuses));
            }

            return oReadPromise.then(function (aRows) {
                var oDelayModel = this.getView().getModel("delay");
                var aDelayRows = Array.isArray(aRows) ? aRows : [];

                oDelayModel.setData({
                    rows: aDelayRows,
                    count: aDelayRows.length
                });

                this._reapplyDelayTableSorters();
                return aDelayRows;
            }.bind(this));
        },

        /**
         * 조달 문서 목록 Table에 정렬/그룹 Sorter를 적용한다.
         *
         * 견적 비교 앱과 동일하게 그룹 Sorter를 먼저 적용하고,
         * 그룹과 다른 정렬 필드가 선택된 경우 정렬 Sorter를 두 번째로 추가한다.
         *
         * @param {string} sSortKey 정렬 기준 Property
         * @param {boolean} bSortDescending 정렬 내림차순 여부
         * @param {string} sGroupKey 그룹 기준 Property
         * @param {boolean} bGroupDescending 그룹 내림차순 여부
         */
        _applyDelayTableSorters(sSortKey, bSortDescending, sGroupKey, bGroupDescending) {
            var oView = this.getView && this.getView();
            var oTable = oView && typeof oView.byId === "function"
                ? oView.byId("delayListTable")
                : (typeof this.byId === "function" ? this.byId("delayListTable") : null);
            var oBinding = oTable && oTable.getBinding && oTable.getBinding("items");
            var aSorters = [];

            this._setDelayTableSortGroupState(sSortKey, bSortDescending, sGroupKey, bGroupDescending);

            if (sGroupKey) {
                aSorters.push(this._createDelayTableSorter(
                    sGroupKey,
                    bGroupDescending,
                    this._getDelayTableGroup.bind(this, sGroupKey)
                ));
            }

            if (sSortKey && sSortKey !== sGroupKey) {
                aSorters.push(this._createDelayTableSorter(sSortKey, bSortDescending));
            }

            if (oBinding && typeof oBinding.sort === "function") {
                oBinding.sort(aSorters);
            }
        },

        /**
         * 조회 후에도 사용자가 지정한 정렬/그룹 상태가 유지되도록 현재 view 모델 상태를 다시 적용한다.
         */
        _reapplyDelayTableSorters() {
            var oViewModel = this.getView().getModel("view");

            if (!oViewModel) {
                return;
            }

            this._applyDelayTableSorters(
                oViewModel.getProperty("/DelayTableSortKey"),
                oViewModel.getProperty("/DelayTableSortDescending"),
                oViewModel.getProperty("/DelayTableGroupKey"),
                oViewModel.getProperty("/DelayTableGroupDescending")
            );
        },

        /**
         * 조달 문서 목록의 정렬/그룹 상태와 Dialog 선택값을 기본값으로 되돌린다.
         */
        _resetDelayTableSettings() {
            this._applyDelayTableSorters("", false, "", false);
            this._resetDelayTableSettingsDialog();
        },

        /**
         * 이미 생성된 ViewSettingsDialog의 선택 표시를 초기화한다.
         */
        _resetDelayTableSettingsDialog() {
            var oDialog = this.byId("delayTableSettingsDialog");

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

        /**
         * ViewSettingsDialog Item 선택 표시를 해제한다.
         *
         * @param {sap.m.ViewSettingsItem[]} aItems Dialog Item 배열
         */
        _clearViewSettingsItems(aItems) {
            (aItems || []).forEach(function (oItem) {
                if (oItem && typeof oItem.setSelected === "function") {
                    oItem.setSelected(false);
                }
            });
        },

        /**
         * DelayList 필드 특성에 맞는 Sorter를 만든다.
         *
         * 지연일/품목 수처럼 숫자로 비교해야 하는 필드는 별도 comparator를 사용해
         * 문자 정렬에서 "10"이 "2"보다 앞서는 문제를 막는다.
         *
         * @param {string} sKey Sorter Property
         * @param {boolean} bDescending 내림차순 여부
         * @param {function|boolean} vGroup 그룹 함수 또는 그룹 여부
         * @returns {sap.ui.model.Sorter} Table binding에 적용할 Sorter
         */
        _createDelayTableSorter(sKey, bDescending, vGroup) {
            var fnComparator = this._isDelayNumericSortKey(sKey) ? this._compareNumericValues.bind(this) : undefined;

            return new Sorter(sKey, bDescending, vGroup, fnComparator);
        },

        /**
         * 숫자 정렬이 필요한 DelayList Property인지 판별한다.
         *
         * @param {string} sKey Property 이름
         * @returns {boolean} 숫자 comparator 필요 여부
         */
        _isDelayNumericSortKey(sKey) {
            return [
                "DelayDays",
                "DelayedItemCount",
                "TotalItemCount"
            ].indexOf(sKey) > -1;
        },

        /**
         * 숫자형 필드 정렬용 comparator.
         *
         * @param {*} vA 왼쪽 값
         * @param {*} vB 오른쪽 값
         * @returns {int} 비교 결과
         */
        _compareNumericValues(vA, vB) {
            var fA = Number(vA);
            var fB = Number(vB);

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

        /**
         * Table 그룹 헤더에 표시할 key/text를 만든다.
         *
         * @param {string} sProperty 그룹 기준 Property
         * @param {sap.ui.model.Context} oContext Row binding context
         * @returns {{key: string, text: string}} UI5 그룹 헤더 정보
         */
        _getDelayTableGroup(sProperty, oContext) {
            var oRow = oContext && oContext.getObject ? oContext.getObject() : {};
            var sKey = oRow[sProperty] || "";
            var sText = sKey || "N/A";

            if (sProperty === "DocType") {
                sText = this._getDocTypeText(sKey);
            }

            return {
                key: sKey,
                text: this._getDelayTableSettingLabel(sProperty) + ": " + sText
            };
        },

        /**
         * 정렬/그룹 상태를 view 모델에 저장하고 Header 요약 문구를 갱신한다.
         */
        _setDelayTableSortGroupState(sSortKey, bSortDescending, sGroupKey, bGroupDescending) {
            var oViewModel = this.getView().getModel("view");

            if (!oViewModel) {
                return;
            }

            oViewModel.setProperty("/DelayTableSortKey", sSortKey || "");
            oViewModel.setProperty("/DelayTableSortDescending", !!bSortDescending);
            oViewModel.setProperty("/DelayTableGroupKey", sGroupKey || "");
            oViewModel.setProperty("/DelayTableGroupDescending", !!bGroupDescending);

            this._updateDelayTableStateSummary();
        },

        /**
         * 목록 Header에 표시되는 상태 요약과 정렬/그룹 요약을 갱신한다.
         */
        _updateDelayTableStateSummary() {
            var oViewModel = this.getView().getModel("view");

            if (!oViewModel) {
                return;
            }

            oViewModel.setProperty("/DelayTableStatusSummary", this._getDelayTableStatusSummary());
            oViewModel.setProperty("/DelayTableSortGroupSummary", this._getDelayTableSortGroupSummary());
        },

        /**
         * 현재 지연 상태 선택값을 Header 요약 문구로 변환한다.
         *
         * @returns {string} 예: "상태: 전체", "상태: RFQ 미접수 외 1"
         */
        _getDelayTableStatusSummary() {
            var aStatuses = this._getSelectedDelayStatuses();
            var aDefaultStatuses = this._getDefaultDelayStatuses();
            var aLabels;

            if (!aStatuses.length) {
                return "상태: 미선택";
            }

            if (this._hasSameMembers(aStatuses, aDefaultStatuses)
                    || this._hasSameMembers(aStatuses, aDefaultStatuses.concat(["NORMAL"]))) {
                return "상태: 전체";
            }

            aLabels = aStatuses.map(this._getDelayStatusTextByCode.bind(this)).filter(Boolean);

            if (aLabels.length <= 2) {
                return "상태: " + aLabels.join(", ");
            }

            return "상태: " + aLabels[0] + " 외 " + (aLabels.length - 1);
        },

        /**
         * 현재 정렬/그룹 선택값을 Header 요약 문구로 변환한다.
         *
         * @returns {string} 예: "정렬/그룹: 기본", "정렬: 지연일 내림차순 / 그룹: 지연상태 오름차순"
         */
        _getDelayTableSortGroupSummary() {
            var oViewModel = this.getView().getModel("view");
            var aParts = [];
            var sSortKey = oViewModel && oViewModel.getProperty("/DelayTableSortKey");
            var sGroupKey = oViewModel && oViewModel.getProperty("/DelayTableGroupKey");

            if (sSortKey) {
                aParts.push(
                    "정렬: "
                    + this._getDelayTableSettingLabel(sSortKey)
                    + " "
                    + this._getOrderText(oViewModel.getProperty("/DelayTableSortDescending"))
                );
            }

            if (sGroupKey) {
                aParts.push(
                    "그룹: "
                    + this._getDelayTableSettingLabel(sGroupKey)
                    + " "
                    + this._getOrderText(oViewModel.getProperty("/DelayTableGroupDescending"))
                );
            }

            return aParts.length ? aParts.join(" / ") : "정렬/그룹: 기본";
        },

        /**
         * DelayList 정렬/그룹 Property를 사용자가 읽을 수 있는 라벨로 변환한다.
         *
         * @param {string} sKey Property 이름
         * @returns {string} 화면 표시 라벨
         */
        _getDelayTableSettingLabel(sKey) {
            var mLabelByProperty = {
                DelayStatusText: "지연상태",
                DocType: "문서유형",
                DocNo: "문서번호",
                MaterialSummary: "자재요약",
                VendorSummary: "공급업체",
                PlantSummary: "플랜트",
                DelayDays: "지연일",
                DelayedItemCount: "지연품목",
                TotalItemCount: "전체품목"
            };

            return mLabelByProperty[sKey] || sKey;
        },

        /**
         * 정렬 방향 Boolean 값을 한국어 문구로 변환한다.
         *
         * @param {boolean} bDescending 내림차순 여부
         * @returns {string} 오름차순/내림차순
         */
        _getOrderText(bDescending) {
            return bDescending ? "내림차순" : "오름차순";
        },

        /**
         * DelayStatus 코드를 KPI 카드 명칭과 같은 한국어 문구로 변환한다.
         *
         * @param {string} sStatus DelayStatus 코드
         * @returns {string} 상태명
         */
        _getDelayStatusTextByCode(sStatus) {
            var mTextByStatus = {
                PR_DELAY: "PR 처리 지연",
                RFQ_NO_QUOTATION: "RFQ 미접수",
                MQ_SELECTION_DELAY: "MQ 채택 지연",
                PO_DELIVERY_DELAY: "PO 납기 지연",
                IV_INCOMPLETE: "입고 후 미송장",
                NORMAL: "정상",
                DELAY: "지연/미처리 전체",
                ALL: "전체"
            };

            return mTextByStatus[sStatus] || sStatus;
        },

        /**
         * 문서유형 코드를 그룹 헤더용 문구로 변환한다.
         *
         * @param {string} sDocType 문서유형 코드
         * @returns {string} 문서유형 문구
         */
        _getDocTypeText(sDocType) {
            var mTextByDocType = {
                PR: "PR",
                RFQ: "RFQ",
                PO: "PO"
            };

            return mTextByDocType[sDocType] || sDocType || "N/A";
        },

        /**
         * 두 배열이 순서와 무관하게 같은 값을 가지고 있는지 확인한다.
         *
         * @param {string[]} aLeft 첫 번째 배열
         * @param {string[]} aRight 두 번째 배열
         * @returns {boolean} 동일 멤버 여부
         */
        _hasSameMembers(aLeft, aRight) {
            var aNormalizedLeft = (Array.isArray(aLeft) ? aLeft : []).slice().sort();
            var aNormalizedRight = (Array.isArray(aRight) ? aRight : []).slice().sort();

            return aNormalizedLeft.length === aNormalizedRight.length
                && aNormalizedLeft.every(function (sValue, iIndex) {
                    return sValue === aNormalizedRight[iIndex];
                });
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
         * 화면 MultiComboBox의 세부 선택값을 Backend가 지원하는 DelayStatus 정책으로 변환한다.
         *
         * 화면에는 사용자가 이해하기 쉬운 PR/RFQ/MQ/PO/IV/NORMAL 개별 상태를 보여주고,
         * OData 요청 직전에만 Backend 대표 코드로 압축한다.
         * 이렇게 하면 UI 선택 상태는 그대로 유지하면서도 전체 지연 조회는 한 번만 호출할 수 있다.
         *
         * 변환 규칙:
         * - 지연/미처리 5개 전체 선택: DELAY
         * - 지연/미처리 5개 + 정상 선택: ALL
         * - 정상만 선택: NORMAL
         * - 일부 상태 다중 선택: 기존처럼 상태별 개별 조회 후 병합
         *
         * @param {string[]} aDelayStatuses 화면에서 선택된 DelayStatus 코드 배열
         * @returns {string[]} Backend에 실제로 전달할 DelayStatus 코드 배열
         */
        _toBackendDelayStatuses(aDelayStatuses) {
            var aDelayOnlyStatuses = [
                "PR_DELAY",
                "RFQ_NO_QUOTATION",
                "MQ_SELECTION_DELAY",
                "PO_DELIVERY_DELAY",
                "IV_INCOMPLETE"
            ];
            var mSeen = {};
            var aStatusKeys = (Array.isArray(aDelayStatuses) ? aDelayStatuses : []).filter(function (sStatus) {
                if (!sStatus || mSeen[sStatus]) {
                    return false;
                }

                mSeen[sStatus] = true;
                return true;
            });
            var bHasNormal = aStatusKeys.indexOf("NORMAL") > -1;
            var bHasAllDelayStatuses = aDelayOnlyStatuses.every(function (sDelayStatus) {
                return aStatusKeys.indexOf(sDelayStatus) > -1;
            });

            if (!aStatusKeys.length) {
                return [];
            }

            if (bHasAllDelayStatuses && bHasNormal && aStatusKeys.length === aDelayOnlyStatuses.length + 1) {
                return ["ALL"];
            }

            if (bHasAllDelayStatuses && !bHasNormal && aStatusKeys.length === aDelayOnlyStatuses.length) {
                return ["DELAY"];
            }

            if (bHasNormal && aStatusKeys.length === 1) {
                return ["NORMAL"];
            }

            return aStatusKeys;
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
         * DashboardSummarySet에 안전하게 보낼 수 있는 OData Filter를 만든다.
         *
         * Backend 최신 metadata 기준 DashboardSummarySet은 KeyDate와 LookbackMonths를 필터로 받는다.
         * PR/RFQ/PO번호, 자재, 공급업체, 플랜트 조건은 조달 문서 목록용 조건이므로
         * DashboardSummarySet에는 보내지 않는다.
         *
         * @returns {sap.ui.model.Filter[]} DashboardSummarySet 조회용 Filter 배열
         */
        _buildSummaryFilters() {
            var oFilterData = this.getView().getModel("filter").getData();
            var iLookbackMonths = Number(oFilterData.LookbackMonths);
            var aFilters = [];

            if (oFilterData.KeyDate) {
                aFilters.push(new Filter("KeyDate", FilterOperator.EQ, this._normalizeDate(oFilterData.KeyDate)));
            }

            /*
             * UI의 SegmentedButton은 "3", "6" 같은 문자열을 보관한다.
             * OData metadata의 LookbackMonths는 Edm.Int32이므로 숫자로 변환해 전송한다.
             * 값이 비어 있거나 숫자가 아니면 Backend의 기본값 3개월 보정 로직에 맡긴다.
             */
            if (Number.isFinite(iLookbackMonths) && iLookbackMonths > 0) {
                aFilters.push(new Filter("LookbackMonths", FilterOperator.EQ, iLookbackMonths));
            }

            return aFilters;
        },

        /**
         * WeeklySummarySet 조회용 Filter를 만든다.
         *
         * 주간 요약은 기준일이 속한 "한 주"의 구매/입고/송장 금액과 건수를 보여준다.
         * 최근 3개월/6개월 조회기간과는 의미가 다르므로 Backend 계약에 맞춰 KeyDate만 전송한다.
         *
         * @returns {sap.ui.model.Filter[]} WeeklySummarySet 조회용 Filter 배열
         */
        _buildWeeklySummaryFilters() {
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
            var iLookbackMonths = Number(oFilterData.LookbackMonths);
            var sPrNo = this._normalizeSearchText(oFilterData.PrNo);
            var sRfqNo = this._normalizeSearchText(oFilterData.RfqNo);
            var sPoNo = this._normalizeSearchText(oFilterData.PoNo);
            var sDocType = this._normalizeSearchText(oFilterData.DocType);
            var sMatnr = this._normalizeSearchText(oFilterData.Matnr);
            var sMaktx = this._normalizeFreeText(oFilterData.Maktx);
            var sLifnr = this._normalizeSearchText(oFilterData.Lifnr);
            var sName1 = this._normalizeFreeText(oFilterData.Name1);
            var sWerks = this._normalizeSearchText(oFilterData.Werks);
            var aFilters = [];

            if (oFilterData.KeyDate) {
                aFilters.push(new Filter("KeyDate", FilterOperator.EQ, this._normalizeDate(oFilterData.KeyDate)));
            }

            /*
             * DelayListSet도 Backend 최신 metadata에서 LookbackMonths를 지원한다.
             * 이 값을 보내야 조달 문서 목록과 그 목록 기준으로 다시 계산하는 KPI 카드가
             * 최근 3개월/6개월 선택값에 맞게 함께 바뀐다.
             */
            if (Number.isFinite(iLookbackMonths) && iLookbackMonths > 0) {
                aFilters.push(new Filter("LookbackMonths", FilterOperator.EQ, iLookbackMonths));
            }

            /*
             * DelayListSet의 기준 문서는 DocType + DocNo 조합이다.
             * 따라서 화면의 PR번호/PO번호 입력값은 Backend에 직접 PrNo/PoNo로 보내지 않고,
             * 실제 목록 Key인 문서유형과 문서번호로 변환해서 전달한다.
             *
             * 문서유형 Select는 문서번호가 없을 때만 단독 DocType 필터로 사용한다.
             * 예를 들어 사용자가 문서유형을 PO로 둔 상태에서 PR번호를 입력했다면,
             * 더 구체적인 PR번호 조건이 우선되어 DocType은 PR로 고정된다.
             *
             * PR번호와 PO번호가 동시에 입력된 경우에는 하나의 Header 기준문서를 고르는 화면 특성상
             * PR번호를 우선한다. 동시 입력 경고는 이후 Busy/오류 처리 고도화 단계에서 사용자 안내로 분리한다.
             */
            if (sPrNo) {
                aFilters.push(new Filter("DocType", FilterOperator.EQ, "PR"));
                aFilters.push(new Filter("DocNo", FilterOperator.EQ, sPrNo));
            } else if (sRfqNo) {
                aFilters.push(new Filter("DocType", FilterOperator.EQ, "RFQ"));
                aFilters.push(new Filter("DocNo", FilterOperator.EQ, sRfqNo));
            } else if (sPoNo) {
                aFilters.push(new Filter("DocType", FilterOperator.EQ, "PO"));
                aFilters.push(new Filter("DocNo", FilterOperator.EQ, sPoNo));
            } else if (["PR", "RFQ", "PO"].indexOf(sDocType) > -1) {
                aFilters.push(new Filter("DocType", FilterOperator.EQ, sDocType));
            }

            /*
             * 상세 조회조건은 DelayListSet에 직접 전달한다.
             *
             * 자재코드/공급업체코드/플랜트는 코드값 그대로 동등 비교한다.
             * 자재명(Maktx), 공급업체명(Name1)은 Frontend에서는 EQ로 보내지만,
             * Backend DPC_EXT에서 LIKE '%검색어%' 방식의 부분일치 검색으로 해석한다.
             * 이렇게 하면 UI5 OData Filter 구조는 단순하게 유지하면서도 사용자는 포함 검색처럼 사용할 수 있다.
             */
            if (sMatnr) {
                aFilters.push(new Filter("Matnr", FilterOperator.EQ, sMatnr));
            }

            if (sMaktx) {
                aFilters.push(new Filter("Maktx", FilterOperator.EQ, sMaktx));
            }

            if (sLifnr) {
                aFilters.push(new Filter("Lifnr", FilterOperator.EQ, sLifnr));
            }

            if (sName1) {
                aFilters.push(new Filter("Name1", FilterOperator.EQ, sName1));
            }

            if (sWerks) {
                aFilters.push(new Filter("Werks", FilterOperator.EQ, sWerks));
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
         * 자재명/공급업체명처럼 사람이 읽는 명칭 검색어를 정규화한다.
         *
         * 코드/문서번호는 대문자로 고정해도 안전하지만, 명칭은 Backend와 DB의 대소문자 처리 방식에 따라
         * "Battery"와 "BATTERY"가 다르게 해석될 수 있다.
         * 그래서 명칭 검색어는 사용자가 입력한 대소문자를 유지하고 앞뒤 공백만 제거한다.
         *
         * @param {string|number|null|undefined} vValue 명칭 검색어 입력값
         * @returns {string} 앞뒤 공백만 제거한 검색어. 값이 없으면 빈 문자열
         */
        _normalizeFreeText(vValue) {
            return String(vValue || "").trim();
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
         * OData 조회 오류를 사용자가 이해하고 조치할 수 있는 안내 문구로 변환한다.
         *
         * SAP Gateway가 JSON 오류 본문에 업무 메시지를 전달한 경우 그 문구를 가장 먼저 사용한다.
         * 반면 `HTTP request failed`, `Internal Server Error` 같은 기술 문구는 화면에 그대로 노출하지 않고
         * 연결, 권한, 조회 조건, 서버 처리 오류처럼 사용자가 이해할 수 있는 표현으로 바꾼다.
         *
         * @param {object|Error|string} vError ODataModel.read error 콜백 값
         * @param {string} sContextMessage 오류가 발생한 화면 작업을 설명하는 기본 안내
         * @returns {string} MessageBox에 표시할 사용자용 오류 메시지
         */
        _getODataErrorMessage(vError, sContextMessage) {
            var sBusinessMessage = this._extractODataBusinessMessage(vError);
            var iStatusCode = Number(vError && (vError.statusCode || vError.status));

            if (sBusinessMessage && !this._isTechnicalErrorMessage(sBusinessMessage)) {
                return sBusinessMessage;
            }

            if (!iStatusCode || iStatusCode === 408 || iStatusCode === 504) {
                if (iStatusCode === 408 || iStatusCode === 504 || this._isConnectionError(vError)) {
                    return "서버에 연결할 수 없습니다. 네트워크 상태와 로그인 세션을 확인한 후 다시 시도하세요.";
                }
            }

            if (iStatusCode === 401 || iStatusCode === 403) {
                return "이 정보를 조회할 권한이 없거나 로그인 세션이 만료되었습니다. 다시 로그인한 후 시도하세요.";
            }

            if (iStatusCode === 404) {
                return "요청한 조회 서비스를 찾을 수 없습니다. 시스템 관리자에게 문의하세요.";
            }

            if (iStatusCode === 400 || iStatusCode === 422) {
                return "조회 조건을 처리하지 못했습니다. 입력한 조건을 확인한 후 다시 시도하세요.";
            }

            if (iStatusCode >= 500) {
                return "요청을 처리하는 중 문제가 발생했습니다. 잠시 후 다시 시도하세요.";
            }

            return sContextMessage || "데이터를 조회하지 못했습니다. 잠시 후 다시 시도하세요.";
        },

        /**
         * SAP Gateway OData 오류 응답의 JSON 본문에서 업무 메시지를 추출한다.
         *
         * OData V2는 일반적으로 `error.message.value`, 일부 응답은 `error.message` 문자열을 사용한다.
         * JSON 형식이 아니거나 구조가 다르면 빈 문자열을 반환하여 상태 코드별 안내를 사용하게 한다.
         * 원문 전체를 화면에 표시하지 않으므로 HTML, XML, 예외 스택이 노출되는 문제도 방지한다.
         *
         * @param {object|Error|string} vError OData 오류 객체
         * @returns {string} Gateway 업무 메시지 또는 빈 문자열
         * @private
         */
        _extractODataBusinessMessage(vError) {
            var sResponseText = vError && (
                vError.responseText ||
                vError.response && vError.response.body
            );
            var oResponse;
            var vMessage;

            if (!sResponseText || typeof sResponseText !== "string") {
                return "";
            }

            try {
                oResponse = JSON.parse(sResponseText);
                vMessage = oResponse && oResponse.error && oResponse.error.message;

                if (typeof vMessage === "string") {
                    return vMessage.trim();
                }

                return vMessage && typeof vMessage.value === "string" ? vMessage.value.trim() : "";
            } catch {
                return "";
            }
        },

        /**
         * 오류 문구가 사용자 안내가 아니라 통신 계층의 기술 문구인지 판별한다.
         *
         * @param {string} sMessage 검사할 오류 문구
         * @returns {boolean} 기술 문구이면 true
         * @private
         */
        _isTechnicalErrorMessage(sMessage) {
            return /http request failed|network error|internal server error|failed to fetch/i.test(String(sMessage || ""));
        },

        /**
         * 상태 코드가 없는 브라우저 통신 실패를 판별한다.
         *
         * @param {object|Error|string} vError OData 오류 객체
         * @returns {boolean} 네트워크 또는 연결 실패이면 true
         * @private
         */
        _isConnectionError(vError) {
            var sMessage = vError && vError.message || "";

            return /network error|failed to fetch|connection|timeout/i.test(String(sMessage));
        }
    });
});
