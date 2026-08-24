import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import type { AttributeDefinition } from './api';

export function DynamicAttributeFields({ definitions, register, errors = {}, prefix = 'attributes', disabled = false }: { definitions: AttributeDefinition[]; register: UseFormRegister<any>; errors?: FieldErrors; prefix?: string; disabled?: boolean }) {
  return <div className="space-y-5">{definitions.map((definition) => {
    const errorFor = (locale?: string) => locale
      ? (errors as any)?.[definition.handle]?.[locale]?.message
      : (errors as any)?.[definition.handle]?.message;
    return <div key={definition.handle}>
      <label className="mb-1 block text-sm font-medium text-slate-700">{definition.label}{definition.required && <span className="ml-1 text-red-500">*</span>}</label>
      {definition.type === 'translated_text' ? <div className="grid gap-3 sm:grid-cols-2">
        {(['en', 'vi'] as const).map((locale) => <div key={locale}><div className="mb-1 text-xs font-semibold uppercase text-slate-400">{locale}</div><Input disabled={disabled} {...register(`${prefix}.${definition.handle}.${locale}` as any)} />{errorFor(locale) && <p className="mt-1 text-xs text-red-600">{String(errorFor(locale))}</p>}</div>)}
      </div> : <><Input disabled={disabled} {...register(`${prefix}.${definition.handle}` as any)} />{errorFor() && <p className="mt-1 text-xs text-red-600">{String(errorFor())}</p>}</>}
    </div>;
  })}</div>;
}
