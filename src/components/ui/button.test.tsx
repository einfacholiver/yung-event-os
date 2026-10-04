import Link from "next/link";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Button } from "./button";

it("supports native disabled behavior", () => {
  const onClick = vi.fn();
  render(
    <Button disabled onClick={onClick}>
      Weiter
    </Button>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
  expect(onClick).not.toHaveBeenCalled();
  expect(screen.getByRole("button")).toBeDisabled();
});

it("composes a link without nesting interactive elements", () => {
  render(
    <Button asChild>
      <Link href="/">Startseite</Link>
    </Button>,
  );
  expect(screen.getByRole("link", { name: "Startseite" })).toHaveAttribute(
    "href",
    "/",
  );
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
