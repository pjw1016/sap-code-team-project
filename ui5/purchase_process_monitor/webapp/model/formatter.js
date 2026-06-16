sap.ui.define([], function () {
    "use strict";

    /*
     * formatter.js
     * --------------------------------------------------------------------
     * 이 파일은 Backend가 내려준 "업무 값"을 UI5 Control이 이해할 수 있는
     * "표시 값"으로 바꾸는 함수들을 모아둔다.
     *
     * 중요한 원칙:
     * - 지연 여부, 완료 여부, Working Day 계산은 Backend가 이미 끝낸다.
     * - Frontend는 업무 상태를 다시 계산하지 않는다.
     * - Frontend는 Positive/Critical/Negative 같은 Backend Criticality를
     *   ObjectStatus, ObjectNumber, 카드 색상 등에 맞는 UI5 상태값으로만 변환한다.
     */

    /**
     * 숫자처럼 보이는 값을 안전하게 정수로 변환한다.
     *
     * @param {string|number|null|undefined} vValue Backend 또는 JSONModel에서 온 값
     * @returns {int} 숫자로 바꿀 수 없으면 0, 가능하면 정수
     */
    function toInteger(vValue) {
        var iValue = Number(vValue);

        if (vValue === null || vValue === undefined || vValue === "" || isNaN(iValue)) {
            return 0;
        }

        return Math.trunc(iValue);
    }

    /**
     * 금액/수량 표시에 사용할 숫자 포맷을 만든다.
     * UI5 NumberFormat을 화면마다 반복 생성하지 않도록 기본 formatter 단계에서는
     * 브라우저 내장 Intl.NumberFormat을 사용한다.
     *
     * @param {string|number|null|undefined} vValue 표시할 숫자 값
     * @param {int} iMaximumFractionDigits 최대 소수 자리수
     * @returns {string} 콤마가 포함된 숫자 문자열
     */
    function formatNumber(vValue, iMaximumFractionDigits) {
        var fValue = Number(vValue);

        if (vValue === null || vValue === undefined || vValue === "" || isNaN(fValue)) {
            return "0";
        }

        return new Intl.NumberFormat("ko-KR", {
            maximumFractionDigits: iMaximumFractionDigits
        }).format(fValue);
    }

    return {
        /**
         * Backend Criticality를 sap.m.ObjectStatus의 state 값으로 변환한다.
         *
         * Backend:
         * - Positive / Information / Critical / Negative / None
         *
         * sap.m.ObjectStatus.state:
         * - Success / Information / Warning / Error / None
         *
         * @param {string} sCriticality Backend에서 반환한 Criticality
         * @returns {string} sap.ui.core.ValueState 계열 문자열
         */
        criticalityToValueState: function (sCriticality) {
            switch (sCriticality) {
                case "Positive":
                    return "Success";
                case "Information":
                    return "Information";
                case "Critical":
                    return "Warning";
                case "Negative":
                    return "Error";
                default:
                    return "None";
            }
        },

        /**
         * Backend Criticality를 카드/숫자 강조 색상용 값으로 변환한다.
         * ObjectStatus는 Warning/Error를 쓰지만, 일부 UI5 Control은
         * Good/Critical/Error/Neutral 같은 값 이름을 사용한다.
         *
         * @param {string} sCriticality Backend에서 반환한 Criticality
         * @returns {string} 강조 색상 문자열
         */
        criticalityToValueColor: function (sCriticality) {
            switch (sCriticality) {
                case "Positive":
                    return "Good";
                case "Critical":
                    return "Critical";
                case "Negative":
                    return "Error";
                case "Information":
                case "None":
                default:
                    return "Neutral";
            }
        },

        /**
         * Backend Criticality를 CSS class suffix로 변환한다.
         * Flow 카드 테두리나 KPI 카드 상단 라인 색상처럼 표준 Control state만으로
         * 표현하기 어려운 영역에서 사용한다.
         *
         * @param {string} sCriticality Backend에서 반환한 Criticality
         * @returns {string} CSS class suffix
         */
        criticalityToCssClass: function (sCriticality) {
            switch (sCriticality) {
                case "Positive":
                    return "positive";
                case "Information":
                    return "information";
                case "Critical":
                    return "critical";
                case "Negative":
                    return "negative";
                default:
                    return "none";
            }
        },

        /**
         * Working Day 기준 지연일수를 화면 텍스트로 표시한다.
         *
         * @param {string|number|null|undefined} vValue Backend DelayDays 값
         * @returns {string} 예: "14일", 지연 없음은 "-"
         */
        formatDelayDays: function (vValue) {
            var iDays = toInteger(vValue);

            if (iDays <= 0) {
                return "-";
            }

            return iDays + "일";
        },

        /**
         * NUMC 형태의 품목번호를 사용자가 읽기 쉬운 숫자로 표시한다.
         * 예: "00010" -> "10"
         *
         * @param {string|number|null|undefined} vValue 품목번호
         * @returns {string} 앞자리 0을 제거한 품목번호
         */
        formatItemNo: function (vValue) {
            var sValue = String(vValue || "");

            if (!sValue) {
                return "";
            }

            return sValue.replace(/^0+/, "") || "0";
        },

        /**
         * 수량을 화면에 표시한다.
         *
         * @param {string|number|null|undefined} vValue 수량 값
         * @returns {string} 콤마가 적용된 수량 문자열
         */
        formatQuantity: function (vValue) {
            return formatNumber(vValue, 3);
        },

        /**
         * 금액을 화면에 표시한다.
         *
         * @param {string|number|null|undefined} vValue 금액 값
         * @returns {string} 콤마가 적용된 금액 문자열
         */
        formatAmount: function (vValue) {
            return formatNumber(vValue, 0);
        }
    };
});
