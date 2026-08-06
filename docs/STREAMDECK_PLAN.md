# Stream Deck Plan

## v0.4 mapping concept

| Key | Short press | Long press | Current behavior |
|---|---|---|---|
| 1 | Work Mode | Open work board | Mock only |
| 2 | Gaming Mode | Performance view | Mock only |
| 3 | Client Mode | Client selector | Mock only |
| 4 | Stream Mode | Stream checklist | Mock only |
| 5 | Maintenance Mode | Diagnostics | Mock only |
| 6 | Night Mode | Dim scene | Mock only |

A future adapter should emit internal action IDs rather than shell commands. Cipher's permission gate must validate every action, and destructive actions must require an explicit confirmation surface.

No Stream Deck plugin, driver, or device communication is included.
