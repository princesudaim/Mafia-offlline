import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BookOpen, Play } from 'lucide-react';
import { roles, defaults, deal, tally, winner, resolveNight, visitorsTo, applyIllness, applyInfections, settleGamblerBets, resolveGamblerEscapes, collectGamblerDebts, mindFlayerWinner, regenerateParasite, intelligenceReport, applyThefts, canDetain, resolveDetentions, applyHypnosis, canChefAct, celebrityReveals, isEligibleMadmanRole, selectMadmen, randomLineup, teamOfPlayer, sameTeamForChef, shuffle, knownPackmate, canWolfTarget, type Player, type Role, type Settings, type WinningSide, type Visit } from './werewolf-engine';
import PlayerSetup, { Avatar, readAvatars } from './PlayerSetup';
import JournalistEditor, { type Newspaper } from './JournalistEditor';
import RoleDetails from './RoleDetails';
import { RANKINGS_KEY, readRankings, updateRankings, winningPlayers } from './rankings';
import './werewolf.css';

type Screen = 'home'|'rules'|'players'|'roles'|'nightIntro'|'pass'|'action'|'hypnoAction'|'privateResult'|'morning'|'discussion'|'vote'|'voteResult'|'end';
const roleOrder: Role[] = ['werewolf','villager','doctor','seer','chef','mayor','templar','muted','jester','necromancer','bodyguard','sheriff','serialkiller','survivor','visitor','psychic','celebrity','detective','instigator','strongwolf','sickman','lonewolf','wolfpup','journalist','raven','rabidwolf','whitewolf','gambler','mindflayer','intelligence','thief','police','hypnowolf','charmer'];
const emptyRoleCounts = (): Record<Role,number> => Object.fromEntries((Object.keys(roles) as Role[]).map(role=>[role,0])) as Record<Role,number>;
const passiveRoles: Role[] = ['villager','muted','jester','celebrity','sickman'];
const picture = (name: string) => `./werewolf/${name}`;
function read<T>(key: string, fallback: T): T { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } }
function save(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private browsing */ } }
export default function Werewolf() {
  const [screen,setScreen] = useState<Screen>('home');
  const [detailRole,setDetailRole] = useState<Role | null>(null);
  const [names,setNames] = useState<string[]>(() => read('werewolf.names', []));
  const [avatars,setAvatars] = useState(readAvatars);
  const [counts,setCounts] = useState<Record<Role,number>>(emptyRoleCounts);
  const [settings,setSettings] = useState<Settings>(() => ({...defaults,...read('werewolf.settings', {})}));
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioPhase = ['nightIntro','pass','action','hypnoAction','privateResult'].includes(screen) ? 'night' : ['morning','discussion'].includes(screen) ? 'day' : ['vote','voteResult'].includes(screen) ? 'vote' : null;
  function playPhase(phase: string) {
    try {
      const player=audio.current || new Audio();
      audio.current=player;
      if (player.dataset.phase !== phase) { player.src=`./werewolf/audio/${phase}.mp3`; player.dataset.phase=phase; }
      player.loop=true; player.volume=0.45;
      const playback=player.play();
      playback?.catch(()=>{}); // Mobile browsers can require another tap before audio may play.
    } catch { /* Playback is optional and must never block the game. */ }
  }
  useEffect(() => {
    if (settings.sounds && audioPhase) playPhase(audioPhase);
    else audio.current?.pause();
  }, [audioPhase,settings.sounds]);
  useEffect(() => () => { audio.current?.pause(); }, []);
  const [players,setPlayers] = useState<Player[]>([]);
  const [round,setRound] = useState(1);
  const [queue,setQueue] = useState<number[]>([]);
  const [index,setIndex] = useState(0);
  const [selected,setSelected] = useState<number[]>([]);
  const [privateText,setPrivateText] = useState('');
  const [enraged,setEnraged] = useState(false);
  const [enragedNext,setEnragedNext] = useState(false);
  const curses = useRef<Record<number,number[]>>({});
  const triggeredCurses = useRef<number[]>([]);
  const mindParasites = useRef<Record<number,number[]>>({});
  const [parasiteStock,setParasiteStock] = useState<Record<number,number>>({});
  const [mindWinner,setMindWinner] = useState('');
  const lovers = useRef<Record<number,number>>({});
  const fakeDoctorSaves = useRef<Record<number,number>>({});
  const policeTargets = useRef<Record<number,number>>({});
  const detectiveAttempts = useRef<Visit[]>([]);
  const provocationAttempts = useRef<Visit[]>([]);
  const revivalAttempts = useRef<Visit[]>([]);
  const mayorAttempts = useRef<number[]>([]);
  const fakeMayorAttempts = useRef<number[]>([]);
  const parasiteAttempts = useRef<Visit[]>([]);
  const parasiteRegens = useRef<{actor:number; amount:number}[]>([]);
  const curseAttempts = useRef<Visit[]>([]);
  const loverAttempts = useRef<Visit[]>([]);
  const newspaperAttempts = useRef<{actor:number; paper:Newspaper}[]>([]);
  const pendingReports = useRef<Record<number,string>>({});
  const [privateReports,setPrivateReports] = useState<Record<number,string>>({});
  const nextFame = useRef<Record<number,string[]>>({});
  const policeChoices = useRef<Record<number,number>>({});
  const [lastDetentions,setLastDetentions] = useState<Record<number,number>>({});
  const hypnosis = useRef<Visit[]>([]);
  const [hypnoUsed,setHypnoUsed] = useState<number[]>([]);
  const [corrupted,setCorrupted] = useState<number[]>([]);
  const [madmen,setMadmen] = useState<number[]>([]);
  const [failedMayors,setFailedMayors] = useState<number[]>([]);
  const thefts = useRef<Visit[]>([]);
  const [stolenRoles,setStolenRoles] = useState<Record<number,Role>>({});
  const infections = useRef<Visit[]>([]);
  const gamblerBets = useRef<Visit[]>([]);
  const [gamblerCorrect,setGamblerCorrect] = useState<Record<number,number>>({});
  const [gamblerDebts,setGamblerDebts] = useState<number[]>([]);
  const [gamblerReady,setGamblerReady] = useState<number[]>([]);
  const [nightEscapes,setNightEscapes] = useState<string[]>([]);
  const [converted,setConverted] = useState<number[]>([]);
  const wolfBallots = useRef<{actor:number;target:number}[]>([]);
  const [wolfVotes,setWolfVotes] = useState<number[]>([]);
  const [saves,setSaves] = useState<number[]>([]);
  const [lastSaves,setLastSaves] = useState<Record<number,number>>({});
  const [currentSaves,setCurrentSaves] = useState<Record<number,number>>({});
  const [mayors,setMayors] = useState<number[]>([]);
  const [assembly,setAssembly] = useState(false);
  const [assemblyNames,setAssemblyNames] = useState<string[]>([]);
  const [templeUsed,setTempleUsed] = useState<number[]>([]);
  const [guards,setGuards] = useState<{actor:number;target:number}[]>([]);
  const [bullets,setBullets] = useState<{actor:number;target:number}[]>([]);
  const [sheriffUsed,setSheriffUsed] = useState<number[]>([]);
  const nightVisits = useRef<Visit[]>([]);
  const [previousVisits,setPreviousVisits] = useState<Visit[]>([]);
  const [watchTargets,setWatchTargets] = useState<Record<number,number>>({});
  const [provocations,setProvocations] = useState<number[]>([]);
  const [instigatorUses,setInstigatorUses] = useState<Record<number,number>>({});
  const [fame,setFame] = useState<Record<number,string[]>>({});
  const [sickLife,setSickLife] = useState<Record<number,number>>({});
  const [lone,setLone] = useState<{actor:number;target:number}[]>([]);
  const [strong,setStrong] = useState<{actor:number;target:number}[]>([]);
  const [serials,setSerials] = useState<{actor:number;target:number}[]>([]);
  const [visitors,setVisitors] = useState<{actor:number;target:number}[]>([]);
  const [shields,setShields] = useState<number[]>([]);
  const [shieldUses,setShieldUses] = useState<Record<number,number>>({});
  const [shots,setShots] = useState<{actor:number;target:number}[]>([]);
  const [newspapers,setNewspapers] = useState<Newspaper[]>([]);
  const [deaths,setDeaths] = useState<Player[]>([]);
  const [ballots,setBallots] = useState<(number|null)[]>([]);
  const [result,setResult] = useState('');
  const [won,setWon] = useState<WinningSide|null>(null);
  const [jesterWinner,setJesterWinner] = useState('');
  const [revivals,setRevivals] = useState<number[]>([]);
  const [revived,setRevived] = useState<Player[]>([]);
  const [necromancerUsed,setNecromancerUsed] = useState<number[]>([]);
  const [seconds,setSeconds] = useState(180);
  const discussionDeadline = useRef(0);
  const rankingRecorded = useRef(false);
  const [rankingError,setRankingError] = useState(false);
  useEffect(() => {
    if (screen !== 'end' || !won || rankingRecorded.current) return;
    rankingRecorded.current = true;
    try {
      const next=updateRankings(readRankings(),players,winningPlayers(players,won,lovers.current,jesterWinner,mindWinner));
      localStorage.setItem(RANKINGS_KEY,JSON.stringify(next));
    } catch { setRankingError(true); }
  }, [screen,won,players,jesterWinner,mindWinner]);
  // Each private turn starts at the top even if the previous player scrolled.
  useLayoutEffect(() => { window.scrollTo({top:0,behavior:'instant'}); }, [screen,index]);
  useEffect(() => { save('werewolf.names',names); }, [names]);
  useEffect(() => { save('werewolf.settings',settings); }, [settings]);
  useEffect(() => {
    if (screen !== 'discussion') return;
    const update = () => {
      const remaining = Math.max(0,Math.ceil((discussionDeadline.current-Date.now())/1000));
      setSeconds(remaining);
      if (remaining === 0) {
        setQueue(players.filter(p => p.alive).map(p => p.id));
        setIndex(0); setBallots(provocations.filter(id=>players.some(p=>p.id===id&&p.alive)).flatMap(id=>[id,id])); setScreen('vote');
      }
    };
    update();
    const timer=setInterval(update,250);
    document.addEventListener('visibilitychange',update);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange',update); };
  }, [screen,players,provocations]);
  const active = players.find(p => p.id === queue[index]);
  const [passiveWaitUntil,setPassiveWaitUntil] = useState(0);
  const [passiveSeconds,setPassiveSeconds] = useState(0);
  useEffect(() => {
    if (screen !== 'action' || !settings.passiveWait || !active || !passiveRoles.includes(active.role)) { setPassiveWaitUntil(0); setPassiveSeconds(0); return; }
    const end = Date.now() + 5000;
    setPassiveWaitUntil(end); setPassiveSeconds(5);
    const timer = setInterval(() => setPassiveSeconds(Math.max(0, Math.ceil((end - Date.now()) / 1000))), 250);
    return () => clearInterval(timer);
  }, [screen, active?.id, active?.role, settings.passiveWait]);
  const selectedCount = roleOrder.reduce((sum,r) => sum+counts[r],0);
  const adjustRole = (role: Role, delta: number) => { setCounts(current=>({...current,[role]:Math.max(0,Math.min(names.length,current[role]+delta))})); setResult(''); };
  const changeSetting = <K extends keyof Settings,>(key: K, value: Settings[K]) => setSettings(s => ({...s,[key]:value}));
  function distributeRandomly() { try { setCounts(randomLineup(names.length,settings.madmanCount)); setResult(''); } catch(e) { setResult((e as Error).message); } }
  function start() { try { const p=deal(names,counts); const chosenMadmen=selectMadmen(p,settings.madmanCount); rankingRecorded.current=false; setRankingError(false); setMadmen(chosenMadmen); setPlayers(p); setRound(1); setLastSaves({}); setMayors([]); setTempleUsed([]); setNecromancerUsed([]); setSheriffUsed([]); setShieldUses({}); setSickLife(Object.fromEntries(p.filter(x=>x.role==='sickman').map(x=>[x.id,3]))); setWatchTargets({}); setPreviousVisits([]); setInstigatorUses({}); setJesterWinner(''); lovers.current={}; setPrivateReports({}); nextFame.current={}; setLastDetentions({}); setHypnoUsed([]); setCorrupted(chosenMadmen); setFailedMayors([]); setStolenRoles({}); setMindWinner(''); mindParasites.current={}; setParasiteStock({}); setConverted([]); setGamblerCorrect({}); setGamblerDebts([]); setGamblerReady([]); setNightEscapes([]); curses.current={}; setEnragedNext(false); beginNight(p,false,chosenMadmen); } catch (e) { setResult((e as Error).message); } }
  function beginNight(p: Player[], rage = enragedNext, currentCorrupted = corrupted) { setEnraged(rage); setEnragedNext(false); nightVisits.current=[]; wolfBallots.current=[]; policeTargets.current={}; policeChoices.current={}; detectiveAttempts.current=[]; provocationAttempts.current=[]; revivalAttempts.current=[]; mayorAttempts.current=[]; fakeMayorAttempts.current=[]; parasiteAttempts.current=[]; parasiteRegens.current=[]; curseAttempts.current=[]; loverAttempts.current=[]; newspaperAttempts.current=[]; pendingReports.current={}; hypnosis.current=[]; fakeDoctorSaves.current={}; thefts.current=[]; infections.current=[]; gamblerBets.current=[]; triggeredCurses.current=[]; setProvocations([]); setFame(p.some(x=>x.alive && x.role==='police') ? nextFame.current : celebrityReveals(p,[],currentCorrupted)); nextFame.current={}; setQueue(p.filter(x=>x.alive).map(x=>x.id)); setIndex(0); setSelected([]); setWolfVotes([]); setSaves([]); setCurrentSaves({}); setAssembly(false); setAssemblyNames([]); setShots([]); setGuards([]); setBullets([]); setSerials([]); setStrong([]); setLone([]); setVisitors([]); setShields([]); setNewspapers([]); setRevivals([]); setRevived([]); setScreen('nightIntro'); }
  function nextNightTurn(votes: number[], _protectedIds: number[], doctorSaves: Record<number,number>, _nextAssembly = assembly, nextShots = shots, nextRevivals = revivals, nextGuards = guards, nextBullets = bullets, extra = {serials,visitors,shields,strong}, nextLone = lone) {
    setSelected([]);
    if (index+1 < queue.length) { setIndex(index+1); setScreen('pass'); return; }
    const detentions=resolveDetentions(Object.entries(policeTargets.current).map(([actor,target])=>({actor:Number(actor),target})));
    const blocked = new Set(detentions.blocked);
    const allowed = (id:number) => !blocked.has(id);
    const isAttempt = (id:number) => nightVisits.current.some(v=>v.actor===id);
    setLastDetentions(Object.fromEntries(Object.entries(policeChoices.current).filter(([actor])=>allowed(Number(actor)))));
    setPreviousVisits(nightVisits.current.filter(v=>allowed(v.actor)));
    setPrivateReports(Object.fromEntries(Object.entries(pendingReports.current).filter(([actor])=>allowed(Number(actor)))));
    if (players.some(p=>p.alive && p.role==='police')) nextFame.current=celebrityReveals(players,detentions.blocked,corrupted);
    setNewspapers(newspaperAttempts.current.filter(a=>allowed(a.actor)).map(a=>a.paper));
    setProvocations(provocationAttempts.current.filter(a=>allowed(a.actor) && a.target>=0).map(a=>a.target));
    setWatchTargets(previous=>{
      const next={...previous};
      for (const p of players) if (p.alive && p.role==='detective') delete next[p.id];
      for (const action of detectiveAttempts.current) if (allowed(action.actor)) next[action.actor]=action.target;
      return next;
    });
    setTempleUsed(previous=>previous.filter(id=>allowed(id) || !isAttempt(id)));
    setSheriffUsed(previous=>previous.filter(id=>allowed(id) || !isAttempt(id)));
    setNecromancerUsed(previous=>previous.filter(id=>allowed(id) || !isAttempt(id)));
    setHypnoUsed(previous=>previous.filter(id=>allowed(id) || !hypnosis.current.some(a=>a.actor===id)));
    setMayors(previous=>previous.filter(id=>allowed(id) || !mayorAttempts.current.includes(id)));
    setFailedMayors(previous=>previous.filter(id=>allowed(id) || !fakeMayorAttempts.current.includes(id)));
    setInstigatorUses(previous=>{
      const next={...previous};
      for (const a of provocationAttempts.current) if (!allowed(a.actor)) next[a.actor]=Math.max(0,(next[a.actor]||0)-1);
      return next;
    });
    setShieldUses(previous=>{
      const next={...previous};
      for (const id of extra.shields) if (!allowed(id) && players.some(p=>p.id===id && p.role==='survivor')) next[id]=Math.max(0,(next[id]||0)-1);
      return next;
    });
    setParasiteStock(previous=>{
      const next={...previous};
      for (const a of parasiteAttempts.current) if (!allowed(a.actor)) next[a.actor]=(next[a.actor] ?? 0)+1;
      for (const a of parasiteRegens.current) if (!allowed(a.actor)) next[a.actor]=Math.max(0,(next[a.actor] ?? 0)-a.amount);
      return next;
    });
    for (const a of parasiteAttempts.current) if (!allowed(a.actor)) mindParasites.current[a.actor]=(mindParasites.current[a.actor] || []).filter(id=>id!==a.target);
    for (const a of curseAttempts.current) if (!allowed(a.actor)) curses.current[a.actor]=(curses.current[a.actor] || []).filter(id=>id!==a.target);
    for (const a of loverAttempts.current) if (allowed(a.actor) && lovers.current[a.actor]===undefined && lovers.current[a.target]===undefined) {
      lovers.current={...lovers.current,[a.actor]:a.target,[a.target]:a.actor};
    }
    gamblerBets.current=gamblerBets.current.filter(a=>allowed(a.actor));
    const actualSaves=Object.fromEntries(Object.entries(doctorSaves).filter(([id])=>allowed(Number(id))));
    const actualAssembly=mayorAttempts.current.some(allowed);
    setAssemblyNames(mayorAttempts.current.filter(allowed).map(id=>players.find(p=>p.id===id)?.name || '').filter(Boolean));
    const actualRevivals=nextRevivals.filter(id=>revivalAttempts.current.some(a=>a.target===id && allowed(a.actor)));
    const successfulThefts: Visit[] = [];
    const nightResult = resolveNight(players, votes, Object.values(actualSaves), actualAssembly, nextShots.filter(a=>allowed(a.actor)), nextGuards.filter(a=>allowed(a.actor)), nextBullets.filter(a=>allowed(a.actor)), {
      serials:extra.serials.filter(a=>allowed(a.actor)),visitors:extra.visitors.filter(a=>allowed(a.actor)),shields:extra.shields.filter(allowed),strong:extra.strong.filter(a=>allowed(a.actor)),
      lone:nextLone.filter(a=>allowed(a.actor)),packVotes:wolfBallots.current.filter(a=>allowed(a.actor)),enraged,curses:curses.current,
      triggeredCurses:triggeredCurses.current.filter(allowed),thieves:thefts.current.filter(a=>allowed(a.actor)),successfulThefts,lovers:lovers.current,madmen:corrupted
    });
    const afterDebts = collectGamblerDebts(nightResult,gamblerDebts,actualSaves);
    setGamblerDebts([]);
    const illness = applyIllness(afterDebts, actualSaves, sickLife, corrupted);
    const revivedPlayers = illness.players.map(p => actualRevivals.includes(p.id) ? {...p,alive:true} : p);
    const infectionResult = applyInfections(revivedPlayers, infections.current.filter(a=>allowed(a.actor)));
    const theftResult=applyThefts(players,infectionResult.players,successfulThefts);
    const survived = theftResult.players;
    const escapeResult = resolveGamblerEscapes(survived,gamblerReady,lovers.current);
    const updated = escapeResult.players;
    setNightEscapes(escapeResult.escaped.map(id=>players.find(p=>p.id===id)?.name || '').filter(Boolean));
    setGamblerReady([]);
    setCorrupted(applyHypnosis(updated,hypnosis.current.filter(a=>allowed(a.actor)),corrupted));
    setStolenRoles(previous=>({...previous,...theftResult.stolen}));
    setConverted(prev=>[...new Set([...prev,...infectionResult.converted])]);
    for (const p of updated) if (p.role==='sickman' && actualRevivals.includes(p.id)) illness.remaining[p.id]=3;
    setSickLife(illness.remaining);
    setRevived(players.filter(p => !p.alive && updated.find(q => q.id === p.id)?.alive));
    const killed = players.filter(p => p.alive && !survived.find(q => q.id === p.id)?.alive);
    if (killed.some(p=>p.role==='wolfpup')) setEnragedNext(true);
    const mindWinnerId=mindFlayerWinner(updated,mindParasites.current,lovers.current);
    if (mindWinnerId !== null) setMindWinner(updated.find(p=>p.id===mindWinnerId)?.name || '');
    setPlayers(updated); setDeaths(killed); setLastSaves({...actualSaves,...Object.fromEntries(Object.entries(fakeDoctorSaves.current).filter(([id])=>allowed(Number(id))))}); setWon(mindWinnerId !== null ? 'mindflayer' : winner(updated,lovers.current)); setScreen('morning');
  }
  function showPrivateResult(actor: number, text: string) {
    if (players.some(p=>p.alive && p.role==='police')) {
      pendingReports.current[actor]=text;
      nextNightTurn(wolfVotes,saves,currentSaves);
    } else {setPrivateText(text);setScreen('privateResult');}
  }
  function completeAction() {
    if (!active || (settings.passiveWait && passiveRoles.includes(active.role) && Date.now() < passiveWaitUntil)) return;
    let votes=wolfVotes, protections=saves, doc=currentSaves;
    const skipWolf = ['werewolf','wolfpup','whitewolf','hypnowolf','strongwolf','lonewolf','sheriff','templar','serialkiller','thief'].includes(active.role) && round === 1 && settings.firstNightSafe;
    const required = ((['werewolf','wolfpup','whitewolf','hypnowolf'].includes(active.role) || (active.role==='rabidwolf' && round>1)) && enraged && !skipWolf) ? packTargetCount : active.role === 'chef' ? (canChefAct(players,active.id) ? 2 : 0) : (['villager','muted','mayor','jester','survivor','celebrity','sickman','journalist','intelligence'].includes(active.role) || (active.role === 'police' && !policeCanChoose) || (active.role === 'charmer' && !charmerCanChoose) || (active.role === 'mindflayer' && !mindCanPlace) || (active.role === 'raven' && players.every(p=>!p.alive || p.id===active.id || (curses.current[active.id] || []).includes(p.id))) || (active.role === 'necromancer' && (necromancerUsed.includes(active.id) || players.every(p=>p.alive || p.escaped))) || (active.role === 'templar' && templeUsed.includes(active.id)) || (active.role === 'sheriff' && sheriffUsed.includes(active.id)) || (active.role === 'instigator' && (instigatorUses[active.id] || 0) >= 2) || skipWolf ? 0 : 1);
    if (selected.length !== required) return;
    if (active.role==='police' && selected.length) {
      policeChoices.current[active.id]=selected[0];
      if (!corrupted.includes(active.id)) policeTargets.current[active.id]=selected[0];
      nightVisits.current.push({actor:active.id,target:selected[0]});
      nextNightTurn(votes,protections,doc); return;
    }
    if (active.role!=='gambler') for (const target of selected) nightVisits.current.push({actor:active.id,target});
    if (corrupted.includes(active.id)) {
      if (active.role==='seer') {
        const target=players.find(p=>p.id===selected[0]);
        const randomRole=shuffle(Object.keys(roles) as Role[])[0];
        showPrivateResult(active.id,`${target?.name} is ${roles[randomRole].name}.`); return;
      }
      if (active.role==='psychic') {
        const target=players.find(p=>p.id===selected[0]);
        const fake=shuffle(['village','wolf','neutral'])[0];
        showPrivateResult(active.id,`${target?.name} belongs to the ${fake} team.`); return;
      }
      if (active.role==='chef' && selected.length===2) { showPrivateResult(active.id,Math.random()<0.5 ? 'No trouble at the table. Your guests are on the same team.' : 'You felt tension at the table. Your guests are on different teams.'); return; }
      if (active.role==='intelligence' && round%2===0) {
        const names=shuffle(players.filter(p=>p.alive && p.id!==active.id)).slice(0,2).map(p=>p.name);
        showPrivateResult(active.id,names.length ? `${names.join(' and ')}: one of these players may be a Werewolf or neutral. Intelligence can be inaccurate.` : 'No other living players to report on.'); return;
      }
      if (active.role==='doctor' && selected.length) fakeDoctorSaves.current[active.id]=selected[0];
      if (active.role==='detective' && selected.length) detectiveAttempts.current.push({actor:active.id,target:selected[0]});
      if (active.role==='templar' && selected.length) setTempleUsed([...templeUsed,active.id]);
      if (active.role==='sheriff' && selected.length) setSheriffUsed([...sheriffUsed,active.id]);
      if (active.role==='necromancer' && selected.length) setNecromancerUsed([...necromancerUsed,active.id]);
      if (active.role==='instigator' && selected.length) { provocationAttempts.current.push({actor:active.id,target:-1}); setInstigatorUses({...instigatorUses,[active.id]:(instigatorUses[active.id]||0)+1}); }
      nextNightTurn(votes,protections,doc); return;
    }
    if (active.role==='gambler') {
      gamblerBets.current.push({actor:active.id,target:selected[0]});
      const next=[...shields,active.id]; setShields(next);
      nextNightTurn(votes,protections,doc,assembly,shots,revivals,guards,bullets,{serials,visitors,shields:next,strong}); return;
    }
    if (active.role==='charmer' && selected.length && charmerCanChoose) loverAttempts.current.push({actor:active.id,target:selected[0]});
    if (active.role==='mindflayer' && selected.length) {
      parasiteAttempts.current.push({actor:active.id,target:selected[0]});
      mindParasites.current = {...mindParasites.current,[active.id]:[...(mindParasites.current[active.id] || []),selected[0]]};
      setParasiteStock({...parasiteStock,[active.id]:(parasiteStock[active.id] ?? 3)-1});
    }
    if (active.role==='raven' && selected.length) { curseAttempts.current.push({actor:active.id,target:selected[0]}); curses.current = {...curses.current,[active.id]:[...(curses.current[active.id] || []),selected[0]]}; }
    if (active.role==='detective') detectiveAttempts.current.push({actor:active.id,target:selected[0]});
    if (active.role==='instigator' && (instigatorUses[active.id]||0)<2) { provocationAttempts.current.push({actor:active.id,target:selected[0]}); setInstigatorUses({...instigatorUses,[active.id]:(instigatorUses[active.id]||0)+1}); }
    if (active.role==='rabidwolf' && round===1) infections.current.push({actor:active.id,target:selected[0]});
    if ((['werewolf','wolfpup','whitewolf','hypnowolf'].includes(active.role) || (active.role==='rabidwolf' && round>1)) && !skipWolf) { votes=[...wolfVotes,...selected]; for(const target of selected) wolfBallots.current.push({actor:active.id,target}); setWolfVotes(votes); }
    if (active.role==='hypnowolf' && !hypnoUsed.includes(active.id)) { setSelected([]); setScreen('hypnoAction'); return; }
    if (active.role==='doctor') { protections=[...saves,selected[0]]; doc={...currentSaves,[active.id]:selected[0]}; setSaves(protections); setCurrentSaves(doc); }
    if (active.role==='lonewolf' && !skipWolf) { const next=[...lone,{actor:active.id,target:selected[0]}]; setLone(next); nextNightTurn(votes,protections,doc,assembly,shots,revivals,guards,bullets,{serials,visitors,shields,strong},next); return; }
    if (active.role==='strongwolf' && !skipWolf) { const next=[...strong,{actor:active.id,target:selected[0]}]; setStrong(next); nextNightTurn(votes,protections,doc,assembly,shots,revivals,guards,bullets,{serials,visitors,shields,strong:next}); return; }
    if (active.role==='thief' && !skipWolf) { thefts.current.push({actor:active.id,target:selected[0]}); nextNightTurn(votes,protections,doc); return; }
    if (active.role==='serialkiller' && !skipWolf) { const next=[...serials,{actor:active.id,target:selected[0]}]; setSerials(next); nextNightTurn(votes,protections,doc,assembly,shots,revivals,guards,bullets,{serials:next,visitors,shields,strong}); return; }
    if (active.role==='visitor') { const next=[...visitors,{actor:active.id,target:selected[0]}]; setVisitors(next); nextNightTurn(votes,protections,doc,assembly,shots,revivals,guards,bullets,{serials,visitors:next,shields,strong}); return; }
    if (active.role==='bodyguard') { const next=[...guards,{actor:active.id,target:selected[0]}]; setGuards(next); nextNightTurn(votes,protections,doc,assembly,shots,revivals,next); return; }
    if (active.role==='sheriff' && !sheriffUsed.includes(active.id) && !skipWolf) { const next=[...bullets,{actor:active.id,target:selected[0]}]; setBullets(next); setSheriffUsed([...sheriffUsed,active.id]); nextNightTurn(votes,protections,doc,assembly,shots,revivals,guards,next); return; }
    if (active.role==='necromancer' && !necromancerUsed.includes(active.id) && players.some(p=>!p.alive && !p.escaped)) { const next=[...revivals,selected[0]]; revivalAttempts.current.push({actor:active.id,target:selected[0]}); setRevivals(next); setNecromancerUsed([...necromancerUsed,active.id]); nextNightTurn(votes,protections,doc,assembly,shots,next); return; }
    if (active.role==='templar' && !templeUsed.includes(active.id) && !skipWolf) { const next=[...shots,{actor:active.id,target:selected[0]}]; setShots(next); setTempleUsed([...templeUsed,active.id]); nextNightTurn(votes,protections,doc,assembly,next); return; }
    if (active.role==='intelligence' && round%2===0) {
      const candidates=intelligenceReport(players,active.id).map(id=>players.find(p=>p.id===id)?.name).filter(Boolean);
      showPrivateResult(active.id,candidates.length ? `${candidates.join(' and ')}: one of these players may be a Werewolf or neutral. Intelligence can be inaccurate.` : 'No other living players to report on.'); return;
    }
    if (active.role==='psychic') { const target=players.find(p=>p.id===selected[0])!; showPrivateResult(active.id,`${target.name} belongs to the ${teamOfPlayer(target,lovers.current)} team.`); return; }
    if (active.role==='seer') { const target=players.find(p=>p.id===selected[0])!; showPrivateResult(active.id,`${target.name} is ${target.role === 'serialkiller' ? 'Villager' : target.role === 'whitewolf' ? 'Werewolf' : roles[target.role].name}.`); return; }
    if (active.role==='chef' && selected.length===2) { const [a,b]=selected.map(id=>players.find(p=>p.id===id)!); showPrivateResult(active.id,sameTeamForChef(a,b,lovers.current) ? 'No trouble at the table. Your guests are on the same team.' : 'You felt tension at the table. Your guests are on different teams.'); return; }
    nextNightTurn(votes,protections,doc);
  }
  function recordVote(vote: number|null) {
    const next=[...ballots,vote,...(active && mayors.includes(active.id) ? [vote] : [])]; setBallots(next); setSelected([]);
    if (index+1 < queue.length) {setIndex(index+1);setScreen('vote');return;}
    const id=tally(next), victim=players.find(p=>p.id===id && p.alive);
    const afterVote=players.map(p=>p.id===id ? {...p,alive:false} : p);
    const settled=settleGamblerBets(afterVote,id,gamblerBets.current,gamblerCorrect,lovers.current);
    setGamblerCorrect(settled.correct); setGamblerDebts(settled.indebted); setGamblerReady(settled.ready);
    setPlayers(settled.players); if (victim?.role==='wolfpup') setEnragedNext(true);
    const mindWinnerId=mindFlayerWinner(settled.players,mindParasites.current,lovers.current);
    if (mindWinnerId !== null) setMindWinner(settled.players.find(p=>p.id===mindWinnerId)?.name || '');
    setWon(victim?.role==='jester' && lovers.current[victim.id]===undefined ? 'jester' : mindWinnerId !== null ? 'mindflayer' : winner(settled.players,lovers.current)); if (victim?.role === 'jester' && lovers.current[victim.id]===undefined) setJesterWinner(victim.name);
    const announcement=victim ? `${victim.name} was executed${settings.revealDead ? ` — ${roles[victim.role].name}` : ''}.` : 'No one was executed. The vote was tied or skip won.';
    setResult(announcement);
    setScreen('voteResult');
  }
  const canSelect = (p: Player) => !!active && !(active.role==='police' && !canDetain(players,active.id,p.id,lastDetentions)) && !(active.role==='charmer' && lovers.current[p.id]!==undefined) && !(['werewolf','wolfpup','whitewolf','hypnowolf','rabidwolf','strongwolf','lonewolf','serialkiller','sheriff','templar','thief','raven'].includes(active.role) && lovers.current[active.id]===p.id) && !(active.role==='mindflayer' && (mindParasites.current[active.id] || []).includes(p.id)) && !(active.role==='raven' && (curses.current[active.id] || []).includes(p.id)) && (active.role === 'necromancer' ? !p.alive && !p.escaped && !revivals.includes(p.id) : p.alive) && (active.role === 'doctor' || p.id !== active.id) && canWolfTarget(active.role,p.role) && !(active.role==='doctor' && lastSaves[active.id]===p.id);
  const policeCanChoose = !!active && active.role==='police' && players.some(p=>canDetain(players,active.id,p.id,lastDetentions));
  const charmerCanChoose = !!active && active.role==='charmer' && lovers.current[active.id]===undefined && players.some(p=>p.alive && p.id!==active.id && lovers.current[p.id]===undefined);
  const mindCanPlace = !!active && active.role==='mindflayer' && (parasiteStock[active.id] ?? 3)>0 && players.some(p=>p.alive && p.id!==active.id && !(mindParasites.current[active.id] || []).includes(p.id));
  const packTargetCount = active && enraged && (['werewolf','wolfpup','whitewolf','hypnowolf'].includes(active.role) || (active.role==='rabidwolf' && round>1)) ? Math.min(2, players.filter(canSelect).length) : 1;
  const toggleTarget = (id: number) => { const max=active?.role==='chef'?2:packTargetCount; setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : max===1?[id]:s.length<max?[...s,id]:s); };
  const backHome = () => { if (window.confirm('End this game and return to the menu?')) setScreen('home'); };
  return <main className={`app ${screen==='home'?'home':['rules','players','roles'].includes(screen)?'menu': ['discussion','vote','voteResult'].includes(screen)?'day':'night'}`}>
    <div className="shell">
      {screen!=='home' && screen!=='players' && <header><button className="back" aria-label="Go back" onClick={() => { if(screen==='rules') setScreen('home'); else if(screen==='roles') setScreen('players'); else backHome(); }}>‹</button><span>{screen==='rules'?'RULEBOOK':screen==='roles'?'CHOOSE ROLES':`WEREWOLF · NIGHT ${round}`}</span>{audioPhase && <button className="sound-control" aria-label={settings.sounds?'Mute game sounds':'Enable game sounds'} aria-pressed={settings.sounds} onClick={()=>{if (!settings.sounds) playPhase(audioPhase); else audio.current?.pause();changeSetting('sounds',!settings.sounds);}}>{settings.sounds?'♫ ON':'♫ OFF'}</button>}</header>}
      {screen==='home' && <div className="home-content"><h1 className="visually-hidden">WEREWOLF</h1><div className="home-buttons"><button className="home-button home-start" onClick={()=>setScreen('players')}><Play aria-hidden="true" size={19} fill="currentColor" strokeWidth={2}/><span>START GAME</span></button><button className="home-button home-rules" onClick={()=>setScreen('rules')}><BookOpen aria-hidden="true" size={19} fill="currentColor" strokeWidth={2}/><span>HOW TO PLAY</span></button></div></div>}
      {screen==='rules' && <div className="page"><h2>THE RULEBOOK</h2><div className="panel"><h3>Gather the players</h3><p>4–24 players share one phone. Keep your role secret and pass the phone when prompted.</p></div><div className="panel"><h3>Choose your roles</h3><p>Select one role per player. The game randomly assigns the chosen roles.</p></div><div className="panel"><h3>Night, discussion and voting</h3><p>Each player privately takes a turn at night. In the morning, discuss the news, then pass the phone around to vote. A tied vote has no execution.</p></div><div className="panel"><h3>Winning</h3><p>The village wins when all werewolves are gone. Werewolves win when they equal or outnumber the remaining villagers.</p></div><div className="panel"><h3>Current edition</h3><p>Optional Madmen keep their apparent roles secret until the game ends. This playable reconstruction includes Werewolf, Villager, Doctor, Seer, Chef, Mayor, Templar, Muted, Jester, Necromancer, Bodyguard, Sheriff, Serial Killer, Visitor, Survivor, Psychic, Celebrity, Detective, Instigator, Strong Werewolf, Sick Man, Lone Werewolf, Wolf Pup, Journalist, Raven, Rabid Werewolf, White Werewolf, Gambler, Mind Flayer, Intelligence Chief, Thief, Police, Hypnotist Werewolf and Charmer. Other original roles and settings are not yet implemented.</p></div><button className="primary" onClick={()=>setScreen('home')}>GOT IT</button></div>}
      {screen==='roles' && detailRole && <RoleDetails role={detailRole} onClose={()=>setDetailRole(null)}/>}
      {screen==='players' && <PlayerSetup onBack={()=>setScreen('home')} names={names} setNames={setNames} avatars={avatars} setAvatars={setAvatars} onContinue={()=>{setCounts(emptyRoleCounts());setResult('');setScreen('roles');}}/>}
      {screen==='roles' && <div className="page role-page"><div className="heading"><div><small>PREPARE THE GAME</small><h2>Choose roles</h2></div><span className="pill">{selectedCount} / {names.length}</span></div><p className="muted">Tap a role’s picture or name to see its description and settings.</p><details className="panel" open><summary>⚙ GAME SETTINGS</summary><div className="settings"><div><button type="button" className="secondary" onClick={distributeRandomly}>RANDOM DISTRIBUTION</button><p className="muted">Build a video-inspired basic lineup: 4–8 players get one Werewolf; 9–24 get two Werewolves and a Seer. The video covers 6–16; other sizes are extrapolated. Roles are randomly assigned to players and can be adjusted here.</p><p className="muted">The reference assumes no first-night kill, revealed roles on death and skip votes. Your settings are not changed.</p></div>{([['firstNightSafe','No first night kill'],['revealDead',"Show dead player’s role"],['secretVotes','Secret voting'],['allowSkip','Allow skip vote'],['passiveWait','Wait time for passive roles'],['sounds','Game sounds']] as const).map(([key,label])=><label key={key}><span>{label}</span><input type="checkbox" checked={settings[key]} onChange={e=>changeSetting(key,e.target.checked)}/></label>)}<label><span>Discussion minutes</span><input type="number" min="1" max="15" value={settings.discussionMinutes} onChange={e=>changeSetting('discussionMinutes',Math.max(1,Math.min(15,Number(e.target.value)||1)))}/></label><label><span>Madmen (disguised roles)</span><input type="number" min="0" max={names.length} value={settings.madmanCount} onChange={e=>{changeSetting('madmanCount',Math.max(0,Math.min(names.length,Math.floor(Number(e.target.value)||0))));setResult('');}}/></label><p className="muted">Optional: randomly chosen eligible village players see their normal roles, but their abilities fail or give misleading results. Eligible selected roles: {roleOrder.filter(isEligibleMadmanRole).reduce((sum,r)=>sum+counts[r],0)}.</p></div></details>{([['village','VILLAGERS'],['wolf','WEREWOLVES'],['neutral','NEUTRALS']] as const).map(([team,label])=><section key={team}><h3 className={`section-title team-${team}`}>✦ {label} <small>{roleOrder.filter(r=>roles[r].team===team).length} / {roleOrder.length} ROLES</small></h3><div className="role-grid">{roleOrder.filter(r=>roles[r].team===team).map(r=><div className="role-choice" key={r}><button type="button" className="role-info-button" aria-label={`View ${roles[r].name} details`} onClick={()=>setDetailRole(r)}><img src={picture(r+'.webp')} alt=""/><strong>{roles[r].name}</strong><span className="role-info-hint">ⓘ DETAILS</span></button><div className="stepper"><button aria-label={`Remove ${roles[r].name}`} onClick={()=>adjustRole(r,-1)}>−</button><span>{counts[r]}</span><button aria-label={`Add ${roles[r].name}`} onClick={()=>adjustRole(r,1)}>+</button></div></div>)}</div></section>)}<p className="muted">Select exactly one role per player. Werewolves must be fewer than half of the players.</p><div className="role-start-bar">{result && <p className="warning" role="alert">{result}</p>}<button className="primary" disabled={selectedCount!==names.length} onClick={start}>▶ &nbsp; START GAME <span className="role-start-count">{selectedCount} / {names.length}</span></button></div></div>}
      {screen==='nightIntro' && <div className="center"><div className="modal"><div className="symbol">☾</div><h2>NIGHT {round} STARTED</h2><p>Everyone is sleeping. Pass the phone around so each player can use their role privately.</p><button className="primary" onClick={()=>setScreen('pass')}>CONTINUE →</button></div></div>}
      {screen==='pass' && active && <div className="center"><Avatar name={active.name} avatars={avatars} className="pass-avatar"/><h2>{active.name}</h2><p className="muted">Pass the phone to this player. No peeking!</p><button className="primary" onClick={()=>setScreen('action')}>◉ &nbsp; SHOW YOUR ROLE</button></div>}
      {screen==='action' && active && <div className="page action"><img className="role-art" src={picture(active.role+'.webp')} alt=""/><h2 className={roles[active.role].team==='wolf'?'red':'green'}>{roles[active.role].name}</h2><div className="panel description"><small>DESCRIPTION</small><p>{roles[active.role].description}</p></div>{enraged && (['werewolf','wolfpup','whitewolf','hypnowolf'].includes(active.role) || (active.role==='rabidwolf' && round>1)) && <div className="panel">The pack is enraged: choose {packTargetCount} {packTargetCount===1?'target':'targets'} tonight.</div>}{stolenRoles[active.id] && <div className="panel">You stole this role and joined its team.</div>}{converted.includes(active.id) && <div className="panel">The Rabid Werewolf converted you. You are now on the werewolf team.</div>}{privateReports[active.id] && <div className="panel"><small>PREVIOUS NIGHT REPORT</small><p>{privateReports[active.id]}</p></div>}{lovers.current[active.id] !== undefined && <div className="panel">Your lover: {players.find(p=>p.id===lovers.current[active.id])?.name}. You are on the independent Lovers team. {players.find(p=>p.id===lovers.current[active.id])?.alive ? 'Your lover is alive.' : 'Your lover has been eliminated, but you can still win.'}</div>}{active.role==='chef' && !canChefAct(players,active.id) && <div className="panel">Not enough other living players to invite tonight.</div>}{players.some(p=>p.alive && p.role==='police') && ['seer','psychic','chef','intelligence','mindflayer'].includes(active.role) && <div className="panel">Night results are delivered privately on your next turn.</div>}{active.role==='intelligence' && <div className="panel">{round%2===0 ? 'Your intelligence report is ready. It may be inaccurate.' : 'No intelligence report tonight. Reports arrive every two nights.'}</div>}{active.role==='mindflayer' && <div className="panel">Parasites remaining: {parasiteStock[active.id] ?? 3}. Parasitized: {(mindParasites.current[active.id] || []).map(id=>players.find(p=>p.id===id)).filter(p=>p?.alive).map(p=>p!.name).join(', ') || 'None'}.</div>}{active.role==='gambler' && <div className="panel">Correct predictions: {gamblerCorrect[active.id] || 0} / 2.{gamblerDebts.includes(active.id) ? ' Your creditors are coming tonight. A Doctor must save you.' : ''}{gamblerReady.includes(active.id) ? ' If you survive tonight, you will escape in the morning.' : ''}</div>}{active.role==='rabidwolf' && round===1 && <div className="panel">Choose a player to infect tonight. From the next night, you vote with the pack.</div>}{active.role==='sickman' && <div className="panel">Nights remaining without a Doctor visit: {sickLife[active.id] ?? 3}.</div>}{active.role==='detective' && watchTargets[active.id] !== undefined && corrupted.includes(active.id) && <div className="panel">Last night’s visitors to {players.find(p=>p.id===watchTargets[active.id])?.name}: None</div>}{active.role==='detective' && !corrupted.includes(active.id) && watchTargets[active.id] !== undefined && <div className="panel">Last night’s visitors to {players.find(p=>p.id===watchTargets[active.id])?.name}: {visitorsTo(previousVisits,watchTargets[active.id]).map(id=>players.find(p=>p.id===id)?.name).filter(Boolean).join(', ') || 'None'}</div>}{fame[active.id]?.length > 0 && <div className="panel">You recognize {fame[active.id].join(', ')} as a Celebrity.</div>}{['werewolf','wolfpup','strongwolf','rabidwolf','whitewolf','hypnowolf'].includes(active.role) && <div className="panel">Your pack: {players.filter(p=>knownPackmate(active.role,p.role) && p.id!==active.id && p.alive).map(p=>p.name).join(', ') || 'You are the only living werewolf.'}</div>}{['werewolf','wolfpup','whitewolf','hypnowolf','strongwolf','lonewolf','sheriff','templar','serialkiller','thief'].includes(active.role) && round===1 && settings.firstNightSafe && <div className="panel">No killing ability on the first night.{['werewolf','wolfpup','strongwolf','rabidwolf','whitewolf','hypnowolf'].includes(active.role) ? ' Meet your teammates.' : ''}</div>}{!['villager','muted','mayor','jester','survivor','celebrity','sickman','journalist','intelligence'].includes(active.role) && !(active.role==='police' && !policeCanChoose) && !(active.role==='charmer' && !charmerCanChoose) && !(active.role==='chef' && !canChefAct(players,active.id)) && !(active.role==='mindflayer' && !mindCanPlace) && !(active.role==='raven' && players.every(p=>!p.alive || p.id===active.id || (curses.current[active.id] || []).includes(p.id))) && !(active.role==='necromancer' && (necromancerUsed.includes(active.id) || players.every(p=>p.alive || p.escaped))) && !(active.role==='templar' && templeUsed.includes(active.id)) && !(active.role==='sheriff' && sheriffUsed.includes(active.id)) && !(active.role==='instigator' && (instigatorUses[active.id]||0)>=2) && !(['werewolf','wolfpup','whitewolf','hypnowolf','strongwolf','lonewolf','sheriff','templar','serialkiller','thief'].includes(active.role) && round===1 && settings.firstNightSafe) && <><p className="muted">{active.role==='chef' ? `Choose two players (${selected.length}/2)` : enraged && (['werewolf','wolfpup','whitewolf','hypnowolf'].includes(active.role) || (active.role==='rabidwolf' && round>1)) ? `Choose ${packTargetCount} targets (${selected.length}/${packTargetCount})` : active.role==='necromancer' ? 'Choose a dead player to revive' : 'Choose a player'}</p><div className="targets">{players.map(p=><button key={p.id} className={`target ${selected.includes(p.id)?'selected':''} ${!p.alive?'dead':''}`} disabled={!canSelect(p)} onClick={()=>toggleTarget(p.id)}><Avatar name={p.name} avatars={avatars} className="target-avatar"/><strong>{p.name}</strong>{!p.alive && <small>{p.escaped ? 'ESCAPED' : 'DEAD'}</small>}</button>)}</div></>}{active.role==='raven' && <div className="panel">Marked: {(curses.current[active.id] || []).map(id=>players.find(p=>p.id===id)).filter(p=>p?.alive).map(p=>p!.name).join(', ') || 'None'}</div>}{active.role==='raven' && (curses.current[active.id] || []).some(id=>players.some(p=>p.id===id && p.alive)) && <button className="secondary" onClick={()=>{triggeredCurses.current.push(active.id);nextNightTurn(wolfVotes,saves,currentSaves);}}>ACTIVATE CURSE</button>}{active.role==='survivor' && (shieldUses[active.id] || 0) < 3 && <button className="secondary" onClick={()=>{const next=[...shields,active.id]; setShields(next); setShieldUses({...shieldUses,[active.id]:(shieldUses[active.id]||0)+1});nextNightTurn(wolfVotes,saves,currentSaves,assembly,shots,revivals,guards,bullets,{serials,visitors,shields:next,strong});}}>USE SHIELD ({3-(shieldUses[active.id]||0)} LEFT)</button>}{active.role==='survivor' && (shieldUses[active.id] || 0) >= 3 && <div className="panel">No shields remaining.</div>}{active.role==='mayor' && !mayors.includes(active.id) && !failedMayors.includes(active.id) && <button className="secondary" onClick={()=>{if(corrupted.includes(active.id)){fakeMayorAttempts.current.push(active.id);setFailedMayors([...failedMayors,active.id]);nextNightTurn(wolfVotes,saves,currentSaves);return;}mayorAttempts.current.push(active.id);setMayors([...mayors,active.id]);setAssemblyNames([...assemblyNames,active.name]);setAssembly(true);nextNightTurn(wolfVotes,saves,currentSaves,true);}}>DECLARE EMERGENCY ASSEMBLY</button>}{active.role==='mayor' && (mayors.includes(active.id) || failedMayors.includes(active.id)) && <div className="panel">Your emergency assembly has already been used.</div>}{active.role==='templar' && templeUsed.includes(active.id) && <div className="panel">Your holy water has already been used.</div>}{active.role==='journalist' && <JournalistEditor key={active.id} onSubmit={paper=>{if(!corrupted.includes(active.id) && (paper.headline || paper.drawing)) newspaperAttempts.current.push({actor:active.id,paper}); nextNightTurn(wolfVotes,saves,currentSaves);}}/>}<p className="muted tip">Pass the phone to the next player after completing your action.</p>{settings.passiveWait && passiveRoles.includes(active.role) && passiveSeconds > 0 && <p className="muted" role="status">Please wait {passiveSeconds} seconds before passing the phone.</p>}{active.role!=='journalist' && active.role!=='mindflayer' && <button className="primary bottom" onClick={completeAction} disabled={(settings.passiveWait && passiveRoles.includes(active.role) && passiveSeconds > 0) || (active.role==='chef'?canChefAct(players,active.id) && selected.length!==2:enraged && (['werewolf','wolfpup','whitewolf','hypnowolf'].includes(active.role) || (active.role==='rabidwolf' && round>1)) && !(round===1&&settings.firstNightSafe)?selected.length!==packTargetCount:['villager','muted','mayor','jester','survivor','celebrity','sickman','journalist','intelligence'].includes(active.role)||(active.role==='police' && !policeCanChoose)||(active.role==='charmer' && !charmerCanChoose)||(active.role==='raven' && players.every(p=>!p.alive || p.id===active.id || (curses.current[active.id] || []).includes(p.id)))||(active.role==='necromancer'&&(necromancerUsed.includes(active.id)||players.every(p=>p.alive || p.escaped)))||(active.role==='templar'&&templeUsed.includes(active.id))||(active.role==='sheriff'&&sheriffUsed.includes(active.id))||(active.role==='instigator'&&(instigatorUses[active.id]||0)>=2)||(['werewolf','wolfpup','whitewolf','hypnowolf','strongwolf','lonewolf','sheriff','templar','serialkiller','thief'].includes(active.role)&&round===1&&settings.firstNightSafe)?false:selected.length!==1)}>{(active.role==='chef' && !canChefAct(players,active.id)) || ['villager','muted','mayor','jester','survivor','celebrity','sickman','journalist','intelligence'].includes(active.role)||(active.role==='police' && !policeCanChoose)||(active.role==='charmer' && !charmerCanChoose)||(active.role==='raven' && players.every(p=>!p.alive || p.id===active.id || (curses.current[active.id] || []).includes(p.id)))||(active.role==='necromancer'&&(necromancerUsed.includes(active.id)||players.every(p=>p.alive || p.escaped)))||(active.role==='templar'&&templeUsed.includes(active.id))||(active.role==='sheriff'&&sheriffUsed.includes(active.id))||(active.role==='instigator'&&(instigatorUses[active.id]||0)>=2)||(['werewolf','wolfpup','whitewolf','hypnowolf','strongwolf','lonewolf','sheriff','templar','serialkiller','thief'].includes(active.role)&&round===1&&settings.firstNightSafe)?(active.role==='intelligence' && round%2===0?'VIEW INTEL':'SKIP'):'COMPLETE ACTION'}</button>}{active.role==='mindflayer' && mindCanPlace && <button className="primary bottom" disabled={selected.length!==1} onClick={completeAction}>PLANT PARASITE</button>}{active.role==='mindflayer' && <button className="secondary" onClick={()=>{const before=parasiteStock[active.id] ?? 3;const after=regenerateParasite(before);parasiteRegens.current.push({actor:active.id,amount:after-before});setParasiteStock({...parasiteStock,[active.id]:after});showPrivateResult(active.id,after>before ? 'You generated one parasite.' : 'You did not generate a parasite tonight.');}}>SKIP AND TRY TO GENERATE</button>}{active.role==='police' && <button className="secondary" onClick={()=>nextNightTurn(wolfVotes,saves,currentSaves)}>SKIP DETENTION</button>}{active.role==='thief' && !(round===1 && settings.firstNightSafe) && <button className="secondary" onClick={()=>nextNightTurn(wolfVotes,saves,currentSaves)}>SKIP THEFT</button>}{active.role==='gambler' && <button className="secondary" onClick={()=>nextNightTurn(wolfVotes,saves,currentSaves)}>SKIP BET</button>}{active.role==='instigator' && (instigatorUses[active.id]||0)<2 && <button className="secondary" onClick={()=>nextNightTurn(wolfVotes,saves,currentSaves)}>SAVE PROVOCATION FOR LATER</button>}{active.role==='necromancer' && !necromancerUsed.includes(active.id) && players.some(p=>!p.alive && !p.escaped) && <button className="secondary" onClick={()=>nextNightTurn(wolfVotes,saves,currentSaves)}>SAVE REVIVAL FOR LATER</button>}{active.role==='sheriff' && !sheriffUsed.includes(active.id) && <button className="secondary" onClick={()=>nextNightTurn(wolfVotes,saves,currentSaves)}>SAVE BULLET FOR LATER</button>}{active.role==='templar' && !templeUsed.includes(active.id) && <button className="secondary" onClick={()=>nextNightTurn(wolfVotes,saves,currentSaves)}>SAVE HOLY WATER FOR LATER</button>}</div>}
      {screen==='hypnoAction' && active && <div className="page action"><img className="role-art" src={picture('hypnowolf.webp')} alt=""/><h2>Hypnotist Werewolf</h2><p>Once per game, choose someone to hypnotize. It works on villagers and takes effect after this night.</p><div className="targets">{players.map(p=><button key={p.id} className={`target ${selected[0]===p.id?'selected':''}`} disabled={!canSelect(p)} onClick={()=>setSelected([p.id])}><Avatar name={p.name} avatars={avatars} className="target-avatar"/><strong>{p.name}</strong></button>)}</div><button className="primary bottom" disabled={selected.length!==1} onClick={()=>{hypnosis.current.push({actor:active.id,target:selected[0]});nightVisits.current.push({actor:active.id,target:selected[0]});setHypnoUsed([...hypnoUsed,active.id]);nextNightTurn(wolfVotes,saves,currentSaves);}}>HYPNOTIZE</button><button className="secondary" onClick={()=>nextNightTurn(wolfVotes,saves,currentSaves)}>SAVE HYPNOSIS FOR LATER</button></div>}
      {screen==='privateResult' && <div className="center"><div className="modal"><div className="symbol">◉</div><h2>PRIVATE RESULT</h2><p>{privateText}</p><button className="primary" onClick={()=>nextNightTurn(wolfVotes,saves,currentSaves)}>OK · HIDE RESULT</button></div></div>}
      {screen==='morning' && <div className="center"><div className="modal"><div className="symbol">☀</div><h2>{deaths.length?'THE VILLAGE AWAKES':'NIGHT ENDED'}</h2><p>{deaths.length ? deaths.map(p=>`${p.name} died${settings.revealDead ? ` (${roles[p.role].name})` : ''}.`).join(' ') : 'No one was killed tonight.'}</p>{nightEscapes.length > 0 && <p>{nightEscapes.join(', ')} escaped the village victorious.</p>}{newspapers.map((paper,i)=><article className="newspaper" key={i}><small>THE MORNING PAPER</small><h3>{paper.headline || 'The village news'}</h3>{paper.drawing && <img src={paper.drawing} alt="Newspaper drawing"/>}</article>)}{provocations.length > 0 && <p>Provoked: {provocations.map(id=>players.find(p=>p.id===id)?.name).filter(Boolean).join(', ')}. Each receives two votes against them.</p>}{revived.length > 0 && <p>{revived.map(p=>p.name).join(', ')} returned to life.</p>}{assemblyNames.length > 0 && <p>{assemblyNames.join(', ')} declared an emergency assembly.</p>}<button className="primary" onClick={()=>{if(won)setScreen('end');else {discussionDeadline.current=Date.now()+settings.discussionMinutes*60000;setSeconds(settings.discussionMinutes*60);setScreen('discussion');}}}>CONTINUE →</button></div></div>}
      {screen==='discussion' && <div className="center"><div className="timer">{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</div><h2>DISCUSS YOUR SUSPECTS</h2><p>Who can you trust?</p><button className="secondary" onClick={()=>{discussionDeadline.current=Math.max(discussionDeadline.current,Date.now())+60000;setSeconds(Math.ceil((discussionDeadline.current-Date.now())/1000));}}>+1 MINUTE</button><button className="primary" onClick={()=>{setQueue(players.filter(p=>p.alive).map(p=>p.id));setIndex(0);setBallots(provocations.filter(id=>players.some(p=>p.id===id&&p.alive)).flatMap(id=>[id,id]));setScreen('vote');}}>END DISCUSSION →</button></div>}
      {screen==='vote' && active && <div className="page"><h2>{active.name}, who are you voting for?</h2><p className="muted">Pass the phone to {active.name} to vote.</p>{lovers.current[active.id] !== undefined && <div className="panel">Your lover is {players.find(p=>p.id===lovers.current[active.id])?.name}. You are on the independent Lovers team.</div>}<div className="targets">{players.map(p=><button key={p.id} className={`target ${selected[0]===p.id?'selected':''}`} disabled={!p.alive || p.id===active.id || lovers.current[active.id]===p.id} onClick={()=>setSelected([p.id])}><Avatar name={p.name} avatars={avatars} className="target-avatar"/><strong>{p.name}</strong>{!p.alive && <small>{p.escaped ? 'ESCAPED' : 'DEAD'}</small>}</button>)}</div>{!settings.secretVotes && <p className="muted">Votes so far: {ballots.map(v=>v===null?'Skip':players.find(p=>p.id===v)?.name).join(', ') || 'None'}</p>}<button className="primary bottom" disabled={!selected.length} onClick={()=>recordVote(selected[0])}>VOTE</button>{settings.allowSkip && <button className="secondary" onClick={()=>recordVote(null)}>SKIP VOTE</button>}</div>}
      {screen==='voteResult' && <div className="center"><div className="modal"><div className="symbol">⚖</div><h2>THE VILLAGE HAS DECIDED</h2><p>{result}</p><button className="primary" onClick={()=>{if(won)setScreen('end');else {setRound(r=>r+1);beginNight(players);}}}>CONTINUE →</button></div></div>}
      {screen==='end' && <div className="center"><div className="modal"><div className="symbol">✦</div><h2>{won==='wolf'?'WEREWOLVES WIN':won==='jester'?`${jesterWinner.toUpperCase()} THE JESTER WINS`:won==='serialkiller'?'SERIAL KILLER WINS':won==='raven'?'RAVEN WINS':won==='whitewolf'?'WHITE WEREWOLF WINS':won==='mindflayer'?`${mindWinner.toUpperCase()} THE MIND FLAYER WINS`:won==='lovers'?'THE LOVERS WIN':won==='draw'?'NO SURVIVORS':'VILLAGE WINS'}</h2><p>The game is over. {players.some(p=>p.alive && p.role==='survivor' && lovers.current[p.id]===undefined) ? `Surviving ${players.filter(p=>p.alive && p.role==='survivor' && lovers.current[p.id]===undefined).map(p=>p.name).join(', ')} also win.` : ''} Here are the hidden roles:</p>{rankingError && <p className="warning" role="alert">Could not save local rankings. Storage may be full or disabled.</p>}{players.map(p=><div className="result-row" key={p.id}><strong>{p.name}</strong><span>{roles[p.role].name}{madmen.includes(p.id) ? (corrupted.includes(p.id) ? ' · Madman' : ' · Former Madman') : ''}{p.escaped?' · escaped victorious':p.alive?'':' · eliminated'}</span></div>)}<button className="primary" onClick={()=>setScreen('home')}>BACK TO MENU</button></div></div>}
    </div>
  </main>;
}
