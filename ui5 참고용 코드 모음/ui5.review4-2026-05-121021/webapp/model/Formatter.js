sap.ui.define([
	"sap/ui/core/message/MessageType"
], (MessageType) => {
		"use strict";

		return {
			// List.view.xml의 전체화면 버튼 아이콘은 view 모델의 bFullScreen 값에 따라 바뀐다.
			formatListButtonIcon(bFullScreen){
				if (bFullScreen) {
					return "sap-icon://exit-full-screen";
				} else {
					return "sap-icon://full-screen";
				}

			},
			// Table 행의 highlight 속성은 MessageType 값을 기대한다.
			// 연결편 수가 있는 항공사는 Success, 없으면 Error 상태로 표시한다.
			formatConnectionCountHighlight(iConnectionCount) {
				if (iConnectionCount > 0) {
					return MessageType.Success;
				} else {
					return MessageType.Error;
				}
			},
			// OData의 비행시간(분)을 화면 표시용 HH:mm 문자열로 변환한다.
			formatFlightTime(sFltime) {
				// sFltime이 null, undefined 또는 빈 문자열인 경우 "N/A"를 반환하여 유효하지 않은 입력에 대한 처리를 수행합니다.
				if (!sFltime) {
					return "N/A";
				}

				// sFltime을 정수로 변환하여 시간과 분으로 계산합니다.
				// parseInt 함수는 문자열을 정수로 변환하는 함수입니다. 두 번째 인자로 10을 전달하여 10진수로 변환하도록 지정합니다.
				// Math.floor 함수는 소수점 이하를 버리고 정수 부분만 반환하는 함수입니다.
				let iFltime = parseInt(sFltime, 10),
					iHours = Math.floor(iFltime / 60),
					iMinutes = iFltime % 60;

				// padStart 함수는 문자열이 지정된 길이보다 짧을 경우 앞부분을 지정된 문자로 채우는 함수
				// 여기서는 시간과 분이 항상 두 자리로 표시되도록 하여, 한 자리일 경우 앞에 "0"을 추가합니다.
				let sHours = iHours.toString().padStart(2, "0");
				let sMinutes = iMinutes.toString().padStart(2, "0");

				// HH:mm 형식으로 반환
				return `${sHours}:${sMinutes}`;
			}
		};
	});
