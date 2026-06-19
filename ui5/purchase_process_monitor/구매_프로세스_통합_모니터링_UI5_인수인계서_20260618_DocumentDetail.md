# 구매 프로세스 통합 모니터링 UI5 인수인계서

작성일: 2026.06.18  
대상 프로젝트: `ui5/purchase_process_monitor`  
기준 설계서: `구매 프로세스 통합 모니터링 Fiori 조회 프로그램 설계서_V1.2.1.md`  
현재 완료 단계: 전체 41단계 중 32단계 `DocumentDetailSet 조회 및 Dialog 표시`

## 1. 현재 결론

Begin Column의 조회조건, KPI, 주간 요약, 조달 문서 목록은 대부분 구현되었다.

Mid Column은 PO 행 선택 후 다음 데이터를 조회하고 표시한다.

1. `ProcessFlowSet`: PR -> RFQ -> MQ -> PO -> GR -> IV 조달 흐름
2. `ProcessItemSet`: 품목별 현재 단계와 수량/지연 상태
3. `ProcessDocumentSet`: 선택 PO와 연결된 관련 문서 목록
4. `DocumentDetailSet`: Dialog에서 선택한 관련 문서의 상세 필드

다음 개발은 33단계 `지연 산식 Popover`다.

## 2. 핵심 설계 결정

| 항목 | 결정 |
| --- | --- |
| FCL 구조 | Begin Column 목록 + Mid Column PO 상세 |
| Mid 진입 대상 | PO 문서만 가능 |
| PR/RFQ 행 선택 | Mid를 열지 않고 안내 메시지 표시 |
| 조달 흐름 UI | `sap.suite.ui.commons.ProcessFlow` 사용 |
| ProcessFlow 노드 클릭 | 사용하지 않음, 시각화 전용 |
| 단계 선택 | ProcessFlow 하단 `SegmentedButton` 사용 |
| 품목 단계 필터 | 이미 조회한 `ProcessItemSet`을 Frontend에서 필터링 |
| 관련 문서 상세 | 별도 `sap.m.Dialog`에서 표시 |
| 상세 필드 구성 | Backend가 `GroupName/FieldName/FieldValue`로 결정 |
| 상세 필드 순서 | `DisplayOrder` 오름차순 |

ProcessFlow를 시각화 전용으로 둔 이유는 UI5 ProcessFlow의 상태와 focus 처리에 따라 일부 노드만 클릭 가능한 것처럼 보이는 문제가 있었기 때문이다. 단계 선택은 명확한 `SegmentedButton`으로 분리했다.

## 3. 단계별 개발 현황

| 단계 | 개발 항목 | 상태 | 비고 |
| --- | --- | --- | --- |
| 1 | 프로젝트 기본 설정 | 완료 | `manifest.json`, `Component.js`, `sap.f` |
| 2 | 공통 JSONModel | 완료 | filter/view/dashboard/weekly/delay/rfq/detail |
| 3 | Formatter | 완료 | 상태, 수량, 품목번호 등 |
| 4 | FCL Begin Column 골격 | 완료 | 조회/KPI/요약/목록 |
| 5 | FCL Mid Column 골격 | 완료 | DynamicPage 및 Footer 포함 |
| 6 | 기본 조회조건 UI | 완료 | 기준일/기간/지연상태/문서유형 |
| 7 | 상세 조회조건 UI | 완료 | 자재/공급업체/플랜트/문서번호 |
| 8~18 | 조회 필터 기능 | 완료 | LookbackMonths, Maktx, Name1 포함 |
| 19~20 | RFQ/MQ 별도 영역 | 제외 | 조달 문서 목록으로 통합 |
| 21 | DelayList 행 선택 | 완료 | 선택 문서 문맥 저장 |
| 22 | PR 행 처리 | 완료 | 안내 후 Mid 호출 금지 |
| 23 | RFQ 행 처리 | 완료 | 안내 후 Mid 호출 금지 |
| 24 | PO 행 처리 | 완료 | Mid Column 오픈 |
| 25 | `ProcessFlowSet` 조회 | 완료 | StageOrder 정렬 |
| 26 | `ProcessItemSet` 조회 | 완료 | ItemNo 정렬 |
| 27 | Mid PO 요약 | 완료 | 선택한 DelayList Header 정보 사용 |
| 28 | ProcessFlow UI | 완료 | `sap.suite.ui.commons.ProcessFlow` |
| 29 | 품목별 진행 상태 Table | 완료 | 단계 버튼 필터 포함 |
| 30 | 문서 상세 Dialog Fragment | 완료 | 상/하단 2개 Table |
| 31 | `ProcessDocumentSet` 조회 | 완료 | 단계/연도/품목 순 정렬 |
| 32 | `DocumentDetailSet` 조회 | 완료 | 선택 문서 4개 Key 필터 |
| 33 | 지연 산식 Popover | 미완료 | 다음 단계 |
| 34 | 납기/미입고 앱 이동 | 미완료 | 대상 앱 intent 확인 필요 |
| 35 | Busy 처리 고도화 | 일부 완료 | Mid/Dialog Busy 구현됨 |
| 36 | 오류 메시지 고도화 | 일부 완료 | 공통 OData 메시지 사용 중 |
| 37 | No Data 처리 | 일부 완료 | Begin/Mid/Dialog 기본 문구 있음 |
| 38 | 반응형 정리 | 일부 완료 | Mid/Dialog 최종 점검 필요 |
| 39 | 전체 수동 테스트 | 진행 중 | 사용자가 단계별 확인 중 |
| 40 | `npm run build` | 성공 | 2026.06.18 재검증 |
| 41 | `npm run lint` | 성공 | 오류 0건, 기존 경고 4건 |

