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
const click = name => {
  const button=ui.screen.getByRole('button',{name});
  if (button.classList.contains('hold-button')) {
    const original=globalThis.setTimeout;
    try { globalThis.setTimeout=(fn,ms,...args)=>ms===2000 ? (fn(...args),0) : original(fn,ms,...args); ui.fireEvent.keyDown(button,{key:'Enter'}); }
    finally { globalThis.setTimeout=original; }
  } else ui.fireEvent.click(button);
};
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
    const count=h.parentElement.querySelectorAll('.role-choice:not(.random-role-choice)').length;
    assert.ok(h.textContent.includes(`${count} / ${Object.keys(roles).length} ROLES`));
  }
  click('View Villager details');
  let dialog=ui.screen.getByRole('dialog');
  assert.ok(ui.within(dialog).getByAltText('Villager role artwork'));
  click('Next role');
  assert.equal(ui.within(dialog).queryByAltText('Villager role artwork'),null);
  click('Previous role');
  assert.ok(ui.within(dialog).getByAltText('Villager role artwork'));
  click('Close role details');
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
  assert.equal(counts.length,Object.keys(roles).length + 3);
  assert.ok(counts.every(count=>count.textContent==='0'));
  click('Add Werewolf');click('Add Villager');click('Add Villager');click('Add Doctor');
  assert.match(start.textContent,/4 \/ 4/);assert.equal(start.disabled,false);
  click('Remove Villager');assert.match(start.textContent,/3 \/ 4/);assert.equal(start.disabled,true);
  click('Go back');click(/CHOOSE ROLES/);
  assert.match(document.querySelector('.role-start-bar button').textContent,/0 \/ 4/);
});

test('Charmer forms a private bond and the Friends win only after opponents are gone', () => {
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
    if(player==='B') { assert.ok(partnerButton.disabled,'a friend must not vote to eliminate their partner'); assert.ok(ui.screen.getByText(/Your friend is D/)); }
    const desired=player==='A'?'C':'A';
    const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===desired);
    assert.ok(target);ui.fireEvent.click(target);click('VOTE');
  }
  assert.ok(ui.screen.getByText(/A was executed/));click('CONTINUE →');
  assert.ok(ui.screen.getByText(/NIGHT 2 STARTED/),'living opponents should prevent Friends victory');click('CONTINUE →');
  for(let i=0;i<3;i++) {
    click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if(role==='Charmer') assert.ok(ui.screen.getByText(/Your friend: B/));
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
  assert.ok(ui.screen.getByRole('heading',{name:'THE FRIENDS WIN'}));
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
    assert.equal(ui.screen.getByLabelText('Passive role wait seconds').value,'5');
    ui.fireEvent.change(ui.screen.getByLabelText('Passive role wait seconds'),{target:{value:'2'}});
    assert.equal(JSON.parse(localStorage.getItem('werewolf.settings')).passiveWaitSeconds,2);
    click(/START GAME/);click('CONTINUE →');
    let checkedPassive=false,checkedActive=false;
    for(let i=0;i<4;i++) {
      click(/SHOW YOUR ROLE/);
      const role=ui.screen.getByRole('heading',{level:2}).textContent;
      if(role==='Villager') {
        checkedPassive=true;
        assert.ok(ui.screen.getByRole('button',{name:'SKIP'}).disabled);
        assert.ok(ui.screen.getByRole('status').textContent.includes('2 seconds'));
        now+=2000;
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
  click('RANDOM DISTRIBUTION');click('BALANCED Even matchup');
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
  assert.deepEqual(rankings.winningPlayers(p,'friends',lovers,'', ''),[1,2,3,4]);
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
    assert.ok(instances[0].src.endsWith('/day.mp3'));
    assert.ok(instances[0].pauseCount>0, 'voting audio must be silent');
    click('Mute game sounds');assert.ok(instances[0].pauseCount>0);
    assert.equal(JSON.parse(localStorage.getItem('werewolf.settings')).sounds,false);
    assert.ok(ui.screen.getByRole('button',{name:'SKIP VOTE'}));
  } finally {ui.cleanup();globalThis.Audio=originalAudio;}
});

test('automatic distribution preserves the lineup when Madman count is incompatible', () => {
  startSetup(['A','B','C','D'],{},false);
  click('Add Werewolf');
  ui.fireEvent.change(ui.screen.getByLabelText('Madmen (disguised roles)'),{target:{value:'4'}});
  click('RANDOM DISTRIBUTION');click('BALANCED Even matchup');
  assert.match(ui.screen.getByRole('alert').textContent,/Not enough village roles/);
  assert.match(ui.screen.getByRole('button',{name:/START GAME/}).textContent,/1 \/ 4/);
  ui.fireEvent.change(ui.screen.getByLabelText('Madmen (disguised roles)'),{target:{value:'0'}});
  click('BALANCED Even matchup');
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


test('random team cards count selections and deal roles from the chosen teams', () => {
  startSetup(['A','B','C','D'],{},false);
  click('Add random WEREWOLVES role');
  click('Add random VILLAGERS role');
  click('Add random VILLAGERS role');
  click('Add random NEUTRALS role');
  assert.match(ui.screen.getByRole('button',{name:/START GAME/}).textContent,/4 \/ 4/);
  click('Remove random NEUTRALS role');
  assert.match(ui.screen.getByRole('button',{name:/START GAME/}).textContent,/3 \/ 4/);
  click('Add random NEUTRALS role');
  click(/START GAME/);
  assert.ok(ui.screen.getByText('NIGHT 1 STARTED'));
});


test('every-role wait is adjustable, persists, and delays active roles', async () => {
  const originalNow=Date.now; let now=originalNow(); Date.now=()=>now;
  try {
    startSetup(['A','B','C','D']);
    ui.fireEvent.click(ui.screen.getByLabelText('Wait time for every role'));
    ui.fireEvent.change(ui.screen.getByLabelText('Every role wait seconds'),{target:{value:'2'}});
    assert.equal(JSON.parse(localStorage.getItem('werewolf.settings')).allRolesWaitSeconds,2);
    click(/START GAME/);click('CONTINUE →');click(/SHOW YOUR ROLE/);
    assert.ok(ui.screen.getByRole('status').textContent.includes('2 seconds'));
    assert.ok(document.querySelector('.role-turn-content').disabled);
    now+=2000;await ui.act(async()=>{await new Promise(resolve=>setTimeout(resolve,300));});
    assert.equal(document.querySelector('.role-turn-content').disabled,false);
  } finally {Date.now=originalNow;}
});

test('public reports require a continuous two-second hold', async () => {
  const {default:HoldButton}=await vite.ssrLoadModule('/src/HoldButton.tsx');
  let completed=0;ui.render(React.createElement(HoldButton,{onComplete:()=>completed++}));
  const button=ui.screen.getByRole('button',{name:'CONTINUE →'});
  ui.fireEvent.click(button);assert.equal(completed,0);
  ui.fireEvent.keyDown(button,{key:'Enter'});ui.fireEvent.keyUp(button,{key:'Enter'});
  await ui.act(async()=>{await new Promise(resolve=>setTimeout(resolve,50));});assert.equal(completed,0);
  ui.fireEvent.keyDown(button,{key:'Enter'});
  await ui.act(async()=>{await new Promise(resolve=>setTimeout(resolve,2100));});
  assert.equal(completed,1);
});


test('villager role settings persist and change Doctor and Sheriff abilities', async () => {
  const names=['A','B','C','D','E']; startSetup(names,{firstNightSafe:false},false);
  for(const role of ['Werewolf','Doctor','Sheriff','Villager','Villager']) click('Add '+role);
  click('View Doctor details');
  ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
  ui.fireEvent.click(ui.screen.getByLabelText('Protect yourself'));
  ui.fireEvent.click(ui.screen.getByLabelText('Protect the same player on consecutive nights'));
  assert.match(ui.screen.getByText(/You cannot protect yourself/).textContent,/consecutive nights/);
  click('Close role details');
  click('View Sheriff details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
  ui.fireEvent.click(ui.screen.getByLabelText('One shot every night'));click('Close role details');
  const saved=JSON.parse(localStorage.getItem('werewolf.settings'));
  assert.equal(saved.doctorSelfProtect,false);assert.equal(saved.doctorRepeatProtect,true);assert.equal(saved.sheriffEveryNight,true);
  const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');
  const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:1,doctor:1,sheriff:1,villager:2});
  const lineup=deal(names,counts), villager=lineup.find(p=>p.role==='villager').name, victim=lineup.filter(p=>p.role==='villager')[1].name, doctor=lineup.find(p=>p.role==='doctor').name;
  click(/START GAME/);click('CONTINUE →');
  for(let i=0;i<5;i++){
    click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if(role==='Doctor'){const self=[...document.querySelectorAll('button.target')].find(b=>b.querySelector('strong')?.textContent===doctor);assert.ok(self.disabled);const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===villager);ui.fireEvent.click(target);click('COMPLETE ACTION');}
    else if(role==='Sheriff' || role==='Werewolf'){const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===(role==='Sheriff'?victim:villager));ui.fireEvent.click(target);click('COMPLETE ACTION');}
    else click('SKIP');
  }
  click('CONTINUE →');click('END DISCUSSION →');for(let i=0;i<4;i++)click('SKIP VOTE');
  click('CONTINUE →');click('CONTINUE →');
  for(let i=0;i<4;i++){
    click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if(role==='Doctor'){assert.ok(availableTargets().some(b=>b.querySelector('strong')?.textContent===villager),'doctor can repeat their protection');chooseTargets();click('COMPLETE ACTION');}
    else if(role==='Werewolf'){chooseTargets();click('COMPLETE ACTION');}
    else if(role==='Sheriff'){assert.ok(availableTargets().length>0);click('SAVE BULLET FOR LATER');}
    else click('SKIP');
  }
});

test('villager role use limits are configurable and saved in role details', () => {
  startSetup(['A','B','C','D'],{},false);
  for(const [role,key] of [['Templar','templarUses'],['Necromancer','necromancerUses'],['Instigator','instigatorMaxUses']]) {
    click(`View ${role} details`);ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
    const input=ui.screen.getByLabelText(`${role} uses per game`);
    ui.fireEvent.change(input,{target:{value:'3'}});
    assert.equal(input.value,'3');
    assert.equal(JSON.parse(localStorage.getItem('werewolf.settings'))[key],3);
    click('Close role details');
  }
});

test('Instigator can use the configured number of provocations', async () => {
  const names=['A','B','C','D','E','F','G','H'];
  startSetup(names,{instigatorMaxUses:3,doctorRepeatProtect:true},false);
  for(const role of ['Werewolf','Doctor','Instigator','Villager','Villager','Villager','Villager','Villager']) click('Add '+role);
  const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');
  const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:1,doctor:1,instigator:1,villager:5});
  const protectedName=deal(names,counts).find(p=>p.role==='villager').name;
  click(/START GAME/);
  for(let round=1;round<=4;round++) {
    click('CONTINUE →');
    for(let i=0;i<8;i++) {
      click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
      if(role==='Instigator') {
        if(round<=3){assert.ok(availableTargets().length>0);chooseTargets();click('COMPLETE ACTION');}
        else {assert.equal(availableTargets().length,0);click('SKIP');}
      } else if(role==='Doctor' || (role==='Werewolf' && round>1)) {
        const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===protectedName);assert.ok(target);ui.fireEvent.click(target);click('COMPLETE ACTION');
      } else click('SKIP');
    }
    if(round===4)break;
    click('CONTINUE →');click('END DISCUSSION →');
    for(let i=0;i<8;i++)click('SKIP VOTE');
    click('CONTINUE →');
  }
});

