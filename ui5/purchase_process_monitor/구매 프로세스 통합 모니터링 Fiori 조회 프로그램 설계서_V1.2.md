# 구매 프로세스 통합 모니터링 Fiori 조회 프로그램 설계서 V1.2

## 1. 문서 정보

| 항목 | 내용 |
| --- | --- |
| 문서명 | 구매 프로세스 통합 모니터링 Fiori 조회 프로그램 설계서 |
| 버전 | V1.2 |
| 작성일 | 2026.06.15 |
| 대상 기업 | 삼만리 모빌리티 |
| 대상 모듈 | MM 중심, GR/IV 단계에서 FI 연계 |
| 개발 방식 | SAPUI5 Freestyle + SAP Gateway OData V2 |
| Backend 개발 | SAP Gateway Backend는 GPT와 협업하여 개발 |
| Frontend 개발 | SAPUI5 Frontend는 Codex와 협업하여 개발 |
| 기준 UI5 버전 | SAPUI5 1.120.x |
| 기준 화면 구조 | `sap.f.FlexibleColumnLayout` Begin/Mid 2컬럼 |

### 1.1 V1.2 작성 목적

본 문서는 V1.1 설계서와 추가 검토에서 확정한 RFQ 견적 접수·채택 상태 모델 및 Backend 구현 규칙을 통합한 개발 기준 문서다.

Backend GPT와 UI5 Frontend 개발자가 같은 기준으로 개발할 수 있도록 다음 내용을 명확히 정의한다.

```text
1. 지연 상태 계산 단위
2. Begin Column과 Mid Column의 표시 단위
3. Header 대표 지연상태 집계 규칙
4. Working Day 기반 지연 계산
5. RFQ 견적 접수상태와 채택상태의 분리
6. RFQ Item별 채택 지연과 Header 집계 방식
7. Working Day Function Module 계약
8. IV 완료 판정 계약
9. OData EntitySet 및 필드 계약
10. Backend와 UI5 Frontend의 책임 분리
11. 전체 개발 순서
```

### 1.2 V1.1 대비 주요 변경사항

| 구분 | V1.1 | V1.2 확정안 |
| --- | --- | --- |
| RFQ 상태 모델 | 접수상태 중심 | 접수상태와 채택상태 분리 |
| 견적 접수상태 | 미접수/완료 | 미접수/접수완료 |
| 견적 채택상태 | 별도 Header 상태 없음 | 미채택/부분채택/채택완료 |
| 채택 진행도 | 지연 여부만 표시 | 전체/접수/채택 Item 수와 채택률 표시 |
| 채택 지연 계산 | RFQ 기준 설명이 혼재 | RFQ Item별 MQ 그룹 기준 |
| RFQ Header 집계 | 접수 여부 중심 | Item별 채택 결과를 Header로 집계 |
| Working Day FM | `BKK*` 계열로 표현 | `BKK_ADD_WORKINGDAY`, `DATE_CONVERT_TO_FACTORYDATE` |
| Factory Calendar | 시스템 확인 대상 | `KR` 사용 |
| IV 완료 | 상태 및 수량/금액 기준 | 실제 상태값 검증 + 정상 IV 수량 우선 |
| RFQ 현황 영역 | RFQ별 견적 접수 현황 | RFQ별 견적 접수·채택 현황 |
| OData 계약 | 접수 필드 중심 | 접수·채택 상태 및 Item 집계 필드 추가 |
| 테스트 | MQ 0/1건 중심 | 미채택/부분채택/채택완료 시나리오 추가 |

---

## 2. 프로그램 개요

| 항목 | 내용 |
| --- | --- |
| 프로그램명 | 구매 프로세스 통합 모니터링 Fiori 조회 프로그램 |
| 화면명 | 조달 프로세스 통합 모니터링 |
| 앱 성격 | 구매/조달 프로세스 병목 모니터링 앱 |
| 적용 프로세스 | PR → RFQ/RQ → MQ → PO → GR → IV |
| 주요 사용자 | 구매 담당자, 조달 관리자, MM 담당자 |
| 핵심 목적 | 구매 프로세스의 현재 병목과 지연 Item을 조기에 식별 |
| 조회 성격 | 조회 전용 |
| 화면 구조 | Flexible Column Layout Begin/Mid 2컬럼 |
| 기존 앱 연계 | 납기 지연 및 미입고 현황 앱 등 실제 배포된 앱으로 이동 |

### 2.1 개발 목적

기존 MM 프로그램은 구매문서 생성, 견적 비교, 거래선 채택, PO 생성, 입고 및 송장검증처럼 특정 업무 단계의 처리 기능을 담당한다.

본 프로그램은 개별 문서를 생성하거나 변경하는 앱이 아니라, PR부터 IV까지의 전체 흐름을 조회하여 다음 병목을 한 화면에서 확인하는 상위 모니터링 앱이다.

| 업무 문제 | 모니터링 기능 |
| --- | --- |
| PR 생성 후 후속 문서 미생성 | PR 처리 지연 KPI 및 목록 |
| RFQ 생성 후 견적 미접수 | RFQ 견적 미접수 KPI 및 RFQ별 견적 접수상태 |
| MQ 접수 후 일부 또는 전체 Item 미채택 | 채택상태 3단계 및 견적 채택 지연 KPI |
| PO 납기 경과 후 미입고 | PO 납기 지연 KPI 및 기존 앱 이동 |
| 전량 입고 후 IV 미처리 | 입고 후 미송장 KPI |
| 구매문서 연결 흐름 파악 어려움 | Mid Column ProcessFlow와 관련 문서 목록 |
| Header만으로 문제 Item 확인 어려움 | Mid Column 품목별 지연 상세 |

---

## 3. V1.2 구현 범위

### 3.1 포함 범위

개발 마감 일정을 고려하되, V1.2는 설계된 전체 기능을 구현 범위로 한다.

| 기능 | 포함 여부 |
| --- | --- |
| 조회조건 Header | 포함 |
| 코드 필드 Value Help | 포함 |
| 조회조건 유효성 검증 | 포함 |
| KPI 카드 5개 | 포함 |
| 금주 구매 요약 | 포함 |
| RFQ별 견적 접수·채택 현황 | 포함 |
| 조달 상태 Header 목록 | 포함 |
| Flexible Column Layout | 포함 |
| Begin/Mid Routing | 포함 |
| Header 기준 ProcessFlow | 포함 |
| 품목별 지연 상세 | 포함 |
| 관련 문서 목록 | 포함 |
| 문서 상세 Dialog | 포함 |
| 지연 산식 Popover | 포함 |
| 기존 앱 Intent Navigation | 포함 |
| 부분 조회 실패 처리 | 포함 |
| Working Day 지연 계산 | 포함 |
| RFQ 채택상태 3단계 집계 | 포함 |

### 3.2 제외 범위

| 기능 | 제외 사유 |
| --- | --- |
| End Column | 화면 복잡도와 개발 범위 증가 |
| 자동 새로고침 | V1.2는 수동 조회/새로고침으로 충분 |
| 지연 허용일수 설정 테이블 | 초기 버전은 Backend 상수로 관리 |
| 긴급발주 건수 | 실제 판정 필드 또는 확정 규칙이 없음 |
| 공급업체별 RFQ 미응답 | RFQ 생성 시 대상 공급업체를 지정하지 않음 |
| 초과입고 별도 처리 화면 | 프로젝트 업무상 초과입고가 발생하지 않음 |
| 권한별 KPI 제한 | 향후 개선 범위 |

---

## 4. 전체 아키텍처와 개발 책임

### 4.1 전체 데이터 흐름

```text
ZTD3MM0015~ZTD3MM0021 원천 데이터
        ↓
SAP Gateway Backend
- 조회조건 처리
- 문서 연결관계 구성
- Item별 지연 계산
- Header별 상태 집계
- KPI/주간요약/ProcessFlow 집계
        ↓
OData V2 EntitySet
        ↓
SAPUI5 Frontend
- 조회조건 입력
- OData 호출
- KPI/목록/ProcessFlow 표시
- FCL 화면 전환
- Dialog/Popover/앱 이동
```

### 4.2 Backend GPT 책임

Backend는 업무 판단의 단일 기준이 된다.

```text
1. CBO 테이블과 실제 필드 검증
2. PR~IV 문서 연결관계 구성
3. Factory Calendar 기반 Working Day 계산
4. Item별 지연상태 및 지연일수 계산
5. Header별 대표 지연상태와 최대 지연일수 계산
6. KPI, 금주 요약, RFQ 견적 접수·채택 현황 집계
7. ProcessFlow 단계별 집계
8. 문서 및 품목 상세 반환
9. OData Filter 처리
10. 기술 오류와 업무 메시지 반환
```

Backend 개발 시 다음 원칙을 따른다.

```text
- New Open SQL 사용
- SELECT * 사용 지양
- SELECT~ENDSELECT 사용 금지
- LOOP 안 SELECT 사용 금지
- 필요한 필드를 명시적으로 조회
- Header/Item/후속문서를 일괄 조회한 뒤 Internal Table에서 연결
- 지연 계산 결과를 DB에 저장하지 않고 조회 시점에 계산
```

### 4.3 UI5 Frontend 책임

Frontend는 Backend 계산 결과를 신뢰하고 표시와 사용자 상호작용에 집중한다.

