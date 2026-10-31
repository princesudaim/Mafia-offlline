import { roles, type Role, type Settings } from './werewolf-engine';

export default function ChanceSlider({role,settings,onSetting}:{role:Role;settings:Settings;onSetting:<K extends keyof Settings>(key:K,value:Settings[K])=>void}) {
  const stored=settings.roleChances?.[role];
  const value=typeof stored==='number' && Number.isFinite(stored) ? Math.max(0,Math.min(100,Math.round(stored))) : 100;
  return <div className="chance-control">
    <div className="chance-heading"><label htmlFor={`chance-${role}`}>Random role chance</label><output htmlFor={`chance-${role}`}>{value}%</output></div>
    <input id={`chance-${role}`} aria-label={`${roles[role].name} random role chance`} type="range" min="0" max="100" step="1" value={value} style={{background:`linear-gradient(to right, var(--detail-color) ${value}%, #29384a ${value}%)`}} onChange={event=>onSetting('roleChances',{...settings.roleChances,[role]:Number(event.target.value)})}/>
    <div className="chance-scale" aria-hidden="true"><span>0%</span><span>50%</span><span>100%</span></div>
    <p>Relative chance for Random cards in this team. 0% excludes this role; 50% is half as likely as 100%. Manually added roles are unaffected. Distribution follows these chances only when its setting is on.</p>
  </div>;
}
