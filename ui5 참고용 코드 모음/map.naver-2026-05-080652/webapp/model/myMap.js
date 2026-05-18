sap.ui.define([], function () {
  "use strict";

  return {
    initNaverMap() {
      // naver.maps 사용 가능
      //지도 생성 시에 옵션을 지정할 수 있습니다.
      var map = new naver.maps.Map("map", {
        center: new naver.maps.LatLng(37.3595704, 127.105399), //지도의 초기 중심 좌표
        zoom: 7, //지도의 초기 줌 레벨
        minZoom: 7, //지도의 최소 줌 레벨
        zoomControl: true, //줌 컨트롤의 표시 여부
        zoomControlOptions: {
          //줌 컨트롤의 옵션
          position: naver.maps.Position.TOP_RIGHT
        }
      });

      //setOptions 메서드를 이용해 옵션을 조정할 수도 있습니다.
      //지도 컨트롤
      map.setOptions({
        //지도 유형 컨트롤의 표시 켜기
        mapTypeControl: true,

        //지도 인터랙션 켜기
        draggable: true,
        pinchZoom: true,
        scrollWheel: true,
        keyboardShortcuts: true,
        disableDoubleTapZoom: false,
        disableDoubleClickZoom: false,
        disableTwoFingerTapZoom: false,

        ////관성 드래깅 켜기
        disableKineticPan: false,

        //타일 fadeIn 효과 켜기
        tileTransition: true,

        // min/max 줌 레벨
        minZoom: 7,
        maxZoom: 19,

        //모든 지도 컨트롤 보이기
        scaleControl: true,
        logoControl: true,
        mapDataControl: true,
        zoomControl: true
      });

      naver.maps.Event.addListener(map, "zoom_changed", function (zoom) {
        console.log("zoom:" + zoom);
      });

      console.log(
        "잘못된 참조 시점",
        map.getOptions("minZoom"),
        map.getOptions("minZoom") === 10
      );

      // 지도의 옵션 참조는 init 이벤트 이후에 참조해야 합니다.
      naver.maps.Event.once(map, "init", function () {
        console.log("올바른 참조 시점", map.getOptions("minZoom") === 10);
      });

      // 버튼별 옵션 처리
      var btns = $(".buttons > input");
      btns.on("click", function (e) {
        e.preventDefault();

        var mapTypeId = this.id;

        if (map.getMapTypeId() !== naver.maps.MapTypeId[mapTypeId]) {
          map.setMapTypeId(naver.maps.MapTypeId[mapTypeId]); // 지도 유형 변경하기

          btns.removeClass("control-on");
          $(this).addClass("control-on");
        }
      });

      return map;
    }
  };
});
