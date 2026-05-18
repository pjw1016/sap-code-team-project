/*global QUnit*/

sap.ui.define([
	"code/t0/ui5/review5/controller/Carrier.controller"
], function (Controller) {
	"use strict";

	QUnit.module("Carrier Controller");

	QUnit.test("I should test the Carrier controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
