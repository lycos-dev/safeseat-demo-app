# SafeSeat App UAT UX R14 — Secret Warning Control

## Researcher trigger
While monitoring is active on Home, long-press the **SAFESEAT ACTIVE** brand text for about 2 seconds.

A hidden researcher control opens with:
- Warning in 10 seconds
- Warning in 30 seconds
- Warning in 60 seconds
- Cancel Armed Warning

Choosing a delay closes the panel. The linked monitored seat shows a local-only WARNING after the selected delay, holds for 10 seconds, then returns to the real latched Fusion state.

## Safety / behavior
- No request is sent to the Main Hub.
- The timer lives in the global SafeSeat provider, so switching tabs does not cancel or restart it.
- If SafeSeat is offline when the countdown ends, the warning waits until telemetry is ready again.
- A real Main Hub EMERGENCY overrides the synthetic Warning.
- Starting or ending a monitoring session cancels any previously armed Warning.
- No UAT simulation control is visible in Settings or normal navigation.
