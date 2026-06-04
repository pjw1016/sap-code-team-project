# [MM] 견적 비교 및 거래선 채택 Fiori 프로그램 2차 개발 설계서 V1.0.0

- 작성일: 2026-06-05
- 대상 프로그램: `[MM] 견적 비교 및 거래선 채택`
- 대상 UI5 프로젝트: `D:\sapcodeproject_usb\ui5\quote_comparison`
- Backend OData Service: `ZGWD3MM0005_SRV`
- Backend DPC Extension Class: `ZCL_ZGWD3MM0005_DPC_EXT`
- 2차 개발 주제: 채택된 MQ 기준 PO 생성

---

## 1. 문서 목적

본 문서는 `[MM] 견적 비교 및 거래선 채택` Fiori 프로그램의 2차 개발 범위인 **PO 생성 기능**을 설계하기 위한 문서이다.

1차 개발에서는 RFQ 조회, RFQ Item 조회, MQ 비교, MQ 상세조회, 거래선 채택, 채택취소, 일괄 채택, 일괄 채택취소, Search Help, 조회조건 유효성 검증까지 구현하였다. 2차 개발에서는 사용자가 RFQ별 거래선 채택을 완료한 뒤, 선택 RFQ의 채택 MQ를 기준으로 구매오더(PO)를 생성할 수 있도록 한다.

핵심 설계 방향은 다음과 같다.

```text
SAPGUI 구매문서 생성 프로그램의 업무 규칙은 재사용한다.
단, SAPGUI Module Pool의 FORM을 그대로 호출하지 않고,
Gateway Function Import에 맞는 Stateless Backend 로직으로 재구현한다.
```

이렇게 하는 이유는 SAPGUI 프로그램은 화면 전역 변수, ALV Internal Table, OK_CODE, MESSAGE, POPUP, COMMIT 흐름에 강하게 묶여 있기 때문이다. 반면 Fiori/OData는 HTTP 요청 1건 안에서 입력값을 받고, Backend에서 검증과 저장을 수행한 뒤, 구조화된 결과를 UI5로 반환해야 한다.

---

## 2. 기존 1차 개발 완료 범위

| 구분 | 완료 내용 |
|---|---|
| RFQ Header 조회 | `RFQHeaderSet` 기준 조회조건, KPI, RFQ 목록 표시 |
| RFQ Item 조회 | 선택 RFQ 기준 `RFQItemSet` 조회 |
| MQ 비교 | 선택 RFQ Item 기준 `MQCompareSet` 조회 |
| 금액 비교 차트 | `MQCompareSet-NetwrKrw` 기준 Bar Chart 표시 |
| MQ 상세조회 | `MQDetailSet` 기준 Dialog 표시 |
| 거래선 채택 | `QuotationItemSet` MERGE, `ActionType = AWARD` |
| 거래선 채택취소 | `QuotationItemSet` MERGE, `ActionType = CANCEL` |
| 일괄 채택 | RFQ Item별 자동추천 MQ를 순차 채택 |
| 일괄 채택취소 | 채택취소 가능한 RFQ Item을 순차 취소 |
| Search Help | RFQ, MQ, 공급업체, 자재, 플랜트, 회사, 구매조직, 구매그룹 |
| 유효성 검증 | 조회조건 오류를 Footer `MessagePopover`로 표시 |
| 처리 결과 메시지 | 채택/취소 결과를 `processMessages` 모델과 `MessagePopover`로 표시 |

2차 개발은 위 기능을 유지하면서, **채택 완료 상태의 RFQ를 PO로 전환하는 기능**을 추가한다.

---

## 3. 2차 개발 목표

### 3.1 업무 목표

사용자는 RFQ Header를 선택한 뒤, 해당 RFQ의 채택된 MQ Item들을 기준으로 PO를 생성한다.

업무 흐름은 다음과 같다.

```text
RFQ Header 조회
-> RFQ Header 선택
-> RFQ Item별 MQ 채택 완료
-> PO 생성 버튼 클릭
-> Backend에서 채택 MQ Item 조회
-> PO 생성 가능 여부 전체 검증
-> 공급업체/조직/통화/지급조건 기준으로 PO Header 그룹핑
-> PO Header 및 PO Item 생성
-> PR 참조 상태 갱신
-> 생성 결과를 UI5 MessagePopover에 표시
-> RFQ Header, RFQ Item, MQ 비교 목록 재조회
```

### 3.2 기능 목표

