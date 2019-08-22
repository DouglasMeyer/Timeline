import React, { useState, useEffect, useRef, useCallback } from 'react';

const useWorker = (worker, onmessage, onerror) => {
  const workerRef = useRef(worker);
  useEffect(() => {
    worker.onmessage = onmessage;
    worker.onerror = onerror;
    return () => worker.terminate();
  }, []);
  return worker.postMessage.bind(worker);
};

const getYearFrac = ([ year, month=1, day=1 ]) => ((day-1)/30 + month-1)/12 + year;
const sortBy = (array, fn) => array.sort((a, b) => fn(a) - fn(b));
Array.prototype.sortBy = function(fn) { return sortBy(this, fn); };

const App = () => {
  const [ range, setRange ] = useState([ [], [] ]);
  const [ popup, setPopup ] = useState();
  const [ items, setItems ] = useState();

  const itemFetcherPost = useWorker(new Worker('./item_fetcher.js'),
    ({ data: { items } }) => {
      if (range[0].length === 0 && range[1].length === 0) {
        const earliest = items.slice()
          .filter(({ date, startDate }) => date || startDate)
          .sortBy(({ date, startDate }) => getYearFrac(date || startDate))[0].date;
        const latest = items.slice()
          .filter(({ date, endDate }) => date || endDate)
          .sortBy(({ date, endDate }) => -getYearFrac(date || endDate))[0].date;
        setRange([ earliest, latest ]);
      }
      setItems(items);
    },
    console.error.bind(console, 'from worker')
  );
  useEffect(() => {
    itemFetcherPost({ startDate: range[0], endDate: range[1] });
  }, [ range ]);

  const startYear = range[0] && range[0][0] || 0;
  const endYear = (range[1] && range[1][0] || 2000) + 1;
  const delta = endYear - startYear;
  const width = 400;
  const widthPadding = 17;

  return <>
    <svg viewBox={`${-widthPadding} 0 ${width+2*widthPadding} 300`}>
    { new Array(endYear-startYear+1).fill()
      .map((_,i) => i + startYear)
      .filter((year, index, array) =>
        index === 0 || index === array.length-1 ||
        array.length < 20 || year % 10 === 0
      )
      .map(year => {
        const x = Math.round(year - startYear) / delta * 400;
        return <g key={year}>
          <line x1={x} y1="0" x2={x} y2="300" stroke="lightGray" />
          <text x={x} y="280" textAnchor="middle">{Math.round(year)}</text>
        </g>;
      }) }
      { items && items.map((item, index) => {
        const { date, startDate, endDate, description } = item;
        const x1 = (getYearFrac(date || startDate || [startYear]) - startYear) / delta * width;
        const x2 = (getYearFrac(date || endDate || [endYear]) - startYear) / delta * width;
        const y = 100 + index * (index % 2 === 0 ? 3 : -3);
        return <line key={index} stroke="black" strokeWidth="3" strokeLinecap="round"
          x1={x1} y1={y}
          x2={x2} y2={y}
          onMouseEnter={({ clientX: x, clientY: y }) => setPopup({ x, y, item }) }
          onMouseLeave={({ clientX: x, clientY: y }) => setPopup(null) }
        />
      }) }
    </svg>
    { popup &&
      <div className="popup" style={{ top: popup.y+20, left: popup.x+10 }}>
        { popup.item.date
          ? popup.item.date.join('-')
          : `${popup.item.startDate ? popup.item.startDate.join('-') : ''} - ${popup.item.endDate ? popup.item.endDate.join('-') : ''}`
        }
        {' '}
        <p>{popup.item.description}</p>
      </div>
    }
  </>;
};

export default App;
