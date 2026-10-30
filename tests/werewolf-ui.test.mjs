import { before, after, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url:'http://localhost/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.localStorage = dom.window.localStorage;
window.scrollTo = () => {};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new window.Event('close')); };
let vite, App, React, ui, roles, rankings;
const originalRandom = Math.random;
before(async () => {
  vite = await createServer({ server:{middlewareMode:true}, appType:'custom', optimizeDeps:{noDiscovery:true,include:[]} });
  ({default:App} = await vite.ssrLoadModule('/src/Werewolf.tsx'));
  ({roles} = await vite.ssrLoadModule('/src/werewolf-engine.ts'));
  rankings = await vite.ssrLoadModule('/src/rankings.ts');
  React = await import('react');
  ui = await import('@testing-library/react');
});
afterEach(() => { ui?.cleanup(); localStorage.clear(); Math.random = originalRandom; });
after(async () => { await vite?.close(); dom.window.close(); });
const click = name => ui.fireEvent.click(ui.screen.getByRole('button',{name}));
const availableTargets = () => [...document.querySelectorAll('button.target:not(:disabled)')];
function startSetup(names, settings={}, populate=true) {
  localStorage.setItem('werewolf.names',JSON.stringify(names));
  localStorage.setItem('werewolf.settings',JSON.stringify(settings));
  Math.random=()=>0;
  ui.render(React.createElement(App));
  click(/START GAME/); click(/CHOOSE ROLES/);
  if (populate) {
    click('Add Werewolf');click('Add Doctor');click('Add Seer');
    for (let i=0;i<Math.max(0,names.length-3);i++) click('Add Villager');
  }
}
function chooseTargets(count=1, excludedName) {
  const targets=availableTargets().filter(b=>b.querySelector('strong')?.textContent!==excludedName);
  assert.ok(targets.length>=count,`expected ${count} selectable targets, got ${targets.length}`);
  for (let i=0;i<count;i++) ui.fireEvent.click(targets[i]);
}
function finishPrivateResult() {
  if (ui.screen.queryByRole('button',{name:'OK · HIDE RESULT'})) click('OK · HIDE RESULT');
}
function actCurrentRole() {
  click(/SHOW YOUR ROLE/);
  const heading=ui.screen.getByRole('heading',{level:2}).textContent;
  if (heading==='Journalist') {
    ui.fireEvent.change(ui.screen.getByPlaceholderText('Write a headline'),{target:{value:'Nightly news'}});
    click('PUBLISH IN THE MORNING');
  } else if (heading==='Mayor') click('DECLARE EMERGENCY ASSEMBLY');
  else if (heading==='Survivor') click(/USE SHIELD/);
  else if (heading==='Mind Flayer') { chooseTargets(); click('PLANT PARASITE'); }
  else {
    const button=ui.screen.getByRole('button',{name:/^(COMPLETE ACTION|SKIP|VIEW INTEL)$/});
    if (button.disabled) chooseTargets(heading==='Chef' ? 2 : 1);
    ui.fireEvent.click(button);
    finishPrivateResult();
    if (heading==='Hypnotist Werewolf' && ui.screen.queryByRole('button',{name:'HYPNOTIZE'})) {
      chooseTargets(); click('HYPNOTIZE');
    }
  }
  return heading;
}

// Every selectable role is dealt, takes a first-night turn, and reaches morning.
test('every implemented role can be selected and complete a night', async t => {
  for (const [id,meta] of Object.entries(roles)) await t.test(meta.name, () => {
    startSetup(['A','B','C','D','E','F'],{firstNightSafe:false});
    for (let i=0;i<3;i++) click('Remove Villager');
    click('Remove Doctor'); click('Remove Seer');
    for (let i=0;i<4;i++) click('Add Villager');
    click(`Add ${meta.name}`);
    click(/START GAME/); click('CONTINUE →');
    const seen=[];
    for (let i=0;i<6;i++) seen.push(actCurrentRole());
    assert.ok(seen.includes(meta.name),`${meta.name} never got a turn`);
    assert.ok(ui.screen.queryByText(/No one was killed tonight|died/),'night did not reach morning');
    if (id==='journalist') assert.ok(ui.screen.getByText('Nightly news'));
    ui.cleanup(); localStorage.clear(); Math.random=originalRandom;
  });
});

test('role detail modal and section counts cover every role', () => {
  startSetup(['A','B','C','D']);
  const sections=ui.screen.getAllByRole('heading',{level:3}).filter(h=>/VILLAGERS|WEREWOLVES|NEUTRALS/.test(h.textContent));
  assert.equal(sections.length,3);
  for (const h of sections) {
    const count=h.parentElement.querySelectorAll('.role-choice').length;
    assert.ok(h.textContent.includes(`${count} / ${Object.keys(roles).length} ROLES`));
  }
  for (const meta of Object.values(roles)) {
    click(`View ${meta.name} details`);
    const dialog=ui.screen.getByRole('dialog');
    assert.ok(ui.within(dialog).getByText(meta.description));
    assert.ok(ui.within(dialog).getByAltText(`${meta.name} role artwork`));
    click('Close role details');
  }
});

