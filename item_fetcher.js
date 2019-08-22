import timeline from './family_timeline.json';

onmessage = function(event) {
  postMessage({ items: timeline });
}