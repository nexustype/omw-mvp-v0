import React from "react";

type Role = "rider" | "driver";

export default function RoleToggle({
  value,
  onChange,
}: {
  value: Role;
  onChange: (r: Role) => void;
}) {
  const isRider = value === "rider";

  return (
    <div
      aria-label="Role toggle"
      role="switch"
      aria-checked={isRider}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onChange(isRider ? "driver" : "rider");
        }
      }}
      className="glass-toggle"
      onClick={() => onChange(isRider ? "driver" : "rider")}
    >
      <div className={`glass-toggle__knob ${isRider ? "left" : "right"}`} />
      <div className={`glass-toggle__label ${isRider ? "active" : ""}`} style={{ left: 8 }}>
        Rider
      </div>
      <div className={`glass-toggle__label ${!isRider ? "active" : ""}`} style={{ right: 8 }}>
        Driver
      </div>
    </div>
  );
}
