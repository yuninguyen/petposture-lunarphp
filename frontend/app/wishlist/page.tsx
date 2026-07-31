import type { Metadata } from 'next';
import WishlistPage from '@/components/WishlistPage';

export const metadata: Metadata = {
    title: 'Wishlist | PetPosture',
    description: 'Products you\'ve saved for later.',
};

export default function Page() {
    return <WishlistPage />;
}
