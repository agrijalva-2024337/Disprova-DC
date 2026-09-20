const defaultLocale = 'es-GT';
const defaultCurrency = 'GTQ';

export function formatMoney(
  amount: number,
  options?: { locale?: string; currency?: string },
): string {
  const locale = options?.locale ?? defaultLocale;
  const currency = options?.currency ?? defaultCurrency;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}
