'use client';

import React, { InputHTMLAttributes, useId } from 'react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className, 
    label, 
    error,
    icon,
    helperText,
    type = 'text',
    id,
    ...props 
  }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            className={clsx(
              'w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-all',
              icon ? 'pl-10' : '',
              error
                ? 'border-red-500 focus:ring-red-200 focus:border-red-500'
                : 'border-gray-300 focus:ring-primary-200 focus:border-primary-500',
              'dark:bg-gray-800 dark:border-gray-600 dark:text-white',
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{helperText}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
