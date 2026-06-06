# [MM] 견적 비교 및 거래선 채택 Fiori 프로그램 2차 개발 설계서 V1.1.0

- 작성일: 2026-06-05
- 대상 프로그램: `[MM] 견적 비교 및 거래선 채택`
- 대상 UI5 프로젝트: `D:\sapcodeproject_usb\ui5\quote_comparison`
- Backend OData Service: `ZGWD3MM0005_SRV`
- Backend SEGW Project: `ZGWD3MM0005`
- Backend DPC Extension Class: `ZCL_ZGWD3MM0005_DPC_EXT`
- Backend MPC Extension Class: `ZCL_ZGWD3MM0005_MPC_EXT`
- 2차 개발 주제: 채택된 MQ 기준 PO 생성
- 본 문서 버전 핵심 변경: `Function Import + EXECUTE_ACTION` 방식 중단, `PoCreateRequestSet + CREATE_ENTITY` 방식 채택

---

## 1. 문서 목적

본 문서는 `[MM] 견적 비교 및 거래선 채택` Fiori 프로그램의 2차 개발 범위인 **PO 생성 기능**을 구현하기 위한 V1.1.0 설계서이다.

기존 2차 개발 설계서 V1.0.0은 `CreatePoFromRfq` Function Import와 `/IWBEP/IF_MGW_APPL_SRV_RUNTIME~EXECUTE_ACTION`을 기준으로 작성되었다. 그러나 집 개발 환경에서 SAP Gateway Client 테스트를 수행한 결과, Function Import 요청이 `DPC_EXT`까지 도달하지 못하고 Gateway URI Parser 단계에서 실패했다.

따라서 V1.1.0에서는 Function Import 방식을 더 이상 진행하지 않고, SAP Gateway의 표준 EntitySet 생성 흐름인 **`PoCreateRequestSet`에 대한 `CREATE_ENTITY` 처리 방식**으로 전환한다.

```text
V1.0.0 방향
CreatePoFromRfq Function Import
-> EXECUTE_ACTION
-> Gateway URI Parser 단계에서 실패

V1.1.0 방향
PoCreateRequestSet
-> POCREATEREQUESTSET_CREATE_ENTITY
-> io_data_provider->read_entry_data
-> RFQ 기준 PO 생성
-> 처리 요약 응답 반환
```

이 문서는 학원 환경에서 2차 개발을 이어가기 위한 기준 문서이며, 마지막 장에 실제 개발 순서를 단계별로 정리한다.

---

## 2. 현재 1차 개발 완료 범위

현재 UI5 1차 개발은 아래 기능까지 완료된 상태이다.

| 구분 | 완료 내용 |
|---|---|
| RFQ Header 조회 | `RFQHeaderSet` 기준 조회조건, KPI, RFQ Header 목록 표시 |
| RFQ Header 필터 | RFQ 번호, 문서일자, 채택상태, 공급업체, 자재, 플랜트, 회사, 구매조직, 구매그룹 등 |
| 조회조건 유효성 검증 | Footer `MessagePopover`로 날짜 및 코드 존재 여부 오류 표시 |
| Search Help | Table Select Dialog 기반 RFQ, MQ, 공급업체, 자재, 플랜트, 회사, 구매조직, 구매그룹 검색 도움말 |
| RFQ Item 조회 | 선택 RFQ 기준 `RFQItemSet` 조회 |
| MQ 비교 | 선택 RFQ Item 기준 `MQCompareSet` 조회 |
| 금액 비교 차트 | `MQCompareSet-NetwrKrw` 기준 오름차순 Bar Chart 표시 |
| MQ 비교 목록 | `sap.ui.table.Table` 기반 MQ 비교 목록, KRW 환산총액 오름차순 정렬 |
| MQ 상세조회 | MQ 상세 Dialog 표시 |
| 거래선 채택 | `QuotationItemSet` MERGE, `ActionType = AWARD` |
| 거래선 채택취소 | `QuotationItemSet` MERGE, `ActionType = CANCEL` |
| 일괄 채택 | RFQ Item별 자동추천 MQ 기준 순차 채택 |
| 일괄 채택취소 | 채택취소 가능한 RFQ Item 기준 순차 취소 |
| PO 생성 후 변경 차단 | PO 생성 완료 Item은 채택, 채택취소, MQ 라디오 선택 비활성화 |
| 처리 결과 메시지 | `processMessages` 모델과 Footer `MessagePopover` 사용 |

2차 개발은 위 기능을 유지하면서 **선택 RFQ의 채택 MQ를 기준으로 PO Header와 PO Item을 생성하는 기능**을 추가한다.

---

## 3. V1.1.0 핵심 결정 사항

### 3.1 API 방식 전환

| 항목 | V1.0.0 | V1.1.0 |
|---|---|---|
| OData 호출 방식 | Function Import | EntitySet POST |
| Backend 진입점 | `EXECUTE_ACTION` | `POCREATEREQUESTSET_CREATE_ENTITY` |
| UI5 호출 API | `oModel.callFunction(...)` | `oModel.create(...)` |
| 요청 데이터 | URL Parameter | JSON Body |
| 응답 데이터 | `PoCreateResultSet` 다건 예정 | `PoCreateRequest` 요약 1건 |
| 현재 판단 | Gateway URI Parser에서 실패 | 우선 적용할 방식 |

