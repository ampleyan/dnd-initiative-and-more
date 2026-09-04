import { Combatant, Condition, MonsterTemplate } from './types';

export const CONDITIONS: Condition[] = [
  { id: 'blinded', name: 'Blinded', icon: 'EyeOff', color: 'bg-slate-500',
    description: "Can't see; automatically fails any ability check requiring sight. Attack rolls against it have advantage; its attack rolls have disadvantage." },
  { id: 'charmed', name: 'Charmed', icon: 'Heart', color: 'bg-pink-500',
    description: "Can't attack the charmer or target them with harmful abilities. The charmer has advantage on social ability checks against it." },
  { id: 'deafened', name: 'Deafened', icon: 'VolumeX', color: 'bg-yellow-600',
    description: "Can't hear; automatically fails any ability check that requires hearing." },
  { id: 'exhaustion', name: 'Exhaustion', icon: 'Battery', color: 'bg-orange-600',
    description: "Level 1: Disadv. on checks. Level 2: Speed halved. Level 3: Disadv. on attacks & saves. Level 4: HP max halved. Level 5: Speed 0. Level 6: Death." },
  { id: 'frightened', name: 'Frightened', icon: 'AlertTriangle', color: 'bg-yellow-500',
    description: "Disadv. on ability checks and attack rolls while the source of fear is in line of sight. Can't willingly move closer to the source." },
  { id: 'grappled', name: 'Grappled', icon: 'Lock', color: 'bg-orange-500',
    description: "Speed becomes 0. Ends if grappler is incapacitated or the creature is removed from the grappler's reach." },
  { id: 'incapacitated', name: 'Incapacitated', icon: 'XCircle', color: 'bg-red-500',
    description: "Can't take actions or reactions." },
  { id: 'invisible', name: 'Invisible', icon: 'Eye', color: 'bg-cyan-400',
    description: "Impossible to see without special sense. Attack rolls against it have disadvantage; its attack rolls have advantage. Not considered hidden." },
  { id: 'paralyzed', name: 'Paralyzed', icon: 'Square', color: 'bg-red-700',
    description: "Incapacitated; can't move or speak. Automatically fails STR and DEX saves. Attacks against it have advantage; hits within 5 ft are critical hits." },
  { id: 'petrified', name: 'Petrified', icon: 'Mountain', color: 'bg-stone-400',
    description: "Transformed into solid inanimate stone. Incapacitated, weight increases x10. Resistance to all damage; immune to poison and disease." },
  { id: 'poisoned', name: 'Poisoned', icon: 'Droplet', color: 'bg-green-500',
    description: "Disadvantage on attack rolls and ability checks." },
  { id: 'prone', name: 'Prone', icon: 'ArrowDown', color: 'bg-primary',
    description: "Can only crawl until it spends half speed to stand. Disadv. on attacks. Attacks against it have advantage within 5 ft; disadvantage beyond." },
  { id: 'restrained', name: 'Restrained', icon: 'Anchor', color: 'bg-amber-700',
    description: "Speed becomes 0. Attack rolls against it have advantage; its attack rolls have disadvantage. Disadvantage on DEX saving throws." },
  { id: 'stunned', name: 'Stunned', icon: 'Zap', color: 'bg-amber-500',
    description: "Incapacitated; can't move and can speak only falteringly. Automatically fails STR and DEX saves. Attacks against it have advantage." },
  { id: 'unconscious', name: 'Unconscious', icon: 'Moon', color: 'bg-indigo-700',
    description: "Incapacitated; can't move, speak, or be aware of surroundings. Falls prone. Automatically fails STR and DEX saves. Hits within 5 ft are critical." },
  { id: 'blessed', name: 'Blessed', icon: 'Sparkles', color: 'bg-secondary',
    description: 'Add a 1d4 bonus to attack rolls and saving throws for the duration.' },
  { id: 'hasted', name: 'Hasted', icon: 'Wind', color: 'bg-primary',
    description: 'Speed doubled, +2 AC, advantage on DEX saves, and one additional action per turn (Attack, Dash, Disengage, Hide, or Use an Object). Lethargy follows.' },
  { id: 'concentrating', name: 'Concentrating', icon: 'Target', color: 'bg-violet-500',
    description: 'Sustaining a concentration spell. Must make a CON save (DC 10 or half damage taken) when taking damage. Broken by incapacitation or another concentration spell.' },
  { id: 'raging', name: 'Raging', icon: 'Flame', color: 'bg-red-400',
    description: 'Advantage on STR checks and saves; bonus melee damage; resistance to bludgeoning, piercing, and slashing damage. Ends if not attacking or no damage taken last turn.' },
  { id: 'inspired', name: 'Inspired', icon: 'Music', color: 'bg-teal-400',
    description: 'Can add one Bardic Inspiration die to an ability check, attack roll, or saving throw before the DM declares success or failure.' },
  { id: 'disadvantaged', name: 'Disadvantage', icon: 'TrendingDown', color: 'bg-rose-700',
    description: 'Disadvantage on attack rolls (next attack or until end of next turn).' },
  { id: 'reaction-spent', name: 'Reaction Spent', icon: 'RotateCcw', color: 'bg-zinc-500',
    description: 'Reaction has been used and is unavailable until the start of next turn.' },
  { id: 'speed-zero', name: 'Speed 0', icon: 'Minus', color: 'bg-slate-600',
    description: 'Movement speed is 0 until the end of next turn.' },
  { id: 'hunters-mark', name: "Hunter's Mark", icon: 'Target', color: 'bg-amber-700',
    description: "Marked by Hunter's Mark. The hunter deals an extra 1d6 Force damage to this target on each hit. The hunter has Advantage on Wisdom (Perception or Survival) checks to find it. If the target drops to 0 HP, the hunter can move the mark to a new creature as a Bonus Action." },
];

