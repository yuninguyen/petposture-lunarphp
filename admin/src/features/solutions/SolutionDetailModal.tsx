import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSolution } from './solutionsApi';

interface SolutionDetailModalProps {
  solutionId: number | null;
  onClose: () => void;
}

export function SolutionDetailModal({ solutionId, onClose }: SolutionDetailModalProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useSolution(solutionId ?? undefined);
  
  if (!solutionId) return null;

  const solution = data?.data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">{t('common.view_details')}</h2>
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
          ) : !solution ? (
            <div className="text-center text-slate-500 py-8">Solution not found</div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-6">
                {(solution.featured_media || solution.featured_image) && (
                  <div className="w-full sm:w-1/3 shrink-0 flex justify-center sm:justify-start">
                    <img
                      src={solution.featured_media?.url || solution.featured_image || undefined}
                      alt={solution.featured_media?.alt || solution.featured_image_alt || solution.name}
                      className="rounded-lg shadow-sm w-full object-contain border border-slate-200 bg-slate-50"
                    />
                  </div>
                )}
                
                <div className="flex-1 bg-slate-50 p-5 rounded-lg border border-slate-100 space-y-5">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">{t('solutions.name', 'Name')}</h3>
                    <div className="text-sm text-slate-700">{solution.name}</div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">{t('solutions.slug', 'Slug')}</h3>
                    <div className="text-sm text-slate-600 font-mono bg-white px-2 py-1 rounded border border-slate-200 w-fit">
                      {solution.slug}
                    </div>
                  </div>
                </div>
              </div>

              {solution.description && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">{t('solutions.description', 'Description')}</h3>
                  <div 
                    className="text-sm text-slate-700 prose prose-sm max-w-none bg-slate-50 p-4 rounded-lg border border-slate-100"
                    dangerouslySetInnerHTML={{ __html: solution.description }}
                  />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">{t('solutions.products', 'Products')} ({solution.products_count ?? solution.products?.length ?? 0})</h3>
                  {solution.products && solution.products.length > 0 ? (
                    <ul className="space-y-2">
                      {solution.products.map(product => (
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
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">{t('solutions.posts', 'Posts')} ({solution.posts_count ?? solution.posts?.length ?? 0})</h3>
                  {solution.posts && solution.posts.length > 0 ? (
                    <ul className="space-y-2">
                      {solution.posts.map(post => (
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
            {t('common.close')}
          </Button>
          <Link to={`/solutions/${solutionId}/edit`}>
            <Button variant="primary">
              {t('common.edit', 'Edit')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
