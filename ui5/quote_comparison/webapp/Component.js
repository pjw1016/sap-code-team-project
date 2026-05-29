sap.ui.define([
    "sap/ui/core/UIComponent",
    "code/d3/quotecomparison/model/models"
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("code.d3.quotecomparison.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // UIComponent 기본 초기화를 먼저 실행해 manifest 기반 설정과 라이프사이클을 준비한다.
            UIComponent.prototype.init.apply(this, arguments);

            // 화면 크기와 기기 종류에 따라 반응형 제어가 가능하도록 device 모델을 등록한다.
            this.setModel(models.createDeviceModel(), "device");

            // manifest.json의 라우팅 설정을 활성화해 앱 진입 시 대상 화면을 표시한다.
            this.getRouter().initialize();
        }
    });
});