test('settings control first-night attacks, death reveal, secret voting and skip voting', () => {
  startSetup(['A','B','C','D'],{firstNightSafe:false,revealDead:false,secretVotes:false,allowSkip:false,discussionMinutes:2});
  click(/START GAME/); click('CONTINUE →');
  let victim='', saved='';
  for(let i=0;i<4;i++) {
    click(/SHOW YOUR ROLE/);
    const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if(role==='Werewolf') { const target=availableTargets().find(b=>b.querySelector('strong').textContent!==saved); victim=target.querySelector('strong').textContent; ui.fireEvent.click(target); click('COMPLETE ACTION'); }
    else if(role==='Doctor') { const target=availableTargets().find(b=>b.querySelector('strong').textContent!==victim); saved=target.querySelector('strong').textContent; ui.fireEvent.click(target); click('COMPLETE ACTION'); }
    else if(role==='Seer') { chooseTargets(); click('COMPLETE ACTION'); finishPrivateResult(); }
    else click('SKIP');
  }
  const morning=ui.screen.getByText(/ died/).textContent;
  assert.ok(morning.includes(victim));
  assert.ok(!morning.includes('('),'death role should be hidden');
  click('CONTINUE →');
  assert.ok(ui.screen.getByText('02:00'));
  click('+1 MINUTE'); assert.ok(ui.screen.getByText('03:00'));
  click('END DISCUSSION →'); 
  assert.ok(ui.screen.getByText(/Votes so far:/));
  assert.equal(ui.screen.queryByRole('button',{name:'SKIP VOTE'}),null);
});

test('safe first night, secret votes and skip votes use their default settings', () => {
  startSetup(['A','B','C','D']);
  click(/START GAME/); click('CONTINUE →');
  let wolfTurn=false;
  for (let i=0;i<4;i++) {
    click(/SHOW YOUR ROLE/);
    const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if (role==='Werewolf') {
      wolfTurn=true;
      assert.ok(ui.screen.getByText(/No killing ability on the first night/));
      assert.equal(availableTargets().length,0);
      click('SKIP');
    } else if (role==='Doctor') { chooseTargets(); click('COMPLETE ACTION'); }
    else if (role==='Seer') { chooseTargets(); click('COMPLETE ACTION'); finishPrivateResult(); }
    else click('SKIP');
  }
  assert.ok(wolfTurn);
  assert.ok(ui.screen.getByText('No one was killed tonight.'));
  click('CONTINUE →'); click('END DISCUSSION →'); 
  assert.ok(ui.screen.getByRole('button',{name:'SKIP VOTE'}));
  assert.equal(ui.screen.queryByText(/Votes so far:/),null);
});

for (const order of ['police-after-doctor','police-before-doctor']) {
  test(`Police silently blocks the Doctor irrespective of action order: ${order}`, () => {
    startSetup(['A','B','C','D','E','F'],{firstNightSafe:false});
    click('Remove Seer');click('Add Police');
    if (order==='police-before-doctor') Math.random=()=>0.999;
    click(/START GAME/);click('CONTINUE →');
    const doctor=order==='police-before-doctor'?'F':'E';
    const victim=order==='police-before-doctor'?'C':'B';
    let sawDoctor=false,sawPolice=false,sawWolf=false;
    for(let i=0;i<6;i++) {
      const player=ui.screen.getByRole('heading',{level:2}).textContent;
      click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
      assert.equal(ui.screen.queryByText('You cannot use your role tonight.'),null);
      if(role==='Werewolf' || role==='Doctor' || role==='Police') {
        const desired=role==='Police'?doctor:victim;
        const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===desired);
        assert.ok(target,`${role} cannot select ${desired}`);
        ui.fireEvent.click(target);click('COMPLETE ACTION');
        if(role==='Doctor') {assert.equal(player,doctor);sawDoctor=true;}
        if(role==='Police') sawPolice=true;
        if(role==='Werewolf') sawWolf=true;
      } else click('SKIP');
    }
    assert.ok(sawDoctor && sawPolice && sawWolf);
    assert.ok(ui.screen.getByText(new RegExp(`${victim} died`)),'blocked protection must fail');
    assert.equal(ui.screen.queryByText(/detained/i),null);
  });
}

