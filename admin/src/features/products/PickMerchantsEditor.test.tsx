import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ form: { current: null as any }, networks: [] as any[], isError: false }));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key) }) }));
vi.mock('@/features/affiliate-networks/api', () => ({ useMerchantOptions: () => ({ data: mocks.networks, isError: mocks.isError }) }));

import { MAX_OTHER_MERCHANTS, PickMerchantsEditor } from './PickMerchantsEditor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CHEWY = { id: 3, name: 'Chewy', slug: 'chewy', logo: 'https://cdn.example.test/chewy.png' };
const PETSMART = { id: 4, name: 'PetSmart', slug: 'petsmart', logo: null };
const AMAZON = { id: 5, name: 'Amazon', slug: 'amazon', logo: 'https://cdn.example.test/amazon.svg' };
const row = (extra: object = {}) => ({ id: null, affiliate_network_id: null, url: '', price: '', price_checked_date: '', ...extra });

function Harness({ merchants = [], slug = 'chewy', errors = {} }: { merchants?: object[]; slug?: string; errors?: object }) {
  const form = useForm({ defaultValues: { attributes: { affiliate_network_slug: slug, external_url: 'https://www.chewy.com/x', reference_price: '49.96', price_checked_date: '2026-11-14' }, merchants } });
  mocks.form.current = form;

  return createElement(PickMerchantsEditor, { control: form.control as any, register: form.register as any, setValue: form.setValue as any, errors });
}

