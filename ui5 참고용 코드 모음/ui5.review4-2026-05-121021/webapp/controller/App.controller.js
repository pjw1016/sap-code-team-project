sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (BaseController) => {
    "use strict";

    return BaseController.extend("code.t0.ui5.review4.controller.App", {
        onInit() {
            // 컴포넌트(Component)와 라우터(Router) 객체를 가져와서 컨트롤러의 속성(Property)으로 저장
            this._oComponent = this.getOwnerComponent();
            this._oRouter = this._oComponent.getRouter();

            // 경로(Route)가 일치할 때마다 호출되는 메서드 등록
            this._oRouter.attachRouteMatched(this._onRouteMatched, this);
            this._oRouter.attachBeforeRouteMatched(this._onBeforeRouteMatched, this);

        },

        _onBeforeRouteMatched(oEvent) {

            var oModel = this._oComponent.getModel("config");
            var oArguments = oEvent.getParameter("arguments");
            var sLayout = oArguments.layout;

            // If there is no layout parameter, query for the default level 0 layout (normally OneColumn)
            if (!sLayout) {
                var oNextUIState = this._oComponent.getHelper().getNextUIState(0);
                sLayout = oNextUIState.layout;
            }

            // Update the layout of the FlexibleColumnLayout
            if (sLayout) {
                oModel.setProperty("/layout", sLayout);
            }

        },

        // 경로(Route)가 일치할 때마다 호출되는 메서드
        _onRouteMatched(oEvent) {

            // 현재 경로(Route)의 이름과 인자(Arguments)를 가져옴
            var sRouteName = oEvent.getParameter("name"),
                oArguments = oEvent.getParameter("arguments");

            this._updateUIElements();


            // 현재 경로(Route)의 이름과 인자를 컨트롤러의 속성에 저장
            this._currentRouteName = sRouteName;
            this._currentCarrid = oArguments.carrid;
            this._currentConnid = oArguments.connid;

        },

        onFlexibleColumnLayoutStateChange(oEvent) {
            // FlexibleColumnLayout의 내장 화살표를 누르면 stateChange 이벤트가 발생한다.
            // 이때 바뀐 layout을 URL에도 반영해야 새로고침/뒤로가기를 해도 같은 컬럼 상태를 복원할 수 있다.
            var bIsNavigationArrow = oEvent.getParameter("isNavigationArrow"),
                sLayout = oEvent.getParameter("layout");


            this._updateUIElements();


            // bIsNavigationArrow가 true라면 browser history를 새로 쌓지 않고 현재 URL을 교체한다.
            if (bIsNavigationArrow) {
                this._oRouter.navTo(this._currentRouteName, {
                    layout: sLayout,
                    carrid: this._currentCarrid,
                    connid: this._currentConnid
                }, true);
            }
        },

        // 현재 FCL 상태를 config 모델에 저장한다.
        // Detail/Flight View의 visible 바인딩은 이 모델의 actionButtonsInfo 값을 읽어 버튼을 보여주거나 숨긴다.
        _updateUIElements () {
            var oHelper = this._oComponent.getHelper();
            var oUIState = oHelper.getCurrentUIState();
            console.log("oUIState:", oUIState);
            
            var oModel = this._oComponent.getModel("config");
            oModel.setData(oUIState);

        },

        onExit: function () {
            this._oRouter.detachRouteMatched(this._onRouteMatched, this);
            this._oRouter.detachBeforeRouteMatched(this._onBeforeRouteMatched, this);
        }
    });
});
