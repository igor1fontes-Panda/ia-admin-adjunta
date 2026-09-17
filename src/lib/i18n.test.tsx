import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PreferencesProvider, usePreferences } from "./i18n";

function Probe() {
  const { locale, theme, setLocale, toggleTheme, t } = usePreferences();
  return <div><span>{locale}-{theme}-{t("dashboard")}</span><button onClick={() => setLocale("en")}>English</button><button onClick={toggleTheme}>Theme</button></div>;
}

describe("preferences", () => {
  it("switches language and theme", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<PreferencesProvider><Probe /></PreferencesProvider>);
    await user.click(screen.getByText("English"));
    await user.click(screen.getByText("Theme"));
    expect(screen.getByText("en-light-Dashboard")).toBeInTheDocument();
  });
});
