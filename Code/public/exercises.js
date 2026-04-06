// Exercise library: coaching cues + animation key for each gym lift.
// Animation keys map to CSS classes in style.css (.anim-<key>).

window.EXERCISES = {
  'Back Squat': {
    cues: [
      'Brust hoch, Blick neutral nach vorn',
      'Knie tracken über die Zehenspitzen',
      'Volle Tiefe (Hüfte unter Knie)',
      'Bar fest, Lats angespannt',
    ],
    anim: 'squat',
  },
  'Front Squat': {
    cues: [
      'Ellenbogen hoch, Bar liegt auf Schultern',
      'Aufrechter Oberkörper, kein Vorbeugen',
      'Volle Tiefe',
      'Core fest gespannt',
    ],
    anim: 'squat',
  },
  'Conventional Deadlift': {
    cues: [
      'Bar über Mittelfuß',
      'Hüfte hoch, Brust hoch, Lats engaged',
      'Boden wegschieben, nicht ziehen',
      'Lockout: Hüfte vor, Glutes anspannen',
    ],
    anim: 'deadlift',
  },
  'Romanian Deadlift': {
    cues: [
      'Hüft-Hinge, Knie nur leicht beugen',
      'Bar entlang der Beine führen',
      'Spannung in den Hamstrings spüren',
      'Hüfte explosiv nach vorn am Top',
    ],
    anim: 'deadlift',
  },
  'Barbell Row': {
    cues: [
      'Hüft-Hinge, Rücken neutral parallel',
      'Bar zum unteren Rippenbogen ziehen',
      'Schulterblätter zusammen am Top',
      'Kein Schwung aus den Knien',
    ],
    anim: 'row',
  },
  'Chin-Up': {
    cues: [
      'Voller Hang am Start',
      'Schulterblätter aktiv runter',
      'Brust zur Stange',
      'Kontrolliert ablassen, kein Schwung',
    ],
    anim: 'pullup',
  },
  'DB Incline Press': {
    cues: [
      'Schulterblätter retracted auf Bank',
      'Hanteln über Brust starten',
      'Volle Range bis Schulterhöhe',
      'Handgelenke gerade',
    ],
    anim: 'press',
  },
  'Dips': {
    cues: [
      'Voller Hang am Start',
      'Leichte Vorlage für Brustfokus',
      'Tief runter (Schulter unter Ellenbogen)',
      'Voller Lockout am Top',
    ],
    anim: 'dip',
  },
  'Ab Wheel Rollout': {
    cues: [
      'Knie auf Polster, Core fest',
      'Langsam nach vorne rollen',
      'Hüfte nicht durchhängen lassen',
      'Mit Lats zurückziehen',
    ],
    anim: 'rollout',
  },
  'Hanging Leg Raise': {
    cues: [
      'Voller Hang, Schultern aktiv',
      'Beine kontrolliert hoch (90° oder mehr)',
      'Kein Schwung',
      'Langsam ablassen',
    ],
    anim: 'legraise',
  },
  'Copenhagen Plank': {
    cues: [
      'Side Plank, oberes Bein auf Bank',
      'Hüfte hoch halten',
      'Body line gerade',
      '20s pro Seite',
    ],
    anim: 'plank',
  },
  'Suitcase Deadlift': {
    cues: [
      'Hantel/KB einarmig am Boden',
      'Aufrechter Stand, kein Lehnen',
      'Core kämpft gegen Lateralflexion',
      '6 Reps pro Seite',
    ],
    anim: 'deadlift',
  },
};

// Workout structure for the Gym module
window.GYM_WORKOUTS = {
  A: {
    name: 'Squat Focus',
    main: [
      { exercise: 'Back Squat',   sets: 3, reps: '6' },
      { exercise: 'Barbell Row',  sets: 3, reps: '6' },
      { exercise: 'Chin-Up',      sets: 3, reps: '6' },
    ],
    accessory: [
      { exercise: 'Romanian Deadlift', sets: 3, reps: '8-10' },
      { exercise: 'DB Incline Press',  sets: 3, reps: '8-10' },
    ],
    core: [
      { exercise: 'Ab Wheel Rollout', sets: 3, reps: '8' },
      { exercise: 'Copenhagen Plank', sets: 3, reps: '20s/side' },
    ],
  },
  B: {
    name: 'Deadlift Focus',
    main: [
      { exercise: 'Conventional Deadlift', sets: 3, reps: '6' },
      { exercise: 'Barbell Row',           sets: 3, reps: '6' },
      { exercise: 'Chin-Up',               sets: 3, reps: '6' },
    ],
    accessory: [
      { exercise: 'Front Squat', sets: 3, reps: '8' },
      { exercise: 'Dips',        sets: 3, reps: '8' },
    ],
    core: [
      { exercise: 'Hanging Leg Raise', sets: 3, reps: '10' },
      { exercise: 'Suitcase Deadlift', sets: 3, reps: '6/side' },
    ],
  },
};