### 3.2 PO 생성 대상 기준

V1.1.0에서는 RFQ 전체가 완전히 채택된 경우만 PO를 생성하는 방식이 아니다. 선택 RFQ 안에서 **PO 생성 가능한 Item만 선별하여 생성**한다.

| RFQ Item 상태 | 처리 |
|---|---|
| 채택 완료 + PO 미생성 | 이번 PO 생성 대상 |
| 채택 완료 + PO 생성 완료 | 생성 대상에서 제외, MessagePopover에 제외 사유 표시 |
| 미채택 | 생성 대상에서 제외, MessagePopover에 제외 사유 표시 |
| 미응답 MQ | 생성 대상에서 제외 또는 업무 오류 메시지 표시 |
| 단가/수량/가격단위 오류 | 생성 대상 검증 실패, PO 생성 중단 |

중요한 기준은 다음과 같다.

```text
이미 PO가 생성된 RFQ Item은 다시 생성하지 않는다.
미채택 RFQ Item도 PO 생성 대상이 아니다.
그러나 이 두 경우는 즉시 시스템 오류로 보지 않고, 사용자가 이해할 수 있도록 제외 메시지로 표시한다.
실제 생성 대상은 "채택 완료 + PO 미생성" RFQ Item이다.
```

### 3.3 저장 정책

저장 정책은 **생성 대상 Item 기준 All-or-Nothing**으로 한다.

| 상황 | 처리 |
|---|---|
| 생성 대상 Item이 있고 모든 검증 통과 | PO Header/Item 생성, PR 참조 갱신, Commit |
| 생성 대상 Item이 0건 | DB 저장 없이 MessagePopover에 안내 |
| 생성 대상 Item 중 하나라도 치명 오류 | 전체 PO 생성 중단, Rollback |
| 이미 PO 생성된 Item 존재 | 해당 Item 제외, 나머지 생성 대상은 계속 처리 |
| 미채택 Item 존재 | 해당 Item 제외, 나머지 생성 대상은 계속 처리 |

### 3.4 결과 표시

PO 생성 결과는 기존 채택/일괄 처리와 동일하게 Footer `MessagePopover`에 표시한다.

| 표시 항목 | 설명 |
|---|---|
| 처리 결과 요약 | PO 생성 성공/제외/오류 메시지 |
| 생성 PO Header 번호 | 생성된 PO Header 번호를 MessagePopover에 표시 |
| 생성 PO Item 번호 | V1.1.0에서는 표시하지 않음 |
| 향후 확장 | 생성된 PO Header 목록을 별도 Dialog로 표시 가능하게 설계 |

---

## 4. OData 설계

### 4.1 Entity Type

새 Entity Type은 아래 이름으로 생성한다.

```text
PoCreateRequest
```

이 Entity는 실제 DB 테이블 1건을 의미하는 일반 Master Data Entity가 아니다. RFQ 기준 PO 생성 요청을 받기 위한 **Command성 Entity**이다.

Command성 Entity란 화면에서 "생성 요청"을 보내기 위해 사용하는 Entity이다. 즉, 사용자가 PO 생성 버튼을 누르면 UI5가 이 EntitySet으로 POST 요청을 보내고, Backend는 그 요청을 하나의 업무 트랜잭션으로 처리한다.

### 4.2 EntitySet

새 EntitySet은 아래 이름으로 생성한다.

```text
PoCreateRequestSet
```

UI5 호출 기준은 다음과 같다.

```javascript
oModel.create("/PoCreateRequestSet", {
    RfqNo: sRfqNo
}, {
    success: fnSuccess,
    error: fnError
});
```

### 4.3 Property 설계

`PoCreateRequest`의 권장 Property는 아래와 같다.

| Property | Edm Type | Max Length | Key | 설명 |
|---|---:|---:|---|---|
| `RfqNo` | `Edm.String` | 10 | O | PO 생성 대상 RFQ 번호 |
| `MessageType` | `Edm.String` | 1 |  | 대표 처리 결과 유형. `S`, `E`, `W`, `I` |
| `MessageText` | `Edm.String` | 220 |  | 대표 처리 결과 메시지 |
| `PoCount` | `Edm.Int32` |  |  | 생성된 PO Header 수 |
| `PoItemCount` | `Edm.Int32` |  |  | 생성된 PO Item 수 |
| `FirstPoNo` | `Edm.String` | 10 |  | 대표 PO 번호 |
| `CreatedPoNos` | `Edm.String` | 255 |  | 생성된 PO Header 번호 목록. 예: `4500000010, 4500000011` |
| `SkippedItemCount` | `Edm.Int32` |  |  | 제외된 RFQ Item 수 |
| `ErrorCount` | `Edm.Int32` |  |  | 오류 건수 |

`CreatedPoNos`는 V1.1.0에서 중요하다. 사용자가 MessagePopover에서 방금 생성된 PO Header 번호를 확인하고 싶어하기 때문이다.

### 4.4 Key 설정

`RfqNo`를 Key로 설정한다.

| 항목 | 판단 |
|---|---|
| Key | `RfqNo` |
| 이유 | RFQ 기준 PO 생성 요청 Entity이므로 요청 식별값으로 충분함 |
| 주의 | 실제 DB 저장용 Key가 아니라 OData Entity 구조상 필요한 Key임 |

