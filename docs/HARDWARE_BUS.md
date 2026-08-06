# Hardware Bus

The bus exposes normalized device state while keeping hardware-specific code behind adapters.

- **Top Monitor:** local dashboard display target; currently represented as online
- **Stream Deck:** static operator-mode mapping is planned; no plugin exists
- **Thermalright LCD:** future read-only mirror scene
- **Govee RGB:** future state-driven ambient scene adapter
- **iPad Console:** future local-network remote interface requiring authentication and threat modeling

`hardwareControlEnabled` remains `false`. The current hardware service rejects action requests and does not enumerate, connect to, or control devices.