// Kettlebell HIIT workouts (variant A: EMOM, variant B: interval circuit)
window.KB_WORKOUTS = {
  A: {
    name: 'Power & Push (EMOM)',
    description: 'EMOM x20 - Every Minute On the Minute. 4 exercises rotating, 20 minutes total.',
    warmup: [
      { name: 'Halo',        duration: 30, reps: '10/side', rest: 15 },
      { name: 'Halo',        duration: 30, reps: '10/side', rest: 15 },
      { name: 'Goblet Squat', duration: 30, reps: '10',     rest: 15 },
      { name: 'Goblet Squat', duration: 30, reps: '10',     rest: 15 },
    ],
    main: [
      { name: 'KB Swing',          duration: 60, reps: '15',     rest: 0, isEmom: true },
      { name: 'KB Clean & Press',  duration: 60, reps: '6/side', rest: 0, isEmom: true },
      { name: 'Goblet Squat',      duration: 60, reps: '10',     rest: 0, isEmom: true },
      { name: 'Renegade Row',      duration: 60, reps: '6/side', rest: 0, isEmom: true },
    ],
    mainRounds: 5,
    finisher: [
      { name: 'KB Windmill',       duration: 45, reps: '5/side', rest: 20 },
      { name: 'KB Windmill',       duration: 45, reps: '5/side', rest: 20 },
      { name: 'KB Windmill',       duration: 45, reps: '5/side', rest: 20 },
      { name: 'KB Suitcase Carry', duration: 60, reps: '20m',    rest: 30 },
      { name: 'KB Suitcase Carry', duration: 60, reps: '20m',    rest: 30 },
      { name: 'KB Suitcase Carry', duration: 60, reps: '20m',    rest: 30 },
    ],
  },
  B: {
    name: 'Grind & Carry',
    description: '5 rounds, 40s work / 20s rest. 4 exercises per round.',
    warmup: [
      { name: 'Arm Bar',     duration: 30, reps: '/side', rest: 15 },
      { name: 'Arm Bar',     duration: 30, reps: '/side', rest: 15 },
      { name: 'KB Deadlift', duration: 30, reps: '10',    rest: 15 },
      { name: 'KB Deadlift', duration: 30, reps: '10',    rest: 15 },
    ],
    main: [
      { name: 'KB Deadlift',           duration: 40, reps: 'AMRAP', rest: 20 },
      { name: 'One-Arm Row',           duration: 40, reps: 'AMRAP', rest: 20 },
      { name: 'Goblet Reverse Lunge',  duration: 40, reps: 'AMRAP', rest: 20 },
      { name: 'Push Press',            duration: 40, reps: 'AMRAP', rest: 20 },
    ],
    mainRounds: 5,
    finisher: [
      { name: 'Dead Bug',     duration: 40, reps: '8/side', rest: 20 },
      { name: 'Dead Bug',     duration: 40, reps: '8/side', rest: 20 },
      { name: 'Dead Bug',     duration: 40, reps: '8/side', rest: 20 },
      { name: 'Pallof Press', duration: 40, reps: '10/side', rest: 20 },
      { name: 'Pallof Press', duration: 40, reps: '10/side', rest: 20 },
      { name: 'Pallof Press', duration: 40, reps: '10/side', rest: 20 },
    ],
  },
};

// Yoga inspiration sequence
window.YOGA_POSES = [
  { name: 'Cat-Cow',                 hint: 'Wake up the spine, 8-10 reps' },
  { name: 'Downward Dog → Cobra',    hint: 'Flow, 5 rounds' },
  { name: 'Warrior I & II',          hint: '5 breaths each side' },
  { name: 'Pigeon Pose',             hint: '8-10 breaths each side' },
  { name: 'Seated Forward Fold',     hint: 'Hold 1-2 minutes' },
  { name: 'Savasana',                hint: 'Rest 3-5 minutes' },
];
