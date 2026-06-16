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

    QUnit.test("summaryCode and summaryText split backend summary values", function (assert) {
        assert.strictEqual(formatter.summaryCode("100005 / DDK Saddle 외 4건"), "100005");
        assert.strictEqual(formatter.summaryText("100005 / DDK Saddle 외 4건"), "DDK Saddle 외 4건");
        assert.strictEqual(formatter.summaryCode("견적 접수 후 미채택"), "견적 접수 후 미채택");
        assert.strictEqual(formatter.summaryText("견적 접수 후 미채택"), "");
    });
});
