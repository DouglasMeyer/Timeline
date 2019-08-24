import React, { useState, useEffect, useRef } from 'react';

const useWorker = (workerPath, onmessage, onerror) => {
  const workerRef = useRef();
  useEffect(() => {
    workerRef.current = new Worker(workerPath);
    return () => workerRef.current.terminate();
  }, []);
  useEffect(() => {
    workerRef.current.onmessage = onmessage;
    workerRef.current.onerror = onerror;
  }, [ onmessage, onerror ]);
  return data => workerRef.current.postMessage(data);
};

class Time {
  static fromFrac(yearFrac){
    return new Time(
      Math.floor(yearFrac),
      Math.floor(yearFrac*12 % 12)+1, // FIXME mod
      Math.floor(yearFrac*12*30 % 30 + 1) // FIXME mod
    );
  }
  constructor(...args) {
    this.precision = args.length;
    const [ year, month, ...more ] = args;
    this.date = new Date(Date.UTC(year, month-1, ...more));
  }
  toString() {
    return this.toArgs().join('-');
  }
  toArgs() {
    return [
      this.date.getUTCFullYear(),
      this.date.getUTCMonth()+1,
      this.date.getUTCDate(),
      this.date.getUTCHours(),
      this.date.getUTCMinutes(),
      this.date.getUTCSeconds(),
      this.date.getUTCMilliseconds()
    ].slice(0, this.precision);
  }
  add(...add) {
    const args = this.toArgs();
    const precision = Math.max(this.precision, add.length);
    const newArgs = new Array(precision).fill().map((_, i) =>
      (args[i] || 0) + (add[i] || 0)
    );
    return new Time(...newArgs);
  }
  yearFrac() {
    return ((this.date.getUTCDate()-1)/30 + this.date.getUTCMonth())/12 + this.date.getUTCFullYear();
  }
}

const sortBy = (array, fn) => array.sort((a, b) => fn(a) - fn(b));
Array.prototype.sortBy = function(fn) { return sortBy(this, fn); };

// parcel loading workaround
new Worker('./item_fetcher.js').terminate();

const App = () => {
  const [ range, setRange ] = useState([ null, null ]);
  const [ popup, setPopup ] = useState();
  const [ items, setItems ] = useState();

  const itemFetcherPost = useWorker('./item_fetcher.js',
    ({ data: { items } }) => {
      items.forEach(item => {
        if (item.date) item.date = new Time(...item.date);
        if (item.startDate) item.startDate = new Time(...item.startDate);
        if (item.endDate) item.endDate = new Time(...item.endDate);
      });
      if (!range[0] && !range[1]) {
        const earliest = items.slice()
          .filter(({ date, startDate }) => date || startDate)
          .sortBy(({ date, startDate }) => (date || startDate).yearFrac())[0].date;
        const latest = items.slice()
          .filter(({ date, endDate }) => date || endDate)
          .sortBy(({ date, endDate }) => -(date || endDate).yearFrac())[0].date;
        setRange([ earliest, latest ]);
      }
      setItems(items);
    },
    console.error.bind(console, 'from worker')
  );
  const timeout = useRef();
  useEffect(() => {
    if (timeout.current) return;
    timeout.current = requestAnimationFrame(() => {
      timeout.current = null;
      itemFetcherPost({ startDate: range[0], endDate: range[1] });
    });
  }, [ range ]);
  useEffect(() => {
    let x, y;
    x = y = 0;
    let raf = null;
    const fn = ({ deltaX, deltaY }) => {
      x += deltaX;
      y += deltaY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        setRange((range) => {
          const [ startFrac, endFrac ] = range.map((date, index) => date ? date.yearFrac() : index ? 2000 : 0)
          const delta = endFrac - startFrac;
          return [
            range[0].add(0, 0, (x-y)*delta/10),
            range[1].add(0, 0, (x+y)*delta/10)
          ];
        });
        x = y = 0;
      });
    };
    addEventListener('wheel', fn);
    return () => removeEventListener('wheel', fn);
  }, []);

  const [ startFrac, endFrac ] = range.map((date, index) => date ? date.yearFrac() : index ? 2000 : 0)
  const delta = endFrac - startFrac;
  const width = 400;
  const widthPadding = 17;

  const count = Math.round(width / 35);
  let scale = 1;
  const endScaleFrac = (scale) => Math.floor(startFrac) + (count-1)*scale;
  // 1 -> 2 -> 5 -> 10 -> 20 -> 50 -> 100 -> 200 -> 300 -> 400 -> ...
  if (endScaleFrac(scale) < endFrac) scale = 2;
  if (endScaleFrac(scale) < endFrac) scale = 5;
  if (endScaleFrac(scale) < endFrac) scale = 10;
  if (endScaleFrac(scale) < endFrac) scale = 20;
  if (endScaleFrac(scale) < endFrac) scale = 50;
  if (endScaleFrac(scale) < endFrac) scale = 100;
  while (endScaleFrac(scale) < endFrac) {
    scale+=100;
  }
  // 1 -> 1/2 -> 1/4 -> 1/12
  if (endScaleFrac(1/2) > endFrac) scale = 1/2;
  if (endScaleFrac(1/4) > endFrac) scale = 1/4;
  if (endScaleFrac(1/12) > endFrac) scale = 1/12;

  return <>
    <svg viewBox={`${-widthPadding} 0 ${width+2*widthPadding} 300`}>
      { new Array(count).fill()
        .map((_, i) =>
          Math.floor(startFrac) - Math.floor(startFrac)%Math.max(1, scale) + i*scale
        )
        .map(yearFrac => {
          const x = (yearFrac - startFrac) / delta * 400;
          return <g key={yearFrac}>
            <line x1={x} y1="0" x2={x} y2="300" stroke="lightGray" />
            <text x={x} y="280" textAnchor="middle">{Time.fromFrac(yearFrac).toArgs().slice(0,2).join('-')}</text>
          </g>;
        })
      }
      { items && items.map((item, index) => {
        const { date, startDate, endDate } = item;
        const x1 = ((date || startDate || range[0]).yearFrac() - startFrac) / delta * width;
        const x2 = ((date || endDate || range[1]).yearFrac() - startFrac) / delta * width;
        if (x1 > x2) return;
        const y = 100 + index * (index % 2 === 0 ? 3 : -3);
        return <line key={index} stroke="black" strokeWidth="3" strokeLinecap="round"
          x1={x1} y1={y}
          x2={x2} y2={y}
          onMouseEnter={({ clientX: x, clientY: y }) => setPopup({ x, y, item }) }
          onMouseLeave={() => setPopup(null) }
        />
      }) }
    </svg>
    { popup &&
      <div className="popup" style={{ top: popup.y+20, left: popup.x+10 }}>
        { popup.item.date
          ? popup.item.date.toString()
          : `${popup.item.startDate ? popup.item.startDate.toString() : ''} - ${popup.item.endDate ? popup.item.endDate.toString() : ''}`
        }
        {' '}
        <p>{popup.item.description}</p>
      </div>
    }
  </>;
};

export default App;
