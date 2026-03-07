"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export type EditableFieldType = "text" | "number" | "date" | "select";

export interface EditableFieldSelectOption {
  value: string;
  label: string;
}

export interface EditableFieldProps {
  value: string | number;
  onChange: (value: string) => void;
  className?: string;
  multiline?: boolean;
  type?: EditableFieldType;
  options?: EditableFieldSelectOption[];
  dataEditable?: boolean;
}

export function EditableField({
  value,
  onChange,
  className,
  multiline = false,
  type = "text",
  options = [],
  dataEditable = true,
}: EditableFieldProps) {
  const strValue = String(value ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(strValue);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  useEffect(() => {
    setEditValue(strValue);
  }, [strValue]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (type !== "select") (inputRef.current as HTMLInputElement).select?.();
    }
  }, [isEditing, type]);

  const handleBlur = () => {
    setIsEditing(false);
    const trimmed = type === "number" ? editValue : editValue.trim();
    if (trimmed !== strValue) {
      onChange(trimmed);
    } else {
      setEditValue(strValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      handleBlur();
    }
    if (e.key === "Escape") {
      setEditValue(strValue);
      setIsEditing(false);
      (inputRef.current as HTMLInputElement | HTMLSelectElement | null)?.blur();
    }
  };

  const inputCn = cn(
    "rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring",
    className
  );

  if (isEditing) {
    if (type === "select" && options.length > 0) {
      return (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={strValue}
          onChange={(e) => {
            onChange(e.target.value);
            setIsEditing(false);
          }}
          onBlur={handleBlur}
          className={inputCn}
          data-editable={dataEditable ? "true" : undefined}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    if (multiline) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={cn("w-full min-h-[60px]", inputCn)}
          rows={3}
          data-editable={dataEditable ? "true" : undefined}
        />
      );
    }
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={type === "number" ? "number" : type === "date" ? "date" : "text"}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={inputCn}
        data-editable={dataEditable ? "true" : undefined}
        step={type === "number" ? "0.01" : undefined}
      />
    );
  }

  const displayValue = type === "select" && options.length > 0
    ? options.find((o) => o.value === strValue)?.label ?? strValue
    : strValue;

  return (
    <span
      onClick={() => setIsEditing(true)}
      className={cn(
        "cursor-pointer rounded hover:bg-yellow-50 hover:outline hover:outline-1 hover:outline-yellow-300",
        displayValue ? "" : "text-muted-foreground italic",
        className
      )}
      data-editable={dataEditable ? "true" : undefined}
    >
      {displayValue || "—"}
    </span>
  );
}

export interface EditableDateFieldProps {
  value: string; // YYYY-MM-DD
  onChange: (v: string) => void;
  displayValue: string; // DD.MM.YYYY for display
}

export function EditableDateField({ value, onChange, displayValue }: EditableDateFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (value) onChange(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleBlur();
    }
    if (e.key === "Escape") {
      setIsEditing(false);
      inputRef.current?.blur();
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
    );
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      className="cursor-pointer rounded hover:bg-yellow-50 hover:outline hover:outline-1 hover:outline-yellow-300"
    >
      {displayValue || "—"}
    </span>
  );
}
