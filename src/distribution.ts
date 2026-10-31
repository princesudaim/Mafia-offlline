import { isEligibleMadmanRole, roles, type Role } from './werewolf-engine.ts';
import { ROLE_POWER } from './role-power.ts';

export type DistributionMode = 'easy' | 'balanced' | 'hard';
type Team = 'village' | 'wolf' | 'neutral';
type Candidate = { role: Role; score: number; weight: number; eligible: boolean };
const targets: Record<DistributionMode,{village:number;wolf:number}> = {easy:{village:8.5,wolf:7}, balanced:{village:5,wolf:8}, hard:{village:2.5,wolf:9}};
const randomUnit = (random:()=>number) => Math.max(0,Math.min(0.999999999999,random()));

/** Counts keep the reference's 1 wolf at 4–8 and 2 at 9–16; larger games extrapolate. */
export function distributionWolfCount(players:number): number {
  return players<=8 ? 1 : players<=16 ? 2 : players<=20 ? 3 : 4;
}

/** Keep small games simple and add independent roles as the group grows. */
export function distributionNeutralCount(players:number):number {
  return players===4 ? 0 : players<=11 ? 1 : players<=19 ? 2 : 3;
}

/** Weights count all ordered lineups that can achieve a score and enough Madman-eligible roles. */
function table(candidates:Candidate[], size:number) {
  const memo=new Map<string,number>();
  function ways(count:number, score:number, needed:number):number {
    if (score<0 || needed>count) return 0;
    if (count===0) return score===0 && needed===0 ? 1 : 0;
    const key=`${count},${score},${needed}`;
    const existing=memo.get(key);if(existing!==undefined)return existing;
    let total=0;
    for(const c of candidates) total+=c.weight*ways(count-1,score-c.score,Math.max(0,needed-(c.eligible?1:0)));
    memo.set(key,total);return total;
  }
  function sample(score:number,needed:number,random:()=>number):Role[] {
    const result:Role[]=[];
    for(let left=size;left>0;left--) {
      const choices=candidates.map(c=>({c, weight:c.weight*ways(left-1,score-c.score,Math.max(0,needed-(c.eligible?1:0)))})).filter(x=>x.weight>0);
      let draw=randomUnit(random)*choices.reduce((sum,x)=>sum+x.weight,0);
      let selected=choices[choices.length-1].c;
      for(const choice of choices){if(draw<choice.weight){selected=choice.c;break;}draw-=choice.weight;}
      result.push(selected.role);score-=selected.score;needed=Math.max(0,needed-(selected.eligible?1:0));
    }
    return result;
  }
  return {ways,sample};
}

/** Point targets are approximate and cannot guarantee winning odds or account for all role interactions. */
export function balancedDistribution(playerCount:number,mode:DistributionMode,madmanCount=0,followChances=false,chances:Partial<Record<Role,number>>={},random:()=>number=Math.random):Record<Role,number> {
  if(!Number.isInteger(playerCount)||playerCount<4||playerCount>24) throw new Error('Automatic distribution needs 4–24 players.');
  if(!Number.isInteger(madmanCount)||madmanCount<0) throw new Error('Madman count must be a non-negative whole number.');
  const wolfCount=distributionWolfCount(playerCount),neutralCount=distributionNeutralCount(playerCount),villageCount=playerCount-wolfCount-neutralCount;
  if(madmanCount>villageCount) throw new Error('Not enough village roles for the requested Madmen.');
  const candidates=(team:Team):Candidate[] => (Object.keys(roles) as Role[]).filter(role=>roles[role].team===team).map(role=>{
    const raw=chances?.[role];
    const weight=followChances && typeof raw==='number' && Number.isFinite(raw) ? Math.max(0,Math.min(100,raw))/100 : 1;
    return {role,score:ROLE_POWER[role],weight,eligible:isEligibleMadmanRole(role)};
  }).filter(candidate=>candidate.weight>0);
  const villagers=candidates('village'),wolves=candidates('wolf'),neutrals=candidates('neutral');
  if(!villagers.length || !wolves.length) throw new Error('Distribution needs at least one eligible Villager role and one eligible Werewolf role. Adjust role chances or turn off “Distribution follows role chances”.');
  if(neutralCount>0 && !neutrals.length) throw new Error('Distribution needs an eligible Neutral role for this player count. Adjust role chances or turn off “Distribution follows role chances”.');
  if(madmanCount>0 && !villagers.some(c=>c.eligible)) throw new Error('No eligible village roles for Madmen. Adjust role chances or turn off “Distribution follows role chances”.');
  function chooseTeam(pool:Candidate[], count:number, desiredAverage:number, needed:number):Role[] {
    if(count===0)return [];
    const t=table(pool,count);let best=Infinity;let scores:number[]=[];
    for(let score=1;score<=9*count;score++) {
      if(t.ways(count,score,needed)<=0)continue;
      const distance=Math.abs(score/count-desiredAverage);
      if(distance<best-1e-10){best=distance;scores=[score];}
      else if(Math.abs(distance-best)<1e-10)scores.push(score);
    }
    if(!scores.length)throw new Error('Cannot make a lineup with these chances and Madmen. Adjust the settings and try again.');
    return t.sample(scores[Math.floor(randomUnit(random)*scores.length)],needed,random);
  }
  const chosen=[...chooseTeam(wolves,wolfCount,targets[mode].wolf,0),...chooseTeam(villagers,villageCount,targets[mode].village,madmanCount),...chooseTeam(neutrals,neutralCount,5,0)];
  const result=Object.fromEntries((Object.keys(roles) as Role[]).map(role=>[role,0])) as Record<Role,number>;
  for(const role of chosen)result[role]++;
  return result;
}