### 4.5 기존 Function Import 처리

V1.0.0에서 생성한 아래 객체는 당장 삭제하지 않는다.

| 객체 | 처리 방침 |
|---|---|
| `PoCreateResult` | 유지 |
| `PoCreateResultSet` | 유지 |
| `CreatePoFromRfq` Function Import | 미사용 상태로 유지 |
| `EXECUTE_ACTION` 재정의 | 당장 삭제하지 않음 |

삭제하지 않는 이유는 다음과 같다.

- 이미 Runtime Generate가 완료되어 있으므로 즉시 삭제 시 영향 범위를 다시 확인해야 한다.
- V1.1.0의 `PoCreateRequestSet` 방식이 안정적으로 동작하는 것을 먼저 확인해야 한다.
- 최종 정리 단계에서 미사용 객체 삭제 여부를 결정한다.

---

## 5. Gateway Client 테스트 설계

### 5.1 테스트 전제

먼저 실제 PO 생성 로직을 구현하지 않고, `CREATE_ENTITY` 진입 여부만 확인하는 Echo 테스트를 수행한다.

이 테스트의 목적은 다음과 같다.

| 목적 | 설명 |
|---|---|
| Metadata 반영 확인 | `PoCreateRequestSet`이 `$metadata`에 보이는지 확인 |
| Create 진입 확인 | `POCREATEREQUESTSET_CREATE_ENTITY` 외부 Breakpoint가 걸리는지 확인 |
| JSON Body 수신 확인 | `io_data_provider->read_entry_data`로 `RfqNo`가 읽히는지 확인 |
| UI5 연결 전 검증 | Backend API가 안정적으로 동작하는지 먼저 확인 |

### 5.2 Request

```http
POST /sap/opu/odata/SAP/ZGWD3MM0005_SRV/PoCreateRequestSet
```

### 5.3 Header

```text
Content-Type: application/json
Accept: application/json
X-CSRF-Token: <token>
```

### 5.4 Body

```json
{
  "RfqNo": "RQ10000002"
}
```

### 5.5 Echo 테스트 기대 응답

```json
{
  "d": {
    "RfqNo": "RQ10000002",
    "MessageType": "S",
    "MessageText": "RFQ RQ10000002 기준 PO 생성 요청이 정상적으로 수신되었습니다.",
    "PoCount": 0,
    "PoItemCount": 0,
    "FirstPoNo": "",
    "CreatedPoNos": "",
    "SkippedItemCount": 0,
    "ErrorCount": 0
  }
}
```

이 테스트가 성공하면 Function Import에서 발생한 URI Parser 문제를 우회하고, EntitySet POST 방식으로 PO 생성 개발을 이어갈 수 있다.

---

## 6. Backend 처리 설계

### 6.1 전체 처리 흐름

```text
1. PoCreateRequestSet CREATE_ENTITY 진입
2. io_data_provider->read_entry_data로 RfqNo 수신
3. RFQ Header 존재 여부 검증
4. RFQ Item 전체 조회
5. RFQ Item별 채택 MQ 연결 정보 조회
6. 이미 PO 생성된 Item과 미채택 Item 분류
7. PO 생성 대상 Item 선별
8. 생성 대상 Item이 0건이면 메시지 반환 후 종료
9. 생성 대상 Item의 MQ Header/Item 상세 조회
10. 수량, 단가, 가격단위, 납기일, 공급업체, 조직 정보 검증
11. PO Header 그룹핑
12. 그룹별 PO 번호 채번
13. PO Header Internal Table 구성
14. PO Item Internal Table 구성
15. PR 참조 정보 갱신 대상 구성
16. Header/Item/PR 저장
17. 오류 발생 시 Rollback
18. 성공 시 Commit
19. 생성 결과를 PoCreateRequest 응답으로 반환
```

### 6.2 입력값 검증

| 검증 항목 | 오류 처리 |
|---|---|
| `RfqNo` 누락 | `MessageType = E`, `RFQ 번호가 없습니다.` |
| RFQ Header 미존재 | `MessageType = E`, `존재하지 않는 RFQ입니다.` |
| RFQ Header가 `BSART = RQ`가 아님 | `MessageType = E`, `RFQ 문서가 아닙니다.` |
| RFQ Item 미존재 | `MessageType = E`, `RFQ Item이 없습니다.` |

### 6.3 RFQ Item 분류

Backend는 RFQ Item 전체를 기준으로 아래처럼 분류한다.

| 분류 | 조건 | 처리 |
|---|---|---|
| 생성 대상 | 채택 MQ 존재, PO 미생성 | PO 생성 후보 |
| 이미 생성됨 | PO 번호 또는 PO 참조 존재 | 제외 메시지 |
| 미채택 | 채택 MQ 없음 | 제외 메시지 |
| 오류 후보 | 데이터 불완전 | 검증 후 오류 메시지 |

여기서 "이미 생성됨"과 "미채택"은 V1.1.0에서는 전체 처리를 막지 않는다. 다만 생성 대상이 0건이면 PO를 생성하지 않고 사용자에게 안내한다.

### 6.4 PO 생성 대상 Item 기준

PO 생성 대상 Item은 아래 조건을 모두 만족해야 한다.