| 목표 | 설명 |
|---|---|
| RFQ 기준 PO 생성 | UI5는 선택 RFQ 번호만 Backend에 전달한다. |
| 채택 MQ 기준 생성 | Backend는 `ZTD3MM0017-SELIDC = 'X'`인 MQ Item만 대상으로 한다. |
| 다중 PO Header 생성 | 채택 공급업체/조직/통화/지급조건이 다르면 PO Header를 나누어 생성한다. |
| 중복 PO 방어 | 이미 PO Item의 `QTNFN + QTNFP`로 참조된 MQ Item은 다시 PO 생성할 수 없다. |
| 전체 롤백 | 오류가 하나라도 있으면 어떤 PO도 생성하지 않는다. |
| 결과 메시지 표시 | 성공/오류 결과는 기존 Footer `MessagePopover` 패턴으로 표시한다. |

---

## 4. SAPGUI PO 생성 로직 분석 반영

### 4.1 참고한 SAPGUI 흐름

SAPGUI 구매문서 생성 프로그램에는 PO 생성과 관련하여 다음 흐름이 존재한다.

| SAPGUI 흐름 | 의미 | 2차 개발 반영 여부 |
|---|---|---|
| Screen 100 저장 | 일반 구매문서 Header/Item 저장 | 저장 순서와 매핑 규칙 참고 |
| Screen 400 MQ 참조 | Fiori에서 채택된 MQ Item을 PO 후보로 등록 | `SELIDC`, `QTNFN/QTNFP` 규칙 반영 |
| Screen 500 대량 PO | 그룹별 PO Header 생성 및 All-or-Nothing 저장 | Header 그룹핑, 대량 INSERT, Rollback 원칙 참고 |

### 4.2 그대로 사용하지 않는 항목

SAPGUI의 `FORM`을 직접 재사용하지 않는다.

| 제외 항목 | 제외 이유 |
|---|---|
| `gt_display`, `gs_display` | SAPGUI 화면 ALV 상태에 의존한다. |
| `gv_*` 화면 전역 변수 | OData 요청마다 상태를 보장할 수 없다. |
| `MESSAGE`, `POPUP_TO_CONFIRM` | UI5에서는 MessagePopover/MessageBox로 표시해야 한다. |
| `CALL SCREEN`, `SUBMIT` | Fiori 흐름과 맞지 않는다. |
| 화면 저장 전 ALV 변경 확정 | Fiori에서는 Backend가 DB 기준으로 다시 조회한다. |

### 4.3 반드시 이식할 업무 규칙

| 규칙 | 설명 |
|---|---|
| `SELIDC = 'X'` | Fiori에서 채택된 MQ Item만 PO 생성 대상이다. |
| `QTNFN + QTNFP` | PO Item에 원본 MQ 번호/품목을 저장하여 추적한다. |
| PO Item 저장 시 `SELIDC` 초기화 | `SELIDC`는 MQ Item의 채택 표시이므로 PO Item에는 저장하지 않는다. |
| `QTNFN + QTNFP` 중복 방어 | 이미 PO가 생성된 MQ Item은 다시 PO 생성할 수 없다. |
| SNRO 번호 채번 | PO 번호는 기존 Number Range Object를 사용한다. |
| Header/Item INSERT 후 PR 갱신 | `BANFN`이 있는 경우 PR 참조 상태를 갱신한다. |
| All-or-Nothing | Header/Item/PR 갱신 중 하나라도 실패하면 전체 Rollback한다. |

---

## 5. OData 설계

### 5.1 Function Import 선택 사유

PO 생성은 단순 Entity 생성이 아니라 다음 절차가 포함된 업무 트랜잭션이다.

- RFQ 기준 채택 MQ 조회
- 전체 사전 검증
- 공급업체/조직/통화/지급조건 기준 그룹핑
- PO 번호 다건 채번
- Header/Item 다건 INSERT
- PR 상태 갱신
- 결과 메시지 반환

따라서 Deep Insert보다 **Function Import**가 적합하다.

| 방식 | 판단 |
|---|---|
| Deep Insert | UI5가 Header/Item 구조를 모두 만들어 보내야 하므로 부적합 |
| Entity Create | 생성 대상이 단일 Entity가 아니라 복합 업무라 부적합 |
| Function Import | RFQ 번호만 받아 Backend가 전체 업무를 처리하므로 적합 |

### 5.2 Function Import 정의

| 항목 | 값 |
|---|---|
| 이름 | `CreatePoFromRfq` |
| HTTP Method | `POST` 권장 |
| Import Parameter | `RfqNo` |
| Return | PO 생성 결과 메시지 EntitySet |
| 처리 위치 | `ZCL_ZGWD3MM0005_DPC_EXT` |

예상 호출 형태:

```http
POST /sap/opu/odata/SAP/ZGWD3MM0005_SRV/CreatePoFromRfq?RfqNo='RQ10000002'
```

