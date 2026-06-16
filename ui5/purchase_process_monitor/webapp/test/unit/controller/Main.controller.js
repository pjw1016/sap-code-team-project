/*global QUnit*/

sap.ui.define([
	"sap/m/MessageToast",
	"code/d3/purchaseprocessmonitor/controller/Main.controller"
], function (MessageToast, Controller) {
	"use strict";

	QUnit.module("Main Controller");

	QUnit.test("onInit initializes search, summary, and detail JSON models", function (assert) {
		var oAppController = new Controller();
		var aModelNames = [];
		var bInitialLoadCalled = false;

		oAppController._loadInitialData = function () {
			bInitialLoadCalled = true;
			return Promise.resolve();
		};

		oAppController.getView = function () {
			return {
				setModel: function (oModel, sName) {
					aModelNames.push(sName);
					assert.ok(oModel, sName + " 모델 인스턴스가 생성되어 View에 등록된다.");
				}
			};
		};

		oAppController.onInit();

		assert.ok(oAppController);
		assert.deepEqual(
			aModelNames,
			["filter", "view", "dashboard", "weekly", "detail"],
			"화면에서 사용할 JSONModel을 조회조건, 화면상태, KPI, 주간요약, 상세데이터 순서로 등록한다."
		);
		assert.strictEqual(bInitialLoadCalled, true, "모델 등록 후 최초 자동 조회를 시작한다.");
	});

	QUnit.test("onToggleAdvancedFilters toggles advanced filter visibility", function (assert) {
		var oAppController = new Controller();
		var bVisible = false;

		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					assert.strictEqual(sName, "view", "상세조건 표시 여부는 view 모델에서 관리한다.");
					return {
						getProperty: function (sPath) {
							assert.strictEqual(sPath, "/showAdvancedFilters");
							return bVisible;
						},
						setProperty: function (sPath, bValue) {
							assert.strictEqual(sPath, "/showAdvancedFilters");
							bVisible = bValue;
						}
					};
				}
			};
		};

		oAppController.onToggleAdvancedFilters();
		assert.strictEqual(bVisible, true, "접혀 있던 상세조건이 펼쳐진다.");

		oAppController.onToggleAdvancedFilters();
		assert.strictEqual(bVisible, false, "펼쳐진 상세조건이 다시 접힌다.");
	});

	QUnit.test("onResetFilters replaces filter model with default values", function (assert) {
		var oAppController = new Controller();
		var oNewFilterModel;

		oAppController.getView = function () {
			return {
				setModel: function (oModel, sName) {
					if (sName === "filter") {
						oNewFilterModel = oModel;
					}
				},
				getModel: function () {
					return {
						setProperty: function () {}
					};
				}
			};
		};

		oAppController.onResetFilters();

		assert.ok(oNewFilterModel, "초기화 시 filter 모델을 기본값 모델로 교체한다.");
		assert.strictEqual(oNewFilterModel.getData().LookbackMonths, "3", "조회기간은 최근 3개월로 초기화된다.");
		assert.strictEqual(oNewFilterModel.getData().PrNo, "", "PR번호는 공백으로 초기화된다.");
		assert.strictEqual(oNewFilterModel.getData().PoNo, "", "PO번호는 공백으로 초기화된다.");
	});

	QUnit.test("onClearKpiFilter clears selected DelayStatus", function (assert) {
		var oAppController = new Controller();
		var sSelectedDelayStatus = "PO_DELIVERY_DELAY";
		var fnOriginalShow = MessageToast.show;

		MessageToast.show = function (sMessage) {
			assert.strictEqual(sMessage, "KPI 필터를 해제했습니다.", "KPI 필터 해제 안내 메시지를 표시한다.");
		};

		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					assert.strictEqual(sName, "view", "KPI 필터 상태는 view 모델에서 관리한다.");
					return {
						setProperty: function (sPath, sValue) {
							assert.strictEqual(sPath, "/selectedDelayStatus");
							sSelectedDelayStatus = sValue;
						}
					};
				}
			};
		};

		oAppController.onClearKpiFilter();

		MessageToast.show = fnOriginalShow;
		assert.strictEqual(sSelectedDelayStatus, "", "선택된 KPI DelayStatus를 공백으로 초기화한다.");
	});

	QUnit.test("onSearch loads dashboard and weekly summaries", function (assert) {
		var done = assert.async();
		var oAppController = new Controller();
		var aBusyStates = [];
		var bDashboardRead = false;
		var bWeeklyRead = false;
		var fnOriginalShow = MessageToast.show;

		MessageToast.show = function (sMessage) {
			assert.strictEqual(sMessage, "요약 데이터를 조회했습니다.", "요약 조회 성공 메시지를 표시한다.");
		};

		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					assert.strictEqual(sName, "view", "요약 조회 Busy 상태는 view 모델에서 관리한다.");
					return {
						setProperty: function (sPath, bValue) {
							assert.strictEqual(sPath, "/busy");
							aBusyStates.push(bValue);
						}
					};
				}
			};
		};

		oAppController._readDashboardSummary = function () {
			bDashboardRead = true;
			return Promise.resolve({});
		};

		oAppController._readWeeklySummary = function () {
			bWeeklyRead = true;
			return Promise.resolve({});
		};

		oAppController.onSearch().then(function () {
			assert.strictEqual(bDashboardRead, true, "DashboardSummarySet 조회 함수가 호출된다.");
			assert.strictEqual(bWeeklyRead, true, "WeeklySummarySet 조회 함수가 호출된다.");
			assert.deepEqual(aBusyStates, [true, false], "조회 시작 시 Busy를 켜고 종료 시 끈다.");
		}).finally(function () {
			MessageToast.show = fnOriginalShow;
			done();
		});
	});

	QUnit.test("_loadInitialData waits for OData metadata before loading summary", function (assert) {
		var done = assert.async();
		var oAppController = new Controller();
		var bMetadataLoadedCalled = false;
		var bSummaryLoaded = false;

		oAppController.getOwnerComponent = function () {
			return {
				getModel: function () {
					return {
						metadataLoaded: function () {
							bMetadataLoadedCalled = true;
							return Promise.resolve();
						}
					};
				}
			};
		};

		oAppController._loadBeginSummary = function () {
			bSummaryLoaded = true;
			return Promise.resolve();
		};

		oAppController._loadInitialData().then(function () {
			assert.strictEqual(bMetadataLoadedCalled, true, "OData metadata 로딩 완료를 기다린다.");
			assert.strictEqual(bSummaryLoaded, true, "metadata 로딩 후 기본 요약 조회를 실행한다.");
			done();
		});
	});

	QUnit.test("_buildSummaryFilters sends only KeyDate for summary entity sets", function (assert) {
		var oAppController = new Controller();
		var oKeyDate = new Date(2026, 5, 16);

		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					assert.strictEqual(sName, "filter", "Summary 필터는 filter 모델 기준으로 만든다.");
					return {
						getData: function () {
							return {
								KeyDate: oKeyDate,
								PrNo: "PR00000001",
								PoNo: "4500000001",
								Matnr: "100001",
								Lifnr: "V00001",
								Werks: "1000"
							};
						}
					};
				}
			};
		};

		var aFilters = oAppController._buildSummaryFilters();

		assert.strictEqual(aFilters.length, 1, "Summary EntityType에 존재하는 KeyDate만 필터로 전달한다.");
		assert.strictEqual(aFilters[0].sPath, "KeyDate", "필터 Property는 KeyDate이다.");
	});

});
