'use client';

import { useState, useEffect } from 'react';
import { FaClock, FaFire } from 'react-icons/fa';

interface SaleCountdownProps {
  saleEndDate?: string; // Data di fine offerta ISO 8601
  saleStartDate?: string; // Data di inizio offerta ISO 8601 (opzionale)
  className?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export default function SaleCountdown({ saleEndDate, saleStartDate, className = '' }: SaleCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isActive, setIsActive] = useState(false);
  const [saleStatus, setSaleStatus] = useState<'not-started' | 'active' | 'ended'>('ended');

  useEffect(() => {
    if (!saleEndDate) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();

      // Parse la data di fine offerta
      let endDateObj = new Date(saleEndDate);

      // DEBUG: Log per capire cosa arriva dall'API
      if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
        console.log('🔍 SaleCountdown DEBUG:', {
          saleEndDate,
          saleStartDate,
          endDateParsed: endDateObj.toISOString(),
          endDateLocal: endDateObj.toString(),
          hours: endDateObj.getHours(),
          minutes: endDateObj.getMinutes(),
          seconds: endDateObj.getSeconds(),
          nowISO: new Date(now).toISOString(),
          nowLocal: new Date(now).toString()
        });
      }

      // Fix per offerte senza data di inizio:
      // WooCommerce salva la data come inizio giornata invece di fine giornata
      // Quando non c'è saleStartDate, aggiungiamo 1 giorno completo meno 1 secondo
      if (!saleStartDate) {
        // Prendi la data così com'è e aggiungi 1 giorno completo
        const adjustedDate = new Date(endDateObj);
        adjustedDate.setDate(adjustedDate.getDate() + 1);
        adjustedDate.setMilliseconds(adjustedDate.getMilliseconds() - 1);
        endDateObj = adjustedDate;

        if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
          console.log('🔧 Adjusted date for offer without start date:', {
            original: new Date(saleEndDate).toISOString(),
            adjusted: endDateObj.toISOString()
          });
        }
      }

      const endDate = endDateObj.getTime();

      const startDate = saleStartDate ? new Date(saleStartDate).getTime() : 0;

      // Determina lo stato dell'offerta
      if (saleStartDate && now < startDate) {
        setSaleStatus('not-started');
        setIsActive(false);
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      } else if (now > endDate) {
        setSaleStatus('ended');
        setIsActive(false);
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      } else {
        setSaleStatus('active');
        setIsActive(true);
      }

      const difference = endDate - now;
      
      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        
        return { days, hours, minutes, seconds };
      }
      
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    };

    // Calcola il tempo iniziale
    setTimeLeft(calculateTimeLeft());

    // Aggiorna ogni secondo
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);
    }, 1000);

    return () => clearInterval(timer);
  }, [saleEndDate, saleStartDate]);

  // Non mostrare il countdown se l'offerta è finita o non è ancora iniziata
  if (!isActive || saleStatus !== 'active') {
    return null;
  }

  const { days, hours, minutes, seconds } = timeLeft;
  const isUrgent = days === 0 && hours < 24; // Ultimi 24 ore

  return (
    <div className={`bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg p-4 shadow-lg ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <FaFire className={`text-yellow-300 ${isUrgent ? 'animate-pulse' : ''}`} />
          <h3 className="font-bold text-lg">
            {isUrgent ? '⚡ ULTIMI MOMENTI!' : '🔥 OFFERTA LIMITATA'}
          </h3>
        </div>
        <FaClock className="text-yellow-300" />
      </div>
      
      <div className="text-center">
        <p className="text-sm mb-2 opacity-90">L&apos;offerta scade tra:</p>
        <div className="grid grid-cols-4 gap-2 text-center">
          {/* Giorni */}
          <div className="bg-white/20 rounded-lg py-2 px-1">
            <div className="text-xl font-bold leading-none">{days.toString().padStart(2, '0')}</div>
            <div className="text-xs opacity-80 uppercase tracking-wide">Giorni</div>
          </div>
          
          {/* Ore */}
          <div className="bg-white/20 rounded-lg py-2 px-1">
            <div className="text-xl font-bold leading-none">{hours.toString().padStart(2, '0')}</div>
            <div className="text-xs opacity-80 uppercase tracking-wide">Ore</div>
          </div>
          
          {/* Minuti */}
          <div className="bg-white/20 rounded-lg py-2 px-1">
            <div className="text-xl font-bold leading-none">{minutes.toString().padStart(2, '0')}</div>
            <div className="text-xs opacity-80 uppercase tracking-wide">Min</div>
          </div>
          
          {/* Secondi */}
          <div className={`bg-white/20 rounded-lg py-2 px-1 ${isUrgent ? 'animate-pulse' : ''}`}>
            <div className="text-xl font-bold leading-none">{seconds.toString().padStart(2, '0')}</div>
            <div className="text-xs opacity-80 uppercase tracking-wide">Sec</div>
          </div>
        </div>
        
        {isUrgent && (
          <p className="text-sm mt-2 animate-pulse font-medium">
            ⏰ Affrettati! L&apos;offerta sta per scadere!
          </p>
        )}
      </div>
    </div>
  );
}