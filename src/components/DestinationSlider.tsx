import React, { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";

type Mode = "center" | "driver" | "rider";

interface DestinationSliderProps {
  onKeyboardOpen?: (mode: "driver" | "rider") => void;
  onKeyboardClose?: () => void;
  onDestinationChange?: (mode: "driver" | "rider", value: string) => void;
}

export const DestinationSlider: React.FC<DestinationSliderProps> = ({
  onKeyboardOpen,
  onKeyboardClose,
  onDestinationChange,
}) => {
  const [selectedMode, setSelectedMode] = useState<Mode>("center");
  const [showInput, setShowInput] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [sliderWidth, setSliderWidth] = useState(300);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // slightly taller handle
  const handleSize = 56;
  const x = useMotionValue(0);

  // responsive width
  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateWidth = () => {
      const vw = window.innerWidth;
      const width = Math.min(360, Math.max(260, vw * 0.9));
      setSliderWidth(width);
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const dragConstraints = {
    left: -(sliderWidth / 2 - handleSize / 2),
    right: sliderWidth / 2 - handleSize / 2,
  };

  const driverOpacity = useTransform(x, [-75, -40, 0], [1, 0.4, 0]);
  const riderOpacity = useTransform(x, [0, 40, 75], [0, 0.4, 1]);

  const snapTo = (mode: Mode) => {
    if (mode === "driver") {
      x.set(dragConstraints.left);
    } else if (mode === "rider") {
      x.set(dragConstraints.right);
    } else {
      x.set(0);
    }
    setSelectedMode(mode);
  };

  // centralised keyboard / labels logic
  useEffect(() => {
    if (selectedMode === "center") {
      setShowInput(false);
      setShowLabels(true);
      onKeyboardClose?.();
      return;
    }

    // driver or rider
    setShowInput(true);
    setShowLabels(false);
    onKeyboardOpen?.(selectedMode);

    const id = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 80);

    return () => window.clearTimeout(id);
  }, [selectedMode, onKeyboardOpen, onKeyboardClose]);

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: any
  ) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    let target: Mode = "center";

    if (offset < -50 || velocity < -500) {
      target = "driver";
    } else if (offset > 50 || velocity > 500) {
      target = "rider";
    } else {
      target = "center";
    }

    snapTo(target);
  };

  const handleTextClick = (mode: "driver" | "rider") => {
    snapTo(mode);
  };

  const handleInputBlur = () => {
    // for the demo, return to center when leaving the field
    snapTo("center");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (selectedMode === "driver" || selectedMode === "rider") {
      onDestinationChange?.(selectedMode, value);
    }
  };

  return (
    <motion.div
      style={{
        position: "fixed",
        insetInline: 0,
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 50,
      }}
      // ❗ no vertical animation – let iOS handle viewport changes
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
    >
      {/* centering wrapper */}
      <div
        style={{
          pointerEvents: "auto",
          position: "relative",
          width: `${sliderWidth}px`,
          height: `${handleSize + 8}px`, // slightly taller pill
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* glass container */}
        <div
  style={{
    position: "absolute",
    inset: 0,
    borderRadius: 999,
    // ultra-light glass – almost fully transparent
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.0001), rgba(255,255,255,0.0))",
    border: "1px solid rgba(255,255,255,0.16)",
    boxShadow:
      "0 4px 10px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(255,255,255,0.12)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    overflow: "hidden",
  }}

        >
          {/* Rider label */}
          {showLabels && (
            <motion.div
              style={{
                position: "absolute",
                left: 18,
                top: "50%",
                transform: "translateY(-50%)",
                color: "rgba(255,255,255,0.9)",
                userSelect: "none",
                whiteSpace: "nowrap",
                fontSize: 15,
                fontWeight: 500,
                letterSpacing: 0.1,
                opacity: riderOpacity,
                cursor: "pointer",
              }}
              onClick={() => handleTextClick("rider")}
            >
              Rider destination
            </motion.div>
          )}

          {/* Driver label */}
          {showLabels && (
            <motion.div
              style={{
                position: "absolute",
                right: 18,
                top: "50%",
                transform: "translateY(-50%)",
                color: "rgba(255,255,255,0.9)",
                userSelect: "none",
                whiteSpace: "nowrap",
                fontSize: 15,
                fontWeight: 500,
                letterSpacing: 0.1,
                opacity: driverOpacity,
                cursor: "pointer",
              }}
              onClick={() => handleTextClick("driver")}
            >
              Driver destination
            </motion.div>
          )}

          {/* Text input */}
          {showInput && (
            <input
              ref={inputRef}
              type="text"
              placeholder={
                selectedMode === "driver"
                  ? "Enter driver destination..."
                  : "Enter rider destination..."
              }
              onBlur={handleInputBlur}
              onChange={handleInputChange}
              style={{
                position: "absolute",
                insetInline: 18,
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#ffffff",
                fontSize: 15,
                fontWeight: 500,
                textAlign: selectedMode === "driver" ? "right" : "left",
                "::placeholder": {
                  color: "rgba(255,255,255,0.65)",
                } as any,
              }}
            />
          )}
        </div>

        {/* handle wrapper – stays centered, x handles the drag */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <motion.div
            style={{
              width: `${handleSize}px`,
              height: `${handleSize}px`,
              cursor: "grab",
              x,
              zIndex: 10,
              pointerEvents: "auto",
            }}
            drag="x"
            dragConstraints={dragConstraints}
            dragElastic={0.12}
            dragTransition={{ bounceStiffness: 650, bounceDamping: 22 }}
            onDragEnd={handleDragEnd}
            whileTap={{ cursor: "grabbing" }}
          >
            <div
  style={{
    width: "100%",
    height: "100%",
    borderRadius: "999px",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.88))",
    border: "1.5px solid rgba(255,255,255,0.95)",
    backdropFilter: "blur(22px)",
    WebkitBackdropFilter: "blur(22px)",
    boxShadow:
      "0 8px 20px rgba(0,0,0,0.35), 0 0 0 0.5px rgba(0,0,0,0.20)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }}
>
            
              <img
                src="/omw-logo.png"
                alt="OMW"
                style={{
                  width: "70%",
                  height: "70%",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};
