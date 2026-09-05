import os
import json
import gspread

# 1. GitHub Secrets 환경 변수 가져오기
creds_json = os.environ.get('GOOGLE_CREDENTIALS_JSON')
sheet_id = os.environ.get('GOOGLE_SHEET_ID')

if not creds_json or not sheet_id:
    raise ValueError("GitHub Secrets 환경 변수가 제대로 설정되지 않았습니다.")

# 2. 구글 시트 연결
creds_dict = json.loads(creds_json)
gc = gspread.service_account_from_dict(creds_dict)
spreadsheet = gc.open_by_key(sheet_id)

# 3. 데이터 통합을 위한 딕셔너리 생성
db_dict = {}

# 시트 이름(구글 시트)과 딕셔너리에 들어갈 Key 이름(JSON) 매핑
sheet_mapping = {
    '설정': 'settings',
    '팀 목록': 'teams',      # <-- 이 부분이 크루 목록에서 팀 목록으로, Key가 teams로 변경되었습니다!
    '멤버 목록': 'members',
    '매치 목록': 'matches',
    '매치 전적': 'rounds'
}

# 시트별 필수 컬럼 - 이 컬럼이 없으면 이후 통계 산출(generate_stats.py)이
# KeyError로 조용히 죽기 때문에, 여기서 미리 잡아서 명확한 경고를 남긴다.
required_columns = {
    'settings': ['시즌', '날짜'],
    'members': ['이름'],
    'matches': ['날짜', '상대팀', '형식', '최종 결과'],
    'rounds': ['날짜', '상대팀', '형식', '우리 선수', '결과', '상대 종족', '맵'],
}

print("데이터를 불러오는 중...")

for sheet_name, key_name in sheet_mapping.items():
    try:
        worksheet = spreadsheet.worksheet(sheet_name)
        # 데이터를 리스트 형태의 딕셔너리로 바로 가져옴
        records = worksheet.get_all_records()
        db_dict[key_name] = records
        print(f"✅ '{sheet_name}' 시트 불러오기 완료! ({len(records)}행)")

        # 필수 컬럼 검증 (행이 있을 때만 확인 가능)
        needed = required_columns.get(key_name)
        if needed and records:
            missing = [col for col in needed if col not in records[0]]
            if missing:
                print(f"⚠️ '{sheet_name}' 시트에 예상 컬럼이 없습니다: {missing} — 통계 산출 단계에서 오류가 날 수 있습니다.")
    except gspread.exceptions.WorksheetNotFound:
        print(f"❌ '{sheet_name}' 시트를 찾을 수 없습니다. 이름을 확인해주세요.")

# 4. 저장할 폴더 생성
os.makedirs('data', exist_ok=True)

# 5. 하나의 db.json 파일로 통합 저장
with open('data/db.json', 'w', encoding='utf-8') as f:
    json.dump(db_dict, f, ensure_ascii=False, indent=2)

print("\n🎉 모든 데이터가 data/db.json 파일 하나로 통합되어 성공적으로 저장되었습니다!")