test('Templar can use two configured shots on separate nights', async () => {
  const names=['A','B','C','D','E','F','G'];
  startSetup(names,{templarUses:2,doctorRepeatProtect:true,firstNightSafe:false},false);
  for(const role of ['Werewolf','Werewolf','Doctor','Templar','Villager','Villager','Villager']) click('Add '+role);
  const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:2,doctor:1,templar:1,villager:3});
  const lineup=deal(names,counts), wolves=lineup.filter(p=>p.role==='werewolf').map(p=>p.name), protectedName=lineup.find(p=>p.role==='villager').name;
  click(/START GAME/);
  for(let round=1;round<=2;round++) {
    click('CONTINUE →');
    for(let i=0;i<(round===1?7:6);i++) {
      click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
      if(role==='Werewolf' || role==='Doctor' || role==='Templar') {
        const desired=role==='Templar'?wolves[round-1]:protectedName;
        const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===desired);assert.ok(target,`${role} cannot select ${desired}`);ui.fireEvent.click(target);click('COMPLETE ACTION');
      } else click('SKIP');
    }
    if(round===2){assert.ok(ui.screen.getByText(new RegExp(`${wolves[1]} died`)));break;}
    click('CONTINUE →');click('END DISCUSSION →');for(let i=0;i<6;i++)click('SKIP VOTE');click('CONTINUE →');
  }
});

test('Necromancer can revive twice when configured, then runs out', async () => {
  const names=['A','B','C','D','E','F'];startSetup(names,{necromancerUses:2,firstNightSafe:false},false);
  for(const role of ['Werewolf','Necromancer','Villager','Villager','Villager','Villager']) click('Add '+role);
  const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:1,necromancer:1,villager:4});
  const villagers=deal(names,counts).filter(p=>p.role==='villager').map(p=>p.name);
  click(/START GAME/);
  for(let round=1;round<=4;round++) {
    click('CONTINUE →');
    for(let i=0;i<(round===1?6:5);i++) {
      click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
      if(role==='Werewolf') {
        const desired=round===1?villagers[0]:round===2?villagers[1]:round===3?villagers[0]:villagers[2];
        const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===desired);assert.ok(target);ui.fireEvent.click(target);click('COMPLETE ACTION');
      } else if(role==='Necromancer' && (round===2 || round===3)) {
        const desired=round===2?villagers[0]:villagers[1];
        const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===desired);assert.ok(target);ui.fireEvent.click(target);click('COMPLETE ACTION');
      } else if(role==='Necromancer' && round===4) {assert.equal(availableTargets().length,0);click('SKIP');}
      else click('SKIP');
    }
    if(round===4) break;
    click('CONTINUE →');click('END DISCUSSION →');for(let i=0;i<5;i++)click('SKIP VOTE');click('CONTINUE →');
  }
});

test('information role settings save in their role screens', () => {
  startSetup(['A','B','C','D'],{},false);
  click('View Celebrity details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
  ui.fireEvent.change(ui.screen.getByLabelText('Celebrity audience'),{target:{value:'3'}});click('Close role details');
  click('View Intelligence Chief details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
  ui.fireEvent.change(ui.screen.getByLabelText('Intelligence report interval'),{target:{value:'1'}});click('Close role details');
  click('View Detective details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
  ui.fireEvent.click(ui.screen.getByLabelText("Show visitors' names"));click('Close role details');
  const saved=JSON.parse(localStorage.getItem('werewolf.settings'));
  assert.equal(saved.celebrityAudience,3);assert.equal(saved.intelligenceInterval,1);assert.equal(saved.detectiveShowNames,false);
});

test('intelligence interval can provide a report on the first night', () => {
  startSetup(['A','B','C','D'],{intelligenceInterval:1},false);
  for(const role of ['Werewolf','Intelligence Chief','Villager','Villager'])click('Add '+role);
  click(/START GAME/);click('CONTINUE →');let found=false;
  for(let i=0;i<4;i++){
    click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if(role==='Intelligence Chief'){found=true;assert.ok(ui.screen.getByText(/Your intelligence report is ready/));click('VIEW INTEL');finishPrivateResult();}
    else click('SKIP');
  }
  assert.ok(found);
});

test('Detective can see a visitor count instead of names', async () => {
  const names=['A','B','C','D','E'];startSetup(names,{detectiveShowNames:false,firstNightSafe:false,doctorRepeatProtect:true},false);
  for(const role of ['Werewolf','Doctor','Detective','Villager','Villager'])click('Add '+role);
  const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:1,doctor:1,detective:1,villager:2});
  const targetName=deal(names,counts).find(p=>p.role==='villager').name;
  click(/START GAME/);click('CONTINUE →');
  for(let i=0;i<5;i++){
    click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if(['Werewolf','Doctor','Detective'].includes(role)){const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===targetName);ui.fireEvent.click(target);click('COMPLETE ACTION');}else click('SKIP');
  }
  click('CONTINUE →');click('END DISCUSSION →');for(let i=0;i<5;i++)click('SKIP VOTE');click('CONTINUE →');click('CONTINUE →');
  let checked=false;
  for(let i=0;i<5;i++){
    click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if(role==='Detective'){const report=ui.screen.getByText(/Last night’s visitors to/).textContent;assert.match(report,/: \d+ visitors?$/);checked=true;chooseTargets();click('COMPLETE ACTION');}
    else if(role==='Werewolf' || role==='Doctor'){const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===targetName);ui.fireEvent.click(target);click('COMPLETE ACTION');}
    else click('SKIP');
  }
  assert.ok(checked);
});

test('a disguised Madman Detective uses the same count-only report format', () => {
  startSetup(['A','B','C','D','E'],{detectiveShowNames:false,madmanCount:1},false);
  for(const role of ['Werewolf','Detective','Villager','Villager','Villager'])click('Add '+role);
  click(/START GAME/);click('CONTINUE →');
  for(let i=0;i<5;i++){
    click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if(role==='Detective'){chooseTargets();click('COMPLETE ACTION');}else click('SKIP');
  }
  click('CONTINUE →');click('END DISCUSSION →');for(let i=0;i<5;i++)click('SKIP VOTE');click('CONTINUE →');click('CONTINUE →');
  let checked=false;
  for(let i=0;i<5;i++){
    click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if(role==='Detective'){assert.match(ui.screen.getByText(/Last night’s visitors to/).textContent,/: 0 visitors$/);checked=true;chooseTargets();click('COMPLETE ACTION');}
    else if(role==='Werewolf'){chooseTargets();click('COMPLETE ACTION');}else click('SKIP');
  }
  assert.ok(checked);
});

test('Seer and Sick Man role settings save and affect descriptions and private results', async () => {
  const names=['A','B','C','D'];startSetup(names,{},false);
  for(const role of ['Werewolf','Seer','Sick Man','Villager'])click('Add '+role);
  click('View Seer details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));ui.fireEvent.click(ui.screen.getByLabelText('Show exact role'));click('Close role details');
  click('View Sick Man details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
  ui.fireEvent.change(ui.screen.getByLabelText('Sick Man starting nights'),{target:{value:'5'}});
  ui.fireEvent.change(ui.screen.getByLabelText('Sick Man Doctor visit bonus'),{target:{value:'1'}});click('Close role details');
  const stored=JSON.parse(localStorage.getItem('werewolf.settings'));assert.equal(stored.seerShowExactRole,false);assert.equal(stored.sickStartingNights,5);assert.equal(stored.sickDoctorBonus,1);
  const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:1,seer:1,sickman:1,villager:1});
  const wolf=deal(names,counts).find(p=>p.role==='werewolf').name;
  click(/START GAME/);click('CONTINUE →');let sawSeer=false,sawSick=false;
  for(let i=0;i<4;i++){
    click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
    if(role==='Seer'){sawSeer=true;const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===wolf);ui.fireEvent.click(target);click('COMPLETE ACTION');assert.ok(ui.screen.getByText(`${wolf} is a Werewolf.`));finishPrivateResult();}
    else if(role==='Sick Man'){sawSick=true;assert.ok(ui.screen.getByText(/Nights remaining without a Doctor visit: 5/));click('SKIP');}
    else click('SKIP');
  }
  assert.ok(sawSeer && sawSick);
});

test('Mayor, Chef and Visitor settings save from role details',()=>{
 startSetup(['A','B','C','D'],{},false);
 for(const [role,labels] of [['Mayor',['Double vote after assembly']],['Chef',['Neutral roles count as one team']],['Visitor',['Danger when visiting a Werewolf or Serial Killer','Danger when the host is attacked']]]){
   click(`View ${role} details`);ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
   for(const label of labels)ui.fireEvent.click(ui.screen.getByLabelText(label));
   click('Close role details');
 }
 const saved=JSON.parse(localStorage.getItem('werewolf.settings'));
 assert.equal(saved.mayorDoubleVote,false);assert.equal(saved.chefNeutralsTogether,false);assert.equal(saved.visitorDangerousRoles,false);assert.equal(saved.visitorAttackedTarget,false);
});

for(const enabled of [true,false])test(`Mayor double vote ${enabled?'on':'off'} changes the result`,async()=>{
 const names=['A','B','C','D','E','F'];startSetup(names,{mayorDoubleVote:enabled},false);
 for(const role of ['Werewolf','Mayor','Villager','Villager','Villager','Villager'])click('Add '+role);
 const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:1,mayor:1,villager:4});
 const mayor=deal(names,counts).find(p=>p.role==='mayor').name;const [a,b,other]=names.filter(n=>n!==mayor);
 click(/START GAME/);click('CONTINUE →');
 for(let i=0;i<6;i++){click(/SHOW YOUR ROLE/);if(ui.screen.getByRole('heading',{level:2}).textContent==='Mayor')click('DECLARE EMERGENCY ASSEMBLY');else click('SKIP');}
 click('CONTINUE →');click('END DISCUSSION →');
 for(let i=0;i<6;i++){
   const voter=ui.screen.getByRole('heading',{level:2}).textContent.split(',')[0];
   const desired=voter===mayor||voter===b?a:voter===a||voter===other?b:null;
   if(desired){const target=availableTargets().find(x=>x.querySelector('strong')?.textContent===desired);assert.ok(target);ui.fireEvent.click(target);click('VOTE');}else click('SKIP VOTE');
 }
 assert.ok(ui.screen.getByText(enabled?new RegExp(`${a} was executed`):/No one was executed/));
});

