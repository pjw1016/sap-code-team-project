sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
], 
function (JSONModel, Device) {
    "use strict";

    return {
        /**
         * UI5 앱이 실행 중인 기기 정보를 JSONModel로 제공한다.
         * 화면 크기, 터치 지원 여부 같은 값은 레이아웃 반응형 처리에 사용된다.
         * @returns {sap.ui.model.json.JSONModel} 기기 정보 모델
         */
        createDeviceModel: function () {
            var oModel = new JSONModel(Device);
            oModel.setDefaultBindingMode("OneWay");
            return oModel;
        }
    };

});