```text
1. 조회조건 및 Value Help 제공
2. 입력값 형식과 필수값 유효성 검증
3. 영역별 OData 병렬 조회
4. KPI, 요약, Header 목록 표시
5. KPI 클릭 시 지연상태 조건 변경
6. Header 행 클릭 시 Mid Column 이동
7. Item별 지연 상세와 관련 문서 표시
8. ProcessFlow 단계 선택과 Table 필터 연동
9. 문서 상세 Dialog 표시
10. CrossApplicationNavigation 실행
11. Busy, No Data, 부분 실패, 메시지 처리
```

Frontend에서는 다음 업무 계산을 다시 구현하지 않는다.

```text
- Working Day 계산
- 지연 여부 계산
- 대표 지연상태 계산
- 순입고수량 계산
- IV 완료 여부 계산
- KPI 집계 계산
```

---

## 5. 데이터 처리 단위

### 5.1 핵심 원칙

```text
지연 계산       = Item 단위
Begin 목록      = Header 단위
KPI 집계        = 고유 Header 단위
Mid 상세        = Item 단위
관련 문서 목록  = 실제 문서 Item 단위
```

### 5.2 Header와 Item의 관계

예시:

| PO | Item | 상태 | 지연일수 |
| --- | --- | --- | ---: |
| PO00000020 | 00010 | 정상 | 0 |
| PO00000020 | 00020 | PO 납기 지연 | 5 |
| PO00000020 | 00030 | PO 납기 지연 | 12 |

Begin Column에는 다음과 같이 한 행으로 집계한다.

```text
기준문서     PO00000020
대표상태     PO 납기 지연
지연품목     2건 / 전체 3건
지연일수     12 Working Day
```

Mid Column에는 Item 00010, 00020, 00030을 모두 표시하되 지연 Item을 먼저 정렬한다.

### 5.3 Header 지연 판정

```text
Header에 속한 Item 중 지연 Item이 1건 이상 존재
→ Header 지연

모든 Item이 정상
→ Header 정상
```

### 5.4 KPI 집계

KPI는 각 지연 유형에 해당하는 고유 Header 문서 수를 계산한다.

```text
PO00000020의 Item 2건이 PO 납기 지연
→ PO 납기 지연 KPI는 1건 증가
```

하나의 PO Header에 서로 다른 지연 유형이 존재할 경우 각 KPI는 독립적으로 계산한다.

예시:

```text
PO00000020
- Item 00010: PO 납기 지연
- Item 00020: 입고 후 미송장

PO 납기 지연 KPI     +1
입고 후 미송장 KPI   +1
Begin 목록           PO00000020 한 행
대표 상태            입고 후 미송장
```

### 5.5 Header 대표 지연상태

하나의 Header에 여러 지연 유형이 존재하면 가장 후속 단계의 지연을 대표 상태로 표시한다.

| 우선순위 | 상태 코드 | 상태명 |
| ---: | --- | --- |
| 50 | `IV_INCOMPLETE` | 입고 후 미송장 |
| 40 | `PO_DELIVERY_DELAY` | PO 납기 지연 |
| 30 | `MQ_SELECTION_DELAY` | 견적 채택 지연 |
| 20 | `RFQ_NO_QUOTE` | RFQ 견적 미접수 |
| 10 | `PR_PROCESS_DELAY` | PR 처리 지연 |
| 0 | `NORMAL` | 정상 |

### 5.6 Header 지연일수

```text
Header 지연일수
= 대표 지연상태에 해당하는 Item들의 지연일수 중 최대값
```

대표 상태가 아닌 추가 지연은 `AdditionalDelayCount`, `AdditionalDelayText`로 표시한다.

예시:

```text
대표상태: 입고 후 미송장
비고: PO 납기 지연 1건 추가
```

### 5.7 RFQ 견적 접수상태

RFQ 견적 접수 여부는 Header 단위로 판정한다.

```text
RFQ Header에 연결된 MQ Item이 0건
→ 견적 미접수

RFQ Header에 연결된 MQ Item이 1건 이상
→ 견적 접수완료
```

접수상태는 MQ가 등록되었는지만 나타낸다. 모든 RFQ Item이 견적을 받았거나 채택되었다는 의미는 아니다.

| 접수상태 코드 | 표시값 | 판정 |
| --- | --- | --- |
| `NOT_RECEIVED` | 견적 미접수 | 연결 MQ Item이 0건 |
| `RECEIVED` | 견적 접수완료 | 연결 MQ Item이 1건 이상 |

### 5.8 RFQ 견적 채택상태

RFQ Item별 채택 여부를 RFQ Header로 집계한다.

```text
전체 유효 RFQ Item 수 = TotalRfqItemCount
채택 RFQ Item 수      = AwardedRfqItemCount

AwardedRfqItemCount = 0
→ 견적 미채택

0 < AwardedRfqItemCount < TotalRfqItemCount
→ 견적 부분채택

AwardedRfqItemCount = TotalRfqItemCount
→ 견적 채택완료
```

RFQ Item 채택 여부:

```text
해당 RFQ Item을 ANFNR + ANFPS로 참조하는
유효 MQ Item 중 SELIDC = 'X'인 Item이 존재
→ 해당 RFQ Item 채택
```

삭제 또는 취소된 RFQ/MQ Item은 전체 Item 수와 채택 Item 수에서 제외한다.

| 채택상태 코드 | 표시값 |
| --- | --- |
| `NOT_AWARDED` | 견적 미채택 |
| `PARTIALLY_AWARDED` | 견적 부분채택 |
| `FULLY_AWARDED` | 견적 채택완료 |

### 5.9 접수상태·채택상태·지연상태의 관계

진행상태와 지연상태를 혼합하지 않는다.

| 접수상태 | 채택상태 | 시간 조건 | 지연상태 |
| --- | --- | --- | --- |
| 견적 미접수 | 견적 미채택 | RFQ 허용기한 이내 | 정상 진행 |
| 견적 미접수 | 견적 미채택 | RFQ 허용기한 초과 | RFQ 견적 미접수 |
| 견적 접수완료 | 견적 미채택 | 채택 허용기한 이내 | 정상 진행 |
| 견적 접수완료 | 견적 미채택 | Item 채택 허용기한 초과 | 견적 채택 지연 |
| 견적 접수완료 | 견적 부분채택 | 미채택 Item 허용기한 이내 | 정상 진행 |
| 견적 접수완료 | 견적 부분채택 | 미채택 Item 허용기한 초과 | 견적 채택 지연 |
| 견적 접수완료 | 견적 채택완료 | 해당 없음 | 정상 |

부분채택 상태 자체를 지연으로 보지 않는다. 미채택 Item의 채택 허용기한이 초과된 경우에만 견적 채택 지연이다.

### 5.10 Criticality 계약

Backend는 상태별 `Criticality`를 다음 문자열로 반환한다.

| 상태 | Criticality |
| --- | --- |
| 정상/완료 | `Positive` |
| 진행 중 | `Information` |
| 견적 미접수 진행 중 | `None` |
| 견적 접수완료 | `Information` |
| 견적 미채택 | `None` |
| 견적 부분채택 | `Critical` |
| 견적 채택완료 | `Positive` |
| PR 처리 지연 | `Critical` |
| RFQ 견적 미접수 | `Negative` |
| 견적 채택 지연 | `Critical` |
| PO 납기 지연 | `Negative` |
| 입고 후 미송장 | `Negative` |
| 미생성/예정 | `None` |

Frontend는 같은 상태에 대해 별도의 상충하는 색상 계산을 만들지 않는다.

---

## 6. 문서 연결 기준

### 6.1 단계별 기준 문서

| 지연 유형 | Begin 기준문서 | 집계 단위 |
| --- | --- | --- |
| PR 처리 지연 | PR 번호 | PR Header |
| RFQ 견적 미접수 | RFQ/RQ 번호 | RFQ Header |
| 견적 채택 지연 | RFQ/RQ 번호 | RFQ Header |
| PO 납기 지연 | PO 번호 | PO Header |
| 입고 후 미송장 | PO 번호 | PO Header |

견적 채택은 여러 MQ를 하나의 RFQ 기준으로 비교하므로 Begin 목록의 기준문서는 개별 MQ가 아니라 RFQ Header로 한다.

### 6.2 주요 연결 필드

실제 CBO 필드명과 데이터 타입은 Backend 개발 전에 SE11과 테이블 정의서에서 다시 확인한다.

| 연결 | 기준 필드 |
| --- | --- |
| PR → RFQ | RFQ Item의 PR 참조 필드 |
| PR → PO 직접 전환 | PO Item의 PR 번호/품목 참조 |
| RFQ → MQ | MQ Item `ANFNR + ANFPS` |
| MQ → PO | PO Item `QTNFN + QTNFP` |
| RFQ → PO | PO Item `ANFNR + ANFPS` |
| PO → GR | GR Item의 PO 번호/품목 참조 |
| PO/GR → IV | IV Item의 PO 또는 GR 참조 |

### 6.3 문서 연결 원칙

