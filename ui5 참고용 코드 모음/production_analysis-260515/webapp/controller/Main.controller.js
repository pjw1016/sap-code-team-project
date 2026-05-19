sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], (Controller, JSONModel) => {
    "use strict";

    return Controller.extend("code.d3.productionanalysis.controller.Main", {
        onInit() {
            // 조회한 데이터를 저장할 json 모델
            let oDetailModel = new JSONModel({
                ProductAgg : {},
                SalesPlan : {},
                PIRPlan   : {},
                PIRChart  : {}
            });
            this.getView().setModel(oDetailModel, "detail")

        },
        onProductListItemPress(oEvent) {
            this.byId("idFlexibleColumnLayout").setLayout("TwoColumnsMidExpanded");
            this._onReadPlannedData(oEvent);
        },


        /*   생산량 집계 테이블의 행을 클릭한 경우
         *     - 해당 행의 바인딩 정보에서 제품번호, 플랜트번호, 연도, 월, 주차 데이터를 가지고
         *     - 해당 정보를 바탕으로 gateway 를 통해 판매계획, PIR 계획 정보를 불러온다.
         */
        _onReadPlannedData(oEvent) {
            // 클릭된 Row
            let oItem = oEvent.getSource();
            // 해당 Row 의 바인딩 컨텍스트
            let oContext = oItem.getBindingContext();
            // 해당 Row 데이터
            let oRowData = oContext.getObject();

            this.getView().getModel("detail").setProperty("/ProductAgg", oRowData);
            console.log(oRowData);

            let oModel = this.getView().getModel();

            let sSalesPlanPath = oModel.createKey("/SalesPlanAggSet", {
                Matnr : '0000' + oRowData.Matnr,
                Werks : oRowData.Werks,
                Year  : oRowData.Year,
                Mnth  : oRowData.Mnth,
                Week  : oRowData.Week
            });

            let sPIRPath = oModel.createKey("/PIRAggSet", {
                Matnr : '0000' + oRowData.Matnr,
                Werks : oRowData.Werks,
                Year  : oRowData.Year,
                Mnth  : oRowData.Mnth,
                Week  : oRowData.Week
            });

            let that = this;

            oModel.read(sSalesPlanPath, {
                success(oData) {
                    that.getView().getModel("detail").setProperty("/SalesPlan", oData);
                    console.log('판매계획 조회 성공', oData);
                },
                error(oError) {
                    console.log('판매계획 조회 실패', oError);
                }
            })

            oModel.read(sPIRPath, {
                success(oData) {
                    const oDetailModel = that.getView().getModel("detail");

                    oDetailModel.setProperty("/PIRPlan", oData);

                    oDetailModel.setProperty("/PIRChart", [
                        {
                            Label : "수량",
                            Plnmg : Number(oData.Plnmg),
                            Minmenge : Number(oData.Minmenge),
                            Maxmenge : Number(oData.Maxmenge),
                            Avgmenge : Number(oData.Avgmenge),
                        }
                    ]);

                    that._onSetChartDetail();

                    console.log('PIR 계획 조회 성공', oData);
                    
                },
                error(oError) {
                    console.log('PIR 계획 조회 실패', oError);
                }
            })

        },
        _onSetChartDetail() {
            const aProperty = this.getView().getModel('detail').getProperty("/PIRChart")[0];

            console.log(this.getView());
            /*
            this.getView().byId("idPIRChart").setVizProperties({
                plotArea: {
                    referenceLine: {
                        line: {
                            valueAxis: [
                                {
                                    value: Number(aProperty.Avgmenge),
                                    visible: true,
                                    label: {
                                        text: "평균수량"
                                    }
                                },
                                {
                                    value: Number(aProperty.Minmenge),
                                    visible: true,
                                    label: {
                                        text: "최소수량"
                                    }
                                },
                                {
                                    value: Number(aProperty.Maxmenge),
                                    visible: true,
                                    label: {
                                        text: "최대수량"
                                    }
                                }
                            ]
                        }
                    }
                }
            })
            */
        },

        onOverFlowToolbarButtonClosePress() {
            this.byId("idFlexibleColumnLayout").setLayout("OneColumn");
        }
    });
});