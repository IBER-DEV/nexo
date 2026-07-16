import { createContext, useContext, useEffect, useState } from "react";
import { bind, play, setEnabled, type SoundName } from "cuelume";

const KEY = "ui-sound-enabled";

const SoundCtx = createContext<{
  enabled: boolean;
  setSoundEnabled: (value: boolean) => void;
  play: (sound?: SoundName) => void;
}>({
  enabled: true,
  setSoundEnabled: () => {},
  play: () => {},
});

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    bind();
    const stored = localStorage.getItem(KEY);
    const initial = stored === null ? true : stored === "true";
    setEnabledState(initial);
    setEnabled(initial);
  }, []);

  const setSoundEnabled = (value: boolean) => {
    setEnabledState(value);
    setEnabled(value);
    try {
      localStorage.setItem(KEY, String(value));
    } catch {
      // Storage can be unavailable (private mode, quota); preference just won't persist.
    }
  };

  return (
    <SoundCtx.Provider value={{ enabled, setSoundEnabled, play }}>{children}</SoundCtx.Provider>
  );
}

export const useSound = () => useContext(SoundCtx);
