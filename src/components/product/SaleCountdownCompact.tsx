'use client';

import { useState, useEffect } from 'react';
import { FaClock } from 'react-icons/fa';

interface SaleCountdownCompactProps {
  saleEndDate?: string; // Data di fine offerta ISO 8601
  className?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export default function SaleCountdownCompact({ saleEndDate, className = '' }: SaleCountdownCompactProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!saleEndDate) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const endDate = new Date(saleEndDate).getTime();
      const difference = endDate - now;
      
      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        
        setIsActive(true);
        return { days, hours, minutes, seconds };
      }
      
      setIsActive(false);
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
  }, [saleEndDate]);

  // Non mostrare il countdown se l'offerta è finita
  if (!isActive) {
    return null;
  }

  const { days, hours, minutes, seconds } = timeLeft;
  const isUrgent = days === 0 && hours < 24; // Ultimi 24 ore

  // Formato compatto: mostra solo la parte più significativa
  const getDisplayTime = () => {
    if (days > 0) {
      return { value: days, unit: 'g' };
    } else if (hours > 0) {
      return { value: hours, unit: 'h' };
    } else if (minutes > 0) {
      return { value: minutes, unit: 'm' };
    } else {
      return { value: seconds, unit: 's' };
    }
  };

  const displayTime = getDisplayTime();

  return (
    <div className={`inline-flex items-center space-x-1 bg-red-500 text-white px-2 py-1 rounded-md text-xs font-medium ${isUrgent ? 'animate-pulse' : ''} ${className}`}>
      <FaClock className="w-3 h-3" />
      <span>
        {displayTime.value}{displayTime.unit}
      </span>
    </div>
  );
}