```text
- 문서번호만으로 연결하지 않고 가능하면 문서번호 + 품목번호로 연결한다.
- 삭제 또는 취소된 문서는 정상 실적에서 제외하거나 순수량/순금액에서 차감한다.
- Header 문서유형은 ZTD3MM0016-BSART로 RQ/MQ/PO를 구분한다.
- MQ 채택 여부는 MQ Item의 SELIDC를 기준으로 한다.
- PO가 참조한 MQ는 QTNFN/QTNFP를 기준으로 추적한다.
```

---

## 7. Working Day 계산 기준

### 7.1 기본 원칙

모든 지연 허용일수와 지연일수는 달력일이 아니라 Working Day로 계산한다.

```text
문서 기준일
→ Factory Calendar 기준 허용 Working Day 추가
→ 허용기한 계산
→ 조회 기준일과 비교
```

### 7.2 Factory Calendar와 Function Module

기존 프로그램에서 검증한 다음 Function Module을 재사용한다.

| 용도 | Function Module |
| --- | --- |
| 기준일에 허용 Working Day 추가 | `BKK_ADD_WORKINGDAY` |
| 날짜를 Factory Date로 변환 | `DATE_CONVERT_TO_FACTORYDATE` |

Factory Calendar ID:

```abap
CONSTANTS gc_factory_cal_kr TYPE scal-fcalid VALUE 'KR'.
```

`KR` Calendar의 한국 공휴일 설정은 기존 프로그램에서 정상 동작한 설정을 그대로 사용한다.

### 7.3 날짜 보정 규칙

| 대상 날짜 | 보정 방향 | 이유 |
| --- | --- | --- |
| 문서 기준일자 | `+` | 휴일이면 다음 Working Day 기준으로 계산 |
| 허용기한 | `+` | 실제 다음 영업 가능일을 허용기한으로 사용 |
| 조회 기준일 | `-` | 주말 조회 시 미래 월요일까지 지연일을 선반영하지 않음 |

### 7.4 계산 규칙

```text
1. 문서 기준일자를 Factory Date로 보정
2. BKK_ADD_WORKINGDAY로 허용기한 계산
3. 조회 기준일을 이전 Working Day로 보정
4. 허용기한과 조회 기준일 비교
5. Factory Date 차이로 지연 Working Day 계산

조회 기준일 > 허용기한
→ 지연

지연일수
= 조회 기준일 Factory Date - 허용기한 Factory Date
```

예시:

```text
문서 기준일       2026.06.01
허용일수          3 Working Day
허용기한          2026.06.04
조회 기준일       2026.06.05
결과              1 Working Day 지연
```

### 7.5 초기 허용일수

허용일수는 Backend 한 곳에서 상수로 관리한다.

```abap
CONSTANTS:
  gc_pr_days  TYPE i VALUE 3,
  gc_rfq_days TYPE i VALUE 2,
  gc_mq_days  TYPE i VALUE 1,
  gc_iv_days  TYPE i VALUE 3.
```

상수명과 타입은 실제 Backend 클래스 스타일에 맞춰 조정할 수 있으나 값과 의미는 동일하게 유지한다.

---

## 8. 지연상태 산정 기준

### 8.1 PR 처리 지연

#### 기준

| 항목 | 내용 |
| --- | --- |
| 기준문서 | PR |
| 기준일자 | PR 생성일 |
| 허용일수 | 3 Working Day |
| 완료 조건 | 후속 RFQ 또는 PO가 하나라도 생성됨 |

#### 판정식

```text
PR 허용기한 < 조회 기준일
AND 후속 RFQ 없음
AND 후속 PO 없음
→ PR 처리 지연
```

직접 PO 전환과 RFQ 경유 전환을 모두 정상 후속 처리로 인정한다.

### 8.2 RFQ 견적 미접수

프로젝트에서는 RFQ 생성 시 특정 공급업체를 지정하지 않는다. 따라서 공급업체별 미응답이 아니라 RFQ에 연결된 MQ 존재 여부로 판정한다.

| 항목 | 내용 |
| --- | --- |
| 기준문서 | RFQ/RQ |
| 기준일자 | RFQ 생성일 |
| 허용일수 | 2 Working Day |
| 견적 접수완료 | 해당 RFQ를 참조하는 MQ Item이 1건 이상 존재 |

#### 판정식

```text
RFQ 허용기한 < 조회 기준일
AND 해당 RFQ를 참조하는 MQ Item 수 = 0
→ RFQ 견적 미접수
```

MQ가 1건 이상 등록되면 공급업체 수와 관계없이 RFQ 견적 접수완료로 본다.

RFQ 견적 미접수는 Header 단위 지연상태다. MQ가 일부 RFQ Item에만 등록되어도 접수상태는 완료가 되지만, 미채택 Item은 별도의 채택상태와 견적 채택 지연 계산에서 관리한다.

### 8.3 견적 채택 지연

| 항목 | 내용 |
| --- | --- |
| 기준문서 | RFQ/RQ |
| 계산 단위 | RFQ Item 그룹 |
| 기준일자 | 해당 RFQ Item을 참조하는 MQ 중 마지막 MQ 생성일 |
| 허용일수 | 1 Working Day |
| 완료 조건 | 해당 RFQ Item 그룹에 `SELIDC = 'X'`인 MQ Item 존재 |

#### 판정식

```text
RFQ Item별 참조 MQ Item 수 > 0
AND 해당 Item의 마지막 MQ 생성일 기준 허용기한 < 조회 기준일
AND 해당 Item에 채택 MQ Item 없음
→ 해당 RFQ Item 견적 채택 지연
```

RFQ별 별도 견적 마감일이 없으므로 Item별 마지막 MQ 생성일을 채택 검토 시작 기준으로 사용한다.

Header 집계:

```text
채택 지연 RFQ Item이 1건 이상
→ RFQ Header 견적 채택 지연

Header 지연일수
= 채택 지연 RFQ Item의 지연일수 중 최대값
```

### 8.4 PO 납기 지연

| 항목 | 내용 |
| --- | --- |
| 기준문서 | PO |
| 기준일자 | PO Item 납기일 |
| 허용일수 | 별도 유예 없음 |
| 완료 조건 | 순입고수량이 PO수량 이상 |

#### 순입고수량

```text
순입고수량 = 101 입고수량 - 102 입고취소수량
미입고수량 = MAX(PO수량 - 순입고수량, 0)
```

#### 판정식

```text
PO Item 납기일 < 조회 기준일
AND 순입고수량 < PO수량
→ PO 납기 지연
```

프로젝트 업무상 초과입고는 발생하지 않지만 Backend는 방어적으로 미입고수량의 최솟값을 0으로 처리한다.

### 8.5 입고 후 미송장

| 항목 | 내용 |
| --- | --- |
| 기준문서 | PO |
| 기준일자 | 해당 Item이 전량 입고된 최종 GR 전기일 |
| 허용일수 | 3 Working Day |
| 선행 조건 | 순입고수량이 PO수량 이상 |
| 완료 조건 | 실제 완료상태의 정상 IV 수량 합계가 PO수량 이상 |

#### 판정식

```text
순입고수량 >= PO수량
AND 최종 GR 기준 허용기한 < 조회 기준일
AND 정상 IV 완료 조건 미충족
→ 입고 후 미송장
```

IV Header 존재만으로 완료 처리하지 않는다.

Backend는 다음을 확인하여 완료 여부를 반환한다.

```text
- IV 취소 여부
- IV Header 상태
- IV Item 상태
- 정상 IV 수량 합계
- PO/GR 참조관계
```

완료 판정:

```text
정상 IV 수량
= 완료상태 IV 수량 - 취소 IV 수량

IV 완료
= IV Header 완료상태
AND IV Item 완료상태
AND 정상 IV 수량 >= PO 수량
```

금액은 세액, 환율, 반올림 차이가 있으므로 완료 판정의 주 기준으로 사용하지 않고 화면 참고 정보로 반환한다.

실제 `RBSTAT`, `IVSTAT` 완료값과 취소 처리 필드는 Backend 개발 전에 정상 완료·부분 송장·취소·미완료 데이터를 확인하여 상수로 확정한다. 실제값을 확인하기 전에는 `'C'` 등의 값을 하드코딩하지 않는다.

### 8.6 취소 문서 처리

```text
GR 102
→ 101 입고수량에서 차감

IV 취소
→ 정상 송장수량과 송장금액에서 차감
```

취소 문서는 이력에는 표시하지만 정상 완료 실적으로 중복 집계하지 않는다.

---

## 9. 조회조건 설계

### 9.1 기본 조회조건

| 항목 | UI Control | 필수 | 기본값 |
| --- | --- | --- | --- |
| 기준일 | `sap.m.DatePicker` | 필수 | 현재일 |
| 조회기간 | `sap.m.Select` | 필수 | 최근 6개월 |
| PR번호 | `sap.m.Input` + Value Help | 선택 | 공백 |
| PO번호 | `sap.m.Input` + Value Help | 선택 | 공백 |
| 지연상태 | `sap.m.Select` | 선택 | 지연 |

### 9.2 조회기간 선택값

```text
3개월
6개월
12개월
```

조회기간은 사용자가 명시적으로 확인할 수 있도록 조회조건에 표시한다.

Backend 조회 범위:

```text
선택 기간 내 생성된 문서
OR
선택 기간 이전에 생성됐지만 현재 미완료 또는 지연 상태인 문서
```

오래된 미완료 문서는 조회기간 때문에 누락되면 안 된다.

### 9.3 상세 조회조건

