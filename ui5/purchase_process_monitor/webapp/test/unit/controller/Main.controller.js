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
			["filter", "view", "dashboard", "weekly", "delay", "rfq", "detail"],
			"화면에서 사용할 JSONModel을 조회조건, 화면상태, KPI, 주간요약, 지연목록, RFQ현황, 상세데이터 순서로 등록한다."
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
		assert.strictEqual(oNewFilterModel.getData().RfqNo, "", "RFQ번호는 공백으로 초기화된다.");
		assert.strictEqual(oNewFilterModel.getData().PoNo, "", "PO번호는 공백으로 초기화된다.");
	});

	QUnit.test("onClearKpiFilter restores default DelayStatuses and reloads", function (assert) {
		var done = assert.async();
		var oAppController = new Controller();
		var sSelectedDelayStatus = "PO_DELIVERY_DELAY";
		var aDelayStatuses = ["PO_DELIVERY_DELAY"];
		var bReloaded = false;
		var fnOriginalShow = MessageToast.show;

		MessageToast.show = function (sMessage) {
			assert.strictEqual(sMessage, "KPI 필터를 기본 지연 상태로 되돌렸습니다.", "KPI 필터 기본값 복원 안내 메시지를 표시한다.");
		};

		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					if (sName === "filter") {
						return {
							getData: function () {
								return {
									DelayStatuses: aDelayStatuses
								};
							},
							setProperty: function (sPath, aValue) {
								assert.strictEqual(sPath, "/DelayStatuses", "지연 상태 MultiComboBox 선택값을 기본값으로 갱신한다.");
								aDelayStatuses = aValue;
							}
						};
					}

					assert.strictEqual(sName, "view", "KPI 강조 상태는 view 모델에서 관리한다.");
					return {
						getProperty: function () {
							return "";
						},
						setProperty: function (sPath, sValue) {
							if (sPath === "/selectedDelayStatus") {
								sSelectedDelayStatus = sValue;
							}
						}
					};
				}
			};
		};

		oAppController._loadBeginSummary = function () {
			bReloaded = true;
			return Promise.resolve();
		};

		oAppController.onClearKpiFilter().then(function () {
			MessageToast.show = fnOriginalShow;
			assert.deepEqual(aDelayStatuses, [
				"PR_DELAY",
				"RFQ_NO_QUOTATION",
				"MQ_SELECTION_DELAY",
				"PO_DELIVERY_DELAY",
				"IV_INCOMPLETE"
			], "정상 제외 지연/미처리 상태 5개를 기본값으로 복원한다.");
			assert.strictEqual(sSelectedDelayStatus, "", "선택된 KPI DelayStatus를 공백으로 초기화한다.");
			assert.strictEqual(bReloaded, true, "기본값 복원 후 Begin Column 데이터를 재조회한다.");
			done();
		});
	});

	QUnit.test("onKpiDelayStatusPress replaces filter model with clicked status and reloads", function (assert) {
		var done = assert.async();
		var oAppController = new Controller();
		var aDelayStatuses = ["RFQ_NO_QUOTATION"];
		var bReloaded = false;

		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					if (sName === "view") {
						return {
							getProperty: function () {
								return "";
							},
							setProperty: function () {}
						};
					}

					assert.strictEqual(sName, "filter", "KPI 클릭은 조회조건 filter 모델을 변경한다.");
					return {
						getData: function () {
							return {
								DelayStatuses: aDelayStatuses
							};
						},
						getProperty: function (sPath) {
							assert.strictEqual(sPath, "/DelayStatuses");
							return aDelayStatuses;
						},
						setProperty: function (sPath, aValue) {
							assert.strictEqual(sPath, "/DelayStatuses");
							aDelayStatuses = aValue;
						}
					};
				}
			};
		};

		oAppController._loadBeginSummary = function () {
			bReloaded = true;
			return Promise.resolve();
		};

		oAppController.onKpiDelayStatusPress({
			getSource: function () {
				return {
					data: function (sKey) {
						assert.strictEqual(sKey, "delayStatus");
						return "NORMAL";
					}
				};
			}
		}).then(function () {
			assert.deepEqual(aDelayStatuses, ["NORMAL"], "KPI 클릭 시 선택 배열을 클릭한 상태 하나로 교체한다.");
			assert.strictEqual(bReloaded, true, "KPI 선택 변경 후 목록을 재조회한다.");
			done();
		});
	});

	QUnit.test("onKpiDelayStatusPress keeps clicked status as single filter even when already selected", function (assert) {
		var done = assert.async();
		var oAppController = new Controller();
		var aDelayStatuses = ["RFQ_NO_QUOTATION", "MQ_SELECTION_DELAY"];

		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					if (sName === "view") {
						return {
							getProperty: function () {
								return "";
							},
							setProperty: function () {}
						};
					}

					assert.strictEqual(sName, "filter", "KPI 클릭은 조회조건 filter 모델을 변경한다.");
					return {
						getData: function () {
							return {
								DelayStatuses: aDelayStatuses
							};
						},
						getProperty: function () {
							return aDelayStatuses;
						},
						setProperty: function (sPath, aValue) {
							assert.strictEqual(sPath, "/DelayStatuses");
							aDelayStatuses = aValue;
						}
					};
				}
			};
		};

		oAppController._loadBeginSummary = function () {
			return Promise.resolve();
		};

		oAppController.onKpiDelayStatusPress({
			getSource: function () {
				return {
					data: function () {
						return "RFQ_NO_QUOTATION";
					}
				};
			}
		}).then(function () {
			assert.deepEqual(aDelayStatuses, ["RFQ_NO_QUOTATION"], "이미 선택된 KPI를 다시 클릭해도 해당 상태 단건 필터를 유지한다.");
			done();
		});
	});

	QUnit.test("_applyDelayTableSorters applies group sorter before sort sorter and updates summaries", function (assert) {
		var oAppController = new Controller();
		var aAppliedSorters = null;
		var mViewData = {
			DelayTableStatusSummary: "",
			DelayTableSortGroupSummary: "",
			DelayTableSortKey: "",
			DelayTableSortDescending: false,
			DelayTableGroupKey: "",
			DelayTableGroupDescending: false
		};

		oAppController.byId = function (sId) {
			assert.strictEqual(sId, "delayListTable", "조달 문서 목록 Table binding을 사용한다.");
			return {
				getBinding: function (sAggregation) {
					assert.strictEqual(sAggregation, "items", "sap.m.Table items binding에 Sorter를 적용한다.");
					return {
						sort: function (aSorters) {
							aAppliedSorters = aSorters;
						}
					};
				}
			};
		};

		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					if (sName === "filter") {
						return {
							getData: function () {
								return {
									DelayStatuses: [
										"PR_DELAY",
										"RFQ_NO_QUOTATION",
										"MQ_SELECTION_DELAY",
										"PO_DELIVERY_DELAY",
										"IV_INCOMPLETE"
									]
								};
							}
						};
					}

					assert.strictEqual(sName, "view", "정렬/그룹 상태는 view 모델에 저장한다.");
					return {
						getProperty: function (sPath) {
							return mViewData[sPath.replace("/", "")];
						},
						setProperty: function (sPath, vValue) {
							mViewData[sPath.replace("/", "")] = vValue;
						}
					};
				}
			};
		};

		oAppController._applyDelayTableSorters("DelayDays", true, "DelayStatusText", false);

		assert.strictEqual(aAppliedSorters.length, 2, "그룹 Sorter와 정렬 Sorter가 함께 적용된다.");
		assert.strictEqual(aAppliedSorters[0].sPath, "DelayStatusText", "그룹 Sorter를 먼저 적용한다.");
		assert.strictEqual(aAppliedSorters[1].sPath, "DelayDays", "정렬 Sorter를 두 번째로 적용한다.");
		assert.strictEqual(mViewData.DelayTableGroupKey, "DelayStatusText", "그룹 기준을 view 모델에 저장한다.");
		assert.strictEqual(mViewData.DelayTableSortKey, "DelayDays", "정렬 기준을 view 모델에 저장한다.");
		assert.strictEqual(mViewData.DelayTableStatusSummary, "상태: 전체", "기본 지연 상태 전체 선택 문구를 표시한다.");
		assert.strictEqual(mViewData.DelayTableSortGroupSummary, "정렬: 지연일 내림차순 / 그룹: 지연상태 오름차순", "정렬/그룹 요약 문구를 갱신한다.");
	});

	QUnit.test("onDelayListItemPress stores selected document key in view model", function (assert) {
		var oAppController = new Controller();
		var oSelectedData = {};
		var fnOriginalShow = MessageToast.show;

		MessageToast.show = function (sMessage) {
			assert.strictEqual(sMessage, "조달 문서를 선택했습니다: PR PR00000021", "선택 문서 안내 메시지를 표시한다.");
		};

		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					assert.strictEqual(sName, "view", "선택 상태는 view 모델에 저장한다.");
					return {
						setProperty: function (sPath, sValue) {
							oSelectedData[sPath] = sValue;
						}
					};
				}
			};
		};

		oAppController.onDelayListItemPress({
			getSource: function () {
				return {
					getBindingContext: function (sModelName) {
						assert.strictEqual(sModelName, "delay", "선택 행은 delay 모델 바인딩 컨텍스트에서 읽는다.");
						return {
							getObject: function () {
								return {
									DocType: "PR",
									DocNo: "PR00000021"
								};
							}
						};
					}
				};
			}
		});

		MessageToast.show = fnOriginalShow;
		assert.strictEqual(oSelectedData["/selectedDocType"], "PR", "선택 문서유형을 저장한다.");
		assert.strictEqual(oSelectedData["/selectedDocNo"], "PR00000021", "선택 문서번호를 저장한다.");
	});

	QUnit.test("onSearch loads dashboard and weekly summaries", function (assert) {
		var done = assert.async();
		var oAppController = new Controller();
		var aBusyStates = [];
		var bDashboardRead = false;
		var bWeeklyRead = false;
		var bDelayListRead = false;
		var bDashboardCountUpdated = false;
		var fnOriginalShow = MessageToast.show;

		MessageToast.show = function (sMessage) {
			assert.strictEqual(sMessage, "모니터링 데이터를 조회했습니다.", "조회 성공 메시지를 표시한다.");
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

		oAppController._readDelayList = function () {
			bDelayListRead = true;
			return Promise.resolve([{
				DelayStatus: "NORMAL",
				TotalItemCount: 2,
				DelayedItemCount: 0
			}]);
		};

		oAppController._updateDashboardCountsFromDelayRows = function (aRows) {
			bDashboardCountUpdated = true;
			assert.strictEqual(aRows.length, 1, "DelayListSet 결과 기준으로 KPI 카운트를 다시 계산한다.");
		};

		oAppController.onSearch().then(function () {
			assert.strictEqual(bDashboardRead, true, "DashboardSummarySet 조회 함수가 호출된다.");
			assert.strictEqual(bWeeklyRead, true, "WeeklySummarySet 조회 함수가 호출된다.");
			assert.strictEqual(bDelayListRead, true, "DelayListSet 조회 함수가 호출된다.");
			assert.strictEqual(bDashboardCountUpdated, true, "목록 대표 상태 기준으로 KPI 카운트를 갱신한다.");
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

	QUnit.test("_updateDashboardCountsFromDelayRows calculates KPI counts from procurement list rows", function (assert) {
		var oAppController = new Controller();
		var oDashboardData = {
			PrDlyHdrCnt: 999,
			PrDlyItmCnt: 999
		};

		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					assert.strictEqual(sName, "dashboard", "KPI 카운트는 dashboard 모델에 반영한다.");
					return {
						getData: function () {
							return oDashboardData;
						},
						setData: function (oData) {
							oDashboardData = oData;
						}
					};
				}
			};
		};

		oAppController._updateDashboardCountsFromDelayRows([{
			DelayStatus: "RFQ_NO_QUOTATION",
			DelayedItemCount: 2,
			TotalItemCount: 3
		}, {
			DelayStatus: "MQ_SELECTION_DELAY",
			DelayedItemCount: 1,
			TotalItemCount: 2
		}, {
			DelayStatus: "IV_INCOMPLETE",
			DelayedItemCount: 5,
			TotalItemCount: 5
		}, {
			DelayStatus: "NORMAL",
			DelayedItemCount: 0,
			TotalItemCount: 4
		}]);

		assert.strictEqual(oDashboardData.RfqNoqHdrCnt, 1, "RFQ 미접수 Header 수를 계산한다.");
		assert.strictEqual(oDashboardData.RfqNoqItmCnt, 2, "RFQ 미접수 지연 품목 수를 계산한다.");
		assert.strictEqual(oDashboardData.MqSelDlyHdrCnt, 1, "MQ 채택 지연 Header 수를 계산한다.");
		assert.strictEqual(oDashboardData.IvIncHdrCnt, 1, "입고 후 미송장 Header 수를 계산한다.");
		assert.strictEqual(oDashboardData.NormalHdrCnt, 1, "정상 Header 수를 계산한다.");
		assert.strictEqual(oDashboardData.NormalItmCnt, 4, "정상 품목 수는 전체 품목 수를 사용한다.");
		assert.strictEqual(
			oDashboardData.RfqNoqHdrCnt + oDashboardData.MqSelDlyHdrCnt + oDashboardData.IvIncHdrCnt + oDashboardData.NormalHdrCnt,
			4,
			"KPI Header 합계는 DelayListSet 목록 행 수와 일치한다."
		);
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

	QUnit.test("_buildDelayListFilters maps PR number to DelayListSet document key filters", function (assert) {
		var oAppController = new Controller();
		var oKeyDate = new Date(2026, 5, 16);

		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					if (sName === "filter") {
						return {
							getData: function () {
							return {
								KeyDate: oKeyDate,
								PrNo: "PR00000001",
								PoNo: " po00000042 ",
								Matnr: "100001",
								DelayStatuses: [
									"PO_DELIVERY_DELAY",
									"IV_INCOMPLETE"
								]
							};
						}
					};
					}

					assert.strictEqual(sName, "view", "KPI DelayStatus는 view 모델에서 읽는다.");
					return {
						getProperty: function (sPath) {
							assert.strictEqual(sPath, "/selectedDelayStatus");
							return "";
						}
					};
				}
			};
		};

		var aFilters = oAppController._buildDelayListFilters();

		assert.strictEqual(aFilters.length, 4, "DelayListSet에는 KeyDate, PR 문서유형, PR 문서번호, 지연상태 OR 필터를 전달한다.");
		assert.strictEqual(aFilters[0].sPath, "KeyDate", "첫 번째 필터는 KeyDate이다.");
		assert.strictEqual(aFilters[1].sPath, "DocType", "PR번호는 DelayListSet의 문서유형 필터와 함께 전달한다.");
		assert.strictEqual(aFilters[1].oValue1, "PR", "PR번호 조건이므로 DocType은 PR로 고정한다.");
		assert.strictEqual(aFilters[2].sPath, "DocNo", "PR번호는 DelayListSet의 기준 문서번호 필터로 전달한다.");
		assert.strictEqual(aFilters[2].oValue1, "PR00000001", "PR번호 입력값은 앞뒤 공백을 제거하고 대문자로 정규화한다.");
		assert.strictEqual(aFilters[3].aFilters.length, 2, "선택된 지연상태 2개를 하나의 복합 OR Filter로 묶는다.");
		assert.strictEqual(aFilters[3].aFilters[0].sPath, "DelayStatus", "첫 번째 하위 Filter는 DelayStatus 조건이다.");
		assert.strictEqual(aFilters[3].aFilters[0].oValue1, "PO_DELIVERY_DELAY", "첫 번째 선택 상태를 DelayStatus 필터 값으로 전달한다.");
		assert.strictEqual(aFilters[3].aFilters[1].oValue1, "IV_INCOMPLETE", "두 번째 선택 상태를 DelayStatus 필터 값으로 전달한다.");
	});

	QUnit.test("_buildDelayListFilters maps PO number when PR number is empty", function (assert) {
		var oAppController = new Controller();
		var oKeyDate = new Date(2026, 5, 16);

		oAppController.getView = function () {
			return {
				getModel: function () {
					return {
						getData: function () {
							return {
								KeyDate: oKeyDate,
								PrNo: "",
								PoNo: " po00000042 ",
								DelayStatuses: ["PO_DELIVERY_DELAY"]
							};
						}
					};
				}
			};
		};

		var aFilters = oAppController._buildDelayListFilters();

		assert.strictEqual(aFilters.length, 4, "DelayListSet에는 KeyDate, PO 문서유형, PO 문서번호, 지연상태 필터를 전달한다.");
		assert.strictEqual(aFilters[1].sPath, "DocType", "PO번호는 DelayListSet의 문서유형 필터와 함께 전달한다.");
		assert.strictEqual(aFilters[1].oValue1, "PO", "PO번호 조건이므로 DocType은 PO로 고정한다.");
		assert.strictEqual(aFilters[2].sPath, "DocNo", "PO번호는 DelayListSet의 기준 문서번호 필터로 전달한다.");
		assert.strictEqual(aFilters[2].oValue1, "PO00000042", "PO번호 입력값은 앞뒤 공백을 제거하고 대문자로 정규화한다.");
		assert.strictEqual(aFilters[3].sPath, "DelayStatus", "지연상태 단건 선택은 단일 Filter로 전달한다.");
		assert.strictEqual(aFilters[3].oValue1, "PO_DELIVERY_DELAY", "선택한 지연상태를 DelayStatus 필터 값으로 전달한다.");
	});

	QUnit.test("_buildDelayListFilters maps RFQ number when PR number is empty", function (assert) {
		var oAppController = new Controller();
		var oKeyDate = new Date(2026, 5, 16);

		oAppController.getView = function () {
			return {
				getModel: function () {
					return {
						getData: function () {
							return {
								KeyDate: oKeyDate,
								PrNo: "",
								RfqNo: " rq10000005 ",
								PoNo: " po00000042 ",
								DelayStatuses: ["RFQ_NO_QUOTATION"]
							};
						}
					};
				}
			};
		};

		var aFilters = oAppController._buildDelayListFilters();

		assert.strictEqual(aFilters.length, 4, "DelayListSet에는 KeyDate, RFQ 문서유형, RFQ 문서번호, 지연상태 필터를 전달한다.");
		assert.strictEqual(aFilters[1].sPath, "DocType", "RFQ번호는 DelayListSet의 문서유형 필터와 함께 전달한다.");
		assert.strictEqual(aFilters[1].oValue1, "RFQ", "RFQ번호 조건이므로 DocType은 RFQ로 고정한다.");
		assert.strictEqual(aFilters[2].sPath, "DocNo", "RFQ번호는 DelayListSet의 기준 문서번호 필터로 전달한다.");
		assert.strictEqual(aFilters[2].oValue1, "RQ10000005", "RFQ번호 입력값은 앞뒤 공백을 제거하고 대문자로 정규화한다.");
		assert.strictEqual(aFilters[3].sPath, "DelayStatus", "지연상태 단건 선택은 단일 Filter로 전달한다.");
		assert.strictEqual(aFilters[3].oValue1, "RFQ_NO_QUOTATION", "선택한 RFQ 지연상태를 DelayStatus 필터 값으로 전달한다.");
	});

	QUnit.test("_buildDelayListFilters adds material vendor and plant filters", function (assert) {
		var oAppController = new Controller();
		var oKeyDate = new Date(2026, 5, 16);

		oAppController.getView = function () {
			return {
				getModel: function () {
					return {
						getData: function () {
							return {
								KeyDate: oKeyDate,
								PrNo: "",
								PoNo: "",
								Matnr: " 100030 ",
								Maktx: "700Wh Battery",
								Lifnr: " v00006 ",
								Name1: "Shenzhen Battery Co.",
								Werks: " p00001 ",
								DelayStatuses: ["DELAY"]
							};
						}
					};
				}
			};
		};

		var aFilters = oAppController._buildDelayListFilters();

		assert.strictEqual(aFilters.length, 5, "DelayListSet에는 KeyDate, 자재, 공급업체, 플랜트, 지연상태 필터를 전달한다.");
		assert.strictEqual(aFilters[1].sPath, "Matnr", "자재코드는 Matnr 필터로 전달한다.");
		assert.strictEqual(aFilters[1].oValue1, "100030", "자재코드는 앞뒤 공백을 제거한다.");
		assert.strictEqual(aFilters[2].sPath, "Lifnr", "공급업체코드는 Lifnr 필터로 전달한다.");
		assert.strictEqual(aFilters[2].oValue1, "V00006", "공급업체코드는 대문자로 정규화한다.");
		assert.strictEqual(aFilters[3].sPath, "Werks", "플랜트는 Werks 필터로 전달한다.");
		assert.strictEqual(aFilters[3].oValue1, "P00001", "플랜트는 대문자로 정규화한다.");
		assert.strictEqual(aFilters[4].sPath, "DelayStatus", "지연상태는 상세조건 뒤에 추가한다.");
		assert.strictEqual(
			aFilters.some(function (oFilter) {
				return oFilter.sPath === "Maktx" || oFilter.sPath === "Name1";
			}),
			false,
			"자재명과 공급업체명은 현재 Backend 필터 계약에 없으므로 전달하지 않는다."
		);
	});

	QUnit.test("_toBackendDelayStatuses compresses full delay selections to backend policy codes", function (assert) {
		var oAppController = new Controller();

		assert.deepEqual(oAppController._toBackendDelayStatuses([
			"PR_DELAY",
			"RFQ_NO_QUOTATION",
			"MQ_SELECTION_DELAY",
			"PO_DELIVERY_DELAY",
			"IV_INCOMPLETE"
		]), ["DELAY"], "정상 제외 지연/미처리 상태 전체 선택은 Backend 대표 코드 DELAY로 조회한다.");

		assert.deepEqual(oAppController._toBackendDelayStatuses([
			"PR_DELAY",
			"RFQ_NO_QUOTATION",
			"MQ_SELECTION_DELAY",
			"PO_DELIVERY_DELAY",
			"IV_INCOMPLETE",
			"NORMAL"
		]), ["ALL"], "정상까지 포함한 전체 선택은 Backend 대표 코드 ALL로 조회한다.");

		assert.deepEqual(oAppController._toBackendDelayStatuses(["NORMAL"]), ["NORMAL"], "정상만 선택하면 NORMAL 단건 조회로 유지한다.");
		assert.deepEqual(oAppController._toBackendDelayStatuses([
			"RFQ_NO_QUOTATION",
			"MQ_SELECTION_DELAY"
		]), [
			"RFQ_NO_QUOTATION",
			"MQ_SELECTION_DELAY"
		], "일부 상태 다중 선택은 상태별 개별 조회 정책을 유지한다.");
	});

	QUnit.test("_readDelayList stores rows and count in delay model", function (assert) {
		var done = assert.async();
		var oAppController = new Controller();
		var oDelayData;
		var aBackendRows = [{
			DocType: "PO",
			DocNo: "4500000001",
			DelayStatusText: "PO 납기 지연"
		}];

		oAppController._buildDelayListFilters = function () {
			return [];
		};

		oAppController._readEntitySet = function (sPath) {
			assert.strictEqual(sPath, "/DelayListSet", "DelayListSet을 조회한다.");
			return Promise.resolve(aBackendRows);
		};

		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					if (sName === "filter") {
						return {
							getData: function () {
								return {
									DelayStatuses: []
								};
							}
						};
					}

					assert.strictEqual(sName, "delay", "조회 결과는 delay 모델에 저장한다.");
					return {
						setData: function (oData) {
							oDelayData = oData;
						}
					};
				}
			};
		};

		oAppController._readDelayList().then(function () {
			assert.deepEqual(oDelayData.rows, aBackendRows, "Backend 행을 rows에 저장한다.");
			assert.strictEqual(oDelayData.count, 1, "목록 건수를 count에 저장한다.");
			done();
		});
	});

	QUnit.test("_readDelayList reads each selected DelayStatus separately and merges rows", function (assert) {
		var done = assert.async();
		var oAppController = new Controller();
		var oDelayData;
		var aReadStatuses = [];

		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					if (sName === "filter") {
						return {
							getData: function () {
								return {
									DelayStatuses: [
										"RFQ_NO_QUOTATION",
										"MQ_SELECTION_DELAY"
									]
								};
							}
						};
					}

					assert.strictEqual(sName, "delay", "조회 결과는 delay 모델에 저장한다.");
					return {
						setData: function (oData) {
							oDelayData = oData;
						}
					};
				}
			};
		};

		oAppController._readEntitySet = function (sPath, aFilters) {
			var oDelayStatusFilter = aFilters.filter(function (oFilter) {
				return oFilter.sPath === "DelayStatus";
			})[0];
			var sDelayStatus = oDelayStatusFilter && oDelayStatusFilter.oValue1;

			assert.strictEqual(sPath, "/DelayListSet", "DelayListSet을 조회한다.");
			aReadStatuses.push(sDelayStatus);

			if (sDelayStatus === "RFQ_NO_QUOTATION") {
				return Promise.resolve([{
					DocType: "RFQ",
					DocNo: "RQ10000001",
					DelayStatus: "RFQ_NO_QUOTATION"
				}]);
			}

			return Promise.resolve([{
				DocType: "RFQ",
				DocNo: "RQ10000002",
				DelayStatus: "MQ_SELECTION_DELAY"
			}]);
		};

		oAppController._readDelayList().then(function (aRows) {
			assert.deepEqual(aReadStatuses, [
				"RFQ_NO_QUOTATION",
				"MQ_SELECTION_DELAY"
			], "선택된 지연상태별로 단건 DelayStatus 필터 조회를 실행한다.");
			assert.strictEqual(aRows.length, 2, "각 상태 조회 결과를 하나의 목록으로 합친다.");
			assert.strictEqual(oDelayData.count, 2, "합쳐진 결과 건수를 delay 모델에 저장한다.");
			done();
		});
	});

	QUnit.test("_readDelayList sends DELAY when default delayed statuses are all selected", function (assert) {
		var done = assert.async();
		var oAppController = new Controller();
		var oDelayData;
		var aReadStatuses = [];

		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					if (sName === "filter") {
						return {
							getData: function () {
								return {
									DelayStatuses: [
										"PR_DELAY",
										"RFQ_NO_QUOTATION",
										"MQ_SELECTION_DELAY",
										"PO_DELIVERY_DELAY",
										"IV_INCOMPLETE"
									]
								};
							}
						};
					}

					assert.strictEqual(sName, "delay", "조회 결과는 delay 모델에 저장한다.");
					return {
						setData: function (oData) {
							oDelayData = oData;
						}
					};
				}
			};
		};

		oAppController._readEntitySet = function (sPath, aFilters) {
			var oDelayStatusFilter = aFilters.filter(function (oFilter) {
				return oFilter.sPath === "DelayStatus";
			})[0];

			assert.strictEqual(sPath, "/DelayListSet", "DelayListSet을 조회한다.");
			aReadStatuses.push(oDelayStatusFilter && oDelayStatusFilter.oValue1);

			return Promise.resolve([{
				DocType: "PR",
				DocNo: "PR00000001",
				DelayStatus: "PR_DELAY"
			}]);
		};

		oAppController._readDelayList().then(function () {
			assert.deepEqual(aReadStatuses, ["DELAY"], "기본 지연 상태 전체 선택은 Backend에 DELAY 한 번만 전달한다.");
			assert.strictEqual(oDelayData.count, 1, "조회 결과 건수를 delay 모델에 저장한다.");
			done();
		});
	});

	QUnit.test("_readRfqStatus stores rows and count in rfq model", function (assert) {
		var done = assert.async();
		var oAppController = new Controller();
		var oRfqData;
		var aBackendRows = [{
			RfqNo: "RQ00000001",
			ReceptionStatusText: "접수완료",
			AwardStatusText: "부분채택"
		}];

		oAppController._buildRfqStatusFilters = function () {
			return [];
		};

		oAppController._readEntitySet = function (sPath) {
			assert.strictEqual(sPath, "/RfqQuotationStatusSet", "RfqQuotationStatusSet을 조회한다.");
			return Promise.resolve(aBackendRows);
		};

		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					assert.strictEqual(sName, "rfq", "조회 결과는 rfq 모델에 저장한다.");
					return {
						setData: function (oData) {
							oRfqData = oData;
						}
					};
				}
			};
		};

		oAppController._readRfqStatus().then(function () {
			assert.deepEqual(oRfqData.rows, aBackendRows, "Backend 행을 rows에 저장한다.");
			assert.strictEqual(oRfqData.count, 1, "RFQ/MQ 현황 건수를 count에 저장한다.");
			done();
		});
	});

});