| 조건 | 설명 |
|---|---|
| RFQ Item에 채택 MQ가 있음 | `AwardMqNo`, `AwardMqItem` 또는 Backend 기준 채택 MQ 조회 |
| MQ Item의 `SELIDC = 'X'` | 최종 채택된 MQ Item |
| 기존 PO 참조 없음 | `QTNFN/QTNFP` 중복 방어 |
| PO 번호 없음 | 이미 PO 생성된 Item 제외 |
| MQ 응답 완료 | 미응답 MQ 제외 |
| 수량 정상 | 견적수량 또는 요청수량이 0보다 커야 함 |
| 단가 정상 | 단가가 0보다 커야 함 |
| 가격단위 정상 | 가격단위가 0보다 커야 함 |
| 납기일 존재 | PO Item 납기일 생성 가능 |

### 6.5 생성 대상 0건 처리

PO 생성 대상 Item이 0건이면 DB 저장을 수행하지 않는다.

응답 기준:

| Property | 값 |
|---|---|
| `MessageType` | `W` |
| `MessageText` | `PO 생성 대상 Item이 없습니다.` |
| `PoCount` | `0` |
| `PoItemCount` | `0` |
| `CreatedPoNos` | 빈 값 |
| `SkippedItemCount` | 제외 Item 건수 |
| `ErrorCount` | `0` 또는 업무 오류 건수 |

UI5는 이 응답을 Footer MessagePopover에 표시한다.

---

## 7. PO Header 그룹핑 설계

### 7.1 그룹핑 기준

PO Header는 아래 필드 조합 기준으로 나눈다.

```text
BUKRS + EKORG + EKGRP + LIFNR + ZTERM + WAERS
```

| 필드 | 의미 |
|---|---|
| `BUKRS` | 회사코드 |
| `EKORG` | 구매조직 |
| `EKGRP` | 구매그룹 |
| `LIFNR` | 공급업체 |
| `ZTERM` | 지급조건 |
| `WAERS` | 통화 |

같은 RFQ에서 여러 공급업체가 채택되었거나 통화/지급조건이 다르면 PO Header가 여러 건 생성될 수 있다.

### 7.2 그룹핑 예시

| RFQ Item | 공급업체 | 통화 | 지급조건 | 생성 PO |
|---|---|---|---|---|
| 00010 | V00006 | KRW | Z001 | PO 1 |
| 00020 | V00006 | KRW | Z001 | PO 1 |
| 00030 | V00007 | USD | Z001 | PO 2 |

이 경우 PO Header 2건, PO Item 3건이 생성된다.

---

## 8. PO 번호 채번 설계

### 8.1 Number Range

PO 번호는 SAPGUI 구매문서 생성 프로그램과 동일한 Number Range Object를 사용한다.

| 항목 | 값 |
|---|---|
| Number Range Object | `ZNRD3MM01` |
| Interval | `01` |
| 사용 위치 | PO Header 그룹별 번호 채번 |

### 8.2 채번 시점

채번은 모든 사전 검증이 끝난 뒤 수행한다.

이유:

- 검증 실패가 예상되는 상태에서 번호를 먼저 사용하면 번호 소모가 발생할 수 있다.
- PO Header 그룹 수가 확정된 뒤 그룹별 1개 번호만 채번해야 한다.
- All-or-Nothing 정책과 흐름을 맞추기 쉽다.

### 8.3 채번 실패 처리

채번 실패는 시스템성 오류로 본다.

| 상황 | 처리 |
|---|---|
| Number Range Object 오류 | Rollback 후 Gateway Business/Technical Exception |
| Interval 미존재 | Rollback 후 오류 메시지 |
| 번호 고갈 | Rollback 후 오류 메시지 |

---

## 9. DB 저장 설계

### 9.1 저장 대상

| 대상 | 테이블 | 설명 |
|---|---|---|
| PO Header | `ZTD3MM0016` | `BSART = PO` 구매문서 Header |
| PO Item | `ZTD3MM0017` | 생성 PO의 Item |
| PR 참조 | `ZTD3MM0015` 또는 현재 프로젝트 PR 테이블 | PR 참조 상태 갱신 |

실제 PR 테이블명은 현재 시스템의 구매요청 설계와 맞춰 최종 확인한다.

### 9.2 PO Header 생성 기준

PO Header는 그룹핑 기준 1건당 1건 생성한다.

주요 매핑 예시:

| PO Header 필드 | 값 출처 |
|---|---|
| `EBELN` 또는 구매문서번호 | SNRO 채번 |
| `BSART` | PO 문서유형 |
| `BUKRS` | RFQ/MQ 기준 회사코드 |
| `EKORG` | RFQ/MQ 기준 구매조직 |
| `EKGRP` | RFQ/MQ 기준 구매그룹 |
| `LIFNR` | 채택 MQ 공급업체 |
| `ZTERM` | MQ Header 지급조건 |
| `WAERS` | MQ Header 통화 |
| 생성일/생성자 | `sy-datum`, `sy-uname` |

### 9.3 PO Item 생성 기준

PO Item은 생성 대상 RFQ Item 1건당 1건 생성한다.

주요 매핑 예시:

