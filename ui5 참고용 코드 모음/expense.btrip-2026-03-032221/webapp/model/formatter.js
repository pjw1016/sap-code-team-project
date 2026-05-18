sap.ui.define([], function () {
  "use strict";
  return {
    /**
     * Convert trip status code to display text.
     * @param {string} sStat Status code (REQ/APR/REJ/CAN)
     * @returns {string} Display text
     */
    Stat: function (sStat) {
      switch (sStat) {
        case "REQ": return "Requested";
        case "APR": return "Approved";
        case "REJ": return "Rejected";
        case "CAN": return "Canceled";
        default: return sStat || "";
      }
    }
  };
});
