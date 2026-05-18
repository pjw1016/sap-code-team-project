sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "code/t0/map/naver/model/myMap",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment"
], (Controller, myMap, JSONModel, Fragment) => {
    "use strict";

    return Controller.extend("code.t0.map.naver.controller.Main", {
        onInit() {
            var oData = {
                name: "주호타워",
                imgSrc: sap.ui.require.toUrl("code/t0/map/naver/img/logo.png")
            };
            var oModel = new JSONModel(oData);
            var oView = this.getView();
            oView.setModel(oModel, "view");
            
            // 팝업 정보 로딩 시작
            this._pPopover ??= this.loadFragment({
                name: "code.t0.map.naver.view.Popover"
            });

            this._openPopover( );
            this.onPopoverClose( );


            // Naver Map 생성
            this._createNaverMap();
        },

        async _createNaverMap() {
            // Naver Map API를 load 시킨 후 끝날 때까지 대기
            var oComponent = this.getOwnerComponent();
            await oComponent.loadNaverMapScript();

            // Naver MAP 객체 생성 및 초기화
            this._map = myMap.initNaverMap();

            // 확대
            this._map.setZoom(19);

            // 주호타워 위치 생성
            var oPosition = new naver.maps.LatLng(37.4820385, 126.8982004);

            // 해당 위치로 지도 이동
            this._map.setCenter(oPosition);

            // 해당 위치에 Marker 생성
            this._oMarker = new naver.maps.Marker({
                map: this._map,
                position: oPosition
            });

            // Marker를 클릭했을 때 이벤트 처리 => 팝오버 출력
            naver.maps.Event.addListener(
                this._oMarker,
                "click",
                function () { this._openPopover(); }.bind(this)
            );
        },

        _openPopover() {
            // 팝업 로딩 완료되면 출력
            this._pPopover.then(oPopover => {
                // Marker 옆에 출력
                oPopover.openBy(this._oMarker.getElement());
            });
        },

        onButtonPress: function (oEvent) {
            // 화면 이동
            var oPosition = new naver.maps.LatLng(37.4820385, 126.8982004);
            this._map.setCenter(oPosition);

            // 확대
            this._map.setZoom(19);

            // 팝오버 출력
            this._openPopover();
        },
        onPopoverClose() {
            this._pPopover.then(oPopover => {
                oPopover.close();
            });
        }
    });
});