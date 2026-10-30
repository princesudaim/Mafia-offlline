// Optional real-browser smoke test. Start a production preview, then set CHROMIUM_PATH.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const executablePath=process.env.CHROMIUM_PATH;
if (!executablePath) throw new Error('Set CHROMIUM_PATH to a locally installed Chromium executable.');
const base=process.env.BASE_URL || 'http://127.0.0.1:5180/';
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try {
  const context=await browser.newContext({viewport:{width:390,height:700},isMobile:true,hasTouch:true});
  const page=await context.newPage(), errors=[];
  await page.addInitScript(() => {
    window.__playedAudio=[];
    const original=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){ window.__playedAudio.push(this.src);return original.call(this); };
  });
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base,{waitUntil:'networkidle'});
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.evaluate(()=>localStorage.setItem('werewolf.names',JSON.stringify(['A','B','C','D'])));
  await page.reload({waitUntil:'load'});
  assert.match(await page.locator('main.app').evaluate(element=>getComputedStyle(element).backgroundImage),/werewolf\/home\.png/);
  await page.getByRole('button',{name:'HOW TO PLAY'}).click();
  assert.ok(await page.getByRole('heading',{name:'THE RULEBOOK'}).isVisible());
  await page.getByRole('button',{name:'GOT IT'}).click();
  await page.getByRole('button',{name:/START GAME/}).click();
  // Exercise the actual mobile bottom sheets and preserve unique avatar ownership.
  await page.getByRole('button',{name:'Edit A'}).click();
  await page.getByRole('button',{name:'Choose or change game avatar'}).click();
  assert.ok(await page.getByRole('dialog',{name:'Choose photo or avatar'}).isVisible());
  await page.getByRole('button',{name:/Game avatars/}).click();
  assert.ok(await page.getByRole('dialog',{name:'Game avatars'}).isVisible());
  await page.getByRole('button',{name:'Choose avatar 1',exact:true}).click();
  await page.getByRole('button',{name:'SAVE PLAYER'}).click();
  await page.getByRole('button',{name:'Edit B'}).click();
  await page.getByRole('button',{name:'Choose or change game avatar'}).click();
  await page.getByRole('button',{name:/Game avatars/}).click();
  await page.getByRole('button',{name:'Choose avatar 1',exact:true}).click();
  await page.getByRole('button',{name:'SAVE PLAYER'}).click();
  const avatars=await page.evaluate(()=>JSON.parse(localStorage.getItem('werewolf.avatars.v1')));
  assert.notEqual(avatars.a,avatars.b,'used avatar must be transferred, not duplicated');
  assert.ok(avatars.a && avatars.b.endsWith('/player1.webp'));
  await page.getByRole('button',{name:'Edit A'}).click();
  await page.getByRole('button',{name:'Choose or change game avatar'}).click();
  // The native gallery is controlled by the OS; supply an image through its file input.
  await page.locator('dialog input[type=file]:not([capture])').setInputFiles('public/icons/werewolf-512.png');
  await page.waitForFunction(()=>document.querySelector('.avatar-preview img')?.getAttribute('src')?.startsWith('data:image/'));
  await page.getByRole('button',{name:'SAVE PLAYER'}).click();
  assert.ok((await page.evaluate(()=>JSON.parse(localStorage.getItem('werewolf.avatars.v1')).a)).startsWith('data:image/'));
  await page.getByRole('button',{name:'Delete players'}).click();
  assert.ok(await page.getByText('DELETE MODE').isVisible());
  await page.getByRole('button',{name:'Exit delete mode'}).click();
  await page.getByRole('button',{name:/CHOOSE ROLES/}).click();
  assert.equal(await page.evaluate(()=>window.scrollY),0,'new screen should start at the top');
  for (const width of [320,390]) {
    await page.setViewportSize({width,height:700});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'phone layout must not overflow horizontally');
    const control=await page.locator('.stepper button').first().boundingBox();
    assert.ok(control && control.width>=44 && control.height>=44,'role controls must be at least 44px');
  }
  const bar=page.locator('.role-start-bar'), initial=await bar.boundingBox();
  assert.ok(initial && initial.y+initial.height<=701,'start bar must be visible');
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await page.waitForTimeout(100);
  const scrolled=await bar.boundingBox();
  assert.ok(scrolled && Math.abs(initial.y-scrolled.y)<1,'start bar must remain fixed while scrolling');
  await page.getByRole('button',{name:'View White Werewolf details'}).click();
  assert.equal(await page.locator('dialog[open]').count(),1);
  await page.getByRole('button',{name:'Close role details'}).click();
  for(const role of ['Werewolf','Doctor','Seer','Villager']) await page.getByRole('button',{name:'Add '+role}).click();
  await page.getByRole('button',{name:/START GAME/}).click();
  assert.ok(await page.getByRole('heading',{name:'NIGHT 1 STARTED'}).isVisible());
  assert.equal(await page.evaluate(()=>window.scrollY),0,'new night screen should start at the top');
  await context.setOffline(true);
  await page.reload({waitUntil:'load'});
  assert.ok(await page.getByRole('heading',{name:'WEREWOLF'}).isVisible());
  await page.getByRole('button',{name:/START GAME/}).click();
  await page.getByRole('button',{name:/CHOOSE ROLES/}).click();
  const art=page.locator('.role-choice img').first();
  await art.waitFor();
  assert.equal(await art.evaluate(image=>image.complete && image.naturalWidth>0),true,'role art should load offline');
  for(const role of ['Werewolf','Journalist','Villager','Villager']) await page.getByRole('button',{name:'Add '+role}).click();
  await page.getByRole('button',{name:/START GAME/}).click();
  await page.getByRole('button',{name:'Enable game sounds'}).click();
  assert.ok(await page.evaluate(()=>window.__playedAudio.some(src=>src.endsWith('/night.mp3'))));
  await page.getByRole('button',{name:'CONTINUE →'}).click();
  for(let i=0;i<4;i++) {
    await page.getByRole('button',{name:/SHOW YOUR ROLE/}).click();
    const role=await page.locator('.action h2').innerText();
    if(role==='Journalist') {
      await page.getByPlaceholder('Write a headline').fill('Offline village news');
      const canvas=page.locator('canvas.drawing-canvas');await canvas.scrollIntoViewIfNeeded();
      const rect=await canvas.boundingBox();assert.ok(rect);
      await page.touchscreen.tap(rect.x+rect.width/2,rect.y+rect.height/2);
      await page.getByRole('button',{name:'PUBLISH IN THE MORNING'}).click();
    } else await page.getByRole('button',{name:'SKIP',exact:true}).click();
  }
  assert.ok(await page.getByText('Offline village news').isVisible());
  assert.ok(await page.evaluate(()=>window.__playedAudio.some(src=>src.endsWith('/day.mp3'))));
  assert.equal(await page.locator('.newspaper img').count(),1,'touch drawing should appear in the newspaper');
  await page.getByRole('button',{name:'CONTINUE →'}).click();
  await page.getByRole('button',{name:'END DISCUSSION →'}).click();
  assert.ok(await page.getByRole('heading',{name:/who are you voting for/}).isVisible());
  assert.ok(await page.evaluate(()=>window.__playedAudio.some(src=>src.endsWith('/vote.mp3'))));
  await page.getByRole('button',{name:'Mute game sounds'}).click();
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await page.getByRole('button',{name:'SKIP VOTE'}).click();
  assert.equal(await page.evaluate(()=>window.scrollY),0,'the next voter should start at the top');
  assert.deepEqual(errors,[]);
  console.log('Browser smoke passed: fixed bar, role details, offline game, touch drawing and direct voting.');
} finally { await browser.close(); }