test('Chef uses configured neutral-team rule for the private report',async()=>{
 const names=['A','B','C','D','E','F'];startSetup(names,{chefNeutralsTogether:false},false);
 for(const role of ['Werewolf','Chef','Jester','Survivor','Villager','Villager'])click('Add '+role);
 const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:1,chef:1,jester:1,survivor:1,villager:2});
 const lineup=deal(names,counts),targets=lineup.filter(p=>['jester','survivor'].includes(p.role)).map(p=>p.name);
 click(/START GAME/);click('CONTINUE →');let checked=false;
 for(let i=0;i<6;i++){
   click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
   if(role==='Chef'){for(const name of targets){const target=availableTargets().find(x=>x.querySelector('strong')?.textContent===name);ui.fireEvent.click(target);}click('COMPLETE ACTION');assert.ok(ui.screen.getByText(/guests are on different teams/));checked=true;finishPrivateResult();}
   else click('SKIP');
 }
 assert.ok(checked);
});

for(const danger of [true,false])test(`Visitor dangerous-role option ${danger?'on':'off'} changes night outcome`,async()=>{
 const names=['A','B','C','D','E'];startSetup(names,{visitorDangerousRoles:danger},false);
 for(const role of ['Werewolf','Visitor','Villager','Villager','Villager'])click('Add '+role);
 const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:1,visitor:1,villager:3});
 const lineup=deal(names,counts),wolf=lineup.find(p=>p.role==='werewolf').name,visitor=lineup.find(p=>p.role==='visitor').name;
 click(/START GAME/);click('CONTINUE →');
 for(let i=0;i<5;i++){
   click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
   if(role==='Visitor'){const target=availableTargets().find(x=>x.querySelector('strong')?.textContent===wolf);ui.fireEvent.click(target);click('COMPLETE ACTION');}else click('SKIP');
 }
 assert.ok(ui.screen.getByText(danger?new RegExp(`${visitor} died`):'No one was killed tonight.'));
});

test('Bodyguard, Police, Journalist and Psychic options save in role details',()=>{
 startSetup(['A','B','C','D'],{},false);
 for(const [role,label] of [['Bodyguard','Protect players on any team'],['Police','Detain the same player on consecutive nights'],['Journalist','Allow newspaper drawings'],['Psychic','Identify the Friends team']]) {
   click(`View ${role} details`);ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));ui.fireEvent.click(ui.screen.getByLabelText(label));click('Close role details');
 }
 const saved=JSON.parse(localStorage.getItem('werewolf.settings'));
 assert.equal(saved.bodyguardProtectAll,true);assert.equal(saved.policeRepeatTarget,true);assert.equal(saved.journalistDrawing,false);assert.equal(saved.psychicShowFriends,false);
});

test('Journalist can publish a headline without drawing when drawing is disabled',()=>{
 startSetup(['A','B','C','D'],{journalistDrawing:false},false);
 for(const role of ['Werewolf','Journalist','Villager','Villager'])click('Add '+role);
 click(/START GAME/);click('CONTINUE →');let saw=false;
 for(let i=0;i<4;i++){
   click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
   if(role==='Journalist'){saw=true;assert.equal(ui.screen.queryByLabelText('Draw your newspaper picture'),null);ui.fireEvent.change(ui.screen.getByPlaceholderText('Write a headline'),{target:{value:'Important news'}});click('PUBLISH IN THE MORNING');}else click('SKIP');
 }
 assert.ok(saw);assert.ok(ui.screen.getByText('Important news'));assert.equal(document.querySelector('.newspaper img'),null);
});

test('Police can repeat a detention when enabled while blocking remains silent',()=>{
 startSetup(['A','B','C','D','E','F'],{firstNightSafe:false,policeRepeatTarget:true});
 click('Remove Seer');click('Add Sheriff');click('Remove Doctor');click('Add Police');
 click(/START GAME/);click('CONTINUE →');
 for(let i=0;i<6;i++){
   click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
   if(['Werewolf','Sheriff','Police'].includes(role)){const desired=role==='Werewolf'?'B':role==='Sheriff'?'C':'E';const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===desired);assert.ok(target);ui.fireEvent.click(target);click('COMPLETE ACTION');}else click('SKIP');
 }
 assert.ok(ui.screen.getByText(/B died/));assert.equal(ui.screen.queryByText(/C died/),null);
 click('CONTINUE →');click('END DISCUSSION →');for(let i=0;i<5;i++)click('SKIP VOTE');click('CONTINUE →');click('CONTINUE →');let saw=false;
 for(let i=0;i<5;i++){
   click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
   if(role==='Police'){const oldTarget=availableTargets().find(b=>b.querySelector('strong')?.textContent==='E');assert.ok(oldTarget);saw=true;ui.fireEvent.click(oldTarget);click('COMPLETE ACTION');}
   else if(role==='Werewolf'){chooseTargets();click('COMPLETE ACTION');}
   else if(role==='Sheriff'){assert.equal(ui.screen.queryByText(/detained|blocked/i),null);click('SAVE BULLET FOR LATER');}
   else click('SKIP');
 }
 assert.ok(saw);
});

for(const showFriends of [true,false])test(`Psychic ${showFriends?'identifies':'conceals'} the Friends team`,async()=>{
 const names=['A','B','C','D','E','F'];startSetup(names,{psychicShowFriends:showFriends},false);
 for(const role of ['Werewolf','Psychic','Charmer','Villager','Villager','Villager'])click('Add '+role);
 const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:1,psychic:1,charmer:1,villager:3});
 const lineup=deal(names,counts),friend=lineup.find(p=>p.role==='villager').name,charmer=lineup.find(p=>p.role==='charmer').name;
 click(/START GAME/);
 for(let round=1;round<=2;round++){
   click('CONTINUE →');
   for(let i=0;i<6;i++){
     click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
     if(role==='Charmer' && round===1){const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===friend);ui.fireEvent.click(target);click('COMPLETE ACTION');}
     else if(role==='Psychic'){const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===charmer);ui.fireEvent.click(target);click('COMPLETE ACTION');if(round===2)assert.ok(ui.screen.getByText(`${charmer} belongs to the ${showFriends?'friends':'neutral'} team.`));finishPrivateResult();}
     else if(role==='Werewolf' && round===2){chooseTargets();click('COMPLETE ACTION');}
     else click('SKIP');
   }
   if(round===1){click('CONTINUE →');click('END DISCUSSION →');for(let i=0;i<6;i++)click('SKIP VOTE');click('CONTINUE →');}
 }
});

test('Bodyguard protects a neutral target when any-team protection is enabled',async()=>{
 const names=['A','B','C','D','E','F'];startSetup(names,{bodyguardProtectAll:true,firstNightSafe:false},false);
 for(const role of ['Werewolf','Sheriff','Bodyguard','Jester','Villager','Villager'])click('Add '+role);
 const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:1,sheriff:1,bodyguard:1,jester:1,villager:2});
 const lineup=deal(names,counts),jester=lineup.find(p=>p.role==='jester').name,guard=lineup.find(p=>p.role==='bodyguard').name,villager=lineup.find(p=>p.role==='villager').name;
 click(/START GAME/);click('CONTINUE →');
 for(let i=0;i<6;i++){
   click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
   if(['Werewolf','Sheriff','Bodyguard'].includes(role)){const name=role==='Werewolf'?villager:jester;const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===name);assert.ok(target);ui.fireEvent.click(target);click('COMPLETE ACTION');}else click('SKIP');
 }
 assert.ok(ui.screen.getByText(new RegExp(`${guard} died`)));assert.equal(ui.screen.queryByText(new RegExp(`${jester} died`)),null);
});

test('individual Villager waits persist and the longest applicable wait wins',async()=>{
 const originalNow=Date.now;let now=originalNow();Date.now=()=>now;
 try {
   startSetup(['A','B','C','D'],{allRolesWait:true,allRolesWaitSeconds:2},false);
   for(const role of ['Werewolf','Villager','Villager','Muted'])click('Add '+role);
   for(const [role,seconds] of [['Villager','1'],['Muted','3']]){
     click(`View ${role} details`);ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
     ui.fireEvent.change(ui.screen.getByLabelText(`${role} minimum wait seconds`),{target:{value:seconds}});click('Close role details');
   }
   assert.deepEqual(JSON.parse(localStorage.getItem('werewolf.settings')).roleWaitSeconds,{villager:1,muted:3});
   click('View Villager details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));assert.equal(ui.screen.getByLabelText('Villager minimum wait seconds').value,'1');click('Close role details');
   click(/START GAME/);click('CONTINUE →');let sawMuted=false,sawVillager=false,sawWolf=false;
   for(let i=0;i<4;i++){
     click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
     const expected=role==='Muted'?3:2;
     if(role==='Muted')sawMuted=true;else if(role==='Villager')sawVillager=true;else if(role==='Werewolf')sawWolf=true;
     assert.ok(ui.screen.getByRole('status').textContent.includes(`${expected} seconds`));
     assert.ok(ui.screen.getByRole('button',{name:'SKIP'}).disabled);
     now+=expected*1000;await ui.act(async()=>{await new Promise(resolve=>setTimeout(resolve,300));});
     assert.equal(ui.screen.getByRole('button',{name:'SKIP'}).disabled,false);click('SKIP');
   }
   assert.ok(sawMuted && sawVillager && sawWolf);
 } finally {Date.now=originalNow;}
});

test('Random button adds unique roster players without saving them to the library',()=>{
 localStorage.setItem('werewolf.names','[]');localStorage.setItem('werewolf.library.v1',JSON.stringify([{name:'Alex',avatar:''}]));Math.random=()=>0;
 ui.render(React.createElement(App));click(/START GAME/);
 for(let i=0;i<16;i++)click('RANDOM');
 const names=JSON.parse(localStorage.getItem('werewolf.names'));
 const library=JSON.parse(localStorage.getItem('werewolf.library.v1'));
 const avatars=JSON.parse(localStorage.getItem('werewolf.avatars.v1'));
 assert.equal(names.length,16);assert.equal(new Set(names.map(n=>n.toLowerCase())).size,16);assert.ok(!names.includes('Alex'));
 assert.deepEqual(library,[{name:'Alex',avatar:''}]);assert.ok(names.every(n=>!library.some(p=>p.name===n)));
 const assigned=names.map(n=>avatars[n.toLowerCase()]).filter(Boolean);assert.equal(assigned.length,16);assert.equal(new Set(assigned).size,16);
 assert.ok(assigned.some(a=>a.startsWith('data:image/svg+xml,')));
 assert.match(ui.screen.getByRole('status').textContent,/added to this game/);
 for(let i=0;i<8;i++)click('RANDOM');
 const fullNames=JSON.parse(localStorage.getItem('werewolf.names'));const fullAvatars=JSON.parse(localStorage.getItem('werewolf.avatars.v1'));
 assert.equal(fullNames.length,24);assert.equal(new Set(fullNames.map(n=>fullAvatars[n.toLowerCase()])).size,24);
 click('RANDOM');assert.match(ui.screen.getByRole('alert').textContent,/up to 24 players/);
});

test('Wolf Pup revenge setting saves and lets the pack choose three targets',async()=>{
 const names=['A','B','C','D','E','F','G','H'];startSetup(names,{firstNightSafe:false},false);
 for(const role of ['Werewolf','Wolf Pup','Sheriff','Villager','Villager','Villager','Villager','Villager'])click('Add '+role);
 click('View Wolf Pup details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
 ui.fireEvent.change(ui.screen.getByLabelText('Wolf Pup revenge targets'),{target:{value:'3'}});click('Close role details');
 assert.equal(JSON.parse(localStorage.getItem('werewolf.settings')).wolfPupAttackCount,3);
 const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:1,wolfpup:1,sheriff:1,villager:5});
 const lineup=deal(names,counts),pup=lineup.find(p=>p.role==='wolfpup').name, firstVictim=lineup.find(p=>p.role==='villager').name;
 click(/START GAME/);click('CONTINUE →');
 for(let i=0;i<8;i++){
   click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
   if(['Werewolf','Wolf Pup','Sheriff'].includes(role)){const desired=role==='Sheriff'?pup:firstVictim;const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===desired);assert.ok(target);ui.fireEvent.click(target);click('COMPLETE ACTION');}else click('SKIP');
 }
 assert.ok(ui.screen.getByText(new RegExp(`${pup} died`)));
 click('CONTINUE →');click('END DISCUSSION →');for(let i=0;i<6;i++)click('SKIP VOTE');click('CONTINUE →');click('CONTINUE →');let checked=false;
 for(let i=0;i<6;i++){
   click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
   if(role==='Werewolf'){assert.ok(ui.screen.getByText(/Choose 3 targets/));chooseTargets(3);click('COMPLETE ACTION');checked=true;}else click('SKIP');
 }
 assert.ok(checked);assert.equal((ui.screen.getByText(/died/).textContent.match(/died/g)||[]).length,3);
});