| 항목 | UI Control | 처리 |
| --- | --- | --- |
| 자재코드 | Input + Value Help | Item 조건 |
| 자재명 | Input | 부분일치 |
| 공급업체코드 | Input + Value Help | Header/Item 조건 |
| 공급업체명 | Input | 부분일치 |
| 플랜트코드 | Input + Value Help | Item 조건 |
| 플랜트명 | Input 또는 표시용 | 코드 선택 시 자동 세팅 |

### 9.4 PR번호와 PO번호 동시 입력

```text
PR번호와 PO번호를 동시에 입력
→ 두 문서가 실제 연결된 경우만 조회
```

두 조건은 OR가 아니라 AND로 처리한다.

### 9.5 기본 플랜트

```text
사용자 기본 플랜트를 조회할 수 있으면 기본값 적용
사용자 기본 플랜트가 없으면 전체 플랜트 조회
```

특정 플랜트를 Frontend에 하드코딩하지 않는다.

### 9.6 지연상태 선택값

| 코드 | 표시값 |
| --- | --- |
| `DELAY` | 지연 |
| `ALL` | 전체 |
| `NORMAL` | 정상 |
| `PR_PROCESS_DELAY` | PR 처리 지연 |
| `RFQ_NO_QUOTE` | RFQ 견적 미접수 |
| `MQ_SELECTION_DELAY` | 견적 채택 지연 |
| `PO_DELIVERY_DELAY` | PO 납기 지연 |
| `IV_INCOMPLETE` | 입고 후 미송장 |

### 9.7 조회조건 적용 범위

| 조건 | KPI | 금주 요약 | RFQ 현황 | Header 목록 |
| --- | ---: | ---: | ---: | ---: |
| 기준일 | O | O | O | O |
| 조회기간 | O | O | O | O |
| PR번호 | O | O | O | O |
| PO번호 | O | O | O | O |
| 자재 | O | O | O | O |
| 공급업체 | O | O | O | O |
| 플랜트 | O | O | O | O |
| 지연상태 | 제외 | 제외 | 제외 | O |

KPI와 요약 영역은 현재 검색 범위의 전체 병목 현황을 보여주기 위해 지연상태 조건을 제외한다.

---

## 10. 전체 화면 구조

### 10.1 Flexible Column Layout

```text
[Begin Column]
- 조회조건
- KPI 카드 5개
- 금주 구매 요약
- RFQ별 견적 접수·채택 현황
- 조달 상태 Header 목록

        ↓ Header 행 클릭

[Mid Column]
- 선택 Header 요약
- PR~IV ProcessFlow
- 품목별 지연 현황
- 관련 문서 목록
- 문서 상세 Dialog
- 지연 산식 Popover
- 기존 앱 이동
```

| 컬럼 | 사용 여부 | 역할 |
| --- | --- | --- |
| Begin | 사용 | 전체 조달 Header 모니터링 |
| Mid | 사용 | 선택 Header의 Item과 연결 문서 상세 |
| End | 미사용 | V1.2 범위 제외 |

### 10.2 Routing

| Route | Pattern | 역할 |
| --- | --- | --- |
| `main` | 빈 Pattern 또는 `/` | Begin Column만 표시 |
| `flow` | `flow/{docType}/{docNo}` | 선택 Header의 Mid Column 표시 |

Layout:

| 상황 | FCL Layout |
| --- | --- |
| 최초 진입 | `OneColumn` |
| Header 선택 | `TwoColumnsMidExpanded` |
| Mid 전체화면 | `MidColumnFullScreen` |
| Mid 닫기 | `OneColumn` |

Header 단위로 이동하므로 Route에는 Item 번호를 넣지 않는다. Mid Column에서 해당 Header의 전체 Item을 조회한다.

---

## 11. Begin Column 설계

### 11.1 조회조건 영역

`sap.f.DynamicPageHeader`에 기본조건과 상세조건을 배치한다.

```text
기본조건
- 기준일
- 조회기간
- PR번호
- PO번호
- 지연상태

상세조건
- 자재코드/자재명
- 공급업체코드/공급업체명
- 플랜트코드/플랜트명
```

버튼:

```text
조회
초기화
새로고침
상세조건 펼치기/접기
```

### 11.2 KPI 카드

KPI는 5개를 모두 구현한다.

| 순서 | 상태 코드 | KPI명 |
| ---: | --- | --- |
| 1 | `PR_PROCESS_DELAY` | PR 처리 지연 |
| 2 | `RFQ_NO_QUOTE` | RFQ 견적 미접수 |
| 3 | `MQ_SELECTION_DELAY` | 견적 채택 지연 |
| 4 | `PO_DELIVERY_DELAY` | PO 납기 지연 |
| 5 | `IV_INCOMPLETE` | 입고 후 미송장 |

KPI 카드 표시:

```text
주 숫자     = 지연된 고유 Header 문서 수
보조 텍스트 = 지연 Item 수
```

예시:

```text
PO 납기 지연
3건
지연 품목 7건
```

KPI 클릭:

```text
KPI 클릭
→ 지연상태 Select를 해당 상태로 변경
→ Header 목록 재조회
→ 결과 목록 위치로 이동
```

0건 KPI는 클릭할 수 없도록 비활성화한다.

### 11.3 금주 구매 요약

금주의 범위:

```text
기준일이 속한 주의 월요일
~
조회 기준일
```

| 요약 항목 | 기준 |
| --- | --- |
| 구매금액 합계 | 금주 생성 PO의 순구매금액 |
| 입고금액 합계 | 금주 GR 전기일 기준 101-102 순금액 |
| 송장금액 합계 | 금주 IV 전기일 기준 정상 IV-취소 순금액 |
| 금주 입고 완료 건수 | 금주에 전량 입고 완료된 고유 PO Header 수 |
| 입고 완료 후 미송장 건수 | 조회 기준일 현재 입고 후 미송장 고유 PO Header 수 |

긴급발주 건수는 V1.2에서 제외한다.

### 11.4 RFQ별 견적 접수·채택 현황

RFQ별 MQ 등록 여부와 Item별 채택 진행도를 같은 Table에서 확인한다.

| 컬럼 | 설명 |
| --- | --- |
| RFQ번호 | RFQ/RQ Header 번호 |
| 생성일 | RFQ 생성일 |
| 경과일 | 생성일부터 기준일까지 Working Day |
| 접수 MQ 수 | 해당 RFQ를 참조하는 MQ 수 |
| 참여 공급업체 수 | MQ를 제출한 고유 공급업체 수 |
| 전체 RFQ Item | 유효 RFQ Item 수 |
| MQ 접수 Item | MQ가 하나 이상 등록된 RFQ Item 수 |
| 채택 Item | `SELIDC = 'X'`인 MQ가 존재하는 RFQ Item 수 |
| 접수상태 | 견적 미접수 또는 견적 접수완료 |
| 채택상태 | 견적 미채택, 견적 부분채택, 견적 채택완료 |
| 채택률 | 채택 Item 수 / 전체 RFQ Item 수 |
| 지연상태 | RFQ 견적 미접수 또는 견적 채택 지연 여부 |

접수상태:

```text
참조 MQ 수 = 0
→ 미접수

참조 MQ 수 >= 1
→ 견적 접수완료
```

채택상태:

```text
채택 Item = 0
→ 견적 미채택

0 < 채택 Item < 전체 RFQ Item
→ 견적 부분채택

채택 Item = 전체 RFQ Item
→ 견적 채택완료
```

화면 예시:

```text
RQ00000010
접수완료
부분채택
2 / 5 Item 채택
채택률 40%
```

접수·채택 진행상태와 지연상태는 별도 `ObjectStatus`로 표시한다.

### 11.5 조달 상태 Header 목록

UI Control:

```text
sap.m.Table
mode="None"
itemPress 사용
demandPopin 적용
```

권장 컬럼:

| 컬럼 | 설명 |
| --- | --- |
| 대표 지연상태 | Header의 가장 후속 단계 지연 |
| 기준문서 | 문서유형 + Header 번호 |
| 자재 요약 | 대표 자재명 또는 `외 N건` |
| 공급업체 요약 | 대표 공급업체 또는 `외 N건` |
| 플랜트 요약 | 대표 플랜트 또는 `외 N건` |
| 기준일자 | 대표 지연상태의 기준일자 |
| 지연일수 | 대표 상태 Item 중 최대 Working Day |
| 지연품목 | 지연 Item 수 / 전체 Item 수 |
| 비고 | 추가 지연상태, 부분입고, 미송장 등 |
| RFQ 접수/채택상태 | RFQ 문서인 경우 접수상태와 채택상태 |

Header에 여러 자재나 플랜트가 있으면 임의의 단일 값을 사실처럼 표시하지 않는다.

예시:

```text
자재 요약: 알루미늄 프레임 외 2건
플랜트 요약: P00002 외 1건
```

정렬:

```text
1. 대표 상태 우선순위 내림차순
2. Header 지연일수 내림차순
3. 기준문서 번호 오름차순
```

행 클릭:

```text
Router.navTo("flow", {
  docType: DocType,
  docNo: DocNo
})
```

---

## 12. Mid Column 설계

### 12.1 최초 표시 원칙

선택 Header의 전체 Item을 표시하되 다음 순서로 정렬한다.

