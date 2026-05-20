sap.ui.define([], function () {
    "use strict";

    /*
     * formatter.js는 화면 표시 전용 변환 함수를 모아둔 파일이다.
     * OData 원본 값은 숫자/날짜 코드 형태로 오기 때문에,
     * 사용자가 보기 좋은 문자열이나 UI5 상태값으로 바꿔준다.
     */

    function parseDate(vValue) {
        var aMatch;

        if (!vValue) {
            return null;
        }

        // DatePicker나 JSONModel에서 이미 Date 객체로 넘어온 경우 그대로 사용한다.
        if (vValue instanceof Date) {
            return isNaN(vValue.getTime()) ? null : vValue;
        }

        if (typeof vValue === "string") {
            // OData V2 Edm.DateTime은 /Date(밀리초)/ 형태로 넘어올 수 있다.
            aMatch = /\/Date\((\d+)\)\//.exec(vValue);
            if (aMatch) {
                return new Date(Number(aMatch[1]));
            }

            // ABAP DATS처럼 20260520 형태로 넘어오는 값도 화면 날짜로 변환한다.
            if (/^\d{8}$/.test(vValue)) {
                return new Date(Number(vValue.slice(0, 4)), Number(vValue.slice(4, 6)) - 1, Number(vValue.slice(6, 8)));
            }
        }

        return null;
    }

    function formatNumber(vValue, bShowSign) {
        var fValue = Number(vValue);
        var sValue;

        // 값이 없거나 숫자로 바꿀 수 없으면 화면에는 0으로 표시한다.
        if (vValue === null || vValue === undefined || vValue === "" || isNaN(fValue)) {
            return "0";
        }

        // 수량은 소수 3자리까지 받을 수 있지만, 뒤쪽 0은 제거해 깔끔하게 보이도록 한다.
        sValue = fValue.toFixed(3).replace(/\.?0+$/, "");

        // 상세 이력의 계산반영수량은 101 입고를 +수량으로 강조해서 보여준다.
        if (bShowSign && fValue > 0) {
            return "+" + sValue;
        }

        return sValue;
    }

    function getReceiptRate(vPoQty, vGrQty) {
        var fPoQty = Number(vPoQty);
        var fGrQty = Number(vGrQty);

        // 발주수량이 0이거나 값이 이상하면 나눗셈 오류를 피하기 위해 0%로 처리한다.
        if (!fPoQty || isNaN(fPoQty) || fPoQty <= 0 || isNaN(fGrQty)) {
            return 0;
        }

        // 실제 입고수량 / 발주수량 * 100으로 입고율을 계산한다.
        // 음수 입고율은 업무적으로 의미가 없으므로 최소 0으로 보정한다.
        return Math.max((fGrQty / fPoQty) * 100, 0);
    }

    return {
        formatDate: function (vValue) {
            var oDate = parseDate(vValue);
            var sYear;
            var sMonth;
            var sDate;

            if (!oDate) {
                return "-";
            }

            // 브라우저 로케일에 흔들리지 않도록 yyyy-MM-dd 형태를 직접 만든다.
            sYear = String(oDate.getFullYear());
            sMonth = String(oDate.getMonth() + 1).padStart(2, "0");
            sDate = String(oDate.getDate()).padStart(2, "0");

            return sYear + "-" + sMonth + "-" + sDate;
        },

        formatQuantity: function (vValue) {
            return formatNumber(vValue, false);
        },

        formatSignedQuantity: function (vValue) {
            return formatNumber(vValue, true);
        },

        formatDelayDays: function (vValue) {
            var iDays = Number(vValue);

            // 지연일수가 0이면 지연이 없다는 의미이므로 '-'로 표시한다.
            if (!iDays || isNaN(iDays)) {
                return "-";
            }

            return iDays + "일";
        },

        formatItemNo: function (vValue) {
            var sValue = String(vValue || "");

            if (!sValue) {
                return "";
            }

            // EBELP는 00010처럼 NUMC 형태이므로 화면에서는 10처럼 앞자리 0을 제거한다.
            return sValue.replace(/^0+/, "") || "0";
        },

        formatItemLabel: function (sLabel, vItemNo) {
            var sValue = String(vItemNo || "");
            var sItemNo;

            if (!sValue) {
                return sLabel || "";
            }

            sItemNo = sValue.replace(/^0+/, "") || "0";

            // 상세 팝업 헤더에서 "항목 10"처럼 라벨과 품목번호를 합쳐 보여준다.
            return (sLabel || "항목") + " " + sItemNo;
        },

        formatSignedQtyState: function (vValue) {
            var fValue = Number(vValue);

            // 101은 양수(Success), 102 취소는 음수(Error)로 표시해 입고/취소를 빠르게 구분한다.
            if (isNaN(fValue) || fValue === 0) {
                return "None";
            }

            return fValue > 0 ? "Success" : "Error";
        },

        formatReceiptRatePercent: function (vPoQty, vGrQty) {
            // ProgressIndicator의 percentValue는 0~100 범위가 자연스러우므로 100을 넘지 않게 제한한다.
            return Math.min(Math.round(getReceiptRate(vPoQty, vGrQty)), 100);
        },

        formatReceiptRateText: function (vPoQty, vGrQty) {
            // 표시 텍스트는 실제 계산 비율을 보여준다. 초과입고가 있으면 100% 이상도 표시될 수 있다.
            return Math.round(getReceiptRate(vPoQty, vGrQty)) + "%";
        },

        formatReceiptRateState: function (vPoQty, vGrQty) {
            var fRate = getReceiptRate(vPoQty, vGrQty);

            // 100% 이상이면 입고완료 수준, 0보다 크면 부분입고, 0이면 미입고로 표시한다.
            if (fRate >= 100) {
                return "Success";
            }

            if (fRate > 0) {
                return "Information";
            }

            return "None";
        }
    };
});
