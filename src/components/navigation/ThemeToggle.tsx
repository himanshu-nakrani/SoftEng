import { IconButton } from "@/components/ui/IconButton";
import { Moon, Sun } from "lucide-react";

/** Appearance control. The click is handled by the layout boot script. */
export function ThemeToggle() {
  return (
    <IconButton
      variant="bordered"
      label="Toggle light and dark mode"
      title="Light / dark"
      data-theme-toggle=""
    >
      <Sun className="theme-sun size-4" strokeWidth={1.75} />
      <Moon className="theme-moon size-4" strokeWidth={1.75} />
    </IconButton>
  );
}
