/**
 * sap.ui.define은 SAPUI5에서 모듈을 정의하고 필요한 의존성을 불러오는 방식이다.
 *
 * 첫 번째 배열에는 사용할 UI5 모듈의 경로를 작성한다.
 * 두 번째 함수의 매개변수에는 불러온 모듈이 ***[ 같은 순서 ]*** 로 전달된다.
 *
 * 여기서는 Controller와 JSONModel을 불러와서 컨트롤러 정의와 데이터 바인딩에 사용한다.
 */
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], (Controller, JSONModel) => {
    "use strict";

    /**
     * Controller.extend는 기본 Controller를 확장하여
     * 이 화면 전용 컨트롤러를 정의하는 구문이다.
     *
     * 문자열로 작성된 이름은 컨트롤러의 전체 경로를 의미하며,
     * XML View의 controllerName과 연결된다.
     */
    return Controller.extend("code.d00.even.multiplication.table.controller.Main", {
        /**
         * 화면이 최초로 표시될 때 실행되는 초기화 함수.
         *
         * 이 함수는 테이블 출력에 필요한 두 종류의 데이터를 구성한다.
         * 1. 컬럼 정보: 2단, 4단, 6단, 8단
         * 2. 행 데이터: 각 단의 1배부터 9배까지의 계산 결과
         */
        onInit() {
            /**
             * UI5 예제에서는 변수명 앞에 자료형을 암시하는 접두어를 붙이는 경우가 많다.
             *
             * aData의 a는 Array를 의미한다.
             * oData의 o는 Object를 의미한다.
             *
             * 이러한 표기는 필수 문법은 아니지만,
             * 변수의 성격을 빠르게 파악하는 데 도움을 준다.
             */

            /**
             * 테이블 본문에 표시될 행 데이터를 저장하는 배열.
             *
             * 배열의 각 객체는 테이블의 한 행을 의미한다.
             * 각 객체 안의 Column1, Column2, Column3, Column4는
             * 같은 행에 표시될 각 셀의 값을 의미한다.
             *
             * 예:
             * [
             *   {
             *     Column1: "2 x 1 = 2",
             *     Column2: "4 x 1 = 4",
             *     Column3: "6 x 1 = 6",
             *     Column4: "8 x 1 = 8"
             *   },
             *   {
             *     Column1: "2 x 2 = 4",
             *     Column2: "4 x 2 = 8",
             *     Column3: "6 x 2 = 12",
             *     Column4: "8 x 2 = 16"
             *   }
             * ]
             */
            let aData = [];

            /**
             * 테이블 머리글에 표시될 컬럼 정보를 저장하는 배열.
             *
             * XML View의 columns="{column>/Columns}" 바인딩과 연결된다.
             * 배열의 각 객체는 테이블의 컬럼 하나를 의미한다.
             *
             * 예:
             * [
             *   { columnText: "2단" },
             *   { columnText: "4단" },
             *   { columnText: "6단" },
             *   { columnText: "8단" }
             * ]
             */
            let aColumnsText = [];

            /**
             * 하나의 행(row)을 구성하는 임시 객체.
             *
             * 반복문이 한 번 실행될 때마다 새 객체로 초기화된다.
             * 이후 Column1부터 Column4까지의 속성이 추가되고,
             * 완성된 객체는 aData 배열에 하나의 행으로 저장된다.
             */
            let oData = {};

            /**
             * [컬럼 정보 구성]
             *
             * 변수 i는 구구단의 단수를 의미한다.
             * 2부터 9까지 순회하면서 짝수 단만 컬럼 목록에 추가한다.
             */
            for (let i = 2; i <= 9; i++) {
                // 2로 나누어 나머지가 0이면 짝수로 판단한다.
                if (i % 2 === 0) {
                    aColumnsText.push({ columnText: `${i}단` });
                }
            }

            /**
             * [행 데이터 구성]
             *
             * 변수 j는 각 단에 곱해지는 수를 의미한다.
             * j가 1이면 각 짝수 단의 1배 결과로 첫 번째 행을 만든다.
             * 같은 방식으로 j가 9가 될 때까지 총 9개의 행을 만든다.
             */
            for (let j = 1; j <= 9; j++) {
                // Column1, Column2, Column3 형식의 속성명을 만들기 위한 순번.
                let count = 1;

                // 현재 j 값에 해당하는 행 데이터를 새 객체로 준비한다.
                oData = {};

                for (let i = 2; i <= 9; i++) {
                    // 컬럼 구성과 동일하게 짝수 단만 행 데이터에 포함한다.
                    if (i % 2 === 0) {
                        /**
                         * 계산 결과를 동적 속성명에 저장한다.
                         *
                         * count가 1이면 oData.Column1에 값이 저장된다.
                         * count가 2이면 oData.Column2에 값이 저장된다.
                         *
                         * 결과 예:
                         * {
                         *   Column1: "2 x 3 = 6",
                         *   Column2: "4 x 3 = 12",
                         *   Column3: "6 x 3 = 18",
                         *   Column4: "8 x 3 = 24"
                         * }
                         */
                        oData[`Column${count++}`] = `${i} x ${j} = ${i * j}`;
                    }
                }

                // 완성된 한 줄을 전체 테이블 데이터 배열에 추가한다.
                aData.push(oData);
            }

            // 현재 컨트롤러와 연결된 View 인스턴스를 가져온다.
            const oView = this.getView();

            /**
             * View에 모델을 연결한다.
             *
             * JSONModel은 자바스크립트 객체나 배열을
             * UI5 화면과 연결할 수 있는 데이터 모델이다.
             *
             * "data" 모델은 테이블의 행(items) 바인딩에 사용된다.
             * "column" 모델은 테이블의 컬럼(columns) 바인딩에 사용된다.
             */
            oView.setModel(new JSONModel({ Data: aData }), "data");
            oView.setModel(new JSONModel({ Columns: aColumnsText }), "column");

            /**
             * 테이블 행 템플릿을 생성하고, 본문 데이터를 테이블에 바인딩한다.
             *
             * 여기서 전달하는 oData는 실제 전체 출력 데이터가 아니라,
             * Column1부터 Column4까지의 속성명을 확인하기 위한 기준 객체로 사용된다.
             */
            this._createTableItems(oData);
        },

        /**
         * 테이블의 행 템플릿을 생성하는 함수.
         *
         * UI5 테이블은 배열 데이터를 그대로 출력하지 않는다.
         * 각 행에 어떤 컨트롤을 배치할지 템플릿으로 정의해야 한다.
         *
         * 이 함수는 각 셀에 sap.m.Text 컨트롤을 배치하고,
         * Column1, Column2, Column3, Column4 속성에 각각 바인딩한다.
         */
        _createTableItems(oData) {
            // 테이블의 한 행을 표현하는 컨트롤.
            let oColumnListItem = new sap.m.ColumnListItem();

            /**
             * oData의 속성명을 순회한다.
             *
             * 마지막으로 생성된 oData에는 Column1부터 Column4까지의 속성이 있다.
             * 이 속성 목록을 기준으로 각 행에 필요한 셀 개수를 결정한다.
             */
            for (const key in oData) {
                // 상속받은 속성을 제외하고, 객체 자신이 가진 속성만 사용한다.
                if (oData.hasOwnProperty(key)) {
                    // 셀 내부에 배치할 텍스트 컨트롤을 생성한다.
                    var oText = new sap.m.Text();

                    // data 모델의 현재 행에서 key에 해당하는 값을 읽어 표시한다.
                    // 예: key가 "Column1"이면 현재 행의 Column1 값을 출력한다.
                    oText.bindText({ path: key, model: "data" });

                    // 생성한 텍스트 컨트롤을 행 템플릿의 셀로 추가한다.
                    oColumnListItem.addCell(oText);
                }
            }

            // XML View에 선언된 Table을 id로 조회한다.
            const oTable = this.byId("idDataTable");

            /**
             * 테이블의 items aggregation에 data 모델의 /Data 배열을 연결한다.
             *
             * /Data 배열의 객체 하나는 테이블의 한 행으로 해석된다.
             * template은 각 행을 어떤 구조로 렌더링할지 정의한다.
             * UI5는 /Data 배열의 길이만큼 template을 반복해서 사용한다.
             */
            oTable.bindItems({
                path: "/Data",
                model: "data",
                template: oColumnListItem
            });
        }
    });
});
