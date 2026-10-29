import { enabledCommands, type CommandSpec } from "./vocabulary";

export function suggestCommands(query: string): CommandSpec[] {
  const commands = enabledCommands();
  const needle = query.trim().toLowerCase();
  if (!needle) return commands;
  return commands.filter((command) => {
    if (command.label.startsWith(needle) || command.insert.startsWith(needle)) return true;
    return command.keywords.some((keyword) => keyword.startsWith(needle) || needle.startsWith(keyword));
  });
}