SAP Gateway 구현 방식에 따라 UI5에서는 `callFunction`을 사용한다.

```javascript
oModel.callFunction("/CreatePoFromRfq", {
    method: "POST",
    urlParameters: {
        RfqNo: sRfqNo
    },
    success: fnSuccess,
    error: fnError
});
```

### 5.3 결과 Entity 설계

Function Import 결과는 UI5의 기존 `processMessages` 모델로 변환하기 쉽도록 메시지 중심으로 설계한다.

Entity 이름 예시: `PoCreateResult`

| Property | Type | 설명 |
|---|---|---|
| `MessageSeq` | `NUMC 4` 또는 `Edm.Int32` | 메시지 순번 |
| `MessageType` | `CHAR 1` | `S`, `E`, `W`, `I` |
| `MessageTitle` | `CHAR 80` | MessagePopover 제목 |
| `MessageText` | `CHAR 220` | 상세 메시지 |
| `RfqNo` | `CHAR 10` | 대상 RFQ 번호 |
| `RfqItem` | `NUMC 5` | 관련 RFQ Item |
| `MqNo` | `CHAR 10` | 관련 MQ 번호 |
| `MqItem` | `NUMC 5` | 관련 MQ Item |
| `PoNo` | `CHAR 10` | 생성 PO 번호 |
| `PoItem` | `NUMC 5` | 생성 PO Item |
| `Lifnr` | `CHAR 6` | 공급업체 코드 |
| `Name1` | `CHAR 40` | 공급업체명 |

메시지 유형 매핑:

| Backend `MessageType` | UI5 `MessageItem.type` |
|---|---|
| `S` | `Success` |
| `E` | `Error` |
| `W` | `Warning` |
| `I` | `Information` |

---

## 6. Backend 처리 설계

### 6.1 전체 처리 순서

```text
1. Function Import Parameter RfqNo 읽기
2. RFQ Header 존재 여부 확인
3. RFQ Item 전체 조회
4. 채택 MQ Item 조회
5. PO 생성 대상 전체 검증
6. 기존 PO 중복 참조 검증
7. PO Header 그룹 생성
8. 그룹별 PO 번호 채번
9. PO Header/Internal Table 구성
10. PO Item/Internal Table 구성
11. PR 갱신 대상 구성
12. Header INSERT
13. Item INSERT
14. PR UPDATE
15. COMMIT WORK AND WAIT
16. 결과 메시지 반환
```

### 6.2 권장 Private Method 분리

DPC_EXT 안에 모든 코드를 한 메소드에 몰아넣지 않고, 아래처럼 목적별로 분리한다.

| Method | 역할 |
|---|---|
| `get_po_create_rfq_no` | Function Import parameter에서 `RfqNo` 추출 |
| `select_rfq_header` | RFQ Header 기본 정보 조회 |
| `select_rfq_items` | RFQ Item 전체 조회 |
| `select_awarded_mq_items` | `SELIDC = X`인 채택 MQ Item 조회 |
| `validate_po_create_data` | 미채택, 미응답, 납기일, 가격단위 검증 |
| `check_existing_po_ref` | `QTNFN + QTNFP` 기존 PO 참조 검증 |
| `build_po_groups` | PO Header 그룹 기준 생성 |
| `get_next_po_number` | `NUMBER_GET_NEXT`로 PO 번호 채번 |
| `build_po_header_item` | `ZTD3MM0016`, `ZTD3MM0017` INSERT용 데이터 구성 |
| `insert_po_documents` | Header/Item INSERT, PR UPDATE, Commit/Rollback |
| `append_po_result_message` | 결과 메시지 생성 |
| `raise_po_busi_exception` | 전체 오류를 Gateway Business Exception으로 반환 |

### 6.3 조회 대상

채택 MQ 조회는 RFQ Item과 MQ Item 관계를 기준으로 한다.

```text
RFQ Item
  ZTD3MM0017-EBELN = RFQ 번호
  ZTD3MM0017-EBELP = RFQ Item

MQ Item
  ZTD3MM0017-ANFNR = 원본 RFQ 번호
  ZTD3MM0017-ANFPS = 원본 RFQ Item
  ZTD3MM0017-SELIDC = 'X'

PO Item
  ZTD3MM0017-QTNFN = 원본 MQ 번호
  ZTD3MM0017-QTNFP = 원본 MQ Item
```

조회 시 Header 테이블 `ZTD3MM0016`을 함께 조인하여 `BSART = 'MQ'`, 삭제 플래그 제외 조건을 반드시 적용한다.

### 6.4 사전 검증 규칙

