import React, { useCallback, useEffect, useRef, useState } from "react";
import styles from "./ZoomableImage.module.css";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

export default function ZoomableImage({
  src,
  alt = "Image",
  className = "",
  imageClassName = "",
  children,
  ...props
}) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const dragRef = useRef({
    startX: 0,
    startY: 0,
    panX: 0,
    panY: 0,
    pointerId: null,
  });

  const closePreview = () => {
    setOpen(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setDragging(false);
  };

  const zoomIn = () => {
    setZoom((value) =>
      Math.min(MAX_ZOOM, Number((value + ZOOM_STEP).toFixed(2)))
    );
  };

  const zoomOut = () => {
    setZoom((value) => {
      const nextZoom = Math.max(
        MIN_ZOOM,
        Number((value - ZOOM_STEP).toFixed(2))
      );

      if (nextZoom === MIN_ZOOM) {
        setPan({ x: 0, y: 0 });
      }

      return nextZoom;
    });
  };

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const startDrag = (event) => {
    if (zoom <= 1) return;

    event.preventDefault();

    event.currentTarget.setPointerCapture?.(event.pointerId);

    setDragging(true);

    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
      pointerId: event.pointerId,
    };
  };

  const moveDrag = useCallback(
    (event) => {
      if (!dragging) return;

      event.preventDefault();

      const nextX =
        dragRef.current.panX +
        event.clientX -
        dragRef.current.startX;

      const nextY =
        dragRef.current.panY +
        event.clientY -
        dragRef.current.startY;

      setPan({
        x: nextX,
        y: nextY,
      });
    },
    [dragging]
  );

  const endDrag = useCallback(() => {
    setDragging(false);
    dragRef.current.pointerId = null;
  }, []);

  const handleWheel = (event) => {
    event.preventDefault();

    if (event.deltaY < 0) {
      zoomIn();
    }

    if (event.deltaY > 0) {
      zoomOut();
    }
  };

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") closePreview();
      if (event.key === "+" || event.key === "=") zoomIn();
      if (event.key === "-") zoomOut();
      if (event.key === "0") resetZoom();
    };

    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointermove", moveDrag, {
      passive: false,
    });
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    return () => {
      document.body.style.overflow = "";

      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointermove", moveDrag);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [open, moveDrag, endDrag]);

  if (!src) return null;

  return (
    <>
      <button
        type="button"
        className={`${styles.trigger} ${className}`.trim()}
        onClick={() => setOpen(true)}
        aria-label={`Отвори ${alt}`}
      >
        {children || (
          <img
            src={src}
            alt={alt}
            className={imageClassName}
            {...props}
          />
        )}
      </button>

      {open ? (
        <div
          className={styles.overlay}
          onClick={closePreview}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className={styles.close}
            onClick={closePreview}
            aria-label="Затвори прегледа на снимката"
          >
            ×
          </button>

          <div
            className={styles.toolbar}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={zoomOut}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Намали"
            >
              −
            </button>

            <span>{Math.round(zoom * 100)}%</span>

            <button
              type="button"
              onClick={zoomIn}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Увеличи"
            >
              +
            </button>

            <button
              type="button"
              onClick={resetZoom}
              disabled={zoom === 1}
            >
              Reset
            </button>
          </div>

          <div
            className={`${styles.imageStage} ${
              zoom > 1 ? styles.canPan : ""
            } ${dragging ? styles.dragging : ""}`}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={startDrag}
            onWheel={handleWheel}
          >
            <img
              src={src}
              alt={alt}
              className={styles.fullImage}
              draggable={false}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}