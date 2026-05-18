sap.ui.define([
    "sap/ui/core/UIComponent",
    "code/t0/map/naver/model/models"
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("code.t0.map.naver.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();
        },
        loadNaverMapScript: function () {
            return new Promise((resolve, reject) => {
                if (window.naver && window.naver.maps) {
                    resolve(); // 이미 로딩됨
                    return;
                }

                const script = document.createElement("script");
                script.src = "https://openapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=xc33ttmumv";
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        },
    });
});