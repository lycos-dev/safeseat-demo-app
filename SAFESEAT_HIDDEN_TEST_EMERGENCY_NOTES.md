# SafeSeat Hidden Test Emergency

- Removed the visible Settings > Test Emergency SMS developer control.
- Added **Trigger Test Emergency** to the existing hidden Researcher Control opened by long-pressing the hardware-linked monitored seat.
- Test Emergency is local-only (`simulationState = emergency`) and persists until the researcher long-presses the same seat and selects **Stop Test Emergency**.
- Researcher Warning behavior remains 10s / 30s / 60s delay then persistent until stopped.
- Local Warning/Emergency simulations never become a real SMS event because SMS eligibility is based on the raw Main Hub emergency state.
- A genuine raw Main Hub Emergency remains SMS-eligible even if a local researcher simulation was active.
- The Emergency modal shows **TEST MODE** during researcher simulation, hides the SMS countdown, and explicitly states that no automated SMS will be sent.
