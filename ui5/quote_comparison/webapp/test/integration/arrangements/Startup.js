sap.ui.define([
	"sap/ui/test/Opa5"
], function (Opa5) {
	"use strict";

	return Opa5.extend("integration.arrangements.Startup", {

		iStartMyApp: function (oOptionsParameter) {
			var oOptions = oOptionsParameter || {};

			// 테스트 속도는 유지하되 비동기 타이밍 문제도 드러나도록 최소 지연 시간을 둔다.
			oOptions.delay = oOptions.delay || 50;

			// 실제 앱과 같은 Component 설정으로 OPA 테스트 대상 UI를 시작한다.
			this.iStartMyUIComponent({
				componentConfig: {
					name: "code.d3.quotecomparison",
					async: true
				},
				hash: oOptions.hash,
				autoWait: oOptions.autoWait
			});
		}
	});
});
