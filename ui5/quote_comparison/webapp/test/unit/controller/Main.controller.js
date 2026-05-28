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

	QUnit.test("onRfqItemSelectionChange should prepare chart rows from valid MQ compare rows", function (assert) {
		var done = assert.async();
		var oRfqItem = {
			RfqNo: "5000000123",
			RfqItem: "00010"
		};
		var aMqRows = [{
			RfqNo: "5000000123",
			RfqItem: "00010",
			MqNo: "MQ70000001",
			MqItem: "00010",
			Name1: "Supplier A",
			NetwrKrw: "120000",
			ResponseStatus: "R",
			RecommendYn: "X",
			CurrentAwardYn: ""
		}, {
			RfqNo: "5000000123",
			RfqItem: "00010",
			MqNo: "MQ70000002",
			MqItem: "00010",
			Name1: "Supplier B",
			NetwrKrw: "0",
			ResponseStatus: "N",
			RecommendYn: "",
			CurrentAwardYn: ""
		}];
		var oFixture = createControllerWithFakeView({
			odataModel: {
				read: function (sPath, mParameters) {
					assert.strictEqual(sPath, "/MQCompareSet", "RFQ item selection reads MQCompareSet.");
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
			assert.deepEqual(oFixture.models.work.getProperty("/ChartRows"), [{
				RfqNo: "5000000123",
				RfqItem: "00010",
				MqNo: "MQ70000001",
				MqItem: "00010",
				Name1: "Supplier A",
				NetwrKrw: 120000,
				RecommendYn: "X",
				CurrentAwardYn: ""
			}], "Only valid responded MQ rows with KRW amount are prepared for the chart.");
			done();
		});
	});

	QUnit.test("onMqRadioSelect should keep only one selectable MQ selected", function (assert) {
		var aRows = [{
			RfqNo: "5000000123",
			RfqItem: "00010",
			MqNo: "MQ70000001",
			MqItem: "00010",
			Lifnr: "V001",
			Name1: "Supplier A",
			CanSelect: "X",
			RecommendYn: "",
			CurrentAwardYn: "",
			UiSelected: true
		}, {
			RfqNo: "5000000123",
			RfqItem: "00010",
			MqNo: "MQ70000002",
			MqItem: "00010",
			Lifnr: "V002",
			Name1: "Supplier B",
			CanSelect: "X",
			RecommendYn: "X",
			CurrentAwardYn: "",
			UiSelected: false
		}];
		var oFixture = createControllerWithFakeView();

		oFixture.controller.onInit();
		oFixture.models.work.setProperty("/MqCompareRows", aRows);

		oFixture.controller.onMqRadioSelect({
			getSource: function () {
				return {
					getBindingContext: function () {
						return {
							getObject: function () {
								return aRows[1];
							}
						};
					}
				};
			}
		});

		assert.strictEqual(oFixture.models.work.getProperty("/MqCompareRows/0/UiSelected"), false, "Previous MQ selection is cleared.");
		assert.strictEqual(oFixture.models.work.getProperty("/MqCompareRows/1/UiSelected"), true, "Selected MQ row remains selected.");
		assert.deepEqual(oFixture.models.work.getProperty("/SelectedMq"), {
			RfqNo: "5000000123",
			RfqItem: "00010",
			MqNo: "MQ70000002",
			MqItem: "00010",
			Lifnr: "V002",
			Name1: "Supplier B",
			CanSelect: "X",
			BlockReason: undefined,
			RecommendYn: "X",
			CurrentAwardYn: ""
		}, "Selected MQ is stored for award actions.");
	});

	QUnit.test("onMqRadioSelect should ignore MQ rows that cannot be selected", function (assert) {
		var aRows = [{
			RfqNo: "5000000123",
			RfqItem: "00010",
			MqNo: "MQ70000001",
			MqItem: "00010",
			CanSelect: "X",
			UiSelected: true
		}, {
			RfqNo: "5000000123",
			RfqItem: "00010",
			MqNo: "MQ70000002",
			MqItem: "00010",
			CanSelect: "",
			BlockReason: "미응답 MQ는 채택할 수 없습니다.",
			UiSelected: false
		}];
		var oFixture = createControllerWithFakeView();
		var oPreviousSelectedMq = {
			MqNo: "MQ70000001",
			MqItem: "00010"
		};

		oFixture.controller.onInit();
		oFixture.models.work.setProperty("/MqCompareRows", aRows);
		oFixture.models.work.setProperty("/SelectedMq", oPreviousSelectedMq);

		oFixture.controller.onMqRadioSelect({
			getSource: function () {
				return {
					getBindingContext: function () {
						return {
							getObject: function () {
								return aRows[1];
							}
						};
					}
				};
			}
		});

		assert.strictEqual(oFixture.models.work.getProperty("/MqCompareRows/0/UiSelected"), true, "Previous valid selection is kept.");
		assert.strictEqual(oFixture.models.work.getProperty("/MqCompareRows/1/UiSelected"), false, "Unselectable MQ row is not selected.");
		assert.deepEqual(oFixture.models.work.getProperty("/SelectedMq"), oPreviousSelectedMq, "Selected MQ model is not overwritten by an unselectable row.");
	});

	QUnit.test("onOpenMqDetailFromRow should read detail for the clicked MQ row regardless of selectability", function (assert) {
		var done = assert.async();
		var oClickedRow = {
			MqNo: "MQ70000003",
			MqItem: "00020",
			CanSelect: "",
			CurrentAwardYn: "X"
		};
		var oDetail = {
			MqNo: "MQ70000003",
			MqItem: "00020",
			Name1: "Awarded Supplier",
			CanSelect: "",
			CurrentAwardYn: "X"
		};
		var bDialogOpened = false;
		var oFixture = createControllerWithFakeView({
			odataModel: {
				read: function (sPath, mParameters) {
					assert.strictEqual(sPath, "/MQDetailSet(MqNo='MQ70000003',MqItem='00020')", "The clicked MQ row is used as the detail key.");
					mParameters.success(oDetail);
				}
			}
		});

		oFixture.controller.onInit();
		oFixture.controller._openMqDetailDialog = function () {
			bDialogOpened = true;
			return Promise.resolve();
		};

		oFixture.controller.onOpenMqDetailFromRow({
			getSource: function () {
				return {
					getBindingContext: function () {
						return {
							getObject: function () {
								return oClickedRow;
							}
						};
					}
				};
			}
		}).then(function () {
			assert.deepEqual(oFixture.models.detail.getProperty("/MqDetail"), oDetail, "MQ detail data is stored in the detail model.");
			assert.ok(bDialogOpened, "MQ detail dialog is opened after the detail read.");
			done();
		});
	});

	QUnit.test("onOpenMqDetail should read detail for the currently selected MQ", function (assert) {
		var done = assert.async();
		var oSelectedMq = {
			MqNo: "MQ70000004",
			MqItem: "00010"
		};
		var oDetail = {
			MqNo: "MQ70000004",
			MqItem: "00010",
			Name1: "Selected Supplier",
			CanSelect: "X"
		};
		var oFixture = createControllerWithFakeView({
			odataModel: {
				read: function (sPath, mParameters) {
					assert.strictEqual(sPath, "/MQDetailSet(MqNo='MQ70000004',MqItem='00010')", "Selected MQ is used as the detail key.");
					mParameters.success(oDetail);
				}
			}
		});

		oFixture.controller.onInit();
		oFixture.models.work.setProperty("/SelectedMq", oSelectedMq);
		oFixture.controller._openMqDetailDialog = function () {
			return Promise.resolve();
		};

		oFixture.controller.onOpenMqDetail().then(function () {
			assert.deepEqual(oFixture.models.detail.getProperty("/MqDetail"), oDetail, "Selected MQ detail data is stored in the detail model.");
			done();
		});
	});

	QUnit.test("onSelectMqFromDialog should select a selectable detail MQ from the compare rows", function (assert) {
		var bDialogClosed = false;
		var aRows = [{
			RfqNo: "5000000123",
			RfqItem: "00010",
			MqNo: "MQ70000001",
			MqItem: "00010",
			Lifnr: "V001",
			Name1: "Supplier A",
			CanSelect: "X",
			RecommendYn: "",
			CurrentAwardYn: "",
			UiSelected: false
		}, {
			RfqNo: "5000000123",
			RfqItem: "00010",
			MqNo: "MQ70000002",
			MqItem: "00010",
			Lifnr: "V002",
			Name1: "Supplier B",
			CanSelect: "X",
			RecommendYn: "X",
			CurrentAwardYn: "",
			UiSelected: false
		}];
		var oFixture = createControllerWithFakeView();

		oFixture.controller.onInit();
		oFixture.models.work.setProperty("/MqCompareRows", aRows);
		oFixture.models.detail.setProperty("/MqDetail", {
			MqNo: "MQ70000002",
			MqItem: "00010",
			CanSelect: "X"
		});
		oFixture.controller.onCloseMqDetailDialog = function () {
			bDialogClosed = true;
		};

		oFixture.controller.onSelectMqFromDialog();

		assert.strictEqual(oFixture.models.work.getProperty("/MqCompareRows/0/UiSelected"), false, "Other MQ rows remain unselected.");
		assert.strictEqual(oFixture.models.work.getProperty("/MqCompareRows/1/UiSelected"), true, "Dialog MQ row is selected in the compare table.");
		assert.strictEqual(oFixture.models.work.getProperty("/SelectedMq/MqNo"), "MQ70000002", "Dialog MQ is stored as the award target.");
		assert.strictEqual(oFixture.models.work.getProperty("/SelectedMq/RecommendYn"), "X", "Selected MQ uses the compare row data, not only the detail payload.");
		assert.ok(bDialogClosed, "Dialog is closed after a successful selectable MQ selection.");
	});

	QUnit.test("onSelectMqFromDialog should ignore an unselectable detail MQ", function (assert) {
		var bDialogClosed = false;
		var oPreviousSelectedMq = {
			MqNo: "MQ70000001",
			MqItem: "00010"
		};
		var aRows = [{
			RfqNo: "5000000123",
			RfqItem: "00010",
			MqNo: "MQ70000001",
			MqItem: "00010",
			CanSelect: "X",
			UiSelected: true
		}, {
			RfqNo: "5000000123",
			RfqItem: "00010",
			MqNo: "MQ70000003",
			MqItem: "00010",
			CanSelect: "",
			BlockReason: "이미 채택된 견적입니다.",
			UiSelected: false
		}];
		var oFixture = createControllerWithFakeView();

		oFixture.controller.onInit();
		oFixture.models.work.setProperty("/MqCompareRows", aRows);
		oFixture.models.work.setProperty("/SelectedMq", oPreviousSelectedMq);
		oFixture.models.detail.setProperty("/MqDetail", {
			MqNo: "MQ70000003",
			MqItem: "00010",
			CanSelect: "",
			BlockReason: "이미 채택된 견적입니다."
		});
		oFixture.controller.onCloseMqDetailDialog = function () {
			bDialogClosed = true;
		};

		oFixture.controller.onSelectMqFromDialog();

		assert.strictEqual(oFixture.models.work.getProperty("/MqCompareRows/0/UiSelected"), true, "Previous selection remains selected.");
		assert.strictEqual(oFixture.models.work.getProperty("/MqCompareRows/1/UiSelected"), false, "Unselectable detail MQ is not selected.");
		assert.deepEqual(oFixture.models.work.getProperty("/SelectedMq"), oPreviousSelectedMq, "Selected MQ is not overwritten.");
		assert.notOk(bDialogClosed, "Dialog stays open so the user can read the block reason.");
	});

	QUnit.test("onApplyAutoRecommend should select the recommended MQ only when it is selectable", function (assert) {
		var aRows = [{
			RfqNo: "5000000123",
			RfqItem: "00010",
			MqNo: "MQ70000001",
			MqItem: "00010",
			Lifnr: "V001",
			Name1: "Supplier A",
			RecommendYn: "X",
			CanSelect: "",
			BlockReason: "이미 채택된 견적입니다.",
			UiSelected: false
		}, {
			RfqNo: "5000000123",
			RfqItem: "00010",
			MqNo: "MQ70000002",
			MqItem: "00010",
			Lifnr: "V002",
			Name1: "Supplier B",
			RecommendYn: "X",
			CanSelect: "X",
			CurrentAwardYn: "",
			UiSelected: false
		}];
		var oFixture = createControllerWithFakeView();

		oFixture.controller.onInit();
		oFixture.models.work.setProperty("/MqCompareRows", aRows);

		oFixture.controller.onApplyAutoRecommend();

		assert.strictEqual(oFixture.models.work.getProperty("/MqCompareRows/0/UiSelected"), false, "Recommended but unselectable MQ remains unselected.");
		assert.strictEqual(oFixture.models.work.getProperty("/MqCompareRows/1/UiSelected"), true, "Recommended and selectable MQ is selected.");
		assert.strictEqual(oFixture.models.work.getProperty("/SelectedMq/MqNo"), "MQ70000002", "Selectable recommended MQ becomes the award target.");
	});

	QUnit.test("onApplyAutoRecommend should keep the current selection when no selectable recommendation exists", function (assert) {
		var sToastMessage = "";
		var oPreviousSelectedMq = {
			MqNo: "MQ70000001",
			MqItem: "00010"
		};
		var aRows = [{
			RfqNo: "5000000123",
			RfqItem: "00010",
			MqNo: "MQ70000001",
			MqItem: "00010",
			RecommendYn: "",
			CanSelect: "X",
			UiSelected: true
		}, {
			RfqNo: "5000000123",
			RfqItem: "00010",
			MqNo: "MQ70000003",
			MqItem: "00010",
			RecommendYn: "X",
			CanSelect: "",
			BlockReason: "미응답 MQ는 채택할 수 없습니다.",
			UiSelected: false
		}];
		var oFixture = createControllerWithFakeView();

		oFixture.controller.onInit();
		oFixture.models.work.setProperty("/MqCompareRows", aRows);
		oFixture.models.work.setProperty("/SelectedMq", oPreviousSelectedMq);
		oFixture.controller._showToast = function (sMessage) {
			sToastMessage = sMessage;
		};
		oFixture.controller._getText = function (sKey) {
			return sKey === "msgNoSelectableRecommend" ? "선택 가능한 추천 MQ가 없습니다." : "";
		};

		oFixture.controller.onApplyAutoRecommend();

		assert.strictEqual(oFixture.models.work.getProperty("/MqCompareRows/0/UiSelected"), true, "Previous selection remains selected.");
		assert.strictEqual(oFixture.models.work.getProperty("/MqCompareRows/1/UiSelected"), false, "Unselectable recommended MQ is not selected.");
		assert.deepEqual(oFixture.models.work.getProperty("/SelectedMq"), oPreviousSelectedMq, "Selected MQ is not overwritten.");
		assert.strictEqual(sToastMessage, "선택 가능한 추천 MQ가 없습니다.", "User is informed when no selectable recommendation exists.");
	});

	QUnit.test("onSaveAward should MERGE AWARD for the selected MQ and refresh comparison data", function (assert) {
		var done = assert.async();
		var bRefreshed = false;
		var sToastMessage = "";
		var oFixture = createControllerWithFakeView({
			odataModel: {
				update: function (sPath, oPayload, mParameters) {
					assert.strictEqual(sPath, "/QuotationItemSet(MqNo='MQ70000002',MqItem='00010')", "Selected MQ key is used for QuotationItemSet MERGE.");
					assert.deepEqual(oPayload, {
						MqNo: "MQ70000002",
						MqItem: "00010",
						ActionType: "AWARD"
					}, "AWARD payload is sent to the backend.");
					assert.strictEqual(mParameters.merge, true, "OData update is sent as MERGE.");
					mParameters.success();
				}
			}
		});

		oFixture.controller.onInit();
		oFixture.models.work.setProperty("/SelectedMq", {
			MqNo: "MQ70000002",
			MqItem: "00010",
			CanSelect: "X"
		});
		oFixture.controller._confirmAction = function () {
			return Promise.resolve(true);
		};
		oFixture.controller._refreshAfterAward = function () {
			bRefreshed = true;
			return Promise.resolve();
		};
		oFixture.controller._showToast = function (sMessage) {
			sToastMessage = sMessage;
		};
		oFixture.controller._getText = function (sKey) {
			return sKey === "msgAwardSuccess" ? "견적이 채택되었습니다." : "선택한 MQ를 채택하시겠습니까?";
		};

		oFixture.controller.onSaveAward().then(function () {
			assert.strictEqual(sToastMessage, "견적이 채택되었습니다.", "Success message is shown after successful MERGE.");
			assert.ok(bRefreshed, "RFQ item and MQ comparison data are refreshed after successful AWARD.");
			assert.strictEqual(oFixture.models.view.getProperty("/Busy"), false, "Busy state is cleared after the update flow.");
			done();
		});
	});

	QUnit.test("onSaveAward should not call MERGE when no MQ is selected", function (assert) {
		var bUpdateCalled = false;
		var sToastMessage = "";
		var oFixture = createControllerWithFakeView({
			odataModel: {
				update: function () {
					bUpdateCalled = true;
				}
			}
		});

		oFixture.controller.onInit();
		oFixture.controller._showToast = function (sMessage) {
			sToastMessage = sMessage;
		};
		oFixture.controller._getText = function (sKey) {
			return sKey === "msgSelectMq" ? "채택할 MQ를 선택하세요." : "";
		};

		return oFixture.controller.onSaveAward().then(function () {
			assert.notOk(bUpdateCalled, "Backend update is not called without a selected MQ.");
			assert.strictEqual(sToastMessage, "채택할 MQ를 선택하세요.", "User is asked to select an MQ first.");
		});
	});

	QUnit.test("onCancelAward should MERGE CANCEL for the awarded MQ and refresh comparison data", function (assert) {
		var done = assert.async();
		var bRefreshed = false;
		var sToastMessage = "";
		var oFixture = createControllerWithFakeView({
			odataModel: {
				update: function (sPath, oPayload, mParameters) {
					assert.strictEqual(sPath, "/QuotationItemSet(MqNo='MQ70000002',MqItem='00010')", "Awarded MQ key is used for QuotationItemSet MERGE.");
					assert.deepEqual(oPayload, {
						MqNo: "MQ70000002",
						MqItem: "00010",
						ActionType: "CANCEL"
					}, "CANCEL payload is sent to the backend.");
					assert.strictEqual(mParameters.merge, true, "OData update is sent as MERGE.");
					mParameters.success();
				}
			}
		});

		oFixture.controller.onInit();
		oFixture.models.work.setProperty("/SelectedRfqItem", {
			RfqNo: "5000000123",
			RfqItem: "00010",
			AwardMqNo: "MQ70000002",
			AwardMqItem: "00010",
			CanCancelAward: "X"
		});
		oFixture.controller._confirmAction = function () {
			return Promise.resolve(true);
		};
		oFixture.controller._refreshAfterAward = function () {
			bRefreshed = true;
			return Promise.resolve();
		};
		oFixture.controller._showToast = function (sMessage) {
			sToastMessage = sMessage;
		};
		oFixture.controller._getText = function (sKey) {
			if (sKey === "msgCancelSuccess") {
				return "견적 채택이 취소되었습니다.";
			}

			if (sKey === "msgConfirmCancel") {
				return "현재 채택된 MQ를 채택취소하시겠습니까?";
			}

			return "";
		};

		oFixture.controller.onCancelAward().then(function () {
			assert.strictEqual(sToastMessage, "견적 채택이 취소되었습니다.", "Success message is shown after successful CANCEL.");
			assert.ok(bRefreshed, "RFQ item and MQ comparison data are refreshed after successful CANCEL.");
			assert.strictEqual(oFixture.models.view.getProperty("/Busy"), false, "Busy state is cleared after the update flow.");
			done();
		});
	});

	QUnit.test("onCancelAward should not call MERGE when the selected RFQ item cannot be cancelled", function (assert) {
		var bUpdateCalled = false;
		var sToastMessage = "";
		var oFixture = createControllerWithFakeView({
			odataModel: {
				update: function () {
					bUpdateCalled = true;
				}
			}
		});

		oFixture.controller.onInit();
		oFixture.models.work.setProperty("/SelectedRfqItem", {
			RfqNo: "5000000123",
			RfqItem: "00010",
			CanCancelAward: ""
		});
		oFixture.controller._showToast = function (sMessage) {
			sToastMessage = sMessage;
		};
		oFixture.controller._getText = function (sKey) {
			return sKey === "msgNoAwardToCancel" ? "채택취소할 MQ가 없습니다." : "";
		};

		return oFixture.controller.onCancelAward().then(function () {
			assert.notOk(bUpdateCalled, "Backend update is not called without a cancellable awarded MQ.");
			assert.strictEqual(sToastMessage, "채택취소할 MQ가 없습니다.", "User is informed that there is no award to cancel.");
		});
	});

	QUnit.test("_refreshAfterAward should preserve the current Mid column layout while reloading data", function (assert) {
		var done = assert.async();
		var aReadPaths = [];
		var oSelectedRfq = {
			RfqNo: "5000000123",
			AwardStatusText: "Not awarded"
		};
		var oUpdatedItem = {
			RfqNo: "5000000123",
			RfqItem: "00010",
			ItemStatusText: "Awarded",
			CanCancelAward: "X"
		};
		var oFixture = createControllerWithFakeView({
			odataModel: {
				read: function (sPath, mParameters) {
					aReadPaths.push(sPath);

					if (sPath === "/RFQHeaderSet") {
						mParameters.success({
							results: [
								oSelectedRfq,
								{ RfqNo: "5000000456", AwardStatusText: "Not awarded" }
							]
						});
						return;
					}

					if (sPath === "/RFQItemSet") {
						mParameters.success({
							results: [oUpdatedItem]
						});
						return;
					}

					assert.strictEqual(sPath, "/MQCompareSet", "MQ comparison is reloaded for the remembered RFQ item.");
					mParameters.success({
						results: [{
							RfqNo: "5000000123",
							RfqItem: "00010",
							MqNo: "MQ70000002",
							MqItem: "00010",
							CurrentAwardYn: "X",
							CanSelect: ""
						}]
					});
				}
			}
		});

		oFixture.controller.onInit();
		oFixture.models.view.setProperty("/FclLayout", "TwoColumnsMidExpanded");
		oFixture.models.work.setProperty("/SelectedRfq", oSelectedRfq);
		oFixture.models.work.setProperty("/SelectedRfqItem", {
			RfqNo: "5000000123",
			RfqItem: "00010",
			ItemStatusText: "Not awarded"
		});

		oFixture.controller._refreshAfterAward().then(function () {
			assert.deepEqual(aReadPaths, ["/RFQHeaderSet", "/RFQItemSet", "/MQCompareSet"], "Header, item, and MQ data are refreshed in order.");
			assert.strictEqual(oFixture.models.view.getProperty("/FclLayout"), "TwoColumnsMidExpanded", "Award refresh keeps the user in the Mid column layout.");
			assert.deepEqual(oFixture.models.work.getProperty("/SelectedRfq"), oSelectedRfq, "Selected RFQ context is restored after header refresh.");
			assert.strictEqual(oFixture.models.work.getProperty("/SelectedRfqItem/ItemStatusText"), "Awarded", "Selected RFQ item context is replaced with the refreshed item row.");
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