## 4. 주요 파일과 역할

| 파일 | 역할 |
| --- | --- |
| `webapp/view/Main.view.xml` | Begin/Mid Column 전체 화면, ProcessFlow, 품목 Table, Footer |
| `webapp/controller/Main.controller.js` | 조회, 필터, FCL 전환, Mid OData 호출, Dialog 이벤트 |
| `webapp/fragment/DocumentDetailDialog.fragment.xml` | 관련 문서 및 문서 상세 Dialog |
| `webapp/model/models.js` | 공통 JSONModel 초기 구조 |
| `webapp/model/formatter.js` | 상태/번호/수량 화면 변환 |
| `webapp/manifest.json` | OData, 라우팅, UI5 라이브러리 의존성 |
| `webapp/test/unit/controller/Main.controller.js` | Controller 단위 테스트 |
| `webapp/test/unit/model/models.js` | 모델 초기값 테스트 |
| `webapp/test/unit/model/formatter.js` | Formatter 단위 테스트 |

## 5. PO 선택 이후 처리 흐름

```text
조달 문서 목록에서 PO 행 선택
-> onDelayListItemPress
-> _openMidColumnForPo
-> FCL layout = TwoColumnsMidExpanded
-> ProcessFlowSet / ProcessItemSet / ProcessDocumentSet 병렬 조회
-> detail JSONModel에 결과 저장
-> ProcessFlow, 품목별 진행 상태, 관련 문서 Dialog 데이터 준비
```

PR 또는 RFQ는 PO 기준 상세 흐름을 만들 수 없으므로 `_openMidColumnForPo`를 호출하지 않는다.

## 6. Mid Column 데이터 구조

`detail` 모델에서 사용하는 주요 경로는 다음과 같다.

| 모델 경로 | 내용 |
| --- | --- |
| `/processFlow` | Backend ProcessFlowSet 원본 |
| `/processFlowNodes` | ProcessFlow Node 화면 구조 |
| `/processFlowLanes` | ProcessFlow Lane 화면 구조 |
| `/processItemsAll` | ProcessItemSet 전체 원본 |
| `/processItems` | 현재 선택 단계에 해당하는 화면 행 |
| `/processItemCount` | 현재 표시 품목 수 |
| `/processDocuments` | 관련 문서 목록 |
| `/processDocumentCount` | 관련 문서 수 |
| `/documentDetails` | 선택 관련 문서의 상세 필드 |

`view` 모델의 주요 선택 상태는 다음과 같다.

| 모델 경로 | 내용 |
| --- | --- |
| `/selectedDocType` | Begin에서 선택한 문서유형 |
| `/selectedDocNo` | Begin에서 선택한 문서번호 |
| `/selectedProcessStage` | PR/RFQ/MQ/PO/GR/IV 선택 단계 |
| `/selectedDocumentStage` | Dialog 선택 문서 단계 |
| `/selectedDocumentNo` | Dialog 선택 문서번호 |
| `/selectedDocumentYear` | Dialog 선택 문서연도 |
| `/selectedDocumentItemNo` | Dialog 선택 문서품목 |
| `/dialogBusy` | 문서 상세 조회 Busy 상태 |

## 7. DocumentDetailSet 구현 내용

### 7.1 사용자 흐름

```text
Mid Footer의 문서 상세 보기 클릭
-> DocumentDetailDialog Fragment 최초 로드 또는 기존 인스턴스 재사용
-> 상단 관련 문서 목록 표시
-> 관련 문서 행 선택
-> 기존 상세 행 초기화
-> Dialog Busy 시작
-> DocumentDetailSet 조회
-> DisplayOrder 정렬
-> 하단 상세 Table 표시
-> Dialog Busy 해제
```

### 7.2 OData 필터 계약

Frontend는 선택한 `ProcessDocumentSet` 행에서 다음 4개 값을 그대로 전달한다.

```text
Stage  EQ 선택 문서 단계
DocNo  EQ 선택 문서번호
DocYear EQ 선택 문서연도
ItemNo EQ 선택 문서품목번호
```

호출 EntitySet:

```text
/DocumentDetailSet
```

Backend 반환 필드:

| 필드 | 용도 |
| --- | --- |
| `Stage` | 문서 단계 Key |
| `DocNo` | 문서번호 Key |
| `DocYear` | 문서연도 Key |
| `ItemNo` | 품목번호 Key |
| `DisplayOrder` | 화면 표시 순서 |
| `GroupName` | 상세 그룹 |
| `FieldName` | 항목명 |
| `FieldValue` | 표시 값 |

