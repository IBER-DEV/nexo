import { MASTER_COLOR_PRESETS } from "@/services/mastersService";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function ColorSwatchPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {MASTER_COLOR_PRESETS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={cn(
            "h-7 w-7 rounded-full flex items-center justify-center transition-transform hover:scale-110",
            value === color && "ring-2 ring-offset-2 ring-offset-background ring-foreground",
          )}
          style={{ background: color }}
          aria-label={`Color ${color}`}
        >
          {value === color && <Check className="h-3.5 w-3.5 text-white drop-shadow" />}
        </button>
      ))}
    </div>
  );
}