for (const blocked of [true,false]) {
  test(`Police-game Seer report is delayed and ${blocked?'suppressed when detained':'delivered when not detained'}`, () => {
    startSetup(['A','B','C','D','E','F']);
    click('Remove Villager');click('Add Police');click(/START GAME/);click('CONTINUE →');
    let seer='';
    for(let i=0;i<6;i++) {
      const player=ui.screen.getByRole('heading',{level:2}).textContent;
      click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
      if(role==='Seer' || role==='Doctor' || role==='Police') {
        const desired=role==='Police'?(blocked?'E':'D'):(role==='Seer'?'A':'B');
        const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===desired);assert.ok(target);
        ui.fireEvent.click(target);click('COMPLETE ACTION');
        if(role==='Seer') {seer=player;assert.equal(ui.screen.queryByRole('heading',{name:'PRIVATE RESULT'}),null);}
      } else click('SKIP');
    }
    assert.equal(seer,'E');click('CONTINUE →');click('END DISCUSSION →');
    for(let i=0;i<6;i++) click('SKIP VOTE');
    click('CONTINUE →');click('CONTINUE →');
    for(let i=0;i<5;i++) {
      const player=ui.screen.getByRole('heading',{level:2}).textContent;
      click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
      if(player===seer) {
        assert.equal(!!ui.screen.queryByText('PREVIOUS NIGHT REPORT'),!blocked);
        if(!blocked) assert.ok(ui.screen.getByText(/A is Werewolf/));
        break;
      }
      if(role==='Doctor' || role==='Werewolf') {chooseTargets();click('COMPLETE ACTION');} else click('SKIP');
    }
  });
}

test('Chef can continue when only one possible guest remains', () => {
  startSetup(['A','B','C','D']);
  click('Remove Doctor');click('Remove Seer');click('Add Chef');click('Add Thief');
  click(/START GAME/);click('CONTINUE →');
  for(let i=0;i<4;i++) {
    click(/SHOW YOUR ROLE/); const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if(role==='Chef'){chooseTargets(2);click('COMPLETE ACTION');finishPrivateResult();}
    else click('SKIP');
  }
  click('CONTINUE →');click('END DISCUSSION →');
  for(let i=0;i<4;i++){click('SKIP VOTE');}
  click('CONTINUE →');click('CONTINUE →');
  for(let i=0;i<4;i++) {
    click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if(role==='Werewolf') {const target=availableTargets().find(b=>b.querySelector('strong')?.textContent==='B');assert.ok(target);ui.fireEvent.click(target);click('COMPLETE ACTION');}
    else if(role==='Chef'){chooseTargets(2);click('COMPLETE ACTION');finishPrivateResult();}
    else if(role==='Thief') click('SKIP THEFT');
    else click('SKIP');
  }
  assert.ok(ui.screen.getByText(/B died/));click('CONTINUE →');click('END DISCUSSION →');
  for(let i=0;i<3;i++) {
    const player=ui.screen.getByRole('heading',{level:2}).textContent.split(',')[0];
    if(player==='A') click('SKIP VOTE');
    else {const target=availableTargets().find(b=>b.querySelector('strong')?.textContent==='A');assert.ok(target);ui.fireEvent.click(target);click('VOTE');}
  }
  assert.ok(ui.screen.getByText(/A was executed/));click('CONTINUE →');click('CONTINUE →');
  let sawChef=false;
  for(let i=0;i<2;i++) {
    click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if(role==='Chef') {sawChef=true;assert.ok(ui.screen.getByText(/Not enough other living players/));click('SKIP');}
    else if(role==='Thief') click('SKIP THEFT');
  }
  assert.ok(sawChef);assert.ok(ui.screen.getByText('No one was killed tonight.'));
});

test('show-dead-role setting reveals the eliminated role', () => {
  startSetup(['A','B','C','D'],{firstNightSafe:false,revealDead:true});
  click(/START GAME/);click('CONTINUE →');
  let victim='', saved='';
  for(let i=0;i<4;i++) {
    click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if(role==='Werewolf') {const target=availableTargets().find(b=>b.querySelector('strong').textContent!==saved);victim=target.querySelector('strong').textContent;ui.fireEvent.click(target);click('COMPLETE ACTION');}
    else if(role==='Doctor') {const target=availableTargets().find(b=>b.querySelector('strong').textContent!==victim);saved=target.querySelector('strong').textContent;ui.fireEvent.click(target);click('COMPLETE ACTION');}
    else if(role==='Seer') {chooseTargets();click('COMPLETE ACTION');finishPrivateResult();}
    else click('SKIP');
  }
  assert.match(ui.screen.getByText(/ died/).textContent,/ died \(.+\)\./);
});


test('role selection starts empty and the fixed start bar follows the selected total', () => {
  startSetup(['A','B','C','D'],{},false);
  const bar=document.querySelector('.role-start-bar');
  assert.ok(bar);
  const start=ui.within(bar).getByRole('button',{name:/START GAME/});
  assert.ok(start.disabled);
  assert.match(start.textContent,/0 \/ 4/);
  const counts=[...document.querySelectorAll('.role-choice .stepper span')];
  assert.equal(counts.length,Object.keys(roles).length);
  assert.ok(counts.every(count=>count.textContent==='0'));
  click('Add Werewolf');click('Add Villager');click('Add Villager');click('Add Doctor');
  assert.match(start.textContent,/4 \/ 4/);assert.equal(start.disabled,false);
  click('Remove Villager');assert.match(start.textContent,/3 \/ 4/);assert.equal(start.disabled,true);
  click('Go back');click(/CHOOSE ROLES/);
  assert.match(document.querySelector('.role-start-bar button').textContent,/0 \/ 4/);
});

