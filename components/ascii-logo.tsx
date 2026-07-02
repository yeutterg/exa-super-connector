// ASCII-art wordmark, Claude Code style (ANSI Shadow figlet), with Exa's own
// logo above it and "SUPER" set in Exa's brand blue.

import { EXA_BLUE, ExaLogoFull } from "@/components/exa-logo";

const SUPER = `███████╗██╗   ██╗██████╗ ███████╗██████╗
██╔════╝██║   ██║██╔══██╗██╔════╝██╔══██╗
███████╗██║   ██║██████╔╝█████╗  ██████╔╝
╚════██║██║   ██║██╔═══╝ ██╔══╝  ██╔══██╗
███████║╚██████╔╝██║     ███████╗██║  ██║
╚══════╝ ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═╝`;

const CONNECTOR = ` ██████╗ ██████╗ ███╗   ██╗███╗   ██╗███████╗ ██████╗████████╗ ██████╗ ██████╗
██╔════╝██╔═══██╗████╗  ██║████╗  ██║██╔════╝██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗
██║     ██║   ██║██╔██╗ ██║██╔██╗ ██║█████╗  ██║        ██║   ██║   ██║██████╔╝
██║     ██║   ██║██║╚██╗██║██║╚██╗██║██╔══╝  ██║        ██║   ██║   ██║██╔══██╗
╚██████╗╚██████╔╝██║ ╚████║██║ ╚████║███████╗╚██████╗   ██║   ╚██████╔╝██║  ██║
 ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═══╝╚══════╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝`;

/** Full stacked wordmark — empty-state hero, like Claude Code's welcome screen. */
export function AsciiWordmark() {
  return (
    <div className="flex select-none flex-col items-center gap-5">
      <ExaLogoFull className="h-7 text-foreground opacity-90" />
      <div className="flex flex-col gap-3 font-mono text-[7px] leading-[1.15] sm:text-[9px]">
        <pre aria-label="Super" style={{ color: EXA_BLUE }}>
          {SUPER}
        </pre>
        <pre aria-label="Connector" className="text-foreground">
          {CONNECTOR}
        </pre>
      </div>
    </div>
  );
}