test('random players remain in the roster after reopening but not the player library',()=>{
 localStorage.setItem('werewolf.names','[]');Math.random=()=>0;ui.render(React.createElement(App));click(/START GAME/);click('RANDOM');
 const name=JSON.parse(localStorage.getItem('werewolf.names'))[0],avatar=JSON.parse(localStorage.getItem('werewolf.avatars.v1'))[name.toLowerCase()];
 click('PLAYER LIBRARY');assert.ok(ui.screen.getByText('PLAYER LIBRARY EMPTY'));
 ui.cleanup();ui.render(React.createElement(App));click(/START GAME/);
 assert.ok(ui.screen.getByRole('button',{name:`Edit ${name}`}));assert.equal(JSON.parse(localStorage.getItem('werewolf.avatars.v1'))[name.toLowerCase()],avatar);
 click('PLAYER LIBRARY');assert.ok(ui.screen.getByText('PLAYER LIBRARY EMPTY'));
});

test('Rabid and Hypnotist Werewolf settings save in their role details',()=>{
 startSetup(['A','B','C','D'],{},false);
 click('View Rabid Werewolf details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));ui.fireEvent.click(ui.screen.getByLabelText('Allow first-night infection'));click('Close role details');
 click('View Hypnotist Werewolf details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));ui.fireEvent.change(ui.screen.getByLabelText('Hypnotist Werewolf hypnosis uses'),{target:{value:'2'}});click('Close role details');
 const settings=JSON.parse(localStorage.getItem('werewolf.settings'));assert.equal(settings.rabidCanInfect,false);assert.equal(settings.hypnoMaxUses,2);
});

for(const enabled of [true,false])test(`Rabid infection is ${enabled?'enabled':'disabled'} on first night`,async()=>{
 const names=['A','B','C','D','E','F'];startSetup(names,{rabidCanInfect:enabled},false);
 for(const role of ['Rabid Werewolf','Doctor','Villager','Villager','Villager','Villager'])click('Add '+role);
 const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{rabidwolf:1,doctor:1,villager:4});
 const targetName=deal(names,counts).find(p=>p.role==='villager').name;
 click(/START GAME/);click('CONTINUE →');
 for(let i=0;i<6;i++){
   click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
   if(role==='Rabid Werewolf'){
     if(enabled){const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===targetName);assert.ok(target);ui.fireEvent.click(target);click('COMPLETE ACTION');}
     else {assert.equal(availableTargets().length,0);assert.ok(ui.screen.getByText(/Infection is disabled/));click('SKIP');}
   } else if(role==='Doctor'){chooseTargets();click('COMPLETE ACTION');} else click('SKIP');
 }
 click('CONTINUE →');click('END DISCUSSION →');for(let i=0;i<6;i++)click('SKIP VOTE');click('CONTINUE →');click('CONTINUE →');let checked=false;
 for(let i=0;i<6;i++){
   const player=ui.screen.getByRole('heading',{level:2}).textContent;
   click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
   if(player===targetName){assert.equal(role,enabled?'Werewolf':'Villager');checked=true;}
   if(role==='Doctor'||role==='Werewolf'||role==='Rabid Werewolf'){chooseTargets();click('COMPLETE ACTION');}else click('SKIP');
 }
 assert.ok(checked);
});

test('Hypnotist gets configured uses across nights, then runs out',async()=>{
 const names=['A','B','C','D','E','F','G','H'];startSetup(names,{hypnoMaxUses:2,doctorRepeatProtect:true},false);
 for(const role of ['Werewolf','Hypnotist Werewolf','Doctor','Villager','Villager','Villager','Villager','Villager'])click('Add '+role);
 const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:1,hypnowolf:1,doctor:1,villager:5});
 const villagers=deal(names,counts).filter(p=>p.role==='villager').map(p=>p.name),protectedName=villagers[0];
 click(/START GAME/);
 for(let round=1;round<=3;round++){
   click('CONTINUE →');let saw=false;
   for(let i=0;i<8;i++){
     click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
     if(role==='Hypnotist Werewolf'){
       if(round===1)click('SKIP');else {const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===protectedName);ui.fireEvent.click(target);click('COMPLETE ACTION');}
       if(round<=2){assert.ok(ui.screen.getByRole('button',{name:'HYPNOTIZE'}));const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===villagers[round]);assert.ok(target);ui.fireEvent.click(target);click('HYPNOTIZE');}
       else assert.equal(ui.screen.queryByRole('button',{name:'HYPNOTIZE'}),null);
       saw=true;
     } else if(role==='Doctor' || (role==='Werewolf' && round>1)){const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===protectedName);ui.fireEvent.click(target);click('COMPLETE ACTION');}else click('SKIP');
   }
   assert.ok(saw);
   if(round<3){click('CONTINUE →');click('END DISCUSSION →');for(let i=0;i<8;i++)click('SKIP VOTE');click('CONTINUE →');}
 }
});

test('remaining Werewolf role settings save from their detail screens',()=>{
 startSetup(['A','B','C','D'],{},false);
 click('View Werewolf details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));ui.fireEvent.click(ui.screen.getByLabelText('Randomly break tied pack votes'));click('Close role details');
 for(const role of ['Lone Werewolf','Strong Werewolf']){click(`View ${role} details`);ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));ui.fireEvent.change(ui.screen.getByLabelText(`${role} attack interval`),{target:{value:'2'}});click('Close role details');}
 const settings=JSON.parse(localStorage.getItem('werewolf.settings'));assert.equal(settings.wolfRandomTies,true);assert.equal(settings.loneWolfInterval,2);assert.equal(settings.strongWolfInterval,2);
});

for(const role of ['Lone Werewolf','Strong Werewolf'])test(`${role} follows its configured independent attack interval`,async()=>{
 const names=['A','B','C','D','E','F'];startSetup(names,{firstNightSafe:false,doctorRepeatProtect:true},false);
 for(const r of [role,'Doctor','Villager','Villager','Villager','Villager'])click('Add '+r);
 click(`View ${role} details`);ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));ui.fireEvent.change(ui.screen.getByLabelText(`${role} attack interval`),{target:{value:'2'}});click('Close role details');
 const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{[role==='Lone Werewolf'?'lonewolf':'strongwolf']:1,doctor:1,villager:4});
 const protectedName=deal(names,counts).find(p=>p.role==='villager').name;
 click(/START GAME/);
 for(let round=1;round<=3;round++){
   click('CONTINUE →');let saw=false;
   for(let i=0;i<6;i++){
     click(/SHOW YOUR ROLE/);const current=ui.screen.getByRole('heading',{level:2}).textContent;
     if(current===role){saw=true;if(round===2){const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===protectedName);assert.ok(target);ui.fireEvent.click(target);click('COMPLETE ACTION');}else{assert.equal(availableTargets().length,0);assert.ok(ui.screen.getByText(/No independent attack tonight/));click('SKIP');}}
     else if(current==='Doctor'){const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===protectedName);ui.fireEvent.click(target);click('COMPLETE ACTION');}
     else click('SKIP');
   }
   assert.ok(saw);assert.ok(ui.screen.getByText('No one was killed tonight.'));
   if(round<3){click('CONTINUE →');click('END DISCUSSION →');for(let i=0;i<6;i++)click('SKIP VOTE');click('CONTINUE →');}
 }
});

for(const randomTies of [true,false])test(`pack vote tie ${randomTies?'randomly chooses a target':'causes no kill'}`,async()=>{
 const names=['A','B','C','D','E','F'];startSetup(names,{firstNightSafe:false,wolfRandomTies:randomTies},false);
 for(const role of ['Werewolf','Werewolf','Villager','Villager','Villager','Villager'])click('Add '+role);
 const victims=[];let votes=0;
 click(/START GAME/);click('CONTINUE →');
 for(let i=0;i<6;i++){
   click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
   if(role==='Werewolf'){const target=availableTargets().find(b=>!victims.includes(b.querySelector('strong')?.textContent));assert.ok(target);victims.push(target.querySelector('strong').textContent);votes++;ui.fireEvent.click(target);click('COMPLETE ACTION');}else click('SKIP');
 }
 assert.equal(votes,2);
 if(randomTies){const report=ui.screen.getByText(/ died/).textContent;assert.equal((report.match(/ died/g)||[]).length,1);assert.ok(victims.slice(0,2).some(name=>report.includes(`${name} died`)));}
 else assert.ok(ui.screen.getByText('No one was killed tonight.'));
});

