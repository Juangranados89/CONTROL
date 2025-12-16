import { useState, useEffect } from 'react';
import { AlertTriangle, AlertCircle, Clock, X, Bell, BellOff } from 'lucide-react';

export default function NotificationBadge({ fleet, workOrders }) {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);

  useEffect(() => {
    const alerts = [];
    
    // 1. Vehículos próximos a mantenimiento (< 500km)
    fleet.forEach(vehicle => {
      const nextMaintenance = vehicle.nextMaintenanceKm || 0;
      const currentKm = vehicle.currentKm || 0;
      const remaining = nextMaintenance - currentKm;
      
      if (remaining > 0 && remaining <= 500) {
        alerts.push({
          id: `maint-${vehicle.id}`,
          type: 'warning',
          title: 'Próximo a Mantenimiento',
          message: `${vehicle.plate} - Faltan ${remaining} KM`,
          vehicle: vehicle.plate,
          priority: remaining <= 100 ? 'high' : 'medium'
        });
      }
    });

    // 2. OT vencidas sin cerrar
    const today = new Date();
    workOrders.forEach(ot => {
      if (ot.status !== 'completed' && ot.dueDate) {
        const dueDate = new Date(ot.dueDate);
        if (dueDate < today) {
          alerts.push({
            id: `overdue-${ot.id}`,
            type: 'error',
            title: 'OT Vencida',
            message: `OT #${ot.otNumber} - ${ot.vehiclePlate}`,
            vehicle: ot.vehiclePlate,
            priority: 'high'
          });
        }
      }
    });

    // 3. Vehículos sin actualizar kilometraje (>7 días)
    fleet.forEach(vehicle => {
      if (vehicle.lastUpdate) {
        const lastUpdate = new Date(vehicle.lastUpdate);
        const daysSince = Math.floor((today - lastUpdate) / (1000 * 60 * 60 * 24));
        
        if (daysSince > 7) {
          alerts.push({
            id: `stale-${vehicle.id}`,
            type: 'info',
            title: 'Sin Actualizar',
            message: `${vehicle.plate} - Hace ${daysSince} días`,
            vehicle: vehicle.plate,
            priority: 'low'
          });
        }
      }
    });

    // Ordenar por prioridad
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    setNotifications(alerts);

    // Reproducir sonido si hay alertas críticas nuevas
    if (soundEnabled && alerts.some(a => a.priority === 'high')) {
      playNotificationSound();
    }
  }, [fleet, workOrders, soundEnabled]);

  const playNotificationSound = () => {
    // Beep simple con Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.1;
    
    oscillator.start();
    setTimeout(() => oscillator.stop(), 200);
  };

  const getIcon = (type) => {
    switch (type) {
      case 'error': return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default: return <Clock className="w-5 h-5 text-blue-600" />;
    }
  };

  const getColor = (type) => {
    switch (type) {
      case 'error': return 'bg-red-50 border-red-200 text-red-800';
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default: return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const criticalCount = notifications.filter(n => n.priority === 'high').length;

  return (
    <div className="relative">
      {/* Badge Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <Bell className="w-6 h-6 text-slate-600" />
        {notifications.length > 0 && (
          <span className={`absolute -top-1 -right-1 ${criticalCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-blue-500'} text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center`}>
            {notifications.length}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-2xl border border-slate-200 z-50 max-h-[500px] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Notificaciones
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {notifications.length} alertas activas
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="p-1.5 hover:bg-slate-200 rounded transition-colors"
                    title={soundEnabled ? 'Desactivar sonido' : 'Activar sonido'}
                  >
                    {soundEnabled ? 
                      <Bell className="w-4 h-4 text-blue-600" /> : 
                      <BellOff className="w-4 h-4 text-slate-400" />
                    }
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-slate-200 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
              </div>
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="font-medium">No hay notificaciones</p>
                  <p className="text-sm mt-1">Todo está bajo control</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {notifications.map(notification => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-slate-50 transition-colors border-l-4 ${
                        notification.priority === 'high' ? 'border-l-red-500' :
                        notification.priority === 'medium' ? 'border-l-yellow-500' :
                        'border-l-blue-500'
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-800">
                            {notification.title}
                          </p>
                          <p className="text-sm text-slate-600 mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-slate-400 mt-2">
                            {notification.vehicle}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-slate-200 bg-slate-50">
                <button
                  onClick={() => {
                    setNotifications([]);
                    setIsOpen(false);
                  }}
                  className="w-full text-sm text-slate-600 hover:text-slate-800 font-medium"
                >
                  Marcar todas como leídas
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
