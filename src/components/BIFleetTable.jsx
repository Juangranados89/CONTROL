import React, { useMemo } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';

export default function BIFleetTable({
  data,
  selectedVehicle,
  onRowClick,
  pageSize = 50,
}) {
  const columns = useMemo(
    () => [
      {
        header: 'Código',
        accessorKey: 'code',
        cell: (info) => info.getValue() || '—',
      },
      {
        header: 'Placa',
        accessorKey: 'plate',
        cell: (info) => info.getValue() || '—',
      },
      {
        header: 'Modelo',
        accessorKey: 'model',
        cell: (info) => info.getValue() || '—',
      },
      {
        header: 'Estado',
        accessorKey: 'status',
        cell: (info) => info.getValue() || '—',
      },
      {
        header: 'KM',
        accessorKey: 'mileage',
        cell: (info) => {
          const v = info.getValue();
          const n = typeof v === 'number' ? v : parseInt(String(v || '0'), 10);
          return Number.isFinite(n) ? n.toLocaleString() : '—';
        },
      },
      {
        header: 'Conductor',
        accessorKey: 'driver',
        cell: (info) => info.getValue() || '—',
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageIndex: 0, pageSize },
    },
  });

  const canPrev = table.getCanPreviousPage();
  const canNext = table.getCanNextPage();
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          Mostrando {table.getRowModel().rows.length.toLocaleString()} de{' '}
          {(data?.length || 0).toLocaleString()} filas
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!canPrev}
            className="px-3 py-1.5 text-sm font-semibold rounded-md border border-slate-200 text-slate-700 disabled:opacity-40"
          >
            Anterior
          </button>
          <div className="text-sm text-slate-600">
            Página {pageIndex + 1} / {Math.max(pageCount, 1)}
          </div>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!canNext}
            className="px-3 py-1.5 text-sm font-semibold rounded-md border border-slate-200 text-slate-700 disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left font-bold text-slate-700 whitespace-nowrap"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const original = row.original;
              const isSelected =
                !!selectedVehicle &&
                ((selectedVehicle.code && original.code === selectedVehicle.code) ||
                  (selectedVehicle.plate && original.plate === selectedVehicle.plate));

              return (
                <tr
                  key={row.id}
                  className={
                    "border-b border-slate-100 hover:bg-blue-50 cursor-pointer " +
                    (isSelected ? 'bg-blue-100' : 'bg-white')
                  }
                  onClick={() => onRowClick?.(original)}
                  title="Clic para filtrar el dashboard por este vehículo"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 whitespace-nowrap text-slate-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
