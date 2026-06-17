// Labels for the on-device RAW produce classifier (assets/produce.tflite).
//
// IMPORTANT: this list must match your model's output classes AND their order
// exactly. The default below is the widely-used 36-class "Fruits and Vegetables
// Image Recognition" set (Kaggle: Kritik Seth) — alphabetical, which is how
// Keras/TF Model Maker exports class indices by default. If you train/export a
// different model, replace this array (and the count) to match.
//
// These names are looked up in the offline nutrition table (fuzzy, so plurals
// like "grapes" resolve to "grape"); unmatched ones still show name+confidence
// and offer a USDA text search via the confirm step.
export const PRODUCE_LABELS = [
  'apple', 'banana', 'beetroot', 'bell pepper', 'cabbage', 'capsicum',
  'carrot', 'cauliflower', 'chilli pepper', 'corn', 'cucumber', 'eggplant',
  'garlic', 'ginger', 'grapes', 'jalepeno', 'kiwi', 'lemon', 'lettuce',
  'mango', 'onion', 'orange', 'paprika', 'pear', 'peas', 'pineapple',
  'pomegranate', 'potato', 'raddish', 'soy beans', 'spinach', 'sweetcorn',
  'sweetpotato', 'tomato', 'turnip', 'watermelon',
];
