import { LucideProps } from "lucide-react";

export function TikTokIcon({ size = 16, style }: LucideProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={style}
        >
            <path d="M9 12a4 4 0 1 0 4 4V3a5 5 0 0 0 5 5" />
        </svg>
    );
}

export function PinterestIcon({ size = 16, style }: LucideProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={style}
        >
            <circle cx="12" cy="12" r="10" />
            <path d="M9 20c.7-3.3 1.8-7.4 2.3-10M11 4a4 4 0 1 1 0 8h-2" />
        </svg>
    );
}
