sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox"
], (Controller, MessageBox) => {
    "use strict";

    return Controller.extend("code.t0.ui5.review3.controller.Main", {
        onInit() {
            
        },
        onTopTableItemPress(oEvent) {
            const oSelectedItem = oEvent.getParameter("listItem");
            const oContext = oSelectedItem.getBindingContext();
            const id = oContext.getProperty("Id");
            const name = oContext.getProperty("Name");

            // ``는 템플릿 리터럴이라고 불리는 문자열 리터럴의 한 형태입니다. 
            // 백틱(`)으로 감싸진 문자열 안에서 ${} 구문을 사용하여 변수나 표현식을 삽입할 수 있습니다. 
            // 이를 통해 문자열을 동적으로 생성할 수 있습니다.
            const sMessage = `Item pressed : ${id} - ${name}`;
            MessageBox.information(sMessage);
        },
        onTopTableSelectionChange(oEvent) {
            const oSelectedItem = oEvent.getParameter("listItem");
            const oContext = oSelectedItem.getBindingContext();
            const id = oContext.getProperty("Id");
            const name = oContext.getProperty("Name");

            const sMessage = `Selection changed : ${id} - ${name}`;
            MessageBox.information(sMessage);
        },
        onTableCellClick(oEvent) {
            
            const oParams = oEvent.getParameters();
            const iRowIndex = oParams.rowIndex;
            const iColumnIndex = oParams.columnIndex;

            const sMessage = `Cell clicked : Row Index ${iRowIndex}, Column Index ${iColumnIndex}`;
            MessageBox.information(sMessage);

        },
        onTableRowSelectionChange(oEvent) {

            const oParams = oEvent.getParameters();
            const oRowContext = oParams.rowContext;
            const iRowIndex = oParams.rowIndex;     // 한 줄씩만 선택할 때는 rowIndex를 사용해도 된다.
            const aRowIndices = oParams.rowIndices; // 하지만 여러 줄을 동시에 선택할 때에는 rowIndices만 사용해야 한다.

            const sMessage = `Row selection changed : Row Index ${iRowIndex}, Row Indices ${aRowIndices.join(", ")}`;
            MessageBox.information(sMessage);
        },

		onPanelExpand(oEvent) {
			// 패널이 확장될 때마다 호출되는 이벤트 핸들러입니다.
            // 패널이 확장될 때 Panel의 높이를 40%로 설정하고, 축소할 때는 auto로 설정합니다.
            const oPanel = oEvent.getSource();
            const bExpanded = oEvent.getParameter("expand");
            oPanel.setHeight(bExpanded ? "40%" : "auto");
		}
    });
});
