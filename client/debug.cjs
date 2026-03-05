const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE_ERROR:', err.toString()));
    await page.goto('http://localhost:5173');
    await page.waitForSelector('.manga-card');
    const cards = await page.$$('.manga-card');
    await cards[0].click();
    await page.waitForSelector('.btn-ghost');
    const btns = await page.$$('.btn-ghost');
    for (let b of btns) {
        const text = await b.evaluate(el => el.textContent);
        if (text.includes('Edit')) {
            await b.click();
            break;
        }
    }
    await page.waitForTimeout(2000);
    await browser.close();
})();