let host: HTMLDivElement;
let root: Root;
const mount = (props: object = {}) => act(() => root.render(createElement(Harness, props)));
const extras = () => Array.from(host.querySelectorAll('[data-testid="merchant-extra"]')) as HTMLElement[];
const main = () => host.querySelector('[data-testid="merchant-main"]') as HTMLElement;
const button = (label: string, scope: ParentNode = host) => Array.from(scope.querySelectorAll('button')).find((el) => el.textContent?.includes(label) || el.getAttribute('aria-label') === label)! as HTMLButtonElement;
const choose = (select: HTMLSelectElement, value: string) => act(() => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); });
const type = (input: HTMLInputElement, value: string) => act(() => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
const values = () => mocks.form.current.getValues();
const optionLabels = (select: HTMLSelectElement) => Array.from(select.options).map((option) => option.textContent);
const disabled = (select: HTMLSelectElement) => Array.from(select.options).filter((option) => option.disabled).map((option) => option.textContent);

beforeEach(() => {
  mocks.networks = [CHEWY, PETSMART, AMAZON];
  mocks.isError = false;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('PickMerchantsEditor', () => {
  it('shows the main store with its merchant chosen from the list, its link, price and checked date', () => {
    mount();

    const select = main().querySelector('select')!;
    expect(select.value).toBe('chewy');
    expect(optionLabels(select)).toEqual(['products.merchants.choose', 'Chewy', 'PetSmart', 'Amazon']);
    expect((main().querySelector('input[type="url"]') as HTMLInputElement).value).toBe('https://www.chewy.com/x');
    expect((main().querySelector('input[type="date"]') as HTMLInputElement).value).toBe('2026-11-14');
    expect((main().querySelector('input[inputmode="decimal"]') as HTMLInputElement).value).toBe('49.96');
  });

  it('shows the logo chosen for a merchant, and a dash when it has none', () => {
    mount({ merchants: [row({ affiliate_network_id: 4 }), row({ affiliate_network_id: 5 })] });

    expect(main().querySelector('img')?.getAttribute('src')).toBe('https://cdn.example.test/chewy.png');
    const [petsmart, amazon] = extras();
    expect(petsmart.querySelector('img')).toBeNull();
    expect(amazon.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example.test/amazon.svg');
  });

  it('keeps the main store in the first four attributes when another merchant is chosen', () => {
    mount();

    choose(main().querySelector('select')!, 'amazon');

    expect(values().attributes.affiliate_network_slug).toBe('amazon');
  });

  it('names a slug that is not in the list instead of hiding it', () => {
    mount({ slug: 'not-a-network' });

    const select = main().querySelector('select')!;
    expect(select.value).toBe('not-a-network');
    expect(optionLabels(select)).toContain('products.merchants.unknown {"slug":"not-a-network"}');
  });

  it('adds a store to the list, and the merchant, link, price and date are saved as typed', () => {
    mount();
    expect(extras()).toHaveLength(0);

    act(() => button('products.merchants.add').click());
    expect(extras()).toHaveLength(1);

    const [store] = extras();
    choose(store.querySelector('select')!, '4');
    type(store.querySelector('input[type="url"]')!, 'https://www.petsmart.com/dog/x.html');
    type(store.querySelector('input[inputmode="decimal"]')!, '40.99');
    type(store.querySelector('input[type="date"]')!, '2026-11-21');

    expect(values().merchants).toEqual([{ id: null, affiliate_network_id: 4, url: 'https://www.petsmart.com/dog/x.html', price: '40.99', price_checked_date: '2026-11-21' }]);
  });

  it('does not offer a merchant that is already on the list, in the main store or in another row', () => {
    mount({ merchants: [row({ affiliate_network_id: 4 }), row()] });

    const [first, second] = extras();
    // Chewy is the main store and PetSmart is the first row, so the second row can take only Amazon
    expect(disabled(second.querySelector('select')!)).toEqual(['Chewy', 'PetSmart']);
    // a row keeps its own choice selectable
    expect(disabled(first.querySelector('select')!)).toEqual(['Chewy']);
    // and the main store cannot take PetSmart
    expect(disabled(main().querySelector('select')!)).toEqual(['PetSmart']);
  });

  it('removes a row and moves one up and down', () => {
    mount({ merchants: [row({ id: 11, affiliate_network_id: 4, url: 'https://a.example/1' }), row({ id: 12, affiliate_network_id: 5, url: 'https://a.example/2' })] });

    act(() => button('products.merchants.move_down', extras()[0]).click());
    expect(values().merchants.map((entry: { id: number }) => entry.id)).toEqual([12, 11]);

    act(() => button('products.merchants.move_up', extras()[1]).click());
    expect(values().merchants.map((entry: { id: number }) => entry.id)).toEqual([11, 12]);

    act(() => button('products.merchants.remove', extras()[0]).click());
    expect(values().merchants.map((entry: { id: number }) => entry.id)).toEqual([12]);
    expect(extras()).toHaveLength(1);
  });

  it('cannot move the first row up or the last row down', () => {
    mount({ merchants: [row({ affiliate_network_id: 4 }), row({ affiliate_network_id: 5 })] });

    expect(button('products.merchants.move_up', extras()[0]).disabled).toBe(true);
    expect(button('products.merchants.move_down', extras()[1]).disabled).toBe(true);
    expect(button('products.merchants.move_down', extras()[0]).disabled).toBe(false);
  });

  it('stops offering to add a store at the limit', () => {
    mount({ merchants: Array.from({ length: MAX_OTHER_MERCHANTS }, () => row()) });

    expect(button('products.merchants.add').disabled).toBe(true);
  });

  it('shows what the server or the form says is wrong, next to the field', () => {
    mount({
      merchants: [row({ affiliate_network_id: 4, url: 'javascript:alert(1)' })],
      errors: { attributes: { external_url: { message: 'A Pick needs its retailer link' } }, merchants: [{ url: { message: 'The store link must start with http://' }, price: { message: 'The price must be a number' } }] },
    });

    expect(main().textContent).toContain('A Pick needs its retailer link');
    expect(extras()[0].textContent).toContain('The store link must start with http://');
    expect(extras()[0].textContent).toContain('The price must be a number');
  });

  it('says so when the list of merchants could not be loaded', () => {
    mocks.isError = true;
    mocks.networks = [];
    mount();

    expect(host.textContent).toContain('products.merchants.load_failed');
  });
});
