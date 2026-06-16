sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
], 
function (JSONModel, Device) {
    "use strict";

    return {
        /**
         * Provides runtime information for the device the UI5 app is running on as a JSONModel.
         * @returns {sap.ui.model.json.JSONModel} The device model.
         */
        createDeviceModel: function () {
            var oModel = new JSONModel(Device);
            oModel.setDefaultBindingMode("OneWay");
            return oModel;
        },

        /**
         * 조회조건 전용 JSONModel을 생성한다.
         *
         * 이 모델은 Backend OData Filter를 만들 때 기준이 된다.
         * V1.2.1에서 확정한 기본 조회조건과 상세 조회조건을 한 곳에 모아두면,
         * Main.controller.js에서 화면 Control 값을 일일이 찾아다니지 않아도 된다.
         *
         * 필드명은 Backend OData Property 이름과 동일하게 PascalCase로 둔다.
         * 예를 들어 PR번호는 화면 라벨이 "PR번호"이지만, OData Filter에서는
         * `PrNo`로 전달해야 하므로 모델 필드명도 `PrNo`로 맞춘다.
         *
         * @returns {sap.ui.model.json.JSONModel} 조회조건 기본값이 담긴 JSONModel
         */
        createFilterModel: function () {
            return new JSONModel({
                // DatePicker의 dateValue에 바로 바인딩하고, OData V2 Filter 생성 시에도 재사용한다.
                KeyDate: new Date(),

                // Backend 기본값도 3개월이지만, UI에서 사용자가 명확히 볼 수 있도록 모델에도 둔다.
                LookbackMonths: "3",

                // 기본 조회조건: V1.2 설계서 기준으로 PR번호와 PO번호는 항상 화면에 표시한다.
                PrNo: "",
                PoNo: "",

                // 상세 조회조건: 접기/펼치기 영역에 배치할 조건이다.
                // 코드 필드(Matnr, Lifnr, Werks)는 이후 Search Help와 연결하고,
                // 명칭 필드(Maktx, Name1)는 사용자가 일부 텍스트로 좁혀 볼 수 있는 일반 조건으로 둔다.
                // Backend metadata의 OData Property 이름이 각각 Maktx(자재명), Name1(공급업체명)이므로
                // UI 모델도 같은 이름을 사용해 이후 Filter 생성 로직에서 매핑 오류를 줄인다.
                Matnr: "",
                Maktx: "",
                Lifnr: "",
                Name1: "",
                Werks: "",

                // KPI 카드 클릭 전에는 지연상태 필터를 적용하지 않는다.
                DelayStatus: ""
            });
        },

        /**
         * 화면 상태 전용 JSONModel을 생성한다.
         *
         * 이 모델은 Backend 업무 데이터가 아니라 UI의 현재 상태를 관리한다.
         * 예: FCL Layout, Busy 표시, 상세조건 펼침 여부, 선택한 문서 정보.
         *
         * @returns {sap.ui.model.json.JSONModel} 화면 상태 기본값이 담긴 JSONModel
         */
        createViewModel: function () {
            return new JSONModel({
                // 앱 최초 진입 시에는 Begin Column만 보여준다.
                layout: "OneColumn",

                // 전체 조회 Busy와 상세 영역 Busy를 분리해 부분 조회 실패/지연에 대응한다.
                busy: false,
                midBusy: false,
                dialogBusy: false,

                // 상세 조회조건은 기본적으로 접어 두고, 사용자가 필요할 때 펼치게 한다.
                showAdvancedFilters: false,

                // KPI 카드 클릭 시 선택된 DelayStatus를 보관해 강조 표시와 재조회에 사용한다.
                selectedDelayStatus: "",

                // DelayList에서 선택한 기준 문서 정보다.
                // PO이면 Mid Column을 열고, RFQ이면 RFQ/MQ 현황 영역만 강조한다.
                selectedDocType: "",
                selectedDocNo: "",

                // 문서 상세 Dialog에서 선택한 관련 문서를 기억한다.
                selectedDocumentStage: "",
                selectedDocumentNo: "",
                selectedDocumentYear: "",
                selectedDocumentItemNo: ""
            });
        },

        /**
         * DashboardSummarySet 결과를 담을 KPI 전용 JSONModel을 생성한다.
         *
         * OData 조회 전에도 화면 구조가 안정적으로 보이도록 모든 숫자 필드는 0으로 초기화한다.
         * Header 수는 KPI 카드의 큰 숫자로 표시하고, Item 수는 카드 보조 설명으로 표시한다.
         *
         * @returns {sap.ui.model.json.JSONModel} KPI 카드 기본값이 담긴 JSONModel
         */
        createDashboardModel: function () {
            return new JSONModel({
                SummaryId: "DASHBOARD",
                KeyDate: null,
                PrDlyHdrCnt: 0,
                PrDlyItmCnt: 0,
                RfqNoqHdrCnt: 0,
                RfqNoqItmCnt: 0,
                MqSelDlyHdrCnt: 0,
                MqSelDlyItmCnt: 0,
                PoDlvDlyHdrCnt: 0,
                PoDlvDlyItmCnt: 0,
                IvIncHdrCnt: 0,
                IvIncItmCnt: 0
            });
        },

        /**
         * WeeklySummarySet 결과를 담을 주간 요약 전용 JSONModel을 생성한다.
         *
         * 금액은 ObjectNumber에서 formatter를 거쳐 표시하고, 통화는 기본 KRW로 둔다.
         * Backend 조회가 붙으면 WeeklySummarySet 결과 한 건으로 이 모델 값을 갱신한다.
         *
         * @returns {sap.ui.model.json.JSONModel} 주간 요약 기본값이 담긴 JSONModel
         */
        createWeeklyModel: function () {
            return new JSONModel({
                SummaryId: "WEEKLY",
                KeyDate: null,
                WeekFrom: null,
                WeekTo: null,
                PurchaseAmt: 0,
                ReceiptAmt: 0,
                InvoiceAmt: 0,
                Waers: "KRW",
                CompGrHdrCnt: 0,
                IvIncHdrCnt: 0
            });
        },

        /**
         * Mid Column과 Dialog에서 사용할 상세 데이터 모델을 생성한다.
         *
         * ODataModel을 화면에 직접 바인딩할 수도 있지만, 이 앱은 하나의 사용자 동작에서
         * 여러 EntitySet을 조합해 보여준다. JSONModel에 결과를 모아두면
         * PO/RFQ 분기, Dialog 초기화, 부분 실패 처리 로직이 단순해진다.
         *
         * @returns {sap.ui.model.json.JSONModel} 상세 화면 데이터 기본 구조
         */
        createDetailModel: function () {
            return new JSONModel({
                processFlow: [],
                processItems: [],
                processDocuments: [],
                documentDetails: []
            });
        }
    };

});