Frontend는 개별 업무 필드를 하드코딩하지 않는다. Backend가 상세 항목을 추가해도 위 구조로 반환하면 Dialog에 자동 표시된다.

## 8. 현재 OData EntitySet 사용 현황

| EntitySet | 상태 | 용도 |
| --- | --- | --- |
| `DashboardSummarySet` | 사용 중 | KPI 요약 |
| `WeeklySummarySet` | 사용 중 | 주간 구매/입고/송장 요약 |
| `DelayListSet` | 사용 중 | 조달 문서 목록 |
| `ProcessFlowSet` | 사용 중 | PO 조달 흐름 |
| `ProcessItemSet` | 사용 중 | 품목별 진행 상태 |
| `ProcessDocumentSet` | 사용 중 | 관련 문서 목록 |
| `DocumentDetailSet` | 사용 중 | 관련 문서 상세 필드 |

## 9. 32단계 수동 테스트 케이스

| 번호 | 테스트 절차 | 기대 결과 |
| --- | --- | --- |
| 1 | Begin에서 문서유형 PO 선택 후 조회 | PO 행만 표시 |
| 2 | PO 행 선택 | Mid Column 열림 |
| 3 | `문서 상세 보기` 클릭 | 관련 문서 Dialog 열림 |
| 4 | Dialog 상단 PO/GR/IV 행 선택 | 하단 상세 Table 갱신 |
| 5 | 브라우저 Network 확인 | `DocumentDetailSet` 요청 발생 |
| 6 | 요청 필터 확인 | Stage/DocNo/DocYear/ItemNo 일치 |
| 7 | 상세 항목 순서 확인 | DisplayOrder 오름차순 표시 |
| 8 | 다른 관련 문서 연속 선택 | 이전 상세가 남지 않고 새 값으로 교체 |
| 9 | 상세 데이터 없는 문서 선택 | 오류 없이 No Data 문구 표시 |
| 10 | Backend 오류 유도 | 오류 MessageBox 표시 후 Busy 해제 |

## 10. 검증 결과

2026.06.18 기준 다음 명령을 실행했다.

```powershell
npm run build
npm run lint
git diff --check
```

| 검증 | 결과 |
| --- | --- |
| UI5 build | 성공 |
| ESLint error | 0건 |
| ESLint warning | 기존 4건 |
| Git whitespace error | 없음 |

기존 경고는 다음과 같다.

| 위치 | 내용 |
| --- | --- |
| `dist/test/testsuite.qunit-dbg.js` | unused eslint-disable |
| `Main.controller.js` | `max-params` |
| `Main.controller.js` | `no-nested-ternary` |
| `webapp/test/testsuite.qunit.js` | unused eslint-disable |

`npm run build`에는 i18n fallback locale `en` 관련 경고가 있으나 빌드는 성공한다.

## 11. 다음 개발: 33단계 지연 산식 Popover

Mid Footer의 `지연 산식 보기` 버튼은 현재 비활성 상태다.

다음 단계 권장 구현은 다음과 같다.

1. `sap.m.Popover` 또는 `sap.m.ResponsivePopover` Fragment 생성
2. 선택 PO의 지연 상태와 지연일 표시
3. 기준일, 기준 납기일 또는 후속 처리 기준일 표시
4. Calendar Day가 아니라 KR Working Day 기준임을 명시
5. Backend의 BKK 계열 Working Day 함수 결과를 Frontend가 재계산하지 않음을 명시
6. PO가 선택된 경우에만 Footer 버튼 활성화
7. 모바일에서 Popover 대신 Dialog처럼 표시되는 반응형 동작 확인

주의: Frontend에서 공휴일 계산을 다시 구현하면 Backend 판정과 값이 달라질 수 있다. 산식 Popover는 Backend 결과를 설명하는 용도여야 한다.

## 12. 남은 개발 순서

| 순서 | 단계 | 작업 |
| --- | --- | --- |
| 1 | 33 | 지연 산식 Popover |
| 2 | 34 | 납기/미입고 앱 이동 연결 |
| 3 | 35 | Busy 처리 최종 정리 |
| 4 | 36 | OData 오류 메시지 최종 정리 |
| 5 | 37 | 전체 No Data 상태 점검 |
| 6 | 38 | Begin/Mid/Dialog 반응형 최종 점검 |
| 7 | 39 | 전체 수동 통합 테스트 |
| 8 | 40~41 | build/lint 최종 검증 |

## 13. 최종 요약

| 구분 | 현재 상태 |
| --- | --- |
| Begin 조회/필터/KPI | 거의 완료 |
| 조달 문서 목록 | 완료 |
| PO Mid Column | 완료 |
| ProcessFlow | 완료, 시각화 전용 |
| 품목 단계 필터 | 완료 |
| 관련 문서 목록 | 완료 |
| 문서 상세 Dialog | 완료 |
| DocumentDetailSet | 완료 |
| 현재 완료 단계 | 32단계 |
| 다음 단계 | 33단계 지연 산식 Popover |
