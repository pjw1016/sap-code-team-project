/*global QUnit*/

sap.ui.define([
    "code/d3/purchaseprocessmonitor/model/models"
], function (models) {
    "use strict";

    QUnit.module("model/models");

    QUnit.test("createFilterModel provides V1.2.1 default search conditions", function (assert) {
        var oFilterModel = models.createFilterModel();
        var oFilterData = oFilterModel.getData();

        assert.ok(oFilterData.KeyDate instanceof Date, "기준일은 DatePicker와 OData Date 필터에서 바로 쓸 수 있는 Date 객체이다.");
        assert.strictEqual(oFilterData.LookbackMonths, "3", "조회기간 기본값은 최근 3개월이다.");
        assert.strictEqual(oFilterData.PrNo, "", "PR번호는 기본 조회조건이지만 초기값은 공백이다.");
        assert.strictEqual(oFilterData.PoNo, "", "PO번호는 기본 조회조건이지만 초기값은 공백이다.");
        assert.strictEqual(oFilterData.Matnr, "", "자재코드는 상세 조회조건이며 초기값은 공백이다.");
        assert.strictEqual(oFilterData.Maktx, "", "자재명(MAKTX)은 상세 조회조건이며 초기값은 공백이다.");
        assert.strictEqual(oFilterData.Lifnr, "", "공급업체는 상세 조회조건이며 초기값은 공백이다.");
        assert.strictEqual(oFilterData.Name1, "", "공급업체명(NAME1)은 상세 조회조건이며 초기값은 공백이다.");
        assert.strictEqual(oFilterData.Werks, "", "플랜트는 상세 조회조건이며 초기값은 공백이다.");
        assert.strictEqual(oFilterData.DelayStatus, "", "DelayStatus는 KPI 클릭 전에는 비어 있다.");
    });

    QUnit.test("createViewModel provides initial FCL and busy states", function (assert) {
        var oViewModel = models.createViewModel();
        var oViewData = oViewModel.getData();

        assert.strictEqual(oViewData.layout, "OneColumn", "최초 진입은 Begin Column만 표시한다.");
        assert.strictEqual(oViewData.busy, false, "최초 진입 전 전체 Busy는 꺼져 있다.");
        assert.strictEqual(oViewData.showAdvancedFilters, false, "상세 조회조건은 기본적으로 접혀 있다.");
        assert.strictEqual(oViewData.selectedDocType, "", "선택 문서 유형은 초기에는 비어 있다.");
        assert.strictEqual(oViewData.selectedDocNo, "", "선택 문서 번호는 초기에는 비어 있다.");
    });

    QUnit.test("createDashboardModel provides zero-based KPI defaults", function (assert) {
        var oDashboardModel = models.createDashboardModel();
        var oDashboardData = oDashboardModel.getData();

        assert.strictEqual(oDashboardData.SummaryId, "DASHBOARD", "DashboardSummarySet 결과 모델임을 식별할 수 있다.");
        assert.strictEqual(oDashboardData.RfqNoqHdrCnt, 0, "RFQ 미접수 Header 수 기본값은 0이다.");
        assert.strictEqual(oDashboardData.MqSelDlyHdrCnt, 0, "MQ 채택 지연 Header 수 기본값은 0이다.");
        assert.strictEqual(oDashboardData.PoDlvDlyHdrCnt, 0, "PO 납기 지연 Header 수 기본값은 0이다.");
        assert.strictEqual(oDashboardData.IvIncHdrCnt, 0, "입고 후 미송장 Header 수 기본값은 0이다.");
        assert.strictEqual(oDashboardData.PrDlyHdrCnt, 0, "PR 처리 지연 Header 수 기본값은 0이다.");
    });

    QUnit.test("createWeeklyModel provides amount and count defaults", function (assert) {
        var oWeeklyModel = models.createWeeklyModel();
        var oWeeklyData = oWeeklyModel.getData();

        assert.strictEqual(oWeeklyData.SummaryId, "WEEKLY", "WeeklySummarySet 결과 모델임을 식별할 수 있다.");
        assert.strictEqual(oWeeklyData.PurchaseAmt, 0, "구매금액 기본값은 0이다.");
        assert.strictEqual(oWeeklyData.ReceiptAmt, 0, "입고금액 기본값은 0이다.");
        assert.strictEqual(oWeeklyData.InvoiceAmt, 0, "송장금액 기본값은 0이다.");
        assert.strictEqual(oWeeklyData.Waers, "KRW", "통화 기본값은 KRW이다.");
        assert.strictEqual(oWeeklyData.CompGrHdrCnt, 0, "금주 입고 완료 건수 기본값은 0이다.");
    });
});
