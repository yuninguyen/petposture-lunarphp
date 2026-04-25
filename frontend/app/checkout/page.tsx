"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
    CheckCircle,
    ChevronLeft,
    CreditCard,
    Lock,
    Mail,
    MapPinHouse,
    Search,
    ShieldCheck,
    ShoppingBag,
    Tag,
    Truck
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { getApiBaseUrl } from '@/lib/api';
import { getShippingAmount } from '@/lib/pricing';

declare global {
    interface Window {
        Stripe?: (publishableKey: string) => {
            elements: () => {
                create: (
                    type: 'card',
                    options?: Record<string, unknown>
                ) => {
                    mount: (element: string | HTMLElement) => void;
                    unmount: () => void;
                    destroy: () => void;
                };
            };
            confirmCardPayment: (
                clientSecret: string,
                data: Record<string, unknown>
            ) => Promise<{
                error?: { message?: string };
                paymentIntent?: { status?: string };
            }>;
        };
        google?: {
            maps?: {
                places?: {
                    AutocompleteService: new () => {
                        getPlacePredictions: (
                            request: Record<string, unknown>,
                            callback: (predictions: Array<Record<string, unknown>> | null, status: string) => void
                        ) => void;
                    };
                    PlacesService: new (container: HTMLDivElement) => {
                        getDetails: (
                            request: Record<string, unknown>,
                            callback: (place: Record<string, unknown> | null, status: string) => void
                        ) => void;
                    };
                    PlacesServiceStatus: {
                        OK: string;
                    };
                };
            };
        };
        __petpostureGoogleMapsInit?: () => void;
    }
}

type CheckoutFormState = {
    email: string;
    country: string;
    firstName: string;
    lastName: string;
    company: string;
    address1: string;
    address2: string;
    city: string;
    province: string;
    postalCode: string;
    phone: string;
    saveInfo: boolean;
    shippingMethod: 'standard' | 'express';
    paymentMethod: 'cod' | 'card' | 'paypal';
    cardNumber: string;
    cardName: string;
    expiry: string;
    securityCode: string;
    billingAddress: 'same' | 'different';
    billingCountry: string;
    billingFirstName: string;
    billingLastName: string;
    billingAddress1: string;
    billingAddress2: string;
    billingCity: string;
    billingProvince: string;
    billingPostalCode: string;
};

const countryOptions = ['United States'];
const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const googleMapsScriptId = 'petposture-google-places';
const stripeJsScriptId = 'petposture-stripe-js';
const paymentMethodOrder = { card: 0, paypal: 1, cod: 2 } as const;

type AddressTarget = 'shipping' | 'billing';
type AddressSuggestion = {
    placeId: string;
    mainText: string;
    secondaryText: string;
    description: string;
    target: AddressTarget;
};

type PaymentMethod = 'cod' | 'card' | 'paypal';

type PaymentMethodOption = {
    method: PaymentMethod;
    label: string;
    gateway: string;
    collection: string;
    description?: string;
    enabled: boolean;
    mode?: string;
    brands?: string[];
    publishable_key?: string | null;
};

type PreparedPaymentIntent = {
    intent_id: string;
    client_secret: string;
    amount: number;
    currency: string;
    status: string;
    mode: string;
    gateway: string;
    publishable_key?: string | null;
};

type TaxQuote = {
    state_code?: string | null;
    state_rate_percentage: number;
    avg_local_rate_percentage: number;
    rate_percentage: number;
    tax_amount: number;
    provider: string;
    is_estimate: boolean;
    source_label?: string | null;
    source_url?: string | null;
    effective_date?: string | null;
};

type CheckoutAddressPayload = {
    firstName: string;
    lastName: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
    phone?: string;
};

function buildAddressPayload(fields: CheckoutAddressPayload) {
    return {
        first_name: fields.firstName.trim(),
        last_name: fields.lastName.trim(),
        company: fields.company?.trim() || null,
        line_one: fields.address1.trim(),
        line_two: fields.address2?.trim() || null,
        city: fields.city.trim(),
        state: fields.province.trim(),
        postcode: fields.postalCode.trim(),
        country: fields.country.trim(),
        phone: fields.phone?.trim() || null,
    };
}

function normalizeCountryCode(country: string) {
    if (country === 'United States') {
        return 'us';
    }

    if (country === 'Canada') {
        return 'ca';
    }

    if (country === 'Australia') {
        return 'au';
    }

    return country.trim().slice(0, 2).toLowerCase();
}

function getAddressComponent(
    components: Array<Record<string, unknown>>,
    type: string,
    format: 'long_name' | 'short_name' = 'long_name'
) {
    const component = components.find((item) => Array.isArray(item.types) && item.types.includes(type));
    const value = component?.[format];

    return typeof value === 'string' ? value : '';
}

function parsePlaceAddress(place: Record<string, unknown>) {
    const components = Array.isArray(place.address_components)
        ? (place.address_components as Array<Record<string, unknown>>)
        : [];

    const streetNumber = getAddressComponent(components, 'street_number');
    const route = getAddressComponent(components, 'route');
    const subpremise = getAddressComponent(components, 'subpremise');
    const city =
        getAddressComponent(components, 'locality') ||
        getAddressComponent(components, 'postal_town') ||
        getAddressComponent(components, 'sublocality_level_1');

    return {
        lineOne: [streetNumber, route].filter(Boolean).join(' ').trim(),
        lineTwo: subpremise,
        city,
        state: getAddressComponent(components, 'administrative_area_level_1', 'short_name'),
        postcode: getAddressComponent(components, 'postal_code'),
        country: getAddressComponent(components, 'country'),
    };
}

