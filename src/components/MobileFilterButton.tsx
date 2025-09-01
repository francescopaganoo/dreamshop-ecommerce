'use client';

import { FaBars } from 'react-icons/fa';

interface MobileFilterButtonProps {
  onClick: () => void;
}

export default function MobileFilterButton({ onClick }: MobileFilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden flex items-center gap-2 bg-gray-100 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors mb-6"
      aria-label="Filtra prodotti"
    >
      <FaBars className="text-sm" />
      <span className="font-medium">Filtra</span>
    </button>
  );
}