<script setup>
// A Chart.js chart drawn in the theme: series colors are role names (state-active, state-retry…) resolved from the
// CSS tokens, so every theme — dark ones included — gets its own colors; the chart is rebuilt when the theme or the
// flat look changes and updated in place (no animation) when the data changes.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'

Chart.register(BarController, BarElement, CategoryScale, Filler, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip)

const props = defineProps({
  type: { type: String, default: 'line' }, // line | bar
  labels: Array, // category labels (bar charts)
  series: { type: Array, required: true }, // [{ label, data, color }] — data: numbers, or { x: unix seconds, y } with time
  stacked: Boolean,
  horizontal: Boolean,
  time: Boolean, // x is a time axis (unix seconds)
  area: Boolean, // fill under the lines
  yFormat: { type: Function, default: (v) => v.toLocaleString() },
  label: { type: String, required: true }, // accessible name of the chart
})

const canvas = ref(null)
const probe = ref(null)
let chart = null

// paint resolves a role (or any CSS color) to #rrggbbaa, through a probe element and a 1×1 canvas: computed colors may
// be oklch() or light-dark(), which Chart.js cannot parse or fade.
const px = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
function paint(role, alpha = 1) {
  probe.value.style.color = role.startsWith('#') || role.includes('(') ? role : `var(--color-${role})`
  px.clearRect(0, 0, 1, 1)
  px.fillStyle = getComputedStyle(probe.value).color
  px.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = px.getImageData(0, 0, 1, 1).data
  const hex = (n) => Math.round(n).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}${hex(a * alpha)}`
}

// the system asks for less motion: no hover transition either (CSS cannot reach a canvas)
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches

const fmtTime = (sec, long) =>
  new Date(sec * 1000).toLocaleString([], long ? { dateStyle: 'medium', timeStyle: 'medium' } : { hour: '2-digit', minute: '2-digit' })

function datasets() {
  return props.series.map((s) => ({
    label: s.label,
    data: s.data,
    borderColor: paint(s.color),
    backgroundColor: props.type === 'line' ? paint(s.color, props.area ? 0.14 : 1) : paint(s.color, 0.9),
    fill: props.area,
    // monotone: smooth, but never above or below the data between two points (a plain curve overshoots)
    cubicInterpolationMode: 'monotone',
    borderWidth: props.type === 'line' ? 2 : 0,
    pointRadius: 0,
    pointHoverRadius: 4,
    pointHoverBorderWidth: 2,
    pointHoverBackgroundColor: paint('surface'),
    pointHitRadius: 12,
    maxBarThickness: 34,
  }))
}

function build() {
  chart?.destroy()
  const text = paint('fg-muted')
  const grid = paint('line')
  const font = { family: getComputedStyle(document.body).fontFamily, size: 11 }
  const value = props.horizontal ? 'x' : 'y'
  const cat = props.horizontal ? 'y' : 'x'
  chart = new Chart(canvas.value, {
    type: props.type,
    data: { labels: props.labels, datasets: datasets() },
    options: {
      indexAxis: props.horizontal ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      // no animation on load or on a refresh, but the hover (point, tooltip) moves smoothly instead of jumping
      // reduced motion: no animation at all (duration 0 still leaves Chart.js' 200ms fades, the tooltip's included)
      animation: still() ? false : { duration: 0 },
      transitions: { active: { animation: { duration: still() ? 0 : 120 } } },
      // every series at the nearest category (or time) along the category axis, wherever the pointer is above it
      interaction: { mode: 'index', intersect: false, axis: props.horizontal ? 'y' : 'x' },
      hover: { mode: 'index', intersect: false, axis: props.horizontal ? 'y' : 'x' },
      font,
      scales: {
        [cat]: {
          type: props.time ? 'linear' : 'category',
          stacked: props.stacked,
          grid: { display: props.time, color: grid },
          border: { color: grid },
          // no callback key at all on a category axis: an undefined one replaces Chart.js' label lookup
          ticks: { color: text, font, maxRotation: 0, autoSkipPadding: 16, ...(props.time && { callback: (v) => fmtTime(v) }) },
        },
        [value]: {
          stacked: props.stacked,
          beginAtZero: true,
          grid: { color: grid },
          border: { display: false },
          ticks: { color: text, font, ...(!props.time && { precision: 0 }), callback: (v) => props.yFormat(v) },
        },
      },
      plugins: {
        legend: {
          position: 'bottom',
          onClick: () => {}, // the legend only names the series (a canvas toggle is out of reach of the keyboard)
          labels: { color: text, font, boxWidth: 10, boxHeight: 10, padding: 12 },
        },
        tooltip: {
          animation: { duration: still() ? 0 : 120 },
          position: 'nearest',
          caretPadding: 8,
          backgroundColor: paint('tooltip'),
          titleColor: paint('on-tooltip'),
          bodyColor: paint('on-tooltip'),
          borderColor: paint('tooltip-bar'),
          borderWidth: 1,
          cornerRadius: 0,
          titleFont: { ...font, weight: '600' },
          bodyFont: font,
          boxPadding: 4,
          callbacks: {
            ...(props.time && { title: (items) => items[0] && fmtTime(items[0].parsed.x, true) }),
            label: (c) => ` ${c.dataset.label}: ${props.yFormat(c.parsed[value])}`,
          },
        },
      },
    },
    plugins: [guide(text)],
  })
}

// a line chart's guide: a vertical line at the point under the pointer, so the day (or time) read is plain
const guide = (color) => ({
  id: 'guide',
  afterDatasetsDraw(c) {
    const active = c.tooltip?.getActiveElements?.()
    if (props.type !== 'line' || !active?.length) return
    const x = active[0].element.x
    const { top, bottom } = c.chartArea
    c.ctx.save()
    c.ctx.strokeStyle = color
    c.ctx.lineWidth = 1
    c.ctx.setLineDash([4, 3])
    c.ctx.beginPath()
    c.ctx.moveTo(x, top)
    c.ctx.lineTo(x, bottom)
    c.ctx.stroke()
    c.ctx.restore()
  },
})

const observer = new MutationObserver(build)
onMounted(() => {
  build()
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-flat'] })
})
// a new type, stacking or axis needs a new chart; new data only an update
watch(() => [props.type, props.stacked, props.horizontal, props.time, props.area], build)
watch(
  () => [props.series, props.labels],
  () => {
    if (!chart) return
    chart.data.labels = props.labels
    chart.data.datasets = datasets()
    chart.update('none')
  },
  { deep: true },
)
// the same data as a table for screen readers: categories × series, or for time series the latest, lowest and
// highest value of each series
const table = computed(() => {
  if (!props.time)
    return {
      head: ['', ...props.series.map((s) => s.label)],
      rows: (props.labels || []).map((l, i) => [l, ...props.series.map((s) => props.yFormat(s.data[i] ?? 0))]),
    }
  return {
    head: ['', 'Latest', 'Lowest', 'Highest'],
    rows: props.series.map((s) => {
      const ys = s.data.map((p) => p.y)
      return [s.label, ...[ys.at(-1) ?? 0, Math.min(...ys), Math.max(...ys)].map((v) => props.yFormat(v))]
    }),
  }
})
onBeforeUnmount(() => {
  observer.disconnect()
  chart?.destroy()
})
</script>

<template>
  <div class="relative h-full w-full">
    <span ref="probe" class="hidden"></span>
    <canvas ref="canvas" role="img" :aria-label="label"></canvas>
    <!-- hidden in a wrapper: a caption sits outside the table box, so an sr-only table would still show it -->
    <div class="sr-only">
      <table>
        <caption>
          {{
            label
          }}
        </caption>
        <thead>
          <tr>
            <th v-for="(h, i) in table.head" :key="i" scope="col">{{ h }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in table.rows" :key="i">
            <th scope="row">{{ r[0] }}</th>
            <td v-for="(c, j) in r.slice(1)" :key="j">{{ c }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
