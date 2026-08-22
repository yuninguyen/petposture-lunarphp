// Category name translations mapping
// Backend returns Vietnamese category names, we map them to other languages here
export const categoryTranslations: Record<string, Record<string, string>> = {
  vi: {
    'Sức khỏe': 'Sức khỏe',
    'Dinh dưỡng': 'Dinh dưỡng',
    'Huấn luyện': 'Huấn luyện',
    'Chăm sóc': 'Chăm sóc',
  },
  en: {
    'Sức khỏe': 'Health',
    'Dinh dưỡng': 'Nutrition',
    'Huấn luyện': 'Training',
    'Chăm sóc': 'Care',
  },
};

export function translateCategoryName(vietnameseName: string, language: string): string {
  const translations = categoryTranslations[language];
  if (!translations) return vietnameseName;
  return translations[vietnameseName] || vietnameseName;
}
