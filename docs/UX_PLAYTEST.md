# Local gameplay usability pass

Evaluated the existing café using [Nielsen's usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) and [Laws of UX](https://lawsofux.com/). These are design checks, not a claim of universal usability or a replacement for human playtesting.

## Reproduced problems and corrections

| Observed problem | Consequence | Correction | Heuristic |
| --- | --- | --- | --- |
| Failed room creation still entered property selection with an undefined room | Player could continue into a broken session | Validate the response before navigating, preserve the name and offer retry with a visible error; bound the request to 12 seconds | Error recovery, system status |
| Tab from management buttons triggered build mode | Ordinary keyboard navigation changed game mode | Retain normal Tab navigation in controls; focus the drawer close button on entry and return to Menu on exit | Consistency, user control |
| Escape in the manager text field did not close the drawer | The expected exit stopped working while typing | Handle drawer dismissal before excluding text-entry shortcuts | User control |
| Invite panel stayed open after Escape or outside click | The disclosure obscured play without a familiar dismissal | Escape closes it and returns focus; outside pointer dismisses it | Jakob's Law, user control |
| Management tabs measured 33.375px high on a phone viewport | Small adjacent targets increased selection difficulty | Minimum 44px height | Fitts's Law |
| A completed held drink still said “To make” in the order rail | The UI contradicted the actual order stage | Show Brewing and Ready to serve from the assigned player's actual held state | System status, recognition |
| Coffee remained at a fixed point beside the player | Carrying was visually disconnected from walking and turning | Attach it to the animated hand and apply a carrying arm pose; show paper before brewing completes | Match to the real world |

The closed drawer already had `inert` and `aria-hidden`; it was not a confirmed hidden-focus leak. Added CSS visibility to keep it out of rendered visibility queries as well.

## Evidence and limits

Local Chromium tested actual buttons and keyboard input. The host check deliberately returned HTTP 503, confirmed that the landing form and entered name remained, then removed the fault and successfully created a room and entered the game. Mobile form input is 16px to avoid focus zoom on iOS. See [host recovery assertions](screenshots/ux-host-verification.json) and [phone-sized recovery screenshot](screenshots/ux-host-recovery.png).

The actual take-order → brew → carry while moving/turning → serve flow passed with one $10 mocha sale and the correct inventory change. Hand attachment and removal were inspected without mutating game state. See [hand assertions](screenshots/held-cup-attachment.json) and [carrying screenshot](screenshots/held-cup-moving.png).

Phone checks use browser emulation, not a physical handset. No claim of physical touch latency, iOS installation, screen-reader acceptance, or near-exact original property interior. Sponsor/private geometry screenshots remain outside the repository.

Menu evidence: [keyboard/focus assertions](screenshots/ux-menu-verification.json), [actual ready-to-serve and sale assertions](screenshots/ux-order-verification.json). Modern Web Guidance `forms` informed visible error feedback, preserved inputs, explicit labels and 16px input text; `accessibility` informed focus management, ordinary native keyboard behavior and larger touch targets. Local screenshot review also caught a clipped final navigation tab; flexible content-sized tabs now fit the phone width without horizontal overflow.
