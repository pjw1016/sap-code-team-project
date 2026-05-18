sap.ui.define([
    // UIComponent는 UI5 애플리케이션의 뼈대를 세우는 기본 클래스입니다.
    // 이 클래스를 확장함으로써 우리 앱은 manifest, 라우팅, 모델 같은 핵심 기능을 품위 있게 사용할 수 있습니다.
    "sap/ui/core/UIComponent",
    // models 모듈에는 앱 전역에서 사용할 모델 생성 로직이 정리되어 있습니다.
    // 특히 device 모델처럼 여러 화면에서 공통으로 참조하는 정보는 이렇게 별도 모듈로 분리하면 관리가 쉬워집니다.
    "code/t0/ui5/review5/model/models",
    // JSONModel은 자바스크립트 객체 형태의 데이터를 UI5 바인딩에 올려 주는 가장 친숙한 모델입니다.
    // 화면 설정값이나 임시 상태처럼 가볍게 다룰 데이터에 적합합니다.
    "sap/ui/model/json/JSONModel",
    // FlexibleColumnLayoutSemanticHelper는 Fiori의 다단 컬럼 화면에서 다음 레이아웃을 판단하도록 도와주는 조력자입니다.
    // 말하자면 화면 전환의 질서를 알고 있는 안내자라고 이해하면 좋습니다.
    "sap/f/FlexibleColumnLayoutSemanticHelper",
    // sap/f/library는 FlexibleColumnLayout에서 사용하는 LayoutType 같은 상수를 제공합니다.
    // 문자열을 직접 쓰기보다 라이브러리의 상수를 쓰면 의미가 분명해지고 오타 위험도 줄어듭니다.
    "sap/f/library"
], (UIComponent, models, JSONModel, FCLSemanticHelper, fioriLibrary) => {
    "use strict";

    // Component는 UI5 앱 전체의 출발점입니다.
    // 컨트롤러가 개별 화면의 행동을 맡는다면, Component는 앱의 공통 설정과 생명주기를 책임진다고 볼 수 있습니다.
    return UIComponent.extend("code.t0.ui5.review5.Component", {
        metadata: {
            // manifest.json을 이 Component의 설정 원천으로 사용하겠다는 선언입니다.
            // 라우트, 모델, 리소스, 루트 뷰 같은 큰 설계도는 manifest에 모아 두는 것이 UI5의 표준적인 방식입니다.
            manifest: "json",
            interfaces: [
                // 비동기 방식으로 콘텐츠를 생성하겠다는 표시입니다.
                // 초기 로딩을 더 유연하게 만들고, 현대적인 UI5 애플리케이션 구조와도 잘 어울립니다.
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // 먼저 부모 클래스의 init을 호출해야 합니다.
            // 집을 짓기 전에 기초 공사를 마치는 것처럼, UIComponent가 제공하는 기본 초기화가 선행되어야 합니다.
            UIComponent.prototype.init.apply(this, arguments);

            // device 모델은 현재 사용 환경의 특성, 예컨대 데스크톱/태블릿/휴대폰 여부를 담습니다.
            // 화면이 기기 특성에 맞게 반응하도록 만들 때 매우 자주 활용됩니다.
            this.setModel(models.createDeviceModel(), "device");

            // config 모델은 이 앱에서 UI 환경이나 화면 상태를 전역적으로 다루기 위한 공간입니다.
            // 아직 값이 비어 있더라도, 이름 있는 모델로 마련해 두면 여러 뷰와 컨트롤러가 같은 상태를 바라볼 수 있습니다.
            this.setModel(new JSONModel(), "config");

            // 라우터를 초기화하면 manifest.json에 정의된 route와 target 규칙이 실제로 동작하기 시작합니다.
            // 사용자가 목록에서 상세로 이동하는 흐름도 이 시점 이후부터 주소와 화면이 함께 맞물려 움직입니다.
            this.getRouter().initialize();

        },

        /**
         * FlexibleColumnLayout의 Semantic Helper 객체를 반환합니다.
         *
         * 이 Helper는 현재 화면 상태와 사용자의 이동 흐름을 바탕으로
         * 다음에 어떤 컬럼 레이아웃을 사용하면 자연스러운지 알려 줍니다.
         *
         * 예를 들어 한 컬럼 화면에서 상세 화면으로 들어갈 때,
         * 또는 중간 컬럼을 닫고 다시 목록 중심의 화면으로 돌아갈 때,
         * 개발자가 모든 경우의 수를 직접 계산하지 않도록 도와주는 역할을 합니다.
         *
         * 또한 한 번 생성한 Helper를 this._oHelper에 보관해 둡니다.
         * 같은 안내자를 반복해서 새로 부르지 않고, 필요할 때마다 차분히 다시 쓰는 방식이라고 이해하면 됩니다.
         */
        getHelper() {

            // Helper는 앱의 FlexibleColumnLayout을 기준으로 동작하므로, 여러 번 만들 필요가 없습니다.
            // 아직 준비된 Helper가 없을 때만 생성하고, 이후 호출에서는 저장된 객체를 그대로 반환합니다.
            if (!this._oHelper) {

                // 루트 뷰 안에 선언된 FlexibleColumnLayout 컨트롤을 찾습니다.
                // 이 컨트롤이 실제로 여러 컬럼을 품는 무대이므로, Helper도 이 객체를 기준으로 동작합니다.
                var oFlexible = this.getRootControl().byId("idFlexibleColumnLayout");

                // Semantic Helper가 레이아웃을 판단할 때 참고할 기본 규칙입니다.
                // 처음에는 한 컬럼으로 시작하고, 필요할 때 최대 세 컬럼까지 확장할 수 있도록 설정합니다.
                var oSettings = {
                    defaultTwoColumnLayoutType: fioriLibrary.LayoutType.OneColumn, // "TwoColumnsMidExpanded",
                    initialColumnsCount: 1,
                    maxColumnsCount: 3
                };

                // 동일한 FlexibleColumnLayout에 대해 Helper 인스턴스를 가져온 뒤 Component 안에 보관합니다.
                // 이렇게 해 두면 각 컨트롤러는 Component의 getHelper()를 통해 같은 기준의 레이아웃 판단을 공유할 수 있습니다.
                this._oHelper = FCLSemanticHelper.getInstanceFor(oFlexible, oSettings);

            }
            
            // 이미 생성된 Helper를 반환합니다.
            // 호출하는 쪽에서는 내부적으로 새로 만들었는지, 기존 객체를 재사용했는지 신경 쓰지 않아도 됩니다.
            return this._oHelper;
        }
    });
});
