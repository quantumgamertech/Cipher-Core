# AIDA64 Bridge Discovery

- **Date:** 2026-07-05
- **Status:** Discovery complete; prototype blocked
- **Target:** AIDA64 Extreme 8.30.8300
- **Environment:** Asset-only lab
- **Production status:** Untouched

## Objective

Determine whether Theme Center can apply ROG AIO LCD themes through a clean AIDA64 Bridge:

```text
Theme Center
    ↓
\\.\pipe\CipherCore.AIDA64.v1
    ↓
AIDA64 lab controller
    ↓
Native AIDA64 layout activation
```

## Inventory

- Install path: `C:\Program Files\FinalWire\AIDA64 Extreme`
- Executable: `aida64.exe`
- Version: `8.30.8300`
- Executable SHA-256: `C80E3E2FCA84FCB64216A8942D54AD5316B9B174C1AB6597C7E48F38177CEA6F`
- Active configuration: `C:\Program Files\FinalWire\AIDA64 Extreme\aida64.ini`
- Active configuration SHA-256: `7571A7106E6DF6E0B1B01035546078BD5B4AF44B363739ABFD7732BE58002F79`
- ROG LCD enabled: `HWMonEnableRALCD=1`
- Active Page A item count: 16
- Active Page B/C item count: 0
- Theme assets: five matching `.ralcd` and PNG pairs in `C:\Cipher Core\QGT_Themes`

No `.ralcd` file association or per-user default application was registered.

## Interfaces found

### LCD editor and import

AIDA64 supports LCD layout editing and import through:

`File → Preferences → Hardware Monitoring → LCD → LCD Items`

This is an interactive UI path. No documented live import command was found.

Reference: [FinalWire external display support](https://www.aida64.com/products/features/external-display-support)

### Alternate INI

FinalWire documents `/INIFILE` as a startup option for AIDA64 Business, Engineer, and Network Audit. It is not documented as available for AIDA64 Extreme, and it does not provide a live layout reload command.

Reference: [FinalWire miscellaneous command-line options](https://www.aida64.com/user-manual/command-line-options/miscellaneous)

### External applications

AIDA64 exposes sensor readings through:

- shared memory;
- Registry;
- WMI;
- RivaTuner shared memory.

These are outbound sensor-data interfaces. The documented shared-memory mapping is read-only to consumers and provides no layout-control command.

Reference: [FinalWire external applications](https://www.aida64.com/user-manual/hardware-monitoring/external-applications)

### Remote features

AIDA64 remote control is documented for AIDA64 Business and exposes remote administration rather than an LCD layout API. No relevant listener was active in the installed Extreme runtime.

Reference: [FinalWire remote features](https://www.aida64.com/user-manual/remote-features)

## Interfaces not found

- No AIDA64 or FinalWire named pipe
- No active AIDA64 TCP listener
- No `.ralcd` shell association
- No command-line `.ralcd` import or activation switch
- No live configuration reload command
- No documented LCD-control shared-memory structure
- No documented localhost/web layout-control API
- No public AIDA64 LCD plugin SDK in the installation
- No safe Windows message contract for layout activation

## Safe tests performed

Read-only commands and inspections:

- Process inventory through CIM
- Executable version and SHA-256
- Production INI SHA-256 before and after discovery
- Installation and ROG LCD asset inventory
- TCP listener inventory for the running AIDA64 PID
- Named-pipe enumeration
- FinalWire registry key-name inventory with sensitive values excluded
- `.ralcd` association and UserChoice lookup
- `assoc .ralcd`
- Relevant INI key inspection
- `.ralcd` encoding, page, image-item, embedded-data, and filename validation
- Official FinalWire command-line and interface documentation review

No AIDA64 command was executed.

## Methods eliminated

### Direct `.ralcd` launch

Blocked: no shell association or command handler exists.

### `/INIFILE` lab instance

Blocked:

- unsupported for the installed Extreme edition according to the applicable-product documentation;
- startup-only rather than live reload;
- production AIDA64 was already running;
- FinalWire documents one-instance constraints;
- a second instance cannot be proven isolated from the kernel driver or ROG LCD device.

### INI rewrite and restart

Rejected: mutates application-owned configuration, requires process control, and violates the approved one-clean-path architecture.

### UI automation or Windows messages

Rejected: no stable documented contract; behavior would be fragile and potentially target the production process.

### Shared memory, Registry, WMI, remote control

Rejected for activation: available surfaces publish telemetry or provide unrelated administration. They do not load LCD layouts.

## Risk assessment

Launching a copied AIDA64 executable on the same Windows host while production is running could:

- activate the existing single instance;
- compete for the kernel driver;
- compete for the ROG AIO LCD device;
- read or write an unexpected configuration;
- disturb the live LCD output.

That experiment does not meet the Cipher Core lab-isolation standard.

## Decision

Do not implement `\\.\pipe\CipherCore.AIDA64.v1` yet.

A named pipe alone would only wrap an unsafe or unsupported downstream action. A Bridge is valid only when it terminates in a stable native interface.

## Recommended next step

Ask FinalWire for one of the following supported capabilities:

1. a live `.ralcd` import/load API;
2. a documented command-line switch for LCD layout activation in AIDA64 Extreme;
3. a plugin or IPC callback that reloads Page A on the application UI thread;
4. confirmation of an isolated, supported `/INIFILE` workflow for AIDA64 Extreme.

Until such an interface exists:

- keep `ENABLE_AIDA64_THEME_ACTIONS=false`;
- keep Theme Center RGB bridge-only;
- import `.ralcd` layouts manually in AIDA64;
- do not add an AIDA64 Bridge facade that mutates INI files or automates the UI.

## Lab artifacts

`C:\Cipher Core\AIDA64_Bridge_Discovery_Lab\20260705-005023`
