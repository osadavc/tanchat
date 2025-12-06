"use client"

// https://github.com/augiwan/tanstack-theme-kit/blob/main/src/index.tsx

import {
  createContext,
  type Dispatch,
  memo,
  type PropsWithChildren,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ValueObject = {
  [themeName: string]: string;
};

export type UseThemeProps = {
  /** List of all available theme names */
  themes: string[];
  /** Forced theme name for the current page */
  forcedTheme?: string | undefined;
  /** Update the theme */
  setTheme: Dispatch<SetStateAction<string>>;
  /** Active theme name */
  theme?: string | undefined;
  /** If enableSystem is true, returns the System theme preference ("dark" or "light"), regardless what the active theme is */
  systemTheme?: "dark" | "light" | undefined;
  /** If enableSystem is true and theme is "system", returns the System theme preference ("dark" or "light"), otherwise returns the theme value */
  resolvedTheme?: string | undefined;
};

export type Attribute = `data-${string}` | "class";

export interface ThemeProviderProps extends PropsWithChildren {
  /** List of all available theme names */
  themes?: string[] | undefined;
  /** Forced theme name for the current page */
  forcedTheme?: string | undefined;
  /** Whether to switch between dark and light themes based on prefers-color-scheme */
  enableSystem?: boolean | undefined;
  /** Disable all CSS transitions when switching themes */
  disableTransitionOnChange?: boolean | undefined;
  /** Whether to indicate to browsers which color scheme is used (dark or light) for built-in UI like inputs and buttons */
  enableColorScheme?: boolean | undefined;
  /** Key used to store theme setting in localStorage */
  storageKey?: string | undefined;
  /** Default theme name (for v0.0.12 and lower the default was light). If `enableSystem` is false, the default theme is light */
  defaultTheme?: string | undefined;
  /** HTML attribute modified based on the active theme. Accepts `class`, `data-*` (meaning any data attribute, `data-mode`, `data-color`, etc.), or an array which could include both */
  attribute?: Attribute | Attribute[] | undefined;
  /** Mapping of theme name to HTML attribute value. Object where key is the theme name and value is the attribute value */
  value?: ValueObject | undefined;
  /** Nonce string to pass to the inline script for CSP headers */
  nonce?: string | undefined;
}

const colorSchemes = ["light", "dark"];
const MEDIA = "(prefers-color-scheme: dark)";
const isServer = typeof window === "undefined";
const ThemeContext = createContext<UseThemeProps | undefined>(undefined);
const defaultContext: UseThemeProps = {
  setTheme: () => {
    /* no-op */
  },
  themes: [],
};

export const useTheme = () => useContext(ThemeContext) ?? defaultContext;

export const ThemeProvider = (props: ThemeProviderProps): ReactNode => {
  const context = useContext(ThemeContext);

  // Ignore nested context providers, just passthrough children
  if (context) {
    return props.children;
  }
  return <Theme {...props} />;
};

const defaultThemes = ["light", "dark"];

const Theme = ({
  forcedTheme,
  disableTransitionOnChange = false,
  enableSystem = true,
  enableColorScheme = true,
  storageKey = "theme",
  themes = defaultThemes,
  defaultTheme = enableSystem ? "system" : "light",
  attribute = "data-theme",
  value,
  children,
  nonce,
}: ThemeProviderProps) => {
  const [theme, setThemeState] = useState(() =>
    getTheme(storageKey, defaultTheme)
  );

  const applyClassAttribute = useCallback(
    (name: string | undefined, attrValues: string[]) => {
      const d = document.documentElement;
      d.classList.remove(...attrValues);
      if (name) {
        d.classList.add(name);
      }
    },
    []
  );

  const applyDataAttribute = useCallback(
    (attr: string, name: string | undefined) => {
      const d = document.documentElement;
      if (name) {
        d.setAttribute(attr, name);
      } else {
        d.removeAttribute(attr);
      }
    },
    []
  );

  const applyAttributesToDOM = useCallback(
    (resolved: string) => {
      const attributeList = Array.isArray(attribute) ? attribute : [attribute];
      const attrValues = value ? Object.values(value) : themes;
      const name = value ? value[resolved] : resolved;

      for (const attr of attributeList) {
        if (attr === "class") {
          applyClassAttribute(name, attrValues);
        } else if (attr.startsWith("data-")) {
          applyDataAttribute(attr, name);
        }
      }
    },
    [attribute, themes, value, applyClassAttribute, applyDataAttribute]
  );

  const applyColorScheme = useCallback(
    (resolved: string) => {
      if (!enableColorScheme) {
        return;
      }
      const fallback = colorSchemes.includes(defaultTheme)
        ? defaultTheme
        : null;
      const colorScheme = colorSchemes.includes(resolved) ? resolved : fallback;
      document.documentElement.style.colorScheme = colorScheme || "";
    },
    [enableColorScheme, defaultTheme]
  );

  // apply selected theme function (light, dark, system)
  const applyTheme = useCallback(
    (nextTheme: string | undefined) => {
      if (!nextTheme) {
        return;
      }

      const resolved =
        nextTheme === "system" && enableSystem ? getSystemTheme() : nextTheme;

      const enable = disableTransitionOnChange ? disableAnimation() : null;

      applyAttributesToDOM(resolved);
      applyColorScheme(resolved);

      enable?.();
    },
    [
      enableSystem,
      disableTransitionOnChange,
      applyAttributesToDOM,
      applyColorScheme,
    ]
  );

  // Set theme state and save to local storage
  const setTheme = useCallback(
    (newValue: SetStateAction<string>) => {
      const newTheme =
        typeof newValue === "function" ? newValue(theme ?? "") : newValue;
      setThemeState(newTheme);

      // Save to storage
      try {
        localStorage.setItem(storageKey, newTheme);
      } catch {
        // localStorage might not be available
      }
    },
    [theme, storageKey]
  );

  const handleMediaQuery = useCallback(
    (_event: MediaQueryListEvent | MediaQueryList) => {
      if (theme === "system" && enableSystem && !forcedTheme) {
        applyTheme("system");
      }
    },
    [applyTheme, enableSystem, forcedTheme, theme]
  );

  // Always listen to System preference
  useEffect(() => {
    if (isServer) {
      return;
    }

    const media = window.matchMedia(MEDIA);

    // Intentionally use deprecated listener methods to support iOS 13 and older browsers
    media.addListener(handleMediaQuery);
    handleMediaQuery(media);

    return () => media.removeListener(handleMediaQuery);
  }, [handleMediaQuery]);

  // localStorage event handling, allow to sync theme changes between tabs
  useEffect(() => {
    if (isServer) {
      return;
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) {
        return;
      }

      // If default theme set, use it if localstorage === null (happens on local storage manual deletion)
      const newTheme = e.newValue || defaultTheme;
      setTheme(newTheme);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [defaultTheme, setTheme, storageKey]);

  // Whenever theme or forcedTheme changes, apply it
  useEffect(() => {
    applyTheme(forcedTheme ?? theme);
  }, [applyTheme, forcedTheme, theme]);

  const providerValue = useMemo(() => {
    const systemThemeValue = enableSystem
      ? (getSystemTheme() as "dark" | "light")
      : undefined;
    
    const resolvedTheme = 
      theme === "system" && enableSystem ? systemThemeValue : theme;

    return {
      theme,
      setTheme,
      forcedTheme,
      themes: enableSystem ? [...themes, "system"] : themes,
      systemTheme: systemThemeValue,
      resolvedTheme,
    };
  }, [theme, forcedTheme, enableSystem, themes, setTheme]);

  return (
    <ThemeContext.Provider value={providerValue}>
      <ThemeScript
        {...{
          forcedTheme,
          storageKey,
          attribute,
          enableSystem,
          enableColorScheme,
          defaultTheme,
          value,
          themes,
          nonce,
        }}
      />
      {children}
    </ThemeContext.Provider>
  );
};

const ThemeScript = memo(
  ({
    forcedTheme,
    storageKey,
    attribute,
    enableSystem,
    enableColorScheme,
    defaultTheme,
    value,
    themes,
    nonce,
  }: Omit<ThemeProviderProps, "children"> & { defaultTheme: string }) => {
    const scriptArgs = JSON.stringify([
      attribute,
      storageKey,
      defaultTheme,
      forcedTheme,
      themes,
      value,
      enableSystem,
      enableColorScheme,
    ]).slice(1, -1);

    return (
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Needed to inject script before hydration
        dangerouslySetInnerHTML={{
          __html: `(${script.toString()})(${scriptArgs})`,
        }}
        nonce={nonce}
        suppressHydrationWarning
      />
    );
  }
);

ThemeScript.displayName = "ThemeScript";

// Helpers
const getTheme = (key: string, fallback?: string) => {
  if (isServer) {
    return fallback;
  }
  let theme: string | undefined;
  try {
    theme = localStorage.getItem(key) || undefined;
  } catch {
    // localStorage might not be available
  }
  return theme || fallback;
};

const disableAnimation = () => {
  const css = document.createElement("style");
  css.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}"
    )
  );
  document.head.appendChild(css);

  return () => {
    // Force restyle
    window.getComputedStyle(document.body);

    // Wait for next tick before removing
    setTimeout(() => {
      document.head.removeChild(css);
    }, 1);
  };
};

