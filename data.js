/* ==========================================================================
   GYM TRACKER — default program + exercise alternatives database
   ========================================================================== */

// Cheerful pastel palette — each day gets its own color-blocked identity.
const PLATE_COLORS = {
  upper1: "butter",
  lower1: "lavender",
  upper2: "sage",
  lower2: "coral",
  core:   "peach"
};

function uid(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

// The default program, seeded from the user's split.
function defaultProgram() {
  return [
    {
      id: "upper1", name: "Upper 1", plate: "butter",
      exercises: [
        { id: uid("ex"), name: "Bench Press",     sets: 4, reps: "6-8",   timed: false },
        { id: uid("ex"), name: "Lat Pulldown",     sets: 3, reps: "10-12",timed: false },
        { id: uid("ex"), name: "Barbell Row",      sets: 3, reps: "8-10", timed: false },
        { id: uid("ex"), name: "Shoulder Press",   sets: 3, reps: "8-10", timed: false },
        { id: uid("ex"), name: "Rear Delt Fly",    sets: 3, reps: "12-15",timed: false }
      ]
    },
    {
      id: "lower1", name: "Lower 1", plate: "lavender",
      exercises: [
        { id: uid("ex"), name: "Back Squat",           sets: 4, reps: "6-8",  timed: false },
        { id: uid("ex"), name: "Hamstring Curl",        sets: 3, reps: "10-12",timed: false },
        { id: uid("ex"), name: "Hip Abduction (in)",    sets: 3, reps: "15",  timed: false },
        { id: uid("ex"), name: "Calf Raise",            sets: 3, reps: "12-15",timed: false },
        { id: uid("ex"), name: "Tibialis / Shin Raise", sets: 2, reps: "15",  timed: false }
      ]
    },
    {
      id: "upper2", name: "Upper 2", plate: "sage",
      exercises: [
        { id: uid("ex"), name: "Face Pull",        sets: 3, reps: "15",   timed: false },
        { id: uid("ex"), name: "Lat Pullover",     sets: 3, reps: "10-12",timed: false },
        { id: uid("ex"), name: "Tricep Pushdown",  sets: 3, reps: "10-12",timed: false },
        { id: uid("ex"), name: "Bicep Curl",       sets: 3, reps: "10-12",timed: false },
        { id: uid("ex"), name: "Lateral Raise",    sets: 3, reps: "12-15",timed: false }
      ]
    },
    {
      id: "lower2", name: "Lower 2", plate: "coral",
      exercises: [
        { id: uid("ex"), name: "Hip Thrust",             sets: 4, reps: "8-10", timed: false },
        { id: uid("ex"), name: "Bulgarian Split Squat",  sets: 3, reps: "10/leg",timed: false },
        { id: uid("ex"), name: "Leg Extension",          sets: 3, reps: "12-15",timed: false },
        { id: uid("ex"), name: "Hip Adduction (out)",    sets: 3, reps: "15",  timed: false },
        { id: uid("ex"), name: "RDL",                    sets: 3, reps: "8-10",timed: false }
      ]
    },
    {
      id: "core", name: "Core", plate: "peach",
      exercises: [
        { id: uid("ex"), name: "Plank",             sets: 3, reps: "45s", timed: true },
        { id: uid("ex"), name: "Cable Crunch",      sets: 3, reps: "12-15", timed: false },
        { id: uid("ex"), name: "Hanging Leg Raise", sets: 3, reps: "12",  timed: false },
        { id: uid("ex"), name: "Russian Twist",     sets: 3, reps: "20",  timed: false }
      ]
    }
  ];
}

// Curated swap options, grouped by the default slot name they belong to.
// Each entry also appears as a candidate for any exercise sharing its group.
const SWAP_GROUPS = {
  "Bench Press":            ["Bench Press","Incline DB Press","Machine Chest Press","Push Ups","Weighted Dips"],
  "Lat Pulldown":           ["Lat Pulldown","Pull Ups","Assisted Pull Up","Straight Arm Pulldown"],
  "Barbell Row":            ["Barbell Row","Seated Cable Row","T-Bar Row","Chest Supported Row","Single Arm DB Row"],
  "Shoulder Press":         ["Shoulder Press","Barbell OHP","Arnold Press","Machine Shoulder Press"],
  "Rear Delt Fly":          ["Rear Delt Fly","Reverse Pec Deck","Face Pull","Band Pull Apart"],
  "Back Squat":             ["Back Squat","Front Squat","Hack Squat","Leg Press","Goblet Squat"],
  "Hamstring Curl":         ["Hamstring Curl","Lying Leg Curl","Nordic Curl","Stability Ball Curl"],
  "Hip Abduction (in)":     ["Hip Abduction (in)","Cable Hip Abduction","Band Abduction"],
  "Calf Raise":             ["Calf Raise","Seated Calf Raise","Calf Press"],
  "Tibialis / Shin Raise":  ["Tibialis / Shin Raise","Tibialis Raise Machine","Band Dorsiflexion"],
  "Face Pull":              ["Face Pull","Band Face Pull","Rope Face Pull"],
  "Lat Pullover":           ["Lat Pullover","Straight Arm Pullover","Cable Pullover"],
  "Tricep Pushdown":        ["Tricep Pushdown","Overhead Tricep Extension","Skull Crushers","Weighted Dips"],
  "Bicep Curl":             ["Bicep Curl","Hammer Curl","Cable Curl","Preacher Curl"],
  "Lateral Raise":          ["Lateral Raise","Cable Lateral Raise","Machine Lateral Raise"],
  "Hip Thrust":             ["Hip Thrust","Glute Bridge","Machine Hip Thrust"],
  "Bulgarian Split Squat":  ["Bulgarian Split Squat","Walking Lunge","Reverse Lunge","Hyperextension","Step Up"],
  "Leg Extension":          ["Leg Extension","Sissy Squat","Single Leg Extension"],
  "Hip Adduction (out)":    ["Hip Adduction (out)","Cable Hip Adduction","Band Adduction"],
  "RDL":                    ["RDL","Stiff Leg Deadlift","Single Leg RDL","Good Morning"],
  "Plank":                  ["Plank","Side Plank","Dead Bug","Ab Wheel"],
  "Cable Crunch":           ["Cable Crunch","Bicycle Crunch","Weighted Sit Up"],
  "Hanging Leg Raise":      ["Hanging Leg Raise","Lying Leg Raise","Toes to Bar"],
  "Russian Twist":          ["Russian Twist","Cable Woodchop","Landmine Twist"]
};

function getSwapOptions(exerciseName) {
  return SWAP_GROUPS[exerciseName] || [exerciseName];
}
