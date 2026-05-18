sap.ui.define([
    // 모든 UI5 컨트롤러의 기본이 되는 클래스입니다.
    // 화면에서 발생하는 이벤트를 받아 처리하고, 모델과 라우터를 연결하는 중심 역할을 합니다.
    "sap/ui/core/mvc/Controller",
    // sap.f 라이브러리는 FlexibleColumnLayout에서 사용하는 레이아웃 상수를 제공합니다.
    // 문자열을 직접 적는 것보다 상수를 사용하면 코드의 의도가 더 분명해집니다.
    "sap/f/library"
], (BaseController, fioriLibrary) => {
    "use strict";

    // App.controller.js는 애플리케이션의 최상위 레이아웃을 관리합니다.
    // 개별 데이터 화면보다, 라우팅과 FlexibleColumnLayout의 상태를 조율하는 데 초점이 있습니다.
    return BaseController.extend("code.t0.ui5.review5.controller.App", {

        // 컨트롤러 내부에서 LayoutType을 간결하게 참조하기 위한 별칭입니다.
        // 예를 들어 OneColumn, TwoColumnsMidExpanded 같은 값을 읽기 쉽게 사용할 수 있습니다.
        /** @type {sap.f.LayoutType} */
        LayoutType: fioriLibrary.LayoutType,

        onInit() {
            // Component가 가진 라우터를 꺼내 이 컨트롤러의 멤버로 보관합니다.
            // 여러 메서드에서 반복해서 사용할 대상은 이렇게 저장해 두면 코드가 한결 단정해집니다.
            this._oRouter = this.getOwnerComponent().getRouter();

            // route가 실제 target 화면을 표시하기 전에 먼저 실행됩니다.
            // 이 시점에 layout을 정해 두면, 화면이 나타날 때부터 올바른 컬럼 구조로 열립니다.
            this._oRouter.attachBeforeRouteMatched(this._onBeforeRouteMatched, this);

            // route가 일치한 뒤 실행됩니다.
            // 여기서는 현재 route 이름과 인자를 기억하고, UI 상태를 config 모델에 반영합니다.
            this._oRouter.attachRouteMatched(this._onRouteMatched, this);
        },

        _onBeforeRouteMatched: function (oEvent) {
            // oEvent는 이번에 매칭될 route의 arguments 정보를 담고 있습니다.
            // URL에 layout 값이 들어 있다면 그 값을 사용하고, 없다면 기본 UI 상태에서 layout을 계산합니다.
            var oArgs = oEvent.getParameter("arguments");
            var layout = oArgs.layout;

            if (!layout) {
                layout = this.LayoutType.OneColumn; //; "OneColumn";
                // Component의 Semantic Helper는 현재 FCL 구조에 맞는 다음 UI 상태를 알려 줍니다.
                // getNextUIState(0)은 기본적으로 한 컬럼 중심의 시작 상태를 얻기 위해 사용됩니다.
                var oLayoutInfo = this.getOwnerComponent().getHelper();
                layout = oLayoutInfo.getNextUIState(0).layout; // "OneColumn"
                // layout = oLayoutInfo.getNextUIState(1).layout; // "TwoColumns"
            }

            if (layout) {
                // config 모델의 /layout 값이 FlexibleColumnLayout의 layout 속성과 연결되어 있습니다.
                // 그러므로 이 값을 바꾸는 순간, 실제 화면의 컬럼 배치도 함께 갱신됩니다.
                var oModel = this.getOwnerComponent().getModel("config");
                oModel.setProperty("/layout", layout);
            }
        },

        _onRouteMatched: function (oEvent) {
            // route가 매칭된 뒤에는 현재 route 이름과 전달 인자를 읽어 둡니다.
            // 이 정보는 사용자가 FCL의 내비게이션 화살표를 눌렀을 때 다시 같은 화면으로 이동하는 데 필요합니다.
            var oRouteName = oEvent.getParameter("name"); // RouteCarrier, RouteConnection, RouteFlight 중 하나입니다.
            var oArgs = oEvent.getParameter("arguments");

            // 현재 FlexibleColumnLayout의 UI 상태를 가져와 config 모델에 통째로 반영합니다.
            // begin/mid/end 컬럼의 전체 화면 가능 여부 같은 상태도 이 모델을 통해 참조할 수 있습니다.
            var oModel = this.getOwnerComponent().getModel("config");
            var oUIState = this.getOwnerComponent()
                .getHelper()
                .getCurrentUIState();

            if (oArgs.layout) {
                // URL에 layout이 명시되어 있으면, 현재 UI 상태에도 그 layout을 우선 반영합니다.
                oUIState.layout = oArgs.layout;
            }

            oModel.setData(oUIState);

            // 현재 route와 주요 키 값을 기억해 둡니다.
            // 이후 사용자가 컬럼 닫기/확대 같은 FCL 자체 버튼을 누르면, 이 값으로 URL을 다시 정돈합니다.
            this._currentRouteName = oRouteName;
            this._currentCarrid = oArgs.carrid; // RouteDetail 일 때만 값이 존재
            this._currentConnid = oArgs.connid; // RouteDetail 일 때만 값이 존재
        },

        onStateChanged: function (oEvent) {
            // FlexibleColumnLayout의 상태가 바뀔 때 호출됩니다.
            // 특히 화면 오른쪽의 내비게이션 화살표를 눌렀는지 여부가 중요합니다.
            var isNavigationArrow = oEvent.getParameter("isNavigationArrow");
            var layout = oEvent.getParameter("layout");

            // 실제 FCL 상태를 다시 읽어 config 모델에 저장합니다.
            // 화면 버튼의 표시 여부나 layout 바인딩이 최신 상태를 바라보게 하기 위함입니다.
            var oModel = this.getOwnerComponent().getModel("config");
            var oUIState = this.getOwnerComponent()
                .getHelper()
                .getCurrentUIState();

            oModel.setData(oUIState);

            if (isNavigationArrow) {
                // 사용자가 FCL의 기본 화살표로 레이아웃을 바꾸면 URL도 같은 상태를 표현해야 합니다.
                // 화면만 바뀌고 주소가 뒤처지면 새로고침이나 뒤로 가기에서 혼란이 생길 수 있습니다.
                this.getOwnerComponent().getRouter().navTo(this._currentRouteName, {
                    Carrid: this._currentCarrid,
                    Connid: this._currentConnid,
                    layout: layout
                });
            }
        },
        onExit: function () {
            // 컨트롤러가 사라질 때 route 이벤트 연결을 해제합니다.
            // 작은 정리처럼 보이지만, 오래 실행되는 앱에서는 불필요한 이벤트 호출을 막는 중요한 습관입니다.
            this._oRouter.detachRouteMatched(this._onRouteMatched, this);
        }
    });
});
