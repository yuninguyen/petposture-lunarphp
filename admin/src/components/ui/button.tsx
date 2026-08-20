import { ButtonHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

type ButtonVariant = 'primary' | 'secondary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', ...props }, ref) => (
    <button
      ref={ref}
      className={clsx(
        'px-4 py-2 rounded-lg text-sm font-semibold border transition-colors',
        variant === 'secondary'
          ? 'bg-secondary border-secondary text-white hover:bg-secondary-dark'
          : 'bg-white border-gray-300 text-primary hover:bg-gray-50',
        className
      )}
      {...props}
    />
  )
);
Button.displayName = 'Button';
