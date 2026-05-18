sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/f/library",
    "code/t0/ui5/review4/model/Formatter"
], (Controller, Filter, FilterOperator, Sorter, JSONModel, MessageBox, fioriLibrary, Formatter) => {
    "use strict";

    /** @type {sap.f.LayoutType} */
    const LayoutType = fioriLibrary.LayoutType;

    return Controller.extend("code.t0.ui5.review4.controller.List", {
        
        formatter: Formatter,
        
        onInit() {
        
            this._oView = this.getView();
            this._bDescendingSort = false;

            // 목록(List)에서 상세(Detail)로 이동할 때 manifest.json에 정의된 RouteDetail을 사용한다.
            this._oRouter = this.getOwnerComponent().getRouter();

            this._oViewModel = new JSONModel({
                bFullScreen: true,
                carrierCountText: "Loading 중",
                carrierCount: "?"
            });

            // 이 View에서만 사용하기 위해 "view"라는 이름으로 등록한다.
            this._oView.setModel(this._oViewModel, "view");

            // List View의 항공사 목록을 출력하는 Table 컨트롤 정보를 가져온다.
            // 테이블의 데이터가 변경되었을 때마다 this._updateCarrierCount를 호출한다.
            this._oCarrierTable = this._oView.byId("idCarrierSetTable");
            this._oCarrierTable.attachUpdateFinished(this._updateCarrierCount, this);
        },

        _updateCarrierCount() {
            var oBinding = this._oCarrierTable.getBinding("items");

            if (!oBinding || (oBinding.isLengthFinal && !oBinding.isLengthFinal())) {
                return;
            }

            var iCount = oBinding.getLength();
            var oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            var sCountText = oResourceBundle.getText("title", [iCount]);

            this._oViewModel.setProperty("/carrierCount", iCount);
            this._oViewModel.setProperty("/carrierCountText", sCountText);
        },

        /**
         * List 컬럼의 전체 화면 상태를 토글한다.
         * URL 라우팅을 거치지 않고 FCL 인스턴스의 layout을 직접 바꾸는 예시다.
         * 좋지 않은 예를 보여주고 있다.
         */
        onButtonFullScreenPress() {

            /** @type {sap.f.FlexibleColumnLayout} */
            var oFCL = this._oView.getParent().getParent();


            var bFullScreen = this._oViewModel.getProperty("/bFullScreen");
            bFullScreen = !bFullScreen;

            if (bFullScreen) {
                oFCL.setLayout(LayoutType.OneColumn);
            } else {
                oFCL.setLayout(LayoutType.TwoColumnsMidExpanded);
            }

            this._oViewModel.setProperty("/bFullScreen", bFullScreen);
        },

        onSearch(oEvent) {

            var oFilter,
                aFilters = [],
                sQuery = oEvent.getParameter("query");

            if (sQuery && sQuery.length > 0) {

                // aFilters 배열에 Carrid와 Carrname 필드에 대한 필터를 추가합니다.
                aFilters.push(new Filter("Carrid", FilterOperator.Contains, sQuery));
                aFilters.push(new Filter("Carrname", FilterOperator.Contains, sQuery));

                // aFilters 배열에 담긴 필터들을 OR 조건으로 결합하여 하나의 필터 객체로 생성합니다.
                // true는 AND 조건, false는 OR 조건을 의미합니다.
                oFilter = new Filter(aFilters, false);
            }

            // "Application"을 filter함수에 전달하는 이유
            // => "items" aggregation이 "Application" 레벨에서 바인딩되어 있기 때문입니다.
            // -- 참고. Application 레벨이란? List.view.xml에서 Table 컨트롤의 items에 직접 바인딩이 되어 있는 것을 의미
            //         예) <Table items="{/CarrierSet}"> ... </Table>
            var oBinding = this._oCarrierTable.getBinding("items");
            oBinding.filter(oFilter, "Application");
        },

        onAdd() {
            MessageBox.information("해당 기능이 구현되지 않았습니다.", { title: "알림" });
        },

        onSort() {

            // 연산자 !는 boolean 값을 반전시키는 역할을 합니다. 
            // 즉, _bDescendingSort가 true이면 false로, false이면 true로 변경됩니다.
            // 이를 통해 정렬 순서를 반전시킬 수 있습니다.
            this._bDescendingSort = !this._bDescendingSort;

            var oSorter = new Sorter("Carrid", this._bDescendingSort);

            // oBinding.sort(oSorter) 메서드는 테이블의 아이템을 정렬하는 역할을 합니다.
            var oBinding = this._oCarrierTable.getBinding("items");
            oBinding.sort(oSorter);

            var sMessage;
            if (this._bDescendingSort) {
                sMessage = "항공사ID 기준으로 내림차순 정렬되었습니다.";
            } else {
                sMessage = "항공사ID 기준으로 오름차순 정렬되었습니다.";
            }

            MessageBox.information(sMessage, {
                icon: MessageBox.Icon.INFORMATION,
                title: "알림",
                actions: [MessageBox.Action.OK]
            })
        },

        onAccept() {
            MessageBox.information("해당 기능이 구현되지 않았습니다.", {
                icon: MessageBox.Icon.WARNING,
                title: "알림"
            });
        },

        onReject() {
            MessageBox.information("해당 기능이 구현되지 않았습니다.", {
                icon: MessageBox.Icon.WARNING,
                title: "알림"
            });
        },

        onColumnListItemPress(oEvent) {
            // 이벤트가 발생한 소스 컨트롤과 해당 컨트롤의 바인딩 컨텍스트를 가져옵니다.
            var oSource = oEvent.getSource();
            // ColumnListItem은 /CarrierSet의 한 행에 바인딩되어 있으므로
            // getBindingContext()를 통해 클릭한 행의 OData 엔티티를 얻을 수 있다.
            var oContext = oSource.getBindingContext();

            // 바인딩 컨텍스트에서 "Carrid" 속성의 값을 가져옵니다.
            var sCarrid = oContext.getProperty("Carrid");

            // 1단계 UI 상태는 begin + mid 컬럼을 여는 상세 화면 레이아웃을 의미한다.
            var oHelper = this.getOwnerComponent().getHelper();
            var oNextUIState = oHelper.getNextUIState(1);

            this._oRouter.navTo("RouteDetail", {
                layout: oNextUIState.layout,
                carrid: sCarrid
            });
        },

        onExit() {
            this._oCarrierTable.detachUpdateFinished(this._updateCarrierCount, this);
        }
    });
});
