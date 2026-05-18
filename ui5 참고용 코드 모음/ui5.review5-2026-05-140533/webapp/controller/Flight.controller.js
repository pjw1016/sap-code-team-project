sap.ui.define([
    // Flight 상세 화면의 이벤트와 라우팅을 처리하는 기본 컨트롤러 클래스입니다.
    "sap/ui/core/mvc/Controller",
    // History는 브라우저의 이전 hash 정보를 확인할 때 사용합니다.
    // 뒤로 가기 동작을 직접 설계할 때 유용한 도구입니다.
    "sap/ui/core/routing/History",
    // includeScript는 외부 스크립트를 동적으로 로딩할 때 사용합니다.
    // PDF나 이미지 저장 라이브러리를 필요할 때 불러오는 데 활용할 수 있습니다.
    "sap/ui/dom/includeScript",
    // 사용자 안내 대화상자를 위한 표준 컨트롤입니다.
    "sap/m/MessageBox"
], function (Controller, History, includeScript, MessageBox) {
    "use strict";

    // Flight 컨트롤러는 연결편 상세와 날짜별 운항 정보를 담당합니다.
    // 또한 현재 화면을 인쇄하거나 PDF/이미지로 저장하는 부가 기능도 이곳에 모여 있습니다.
    return Controller.extend("code.t0.ui5.review5.controller.Flight", {

        onInit() {
            // Flight route가 매칭될 때마다 URL의 carrid, connid를 읽어 화면 바인딩을 갱신합니다.
            this._oRouter = this.getOwnerComponent().getRouter();
            this._oRouteFlight = this._oRouter.getRoute("RouteFlight");
            this._oRouteFlight.attachPatternMatched(this._onPatternMatched, this);
        },
        onExit() {
            // 컨트롤러가 종료될 때 route 이벤트 연결을 해제합니다.
            // 화면이 사라진 뒤에도 핸들러가 호출되는 일을 막아 주는 정리 과정입니다.
            this._oRouteFlight.detachPatternMatched(this._onPatternMatched, this);
        },
        _onPatternMatched(oEvent) {
            // RouteFlight의 URL 인자에서 항공사 ID와 연결편 번호를 꺼냅니다.
            // 이 두 값이 ConnectionSet 한 건을 찾는 복합 키가 됩니다.
            var oArguments = oEvent.getParameter("arguments");
            var sCarrid = oArguments.carrid;
            var sConnid = oArguments.connid;
            // var vPath = "/Conn(CarrierId='AA',ConnectionId='0017')";
            var oModel = this.getView().getModel();

            // createKey는 OData 모델이 요구하는 정확한 키 경로를 만들어 줍니다.
            // 문자열을 손으로 조립하는 것보다 안전하며, 키 형식이 복잡해져도 실수를 줄일 수 있습니다.
            let sPath = oModel.createKey("/ConnectionSet", {
                Carrid: sCarrid,
                Connid: sConnid
            });
            // 생성한 경로를 기준으로 이 View 전체를 ConnectionSet 한 건에 바인딩합니다.
            // 이후 View 안의 {Carrid}, {Connid}, {to_Flight} 같은 바인딩은 모두 이 문맥에서 해석됩니다.
            this.getView().bindElement(sPath);
        },
        onNavBack() {
            // 브라우저 히스토리에 이전 hash가 있으면 실제 뒤로 가기를 수행합니다.
            // 사용자가 어떤 경로로 들어왔는지를 존중하는 가장 자연스러운 방식입니다.
            var oHistory = History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                // 직접 URL로 들어온 경우처럼 이전 hash가 없다면, Carrier 목록으로 대체 이동합니다.
                // replace=true를 사용해 불필요한 히스토리 항목을 남기지 않습니다.
                var oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("RouteCarrier", {}, true);
            }
        },

        _currentTime() {
            // 파일명에 붙일 현재 시각 문자열을 생성합니다.
            // 같은 이름으로 저장되어 덮어쓰이는 상황을 피하고, 저장 시점을 쉽게 알 수 있게 합니다.
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0'); // 월은 0부터 시작하므로 +1
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');

            const formattedNow = `${year}${month}${day}_${hours}${minutes}${seconds}`;
            console.log(formattedNow); // 예: 20260512_200700
            return formattedNow;
        },
        onPrint() {
            // 인쇄할 때는 Flight 상세가 잘 보이도록 잠시 end column을 전체 화면으로 확장합니다.
            // 인쇄가 끝난 뒤에는 기존 layout 값을 되돌려 사용자의 화면 흐름을 보존합니다.
            var oModel = this.getOwnerComponent().getModel("config");
            var sLayout = oModel.getProperty("/layout");

            oModel.setProperty("/layout", "EndColumnFullScreen");
            window.print();
            oModel.setProperty("/layout", sLayout);
        },
        onDownloadPDF() {

            // PDF 저장에 필요한 라이브러리를 UI5 모듈 방식으로 로딩합니다.
            // 로딩이 끝난 뒤 현재 View의 DOM을 캡처하여 PDF 파일로 변환합니다.
            sap.ui.require([
                "code/t0/ui5/review5/libs/html2pdf.bundle.min",
                "code/t0/ui5/review5/libs/jspdf.umd.min",
                "code/t0/ui5/review5/libs/html2canvas.min"
            ], () => {

                if (html2pdf) {
                    console.log("html2pdf 내부로딩 성공");
                }
                if (jspdf) {
                    console.log("jspdf 내부로딩 성공");
                }
                if (html2canvas) {
                    console.log("html2canvas 내부로딩 성공");
                }

                // 현재 View의 실제 HTML Element를 가져옵니다.
                // 화면에 보이는 내용을 그대로 PDF의 원본으로 삼는다고 이해하면 됩니다.
                var oDomRef = this.getView().getDomRef();

                // HTML을 PDF로 변환해 다운로드합니다.
                // margin, filename, image 품질, canvas scale, PDF 용지 설정을 여기서 세밀하게 조정합니다.
                html2pdf()
                    .set({
                        margin: 10,
                        filename: `비행상세정보_${this._currentTime()}.pdf`,
                        image: {
                            type: "jpeg",
                            quality: 1
                        },
                        html2canvas: {

                            scale: 3,
                            scrollX: 0,
                            scrollY: 0,
                            height: oDomRef.clientHeight,
                            useCORS: true

                            // allowTaint: true,
                            // backgroundColor: "#ffffff",
                            // windowWidth: oTableDomRef.scrollWidth
                        },
                        jsPDF: {
                            unit: "mm",
                            format: "a4",
                            orientation: "portrait"
                        }
                    })
                    .from(oDomRef)
                    .save()
                    .then(() => {
                        console.log("PDF saved successfully.");
                    })
                    .catch((err) => {
                        console.error("Error saving PDF:", err);
                    });

            });

        },
        onDownloadImage() {

            // 이미지 다운로드는 html2canvas만 있으면 처리할 수 있습니다.
            // 현재 View를 canvas로 그린 뒤 PNG 데이터 URL로 변환하여 다운로드합니다.
            sap.ui.require([
                "code/t0/ui5/review5/libs/html2canvas.min"
            ], async () => {
                console.log("html2canvas 내부로딩 성공");

                var oDomRef = this.getView().getDomRef();

                /*
                 * ligature 문제를 피하기 위한 보정입니다.
                 * 아이콘 폰트나 특정 글꼴 기능이 캡처 과정에서 다르게 해석될 수 있으므로,
                 * 가능한 범위에서 글자 결합 기능을 꺼 둡니다.
                 */
                oDomRef.style.fontFeatureSettings = '"liga" 0';

                // DOM을 고해상도 canvas로 변환합니다.
                // scale 값을 높이면 결과 이미지는 선명해지지만, 처리 비용도 함께 커집니다.
                html2canvas(oDomRef, {
                    useCORS: true,
                    allowTaint: false,
                    scale: 5,
                    logging: true,
                    letterRendering: true
                }).then((canvas) => {
                    console.log("html2canvas 테스트 성공");

                    var ctx = canvas.getContext('2d');
                    ctx.webkitImageSmoothingEnabled = true;
                    ctx.mozImageSmoothingEnabled = true;
                    ctx.imageSmoothingEnabled = true;

                    // 임시 a 태그를 만들어 다운로드를 실행합니다.
                    var downloadLink = document.createElement('a');
                    downloadLink.href = canvas.toDataURL("image/png");
                    downloadLink.download = `비행상세정보_${this._currentTime()}.png`;
                    downloadLink.click();
                });
            });
        }
    });
});
