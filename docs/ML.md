# Completion-time experiment

The optional regression is deliberately small: predict hours of care from the selected service’s standard duration, the garment count and the outlet’s active workload. It uses full-batch gradient descent and L2 regularisation on three scaled features plus an intercept. This is ordinary supervised linear regression implemented in JavaScript, not deep learning or an external AI API.

```sh
npm run model:evaluate
```

`demoHistory()` creates 240 reproducible **synthetic** labelled rows using a fixed random seed. The first 192 train the model; the final 48 form a chronological holdout. Evaluation reports mean absolute error in hours and a service-duration baseline. With the checked-in deterministic data, the observed MAE was about **1.86h**, versus **7.57h** for that baseline. These numbers describe the synthetic experiment only, not a real laundry business.

Demo mode shows “Demo regression” and the synthetic-data limitation directly beside the estimate. Normal mode uses the catalog’s service duration, with no claim of a trained production model. Both estimates describe duration **from outlet intake**, not a live arrival time or a delivery promise.

A real extension would collect intake/completion timestamps, preserve workload as it existed at prediction time, remove cancellation/invalid records, split by time, compare against a median/service baseline, inspect errors per service and retrain only after adequate representative history. Current workloads must not be reconstructed using future outcomes. The pilot does not silently train on seed data and label it real.
