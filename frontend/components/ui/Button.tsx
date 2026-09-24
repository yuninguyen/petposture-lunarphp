import Link, { type LinkProps } from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "dark";
export type ButtonSize = "md" | "lg" | "icon";

type ButtonClassOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-secondary text-ink hover:bg-secondary-dark",
  secondary:
    "border border-primary bg-white text-primary hover:bg-primary hover:text-white",
  quiet: "bg-transparent text-primary hover:bg-zinc-100",
  dark: "bg-primary text-white hover:bg-[#2c363e]",
};

const sizeClasses: Record<ButtonSize, string> = {
  md: "h-12 rounded-md px-6 text-sm",
  lg: "h-14 rounded-md px-6 text-[15px]",
  icon: "h-11 w-11 rounded-md p-0",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: ButtonClassOptions = {}) {
  return [
    "inline-flex items-center justify-center whitespace-nowrap font-bold uppercase tracking-[0.08em] transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonClassOptions;

export function Button({
  type = "button",
  variant,
  size,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      {...props}
    />
  );
}

type ButtonLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps | "className"> &
  ButtonClassOptions & { children: ReactNode };

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      {...props}
      className={buttonClasses({ variant, size, className })}
    />
  );
}