PO 생성은 전체 성공 또는 전체 실패 방식이므로, INSERT 전에 모든 검증을 끝낸다.

| 검증 | 오류 조건 | 처리 |
|---|---|---|
| RFQ 번호 | `RfqNo`가 비어 있음 | 전체 중단 |
| RFQ Header | RFQ가 존재하지 않거나 삭제됨 | 전체 중단 |
| RFQ Item | RFQ Item이 없음 | 전체 중단 |
| 채택 여부 | RFQ Item 중 채택 MQ가 없는 Item 존재 | 전체 중단 |
| 미응답 | `MENGE <= 0` 또는 `NETPR <= 0` | 전체 중단 |
| 가격단위 | `PEINH <= 0` | 전체 중단 |
| 납기일 | `EINDT`가 비었거나 `EINDT < SY-DATUM` | 전체 중단 |
| PO 중복 | 기존 PO Item에 동일 `QTNFN + QTNFP` 존재 | 전체 중단 |
| Header 그룹 | 그룹핑 필수값 누락 | 전체 중단 |
| 통화 | `WAERS` 누락 | 전체 중단 |

오류 메시지는 가능한 한 RFQ Item/MQ Item 단위로 반환하여 사용자가 어떤 항목 때문에 실패했는지 알 수 있게 한다.

### 6.5 PO Header 그룹핑 기준

하나의 RFQ에서 여러 공급업체가 채택될 수 있으므로, PO Header는 아래 기준으로 나눈다.

```text
BUKRS + EKORG + EKGRP + LIFNR + ZTERM + WAERS
```

예시:

| RFQ Item | 채택 MQ | 공급업체 | 통화 | 생성 PO |
---|---|---|---|---|
| 00010 | MQ10000001/00010 | V00001 | KRW | PO00000001 |
| 00020 | MQ10000002/00020 | V00001 | KRW | PO00000001 |
| 00030 | MQ10000003/00030 | V00002 | USD | PO00000002 |

위 예시에서는 공급업체/통화가 달라 PO Header가 2개 생성된다.

### 6.6 PO 번호 채번

PO 번호는 SAPGUI 구매문서 생성 프로그램과 동일하게 SNRO를 사용한다.

| 항목 | 값 |
|---|---|
| Number Range Object | `ZNRD3MM01` |
| 기본 Interval | `01` |
| Prefix | `PO` |
| 최종 형식 | `PO` + 8자리 숫자 |

주의사항:

- SAPGUI MRP 대량 PO 로직에서는 별도 interval `03`을 사용하는 흐름도 확인되었다.
- 본 Fiori RFQ 기반 PO 생성은 기존 일반 PO 생성 흐름과 맞추어 `01`을 기본으로 설계한다.
- 만약 운영 기준상 Fiori PO 번호대를 분리해야 한다면 SEGW 구현 전에 SNRO interval을 별도 확정해야 한다.
- Number Range는 일반적으로 Rollback되어도 이미 발급된 번호가 되돌아가지 않을 수 있다. 따라서 채번은 전체 사전 검증 통과 후 수행한다.

---

## 7. DB 매핑 설계

### 7.1 PO Header: `ZTD3MM0016`

| 필드 | 값 | 비고 |
|---|---|---|
| `MANDT` | `SY-MANDT` | Client |
| `EBELN` | 채번 PO 번호 | `PO########` |
| `BSART` | `PO` | 구매문서유형 |
| `LIFNR` | 채택 MQ Header 공급업체 | Header 그룹 기준 |
| `EKORG` | 채택 MQ Header 구매조직 | Header 그룹 기준 |
| `EKGRP` | 채택 MQ Header 구매그룹 | Header 그룹 기준 |
| `BUKRS` | 채택 MQ Header 회사코드 | Header 그룹 기준 |
| `BEDAT` | `SY-DATUM` | PO 생성일 |
| `WAERS` | 채택 MQ Header 통화 | Header 그룹 기준 |
| `ZTERM` | 채택 MQ Header 지급조건 | Header 그룹 기준 |
| `STATU` | `O` | 입고 없음 |
| `HEAD_TXT` | `RFQ {RfqNo} PO` | CHAR40 제한 |
| `LVORM` | space | 삭제 아님 |
| 생성/변경 정보 | `SY-DATUM`, `SY-UZEIT`, `SY-UNAME` | Include 필드 |

### 7.2 PO Item: `ZTD3MM0017`

