import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

const STATUS_LABELS = {
  OPERATIVO: 'Operativos',
  MANTENIMIENTO: 'En Mantenimiento',
  'FUERA DE SERVICIO': 'Fuera de Servicio',
};

const STATUS_COLORS = {
  OPERATIVO: '#10b981',
  MANTENIMIENTO: '#f59e0b',
  'FUERA DE SERVICIO': '#ef4444',
};

export default function BIFleetStatusDonut({ metrics, activeStatus, onToggleStatus }) {
  const seriesData = useMemo(() => {
    const items = [
      { status: 'OPERATIVO', value: metrics.operative ?? 0 },
      { status: 'MANTENIMIENTO', value: metrics.inMaintenance ?? 0 },
      { status: 'FUERA DE SERVICIO', value: metrics.outOfService ?? 0 },
    ];

    return items.map((it) => ({
      name: STATUS_LABELS[it.status] || it.status,
      value: it.value,
      status: it.status,
      itemStyle: { color: STATUS_COLORS[it.status] },
      selected: activeStatus === it.status,
    }));
  }, [metrics, activeStatus]);

  const option = useMemo(
    () => ({
      tooltip: {
        trigger: 'item',
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        textStyle: { color: '#0f172a' },
      },
      legend: {
        bottom: 0,
        left: 'center',
        textStyle: { color: '#334155' },
      },
      series: [
        {
          type: 'pie',
          radius: ['55%', '80%'],
          center: ['50%', '45%'],
          selectedMode: 'single',
          selectedOffset: 8,
          avoidLabelOverlap: true,
          label: {
            show: true,
            formatter: '{b}: {c}',
            color: '#334155',
          },
          labelLine: { show: true },
          data: seriesData,
        },
      ],
    }),
    [seriesData]
  );

  const onEvents = useMemo(
    () => ({
      click: (params) => {
        const status = params?.data?.status;
        if (!status) return;
        onToggleStatus?.(status);
      },
    }),
    [onToggleStatus]
  );

  return (
    <ReactECharts
      option={option}
      onEvents={onEvents}
      style={{ height: 300, width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  );
}
