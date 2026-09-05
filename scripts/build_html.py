import json
import os
from jinja2 import Environment, FileSystemLoader

# 1. 아까 파이썬이 만들어둔 통계 JSON 로드
try:
    with open('data/render_stats.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
except FileNotFoundError:
    print("❌ render_stats.json이 없습니다. 먼저 generate_stats.py를 실행하세요.")
    exit(1)

# 2. Jinja2 템플릿 환경 설정
env = Environment(loader=FileSystemLoader('templates'))
template = env.get_template('index.html')

# 3. HTML 렌더링
html_output = template.render(
    crew_stats=data['crew_stats'],
    member_stats=data['member_stats']
)

# 4. docs 폴더를 만들고, 배포용 index.html 파일 저장 (수정된 부분!)
os.makedirs('docs', exist_ok=True)
with open('docs/index.html', 'w', encoding='utf-8') as f:
    f.write(html_output)

print("✅ 성공적으로 docs/index.html 웹페이지가 구워졌습니다!")
