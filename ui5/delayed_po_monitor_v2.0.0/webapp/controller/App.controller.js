sap.ui.define([
  "sap/ui/core/mvc/Controller"
], (BaseController) => {
  "use strict";

  /*
   * App.controller.js는 root view(App.view.xml)에 연결된 컨트롤러다.
   * 현재 앱의 실제 업무 이벤트는 Main.controller.js에서 처리하고,
   * 이 컨트롤러는 앱 컨테이너용으로 비워둔다.
   */
  return BaseController.extend("code.d3.delayedpomonitor.controller.App", {
      onInit() {
      }
  });
});
