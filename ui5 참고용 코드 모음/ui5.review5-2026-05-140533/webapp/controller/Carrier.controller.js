sap.ui.define([
    // UI5 MVC 컨트롤러의 기본 클래스입니다.
    // 이 파일에서는 항공사 목록 화면의 검색, 정렬, 이동 이벤트를 처리합니다.
    "sap/ui/core/mvc/Controller",
    // Filter와 FilterOperator는 OData 목록 바인딩에 조건을 적용할 때 사용합니다.
    // 사용자가 검색어를 입력하면, 이 도구들로 Carrname 조건을 만들어 표에 전달합니다.
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    // MessageBox는 사용자에게 안내 메시지를 품위 있게 보여 주는 표준 대화상자입니다.
    "sap/m/MessageBox",
    // FlexibleColumnLayout의 레이아웃 상수를 사용하기 위한 라이브러리입니다.
    "sap/f/library"
], (Controller, Filter, FilterOperator, MessageBox, fioriLibrary) => {
    "use strict";

    // Carrier 컨트롤러는 첫 번째 컬럼의 항공사 목록 화면을 담당합니다.
    // 목록을 다루는 기본 동작과, 선택한 항공사의 상세 화면으로 이동하는 흐름이 이곳에 모여 있습니다.
    return Controller.extend("code.t0.ui5.review5.controller.Carrier", {

        // FCL 레이아웃 값을 읽기 쉽게 사용하기 위한 별칭입니다.
        /** @type {sap.f.LayoutType} */
        LayoutType: fioriLibrary.LayoutType,

        onInit() {
            // 자주 참조할 View, Table, Router를 멤버 변수로 보관합니다.
            // 반복해서 찾아오는 비용을 줄이고, 각 이벤트 메서드의 의도도 더 선명해집니다.
            this._oView = this.getView();
            this._oCarrierTable = this._oView.byId("idCarrierTable");
            this._oRouter = this.getOwnerComponent().getRouter();

            // 정렬 방향을 기억하는 플래그입니다.
            // 버튼을 누를 때마다 오름차순과 내림차순이 번갈아 적용됩니다.
            this._bDescending = false;


        },
        onSearch(oEvent) {
            // SearchField의 query 값을 읽어 항공사명 필터를 구성합니다.
            // 검색어가 없으면 빈 필터 배열을 전달하여 전체 목록이 다시 보이게 됩니다.
            var aFilter = [],
                sQuery = oEvent.getParameter("query");

            if (sQuery && sQuery.length > 0) {
                // Carrname 필드에 검색어가 포함되는 항공사만 남깁니다.
                // Contains는 사용자가 일부 단어만 입력해도 찾을 수 있게 해 주는 친절한 조건입니다.
                var oFilter = new Filter("Carrname", FilterOperator.Contains, sQuery);
                aFilter.push(oFilter);
            }

            // items 바인딩에 Application 필터를 적용합니다.
            // 즉, 서버나 모델에서 가져온 목록 중 화면 목적에 맞는 항목만 보여 주게 됩니다.
            this._oCarrierTable.getBinding("items").filter(aFilter, "Application");
        },
        onSort(oEvent) {
            // 현재 정렬 방향을 반대로 바꿉니다.
            // 단일 버튼으로 오름차순과 내림차순을 모두 다루기 위한 간결한 방식입니다.
            this._bDescending = !this._bDescending;

            // Carrid 기준 Sorter를 생성합니다.
            // 두 번째 인자가 true이면 내림차순, false이면 오름차순입니다.
            var oSorter = new sap.ui.model.Sorter("Carrid", this._bDescending);

            var oTable = this._oCarrierTable;
            var oBinding = oTable.getBinding("items");
            // 표의 items 바인딩에 정렬 조건을 적용합니다.
            // 데이터 자체를 고치는 것이 아니라, 화면에 보이는 순서를 조정하는 점을 기억하면 좋습니다.
            oBinding.sort(oSorter);
        },

        onAdd(oEvent){
            // 현재 Add 기능은 아직 구현되지 않았음을 사용자에게 알려 줍니다.
            // 미완성 기능도 조용히 실패시키기보다, 명확한 안내를 주는 편이 좋은 UI입니다.
            MessageBox.information("미구현", {title:"알람", actions:MessageBox.Action.OK});
        },

        onListItemPress(oEvent) {
            // 사용자가 누른 행의 바인딩 컨텍스트를 가져옵니다.
            // 컨텍스트는 "이 행이 어떤 데이터 한 건을 대표하는가"를 알려 주는 연결고리입니다.
            var oContext = oEvent.getSource().getBindingContext();
            var sCarrid = oContext.getProperty("Carrid");

            // 선택한 항공사의 Connection 상세 화면으로 이동합니다.
            // TwoColumnsMidExpanded를 사용하므로 목록 컬럼과 상세 컬럼이 함께 보이는 구조가 됩니다.
            this._oRouter.navTo("RouteConnection", {
                layout: this.LayoutType.TwoColumnsMidExpanded,
                carrid: sCarrid
            });
        }
    });
});
