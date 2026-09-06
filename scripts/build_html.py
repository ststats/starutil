import json
import os
import shutil
from jinja2 import Environment, FileSystemLoader
from match_link import link_rounds_to_matches

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

# 같은 날 같은 상대와 여러 경기를 치른 경우를 구분하기 위해 매치/라운드에
# 고유 순번(_match_key)을 부여하고, 라운드에 형식을 채운다 (프론트에서 개인 전적에
# 형식 표시 + 팀 매치 상세보기에서 세트가 섞이지 않게 하는 데 사용됨. match_link.py 참고)
linked_matches, linked_rounds = link_rounds_to_matches(db_data.get('matches', []), db_data.get('rounds', []), db_data.get('members', []))

# 최신 경기가 위로 오도록 역순 정렬 (팀 경기, 개인 라운드 경기)
matches_list = sorted(linked_matches, key=lambda x: str(x.get('날짜', '')), reverse=True)
rounds_list = sorted(linked_rounds, key=lambda x: str(x.get('날짜', '')), reverse=True)

env = Environment(loader=FileSystemLoader('templates'))
template = env.get_template('index.html')

html_output = template.render(
    crew_stats=stats_data['crew_stats'],
    member_stats=stats_data['member_stats'],
    members_list=sorted_members,
    matches_list=matches_list,
    rounds_list=rounds_list  # 개인별 상세 전적 추가!
)

os.makedirs('docs', exist_ok=True)
with open('docs/index.html', 'w', encoding='utf-8') as f:
    f.write(html_output)

# 정적 자산(style.css / app.js / calendar.js)은 데이터와 무관하게 그대로 복사.
# templates/assets/ 아래에 두고 소스로 관리, 빌드마다 docs/로 동기화.
static_src = os.path.join('templates', 'assets')
if os.path.isdir(static_src):
    for filename in os.listdir(static_src):
        shutil.copyfile(os.path.join(static_src, filename), os.path.join('docs', filename))
    print(f"✅ 정적 자산 {os.listdir(static_src)} 을(를) docs/로 복사했습니다.")

print("✅ 성공적으로 화이트&블루 통합 웹페이지가 구워졌습니다!")
