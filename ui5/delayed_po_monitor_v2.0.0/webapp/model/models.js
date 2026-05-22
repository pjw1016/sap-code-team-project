sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
], 
function (JSONModel, Device) {
    "use strict";

    return {
        /**
         * 현재 앱이 실행되는 기기 정보를 JSONModel로 제공한다.
         * UI5 표준 Device 객체를 감싸서 View에서 바인딩 가능한 모델로 만드는 역할이다.
         * 예: phone/tablet/desktop 여부에 따라 화면 표시를 다르게 만들 때 사용할 수 있다.
         *
         * @returns {sap.ui.model.json.JSONModel} The device model.
         */
        createDeviceModel: function () {
            // Device 객체는 브라우저/기기 정보를 담고 있으며, 앱에서 직접 수정할 값이 아니다.
            var oModel = new JSONModel(Device);

            // OneWay로 두면 View가 Device 값을 읽기만 하므로 불필요한 역방향 갱신을 막을 수 있다.
            oModel.setDefaultBindingMode("OneWay");
            return oModel;
        }
    };

});
