import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';

interface FieldWrapProps {
  label?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  required?: boolean;
}

export function Field({ label, error, hint, children, required }: FieldWrapProps) {
  return (
    <div className="field">
      {label && (
        <label className="field-label">
          {label} {required && <span style={{ color: 'var(--color-red-text)' }}>*</span>}
        </label>
      )}
      {children}
      {error && <span className="field-error">{error}</span>}
      {!error && hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
}

export function Input({ label, error, hint, icon, className = '', ...rest }: InputProps) {
  const input = (
    <input className={`input ${error ? 'has-error' : ''} ${className}`} {...rest} />
  );
  return (
    <Field label={label} error={error} hint={hint}>
      {icon ? (
        <div className="input-with-icon">
          {icon}
          {input}
        </div>
      ) : (
        input
      )}
    </Field>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, className = '', ...rest }: TextareaProps) {
  return (
    <Field label={label} error={error} hint={hint}>
      <textarea className={`textarea ${error ? 'has-error' : ''} ${className}`} {...rest} />
    </Field>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function Select({ label, error, hint, children, className = '', ...rest }: SelectProps) {
  return (
    <Field label={label} error={error} hint={hint}>
      <select className={`select ${error ? 'has-error' : ''} ${className}`} {...rest}>
        {children}
      </select>
    </Field>
  );
}
