/*global QUnit*/

sap.ui.define([
	"code/d3/delayedpomonitor/controller/Main.controller"
], function (Controller) {
	"use strict";

	QUnit.module("Main Controller");

	QUnit.test("I should test the Main controller", function (assert) {
		var oAppController = new Controller();

		// onInit은 실제 View/Component가 붙은 런타임에서 실행된다.
		// 단위 테스트에서는 컨트롤러 생성 자체만 확인해 기본 생성 테스트가 View 의존성에 묶이지 않게 한다.
		assert.ok(oAppController);
	});

	QUnit.test("회사 설립일보다 과거 날짜는 기준일과 납기일 조건에서 오류로 처리한다", function (assert) {
		var oController = new Controller();

		// View/ResourceBundle 없이 날짜 검증 메소드만 단위 테스트하기 위해 필요한 의존성만 가볍게 대체한다.
		oController.getView = function () {
			return {
				getModel: function () {
					return {
						getProperty: function (sPath) {
							if (sPath === "/filters") {
								return {
									baseDate: new Date(2020, 2, 14),
									eindtFrom: new Date(2020, 2, 14),
									eindtTo: new Date(2020, 2, 14)
								};
							}
							return null;
						}
					};
				}
			};
		};
		oController._text = function (sKey) {
			return sKey;
		};

		assert.deepEqual(oController._validateDateRange(), [
			{
				inputId: "baseDatePicker",
				message: "validationDateBeforeCompanyStart"
			},
			{
				inputId: "eindtFromPicker",
				message: "validationDateBeforeCompanyStart"
			},
			{
				inputId: "eindtToPicker",
				message: "validationDateBeforeCompanyStart"
			}
		], "2020-03-14 이하는 세 날짜 필드 모두 회사 설립일 기준 오류로 누적된다.");
	});

	QUnit.test("회사 설립일 당일 날짜는 기준일과 납기일 조건에서 허용한다", function (assert) {
		var oController = new Controller();

		oController.getView = function () {
			return {
				getModel: function () {
					return {
						getProperty: function (sPath) {
							if (sPath === "/filters") {
								return {
									baseDate: new Date(2020, 2, 15),
									eindtFrom: new Date(2020, 2, 15),
									eindtTo: new Date(2020, 2, 15)
								};
							}
							return null;
						}
					};
				}
			};
		};
		oController._text = function (sKey) {
			return sKey;
		};

		assert.deepEqual(oController._validateDateRange(), [], "2020-03-15는 회사 설립일 당일이므로 오류가 아니다.");
	});

	QUnit.test("존재하지 않는 yyyy-MM-dd 날짜 문자열은 날짜 형식 오류로 처리한다", function (assert) {
		var oController = new Controller();

		oController.getView = function () {
			return {
				getModel: function () {
					return {
						getProperty: function (sPath) {
							if (sPath === "/filters") {
								return {
									baseDate: new Date(2026, 4, 1),
									eindtFrom: new Date(2026, 4, 1),
									eindtTo: new Date(2026, 4, 31)
								};
							}
							return null;
						}
					};
				}
			};
		};
		oController.byId = function (sInputId) {
			var mValues = {
				baseDatePicker: "2026-05-32",
				eindtFromPicker: "2026-06-31",
				eindtToPicker: "2026-05-31"
			};

			return {
				getValue: function () {
					return mValues[sInputId];
				}
			};
		};
		oController._text = function (sKey) {
			return sKey;
		};

		assert.deepEqual(oController._validateDateRange(), [
			{
				inputId: "baseDatePicker",
				message: "validationDateFormatInvalid"
			},
			{
				inputId: "eindtFromPicker",
				message: "validationDateFormatInvalid"
			}
		], "2026-05-32와 2026-06-31은 실제 존재하지 않는 날짜이므로 오류로 누적된다.");
	});

});
