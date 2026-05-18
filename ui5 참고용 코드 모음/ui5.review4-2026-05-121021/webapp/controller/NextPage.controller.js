sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
], function (Controller, History) {
    "use strict";

    return Controller.extend("code.t0.ui5.review4.controller.NextPage", {
        onInit: function () {
            this._oPage = this.byId("idDynamicPage");
            this._oComponent = this.getOwnerComponent();
            this._oRouter = this._oComponent.getRouter();
        },
        onToggleFooter: function () {
            this._oPage.setShowFooter(!this._oPage.getShowFooter());
        },
        onGenericTagPress: function (oEvent) {
            var oSourceControl = oEvent.getSource();
            this._openPopover(oSourceControl);
        },

        async _openPopover(oControl) {
            this._oPopover ??= await this.loadFragment({
                name: "code.t0.ui5.review4.view.Card"
            })

            this._oPopover.openBy(oControl);
        },

        onHomeLinkPress() {
            var oHelper = this._oComponent.getHelper();
            var oNextUIState = oHelper.getNextUIState(0);
            this._oRouter.navTo("RouteList",
                { layout: oNextUIState.layout }, true
            );
        },

        onButtonClosePress(oEvent) {
            const oHistory = History.getInstance();
            const sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.onHomeLinkPress();
            }
        }
    });
});