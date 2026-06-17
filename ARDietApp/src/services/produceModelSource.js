// ---------------------------------------------------------------------------
// Produce model wiring switch.
//
// The raw fruit/vegetable TFLite model is NOT committed (you supply it). Until
// you drop the file in, this exports `null` so the app still bundles and runs —
// the produce classifier simply stays disabled and SCAN behaves as before.
//
// TO ACTIVATE (one line):
//   1. Put your model at  ARDietApp/assets/produce.tflite
//   2. Make sure src/data/ProduceLabels.js matches that model's classes/order
//   3. Replace the line below with:
//        export default require('../../assets/produce.tflite');
//
// Why a shim instead of a plain require()? Metro resolves require() paths at
// BUNDLE time and fails the whole build if the .tflite is missing — a try/catch
// can't rescue that. Isolating the require here means activating the model is a
// one-line edit and never breaks the build before the file exists.
// ---------------------------------------------------------------------------

export default null;