test('Survivor shields are configurable, saved, and tracked independently',()=>{
 const names=['A','B','C','D','E','F'];startSetup(names,{},false);
 for(const role of ['Werewolf','Survivor','Survivor','Villager','Villager','Villager'])click('Add '+role);
 click('View Survivor details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
 assert.equal(ui.screen.getByLabelText('Survivor shields per game').value,'3');
 ui.fireEvent.change(ui.screen.getByLabelText('Survivor shields per game'),{target:{value:'1'}});
 assert.equal(JSON.parse(localStorage.getItem('werewolf.settings')).survivorShieldCount,1);
 click('Close role details');click('View Survivor details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
 assert.equal(ui.screen.getByLabelText('Survivor shields per game').value,'1');click('Close role details');
 click(/START GAME/);click('CONTINUE →');let seen=0;
 for(let i=0;i<6;i++){click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
   if(role==='Survivor'){assert.ok(ui.screen.getByText(/up to 1 shield/));click('USE SHIELD (1 LEFT)');seen++;}else click('SKIP');
 }
 assert.equal(seen,2);click('CONTINUE →');click('END DISCUSSION →');for(let i=0;i<6;i++)click('SKIP VOTE');click('CONTINUE →');click('CONTINUE →');
 for(let i=0;i<6;i++){click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
   if(role==='Survivor'){assert.ok(ui.screen.getByText('No shields remaining.'));assert.equal(ui.screen.queryByRole('button',{name:/USE SHIELD/}),null);click('SKIP');seen++;}
   else if(role==='Werewolf'){chooseTargets();click('COMPLETE ACTION');}else click('SKIP');
 }
 assert.equal(seen,4);
});

test('Neutral role minimum waits persist and apply on a private turn',async()=>{
 const originalNow=Date.now;let now=originalNow();Date.now=()=>now;
 try {
  startSetup(['A','B','C','D'],{},false);for(const role of ['Werewolf','Jester','Villager','Villager'])click('Add '+role);
  click('View Jester details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
  ui.fireEvent.change(ui.screen.getByLabelText('Jester minimum wait seconds'),{target:{value:'1'}});click('Close role details');
  assert.equal(JSON.parse(localStorage.getItem('werewolf.settings')).roleWaitSeconds.jester,1);
  click(/START GAME/);click('CONTINUE →');let seen=false;
  for(let i=0;i<4;i++){click(/SHOW YOUR ROLE/);if(ui.screen.getByRole('heading',{level:2}).textContent==='Jester'){
   seen=true;assert.match(ui.screen.getByRole('status').textContent,/1 seconds/);assert.ok(ui.screen.getByRole('button',{name:'SKIP'}).disabled);
   now+=1000;await ui.act(async()=>{await new Promise(resolve=>setTimeout(resolve,300));});
  }click('SKIP');}assert.ok(seen);
 }finally{Date.now=originalNow;}
});

test('Mind Flayer starting stock and guaranteed regeneration persist and affect play',async()=>{
 const names=['A','B','C','D','E','F','G','H'];startSetup(names,{},false);
 for(const role of ['Werewolf','Mind Flayer','Villager','Villager','Villager','Villager','Villager','Villager'])click('Add '+role);
 click('View Mind Flayer details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
 assert.equal(ui.screen.getByLabelText('Mind Flayer starting parasites').value,'3');assert.equal(ui.screen.getByLabelText('Mind Flayer regeneration chance').value,'20');
 ui.fireEvent.change(ui.screen.getByLabelText('Mind Flayer starting parasites'),{target:{value:'1'}});
 ui.fireEvent.change(ui.screen.getByLabelText('Mind Flayer regeneration chance'),{target:{value:'100'}});click('Close role details');
 assert.equal(JSON.parse(localStorage.getItem('werewolf.settings')).mindStartingParasites,1);
 assert.equal(JSON.parse(localStorage.getItem('werewolf.settings')).mindRegenPercent,100);
 const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:1,mindflayer:1,villager:6});
 const mind=deal(names,counts).find(p=>p.role==='mindflayer').name;
 click(/START GAME/);
 let living=8;
 for(let round=1;round<=3;round++){
  click('CONTINUE →');let saw=false;
  for(let i=0;i<living;i++){
   click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
   if(role==='Mind Flayer'){
    saw=true;assert.ok(ui.screen.getByText(new RegExp(`Parasites remaining: ${round===2?0:1}\\.`)));
    if(round===2){assert.equal(ui.screen.queryByRole('button',{name:'PLANT PARASITE'}),null);click('SKIP AND TRY TO GENERATE');finishPrivateResult();}
    else {chooseTargets();click('PLANT PARASITE');}
   }else if(role==='Werewolf' && round>1){chooseTargets(1,mind);click('COMPLETE ACTION');}else click('SKIP');
  }
  assert.ok(saw);
  if(round<3){if(round===2)living--;click('CONTINUE →');click('END DISCUSSION →');for(let i=0;i<living;i++)click('SKIP VOTE');click('CONTINUE →');}
 }
});

for(const order of ['police-first','police-last'])test(`Police silently refunds Mind Flayer stock and placement: ${order}`,async()=>{
 const names=['A','B','C','D','E','F'];startSetup(names,{mindStartingParasites:1},false);
 for(const role of ['Werewolf','Mind Flayer','Police','Villager','Villager','Villager'])click('Add '+role);
 const random=order==='police-first'?0.999:0;Math.random=()=>random;
 const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:1,mindflayer:1,police:1,villager:3});
 const lineup=deal(names,counts),mind=lineup.find(p=>p.role==='mindflayer').name;
 click(/START GAME/);click('CONTINUE →');let targetName,policeIndex,mindIndex;
 for(let i=0;i<6;i++){
  click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
  if(role==='Police'){policeIndex=i;const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===mind);assert.ok(target);ui.fireEvent.click(target);click('COMPLETE ACTION');}
  else if(role==='Mind Flayer'){mindIndex=i;const target=availableTargets()[0];targetName=target.querySelector('strong').textContent;ui.fireEvent.click(target);click('PLANT PARASITE');}
  else click('SKIP');
 }
 assert.equal(policeIndex<mindIndex,order==='police-first');
 click('CONTINUE →');click('END DISCUSSION →');for(let i=0;i<6;i++)click('SKIP VOTE');click('CONTINUE →');click('CONTINUE →');
 for(let i=0;i<6;i++){
  click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
  if(role==='Mind Flayer'){assert.ok(ui.screen.getByText(/Parasites remaining: 1\. Parasitized: None\./));assert.ok(availableTargets().some(b=>b.querySelector('strong')?.textContent===targetName));break;}
  if(role==='Police')click('SKIP DETENTION');else if(role==='Werewolf'){chooseTargets(1,mind);click('COMPLETE ACTION');}else click('SKIP');
 }
});

test('Police silently cancels guaranteed Mind Flayer regeneration',async()=>{
 const names=['A','B','C','D','E','F'];startSetup(names,{mindStartingParasites:1,mindRegenPercent:100},false);
 for(const role of ['Werewolf','Mind Flayer','Police','Villager','Villager','Villager'])click('Add '+role);
 const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:1,mindflayer:1,police:1,villager:3});
 const mind=deal(names,counts).find(p=>p.role==='mindflayer').name;click(/START GAME/);click('CONTINUE →');
 for(let i=0;i<6;i++){
  click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
  if(role==='Police'){const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===mind);assert.ok(target);ui.fireEvent.click(target);click('COMPLETE ACTION');}
  else if(role==='Mind Flayer'){click('SKIP AND TRY TO GENERATE');finishPrivateResult();}else click('SKIP');
 }
 click('CONTINUE →');click('END DISCUSSION →');for(let i=0;i<6;i++)click('SKIP VOTE');click('CONTINUE →');click('CONTINUE →');
 let saw=false;for(let i=0;i<6;i++){
  click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
  if(role==='Mind Flayer'){saw=true;assert.ok(ui.screen.getByText(/Parasites remaining: 1\./));assert.equal(ui.screen.queryByText(/You generated one parasite/),null);break;}
  if(role==='Police')click('SKIP DETENTION');else if(role==='Werewolf'){chooseTargets(1,mind);click('COMPLETE ACTION');}else click('SKIP');
 }assert.ok(saw);
});

for(const protectedBet of [true,false])test(`Gambler betting protection ${protectedBet?'prevents':'does not prevent'} a night attack`,async()=>{
 const names=['A','B','C','D','E','F'];startSetup(names,{firstNightSafe:false},false);
 for(const role of ['Werewolf','Gambler','Villager','Villager','Villager','Villager'])click('Add '+role);
 click('View Gambler details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
 const protection=ui.screen.getByLabelText('Night protection while betting');assert.equal(protection.checked,true);
 if(!protectedBet)ui.fireEvent.click(protection);assert.equal(JSON.parse(localStorage.getItem('werewolf.settings')).gamblerBetProtection,protectedBet);
 click('Close role details');
 const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:1,gambler:1,villager:4});
 const lineup=deal(names,counts),gambler=lineup.find(p=>p.role==='gambler').name,villager=lineup.find(p=>p.role==='villager').name;
 click(/START GAME/);click('CONTINUE →');
 for(let i=0;i<6;i++){click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
  if(role==='Werewolf' || role==='Gambler'){const desired=role==='Werewolf'?gambler:villager;const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===desired);assert.ok(target);ui.fireEvent.click(target);click('COMPLETE ACTION');}else click('SKIP');
 }
 assert.equal(!!ui.screen.queryByText(new RegExp(`${gambler} died`)),!protectedBet);
});

test('Gambler configured for one prediction escapes only after the following night',async()=>{
 const names=['A','B','C','D','E','F','G','H'];startSetup(names,{},false);
 for(const role of ['Werewolf','Gambler','Villager','Villager','Villager','Villager','Villager','Villager'])click('Add '+role);
 click('View Gambler details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
 assert.equal(ui.screen.getByLabelText('Gambler correct predictions').value,'2');
 ui.fireEvent.change(ui.screen.getByLabelText('Gambler correct predictions'),{target:{value:'1'}});click('Close role details');
 click('View Gambler details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));assert.equal(ui.screen.getByLabelText('Gambler correct predictions').value,'1');click('Close role details');
 const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:1,gambler:1,villager:6});
 const lineup=deal(names,counts),gambler=lineup.find(p=>p.role==='gambler').name,[predicted,victim]=lineup.filter(p=>p.role==='villager').map(p=>p.name);
 const selectName=name=>{const b=availableTargets().find(b=>b.querySelector('strong')?.textContent===name);assert.ok(b,`cannot select ${name}`);ui.fireEvent.click(b);};
 click(/START GAME/);click('CONTINUE →');
 for(let i=0;i<8;i++){click(/SHOW YOUR ROLE/);if(ui.screen.getByRole('heading',{level:2}).textContent==='Gambler'){assert.ok(ui.screen.getByText(/Correct predictions: 0 \/ 1/));selectName(predicted);click('COMPLETE ACTION');}else click('SKIP');}
 click('CONTINUE →');click('END DISCUSSION →');
 for(let i=0;i<8;i++){const voter=ui.screen.getByRole('heading',{level:2}).textContent.split(',')[0];if(voter===predicted)click('SKIP VOTE');else{selectName(predicted);click('VOTE');}}
 assert.equal(ui.screen.queryByText(/escaped the village victorious/),null);click('CONTINUE →');click('CONTINUE →');
 for(let i=0;i<7;i++){click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
  if(role==='Gambler'){assert.ok(ui.screen.getByText(/Correct predictions: 1 \/ 1/));assert.ok(ui.screen.getByText(/If you survive tonight/));click('SKIP BET');}
  else if(role==='Werewolf'){selectName(victim);click('COMPLETE ACTION');}else click('SKIP');}
 assert.ok(ui.screen.getByText(new RegExp(`${gambler} escaped the village victorious`)));
});

