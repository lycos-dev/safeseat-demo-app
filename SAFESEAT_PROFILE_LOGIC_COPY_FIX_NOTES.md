# SafeSeat Profile Logic & Copy Fix

- Add Person now requires only **Name**.
- Birthday, height, weight, blood type, allergies, and profile photo are optional.
- Optional fields are validated only when entered.
- Removed the 18+ restriction from saved profiles; SafeSeat can now store passengers of any age.
- Blank optional values save as null/empty values instead of fake zeroes.
- Editing a profile can now clear optional health values correctly.
- Removed the unrelated Sun Sign field from the profile screen.
- Profile copy clearly marks required vs optional information.
- Replaced user-facing “prototype” terminology with “SafeSeat Sensor”, “Sensor seat”, and “Sensor setup card”.
- Internal `prototypeIndicator` preference key remains unchanged for backward compatibility.
