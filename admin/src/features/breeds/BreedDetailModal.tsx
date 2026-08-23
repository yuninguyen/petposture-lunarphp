import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useBreed } from './breedsApi';

interface BreedDetailModalProps {
  breedId: number | null;
  onClose: () => void;
}

export function BreedDetailModal({ breedId, onClose }: BreedDetailModalProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useBreed(breedId ?? undefined);
  
  if (!breedId) return null;

  const breed = data?.data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">{t('common.view_details', 'View Details')}</h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-500 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !breed ? (
            <div className="text-center text-slate-500 py-8">Breed not found</div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-6">
                {breed.featured_media && (
                  <div className="w-full sm:w-1/3 shrink-0 flex justify-center sm:justify-start">
                    <img 
                      src={breed.featured_media.url} 
                      alt={breed.featured_media.alt || breed.name}
                      className="rounded-lg shadow-sm w-full object-contain border border-slate-200 bg-slate-50"
                    />
                  </div>
                )}
                
                <div className="flex-1 bg-slate-50 p-5 rounded-lg border border-slate-100 space-y-5">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">{t('breeds.name', 'Name')}</h3>
                    <div className="text-sm text-slate-700">{breed.name}</div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">{t('breeds.slug', 'Slug')}</h3>
                    <div className="text-sm text-slate-600 font-mono bg-white px-2 py-1 rounded border border-slate-200 w-fit">
                      {breed.slug}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">{t('breeds.body_type', 'Body Type')}</h3>
                    <div className="text-sm text-slate-700">
                      {breed.body_type ? breed.body_type.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '-'}
                    </div>
                  </div>
                </div>
              </div>

              {breed.description && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">{t('breeds.description', 'Description')}</h3>
                  <div 
                    className="text-sm text-slate-700 prose prose-sm max-w-none bg-slate-50 p-4 rounded-lg border border-slate-100"
                    dangerouslySetInnerHTML={{ __html: breed.description }}
                  />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">{t('breeds.products', 'Products')} ({breed.products_count ?? breed.products?.length ?? 0})</h3>
                  {breed.products && breed.products.length > 0 ? (
                    <ul className="space-y-2">
                      {breed.products.map(product => (
                        <li key={product.id} className="flex items-center text-sm">
                          <Link to={`/products/${product.id}`} className="text-primary hover:underline flex items-center gap-1.5 group" title="View product">
                            {product.name || product.title}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No products attached.</p>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">{t('breeds.posts', 'Posts')} ({breed.posts_count ?? breed.posts?.length ?? 0})</h3>
                  {breed.posts && breed.posts.length > 0 ? (
                    <ul className="space-y-2">
                      {breed.posts.map(post => (
                        <li key={post.id} className="flex items-center text-sm">
                          <Link to={`/posts/${post.id}`} className="text-primary hover:underline flex items-center gap-1.5 group" title="View post">
                            {post.title}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No posts attached.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            {t('common.close', 'Close')}
          </Button>
          <Link to={`/breeds/${breedId}`}>
            <Button variant="primary">
              {t('common.edit', 'Edit')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
