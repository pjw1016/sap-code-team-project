sap.ui.define([
    // ObjectPageLayout으로 구성된 항공사 상세 화면의 이벤트를 처리하는 기본 컨트롤러 클래스입니다.
    "sap/ui/core/mvc/Controller",
    // 화면 전용 상태, 예컨대 이미지 경로처럼 가벼운 데이터를 담기 위해 JSONModel을 사용합니다.
    "sap/ui/model/json/JSONModel",
    // FlexibleColumnLayout의 레이아웃 상수를 사용하기 위한 라이브러리입니다.
    "sap/f/library"
], function (Controller, JSONModel, fioriLibrary) {
    "use strict";

    // Connection 컨트롤러는 선택한 항공사의 상세 정보와 연결편 목록을 담당합니다.
    // Carrier 목록과 Flight 상세 사이에서 중간 다리 역할을 하는 화면이라고 보면 좋습니다.
    return Controller.extend("code.t0.ui5.review5.controller.Connection", {

        // Route 이동 시 사용할 FlexibleColumnLayout 레이아웃 값을 읽기 쉽게 보관합니다.
        LayoutType: fioriLibrary.LayoutType,

        onInit() {
            // Component의 라우터를 가져와 이 컨트롤러 안에서 재사용합니다.
            this._oRouter = this.getOwnerComponent().getRouter();

            // RouteConnection에 진입하면 항공사 상세 데이터를 바인딩해야 합니다.
            // 따라서 해당 route의 patternMatched 이벤트에 _onPatternMatched를 연결합니다.
            this._oRouteConn = this._oRouter.getRoute("RouteConnection");
            this._oRouteConn.attachPatternMatched(this._onPatternMatched, this);

            // RouteFlight로 이동해도 중간 컬럼인 Connection 화면은 유지됩니다.
            // 이때도 필요한 경우 현재 항공사 바인딩을 점검하기 위해 같은 핸들러를 연결합니다.
            this._oRouteFlight = this._oRouter.getRoute("RouteFlight");
            this._oRouteFlight.attachPatternMatched(this._onPatternMatched, this);

            // 이미지 파일의 기본 경로를 UI5 모듈 경로 기준으로 계산합니다.
            // 하드코딩된 상대 경로보다, 모듈 네임스페이스에 맞춰 찾는 이 방식이 더 견고합니다.
            var sDefaultPath = sap.ui.require.toUrl("code/t0/ui5/review5/img/");
            var oModel = new JSONModel({
                defaultPath: sDefaultPath,
                imagePath: sDefaultPath + "flight.jpg"
            });

            // view 모델은 이 화면 안에서만 사용하는 보조 데이터 모델입니다.
            // OData 모델과 구분해 "view"라는 이름을 붙여 두면 바인딩의 출처가 분명해집니다.
            this.getView().setModel(oModel, "view");

        },
        onExit() {
            // 컨트롤러가 사라질 때 route 이벤트 연결을 해제합니다.
            // 이벤트 연결을 맺었다면, 생명주기가 끝날 때 풀어 주는 것이 훌륭한 습관입니다.
            this._oRouteConn.detachPatternMatched(this._onPatternMatched, this);
            this._oRouteFlight.detachPatternMatched(this._onPatternMatched, this);
        },
        _onPatternMatched(oEvent) {
            // oArgs는 현재 route의 URL에서 추출된 인자입니다.
            // RouteConnection에서는 carrid가 직접 전달되고, RouteFlight에서는 carrid와 connid가 함께 전달됩니다.
            var oArgs = oEvent.getParameter("arguments");

            // 현재 매칭된 route 이름을 기준으로 항공사 키를 관리합니다.
            // RouteConnection으로 들어온 경우에는 새로 선택한 항공사를 그대로 기억합니다.
            if (oEvent.getParameter("name") === "RouteConnection") {
                this._carrid = oArgs.carrid || "";
            } else {
                // RouteFlight로 이동할 때 같은 carrid라면 중간 컬럼의 바인딩을 다시 할 필요가 없습니다.
                // 이미 같은 항공사를 보고 있으므로, 불필요한 갱신을 줄이는 작은 배려입니다.
                if (this._carrid === oArgs.carrid) {
                    return; // 동일한 carrid 이면 다시 bindElement 하지 않는다.
                }

                // carrid가 URL에 있으면 그 값을 우선 사용하고, 없으면 기존 값을 보존합니다.
                // 화면 흐름이 잠깐 흔들려도 중간 컬럼이 비지 않도록 하는 방어적인 처리입니다.
                this._carrid = oArgs.carrid || this._carrid || "";
            }


            if (this._carrid) {
                // 선택된 항공사 키로 CarrierSet의 단일 엔티티에 뷰를 바인딩합니다.
                // 예를 들어 carrid가 "AA"라면 "/CarrierSet('AA')"와 같은 경로가 됩니다.
                this.getView().bindElement(`/CarrierSet('${this._carrid}')`);
            } else {
                // 항공사 키가 없으면 이전 바인딩을 해제하여 잘못된 데이터가 남지 않게 합니다.
                this.getView().unbindElement("");
            }
        },

        onListItemPress(oEvent) {
            // 사용자가 선택한 Connection 행의 컨텍스트에서 항공사 ID와 연결편 번호를 읽습니다.
            var oContext = oEvent.getSource().getBindingContext();
            var sCarrid = oContext.getProperty("Carrid");
            var sConnid = oContext.getProperty("Connid");

            // Flight 상세 화면으로 이동합니다.
            // ThreeColumnsEndExpanded를 사용하면 목록, 항공사 상세, 항공편 상세가 세 컬럼으로 함께 펼쳐집니다.
            // carrid와 connid는 URL의 핵심 키가 되므로, 가능한 한 현재 컨텍스트에서 정확히 전달합니다.
            this._oRouter.navTo("RouteFlight", {
                layout: this.LayoutType.ThreeColumnsEndExpanded,
                carrid: sCarrid || this._carrid || "",
                connid: sConnid || "0000"
            });
        },
    });
});
