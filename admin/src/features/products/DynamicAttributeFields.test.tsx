import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { DynamicAttributeFields } from './DynamicAttributeFields';
import type { AttributeDefinition } from './api';

const definition = (handle: string, label: string): AttributeDefinition => ({
  handle,
  label,
  type: 'text',
  section: null,
  system: false,
  required: false,
  value: '',
});

function Harness({ definitions, defaults }: { definitions: AttributeDefinition[]; defaults: Record<string, string> }) {
  const { register, control } = useForm({ defaultValues: { attributes: defaults } });

  return <DynamicAttributeFields definitions={definitions} register={register as any} control={control as any} />;
}

// The field's label is not linked to its control, so find the control inside the label's wrapper.
function controlFor(label: string): HTMLInputElement | HTMLTextAreaElement | null {
  return screen.getByText(label).parentElement!.querySelector('input, textarea');
}

describe('DynamicAttributeFields', () => {
  it('renders pros and cons as multi-line text areas so each item can sit on its own line', () => {
    render(
      <Harness
        definitions={[definition('pros', 'Pros'), definition('cons', 'Cons')]}
        defaults={{ pros: 'Raised design\nEasy to clean', cons: 'Holds about one cup' }}
      />,
    );

    expect(controlFor('Pros')).toBeInstanceOf(HTMLTextAreaElement);
    expect(controlFor('Cons')).toBeInstanceOf(HTMLTextAreaElement);
    expect(controlFor('Pros')!.value).toBe('Raised design\nEasy to clean');
    expect(controlFor('Cons')!.value).toBe('Holds about one cup');
  });

  it('keeps the other text fields as single-line inputs', () => {
    render(
      <Harness
        definitions={[definition('external_url', 'Retailer URL'), definition('breed_tags', 'Breed Tags')]}
        defaults={{ external_url: 'https://www.chewy.com/p/1', breed_tags: 'pug' }}
      />,
    );

    expect(controlFor('Retailer URL')).toBeInstanceOf(HTMLInputElement);
    expect(controlFor('Breed Tags')).toBeInstanceOf(HTMLInputElement);
    expect(document.querySelectorAll('textarea')).toHaveLength(0);
  });

  it('lets a person type several lines into pros', () => {
    render(<Harness definitions={[definition('pros', 'Pros')]} defaults={{ pros: '' }} />);

    const pros = controlFor('Pros')!;
    fireEvent.change(pros, { target: { value: 'One\nTwo\nThree' } });

    expect(pros.value).toBe('One\nTwo\nThree');
  });
});
