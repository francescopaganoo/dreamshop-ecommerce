'use client';

import { useState, useEffect } from 'react';

interface ProductAttribute {
  id: number;
  name: string;
  slug?: string;
  options: Array<string | { name: string; slug: string }>;
}

interface RestockNoticeProps {
  productId: number;
  categories: Array<{ id: number; name: string; slug: string }>;
  metaData?: Array<{ key: string; value: string }>;
  attributes?: ProductAttribute[];
  targetCategory?: string;
}

interface RestockNoticeData {
  show_notice: boolean;
  notice: string | null;
  color: string | null;
  month: string;
  year: string;
}

// Cache per evitare chiamate ripetute
const noticeCache = new Map<number, RestockNoticeData>();

export default function RestockNotice({
  productId,
  categories,
  metaData,
  attributes,
  targetCategory = 'ichiban-kuji'
}: RestockNoticeProps) {
  const [noticeData, setNoticeData] = useState<RestockNoticeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchNotice = async () => {
      // Verifica preliminare lato client per evitare chiamate inutili
      const hasTargetCategory = categories.some(cat => cat.slug === targetCategory);

      // Controlla attributo "in-pre-order" (pa_disponibilita)
      const hasPreorderAttribute = attributes?.some(attr => {
        if (attr.name === 'pa_disponibilita' || attr.slug === 'pa_disponibilita') {
          return attr.options.some(opt => {
            const optSlug = typeof opt === 'string' ? opt.toLowerCase().replace(/\s+/g, '-') : opt.slug;
            return optSlug === 'in-pre-order' || optSlug.includes('pre-order');
          });
        }
        return false;
      });

      // Controlla meta YITH Pre-Order
      const hasYithPreorder = metaData?.find(m => m.key === '_ywpo_preorder')?.value === 'yes';

      // Il prodotto è in pre-ordine se ha l'attributo O il meta YITH
      const isPreorder = hasPreorderAttribute || hasYithPreorder;

      if (!isPreorder || !hasTargetCategory) {
        setNoticeData({ show_notice: false, notice: null, color: null, month: '', year: '' });
        setIsLoading(false);
        return;
      }

      // Controlla cache
      if (noticeCache.has(productId)) {
        setNoticeData(noticeCache.get(productId)!);
        setIsLoading(false);
        return;
      }

      try {
        const wpUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL || 'https://be.dreamshop18.com';
        const response = await fetch(`${wpUrl}/wp-json/dreamshop-restock/v1/notice/${productId}`, {
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error('Failed to fetch restock notice');
        }

        const data = await response.json();

        if (data.success) {
          noticeCache.set(productId, data);
          setNoticeData(data);
        }
      } catch (error) {
        console.error('Error fetching restock notice:', error);
        setNoticeData({ show_notice: false, notice: null, color: null, month: '', year: '' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotice();
  }, [productId, categories, metaData, attributes, targetCategory]);

  // Non mostrare nulla durante il caricamento o se non c'e notice
  if (isLoading || !noticeData?.show_notice || !noticeData.notice) {
    return null;
  }

  // Usa il colore dall'API o default
  const noticeColor = noticeData.color || '#ef4444';

  return (
    <div
      className="mt-3 p-3 rounded-lg border flex items-center"
      style={{
        backgroundColor: `${noticeColor}10`,
        borderColor: `${noticeColor}40`
      }}
    >
      <svg
        className="w-5 h-5 mr-2 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        style={{ color: noticeColor }}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span
        className="text-sm font-semibold"
        style={{ color: noticeColor }}
      >
        {noticeData.notice}
      </span>
    </div>
  );
}
