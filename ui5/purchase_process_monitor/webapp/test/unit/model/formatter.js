/*global QUnit*/

sap.ui.define([
    "code/d3/purchaseprocessmonitor/model/formatter"
], function (formatter) {
    "use strict";

    QUnit.module("model/formatter");

    QUnit.test("criticalityToValueState maps backend criticality to sap.m ValueState", function (assert) {
        assert.strictEqual(formatter.criticalityToValueState("Positive"), "Success");
        assert.strictEqual(formatter.criticalityToValueState("Information"), "Information");
        assert.strictEqual(formatter.criticalityToValueState("Critical"), "Warning");
        assert.strictEqual(formatter.criticalityToValueState("Negative"), "Error");
        assert.strictEqual(formatter.criticalityToValueState("None"), "None");
    });

    QUnit.test("formatDelayDays displays working-day delay text", function (assert) {
        assert.strictEqual(formatter.formatDelayDays(14), "14일");
        assert.strictEqual(formatter.formatDelayDays(0), "-");
        assert.strictEqual(formatter.formatDelayDays(null), "-");
    });

    QUnit.test("formatQuantityWithUnit displays quantity and unit together", function (assert) {
        assert.strictEqual(formatter.formatQuantityWithUnit(10, "EA"), "10 EA");
        assert.strictEqual(formatter.formatQuantityWithUnit("12.345", "KG"), "12.345 KG");
        assert.strictEqual(formatter.formatQuantityWithUnit(null, "EA"), "0 EA");
        assert.strictEqual(formatter.formatQuantityWithUnit(5, ""), "5");
    });

    QUnit.test("formatProcessQuantities labels PO, GR, and IV quantities in one line", function (assert) {
        assert.strictEqual(
            formatter.formatProcessQuantities(10, 10, 0, "EA"),
            "PO 10 EA / GR 10 EA / IV 0 EA",
            "각 수량의 업무 의미를 라벨로 구분하여 한 줄로 표시한다."
        );
        assert.strictEqual(
            formatter.formatProcessQuantities("12.5", 3, null, "KG"),
            "PO 12.5 KG / GR 3 KG / IV 0 KG",
            "소수 수량과 빈 송장 수량도 동일한 형식으로 표시한다."
        );
    });

    QUnit.test("summaryCode and summaryText split backend summary values", function (assert) {
        assert.strictEqual(formatter.summaryCode("100005 / DDK Saddle 외 4건"), "100005");
        assert.strictEqual(formatter.summaryText("100005 / DDK Saddle 외 4건"), "DDK Saddle 외 4건");
        assert.strictEqual(formatter.summaryCode("견적 접수 후 미채택"), "견적 접수 후 미채택");
        assert.strictEqual(formatter.summaryText("견적 접수 후 미채택"), "");
    });

    QUnit.test("formatProcessItemNoDataText distinguishes PO and stage empty results", function (assert) {
        assert.strictEqual(
            formatter.formatProcessItemNoDataText(""),
            "선택한 PO의 품목 진행 정보가 없습니다.",
            "단계를 선택하지 않은 경우 PO 전체 품목 정보가 없음을 안내한다."
        );
        assert.strictEqual(
            formatter.formatProcessItemNoDataText("GR"),
            "선택한 GR 단계에 해당하는 품목이 없습니다.",
            "단계 필터 결과가 비어 있으면 선택한 단계를 포함해 안내한다."
        );
    });

    QUnit.test("formatDocumentDetailNoDataText distinguishes selection and empty details", function (assert) {
        assert.strictEqual(
            formatter.formatDocumentDetailNoDataText(""),
            "관련 문서를 선택하면 상세 정보가 표시됩니다.",
            "문서를 선택하기 전에는 다음 행동을 안내한다."
        );
        assert.strictEqual(
            formatter.formatDocumentDetailNoDataText("5000000001"),
            "선택한 문서의 상세 정보가 없습니다.",
            "문서를 선택한 뒤 결과가 비어 있으면 데이터가 없음을 정확히 안내한다."
        );
    });
});
