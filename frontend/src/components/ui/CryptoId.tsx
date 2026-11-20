import * as React from "react";

/**
 * Typography for every cryptographic identifier the app shows: Stellar
 * addresses (G...), contract IDs (C...), transaction hashes and deliverable
 * hashes. A monospace stack keeps characters aligned and tells 0/O and 1/l
 * apart; tight tracking keeps 56-character keys on as few lines as possible.
 */
export const CRYPTO_ID_CLASS = "font-mono tracking-tight";

export type CryptoIdSize = "xs" | "sm";

const SIZE_CLASS: Record<CryptoIdSize, string> = {
  xs: "text-xs",
  sm: "text-sm",
};

/**
 * Shortens `value` to its first `head` and last `tail` characters joined by
 * "...". Values that would not get shorter are returned unchanged.
 */
export function truncateMiddle(value: string, head: number, tail: number): string {
  if (head < 0 || tail < 0 || value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(value.length - tail)}`;
}

export interface CryptoIdProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children" | "prefix"> {
  /** The full address, contract ID or hash. */
  value: string;
  /** Characters kept at the start. Truncates only when `tail` is set too. */
  head?: number;
  /** Characters kept at the end. Truncates only when `head` is set too. */
  tail?: number;
  size?: CryptoIdSize;
  /** Rendered before the value, e.g. an icon. */
  prefix?: React.ReactNode;
}

/**
 * Renders a cryptographic identifier in the shared monospace style. When the
 * value is truncated, the full value is exposed through the `title` tooltip
 * unless the caller passes its own.
 */
export function CryptoId({
  value,
  head,
  tail,
  size = "xs",
  prefix,
  className = "",
  title,
  ...rest
}: CryptoIdProps) {
  const shown =
    head !== undefined && tail !== undefined ? truncateMiddle(value, head, tail) : value;

  return (
    <span
      {...rest}
      data-crypto-id=""
      title={title ?? (shown !== value ? value : undefined)}
      className={`${CRYPTO_ID_CLASS} ${SIZE_CLASS[size]} ${className}`.trim()}
    >
      {prefix}
      {shown}
    </span>
  );
}
