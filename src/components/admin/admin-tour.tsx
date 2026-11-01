"use client";

import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { usePathname } from "next/navigation";
import { useCallback, useEffect } from "react";
import { TOURS } from "./tours";

const STORAGE_KEY = "nightdaro-tours-seen";

/** Sections each admin already toured, per admin id. A convenience: missing storage is fine. */
function seen(adminId: string): string[] {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, string[]>;
    return Array.isArray(all[adminId]) ? all[adminId] : [];
  } catch {
    return [];
  }
}

function markSeen(adminId: string, path: string) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, string[]>;
    all[adminId] = [...new Set([...(all[adminId] ?? []), path])];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Private mode or blocked storage: the tour simply shows again next time.
  }
}

function start(path: string) {
  const steps = (TOURS[path] ?? []).flatMap((step) => {
    if (!step.target) return [{ popover: { title: step.title, description: step.description } }];
    const element = document.querySelector(`[data-tour="${step.target}"]`);
    return element
      ? [{ element, popover: { title: step.title, description: step.description } }]
      : [];
  });
  if (steps.length === 0) return;
  driver({
    steps,
    showProgress: true,
    progressText: "{{current}} de {{total}}",
    nextBtnText: "Siguiente",
    prevBtnText: "Anterior",
    doneBtnText: "Listo",
    popoverClass: "nightdaro-tour",
    overlayColor: "#07041a",
    overlayOpacity: 0.72,
    stagePadding: 6,
    stageRadius: 6,
  }).drive();
}

/**
 * "Ver tutorial" for the current section, and the first visit of each section starts it by
 * itself (not under automation: navigator.webdriver, so test runs are not covered by it).
 */
export function AdminTour({ adminId }: { adminId: string }) {
  const pathname = usePathname();
  const hasTour = pathname in TOURS;

  useEffect(() => {
    if (!hasTour || navigator.webdriver || seen(adminId).includes(pathname)) return;
    // After the section has painted, so every target is on screen.
    const timer = setTimeout(() => {
      markSeen(adminId, pathname);
      start(pathname);
    }, 400);
    return () => clearTimeout(timer);
  }, [adminId, pathname, hasTour]);

  const replay = useCallback(() => {
    markSeen(adminId, pathname);
    start(pathname);
  }, [adminId, pathname]);

  if (!hasTour) return null;
  return (
    <button
      type="button"
      data-tour="tour-button"
      onClick={replay}
      className="rounded-full border-[1.5px] border-border px-3 py-1.5 text-xs font-bold hover:border-brand-sky"
    >
      Ver tutorial
    </button>
  );
}
