# Five-minute demonstration

Run `npm ci` and `npm run demo`. All sample records are synthetic. Demo accounts share a password; never use them for real customers.

1. **Customer:** choose Customer, book two Wash & fold pieces, enter a fictional address and pickup slot. The receipt shows ₹70. Keep the private return code on the customer screen.
2. **Outlet team:** sign out and choose Outlet team. Open that order in the workspace. Count the two physical pieces and confirm collection. A mismatch is blocked. For this pilot, cancel and rebook an uncollected order if the agreed item count is wrong.
3. **Intake:** register a blue shirt and black trousers, noting any existing damage. Print their QR labels from the web manifest. Processing is blocked until both are registered.
4. **Processing:** advance through At the outlet, Being cleaned, Quality check and Packing.
5. **Reconciliation:** try marking ready before scanning — blocked. Scan one garment twice — the second scan is blocked. A garment from another order is also rejected. On web, “Manual scan code” exposes the full QR payload for a hardware-free demo; the app uses the camera or manual entry.
6. **Offline demonstration:** open the native staff scanner while online so the manifest is cached. Disconnect the API/network, scan a known garment and observe “saved on this phone”. Reconnect, sync, and verify the new event. A conflicting server change leaves the action pending for review. Unit tests also exercise interrupted/conflicting queue replay.
7. **Handoff:** verify both pieces, mark ready, then on the way. Obtain the customer’s return code at handoff. Return one piece and observe that the other remains open. Return the last piece to complete the order.
8. **Support:** customer raises an issue; outlet adds a resolution. Show the event history and receipt.
9. **Owner:** inspect workload and export orders as CSV. Explain that booked value is not payments received.
10. **ML:** run `npm run model:evaluate`. Discuss the chronological split, baseline and synthetic-data limitation.

Do not present a phone-sized browser view as a tested native camera or physical laundry-label pilot. The test record in VALIDATION.md lists what was actually checked.
