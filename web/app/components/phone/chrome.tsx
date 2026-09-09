"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { usePhone } from "./theme";
import { getRangeColor } from "./demo";

// RN ActivityIndicator look: a spinning arc.
export function Spinner({ size = 20, color }: { size?: number; color: string }) {
  return (
    <span
      className="motion-safe:animate-spin inline-block rounded-full"
      style={{
        width: size,
        height: size,
        border: `${Math.max(2, size / 10)}px solid ${color}33`,
        borderTopColor: color,
      }}
    />
  );
}

// Banded meter bar (HomeScreen GradientMeter): solid fill, 5 severity ranges.
export function GradientMeter({
  percent,
  height = 12,
}: {
  percent: number;
  height?: number;
}) {
  const { colors } = usePhone();
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="w-full overflow-hidden"
      style={{ height, borderRadius: height / 2, backgroundColor: colors.surface }}
    >
      <div
        className="h-full transition-[width] duration-700 ease-out"
        style={{
          width: `${clamped}%`,
          borderRadius: height / 2,
          backgroundColor: getRangeColor(clamped),
        }}
      />
    </div>
  );
}

// Android-style centered alert card over a dim overlay.
export function PhoneAlert({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  const { colors } = usePhone();
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center px-6"
      style={{ background: colors.overlay }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-[28px] p-6"
        style={{ backgroundColor: colors.card, boxShadow: "0 10px 40px rgba(0,0,0,0.45)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ color: colors.text, fontSize: 17, fontWeight: 700 }}>{title}</div>
        <div style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 1.45, marginTop: 8 }}>
          {message}
        </div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            style={{ color: colors.primary, fontWeight: 700, fontSize: 14 }}
            className="rounded-full px-4 py-2 active:opacity-70"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

// Port of TypeToConfirmModal: type the shown token to arm the button.
export function TypeToConfirm({
  title,
  message,
  token,
  busy,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  token: string;
  busy: boolean;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { colors } = usePhone();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const armed = value.trim() === token;

  useEffect(() => {
    if (title) setValue("");
  }, [title]);

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center px-5"
      style={{ background: colors.overlay }}
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="w-full rounded-[28px] p-6"
        style={{ backgroundColor: colors.card, boxShadow: "0 10px 40px rgba(0,0,0,0.45)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ color: colors.text, fontSize: 17, fontWeight: 700 }}>{title}</div>
        <div style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 1.45, marginTop: 8 }}>
          {message}
        </div>

        <div className="mt-4 rounded-xl px-4 py-3" style={{ backgroundColor: colors.surface }}>
          <div style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Type to confirm
          </div>
          <div
            className="mt-1 select-all font-mono text-lg"
            style={{ color: colors.primary, fontWeight: 700, letterSpacing: 1 }}
          >
            {token}
          </div>
        </div>

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={token.replace(/[A-Z]/g, "•")}
          autoFocus
          spellCheck={false}
          className="mt-3 w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={{
            backgroundColor: colors.surface,
            color: colors.text,
            border: `1px solid ${armed ? colors.primary : colors.border}`,
          }}
        />

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-full px-4 py-2.5 text-sm active:opacity-70"
            style={{ color: colors.textSecondary, fontWeight: 600 }}
          >
            <X size={14} className="mr-1 inline" />
            Cancel
          </button>
          <button
            onClick={() => armed && onConfirm()}
            disabled={!armed || busy}
            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-opacity"
            style={{
              backgroundColor: armed && !busy ? colors.primary : colors.surface,
              color: armed && !busy ? colors.onPrimary : colors.textMuted,
            }}
          >
            {busy && <Spinner size={14} color={colors.onPrimary} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