| PO Item 필드 | 값 출처 |
|---|---|
| PO 번호 | 그룹별 채번 PO 번호 |
| PO Item | 그룹 내 00010, 00020 형식 순번 |
| 자재코드 | RFQ/MQ Item 자재 |
| 플랜트 | RFQ/MQ Item 플랜트 |
| 저장위치 | RFQ/MQ Item 저장위치 |
| 수량 | 채택 MQ 견적수량 또는 기준 수량 |
| 단가 | 채택 MQ 단가 |
| 가격단위 | 채택 MQ 가격단위 |
| 적용환율 | 채택 MQ 환율 |
| 환산총액 | 채택 MQ KRW 환산총액 |
| 납기일 | RFQ/MQ Item 납기일 |
| 원본 MQ 번호 | `QTNFN` |
| 원본 MQ Item | `QTNFP` |

`SELIDC`는 PO Item에 채택 표시로 저장하지 않는다. `SELIDC`는 MQ Item에서 채택 상태를 나타내는 용도이며, PO Item에서는 원본 MQ 참조인 `QTNFN/QTNFP`로 추적한다.

### 9.4 중복 생성 방어

중복 생성 방어는 반드시 Backend에서 최종 수행한다.

| 방어 기준 | 설명 |
|---|---|
| 원본 MQ 참조 중복 | 이미 `QTNFN/QTNFP`가 PO Item에 존재하면 제외 |
| RFQ Item의 PO 생성 상태 | RFQ Item에 PO 번호가 있으면 제외 |
| MQ Item 상태 | 이미 PO 생성 완료 상태이면 제외 |

UI5에서 버튼을 비활성화하더라도, 브라우저 요청 조작이나 동시 사용자 처리를 막기 위해 Backend 검증이 반드시 필요하다.

---

## 10. 오류 및 메시지 처리 설계

### 10.1 UI5 메시지 패턴

PO 생성 결과는 기존 `processMessages` 모델과 Footer `MessagePopover`를 재사용한다.

| 기존 요소 | 재사용 방식 |
|---|---|
| `processMessages` JSONModel | PO 생성 결과 메시지를 items로 변환 |
| Footer Message Button | 오류/성공 건수 표시 |
| `onProcessMessagePopoverPress` | 기존 이벤트 재사용 |
| `_setProcessMessages` | PO 생성 메시지에도 사용 |
| `_createProcessMessage` | Backend 응답을 UI5 메시지로 변환 |

### 10.2 업무 메시지 기준

업무 메시지는 사용자가 원인을 이해하고 조치할 수 있는 메시지이다.

| 상황 | Message Type | 예시 문구 |
|---|---|---|
| PO 생성 성공 | `Success` | `PO 4500000010이 생성되었습니다.` |
| 여러 PO 생성 성공 | `Success` | `PO 2건이 생성되었습니다. 생성 PO: 4500000010, 4500000011` |
| 이미 PO 생성된 Item 제외 | `Warning` | `RFQ Item 00010: 이미 PO가 생성되어 제외되었습니다.` |
| 미채택 Item 제외 | `Warning` | `RFQ Item 00020: 채택 MQ가 없어 제외되었습니다.` |
| 생성 대상 없음 | `Warning` | `PO 생성 대상 Item이 없습니다.` |
| 단가 오류 | `Error` | `RFQ Item 00030: 단가가 0이므로 PO를 생성할 수 없습니다.` |
| 가격단위 오류 | `Error` | `RFQ Item 00030: 가격단위가 0이므로 PO를 생성할 수 없습니다.` |

### 10.3 시스템 오류 기준

시스템 오류는 사용자가 화면에서 직접 해결하기 어려운 오류이다.

| 상황 | UI 처리 |
|---|---|
| Number Range 오류 | `MessageBox.error` 또는 Error MessagePopover |
| DB INSERT 실패 | `MessageBox.error` |
| DB UPDATE 실패 | `MessageBox.error` |
| Gateway Runtime 오류 | `MessageBox.error` |

실제 구현에서는 OData `error` callback으로 들어오는 오류는 기존 `_getODataErrorText`를 활용하여 사용자에게 명확히 표시한다.

### 10.4 응답 1건 구조의 한계와 보완

V1.1.0의 Backend 응답은 `PoCreateRequest` 1건 요약이다. 따라서 Backend가 여러 제외 메시지를 모두 구조화해서 반환하기에는 한계가 있다.

이를 보완하기 위한 V1.1.0 기준은 다음과 같다.

| 메시지 종류 | 처리 |
|---|---|
| 대표 성공 메시지 | `MessageText`, `CreatedPoNos`로 표현 |
| 제외 건수 | `SkippedItemCount`로 표현 |
| 오류 건수 | `ErrorCount`로 표현 |
| 상세 제외 메시지 | V1.1.0에서는 Backend 대표 메시지 중심, 향후 상세 EntitySet 확장 |

향후 C안 확장 시 별도 `PoCreateResultSet` 또는 `PoCreateLogSet`을 추가하여 방금 생성된 PO Header 목록과 제외 Item 목록을 Dialog로 표시할 수 있다.

---

## 11. UI5 설계

### 11.1 PO 생성 버튼 위치

PO 생성 버튼은 Mid 컬럼 Footer에 추가한다.

| 위치 | 판단 |
|---|---|
| Mid Footer | 채택/채택취소와 같은 업무 처리 영역이므로 적합 |
| RFQ Item Toolbar | 목록 작업처럼 보여 PO 생성 업무의 무게감이 약함 |
| Header 영역 | 조회/정보 영역에 가까워 처리 버튼 위치로 부적합 |

