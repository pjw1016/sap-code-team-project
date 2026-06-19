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
		assert.strictEqual(oNewFilterModel.getData().DocType, "ALL", "문서유형은 전체로 초기화된다.");
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

	QUnit.test("onDelayListItemPress keeps one column and shows guidance for PR row", function (assert) {
		var oAppController = new Controller();
		var oSelectedData = {};
		var fnOriginalShow = MessageToast.show;

		MessageToast.show = function (sMessage) {
			assert.strictEqual(sMessage, "PR 문서는 PO 조달 흐름 상세 대상이 아닙니다. PO 문서를 선택하세요.", "PR 행은 PO 상세 화면 대상이 아님을 안내한다.");
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
		assert.strictEqual(oSelectedData["/layout"], "OneColumn", "PR 선택 시 Mid Column을 열지 않는다.");
	});

	QUnit.test("onDelayListItemPress keeps one column and shows guidance for RFQ row", function (assert) {
		var oAppController = new Controller();
		var oSelectedData = {};
		var fnOriginalShow = MessageToast.show;

		MessageToast.show = function (sMessage) {
			assert.strictEqual(sMessage, "RFQ 문서는 PO 조달 흐름 상세 대상이 아닙니다. PO 문서를 선택하세요.", "RFQ 행은 PO 상세 화면 대상이 아님을 안내한다.");
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
									DocType: "RFQ",
									DocNo: "RQ10000001"
								};
							}
						};
					}
				};
			}
		});

		MessageToast.show = fnOriginalShow;
		assert.strictEqual(oSelectedData["/selectedDocType"], "RFQ", "선택 문서유형을 저장한다.");
		assert.strictEqual(oSelectedData["/selectedDocNo"], "RQ10000001", "선택 문서번호를 저장한다.");
		assert.strictEqual(oSelectedData["/layout"], "OneColumn", "RFQ 선택 시 Mid Column을 열지 않는다.");
	});

	QUnit.test("onDelayListItemPress opens mid column for PO row", function (assert) {
		var oAppController = new Controller();
		var oSelectedData = {};
		var sOpenedPoNo = "";
		var oOpenedPoRow;
		var oPoRow = {
			DocType: "PO",
			DocNo: "PO00000042",
			DelayStatusText: "입고 후 미송장",
			Criticality: "Negative",
			DelayDays: 14,
			DelayedItemCount: 5,
			TotalItemCount: 5
		};
		var fnOriginalShow = MessageToast.show;

		MessageToast.show = function (sMessage) {
			assert.strictEqual(sMessage, "PO 조달 흐름 상세를 표시합니다: PO PO00000042", "PO 행은 Mid Column 상세 표시를 안내한다.");
		};

		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					assert.strictEqual(sName, "view", "선택 상태와 FCL layout은 view 모델에서 관리한다.");
					return {
						setProperty: function (sPath, sValue) {
							oSelectedData[sPath] = sValue;
						}
					};
				}
			};
		};

		oAppController._openMidColumnForPo = function (sPoNo, oSelectedRow) {
			sOpenedPoNo = sPoNo;
			oOpenedPoRow = oSelectedRow;
			oSelectedData["/layout"] = "TwoColumnsMidExpanded";
			MessageToast.show("PO 조달 흐름 상세를 표시합니다: PO " + sPoNo);
			return Promise.resolve();
		};

		oAppController.onDelayListItemPress({
			getSource: function () {
				return {
					getBindingContext: function (sModelName) {
						assert.strictEqual(sModelName, "delay", "선택 행은 delay 모델 바인딩 컨텍스트에서 읽는다.");
						return {
							getObject: function () {
								return oPoRow;
							}
						};
					}
				};
			}
		});

		MessageToast.show = fnOriginalShow;
		assert.strictEqual(oSelectedData["/selectedDocType"], "PO", "선택 문서유형을 저장한다.");
		assert.strictEqual(oSelectedData["/selectedDocNo"], "PO00000042", "선택 문서번호를 저장한다.");
		assert.strictEqual(sOpenedPoNo, "PO00000042", "PO 선택 시 해당 PO 번호로 Mid 상세 조회를 시작한다.");
		assert.strictEqual(oOpenedPoRow, oPoRow, "선택한 PO 행 전체를 Mid Column 요약 영역에 전달한다.");
		assert.strictEqual(oSelectedData["/layout"], "TwoColumnsMidExpanded", "PO 선택 시 Begin/Mid 2컬럼 레이아웃을 연다.");
	});

	QUnit.test("_readProcessFlow reads PO context, sorts by StageOrder, and stores detail rows", function (assert) {
		var done = assert.async();
		var oAppController = new Controller();
		var oDetailData = {};
		var aReadFilters;
		var bProcessFlowUpdated = false;

		oAppController._readEntitySet = function (sPath, aFilters) {
			assert.strictEqual(sPath, "/ProcessFlowSet", "ProcessFlowSet을 조회한다.");
			aReadFilters = aFilters;

			return Promise.resolve([{
				Stage: "PO",
				StageOrder: 40,
				StageText: "PO",
				NodeTitle: "PO00000042",
				ChildStage: "",
				Criticality: "Negative",
				DocumentCount: 1,
				ItemCount: 2,
				DelayedItemCount: 1
			}, {
				Stage: "PR",
				StageOrder: 10,
				StageText: "PR",
				NodeTitle: "PR00000021",
				ChildStage: "PO",
				Criticality: "Positive",
				DocumentCount: 1,
				ItemCount: 2,
				DelayedItemCount: 0
			}]);
		};

		oAppController.byId = function (sId) {
			assert.strictEqual(sId, "poProcessFlow", "ProcessFlow 컨트롤을 갱신한다.");
			return {
				updateModel: function () {
					bProcessFlowUpdated = true;
				}
			};
		};

		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					assert.strictEqual(sName, "detail", "ProcessFlowSet 결과는 detail 모델에 저장한다.");
					return {
						setProperty: function (sPath, vValue) {
							oDetailData[sPath] = vValue;
						}
					};
				}
			};
		};

		oAppController._readProcessFlow("PO", " po00000042 ").then(function (aRows) {
			assert.strictEqual(aReadFilters[0].sPath, "ContextDocType", "첫 번째 필터는 기준 문서유형이다.");
			assert.strictEqual(aReadFilters[0].oValue1, "PO", "기준 문서유형은 대문자로 정규화한다.");
			assert.strictEqual(aReadFilters[1].sPath, "ContextDocNo", "두 번째 필터는 기준 문서번호이다.");
			assert.strictEqual(aReadFilters[1].oValue1, "PO00000042", "기준 문서번호는 앞뒤 공백 제거와 대문자 정규화를 적용한다.");
			assert.deepEqual(aRows.map(function (oRow) {
				return oRow.Stage;
			}), ["PR", "PO"], "StageOrder 기준으로 정렬한다.");
			assert.strictEqual(oDetailData["/processFlow"].length, 2, "정렬된 Flow 행을 detail 모델에 저장한다.");
			assert.strictEqual(oDetailData["/processFlowCount"], 2, "Flow 건수를 detail 모델에 저장한다.");
			assert.strictEqual(oDetailData["/processFlowLanes"].length, 2, "ProcessFlow Lane 배열을 생성한다.");
			assert.strictEqual(oDetailData["/processFlowLanes"][0].id, "PR", "첫 번째 Lane은 정렬된 PR 단계이다.");
			assert.strictEqual(oDetailData["/processFlowLanes"][0].position, 0, "Lane position은 StageOrder가 아니라 정렬 index 기준으로 0부터 시작한다.");
			assert.strictEqual(oDetailData["/processFlowLanes"][1].position, 1, "Lane position은 중간 공백 없이 연속 값으로 만든다.");
			assert.strictEqual(oDetailData["/processFlowNodes"].length, 2, "ProcessFlow Node 배열을 생성한다.");
			assert.deepEqual(oDetailData["/processFlowNodes"][0].children, ["PO"], "ChildStage를 ProcessFlowNode children으로 매핑한다.");
			assert.strictEqual(oDetailData["/processFlowNodes"][1].state, "Negative", "Backend Criticality를 ProcessFlow 상태로 매핑한다.");
			assert.strictEqual(oDetailData["/processFlowNodes"][1].highlighted, true, "지연 품목이 있는 노드는 강조한다.");
			assert.strictEqual(oDetailData["/processFlowNodes"][1].focused, false, "최초 로딩 시 특정 단계를 고정 선택하지 않는다.");
			assert.strictEqual(bProcessFlowUpdated, true, "nodes/lanes 반영 후 ProcessFlow updateModel을 호출한다.");
			done();
		});
	});

	QUnit.test("_openMidColumnForPo reuses the active PO detail request", function (assert) {
		var done = assert.async();
		var oAppController = new Controller();
		var fnResolveRead;
		var pPendingRead = new Promise(function (resolve) {
			fnResolveRead = resolve;
		});
		var iReadCount = 0;
		var aMidBusyStates = [];
		var fnOriginalShow = MessageToast.show;
		var oViewModel = {
			setProperty: function (sPath, vValue) {
				if (sPath === "/midBusy") {
					aMidBusyStates.push(vValue);
				}
			}
		};
		var oDetailModel = {
			setData: function () {},
			setProperty: function () {}
		};

		MessageToast.show = function () {};
		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					return sName === "view" ? oViewModel : oDetailModel;
				}
			};
		};
		oAppController._readProcessFlow = function () {
			iReadCount += 1;
			return pPendingRead;
		};
		oAppController._readProcessItems = function () {
			iReadCount += 1;
			return pPendingRead;
		};
		oAppController._readProcessDocuments = function () {
			iReadCount += 1;
			return pPendingRead;
		};

		var pFirstLoad = oAppController._openMidColumnForPo("PO00000042", {});
		var pDuplicateLoad = oAppController._openMidColumnForPo("PO00000042", {});

		assert.strictEqual(pDuplicateLoad, pFirstLoad, "상세 조회 중 재호출은 진행 중인 Promise를 반환한다.");
		assert.strictEqual(iReadCount, 3, "Flow/Item/Document 조회를 각각 한 번만 실행한다.");
		assert.deepEqual(aMidBusyStates, [true], "중복 호출이 Mid Busy를 다시 켜지 않는다.");

		fnResolveRead([]);
		pFirstLoad.then(function () {
			assert.deepEqual(aMidBusyStates, [true, false], "상세 조회 완료 후 Mid Busy를 한 번만 해제한다.");
		}).finally(function () {
			MessageToast.show = fnOriginalShow;
			done();
		});
	});


	QUnit.test("onProcessStageSelect filters ProcessItem rows by normalized CurrentStage", function (assert) {
		var oAppController = new Controller();
		var mViewData = {};
		var mDetailData = {
			"/processItemsAll": [{ ItemNo: "10", CurrentStage: "PO" }, {
				ItemNo: "20",
				CurrentStage: " gr "
			}, { ItemNo: "30", CurrentStage: "IV" }]
		};

		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					if (sName === "view") {
						return {
							setProperty: function (sPath, vValue) {
								mViewData[sPath] = vValue;
							}
						};
					}

					if (sName === "detail") {
						return {
							getProperty: function (sPath) {
								return mDetailData[sPath];
							},
							setProperty: function (sPath, vValue) {
								mDetailData[sPath] = vValue;
							}
						};
					}

					return null;
				}
			};
		};

		oAppController.onProcessStageSelect({
			getParameter: function (sName) {
				assert.strictEqual(sName, "item", "SegmentedButton selectionChange의 item 파라미터를 읽는다.");
				return {
					getKey: function () {
						return "GR";
					}
				};
			}
		});

		assert.strictEqual(mViewData["/selectedProcessStage"], "GR", "SegmentedButton으로 선택한 Stage를 저장한다.");
		assert.deepEqual(mDetailData["/processItems"].map(function (oRow) {
			return oRow.ItemNo;
		}), ["20"], "CurrentStage를 공백 제거와 대문자 변환 후 비교한다.");
		assert.strictEqual(mDetailData["/processItemCount"], 1, "현재 선택 단계의 표시 건수를 저장한다.");
		assert.strictEqual(mDetailData["/processItemsAll"].length, 3, "단계 전환에 사용할 원본 배열은 변경하지 않는다.");
	});

	QUnit.test("_readProcessItems reads PO context, sorts by ItemNo, and stores detail rows", function (assert) {
		var done = assert.async();
		var oAppController = new Controller();
		var oDetailData = {};
		var aReadFilters;

		oAppController._readEntitySet = function (sPath, aFilters) {
			assert.strictEqual(sPath, "/ProcessItemSet", "ProcessItemSet을 조회한다.");
			aReadFilters = aFilters;

			return Promise.resolve([{
				ItemNo: "20",
				Matnr: "100020",
				Maktx: "Aluminum Drop Handlebar",
				DelayStatusText: "정상"
			}, {
				ItemNo: "10",
				Matnr: "100005",
				Maktx: "DDK Saddle",
				DelayStatusText: "입고 후 미송장"
			}]);
		};

		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					assert.strictEqual(sName, "detail", "ProcessItemSet 결과는 detail 모델에 저장한다.");
					return {
						setProperty: function (sPath, vValue) {
							oDetailData[sPath] = vValue;
						}
					};
				}
			};
		};

		oAppController._readProcessItems("PO", " po00000042 ").then(function (aRows) {
			assert.strictEqual(aReadFilters[0].sPath, "ContextDocType", "첫 번째 필터는 기준 문서유형이다.");
			assert.strictEqual(aReadFilters[0].oValue1, "PO", "기준 문서유형을 대문자로 정규화한다.");
			assert.strictEqual(aReadFilters[1].sPath, "ContextDocNo", "두 번째 필터는 기준 문서번호이다.");
			assert.strictEqual(aReadFilters[1].oValue1, "PO00000042", "기준 문서번호를 앞뒤 공백 제거와 대문자 정규화한다.");
			assert.deepEqual(aRows.map(function (oRow) {
				return oRow.ItemNo;
			}), ["10", "20"], "ItemNo 기준으로 품목을 오름차순 정렬한다.");
			assert.strictEqual(oDetailData["/processItemsAll"].length, 2, "정렬된 원본 품목 진행 상태를 detail 모델에 저장한다.");
			assert.strictEqual(oDetailData["/processItems"].length, 2, "정렬된 화면 품목 진행 상태를 detail 모델에 저장한다.");
			assert.notStrictEqual(oDetailData["/processItemsAll"], oDetailData["/processItems"], "원본과 화면 배열은 별도 배열로 저장한다.");
			assert.strictEqual(oDetailData["/processItemCount"], 2, "품목 진행 상태 건수를 detail 모델에 저장한다.");
			done();
		});
	});

	QUnit.test("_readProcessDocuments reads PO context and stores documents in procurement stage order", function (assert) {
		var done = assert.async();
		var oAppController = new Controller();
		var oDetailData = {};
		var aReadFilters;

		oAppController._readEntitySet = function (sPath, aFilters) {
			assert.strictEqual(sPath, "/ProcessDocumentSet", "ProcessDocumentSet을 조회한다.");
			aReadFilters = aFilters;

			return Promise.resolve([{
				Stage: "IV",
				DocNo: "IV00000001",
				DocYear: "2026",
				ItemNo: "10"
			}, {
				Stage: "PO",
				DocNo: "PO00000042",
				DocYear: "2026",
				ItemNo: "20"
			}, {
				Stage: "PR",
				DocNo: "PR00000021",
				DocYear: "",
				ItemNo: "10"
			}, {
				Stage: "PO",
				DocNo: "PO00000042",
				DocYear: "2026",
				ItemNo: "10"
			}]);
		};

		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					assert.strictEqual(sName, "detail", "ProcessDocumentSet 결과는 detail 모델에 저장한다.");
					return {
						setProperty: function (sPath, vValue) {
							oDetailData[sPath] = vValue;
						}
					};
				}
			};
		};

		oAppController._readProcessDocuments(" po ", " po00000042 ").then(function (aRows) {
			assert.strictEqual(aReadFilters[0].sPath, "ContextDocType", "첫 번째 필터는 기준 문서유형이다.");
			assert.strictEqual(aReadFilters[0].oValue1, "PO", "기준 문서유형을 정규화한다.");
			assert.strictEqual(aReadFilters[1].sPath, "ContextDocNo", "두 번째 필터는 기준 문서번호이다.");
			assert.strictEqual(aReadFilters[1].oValue1, "PO00000042", "기준 문서번호를 정규화한다.");
			assert.deepEqual(aRows.map(function (oRow) {
				return oRow.Stage + ":" + oRow.ItemNo;
			}), ["PR:10", "PO:10", "PO:20", "IV:10"], "조달 단계와 품목번호 순으로 정렬한다.");
			assert.strictEqual(oDetailData["/processDocuments"].length, 4, "관련 문서를 detail 모델에 저장한다.");
			assert.strictEqual(oDetailData["/processDocumentCount"], 4, "관련 문서 건수를 detail 모델에 저장한다.");
			done();
		});
	});

	QUnit.test("onOpenDocumentDetailDialog lazily loads and reuses the document dialog", function (assert) {
		var done = assert.async();
		var oAppController = new Controller();
		var iLoadCount = 0;
		var iOpenCount = 0;
		var oDialog = {
			open: function () {
				iOpenCount += 1;
			}
		};

		oAppController.loadFragment = function (mOptions) {
			iLoadCount += 1;
			assert.strictEqual(
				mOptions.name,
				"code.d3.purchaseprocessmonitor.fragment.DocumentDetailDialog",
				"문서 상세 Fragment를 Controller.loadFragment로 로드한다."
			);
			return Promise.resolve(oDialog);
		};

		oAppController.onOpenDocumentDetailDialog().then(function (oOpenedDialog) {
			assert.strictEqual(oOpenedDialog, oDialog, "로드한 Dialog 인스턴스를 반환한다.");
			return oAppController.onOpenDocumentDetailDialog();
		}).then(function () {
			assert.strictEqual(iLoadCount, 1, "Dialog Fragment는 최초 한 번만 로드한다.");
			assert.strictEqual(iOpenCount, 2, "재사용 시 기존 Dialog를 다시 연다.");
			done();
		});
	});

	QUnit.test("onOpenDelayFormulaPopover lazily loads, reuses, and opens by the footer button", function (assert) {
		var done = assert.async();
		var oAppController = new Controller();
		var iLoadCount = 0;
		var iCloseCount = 0;
		var aOpenBySources = [];
		var oFirstButton = { id: "delayFormulaButton1" };
		var oSecondButton = { id: "delayFormulaButton2" };
		var oPopover = {
			openBy: function (oSource) {
				aOpenBySources.push(oSource);
			},
			close: function () {
				iCloseCount += 1;
			}
		};

		oAppController.loadFragment = function (mOptions) {
			iLoadCount += 1;
			assert.strictEqual(
				mOptions.name,
				"code.d3.purchaseprocessmonitor.fragment.DelayFormulaPopover",
				"지연 산식 ResponsivePopover Fragment를 Controller.loadFragment로 로드한다."
			);
			return Promise.resolve(oPopover);
		};

		oAppController.onOpenDelayFormulaPopover({
			getSource: function () {
				return oFirstButton;
			}
		}).then(function (oOpenedPopover) {
			assert.strictEqual(oOpenedPopover, oPopover, "로드한 ResponsivePopover 인스턴스를 반환한다.");
			return oAppController.onOpenDelayFormulaPopover({
				getSource: function () {
					return oSecondButton;
				}
			});
		}).then(function () {
			assert.strictEqual(iLoadCount, 1, "지연 산식 Fragment는 최초 한 번만 로드한다.");
			assert.deepEqual(
				aOpenBySources,
				[oFirstButton, oSecondButton],
				"데스크톱과 태블릿에서는 누른 Footer 버튼을 기준으로 Popover를 연다."
			);
			return oAppController.onCloseDelayFormulaPopover();
		}).then(function (oClosedPopover) {
			assert.strictEqual(oClosedPopover, oPopover, "닫은 ResponsivePopover 인스턴스를 반환한다.");
			assert.strictEqual(iCloseCount, 1, "휴대폰 Dialog 모드와 Popover 모드에서 같은 close 처리를 사용한다.");
			done();
		});
	});

	QUnit.test("onProcessDocumentPress stores selected document and requests its detail fields", function (assert) {
		var done = assert.async();
		var oAppController = new Controller();
		var mViewData = {};
		var mDetailData = {
			"/documentDetails": [{ FieldName: "이전 값" }]
		};
		var aReadArguments;
		var oSelectedDocument = {
			Stage: "GR",
			DocNo: "5000000001",
			DocYear: "2026",
			ItemNo: "10"
		};

		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					if (sName === "view") {
						return {
							setProperty: function (sPath, vValue) {
								mViewData[sPath] = vValue;
							}
						};
					}

					if (sName === "detail") {
						return {
							setProperty: function (sPath, vValue) {
								mDetailData[sPath] = vValue;
							}
						};
					}

					return null;
				}
			};
		};

		oAppController._readDocumentDetails = function (sStage, sDocNo, sDocYear, sItemNo) {
			aReadArguments = [sStage, sDocNo, sDocYear, sItemNo];
			return Promise.resolve([]);
		};

		oAppController.onProcessDocumentPress({
			getParameter: function (sName) {
				assert.strictEqual(sName, "listItem", "관련 문서 Table의 선택 행을 읽는다.");
				return {
					getBindingContext: function (sModelName) {
						assert.strictEqual(sModelName, "detail", "관련 문서는 detail 모델에 바인딩한다.");
						return {
							getObject: function () {
								return oSelectedDocument;
							}
						};
					}
				};
			}
		}).then(function () {
			assert.strictEqual(mViewData["/selectedDocumentStage"], "GR", "선택 문서 단계를 저장한다.");
			assert.strictEqual(mViewData["/selectedDocumentNo"], "5000000001", "선택 문서번호를 저장한다.");
			assert.strictEqual(mViewData["/selectedDocumentYear"], "2026", "선택 문서연도를 저장한다.");
			assert.strictEqual(mViewData["/selectedDocumentItemNo"], "10", "선택 문서품목을 저장한다.");
			assert.deepEqual(mDetailData["/documentDetails"], [], "새 문서를 선택하면 이전 상세 필드를 초기화한다.");
			assert.deepEqual(aReadArguments, ["GR", "5000000001", "2026", "10"], "선택 문서 Key로 상세 조회를 실행한다.");
			assert.strictEqual(mViewData["/dialogBusy"], false, "상세 조회 완료 후 Dialog Busy를 해제한다.");
			done();
		});
	});

	QUnit.test("_readDocumentDetails filters selected document and stores rows by DisplayOrder", function (assert) {
		var done = assert.async();
		var oAppController = new Controller();
		var aReadFilters;
		var mDetailData = {};

		oAppController._readEntitySet = function (sPath, aFilters) {
			assert.strictEqual(sPath, "/DocumentDetailSet", "DocumentDetailSet을 조회한다.");
			aReadFilters = aFilters;

			return Promise.resolve([{
				DisplayOrder: 20,
				GroupName: "수량",
				FieldName: "입고수량",
				FieldValue: "10 EA"
			}, {
				DisplayOrder: 10,
				GroupName: "기본정보",
				FieldName: "문서번호",
				FieldValue: "5000000001"
			}]);
		};

		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					assert.strictEqual(sName, "detail", "DocumentDetailSet 결과는 detail 모델에 저장한다.");
					return {
						setProperty: function (sPath, vValue) {
							mDetailData[sPath] = vValue;
						}
					};
				}
			};
		};

		oAppController._readDocumentDetails(" gr ", " 5000000001 ", " 2026 ", " 10 ").then(function (aRows) {
			assert.deepEqual(aReadFilters.map(function (oFilter) {
				return [oFilter.sPath, oFilter.oValue1];
			}), [
				["Stage", "GR"],
				["DocNo", "5000000001"],
				["DocYear", "2026"],
				["ItemNo", "10"]
			], "DocumentDetailSet Key 네 개를 정규화해 전달한다.");
			assert.deepEqual(aRows.map(function (oRow) {
				return oRow.DisplayOrder;
			}), [10, 20], "Backend DisplayOrder 순으로 정렬한다.");
			assert.deepEqual(mDetailData["/documentDetails"], aRows, "정렬된 상세 필드를 detail 모델에 저장한다.");
			done();
		});
	});

	QUnit.test("Mid column navigation actions switch layout and close selected PO context", function (assert) {
		var oAppController = new Controller();
		var mViewData = {
			layout: "TwoColumnsMidExpanded",
			selectedDocType: "PO",
			selectedDocNo: "PO00000042"
		};
		var oDetailData = {
			processFlow: [{ Stage: "PO" }],
			processItems: [{ ItemNo: "10" }],
			processDocuments: [{ DocNo: "GR00000001" }],
			documentDetails: [{ Field: "DocNo" }]
		};

		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					if (sName === "view") {
						return {
							getProperty: function (sPath) {
								return mViewData[sPath.replace("/", "")];
							},
							setProperty: function (sPath, vValue) {
								mViewData[sPath.replace("/", "")] = vValue;
							}
						};
					}

					assert.strictEqual(sName, "detail", "닫기 동작은 Mid 상세 모델을 초기화한다.");
					return {
						setData: function (oData) {
							oDetailData = oData;
						}
					};
				}
			};
		};

		oAppController.onEnterMidFullScreen();
		assert.strictEqual(mViewData.layout, "MidColumnFullScreen", "전체화면 버튼은 MidColumnFullScreen으로 전환한다.");

		oAppController.onExitMidFullScreen();
		assert.strictEqual(mViewData.layout, "TwoColumnsMidExpanded", "전체화면 해제 버튼은 2컬럼 화면으로 복귀한다.");

		oAppController.onCloseMidColumn();
		assert.strictEqual(mViewData.layout, "OneColumn", "닫기 버튼은 Begin Column 단독 화면으로 복귀한다.");
		assert.strictEqual(mViewData.selectedDocType, "", "닫기 버튼은 선택 문서유형을 초기화한다.");
		assert.strictEqual(mViewData.selectedDocNo, "", "닫기 버튼은 선택 문서번호를 초기화한다.");
		assert.deepEqual(oDetailData.processFlow, [], "닫기 버튼은 ProcessFlow 데이터를 초기화한다.");
		assert.deepEqual(oDetailData.processItems, [], "닫기 버튼은 품목 진행 상태 데이터를 초기화한다.");
		assert.deepEqual(oDetailData.processDocuments, [], "닫기 버튼은 관련 문서 데이터를 초기화한다.");
		assert.deepEqual(oDetailData.documentDetails, [], "닫기 버튼은 문서 상세 데이터를 초기화한다.");
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

	QUnit.test("_loadBeginSummary reuses the active request and prevents duplicate reads", function (assert) {
		var done = assert.async();
		var oAppController = new Controller();
		var fnResolveRead;
		var pPendingRead = new Promise(function (resolve) {
			fnResolveRead = resolve;
		});
		var iReadCount = 0;
		var aBusyStates = [];
		var fnOriginalShow = MessageToast.show;

		MessageToast.show = function () {};
		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					assert.strictEqual(sName, "view", "Begin 조회 Busy는 view 모델에서 관리한다.");
					return {
						setProperty: function (sPath, bValue) {
							assert.strictEqual(sPath, "/busy", "Begin 영역 Busy 경로만 변경한다.");
							aBusyStates.push(bValue);
						}
					};
				}
			};
		};

		oAppController._readDashboardSummary = function () {
			iReadCount += 1;
			return pPendingRead;
		};
		oAppController._readWeeklySummary = function () {
			iReadCount += 1;
			return pPendingRead;
		};
		oAppController._readDelayList = function () {
			iReadCount += 1;
			return pPendingRead;
		};
		oAppController._updateDashboardCountsFromDelayRows = function () {};

		var pFirstLoad = oAppController._loadBeginSummary();
		var pDuplicateLoad = oAppController._loadBeginSummary();

		assert.strictEqual(pDuplicateLoad, pFirstLoad, "조회 중 재호출은 진행 중인 Promise를 그대로 반환한다.");
		assert.strictEqual(iReadCount, 3, "Dashboard/Weekly/DelayList는 각각 한 번만 호출한다.");
		assert.deepEqual(aBusyStates, [true], "중복 호출이 Busy를 다시 켜지 않는다.");

		fnResolveRead([]);
		pFirstLoad.then(function () {
			assert.deepEqual(aBusyStates, [true, false], "공통 조회가 끝난 뒤 Busy를 한 번만 해제한다.");
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

	QUnit.test("_buildSummaryFilters sends KeyDate and LookbackMonths for dashboard summary", function (assert) {
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
								LookbackMonths: "6",
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

		assert.strictEqual(aFilters.length, 2, "DashboardSummarySet에는 KeyDate와 LookbackMonths만 필터로 전달한다.");
		assert.strictEqual(aFilters[0].sPath, "KeyDate", "필터 Property는 KeyDate이다.");
		assert.strictEqual(aFilters[1].sPath, "LookbackMonths", "두 번째 필터 Property는 LookbackMonths이다.");
		assert.strictEqual(aFilters[1].oValue1, 6, "조회기간 문자열 값을 Edm.Int32에 맞는 숫자로 변환한다.");
	});

	QUnit.test("_buildWeeklySummaryFilters sends only KeyDate for weekly summary", function (assert) {
		var oAppController = new Controller();
		var oKeyDate = new Date(2026, 5, 16);

		oAppController.getView = function () {
			return {
				getModel: function (sName) {
					assert.strictEqual(sName, "filter", "WeeklySummary 필터는 filter 모델 기준으로 만든다.");
					return {
						getData: function () {
							return {
								KeyDate: oKeyDate,
								LookbackMonths: "6"
							};
						}
					};
				}
			};
		};

		var aFilters = oAppController._buildWeeklySummaryFilters();

		assert.strictEqual(aFilters.length, 1, "WeeklySummarySet에는 조회기간을 보내지 않고 KeyDate만 전달한다.");
		assert.strictEqual(aFilters[0].sPath, "KeyDate", "필터 Property는 KeyDate이다.");
	});

	QUnit.test("_buildDelayListFilters sends LookbackMonths for procurement list", function (assert) {
		var oAppController = new Controller();
		var oKeyDate = new Date(2026, 5, 16);

		oAppController.getView = function () {
			return {
				getModel: function () {
					return {
						getData: function () {
							return {
								KeyDate: oKeyDate,
								LookbackMonths: "6",
								PrNo: "",
								RfqNo: "",
								PoNo: "",
								Matnr: "",
								Lifnr: "",
								Werks: "",
								DelayStatuses: ["DELAY"]
							};
						}
					};
				}
			};
		};

		var aFilters = oAppController._buildDelayListFilters();

		assert.strictEqual(aFilters.length, 3, "DelayListSet에는 KeyDate, LookbackMonths, DelayStatus를 전달한다.");
		assert.strictEqual(aFilters[0].sPath, "KeyDate", "첫 번째 필터는 KeyDate이다.");
		assert.strictEqual(aFilters[1].sPath, "LookbackMonths", "두 번째 필터는 조회기간이다.");
		assert.strictEqual(aFilters[1].oValue1, 6, "조회기간 문자열 값을 숫자로 변환한다.");
		assert.strictEqual(aFilters[2].sPath, "DelayStatus", "마지막 필터는 지연상태이다.");
	});

	QUnit.test("_buildDelayListFilters adds selected document type when document number is empty", function (assert) {
		var oAppController = new Controller();
		var oKeyDate = new Date(2026, 5, 16);

		oAppController.getView = function () {
			return {
				getModel: function () {
					return {
						getData: function () {
							return {
								KeyDate: oKeyDate,
								LookbackMonths: "3",
								DocType: "PO",
								PrNo: "",
								RfqNo: "",
								PoNo: "",
								Matnr: "",
								Maktx: "",
								Lifnr: "",
								Name1: "",
								Werks: "",
								DelayStatuses: ["DELAY"]
							};
						}
					};
				}
			};
		};

		var aFilters = oAppController._buildDelayListFilters();

		assert.strictEqual(aFilters.length, 4, "DelayListSet에는 KeyDate, LookbackMonths, DocType, DelayStatus를 전달한다.");
		assert.strictEqual(aFilters[2].sPath, "DocType", "문서번호가 없으면 선택한 문서유형을 단독 필터로 전달한다.");
		assert.strictEqual(aFilters[2].oValue1, "PO", "PO 선택값을 DocType 필터 값으로 사용한다.");
		assert.strictEqual(aFilters[3].sPath, "DelayStatus", "지연상태 필터는 문서유형 뒤에 추가한다.");
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

	QUnit.test("_buildDelayListFilters adds material, vendor, plant, and name filters", function (assert) {
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

		assert.strictEqual(aFilters.length, 7, "DelayListSet에는 KeyDate, 자재/공급업체/플랜트 조건, 명칭 조건, 지연상태를 전달한다.");
		assert.strictEqual(aFilters[1].sPath, "Matnr", "자재코드는 Matnr 필터로 전달한다.");
		assert.strictEqual(aFilters[1].oValue1, "100030", "자재코드는 앞뒤 공백을 제거한다.");
		assert.strictEqual(aFilters[2].sPath, "Maktx", "자재명은 Maktx 필터로 전달한다.");
		assert.strictEqual(aFilters[2].oValue1, "700Wh Battery", "자재명은 대소문자를 유지하고 앞뒤 공백만 제거한다.");
		assert.strictEqual(aFilters[3].sPath, "Lifnr", "공급업체코드는 Lifnr 필터로 전달한다.");
		assert.strictEqual(aFilters[3].oValue1, "V00006", "공급업체코드는 대문자로 정규화한다.");
		assert.strictEqual(aFilters[4].sPath, "Name1", "공급업체명은 Name1 필터로 전달한다.");
		assert.strictEqual(aFilters[4].oValue1, "Shenzhen Battery Co.", "공급업체명은 대소문자를 유지하고 앞뒤 공백만 제거한다.");
		assert.strictEqual(aFilters[5].sPath, "Werks", "플랜트는 Werks 필터로 전달한다.");
		assert.strictEqual(aFilters[5].oValue1, "P00001", "플랜트는 대문자로 정규화한다.");
		assert.strictEqual(aFilters[6].sPath, "DelayStatus", "지연상태는 상세조건 뒤에 추가한다.");
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

	QUnit.test("_getODataErrorMessage extracts the Gateway business message", function (assert) {
		var oAppController = new Controller();
		var oError = {
			statusCode: 400,
			message: "HTTP request failed",
			responseText: JSON.stringify({
				error: {
					message: {
						lang: "ko",
						value: "공급업체 조회 조건을 확인하세요."
					}
				}
			})
		};

		assert.strictEqual(
			oAppController._getODataErrorMessage(oError, "모니터링 데이터를 조회하지 못했습니다."),
			"공급업체 조회 조건을 확인하세요.",
			"Gateway가 반환한 업무 메시지를 기술 오류 문구보다 우선 표시한다."
		);
	});

	QUnit.test("_getODataErrorMessage maps technical failures to user guidance", function (assert) {
		var oAppController = new Controller();
		var sContextMessage = "모니터링 데이터를 조회하지 못했습니다.";

		assert.strictEqual(
			oAppController._getODataErrorMessage({ statusCode: 0, message: "Network Error" }, sContextMessage),
			"서버에 연결할 수 없습니다. 네트워크 상태와 로그인 세션을 확인한 후 다시 시도하세요.",
			"연결 실패는 사용자가 확인할 수 있는 조치 방법으로 안내한다."
		);
		assert.strictEqual(
			oAppController._getODataErrorMessage({ statusCode: 403, message: "Forbidden" }, sContextMessage),
			"이 정보를 조회할 권한이 없거나 로그인 세션이 만료되었습니다. 다시 로그인한 후 시도하세요.",
			"권한 오류는 권한 또는 로그인 상태를 확인하도록 안내한다."
		);
		assert.strictEqual(
			oAppController._getODataErrorMessage({ statusCode: 400, message: "HTTP request failed" }, sContextMessage),
			"조회 조건을 처리하지 못했습니다. 입력한 조건을 확인한 후 다시 시도하세요.",
			"잘못된 요청은 조회 조건 확인 안내로 변환한다."
		);
		assert.strictEqual(
			oAppController._getODataErrorMessage({ statusCode: 500, message: "Internal Server Error" }, sContextMessage),
			"요청을 처리하는 중 문제가 발생했습니다. 잠시 후 다시 시도하세요.",
			"서버 오류는 기술 용어 없이 재시도를 안내한다."
		);
		assert.strictEqual(
			oAppController._getODataErrorMessage({ message: "HTTP request failed" }, sContextMessage),
			sContextMessage,
			"상태 코드를 알 수 없는 기술 오류는 화면 작업에 맞는 기본 안내로 대체한다."
		);
	});

});
