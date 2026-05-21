sap.ui.define([], function () {
    "use strict";

    /*
     * ChartHelper는 VizFrame 이벤트/Popover 데이터에서 필요한 값을 꺼내는 유틸이다.
     *
     * 분리 이유:
     * - VizFrame이 넘기는 데이터 구조는 UI5 버전, 차트 타입, 이벤트 종류에 따라 조금씩 달라질 수 있다.
     * - 그래서 컨트롤러 안에 재귀 탐색 로직을 길게 두면 Main.controller.js가 계속 복잡해진다.
     * - 이 파일은 "복잡한 데이터 구조를 안전하게 훑어서 원하는 값 찾기"만 담당한다.
     *
     * 주의:
     * - 이 헬퍼는 화면 상태나 OData 모델을 직접 모른다.
     * - 어떤 값이 정상 상태코드인지, 어떤 문자열이 상태명인지는 컨트롤러가 판단한다.
     */
    return {
        extractNamedValue: function (vData, aNames, iDepth, aVisited) {
            /*
             * 객체/배열이 중첩된 VizFrame 데이터에서 이름이 맞는 값을 찾는다.
             *
             * 예:
             * - { name: "StatusCode", value: "D" }       -> "D"
             * - { StatusCode: "D" }                      -> "D"
             * - { data: [{ name: "Status", val: "미입고 지연" }] } -> "미입고 지연"
             *
             * iDepth:
             * - 데이터가 예상보다 깊거나 순환 참조가 있을 때 무한 탐색을 막기 위한 깊이 제한이다.
             *
             * aVisited:
             * - 이미 확인한 객체를 기억해서 같은 객체를 반복 탐색하지 않게 한다.
             */
            var sName;
            var vValue;
            var aKeys;
            var sFoundValue;

            if (!vData || iDepth > 8) {
                return "";
            }

            if (typeof vData !== "object") {
                return "";
            }

            aVisited = aVisited || [];
            if (aVisited.indexOf(vData) > -1) {
                return "";
            }
            aVisited.push(vData);

            if (Array.isArray(vData)) {
                vData.some(function (vEntry) {
                    sFoundValue = this.extractNamedValue(vEntry, aNames, (iDepth || 0) + 1, aVisited);
                    return !!sFoundValue;
                }.bind(this));

                return sFoundValue || "";
            }

            /*
             * VizFrame 데이터는 name/value 형태나 ctx.name 형태로 차원명을 들고 오는 경우가 있다.
             * aNames에 포함된 이름이면 val/value/rawValue/text 중 문자열 값을 반환한다.
             */
            sName = vData.name || vData.label || vData.key || vData.ctx && (vData.ctx.name || vData.ctx.path);
            if (aNames.indexOf(sName) > -1) {
                vValue = vData.val || vData.value || vData.rawValue || vData.text;
                if (typeof vValue === "string") {
                    return vValue;
                }
            }

            /*
             * { StatusCode: "D" }처럼 필드명이 바로 객체 속성으로 들어오는 경우도 처리한다.
             */
            sFoundValue = aNames.reduce(function (sResult, sFieldName) {
                if (sResult) {
                    return sResult;
                }

                return typeof vData[sFieldName] === "string" ? vData[sFieldName] : "";
            }, "");

            if (sFoundValue) {
                return sFoundValue;
            }

            /*
             * 현재 깊이에서 못 찾으면 하위 속성을 다시 탐색한다.
             * 이 로직 때문에 Popover 데이터 구조가 조금 바뀌어도 비교적 안정적으로 값을 찾을 수 있다.
             */
            aKeys = Object.keys(vData);
            aKeys.some(function (sKey) {
                sFoundValue = this.extractNamedValue(vData[sKey], aNames, (iDepth || 0) + 1, aVisited);
                return !!sFoundValue;
            }.bind(this));

            return sFoundValue || "";
        },

        findKnownText: function (vData, fnIsKnownText, iDepth, aVisited) {
            /*
             * 중첩 데이터 안에서 "앱이 알고 있는 텍스트"와 정확히 일치하는 문자열을 찾는다.
             *
             * 컨트롤러는 fnIsKnownText로 상태명인지 판단하는 함수를 넘긴다.
             * 이 헬퍼는 그 판단 기준을 직접 알지 않고, 데이터 탐색만 수행한다.
             */
            var sFoundText = "";
            var aKeys;

            if (!vData || iDepth > 8) {
                return "";
            }

            if (typeof vData === "string") {
                return fnIsKnownText(vData) ? vData : "";
            }

            if (typeof vData !== "object") {
                return "";
            }

            aVisited = aVisited || [];
            if (aVisited.indexOf(vData) > -1) {
                return "";
            }
            aVisited.push(vData);

            if (Array.isArray(vData)) {
                vData.some(function (vEntry) {
                    sFoundText = this.findKnownText(vEntry, fnIsKnownText, (iDepth || 0) + 1, aVisited);
                    return !!sFoundText;
                }.bind(this));

                return sFoundText;
            }

            aKeys = Object.keys(vData);
            aKeys.some(function (sKey) {
                sFoundText = this.findKnownText(vData[sKey], fnIsKnownText, (iDepth || 0) + 1, aVisited);
                return !!sFoundText;
            }.bind(this));

            return sFoundText;
        }
    };
});
