import ShopPage from '@/components/ShopPage';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Shop | PetPosture',
    description: 'Elite ergonomic gear for your pet\'s best life. Shop our collection of bowls, ramps, beds, and harnesses.',
};

export default function Page() {
    return <ShopPage />;
}
