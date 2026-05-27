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

    function toNumber(vValue) {
        if (vValue === null || vValue === undefined || vValue === "") {
            return NaN;
        }

        return Number(vValue);
    }

    return {
        /**
         * Formats UI5 Date objects, Gateway /Date(...)/ values, or ISO-like strings.
         * @param {Date|string} vDate Date value from OData or JSONModel
         * @returns {string} Date text in yyyy-MM-dd format
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
         * Formats quantities with grouping and up to three decimal places.
         * @param {string|number} vValue Numeric value
         * @returns {string} Quantity text
         */
        formatQuantity: function (vValue) {
            var fValue = toNumber(vValue);

            if (isNaN(fValue)) {
                return "";
            }

            return oQuantityFormat.format(fValue);
        },

        /**
         * Formats amounts with grouping and up to two decimal places.
         * @param {string|number} vValue Numeric value
         * @returns {string} Amount text
         */
        formatAmount: function (vValue) {
            var fValue = toNumber(vValue);

            if (isNaN(fValue)) {
                return "";
            }

            return oAmountFormat.format(fValue);
        },

        /**
         * Formats an amount and appends the currency code for compact text fields.
         * @param {string|number} vValue Amount value
         * @param {string} sCurrency Currency code
         * @returns {string} Amount and currency text
         */
        formatCurrencyAmount: function (vValue, sCurrency) {
            var sAmount = this.formatAmount(vValue);

            if (!sAmount) {
                return "";
            }

            return sCurrency ? sAmount + " " + sCurrency : sAmount;
        },

        /**
         * Converts backend X flags to Korean display text.
         * @param {string} sValue Backend flag
         * @returns {string} Yes/No text
         */
        formatBooleanText: function (sValue) {
            return sValue === "X" ? "예" : "아니오";
        },

        /**
         * Converts backend X flags to ObjectStatus-compatible states.
         * @param {string} sValue Backend flag
         * @returns {sap.ui.core.ValueState} UI5 state
         */
        formatBooleanState: function (sValue) {
            return sValue === "X" ? ValueState.Success : ValueState.None;
        },

        /**
         * Converts MQ selection availability to display text.
         * @param {string} sValue Backend CanSelect flag
         * @returns {string} Selection availability text
         */
        formatCanSelectText: function (sValue) {
            return sValue === "X" ? "선택 가능" : "선택 불가";
        },

        /**
         * Converts MQ selection availability to ObjectStatus-compatible states.
         * @param {string} sValue Backend CanSelect flag
         * @returns {sap.ui.core.ValueState} UI5 state
         */
        formatCanSelectState: function (sValue) {
            return sValue === "X" ? ValueState.Success : ValueState.Warning;
        },

        /**
         * Converts MQ response status to ObjectStatus-compatible states.
         * @param {string} sStatus Backend response status. R means responded.
         * @returns {sap.ui.core.ValueState} UI5 state
         */
        formatResponseState: function (sStatus) {
            if (sStatus === "R") {
                return ValueState.Success;
            }

            if (sStatus === "N") {
                return ValueState.Warning;
            }

            return ValueState.None;
        }
    };
});