```text
1. 지연 Item
2. 대표 지연상태 우선순위
3. 지연일수 내림차순
4. Item 번호 오름차순
5. 정상 Item
```

정상 Item도 숨기지 않는다. 사용자는 한 Header 안에서 정상 품목과 문제 품목을 함께 비교할 수 있어야 한다.

### 12.2 Header 영역

| 항목 | 설명 |
| --- | --- |
| 기준문서 | 선택 Header 문서번호 |
| 문서유형 | PR/RFQ/PO 등 |
| 대표 지연상태 | Header 집계 상태 |
| 기준일 | 조회 기준일 |
| 최대 지연일수 | 대표 상태 Item 중 최대값 |
| 지연품목 | 지연 Item 수 / 전체 Item 수 |
| 전체화면 버튼 | `MidColumnFullScreen` |
| 닫기 버튼 | `main` Route로 복귀 |

### 12.3 ProcessFlow

사용 Control:

```text
sap.suite.ui.commons.ProcessFlow
sap.suite.ui.commons.ProcessFlowLaneHeader
sap.suite.ui.commons.ProcessFlowNode
```

단계:

```text
PR → RFQ → MQ → PO → GR → IV
```

ProcessFlow는 개별 문서를 모두 나열하지 않고 단계별 집계 노드를 표시한다.

예시:

```text
PR 4건
→ RFQ 1건
→ MQ 3건 / 2 of 5 Item 채택 / 부분채택
→ PO 1건 / 지연 Item 2건
→ GR 3건 / 전량입고 1건
→ IV 미처리 1건
```

단계 상태:

| 상태 | ProcessFlow 의미 |
| --- | --- |
| 완료 | Positive |
| 진행 중 | Neutral |
| 주의 | Critical |
| 지연 | Negative |
| 미생성/예정 | Planned 또는 Neutral |

ProcessFlow 노드 클릭:

```text
선택 Stage를 품목/관련 문서 목록 필터에 반영
```

### 12.4 품목별 지연 현황

Mid Column에는 선택 Header의 Item별 상태를 별도 Table로 표시한다.

| 컬럼 | 설명 |
| --- | --- |
| 품목번호 | Header Item 번호 |
| 자재 | 자재코드 + 자재명 |
| 플랜트 | 플랜트코드 + 플랜트명 |
| 공급업체 | 적용 가능한 경우 표시 |
| 현재 단계 | PR/RFQ/MQ/PO/GR/IV |
| MQ 접수여부 | RFQ Item 기준 MQ 존재 여부 |
| MQ 채택여부 | RFQ Item 기준 `SELIDC = 'X'` 존재 여부 |
| 지연상태 | 정상 또는 Item 지연상태 |
| 기준일자 | 지연 판단 기준 날짜 |
| 지연일수 | Working Day |
| 수량 | 요청/PO/입고/송장 수량 |
| 비고 | 부분입고, 미송장, 추가 지연 등 |

Item이 여러 지연상태에 해당하면 대표 Item 상태와 추가 상태를 함께 반환한다. RFQ Item은 MQ 접수여부와 MQ 채택여부를 별도로 표시한다.

### 12.5 관련 문서 목록

상단 단계 필터:

```text
[전체] [PR] [RFQ] [MQ] [PO] [GR] [IV]
```

UI Control:

```text
sap.m.SegmentedButton
sap.m.Table
```

관련 문서 컬럼:

| 컬럼 | 설명 |
| --- | --- |
| 단계 | PR/RFQ/MQ/PO/GR/IV |
| 문서번호 | 실제 문서번호 |
| 품목번호 | 실제 문서 Item |
| 자재 | 코드 + 명칭 |
| 공급업체 | 코드 + 명칭 |
| 상태 | 문서 상태 |
| 기준일자 | 문서 단계의 기준 날짜 |
| 수량 | 문서수량 |
| 금액 | 문서금액 |
| 통화 | 통화코드 |
| 비고 | 채택, 취소, 부분입고, 미처리 등 |

### 12.6 문서 상세 Dialog

관련 문서 행을 클릭하면 공통 Dialog를 표시한다.

```text
공통 영역
- 단계
- 문서번호
- 품목번호
- 상태
- 기준일자

유형별 상세 영역
- PR
- RFQ
- MQ
- PO
- GR
- IV
```

Dialog에는 실제 연결 대상 앱이 존재하는 경우에만 앱 이동 버튼을 제공한다.

### 12.7 지연 산식 Popover

버튼명:

```text
지연 산식 보기
```

선택 Header의 대표 지연상태 산식을 기본 표시하고, 추가 지연상태가 있으면 함께 선택할 수 있도록 한다.

예시:

```text
PO 납기 지연

납기일 < 기준일
AND 순입고수량 < PO수량

순입고수량 = 101 - 102
지연일수 = 납기일 다음 Working Day부터 기준일까지
```

---

## 13. Value Help 및 유효성 검증

### 13.1 Value Help 대상

| 필드 | 재사용 서비스 |
| --- | --- |
| PR번호 | PR CDS OData |
| PO번호 | PO CDS OData |
| 자재코드 | 자재 CDS OData |
| 공급업체코드 | 공급업체 CDS OData |
| 플랜트코드 | 플랜트 CDS OData |

기존 프로젝트에서 사용하는 `TableSelectDialog` 공통 패턴을 재사용한다.

### 13.2 코드 선택 처리

```text
자재코드 선택
→ 자재명 자동 세팅

공급업체코드 선택
→ 공급업체명 자동 세팅

플랜트코드 선택
→ 플랜트명 자동 세팅
```

### 13.3 조회 전 유효성 검증

| 검증 | 처리 |
| --- | --- |
| 기준일 미입력 | 조회 중단 |
| 기준일 형식 오류 | ValueState Error |
| 조회기간 미선택 | 기본 6개월 적용 또는 오류 표시 |
| 코드 형식 오류 | ValueState Error |
| 존재하지 않는 코드 | Value Help OData로 검증 |
| PR/PO 동시 입력 불일치 | 조회 결과 없음 또는 Backend 업무 메시지 |

여러 오류는 `sap.m.MessagePopover`로 한 번에 표시한다.

---

## 14. OData Service 설계

### 14.1 Service

```text
SEGW Project : ZGWD3MM_PROC_MON
Service Name : ZGWD3MM_PROC_MON_SRV
OData Version: V2
```

### 14.2 EntitySet 목록

| EntitySet | 역할 | V1.2 변경 |
| --- | --- | --- |
| `DashboardSummarySet` | KPI 5개 집계 | Header/Item 수 함께 반환 |
| `WeeklySummarySet` | 금주 구매 요약 | 긴급발주 제거 |
| `RfqQuotationStatusSet` | RFQ별 견적 접수·채택 현황 | 접수/채택 상태와 Item 진행도 반환 |
| `DelayListSet` | Begin Header 목록 | Header 단위로 확정 |
| `ProcessFlowSet` | 단계별 집계 노드 | Header 기준 |
| `ProcessItemSet` | Mid 품목별 지연 및 MQ 접수·채택 현황 | RFQ Item 상태 필드 추가 |
| `ProcessDocumentSet` | 관련 실제 문서 목록 | 유지 |
| `DocumentDetailSet` | 문서 상세 Dialog | 유지 |
| `PrValueHelpSet` | PR Value Help | 재사용 가능 |
| `PoValueHelpSet` | PO Value Help | 재사용 가능 |
| `MaterialValueHelpSet` | 자재 Value Help | 재사용 가능 |
| `VendorValueHelpSet` | 공급업체 Value Help | 재사용 가능 |
| `PlantValueHelpSet` | 플랜트 Value Help | 재사용 가능 |

### 14.3 공통 Filter 계약

메인 EntitySet은 가능한 범위에서 동일한 Filter 이름을 사용한다.

| Property | 의미 |
| --- | --- |
| `KeyDate` | 조회 기준일 |
| `LookbackMonths` | 3, 6, 12 |
| `PrNo` | PR번호 |
| `PoNo` | PO번호 |
| `DelayStatus` | 지연상태 |
| `Matnr` | 자재코드 |
| `Maktx` | 자재명 부분검색 |
| `Lifnr` | 공급업체코드 |
| `Name1` | 공급업체명 부분검색 |
| `Werks` | 플랜트코드 |

`DelayStatus`는 `DelayListSet`에만 실제 필터로 적용하고 KPI와 요약 EntitySet에서는 무시한다.

---

## 15. OData Entity 상세 계약

### 15.1 DashboardSummarySet

Key:

```text
SummaryId
```

호출 결과는 한 행이며 `SummaryId = 'DASHBOARD'`를 반환한다.

| 필드 | 설명 |
| --- | --- |
| `SummaryId` | 고정 Key |
| `KeyDate` | 기준일 |
| `PrDelayHeaderCount` | PR 지연 Header 수 |
| `PrDelayItemCount` | PR 지연 Item 수 |
| `RfqNoQuoteHeaderCount` | RFQ 견적 미접수 Header 수 |
| `RfqNoQuoteItemCount` | 견적 미접수 RFQ Header에 포함된 Item 수 |
| `MqSelectionDelayHeaderCount` | 견적 채택 지연 RFQ Header 수 |
| `MqSelectionDelayItemCount` | 견적 채택 지연 Item 수 |
| `PoDeliveryDelayHeaderCount` | PO 납기 지연 Header 수 |
| `PoDeliveryDelayItemCount` | PO 납기 지연 Item 수 |
| `IvIncompleteHeaderCount` | 입고 후 미송장 PO Header 수 |
| `IvIncompleteItemCount` | 입고 후 미송장 Item 수 |

