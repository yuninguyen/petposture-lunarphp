import type { ReactNode } from 'react';
import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { ProductDescriptionEditor } from './ProductDescriptionEditor';
import type { AttributeDefinition } from './api';

export function DynamicAttributeFields({ definitions, register, control, errors = {}, prefix = 'attributes', disabled = false, afterHandle = {} }: { definitions: AttributeDefinition[]; register: UseFormRegister<any>; control: Control<any>; errors?: FieldErrors; prefix?: string; disabled?: boolean; afterHandle?: Record<string, ReactNode> }) {
  return <div className="space-y-5">{definitions.map((definition) => {
    const errorFor = (locale?: string) => locale
      ? (errors as any)?.[definition.handle]?.[locale]?.message
      : (errors as any)?.[definition.handle]?.message;
    const isDescription = definition.handle === 'description';
    return <div key={definition.handle}>
      <label className="mb-1 block text-sm font-medium text-slate-700">{definition.label}{definition.required && <span className="ml-1 text-red-500">*</span>}</label>
      {definition.type === 'translated_text' ? <div className="grid gap-3 sm:grid-cols-2">
        {(['en', 'vi'] as const).map((locale) => <div key={locale}><div className="mb-1 text-xs font-semibold uppercase text-slate-400">{locale}</div>{isDescription ? <Controller control={control} name={`${prefix}.${definition.handle}.${locale}`} render={({ field }) => <ProductDescriptionEditor value={field.value ?? ''} onChange={field.onChange} disabled={disabled}/>}/> : <Input disabled={disabled} {...register(`${prefix}.${definition.handle}.${locale}` as any)} />}{errorFor(locale) && <p className="mt-1 text-xs text-red-600">{String(errorFor(locale))}</p>}</div>)}
      </div> : <>{isDescription ? <Controller control={control} name={`${prefix}.${definition.handle}`} render={({ field }) => <ProductDescriptionEditor value={field.value ?? ''} onChange={field.onChange} disabled={disabled}/>}/> : <Input disabled={disabled} {...register(`${prefix}.${definition.handle}` as any)} />}{errorFor() && <p className="mt-1 text-xs text-red-600">{String(errorFor())}</p>}</>}
      {afterHandle[definition.handle]}
    </div>;
  })}</div>;
}
