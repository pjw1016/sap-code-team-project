sap.ui.define([
    "sap/ui/core/UIComponent",
    "code/t0/ui5/review4/model/models",
    "sap/ui/model/json/JSONModel",
    "sap/f/library",
    'sap/f/FlexibleColumnLayoutSemanticHelper',

], (UIComponent, models, JSONModel, fioriLibrary, FlexibleColumnLayoutSemanticHelper) => {
    "use strict";

    /** @type {sap.f.LayoutType} */
    const LayoutType = fioriLibrary.LayoutType;

    return UIComponent.extend("code.t0.ui5.review4.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // device 모델은 화면 크기/터치 지원 여부처럼 UI5가 제공하는 런타임 정보를 담는다.
            // View에서는 필요할 때 {device>/...} 형태로 읽을 수 있고, 여기서는 전역 이름 있는 모델로 등록한다.
            this.setModel(models.createDeviceModel(), "device");

            // 이 예제 프로그램의 각종 환경 정보를 보관할 전역 Model 설정
            // FlexibleColumnLayout의 layout 값과 컬럼별 액션 버튼 상태를 여러 View에서 함께 사용하기 위한 모델이다.
            this.setModel(new JSONModel(), "config");

            // 라우터(Router)를 초기화하여 애플리케이션의 라우팅 기능을 사용할 수 있도록 설정
            this.getRouter().initialize();

        },


        /**
         * Returns an instance of the semantic helper
         * @returns {sap.f.FlexibleColumnLayoutSemanticHelper} An instance of the semantic helper
         */
        getHelper: function () {
            /** @type {sap.f.LayoutType} */
            const LayoutType = fioriLibrary.LayoutType;

            if (!this._oHelper) {
                // SemanticHelper는 현재 FlexibleColumnLayout 상태를 기준으로
                // 다음 화면 단계의 layout과 full screen/close 버튼 노출 여부를 계산해준다.
                let oFCL = this.getRootControl().byId("idFlexibleColumnLayout");
                let oSettings = {
                    defaultTwoColumnLayoutType: LayoutType.TwoColumnsMidExpanded,
                    defaultThreeColumnLayoutType: LayoutType.ThreeColumnsMidExpanded,
                    initialColumnsCount: 1,
                    maxColumnsCount: 3
                };

                this._oHelper = FlexibleColumnLayoutSemanticHelper.getInstanceFor(oFCL, oSettings);
            }

            return this._oHelper;


        }

    });
});
