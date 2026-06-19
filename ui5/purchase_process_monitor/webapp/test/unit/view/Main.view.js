/*global QUnit*/

sap.ui.define([
    "sap/ui/thirdparty/jquery"
], function (jQuery) {
    "use strict";

    QUnit.module("view/Main responsive structure");

    QUnit.test("main view and document dialog keep responsive layout contracts", function (assert) {
        var done = assert.async();
        var sAppRoot = sap.ui.require.toUrl("code/d3/purchaseprocessmonitor");

        Promise.all([
            jQuery.ajax({ url: sAppRoot + "/view/Main.view.xml", dataType: "text" }),
            jQuery.ajax({ url: sAppRoot + "/fragment/DocumentDetailDialog.fragment.xml", dataType: "text" }),
            jQuery.ajax({ url: sAppRoot + "/css/style.css", dataType: "text" })
        ]).then(function (aSources) {
            var sMainView = aSources[0];
            var sDocumentDialog = aSources[1];
            var sStyleSheet = aSources[2];
            var iResponsiveFilterFields = (sMainView.match(/ppmFilterField/g) || []).length;

            assert.ok(iResponsiveFilterFields >= 12, "기본 및 상세 조회조건 필드에 모바일 폭 제어 클래스를 적용한다.");
            assert.ok(/id="poProcessFlow"[\s\S]*?scrollable="true"/.test(sMainView), "좁은 Mid Column에서는 ProcessFlow 내부 스크롤을 사용한다.");
            assert.ok(/id="processItemTable"[\s\S]*?width="100%"/.test(sMainView), "품목 Table은 Mid Column의 사용 가능한 폭을 채운다.");
            assert.ok(/id="processDocumentTable"[\s\S]*?width="100%"/.test(sDocumentDialog), "관련 문서 Table은 Dialog 폭을 넘지 않는다.");
            assert.ok(/@media\s*\(max-width:\s*600px\)[\s\S]*?\.ppmFilterField/.test(sStyleSheet), "휴대폰 폭에서 조회조건 필드를 한 열로 배치한다.");
            done();
        }).catch(function (oError) {
            assert.ok(false, "반응형 구조 파일을 읽어야 합니다: " + oError);
            done();
        });
    });
});