for(const reflect of [true,false])test(`Raven marked attack reflection ${reflect?'enabled':'disabled'} in gameplay`,async()=>{
 const names=['A','B','C','D','E','F'];startSetup(names,{},false);
 for(const role of ['Werewolf','Raven','Villager','Villager','Villager','Villager'])click('Add '+role);
 click('View Raven details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
 const checkbox=ui.screen.getByLabelText('Reflect attacks from marked players');assert.equal(checkbox.checked,true);if(!reflect)ui.fireEvent.click(checkbox);
 assert.equal(JSON.parse(localStorage.getItem('werewolf.settings')).ravenReflectAttackers,reflect);click('Close role details');
 click('View Raven details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));assert.equal(ui.screen.getByLabelText('Reflect attacks from marked players').checked,reflect);click('Close role details');
 const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:1,raven:1,villager:4});
 const lineup=deal(names,counts),raven=lineup.find(p=>p.role==='raven').name,wolf=lineup.find(p=>p.role==='werewolf').name,villager=lineup.find(p=>p.role==='villager').name;
 const select=name=>{const b=availableTargets().find(b=>b.querySelector('strong')?.textContent===name);assert.ok(b,`cannot select ${name}`);ui.fireEvent.click(b);};
 click(/START GAME/);click('CONTINUE →');
 for(let i=0;i<6;i++){click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;if(role==='Raven'){select(wolf);click('COMPLETE ACTION');}else click('SKIP');}
 click('CONTINUE →');click('END DISCUSSION →');for(let i=0;i<6;i++)click('SKIP VOTE');click('CONTINUE →');click('CONTINUE →');
 for(let i=0;i<6;i++){click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
  if(role==='Raven'){select(villager);click('COMPLETE ACTION');}else if(role==='Werewolf'){select(raven);click('COMPLETE ACTION');}else click('SKIP');
 }
 assert.equal(!!ui.screen.queryByText(new RegExp(`${wolf} died`)),reflect);
 assert.equal(!!ui.screen.queryByText(new RegExp(`${raven} died`)),!reflect);
});

test('Serial Killer attack interval persists and controls three consecutive nights',async()=>{
 const names=['A','B','C','D','E','F'];startSetup(names,{firstNightSafe:false,survivorShieldCount:5},false);
 for(const role of ['Werewolf','Serial Killer','Survivor','Villager','Villager','Villager'])click('Add '+role);
 click('View Serial Killer details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
 const interval=ui.screen.getByLabelText('Serial Killer attack interval');assert.equal(interval.value,'1');ui.fireEvent.change(interval,{target:{value:'2'}});click('Close role details');
 assert.equal(JSON.parse(localStorage.getItem('werewolf.settings')).serialKillerInterval,2);
 click('View Serial Killer details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));assert.equal(ui.screen.getByLabelText('Serial Killer attack interval').value,'2');click('Close role details');
 const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:1,serialkiller:1,survivor:1,villager:3});
 const survivor=deal(names,counts).find(p=>p.role==='survivor').name;click(/START GAME/);
 for(let round=1;round<=3;round++){
  click('CONTINUE →');let saw=false;
  for(let i=0;i<6;i++){
   click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
   if(role==='Survivor')click(/USE SHIELD/);
   else if(role==='Serial Killer' || role==='Werewolf'){
    if(role==='Serial Killer'){saw=true;if(round!==2){assert.equal(availableTargets().length,0);assert.ok(ui.screen.getByText(/No independent attack tonight/));click('SKIP');continue;}}
    const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===survivor);assert.ok(target);ui.fireEvent.click(target);click('COMPLETE ACTION');
   }else click('SKIP');
  }
  assert.ok(saw);assert.ok(ui.screen.getByText('No one was killed tonight.'));
  if(round<3){click('CONTINUE →');click('END DISCUSSION →');for(let i=0;i<6;i++)click('SKIP VOTE');click('CONTINUE →');}
 }
});

test('Serial Killer interval respects first-night safety when set to every night',()=>{
 startSetup(['A','B','C','D','E'],{serialKillerInterval:1},false);
 for(const role of ['Werewolf','Serial Killer','Villager','Villager','Villager'])click('Add '+role);
 click(/START GAME/);click('CONTINUE →');let saw=false;
 for(let i=0;i<5;i++){click(/SHOW YOUR ROLE/);if(ui.screen.getByRole('heading',{level:2}).textContent==='Serial Killer'){saw=true;assert.equal(availableTargets().length,0);assert.ok(ui.screen.getByText(/No killing ability on the first night/));}click('SKIP');}
 assert.ok(saw);assert.ok(ui.screen.getByText('No one was killed tonight.'));
});

test('Thief interval persists and a protected target prevents role theft',async()=>{
 const names=['A','B','C','D','E','F'];startSetup(names,{firstNightSafe:false,survivorShieldCount:5},false);
 for(const role of ['Werewolf','Thief','Survivor','Villager','Villager','Villager'])click('Add '+role);
 click('View Thief details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
 const interval=ui.screen.getByLabelText('Thief attack interval');assert.equal(interval.value,'1');ui.fireEvent.change(interval,{target:{value:'2'}});click('Close role details');
 assert.equal(JSON.parse(localStorage.getItem('werewolf.settings')).thiefAttackInterval,2);
 click('View Thief details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));assert.equal(ui.screen.getByLabelText('Thief attack interval').value,'2');click('Close role details');
 const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:1,thief:1,survivor:1,villager:3});
 const survivor=deal(names,counts).find(p=>p.role==='survivor').name;click(/START GAME/);
 for(let round=1;round<=3;round++){
  click('CONTINUE →');let saw=false;
  for(let i=0;i<6;i++){
   click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
   if(role==='Survivor')click(/USE SHIELD/);
   else if(role==='Thief' || role==='Werewolf'){
    if(role==='Thief'){saw=true;if(round!==2){assert.equal(availableTargets().length,0);assert.ok(ui.screen.getByText(/No independent attack tonight/));assert.equal(ui.screen.queryByRole('button',{name:'SKIP THEFT'}),null);click('SKIP');continue;}}
    const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===survivor);assert.ok(target);ui.fireEvent.click(target);click('COMPLETE ACTION');
   }else click('SKIP');
  }
  assert.ok(saw);assert.ok(ui.screen.getByText('No one was killed tonight.'));
  if(round<3){click('CONTINUE →');click('END DISCUSSION →');for(let i=0;i<6;i++)click('SKIP VOTE');click('CONTINUE →');}
 }
});

test('successful scheduled Thief attack changes their role on the next night',async()=>{
 const names=['A','B','C','D','E','F','G'];startSetup(names,{thiefAttackInterval:2,firstNightSafe:false,survivorShieldCount:5},false);
 for(const role of ['Werewolf','Thief','Survivor','Villager','Villager','Villager','Villager'])click('Add '+role);
 const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:1,thief:1,survivor:1,villager:4});
 const lineup=deal(names,counts),thief=lineup.find(p=>p.role==='thief').name,survivor=lineup.find(p=>p.role==='survivor').name,victim=lineup.find(p=>p.role==='villager').name;
 const select=name=>{const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===name);assert.ok(target);ui.fireEvent.click(target);};click(/START GAME/);
 for(let round=1;round<=3;round++){
  click('CONTINUE →');let saw=false;
  for(let i=0;i<(round===3?6:7);i++){
   const player=ui.screen.getByRole('heading',{level:2}).textContent.split(',')[0];click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
   if(player===thief){saw=true;if(round===3){assert.equal(role,'Villager');assert.ok(ui.screen.getByText(/You stole this role and joined its team/));click('SKIP');}else if(round===1){assert.equal(role,'Thief');click('SKIP');}else {select(victim);click('COMPLETE ACTION');}}
   else if(role==='Werewolf'){select(survivor);click('COMPLETE ACTION');}
   else if(role==='Survivor')click(/USE SHIELD/);else click('SKIP');
  }
  assert.ok(saw);
  if(round<3){if(round===2)assert.ok(ui.screen.getByText(new RegExp(`${victim} died`)));click('CONTINUE →');click('END DISCUSSION →');for(let i=0;i<(round===1?7:6);i++)click('SKIP VOTE');click('CONTINUE →');}
 }
});

for(const order of ['police-first','police-last'])test(`Police silently prevents Thief attack in either turn order: ${order}`,async()=>{
 const names=['A','B','C','D','E','F'];startSetup(names,{firstNightSafe:false},false);
 for(const role of ['Werewolf','Thief','Police','Survivor','Villager','Villager'])click('Add '+role);
 Math.random=()=>order==='police-first'?0.999:0;
 const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:1,thief:1,police:1,survivor:1,villager:2});
 const lineup=deal(names,counts),thief=lineup.find(p=>p.role==='thief').name,survivor=lineup.find(p=>p.role==='survivor').name,victim=lineup.find(p=>p.role==='villager').name;
 const select=name=>{const b=availableTargets().find(b=>b.querySelector('strong')?.textContent===name);assert.ok(b,`cannot select ${name}`);ui.fireEvent.click(b);};
 click(/START GAME/);click('CONTINUE →');let policeIndex,thiefIndex;
 for(let i=0;i<6;i++){
  click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
  if(role==='Police'){policeIndex=i;select(thief);click('COMPLETE ACTION');}
  else if(role==='Thief'){thiefIndex=i;select(victim);click('COMPLETE ACTION');}
  else if(role==='Werewolf'){select(survivor);click('COMPLETE ACTION');}
  else if(role==='Survivor')click(/USE SHIELD/);else click('SKIP');
 }
 assert.equal(policeIndex<thiefIndex,order==='police-first');assert.ok(ui.screen.getByText('No one was killed tonight.'));
 click('CONTINUE →');click('END DISCUSSION →');for(let i=0;i<6;i++)click('SKIP VOTE');click('CONTINUE →');click('CONTINUE →');let saw=false;
 for(let i=0;i<6;i++){
  const player=ui.screen.getByRole('heading',{level:2}).textContent.split(',')[0];click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
  if(player===thief){saw=true;assert.equal(role,'Thief');assert.equal(ui.screen.queryByText(/You stole this role/),null);assert.ok(availableTargets().some(b=>b.querySelector('strong')?.textContent===victim));break;}
  if(role==='Police')click('SKIP DETENTION');else if(role==='Werewolf'){select(survivor);click('COMPLETE ACTION');}else if(role==='Survivor')click(/USE SHIELD/);else click('SKIP');
 }assert.ok(saw);
});

for(const betrayal of [true,false])test(`White Werewolf pack betrayal ${betrayal?'enabled':'disabled'} in role selection`,async()=>{
 const names=['A','B','C','D','E','F'];startSetup(names,{firstNightSafe:false},false);
 for(const role of ['Werewolf','White Werewolf','Villager','Villager','Villager','Villager'])click('Add '+role);
 click('View White Werewolf details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
 const checkbox=ui.screen.getByLabelText('Allow votes against known packmates');assert.equal(checkbox.checked,true);if(!betrayal)ui.fireEvent.click(checkbox);
 assert.equal(JSON.parse(localStorage.getItem('werewolf.settings')).whiteWolfBetrayPack,betrayal);click('Close role details');
 const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:1,whitewolf:1,villager:4});
 const lineup=deal(names,counts),wolf=lineup.find(p=>p.role==='werewolf').name,villager=lineup.find(p=>p.role==='villager').name;
 click(/START GAME/);click('CONTINUE →');let saw=false;
 for(let i=0;i<6;i++){click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
  if(role==='White Werewolf'){saw=true;assert.equal(availableTargets().some(b=>b.querySelector('strong')?.textContent===wolf),betrayal);}
  if(role==='Werewolf' || role==='White Werewolf'){const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===villager);assert.ok(target);ui.fireEvent.click(target);click('COMPLETE ACTION');}else click('SKIP');
 }assert.ok(saw);
});