test('Charmer forms a private bond and the Lovers win only after opponents are gone', () => {
  startSetup(['A','B','C','D']);
  click('Remove Doctor');click('Remove Seer');click('Add Villager');click('Add Charmer');
  click(/START GAME/);click('CONTINUE →');
  for(let i=0;i<4;i++) {
    click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if(role==='Charmer') {
      const target=availableTargets().find(b=>b.querySelector('strong')?.textContent==='B');
      assert.ok(target);ui.fireEvent.click(target);click('COMPLETE ACTION');
    } else click('SKIP');
  }
  assert.ok(ui.screen.getByText('No one was killed tonight.'));
  click('CONTINUE →');click('END DISCUSSION →');
  for(let i=0;i<4;i++) {
    const player=ui.screen.getByRole('heading',{level:2}).textContent.split(',')[0];
    const partnerButton=[...document.querySelectorAll('button.target')].find(b=>b.querySelector('strong')?.textContent==='D');
    if(player==='B') { assert.ok(partnerButton.disabled,'a lover must not vote to eliminate their partner'); assert.ok(ui.screen.getByText(/Your lover is D/)); }
    const desired=player==='A'?'C':'A';
    const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===desired);
    assert.ok(target);ui.fireEvent.click(target);click('VOTE');
  }
  assert.ok(ui.screen.getByText(/A was executed/));click('CONTINUE →');
  assert.ok(ui.screen.getByText(/NIGHT 2 STARTED/),'living opponents should prevent Lovers victory');click('CONTINUE →');
  for(let i=0;i<3;i++) {
    click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if(role==='Charmer') assert.ok(ui.screen.getByText(/Your lover: B/));
    click('SKIP');
  }
  click('CONTINUE →');click('END DISCUSSION →');
  for(let i=0;i<3;i++) {
    const player=ui.screen.getByRole('heading',{level:2}).textContent.split(',')[0];
    const desired=player==='C'?'D':'C';
    const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===desired);
    assert.ok(target);ui.fireEvent.click(target);click('VOTE');
  }
  assert.ok(ui.screen.getByText(/C was executed/));click('CONTINUE →');
  assert.ok(ui.screen.getByRole('heading',{name:'THE LOVERS WIN'}));
});

test('Madman setting validates eligible roles, hides the disguise and reveals it only at game end', () => {
  startSetup(['A','B','C','D']);
  const count=ui.screen.getByLabelText('Madmen (disguised roles)');
  assert.equal(count.value,'0');
  ui.fireEvent.change(count,{target:{value:'3'}});
  click(/START GAME/);
  assert.ok(ui.screen.getByRole('alert').textContent.includes('at most 2 Madmen'));
  ui.fireEvent.change(count,{target:{value:'1'}});
  assert.equal(ui.screen.queryByRole('alert'),null);
  click(/START GAME/);click('CONTINUE →');
  let wolf='';
  for(let i=0;i<4;i++) {
    const player=ui.screen.getByRole('heading',{level:2}).textContent;click(/SHOW YOUR ROLE/);
    const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if(role==='Werewolf') {wolf=player;click('SKIP');}
    else if(role==='Doctor' || role==='Seer') {chooseTargets();click('COMPLETE ACTION');finishPrivateResult();}
    else click('SKIP');
    assert.equal(ui.screen.queryByText(/· Madman/),null);
  }
  assert.ok(wolf);click('CONTINUE →');click('END DISCUSSION →');
  for(let i=0;i<4;i++) {
    const player=ui.screen.getByRole('heading',{level:2}).textContent.split(',')[0];
    if(player===wolf) click('SKIP VOTE');
    else {const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===wolf);assert.ok(target);ui.fireEvent.click(target);click('VOTE');}
  }
  click('CONTINUE →');
  const rows=[...document.querySelectorAll('.result-row')];
  assert.equal(rows.filter(row=>row.textContent.includes('· Madman')).length,1);
});


test('discussion and successive votes open the voting page directly', () => {
  startSetup(['A','B','C','D']);
  click(/START GAME/);click('CONTINUE →');
  for(let i=0;i<4;i++) {
    click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if(role==='Doctor' || role==='Seer') {chooseTargets();click('COMPLETE ACTION');finishPrivateResult();}
    else click('SKIP');
  }
  click('CONTINUE →');click('END DISCUSSION →');
  assert.ok(ui.screen.getByRole('heading',{name:'A, who are you voting for?'}));
  assert.equal(ui.screen.queryByRole('button',{name:'CAST YOUR VOTE'}),null);
  click('SKIP VOTE');
  assert.ok(ui.screen.getByRole('heading',{name:'B, who are you voting for?'}));
  assert.equal(ui.screen.queryByRole('button',{name:'CAST YOUR VOTE'}),null);
});