Footer 버튼 예시:

```xml
<Button
    text="{i18n>createPo}"
    type="Emphasized"
    enabled="{= !!${work>/SelectedRfq/RfqNo} }"
    press=".onCreatePo"/>
```

실제 활성화 조건은 아래 기준을 적용한다.

### 11.2 버튼 활성화 조건

| 조건 | 처리 |
|---|---|
| 선택 RFQ 없음 | 비활성화 |
| RFQ Item 없음 | 비활성화 또는 Backend 안내 |
| RFQ가 이미 전체 PO 생성 완료 상태 | 비활성화 권장 |
| 일부 Item만 PO 생성 가능 | 활성화 |
| PO 생성 대상이 있는지 정확히 모름 | 버튼 클릭 후 Backend에서 최종 판단 |

V1.1.0에서는 이미 PO 생성된 Item이 있어도 미생성 채택 Item이 있을 수 있으므로, UI에서 너무 강하게 막지 않는다. 최종 생성 대상 판단은 Backend가 수행한다.

권장 활성화 조건:

```text
선택 RFQ가 있고,
RFQ Item 목록이 있으며,
RFQ Header 상태가 완전 PO 생성 상태가 아닐 때 활성화
```

### 11.3 확인 팝업

사용자가 PO 생성 버튼을 누르면 확인 팝업을 표시한다.

문구 예시:

```text
선택 RFQ 기준으로 PO를 생성하시겠습니까?
이미 PO가 생성된 Item과 미채택 Item은 제외됩니다.
```

이 확인 팝업은 실수로 PO가 생성되는 것을 방지하기 위한 장치이다.

### 11.4 UI5 호출 방식

Controller에서는 아래 흐름으로 구현한다.

```javascript
onCreatePo() {
    const oWorkModel = this.getView().getModel("work");
    const oSelectedRfq = oWorkModel.getProperty("/SelectedRfq") || {};
    const sRfqNo = oSelectedRfq.RfqNo;

    if (!sRfqNo) {
        this._setProcessMessages([
            this._createProcessMessage("Warning", this._getText("msgSelectRfq"))
        ]);
        this._openProcessMessagePopoverDelayed();
        return Promise.resolve(false);
    }

    return this._confirmAction(this._getText("msgConfirmCreatePo"))
        .then((bConfirmed) => {
            if (!bConfirmed) {
                return false;
            }

            return this._createPoForSelectedRfq(sRfqNo);
        });
}
```

실제 OData 호출 예시:

```javascript
_createPoForSelectedRfq(sRfqNo) {
    const oModel = this.getView().getModel();

    return new Promise((resolve, reject) => {
        oModel.create("/PoCreateRequestSet", {
            RfqNo: sRfqNo
        }, {
            success: (oData) => resolve(oData),
            error: (oError) => reject(oError)
        });
    });
}
```

### 11.5 성공 후 화면 갱신

PO 생성 성공 후에는 Mid 컬럼을 유지한다.

재조회 범위:

| 데이터 | 재조회 필요 여부 |
|---|---|
| RFQ Header 목록 | 필요 |
| KPI | 필요 |
| 선택 RFQ Header | 필요 |
| RFQ Item 목록 | 필요 |
| MQ 비교 목록 | 필요 |
| 금액 비교 차트 | 필요 |

이전 채택 처리에서도 사용자가 Mid 컬럼에 머물러야 한다는 기준을 확정했으므로, PO 생성 후에도 같은 UX 원칙을 유지한다.

### 11.6 i18n 추가 키

권장 i18n 키:

```properties
createPo=PO 생성
msgConfirmCreatePo=선택 RFQ 기준으로 PO를 생성하시겠습니까? 이미 PO가 생성된 Item과 미채택 Item은 제외됩니다.
msgCreatePoSuccess=PO 생성이 완료되었습니다. 생성 PO: {0}
msgCreatePoNoTarget=PO 생성 대상 Item이 없습니다.
msgCreatePoError=PO 생성 중 오류가 발생했습니다.
msgCreatePoSkipped=제외된 RFQ Item {0}건이 있습니다.
processCreatePo=PO 생성
```

---

## 12. Backend ABAP 구현 기준

### 12.1 구현 메소드

SEGW Runtime Generate 후 DPC_EXT에서 아래 메소드를 재정의한다.

```abap
POCREATEREQUESTSET_CREATE_ENTITY
```

생성되는 실제 메소드명은 SEGW Runtime Generate 결과에 맞춰 확인한다. 일반적으로 EntitySet 이름을 기준으로 `*_CREATE_ENTITY` 메소드가 생성된다.

### 12.2 초기 Echo 구현 예시

아래 코드는 실제 PO 생성 전 Gateway 진입 테스트를 위한 골격 예시이다.

```abap
METHOD pocreaterequestset_create_entity.

  DATA: ls_request  TYPE zcl_zgwd3mm0005_mpc=>ts_pocreaterequest,
        ls_response TYPE zcl_zgwd3mm0005_mpc=>ts_pocreaterequest.

  " UI5 또는 Gateway Client에서 보낸 JSON Body를 ABAP 구조로 읽는다.
  io_data_provider->read_entry_data(
    IMPORTING
      es_data = ls_request
  ).

  ls_response-rfqno       = ls_request-rfqno.
  ls_response-messagetype = 'S'.
  ls_response-messagetext = |RFQ { ls_request-rfqno } 기준 PO 생성 요청이 정상적으로 수신되었습니다.|.
  ls_response-pocount     = 0.
  ls_response-poitemcount = 0.
  ls_response-firstpono   = ''.
  ls_response-createdponos = ''.
  ls_response-skippeditemcount = 0.
  ls_response-errorcount  = 0.

  er_entity = ls_response.

ENDMETHOD.
```

