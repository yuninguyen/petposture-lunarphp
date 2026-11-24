import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';

/**
 * Read-only "Mentioned in" of a Pick: the published posts that link to it. There is nothing to fill in here; the
 * link is set on the post. Left out entirely while no post mentions the Pick.
 */
export function PickMentionedIn({ posts }: { posts: Array<{ id: number; title: string; published_at: string | null }> }) {
  const { t } = useTranslation();
  if (posts.length === 0) return null;

  return (
    <Card className="p-5">
      <h2 className="font-semibold">{t('products.mentioned_in.title')}</h2>
      <ul className="mt-3 space-y-2">
        {posts.map((post) => (
          <li key={post.id} className="text-sm">
            <Link to={`/posts/${post.id}`} className="font-medium text-primary hover:underline">
              {post.title}
            </Link>
            {post.published_at && <span className="ml-1 text-slate-500">({new Date(post.published_at).toLocaleDateString()})</span>}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">{t('products.mentioned_in.hint')}</p>
    </Card>
  );
}