export default function CheckoutPage() {
    const router = useRouter();
    const { items, totalAmount, coupon, setCoupon, clearCoupon } = useCart();
    const { user, token } = useAuth();
    const [couponCode, setCouponCode] = useState(coupon.code);
    const [isLoading, setIsLoading] = useState(false);
    const [successRef] = useState<string | null>(null);
    const [activeStep, setActiveStep] = useState<'information' | 'shipping' | 'payment'>('information');
    const informationSectionRef = useRef<HTMLElement | null>(null);
    const shippingSectionRef = useRef<HTMLElement | null>(null);
    const paymentSectionRef = useRef<HTMLElement | null>(null);
    const placesContainerRef = useRef<HTMLDivElement | null>(null);
    const stripeCardMountRef = useRef<HTMLDivElement | null>(null);
    const stripeInstanceRef = useRef<ReturnType<NonNullable<typeof window.Stripe>> | null>(null);
    const stripeElementsRef = useRef<ReturnType<ReturnType<NonNullable<typeof window.Stripe>>['elements']> | null>(null);
    const stripeCardElementRef = useRef<ReturnType<ReturnType<ReturnType<NonNullable<typeof window.Stripe>>['elements']>['create']> | null>(null);
    const autocompleteServiceRef = useRef<{
        getPlacePredictions: (
            request: Record<string, unknown>,
            callback: (predictions: Array<Record<string, unknown>> | null, status: string) => void
        ) => void;
    } | null>(null);
    const placesServiceRef = useRef<{
        getDetails: (
            request: Record<string, unknown>,
            callback: (place: Record<string, unknown> | null, status: string) => void
        ) => void;
    } | null>(null);
    const [placesReady, setPlacesReady] = useState(false);
    const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
    const [activeAddressTarget, setActiveAddressTarget] = useState<AddressTarget | null>(null);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);
    const [preparedPaymentIntent, setPreparedPaymentIntent] = useState<PreparedPaymentIntent | null>(null);
    const [paymentIntentMessage, setPaymentIntentMessage] = useState<string | null>(null);
    const [taxQuote, setTaxQuote] = useState<TaxQuote | null>(null);
    const [stripeReady, setStripeReady] = useState(false);
    const [stripeError, setStripeError] = useState<string | null>(null);
    const [form, setForm] = useState<CheckoutFormState>({
        email: user?.email || 'guest@petposture.com',
        country: 'United States',
        firstName: '',
        lastName: '',
        company: '',
        address1: '',
        address2: '',
        city: '',
        province: '',
        postalCode: '',
        phone: '',
        saveInfo: true,
        shippingMethod: 'standard',
        paymentMethod: 'cod',
        cardNumber: '',
        cardName: '',
        expiry: '',
        securityCode: '',
        billingAddress: 'same',
        billingCountry: 'United States',
        billingFirstName: '',
        billingLastName: '',
        billingAddress1: '',
        billingAddress2: '',
        billingCity: '',
        billingProvince: '',
        billingPostalCode: '',
    });
    const selectedCardMethod = paymentMethods.find((method) => method.method === 'card') ?? {
        method: 'card' as const,
        label: 'Credit card',
        gateway: 'stripe',
        collection: 'direct',
        enabled: true,
        mode: 'placeholder',
        publishable_key: null,
    };
    const stripeLiveMode = form.paymentMethod === 'card'
        && selectedCardMethod.mode === 'configured'
        && Boolean(selectedCardMethod.publishable_key);

    useEffect(() => {
        setCouponCode(coupon.code);
    }, [coupon.code]);

    useEffect(() => {
        let cancelled = false;

        const loadPaymentMethods = async () => {
            try {
                const apiBase = getApiBaseUrl();
                const response = await fetch(`${apiBase}/api/checkout/payment-methods`);
                const data = await response.json();

                if (!response.ok || !Array.isArray(data?.methods)) {
                    return;
                }

                if (cancelled) {
                    return;
                }

                const methods = data.methods as PaymentMethodOption[];
                setPaymentMethods(methods.filter((method) => method.enabled));

                const selectedStillExists = methods.some((method) => method.method === form.paymentMethod && method.enabled);

                if (!selectedStillExists) {
                    const fallbackMethod = methods.find((method) => method.enabled)?.method ?? 'cod';
                    setForm((prev) => ({ ...prev, paymentMethod: fallbackMethod }));
                }
            } catch {
                setPaymentMethods([]);
            }
        };

        void loadPaymentMethods();

        return () => {
            cancelled = true;
        };
    }, [form.paymentMethod]);

    useEffect(() => {
        setForm((prev) => ({
            ...prev,
            email: user?.email || prev.email || 'guest@petposture.com',
        }));
    }, [user?.email]);

    useEffect(() => {
        if (!googleMapsApiKey || typeof window === 'undefined') {
            return;
        }

        const initialisePlaces = () => {
            if (!window.google?.maps?.places || !placesContainerRef.current) {
                return;
            }

            autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
            placesServiceRef.current = new window.google.maps.places.PlacesService(placesContainerRef.current);
            setPlacesReady(true);
        };

        if (window.google?.maps?.places) {
            initialisePlaces();
            return;
        }

        window.__petpostureGoogleMapsInit = initialisePlaces;

        const existingScript = document.getElementById(googleMapsScriptId) as HTMLScriptElement | null;

        if (existingScript) {
            existingScript.addEventListener('load', initialisePlaces, { once: true });
            return;
        }

        const script = document.createElement('script');
        script.id = googleMapsScriptId;
        script.async = true;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places&callback=__petpostureGoogleMapsInit`;
        document.head.appendChild(script);

        return () => {
            window.__petpostureGoogleMapsInit = undefined;
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || !stripeLiveMode || !selectedCardMethod?.publishable_key) {
            setStripeReady(false);
            setStripeError(null);
            return;
        }

        const initialiseStripe = () => {
            if (!window.Stripe || !selectedCardMethod.publishable_key) {
                setStripeError('Stripe.js could not be loaded.');
                return;
            }

            stripeInstanceRef.current = window.Stripe(selectedCardMethod.publishable_key);
            stripeElementsRef.current = stripeInstanceRef.current.elements();
            setStripeReady(true);
            setStripeError(null);
        };

        if (window.Stripe) {
            initialiseStripe();
            return;
        }

        const existingScript = document.getElementById(stripeJsScriptId) as HTMLScriptElement | null;

        if (existingScript) {
            existingScript.addEventListener('load', initialiseStripe, { once: true });
            return;
        }

        const script = document.createElement('script');
        script.id = stripeJsScriptId;
        script.async = true;
        script.src = 'https://js.stripe.com/v3/';
        script.addEventListener('load', initialiseStripe, { once: true });
        document.head.appendChild(script);
    }, [selectedCardMethod?.publishable_key, stripeLiveMode]);

    useEffect(() => {
        if (!stripeLiveMode || !stripeReady || !stripeElementsRef.current || !stripeCardMountRef.current) {
            return;
        }

        if (stripeCardElementRef.current) {
            return;
        }

        const cardElement = stripeElementsRef.current.create('card', {
            style: {
                base: {
                    color: '#1f2937',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    '::placeholder': {
                        color: '#9ca3af',
                    },
                },
            },
        });

        cardElement.mount(stripeCardMountRef.current);
        stripeCardElementRef.current = cardElement;

        return () => {
            stripeCardElementRef.current?.unmount();
            stripeCardElementRef.current?.destroy();
            stripeCardElementRef.current = null;
        };
    }, [stripeLiveMode, stripeReady]);

    useEffect(() => {
        if (!placesReady || !autocompleteServiceRef.current || !activeAddressTarget) {
            return;
        }

        if (activeAddressTarget === 'billing' && form.billingAddress === 'same') {
            setAddressSuggestions([]);
            return;
        }

        const country = activeAddressTarget === 'shipping' ? form.country : form.billingCountry;
        const addressValue = activeAddressTarget === 'shipping' ? form.address1 : form.billingAddress1;

        if (normalizeCountryCode(country) !== 'us' || addressValue.trim().length < 4) {
            setAddressSuggestions([]);
            return;
        }

        const timeoutId = window.setTimeout(() => {
            autocompleteServiceRef.current?.getPlacePredictions(
                {
                    input: addressValue,
                    componentRestrictions: { country: 'us' },
                    types: ['address'],
                },
                (predictions, status) => {
                    const okStatus = window.google?.maps?.places?.PlacesServiceStatus?.OK;

                    if (!predictions || status !== okStatus) {
                        setAddressSuggestions([]);
                        return;
                    }

                    setAddressSuggestions(
                        predictions.slice(0, 5).map((prediction) => {
                            const formatting = prediction.structured_formatting as Record<string, unknown> | undefined;

                            return {
                                placeId: String(prediction.place_id ?? ''),
                                mainText: String(formatting?.main_text ?? prediction.description ?? ''),
                                secondaryText: String(formatting?.secondary_text ?? ''),
                                description: String(prediction.description ?? ''),
                                target: activeAddressTarget,
                            };
                        }).filter((prediction) => prediction.placeId)
                    );
                }
            );
        }, 220);

        return () => window.clearTimeout(timeoutId);
    }, [activeAddressTarget, form.address1, form.billingAddress, form.billingAddress1, form.billingCountry, form.country, placesReady]);

    useEffect(() => {
        let cancelled = false;

        const loadTaxQuote = async () => {
            try {
                const apiBase = getApiBaseUrl();
                const response = await fetch(`${apiBase}/api/checkout/tax-quote`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        shipping: {
                            state: form.province,
                            country: form.country,
                        },
                        subtotal_amount: totalAmount,
                        discount_amount: coupon.discountAmount,
                    }),
                });

                const data = await response.json();

                if (!response.ok || !data?.quote || cancelled) {
                    return;
                }

                setTaxQuote(data.quote as TaxQuote);
            } catch {
                if (!cancelled) {
                    setTaxQuote(null);
                }
            }
        };

        void loadTaxQuote();

        return () => {
            cancelled = true;
        };
    }, [form.country, form.province, totalAmount, coupon.discountAmount]);

    const taxRate = (taxQuote?.rate_percentage ?? 0) / 100;
    const taxAmount = (taxQuote?.tax_amount ?? 0) / 100;
    const shippingAmount = form.shippingMethod === 'express'
        ? (coupon.freeShipping ? 0 : 25)
        : getShippingAmount(totalAmount, coupon);
    const finalTotal = Math.max(0, totalAmount - coupon.discountAmount + shippingAmount + taxAmount);
    const availablePaymentMethods = (paymentMethods.length
        ? paymentMethods
        : [
            {
                method: 'card',
                label: 'Credit card',
                gateway: 'stripe',
                collection: 'direct',
                description: 'Pay securely with Visa, Mastercard, Amex, and other major cards.',
                enabled: true,
                mode: 'placeholder',
                brands: ['visa', 'mastercard', 'amex'],
            },
            {
                method: 'paypal',
                label: 'PayPal',
                gateway: 'paypal',
                collection: 'redirect',
                description: 'Redirect customers to PayPal for approval before returning to the store.',
                enabled: true,
                mode: 'placeholder',
                brands: ['paypal'],
            },
            {
                method: 'cod',
                label: 'Cash on delivery',
                gateway: 'manual-offline',
                collection: 'offline',
                description: 'Use this only for testing or offline settlement workflows.',
                enabled: true,
                mode: 'manual',
                brands: [],
            },
        ] satisfies PaymentMethodOption[])
        .filter((method) => method.method === 'card' || method.method === 'paypal' || method.method === 'cod')
        .sort((left, right) => paymentMethodOrder[left.method as keyof typeof paymentMethodOrder] - paymentMethodOrder[right.method as keyof typeof paymentMethodOrder]);

    const formatPhoneNumber = (value: string) => {
        const cleaned = value.replace(/\D/g, '');
        if (cleaned.length === 0) return '';
        if (cleaned.length <= 3) return `(${cleaned}`;
        if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    };

    const updateField = <K extends keyof CheckoutFormState>(key: K, value: CheckoutFormState[K]) => {
        if (key === 'phone' && typeof value === 'string') {
            setForm((prev) => ({ ...prev, [key]: formatPhoneNumber(value) }));
            return;
        }
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const activateStep = (step: 'information' | 'shipping' | 'payment') => {
        setActiveStep(step);
    };

    const scrollToStep = (step: 'information' | 'shipping' | 'payment') => {
        const targetMap = {
            information: informationSectionRef.current,
            shipping: shippingSectionRef.current,
            payment: paymentSectionRef.current,
        };

        const target = targetMap[step];
        if (!target) {
            return;
        }

        setActiveStep(step);
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const applySuggestedAddress = (suggestion: AddressSuggestion) => {
        if (!placesServiceRef.current) {
            return;
        }

        placesServiceRef.current.getDetails(
            {
                placeId: suggestion.placeId,
                fields: ['address_components'],
            },
            (place, status) => {
                const okStatus = window.google?.maps?.places?.PlacesServiceStatus?.OK;

                if (!place || status !== okStatus) {
                    return;
                }

                const parsed = parsePlaceAddress(place);

                setForm((prev) => {
                    if (suggestion.target === 'billing') {
                        return {
                            ...prev,
                            billingAddress1: parsed.lineOne || prev.billingAddress1,
                            billingAddress2: prev.billingAddress2 || parsed.lineTwo,
                            billingCity: parsed.city || prev.billingCity,
                            billingProvince: parsed.state || prev.billingProvince,
                            billingPostalCode: parsed.postcode || prev.billingPostalCode,
                            billingCountry: parsed.country || prev.billingCountry,
                        };
                    }

                    return {
                        ...prev,
                        address1: parsed.lineOne || prev.address1,
                        address2: prev.address2 || parsed.lineTwo,
                        city: parsed.city || prev.city,
                        province: parsed.state || prev.province,
                        postalCode: parsed.postcode || prev.postalCode,
                        country: parsed.country || prev.country,
                    };
                });

                setAddressSuggestions([]);
                setActiveAddressTarget(null);
            }
        );
    };

    const renderAddressSuggestions = (target: AddressTarget) => {
        const suggestions = addressSuggestions.filter((suggestion) => suggestion.target === target);

        if (!suggestions.length || activeAddressTarget !== target) {
            return null;
        }

        return (
            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-[12px] border border-[#e5e7eb] bg-white shadow-[0_18px_40px_rgba(17,24,39,0.12)]">
                {suggestions.map((suggestion) => (
                    <button
                        key={suggestion.placeId}
                        type="button"
                        onMouseDown={(event) => {
                            event.preventDefault();
                            applySuggestedAddress(suggestion);
                        }}
                        className="flex w-full items-start gap-3 border-b border-[#f1f1f3] px-4 py-3 text-left transition hover:bg-[#faf7f3] last:border-b-0"
                    >
                        <MapPinHouse size={16} className="mt-0.5 flex-shrink-0 text-[#df8448]" />
                        <div className="min-w-0">
                            <p className="text-[14px] font-medium text-[#333333]">{suggestion.mainText}</p>
                            <p className="text-[12px] leading-5 text-[#707070]">
                                {suggestion.secondaryText || suggestion.description}
                            </p>
                        </div>
                    </button>
                ))}
            </div>
        );
    };

    const renderPaymentBadges = (method: PaymentMethodOption) => {
        if (method.method === 'card') {
            return (
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex h-[24px] w-[38px] items-center justify-center rounded-[3px] bg-white overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="https://cdn.shopifycloud.com/checkout-web/assets/c1/assets/visa.sxIq5Dot.svg"
                            alt="VISA"
                            width="38"
                            height="24"
                            className="h-full w-full object-contain"
                        />
                    </div>
                    <div className="flex h-[24px] w-[38px] items-center justify-center rounded-[3px] bg-white overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="https://cdn.shopifycloud.com/checkout-web/assets/c1/assets/mastercard.1c4_lyMp.svg"
                            alt="MASTERCARD"
                            width="38"
                            height="24"
                            className="h-full w-full object-contain"
                        />
                    </div>
                    <div className="flex h-[24px] w-[38px] items-center justify-center rounded-[3px] bg-white overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="https://cdn.shopifycloud.com/checkout-web/assets/c1/assets/amex.Csr7hRoy.svg"
                            alt="AMEX"
                            width="38"
                            height="24"
                            className="h-full w-full object-contain"
                        />
                    </div>
                    <div className="group relative">
                        <span className="flex h-[16px] w-[28px] cursor-help items-center justify-center rounded-[4px] border border-[#E1E1E1] bg-[#F2F3F5] text-[9px] font-bold text-[#121212] transition hover:bg-[#e8e9eb]">
                            +5
                        </span>
                        <div className="invisible absolute bottom-[calc(100%+8px)] right-0 w-auto min-w-[124px] translate-y-1 rounded-[6px] bg-[#1a1a1a] p-2 opacity-0 shadow-2xl transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 z-[100]">
                            <p className="mb-2 px-1 text-[9px] font-medium text-white opacity-70">Supported cards:</p>
                            <div className="grid grid-cols-2 gap-1.5">
                                <div className="flex h-[24px] w-[38px] items-center justify-center rounded-[3px] bg-white overflow-hidden">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src="https://cdn.shopifycloud.com/checkout-web/assets/c1/assets/discover.C7UbFpNb.svg"
                                        alt="Discover"
                                        className="h-full w-full object-contain"
                                    />
                                </div>
                                <div className="flex h-[24px] w-[38px] items-center justify-center rounded-[3px] bg-white overflow-hidden">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src="https://cdn.shopifycloud.com/checkout-web/assets/c1/assets/diners_club.B9hVEmwz.svg"
                                        alt="Diners Club"
                                        className="h-full w-full object-contain"
                                    />
                                </div>
                                <div className="flex h-[24px] w-[38px] items-center justify-center rounded-[3px] bg-white overflow-hidden">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src="https://cdn.shopifycloud.com/checkout-web/assets/c1/assets/elo.KvOdnY_5.svg"
                                        alt="Elo"
                                        className="h-full w-full object-contain"
                                    />
                                </div>
                                <div className="flex h-[24px] w-[38px] items-center justify-center rounded-[3px] bg-white overflow-hidden">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src="https://cdn.shopifycloud.com/checkout-web/assets/c1/assets/jcb.BgZHqF0u.svg"
                                        alt="JCB"
                                        className="h-full w-full object-contain"
                                    />
                                </div>
                                <div className="flex h-[24px] w-[38px] items-center justify-center rounded-[3px] bg-white overflow-hidden">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src="https://cdn.shopifycloud.com/checkout-web/assets/c1/assets/unionpay.8M-Boq_z.svg"
                                        alt="UnionPay"
                                        className="h-full w-full object-contain"
                                    />
                                </div>
                            </div>
                            <div className="absolute right-3.5 -bottom-1 h-2 w-2 rotate-45 bg-[#1a1a1a]"></div>
                        </div>
                    </div>
                </div>
            );
        }

        if (method.method === 'paypal') {
            return (
                <div className="flex h-[21px] w-[48px] items-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="https://cdn.shopifycloud.com/checkout-web/assets/c1/assets/paypal-logo.Q2f7XzPy.svg"
                        alt="PayPal"
                        className="h-full w-full object-contain"
                    />
                </div>
            );
        }

        return null;
    };

    const paymentRowClasses = (method: PaymentMethod, index: number) =>
        `flex cursor-pointer items-center justify-between px-4 py-[15px] text-[14px] transition ${form.paymentMethod === method ? 'bg-[#f7faff] ring-1 ring-inset ring-[#cfe2f3]' : 'bg-white hover:bg-[#fbfbfc]'} ${index < availablePaymentMethods.length - 1 || form.paymentMethod === method ? 'border-b border-[#d9d9d9]' : ''}`;

    const prepareCardPaymentIntent = async () => {
        const apiBase = getApiBaseUrl();
        const response = await fetch(`${apiBase}/api/checkout/payment-intent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
                payment_method: 'card',
                amount: Math.round(finalTotal * 100),
                currency: 'usd',
                email: form.email,
            }),
        });

        const data = await response.json();

        if (!response.ok || !data?.payment_intent) {
            throw new Error(data?.message || 'Failed to prepare Stripe payment.');
        }

        const intent = data.payment_intent as PreparedPaymentIntent;
        setPreparedPaymentIntent(intent);
        setPaymentIntentMessage(
            intent.mode === 'configured'
                ? 'Stripe payment intent prepared. Live confirmation is the next integration step.'
                : 'Stripe payment intent prepared in placeholder mode. Live Stripe keys are not configured yet.'
        );

        return intent;
    };

    const handleApplyCoupon = async () => {
        if (!couponCode.trim()) return;

        try {
            const apiBase = getApiBaseUrl();
            const res = await fetch(`${apiBase}/api/apply-coupon`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    coupon_code: couponCode.trim(),
                    items: items.map((item) => ({
                        variantId: item.variantId,
                        quantity: item.quantity,
                    })),
                })
            });

            const data = await res.json();

            if (res.ok) {
                setCoupon({
                    code: couponCode.trim(),
                    discountAmount: data.discount_amount ?? 0,
                    message: data.message,
                    isError: false,
                    type: data.coupon?.type ?? null,
                    amount: data.coupon?.amount ?? null,
                    freeShipping: Boolean(data.coupon?.free_shipping),
                });
            } else {
                setCoupon({
                    code: couponCode.trim(),
                    discountAmount: 0,
                    message: data.message || 'Invalid coupon',
                    isError: true,
                    type: null,
                    amount: null,
                    freeShipping: false,
                });
            }
        } catch {
            setCoupon({
                code: couponCode.trim(),
                discountAmount: 0,
                message: 'Error applying coupon',
                isError: true,
                type: null,
                amount: null,
                freeShipping: false,
            });
        }
    };

    const handleCheckout = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setPaymentIntentMessage(null);

        try {
            const shippingAddress = buildAddressPayload({
                firstName: form.firstName,
                lastName: form.lastName,
                company: form.company,
                address1: form.address1,
                address2: form.address2,
                city: form.city,
                province: form.province,
                postalCode: form.postalCode,
                country: form.country,
                phone: form.phone,
            });

            const billingAddress = form.billingAddress === 'same'
                ? shippingAddress
                : buildAddressPayload({
                    firstName: form.billingFirstName,
                    lastName: form.billingLastName,
                    address1: form.billingAddress1,
                    address2: form.billingAddress2,
                    city: form.billingCity,
                    province: form.billingProvince,
                    postalCode: form.billingPostalCode,
                    country: form.billingCountry,
                });

            const apiBase = getApiBaseUrl();
            const paymentContext = form.paymentMethod === 'card'
                ? await prepareCardPaymentIntent()
                : null;
            const res = await fetch(`${apiBase}/api/checkout/place-order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    items: items.map(i => ({ variantId: i.variantId, quantity: i.quantity })),
                    shipping: {
                        email: form.email,
                        ...shippingAddress,
                    },
                    billing_same_as_shipping: form.billingAddress === 'same',
                    billing: billingAddress,
                    shipping_method: form.shippingMethod,
                    payment_method: form.paymentMethod,
                    payment_context: paymentContext,
                    totalAmount: finalTotal,
                    coupon_code: coupon.discountAmount > 0 ? coupon.code : null,
                })
            });

            const raw = await res.text();
            let data: { message?: string; order?: { reference?: string } } | null = null;

            if (raw) {
                try {
                    data = JSON.parse(raw);
                } catch {
                    throw new Error(`Checkout response was not valid JSON: ${raw.slice(0, 180)}`);
                }
            }

            if (res.status === 201 && data?.order?.reference) {
                if (form.paymentMethod === 'card' && paymentContext?.mode === 'configured') {
                    if (!stripeInstanceRef.current || !stripeCardElementRef.current) {
                        throw new Error('Stripe card form is not ready yet.');
                    }

                    const confirmation = await stripeInstanceRef.current.confirmCardPayment(paymentContext.client_secret, {
                        payment_method: {
                            card: stripeCardElementRef.current,
                            billing_details: {
                                name: form.cardName.trim() || `${form.firstName} ${form.lastName}`.trim(),
                                email: form.email,
                                phone: form.phone || undefined,
                            },
                        },
                    });

                    if (confirmation.error?.message) {
                        throw new Error(confirmation.error.message);
                    }

                    const paymentIntentStatus = confirmation.paymentIntent?.status;

                    if (paymentIntentStatus === 'succeeded') {
                        setPaymentIntentMessage('Payment confirmed successfully. Redirecting to your order confirmation.');
                    } else if (paymentIntentStatus === 'processing') {
                        setPaymentIntentMessage('Payment is processing. We will update the order status as soon as Stripe confirms it.');
                    } else if (paymentIntentStatus === 'requires_action') {
                        setPaymentIntentMessage('Additional authentication was requested. Stripe will continue the confirmation flow.');
                    } else if (paymentIntentStatus && paymentIntentStatus !== 'requires_payment_method') {
                        throw new Error(`Stripe returned payment status: ${paymentIntentStatus}`);
                    }
                }

                localStorage.removeItem('petposture_cart');
                localStorage.removeItem('petposture_cart_coupon');
                clearCoupon();

                // Redirect to success page
                router.push(`/checkout/success?ref=${data.order.reference}&email=${encodeURIComponent(form.email)}`);
            } else {
                alert("Checkout failed: " + (data?.message || 'Unknown error'));
            }
        } catch (err) {
            console.error(err);
            alert(err instanceof Error ? err.message : "Network error processing your checkout.");
        } finally {
            setIsLoading(false);
        }
    };

    if (successRef) {
        return (
            <main className="min-h-screen bg-[#f6f6f7] font-hanken">
                <div ref={placesContainerRef} className="hidden" />
                <div className="mx-auto flex min-h-screen max-w-[760px] items-center justify-center px-6 py-16">
                    <div className="w-full rounded-[28px] border border-[#e3e3e6] bg-white p-8 shadow-[0_24px_80px_rgba(17,24,39,0.08)] md:p-12">
                        <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-[#ecfdf3] text-[#0f9f61]">
                            <CheckCircle size={34} />
                        </div>
                        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.28em] text-[#0f9f61]">Order confirmed</p>
                        <h1 className="mb-4 text-[34px] font-semibold leading-tight text-[#1c1c1f]">Thanks for your order.</h1>
                        <p className="mb-10 max-w-[520px] text-[15px] leading-7 text-[#5c5f62]">
                            Your order reference is <span className="font-semibold text-[#1c1c1f]">{successRef}</span>. We&apos;ll email shipping updates as soon as your items are on the way.
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Link href="/shop" className="inline-flex items-center justify-center rounded-[14px] bg-[#111827] px-6 py-4 text-[13px] font-semibold text-white transition hover:bg-[#1f2937]">
                                Continue shopping
                            </Link>
                            <Link href="/track-order" className="inline-flex items-center justify-center rounded-[14px] border border-[#d6d6db] px-6 py-4 text-[13px] font-semibold text-[#1c1c1f] transition hover:bg-[#f6f6f7]">
                                Track order
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#fcfcfd] font-hanken text-[#333333]">
            <div ref={placesContainerRef} className="hidden" />
            <div className="mx-auto flex min-h-screen max-w-[1100px] flex-col lg:flex-row">
                <div className="flex-1 border-r border-[#e8e8ea] bg-white px-4 pt-4 pb-8 md:px-8 lg:px-12 lg:pt-6 lg:pb-12">
                    <header className="mb-10 relative h-16">
                        <Link href="/" className="flex-shrink-0 relative w-[240px] h-full flex items-center -ml-2 transition hover:opacity-80">
                            <Image
                                src="/assets/Logo-PetPosture-1.png"
                                alt="PetPosture Logo"
                                width={300}
                                height={150}
                                priority
                                className="absolute top-1/2 -translate-y-[56%] left-0 h-[120px] md:h-[130px] w-auto object-contain z-50 drop-shadow-sm"
                            />
                        </Link>

                        <nav className="flex items-center gap-2 text-[12px] text-[#707070]">
                            <Link href="/cart" className="hover:text-[#333333]">Cart</Link>
                            <ChevronLeft size={10} className="rotate-180 opacity-50" />
                            <button
                                type="button"
                                onClick={() => scrollToStep('information')}
                                className={`transition hover:text-[#333333] ${activeStep === 'information' ? 'font-semibold text-[#333333]' : ''}`}
                            >
                                Information
                            </button>
                            <ChevronLeft size={10} className="rotate-180 opacity-50" />
                            <button
                                type="button"
                                onClick={() => scrollToStep('shipping')}
                                className={`transition hover:text-[#333333] ${activeStep === 'shipping' ? 'font-semibold text-[#333333]' : ''}`}
                            >
                                Shipping
                            </button>
                            <ChevronLeft size={10} className="rotate-180 opacity-50" />
                            <button
                                type="button"
                                onClick={() => scrollToStep('payment')}
                                className={`transition hover:text-[#333333] ${activeStep === 'payment' ? 'font-semibold text-[#333333]' : ''}`}
                            >
                                Payment
                            </button>
                        </nav>
                    </header>



                    <form onSubmit={handleCheckout} className="space-y-8">
                        <section
                            id="checkout-information"
                            ref={informationSectionRef}
                            data-step="information"
                            className="scroll-mt-8"
                            onFocusCapture={() => activateStep('information')}
                            onPointerDownCapture={() => activateStep('information')}
                        >
                            <div className="mb-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff3eb] text-[#df8448]">
                                        <Mail size={16} />
                                    </div>
                                    <h2 className="text-[18px] font-semibold text-[#333333]">Contact</h2>
                                </div>
                                <p className="text-[13px] text-[#707070]">
                                    Already have an account? <Link href="/auth/login" className="text-[#197bbd] underline">Log in</Link>
                                </p>
                            </div>
                            <div className="space-y-3">
                                <div className="relative">
                                    <input
                                        type="email"
                                        required
                                        name="email"
                                        autoComplete="email"
                                        placeholder="Email"
                                        value={form.email}
                                        onChange={(e) => updateField('email', e.target.value)}
                                        className="h-[46px] w-full rounded-[8px] border border-[#d9d9d9] bg-white px-3.5 text-[14px] transition focus:border-[#df8448] focus:ring-2 focus:ring-[#f4cdb7]"
                                    />
                                </div>
                                <div className="flex items-center gap-3 py-1">
                                    <input
                                        type="checkbox"
                                        id="saveInfo"
                                        checked={form.saveInfo}
                                        onChange={(e) => updateField('saveInfo', e.target.checked)}
                                        className="h-4 w-4 rounded border-[#d9d9d9] text-[#197bbd] focus:ring-[#197bbd]"
                                    />
                                    <label htmlFor="saveInfo" className="text-[13px] text-[#333333]">Email me with news and offers</label>
                                </div>
                            </div>
                        </section>

                        <section
                            id="checkout-shipping"
                            ref={shippingSectionRef}
                            data-step="shipping"
                            className="scroll-mt-8 pt-4"
                            onFocusCapture={() => activateStep('shipping')}
                            onPointerDownCapture={() => activateStep('shipping')}
                        >
                            <div className="mb-4 flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff3eb] text-[#df8448]">
                                    <MapPinHouse size={16} />
                                </div>
                                <h2 className="text-[18px] font-semibold text-[#333333]">Delivery</h2>
                            </div>
                            <div className="grid gap-3">
                                <div className="relative">
                                    <select
                                        name="country"
                                        autoComplete="shipping country-name"
                                        value={form.country}
                                        onChange={(e) => updateField('country', e.target.value)}
                                        className="h-[46px] w-full appearance-none rounded-[8px] border border-[#d9d9d9] bg-white px-3.5 text-[14px] transition focus:border-[#df8448] focus:ring-2 focus:ring-[#f4cdb7]"
                                    >
                                        {countryOptions.map((country) => (
                                            <option key={country} value={country}>{country}</option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 opacity-50">
                                        <ChevronLeft size={14} className="-rotate-90" />
                                    </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <input required name="firstName" autoComplete="shipping given-name" placeholder="First name" value={form.firstName} onChange={(e) => updateField('firstName', e.target.value)} className="h-[46px] w-full rounded-[8px] border border-[#d9d9d9] px-3.5 text-[14px] outline-none transition focus:border-[#df8448] focus:ring-2 focus:ring-[#f4cdb7]" />
                                    <input required name="lastName" autoComplete="shipping family-name" placeholder="Last name" value={form.lastName} onChange={(e) => updateField('lastName', e.target.value)} className="h-[46px] w-full rounded-[8px] border border-[#d9d9d9] px-3.5 text-[14px] outline-none transition focus:border-[#df8448] focus:ring-2 focus:ring-[#f4cdb7]" />
                                </div>

                                <input name="company" autoComplete="shipping organization" placeholder="Company (optional)" value={form.company} onChange={(e) => updateField('company', e.target.value)} className="h-[46px] w-full rounded-[8px] border border-[#d9d9d9] px-3.5 text-[14px] outline-none transition focus:border-[#df8448] focus:ring-2 focus:ring-[#f4cdb7]" />

                                <div className="relative">
                                    <input required name="address1" autoComplete="shipping address-line1" placeholder="Address" value={form.address1} onChange={(e) => updateField('address1', e.target.value)} onFocus={() => setActiveAddressTarget('shipping')} onBlur={() => window.setTimeout(() => setActiveAddressTarget((prev) => (prev === 'shipping' ? null : prev)), 120)} className="h-[46px] w-full rounded-[8px] border border-[#d9d9d9] px-3.5 pr-10 text-[14px] outline-none transition focus:border-[#df8448] focus:ring-2 focus:ring-[#f4cdb7]" />
                                    <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#707070]" />
                                    {renderAddressSuggestions('shipping')}
                                </div>
                                {googleMapsApiKey && normalizeCountryCode(form.country) === 'us' ? (
                                    <p className="text-[12px] text-[#707070]">Start typing your street address and choose a suggestion.</p>
                                ) : null}

                                <input name="address2" autoComplete="shipping address-line2" placeholder="Apartment, suite, etc. (optional)" value={form.address2} onChange={(e) => updateField('address2', e.target.value)} className="h-[46px] w-full rounded-[8px] border border-[#d9d9d9] px-3.5 text-[14px] outline-none transition focus:border-[#df8448] focus:ring-2 focus:ring-[#f4cdb7]" />

                                <div className="grid gap-3 md:grid-cols-3">
                                    <input required name="city" autoComplete="shipping address-level2" placeholder="City" value={form.city} onChange={(e) => updateField('city', e.target.value)} className="h-[46px] w-full rounded-[8px] border border-[#d9d9d9] px-3.5 text-[14px] outline-none transition focus:border-[#df8448] focus:ring-2 focus:ring-[#f4cdb7]" />
                                    <input required name="province" autoComplete="shipping address-level1" placeholder="State" value={form.province} onChange={(e) => updateField('province', e.target.value)} className="h-[46px] w-full rounded-[8px] border border-[#d9d9d9] px-3.5 text-[14px] outline-none transition focus:border-[#df8448] focus:ring-2 focus:ring-[#f4cdb7]" />
                                    <input required name="postalCode" autoComplete="shipping postal-code" placeholder="ZIP code" value={form.postalCode} onChange={(e) => updateField('postalCode', e.target.value)} className="h-[46px] w-full rounded-[8px] border border-[#d9d9d9] px-3.5 text-[14px] outline-none transition focus:border-[#df8448] focus:ring-2 focus:ring-[#f4cdb7]" />
                                </div>

                                <input name="phone" autoComplete="shipping tel" placeholder="Phone" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} className="h-[46px] w-full rounded-[8px] border border-[#d9d9d9] px-3.5 text-[14px] outline-none transition focus:border-[#df8448] focus:ring-2 focus:ring-[#f4cdb7]" />

                                <div className="flex items-center gap-3 py-1">
                                    <input type="checkbox" id="saveDelivery" className="h-4 w-4 rounded border-[#d9d9d9] text-[#197bbd] focus:ring-[#197bbd]" />
                                    <label htmlFor="saveDelivery" className="text-[13px] text-[#333333]">Save this information for next time</label>
                                </div>
                            </div>
                        </section>

                        <section
                            className="scroll-mt-8 pt-4"
                            onFocusCapture={() => activateStep('shipping')}
                            onPointerDownCapture={() => activateStep('shipping')}
                        >
                            <div className="mb-4 flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff3eb] text-[#df8448]">
                                    <Truck size={16} />
                                </div>
                                <h2 className="text-[18px] font-semibold text-[#333333]">Shipping method</h2>
                            </div>
                            <div className="overflow-hidden rounded-[8px] border border-[#d9d9d9] bg-white shadow-[0_8px_24px_rgba(17,24,39,0.03)]">
                                <label className={`flex cursor-pointer items-center justify-between border-b border-[#d9d9d9] p-4 text-[14px] transition ${form.shippingMethod === 'standard' ? 'bg-[#f7faff]' : 'hover:bg-[#fbfbfc]'}`}>
                                    <div className="flex items-center gap-4">
                                        <input type="radio" name="shippingMethod" checked={form.shippingMethod === 'standard'} onChange={() => updateField('shippingMethod', 'standard')} className="h-4 w-4 border-[#d9d9d9] text-[#197bbd]" />
                                        <div>
                                            <span className="text-[#333333]">Standard</span>
                                            <p className="mt-0.5 text-[12px] text-[#707070]">4 to 7 business days</p>
                                        </div>
                                    </div>
                                    <span className="font-semibold text-[#333333]">{getShippingAmount(totalAmount, coupon) === 0 ? 'Free' : `$${getShippingAmount(totalAmount, coupon).toFixed(2)}`}</span>
                                </label>
                                <label className={`flex cursor-pointer items-center justify-between p-4 text-[14px] transition ${form.shippingMethod === 'express' ? 'bg-[#f7faff]' : 'hover:bg-[#fbfbfc]'}`}>
                                    <div className="flex items-center gap-4">
                                        <input type="radio" name="shippingMethod" checked={form.shippingMethod === 'express'} onChange={() => updateField('shippingMethod', 'express')} className="h-4 w-4 border-[#d9d9d9] text-[#197bbd]" />
                                        <div>
                                            <span className="text-[#333333]">Express</span>
                                            <p className="mt-0.5 text-[12px] text-[#707070]">1 to 2 business days</p>
                                        </div>
                                    </div>
                                    <span className="font-semibold text-[#333333]">{coupon.freeShipping ? 'Free' : '$25.00'}</span>
                                </label>
                            </div>
                        </section>

                        <section
                            id="checkout-payment"
                            ref={paymentSectionRef}
                            data-step="payment"
                            className="scroll-mt-8 pt-4"
                            onFocusCapture={() => activateStep('payment')}
                            onPointerDownCapture={() => activateStep('payment')}
                        >
                            <div className="mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff3eb] text-[#df8448]">
                                        <CreditCard size={16} />
                                    </div>
                                    <h2 className="text-[18px] font-semibold text-[#333333]">Payment</h2>
                                </div>
                                <div className="mt-2 flex items-center gap-1.5 text-[13px] text-[#707070]">
                                    <ShieldCheck size={14} className="text-[#0f9f61]" />
                                    <p>All transactions are secure and encrypted.</p>
                                </div>
                            </div>
                            <div className="rounded-[8px] border border-[#d9d9d9] shadow-[0_8px_24px_rgba(17,24,39,0.03)]">
                                {availablePaymentMethods.map((method, index) => (
                                    <React.Fragment key={method.method}>
                                        <label
                                            className={paymentRowClasses(method.method, index)}
                                        >
                                            <div className="flex min-h-[40px] items-start gap-4">
                                                <input
                                                    type="radio"
                                                    name="paymentMethod"
                                                    checked={form.paymentMethod === method.method}
                                                    onChange={() => {
                                                        activateStep('payment');
                                                        updateField('paymentMethod', method.method);
                                                    }}
                                                    className="mt-0.5 h-4 w-4 border-[#bfc6ce] text-[#197bbd] focus:ring-1 focus:ring-[#197bbd]"
                                                />
                                                <div className="pr-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[14px] font-semibold text-[#2d3742]">{method.label}</span>
                                                    </div>
                                                    {method.description ? (
                                                        <p className="mt-1 pr-2 text-[12px] leading-[1.45] text-[#6f7782]">{method.description}</p>
                                                    ) : null}
                                                    {method.mode === 'placeholder' && method.method === 'paypal' ? (
                                                        <p className="mt-1 text-[11px] font-medium text-[#8a5a34]">PayPal redirect is scaffolded but not connected yet.</p>
                                                    ) : null}
                                                    {method.mode === 'manual' && method.method === 'cod' ? (
                                                        <p className="mt-1 text-[11px] font-medium text-[#8a5a34]">Offline/manual method for testing only.</p>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <div className="ml-3 flex flex-shrink-0 items-center">
                                                {renderPaymentBadges(method)}
                                            </div>
                                        </label>

                                        {method.method === 'card' && form.paymentMethod === 'card' && (
                                            <div className="grid gap-3 border-b border-[#d9d9d9] bg-[#f8fafc] px-4 pb-4 pt-3">
                                                {stripeLiveMode ? (
                                                    <div className="rounded-[8px] border border-[#d9d9d9] bg-white px-3.5 py-[15px]">
                                                        <div ref={stripeCardMountRef} />
                                                    </div>
                                                ) : (
                                                    <>
                                                        <input value={form.cardNumber} onChange={(e) => updateField('cardNumber', e.target.value)} placeholder="Card number" className="h-[48px] w-full rounded-[8px] border border-[#d9d9d9] bg-white px-3.5 text-[14px] outline-none transition focus:border-[#197bbd] focus:ring-1 focus:ring-[#c6def0]" />
                                                        <div className="grid gap-3 md:grid-cols-2">
                                                            <input value={form.expiry} onChange={(e) => updateField('expiry', e.target.value)} placeholder="Expiration date (MM / YY)" className="h-[48px] w-full rounded-[8px] border border-[#d9d9d9] bg-white px-3.5 text-[14px] outline-none transition focus:border-[#197bbd] focus:ring-1 focus:ring-[#c6def0]" />
                                                            <input value={form.securityCode} onChange={(e) => updateField('securityCode', e.target.value)} placeholder="Security code" className="h-[48px] w-full rounded-[8px] border border-[#d9d9d9] bg-white px-3.5 text-[14px] outline-none transition focus:border-[#197bbd] focus:ring-1 focus:ring-[#c6def0]" />
                                                        </div>
                                                    </>
                                                )}
                                                <input value={form.cardName} onChange={(e) => updateField('cardName', e.target.value)} placeholder="Name on card" className="h-[48px] w-full rounded-[8px] border border-[#d9d9d9] bg-white px-3.5 text-[14px] outline-none transition focus:border-[#197bbd] focus:ring-1 focus:ring-[#c6def0]" />
                                                {stripeLiveMode ? (
                                                    <p className="text-[12px] leading-[1.45] text-[#6f7782]">Card details are collected securely by Stripe.</p>
                                                ) : null}
                                                {stripeError ? (
                                                    <p className="text-[12px] font-medium text-[#b42318]">{stripeError}</p>
                                                ) : null}
                                                <div className="rounded-[8px] border border-[#d9d9d9] bg-white px-3.5 py-3">
                                                    <label htmlFor="billingSameAsShipping" className="flex cursor-pointer items-start gap-3 text-[14px] text-[#333333]">
                                                        <input
                                                            id="billingSameAsShipping"
                                                            type="checkbox"
                                                            checked={form.billingAddress === 'same'}
                                                            onChange={(e) => updateField('billingAddress', e.target.checked ? 'same' : 'different')}
                                                            className="mt-0.5 h-4 w-4 rounded border-[#bfc6ce] text-[#197bbd] focus:ring-1 focus:ring-[#197bbd]"
                                                        />
                                                        <span>Use shipping address as billing address</span>
                                                    </label>
                                                </div>

                                                {paymentIntentMessage ? (
                                                    <div className="rounded-[8px] border border-[#f4cdb7] bg-[#fff7f2] px-3.5 py-3 text-[12px] leading-5 text-[#8a5a34]">
                                                        {paymentIntentMessage}
                                                        {preparedPaymentIntent?.intent_id ? (
                                                            <span className="mt-1 block font-medium text-[#6b4527]">Intent ID: {preparedPaymentIntent.intent_id}</span>
                                                        ) : null}
                                                    </div>
                                                ) : null}

                                                {form.billingAddress === 'different' && (
                                                    <div className="grid gap-3 rounded-[8px] border border-[#d9d9d9] bg-white p-4">
                                                        <div>
                                                            <p className="text-[14px] font-medium text-[#333333]">Billing address</p>
                                                            <p className="mt-1 text-[12px] text-[#707070]">Enter the address associated with this card.</p>
                                                        </div>

                                                        <div className="relative">
                                                            <select
                                                                name="billingCountry"
                                                                autoComplete="billing country-name"
                                                                value={form.billingCountry}
                                                                onChange={(e) => updateField('billingCountry', e.target.value)}
                                                                className="h-[46px] w-full appearance-none rounded-[8px] border border-[#d9d9d9] bg-white px-3.5 text-[14px] outline-none transition focus:border-[#df8448] focus:ring-2 focus:ring-[#f4cdb7]"
                                                            >
                                                                {countryOptions.map((country) => (
                                                                    <option key={country} value={country}>{country}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        <div className="grid gap-3 md:grid-cols-2">
                                                            <input
                                                                required={form.billingAddress === 'different'}
                                                                name="billingFirstName"
                                                                autoComplete="billing given-name"
                                                                placeholder="First name"
                                                                value={form.billingFirstName}
                                                                onChange={(e) => updateField('billingFirstName', e.target.value)}
                                                                className="h-[46px] w-full rounded-[8px] border border-[#d9d9d9] px-3.5 text-[14px] outline-none transition focus:border-[#df8448] focus:ring-2 focus:ring-[#f4cdb7]"
                                                            />
                                                            <input
                                                                required={form.billingAddress === 'different'}
                                                                name="billingLastName"
                                                                autoComplete="billing family-name"
                                                                placeholder="Last name"
                                                                value={form.billingLastName}
                                                                onChange={(e) => updateField('billingLastName', e.target.value)}
                                                                className="h-[46px] w-full rounded-[8px] border border-[#d9d9d9] px-3.5 text-[14px] outline-none transition focus:border-[#df8448] focus:ring-2 focus:ring-[#f4cdb7]"
                                                            />
                                                        </div>

                                                        <div className="relative">
                                                            <input
                                                                required={form.billingAddress === 'different'}
                                                                name="billingAddress1"
                                                                autoComplete="billing address-line1"
                                                                placeholder="Address"
                                                                value={form.billingAddress1}
                                                                onChange={(e) => updateField('billingAddress1', e.target.value)}
                                                                onFocus={() => setActiveAddressTarget('billing')}
                                                                onBlur={() => window.setTimeout(() => setActiveAddressTarget((prev) => (prev === 'billing' ? null : prev)), 120)}
                                                                className="h-[46px] w-full rounded-[8px] border border-[#d9d9d9] px-3.5 pr-10 text-[14px] outline-none transition focus:border-[#df8448] focus:ring-2 focus:ring-[#f4cdb7]"
                                                            />
                                                            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#707070]" />
                                                            {renderAddressSuggestions('billing')}
                                                        </div>

                                                        <input
                                                            name="billingAddress2"
                                                            autoComplete="billing address-line2"
                                                            placeholder="Apartment, suite, etc. (optional)"
                                                            value={form.billingAddress2}
                                                            onChange={(e) => updateField('billingAddress2', e.target.value)}
                                                            className="h-[46px] w-full rounded-[8px] border border-[#d9d9d9] px-3.5 text-[14px] outline-none transition focus:border-[#df8448] focus:ring-2 focus:ring-[#f4cdb7]"
                                                        />

                                                        <div className="grid gap-3 md:grid-cols-3">
                                                            <input
                                                                required={form.billingAddress === 'different'}
                                                                name="billingCity"
                                                                autoComplete="billing address-level2"
                                                                placeholder="City"
                                                                value={form.billingCity}
                                                                onChange={(e) => updateField('billingCity', e.target.value)}
                                                                className="h-[46px] w-full rounded-[8px] border border-[#d9d9d9] px-3.5 text-[14px] outline-none transition focus:border-[#df8448] focus:ring-2 focus:ring-[#f4cdb7]"
                                                            />
                                                            <input
                                                                required={form.billingAddress === 'different'}
                                                                name="billingProvince"
                                                                autoComplete="billing address-level1"
                                                                placeholder="State"
                                                                value={form.billingProvince}
                                                                onChange={(e) => updateField('billingProvince', e.target.value)}
                                                                className="h-[46px] w-full rounded-[8px] border border-[#d9d9d9] px-3.5 text-[14px] outline-none transition focus:border-[#df8448] focus:ring-2 focus:ring-[#f4cdb7]"
                                                            />
                                                            <input
                                                                required={form.billingAddress === 'different'}
                                                                name="billingPostalCode"
                                                                autoComplete="billing postal-code"
                                                                placeholder="ZIP code"
                                                                value={form.billingPostalCode}
                                                                onChange={(e) => updateField('billingPostalCode', e.target.value)}
                                                                className="h-[46px] w-full rounded-[8px] border border-[#d9d9d9] px-3.5 text-[14px] outline-none transition focus:border-[#df8448] focus:ring-2 focus:ring-[#f4cdb7]"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </React.Fragment>
                                ))}


                            </div>
                        </section>

                        <div className="pt-6">
                            <button
                                disabled={isLoading || items.length === 0}
                                className="flex h-[54px] w-full items-center justify-center gap-2 rounded-[8px] bg-[#df8448] px-6 text-[15px] font-bold text-white shadow-[0_14px_30px_rgba(223,132,72,0.22)] transition hover:bg-[#c9713a] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isLoading ? (
                                    'Processing...'
                                ) : (
                                    <>
                                        <Lock size={16} />
                                        Complete order
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    <footer className="mt-16 border-t border-[#e6e6e6] pt-8">
                        <div className="flex flex-wrap gap-x-6 gap-y-3 text-[11px] text-[#707070]">
                            <Link href="/return-refund-policy" className="hover:underline">Refund policy</Link>
                            <Link href="/shipping-policy" className="hover:underline">Shipping policy</Link>
                            <Link href="/privacy-policy" className="hover:underline">Privacy policy</Link>
                            <Link href="/terms-and-conditions" className="hover:underline">Terms of service</Link>
                            <Link href="/contact" className="hover:underline">Contact information</Link>
                        </div>
                    </footer>
                </div>

                <aside className="w-full border-l border-[#e8e8ea] bg-[#fafafa] px-4 py-8 md:px-8 lg:w-[440px] lg:px-10 lg:py-12">
                    <div className="sticky top-12 space-y-8">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff3eb] text-[#df8448]">
                                <ShoppingBag size={16} />
                            </div>
                            <h2 className="text-[18px] font-semibold text-[#333333]">Order summary</h2>
                        </div>

                        <div className="max-h-[380px] space-y-4 overflow-y-auto overflow-x-hidden p-1 pr-2">
                            {items.map((item) => (
                                <div key={item.variantId} className="flex items-center gap-4 py-1">
                                    <div className="relative h-16 w-16 flex-shrink-0 rounded-[10px] border border-[#e6e6e6] bg-white">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={item.image} alt={item.name} className="h-full w-full object-contain p-1" />
                                        <span className="absolute -right-2 -top-2 z-10 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-[#111827] px-1 text-[10px] font-bold text-white shadow-[0_0_0_2px_#fff]">
                                            {item.quantity}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="line-clamp-1 text-[13px] font-medium text-[#333333]">{item.name}</h3>
                                        <p className="mt-0.5 text-[11px] text-[#707070]">{item.category}</p>
                                    </div>
                                    <span className="text-[14px] font-medium text-[#333333]">${(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-[#e6e6e6] pt-6">
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        value={couponCode}
                                        onChange={(e) => setCouponCode(e.target.value)}
                                        placeholder="Discount code"
                                        className="h-[44px] w-full rounded-[8px] border border-[#d9d9d9] bg-white pl-10 pr-3.5 text-[14px] outline-none transition focus:border-[#df8448]"
                                    />
                                    <Tag size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#707070]" />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleApplyCoupon}
                                    className="h-[44px] rounded-[8px] bg-[#e1e1e1] px-5 text-[13px] font-semibold text-[#333333] transition hover:bg-[#d6d6d6] disabled:opacity-50"
                                >
                                    Apply
                                </button>
                            </div>
                            {coupon.message && (
                                <p className={`mt-2 text-[12px] font-medium ${coupon.isError ? 'text-[#dc2626]' : 'text-[#0f9f61]'}`}>
                                    {coupon.message}
                                </p>
                            )}
                        </div>

                        <div className="space-y-3 border-t border-[#e6e6e6] pt-6">
                            <div className="flex items-center justify-between text-[13px] text-[#333333]">
                                <span>Subtotal</span>
                                <span className="font-medium">${totalAmount.toFixed(2)}</span>
                            </div>
                            {coupon.discountAmount > 0 && (
                                <div className="flex items-center justify-between text-[13px] text-[#0f9f61]">
                                    <div className="flex items-center gap-1.5">
                                        <Tag size={14} />
                                        <span>Discount ({coupon.code})</span>
                                    </div>
                                    <span className="font-medium">-${coupon.discountAmount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex items-center justify-between text-[13px] text-[#333333]">
                                <span>Shipping</span>
                                <span className="font-medium">{shippingAmount === 0 ? 'Free' : `$${shippingAmount.toFixed(2)}`}</span>
                            </div>
                            {taxAmount > 0 && (
                                <div className="flex items-center justify-between text-[13px] text-[#333333]">
                                    <div className="pr-3">
                                        <span>Estimated tax ({(taxRate * 100).toFixed(taxRate * 100 % 1 === 0 ? 0 : 2)}%)</span>
                                        {taxQuote?.source_label ? (
                                            <p className="mt-1 text-[11px] leading-4 text-[#707070]">
                                                {taxQuote.source_label}
                                                {taxQuote.effective_date ? `, effective ${taxQuote.effective_date}` : ''}
                                            </p>
                                        ) : null}
                                    </div>
                                    <span className="font-medium">${taxAmount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex items-center justify-between pt-3 text-[18px] font-bold text-[#333333]">
                                <span>Total</span>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-[11px] font-normal text-[#707070]">USD</span>
                                    <span>${finalTotal.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 rounded-[10px] border border-[#e6f3ea] bg-[#f6fbf7] px-3 py-2 text-[12px] text-[#4d6357]">
                                <ShieldCheck size={14} className="text-[#0f9f61]" />
                                <span>Secure checkout and encrypted payment details.</span>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </main>
    );

}