| 필드 | 값 | 비고 |
|---|---|---|
| `MANDT` | `SY-MANDT` | Client |
| `EBELN` | 생성 PO 번호 | Header와 연결 |
| `EBELP` | 00010, 00020, 00030 | PO별 10 단위 |
| `MATNR` | 채택 MQ Item 자재 | MQ 기준 |
| `WERKS` | 채택 MQ Item 플랜트 | MQ 기준 |
| `LGORT` | 채택 MQ Item 저장위치 | MQ 기준 |
| `INFNR` | 채택 MQ Item 구매정보레코드 | 존재 시 복사 |
| `MENGE` | 채택 MQ Item 견적수량 | PO 수량 |
| `MEINS` | 채택 MQ Item 기본단위 | MQ 기준 |
| `BPRME` | 채택 MQ Item 구매단위 | 비어 있으면 `MEINS` |
| `NETPR` | 채택 MQ Item 단가 | MQ 기준 |
| `PEINH` | 채택 MQ Item 가격단위 | 0 불가 |
| `NETWR` | `NETPR * (MENGE / PEINH)` | Backend 재계산 |
| `WAERS` | 채택 MQ Item 통화 | Header 통화와 동일 |
| `EINDT` | 채택 MQ Item 납기일 | 과거 불가 |
| `BANFN` | 채택 MQ Item PR 번호 | 추적용 |
| `ANFNR` | 원본 RFQ 번호 | MQ Item의 `ANFNR` |
| `ANFPS` | 원본 RFQ Item | MQ Item의 `ANFPS` |
| `QTNFN` | 채택 MQ 번호 | MQ Item의 `EBELN` |
| `QTNFP` | 채택 MQ Item | MQ Item의 `EBELP` |
| `SELIDC` | space | PO Item에는 채택 표시 저장 안 함 |
| `LVORM` | space | 삭제 아님 |
| 생성/변경 정보 | `SY-DATUM`, `SY-UZEIT`, `SY-UNAME` | Include 필드 |

### 7.3 PR 갱신: `ZTD3MM0015`

`BANFN`이 있는 PO Item은 PR 참조 상태를 갱신한다.

| 필드 | 값 |
|---|---|
| `EBELN` | 생성 PO 번호 |
| `EBELP` | 생성 PO Item |
| `STATU` | `C` |
| 변경 정보 | `SY-DATUM`, `SY-UZEIT`, `SY-UNAME` |

권장 조건:

```abap
WHERE banfn = @ls_map-banfn
  AND lvorm = @space
  AND ebeln = @space
```

이미 다른 PO가 연결된 PR이면 중복 생성 가능성이 있으므로 오류 처리한다.

---

## 8. 트랜잭션 및 오류 처리 설계

### 8.1 저장 정책

PO 생성은 반드시 All-or-Nothing으로 처리한다.

```text
사전 검증 오류 있음
-> INSERT 수행하지 않음
-> 오류 메시지 반환

사전 검증 통과
-> PO Header INSERT
-> PO Item INSERT
-> PR UPDATE
-> 하나라도 실패하면 ROLLBACK WORK
-> 전부 성공하면 COMMIT WORK AND WAIT
```

### 8.2 Business Exception 기준

기술적으로 저장 중 오류가 발생했거나, 전체 처리를 진행할 수 없는 업무 오류가 있으면 Gateway Business Exception을 사용한다.

단, UI5 MessagePopover에 여러 항목별 메시지를 보여줘야 하므로, 가능한 경우에는 결과 EntitySet 형태로 오류 메시지를 반환하는 구조를 우선한다.

권장 기준:

| 상황 | 반환 방식 |
|---|---|
| 입력 RFQ 번호 없음 | Business Exception |
| RFQ 존재하지 않음 | Business Exception 또는 Error Result |
| 사전 검증 오류 여러 건 | Result EntitySet에 `E` 메시지 목록 반환 |
| INSERT 실패 | Business Exception |
| PR UPDATE 실패 | Business Exception |
| 정상 생성 | Result EntitySet에 `S` 메시지 목록 반환 |

### 8.3 메시지 예시

| MessageType | MessageTitle | MessageText |
|---|---|---|
| `S` | `PO PO00000001 생성 완료` | `공급업체 V00001 기준 PO Item 3건이 생성되었습니다.` |
| `E` | `RFQ Item 00020 미채택` | `채택된 MQ가 없어 PO를 생성할 수 없습니다.` |
| `E` | `MQ MQ10000001/00010 중복` | `이미 PO PO00000005에서 참조된 MQ Item입니다.` |
| `E` | `RFQ Item 00030 납기일 오류` | `납기일이 비어 있거나 PO 생성일보다 과거입니다.` |

---

## 9. UI5 설계

### 9.1 버튼 위치

PO 생성 버튼은 Mid Column Footer에 추가한다.

