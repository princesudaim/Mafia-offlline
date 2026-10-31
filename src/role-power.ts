import type { Role } from './werewolf-engine';

/** Subjective 1–10 estimates for the implemented roles under default settings.
 * Automatic distribution uses these estimates; the points do not change gameplay.
 * See ROLE_POWER.md for the reasoning and limitations behind each rating.
 */
export const ROLE_POWER: Record<Role, number> = {
  villager: 1, muted: 1, celebrity: 3, sickman: 2, journalist: 3,
  mayor: 7, doctor: 8, seer: 9, chef: 7, templar: 6,
  necromancer: 8, bodyguard: 6, sheriff: 6, visitor: 2, psychic: 8,
  detective: 6, instigator: 6, intelligence: 5, police: 8,
  werewolf: 7, wolfpup: 8, strongwolf: 9, lonewolf: 8, rabidwolf: 9, hypnowolf: 8,
  jester: 4, serialkiller: 8, survivor: 5, raven: 8, whitewolf: 7,
  gambler: 5, mindflayer: 7, thief: 8, charmer: 8,
};
