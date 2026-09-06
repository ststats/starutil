/**
 * admin.html(캘린더 어드민 페이지)을 헤드리스 브라우저로 열어서
 * 캘린더 화면(#calendarCaptureArea)을 스크린샷으로 저장한다.
 *
 * admin.html의 init()은 localStorage에 저장된 GitHub 토큰이 있으면
 * 자동으로 GitHub에서 calendar.json을 불러와 렌더링하도록 돼있다.
 * 그래서 페이지 스크립트가 실행되기 전에(evaluateOnNewDocument)
 * 토큰을 미리 넣어두면, 사람이 직접 로그인/클릭하지 않아도
 * 열리자마자 최신 일정으로 렌더링된다.
 *
 * (원래 쓰던 capture.js는 유실돼서, admin.html의 코드 흐름을 보고
 * 동일한 목적으로 다시 작성한 버전입니다 - 실제 동작은 한 번
 * workflow_dispatch로 수동 실행해서 확인해보는 걸 권장합니다.)
 */
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const token = process.env.GH_TOKEN;
    if (!token) {
        console.error('❌ GH_TOKEN 환경변수가 설정되지 않았습니다.');
        process.exit(1);
    }

    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1290, height: 1000 });

        // admin.html이 로드되자마자 실행되는 init()이 이 토큰을 보고
        // 자동으로 GitHub에서 calendar.json을 불러오도록, 페이지 스크립트가
        // 돌기 전에 localStorage에 미리 심어둔다.
        await page.evaluateOnNewDocument((t) => {
            localStorage.setItem('gh_token', t);
        }, token);

        const filePath = 'file://' + path.resolve(__dirname, 'docs', 'admin.html');
        await page.goto(filePath, { waitUntil: 'networkidle0' });

        // GitHub API 응답 + 렌더링이 끝날 시간을 넉넉히 기다린다.
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const target = await page.$('#calendarCaptureArea');
        if (!target) {
            throw new Error('#calendarCaptureArea 요소를 찾을 수 없습니다.');
        }

        await target.screenshot({ path: 'docs/data/calendar.png' });
        console.log('✅ docs/data/calendar.png 캡처 완료');
    } finally {
        await browser.close();
    }
})();