const getSystemTheme = (e?: MediaQueryList | MediaQueryListEvent) => {
  if (isServer) {
    return "light";
  }
  const event = e ?? window.matchMedia(MEDIA);
  const isDark = event.matches;
  const systemTheme = isDark ? "dark" : "light";
  return systemTheme;
};

/*
  This file is adapted from next-themes to work with tanstack start.
  next-themes can be found at https://github.com/pacocoursey/next-themes under the MIT license.
*/

// biome-ignore lint/nursery/useMaxParams: Function is serialized and injected as inline script, cannot use options object
export const script = (
  attribute: Attribute | Attribute[],
  storageKey: string,
  defaultTheme: string,
  forcedTheme: string | undefined,
  themes: string[],
  value: ValueObject | undefined,
  enableSystem: boolean,
  enableColorScheme: boolean
) => {
  const el = document.documentElement;
  const systemThemes = ["light", "dark"];
  const attributes = Array.isArray(attribute) ? attribute : [attribute];
  const attrValues = value ? Object.values(value) : themes;

  function applyClassAttr(name: string | undefined) {
    el.classList.remove(...attrValues);
    if (name) {
      el.classList.add(name);
    }
  }

  function applyDataAttr(attr: string, name: string | undefined) {
    if (name) {
      el.setAttribute(attr, name);
    } else {
      el.removeAttribute(attr);
    }
  }

  function updateDOM(theme: string) {
    const name = value ? value[theme] : theme;

    for (const attr of attributes) {
      if (attr === "class") {
        applyClassAttr(name);
      } else if (attr.startsWith("data-")) {
        applyDataAttr(attr, name);
      }
    }

    setColorScheme(theme);
  }

  function setColorScheme(theme: string) {
    if (!enableColorScheme) {
      return;
    }

    const fallback = systemThemes.includes(defaultTheme) ? defaultTheme : null;
    const colorScheme = systemThemes.includes(theme) ? theme : fallback;
    el.style.colorScheme = colorScheme || "";
  }

  function resolveSystemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  if (forcedTheme) {
    const resolvedForcedTheme =
      forcedTheme === "system" && enableSystem
        ? resolveSystemTheme()
        : forcedTheme;
    updateDOM(resolvedForcedTheme);
  } else {
    try {
      const themeName = localStorage.getItem(storageKey) || defaultTheme;
      const isSystem = enableSystem && themeName === "system";
      const theme = isSystem ? resolveSystemTheme() : themeName;
      updateDOM(theme);
    } catch {
      // localStorage might not be available
    }
  }
};