
    let currentPlayer = ''; 
    let currentIndivFilter = '전체';

    // 구글시트 원본 텍스트를 innerHTML에 꽂을 때 깨지거나 마크업이 섞이지 않도록 이스케이프
    function escapeHTML(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag]));
    }

    // 상대팀 로고: docs/images/{팀이름}.webp 로 관리. '내전'(자체 스크림)은
    // 상대가 우리 팀 자신이므로 캄몬스타즈.webp를 대신 쓴다. 로고 파일이
    // 없는 팀도 있을 수 있어 onerror로 조용히 숨긴다.
    function teamLogoHtml(teamName, sizePx) {
        const name = String(teamName || '').trim();
        if (!name) return '';
        const fileName = (name === '내전') ? '캄몬스타즈' : name;
        const size = sizePx || 16;
        return `<img src="images/${encodeURIComponent(fileName)}.webp" alt="" class="team-logo-icon" style="width:${size}px;height:${size}px;" onerror="this.remove();">`;
    }

    function switchPage(pageId) {
        document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('#mainMenu .nav-item').forEach(el => el.classList.remove('active'));
        document.getElementById('page-' + pageId).classList.add('active');

        const targetNav = document.querySelector(`#mainMenu .nav-item[data-page="${pageId}"]`);
        if (targetNav) targetNav.classList.add('active');
    }

    function switchStatView(viewType) {
        document.getElementById('tab-team').classList.toggle('active', viewType === 'team');
        document.getElementById('tab-individual').classList.toggle('active', viewType === 'individual');

        if(viewType === 'team') {
            document.getElementById('view-team-stat').style.display = 'block';
            document.getElementById('view-indiv-stat').style.display = 'none';
        } else {
            document.getElementById('view-team-stat').style.display = 'none';
            document.getElementById('view-indiv-stat').style.display = 'block';
            renderIndividualSidebar();
            showIndivSummary(); 
        }
    }

    function switchMemberView(viewType) {
        document.getElementById('tab-member-status').classList.toggle('active', viewType === 'status');
        document.getElementById('tab-member-news').classList.toggle('active', viewType === 'news');
        document.getElementById('view-member-status').style.display = viewType === 'status' ? 'block' : 'none';
        document.getElementById('view-member-news').style.display = viewType === 'news' ? 'block' : 'none';
    }

    function toggleIndivSidebar(open) {
        document.getElementById('indivSidebarPanel').classList.toggle('mobile-open', open);
        document.getElementById('indivSidebarBackdrop').classList.toggle('show', open);
    }

    function parseStat(statStr) {
        if (!statStr || statStr === "-") return { wins: 0, losses: 0, rate: 0, text: "-" };
        const match = statStr.match(/(\d+)승 (\d+)패/);
        if (match) {
            const w = parseInt(match[1]), l = parseInt(match[2]);
            return { wins: w, losses: l, rate: (w+l) > 0 ? (w/(w+l)*100) : 0, text: `${w}승 ${l}패` };
        }
        return { wins: 0, losses: 0, rate: 0, text: "-" };
    }
    function getRateText(w, l) { return (w+l) > 0 ? (w/(w+l)*100).toFixed(1) + "%" : "-"; }
    function updateDonut(elId, txtId, subId, stat, color) {
        document.getElementById(txtId).innerText = stat.text === "-" ? "-" : stat.rate.toFixed(1) + "%";
        document.getElementById(subId).innerText = stat.text;
        document.getElementById(elId).style.background = `conic-gradient(${color} ${stat.rate}%, #eee 0)`;
    }

    function calculateTeamSummaries() {
        let tStats = { '대회': {w:0, l:0}, '대학': {w:0, l:0}, '미니': {w:0, l:0}, 'CK': {w:0, l:0} };
        dbMatches.forEach(m => {
            if (tStats[m['형식']] && m['최종 결과']) {
                if (m['최종 결과'] === '승') tStats[m['형식']].w++;
                if (m['최종 결과'] === '패') tStats[m['형식']].l++;
            }
        });
        for (let fmt in tStats) {
            document.getElementById(`t-sum-${fmt}-w`).innerText = `${tStats[fmt].w}승 ${tStats[fmt].l}패`;
            document.getElementById(`t-sum-${fmt}-r`).innerText = getRateText(tStats[fmt].w, tStats[fmt].l);
        }
        renderTeamMatchesList('team-recent-list', {format: '전체'}, 10);
    }

    function renderTeamMatchesList(containerId, filters, limit) {
        filters = filters || {};
        const format = filters.format || '전체';
        const opponent = filters.opponent || null;

        let filtered = format === '전체' ? dbMatches : dbMatches.filter(m => m['형식'] === format);
        if (opponent) filtered = filtered.filter(m => m['상대팀'] === opponent);
        const sliced = limit ? filtered.slice(0, limit) : filtered;
        
        if (sliced.length === 0) {
            document.getElementById(containerId).innerHTML = '<div class="text-center text-muted py-4">경기 기록이 없습니다.</div>';
            return;
        }

        const html = sliced.map((m, idx) => {
            let resText = m['최종 결과'] || m['최근 결과'] || '';
            let badgeHtml = '<span class="match-badge badge-lose">LOSE</span>';
            if (resText === '승') badgeHtml = '<span class="match-badge badge-win">WIN</span>';
            else if (resText === '무' || resText === '무승부') badgeHtml = '<span class="match-badge badge-draw">DRAW</span>';

            const collapseId = `collapse-${containerId}-${idx}`;
            // _match_key가 있으면 그걸로 정확히 매칭(같은 날 여러 경기 구분), 없을 때만 날짜+상대팀으로 대체
            // 내전 라운드는 개인 통계용으로 반대편 관점의 '미러' 라운드가 추가돼 있으므로
            // (match_link.py 참고) 세트별 상세보기에는 원본 한 줄만 보이도록 걸러낸다.
            const teamRounds = dbRounds.filter(r => {
                if (r['_mirrored']) return false;
                if (m['_match_key'] && r['_match_key']) return r['_match_key'] === m['_match_key'];
                return r['날짜'] === m['날짜'] && r['상대팀'] === m['상대팀'];
            });
            
            let setDetailsHtml = '';
            if (teamRounds.length > 0) {
                setDetailsHtml = teamRounds.map((r, i) => {
                    const isWin = r['결과'] === '승';
                    const isDraw = r['결과'] === '무' || r['결과'] === '무승부';
                    let resBadge = '<span class="text-danger fw-bold">패</span>';
                    if(isWin) resBadge = '<span class="text-primary fw-bold">승</span>';
                    if(isDraw) resBadge = '<span class="text-secondary fw-bold">무</span>';

                    return `
                    <div class="d-flex align-items-center justify-content-center py-2" style="font-size:var(--fs-body); border-bottom:1px solid #f1f3f5; min-width: 500px;">
                        <div style="width:70px; font-weight:800; color:#888; white-space:nowrap;">${escapeHTML(r['세트']) || ''} ${escapeHTML(r['라운드']) || (i+1) + '라'}</div>
                        <div style="width:100px; text-align:center; color:#555;">${escapeHTML(r['맵']) || '-'}</div>
                        <div style="width:90px; text-align:right;" class="fw-bold ${isWin?'text-primary':'text-dark'}">${escapeHTML(r['우리 선수'])||'-'}</div>
                        <div style="width:50px; text-align:center;">${resBadge}</div>
                        <div style="width:90px; text-align:left;" class="fw-bold ${!isWin && !isDraw ?'text-primary':'text-dark'}">${escapeHTML(r['상대 선수'])||'-'}</div>
                    </div>`;
                }).join('');
            } else {
                setDetailsHtml = '<div class="text-center text-muted py-2" style="font-size:var(--fs-body);">상세 세트 기록이 없습니다.</div>';
            }

            return `
            <div class="match-item-wrap">
                <div class="match-row" data-bs-toggle="collapse" data-bs-target="#${collapseId}">
                    <div class="m-date">${m['날짜'] ? m['날짜'].split(' ')[0].substring(2) : ''}</div>
                    <div class="m-type"><span class="tag-badge">${escapeHTML(m['형식'])}</span></div>
                    <div class="m-opp-team">${teamLogoHtml(m['상대팀'])}${escapeHTML(m['상대팀'])}</div>
                    <div class="m-score">${m['세트 결과'] || '-'}</div>
                    <div class="m-res">${badgeHtml}</div>
                    <div class="m-arrow">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                </div>
                <div class="collapse" id="${collapseId}">
                    <div class="px-4 py-2" style="background-color:#fcfcfd; border-top:1px dashed #eaedf2;">
                        ${setDetailsHtml}
                    </div>
                </div>
            </div>
            `;
        }).join('');
        document.getElementById(containerId).innerHTML = html;
    }

    function openTeamMatchModal(format) {
        document.getElementById('teamModalTitle').innerText = format === '전체' ? '팀 전체 전적' : `팀 ${format} 전적`;
        renderTeamMatchesList('team-modal-list', {format}, null);
        new bootstrap.Modal(document.getElementById('teamMatchesModal')).show();
    }

    function openTeamOpponentModal(opponent) {
        document.getElementById('teamModalTitle').innerHTML = `${teamLogoHtml(opponent, 20)} vs ${escapeHTML(opponent)} 전체 전적`;
        renderTeamMatchesList('team-modal-list', {format: '전체', opponent}, null);
        new bootstrap.Modal(document.getElementById('teamMatchesModal')).show();
    }
    document.addEventListener('click', function(e) {
        const row = e.target.closest('.team-row-clickable');
        if (row) openTeamOpponentModal(row.dataset.team);
    });

    function getProfileImgUrl(soopId) {
        if (!soopId) return null;
        const id = String(soopId).trim().toLowerCase();
        // SOOP 아이디는 영문/숫자/일부 특수문자만 쓰이므로, 형식이 이상한 값은 URL/속성에 꽂지 않고 무시
        if (!id || !/^[a-z0-9_-]+$/.test(id)) return null;
        const prefix = id.substring(0, 2);
        return `https://profile.img.sooplive.co.kr/LOGO/${prefix}/${id}/${id}.jpg`;
    }
    function avatarHtml(soopId, cls) {
        const url = getProfileImgUrl(soopId);
        if (!url) return `<span class="${cls} d-flex align-items-center justify-content-center">👤</span>`;
        return `<img src="${url}" class="${cls}" onerror="this.outerHTML='<span class=\\'${cls} d-flex align-items-center justify-content-center\\'>👤</span>';">`;
    }

    // 멤버 탭 렌더링
    const TIER_ORDER = ['갓','킹','잭','조커','스페이드','0','1','2','3','4','5','6','7','8','베이비'];
    function tierIndex(tier) {
        const idx = TIER_ORDER.indexOf(String(tier));
        return idx === -1 ? TIER_ORDER.length : idx;
    }
    function raceShortLabel(race) {
        if (!race) return '-';
        if (race.includes('테란')) return 'T';
        if (race.includes('저그')) return 'Z';
        if (race.includes('프로토스')) return 'P';
        return race;
    }
    function isActiveMember(m) {
        return !m['퇴단일'] || String(m['퇴단일']).trim() === '';
    }
    function todayStr() {
        return new Date().toISOString().split('T')[0];
    }
    function daysBetween(startStr, endStr) {
        if (!startStr || !endStr) return null;
        const start = new Date(startStr);
        const end = new Date(endStr);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
        return Math.floor((end - start) / 86400000) + 1;
    }
    function memberCardHtml(m) {
        const tierText = (m['티어'] !== undefined && m['티어'] !== '') ? `${m['티어']}티어` : '-';
        return `
        <div class="member-card${isActiveMember(m) ? '' : ' former'}" onclick="openMemberProfile('${m['이름']}')">
            ${avatarHtml(m['SOOP ID'], 'member-avatar-img')}
            <div class="member-card-name">${escapeHTML(m['이름'])}</div>
            <div class="member-card-tags">
                <span class="tag-badge">${tierText}</span>
                <span class="tag-badge">${raceShortLabel(m['종족'])}</span>
            </div>
        </div>`;
    }
    function renderMemberGroup(title, members, opts) {
        opts = opts || {};
        if (members.length === 0) return '';
        const sorted = [...members].sort((a, b) =>
            tierIndex(a['티어']) - tierIndex(b['티어']) || String(a['이름']).localeCompare(String(b['이름']), 'ko'));

        const countHtml = `<span class="text-secondary" style="font-size:var(--fs-body); font-weight:600;">${sorted.length}명</span>`;

        if (opts.collapseId) {
            const startClosed = !!opts.startClosed;
            return `
            <div class="section-title${startClosed ? ' collapsed' : ''}" style="cursor:pointer;" role="button" data-bs-toggle="collapse" data-bs-target="#${opts.collapseId}">
                <span>${escapeHTML(title)} ${countHtml}</span>
                <svg class="section-title-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
            <div class="collapse${startClosed ? '' : ' show'}" id="${opts.collapseId}">
                <div class="member-grid mb-4">${sorted.map(memberCardHtml).join('')}</div>
            </div>`;
        }

        return `
        <div class="section-title">${escapeHTML(title)} ${countHtml}</div>
        <div class="member-grid mb-4">${sorted.map(memberCardHtml).join('')}</div>`;
    }
    function renderMembersPage() {
        const roleOrderBase = ['감독', '코치', '선수'];
        const activeMembers = dbMembers.filter(isActiveMember);
        const formerMembers = dbMembers.filter(m => !isActiveMember(m));
        const allRoles = [...new Set(activeMembers.map(m => m['직책'] || '기타'))];
        const extraRoles = allRoles.filter(r => !roleOrderBase.includes(r));
        const roleOrder = [...roleOrderBase, ...extraRoles];

        let html = '';
        roleOrder.forEach(role => {
            const group = activeMembers.filter(m => (m['직책'] || '기타') === role);
            html += renderMemberGroup(role, group);
        });
        html += renderMemberGroup('이전 멤버', formerMembers, { collapseId: 'former-members-collapse', startClosed: true });

        document.getElementById('members-groups').innerHTML = html || '<div class="text-center text-muted py-5">등록된 멤버가 없습니다.</div>';
    }

    // 홈 화면 - 현재 방송중 목록.
    // 참고 프로젝트(ststats)의 개인페이지 패턴 그대로: bjapi.afreecatv.com을
    // 브라우저에서 직접 fetch한다 (CORS 허용됨, 확인됨). 활성 멤버가 소수라
    // 프록시/백엔드 배치 작업 없이 페이지 로드 시점에 병렬로 바로 체크한다 -
    // 그래서 워크플로를 몇 분마다 돌릴 필요가 없고, 열 때마다 최신 상태.
    async function checkIsLiveRealtime(soopId) {
        try {
            const res = await fetch(`https://bjapi.afreecatv.com/api/${soopId}/station`);
            if (!res.ok) return null;
            const data = await res.json();
            if (!data || !data.broad) return null;
            return {
                broad: data.broad,
                broadStart: (data.station && data.station.broad_start) || null,
            };
        } catch (e) {
            return null;
        }
    }

    function formatLiveElapsed(broadStart) {
        if (!broadStart) return '';
        const startDate = new Date(String(broadStart).replace(' ', 'T'));
        if (isNaN(startDate.getTime())) return '';
        const elapsedSec = Math.max(0, Math.floor((Date.now() - startDate.getTime()) / 1000));
        const eh = Math.floor(elapsedSec / 3600);
        const em = Math.floor((elapsedSec % 3600) / 60);
        return (eh > 0 ? `${eh}시간 ${em}분` : `${em}분`) + ' 방송중';
    }

    async function renderLiveBroadcasts() {
        const container = document.getElementById('home-live-broadcast');
        const activeMembers = dbMembers.filter(m => {
            if (!isActiveMember(m)) return false;
            const soopId = m['SOOP ID'];
            return soopId && /^[a-zA-Z0-9_-]+$/.test(String(soopId).trim());
        });

        if (activeMembers.length === 0) {
            container.innerHTML = `<div class="text-center text-muted py-4" style="font-size:var(--fs-body);">현재 방송 중인 멤버가 없습니다.</div>`;
            return;
        }

        container.innerHTML = `<div class="text-center text-muted py-4" style="font-size:var(--fs-body);">방송 상태 확인 중...</div>`;

        const settled = await Promise.allSettled(
            activeMembers.map(m => checkIsLiveRealtime(m['SOOP ID']).then(live => ({ member: m, live })))
        );
        const liveList = settled
            .filter(r => r.status === 'fulfilled' && r.value.live)
            .map(r => r.value);

        if (liveList.length === 0) {
            container.innerHTML = `<div class="text-center text-muted py-4" style="font-size:var(--fs-body);">현재 방송 중인 멤버가 없습니다.</div>`;
            return;
        }

        container.innerHTML = `<div class="live-broadcast-grid">${liveList.map(({ member: m, live }) => {
            const { broad, broadStart } = live;
            const soopId = m['SOOP ID'];
            const viewerText = broad.current_sum_viewer != null ? broad.current_sum_viewer.toLocaleString('ko-KR') + '명' : '-';
            const elapsedText = formatLiveElapsed(broadStart) || '-';

            return `
            <a class="live-broadcast-card" href="https://play.sooplive.co.kr/${encodeURIComponent(soopId)}" target="_blank" rel="noopener">
                <div class="live-thumb-wrap">
                    <img class="live-thumb" src="https://liveimg.sooplive.co.kr/m/${broad.broad_no}" alt="방송 화면" onerror="this.style.display='none';">
                    <span class="live-badge">LIVE</span>
                </div>
                <div class="live-card-body">
                    <div class="live-card-title">${escapeHTML(broad.broad_title || '')}</div>
                    <div class="live-card-meta-row">
                        <div class="live-card-who">
                            ${avatarHtml(soopId, 'live-card-avatar')}
                            <span class="live-card-name">${escapeHTML(m['이름'])}</span>
                        </div>
                        <div class="live-card-stats">
                            <div class="live-card-viewers">${escapeHTML(viewerText)}</div>
                            <div class="live-card-elapsed">${escapeHTML(elapsedText)}</div>
                        </div>
                    </div>
                </div>
            </a>`;
        }).join('')}</div>`;
    }

    // ===== 홈 화면 - 최신 공지 =====
    // SOOP 채널 게시판 API를 브라우저에서 직접 fetch한다 (방송중 체크와 같은 방식).
    // 응답의 noticeData가 실제로 '공지' 처리된 글들이고(noticeYn:2), 최신순으로 정렬돼 온다.
    async function fetchLatestNotice(soopId) {
        try {
            const url = `https://api-channel.sooplive.com/v1.1/channel/${soopId}/board?perPage=20`;
            const res = await fetch(url);
            if (!res.ok) return null;
            const data = await res.json();
            return (data.noticeData && data.noticeData[0]) || null;
        } catch (e) {
            return null;
        }
    }

    async function renderLatestNotices() {
        const container = document.getElementById('home-notice-list');
        const activeMembers = dbMembers.filter(m => {
            if (!isActiveMember(m)) return false;
            const soopId = m['SOOP ID'];
            return soopId && /^[a-zA-Z0-9_-]+$/.test(String(soopId).trim());
        });

        if (activeMembers.length === 0) {
            container.innerHTML = `<div class="text-center text-muted py-4" style="font-size:var(--fs-body);">최근 공지가 없습니다.</div>`;
            return;
        }

        const settled = await Promise.allSettled(
            activeMembers.map(m => fetchLatestNotice(m['SOOP ID']).then(notice => ({ member: m, notice })))
        );

        const withNotice = settled
            .filter(r => r.status === 'fulfilled' && r.value.notice)
            .map(r => r.value)
            .sort((a, b) => new Date(b.notice.regDate) - new Date(a.notice.regDate));

        if (withNotice.length === 0) {
            container.innerHTML = `<div class="text-center text-muted py-4" style="font-size:var(--fs-body);">최근 공지가 없습니다.</div>`;
            return;
        }

        container.innerHTML = withNotice.slice(0, 8).map(({ member: m, notice }) => {
            const soopId = m['SOOP ID'];
            const title = notice.titleName || '(제목 없음)';
            const snippet = (notice.content && (notice.content.textContent || notice.content.summary)) || '';
            const dateText = (notice.regDate || '').split(' ')[0];

            return `
            <a class="notice-row" href="https://www.sooplive.com/station/${encodeURIComponent(soopId)}" target="_blank" rel="noopener">
                ${avatarHtml(soopId, 'notice-row-avatar')}
                <div class="notice-row-body">
                    <div class="notice-row-top">
                        <span class="notice-row-name">${escapeHTML(m['이름'])}</span>
                        <span class="notice-row-date">${escapeHTML(dateText)}</span>
                    </div>
                    <div class="notice-row-title">${escapeHTML(title)}</div>
                    <div class="notice-row-snippet">${escapeHTML(snippet)}</div>
                </div>
            </a>`;
        }).join('');
    }

    function openMemberProfile(name) {
        const m = dbMembers.find(x => x['이름'] === name);
        if (!m) return;

        document.getElementById('mp-name').innerText = name;
        document.getElementById('mp-role-badge').innerText = m['직책'] || '미정';
        document.getElementById('mp-race-badge').innerText = raceShortLabel(m['종족']);
        document.getElementById('mp-tier-badge').innerText = (m['티어'] !== undefined && m['티어'] !== '') ? `${m['티어']}티어` : '티어 미정';

        const avatarUrl = getProfileImgUrl(m['SOOP ID']);
        const avatarEl = document.getElementById('mp-avatar');
        avatarEl.innerHTML = avatarUrl
            ? `<img src="${avatarUrl}" onerror="this.parentElement.innerHTML='👤';">`
            : '👤';

        const active = isActiveMember(m);
        const days = m['입단일'] ? daysBetween(m['입단일'], active ? todayStr() : (m['퇴단일'] || null)) : null;
        const daysLabel = days !== null ? ` (${days}일${active ? '째' : ''})` : '';
        const period = m['입단일'] ? `${m['입단일']} ~ ${active ? '현재' : (m['퇴단일'] || '-')}${daysLabel}` : '-';
        const soopId = m['SOOP ID'];
        const isValidSoopId = soopId && /^[a-zA-Z0-9_-]+$/.test(String(soopId).trim());
        const broadcast = isValidSoopId
            ? `<a href="https://www.sooplive.com/station/${encodeURIComponent(String(soopId).trim())}" target="_blank" rel="noopener" style="display:inline-flex; align-items:center;">
                   <img src="images/숲로고.webp" alt="SOOP" style="width:20px; height:20px; border-radius:4px; object-fit:contain;">
               </a>`
            : '-';

        const rows = [
            ['성별', escapeHTML(m['성별']) || '-'],
            ['생년월일', escapeHTML(m['생년월일']) || '-'],
            ['MBTI', escapeHTML(m['MBTI']) || '-'],
            ['활동기간', period],
            ['방송국', broadcast],
        ];
        document.getElementById('mp-info-body').innerHTML = rows.map(([label, val]) => `
            <tr>
                <td class="text-secondary" style="width:90px; font-weight:700; border-color:#f1f3f5; padding-left:0;">${label}</td>
                <td class="fw-bold text-dark" style="border-color:#f1f3f5;">${val}</td>
            </tr>`).join('');

        renderMemberActivitySummary(m);

        new bootstrap.Modal(document.getElementById('memberProfileModal')).show();
    }

    // 프로필 팝업의 "이번 달 방송 활동"을 시너지표(ststats)에서 가져온 데이터로 채운다.
    function renderMemberActivitySummary(m) {
        const statusEl = document.getElementById('mp-activity-status');
        const balloonsEl = document.getElementById('mp-balloons');
        const hoursEl = document.getElementById('mp-broadcast-hours');
        const viewersEl = document.getElementById('mp-viewers');
        const sponsorEl = document.getElementById('mp-sponsor-record');

        if (!synergyData) {
            statusEl.innerText = '데이터 불러오는 중';
            balloonsEl.innerText = '-';
            hoursEl.innerText = '-';
            viewersEl.innerText = '-';
            sponsorEl.innerText = '-';
            return;
        }

        const soopId = String(m['SOOP ID'] || '').trim().toLowerCase();
        const entry = synergyData.find(s => String(s.id || '').trim().toLowerCase() === soopId);

        if (!entry) {
            statusEl.innerText = '데이터 없음';
            balloonsEl.innerText = '-';
            hoursEl.innerText = '-';
            viewersEl.innerText = '-';
            sponsorEl.innerText = '-';
            return;
        }

        statusEl.innerText = '';
        balloonsEl.innerText = (entry.balloons || 0).toLocaleString('ko-KR') + '개';
        hoursEl.innerText = formatSecondsToHM(entry.broadcast_seconds);
        viewersEl.innerText = (entry.cumulative_viewers || 0).toLocaleString('ko-KR') + '명';
        sponsorEl.innerText = formatSponsorRecord(entry.sponsor_wins, entry.sponsor_losses);
    }

    function renderIndividualSidebar() {
        const activeHtml = [], formerHtml = [];
        dbMembers.forEach(m => {
            const html = `<div class="player-item" id="side-player-${m['이름']}" onclick="selectPlayer('${m['이름']}')">
                            <span>${escapeHTML(m['이름'])}</span> <span class="item-sub">${escapeHTML(m['종족'])||''}</span>
                          </div>`;
            if(!m['퇴단일'] || m['퇴단일'].trim() === '') activeHtml.push(html);
            else formerHtml.push(html);
        });
        document.getElementById('active-player-list').innerHTML = activeHtml.join('');
        document.getElementById('former-player-list').innerHTML = formerHtml.join('');
    }

    function showIndivSummary() {
        currentPlayer = '';
        toggleIndivSidebar(false);
        document.getElementById('statContent').style.display = 'none';
        document.getElementById('indiv-summary-content').style.display = 'block';
        
        document.querySelectorAll('.player-item').forEach(el => el.classList.remove('active'));
        document.getElementById('side-btn-summary').classList.add('active');

        const activeMembers = dbMembers.filter(m => !m['퇴단일'] || m['퇴단일'].trim() === '');
        let html = '';
        activeMembers.forEach(m => {
            const pStat = playersStats.find(x => x['이름'] === m['이름']) || {};
            const name = m['이름'];
            html += `<tr style="border-bottom:1px solid #f1f3f5; cursor:pointer;" onclick="selectPlayer('${name}')">
                <td class="fw-bold text-dark"><span class="d-flex align-items-center justify-content-center gap-2">${avatarHtml(m['SOOP ID'], 'player-avatar-sm')}${escapeHTML(name)}</span></td>
                <td>${pStat['대회 전적'] || '-'}</td>
                <td>${pStat['대학 전적'] || '-'}</td>
                <td>${pStat['미니 전적'] || '-'}</td>
                <td>${pStat['CK 전적'] || '-'}</td>
            </tr>`;
        });
        document.getElementById('indiv-summary-tbody').innerHTML = html;
    }

    function selectPlayer(name) {
        currentPlayer = name;
        toggleIndivSidebar(false);
        document.getElementById('indiv-summary-content').style.display = 'none';
        document.getElementById('statContent').style.display = 'block';

        document.querySelectorAll('.player-item').forEach(el => el.classList.remove('active'));
        document.getElementById('side-btn-summary').classList.remove('active');
        const sideItem = document.getElementById(`side-player-${name}`);
        if(sideItem) sideItem.classList.add('active');

        const pStat = playersStats.find(x => x['이름'] === name) || {};
        const pDb = dbMembers.find(x => x['이름'] === name) || {};

        document.getElementById('p-name').innerText = name;
        document.getElementById('p-tier').innerText = (pDb['티어'] || pDb['입단 티어'] || pDb['직책'] || '미정') + (pDb['직책'] === '선수' ? ' 티어' : '');
        document.getElementById('p-race').innerText = pDb['종족'] || '종족 미정';

        const avatarUrl = getProfileImgUrl(pDb['SOOP ID']);
        const avatarEl = document.getElementById('p-avatar');
        if (avatarUrl) {
            avatarEl.innerHTML = `<img src="${avatarUrl}" onerror="this.parentElement.innerHTML='👤';">`;
        } else {
            avatarEl.innerHTML = '👤';
        }

        updateDonut('d-fmt-1', 'dt-fmt-1', 'dw-fmt-1', parseStat(pStat['대회 전적']), 'var(--color-primary)');
        updateDonut('d-fmt-2', 'dt-fmt-2', 'dw-fmt-2', parseStat(pStat['대학 전적']), 'var(--color-primary)');
        updateDonut('d-fmt-3', 'dt-fmt-3', 'dw-fmt-3', parseStat(pStat['미니 전적']), 'var(--color-primary)');

        updateDonut('d-race-t', 'dt-race-t', 'dw-race-t', parseStat(pStat['테란전 전적']), '#1976d2');
        updateDonut('d-race-z', 'dt-race-z', 'dw-race-z', parseStat(pStat['저그전 전적']), '#7b1fa2');
        updateDonut('d-race-p', 'dt-race-p', 'dw-race-p', parseStat(pStat['프로토스전 전적']), '#f57f17');

        renderIndivMatchesList('indiv-recent-list', currentIndivFilter, 10);
    }

    function setIndivFilter(format) {
        currentIndivFilter = format;
        document.querySelectorAll('#indiv-filters .filter-item').forEach(el => el.classList.remove('active'));
        
        const activeNavEl = Array.from(document.querySelectorAll('#indiv-filters .filter-item')).find(el => el.innerText === format);
        if(activeNavEl) activeNavEl.classList.add('active');

        renderIndivMatchesList('indiv-recent-list', format, 10);
    }

    function renderIndivMatchesList(containerId, format, limit) {
        let filtered = dbRounds.filter(m => m['우리 선수'] === currentPlayer);
        if (format !== '전체') filtered = filtered.filter(m => m['형식'] === format);
        const sliced = limit ? filtered.slice(0, limit) : filtered;

        if (sliced.length === 0) {
            document.getElementById(containerId).innerHTML = '<div class="text-center text-muted py-4">경기 기록이 없습니다.</div>';
            return;
        }

        const html = sliced.map(m => {
            let resText = m['결과'] || '';
            let badgeHtml = '<span class="match-badge badge-lose">LOSE</span>';
            if (resText === '승') badgeHtml = '<span class="match-badge badge-win">WIN</span>';
            else if (resText === '무' || resText === '무승부') badgeHtml = '<span class="match-badge badge-draw">DRAW</span>';

            return `
            <div class="match-item-wrap">
                <div class="match-row" style="cursor:default;">
                    <div class="m-date">${m['날짜'] ? m['날짜'].split(' ')[0].substring(2) : ''}</div>
                    <div class="m-type"><span class="tag-badge">${escapeHTML(m['형식'])}</span></div>
                    <div class="m-opp-team">${teamLogoHtml(m['상대팀'])}${escapeHTML(m['상대팀'])}</div>
                    <div class="m-opp-player">${escapeHTML(m['상대 선수']) || '-'}</div>
                    <div class="m-map">${escapeHTML(m['맵']) || '-'}</div>
                    <div class="m-res">${badgeHtml}</div>
                </div>
            </div>
            `;
        }).join('');
        document.getElementById(containerId).innerHTML = html;
    }

    function openIndivMatchModal() {
        const titleText = currentIndivFilter === '전체' ? `${currentPlayer} 개인 전체 전적` : `${currentPlayer} 전체 전적 (${currentIndivFilter})`;
        document.getElementById('indivModalTitle').innerText = titleText;
        renderIndivMatchesList('indiv-modal-list', currentIndivFilter, null);
        new bootstrap.Modal(document.getElementById('indivMatchesModal')).show();
    }

    // ===== 시너지표 (ststats 외부 데이터에서 우리 로스터만 추려서 표시) =====
    const STSTATS_BASE = 'https://ststats.github.io/staruniv';
    let synergyData = null;
    let synergyMetric = 'balloons';

    function formatSecondsToHM(sec) {
        sec = sec || 0;
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        return `${h}시간 ${m}분`;
    }

    async function loadSynergyData() {
        try {
            const datesRes = await fetch(`${STSTATS_BASE}/data/dates.js`, { cache: 'no-store' });
            const datesText = await datesRes.text();
            const match = datesText.match(/window\.AVAILABLE_DATES\s*=\s*(\[[^\]]*\])/);
            if (!match) throw new Error('날짜 목록 형식을 읽을 수 없습니다.');
            const dates = JSON.parse(match[1]);
            const latestDate = dates[0];
            if (!latestDate) throw new Error('사용 가능한 날짜가 없습니다.');

            const dataRes = await fetch(`${STSTATS_BASE}/data/daily/${latestDate}.json`, { cache: 'no-store' });
            if (!dataRes.ok) throw new Error(`daily json HTTP ${dataRes.status}`);
            const data = await dataRes.json();

            // team 이름이 아니라 SOOP ID로 매칭한다 - 외부 쪽 team 표기가
            // 우리 쪽 개편(예: 캄몬스타즈 -> 스타대학)과 항상 동기화된다는
            // 보장이 없기 때문.
            const idToMember = {};
            dbMembers.forEach(m => {
                const soopId = String(m['SOOP ID'] || '').trim().toLowerCase();
                if (soopId) idToMember[soopId] = m;
            });

            synergyData = (data.members || [])
                .map(m => {
                    const key = String(m.id || '').trim().toLowerCase();
                    const ours = idToMember[key];
                    if (!ours) return null;
                    return {
                        ...m,
                        ourMember: ours,
                        active: isActiveMember(ours),
                    };
                })
                .filter(Boolean);

            const updatedText = data.updated_at ? `업데이트: ${data.updated_at}` : '';
            document.getElementById('synergy-updated').innerText = updatedText;

            renderSynergyTable();
        } catch (e) {
            console.error(e);
            const errRow = `<tr><td colspan="3" class="text-center text-muted py-4">데이터를 불러오지 못했습니다.</td></tr>`;
            document.getElementById('synergy-tbody-male').innerHTML = errRow;
            document.getElementById('synergy-tbody-female').innerHTML = errRow;
        }
    }

    const SYNERGY_METRIC_LABELS = {
        balloons: '별풍선',
        broadcast_seconds: '방송시간',
        cumulative_viewers: '누적시청자',
        sponsor: '스폰전적',
    };

    function setSynergyMetric(metric) {
        synergyMetric = metric;
        document.querySelectorAll('#synergy-metric-filter .sub-tab').forEach(el => {
            el.classList.toggle('active', el.dataset.metric === metric);
        });
        document.querySelectorAll('.synergy-metric-label').forEach(el => {
            el.innerText = SYNERGY_METRIC_LABELS[metric] || '';
        });
        renderSynergyTable();
    }

    function synergyRowHtml(m, idx) {
        const ours = m.ourMember;
        const name = ours['이름'] || m.nickname;

        let displayVal;
        if (synergyMetric === 'balloons') displayVal = (m.balloons || 0).toLocaleString('ko-KR') + '개';
        else if (synergyMetric === 'broadcast_seconds') displayVal = formatSecondsToHM(m.broadcast_seconds);
        else if (synergyMetric === 'cumulative_viewers') displayVal = (m.cumulative_viewers || 0).toLocaleString('ko-KR') + '명';
        else displayVal = formatSponsorRecord(m.sponsor_wins, m.sponsor_losses);

        return `
        <tr>
            <td class="text-center text-secondary fw-bold" style="width:25%; white-space:nowrap;">${idx + 1}</td>
            <td class="text-center" style="width:25%;">
                <span class="d-flex align-items-center justify-content-center gap-2" style="min-width:0;">
                    ${avatarHtml(ours['SOOP ID'], 'player-avatar-sm')}
                    <span class="fw-bold" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(name)}</span>
                </span>
            </td>
            <td class="text-center fw-bold" style="width:50%; color:var(--color-primary); white-space:nowrap;">${escapeHTML(displayVal)}</td>
        </tr>`;
    }

    function formatSponsorRecord(wins, losses) {
        wins = wins || 0;
        losses = losses || 0;
        const total = wins + losses;
        const rate = total > 0 ? (wins / total * 100).toFixed(1) : '0.0';
        return `${wins}승 ${losses}패 (${rate}%)`;
    }

    function sortSynergyRows(rows) {
        if (synergyMetric === 'sponsor') {
            // 표시는 승패/승률이지만, 정렬은 판수(승+패)가 많은 순 - 승수 기준이 아니다.
            return rows.slice().sort((a, b) =>
                ((b.sponsor_wins || 0) + (b.sponsor_losses || 0)) - ((a.sponsor_wins || 0) + (a.sponsor_losses || 0)));
        }
        return rows.slice().sort((a, b) => (b[synergyMetric] || 0) - (a[synergyMetric] || 0));
    }

    function renderSynergyTable() {
        const maleTbody = document.getElementById('synergy-tbody-male');
        const femaleTbody = document.getElementById('synergy-tbody-female');
        if (!synergyData) return;

        const active = synergyData.filter(m => m.active);
        const male = sortSynergyRows(active.filter(m => m.ourMember['성별'] === '남자'));
        const female = sortSynergyRows(active.filter(m => m.ourMember['성별'] === '여자'));

        const noData = `<tr><td colspan="3" class="text-center text-muted py-4">표시할 멤버가 없습니다.</td></tr>`;
        maleTbody.innerHTML = male.length ? male.map(synergyRowHtml).join('') : noData;
        femaleTbody.innerHTML = female.length ? female.map(synergyRowHtml).join('') : noData;
    }

    window.onload = function() {
        calculateTeamSummaries();
        renderMembersPage();
        renderLiveBroadcasts();
        renderLatestNotices();
        loadSynergyData();

        const activePageId = document.querySelector('.page-section.active').id.replace('page-', '');
        document.querySelectorAll('#mainMenu .nav-item').forEach(el => el.classList.remove('active'));
        const targetNav = document.querySelector(`#mainMenu .nav-item[data-page="${activePageId}"]`);
        if (targetNav) targetNav.classList.add('active');

        const today = new Date();
        calSelectedDateStr = calGetFormatDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
        calLoadPublicData();
    };
