export const CARDS = [
  {
    tex: 'tarot_01_lantern_walk', num: 'I', title: 'The Lantern Walk', time: '9:00 PM',
    text: 'A procession by lantern-light through the Whispering Wood. Stay on the path, count the lights ahead of you, and don\'t answer if a voice you know calls your name from the trees.',
  },
  {
    tex: 'tarot_02_seance', num: 'II', title: 'The Séance', time: '9:45 PM',
    text: 'Twelve seats round the velvet table and one empty chair. Madame Vey will open the circle at the stroke of ten. Keep your hands on the table until the candles go out on their own.',
  },
  {
    tex: 'tarot_03_masquerade', num: 'III', title: 'The Masquerade', time: '10:30 PM',
    text: 'The grand ballroom reopens for one night only. Wear your mask, and don\'t count the dancers. There are always a few more than there were invitations.',
  },
  {
    tex: 'tarot_04_witch_kitchen', num: 'IV', title: 'The Witch\'s Kitchen', time: 'All night',
    text: 'A six-course feast from the cauldron: pumpkin, smoke, dark wine and cursed cocktails that change colour as you drink them. The black cat decides who gets dessert.',
  },
  {
    tex: 'tarot_05_crypt', num: 'V', title: 'The Crypt', time: '11:15 PM',
    text: 'Two hundred metres of catacomb maze beneath the manor. There are three ways out, and one way further down. Bring a friend you trust, or at least one who runs slower than you.',
  },
  {
    tex: 'tarot_06_pyre', num: 'VI', title: 'The Midnight Pyre', time: '12:00 AM',
    text: 'At the final stroke of midnight the Hollow King burns. Fireworks, drums, and a thousand lanterns released into the night to guide the wandering dead back home.',
  },
];

export const TIERS = {
  mortal: {
    name: 'Mortal', price: '$66', color: '#7dff9a', liquid: [0.49, 1.0, 0.6],
    perks: ['Entry through the iron gates', 'The Lantern Walk & the Midnight Pyre', 'One cursed cocktail', 'A lantern of your own to keep'],
  },
  phantom: {
    name: 'Phantom', price: '$131', color: '#9fe8ff', liquid: [0.62, 0.91, 1.0],
    perks: ['Everything a Mortal receives', 'A seat at the Séance', 'Masquerade ballroom access', 'Feast in the Witch\'s Kitchen'],
  },
  undying: {
    name: 'Undying', price: '$313', color: '#ff4d5a', liquid: [0.95, 0.12, 0.18],
    perks: ['Every rite, every door, all night', 'The Crypt\'s third way down', 'Private tarot reading at midnight', 'Your name carved on a Hollowmere stone'],
  },
};

export const FORTUNES = [
  'Someone you love is thinking of you. Someone you buried is too.',
  'Before the year is out, a door you closed will open by itself.',
  'Your lucky number is thirteen. It was always going to be thirteen.',
  'Trust the crow on your left. Never the one on your right.',
  'You will dance with a stranger at midnight. Don\'t ask for their name.',
  'A great fortune awaits. It\'s in the crypt. Bring a shovel.',
  'The thing under your bed has grown fond of you. Be kind to it.',
  'You will find what you lost, and wish you hadn\'t.',
  'Beware the pumpkin that smiles back.',
  'Your reflection will blink first tonight. Let it.',
  'The spirits approve of your shoes. Wear them on the thirty-first.',
  'A candle will go out when you enter a room. This is a compliment.',
  'Three knocks means welcome. Four knocks means run.',
  'You have an old soul. The previous owner wants it back.',
  'Soon you will hear music with no source. Hum along; it helps.',
];

// Chapters: [start, end] of scroll progress, label, and the focus point used for navigation.
export const CHAPTERS = [
  { id: 'hero', label: 'The Gates', range: [0.0, 0.045], focus: 0.0 },
  { id: 'gates', label: 'The Threshold', range: [0.07, 0.2], focus: 0.13 },
  { id: 'veil', label: 'The Veil', range: [0.215, 0.275], focus: 0.24 },
  { id: 'deck', label: 'Deck of Fates', range: [0.33, 0.475], focus: 0.345 },
  { id: 'oracle', label: 'The Oracle', range: [0.51, 0.585], focus: 0.545 },
  { id: 'clock', label: 'Witching Hour', range: [0.615, 0.705], focus: 0.64 },
  { id: 'apothecary', label: 'Apothecary', range: [0.735, 0.82], focus: 0.77 },
  { id: 'invitation', label: 'Invitation', range: [0.85, 0.905], focus: 0.875 },
  { id: 'graveyard', label: 'Graveyard', range: [0.955, 1.01], focus: 1.0 },
];
