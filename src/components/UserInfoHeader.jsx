import { useState, useEffect } from 'react';

export default function UserInfoHeader({ compact = false, horizontal = false, userName = 'Usuario' }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sessionStart] = useState(new Date());
  const [userInfo, setUserInfo] = useState({
    ip: '...',
    city: '...',
    country: '...'
  });

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch IP and location
  useEffect(() => {
    const fetchLocationData = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        setUserInfo({
          ip: data.ip || 'N/A',
          city: data.city || 'Desconocida',
          country: data.country_name || ''
        });
      } catch (error) {
        console.error('Error fetching location:', error);
      }
    };
    fetchLocationData();
  }, []);

  // Calculate session duration
  const getSessionDuration = () => {
    const diff = currentTime - sessionStart;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('es-CO', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('es-CO', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (horizontal) {
    return (
      <div className="flex items-center gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <span>👤</span>
          <span className="font-medium text-slate-700">{userName}</span>
        </div>
        
        <span className="text-slate-300">|</span>
        
        <div className="flex items-center gap-1.5">
          <span>📍</span>
          <span>{userInfo.city}</span>
        </div>
        
        <span className="text-slate-300">|</span>
        
        <div className="flex items-center gap-1">
          <span>📅</span>
          <span>{formatDate(currentTime)}</span>
        </div>
        
        <span className="text-slate-300">|</span>
        
        <div className="flex items-center gap-1">
          <span>🕐</span>
          <span className="font-mono font-medium text-slate-700">{formatTime(currentTime)}</span>
        </div>
        
        <span className="text-slate-300">|</span>
        
        <div className="flex items-center gap-1">
          <span>⏱️</span>
          <span className="font-mono">{getSessionDuration()}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 rounded-lg px-2 py-2 text-[9px] text-slate-600">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px]">👤</span>
          <span className="font-semibold text-[10px]">{userName}</span>
        </div>
        
        <div className="flex items-center gap-1.5">
          <span className="text-[11px]">📍</span>
          <span className="truncate">{userInfo.city}</span>
        </div>
        
        <div className="flex items-center gap-1.5">
          <span className="text-[11px]">📅</span>
          <span className="truncate">{formatDate(currentTime)}</span>
        </div>
        
        <div className="flex items-center gap-1.5">
          <span className="text-[11px]">🕐</span>
          <span className="font-mono font-semibold">{formatTime(currentTime)}</span>
        </div>
        
        <div className="flex items-center gap-1.5">
          <span className="text-[11px]">🌐</span>
          <span className="font-mono text-[8px] truncate">{userInfo.ip}</span>
        </div>
        
        <div className="flex items-center gap-1.5">
          <span className="text-[11px]">⏱️</span>
          <span className="font-mono text-[8px]">{getSessionDuration()}</span>
        </div>
      </div>
    </div>
  );
}
