/*global QUnit*/

sap.ui.define([
	"code/d3/quotecomparison/controller/Main.controller"
], function (Controller) {
	"use strict";

	QUnit.module("Main Controller");

	function createControllerWithFakeView(oOptions) {
		var oAppController = new Controller();
		var mModels = {};

		oOptions = oOptions || {};

		var oFakeView = {
			setModel: function (oModel, sName) {
				mModels[sName] = oModel;
			},
			getModel: function (sName) {
				return mModels[sName];
			},
			byId: function (sId) {
				return oOptions.controls && oOptions.controls[sId];
			}
		};

		oAppController.getView = function () {
			return oFakeView;
		};

		oAppController.byId = function (sId) {
			return oFakeView.byId(sId);
		};

		oAppController.getOwnerComponent = function () {
			return {
				getModel: function () {
					return oOptions.odataModel || null;
				}
			};
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
		var oFixture = createControllerWithFakeView({
			odataModel: {
				read: function (sPath, mParameters) {
					assert.strictEqual(sPath, "/RFQItemSet", "Selecting an RFQ starts the RFQ item query.");
					mParameters.success({
						results: []
					});
				}
			}
		});

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

	QUnit.test("onRfqSelectionChange should load RFQItemSet for the selected RFQ", function (assert) {
		var done = assert.async();
		var oRfq = {
			RfqNo: "5000000123",
			AwardStatusText: "미채택"
		};
		var aItems = [{
			RfqNo: "5000000123",
			RfqItem: "00010",
			Matnr: "100001",
			Maktx: "Bolt M10",
			ItemStatusText: "미채택",
			ItemStatusState: "None"
		}];
		var oFixture = createControllerWithFakeView({
			odataModel: {
				read: function (sPath, mParameters) {
					assert.strictEqual(sPath, "/RFQItemSet", "RFQItemSet is read when a header is selected.");
					assert.strictEqual(mParameters.filters.length, 1, "The selected RFQ is passed as one filter.");
					assert.strictEqual(mParameters.filters[0].sPath, "RfqNo", "RFQ item query filters by RfqNo.");
					assert.strictEqual(mParameters.filters[0].sOperator, "EQ", "RFQ item query uses exact RFQ number matching.");
					assert.strictEqual(mParameters.filters[0].oValue1, "5000000123", "Selected RFQ number is used as the filter value.");
					mParameters.success({
						results: aItems
					});
				}
			}
		});

		oFixture.controller.onInit();

		oFixture.controller.onRfqSelectionChange({
			getParameter: function () {
				return {
					getBindingContext: function () {
						return {
							getObject: function () {
								return oRfq;
							}
						};
					}
				};
			}
		}).then(function () {
			assert.deepEqual(oFixture.models.work.getProperty("/RfqItems"), aItems, "RFQ item rows are stored in the work model.");
			assert.deepEqual(oFixture.models.work.getProperty("/MqCompareRows"), [], "Previous MQ compare rows are cleared before item drilldown.");
			assert.deepEqual(oFixture.models.work.getProperty("/ChartRows"), [], "Previous chart rows are cleared before item drilldown.");
			done();
		});
	});

	QUnit.test("onRfqItemSelectionChange should keep selected item and clear stale MQ data", function (assert) {
		var oFixture = createControllerWithFakeView();
		var oRfqItem = {
			RfqNo: "5000000123",
			RfqItem: "00010",
			Matnr: "100001",
			Maktx: "Bolt M10",
			CanCancelAward: "X"
		};

		oFixture.controller.onInit();
		oFixture.models.work.setProperty("/SelectedMq", {
			MqNo: "MQ70000001",
			MqItem: "00010"
		});
		oFixture.models.work.setProperty("/MqCompareRows", [{
			MqNo: "MQ70000001",
			UiSelected: true
		}]);
		oFixture.models.work.setProperty("/ChartRows", [{
			Name1: "기존 공급업체",
			NetwrKrw: 1000
		}]);

		oFixture.controller.onRfqItemSelectionChange({
			getParameter: function () {
				return {
					getBindingContext: function () {
						return {
							getObject: function () {
								return oRfqItem;
							}
						};
					}
				};
			}
		});

		assert.deepEqual(oFixture.models.work.getProperty("/SelectedRfqItem"), oRfqItem, "Selected RFQ item is stored for the comparison area.");
		assert.deepEqual(oFixture.models.work.getProperty("/SelectedMq"), {}, "Previous MQ selection is cleared.");
		assert.deepEqual(oFixture.models.work.getProperty("/MqCompareRows"), [], "Previous MQ compare rows are cleared.");
		assert.deepEqual(oFixture.models.work.getProperty("/ChartRows"), [], "Previous chart rows are cleared.");
	});

	QUnit.test("onRfqItemSelectionChange should load MQCompareSet for the selected RFQ item", function (assert) {
		var done = assert.async();
		var oRfqItem = {
			RfqNo: "5000000123",
			RfqItem: "00010",
			Matnr: "100001",
			Maktx: "Bolt M10"
		};
		var aMqRows = [{
			RfqNo: "5000000123",
			RfqItem: "00010",
			MqNo: "MQ70000001",
			MqItem: "00010",
			Lifnr: "V001",
			Name1: "삼만리 부품"
		}];
		var oFixture = createControllerWithFakeView({
			odataModel: {
				read: function (sPath, mParameters) {
					assert.strictEqual(sPath, "/MQCompareSet", "RFQ item selection reads MQCompareSet.");
					assert.strictEqual(mParameters.filters.length, 2, "MQ compare query sends RFQ number and item filters.");
					assert.strictEqual(mParameters.filters[0].sPath, "RfqNo", "First filter is RfqNo.");
					assert.strictEqual(mParameters.filters[0].sOperator, "EQ", "RfqNo uses exact matching.");
					assert.strictEqual(mParameters.filters[0].oValue1, "5000000123", "Selected RFQ number is used.");
					assert.strictEqual(mParameters.filters[1].sPath, "RfqItem", "Second filter is RfqItem.");
					assert.strictEqual(mParameters.filters[1].sOperator, "EQ", "RfqItem uses exact matching.");
					assert.strictEqual(mParameters.filters[1].oValue1, "00010", "Selected RFQ item is used.");
					mParameters.success({
						results: aMqRows
					});
				}
			}
		});

		oFixture.controller.onInit();

		oFixture.controller.onRfqItemSelectionChange({
			getParameter: function () {
				return {
					getBindingContext: function () {
						return {
							getObject: function () {
								return oRfqItem;
							}
						};
					}
				};
			}
		}).then(function () {
			assert.deepEqual(oFixture.models.work.getProperty("/SelectedRfqItem"), oRfqItem, "Selected RFQ item remains stored.");
			assert.deepEqual(oFixture.models.work.getProperty("/MqCompareRows"), [{
				RfqNo: "5000000123",
				RfqItem: "00010",
				MqNo: "MQ70000001",
				MqItem: "00010",
				Lifnr: "V001",
				Name1: "삼만리 부품",
				UiSelected: false
			}], "MQ compare rows are stored with no selected MQ yet.");
			assert.deepEqual(oFixture.models.work.getProperty("/SelectedMq"), {}, "No MQ is selected automatically.");
			done();
		});
	});

	QUnit.test("Mid column navigation actions should switch the FCL layout", function (assert) {
		var oFixture = createControllerWithFakeView();

		oFixture.controller.onInit();
		oFixture.models.view.setProperty("/FclLayout", "TwoColumnsMidExpanded");

		oFixture.controller.onEnterMidFullScreen();
		assert.strictEqual(oFixture.models.view.getProperty("/FclLayout"), "MidColumnFullScreen", "Full screen action expands the Mid column.");

		oFixture.controller.onExitMidFullScreen();
		assert.strictEqual(oFixture.models.view.getProperty("/FclLayout"), "TwoColumnsMidExpanded", "Exit full screen returns to the two-column comparison layout.");
	});

	QUnit.test("Mid column close action should clear the selected RFQ context", function (assert) {
		var oFixture = createControllerWithFakeView();

		oFixture.controller.onInit();
		oFixture.models.work.setProperty("/SelectedRfq", {
			RfqNo: "5000000123"
		});
		oFixture.models.work.setProperty("/RfqItems", [{ RfqItem: "00010" }]);
		oFixture.models.view.setProperty("/FclLayout", "TwoColumnsMidExpanded");

		oFixture.controller.onCloseMidColumn();

		assert.strictEqual(oFixture.models.view.getProperty("/FclLayout"), "OneColumn", "Close action returns to the Begin column only.");
		assert.deepEqual(oFixture.models.work.getProperty("/SelectedRfq"), {}, "Selected RFQ header is cleared.");
		assert.deepEqual(oFixture.models.work.getProperty("/RfqItems"), [], "RFQ item rows are cleared with the closed Mid column.");
	});

	QUnit.test("_clearRfqItemDependentArea should clear remembered RFQ item table selection", function (assert) {
		var bRemoveAll;
		var oFixture = createControllerWithFakeView({
			controls: {
				idRfqItemTable: {
					removeSelections: function (bAll) {
						bRemoveAll = bAll;
					}
				}
			}
		});

		oFixture.controller.onInit();
		oFixture.models.work.setProperty("/RfqItems", [{ RfqItem: "00010" }]);
		oFixture.models.work.setProperty("/SelectedRfqItem", { RfqItem: "00010" });
		oFixture.models.work.setProperty("/MqCompareRows", [{ MqNo: "MQ70000001" }]);

		oFixture.controller._clearRfqItemDependentArea();

		assert.strictEqual(bRemoveAll, true, "All remembered sap.m.Table selections are removed.");
		assert.deepEqual(oFixture.models.work.getProperty("/RfqItems"), [], "RFQ item rows are cleared.");
		assert.deepEqual(oFixture.models.work.getProperty("/SelectedRfqItem"), {}, "Selected RFQ item model state is cleared.");
		assert.deepEqual(oFixture.models.work.getProperty("/MqCompareRows"), [], "MQ compare rows are cleared.");
	});

	QUnit.test("_clearSelectionAndComparisonArea should clear remembered header and item table selections", function (assert) {
		var mRemoveAll = {};
		var oFixture = createControllerWithFakeView({
			controls: {
				idRfqHeaderTable: {
					removeSelections: function (bAll) {
						mRemoveAll.header = bAll;
					}
				},
				idRfqItemTable: {
					removeSelections: function (bAll) {
						mRemoveAll.item = bAll;
					}
				}
			}
		});

		oFixture.controller.onInit();
		oFixture.models.view.setProperty("/FclLayout", "TwoColumnsMidExpanded");
		oFixture.models.work.setProperty("/SelectedRfq", { RfqNo: "5000000123" });
		oFixture.models.work.setProperty("/SelectedRfqItem", { RfqItem: "00010" });

		oFixture.controller._clearSelectionAndComparisonArea();

		assert.deepEqual(mRemoveAll, { header: true, item: true }, "All remembered sap.m.Table selections are removed.");
		assert.strictEqual(oFixture.models.view.getProperty("/FclLayout"), "OneColumn", "FCL layout is reset.");
		assert.deepEqual(oFixture.models.work.getProperty("/SelectedRfq"), {}, "Selected RFQ header is cleared.");
		assert.deepEqual(oFixture.models.work.getProperty("/SelectedRfqItem"), {}, "Selected RFQ item is cleared.");
	});

	QUnit.test("_buildHeaderFilters should convert filter model to OData filters", function (assert) {
		var oFixture = createControllerWithFakeView();
		var aFilters;
		var oStatusFilter;

		oFixture.controller.onInit();
		oFixture.models.filter.setData({
			RfqNo: "5000000123",
			DocDateFrom: new Date(2026, 4, 1),
			DocDateTo: new Date(2026, 4, 31),
			AwardStatus: ["N", "P"],
			Lifnr: "SUP001",
			Name1: "ABC",
			Matnr: "100001",
			Maktx: "Bolt",
			Werks: "P001",
			EindtFrom: new Date(2026, 5, 1),
			EindtTo: new Date(2026, 5, 30),
			MqNo: "MQ70000001",
			Bukrs: "1000",
			Ekorg: "1010",
			Ekgrp: "001"
		});

		aFilters = oFixture.controller._buildHeaderFilters();
		oStatusFilter = aFilters[aFilters.length - 1];

		assert.strictEqual(aFilters.length, 15, "All filled search conditions become OData filters.");
		assert.strictEqual(aFilters[0].sPath, "RfqNo", "RFQ number uses RfqNo property.");
		assert.strictEqual(aFilters[0].sOperator, "EQ", "RFQ number uses EQ operator.");
		assert.strictEqual(aFilters[1].sPath, "DocDate", "Document date from uses DocDate property.");
		assert.strictEqual(aFilters[1].sOperator, "GE", "Document date from uses GE operator.");
		assert.strictEqual(aFilters[2].sOperator, "LE", "Document date to uses LE operator.");
		assert.notOk(oStatusFilter.bAnd, "Multiple award statuses are grouped with OR.");
		assert.strictEqual(oStatusFilter.aFilters.length, 2, "Two selected award statuses create two inner filters.");
	});

	QUnit.test("onSearch should load RFQHeaderSet and update Begin column models", function (assert) {
		var done = assert.async();
		var oHeader = {
			RfqNo: "5000000123",
			DocDate: new Date(2026, 4, 20),
			RfqItemCount: 4,
			MqCount: 8,
			VendorCount: 3,
			AwardStatus: "N",
			AwardStatusText: "미채택",
			AwardStatusState: "None"
		};
		var oFixture = createControllerWithFakeView({
			odataModel: {
				read: function (sPath, mParameters) {
					if (sPath === "/RFQHeaderSet") {
						assert.ok(Array.isArray(mParameters.filters), "OData filters are passed as an array.");
						mParameters.success({
							results: [oHeader]
						});
						return;
					}

					assert.strictEqual(sPath, "/RFQItemSet", "Single RFQ header result also starts the RFQ item query.");
					mParameters.success({
						results: []
					});
				}
			}
		});

		oFixture.controller.onInit();
		oFixture.models.filter.setProperty("/RfqNo", "5000000123");

		oFixture.controller.onSearch().then(function () {
			assert.strictEqual(oFixture.models.work.getProperty("/RfqHeaderCount"), 1, "Header count is updated.");
			assert.deepEqual(oFixture.models.work.getProperty("/RfqHeaders"), [oHeader], "Header rows are stored in the work model.");
			assert.strictEqual(oFixture.models.work.getProperty("/Kpi/NotAwarded"), 1, "KPI for not awarded headers is calculated.");
			assert.strictEqual(oFixture.models.view.getProperty("/FclLayout"), "TwoColumnsMidExpanded", "Single result opens Mid column automatically.");
			assert.strictEqual(oFixture.models.work.getProperty("/SelectedRfq/RfqNo"), "5000000123", "Single result is stored as selected RFQ.");
			done();
		});
	});

});
