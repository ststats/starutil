import json
import os
from jinja2 import Environment, FileSystemLoader

# 1. 통계 데이터와 원본 DB 모두 로드
try:
    with open('data/render_stats.json', 'r', encoding='utf-8') as f:
        stats_data = json.load(f)
    with open('data/db.json', 'r', encoding='utf-8') as f:
        db_data = json.load(f)
except FileNotFoundError:
    print("❌ JSON 파일이 없습니다. update_data.py와 generate_stats.py를 확인하세요.")
    exit(1)

# 2. 멤버 목록을 직책(감독->코치->선수) 및 티어 순으로 정렬하는 헬퍼 함수
def sort_members(members):
    role_order = {'감독': 1, '코치': 2, '선수': 3}
    # x.get('직책')이 없으면 '선수'로 간주, 티어는 문자열이므로 임시 처리
    return sorted(members, key=lambda x: (
        role_order.get(x.get('직책', '선수'), 99),
        str(x.get('입단 티어', '99'))
    ))

sorted_members = sort_members(db_data.get('members', []))

# 3. HTML 렌더링
env = Environment(loader=FileSystemLoader('templates'))
template = env.get_template('index.html')

html_output = template.render(
    crew_stats=stats_data['crew_stats'],
    member_stats=stats_data['member_stats'],
    members_list=sorted_members  # 정렬된 멤버 DB 추가!
)

# 4. 저장
os.makedirs('docs', exist_ok=True)
with open('docs/index.html', 'w', encoding='utf-8') as f:
    f.write(html_output)

print("✅ 성공적으로 캄몬스타즈 통합 웹페이지가 구워졌습니다!")
