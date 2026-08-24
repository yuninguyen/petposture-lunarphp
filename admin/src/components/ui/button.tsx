import { ButtonHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => (
    <button
      ref={ref}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'primary'
          ? 'bg-secondary border-secondary text-white hover:bg-secondary-dark'
          : variant === 'danger'
          ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
          : 'bg-white border-gray-300 text-primary hover:bg-gray-50',
        className
      )}
      {...props}
    />
  )
);
Button.displayName = 'Button';
