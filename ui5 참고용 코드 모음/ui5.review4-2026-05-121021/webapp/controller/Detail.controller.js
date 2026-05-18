sap.ui.define([
    "sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/f/library",
    "code/t0/ui5/review4/model/Formatter",
], function (Controller, JSONModel, MessageBox, fioriLibrary, Formatter) {
    "use strict";

    /** @type {sap.f.LayoutType} */
    const Layout = fioriLibrary.LayoutType;

    return Controller.extend("code.t0.ui5.review4.controller.Detail", {

        formatter: Formatter,

        // onInit 메서드는 컨트롤러가 초기화될 때 호출되는 메서드입니다. 
        // 이 메서드에서는 라우터(Router)와 모델(Model)을 가져와서 컨트롤러의 속성(Property)으로 저장하고, 
        // 라우터(Router)에 경로(Route)가 일치할 때마다 _onPatternMatched 메서드를 호출하도록 등록합니다.
        onInit: function () {
            // 컴포넌트(Component)와 라우터(Router) 객체를 가져와서 컨트롤러의 속성(Property)으로 저장
            this._oOwnerComponent = this.getOwnerComponent();
            this._oRouter = this._oOwnerComponent.getRouter();
            this._oModel = this._oOwnerComponent.getModel("config");

            // 아래 경로(Route)가 일치할 때마다 _onPatternMatched 메서드를 호출하도록 라우터(Router)에 등록
            // "RouteDetail", "RouteFlight"
            this._oRouter.getRoute("RouteDetail").attachPatternMatched(this._onPatternMatched, this);
            this._oRouter.getRoute("RouteFlight").attachPatternMatched(this._onPatternMatched, this);

            this.getView().setModel(new JSONModel(), "view");
        },

        _onPatternMatched(oEvent) {
            // RouteList에는 carrid가 없으므로, 이미 선택된 항공사가 있으면 기존 값을 유지한다.
            // RouteDetail/RouteFlight로 들어오면 URL의 {carrid} 값이 arguments.carrid로 전달된다.
            this._carrid = oEvent.getParameter("arguments").carrid || this._carrid || "";

            // View 자체를 항공사 한 건에 바인딩한다.
            // 이후 Detail.view.xml 안의 {Carrname}, {Currcode}, {to_Connection}은 이 경로를 기준으로 한 상대 바인딩이다.
            this.getView().bindElement({
                path: `/CarrierSet('${this._carrid}')`,
                parameters: {
                    expand: "to_Connection"
                }
            });

            var sImagePath = sap.ui.require.toUrl(`code/t0/ui5/review4/images/${this._carrid}.jpg`);
            var oModel = this.getView().getModel("view");
            oModel.setProperty("/imageSrc", sImagePath);
            console.log(`완성된 이미지 경로: ${sImagePath}`);

        },
        onToggleButtonPress() {
            var oObjectPage = this.getView().byId("idObjectPageLayout"),
                bCurrentShowFooterState = oObjectPage.getShowFooter();

            oObjectPage.setShowFooter(!bCurrentShowFooterState);
        },

        onColumnListItemConnectionPress(oEvent) {

            let oItem = oEvent.getSource(),
                oContext = oItem.getBindingContext(),
                sPath = oContext.getPath();

            console.log(`Click한 항공편과 연결된 Model 경로: ${sPath}`);

            // 바인딩 컨텍스트에서 "Carrid" 속성의 값을 가져옵니다.
            // 여기서 oContext는 Detail.view.xml의 to_Connection 테이블 행에 해당한다.
            var sCarrid = oContext.getProperty("Carrid");
            var sConnid = oContext.getProperty("Connid");

            // NextUIState(2)는 3개의 컬럼(세 번째 end 컬럼까지 표시)을 출력하는 UI 환경을 의미한다.
            var oHelper = this._oOwnerComponent.getHelper();
            var oNextUIState = oHelper.getNextUIState(2);
            
            // 라우터를 사용하여 "RouteDetail" 경로로 이동할 때 전달할 정보를 구성한다.
            var oParams = {
                layout: oNextUIState.layout,
                carrid: sCarrid,
                connid: sConnid
            }

            this._oRouter.navTo("RouteFlight", oParams);
        },

        onOverflowToolbarButton_FullScreen_Press() {
            // config 모델의 actionButtonsInfo는 App.controller가 현재 FCL 상태를 기준으로 갱신한다.
            var sNextLayout = this._oModel.getProperty("/actionButtonsInfo/midColumn/fullScreen");
            this._oRouter.navTo("RouteDetail", { layout: sNextLayout, carrid: this._carrid });

        },

        onOverflowToolbarButton_ExitFullScreen_Press() {
            var sNextLayout = this._oModel.getProperty("/actionButtonsInfo/midColumn/exitFullScreen");
            this._oRouter.navTo("RouteDetail", { layout: sNextLayout, carrid: this._carrid });

        },

        onOverflowToolbarButton_Close_Press() {
            // mid 컬럼을 닫으면 목록 라우트로 돌아가고, layout만 다음 상태로 전달한다.
            var sNextLayout = this._oModel.getProperty("/actionButtonsInfo/midColumn/closeColumn");
            this._oRouter.navTo("RouteList", { layout: sNextLayout });

        },

        onButtonSavePress() {
            MessageBox.information("해당 기능이 구현되지 않았습니다.", {
                icon: MessageBox.Icon.WARNING,
                title: "알림"
            });
        },

        onButtonDeletePress() {
            MessageBox.information("해당 기능이 구현되지 않았습니다.", {
                icon: MessageBox.Icon.WARNING,
                title: "알림"
            });
        },


        // onExit 메서드는 컨트롤러가 종료될 때 호출되는 메서드입니다. 이 메서드에서는 라우터(Router)에 등록된 이벤트 핸들러를 해제하여 메모리 누수를 방지합니다.
        onExit: function () {
            // 아래 경로(Route)가 일치할 때마다 _onPatternMatched 메서드를 호출하도록 등록했던 정보를 제거
            this._oRouter.getRoute("RouteDetail").detachPatternMatched(this._onPatternMatched, this);
            this._oRouter.getRoute("RouteFlight").detachPatternMatched(this._onPatternMatched, this);
        },
    });
});
