/*global QUnit*/

sap.ui.define([
	"code/d3/quotecomparison/model/formatter"
], function (formatter) {
	"use strict";

	QUnit.module("model/formatter");

	QUnit.test("formatDate returns yyyy-MM-dd for date-like values", function (assert) {
		assert.strictEqual(formatter.formatDate(new Date(2026, 4, 27)), "2026-05-27");
		assert.strictEqual(formatter.formatDate("2026-05-27T00:00:00"), "2026-05-27");
		assert.strictEqual(formatter.formatDate(null), "");
	});

	QUnit.test("boolean helpers convert backend X flags to display values", function (assert) {
		assert.strictEqual(formatter.formatBooleanText("X"), "예");
		assert.strictEqual(formatter.formatBooleanText(""), "아니오");
		assert.strictEqual(formatter.formatBooleanState("X"), "Success");
		assert.strictEqual(formatter.formatBooleanState(""), "None");
	});

	QUnit.test("current award helpers emphasize only the awarded MQ row", function (assert) {
		assert.strictEqual(formatter.formatCurrentAwardText("X"), "현재 채택");
		assert.strictEqual(formatter.formatCurrentAwardText(""), "-");
		assert.strictEqual(formatter.formatCurrentAwardState("X"), "Success");
		assert.strictEqual(formatter.formatCurrentAwardState(""), "None");
		assert.strictEqual(formatter.formatCurrentAwardIcon("X"), "sap-icon://accept");
		assert.strictEqual(formatter.formatCurrentAwardIcon(""), "");
	});

	QUnit.test("selection and response helpers expose UI5 ValueState strings", function (assert) {
		assert.strictEqual(formatter.formatCanSelectText("X"), "선택 가능");
		assert.strictEqual(formatter.formatCanSelectText(""), "선택 불가");
		assert.strictEqual(formatter.formatCanSelectState("X"), "Success");
		assert.strictEqual(formatter.formatCanSelectState(""), "Warning");
		assert.strictEqual(formatter.formatResponseState("R"), "Success");
		assert.strictEqual(formatter.formatResponseState("N"), "Warning");
		assert.strictEqual(formatter.formatResponseState(""), "None");
	});

	QUnit.test("numeric helpers return blank text for invalid values", function (assert) {
		assert.strictEqual(formatter.formatQuantity("ABC"), "");
		assert.strictEqual(formatter.formatAmount(undefined), "");
		assert.strictEqual(formatter.formatExchangeRate(undefined), "");
		assert.strictEqual(formatter.formatCurrencyAmount("ABC", "KRW"), "");
	});

	QUnit.test("formatExchangeRate keeps at least two decimal places", function (assert) {
		assert.strictEqual(formatter.formatExchangeRate("1507.9"), "1,507.90");
		assert.strictEqual(formatter.formatExchangeRate("1507.98765"), "1,507.98765");
	});

	QUnit.test("formatMqDeliveryDateState compares MQ date with selected RFQ Item date", function (assert) {
		assert.strictEqual(
			formatter.formatMqDeliveryDateState("2026-06-21", "2026-06-22"),
			"Warning",
			"Earlier MQ delivery date is shown with warning color."
		);
		assert.strictEqual(
			formatter.formatMqDeliveryDateState("2026-06-22", "2026-06-22"),
			"Success",
			"Same MQ delivery date is shown with success color."
		);
		assert.strictEqual(
			formatter.formatMqDeliveryDateState("2026-06-23", "2026-06-22"),
			"Error",
			"Later MQ delivery date is shown with error color."
		);
		assert.strictEqual(
			formatter.formatMqDeliveryDateState(null, "2026-06-22"),
			"None",
			"Missing MQ date keeps the default text state."
		);
	});
});