현재 Footer에는 채택/채택취소 버튼과 처리 결과 MessagePopover 버튼이 있다. PO 생성은 선택 RFQ 전체를 대상으로 하므로, 채택/채택취소와 구분되는 버튼으로 배치한다.

권장 배치:

```text
Footer 왼쪽: 처리 결과 MessagePopover 버튼
Footer 오른쪽: PO 생성 / 채택 / 채택취소
```

### 9.2 버튼 활성화 조건

| 조건 | 버튼 상태 |
|---|---|
| 선택 RFQ 없음 | 비활성 |
| RFQ Item 없음 | 비활성 |
| Header 상태 `PO` | 비활성 |
| Header 상태 `N`, `P`, `A` | 활성 |

단, 실제 생성 가능 여부는 Backend가 최종 검증한다. UI5는 사용 편의성을 위한 1차 제어만 수행한다.

### 9.3 UI5 호출 방식

Controller에 `onCreatePoFromRfq` 이벤트를 추가한다.

처리 흐름:

```text
1. 선택 RFQ 확인
2. MessageBox.confirm 표시
3. Busy = true
4. oModel.callFunction("/CreatePoFromRfq", method POST)
5. 성공 결과를 processMessages 모델로 변환
6. MessagePopover 자동 표시
7. RFQHeaderSet, RFQItemSet, MQCompareSet 재조회
8. Busy = false
```

### 9.4 결과 메시지 표시

기존 `processMessages` 모델과 `MessagePopover`를 재사용한다.

현재 구조:

```javascript
{
    items: [],
    count: 0,
    buttonText: "",
    buttonIcon: "sap-icon://message-popup",
    buttonType: "Transparent"
}
```

PO 생성 결과도 `_createProcessMessage`, `_setProcessMessages`, `_openProcessMessagePopoverDelayed` 흐름을 사용한다.

---

## 10. Local Metadata 설계

UI5 로컬 테스트와 코드 완성도를 위해 `webapp/localService/mainService/metadata.xml`에도 Function Import와 결과 Entity를 반영한다.

추가 대상:

1. `EntityType Name="PoCreateResult"`
2. `EntitySet Name="PoCreateResultSet"`
3. `FunctionImport Name="CreatePoFromRfq"`

예상 구조:

```xml
<EntityType Name="PoCreateResult">
    <Key>
        <PropertyRef Name="MessageSeq"/>
    </Key>
    <Property Name="MessageSeq" Type="Edm.Int32" Nullable="false"/>
    <Property Name="MessageType" Type="Edm.String" MaxLength="1"/>
    <Property Name="MessageTitle" Type="Edm.String" MaxLength="80"/>
    <Property Name="MessageText" Type="Edm.String" MaxLength="220"/>
    <Property Name="RfqNo" Type="Edm.String" MaxLength="10"/>
    <Property Name="RfqItem" Type="Edm.String" MaxLength="5"/>
    <Property Name="MqNo" Type="Edm.String" MaxLength="10"/>
    <Property Name="MqItem" Type="Edm.String" MaxLength="5"/>
    <Property Name="PoNo" Type="Edm.String" MaxLength="10"/>
    <Property Name="PoItem" Type="Edm.String" MaxLength="5"/>
    <Property Name="Lifnr" Type="Edm.String" MaxLength="6"/>
    <Property Name="Name1" Type="Edm.String" MaxLength="40"/>
</EntityType>
```

---

## 11. ABAP 구현 상세 설계

### 11.1 Function Import 진입점

SEGW에서 Function Import를 생성하면 DPC_EXT에서 Function Import 실행 메소드를 재정의한다.

구현 시 주의:

- `it_parameter`에서 `RfqNo`를 읽는다.
- `RfqNo`가 비어 있으면 Business Exception을 발생시킨다.
- 모든 SELECT는 New Open SQL 방식으로 작성한다.
- `SELECT *`는 사용하지 않고 필요한 필드만 `FIELDS`에 나열한다.
- LOOP 안에서 SELECT하지 않는다.
- `FOR ALL ENTRIES` 사용 전 Internal Table이 비어 있지 않은지 확인한다.

### 11.2 채택 MQ 조회 기준

채택 MQ Item은 다음 조건으로 조회한다.

```text
MQ Header: ZTD3MM0016-BSART = 'MQ'
MQ Header: LVORM = space
MQ Item: LVORM = space
MQ Item: ANFNR = 입력 RFQ 번호
MQ Item: SELIDC = 'X'
```

RFQ Item 전체 목록도 함께 조회하여 미채택 Item 존재 여부를 검증한다.

### 11.3 PO 중복 조회 기준

기존 PO 여부는 다음 기준으로 확인한다.

