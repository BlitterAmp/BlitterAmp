import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Menu, Minus, Square, X } from "lucide-react";

const REPO = "https://github.com/BlitterAmp/BlitterAmp";
const ISSUES = `${REPO}/issues/new`;

function dismissMenu() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

export function LinuxAppMenu({
  onSettings,
  onAbout,
  onLogs,
}: {
  onSettings: () => void;
  onAbout: () => void;
  onLogs: () => void;
}) {
  const action = (run: () => void) => () => {
    dismissMenu();
    run();
  };

  return (
    <div className="dropdown dropdown-bottom">
      <button type="button" tabIndex={0} className="btn btn-ghost btn-sm btn-square" aria-label="Application menu">
        <Menu size={18} />
      </button>
      <ul tabIndex={-1} className="menu dropdown-content z-50 mt-1 w-52 rounded-box border border-base-300 bg-base-100 p-2 shadow-xl">
        <li><button type="button" onClick={action(onSettings)}>Settings</button></li>
        <li><button type="button" onClick={action(onAbout)}>About BlitterAmp</button></li>
        <li><button type="button" onClick={action(onLogs)}>Logs</button></li>
        <li className="my-1 border-t border-base-300" />
        <li><button type="button" onClick={action(() => void openUrl(REPO))}>GitHub</button></li>
        <li><button type="button" onClick={action(() => void openUrl(ISSUES))}>Report an issue</button></li>
        <li className="my-1 border-t border-base-300" />
        <li><button type="button" onClick={action(() => void getCurrentWindow().close())}>Quit</button></li>
      </ul>
    </div>
  );
}

export function LinuxWindowControls() {
  const window = getCurrentWindow();

  return (
    <div className="flex items-center">
      <button type="button" className="btn btn-ghost btn-sm btn-square rounded-none" aria-label="Minimize" onClick={() => void window.minimize()}>
        <Minus size={16} />
      </button>
      <button type="button" className="btn btn-ghost btn-sm btn-square rounded-none" aria-label="Maximize or restore" onClick={() => void window.toggleMaximize()}>
        <Square size={13} />
      </button>
      <button type="button" className="btn btn-ghost btn-sm btn-square rounded-none hover:btn-error" aria-label="Close" onClick={() => void window.close()}>
        <X size={17} />
      </button>
    </div>
  );
}