test('a detained Sheriff keeps their bullet and Police cannot repeat a successful detention', () => {
  startSetup(['A','B','C','D','E','F'],{firstNightSafe:false});
  click('Remove Seer');click('Add Sheriff');click('Remove Doctor');click('Add Police');
  click(/START GAME/);click('CONTINUE →');
  for(let i=0;i<6;i++) {
    click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if(role==='Werewolf' || role==='Sheriff' || role==='Police') {
      const desired=role==='Werewolf'?'B':role==='Sheriff'?'C':'E';
      const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===desired);assert.ok(target,role);
      ui.fireEvent.click(target);click('COMPLETE ACTION');
    } else click('SKIP');
  }
  assert.ok(ui.screen.getByText(/B died/));assert.equal(ui.screen.queryByText(/C died/),null);
  click('CONTINUE →');click('END DISCUSSION →');
  for(let i=0;i<5;i++) click('SKIP VOTE');
  click('CONTINUE →');click('CONTINUE →');
  let sawSheriff=false,sawPolice=false;
  for(let i=0;i<5;i++) {
    click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if(role==='Werewolf') {chooseTargets();click('COMPLETE ACTION');}
    else if(role==='Sheriff') {sawSheriff=true;assert.ok(ui.screen.getByRole('button',{name:'SAVE BULLET FOR LATER'}));assert.ok(availableTargets().length);click('SAVE BULLET FOR LATER');}
    else if(role==='Police') {
      sawPolice=true;
      const oldTarget=[...document.querySelectorAll('button.target')].find(b=>b.querySelector('strong')?.textContent==='E');
      assert.ok(oldTarget.disabled);click('SKIP DETENTION');
    } else click('SKIP');
  }
  assert.ok(sawSheriff && sawPolice);
});

test('a detained Mayor does not protect the village or consume the assembly', () => {
  startSetup(['A','B','C','D','E','F'],{firstNightSafe:false});
  click('Remove Doctor');click('Add Mayor');click('Remove Seer');click('Add Police');
  click(/START GAME/);click('CONTINUE →');
  for(let i=0;i<6;i++) {
    click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if(role==='Werewolf' || role==='Police') {
      const desired=role==='Werewolf'?'B':'E';
      const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===desired);assert.ok(target,role);
      ui.fireEvent.click(target);click('COMPLETE ACTION');
    } else if(role==='Mayor') click('DECLARE EMERGENCY ASSEMBLY');
    else click('SKIP');
  }
  assert.ok(ui.screen.getByText(/B died/));
  assert.equal(ui.screen.queryByText(/declared an emergency assembly/),null);
  click('CONTINUE →');click('END DISCUSSION →');for(let i=0;i<5;i++) click('SKIP VOTE');
  click('CONTINUE →');click('CONTINUE →');
  let sawMayor=false;
  for(let i=0;i<4;i++) {
    click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if(role==='Werewolf') {chooseTargets();click('COMPLETE ACTION');}
    else if(role==='Mayor') {sawMayor=true;assert.ok(ui.screen.getByRole('button',{name:'DECLARE EMERGENCY ASSEMBLY'}));break;}
    else click('SKIP');
  }
  assert.ok(sawMayor);
});

test('a disguised Madman Journalist writes privately but publishes nothing', () => {
  startSetup(['A','B','C','D'],{madmanCount:1});
  click('Remove Doctor'); click('Remove Seer'); click('Add Journalist'); click('Add Villager');
  click(/START GAME/); click('CONTINUE →');
  for(let i=0;i<4;i++) {
    click(/SHOW YOUR ROLE/);
    const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if(role==='Journalist') {
      ui.fireEvent.change(ui.screen.getByPlaceholderText('Write a headline'),{target:{value:'A secret story'}});
      click('PUBLISH IN THE MORNING');
    } else click('SKIP');
  }
  assert.ok(ui.screen.getByText('No one was killed tonight.'));
  assert.equal(ui.screen.queryByText('A secret story'),null);
});

