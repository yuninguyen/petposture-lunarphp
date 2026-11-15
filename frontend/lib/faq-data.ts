// SHOP-HIDDEN: this file also held the "Shipping Information" category ("How long will my order take to
// arrive?", "How much does shipping cost?", "Do you ship internationally?") and the "Orders & Returns"
// category ("How do I start a return? (30-Day Returns)", "My item arrived damaged. What do I do?",
// "Can I change or cancel my order?"). PetPosture ships nothing and takes no orders while the shop is
// hidden. Revert the "hide the shop chrome" commits to restore them word for word.
export const CATEGORIES = [
    { id: "products", title: "Product & Sizing" },
];

export const FAQ_ITEMS = [
    {
        category: "products",
        question: "How do I know which product is right for my pet?",
        answer: "Every pet has unique needs. We recommend exploring our 'Explore by Breed' or 'Explore Solutions' collections. For example, our 'Mobility' section is perfect for older pets needing extra help with furniture access, while our 'Feeding' collection helps pets focus during mealtime."
    },
    {
        category: "products",
        question: "What's the difference between a Ramp and Stairs?",
        answer: "Ramps provide a gradual incline, making them the best choice for long-backed breeds like Dachshunds or pets with arthritis. Stairs requires a slight jumping motion which can put stress on sensitive spines. If your pet has mobility issues, a ramp is generally the safer long-term option."
    },
    {
        category: "products",
        question: "Are the bowls dishwasher safe?",
        answer: "Yes! All of our ceramic and stainless steel bowl inserts are 100% dishwasher safe (top rack recommended). For stands made of bamboo or elevated wood, we recommend wiping them down with a damp cloth to preserve the finish."
    }
];
