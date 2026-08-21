import { HTMLAttributes } from 'react';
import clsx from 'clsx';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('bg-white border border-gray-200 rounded-xl p-4', className)} {...props} />;
}
