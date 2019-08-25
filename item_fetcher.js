const xmlRegexp = /<([^/].*?)>(.*)(?=<\/\1>)/g;
const parseHistory = xml =>
  xml.match(/(?<=<event>).*?(?=<\/event>)/g)
    .map(eventXML => {
      const event = {};

      let result;
      // eslint-disable-next-line no-cond-assign
      while(result = xmlRegexp.exec(eventXML)) {
        const [ _match, key, value ] = result;
        if (key === 'date') {
          event[key] = value.split('/');
        } else if (key === 'description') {
          event[key] = value
            .replace(/^<!\[CDATA\[(.*)\]\]>$/, '$1')
            .replace(/^\s+/, '')
            .replace(/ampnbsp/g, '&nbsp;')
            .replace(/ampampndash/g, '&ndash;')
            .replace(/ampquot/g, '&quot;')
            .replace(/ampref .*?\/amp/g, '')
            .replace(/{{convert|(.*?)|(.*?)|.*?}}/g, '$1$2') // {{convert|600|ft|m|sing=on}}
            .replace(/(ampamp)?{{cite .*?}}(ampamp)?/g, '');
        } else {
          event[key] = value;
        }
      }
      return event;
    });

onmessage = function({ data: { startDate, endDate } }) {

  console.log({ startDate, endDate });
  // &limit=100&related=true
  // fetch(`http://www.vizgr.org/historical-events/search.php?begin_date=${startDate ? startDate.toArgs().slice(0,3).join('') : '20000101'}&end_date=${endDate ? endDate.toArgs().slice(0,3).join('') : '20001231'}`)
  fetch('./history.xml')
    .then(response => response.text())
    .then(xml => {
      const items = parseHistory(xml);
      this.postMessage({ items: items.sort(() => Math.random() - 0.5).slice(-100) })
    });
}