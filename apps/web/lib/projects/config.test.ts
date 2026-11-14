import { describe, expect, it } from "vitest";
import { disallowedConfigFields, toWidgetConfigColumns } from "./config";

const FULL = {
  buttonColor: "#ff0000",
  position: "top-left" as const,
  label: "Help",
  animation: "slide" as const,
  headerText: "Hi there",
  showBadge: false,
};

describe("disallowedConfigFields", () => {
  it("Free may change nothing: every sent field is refused", () => {
    expect(disallowedConfigFields(FULL, "free").sort()).toEqual(Object.keys(FULL).sort());
    expect(disallowedConfigFields({ buttonColor: "#00ff00" }, "free")).toEqual(["buttonColor"]);
    expect(disallowedConfigFields({ showBadge: true }, "free")).toEqual(["showBadge"]);
  });

  it("Pro may change every field", () => {
    expect(disallowedConfigFields(FULL, "pro")).toEqual([]);
  });
});

describe("toWidgetConfigColumns", () => {
  it("maps every field to its column", () => {
    expect(toWidgetConfigColumns(FULL)).toEqual({
      button_color: "#ff0000",
      position: "top-left",
      label: "Help",
      animation: "slide",
      header_text: "Hi there",
      show_badge: false,
    });
  });

  it("only includes the fields that were sent", () => {
    expect(toWidgetConfigColumns({ label: "Chat" })).toEqual({ label: "Chat" });
  });
});