export const INITIATIVE_COLORS = [
  '#C9ECD8', '#A8D884', '#D2EAB8', '#4FA76D', '#2F6F5B',
  '#C7F13A', '#F2D83A', '#E4C12F', '#D1A631', '#C9972C',
  '#A07A4E', '#D68553', '#E97C2B', '#F18B30', '#C45039',
  '#D7A9D6', '#E6598D', '#C43A49', '#D21B1F', '#8D2C24'
];

export const INITIAL_COMBATANTS: Combatant[] = [
  {
    id: '1',
    name: 'Valerius Moonblade',
    type: 'player',
    initiative: 22,
    hp: { current: 42, max: 58 },
    ac: 20,
    speed: '30ft',
    subtitle: 'Elf Paladin • Level 12',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCVgKb28GiyAN5A0cChpbsQ7W8PWGnS3xolHGpplMQwObWRIuZaA5zEPtw_79hyaqbNKVSgjA57Pww7l4gDUgIHz33kdTh16cZMqZXRGIhrLpj3lQSR550rmnzKZNpqIch8AGFtFW2WdUDuQur7X6w6tUak52OSYmjONGzV2F1RPNpOKN4QLONIW5tY4E_geYwn0al9VzpvEIipIwvEGGl1kijXT2xkGOUVZYH2K7cRajCXHBxYvmnFPDaRG_pfS4eoi5ZzpWd4EZgy',
    conditions: ['blessed'],
    tags: ['Leader', 'Healer'],
    stats: { str: 18, dex: 10, con: 16, int: 10, wis: 12, cha: 16 },
    isCurrentTurn: true,
  },
  {
    id: '2',
    name: 'Gorthak the Vile',
    type: 'monster',
    initiative: 18,
    hp: { current: 88, max: 88 },
    ac: 17,
    speed: '30ft',
    subtitle: 'Legendary Monster',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCyL7Yo_tjYyQ2oXTmjzk5qCGa5zs4O1GQKuPqf-Pnnv6aS6ilOx1IZLn3e5pecy1RaDmdfey2nY33fQC0F6gE86qWxddkSSN0ApibUYVBbNSlzTjSPT9OuGjuLeOghPmXBPdGcIDW0O-0qv1IwOHX_tUgniXLBWPGLecaTWCpBGY_tQ77wnXvklRCEJT3DMQzYtuU-vaByrGnd5P6JKIxGVRqdWYGskl0lK4d0EzK2GQcpgQlv7cSu4bw-1QAcKvZ2IK_2vkvUoxrb',
    conditions: [],
    tags: ['Boss', 'Elite'],
    stats: { str: 20, dex: 12, con: 18, int: 8, wis: 10, cha: 12 },
    abilities: [
      { name: 'Stench', description: 'Any creature that starts its turn within 5 feet of Gorthak must succeed on a DC 14 Constitution saving throw or be poisoned until the start of its next turn.' }
    ],
    actions: [
      { name: 'Greataxe', description: 'Melee Weapon Attack: +9 to hit, reach 5 ft., one target. Hit: 14 (2d8 + 5) slashing damage.' }
    ]
  },
  {
    id: '3',
    name: 'Lyra Whisperfoot',
    type: 'player',
    initiative: 15,
    hp: { current: 45, max: 45 },
    ac: 17,
    speed: '35ft',
    subtitle: 'Wood Elf Ranger • Level 12',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBFCnhSwW4_c_otcPqKmljfte7gzUKuEczK6aHGCJGANnog03jwn3tyOqTqYHcfhuX4MGg8-NbO51aP6ts54FApk0dKRErZTepp3mFuZ6R6sqgKnv4TyBlHOIHABH7DC425IkieNTq-axdc7OT65QLhkAvXBzPlu5bNIbB_lUW77UIVeqC9qtl_XS5bFUPkkXo55D5RkYpnWzaFWRt_vcLQxIzBGo5bDJQSsZZFwKlA8TJYZclnr92GCvejSdrMfZeQsSHaCLWHdLCf',
    conditions: [],
    tags: ['Scout'],
    stats: { str: 10, dex: 20, con: 14, int: 12, wis: 16, cha: 10 },
  },
];

