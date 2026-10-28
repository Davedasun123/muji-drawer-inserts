import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--disable-gpu'],
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));

await page.goto('http://localhost:8099/?part=tool', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 2500));

const read = async () => page.evaluate(() => ({
  part: document.querySelector('#part')?.value,
  hud: document.querySelector('#hud')?.textContent?.replace(/\s+/g, ' '),
  err: document.querySelector('#err')?.hidden === false ? document.querySelector('#err').textContent.slice(0, 200) : null,
  inputs: [...document.querySelectorAll('#controls input')].map((i) => `${i.id}=${i.value}`),
}));

console.log('INITIAL', JSON.stringify(await read(), null, 1));

// change every tool field like a user would
for (const [id, v] of [['p_tool_tL', '200'], ['p_tool_tW', '34'], ['p_tool_tJw', '18'], ['p_tool_tJl', '70']]) {
  await page.$eval(`#${id}`, (el, val) => {
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);
  await new Promise((r) => setTimeout(r, 450));
  const s = await read();
  console.log(id, '->', s.hud, s.err ? `ERROR: ${s.err}` : '');
}

// now switch parts after using tool mode
await page.select('#part', 'A');
await new Promise((r) => setTimeout(r, 1500));
console.log('after switch to A ->', (await read()).hud);

// download path
const dl = await page.evaluate(() => {
  const before = performance.now();
  document.querySelector('#download').click();
  return document.querySelector('#download').disabled;
});
console.log('download disabled?', dl);
console.log('LOGS:', logs.slice(0, 12).join('\n'));
await browser.close();
