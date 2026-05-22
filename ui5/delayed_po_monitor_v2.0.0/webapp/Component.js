sap.ui.define([
    "sap/ui/core/UIComponent",
    "code/d3/delayedpomonitor/model/models"
], (UIComponent, models) => {
    "use strict";

    /*
     * Component.js는 UI5 앱의 시작점이다.
     * manifest.json을 읽어 ODataModel, i18n, 라우팅 설정을 구성하고,
     * 앱 전체에서 공통으로 사용할 모델을 등록한다.
     */
    return UIComponent.extend("code.d3.delayedpomonitor.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // UIComponent의 기본 초기화 로직을 먼저 실행해야 manifest 설정이 정상 반영된다.
            UIComponent.prototype.init.apply(this, arguments);

            // 화면 반응형 처리에 쓸 기기 정보 모델이다. 필요하면 View에서 device>/system/phone처럼 참조할 수 있다.
            this.setModel(models.createDeviceModel(), "device");

            // manifest.json의 routing 설정을 활성화한다. 현재 앱은 단일 Main 화면으로 이동한다.
            this.getRouter().initialize();
        }
    });
});
