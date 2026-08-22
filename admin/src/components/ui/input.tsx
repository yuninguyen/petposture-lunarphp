import { InputHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={clsx(
        'w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-ink',
        'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';
