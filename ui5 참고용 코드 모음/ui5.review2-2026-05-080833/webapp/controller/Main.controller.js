sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel" // JSONModel은 JSON 데이터를 모델로 사용할 수 있게 해주는 클래스입니다.
], (Controller, JSONModel) => {
    "use strict";

    return Controller.extend("code.t0.ui5.review2.controller.Main", {
        onInit() {
            // var 는 변수를 선언할 때 사용합니다. 동일한 이름으로 새로 선언할 수 있다. 옛날엔 많이 씀.
            // let 는 변수를 선언할 때 사용합니다. 동일한 이름으로 새로 선언할 수 없다. 요즘은 이렇게 많이 쓰라고 함.
            // const 는 상수를 선언할 때 사용합니다. 한 번 할당된 값은 변경할 수 없다.
            const oModel = new JSONModel();

            // 오류 발생 => 상수는 값을 변경할 수 없다.
            // oModel = "a"; 

            // 이건 가능하다. const로 선언된 객체의 속성은 변경할 수 있습니다.
            oModel.setData({
                name: "홍길동",
                age: 999,
                city: "조선"
            });

            // setModel 메서드는 모델을 뷰에 설정하는 역할을 합니다. 
            // 이렇게 하면 뷰에서 모델의 데이터를 사용할 수 있게 됩니다.
            this.getView().setModel(oModel);
        },
        onReset() {
            const oModel = this.getView().getModel();

            // setData 메서드는 모델의 데이터를 설정하는 역할을 합니다.
            // 여기서는 name, age, city 속성을 초기값으로 설정하여 모델의 데이터를 초기화합니다.
            oModel.setData({
                name: "",   // 이름을 빈 문자열로 초기화합니다.
                age: 0,     // 나이를 0으로 초기화합니다.
                city: ""    // 도시를 빈 문자열로 초기화합니다.
            });
        },
        onSave() {
            // alert("Test");
            // console.log는 브라우저의 개발자 도구 콘솔에 메시지를 출력하는 함수입니다.
            // console.log("Save button clicked");

            let oView = this.getView();

            // 입력한 고객정보를 취급하는 모델을 가져온다.
            let oModel = oView.getModel();

            // getData는 JSON Model에서만 있는 메소드
            // { } 형태의 객체로 고객 데이터를 가져온다.
            let oData = oModel.getData();
            console.log(["고객데이터: ", oData]);

            // Manifest.json에 설정한 OData 모델을 가져온다. (sap라는 이름으로 설정했음)
            let oSapModel = oView.getModel("sap");

            // 콜백함수에서 this를 사용할 수 있도록 that 변수에 this를 할당한다.
            let that = this;

            // OData Model을 통해 SAP 서버로 생성 요청을 보낸다.
            oSapModel.create("/CustomerSet",
                {
                    Name: oData.name,
                    Age: oData.age.toString(),
                    City: oData.city
                },
                {
                    success: (oResponse) => {
                        console.log("고객 등록 성공: ", oResponse);
                        console.log("생성된 고객 ID: ", oResponse.Id);

                        const oResultModel = new JSONModel({
                            Id: oResponse.Id
                        });

                        // result 라는 이름으로 oResultModel을 뷰에 설정합니다.
                        // 이렇게 하면 뷰에서 "result" 모델의 데이터를 사용할 수 있게 됩니다.
                        oView.setModel(oResultModel, "result");

                        // ??= 연산자는 논리적 할당 연산자 중 하나로,
                        // 왼쪽 피연산자가 null 또는 undefined인 경우에만 (즉, 값이 없을 때)
                        // 오른쪽 피연산자의 값을 할당합니다.
                        // this.pDialog가 빈 값일 때만 오른쪽의 this.loadFragment(...)의 결과를 가져온다.
                        that.pDialog ??= that.loadFragment({
                            name: "code.t0.ui5.review2.view.Result"
                        });

                        // this.loadFragment()가 완료된 후 oDialog.open()을 실행한다.
                        // this.pDialog는 Promise 객체이므로, 
                        // then() 메서드를 사용하여 Promise가 완료된 후의 로직을 작성할 수 있다.(* 콜백함수 )
                        that.pDialog.then(oDialog => {
                            oDialog.open();
                        });
                    },
                    error: (oError) => {
                        console.error("고객 등록 실패: ", oError);
                        this._handleODataError(oError);
                    }
                }
            );
        },

        _handleODataError(oError) {

            let sMessage = "알 수 없는 오류가 발생했습니다.";
            let sDetailsHtml = "";

            try {

                // OData 응답 JSON 파싱
                const oResponse = JSON.parse(oError.responseText);

                // 메인 메시지
                sMessage = oResponse.error.message.value;

                // 상세 메시지 수집
                const aDetails = oResponse?.error?.innererror?.errordetails || [];

                sDetailsHtml = this._makeErrorDetailsHtml(aDetails);

            } catch (e) {
                // responseText 파싱 실패 시 fallback
                sDetailsHtml = this._makeRawErrorHtml(oError.responseText || oError.message || String(oError));
            }

            sap.m.MessageBox.error(sMessage, {
                title: "오류",
                details: sDetailsHtml,
                contentWidth: "600px"
            });

        },

        _makeErrorDetailsHtml(aDetails) {
            if (!aDetails || aDetails.length === 0) {
                return "<p>상세 오류 없음</p>";
            }

            const oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            const sMessage = aDetails.map(function (oDetail) {
                let message = `<li><strong>${oDetail.code || ""}</strong> ${oDetail.message || ""}</li>`;
                return message;
            }).join("");

            return `<ol>${sMessage}</ol>`;
        },

        _makeRawErrorHtml(sText) {
            return `<pre>${sText || "상세 오류 없음"}</pre>`;
        },

        onCloseDialog() {
            let oView = this.getView();

            // byId 메서드는 뷰에서 특정 ID를 가진 요소를 찾는 역할을 합니다.
            let oDialog = oView.byId("idResultDialog");

            if (oDialog) {
                oDialog.close();
            }

        }

    });
});