주의:

- 실제 생성된 ABAP 구조 컴포넌트명은 MPC 생성 결과를 반드시 확인한다.
- OData Property가 `CreatedPoNos`여도 ABAP 컴포넌트는 `CREATEDPONOS`처럼 생성될 수 있다.
- V1.0.0 인수인계서에서 확인한 것처럼 CamelCase Property와 ABAP 컴포넌트명이 다를 수 있다.

### 12.3 SELECT 작성 원칙

프로젝트 코딩 지침상 아래 원칙을 지킨다.

| 원칙 | 설명 |
|---|---|
| `SELECT *` 지양 | 필요한 필드를 `FIELDS`에 명시 |
| `SELECT ... ENDSELECT` 금지 | Internal Table로 한 번에 조회 |
| LOOP 안 SELECT 금지 | 선조회 후 Internal Table에서 처리 |
| New Open SQL 사용 | `SELECT FROM ... FIELDS ... INTO TABLE ...` 형태 |
| 하드코딩 최소화 | 문서유형, 상태값은 상수화 권장 |

### 12.4 권장 private helper 메소드

DPC_EXT가 너무 길어지는 것을 막기 위해 아래 helper 메소드 분리를 권장한다.

| 메소드 예시 | 역할 |
|---|---|
| `validate_po_create_request` | `RfqNo` 입력값 검증 |
| `read_rfq_data` | RFQ Header/Item 조회 |
| `read_awarded_mq_data` | 채택 MQ Header/Item 조회 |
| `classify_rfq_items` | 생성 대상/제외/오류 Item 분류 |
| `validate_po_targets` | 수량, 단가, 가격단위, 납기일 검증 |
| `build_po_groups` | PO Header 그룹핑 |
| `number_po_headers` | PO 번호 채번 |
| `build_po_documents` | Header/Item Internal Table 구성 |
| `save_po_documents` | DB INSERT/UPDATE 처리 |
| `build_po_create_response` | OData 응답 구조 구성 |

초기 개발에서는 모든 helper를 한 번에 만들 필요는 없다. 다만 PO 생성 로직은 길어질 가능성이 높으므로, 검증/조회/저장/응답 구성 정도는 분리하는 것이 좋다.

---

## 13. 향후 확장 설계

### 13.1 생성 PO Header 목록 Dialog

V1.1.0에서는 Footer MessagePopover에 생성 PO Header 번호 목록을 표시한다.

향후에는 별도 Dialog를 추가하여 방금 생성된 PO Header 목록을 보여줄 수 있다.

예상 UI:

| 컬럼 | 설명 |
|---|---|
| PO 번호 | 생성 PO Header 번호 |
| 공급업체 | 공급업체 코드/명 |
| 회사코드 | 회사코드/명 |
| 구매조직 | 구매조직/명 |
| 구매그룹 | 구매그룹/명 |
| 통화 | PO 통화 |
| PO Item 수 | 해당 Header에 포함된 Item 수 |

### 13.2 확장용 EntitySet

향후 확장 시 아래 EntitySet을 고려할 수 있다.

| EntitySet | 용도 |
|---|---|
| `PoCreateResultSet` | 생성 결과 상세 메시지 |
| `PoCreateHeaderResultSet` | 방금 생성된 PO Header 목록 |
| `PoCreateItemResultSet` | 방금 생성된 PO Item 목록 |

현재는 범위를 줄이기 위해 `PoCreateRequest` 1건 요약 응답으로 시작한다.

---

## 14. 테스트 설계

### 14.1 Backend Gateway 테스트

| 테스트 | 기대 결과 |
|---|---|
| `$metadata` 조회 | `PoCreateRequestSet` 확인 |
| `POST PoCreateRequestSet` Echo | `POCREATEREQUESTSET_CREATE_ENTITY` Breakpoint 진입 |
| `RfqNo` 누락 | 오류 메시지 반환 |
| 존재하지 않는 RFQ | 오류 메시지 반환 |
| 생성 대상 0건 RFQ | `PO 생성 대상 Item이 없습니다.` 반환 |
| 일부 Item PO 생성 완료 RFQ | 미생성 채택 Item만 생성 대상 |
| 모든 Item 생성 가능 RFQ | PO Header/Item 정상 생성 |
| Number Range 오류 상황 | Rollback 및 오류 표시 |

### 14.2 UI5 수동 테스트

| 테스트 | 기대 결과 |
|---|---|
| RFQ 미선택 상태 | PO 생성 버튼 비활성화 또는 선택 안내 |
| RFQ 선택 후 PO 생성 클릭 | 확인 팝업 표시 |
| 확인 팝업 취소 | OData 호출 없음 |
| 확인 팝업 확인 | `PoCreateRequestSet` POST 호출 |
| 성공 응답 | Footer MessagePopover에 생성 PO 번호 표시 |
| 생성 대상 0건 | MessagePopover에 대상 없음 표시 |
| 일부 Item 제외 | 제외 건수 또는 제외 메시지 표시 |
| 성공 후 화면 | Mid 컬럼 유지, Header/Item/MQ/Chart 재조회 |
| 이미 PO 생성된 Item | 채택/채택취소/라디오 선택 비활성화 유지 |

