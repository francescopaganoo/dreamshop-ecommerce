import { cache } from 'react';
import { getCategoryBySlug } from './api';

// De-duplicate getCategoryBySlug calls within the same request.
// Used by both layout.tsx (generateMetadata + breadcrumb) and page.tsx (data fetch).
export const getCategoryBySlugCached = cache(getCategoryBySlug);
