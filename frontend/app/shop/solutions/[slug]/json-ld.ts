export function buildSolutionCollectionJsonLd(data: { name: string; description: string; url: string }) {
    return { '@context': 'https://schema.org', '@type': 'CollectionPage', ...data };
}
