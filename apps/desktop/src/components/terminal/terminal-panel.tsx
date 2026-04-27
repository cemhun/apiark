import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";

const TERMINAL_ID = "main";

export function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [alive, setAlive] = useState(false);

  const createTerminal = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    // Clean up previous
    if (termRef.current) {
      termRef.current.dispose();
      termRef.current = null;
    }

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Menlo', monospace",
      theme: getTerminalTheme(),
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(container);

    // Small delay to let the DOM settle before fitting
    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    termRef.current = term;
    fitRef.current = fitAddon;

    // Create PTY session on Rust side
    try {
      await invoke("terminal_create", {
        id: TERMINAL_ID,
        cols: term.cols,
        rows: term.rows,
      });
      setAlive(true);
    } catch (e) {
      term.writeln(`\r\n\x1b[31mFailed to create terminal: ${e}\x1b[0m`);
      return;
    }

    // Listen for output from PTY
    const unlistenOutput: UnlistenFn = await listen<string>(
      `terminal-output-${TERMINAL_ID}`,
      (event) => {
        term.write(event.payload);
      },
    );

    const unlistenExit: UnlistenFn = await listen(
      `terminal-exit-${TERMINAL_ID}`,
      () => {
        term.writeln("\r\n\x1b[33m[Process exited]\x1b[0m");
        setAlive(false);
      },
    );

    // Send input from xterm to PTY
    const onData = term.onData((data) => {
      invoke("terminal_write", { id: TERMINAL_ID, data }).catch(() => {});
    });

    // Store cleanup refs on the terminal object
    (term as any)._cleanup = () => {
      onData.dispose();
      unlistenOutput();
      unlistenExit();
    };
  }, []);

  // Initialize terminal on mount
  useEffect(() => {
    createTerminal();

    return () => {
      if (termRef.current) {
        (termRef.current as any)._cleanup?.();
        termRef.current.dispose();
        termRef.current = null;
      }
      invoke("terminal_close", { id: TERMINAL_ID }).catch(() => {});
    };
  }, [createTerminal]);

  // Resize handler
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (fitRef.current && termRef.current) {
        fitRef.current.fit();
        // Sync new size with PTY
        invoke("terminal_resize", {
          id: TERMINAL_ID,
          cols: termRef.current.cols,
          rows: termRef.current.rows,
        }).catch(() => {});
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // Theme sync
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (termRef.current) {
        termRef.current.options.theme = getTerminalTheme();
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  const handleRestart = useCallback(async () => {
    await invoke("terminal_close", { id: TERMINAL_ID }).catch(() => {});
    if (termRef.current) {
      (termRef.current as any)._cleanup?.();
      termRef.current.dispose();
      termRef.current = null;
    }
    await createTerminal();
  }, [createTerminal]);

  return (
    <div className="relative flex h-full flex-col">
      {!alive && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-(--color-bg)/80">
          <button
            onClick={handleRestart}
            className="rounded-lg bg-(--color-accent) px-4 py-2 text-sm font-medium text-white hover:bg-(--color-accent-hover)"
          >
            Restart Terminal
          </button>
        </div>
      )}
      <div ref={containerRef} className="flex-1 overflow-hidden px-1" />
    </div>
  );
}

function getTerminalTheme() {
  const theme = document.documentElement.getAttribute("data-theme");
  const isLight = theme === "light";

  return isLight
    ? {
        background: "#f8f8f8",
        foreground: "#1e1e1e",
        cursor: "#6366f1",
        cursorAccent: "#f8f8f8",
        selectionBackground: "#6366f140",
        black: "#1e1e1e",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#3b82f6",
        magenta: "#a855f7",
        cyan: "#06b6d4",
        white: "#e4e4e7",
        brightBlack: "#71717a",
        brightRed: "#f87171",
        brightGreen: "#4ade80",
        brightYellow: "#facc15",
        brightBlue: "#60a5fa",
        brightMagenta: "#c084fc",
        brightCyan: "#22d3ee",
        brightWhite: "#fafafa",
      }
    : {
        background: "#0a0a0b",
        foreground: "#e4e4e7",
        cursor: "#6366f1",
        cursorAccent: "#0a0a0b",
        selectionBackground: "#6366f140",
        black: "#0a0a0b",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#3b82f6",
        magenta: "#a855f7",
        cyan: "#06b6d4",
        white: "#e4e4e7",
        brightBlack: "#71717a",
        brightRed: "#f87171",
        brightGreen: "#4ade80",
        brightYellow: "#facc15",
        brightBlue: "#60a5fa",
        brightMagenta: "#c084fc",
        brightCyan: "#22d3ee",
        brightWhite: "#fafafa",
      };
}
