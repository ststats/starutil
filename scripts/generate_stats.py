import json
import os
import pandas as pd

# 1. db.json 불러오기
try:
    with open('data/db.json', 'r', encoding='utf-8') as f:
        db = json.load(f)
except FileNotFoundError:
    print("❌ data/db.json 파일을 찾을 수 없습니다. update_data.py를 먼저 실행하세요.")
    exit(1)

# 리스트 딕셔너리를 Pandas DataFrame으로 변환
df_matches = pd.DataFrame(db.get('matches', []))
df_rounds = pd.DataFrame(db.get('rounds', []))
df_settings = pd.DataFrame(db.get('settings', []))

# 날짜 포맷팅 및 정렬
df_settings['날짜'] = pd.to_datetime(df_settings['날짜'])
df_settings = df_settings.sort_values('날짜')
df_matches['날짜'] = pd.to_datetime(df_matches['날짜'], errors='coerce')
df_rounds['날짜'] = pd.to_datetime(df_rounds['날짜'], errors='coerce')

# 2. 시즌 판별 함수
def get_season(date_val):
    if pd.isna(date_val): return "전체"
    valid_seasons = df_settings[df_settings['날짜'] <= date_val]
    if len(valid_seasons) > 0:
        return valid_seasons.iloc[-1]['시즌']
    return "이전"

df_matches['시즌'] = df_matches['날짜'].apply(get_season)
df_rounds['시즌'] = df_rounds['날짜'].apply(get_season)

# 라운드 데이터에 매치 '형식' 결합 (대회, CK 등)
match_info = df_matches[['날짜', '상대팀', '형식']].drop_duplicates()
df_rounds = pd.merge(df_rounds, match_info, on=['날짜', '상대팀'], how='left')

# 3. 승패 텍스트 포맷팅 헬퍼
def fmt_wl(wins, losses):
    total = wins + losses
    if total == 0: return "-"
    return f"{int(wins)}승 {int(losses)}패"

def fmt_wl_rate(wins, losses):
    total = wins + losses
    if total == 0: return "-"
    return f"{int(wins)}승 {int(losses)}패 ({wins/total*100:.1f}%)"

# ==========================================
# 🏆 [크루표 통계 산출]
# ==========================================
def build_crew_stats():
    crew_result = {}
    seasons = ["전체"] + df_settings['시즌'].tolist()
    
    for season in seasons:
        df = df_matches.copy()
        if season != "전체":
            df = df[df['시즌'] == season]
            
        season_stats = []
        for team, group in df.groupby('상대팀'):
            team_data = {'상대': team}
            
            # 형식별 승패 (대회, 대학, 미니, CK)
            for fmt in ['대회', '대학', '미니', 'CK']:
                fmt_group = group[group['형식'] == fmt]
                wins = (fmt_group['최종 결과'] == '승').sum()
                losses = (fmt_group['최종 결과'] == '패').sum()
                team_data[f'{fmt} 전적'] = fmt_wl(wins, losses)
                
            # 자금 정보 계산 (숫자가 없는 경우 0 처리)
            funding = pd.to_numeric(group['펀딩'], errors='coerce').sum()
            support = pd.to_numeric(group['지원금'], errors='coerce').sum()
            sabi = pd.to_numeric(group['사비'], errors='coerce').sum()
            
            team_data['상금/펀딩'] = f"{funding:,.0f}" if funding > 0 else "-"
            team_data['상금/지원금'] = f"{support:,.0f}" if support > 0 else "-"
            team_data['사비'] = f"{sabi:,.0f}" if sabi > 0 else "-"
            
            season_stats.append(team_data)
            
        crew_result[season] = season_stats
    return crew_result

# ==========================================
# 🥇 [멤버표 통계 산출]
# ==========================================
def build_member_stats():
    member_result = {}
    seasons = ["전체"] + df_settings['시즌'].tolist()
    
    for season in seasons:
        df = df_rounds.copy()
        if season != "전체":
            df = df[df['시즌'] == season]
            
        season_stats = []
        for player, group in df.groupby('우리 선수'):
            if pd.isna(player) or str(player).strip() == "": continue
            
            player_data = {'이름': str(player).strip()}
            
            # 1. 형식별 전적
            for fmt in ['대회', '대학', '미니', 'CK']:
                fmt_group = group[group['형식'] == fmt]
                wins = (fmt_group['승패'] == '승').sum()
                losses = (fmt_group['승패'] == '패').sum()
                player_data[f'{fmt} 전적'] = fmt_wl_rate(wins, losses)
                
            # 2. 종족전 전적 (T, Z, P)
            for race, col_name in [('T', '테란전'), ('Z', '저그전'), ('P', '프로토스전')]:
                race_group = group[group['상대 종족'].str.upper() == race]
                wins = (race_group['승패'] == '승').sum()
                losses = (race_group['승패'] == '패').sum()
                player_data[f'{col_name} 전적'] = fmt_wl_rate(wins, losses)
                
            # 3. 맵 전적 (최다 플레이 맵 3개만 추출)
            map_stats = group.groupby('맵')['승패'].value_counts().unstack(fill_value=0)
            if '승' not in map_stats: map_stats['승'] = 0
            if '패' not in map_stats: map_stats['패'] = 0
            map_stats['총전적'] = map_stats['승'] + map_stats['패']
            
            # 많이 한 맵 순으로 정렬
            top_maps = map_stats.sort_values('총전적', ascending=False).head(3)
            map_strings = [f"{m}({r['승']}승{r['패']}패)" for m, r in top_maps.iterrows()]
            player_data['맵 전적'] = " · ".join(map_strings) if map_strings else "-"
            
            # 4. 최다 상대 전적 (가장 많이 만난 상대 3명)
            opp_stats = group.groupby('상대 선수')['승패'].value_counts().unstack(fill_value=0)
            if '승' not in opp_stats: opp_stats['승'] = 0
            if '패' not in opp_stats: opp_stats['패'] = 0
            opp_stats['총전적'] = opp_stats['승'] + opp_stats['패']
            
            top_opps = opp_stats.sort_values('총전적', ascending=False).head(3)
            opp_strings = [f"{opp}({r['승']}승{r['패']}패)" for opp, r in top_opps.iterrows()]
            player_data['상대전적'] = " · ".join(opp_strings) if opp_strings else "-"
            
            season_stats.append(player_data)
            
        member_result[season] = season_stats
    return member_result

# 4. 집계 및 JSON 저장
print("통계 데이터를 집계 중입니다...")
crew_data = build_crew_stats()
member_data = build_member_stats()

# 프론트엔드가 바로 쓸 수 있도록 렌더링용 json 생성
render_data = {
    "crew_stats": crew_data,
    "member_stats": member_data
}

with open('data/render_stats.json', 'w', encoding='utf-8') as f:
    json.dump(render_data, f, ensure_ascii=False, indent=2)

print("✅ 통계 산출 완료! data/render_stats.json에 저장되었습니다.")