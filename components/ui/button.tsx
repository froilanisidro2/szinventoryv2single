'use client';

import React, { ButtonHTMLAttributes } from 'react';
import Link from 'next/link';
import clsx from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
  href?: string;
}

const buttonClasses = (
  variant: 'primary' | 'secondary' | 'danger' | 'ghost' = 'primary',
  size: 'sm' | 'md' | 'lg' = 'md',
  className?: string,
) => clsx(
  'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    primary:   'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-200',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-200',
    danger:    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-200',
    ghost:     'text-gray-700 hover:bg-gray-100 focus:ring-gray-200',
  }[variant],
  {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-base gap-2',
    lg: 'px-6 py-3 text-lg gap-2',
  }[size],
  className,
);

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    disabled,
    icon,
    children,
    href,
    ...props
  }, ref) => {
    const content = (
      <>
        {isLoading ? <span className="animate-spin">⟳</span> : icon ?? null}
        {children}
      </>
    );

    // When href is provided render as a Next.js Link so we never nest <button> inside <a>
    if (href) {
      return (
        <Link href={href} className={buttonClasses(variant, size, className)}>
          {content}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={buttonClasses(variant, size, className)}
        {...props}
      >
        {content}
      </button>
    );
  }
);
Button.displayName = 'Button';
