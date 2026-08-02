import type { Metadata } from 'next';
import WishlistPage from '@/components/WishlistPage';

export const metadata: Metadata = {
    title: 'Wishlist',
    description: 'Products you\'ve saved for later.',
};

export default function Page() {
    return <WishlistPage />;
}