test('optional passive-role wait delays skipping but active roles can act immediately', async () => {
  const originalNow=Date.now;
  let now=originalNow();
  Date.now=()=>now;
  try {
    startSetup(['A','B','C','D'],{passiveWait:true});
    assert.equal(ui.screen.getByLabelText('Wait time for passive roles').checked,true);
    click(/START GAME/);click('CONTINUE →');
    let checkedPassive=false,checkedActive=false;
    for(let i=0;i<4;i++) {
      click(/SHOW YOUR ROLE/);
      const role=ui.screen.getByRole('heading',{level:2}).textContent;
      if(role==='Villager') {
        checkedPassive=true;
        assert.ok(ui.screen.getByRole('button',{name:'SKIP'}).disabled);
        assert.ok(ui.screen.getByRole('status').textContent.includes('5 seconds'));
        now+=5000;
        await ui.act(async()=>{await new Promise(resolve=>setTimeout(resolve,300));});
        assert.equal(ui.screen.getByRole('button',{name:'SKIP'}).disabled,false);
        click('SKIP');
      } else if(role==='Werewolf') {checkedActive=true;assert.equal(ui.screen.getByRole('button',{name:'SKIP'}).disabled,false);click('SKIP');}
      else {chooseTargets();click('COMPLETE ACTION');finishPrivateResult();}
    }
    assert.ok(checkedPassive && checkedActive);
    assert.equal(JSON.parse(localStorage.getItem('werewolf.settings')).passiveWait,true);
  } finally {Date.now=originalNow;}
});


test('random distribution fills an initially empty lineup and remains editable', () => {
  startSetup(['A','B','C','D'],{},false);
  assert.match(ui.screen.getByRole('button',{name:/START GAME/}).textContent,/0 \/ 4/);
  click('RANDOM DISTRIBUTION');
  assert.match(ui.screen.getByRole('button',{name:/START GAME/}).textContent,/4 \/ 4/);
  assert.equal(ui.screen.getByRole('button',{name:/START GAME/}).disabled,false);
  click('Add Villager');
  assert.equal(ui.screen.getByRole('button',{name:/START GAME/}).disabled,true);
  click('Remove Villager');
  click(/START GAME/);
  assert.ok(ui.screen.getByRole('heading',{name:'NIGHT 1 STARTED'}));
});


test('rankings count faction, survivor, escaped Gambler and independent winners correctly', () => {
  const p=[{id:0,name:'W',role:'werewolf',alive:false},{id:1,name:'V',role:'villager',alive:true},{id:2,name:'S',role:'survivor',alive:true},{id:3,name:'G',role:'gambler',alive:false,escaped:true},{id:4,name:'C',role:'charmer',alive:false},{id:5,name:'J',role:'jester',alive:false}];
  assert.deepEqual(rankings.winningPlayers(p,'village',{},'', ''),[1,2,3]);
  assert.deepEqual(rankings.winningPlayers(p,'wolf',{},'', ''),[0,2,3]);
  assert.deepEqual(rankings.winningPlayers(p,'jester',{},'J', ''),[2,3,5]);
  const lovers={1:4,4:1};
  assert.deepEqual(rankings.winningPlayers(p,'lovers',lovers,'', ''),[1,2,3,4]);
  assert.deepEqual(rankings.winningPlayers(p,'wolf',lovers,'', ''),[0,2,3]);
  const first=rankings.updateRankings([],p,[1,2,3]);
  const next=rankings.updateRankings(first,p,[0,2,3]);
  assert.deepEqual(next.find(r=>r.name==='S'),{name:'S',played:2,wins:2});
  assert.deepEqual(next.find(r=>r.name==='J'),{name:'J',played:2,wins:0});
  assert.equal(next.length,6);
});

test('completed games are saved once and visible in local rankings', () => {
  startSetup(['A','B','C','D']);
  click(/START GAME/);click('CONTINUE →');
  let wolf='';
  for(let i=0;i<4;i++) {
    const name=ui.screen.getByRole('heading',{level:2}).textContent;click(/SHOW YOUR ROLE/);
    const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if(role==='Werewolf') {wolf=name;click('SKIP');}
    else if(role==='Doctor' || role==='Seer') {chooseTargets();click('COMPLETE ACTION');finishPrivateResult();}
    else click('SKIP');
  }
  click('CONTINUE →');click('END DISCUSSION →');
  for(let i=0;i<4;i++) {
    const name=ui.screen.getByRole('heading',{level:2}).textContent.split(',')[0];
    if(name===wolf) click('SKIP VOTE');
    else {const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===wolf);ui.fireEvent.click(target);click('VOTE');}
  }
  click('CONTINUE →');
  let stored=JSON.parse(localStorage.getItem('werewolf.rankings.v1'));
  assert.equal(stored.length,4);
  assert.ok(stored.every(r=>r.played===1));
  assert.equal(stored.find(r=>r.name===wolf).wins,0);
  assert.ok(stored.filter(r=>r.name!==wolf).every(r=>r.wins===1));
  click('BACK TO MENU');click(/START GAME/);click(/PLAYER LIBRARY/);click('ALL-TIME RANKINGS');
  assert.ok(ui.screen.getByRole('heading',{name:'ALL-TIME RANKINGS'}));
  assert.equal(document.querySelectorAll('.ranking-row').length,4);
  stored=JSON.parse(localStorage.getItem('werewolf.rankings.v1'));
  assert.ok(stored.every(r=>r.played===1));
});