```text
PO Header: ZTD3MM0016-BSART = 'PO'
PO Header: LVORM = space
PO Item: LVORM = space
PO Item: QTNFN = 채택 MQ 번호
PO Item: QTNFP = 채택 MQ Item
```

SAPGUI에서는 일부 조직/공급업체 조건을 함께 사용하나, Fiori PO 생성에서는 동일 MQ Item이 어떤 조직 조건으로든 이미 PO에 반영되면 중복으로 보는 것이 더 안전하다.

### 11.4 PR 갱신 기준

PO Item의 `BANFN`이 비어 있지 않은 경우만 PR 갱신 대상으로 본다.

PR 갱신 실패 시 전체 Rollback한다.

이유:

```text
PO는 생성되었지만 PR은 미갱신 상태가 되면
PR-PO 추적 정합성이 깨질 수 있다.
```

---

## 12. 테스트 케이스

### 12.1 Backend 단위 테스트 관점

| 번호 | 시나리오 | 기대 결과 |
|---|---|---|
| T01 | RFQ 번호 없이 Function Import 호출 | 오류 반환 |
| T02 | 존재하지 않는 RFQ 번호 호출 | 오류 반환 |
| T03 | RFQ Item이 없는 RFQ 호출 | 오류 반환 |
| T04 | 일부 RFQ Item 미채택 | 전체 PO 생성 중단 |
| T05 | 모든 RFQ Item 채택 완료 | PO 생성 성공 |
| T06 | 공급업체 1개 | PO Header 1건 생성 |
| T07 | 공급업체/통화가 다른 채택 MQ 존재 | PO Header 여러 건 생성 |
| T08 | 동일 MQ Item이 이미 PO 참조됨 | 전체 PO 생성 중단 |
| T09 | MQ 수량 0 | 전체 PO 생성 중단 |
| T10 | MQ 단가 0 | 전체 PO 생성 중단 |
| T11 | 가격단위 0 | 전체 PO 생성 중단 |
| T12 | 납기일 과거 | 전체 PO 생성 중단 |
| T13 | PR 갱신 실패 | 전체 Rollback |
| T14 | Header INSERT 실패 | 전체 Rollback |
| T15 | Item INSERT 실패 | 전체 Rollback |

### 12.2 UI5 테스트 관점

| 번호 | 시나리오 | 기대 결과 |
|---|---|---|
| U01 | RFQ 미선택 상태 | PO 생성 버튼 비활성 |
| U02 | RFQ 선택 후 PO 생성 클릭 | 확인 MessageBox 표시 |
| U03 | 사용자가 취소 선택 | Backend 호출 없음 |
| U04 | PO 생성 성공 | Footer MessagePopover에 성공 메시지 표시 |
| U05 | Backend 검증 오류 | Footer MessagePopover에 오류 메시지 표시 |
| U06 | PO 생성 후 화면 갱신 | Header/Item 상태가 `PO생성`으로 변경 |
| U07 | PO 생성 후 채택 버튼 | 비활성 처리 |
| U08 | PO 생성 후 채택취소 버튼 | 비활성 처리 |

### 12.3 통합 테스트 관점

| 번호 | 시나리오 | 확인 항목 |
|---|---|---|
| I01 | RFQ 1건 전체 채택 후 PO 생성 | `ZTD3MM0016`, `ZTD3MM0017` 생성 확인 |
| I02 | 다중 공급업체 채택 후 PO 생성 | 공급업체별 PO Header 분리 확인 |
| I03 | 생성 PO Item 확인 | `ANFNR/ANFPS/QTNFN/QTNFP` 매핑 확인 |
| I04 | PR 참조 확인 | `ZTD3MM0015-EBELN/EBELP/STATU` 갱신 확인 |
| I05 | 같은 RFQ 재생성 시도 | 중복 오류 확인 |
| I06 | UI 재조회 확인 | RFQ Header 상태 `PO생성` 확인 |

---

## 13. 개발 단계

1. **SEGW 모델 설계**
   - `CreatePoFromRfq` Function Import 생성
   - Import Parameter `RfqNo` 정의
   - Return 결과 Entity/EntitySet 정의

2. **MPC 확장**
   - `PoCreateResult` 구조 필드 정의
   - MessagePopover 표시를 위한 메시지 필드 포함

3. **DPC_EXT Function Import 진입점 구현**
   - Function Import parameter에서 `RfqNo` 추출
   - 입력값 누락 시 Business Exception 처리

4. **RFQ Header/RFQ Item 조회 구현**
   - RFQ Header 존재 여부 확인
   - RFQ Item 전체 목록 조회
   - 삭제 플래그 제외

