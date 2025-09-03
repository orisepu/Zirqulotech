import { PieChart } from '@mui/x-charts/PieChart';
import { legendClasses } from '@mui/x-charts/ChartsLegend';

export function PipelinePie({ pipeline, num }: { pipeline: any[]; num: (n:number)=>string }) {
  const data = (pipeline || []).map((r, i) => ({
    id: i,
    value: Number(r.total || 0),
    label: r.estado || '—',
  }));
  const total = data.reduce((a, d) => a + d.value, 0);

  return (
    <PieChart
      series={[{
        data,
        innerRadius: 20,
        outerRadius: 100,
        paddingAngle: 5,
        cornerRadius: 5,
        startAngle: -45,
        endAngle: 225,
        cx: 160,
        cy: 130,
        }]}
      height={250}
      // Leyenda a la derecha, en columna, con pequeño tuning de spacing
      slotProps={{
        legend: {
          direction: 'horizontal',
          position: { vertical: 'middle', horizontal: 'end' },
          sx: {
            gap: 1,
            [`.${legendClasses.mark}`]: { width: 12, height: 12 },
          },
        },
      }}
      // Opcional: colores propios
      // colors={['#5B8DEF', '#36CFC9', '#73D13D', '#FADB14', '#FF7A45', '#9254DE']}
    />
  );
}

// Uso:
// <PipelinePie pipeline={pipeline} num={num} />
