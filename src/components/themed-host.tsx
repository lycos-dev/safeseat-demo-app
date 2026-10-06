import { useTheme } from "@/hooks/use-theme";
import { Host } from "@expo/ui";
import type { ComponentProps, ReactNode } from "react";

type HostProps = ComponentProps<typeof Host> & { children?: ReactNode };

/**
 * Keeps Expo UI native views in sync with SafeSeat's in-app appearance.
 * Without an explicit colorScheme, SwiftUI / Compose can keep following the
 * device scheme even after SafeSeat switches between Light and Dark mode.
 */
export default function ThemedHost({ children, ...props }: HostProps) {
  const themes = useTheme();
  return (
    <Host colorScheme={themes.mode} seedColor={themes.primaryBttn} {...props}>
      {children}
    </Host>
  );
}
