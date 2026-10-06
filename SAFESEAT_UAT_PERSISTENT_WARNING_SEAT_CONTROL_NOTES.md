# SafeSeat UAT persistent Warning / seat control

- Researcher Control moved from long-pressing **SAFESEAT ACTIVE** to long-pressing the **hardware-linked seat row** on Home while monitoring is active.
- Normal seat tap behavior remains unchanged.
- 10s / 30s / 60s are trigger delays only. Once triggered, simulated Warning persists until the researcher long-presses the same linked seat and taps **Stop Warning**.
- An armed-but-not-yet-triggered warning can still be cancelled from the same hidden control.
- Simulated Warning alert audio/haptics continue while the simulation is active. Real sensor-driven Warning retains its existing 10-second feedback cap.
- A real Main Hub Emergency continues to override the simulated Warning.
- Ending monitoring cancels the simulation and alert feedback as before.