export const MONSTER_LIBRARY: MonsterTemplate[] = [
  {
    id: 'm1',
    name: 'Void Ancient',
    cr: '23',
    type: 'Dragon',
    description: 'A creature of the deep cosmos, its breath can unmake matter itself.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCbHH2KjK6S7tFahbSIkeoi3mZ-gSGwp8tGM8BDFn2jliLcNyIj4OmjI0wi-7rZuIGu070r23dcmbVNahFMp3IgtyYC9uvW_w6LsobdhUOsGcq6_l8m8VIui-Heyo5CV_mF88AN8lDJG-Mh6xNI2-kzxRULFFQdgz3HqyYOe3hHVWh56sZb6TbOLzbqJa_IPnqYP9oAV9mO2A2LLH51CqXUP6qe8o6n1wZWTbzUiwBeGObvNOcZlp9ZQXjbAk-lZ-ea1YYU87OeofgD',
    rarity: 'Legendary',
    hp: 546,
    ac: 22,
    speed: '40ft, fly 80ft',
    stats: { str: 30, dex: 10, con: 29, int: 18, wis: 15, cha: 23 },
    skills: 'Perception +15, Stealth +7',
    abilities: [
      { name: 'Legendary Resistance (3/Day)', description: 'If the dragon fails a saving throw, it can choose to succeed instead.' },
      { name: 'Void Aura', description: 'Any creature that starts its turn within 10 feet of the dragon takes 10 (3d6) necrotic damage.' }
    ],
    actions: [
      { name: 'Void Breath', description: 'Exhales a blast of nothingness in a 90-foot cone.' },
      { name: 'Multiattack', description: 'The dragon makes three attacks: one with its bite and two with its claws.' }
    ]
  },
  {
    id: 'm2',
    name: 'Moss Sentinel',
    cr: '8',
    type: 'Fey',
    description: 'Ancient guardians of the Silken Grove, they move silently through the bark.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBC5xQvp--v0_MQJGAkayLaXemswL1IBl-UW0Kj5xB9USKjrGrmEYUC3xmTjTVSTb7yiwEUbTd-51o-43OWa7t6DVmRQNl-r3PLWTmh5ZlSf3DORsXYjnNFNwyH1-Pa0RGlOIFr4zXJrCpWeoy1AMtOPVr55zv0vqako9jD-NTd2xhs-tjmK9IdeLEiuGujIgvdL8-kWrxV5iJ-HKifFJ6aWqRCj7Eqjp6NP7NpUSzGat2Ul8n2rAGudWTrIuSDRTzVQLukxus05i-K',
    rarity: 'Fey',
    hp: 136,
    ac: 16,
    speed: '30ft, climb 30ft',
    stats: { str: 18, dex: 14, con: 18, int: 10, wis: 14, cha: 11 },
    skills: 'Stealth +8, Nature +6',
    actions: [
      { name: 'Vine Lash', description: 'Melee Weapon Attack: +7 to hit, reach 15 ft., one target.' }
    ]
  },
  {
    id: 'm3',
    name: 'Frost Reaver',
    cr: '12',
    type: 'Undead',
    description: 'An eternal soldier bound to the northern wastes by a curse of ice.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDgT8XBKYmcjUZ3ktrpaDeQUb8waEai2G6W6GOTNXGNVfTrKZeWOKf2ZkEkN1n8soii_l0mfTMjcvoZ5_l3pGEEhZMcZca9PWsas2yRtII31xiNVyMrfKdWTdfjbnSsr8_x3fRGt-JopZJI-M2Py4qGBoNcpK6Z5WT9ZZW2o8e2kVqqGoJo8hIiqTWBAz2lKOSXZXvSGbLZYZP_9XAPzQowu4GVH_LTQKFEJ7MYmFss69AJnuM5ULKJiE3wTcWRDe-IaRSLxPYSya3N',
    rarity: 'Undead',
    hp: 180,
    ac: 18,
    speed: '30ft',
    stats: { str: 20, dex: 10, con: 20, int: 6, wis: 10, cha: 5 },
    skills: 'Athletics +9',
    actions: [
      { name: 'Frost Axe', description: 'Melee Weapon Attack: +9 to hit, reach 5 ft., one target. Hit: 18 (2d12 + 5) slashing damage plus 7 (2d6) cold damage.' }
    ]
  },
  {
    id: 'm4',
    name: 'Bronze Juggernaut',
    cr: '18',
    type: 'Construct',
    description: 'A relic of the First Dynasty, this titanic construct is powered by a beating heart of pure elemental fire.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCd9HM1Rs71LUzCXw35_zxGkVx1c893YT6dVubDO3aw2OFbg-Zs-dW5tcfeyjibFCUOY600hf3nrG2NpqNZMALBkJUrbm3KnLpHWzg2t4gYHYvE0HaadWosNSF6MsF4bIfRGu5Ma2nmIgmEf_OdaVRWceLkMweuCJ0C132BGBrfSbGYXD-9q6gsMZkzQCLfb4PZTj_EKFtFm4X5Y94yB6nwmOeno8ulzb1IjC7OuLJxyweYqYKTD2Ld1vqpFYa25efwU1X7X3j_Fk9r',
    rarity: 'Construct',
    hp: 290,
    ac: 20,
    speed: '40ft',
    stats: { str: 26, dex: 8, con: 22, int: 3, wis: 11, cha: 1 },
    skills: 'Athletics +14',
    actions: [
      { name: 'Slam', description: 'Melee Weapon Attack: +14 to hit, reach 10 ft., one target. Hit: 26 (4d8 + 8) bludgeoning damage.' }
    ]
  },
];