### 15.2 WeeklySummarySet

Key:

```text
SummaryId
```

| 필드 | 설명 |
| --- | --- |
| `SummaryId` | 고정값 `WEEKLY` |
| `WeekFrom` | 해당 주 월요일 |
| `WeekTo` | 조회 기준일 |
| `PurchaseAmount` | PO 순구매금액 |
| `ReceiptAmount` | GR 순입고금액 |
| `InvoiceAmount` | IV 순송장금액 |
| `Waers` | 표시 통화 |
| `CompletedGrHeaderCount` | 금주 전량 입고 완료 PO Header 수 |
| `IvIncompleteHeaderCount` | 입고 완료 후 미송장 PO Header 수 |

금액은 Backend에서 기존 환율 CBO와 환율 조회 로직을 재사용하여 KRW로 환산한다.

```text
Waers = 'KRW'
PurchaseAmount = KRW 환산 구매금액
ReceiptAmount  = KRW 환산 입고금액
InvoiceAmount  = KRW 환산 송장금액
```

통화별 복수 행은 반환하지 않는다.

### 15.3 RfqQuotationStatusSet

Key:

```text
RfqNo
```

| 필드 | 설명 |
| --- | --- |
| `RfqNo` | RFQ번호 |
| `DocDate` | RFQ 생성일 |
| `ElapsedWorkDays` | 기준일까지 경과 Working Day |
| `MqCount` | 참조 MQ 문서 수 |
| `VendorCount` | MQ 제출 고유 공급업체 수 |
| `TotalRfqItemCount` | 전체 유효 RFQ Item 수 |
| `QuotedRfqItemCount` | MQ가 등록된 RFQ Item 수 |
| `AwardedRfqItemCount` | 채택 MQ가 존재하는 RFQ Item 수 |
| `UnawardedRfqItemCount` | 미채택 RFQ Item 수 |
| `AwardProgressRate` | 채택률 |
| `ReceptionStatus` | `NOT_RECEIVED` 또는 `RECEIVED` |
| `ReceptionStatusText` | 견적 미접수 또는 견적 접수완료 |
| `AwardStatus` | `NOT_AWARDED`, `PARTIALLY_AWARDED`, `FULLY_AWARDED` |
| `AwardStatusText` | 견적 미채택, 견적 부분채택, 견적 채택완료 |
| `ReceptionDelayYn` | RFQ 견적 미접수 지연 여부 |
| `SelectionDelayYn` | 견적 채택 지연 여부 |
| `MaxSelectionDelayDays` | 미채택 지연 Item 중 최대 Working Day |
| `ReceptionCriticality` | 접수상태 UI 상태 |
| `AwardCriticality` | 채택상태 UI 상태 |
| `Criticality` | UI 상태 |

### 15.4 DelayListSet

Key:

```text
DocType + DocNo
```

| 필드 | 설명 |
| --- | --- |
| `DocType` | 기준문서 유형 |
| `DocNo` | 기준문서 Header 번호 |
| `DelayStatus` | 대표 지연상태 코드 |
| `DelayStatusText` | 대표 지연상태명 |
| `DelayPriority` | 대표 상태 우선순위 |
| `BaseDate` | 대표 상태 기준일자 |
| `DelayDays` | 대표 상태 최대 지연 Working Day |
| `TotalItemCount` | 전체 Item 수 |
| `DelayedItemCount` | 지연 Item 수 |
| `QuotationReceptionStatus` | RFQ 견적 접수상태 |
| `QuotationReceptionStatusText` | 접수상태 텍스트 |
| `QuotationAwardStatus` | RFQ 견적 채택상태 |
| `QuotationAwardStatusText` | 채택상태 텍스트 |
| `AwardedRfqItemCount` | 채택 RFQ Item 수 |
| `UnawardedRfqItemCount` | 미채택 RFQ Item 수 |
| `AwardProgressRate` | 채택률 |
| `MaterialSummary` | 자재 요약 |
| `VendorSummary` | 공급업체 요약 |
| `PlantSummary` | 플랜트 요약 |
| `AdditionalDelayCount` | 추가 지연상태 수 |
| `AdditionalDelayText` | 추가 지연 설명 |
| `Remark` | 부분입고, 미송장 등 |
| `Criticality` | UI 상태 |

### 15.5 ProcessFlowSet

Key:

```text
ContextDocType + ContextDocNo + Stage
```

| 필드 | 설명 |
| --- | --- |
| `ContextDocType` | 선택 기준문서 유형 |
| `ContextDocNo` | 선택 기준문서 번호 |
| `Stage` | PR/RFQ/MQ/PO/GR/IV |
| `StageOrder` | 단계 순서 |
| `StageText` | 단계명 |
| `NodeTitle` | 집계 노드 제목 |
| `NodeSubText` | 상태 보조 텍스트 |
| `DocumentCount` | 단계 문서 수 |
| `ItemCount` | 단계 Item 수 |
| `DelayedItemCount` | 단계 지연 Item 수 |
| `ReceptionStatus` | RFQ/MQ 단계 접수상태 |
| `AwardStatus` | RFQ/MQ 단계 채택상태 |
| `AwardedItemCount` | 채택 Item 수 |
| `Status` | 완료/진행/주의/지연/예정 |
| `Criticality` | UI 상태 |
| `ParentStage` | 이전 단계 |
| `ChildStage` | 다음 단계 |

### 15.6 ProcessItemSet

Key:

```text
ContextDocType + ContextDocNo + ItemNo
```

| 필드 | 설명 |
| --- | --- |
| `ContextDocType` | 선택 Header 유형 |
| `ContextDocNo` | 선택 Header 번호 |
| `ItemNo` | 기준 Item 번호 |
| `Matnr` | 자재코드 |
| `Maktx` | 자재명 |
| `Werks` | 플랜트 |
| `PlantName` | 플랜트명 |
| `Lifnr` | 공급업체 |
| `Name1` | 공급업체명 |
| `CurrentStage` | 현재 업무 단계 |
| `QuotationReceivedYn` | 해당 RFQ Item에 MQ 존재 여부 |
| `QuotationAwardedYn` | 해당 RFQ Item에 채택 MQ 존재 여부 |
| `LastMqDate` | 해당 RFQ Item의 마지막 MQ 생성일 |
| `DelayStatus` | Item 대표 지연상태 |
| `DelayStatusText` | 상태명 |
| `DelayPriority` | 상태 우선순위 |
| `BaseDate` | 기준일자 |
| `DelayDays` | 지연 Working Day |
| `Quantity` | 기준 문서수량 |
| `ReceivedQuantity` | 순입고수량 |
| `OpenQuantity` | 미입고수량 |
| `InvoicedQuantity` | 정상 송장수량 |
| `Meins` | 단위 |
| `AdditionalDelayText` | 추가 지연상태 |
| `Remark` | 비고 |
| `Criticality` | UI 상태 |

### 15.7 ProcessDocumentSet

Key:

```text
ContextDocType + ContextDocNo + Stage + DocNo + ItemNo
```

| 필드 | 설명 |
| --- | --- |
| `ContextDocType` | 선택 Header 유형 |
| `ContextDocNo` | 선택 Header 번호 |
| `Stage` | 문서 단계 |
| `DocNo` | 실제 문서번호 |
| `ItemNo` | 실제 품목번호 |
| `Matnr` / `Maktx` | 자재 |
| `Lifnr` / `Name1` | 공급업체 |
| `StatusText` | 문서 상태 |
| `BaseDate` | 문서 기준일자 |
| `Menge` / `Meins` | 수량/단위 |
| `Amount` / `Waers` | 금액/통화 |
| `Remark` | 채택, 부분입고, 취소 등 |
| `Criticality` | UI 상태 |

### 15.8 DocumentDetailSet

Key:

```text
Stage + DocNo + ItemNo + DisplayOrder
```

| 필드 | 설명 |
| --- | --- |
| `Stage` | 문서유형 |
| `DocNo` | 문서번호 |
| `ItemNo` | 품목번호 |
| `FieldName` | 화면 표시명 |
| `FieldValue` | 화면 표시값 |
| `DisplayOrder` | 표시 순서 |
| `GroupName` | 공통/수량/금액/참조 등 그룹 |

---

## 16. Frontend Model 설계

| Model | 역할 |
| --- | --- |
| 기본 OData Model | `ZGWD3MM_PROC_MON_SRV` |
| `filter` | 조회조건 |
| `view` | Busy, FCL Layout, 상세조건, 선택상태 |
| `dashboard` | KPI, 금주 요약, RFQ 현황, Header 목록 |
| `flow` | ProcessFlow, 품목, 관련 문서, 선택 Stage |
| `detail` | 문서 상세 Dialog |
| `messages` | 유효성 검증 및 조회 메시지 |

초기 `filter` Model 예시:

```javascript
{
  KeyDate: new Date(),
  LookbackMonths: "6",
  PrNo: "",
  PoNo: "",
  DelayStatus: "DELAY",
  Matnr: "",
  Maktx: "",
  Lifnr: "",
  Name1: "",
  Werks: "",
  PlantName: ""
}
```

