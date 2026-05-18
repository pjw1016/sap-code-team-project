sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "code/d00/expense/btrip/model/formatter",
  ],
  (Controller, JSONModel, MessageToast, MessageBox, formatter) => {
    "use strict";

    return Controller.extend("code.d00.expense.btrip.controller.Main", {
      formatter: formatter,

      onInit() {
        this.getView().setModel(new JSONModel({}), "trip");
        this.getView().setModel(
          new JSONModel(this._getEmptyNewExpense()),
          "newExp",
        );
        this.getView().setModel(
          new JSONModel({
            busy: false,
            tripLoaded: false,
            tripIdValid: false,
            expensePath: "",
          }),
          "ui",
        );
      },
      /**
       * Empty new expense payload for UI. TripID/Waers will be filled after lookup.
       * @returns {object}
       */
      _getEmptyNewExpense: function () {
        return {
          TripID: "",
          ExpDate: "",
          ExpAmt: "",
          Waers: "",
          ExpNote: "",
        };
      },
      /**
       * Validate TripID input.
       * @param {sap.ui.base.Event} oEvent event
       */
      onTripIdLiveChange: function (oEvent) {
        const sVal = (oEvent.getParameter("value") || "").trim();
        this.getView()
          .getModel("ui")
          .setProperty("/tripIdValid", sVal.length > 0);
      },
      /**
       * Build ApprovedTrip key path: /ApprovedTrip(TripID='...')
       * @param {string} sTripId TripID
       * @returns {string} path
       */
      _buildApprovedTripPath: function (sTripId) {
        const sEsc = String(sTripId).replace(/'/g, "''");
        // IMPORTANT: encodeURIComponent is for URL; keep quotes in predicate
        // return `/ApprovedTrip(TripID='${encodeURIComponent(sEsc)}')`;
        return `/ApprovedTrip(TripID='${sTripId}')`;
      },

      /**
       * Check approved trip and bind expenses via navigation: to_Expenses
       */
      onCheckTrip: function () {
        const oView = this.getView();
        const oUi = oView.getModel("ui");
        const sTripId = (this.byId("inpTripId").getValue() || "").trim();

        if (!sTripId) {
          MessageToast.show("Trip ID를 입력하세요.");
          return;
        }

        const sTripPath = this._buildApprovedTripPath(sTripId);
        oUi.setProperty("/busy", true);
        oUi.setProperty("/tripLoaded", false);

        const oTripArea = this.byId("tripArea");

        oTripArea.bindElement({
          path: sTripPath,
          parameters: { $expand: "to_Expenses" },
          events: {
            dataRequested: () => oUi.setProperty("/busy", true),
            change: () => {
              const oCtx = oTripArea.getBindingContext();
              const bHas = !!oCtx;

              oUi.setProperty("/tripLoaded", bHas);

              if (bHas) {
                const sWaers = oCtx.getProperty("Waers") || "";
                oView.getModel("newExp").setData({
                  TripID: sTripId,
                  ExpDate: "",
                  ExpAmt: "",
                  Waers: sWaers,
                  ExpNote: "",
                });
              }
            },
            dataReceived: () => {
              oUi.setProperty("/busy", false);
              const oCtx = oTripArea.getBindingContext();
              if (!oCtx) {
                oView.getModel("newExp").setData(this._getEmptyNewExpense());
                MessageBox.error(
                  "출장 정보를 조회하지 못했습니다. (승인 상태/ID 확인)",
                );
              }
            },
          },
        });

        // /** @type {sap.ui.model.odata.ODataModel} */
        // const oOData = oView.getModel();
        // oOData.read(sTripPath, {
        //   urlParameters:{
        //     "$expand": 'to_Expenses'
        //   },
        //   success: (oData) => {
        //     oView.getModel("trip").setData(oData || {});
        //     oUi.setProperty("/tripLoaded", true);
        //     oUi.setProperty("/busy", false);

        //     // Navigation path for expense list
        //     oUi.setProperty("/expensePath", `${sTripPath}/to_Expenses`);

        //     // Init new expense defaults (TripID + Waers fixed)
        //     const oNew = this._getEmptyNewExpense();
        //     oNew.TripID = oData?.TripID || sTripId;
        //     oNew.Waers = oData?.Waers || "";
        //     oView.getModel("newExp").setData(oNew);

        //     // Refresh table binding if already bound
        //     const oTbl = this.byId("tblExpenses");
        //     oTbl.bindElement(sTripPath);
        //     const oBind = oTbl.getBinding("items");
        //     if (oBind) {
        //       oBind.refresh(true);
        //     }

        //     MessageToast.show("승인된 출장 정보를 조회했습니다.");
        //   },
        //   error: (oErr) => {
        //     oUi.setProperty("/busy", false);
        //     oView.getModel("trip").setData({});
        //     oView.getModel("newExp").setData(this._getEmptyNewExpense());
        //     oUi.setProperty("/tripLoaded", false);
        //     oUi.setProperty("/expensePath", "");
        //     MessageBox.error(
        //       this._extractODataError(
        //         oErr,
        //         "출장 정보를 조회하지 못했습니다. (승인 상태/ID 확인)",
        //       ),
        //     );
        //   },
        //   finally: () => {
        //     oUi.setProperty("/busy", false);
        //   },
        // });
      },

      /**
       * Save expense by OData create.
       */
      onSaveExpense: function () {
        const oView = this.getView();
        const oUi = oView.getModel("ui");
        const oNew = oView.getModel("newExp").getData();

        if (!oUi.getProperty("/tripLoaded")) {
          MessageToast.show("먼저 승인된 출장 ID를 조회하세요.");
          return;
        }

        if (!oNew.ExpDate) {
          MessageToast.show("실비 발생일(ExpDate)을 입력하세요.");
          return;
        }
        if (
          oNew.ExpAmt === "" ||
          oNew.ExpAmt === null ||
          oNew.ExpAmt === undefined
        ) {
          MessageToast.show("실비 금액(ExpAmt)을 입력하세요.");
          return;
        }
        if (!oNew.ExpNote || !String(oNew.ExpNote).trim()) {
          MessageToast.show("실비 내역(ExpNote)을 입력하세요.");
          return;
        }

        oUi.setProperty("/busy", true);

        const oPayload = {
          TripID: oNew.TripID,
          ExpDate: oNew.ExpDate,
          ExpAmt: oNew.ExpAmt,
          Waers: oNew.Waers,
          ExpNote: oNew.ExpNote,
        };

        const oOData = oView.getModel();

        oOData.create("/ExpenseSet", oPayload, {
          success: () => {
            MessageToast.show("실비가 저장되었습니다.");

            // // Refresh expense list via navigation binding
            // const oTbl = this.byId("tblExpenses");
            // const oBind = oTbl.getBinding("items");
            // if (oBind) {
            //   oBind.refresh(true);
            // }

            // // Re-read trip to refresh UseAmt
            // const sTripPath = this._buildApprovedTripPath(oNew.TripID);
            // oOData.read(sTripPath, {
            //   success: (oData) => oView.getModel("trip").setData(oData || {}),
            //   error: () => {
            //     /* ignore */
            //   },
            // });

            const oBind = this.byId("tripArea").getElementBinding();
            if (oBind) {
              oBind.refresh(true);
            }

            // Reset input (keep TripID/Waers)
            const oReset = this._getEmptyNewExpense();
            oReset.TripID = oNew.TripID;
            oReset.Waers = oNew.Waers;
            oView.getModel("newExp").setData(oReset);
          },
          error: (oErr) => {
            MessageBox.error(
              this._extractODataError(oErr, "실비 저장에 실패했습니다."),
            );
          },
          finally: () => {
            oUi.setProperty("/busy", false);
          },
        });
      },

      /**
       * Reset new expense input fields (keep TripID/Waers).
       */
      onResetExpense: function () {
        const oView = this.getView();
        const oNew = oView.getModel("newExp").getData();
        const oReset = this._getEmptyNewExpense();
        oReset.TripID = oNew.TripID || "";
        oReset.Waers = oNew.Waers || "";
        oView.getModel("newExp").setData(oReset);
        MessageToast.show("입력값을 초기화했습니다.");
      },

      /**
       * Extract Gateway error message (best effort).
       * @param {object} oErr error
       * @param {string} sFallback fallback
       * @returns {string} message
       */
      _extractODataError: function (oErr, sFallback) {
        let sMsg = sFallback || "오류가 발생했습니다.";
        try {
          const sBody = oErr?.responseText || oErr?.response?.body;
          if (sBody) {
            const o = JSON.parse(sBody);
            sMsg = o?.error?.message?.value || sMsg;
          }
        } catch (e) {
          /* ignore */
        }
        return sMsg;
      },
    });
  },
);
