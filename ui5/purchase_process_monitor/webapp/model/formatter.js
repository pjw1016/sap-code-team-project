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

    /**
     * Backend 요약 문자열을 코드와 명칭으로 나눈다.
     *
     * DelayListSet은 자재/공급업체/플랜트를 화면 표시용 요약 문자열로 내려준다.
     * 예: "100005 / DDK Saddle 외 4건", "V00002 / Seoul Saddle Manufacturing"
     *
     * UI에서는 코드와 명칭을 한 줄에 붙여 보여주면 폭이 부족해 쉽게 잘린다.
     * 그래서 "/" 앞은 코드 라인, "/" 뒤는 명칭 라인으로 나누어 표시한다.
     *
     * @param {string|null|undefined} sSummary Backend 요약 문자열
     * @returns {{code: string, text: string}} 코드/명칭 분리 결과
     */
    function splitSummary(sSummary) {
        var sValue = String(sSummary || "").trim();
        var iSeparatorIndex = sValue.indexOf("/");

        if (!sValue) {
            return {
                code: "",
                text: ""
            };
        }

        if (iSeparatorIndex < 0) {
            return {
                code: sValue,
                text: ""
            };
        }

        return {
            code: sValue.slice(0, iSeparatorIndex).trim(),
            text: sValue.slice(iSeparatorIndex + 1).trim()
        };
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
         * 수량과 단위를 한 줄로 표시한다.
         *
         * ProcessItemSet의 기준 수량, 입고 수량, 미입고 수량, 송장 수량은 모두 Meins 단위를 공유한다.
         * Table에서 숫자만 보이면 단위 해석이 어려우므로 수량과 단위를 함께 표시한다.
         *
         * @param {string|number|null|undefined} vValue 수량 값
         * @param {string|null|undefined} sUnit 단위. 예: EA, KG
         * @returns {string} 예: "10 EA", 단위가 없으면 "10"
         */
        formatQuantityWithUnit: function (vValue, sUnit) {
            var sQuantity = formatNumber(vValue, 3);
            var sNormalizedUnit = String(sUnit || "").trim();

            return sNormalizedUnit ? sQuantity + " " + sNormalizedUnit : sQuantity;
        },

        /**
         * PO 품목의 주문/입고/송장 수량을 업무 단계 라벨과 함께 한 줄로 표시한다.
         *
         * 기존 화면은 세 수량을 라벨 없이 세로로 표시하여 같은 값이 중복된 것처럼 보였다.
         * PO, GR, IV 라벨을 명시하면 사용자가 각 값의 의미를 바로 구분할 수 있고,
         * Table 행 높이도 불필요하게 커지지 않는다.
         *
         * @param {string|number|null|undefined} vPoQuantity PO 주문 수량
         * @param {string|number|null|undefined} vGrQuantity GR 입고 수량
         * @param {string|number|null|undefined} vIvQuantity IV 송장 수량
         * @param {string|null|undefined} sUnit 공통 수량 단위. 예: EA, KG
         * @returns {string} 예: "PO 10 EA / GR 8 EA / IV 5 EA"
         */
        formatProcessQuantities: function (vPoQuantity, vGrQuantity, vIvQuantity, sUnit) {
            var sNormalizedUnit = String(sUnit || "").trim();

            function formatStageQuantity(sStage, vQuantity) {
                var sQuantity = formatNumber(vQuantity, 3);
                var sQuantityWithUnit = sNormalizedUnit ? sQuantity + " " + sNormalizedUnit : sQuantity;

                return sStage + " " + sQuantityWithUnit;
            }

            return [
                formatStageQuantity("PO", vPoQuantity),
                formatStageQuantity("GR", vGrQuantity),
                formatStageQuantity("IV", vIvQuantity)
            ].join(" / ");
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
        },

        /**
         * "코드 / 명칭" 형태의 요약 문자열에서 코드 부분만 반환한다.
         *
         * @param {string|null|undefined} sSummary Backend 요약 문자열
         * @returns {string} 코드 부분
         */
        summaryCode: function (sSummary) {
            return splitSummary(sSummary).code;
        },

        /**
         * "코드 / 명칭" 형태의 요약 문자열에서 명칭 부분만 반환한다.
         *
         * @param {string|null|undefined} sSummary Backend 요약 문자열
         * @returns {string} 명칭 부분
         */
        summaryText: function (sSummary) {
            return splitSummary(sSummary).text;
        },

        /**
         * Mid Column 품목 Table의 빈 결과 안내 문구를 만든다.
         *
         * 단계가 선택되지 않은 상태의 0건은 PO 전체에 품목 진행 정보가 없다는 의미이고,
         * PR/RFQ/MQ/PO/GR/IV 단계가 선택된 상태의 0건은 해당 단계 필터 결과만 없다는 의미다.
         * 두 경우를 구분해야 사용자가 다른 단계 선택 여부를 올바르게 판단할 수 있다.
         *
         * @param {string|null|undefined} sStage 선택한 조달 프로세스 단계
         * @returns {string} sap.m.Table noDataText에 표시할 안내 문구
         */
        formatProcessItemNoDataText: function (sStage) {
            var sNormalizedStage = String(sStage || "").trim().toUpperCase();

            if (sNormalizedStage) {
                return "선택한 " + sNormalizedStage + " 단계에 해당하는 품목이 없습니다.";
            }

            return "선택한 PO의 품목 진행 정보가 없습니다.";
        },

        /**
         * 문서 상세 Table의 빈 상태를 문서 선택 전과 조회 완료 후로 나누어 안내한다.
         *
         * 문서 선택 전에는 사용자가 해야 할 행동을 알려주고, 문서를 선택했는데 결과가 0건이면
         * 선택은 정상 처리되었지만 표시할 상세 필드가 없다는 사실을 명확히 전달한다.
         *
         * @param {string|null|undefined} sDocumentNo 선택한 관련 문서번호
         * @returns {string} sap.m.Table noDataText에 표시할 안내 문구
         */
        formatDocumentDetailNoDataText: function (sDocumentNo) {
            if (String(sDocumentNo || "").trim()) {
                return "선택한 문서의 상세 정보가 없습니다.";
            }

            return "관련 문서를 선택하면 상세 정보가 표시됩니다.";
        }
    };
});
