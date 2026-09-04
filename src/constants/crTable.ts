export interface CRStats {
  profBonus: number;
  acSuggested: number;
  hpMin: number;
  hpMax: number;
  attackBonus: number;
  saveDC: number;
  xp: number;
}

// HP ranges are based on typical actual 5e monster HP at each CR, not the DMG's
// theoretical defensive ceiling. Mid-points closely match real Monster Manual entries.
export const CR_TABLE: Record<string, CRStats> = {
  '0':   { profBonus: 2, acSuggested: 10, hpMin: 1,   hpMax: 6,   attackBonus: 3, saveDC: 13, xp: 10 },
  '1/8': { profBonus: 2, acSuggested: 12, hpMin: 5,   hpMax: 20,  attackBonus: 3, saveDC: 13, xp: 25 },
  '1/4': { profBonus: 2, acSuggested: 13, hpMin: 10,  hpMax: 30,  attackBonus: 3, saveDC: 13, xp: 50 },
  '1/2': { profBonus: 2, acSuggested: 13, hpMin: 15,  hpMax: 45,  attackBonus: 3, saveDC: 13, xp: 100 },
  '1':   { profBonus: 2, acSuggested: 13, hpMin: 22,  hpMax: 65,  attackBonus: 5, saveDC: 13, xp: 200 },
  '2':   { profBonus: 2, acSuggested: 13, hpMin: 35,  hpMax: 90,  attackBonus: 5, saveDC: 13, xp: 450 },
  '3':   { profBonus: 2, acSuggested: 13, hpMin: 50,  hpMax: 115, attackBonus: 6, saveDC: 13, xp: 700 },
  '4':   { profBonus: 2, acSuggested: 14, hpMin: 60,  hpMax: 125, attackBonus: 6, saveDC: 14, xp: 1100 },
  '5':   { profBonus: 3, acSuggested: 15, hpMin: 80,  hpMax: 145, attackBonus: 8, saveDC: 15, xp: 1800 },
  '6':   { profBonus: 3, acSuggested: 15, hpMin: 85,  hpMax: 155, attackBonus: 8, saveDC: 15, xp: 2300 },
  '7':   { profBonus: 3, acSuggested: 15, hpMin: 95,  hpMax: 170, attackBonus: 8, saveDC: 15, xp: 2900 },
  '8':   { profBonus: 3, acSuggested: 16, hpMin: 110, hpMax: 195, attackBonus: 8, saveDC: 16, xp: 3900 },
  '9':   { profBonus: 4, acSuggested: 16, hpMin: 125, hpMax: 225, attackBonus: 9, saveDC: 16, xp: 5000 },
  '10':  { profBonus: 4, acSuggested: 17, hpMin: 140, hpMax: 255, attackBonus: 9, saveDC: 17, xp: 5900 },
  '11':  { profBonus: 4, acSuggested: 17, hpMin: 158, hpMax: 285, attackBonus: 9, saveDC: 17, xp: 7200 },
  '12':  { profBonus: 4, acSuggested: 17, hpMin: 178, hpMax: 310, attackBonus: 9, saveDC: 17, xp: 8400 },
  '13':  { profBonus: 5, acSuggested: 18, hpMin: 195, hpMax: 335, attackBonus: 10, saveDC: 18, xp: 10000 },
  '14':  { profBonus: 5, acSuggested: 18, hpMin: 215, hpMax: 360, attackBonus: 10, saveDC: 18, xp: 11500 },
  '15':  { profBonus: 5, acSuggested: 18, hpMin: 235, hpMax: 390, attackBonus: 10, saveDC: 18, xp: 13000 },
  '16':  { profBonus: 5, acSuggested: 18, hpMin: 255, hpMax: 420, attackBonus: 10, saveDC: 18, xp: 15000 },
  '17':  { profBonus: 6, acSuggested: 19, hpMin: 280, hpMax: 455, attackBonus: 11, saveDC: 19, xp: 18000 },
  '18':  { profBonus: 6, acSuggested: 19, hpMin: 305, hpMax: 490, attackBonus: 11, saveDC: 19, xp: 20000 },
  '19':  { profBonus: 6, acSuggested: 19, hpMin: 330, hpMax: 525, attackBonus: 11, saveDC: 19, xp: 22000 },
  '20':  { profBonus: 6, acSuggested: 19, hpMin: 360, hpMax: 565, attackBonus: 11, saveDC: 19, xp: 25000 },
  '21':  { profBonus: 7, acSuggested: 19, hpMin: 395, hpMax: 615, attackBonus: 12, saveDC: 20, xp: 33000 },
  '22':  { profBonus: 7, acSuggested: 19, hpMin: 435, hpMax: 665, attackBonus: 12, saveDC: 20, xp: 41000 },
  '23':  { profBonus: 7, acSuggested: 19, hpMin: 475, hpMax: 715, attackBonus: 12, saveDC: 20, xp: 50000 },
  '24':  { profBonus: 7, acSuggested: 19, hpMin: 515, hpMax: 770, attackBonus: 12, saveDC: 21, xp: 62000 },
  '25':  { profBonus: 8, acSuggested: 19, hpMin: 560, hpMax: 830, attackBonus: 13, saveDC: 21, xp: 75000 },
  '26':  { profBonus: 8, acSuggested: 19, hpMin: 605, hpMax: 890, attackBonus: 13, saveDC: 21, xp: 90000 },
  '27':  { profBonus: 8, acSuggested: 19, hpMin: 655, hpMax: 955, attackBonus: 13, saveDC: 22, xp: 105000 },
  '28':  { profBonus: 8, acSuggested: 19, hpMin: 705, hpMax: 1020, attackBonus: 13, saveDC: 22, xp: 120000 },
  '29':  { profBonus: 9, acSuggested: 19, hpMin: 760, hpMax: 1090, attackBonus: 14, saveDC: 22, xp: 135000 },
  '30':  { profBonus: 9, acSuggested: 19, hpMin: 815, hpMax: 1165, attackBonus: 14, saveDC: 23, xp: 155000 },
};