test('discussion timer uses elapsed time when backgrounded and add-minute extends the deadline', () => {
  const originalNow=Date.now; let now=originalNow(); Date.now=()=>now;
  try {
    startSetup(['A','B','C','D'],{discussionMinutes:1});
    click(/START GAME/);click('CONTINUE →');
    for(let i=0;i<4;i++) {
      click(/SHOW YOUR ROLE/);
      const role=ui.screen.getByRole('heading',{level:2}).textContent;
      if(role==='Doctor' || role==='Seer') {chooseTargets();click('COMPLETE ACTION');finishPrivateResult();}
      else click('SKIP');
    }
    click('CONTINUE →');
    assert.equal(document.querySelector('.timer').textContent,'01:00');
    now+=30000;
    ui.act(()=>document.dispatchEvent(new window.Event('visibilitychange')));
    assert.equal(document.querySelector('.timer').textContent,'00:30');
    click('+1 MINUTE');
    assert.equal(document.querySelector('.timer').textContent,'01:30');
    now+=91000;
    ui.act(()=>document.dispatchEvent(new window.Event('visibilitychange')));
    assert.ok(ui.screen.getByRole('heading',{name:/who are you voting for/}));
  } finally {Date.now=originalNow;}
});

for (const random of [0,0.999]) {
  test(`Police silently blocks a Journalist regardless of turn order (random ${random})`, async () => {
    const names=['A','B','C','D','E','F'];
    startSetup(names,{firstNightSafe:true});
    click('Remove Doctor');click('Remove Seer');click('Add Police');click('Add Journalist');
    Math.random=()=>random;
    const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');
    const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));
    Object.assign(counts,{werewolf:1,police:1,journalist:1,villager:3});
    const lineup=deal(names,counts);
    const journalist=lineup.find(p=>p.role==='journalist').name;
    click(/START GAME/);click('CONTINUE →');
    for(let i=0;i<6;i++) {
      click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
      if(role==='Police') {
        const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===journalist);
        assert.ok(target);ui.fireEvent.click(target);click('COMPLETE ACTION');
      } else if(role==='Journalist') {
        ui.fireEvent.change(ui.screen.getByPlaceholderText('Write a headline'),{target:{value:'Tonight’s secret'}});
        click('PUBLISH IN THE MORNING');
      } else click('SKIP');
    }
    assert.ok(ui.screen.getByText('No one was killed tonight.'));
    assert.equal(ui.screen.queryByText('Tonight’s secret'),null);
    assert.equal(ui.screen.queryByText(/detained/i),null);
  });
}

test('Gambler prepares after two votes and only escapes after surviving the following night', async () => {
  const names=['A','B','C','D','E','F','G','H'];
  startSetup(names,{firstNightSafe:true});
  click('Remove Doctor');click('Remove Seer');click('Add Gambler');click('Add Villager');
  const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');
  const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));
  Object.assign(counts,{werewolf:1,gambler:1,villager:6});
  const lineup=deal(names,counts);
  const gambler=lineup.find(p=>p.role==='gambler').name;
  const villages=lineup.filter(p=>p.role==='villager').map(p=>p.name);
  const [v1,v2,night2Victim,night3Victim]=villages;
  const selectName=name=>{const button=availableTargets().find(b=>b.querySelector('strong')?.textContent===name);assert.ok(button,`cannot target ${name}`);ui.fireEvent.click(button);};
  click(/START GAME/);
  for(let round=1;round<=3;round++) {
    click('CONTINUE →');
    const turnCount=round===1?8:round===2?7:5;
    for(let i=0;i<turnCount;i++) {
      click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
      if(role==='Gambler') {
        if(round===3) {assert.ok(ui.screen.getByText(/If you survive tonight/));click('SKIP BET');}
        else {selectName(round===1?v1:v2);click('COMPLETE ACTION');}
      } else if(role==='Werewolf' && round>1) {selectName(round===2?night2Victim:night3Victim);click('COMPLETE ACTION');}
      else click('SKIP');
    }
    if(round===3) {
      assert.ok(ui.screen.getByText(new RegExp(`${gambler} escaped the village victorious`)));
      assert.equal(ui.screen.queryByText(new RegExp(`${gambler} died`)),null);
      break;
    }
    click('CONTINUE →');click('END DISCUSSION →');
    const target=round===1?v1:v2;
    const voters=round===1?8:6;
    for(let i=0;i<voters;i++) {
      const voter=ui.screen.getByRole('heading',{level:2}).textContent.split(',')[0];
      if(voter===target) click('SKIP VOTE'); else {selectName(target);click('VOTE');}
    }
    assert.ok(ui.screen.getByText(new RegExp(`${target} was executed`)));
    assert.equal(ui.screen.queryByText(/escaped the village victorious/),null);
    click('CONTINUE →');
  }
});

