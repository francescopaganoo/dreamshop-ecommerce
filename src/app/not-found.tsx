import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      
      <main className="flex-grow flex items-center justify-center py-12">
        <div className="text-center px-4">
          <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
          <h2 className="text-3xl font-semibold text-gray-800 mb-6">Pagina non trovata</h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
          La pagina che stai cercando potrebbe essere stata rimossa, potrebbe aver cambiato nome o potrebbe non essere temporaneamente disponibile.
          </p>
          <Link
            href="/"
            className="bg-bred-500 text-white px-6 py-3 rounded-md font-medium hover:bg-bred-700 transition-colors"
          >
            Torna alla Home
          </Link>
        </div>
      </main>
      
    </div>
  );
}
