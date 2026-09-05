"""
'매치 목록'과 '매치 전적(라운드)' 시트에는 같은 날 같은 상대와 여러 번 붙었을 때
이를 구분할 별도의 '회차' 컬럼이 없다. (예: 연합팀과 하루에 CK를 2~3번 치른 경우)

이 모듈은 시트에 기록된 순서를 기준으로 각 매치/라운드에 고유한 매치 순번을 부여해서,
같은 (날짜, 상대팀)이라도 서로 다른 경기의 라운드가 섞이지 않도록 한다.

- 매치: (날짜, 상대팀)별로 등장 순서대로 0, 1, 2... 순번 부여
- 라운드: 같은 (날짜, 상대팀) 안에서 '라운드' 번호가 이전 값보다 낮아지는 지점
  (예: 4라 -> 1라)을 새 경기의 시작으로 판단해 같은 방식으로 순번 부여

두 순번이 시트 입력 순서상 서로 대응한다는 가정 하에 동작하는 임시방편이며,
'매치 목록'/'매치 전적' 시트에 정식 회차 컬럼이 추가되면 이 로직은 필요 없어진다.

* '형식'은 이제 '매치 전적' 시트에 자체 컬럼으로 들어오므로, 라운드에 값이 있으면
  그대로 신뢰해서 쓴다. 매치와 매칭해 형식을 채우는 건 그 값이 비어 있는
  (컬럼 추가 이전의) 과거 데이터를 위한 fallback으로만 남겨둔다.
"""


def _extract_round_num(round_str):
    try:
        return int(str(round_str).replace('라', '').strip())
    except (TypeError, ValueError):
        return None


def link_rounds_to_matches(matches, rounds):
    """matches, rounds(dict 리스트)를 받아 각 항목에 '_match_key'를 붙이고,
    라운드에 '형식'이 비어 있으면 대응하는 매치의 '형식'으로 채워서
    (matches_copy, rounds_copy)로 반환한다. 라운드에 '형식'이 이미 있으면 그대로 둔다."""
    matches = [dict(m) for m in matches]
    rounds = [dict(r) for r in rounds]

    # 1. 매치에 순번 부여
    match_seq_counter = {}
    match_by_key = {}
    for m in matches:
        key = (m.get('날짜'), m.get('상대팀'))
        seq = match_seq_counter.get(key, 0)
        match_seq_counter[key] = seq + 1
        m_key = f"{key[0]}__{key[1]}__{seq}"
        m['_match_key'] = m_key
        match_by_key[m_key] = m

    # 2. 라운드에 순번 부여 (라운드 번호 리셋 지점을 새 경기 시작으로 판단)
    round_seq_counter = {}
    last_round_num = {}
    for r in rounds:
        key = (r.get('날짜'), r.get('상대팀'))
        num = _extract_round_num(r.get('라운드'))
        seq = round_seq_counter.get(key, 0)
        prev_num = last_round_num.get(key)
        if prev_num is not None and num is not None and num <= prev_num:
            seq += 1
            round_seq_counter[key] = seq
        last_round_num[key] = num

        m_key = f"{key[0]}__{key[1]}__{seq}"
        r['_match_key'] = m_key

        # 라운드 자체에 형식 값이 없을 때만 매치에서 유추해서 채운다 (fallback)
        existing_fmt = str(r.get('형식', '')).strip()
        if not existing_fmt:
            matched = match_by_key.get(m_key)
            r['형식'] = matched.get('형식', '') if matched else ''

    return matches, rounds

