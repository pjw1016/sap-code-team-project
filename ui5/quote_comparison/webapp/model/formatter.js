sap.ui.define([
    "sap/ui/core/format/DateFormat",
    "sap/ui/core/format/NumberFormat",
    "sap/ui/core/library"
], function (DateFormat, NumberFormat, coreLibrary) {
    "use strict";

    var ValueState = coreLibrary.ValueState;
    var oDateFormat = DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" });
    var oQuantityFormat = NumberFormat.getFloatInstance({
        groupingEnabled: true,
        maxFractionDigits: 3
    });
    var oAmountFormat = NumberFormat.getFloatInstance({
        groupingEnabled: true,
        minFractionDigits: 0,
        maxFractionDigits: 2
    });
    /*
     * 환율은 금액과 달리 끝자리 0도 의미가 있다.
     * 예를 들어 1507.9를 1,507.9로 줄이면 소수 자릿수가 부족해 보이므로 최소 2자리,
     * Gateway 타입 Scale=5에 맞춰 최대 5자리까지 표시한다.
     */
    var oExchangeRateFormat = NumberFormat.getFloatInstance({
        groupingEnabled: true,
        minFractionDigits: 2,
        maxFractionDigits: 5
    });

    function toNumber(vValue) {
        if (vValue === null || vValue === undefined || vValue === "") {
            return NaN;
        }

        return Number(vValue);
    }

    return {
        /**
         * UI5 Date 객체, Gateway /Date(...)/ 값, ISO 형식 문자열을 yyyy-MM-dd로 변환한다.
         * @param {Date|string} vDate OData 또는 JSONModel에서 받은 날짜 값
         * @returns {string} yyyy-MM-dd 형식 날짜 문자열
         */
        formatDate: function (vDate) {
            var aMatch;

            if (!vDate) {
                return "";
            }

            if (vDate instanceof Date) {
                return oDateFormat.format(vDate);
            }

            if (typeof vDate === "string") {
                aMatch = /\/Date\((\d+)\)\//.exec(vDate);
                if (aMatch) {
                    return oDateFormat.format(new Date(Number(aMatch[1])));
                }

                return vDate.slice(0, 10);
            }

            return "";
        },

        /**
         * 수량을 천 단위 구분기호와 최대 소수 3자리로 표시한다.
         * @param {string|number} vValue 숫자로 변환 가능한 수량 값
         * @returns {string} 화면에 표시할 수량 문자열
         */
        formatQuantity: function (vValue) {
            var fValue = toNumber(vValue);

            if (isNaN(fValue)) {
                return "";
            }

            return oQuantityFormat.format(fValue);
        },

        /**
         * 금액을 천 단위 구분기호와 최대 소수 2자리로 표시한다.
         * @param {string|number} vValue 숫자로 변환 가능한 금액 값
         * @returns {string} 화면에 표시할 금액 문자열
         */
        formatAmount: function (vValue) {
            var fValue = toNumber(vValue);

            if (isNaN(fValue)) {
                return "";
            }

            return oAmountFormat.format(fValue);
        },

        /**
         * 적용환율을 최소 소수 2자리, 최대 소수 5자리로 표시한다.
         * @param {string|number} vValue 숫자로 변환 가능한 환율 값
         * @returns {string} 화면에 표시할 적용환율 문자열
         */
        formatExchangeRate: function (vValue) {
            var fValue = toNumber(vValue);

            if (isNaN(fValue)) {
                return "";
            }

            return oExchangeRateFormat.format(fValue);
        },

        /**
         * 좁은 영역에서 금액과 통화코드를 하나의 문자열로 표시할 때 사용한다.
         * @param {string|number} vValue 금액 값
         * @param {string} sCurrency 통화코드
         * @returns {string} 금액과 통화코드가 합쳐진 문자열
         */
        formatCurrencyAmount: function (vValue, sCurrency) {
            var sAmount = this.formatAmount(vValue);

            if (!sAmount) {
                return "";
            }

            return sCurrency ? sAmount + " " + sCurrency : sAmount;
        },

        /**
         * Backend의 X 플래그를 화면용 예/아니오 텍스트로 변환한다.
         * @param {string} sValue Backend 플래그 값
         * @returns {string} 예/아니오 표시 문자열
         */
        formatBooleanText: function (sValue) {
            return sValue === "X" ? "예" : "아니오";
        },

        /**
         * Backend의 X 플래그를 ObjectStatus에서 사용할 수 있는 상태값으로 변환한다.
         * @param {string} sValue Backend 플래그 값
         * @returns {sap.ui.core.ValueState} UI5 상태값
         */
        formatBooleanState: function (sValue) {
            return sValue === "X" ? ValueState.Success : ValueState.None;
        },

        /**
         * MQ 선택 가능 여부 플래그를 화면 표시 텍스트로 변환한다.
         * @param {string} sValue Backend CanSelect 플래그 값
         * @returns {string} 선택 가능 여부 표시 문자열
         */
        formatCanSelectText: function (sValue) {
            return sValue === "X" ? "선택 가능" : "선택 불가";
        },

        /**
         * MQ 선택 가능 여부 플래그를 ObjectStatus 상태값으로 변환한다.
         * @param {string} sValue Backend CanSelect 플래그 값
         * @returns {sap.ui.core.ValueState} UI5 상태값
         */
        formatCanSelectState: function (sValue) {
            return sValue === "X" ? ValueState.Success : ValueState.Warning;
        },

        /**
         * MQ 응답상태를 ObjectStatus 상태값으로 변환한다.
         * @param {string} sStatus Backend 응답상태. R은 응답 완료를 의미한다.
         * @returns {sap.ui.core.ValueState} UI5 상태값
         */
        formatResponseState: function (sStatus) {
            if (sStatus === "R") {
                return ValueState.Success;
            }

            if (sStatus === "N") {
                return ValueState.Warning;
            }

            return ValueState.None;
        },

        /**
         * RFQ Header 채택상태를 sap.m.ColumnListItem의 행 강조 상태로 변환한다.
         * @param {string} sStatus Backend에서 받은 RFQ Header 채택상태
         * @returns {sap.ui.core.ValueState} 행 강조 상태값
         */
        formatAwardHighlight: function (sStatus) {
            if (sStatus === "N") {
                return ValueState.Error;
            }

            if (sStatus === "P") {
                return ValueState.Warning;
            }

            if (sStatus === "A" || sStatus === "PO") {
                return ValueState.Success;
            }

            return ValueState.None;
        }
    };
});
