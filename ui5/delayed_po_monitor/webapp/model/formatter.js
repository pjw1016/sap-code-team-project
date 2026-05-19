sap.ui.define([], function () {
    "use strict";

    function parseDate(vValue) {
        var aMatch;

        if (!vValue) {
            return null;
        }

        if (vValue instanceof Date) {
            return isNaN(vValue.getTime()) ? null : vValue;
        }

        if (typeof vValue === "string") {
            aMatch = /\/Date\((\d+)\)\//.exec(vValue);
            if (aMatch) {
                return new Date(Number(aMatch[1]));
            }

            if (/^\d{8}$/.test(vValue)) {
                return new Date(Number(vValue.slice(0, 4)), Number(vValue.slice(4, 6)) - 1, Number(vValue.slice(6, 8)));
            }
        }

        return null;
    }

    function formatNumber(vValue, bShowSign) {
        var fValue = Number(vValue);
        var sValue;

        if (vValue === null || vValue === undefined || vValue === "" || isNaN(fValue)) {
            return "0";
        }

        sValue = fValue.toFixed(3).replace(/\.?0+$/, "");

        if (bShowSign && fValue > 0) {
            return "+" + sValue;
        }

        return sValue;
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

            return sValue.replace(/^0+/, "") || "0";
        },

        formatItemLabel: function (sLabel, vItemNo) {
            var sValue = String(vItemNo || "");
            var sItemNo;

            if (!sValue) {
                return sLabel || "";
            }

            sItemNo = sValue.replace(/^0+/, "") || "0";

            return (sLabel || "항목") + " " + sItemNo;
        },

        formatSignedQtyState: function (vValue) {
            var fValue = Number(vValue);

            if (isNaN(fValue) || fValue === 0) {
                return "None";
            }

            return fValue > 0 ? "Success" : "Error";
        }
    };
});
