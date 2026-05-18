/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"coded00/expense.btrip/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});
