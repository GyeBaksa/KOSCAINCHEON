# 대한전문건설협회 인천광역시회 모바일 업무정보 앱 v1.2

## v1.2 핵심 변경
- Supabase 공용 DB 연결
- PC 관리자에서 인명부/업무연락처 저장 → 모든 휴대폰에 공통 반영
- PDF는 Supabase Storage의 private `documents` bucket에 저장
- PDF 열람 시 서버가 1시간짜리 signed URL을 발급
- 관리자 비밀번호는 Netlify 서버 환경변수에서 검증
- Supabase Secret Key는 브라우저 소스에 포함되지 않음
- Netlify Functions를 사용하므로 이 버전은 반드시 정적 `public` 폴더만이 아니라 **프로젝트 폴더 전체**를 Netlify에 배포해야 함

## 현재 Supabase 테이블
- `members`
- `work_contacts`
- `documents`
- `statistics`
- `admin_logs`

## Supabase Storage
- private bucket: `documents`

## Netlify 환경변수
권장 이름:
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

현재 사용자가 먼저 만든 아래 이름도 v1.2에서 그대로 인식합니다.
- `kosca_incheon` → Supabase Project URL
- `secret_key` → Supabase Secret Key
- `admin_password` → 관리자 비밀번호
- `admin_session_secret` → 관리자 세션 서명 문자열

따라서 기존 Netlify 환경변수 이름을 당장 바꿀 필요는 없습니다.

## 배포 방법
1. `kosca_mobile_app_v1_2.zip` 압축을 풉니다.
2. Netlify의 기존 `koscaincheon` 사이트 → Deploys로 이동합니다.
3. 압축을 푼 `kosca_mobile_app_v1_2` 폴더를 새 배포 영역에 올립니다.
4. 배포가 끝나면 기존 `https://koscaincheon.netlify.app` 주소를 새로고침합니다.
5. PWA/홈 화면 앱이 구버전을 보이면 Chrome에서 사이트를 완전히 종료 후 다시 열거나 캐시를 새로고침합니다. v1.2 서비스워커는 이전 캐시를 자동 삭제합니다.

## 첫 확인 순서
1. `/api/app?action=health` 주소를 브라우저에서 엽니다.
   - 정상: `{"ok":true,"database":true}`
2. 앱 → 관리 → Netlify에 등록한 관리자 비밀번호 입력
3. PC 관리자 → 인명부 관리 → 엑셀 업로드
4. 휴대폰에서 앱 새로고침 → 같은 명단 확인
5. PDF 자료 관리 → PDF 업로드 → 휴대폰 자료실에서 열람 확인

## 엑셀 권장 열
### 인명부
`성명 | 회사명 | 직위 | 휴대전화 | 일반전화 | 이메일 | 비고`

업로드 화면에서 `명단명`(대표회원, 회장단, 운영위원 등)을 별도 입력합니다.

### 업무연락처
`분류 | 기관명 | 부서명 | 담당자 | 직위 | 담당업무 | 사무실전화 | 휴대전화 | 이메일 | 비고`

## 관리자 비밀번호 변경
v1.2부터 관리자 비밀번호는 앱 브라우저에 저장하지 않습니다.
Netlify → Project configuration → Environment variables에서 `admin_password` 또는 `ADMIN_PASSWORD` 값을 변경하고 새 배포를 실행합니다.

## 주의
- `secret_key` / `SUPABASE_SECRET_KEY` 값은 누구에게도 보내지 말고 Netlify 안에서만 관리하세요.
- Supabase `documents` bucket은 Public을 OFF로 유지하세요.
- 일반 사용자는 로그인 없이 인명부/업무연락처/PDF를 볼 수 있으므로 앱 URL 자체는 조직 내부 배포를 권장합니다.