5. **채택 MQ 조회 구현**
   - `RfqNo` 기준 `SELIDC = X` MQ Item 조회
   - MQ Header, 공급업체, 조직, 통화, 지급조건 정보 확보

6. **사전 검증 구현**
   - 미채택 RFQ Item 검증
   - 미응답 MQ 검증
   - 가격단위 검증
   - 납기일 검증
   - Header 그룹 필수값 검증

7. **기존 PO 중복 검증 구현**
   - `QTNFN + QTNFP` 기준 기존 PO Item 조회
   - 중복 존재 시 전체 생성 중단

8. **PO Header 그룹핑 구현**
   - `BUKRS + EKORG + EKGRP + LIFNR + ZTERM + WAERS` 기준 그룹 생성
   - 그룹별 Item 목록 구성

9. **PO 번호 채번 구현**
   - `NUMBER_GET_NEXT`
   - Object `ZNRD3MM01`
   - Interval `01`
   - 최종 PO 번호 `PO########` 생성

10. **PO Header 데이터 구성**
    - `ZTD3MM0016` INSERT용 Internal Table 구성
    - `HEAD_TXT` CHAR40 제한 고려

11. **PO Item 데이터 구성**
    - `ZTD3MM0017` INSERT용 Internal Table 구성
    - `NETWR` 재계산
    - `ANFNR/ANFPS/QTNFN/QTNFP` 참조 필드 세팅
    - `SELIDC` 초기화

12. **PR 갱신 대상 구성**
    - `BANFN`이 있는 Item만 대상
    - 생성 PO 번호/Item 매핑 저장

13. **저장 트랜잭션 구현**
    - Header INSERT
    - Item INSERT
    - PR UPDATE
    - 실패 시 `ROLLBACK WORK`
    - 성공 시 `COMMIT WORK AND WAIT`

14. **결과 메시지 구현**
    - 성공 메시지 생성
    - 오류 메시지 생성
    - UI5 MessagePopover 변환이 쉬운 구조로 반환

15. **UI5 Local Metadata 갱신**
    - `PoCreateResult` EntityType 추가
    - `PoCreateResultSet` EntitySet 추가
    - `CreatePoFromRfq` FunctionImport 추가

16. **UI5 버튼 추가**
    - Mid Column Footer에 `PO 생성` 버튼 추가
    - 선택 RFQ 기준 활성화 조건 적용

17. **UI5 Function Import 호출 구현**
    - `onCreatePoFromRfq` 이벤트 추가
    - `oModel.callFunction`으로 Backend 호출
    - Busy 처리

18. **UI5 결과 메시지 표시**
    - Backend 결과를 `processMessages` 모델로 변환
    - 기존 `MessagePopover` 자동 표시

19. **UI5 재조회 처리**
    - PO 생성 후 `RFQHeaderSet` 재조회
    - 선택 RFQ 유지
    - `RFQItemSet`, `MQCompareSet` 재조회
    - 버튼 활성화 상태 갱신

20. **단위 테스트 보강**
    - Function Import 호출 path/parameter 검증
    - 성공 결과 MessagePopover 검증
    - 오류 결과 MessagePopover 검증
    - 성공 후 refresh 호출 검증

21. **통합 테스트**
    - 정상 PO 생성
    - 다중 PO Header 생성
    - 중복 PO 오류
    - 미채택 오류
    - 미응답 오류
    - PR 갱신 확인

22. **최종 정리**
    - 설계서와 구현 차이점 점검
    - 테스트 결과 정리
    - 커밋 및 푸시

---

## 14. 요약

| 구분 | 확정 내용 |
|---|---|
| 2차 개발 핵심 | RFQ 기준 PO 생성 |
| OData 방식 | Function Import |
| Function Import 이름 | `CreatePoFromRfq` |
| UI5 입력값 | `RfqNo` |
| Backend 대상 | `SELIDC = X`인 채택 MQ Item |
| Header 그룹 기준 | `BUKRS + EKORG + EKGRP + LIFNR + ZTERM + WAERS` |
| PO 번호 | `ZNRD3MM01`, interval `01`, `PO########` |
| 중복 방어 | PO Item `QTNFN + QTNFP` |
| 저장 정책 | All-or-Nothing |
| PO Header 테이블 | `ZTD3MM0016` |
| PO Item 테이블 | `ZTD3MM0017` |
| PR 갱신 | `BANFN` 기준 `ZTD3MM0015` 갱신 |
| UI 메시지 | 기존 `processMessages` + `sap.m.MessagePopover` 재사용 |
| SAPGUI 로직 사용 방식 | FORM 직접 호출 없이 업무 규칙만 이식 |
