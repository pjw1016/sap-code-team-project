sap.ui.define([
    "sap/ui/core/UIComponent",
    "code/t0/ui5/review2/model/models"
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("code.t0.ui5.review2.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();
        }
    });
});