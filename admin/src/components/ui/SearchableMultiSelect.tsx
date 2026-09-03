import { useState, useMemo } from 'react';
import { Input } from './input';

interface SearchableMultiSelectProps {
  options: { id: number; label: string }[];
  value: number[];
  onChange: (value: number[]) => void;
  placeholder?: string;
  noResultsText?: string;
  selectedCountText?: (count: number) => string;
  clearAllText?: string;
}

export function SearchableMultiSelect({ options, value = [], onChange, placeholder = 'Search...', noResultsText = 'No results found.', selectedCountText = (count) => `${count} selected`, clearAllText = 'Clear all' }: SearchableMultiSelectProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const lower = searchTerm.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(lower));
  }, [options, searchTerm]);

  const toggleOption = (id: number) => {
    if (value.includes(id)) {
      onChange(value.filter(v => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white flex flex-col focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-colors h-64">
      <div className="p-2 border-b border-gray-100 bg-slate-50">
        <Input 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={placeholder}
          className="h-8 text-sm"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filteredOptions.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">{noResultsText}</p>
        ) : (
          filteredOptions.map(option => {
            const isSelected = value.includes(option.id);
            return (
              <label 
                key={option.id}
                className={`flex items-start gap-2.5 p-2 rounded-md cursor-pointer transition-colors text-sm select-none ${
                  isSelected ? 'bg-primary/5 text-primary font-medium' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input 
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleOption(option.id)}
                  className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary/20 cursor-pointer"
                />
                <span className="flex-1 leading-tight">{option.label}</span>
              </label>
            );
          })
        )}
      </div>
      <div className="p-2 border-t border-gray-100 bg-slate-50 text-xs text-slate-500 flex justify-between items-center">
        <span className="font-medium text-slate-600">{selectedCountText(value.length)}</span>
        {value.length > 0 && (
          <button 
            type="button" 
            onClick={() => onChange([])}
            className="text-red-500 hover:text-red-600 font-medium hover:underline"
          >
            {clearAllText}
          </button>
        )}
      </div>
    </div>
  );
}
