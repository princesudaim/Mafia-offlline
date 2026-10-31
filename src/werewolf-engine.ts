export type Role = 'werewolf' | 'villager' | 'doctor' | 'seer' | 'chef' | 'mayor' | 'templar' | 'muted' | 'jester' | 'necromancer' | 'bodyguard' | 'sheriff' | 'serialkiller' | 'survivor' | 'visitor' | 'psychic' | 'celebrity' | 'detective' | 'instigator' | 'strongwolf' | 'sickman' | 'lonewolf' | 'wolfpup' | 'journalist' | 'raven' | 'rabidwolf' | 'whitewolf' | 'gambler' | 'mindflayer' | 'intelligence' | 'thief' | 'police' | 'hypnowolf' | 'charmer';
export type Player = { id: number; name: string; role: Role; alive: boolean; escaped?: boolean };
export type Settings = { firstNightSafe: boolean; revealDead: boolean; secretVotes: boolean; allowSkip: boolean; passiveWait: boolean; passiveWaitSeconds: number; allRolesWait: boolean; allRolesWaitSeconds: number; doctorSelfProtect: boolean; doctorRepeatProtect: boolean; sheriffEveryNight: boolean; templarUses: number; necromancerUses: number; instigatorMaxUses: number; celebrityAudience: number; intelligenceInterval: number; detectiveShowNames: boolean; seerShowExactRole: boolean; sickStartingNights: number; sickDoctorBonus: number; mayorDoubleVote: boolean; chefNeutralsTogether: boolean; visitorDangerousRoles: boolean; visitorAttackedTarget: boolean; bodyguardProtectAll: boolean; policeRepeatTarget: boolean; journalistDrawing: boolean; psychicShowFriends: boolean; roleWaitSeconds: Partial<Record<Role, number>>; wolfPupAttackCount: number; rabidCanInfect: boolean; hypnoMaxUses: number; wolfRandomTies: boolean; loneWolfInterval: number; strongWolfInterval: number; survivorShieldCount: number; mindStartingParasites: number; mindRegenPercent: number; gamblerPredictions: number; gamblerBetProtection: boolean; ravenReflectAttackers: boolean; serialKillerInterval: number; thiefAttackInterval: number; whiteWolfBetrayPack: boolean; charmerFirstNight: number; randomUniqueRoles: boolean; distributionFollowChances: boolean; roleChances: Partial<Record<Role, number>>; sounds: boolean; discussionMinutes: number; madmanCount: number };
export const roles: Record<Role, {name: string; description: string; team: 'wolf' | 'village' | 'neutral'}> = {
  charmer: { name: 'Charmer', team: 'neutral', description: 'Choose another player to become your friend. Together you form an independent Friends team. You win when all opponents are gone, even if only one friend remains alive.' },
  police: { name: 'Police', team: 'village', description: 'Detain one player at night to block their role action. You cannot detain the same player on consecutive nights.' },
  hypnowolf: { name: 'Hypnotist Werewolf', team: 'wolf', description: 'Vote with the pack. Once per game, hypnotize a villager; their ability later fails or gives misleading results.' },
  thief: { name: 'Thief', team: 'neutral', description: 'Visit and kill a player at night. If your attack succeeds, steal their role and join their team.' },
  intelligence: { name: 'Intelligence Chief', team: 'village', description: 'Every two nights, receive intelligence about players. One of the named players may be a Werewolf or neutral, but not all intelligence is accurate.' },
  mindflayer: { name: 'Mind Flayer', team: 'neutral', description: 'Plant a secret parasite in another player each night. Win when all other living players are parasitized. Skip your turn for a 20% chance to generate a parasite.' },
  gambler: { name: 'Gambler', team: 'neutral', description: 'Bet on who will be executed. While betting, you are protected at night. After two correct predictions, survive the next night to escape victorious; a wrong prediction brings creditors the next night unless a Doctor saves you.' },
  whitewolf: { name: 'White Werewolf', team: 'neutral', description: 'You appear as a Werewolf and vote with the pack, but you play alone. Be the last player alive; if the pack wins, you lose.' },
  rabidwolf: { name: 'Rabid Werewolf', team: 'wolf', description: 'On the first night, infect a player and turn them into a Werewolf. After that, vote with the pack each night.' },
  raven: { name: 'Raven', team: 'neutral', description: 'Each night, mark a player or activate your curse to kill all marked players. If a marked player attacks you, they die instead. Survive alone to win.' },
  journalist: { name: 'Journalist', team: 'village', description: 'Write a headline and draw a picture at night. Your newspaper is revealed to everyone in the morning.' },
  wolfpup: { name: 'Wolf Pup', team: 'wolf', description: 'Vote with the pack each night. If you die, the pack can attack two players the next night.' },
  lonewolf: { name: 'Lone Werewolf', team: 'wolf', description: 'You win with the wolves, but neither you nor the pack know each other. Attack one player independently, before the pack attack.' },
  sickman: { name: 'Sick Man', team: 'village', description: 'You die after three nights unless a Doctor helps. Each Doctor visit adds two nights.' },
  strongwolf: { name: 'Strong Werewolf', team: 'wolf', description: 'You know the pack and win with the wolves. Independently attack one player each night.' },
  werewolf: { name: 'Werewolf', team: 'wolf', description: 'Vote with your pack to attack a player at night. Eliminate the village without being discovered.' },
  villager: { name: 'Villager', team: 'village', description: 'You have no night ability. Discuss, investigate through conversation, and vote out the werewolves.' },
  doctor: { name: 'Doctor', team: 'village', description: 'Protect one player from the werewolf attack each night. You may protect yourself, but not the same player on consecutive nights.' },
  detective: { name: 'Detective', team: 'village', description: 'Choose a player to investigate each night. On your next turn, learn who visited them during the previous night.' },
  instigator: { name: 'Instigator', team: 'village', description: 'Twice per game, provoke a player at night. They begin the next vote with two votes against them.' },
  psychic: { name: 'Psychic', team: 'village', description: 'Use your crystal ball to learn a player’s team each night.' },
  celebrity: { name: 'Celebrity', team: 'village', description: 'You are famous: each night one other living player learns your identity.' },
  serialkiller: { name: 'Serial Killer', team: 'neutral', description: 'Kill one player each night and be the last one standing. You appear as a Villager to the Seer.' },
  survivor: { name: 'Survivor', team: 'neutral', description: 'Survive until the end of the game. You have three shields to protect yourself at night.' },
  visitor: { name: 'Visitor', team: 'village', description: 'Visit a player each night. You die if they are attacked or if you visit a Werewolf or Serial Killer.' },
  bodyguard: { name: 'Bodyguard', team: 'village', description: 'Protect a villager each night. If your target would die, you sacrifice yourself in their place.' },
  sheriff: { name: 'Sheriff', team: 'village', description: 'You may shoot another player at night. Use your one bullet carefully, because an innocent can be killed.' },
  seer: { name: 'Seer', team: 'village', description: 'Each night, learn the true role of one player.' },
  jester: { name: 'Jester', team: 'neutral', description: 'Your goal is to be executed by the village vote. If you succeed, you win immediately and the game ends.' },
  necromancer: { name: 'Necromancer', team: 'village', description: 'Once per game, bring one dead player back to life.' },
  mayor: { name: 'Mayor', team: 'village', description: 'Once per game, declare an emergency assembly at night to protect the village and reveal yourself. Your vote then counts twice.' },
  templar: { name: 'Templar', team: 'village', description: 'Once per game, use holy water on a player. A werewolf dies; if the target is innocent, you die instead.' },
  muted: { name: 'Muted', team: 'village', description: 'You cannot speak during the game. Communicate using gestures and vote with the village.' },
  chef: { name: 'Chef', team: 'village', description: 'Invite two players to dinner each night. Learn whether they are on the same team.' },
};
export const defaults: Settings = {firstNightSafe: true, revealDead: true, secretVotes: true, allowSkip: true, passiveWait: false, passiveWaitSeconds: 5, allRolesWait: false, allRolesWaitSeconds: 5, doctorSelfProtect: true, doctorRepeatProtect: false, sheriffEveryNight: false, templarUses: 1, necromancerUses: 1, instigatorMaxUses: 2, celebrityAudience: 1, intelligenceInterval: 2, detectiveShowNames: true, seerShowExactRole: true, sickStartingNights: 3, sickDoctorBonus: 2, mayorDoubleVote: true, chefNeutralsTogether: true, visitorDangerousRoles: true, visitorAttackedTarget: true, bodyguardProtectAll: false, policeRepeatTarget: false, journalistDrawing: true, psychicShowFriends: true, roleWaitSeconds: {}, wolfPupAttackCount: 2, rabidCanInfect: true, hypnoMaxUses: 1, wolfRandomTies: false, loneWolfInterval: 1, strongWolfInterval: 1, survivorShieldCount: 3, mindStartingParasites: 3, mindRegenPercent: 20, gamblerPredictions: 2, gamblerBetProtection: true, ravenReflectAttackers: true, serialKillerInterval: 1, thiefAttackInterval: 1, whiteWolfBetrayPack: true, charmerFirstNight: 1, randomUniqueRoles: false, distributionFollowChances: false, roleChances: {}, sounds: false, discussionMinutes: 3, madmanCount: 0};
export function shuffle<T>(items: T[], random = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
// The neutral White Werewolf appears to be a wolf for abilities that detect wolves.
export function appearsWerewolf(role: Role): boolean {
  return role === 'whitewolf' || roles[role].team === 'wolf';
}
/** The Seer's view preserves special disguises in either reporting mode. */
export function seerReading(role: Role, showExactRole = true): string {
  const apparentRole: Role = role === 'serialkiller' ? 'villager' : role === 'whitewolf' ? 'werewolf' : role;
  return showExactRole ? roles[apparentRole].name : appearsWerewolf(apparentRole) ? 'a Werewolf' : 'not a Werewolf';
}
// Lone wolves are on the wolf team but are hidden from the known pack.
export function knownPackmate(a: Role, b: Role): boolean {
  return (['werewolf','strongwolf','wolfpup','rabidwolf','whitewolf','hypnowolf'].includes(a)) && (['werewolf','strongwolf','wolfpup','rabidwolf','whitewolf','hypnowolf'].includes(b));
}
// A White Werewolf can betray known packmates when casting a pack vote.
export function canWolfTarget(actor: Role, target: Role, whiteCanBetray = true): boolean {
  return (actor === 'whitewolf' && whiteCanBetray) || !knownPackmate(actor, target);
}
export type WinningSide = 'village' | 'wolf' | 'jester' | 'serialkiller' | 'raven' | 'whitewolf' | 'mindflayer' | 'friends' | 'draw';
/** Paired players retain their roles but belong to an independent Friends team. */
export function teamOfPlayer(player: Player, lovers: Record<number,number> = {}): 'village'|'wolf'|'neutral'|'friends' {
  return lovers[player.id] !== undefined ? 'friends' : roles[player.role].team;
}
export function sameTeamForChef(a: Player, b: Player, lovers: Record<number,number> = {}, neutralsTogether = true): boolean {
  if (lovers[a.id] !== undefined || lovers[b.id] !== undefined) return lovers[a.id] === b.id && lovers[b.id] === a.id;
  if (!neutralsTogether && (roles[a.role].team === 'neutral' || roles[b.role].team === 'neutral')) return false;
  return roles[a.role].team === roles[b.role].team;
}
export function winner(players: Player[], lovers: Record<number,number> = {}): WinningSide | null {
  const alive = players.filter(p => p.alive);
  if (!alive.length) return 'draw';
  // Each pair is a separate team. A surviving partner can still win alone.
  for (const p of alive) {
    const partner=lovers[p.id];
    if (partner !== undefined && alive.every(q=>q.id===p.id || q.id===partner)) return 'friends';
  }
  const unpaired = alive.filter(p=>lovers[p.id]===undefined);
  const livingLovers = alive.length !== unpaired.length;
  const wolves = unpaired.filter(p => roles[p.role].team === 'wolf').length;
  const whiteWolves = unpaired.filter(p => p.role === 'whitewolf').length;
  const killers = unpaired.filter(p => p.role === 'serialkiller').length;
  const thieves = unpaired.filter(p => p.role === 'thief').length;
  const mindFlayers = unpaired.filter(p => p.role === 'mindflayer').length;
  const charmers = unpaired.filter(p => p.role === 'charmer').length;
  const ravens = unpaired.filter(p => p.role === 'raven').length;
  if (alive.length === 1 && whiteWolves) return 'whitewolf';
  if (killers || ravens || thieves || mindFlayers || charmers) return alive.length === 1 ? (killers ? 'serialkiller' : ravens ? 'raven' : thieves || charmers ? 'draw' : null) : null;
  if (!wolves) return whiteWolves || livingLovers ? null : 'village';
  return wolves >= alive.length - wolves ? 'wolf' : null;
}
export function voteWinner(players: Player[], executedId: number | null, lovers: Record<number,number> = {}): WinningSide | null {
  const executed = players.find(p => p.id === executedId && p.alive);
  if (executed?.role === 'jester' && lovers[executed.id] === undefined) return 'jester';
  return winner(players.map(p => p.id === executedId ? {...p, alive: false} : p),lovers);
}

/** A tie produces no elimination. Skip participates as a normal vote. */
export function tally(votes: (number | null)[]): number | null {
  const counts = new Map<number | null, number>();
  for (const v of votes) counts.set(v, (counts.get(v) || 0) + 1);
  const sorted = [...counts.entries()].sort((a,b) => b[1] - a[1]);
  return !sorted.length || (sorted.length > 1 && sorted[0][1] === sorted[1][1]) ? null : sorted[0][0];
}
/** Pick top pack targets. By default a cutoff tie selects no tied target. */
export function tallyPack(votes: number[], limit: number, randomTies = false, random = Math.random): number[] {
  const counts = new Map<number, number>();
  for (const v of votes) counts.set(v, (counts.get(v) || 0) + 1);
  const levels = [...new Set(counts.values())].sort((a,b)=>b-a);
  const result: number[] = [];
  for (const score of levels) {
    const tied = [...counts].filter(([, n])=>n===score).map(([id])=>id);
    if (tied.length > limit-result.length) { if (randomTies) result.push(...shuffle(tied,random).slice(0,limit-result.length)); break; }
    result.push(...tied);
    if (result.length===limit) break;
  }
  return result;
}
/** Random card chances are relative weights; manually selected counts are untouched. */
export function resolveRandomRoles(counts: Record<Role,number>, randomCounts: Record<'village'|'wolf'|'neutral',number>, order: Role[], chances: Partial<Record<Role,number>> = {}, unique = false, random = Math.random): Record<Role,number> {
  const resolved = {...counts};
  for (const team of ['village','wolf','neutral'] as const) {
    for (let i=0; i<randomCounts[team]; i++) {
      const candidates = order.filter(role => roles[role].team===team && (!unique || resolved[role]===0)).map(role=>{
        const raw = chances?.[role];
        const weight = typeof raw==='number' && Number.isFinite(raw) ? Math.max(0,Math.min(100,raw)) : 100;
        return {role,weight};
      }).filter(candidate=>candidate.weight>0);
      const total=candidates.reduce((sum,candidate)=>sum+candidate.weight,0);
      if (!total) throw new Error(`Not enough eligible ${team} roles for Random cards. Increase role chances or allow repeated roles.`);
      let draw=Math.max(0,Math.min(0.999999999999,random()))*total;
      let chosen=candidates[candidates.length-1].role;
      for (const candidate of candidates) { if (draw<candidate.weight) { chosen=candidate.role; break; } draw-=candidate.weight; }
      resolved[chosen]++;
    }
  }
  return resolved;
}
export function deal(names: string[], counts: Record<Role, number>): Player[] {
  if (Object.keys(roles).some(r => !Number.isInteger(counts[r as Role]) || counts[r as Role] < 0)) throw new Error('Role counts must be non-negative whole numbers.');
  const deck = shuffle((Object.keys(roles) as Role[]).flatMap(r => Array(counts[r]).fill(r) as Role[]));
  const wolfCount = (Object.keys(roles) as Role[]).filter(r => roles[r].team === 'wolf').reduce((sum,r) => sum + counts[r],0);
  if (names.length !== deck.length || wolfCount < 1 || wolfCount >= names.length / 2) throw new Error('Choose one role per player and keep wolves fewer than half of the players.');
  return names.map((name, id) => ({ id, name, role: deck[id], alive: true }));
}

/** Video-inspired basic lineup. Assignment to individual players is randomized by deal(). */
export function randomLineup(playerCount: number, madmanCount = 0): Record<Role,number> {
  if (!Number.isInteger(playerCount) || playerCount < 4 || playerCount > 24) throw new Error('Automatic distribution needs 4–24 players.');
  if (!Number.isInteger(madmanCount) || madmanCount < 0) throw new Error('Madman count must be a non-negative whole number.');
  // The reference recommends these lineups for 6–16 players. Applying the
  // nearest bracket to 4–5 and 17–24 is an unverified extrapolation.
  const wolves = playerCount <= 8 ? 1 : 2;
  const seers = playerCount <= 8 ? 0 : 1;
  if (madmanCount > seers) throw new Error(`This basic lineup supports at most ${seers} Madmen. Reduce the Madman count, or add eligible village roles manually.`);
  const counts=Object.fromEntries((Object.keys(roles) as Role[]).map(role=>[role,0])) as Record<Role,number>;
  counts.werewolf=wolves;
  counts.seer=seers;
  counts.villager=playerCount-wolves-seers;
  return counts;
}

/** Resolve wolf attack, mayor protection and templar holy water together. */
export function resolveNight(players: Player[], votes: number[], saves: number[], assembly: boolean, shots: {actor: number; target: number}[], guards: {actor: number; target: number}[] = [], bullets: {actor: number; target: number}[] = [], extra: { serials: {actor:number;target:number}[]; visitors: {actor:number;target:number}[]; shields: number[]; strong?: {actor:number;target:number}[]; lone?: {actor:number;target:number}[]; packVotes?: {actor:number;target:number}[]; enraged?: boolean; curses?: Record<number, number[]>; triggeredCurses?: number[]; thieves?: {actor:number;target:number}[]; successfulThefts?: {actor:number;target:number}[]; lovers?: Record<number,number>; madmen?: number[]; visitorDangerousRoles?: boolean; visitorAttackedTarget?: boolean; bodyguardProtectAll?: boolean; packAttackLimit?: number; randomPackTies?: boolean; ravenReflectAttackers?: boolean } = {serials:[],visitors:[],shields:[]}): Player[] {
  const killed = new Set<number>();
  const usedGuards = new Set<number>();
  const isPartner = (actor: number, target: number) => extra.lovers?.[actor] === target;
  const landedThefts: Visit[] = [];
  // A marked attacker is reflected back by the targeted Raven. Pack ballots identify the attackers.
  const reflected = (actor: number, target: number): boolean => {
    if (extra.ravenReflectAttackers !== false && players.some(p => p.alive && p.id === target && p.role === 'raven') && (extra.curses?.[target] || []).includes(actor)) {
      killed.add(actor); return true;
    }
    return false;
  };
  // Lone Wolf attacks occur before the pack's vote resolves. A wolf killed here cannot vote.
  for (const shot of extra.lone || []) {
    const target = players.find(p => p.alive && p.id === shot.target);
    if (!target || isPartner(shot.actor,shot.target) || killed.has(shot.actor) || reflected(shot.actor,shot.target) || saves.includes(target.id) || extra.shields.includes(target.id) || (assembly && teamOfPlayer(target,extra.lovers) === 'village')) continue;
    const guard = guards.find(g => g.actor !== g.target && g.target === target.id && !usedGuards.has(g.actor) && !killed.has(g.actor) && players.some(p => p.alive && p.id === g.actor) && (extra.bodyguardProtectAll === true || teamOfPlayer(target,extra.lovers) === 'village'));
    if (guard) { killed.add(guard.actor); usedGuards.add(guard.actor); } else killed.add(target.id);
  }
  const packVotes = extra.packVotes ? extra.packVotes.filter(v => !killed.has(v.actor) && !isPartner(v.actor,v.target)).map(v => v.target) : votes;
  const wolfTargets = tallyPack(packVotes, extra.enraged ? Math.max(1,Math.floor(extra.packAttackLimit ?? 2)) : 1,extra.randomPackTies === true);
  for (const id of wolfTargets) {
    const victim = players.find(p => p.alive && p.id === id);
    const voters = (extra.packVotes || []).filter(v=>v.target===id && !killed.has(v.actor) && !isPartner(v.actor,v.target));
    const effectiveVoters = voters.filter(v=>!reflected(v.actor,id));
    if (victim && (!voters.length || effectiveVoters.length > 0) && !saves.includes(victim.id) && !(assembly && teamOfPlayer(victim,extra.lovers) === 'village')) killed.add(victim.id);
  }
  for (const shot of shots) {
    const target = players.find(p => p.alive && p.id === shot.target);
    if (!target || isPartner(shot.actor,shot.target) || reflected(shot.actor,shot.target)) continue;
    killed.add(appearsWerewolf(target.role) ? target.id : shot.actor);
  }
  for (const shot of bullets) {
    if (extra.madmen?.includes(shot.target)) continue;
    if (!isPartner(shot.actor,shot.target) && players.some(p => p.alive && p.id === shot.target) && !reflected(shot.actor,shot.target)) killed.add(shot.target);
  }
  for (const shot of extra.serials) {
    if (!isPartner(shot.actor,shot.target) && players.some(p => p.alive && p.id === shot.target) && !reflected(shot.actor,shot.target)) killed.add(shot.target);
  }
  for (const shot of extra.thieves || []) {
    if (!isPartner(shot.actor,shot.target) && players.some(p => p.alive && p.id === shot.target) && !reflected(shot.actor,shot.target)) { killed.add(shot.target); landedThefts.push(shot); }
  }
  for (const shot of extra.strong || []) {
    if (killed.has(shot.actor) || isPartner(shot.actor,shot.target)) continue;
    const target = players.find(p => p.alive && p.id === shot.target);
    if (target && !reflected(shot.actor,shot.target) && !saves.includes(target.id) && !(assembly && teamOfPlayer(target,extra.lovers) === 'village')) killed.add(target.id);
  }
  // Triggered curses kill marked living players at dawn (protection precedence is provisional).
  for (const raven of extra.triggeredCurses || []) {
    for (const id of extra.curses?.[raven] || []) if (!isPartner(raven,id) && players.some(p=>p.alive && p.id===id)) killed.add(id);
  }
  const attacked = new Set<number>([
    ...wolfTargets,
    ...bullets.filter(s=>!isPartner(s.actor,s.target) && !extra.madmen?.includes(s.target)).map(s => s.target), ...extra.serials.filter(s=>!isPartner(s.actor,s.target)).map(s => s.target), ...(extra.thieves || []).filter(s=>!isPartner(s.actor,s.target)).map(s=>s.target), ...(extra.strong || []).filter(s=>!killed.has(s.actor) && !isPartner(s.actor,s.target)).map(s=>s.target), ...(extra.lone || []).filter(s=>!isPartner(s.actor,s.target)).map(s=>s.target),
    ...shots.filter(s=>!isPartner(s.actor,s.target)).map(s => s.target),
  ]);
  for (const visit of extra.visitors) {
    const target = players.find(p => p.id === visit.target && p.alive);
    if (target && ((extra.visitorDangerousRoles !== false && (appearsWerewolf(target.role) || target.role === 'serialkiller')) || (extra.visitorAttackedTarget !== false && attacked.has(target.id)))) killed.add(visit.actor);
  }
  // Shields stop the attack before a bodyguard needs to intervene.
  for (const id of extra.shields) killed.delete(id);
  // One bodyguard intercepts each attacked target; this precedence is a reconstruction.
  for (const guard of guards) {
    if (!usedGuards.has(guard.actor) && !killed.has(guard.actor) && guard.actor !== guard.target && killed.has(guard.target) && players.some(p => p.id === guard.target && (extra.bodyguardProtectAll === true || teamOfPlayer(p,extra.lovers) === 'village')) && players.some(p => p.alive && p.id === guard.actor)) {
      killed.delete(guard.target);
      killed.add(guard.actor);
    }
  }
  if (extra.successfulThefts) extra.successfulThefts.push(...landedThefts.filter(shot=>killed.has(shot.target)));
  return players.map(p => killed.has(p.id) ? {...p, alive: false} : p);
}

export type Visit = { actor: number; target: number };
/** Visitors are reported once each, even when an action targets the same player repeatedly. */
export function visitorsTo(visits: Visit[], target: number): number[] {
  return [...new Set(visits.filter(v => v.target === target).map(v => v.actor))];
}

/** Apply illness after night actions; each doctor visit extends life by two nights. */
export function applyIllness(players: Player[], doctorSaves: Record<number,number>, remaining: Record<number,number>, corrupted: number[] = [], startingNights = 3, doctorBonus = 2): {players: Player[]; remaining: Record<number,number>} {
  const next = {...remaining};
  const updated = players.map(p => {
    if (!p.alive || p.role !== 'sickman' || corrupted.includes(p.id)) return p;
    const visits = Object.values(doctorSaves).filter(target => target === p.id).length;
    next[p.id] = (next[p.id] ?? startingNights) + visits * doctorBonus - 1;
    return next[p.id] <= 0 ? {...p, alive:false} : p;
  });
  return {players: updated, remaining: next};
}

/** Convert living non-wolves targeted by a living Rabid Werewolf at the end of the night.
 * Protection and simultaneous-action precedence are reconstructed, not verified. */
export function applyInfections(players: Player[], infections: Visit[]): { players: Player[]; converted: number[] } {
  const converted = new Set<number>();
  for (const infection of infections) {
    const actor = players.find(p=>p.id===infection.actor && p.alive && p.role==='rabidwolf');
    const target = players.find(p=>p.id===infection.target && p.alive);
    if (actor && target && roles[target.role].team !== 'wolf') converted.add(target.id);
  }
  return {players:players.map(p=>converted.has(p.id) ? {...p,role:'werewolf'} : p),converted:[...converted]};
}

/** Correct predictions prepare a living Gambler to escape after surviving the next night. */
export function settleGamblerBets(players: Player[], executed: number | null, bets: Visit[], previousCorrect: Record<number,number>, lovers: Record<number,number> = {}, requiredCorrect = 2): {players: Player[]; correct: Record<number,number>; indebted: number[]; ready: number[]} {
  const correct = {...previousCorrect}, indebted: number[] = [], ready: number[] = [];
  for (const bet of bets) {
    const gambler = players.find(p=>p.id===bet.actor && p.alive && p.role==='gambler');
    if (!gambler) continue;
    if (executed !== null && bet.target === executed) {
      correct[gambler.id] = (correct[gambler.id] || 0) + 1;
      if (correct[gambler.id] >= requiredCorrect && lovers[gambler.id] === undefined) ready.push(gambler.id);
    } else indebted.push(gambler.id);
  }
  return {players,correct,indebted,ready};
}
/** Escape at dawn only if the ready Gambler survived and still belongs to their own team. */
export function resolveGamblerEscapes(players: Player[], ready: number[], lovers: Record<number,number> = {}): {players: Player[]; escaped: number[]} {
  const escaped=players.filter(p=>p.alive && p.role==='gambler' && ready.includes(p.id) && lovers[p.id]===undefined).map(p=>p.id);
  return {players:players.map(p=>escaped.includes(p.id) ? {...p,alive:false,escaped:true} : p),escaped};
}
/** Collect outstanding debt once; doctor protection stops it. */
export function collectGamblerDebts(players: Player[], indebted: number[], doctorSaves: Record<number,number>): Player[] {
  const saved = Object.values(doctorSaves);
  return players.map(p=>p.alive && p.role==='gambler' && indebted.includes(p.id) && !saved.includes(p.id) ? {...p,alive:false} : p);
}

/** Return a living Mind Flayer whose parasites cover every other living player. */
export function mindFlayerWinner(players: Player[], parasites: Record<number,number[]>, lovers: Record<number,number> = {}): number | null {
  const living=players.filter(p=>p.alive);
  return living.find(p=>p.role==='mindflayer' && lovers[p.id]===undefined && living.every(q=>q.id===p.id || (parasites[p.id] || []).includes(q.id)))?.id ?? null;
}
/** Skipping gives one parasite, with a 20% chance by default. */
export function regenerateParasite(stock: number, random = Math.random, chance = 0.2): number {
  return stock + (random() < chance ? 1 : 0);
}

/** Generate two candidates; the chance and first report timing are provisional. */
export function intelligenceReport(players: Player[], actorId: number, random = Math.random): number[] {
  const candidates = players.filter(p=>p.alive && p.id!==actorId);
  if (candidates.length <= 1) return candidates.map(p=>p.id);
  const threats = candidates.filter(p=>roles[p.role].team !== 'village');
  if (threats.length && random() < 0.5) {
    const threat = threats[Math.min(threats.length-1, Math.floor(random()*threats.length))];
    const other = shuffle(candidates.filter(p=>p.id!==threat.id),random)[0];
    return shuffle([threat.id,other.id],random);
  }
  return shuffle(candidates,random).slice(0,2).map(p=>p.id);
}

/** Surviving Thieves take the original role of their dead target after resolution. */
export function applyThefts(before: Player[], after: Player[], thefts: Visit[]): {players: Player[]; stolen: Record<number,Role>} {
  const stolen: Record<number,Role> = {};
  for (const theft of thefts) {
    const actor = after.find(p=>p.id===theft.actor && p.alive && p.role==='thief');
    const original = before.find(p=>p.id===theft.target && p.alive);
    const target = after.find(p=>p.id===theft.target);
    if (actor && original && target && !target.alive && !target.escaped) stolen[actor.id] = original.role;
  }
  return {players:after.map(p=>stolen[p.id] ? {...p,role:stolen[p.id]} : p),stolen};
}

/** A Police player may not detain themselves, dead players, or last night's target. */
export function canDetain(players: Player[], actor: number, target: number, last: Record<number,number>): boolean {
  return actor !== target && last[actor] !== target && players.some(p=>p.id===actor && p.alive && p.role==='police') && players.some(p=>p.id===target && p.alive);
}
/** Hypnosis takes effect at night end and only affects living village roles. */
export function applyHypnosis(players: Player[], attempts: Visit[], already: number[]): number[] {
  // Hypnosis is a village-role effect; conversion to another team clears it.
  const result = new Set(already.filter(id=>players.some(p=>p.id===id && roles[p.role].team==='village')));
  for (const {target} of attempts) {
    const player=players.find(p=>p.id===target && p.alive);
    if (player && roles[player.role].team === 'village') result.add(target);
  }
  return [...result];
}

/** A Chef needs two other living players to invite. */
export function canChefAct(players: Player[], chefId: number): boolean {
  return players.filter(p=>p.alive && p.id!==chefId).length >= 2;
}
/** Privately assign each unblocked Celebrity to one other living player. */
export function celebrityReveals(players: Player[], blocked: number[] = [], corrupted: number[] = [], random = Math.random, audience = 1): Record<number,string[]> {
  const living=players.filter(p=>p.alive);
  const result:Record<number,string[]>={};
  for (const star of living.filter(p=>p.role==='celebrity' && !blocked.includes(p.id) && !corrupted.includes(p.id))) {
    const candidates=living.filter(p=>p.id!==star.id);
    const count=Math.max(0,Math.min(candidates.length,Math.floor(audience)));
    for (let i=0;i<count;i++) {
      const index=Math.min(candidates.length-1,Math.floor(random()*candidates.length));
      const [recipient]=candidates.splice(index,1);
      (result[recipient.id] ||= []).push(star.name);
    }
  }
  return result;
}

/** Madmen use an eligible village role as a disguise; the role itself remains visible. */
export function isEligibleMadmanRole(role: Role): boolean {
  return roles[role].team === 'village' && role !== 'villager' && role !== 'muted';
}
export function selectMadmen(players: Player[], count: number, random = Math.random): number[] {
  if (!Number.isInteger(count) || count < 0) throw new Error('Madman count must be a non-negative whole number.');
  const eligible=players.filter(p=>isEligibleMadmanRole(p.role));
  if (count > eligible.length) throw new Error(`Choose at most ${eligible.length} Madmen: only eligible village roles can be disguised.`);
  return shuffle(eligible,random).slice(0,count).map(p=>p.id);
}

/** Resolve simultaneous detentions. An already-detained Police player cannot detain anyone.
 * Mutual cycles cancel their actions while detaining the officers in the cycle. */
export function resolveDetentions(attempts: Visit[]): { blocked: number[]; effective: Visit[] } {
  const remaining = new Map(attempts.map(a=>[a.actor,a]));
  const blocked = new Set<number>();
  const effective: Visit[] = [];
  while (remaining.size) {
    const incoming = new Set([...remaining.values()].map(a=>a.target));
    const roots = [...remaining.keys()].filter(id=>!incoming.has(id));
    if (!roots.length) {
      // With at most one target per officer, the remaining nodes form cycles.
      for (const id of remaining.keys()) blocked.add(id);
      break;
    }
    for (const id of roots) {
      const action=remaining.get(id)!;
      remaining.delete(id);
      if (!blocked.has(id)) { effective.push(action); blocked.add(action.target); }
    }
    for (const id of blocked) remaining.delete(id);
  }
  return {blocked:[...blocked],effective};
}
