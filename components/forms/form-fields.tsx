'use client';

interface FormInputProps {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  step?: string;
}

export function FormInput({
  label,
  name,
  type = 'text',
  placeholder,
  required,
  value,
  onChange,
  error,
  step,
}: FormInputProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={onChange}
        step={step}
        className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:ring-primary-900"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

interface FormSelectProps {
  label: string;
  name: string;
  options: Array<{ value: string | number; label: string }>;
  required?: boolean;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  error?: string;
}

export function FormSelect({
  label,
  name,
  options,
  required,
  value,
  onChange,
  error,
}: FormSelectProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        value={value}
        onChange={onChange}
        className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:ring-primary-900"
      >
        <option value="">Select an option</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

interface FormTextareaProps {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  error?: string;
  rows?: number;
}

export function FormTextarea({
  label,
  name,
  placeholder,
  required,
  value,
  onChange,
  error,
  rows = 4,
}: FormTextareaProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <textarea
        id={name}
        name={name}
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={onChange}
        rows={rows}
        className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:ring-primary-900"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
