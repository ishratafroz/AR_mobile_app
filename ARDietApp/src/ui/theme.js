// Shared visual theme for the modern food-tracker UI.
export const C = {
  bg:        '#0E1116',
  surface:   '#171B22',
  surface2:  '#1F252E',
  line:      '#2A313C',
  text:      '#FFFFFF',
  textDim:   '#9AA4B2',
  textFaint: '#6B7480',

  blue:   '#2E7BFF',
  teal:   '#15C5B6',
  green:  '#36D399',
  amber:  '#FBBD23',
  red:    '#F8617A',
  purple: '#A78BFA',

  // macro colors
  cal:     '#2E7BFF',
  protein: '#36D399',
  carbs:   '#FBBD23',
  fat:     '#F8617A',
};

export const RISK = {
  safe:    { color: '#36D399', label: 'SAFE' },
  caution: { color: '#FBBD23', label: 'CAUTION' },
  danger:  { color: '#F8617A', label: 'DANGER' },
  unknown: { color: '#8A93A6', label: 'UNKNOWN' }, // recognized, but no nutrition data yet
};

// Personalized good/risky verdict (recommendation engine).
export const VERDICT = {
  good:     { color: '#36D399', label: 'GOOD FOR YOU' },
  moderate: { color: '#FBBD23', label: 'OK IN MODERATION' },
  risky:    { color: '#F8617A', label: 'RISKY FOR YOU' },
  avoid:    { color: '#E11D48', label: 'AVOID' },
};

// Health-intake option lists.
export const SEX_OPTIONS = ['male', 'female', 'other'];

export const CONDITIONS = [
  { key: 'diabetes',     label: 'Diabetes',            icon: '🩸' },
  { key: 'hypertension', label: 'High blood pressure', icon: '🫀' },
  { key: 'heart',        label: 'Heart disease',       icon: '❤️' },
  { key: 'cholesterol',  label: 'High cholesterol',    icon: '🧈' },
];

export const ALLERGENS = [
  { key: 'nuts',      label: 'Nuts',      icon: '🥜' },
  { key: 'dairy',     label: 'Dairy',     icon: '🥛' },
  { key: 'gluten',    label: 'Gluten',    icon: '🌾' },
  { key: 'shellfish', label: 'Shellfish', icon: '🦐' },
  { key: 'egg',       label: 'Egg',       icon: '🥚' },
  { key: 'soy',       label: 'Soy',       icon: '🫘' },
];

// Use-case profiles (Goal 3). Each retunes the daily goal + what the UI emphasizes.
export const PROFILES = {
  general:  { key: 'general',  label: 'General',       icon: '🍎', goal: 2000, accent: '#2E7BFF', tagline: 'Balanced tracking' },
  diabetic: { key: 'diabetic', label: 'Diabetic',      icon: '🩸', goal: 1800, accent: '#A78BFA', tagline: 'Watches sugar & glycemic index' },
  cardiac:  { key: 'cardiac',  label: 'Cardiac-risk',  icon: '❤️', goal: 2000, accent: '#F8617A', tagline: 'Watches saturated fat & sodium' },
  fitness:  { key: 'fitness',  label: 'Fitness',       icon: '💪', goal: 2400, accent: '#15C5B6', tagline: 'Optimizes protein & macros' },
};
