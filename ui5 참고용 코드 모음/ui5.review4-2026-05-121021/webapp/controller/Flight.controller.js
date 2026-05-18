sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (
    Controller
) {
    "use strict";

    return Controller.extend("code.t0.ui5.review4.controller.Flight", {
        onInit() {
            this._oComponent = this.getOwnerComponent();
            this._oModel = this._oComponent.getModel("config");
            this._oRouter = this._oComponent.getRouter();

            // Flight 화면은 RouteFlight가 매칭될 때만 항공편 상세 데이터를 바인딩한다.
            this._oRouter.getRoute("RouteFlight").attachPatternMatched(this._onPatternMatch, this);
        },

        _onPatternMatch(oEvent) {
            let oArguments = oEvent.getParameter("arguments");

            // URL 파라미터 detail/{carrid}/flight/{connid}에서 넘어온 값을 보관한다.
            // full screen/close 버튼을 눌러서 다시 navTo할 때 같은 엔티티 키를 유지하기 위함.
            this._carrid = oArguments.carrid || this._carrid || "";
            this._connid = oArguments.connid || this._connid || "";

            // ConnectionSet(Carrid='AA',Connid='17')와 같은 형식의 경로를 구성한다.
            // 특히 따옴표(')로 값을 감싸는 것에 주의해야 한다.
            let sPath = `/ConnectionSet(Carrid='${this._carrid}',Connid='${this._connid}')`;


            // 준비한 경로의 데이터를 화면에 출력하기 위해 바인딩을 한다.
            // 이렇게 Binding이 지정되면 View에서 상대경로로 데이터를 참조할 수 있다.
            // - 절대경로란? {} 안에 전체 경로가 지정되는 것을 의미하며, "/"가 경로의 시작을 의미한다.
            // - 상대경로란? {} 안에 현재 바인딩된 경로를 기준으로 데이터를 참조하는 것을 의미하며, "/"없이 경로를 지정한다.
            // - 예를 들어, <Text text="{Fltime}" />와 같이 상대경로로 Fltime 데이터를 참조할 수 있습니다.

            // 아래 두 줄은 동일한 역할이다.
            // this.getView().bindElement(sPath);
            // this.getView().bindElement({ path: sPath });

            // {}를 사용할 경우 보다 많은 기능을 사용할 수 있기 때문에 일반적으로 {}를 사용하는 방식을 권장
            // 예를 들어 parameters에서 expand를 사용하여 연관된 엔티티 데이터를 함께 가져올 수 있다.
            this.getView().bindElement({
                path: sPath,
                // Flight.view.xml의 제목은 to_Carrier를, 비행일정 테이블은 to_Flight를 상대 바인딩으로 사용한다.
                parameters: { expand: "to_Carrier,to_Flight" }
            });

        },


        onNavigateToNextPageLinkPress() {
            var oHelper = this._oComponent.getHelper();
            var oNextUIState = oHelper.getNextUIState(3);
            this._oRouter.navTo("RouteNextPage", { layout: oNextUIState.layout });
        },

        onOverflowToolbarButton_FullScreen_Press() {
            // end 컬럼의 전체 화면 전환도 라우터를 통해 처리하여 URL의 layout과 화면 상태를 일치시킨다.
            var sNextLayout = this._oModel.getProperty("/actionButtonsInfo/endColumn/fullScreen");
            this._oRouter.navTo("RouteFlight", {
                layout: sNextLayout,
                carrid: this._carrid,
                connid: this._connid
            });

        },

        onOverflowToolbarButton_ExitFullScreen_Press() {
            var sNextLayout = this._oModel.getProperty("/actionButtonsInfo/endColumn/exitFullScreen");
            this._oRouter.navTo("RouteFlight", {
                layout: sNextLayout,
                carrid: this._carrid,
                connid: this._connid
            });
        },

        onOverflowToolbarButton_Close_Press() {
            // end 컬럼을 닫으면 Flight 대신 Detail 라우트로 이동하고 carrid만 남긴다.
            var sNextLayout = this._oModel.getProperty("/actionButtonsInfo/endColumn/closeColumn");
            this._oRouter.navTo("RouteDetail", {
                layout: sNextLayout,
                carrid: this._carrid
            });
        },

        onExit: function () {
            this._oRouter.getRoute("RouteFlight").detachPatternMatched(this._onPatternMatch, this);
        },
    });
});
