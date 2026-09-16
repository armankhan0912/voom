import { useEffect, type MutableRefObject, type RefObject } from "react";
import type { OverlayPart } from "../messages";
import { postParent } from "./media";

const DRAG_THRESHOLD = 4;

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  screenX: number;
  screenY: number;
  started: boolean;
};

export function useOverlayDrag(
  rootRef: RefObject<HTMLElement | null>,
  part: OverlayPart | string | null,
  ignoreClickRef: MutableRefObject<boolean>,
) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const el = root;

    let active: DragState | null = null;

    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0) {
        return;
      }

      if (event.target instanceof Element && event.target.closest("button")) {
        return;
      }

      active = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        screenX: event.screenX,
        screenY: event.screenY,
        started: false,
      };

      if (part === "bubble") {
        event.preventDefault();
      }
    }

    function onPointerMove(event: PointerEvent) {
      if (!active || event.pointerId !== active.pointerId) {
        return;
      }

      if (!active.started) {
        const distance = Math.hypot(
          event.clientX - active.startX,
          event.clientY - active.startY,
        );
        if (distance < DRAG_THRESHOLD) {
          return;
        }

        active.started = true;
        ignoreClickRef.current = true;
        el.classList.add("dragging");
        try {
          el.setPointerCapture(event.pointerId);
        } catch {
          // Capture can fail in some embedders; parent listeners still move the frame.
        }
        postParent({
          type: "voom-overlay-drag-start",
          part,
          screenX: active.screenX,
          screenY: active.screenY,
        });
      }

      postParent({
        type: "voom-overlay-drag-move",
        part,
        screenX: event.screenX,
        screenY: event.screenY,
      });
    }

    function endDrag(event: PointerEvent) {
      if (!active || event.pointerId !== active.pointerId) {
        return;
      }

      if (active.started) {
        ignoreClickRef.current = true;
        postParent({ type: "voom-overlay-drag-end", part });
        setTimeout(() => {
          ignoreClickRef.current = false;
        }, 0);
      }

      try {
        el.releasePointerCapture(event.pointerId);
      } catch {
        // Not captured.
      }

      el.classList.remove("dragging");
      active = null;
    }

    function onClickCapture(event: MouseEvent) {
      if (!ignoreClickRef.current) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      ignoreClickRef.current = false;
    }

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("click", onClickCapture, true);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      window.removeEventListener("click", onClickCapture, true);
    };
  }, [ignoreClickRef, part, rootRef]);
}
