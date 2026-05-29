/*global QUnit*/

sap.ui.define([
	"sap/ui/test/opaQunit",
	"./pages/App",
	"./pages/Main"
], function (opaTest) {
	"use strict";

	QUnit.module("Navigation Journey");

	opaTest("Should see the initial page of the app", function (Given, When, Then) {
		// 테스트 준비: 앱을 시작한다.
		Given.iStartMyApp();

		// 검증: 앱 컨테이너와 메인 View가 표시되는지 확인한다.
		Then.onTheAppPage.iShouldSeeTheApp();
      	Then.onTheViewPage.iShouldSeeThePageView();

		// 정리: 테스트가 끝난 뒤 앱을 종료한다.
		Then.iTeardownMyApp();
	});
});
