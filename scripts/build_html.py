import json
import os
from jinja2 import Environment, FileSystemLoader

try:
    with open('data/render_stats.json', 'r', encoding='utf-8') as f:
        stats_data = json.load(f)
    with open('data/db.json', 'r', encoding='utf-8') as f:
        db_data = json.load(f)
except FileNotFoundError:
    print("❌ JSON 파일이 없습니다.")
    exit(1)

def sort_members(members):
    role_order = {'감독': 1, '코치': 2, '선수': 3}
    return sorted(members, key=lambda x: (
        role_order.get(x.get('직책', '선수'), 99),
        str(x.get('입단 티어', '99'))
    ))

sorted_members = sort_members(db_data.get('members', []))
# 최신 경기가 위로 오도록 역순 정렬
matches_list = sorted(db_data.get('matches', []), key=lambda x: str(x.get('날짜', '')), reverse=True)

env = Environment(loader=FileSystemLoader('templates'))
template = env.get_template('index.html')

html_output = template.render(
    crew_stats=stats_data['crew_stats'],
    member_stats=stats_data['member_stats'],
    members_list=sorted_members,
    matches_list=matches_list  # 상세 매치 리스트 추가!
)

os.makedirs('docs', exist_ok=True)
with open('docs/index.html', 'w', encoding='utf-8') as f:
    f.write(html_output)

print("✅ 성공적으로 화이트&블루 통합 웹페이지가 구워졌습니다!")