---

## 15. 개발 순서

### 1단계. 설계서 V1.1.0 확정

- 본 문서를 검토하고 API 전환, 부분 PO 생성 기준, 메시지 표시 방식을 확정한다.
- 확정 후 이 문서를 기준으로 Backend와 UI5 개발을 시작한다.

### 2단계. SEGW에 `PoCreateRequest` / `PoCreateRequestSet` 추가

- Entity Type `PoCreateRequest` 생성
- EntitySet `PoCreateRequestSet` 생성
- Property 추가
- `RfqNo` Key 설정
- Runtime Generate 수행

### 3단계. `CREATE_ENTITY` Echo 테스트 구현

- `POCREATEREQUESTSET_CREATE_ENTITY` 재정의
- `io_data_provider->read_entry_data`로 `RfqNo` 수신
- 실제 PO 생성 없이 Echo 응답 반환
- Gateway Client에서 POST 테스트

### 4단계. UI5 PO 생성 버튼 1차 연결

- Mid Footer에 `PO 생성` 버튼 추가
- i18n 문구 추가
- `onCreatePo` 이벤트 추가
- `oModel.create("/PoCreateRequestSet", ...)` 호출
- Echo 응답을 Footer MessagePopover에 표시

### 5단계. Backend RFQ/Item/MQ 조회 및 분류 구현

- RFQ Header 존재 검증
- RFQ Item 전체 조회
- 채택 MQ Item 조회
- 이미 PO 생성된 Item 분류
- 미채택 Item 분류
- 생성 대상 Item 산출
- 생성 대상 0건 메시지 처리

### 6단계. Backend PO 생성 사전 검증 구현

- 수량 검증
- 단가 검증
- 가격단위 검증
- 납기일 검증
- 공급업체/조직/통화/지급조건 검증
- 기존 PO 중복 참조 검증

### 7단계. Backend PO Header 그룹핑 및 번호 채번 구현

- `BUKRS + EKORG + EKGRP + LIFNR + ZTERM + WAERS` 기준 그룹핑
- 그룹별 `ZNRD3MM01` 번호 채번
- 채번 실패 시 오류 처리

### 8단계. Backend PO Header/Item 저장 구현

- PO Header Internal Table 구성
- PO Item Internal Table 구성
- `ZTD3MM0016`, `ZTD3MM0017` INSERT
- PR 참조 정보 갱신
- All-or-Nothing Commit/Rollback 처리

### 9단계. UI5 성공 후 재조회 구현

- PO 생성 성공 후 RFQ Header 목록 재조회
- KPI 재계산
- 선택 RFQ Header 갱신
- RFQ Item 재조회
- MQ 비교 목록 및 차트 재조회
- Mid 컬럼 유지

### 10단계. 결과 메시지 고도화

- 생성 PO Header 번호 목록 표시
- 제외 Item 건수 표시
- 생성 대상 없음 메시지 표시
- 시스템 오류와 업무 오류 표시 방식 정리

### 11단계. 통합 QA

- 전체 생성 가능 RFQ 테스트
- 일부 Item 이미 PO 생성 RFQ 테스트
- 미채택 Item 포함 RFQ 테스트
- 생성 대상 0건 RFQ 테스트
- Number Range/DB 오류 방어 테스트
- 화면 재조회 및 버튼 비활성화 조건 테스트

### 12단계. 미사용 Function Import 정리 여부 검토

- `PoCreateRequestSet` 방식이 안정화된 뒤 `CreatePoFromRfq` Function Import와 `PoCreateResultSet`을 유지할지 삭제할지 결정한다.
- 삭제 시 SEGW Runtime Generate 영향과 UI5 참조 여부를 다시 확인한다.

---

## 16. 최종 요약

| 구분 | V1.1.0 확정 내용 |
|---|---|
| 핵심 API | `PoCreateRequestSet + CREATE_ENTITY` |
| Function Import | 더 이상 개발하지 않음, 당장은 미사용 상태로 유지 |
| UI5 호출 | `oModel.create("/PoCreateRequestSet", { RfqNo: ... })` |
| PO 생성 대상 | `채택 완료 + PO 미생성` RFQ Item |
| 이미 PO 생성된 Item | 제외 메시지 표시 후 제외 |
| 미채택 Item | 제외 메시지 표시 후 제외 |
| 생성 대상 0건 | PO 생성 없이 MessagePopover 안내 |
| 저장 정책 | 생성 대상 Item 기준 All-or-Nothing |
| PO Header 그룹핑 | `BUKRS + EKORG + EKGRP + LIFNR + ZTERM + WAERS` |
| 번호 채번 | `ZNRD3MM01`, Interval `01` |
| 결과 표시 | Footer MessagePopover에 생성 PO Header 번호 목록 표시 |
| 향후 확장 | 생성된 PO Header 목록 Dialog 추가 가능 |
| 성공 후 화면 | Mid 컬럼 유지, Header/Item/MQ/Chart 재조회 |