test('Charmer waits until configured night before choosing a friend',async()=>{
 const names=['A','B','C','D','E','F'];startSetup(names,{firstNightSafe:false,survivorShieldCount:5},false);
 for(const role of ['Werewolf','Charmer','Survivor','Villager','Villager','Villager'])click('Add '+role);
 click('View Charmer details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
 assert.equal(ui.screen.getByLabelText('Charmer first friend night').value,'1');ui.fireEvent.change(ui.screen.getByLabelText('Charmer first friend night'),{target:{value:'2'}});click('Close role details');
 assert.equal(JSON.parse(localStorage.getItem('werewolf.settings')).charmerFirstNight,2);
 const {deal}=await vite.ssrLoadModule('/src/werewolf-engine.ts');const counts=Object.fromEntries(Object.keys(roles).map(r=>[r,0]));Object.assign(counts,{werewolf:1,charmer:1,survivor:1,villager:3});
 const lineup=deal(names,counts),survivor=lineup.find(p=>p.role==='survivor').name,friend=lineup.find(p=>p.role==='villager').name;
 const select=name=>{const target=availableTargets().find(b=>b.querySelector('strong')?.textContent===name);assert.ok(target);ui.fireEvent.click(target);};click(/START GAME/);
 for(let round=1;round<=3;round++){
  click('CONTINUE →');let saw=false;
  for(let i=0;i<6;i++){click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
   if(role==='Charmer'){saw=true;if(round===1){assert.ok(ui.screen.getByText(/starting on night 2/));assert.equal(availableTargets().length,0);click('SKIP');}
    else if(round===2){select(friend);click('COMPLETE ACTION');}else {assert.ok(ui.screen.getByText(new RegExp(`Your friend: ${friend}`)));click('SKIP');}}
   else if(role==='Werewolf'){select(survivor);click('COMPLETE ACTION');}else if(role==='Survivor')click(/USE SHIELD/);else click('SKIP');
  }
  assert.ok(saw);assert.ok(ui.screen.getByText('No one was killed tonight.'));
  if(round<3){click('CONTINUE →');click('END DISCUSSION →');for(let i=0;i<6;i++)click('SKIP VOTE');click('CONTINUE →');}
 }
});

test('every role has a consistent, accessible default power estimate on its card and description',async()=>{
 const {ROLE_POWER}=await vite.ssrLoadModule('/src/role-power.ts');
 assert.deepEqual(Object.keys(ROLE_POWER).sort(),Object.keys(roles).sort());
 startSetup(['A','B','C','D'],{},false);
 assert.equal(document.querySelectorAll('.random-role-card .role-power-card').length,0);
 for(const [id,meta] of Object.entries(roles)){
  const score=ROLE_POWER[id];assert.ok(Number.isInteger(score)&&score>=1&&score<=10);
  const button=ui.screen.getByRole('button',{name:`View ${meta.name} details`});
  const badge=button.querySelector('.role-power-card');assert.equal(badge.textContent,String(score));
  assert.equal(button.getAttribute('aria-describedby'),badge.id);assert.match(badge.getAttribute('aria-label'),new RegExp(`Power ${score} out of 10`));
  ui.fireEvent.click(button);const dialog=ui.screen.getByRole('dialog');
  assert.equal(dialog.querySelector('.role-power-detail').textContent,`POWER ${score}/10`);
  assert.ok(ui.within(dialog).getByText('Estimated power under default rules'));
  click('Close role details');
 }
});

test('each role description offers a skins section',()=>{
 startSetup(['A','B','C','D'],{},false);
 for(const meta of Object.values(roles)){
  click(`View ${meta.name} details`);const dialog=ui.screen.getByRole('dialog');
  const section=dialog.querySelector('.role-detail-skins');assert.ok(section);assert.equal(section.open,false);
  const summary=ui.within(dialog).getByText('SKINS').closest('summary');ui.fireEvent.click(summary);
  assert.equal(section.open,true);if(['Celebrity','Charmer'].includes(meta.name)) assert.ok(ui.within(dialog).getByRole('group',{name:`${meta.name} skins`}));else assert.ok(ui.within(dialog).getByText('No additional skins are available.'));
  assert.ok(ui.within(dialog).getByText('ROLE SETTINGS'));click('Close role details');
 }
});

test('Celebrity skins can be selected, persist, and update role cards and private gameplay',()=>{
 startSetup(['A','B','C','D','E','F'],{firstNightSafe:true},false);
 for(const role of ['Werewolf','Celebrity','Villager','Villager','Villager','Villager'])click('Add '+role);
 const card=()=>ui.screen.getByRole('button',{name:'View Celebrity details'}).querySelector('img');
 assert.match(card().getAttribute('src'),/celebrity-new\.webp$/);
 click('View Celebrity details');ui.fireEvent.click(ui.screen.getByText('SKINS'));
 const modal=()=>ui.screen.getByRole('dialog');
 const skin=name=>ui.within(modal()).getByRole('button',{name:`${name} Celebrity skin`});
 assert.equal(skin('Default').getAttribute('aria-pressed'),'true');
 for(const [name,file,id] of [['Spotlight','celebrity-spotlight.webp','spotlight'],['Gala','celebrity-gala.webp','gala']]){
  ui.fireEvent.click(skin(name));assert.equal(skin(name).getAttribute('aria-pressed'),'true');assert.equal(JSON.parse(localStorage.getItem('werewolf.celebritySkin')),id);
  assert.ok(ui.within(modal()).getByAltText('Celebrity role artwork').getAttribute('src').endsWith(file));
 }
 click('Close role details');assert.match(card().getAttribute('src'),/celebrity-gala\.webp$/);
 ui.cleanup();ui.render(React.createElement(App));click(/START GAME/);click(/CHOOSE ROLES/);
 assert.match(card().getAttribute('src'),/celebrity-gala\.webp$/);
 click('View Celebrity details');ui.fireEvent.click(ui.screen.getByText('SKINS'));assert.equal(skin('Gala').getAttribute('aria-pressed'),'true');
 ui.fireEvent.click(skin('Default'));assert.match(ui.within(modal()).getByAltText('Celebrity role artwork').getAttribute('src'),/celebrity-new\.webp$/);
 ui.fireEvent.click(skin('Spotlight'));click('Close role details');assert.match(card().getAttribute('src'),/celebrity-spotlight\.webp$/);
 for(const role of ['Werewolf','Celebrity','Villager','Villager','Villager','Villager'])click('Add '+role);
 click(/START GAME/);click('CONTINUE →');let saw=false;
 for(let i=0;i<6;i++){click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
  if(role==='Celebrity'){saw=true;assert.match(document.querySelector('.role-art').getAttribute('src'),/celebrity-spotlight\.webp$/);}click('SKIP');
 }assert.ok(saw);
});

test('invalid saved Celebrity skin falls back safely to the existing artwork',()=>{
 localStorage.setItem('werewolf.celebritySkin',JSON.stringify('unknown'));startSetup(['A','B','C','D'],{},false);
 assert.match(ui.screen.getByRole('button',{name:'View Celebrity details'}).querySelector('img').getAttribute('src'),/celebrity-new\.webp$/);
 click('View Celebrity details');ui.fireEvent.click(ui.screen.getByText('SKINS'));
 assert.equal(ui.screen.getByRole('button',{name:'Default Celebrity skin'}).getAttribute('aria-pressed'),'true');
});

test('Charmer skins are selectable, persist independently, and appear in game',()=>{
 localStorage.setItem('werewolf.celebritySkin',JSON.stringify('gala'));
 startSetup(['A','B','C','D','E','F'],{},false);
 const card=()=>ui.screen.getByRole('button',{name:'View Charmer details'}).querySelector('img');
 assert.match(card().getAttribute('src'),/charmer-new\.webp$/);
 click('View Charmer details');ui.fireEvent.click(ui.screen.getByText('SKINS'));
 const modal=()=>ui.screen.getByRole('dialog');const skin=name=>ui.within(modal()).getByRole('button',{name:`${name} Charmer skin`});
 assert.equal(skin('Default').getAttribute('aria-pressed'),'true');
 for(const [name,file,id] of [['Moonlight','charmer-moonlight.webp','moonlight'],['Starlight','charmer-starlight.webp','starlight'],['Sapphire','charmer-sapphire.webp','sapphire']]){
  ui.fireEvent.click(skin(name));assert.equal(skin(name).getAttribute('aria-pressed'),'true');assert.equal(JSON.parse(localStorage.getItem('werewolf.charmerSkin')),id);
  assert.ok(ui.within(modal()).getByAltText('Charmer role artwork').getAttribute('src').endsWith(file));
 }
 assert.equal(JSON.parse(localStorage.getItem('werewolf.celebritySkin')),'gala');click('Close role details');assert.match(card().getAttribute('src'),/charmer-sapphire\.webp$/);
 assert.match(ui.screen.getByRole('button',{name:'View Celebrity details'}).querySelector('img').getAttribute('src'),/celebrity-gala\.webp$/);
 ui.cleanup();ui.render(React.createElement(App));click(/START GAME/);click(/CHOOSE ROLES/);assert.match(card().getAttribute('src'),/charmer-sapphire\.webp$/);
 click('View Charmer details');ui.fireEvent.click(ui.screen.getByText('SKINS'));assert.equal(skin('Sapphire').getAttribute('aria-pressed'),'true');
 ui.fireEvent.click(skin('Default'));assert.match(ui.within(modal()).getByAltText('Charmer role artwork').getAttribute('src'),/charmer-new\.webp$/);
 ui.fireEvent.click(skin('Moonlight'));click('Close role details');assert.match(card().getAttribute('src'),/charmer-moonlight\.webp$/);
 for(const role of ['Werewolf','Charmer','Villager','Villager','Villager','Villager'])click('Add '+role);
 click(/START GAME/);click('CONTINUE →');let saw=false;
 for(let i=0;i<6;i++){click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
  if(role==='Charmer'){saw=true;assert.match(document.querySelector('.role-art').getAttribute('src'),/charmer-moonlight\.webp$/);chooseTargets();click('COMPLETE ACTION');}else click('SKIP');
 }assert.ok(saw);
});

test('unknown saved Charmer skin falls back to the current default artwork',()=>{
 localStorage.setItem('werewolf.charmerSkin',JSON.stringify('unknown'));startSetup(['A','B','C','D'],{},false);
 assert.match(ui.screen.getByRole('button',{name:'View Charmer details'}).querySelector('img').getAttribute('src'),/charmer-new\.webp$/);
 click('View Charmer details');ui.fireEvent.click(ui.screen.getByText('SKINS'));
 assert.equal(ui.screen.getByRole('button',{name:'Default Charmer skin'}).getAttribute('aria-pressed'),'true');
});

test('game settings check and dash controls remain accessible, toggle, and persist',()=>{
 startSetup(['A','B','C','D'],{},false);
 const checked=ui.screen.getByRole('checkbox',{name:'Secret voting'});
 const unchecked=ui.screen.getByRole('checkbox',{name:'Wait time for passive roles'});
 assert.equal(checked.checked,true);assert.equal(unchecked.checked,false);
 for(const control of [checked,unchecked]){
  const visual=control.parentElement.querySelector('.setting-check-visual');assert.ok(visual);
  assert.equal(visual.getAttribute('aria-hidden'),'true');assert.ok(visual.querySelector('.setting-check-on'));assert.ok(visual.querySelector('.setting-check-off'));
 }
 ui.fireEvent.click(checked.closest('label'));ui.fireEvent.click(unchecked.closest('label'));
 assert.equal(checked.checked,false);assert.equal(unchecked.checked,true);
 const settings=JSON.parse(localStorage.getItem('werewolf.settings'));assert.equal(settings.secretVotes,false);assert.equal(settings.passiveWait,true);
 ui.cleanup();ui.render(React.createElement(App));click(/START GAME/);click(/CHOOSE ROLES/);
 assert.equal(ui.screen.getByRole('checkbox',{name:'Secret voting'}).checked,false);
 assert.equal(ui.screen.getByRole('checkbox',{name:'Wait time for passive roles'}).checked,true);
});

test('Random cards open descriptions with a shared persistent uniqueness option',()=>{
 startSetup(['A','B','C','D'],{},false);
 for(const team of ['VILLAGERS','WEREWOLVES','NEUTRALS']){
  click(`View random ${team} details`);const dialog=ui.screen.getByRole('dialog');
  assert.ok(ui.within(dialog).getByRole('heading',{name:`RANDOM ${team}`}));
  assert.ok(ui.within(dialog).getByText(/Each Random card picks a role/));
  const checkbox=ui.within(dialog).getByRole('checkbox',{name:'One player per random role'});
  if(team==='VILLAGERS'){assert.equal(checkbox.checked,false);ui.fireEvent.click(checkbox);}else assert.equal(checkbox.checked,true);
  click('Close random role details');
 }
 assert.equal(JSON.parse(localStorage.getItem('werewolf.settings')).randomUniqueRoles,true);
 ui.cleanup();ui.render(React.createElement(App));click(/START GAME/);click(/CHOOSE ROLES/);click('View random NEUTRALS details');
 assert.equal(ui.screen.getByRole('checkbox',{name:'One player per random role'}).checked,true);click('Close random role details');
});

test('every role has an independently saved chance slider for Random cards',()=>{
 startSetup(['A','B','C','D'],{},false);
 for(const meta of Object.values(roles)){
  click(`View ${meta.name} details`);ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
  const slider=ui.screen.getByRole('slider',{name:`${meta.name} random role chance`});assert.equal(slider.value,'100');
  assert.equal(slider.min,'0');assert.equal(slider.max,'100');click('Close role details');
 }
 click('View Doctor details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
 ui.fireEvent.change(ui.screen.getByRole('slider',{name:'Doctor random role chance'}),{target:{value:'35'}});
 assert.ok(ui.screen.getByText('35%'));click('Close role details');
 click('View Seer details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));ui.fireEvent.change(ui.screen.getByRole('slider',{name:'Seer random role chance'}),{target:{value:'0'}});click('Close role details');
 assert.deepEqual(JSON.parse(localStorage.getItem('werewolf.settings')).roleChances,{doctor:35,seer:0});
 ui.cleanup();ui.render(React.createElement(App));click(/START GAME/);click(/CHOOSE ROLES/);click('View Doctor details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
 assert.equal(ui.screen.getByRole('slider',{name:'Doctor random role chance'}).value,'35');click('Close role details');
});

test('Random card exclusions show a recoverable error; manually added roles ignore chances',()=>{
 const chances=Object.fromEntries(Object.entries(roles).filter(([,meta])=>meta.team==='village').map(([id])=>[id,0]));
 startSetup(['A','B','C','D'],{roleChances:chances},false);
 click('Add Werewolf');click('Add Villager');click('Add Villager');click('Add random VILLAGERS role');click(/START GAME/);
 assert.match(ui.screen.getByRole('alert').textContent,/Not enough eligible village roles/);
 click('Remove random VILLAGERS role');click('Add Villager');click(/START GAME/);
 assert.ok(ui.screen.getByRole('heading',{name:'NIGHT 1 STARTED'}));
});

test('Random unique setting prevents repeating a manually selected role',()=>{
 const chances=Object.fromEntries(Object.entries(roles).filter(([,meta])=>meta.team==='village').map(([id])=>[id,0]));chances.villager=100;
 startSetup(['A','B','C','D'],{roleChances:chances,randomUniqueRoles:true},false);
 click('Add Werewolf');click('Add Villager');click('Add Villager');click('Add random VILLAGERS role');click(/START GAME/);
 assert.match(ui.screen.getByRole('alert').textContent,/Not enough eligible village roles/);
 click('View random VILLAGERS details');ui.fireEvent.click(ui.screen.getByRole('checkbox',{name:'One player per random role'}));click('Close random role details');click(/START GAME/);
 assert.ok(ui.screen.getByRole('heading',{name:'NIGHT 1 STARTED'}));
});

test('Random card resolves to the only role with a nonzero chance',()=>{
 const chances=Object.fromEntries(Object.entries(roles).filter(([,meta])=>meta.team==='village').map(([id])=>[id,0]));chances.seer=100;
 startSetup(['A','B','C','D'],{roleChances:chances},false);
 click('Add Werewolf');click('Add Villager');click('Add Villager');click('Add random VILLAGERS role');click(/START GAME/);click('CONTINUE →');
 let seers=0;for(let i=0;i<4;i++){click(/SHOW YOUR ROLE/);const role=ui.screen.getByRole('heading',{level:2}).textContent;
  if(role==='Seer'){seers++;chooseTargets();click('COMPLETE ACTION');finishPrivateResult();}else click('SKIP');
 }assert.equal(seers,1);
});

test('distribution expands three difficulty modes and persists the chance-following setting',()=>{
 startSetup(['A','B','C','D','E','F'],{},false);
 const toggle=ui.screen.getByRole('button',{name:'RANDOM DISTRIBUTION'});assert.equal(toggle.getAttribute('aria-expanded'),'false');
 click('RANDOM DISTRIBUTION');assert.equal(toggle.getAttribute('aria-expanded'),'true');
 for(const mode of ['EASY Favors Villagers','BALANCED Even matchup','HARD Favors Werewolves'])assert.ok(ui.screen.getByRole('button',{name:mode}));
 const follow=ui.screen.getByRole('checkbox',{name:'Distribution follows role chances'});assert.equal(follow.checked,false);ui.fireEvent.click(follow);
 assert.equal(JSON.parse(localStorage.getItem('werewolf.settings')).distributionFollowChances,true);
 click('EASY Favors Villagers');assert.match(ui.screen.getByRole('button',{name:/START GAME/}).textContent,/6 \/ 6/);
 click('BALANCED Even matchup');assert.match(ui.screen.getByRole('button',{name:/START GAME/}).textContent,/6 \/ 6/);
 click('HARD Favors Werewolves');assert.match(ui.screen.getByRole('button',{name:/START GAME/}).textContent,/6 \/ 6/);
 click('RANDOM DISTRIBUTION');assert.equal(toggle.getAttribute('aria-expanded'),'false');
 ui.cleanup();ui.render(React.createElement(App));click(/START GAME/);click(/CHOOSE ROLES/);click('RANDOM DISTRIBUTION');
 assert.equal(ui.screen.getByRole('checkbox',{name:'Distribution follows role chances'}).checked,true);
});

test('distribution excludes zero-chance roles when enabled and recovers when disabled',()=>{
 const chances=Object.fromEntries(Object.keys(roles).map(id=>[id,0]));
 startSetup(['A','B','C','D'],{roleChances:chances,distributionFollowChances:true},false);
 click('Add Villager');click('RANDOM DISTRIBUTION');click('BALANCED Even matchup');
 assert.match(ui.screen.getByRole('alert').textContent,/at least one eligible/);assert.match(ui.screen.getByRole('button',{name:/START GAME/}).textContent,/1 \/ 4/);
 ui.fireEvent.click(ui.screen.getByRole('checkbox',{name:'Distribution follows role chances'}));click('BALANCED Even matchup');
 assert.equal(ui.screen.queryByRole('alert'),null);assert.match(ui.screen.getByRole('button',{name:/START GAME/}).textContent,/4 \/ 4/);
});

test('automatic distribution excludes Neutrals for four players and includes one for five',()=>{
 for(const count of [4,5]){
  startSetup(Array.from({length:count},(_,i)=>`Player ${i+1}`),{},false);
  click('RANDOM DISTRIBUTION');click('EASY Favors Villagers');
  const neutralCount=Object.values(roles).filter(meta=>meta.team==='neutral').reduce((sum,meta)=>{
   const card=ui.screen.getByRole('button',{name:`View ${meta.name} details`}).closest('.role-choice');
   return sum+Number(card.querySelector('.stepper span').textContent);
  },0);
  assert.equal(neutralCount,count===4?0:1);assert.match(ui.screen.getByRole('button',{name:/START GAME/}).textContent,new RegExp(`${count} / ${count}`));
  ui.cleanup();localStorage.clear();
 }
});

test('distribution explains when all Neutral chances are zero in a five-player game',()=>{
 const chances=Object.fromEntries(Object.entries(roles).filter(([,role])=>role.team==='neutral').map(([id])=>[id,0]));
 startSetup(['A','B','C','D','E'],{roleChances:chances,distributionFollowChances:true},false);
 click('RANDOM DISTRIBUTION');click('BALANCED Even matchup');
 assert.match(ui.screen.getByRole('alert').textContent,/eligible Neutral role/);
 ui.fireEvent.click(ui.screen.getByRole('checkbox',{name:'Distribution follows role chances'}));click('BALANCED Even matchup');
 assert.equal(ui.screen.queryByRole('alert'),null);assert.match(ui.screen.getByRole('button',{name:/START GAME/}).textContent,/5 \/ 5/);
});

test('dragging the chance slider does not swipe to another role or reset the value',()=>{
 startSetup(['A','B','C','D'],{},false);
 click('View Doctor details');ui.fireEvent.click(ui.screen.getByText('ROLE SETTINGS'));
 const slider=ui.screen.getByRole('slider',{name:'Doctor random role chance'});
 ui.fireEvent.touchStart(slider,{touches:[{clientX:280,clientY:400}]});
 ui.fireEvent.change(slider,{target:{value:'30'}});
 ui.fireEvent.touchEnd(slider,{changedTouches:[{clientX:100,clientY:400}]});
 assert.ok(ui.screen.getByRole('heading',{name:'DOCTOR'}));assert.equal(slider.value,'30');
 assert.equal(JSON.parse(localStorage.getItem('werewolf.settings')).roleChances.doctor,30);
 ui.fireEvent.keyDown(slider,{key:'ArrowRight'});assert.ok(ui.screen.getByRole('heading',{name:'DOCTOR'}));
 const image=ui.screen.getByAltText('Doctor role artwork');
 ui.fireEvent.touchStart(image,{touches:[{clientX:280,clientY:250}]});
 ui.fireEvent.touchEnd(image,{changedTouches:[{clientX:100,clientY:250}]});
 assert.equal(ui.screen.queryByRole('heading',{name:'DOCTOR'}),null,'swiping artwork should still navigate');
 click('Previous role');assert.equal(ui.screen.getByRole('slider',{name:'Doctor random role chance'}).value,'30');
});
