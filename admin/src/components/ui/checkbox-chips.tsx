import clsx from 'clsx';

interface CheckboxChipsProps {
  options: { id: string; name: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}

export function CheckboxChips({ options, value, onChange }: CheckboxChipsProps) {
  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const selected = value.includes(option.id);
        return (
          <button
            type="button"
            key={option.id}
            onClick={() => toggle(option.id)}
            className={clsx(
              'rounded-full px-3 py-1 text-xs font-semibold border transition-colors',
              selected
                ? 'bg-primary border-primary text-white'
                : 'bg-white border-gray-300 text-gray-600 hover:border-primary hover:text-primary'
            )}
          >
            {option.name}
          </button>
        );
      })}
    </div>
  );
}
