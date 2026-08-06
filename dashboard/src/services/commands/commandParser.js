const HELP = 'Commands: status · open work mode · open gaming mode · run diagnostics · show projects · clear · help';

const handlers = {
  status: () => ({ output: 'Core online. Telemetry: mock. Connections: disabled. Hardware control: disabled.' }),
  'open work mode': () => ({ output: 'Work Mode loaded in simulation.', effect: { type: 'SET_OPERATOR_MODE', value: 'work' } }),
  'open gaming mode': () => ({ output: 'Gaming Mode loaded in simulation.', effect: { type: 'SET_OPERATOR_MODE', value: 'gaming' } }),
  'run diagnostics': () => ({ output: 'SIMULATED DIAGNOSTICS: UI nominal · mock provider nominal · safety locks engaged.' }),
  'show projects': () => ({ output: 'Projects: Shear Kutz · Quantum Gamer Tech · Legacy Bot · Wisetouch Interiors.' }),
  clear: () => ({ output: '', effect: { type: 'CLEAR_CONSOLE' } }),
  help: () => ({ output: HELP }),
};

export const allowedCommands = Object.freeze(Object.keys(handlers));

export function parseCommand(rawCommand) {
  const command = rawCommand.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!command) return { command, output: 'Enter a command or type “help”.' };
  const handler = handlers[command];
  if (!handler) {
    return {
      command,
      output: `Unknown command: ${command}. Type “help” for the safe command list.`,
    };
  }
  return { command, ...handler() };
}