초기 `view` Model 예시:

```javascript
{
  Busy: false,
  AdvancedFilterVisible: false,
  FclLayout: "OneColumn",
  SelectedDocType: "",
  SelectedDocNo: "",
  PartialErrors: []
}
```

---

## 17. Frontend 조회 처리

### 17.1 최초 조회

```text
1. Component 및 OData Metadata 로드
2. 기준일 = 현재일
3. 조회기간 = 6개월
4. 지연상태 = 지연
5. 사용자 기본 플랜트 조회, 없으면 전체
6. 조회조건 검증
7. Begin 영역 자동 조회
```

### 17.2 Begin 영역 병렬 조회

```text
Promise.allSettled([
  DashboardSummarySet,
  WeeklySummarySet,
  RfqQuotationStatusSet,
  DelayListSet
])
```

하나의 영역이 실패해도 성공한 다른 영역은 유지한다.

### 17.3 Header 선택

```text
1. Header 행 클릭
2. flow Route 이동
3. FCL = TwoColumnsMidExpanded
4. ProcessFlowSet 조회
5. ProcessItemSet 조회
6. ProcessDocumentSet 조회
7. 지연 Item 우선 정렬
```

### 17.4 새로고침

현재 조회조건과 선택 Header를 유지하여 다시 조회한다.

```text
Begin만 열린 상태
→ Begin 영역 재조회

Mid가 열린 상태
→ Begin + 선택 Mid 영역 재조회
```

---

## 18. 기존 앱 이동

### 18.1 기본 원칙

실제 Fiori Launchpad에 등록된 앱만 버튼을 제공한다.

```text
1순위: CrossApplicationNavigation Intent
2순위: 연결 설정이 없으면 안내 메시지
```

URL 직접 하드코딩은 사용하지 않는다.

### 18.2 납기/미입고 앱 이동

표시 조건:

```text
PO 납기 지연 상태가 존재하는 경우
```

전달 파라미터:

```text
PO번호
플랜트
기준일
```

### 18.3 구현 전 확인 항목

| 항목 | 확인 대상 |
| --- | --- |
| Semantic Object | Fiori Launchpad Target Mapping |
| Action | Fiori Launchpad Target Mapping |
| PO 파라미터명 | 대상 앱 manifest 및 Component |
| 플랜트 파라미터명 | 대상 앱 조회조건 |
| 기준일 파라미터명 | 대상 앱 조회조건 |
| 사용자 권한 | Intent 실행 가능 여부 |

---

## 19. 예외 및 메시지 처리

### 19.1 No Data

```text
조회 조건에 해당하는 조달 상태 데이터가 없습니다.
```

지연상태가 `지연`인 경우:

```text
현재 기준일 기준으로 조달 지연 대상이 없습니다.
```

### 19.2 부분 실패

예:

```text
KPI 성공
금주 요약 성공
RFQ 현황 실패
Header 목록 성공
```

처리:

```text
- 성공 영역은 그대로 표시
- 실패 영역에 재조회 안내 표시
- MessagePopover에 기술 메시지 추가
- 전체 화면을 오류로 막지 않음
```

### 19.3 Mid 데이터 없음

선택 Header의 연결 문서가 일부 없으면 ProcessFlow에 미생성 노드를 표시한다.

```text
MQ 미접수
PO 미생성
GR 미처리
IV 미처리
```

### 19.4 메시지 구분

| 메시지 종류 | UI 처리 |
| --- | --- |
| 입력 오류 | ValueState + MessagePopover |
| 조회 결과 없음 | MessageStrip 또는 Empty State |
| 부분 조회 실패 | 영역별 MessageStrip + MessagePopover |
| 앱 이동 실패 | MessageToast 또는 MessageBox |
| Backend 업무 오류 | OData Error Message 파싱 후 표시 |

---

## 20. 성능 설계

### 20.1 Backend

```text
- 조회기간 조건을 최초 후보 문서 축소에 사용
- 오래된 미완료 문서는 별도 조건으로 포함
- Header 후보를 먼저 구한 뒤 관련 Item/GR/IV를 일괄 조회
- GR과 IV는 DB 또는 Internal Table에서 문서/품목별 집계
- 동일 계산을 KPI와 목록에서 무조건 반복하지 않도록 공통 계산 메소드 구성
- Header 집계 전에 Item 계산 결과를 재사용
- 문서 연결 Key에 맞는 Secondary Key 또는 Sorted/Hashed Table 활용
```

### 20.2 Frontend

```text
- Begin과 Mid 데이터를 필요한 시점에 분리 조회
- Mid 데이터는 Header 선택 전 조회하지 않음
- OData 응답을 JSONModel에 복사해 화면 상태와 분리
- Table growing 또는 paging 적용
- Fragment는 최초 1회 Lazy Load 후 재사용
- Busy 상태를 화면 전체와 영역 단위로 구분
```

---

## 21. 테스트 설계

### 21.1 Backend 단위 테스트 기준

| 케이스 | 기대 결과 |
| --- | --- |
| PR 후속 RFQ 없음 | 허용일수 초과 시 PR 지연 |
| PR 후속 PO 직접 생성 | PR 정상 |
| RFQ 참조 MQ 0건 | 허용일수 초과 시 RFQ 견적 미접수 |
| RFQ 참조 MQ 1건 이상 | RFQ 견적 접수완료 |
| RFQ Item 2건, 채택 0건 | 견적 미채택 |
| RFQ Item 2건, 채택 1건 | 견적 부분채택 |
| RFQ Item 2건, 채택 2건 | 견적 채택완료 |
| MQ 존재, SELIDC 없음 | 해당 Item 허용일수 초과 시 견적 채택 지연 |
| 부분채택이지만 미채택 Item 허용기한 이내 | 정상 진행 |
| 부분채택이고 미채택 Item 허용기한 초과 | 견적 채택 지연 |
| PO 10, GR101 5 | PO 납기 경과 시 납기 지연 |
| PO 10, GR101 10 | PO 입고 완료 |
| PO 10, GR101 10, GR102 2 | 순입고 8, 납기 지연 가능 |
| 전량 GR 후 IV 없음 | 허용일수 초과 시 미송장 |
| 전량 GR 후 정상 IV 완료 | 정상 |
| IV 취소 발생 | 취소분 차감 후 재판정 |
| Header Item 3건 중 1건 지연 | Header 지연 |
| Header에 PO 지연과 IV 지연 공존 | 대표 상태 IV 미송장 |
| 대표 상태 Item 여러 건 | 최대 지연일수 반환 |
| 기간 이전 미완료 문서 | 조회 결과에 포함 |
| 한국 공휴일 포함 기간 | 공휴일 제외 Working Day 계산 |

### 21.2 OData 통합 테스트

| EntitySet | 확인 내용 |
| --- | --- |
| DashboardSummarySet | Header 수와 Item 수 구분 |
| WeeklySummarySet | 월요일~기준일 금액 집계 |
| RfqQuotationStatusSet | 접수상태 2단계, 채택상태 3단계, Item 집계 |
| DelayListSet | Header 중복 없이 한 행 |
| ProcessFlowSet | PR~IV 단계 순서와 상태 |
| ProcessItemSet | 정상/지연 Item 전체 반환 |
| ProcessDocumentSet | 실제 연결문서 반환 |
| DocumentDetailSet | 문서유형별 표시 필드 |

### 21.3 UI5 테스트

| 케이스 | 기대 결과 |
| --- | --- |
| 최초 진입 | 오늘/6개월/지연 자동 조회 |
| KPI 클릭 | 지연상태 변경 후 Header 목록 재조회 |
| 0건 KPI | 클릭 불가 |
| Header 행 클릭 | Mid Column 열림 |
| Mid 최초 표시 | 지연 Item 우선, 정상 Item 포함 |
| RFQ 현황 상태 | 접수상태와 채택상태를 별도 표시 |
| RFQ 부분채택 | 채택 Item 수와 채택률 표시 |
| ProcessFlow 노드 클릭 | 관련 목록 Stage 필터 |
| 문서 행 클릭 | 상세 Dialog 표시 |
| 전체화면 | MidColumnFullScreen |
| 닫기 | Begin OneColumn 복귀 |
| 부분 API 실패 | 성공 영역 유지 |
| 기존 앱 이동 | Intent와 파라미터 전달 |
| 모바일/태블릿 | Table Pop-in 및 FCL 반응형 확인 |

---

## 22. 구현 전 기술 검증 체크리스트

Backend GPT가 코딩을 시작하기 전에 다음 항목을 실제 시스템에서 확인한다.

| 번호 | 확인 항목 |
| ---: | --- |
| 1 | `ZTD3MM0015~0021`의 실제 Key와 필드 타입 |
| 2 | PR→RFQ 및 PR→PO 실제 참조 필드 |
| 3 | MQ 생성일과 Header/Item 연결 방식 |
| 4 | `ANFNR/ANFPS`, `QTNFN/QTNFP`, `SELIDC` 실제 저장값 |
| 5 | GR 이동유형 필드와 101/102 데이터 저장 방식 |
| 6 | PO수량, 입고수량, 단위 필드 |
| 7 | IV Header/Item 완료 및 취소 상태값 |
| 8 | `BKK_ADD_WORKINGDAY`, `DATE_CONVERT_TO_FACTORYDATE` 기존 사용 인터페이스 |
| 9 | Factory Calendar ID `KR`의 한국 공휴일 설정 |
| 10 | 통화 환산 기준과 기존 환율 CBO 재사용 가능 여부 |
| 11 | 기존 앱 Semantic Object/Action/파라미터 |
| 12 | Value Help CDS OData 서비스명 |

