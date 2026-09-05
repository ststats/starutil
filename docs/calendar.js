    // ===== 일정(캘린더) 페이지 로직 =====
    let calCurrentDate = new Date();
    let calSelectedDateStr = "";
    let calSchedules = {};
    const CAL_DATA_URL = 'data/calendar.json';
    
    const calPublicHolidays = {
        "2024-01-01": true, "2024-02-09": true, "2024-02-10": true, "2024-02-11": true, "2024-02-12": true,
        "2024-03-01": true, "2024-04-10": true, "2024-05-05": true, "2024-05-06": true, "2024-05-15": true,
        "2024-06-06": true, "2024-08-15": true, "2024-09-16": true, "2024-09-17": true, "2024-09-18": true,
        "2024-10-03": true, "2024-10-09": true, "2024-12-25": true,
        "2025-01-01": true, "2025-01-28": true, "2025-01-29": true, "2025-01-30": true, "2025-03-01": true, "2025-03-03": true,
        "2025-05-05": true, "2025-05-06": true, "2025-06-06": true, "2025-08-15": true, "2025-10-03": true, "2025-10-05": true, "2025-10-06": true, "2025-10-07": true, "2025-10-08": true, "2025-10-09": true, "2025-12-25": true,
        "2026-01-01": true, "2026-02-16": true, "2026-02-17": true, "2026-02-18": true, "2026-03-01": true, "2026-03-02": true,
        "2026-05-05": true, "2026-05-24": true, "2026-05-25": true, "2026-06-06": true, "2026-08-15": true, "2026-09-24": true, "2026-09-25": true, "2026-09-26": true, "2026-09-28": true, "2026-10-03": true, "2026-10-09": true, "2026-12-25": true
    };
    
    const calEscapeHTML = (str) => {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, tag => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[tag]));
    };
    
    const calGetFormatDate = (year, month, day) => {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };
    
    const calLoadPublicData = async () => {
        try {
            const res = await fetch(CAL_DATA_URL, { cache: 'no-store' });
            if (res.ok) {
                const parsed = await res.json();
                calSchedules = parsed.schedules || parsed;
            }
        } catch (e) {
            console.error(e);
        }
        calRenderCalendar();
    };
    
    const calGetEventHTML = (item) => {
        const timeHtml = item.time ? `<span class="cal-event-time">${calEscapeHTML(item.time)}</span>` : '';
        const personText = item.person ? `<span class="cal-event-person">${calEscapeHTML(item.person)}</span>` : '';
        return `
            <div class="cal-cell-event" style="background-color: ${item.color || '#eff6ff'};">
                <div class="cal-cell-top">${timeHtml}${personText}</div>
                <div class="cal-event-desc">${calEscapeHTML(item.desc)}</div>
            </div>
        `;
    };
    
    const calRenderCalendar = () => {
        const year = calCurrentDate.getFullYear();
        const month = calCurrentDate.getMonth();
        document.getElementById('monthTitle').innerText = `${year}년 ${month + 1}월`;
        
        const firstDayIndex = new Date(year, month, 1).getDay();
        const lastDay = new Date(year, month + 1, 0).getDate();
        const prevLastDay = new Date(year, month, 0).getDate();
        const daysGrid = document.getElementById('daysGrid');
        daysGrid.innerHTML = "";
        const actualToday = new Date();
        const curTodayStr = calGetFormatDate(actualToday.getFullYear(), actualToday.getMonth() + 1, actualToday.getDate());

        for (let i = firstDayIndex; i > 0; i--) {
            daysGrid.insertAdjacentHTML('beforeend', `<div class="cal-day-cell other-month"><span class="cal-day-number">${prevLastDay - i + 1}</span></div>`);
        }
        
        for (let i = 1; i <= lastDay; i++) {
            const dateStr = calGetFormatDate(year, month + 1, i);
            const dayDiv = document.createElement('div');
            dayDiv.className = 'cal-day-cell';
            if (dateStr === curTodayStr) dayDiv.classList.add('today');
            if (calPublicHolidays[dateStr]) dayDiv.classList.add('holiday');
            let dayHTML = `<span class="cal-day-number">${i}</span>`;
            if (calSchedules[dateStr] && calSchedules[dateStr].length > 0) {
                calSchedules[dateStr].forEach(item => { dayHTML += calGetEventHTML(item); });
            }
            dayDiv.innerHTML = dayHTML;
            dayDiv.onclick = () => calSelectDate(dateStr);
            daysGrid.appendChild(dayDiv);
        }
        
        const totalCellsCount = firstDayIndex + lastDay;
        const nextDaysCount = totalCellsCount % 7 === 0 ? 0 : 7 - (totalCellsCount % 7);
        for (let i = 1; i <= nextDaysCount; i++) {
            daysGrid.insertAdjacentHTML('beforeend', `<div class="cal-day-cell other-month"><span class="cal-day-number">${i}</span></div>`);
        }

        calRenderTodaySchedules();
        calRenderSelectedDateSchedules();
    };
    
    const changeMonth = (direction) => {
        calCurrentDate.setMonth(calCurrentDate.getMonth() + direction);
        calRenderCalendar();
    };
    
    const calSelectDate = (dateStr) => {
        calSelectedDateStr = dateStr;
        calRenderSelectedDateSchedules();
    };
    
    const calRenderTodaySchedules = () => {
        const container = document.getElementById('todayList');
        const today = new Date();
        const curTodayStr = calGetFormatDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
        const todayItems = (calSchedules[curTodayStr] || []).slice();
        todayItems.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
        if (todayItems.length === 0) { 
            container.innerHTML = `<div class="cal-no-schedule">오늘 등록된 일정이 없습니다.</div>`; 
            return; 
        }
        container.innerHTML = todayItems.map(item => `
            <div class="cal-today-card">
                <div class="cal-card-main">
                    <div class="cal-card-dot" style="background-color: ${item.color || '#eff6ff'};"></div>
                    ${item.time ? `<span class="cal-card-time">${calEscapeHTML(item.time)}</span>` : ''} 
                    ${item.person ? `<span class="cal-card-person">${calEscapeHTML(item.person)}</span>` : ''}
                    <span class="cal-card-desc">${calEscapeHTML(item.desc)}</span>
                </div>
                ${item.detail ? `<div style="color: var(--color-text-sub); font-size: var(--fs-body); padding-left: 18px;">↳ ${calEscapeHTML(item.detail)}</div>` : ''}
            </div>
        `).join('');
    };
    
    const calRenderSelectedDateSchedules = () => {
        const container = document.getElementById('selectedDateList');
        if (!calSelectedDateStr) { 
            container.innerHTML = `<div class="cal-no-schedule">날짜를 클릭하세요.</div>`; 
            return; 
        }
        const daySchedules = calSchedules[calSelectedDateStr] || [];
        if (daySchedules.length === 0) { 
            container.innerHTML = `<div class="cal-no-schedule">등록된 일정이 없습니다.</div>`; 
            return; 
        }
        container.innerHTML = daySchedules.map(item => `
            <div class="cal-selected-card">
                <div class="cal-card-main">
                    <div class="cal-card-dot" style="background-color: ${item.color || '#eff6ff'};"></div>
                    ${item.time ? `<span class="cal-card-time">${calEscapeHTML(item.time)}</span>` : ''} 
                    ${item.person ? `<span class="cal-card-person">${calEscapeHTML(item.person)}</span>` : ''}
                    <span class="cal-card-desc">${calEscapeHTML(item.desc)}</span>
                </div>
            </div>
        `).join('');
    };

