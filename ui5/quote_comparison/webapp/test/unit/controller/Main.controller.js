/*global QUnit*/

sap.ui.define([
	"code/d3/quotecomparison/controller/Main.controller"
], function (Controller) {
	"use strict";

	QUnit.module("Main Controller");

	function createControllerWithFakeView() {
		var oAppController = new Controller();
		var mModels = {};
		var oFakeView = {
			setModel: function (oModel, sName) {
				mModels[sName] = oModel;
			},
			getModel: function (sName) {
				return mModels[sName];
			}
		};

		oAppController.getView = function () {
			return oFakeView;
		};

		return {
			controller: oAppController,
			models: mModels
		};
	}

	QUnit.test("onInit should create initial view, filter, and work models", function (assert) {
		var oFixture = createControllerWithFakeView();

		oFixture.controller.onInit();

		assert.strictEqual(oFixture.models.view.getProperty("/FclLayout"), "OneColumn", "FCL starts with only Begin column visible.");
		assert.strictEqual(oFixture.models.view.getProperty("/AdvancedFilterVisible"), false, "Advanced filter starts hidden.");
		assert.deepEqual(oFixture.models.filter.getProperty("/AwardStatus"), [], "Award status filter starts empty for multi-select binding.");
		assert.strictEqual(oFixture.models.work.getProperty("/RfqHeaderCount"), 0, "RFQ header count starts at zero.");
		assert.deepEqual(oFixture.models.work.getProperty("/RfqHeaders"), [], "RFQ header list starts empty.");
	});

	QUnit.test("onToggleAdvancedFilter should switch advanced filter visibility", function (assert) {
		var oFixture = createControllerWithFakeView();

		oFixture.controller.onInit();
		oFixture.controller.onToggleAdvancedFilter();
		assert.strictEqual(oFixture.models.view.getProperty("/AdvancedFilterVisible"), true, "Advanced filter is shown after first toggle.");

		oFixture.controller.onToggleAdvancedFilter();
		assert.strictEqual(oFixture.models.view.getProperty("/AdvancedFilterVisible"), false, "Advanced filter is hidden after second toggle.");
	});

	QUnit.test("onRfqSelectionChange should open the Mid column", function (assert) {
		var oFixture = createControllerWithFakeView();

		oFixture.controller.onInit();
		oFixture.controller.onRfqSelectionChange({
			getParameter: function () {
				return {
					getBindingContext: function () {
						return {
							getObject: function () {
								return {
									RfqNo: "5000000123",
									AwardStatusText: "미채택"
								};
							}
						};
					}
				};
			}
		});

		assert.strictEqual(oFixture.models.view.getProperty("/FclLayout"), "TwoColumnsMidExpanded", "Selecting an RFQ opens the Mid column.");
		assert.strictEqual(oFixture.models.work.getProperty("/SelectedRfq/RfqNo"), "5000000123", "Selected RFQ is stored for the Mid column header.");
	});

});