검증 결과 필드명이 본 문서와 다르면 업무 의미는 유지하고 OData Property 이름을 기준 계약으로 사용한다.

---

## 23. 권장 프로젝트 구조

```text
ui5/procurement_process_monitor/
├─ webapp/
│  ├─ controller/
│  │  ├─ App.controller.js
│  │  ├─ Main.controller.js
│  │  └─ Flow.controller.js
│  ├─ view/
│  │  ├─ App.view.xml
│  │  ├─ Main.view.xml
│  │  └─ Flow.view.xml
│  ├─ fragment/
│  │  ├─ DocumentDetail.fragment.xml
│  │  ├─ DelayFormula.fragment.xml
│  │  └─ ValueHelp.fragment.xml
│  ├─ model/
│  │  ├─ models.js
│  │  └─ formatter.js
│  ├─ css/
│  │  └─ style.css
│  ├─ i18n/
│  │  └─ i18n.properties
│  ├─ localService/
│  │  └─ mainService/
│  │     └─ metadata.xml
│  ├─ test/
│  │  ├─ unit/
│  │  └─ integration/
│  ├─ Component.js
│  └─ manifest.json
├─ package.json
├─ ui5.yaml
└─ 구매 프로세스 통합 모니터링 Fiori 조회 프로그램 설계서_V1.2.md
```

Controller를 Begin과 Mid로 분리하여 하나의 `Main.controller.js`가 지나치게 커지지 않도록 한다.

---

## 24. 최종 개발 순서

Backend와 Frontend가 같은 OData 계약을 기준으로 병행 개발할 수 있도록 다음 순서로 진행한다.

### 1단계. 실제 데이터 구조 검증

```text
- ZTD3MM0015~0021 필드 확인
- PR~IV 연결 Key 확인
- GR/IV 상태값 확인
- 두 Working Day Function Module의 기존 호출 인터페이스 확인
- Factory Calendar `KR` 설정 확인
- 기존 앱 Intent 정보 확인
```

산출물:

```text
테이블/필드 매핑표
상태값 정의표
문서 연결 Key 정의표
```

### 2단계. OData 계약 확정

```text
- EntitySet 목록 확정
- Entity별 Key 확정
- Property 타입/길이 확정
- 공통 Filter 이름 확정
- 상태 코드와 Criticality 확정
```

산출물:

```text
SEGW Entity 정의표
$metadata 초안
Frontend Mock metadata
```

### 3단계. SEGW Service 생성

```text
- ZGWD3MM_PROC_MON Project 생성
- Entity Type/EntitySet 생성
- Runtime Object Generate
- Service 등록
- $metadata 호출 확인
```

### 4단계. Backend 공통 데이터 수집 로직 개발

```text
- 조회조건 파싱
- 기간 내 후보 문서 조회
- 기간 이전 미완료 문서 추가
- Header/Item/GR/IV 일괄 조회
- PR~IV 연결관계 구성
```

### 5단계. Working Day 공통 로직 개발

```text
- `BKK_ADD_WORKINGDAY` Wrapper
- `DATE_CONVERT_TO_FACTORYDATE` Wrapper
- 허용기한 계산
- 지연 Working Day 계산
- 휴일/주말/공휴일 테스트
```

### 6단계. Item별 지연 계산 로직 개발

개발 순서:

```text
1. PO 납기 지연
2. 입고 후 미송장
3. PR 처리 지연
4. RFQ 견적 미접수
5. RFQ Item별 MQ 접수·채택 여부
6. 견적 채택 지연
```

PO와 GR 로직은 기존 납기/미입고 앱의 검증된 계산 방식을 우선 참고한다.

### 7단계. Header 집계 로직 개발

```text
- Item 중 지연 존재 여부
- 대표 지연상태 선정
- 대표 상태 최대 지연일수
- 지연 Item 수/전체 Item 수
- 추가 지연상태 요약
- RFQ 접수상태 집계
- RFQ 채택상태 3단계 집계
- 채택 Item 수/미채택 Item 수/채택률
```

### 8단계. Begin EntitySet 구현

```text
- DashboardSummarySet
- WeeklySummarySet
- RfqQuotationStatusSet
- DelayListSet
```

각 EntitySet을 Gateway Client에서 독립적으로 테스트한다.

### 9단계. Mid EntitySet 구현

```text
- ProcessFlowSet
- ProcessItemSet
- ProcessDocumentSet
- DocumentDetailSet
```

선택 Header 기준으로 PR~IV 연결망이 정확히 반환되는지 확인한다.

### 10단계. UI5 프로젝트 생성 및 공통 설정

```text
- Basic V2 Freestyle App 생성
- namespace 설정
- mainService 연결
- Value Help Service 연결
- sap.m, sap.f, sap.suite.ui.commons 의존성 추가
- formatter/models/i18n 기본 구조 생성
```

### 11단계. Flexible Column Layout과 Routing 구현

```text
- App.view.xml FCL 구성
- main Route
- flow/{docType}/{docNo} Route
- OneColumn
- TwoColumnsMidExpanded
- MidColumnFullScreen
```

### 12단계. Begin 조회조건과 Value Help 구현

```text
- 기준일
- 조회기간 3/6/12개월
- PR/PO번호
- 지연상태
- 자재/공급업체/플랜트
- 공통 TableSelectDialog
- MessagePopover 유효성 검증
```

### 13단계. Begin 대시보드 전체 구현

```text
- KPI 카드 5개
- 금주 구매 요약
- RFQ별 견적 접수·채택 현황
- Header 조달 상태 목록
- KPI 클릭 필터
- 부분 API 실패 처리
```

### 14단계. Mid Header와 ProcessFlow 구현

```text
- 선택 Header 요약
- ProcessFlow 단계별 집계
- 전체화면/닫기
- 노드 클릭 Stage 필터
```

### 15단계. Mid 품목 및 관련 문서 구현

```text
- ProcessItemSet Table
- 지연 Item 우선 정렬
- 정상 Item 포함
- RFQ Item별 MQ 접수·채택 여부
- ProcessDocumentSet Table
- SegmentedButton Stage 필터
```

### 16단계. Dialog, Popover, 앱 이동 구현

```text
- 문서 상세 Dialog
- 지연 산식 Popover
- CrossApplicationNavigation
- Intent 파라미터 전달
- 이동 실패 메시지
```

### 17단계. 통합 테스트 및 성능 보완

```text
- Backend 단위 케이스 테스트
- Gateway Client EntitySet 테스트
- UI5 QUnit 테스트
- Header/Item 집계 일치 확인
- Working Day 공휴일 테스트
- 조회기간 이전 미완료 문서 테스트
- Desktop/Tablet/Phone 반응형 테스트
- OData 호출 수와 응답시간 확인
```

### 18단계. 최종 배포 검증

```text
- Fiori Launchpad Tile/Target Mapping
- 사용자 권한
- Value Help 서비스 접근
- 기존 앱 Intent Navigation
- 운영 데이터 No Data/Error 처리
- 최종 화면 시나리오 시연
```

### 24.1 개발 순서 최종 요약

| 순서 | 개발 영역 | 주 담당 | 완료 기준 |
| ---: | --- | --- | --- |
| 1 | 데이터/상태/Calendar 검증 | Backend | 필드 매핑 확정 |
| 2 | OData 계약 | Backend + Frontend | Metadata 합의 |
| 3 | SEGW 생성 | Backend | 서비스 호출 성공 |
| 4 | 공통 데이터 수집 | Backend | PR~IV 연결 성공 |
| 5 | Working Day | Backend | 공휴일 테스트 통과 |
| 6 | Item 지연·채택 계산 | Backend | 5개 지연상태와 Item별 채택 판정 성공 |
| 7 | Header 집계 | Backend | 대표 상태/KPI/채택상태 3단계 일치 |
| 8 | Begin EntitySet | Backend | 4개 EntitySet 호출 성공 |
| 9 | Mid EntitySet | Backend | Flow/Item/문서 반환 성공 |
| 10 | UI5 기본구조 | Frontend | 앱 실행 및 서비스 연결 |
| 11 | FCL/Routing | Frontend | Begin/Mid 이동 성공 |
| 12 | 조회조건/Value Help | Frontend | 조회조건 검증 성공 |
| 13 | Begin 전체 화면 | Frontend | KPI/요약/RFQ 접수·채택/Header 목록 완료 |
| 14 | ProcessFlow | Frontend | 단계별 집계 표시 |
| 15 | 품목/관련 문서 | Frontend | 지연 및 MQ 접수·채택 Item 식별 가능 |
| 16 | Dialog/Popover/앱 이동 | Frontend | 상세 및 Drill-down 성공 |
| 17 | 통합 테스트 | 공동 | 업무 시나리오 통과 |
| 18 | 배포 검증 | 공동 | Launchpad 실행 성공 |