test('optional game sounds follow phases, can be muted and never block gameplay', () => {
  const originalAudio=globalThis.Audio;const instances=[];
  globalThis.Audio=class {
    constructor(){this.dataset={};this.src='';this.playCount=0;this.pauseCount=0;instances.push(this);}
    play(){this.playCount++;return Promise.resolve();}
    pause(){this.pauseCount++;}
  };
  try {
    startSetup(['A','B','C','D']);
    assert.equal(ui.screen.getByLabelText('Game sounds').checked,false);
    click(/START GAME/);assert.equal(instances.length,0);
    click('Enable game sounds');
    assert.equal(instances.length,1);assert.ok(instances[0].src.endsWith('/night.mp3'));
    assert.equal(ui.screen.getByRole('button',{name:'Mute game sounds'}).getAttribute('aria-pressed'),'true');
    click('CONTINUE →');
    for(let i=0;i<4;i++) {
      click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
      if(role==='Doctor' || role==='Seer') {chooseTargets();click('COMPLETE ACTION');finishPrivateResult();}
      else click('SKIP');
    }
    assert.ok(instances[0].src.endsWith('/day.mp3'));
    click('CONTINUE →');click('END DISCUSSION →');
    assert.ok(instances[0].src.endsWith('/vote.mp3'));
    click('Mute game sounds');assert.ok(instances[0].pauseCount>0);
    assert.equal(JSON.parse(localStorage.getItem('werewolf.settings')).sounds,false);
    assert.ok(ui.screen.getByRole('button',{name:'SKIP VOTE'}));
  } finally {ui.cleanup();globalThis.Audio=originalAudio;}
});

test('video-inspired automatic distribution preserves the lineup when Madman count is incompatible', () => {
  startSetup(['A','B','C','D'],{},false);
  click('Add Werewolf');
  ui.fireEvent.change(ui.screen.getByLabelText('Madmen (disguised roles)'),{target:{value:'1'}});
  click('RANDOM DISTRIBUTION');
  assert.match(ui.screen.getByRole('alert').textContent,/at most 0 Madmen/);
  assert.match(ui.screen.getByRole('button',{name:/START GAME/}).textContent,/1 \/ 4/);
  ui.fireEvent.change(ui.screen.getByLabelText('Madmen (disguised roles)'),{target:{value:'0'}});
  click('RANDOM DISTRIBUTION');
  assert.match(ui.screen.getByRole('button',{name:/START GAME/}).textContent,/4 \/ 4/);
});

test('player setup bottom sheets preserve avatar transfers and delete mode is explicit', () => {
  localStorage.setItem('werewolf.names',JSON.stringify(['A','B','C','D']));
  ui.render(React.createElement(App));click(/START GAME/);
  assert.equal(ui.screen.queryByRole('button',{name:'Remove A from this game'}),null);
  click('Edit A');click('Choose or change game avatar');
  assert.ok(ui.screen.getByRole('dialog',{name:'Choose photo or avatar'}));
  click(/Game avatars/);assert.ok(ui.screen.getByRole('dialog',{name:'Game avatars'}));
  click('Choose avatar 1');click('SAVE PLAYER');
  click('Edit B');click('Choose or change game avatar');click(/Game avatars/);click('Choose avatar 1');click('SAVE PLAYER');
  const avatars=JSON.parse(localStorage.getItem('werewolf.avatars.v1'));
  assert.ok(avatars.b.endsWith('/player1.webp'));assert.notEqual(avatars.a,avatars.b);
  assert.match(ui.screen.getByRole('status').textContent,/random unused avatar/);
  click('Delete players');assert.ok(ui.screen.getByText('DELETE MODE'));
  click('Remove D from this game');assert.equal(ui.screen.queryByRole('button',{name:'Remove D from this game'}),null);
  click('Exit delete mode');assert.ok(ui.screen.getByRole('button',{name:/CHOOSE ROLES/}).disabled);
});

test('rankings share sends only local standings after an explicit tap', async () => {
  localStorage.setItem('werewolf.names',JSON.stringify(['A','B','C','D']));
  localStorage.setItem('werewolf.rankings.v1',JSON.stringify([{name:'A',wins:2,played:3}]));
  let sent;const old=Object.getOwnPropertyDescriptor(globalThis.navigator,'share');
  Object.defineProperty(globalThis.navigator,'share',{configurable:true,value:async payload=>{sent=payload;}});
  try {
    ui.render(React.createElement(App));click(/START GAME/);click(/PLAYER LIBRARY/);click('ALL-TIME RANKINGS');
    assert.equal(sent,undefined);
    await ui.act(async()=>{click('SHARE');});
    assert.match(sent.text,/A — 2 wins \/ 3 games/);
  } finally {
    if(old) Object.defineProperty(globalThis.navigator,'share',old);else delete globalThis.navigator.share;
  }
});
